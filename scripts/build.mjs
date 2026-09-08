/**
 * 字体分片构建脚本
 *
 * 读取 fonts.config.json 的任务清单：
 * - type: "split" —— cn-font-split 分片（CJK 大字体）：产物为 result.css + {family}-v-{index}.woff2
 * - type: "copy"  —— 直接拷贝（小型拉丁/等宽字体，无需分片）
 *
 * 分片策略（fonts.config.json 的 defaults + 每个任务可覆盖）：
 * - languageAreas: 同语言字符聚到同片（中文页命中更集中）
 * - autoSubset + chunkSize（默认按工具内置目标大小）——分片过大自动再拆
 * - reduceMins: 合并碎片小包，减少请求数
 * - fontFeature: 保留连字/字距等特性（等宽/代码字体需要）
 * - css.fontDisplay: "swap" —— 不阻塞渲染
 *
 * 源字体放 sources/（.otf/.ttf 不进 git，下载地址见每个任务的 download 字段）。
 * 用法：pnpm build
 */
import { readFile, access, cp, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
// 注意用 WASM 入口而不是包主入口：主入口的 Node FFI 后端依赖未随包分发的
// libffi dylib，加载会异步崩溃（ERR_FFI / OOM）；WASM 版纯 JS、跨平台、无 native 依赖
import { fontSplit } from 'cn-font-split/dist/wasm/index.mjs';

const CONFIG_PATH = new URL('../fonts.config.json', import.meta.url);

async function pathExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
const results = [];

for (const task of config.fonts) {
  const { name, label, source } = task;
  if (!(await pathExists(source))) {
    results.push({ name, status: '跳过', reason: `源文件缺失：${source}（下载：${task.download ?? '—'}）` });
    continue;
  }

  if (task.type === 'copy') {
    await mkdir(task.target, { recursive: true });
    await cp(task.source, task.target, { recursive: true });
    results.push({ name, status: '完成', reason: `拷贝 ${source} → ${task.target}` });
    continue;
  }

  await fontSplit({
    input: source,
    outDir: task.outDir ?? task.name,
    targetType: config.defaults.targetType,
    // 产物命名保持既有形态：{family}-v-{index}.woff2（主站 CSS 与缓存依赖此形态）
    renameOutputFont: `${task.family}-v-[index].[ext]`,
    css: {
      fontFamily: task.family,
      // 字重轴（如 VF 的 "200 900"）不写死：cn-font-split 会从字体 metadata 读取，
      // 如需覆盖再在此处加 fontWeight
      ...config.defaults.css,
    },
    testHtml: config.defaults.testHtml,
    reporter: config.defaults.reporter,
    languageAreas: config.defaults.languageAreas,
    autoSubset: config.defaults.autoSubset,
    reduceMins: config.defaults.reduceMins,
    fontFeature: config.defaults.fontFeature,
    ...task.overrides,
  });
  results.push({ name, status: '完成', reason: `${label} → ${task.name}/result.css` });
}

console.log('\n===== 构建结果 =====');
for (const r of results) console.log(`[${r.status}] ${r.name}：${r.reason}`);
const failed = results.filter((r) => r.status === '跳过');
if (failed.length > 0) {
  console.log(`\n${failed.length} 个任务因缺源跳过。把对应源字体放入 sources/ 后重跑 pnpm build。`);
}
