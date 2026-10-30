// 本地补丁：把 ai-companion-kit 的 qzone-mcp 挂进 DSH。
// 只补一件事——告诉它 qq-bridge 的 config.json 在哪（它自带的候选路径里没有这一层）。
// 发说说/看动态/点赞的逻辑全在原包里，没有改动。
//
// 路径全部相对本文件推算，不写死盘符：
//   本文件        <根>\qqbridge\qq-bridge\src\mcp-qzone.js
//   config.json   <根>\qqbridge\qq-bridge\config.json
//   ai-companion-kit  <根>\qqbridge\ai-companion-kit
// 需要覆盖时用环境变量 QZONE_CONFIG / QZONE_KIT_DIR。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT_DIR = process.env.QZONE_KIT_DIR || path.resolve(HERE, '..', '..', 'ai-companion-kit');

process.env.QZONE_CONFIG = process.env.QZONE_CONFIG || path.resolve(HERE, '..', 'config.json');

await import(pathToFileURL(path.join(KIT_DIR, 'packages', 'qzone-mcp', 'src', 'qzone-mcp.js')).href);
