// 全栈看门狗：只要它还活着，整套服务就能自己恢复。
//
// 管四件事（每 60 秒一轮）：
//   5099  SnowLuma 没在监听      → 拉起 <根目录>\SnowLuma\start-snowluma.bat
//   3080  DSH web 没在监听       → 拉起 start-dsh-web.bat
//   3100  qq-bridge 没在监听     → 拉起 start.bat
//   3001  SnowLuma 活着但桥接没连上（连续 2 次）→ 重启桥接进程
//
// 为什么要它：那些 bat 自带的守护循环只在"窗口还在"时有效。窗口被关、被系统清理、
// 或者进程连崩几次之后，就没人管了 —— 实锤过两次（2026-10-26 晚 22:51 全套挂掉，
// 只剩 DSH 活着，没有任何东西去拉 SnowLuma 和桥接）。
//
// 单实例：占住 127.0.0.1:3111，重复启动会自动退出。
// 日志：state/watchdog.log
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STATE = path.join(ROOT, 'state');
const LOG = path.join(STATE, 'watchdog.log');
const CONFIG = path.join(ROOT, 'config.json');

const CHECK_MS = 60_000;
const COOLDOWN_MS = 180_000;
const FAILS_BEFORE_RESTART = 2;

// 根目录 = 桥接目录的上一级（<根>\qqbridge\qq-bridge → <根>）。SnowLuma 跟着根目录走，
// 整个 D:\whale 搬到别处也不用改这里。
const BASE = path.resolve(ROOT, '..', '..');
const SNOWLUMA_BAT = path.join(BASE, 'SnowLuma', 'start-snowluma.bat');

const SERVICES = [
  { name: 'SnowLuma', port: 5099, bat: SNOWLUMA_BAT, host: '127.0.0.1' },
  { name: 'DSH web', port: 3080, bat: path.join(ROOT, 'start-dsh-web.bat'), host: '127.0.0.1' },
  { name: 'qq-bridge', port: 3100, bat: path.join(ROOT, 'start.bat'), host: '127.0.0.1' }
];

let fails = 0;
let lastRestartAt = 0;
const lastNote = new Map();
const lastSpawnAt = new Map();

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + '\n', 'utf8');
    if (fs.statSync(LOG).size > 512 * 1024) fs.writeFileSync(LOG, line + '\n', 'utf8');
  } catch {}
}

function note(key, msg) {
  if (lastNote.get(key) === msg) return;
  lastNote.set(key, msg);
  log(msg);
}

function readCfg() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function listening(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    return out
      .split(/\r?\n/)
      .some((l) => new RegExp(`127\\.0\\.0\\.1:${port}\\s`).test(l) && /LISTENING/i.test(l));
  } catch {
    return false;
  }
}

function findPidByPort(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const line = out
      .split(/\r?\n/)
      .find((l) => new RegExp(`127\\.0\\.0\\.1:${port}\\s`).test(l) && /LISTENING/i.test(l));
    const pid = line ? line.trim().split(/\s+/).pop() : '';
    return /^\d+$/.test(pid) ? Number(pid) : null;
  } catch {
    return null;
  }
}

function wsEstablished(port = 3001) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    return out.split(/\r?\n/).some((l) => new RegExp(`:${port}\\s`).test(l) && /ESTABLISHED/i.test(l));
  } catch {
    return false;
  }
}

async function snowlumaHttpUp() {
  const cfg = readCfg();
  const url = String(cfg?.snowluma?.httpUrl || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const token = String(cfg?.snowluma?.accessToken || '');
  try {
    const res = await fetch(`${url}/get_status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: '{}',
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return false;
    const j = await res.json().catch(() => ({}));
    return j?.status === 'ok' && j?.retcode === 0;
  } catch {
    return false;
  }
}

/** 用 start /min 开一个新窗口跑 bat —— 必须要有控制台，DETACHED 会让 dsh 起不来。 */
function launchBat(batPath) {
  const now = Date.now();
  const last = lastSpawnAt.get(batPath) || 0;
  if (now - last < COOLDOWN_MS) {
    note(`spawn:${batPath}`, `跳过拉起 ${path.basename(batPath)}（冷却中，${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)} 秒后可再试）`);
    return;
  }
  lastSpawnAt.set(batPath, now);
  try {
    spawn('cmd.exe', ['/c', 'start', '', '/min', batPath], {
      cwd: path.dirname(batPath),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
    log(`拉起 ${path.basename(batPath)}`);
  } catch (e) {
    log(`拉起 ${path.basename(batPath)} 失败：${e?.message ?? e}`);
  }
}

function restartBridge() {
  const pid = findPidByPort(3100);
  if (!pid) {
    launchBat(path.join(ROOT, 'start.bat'));
    return;
  }
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    log(`重启桥接（kill PID ${pid}）`);
    lastRestartAt = Date.now();
    fails = 0;
  } catch (e) {
    log(`重启桥接失败：${e?.message ?? e}`);
  }
}

async function tick() {
  // 1) 三个端口：谁不在就拉谁
  for (const svc of SERVICES) {
    if (!listening(svc.port)) {
      note(`port:${svc.port}`, `${svc.name} :${svc.port} 没在监听，尝试拉起`);
      launchBat(svc.bat);
    } else {
      if (lastNote.get(`port:${svc.port}`)) note(`port:${svc.port}`, `${svc.name} :${svc.port} 已恢复监听`);
      lastNote.delete(`port:${svc.port}`);
    }
  }

  // 2) 桥接的 WebSocket 是否真的连上了 SnowLuma
  const httpUp = await snowlumaHttpUp();
  const ws = wsEstablished(3001);

  if (!httpUp) {
    note('ws', 'SnowLuma 的 OneBot 没响应：小号大概掉线了，需要打开 5099 扫码重新登录');
    fails = 0;
    return;
  }
  if (ws) {
    if (lastNote.get('ws')) note('ws', '恢复正常：桥接 WebSocket 已连上');
    fails = 0;
    return;
  }
  fails += 1;
  note('ws', `桥接 WebSocket 断开（连续第 ${fails} 次探测），SnowLuma 是活的`);
  if (fails >= FAILS_BEFORE_RESTART && Date.now() - lastRestartAt > COOLDOWN_MS) restartBridge();
}

log('看门狗启动：每 60 秒检查 5099 / 3080 / 3100 / 桥接WS(3001)');

const guard = net.createServer();
guard.once('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    log('已有看门狗在运行（3111 被占用），本次退出');
    process.exit(0);
  }
  log(`单实例守卫异常：${err?.message ?? err}`);
});
guard.listen(3111, '127.0.0.1', () => {
  void tick();
  setInterval(() => void tick(), CHECK_MS);
});
