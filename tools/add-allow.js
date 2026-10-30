// 一键加白名单：只给号码，自动判断是群还是私聊，放进对应的名单里。
//
// 用法：
//   node add-allow.js 123456789        → 好友，进 allow.private
//   node add-allow.js 987654321        → 群，自动识破，进 allow.groups
//   node add-allow.js g:987654321      → 强制当群处理
//   node add-allow.js p:123456789      → 强制当私聊处理
//   node add-allow.js --dry 123456      → 只预览，不写文件、不重启
//
// 为什么要自动判断：群里加错到 allow.private 是最常见的坑，
// 表现是"群里完全不回话"，而且控制台不会报任何错。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONFIG = path.join(ROOT, 'config.json');

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const raw = argv.find((a) => !a.startsWith('--'));
if (!raw) {
  console.log('用法：add-allow.js <QQ号 或 群号> [--dry]');
  process.exit(1);
}

let forced = null;
let idPart = raw;
if (/^g:/i.test(raw)) {
  forced = 'group';
  idPart = raw.slice(2);
} else if (/^p:/i.test(raw)) {
  forced = 'private';
  idPart = raw.slice(2);
}
const id = idPart.replace(/\s+/g, '');
if (!/^\d+$/.test(id)) {
  console.log('错误：号码必须是纯数字。');
  process.exit(1);
}
const num = Number(id);

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

/** 问协议端：这个号是不是机器人所在的群。 */
async function isGroupId(n) {
  const url = String(cfg?.snowluma?.httpUrl || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const token = String(cfg?.snowluma?.accessToken || '');
  try {
    const res = await fetch(`${url}/get_group_list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: '{}',
      signal: AbortSignal.timeout(8000)
    });
    const j = await res.json().catch(() => ({}));
    const list = Array.isArray(j?.data) ? j.data : [];
    const hit = list.find((g) => Number(g.group_id) === n);
    return hit ? { isGroup: true, name: hit.group_name, count: hit.member_count } : { isGroup: false };
  } catch {
    return { isGroup: false, offline: true };
  }
}

const probe = forced === 'group' ? { isGroup: true } : forced === 'private' ? { isGroup: false } : await isGroupId(num);
const kind = probe.isGroup ? 'group' : 'private';

cfg.allow = cfg.allow || {};
cfg.allow.private = Array.isArray(cfg.allow.private) ? cfg.allow.private : [];
cfg.allow.groups = Array.isArray(cfg.allow.groups) ? cfg.allow.groups : [];

const targetArr = kind === 'group' ? cfg.allow.groups : cfg.allow.private;

if (probe.offline) {
  console.log('提示：连不上协议端（3000），没法自动判断是不是群，按私聊处理。');
  console.log('      如果这其实是个群，请改成 g:' + id + ' 重新运行。');
}

if (targetArr.includes(num)) {
  console.log(`已经在${kind === 'group' ? '群' : '私聊'}白名单里了：${id}${probe.name ? `（${probe.name}）` : ''}`);
  console.log(`  当前私聊：${JSON.stringify(cfg.allow.private)}`);
  console.log(`  当前群  ：${JSON.stringify(cfg.allow.groups)}`);
  process.exit(0);
}

targetArr.push(num);

console.log(`${probe.name ? `识别为群「${probe.name}」(${probe.member_count}人)` : kind === 'group' ? '按群处理' : '按私聊好友处理'}`);
console.log(`将加入 ${kind === 'group' ? 'allow.groups' : 'allow.private'}：${id}`);
console.log(`  加完后的私聊：${JSON.stringify(cfg.allow.private)}`);
console.log(`  加完后的群  ：${JSON.stringify(cfg.allow.groups)}`);

if (dry) {
  console.log('（--dry：只预览，没有写文件）');
  process.exit(0);
}

fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('已写入 config.json');

// 重启桥接让新配置生效（守护 bat 会在 5 秒内拉起）
try {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const line = out.split(/\r?\n/).find((l) => /127\.0\.0\.1:3100\s/.test(l) && /LISTENING/i.test(l));
  const pid = line ? line.trim().split(/\s+/).pop() : '';
  if (pid && /^\d+$/.test(pid)) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    console.log(`已重启桥接（旧 PID ${pid}），约 5 秒后自动恢复`);
  } else {
    console.log('没找到监听 3100 的桥接进程，请手动跑一次 start-all.bat');
  }
} catch {
  console.log('自动重启失败，请手动跑一次 start-all.bat');
}
