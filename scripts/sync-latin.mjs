/**
 * 拉丁字族批量同步脚本（fontsource → english/）
 *
 * 数据源：@fontsource-variable/*（VF，woff2-variations）与 @fontsource/*（静态字重）。
 * 产物：english/{dir}/{dir}.css（合并包内全部样式声明，含斜体）
 *      + english/{dir}/files/（按 subset 分片的 woff2，unicode-range 按需加载）
 *
 * 命名规范（AGENTS/README 约定）：目录名 = family 名，全小写、连字符、
 * VF 以 -v 结尾（inter-v）；静态字重版不带 -v（ibm-plex-mono）。
 * 脚本会把 css 里 fontsource 原始 family 名（如 'Inter Variable'）重写为本规范名。
 *
 * 更新流程：pnpm update 相关包 → node scripts/sync-latin.mjs → 提交打 tag。
 */
import { readdir, readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/** 字族清单：dir 产物目录名（= 规范 family 名），pkg npm 包名
 *  keepSubsets：只保留这些 subset 的分片（fontsource 分片名形如 {font}-{subset}-{axis}-{style}.woff2）。
 *  中文站场景 latin/latin-ext 足够；需要西里尔/希腊等再放宽。 */
const FONTS = [
  // ---- 可变字体（-v 结尾） ----
  { dir: 'cascadia-mono-v', pkg: '@fontsource-variable/cascadia-mono' },
  { dir: 'source-serif-4-v', pkg: '@fontsource-variable/source-serif-4' },
  { dir: 'newsreader-v', pkg: '@fontsource-variable/newsreader' },
  { dir: 'literata-v', pkg: '@fontsource-variable/literata' },
  { dir: 'source-sans-3-v', pkg: '@fontsource-variable/source-sans-3' },
  { dir: 'inter-v', pkg: '@fontsource-variable/inter' },
  { dir: 'public-sans-v', pkg: '@fontsource-variable/public-sans' },
  { dir: 'work-sans-v', pkg: '@fontsource-variable/work-sans' },
  // ---- 静态字重（无 VF 发行，不带 -v） ----
  { dir: 'ibm-plex-sans', pkg: '@fontsource/ibm-plex-sans' },
  { dir: 'ibm-plex-serif', pkg: '@fontsource/ibm-plex-serif' },
  { dir: 'ibm-plex-mono', pkg: '@fontsource/ibm-plex-mono' },
  { dir: 'libre-baskerville', pkg: '@fontsource/libre-baskerville' },
  { dir: 'dm-serif-display', pkg: '@fontsource/dm-serif-display' },
];

const KEEP_SUBSETS = ['latin', 'latin-ext'];
const isKept = (filename) => KEEP_SUBSETS.some((s) => filename.includes(`-${s}-`));

const results = [];

for (const { dir, pkg } of FONTS) {
  const src = `node_modules/${pkg}`;
  if (!existsSync(src)) {
    results.push({ dir, status: '跳过', detail: `包未安装：${pkg}` });
    continue;
  }

  // 1) 拷贝分片文件（只保留 KEEP_SUBSETS 命中的 latin 系分片）
  const outDir = `english/${dir}`;
  await rm(outDir, { recursive: true, force: true });
  await mkdir(`${outDir}/files`, { recursive: true });
  let copied = 0;
  for (const f of await readdir(`${src}/files`)) {
    if (!f.endsWith('.woff2') || !isKept(f)) continue;
    await cp(`${src}/files/${f}`, `${outDir}/files/${f}`);
    copied++;
  }

  // 2) 合并包根目录全部 css（index.css 与默认字重 css 内容重复，跳过）
  const cssFiles = (await readdir(src)).filter((f) => f.endsWith('.css') && f !== 'index.css').sort();
  let merged = '';
  for (const f of cssFiles) merged += `\n/* ${f} */\n` + (await readFile(`${src}/${f}`, 'utf8'));

  // 3) family 名重写为规范名（全小写、连字符、VF 带 -v）
  const css = merged.replace(/font-family:\s*'[^']+';/g, `font-family: '${dir}';`);
  await writeFile(`${outDir}/${dir}.css`, css, 'utf8');

  const shards = copied;
  results.push({ dir, status: '完成', detail: `${cssFiles.length} 个 css 合并，${shards} 个分片` });
}

console.log('===== latin 字族同步结果 =====');
for (const r of results) console.log(`[${r.status}] ${r.dir}：${r.detail}`);
