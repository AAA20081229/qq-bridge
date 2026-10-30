// 把某个 QQ 号 / 群号加进「主动发言（proactive）白名单」。
// 用法：node add-proactive.js 123456789
//       node add-proactive.js g:876543210     ← 前缀 g: 表示群
//       node add-proactive.js --dry 123456     ← 只预览，不写
// 写完后会重启桥接（杀掉监听 3100 的进程，start.bat 守护 5 秒后拉起）。
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
  console.log('用法：add-proactive.js <QQ号 或 g:群号> [--dry]');
  process.exit(1);
}

const isGroup = /^g:/i.test(raw);
const id = raw.replace(/^g:/i, '').replace(/\s+/g, '');
if (!/^\d+$/.test(id)) {
  console.log('错误：号码必须是纯数字（群号请写成 g:群号）');
  process.exit(1);
}
const key = (isGroup ? 'group:' : 'private:') + id;

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
cfg.socialV2 = cfg.socialV2 || {};
cfg.socialV2.proactive = cfg.socialV2.proactive || {};
const only = Array.isArray(cfg.socialV2.proactive.only) ? cfg.socialV2.proactive.only : [];

if (only.includes(key)) {
  console.log(`已经在名单里了：${key}`);
  console.log('当前名单：', JSON.stringify(only));
  process.exit(0);
}
only.push(key);
cfg.socialV2.proactive.only = only;

console.log('将加入：', key);
console.log('加入后名单：', JSON.stringify(only));

if (dry) {
  console.log('（--dry：只预览，没有写文件）');
  process.exit(0);
}

fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('✔ 已写入 config.json');

// 重启桥接：找到监听 3100 的进程，杀掉让它自动重启读新配置
try {
  const out = execSync('netstat -ano', { encoding: 'utf8' });
  const line = out.split(/\r?\n/).find((l) => /127\.0\.0\.1:3100\s/.test(l) && /LISTENING/i.test(l));
  const pid = line ? line.trim().split(/\s+/).pop() : '';
  if (pid && /^\d+$/.test(pid)) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    console.log(`✔ 已重启桥接（旧 PID ${pid}），5 秒后自动拉起`);
  } else {
    console.log('⚠ 没找到监听 3100 的进程，请手动重启桥接');
  }
} catch {
  console.log('⚠ 自动重启失败，请手动关掉桥接窗口再重开');
}
