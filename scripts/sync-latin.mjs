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
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 每族每样式的「最全轴组合」文件（由 fontTools 从 woff2 fvar 表提取，scripts/extract-axes 生成）
const AXES_DATA = JSON.parse(readFileSync(new URL('../scripts/axes.json', import.meta.url), 'utf8'));

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
  { dir: 'noto-sans-v', pkg: '@fontsource-variable/noto-sans' },
  { dir: 'noto-serif-v', pkg: '@fontsource-variable/noto-serif' },
  { dir: 'roboto-flex-v', pkg: '@fontsource-variable/roboto-flex' },
  { dir: 'roboto-serif-v', pkg: '@fontsource-variable/roboto-serif' },
  { dir: 'open-sans-v', pkg: '@fontsource-variable/open-sans' },
  { dir: 'montserrat-v', pkg: '@fontsource-variable/montserrat' },
  { dir: 'raleway-v', pkg: '@fontsource-variable/raleway' },
  { dir: 'manrope-v', pkg: '@fontsource-variable/manrope' },
  { dir: 'space-grotesk-v', pkg: '@fontsource-variable/space-grotesk' },
  { dir: 'outfit-v', pkg: '@fontsource-variable/outfit' },
  { dir: 'plus-jakarta-sans-v', pkg: '@fontsource-variable/plus-jakarta-sans' },
  { dir: 'oswald-v', pkg: '@fontsource-variable/oswald' },
  { dir: 'archivo-v', pkg: '@fontsource-variable/archivo' },
  { dir: 'lora-v', pkg: '@fontsource-variable/lora' },
  { dir: 'playfair-display-v', pkg: '@fontsource-variable/playfair-display' },
  { dir: 'merriweather-v', pkg: '@fontsource-variable/merriweather' },
  { dir: 'fraunces-v', pkg: '@fontsource-variable/fraunces' },
  { dir: 'crimson-pro-v', pkg: '@fontsource-variable/crimson-pro' },
  { dir: 'bitter-v', pkg: '@fontsource-variable/bitter' },
  { dir: 'fira-code-v', pkg: '@fontsource-variable/fira-code' },
  { dir: 'inconsolata-v', pkg: '@fontsource-variable/inconsolata' },
  { dir: 'martian-mono-v', pkg: '@fontsource-variable/martian-mono' },
  { dir: 'spline-sans-mono-v', pkg: '@fontsource-variable/spline-sans-mono' },
  { dir: 'red-hat-mono-v', pkg: '@fontsource-variable/red-hat-mono' },
  { dir: 'eb-garamond-v', pkg: '@fontsource-variable/eb-garamond' },
  { dir: 'bodoni-moda-v', pkg: '@fontsource-variable/bodoni-moda' },
  { dir: 'cormorant-v', pkg: '@fontsource-variable/cormorant' },
  { dir: 'vollkorn-v', pkg: '@fontsource-variable/vollkorn' },
  { dir: 'recursive-v', pkg: '@fontsource-variable/recursive' },
  { dir: 'anybody-v', pkg: '@fontsource-variable/anybody' },
  { dir: 'saira-v', pkg: '@fontsource-variable/saira' },
  { dir: 'epilogue-v', pkg: '@fontsource-variable/epilogue' },
  { dir: 'rubik-v', pkg: '@fontsource-variable/rubik' },
  { dir: 'dm-sans-v', pkg: '@fontsource-variable/dm-sans' },
  { dir: 'figtree-v', pkg: '@fontsource-variable/figtree' },
  { dir: 'lexend-v', pkg: '@fontsource-variable/lexend' },
  { dir: 'sora-v', pkg: '@fontsource-variable/sora' },
  { dir: 'jost-v', pkg: '@fontsource-variable/jost' },
  { dir: 'quicksand-v', pkg: '@fontsource-variable/quicksand' },
  { dir: 'caveat-v', pkg: '@fontsource-variable/caveat' },
  { dir: 'shantell-sans-v', pkg: '@fontsource-variable/shantell-sans' },
  { dir: 'darker-grotesque-v', pkg: '@fontsource-variable/darker-grotesque' },
  // ---- 静态字重（无 VF 发行，不带 -v） ----
  { dir: 'ubuntu', pkg: '@fontsource/ubuntu' },
  { dir: 'ibm-plex-sans', pkg: '@fontsource/ibm-plex-sans' },
  { dir: 'ibm-plex-serif', pkg: '@fontsource/ibm-plex-serif' },
  { dir: 'ibm-plex-mono', pkg: '@fontsource/ibm-plex-mono' },
  { dir: 'libre-baskerville', pkg: '@fontsource/libre-baskerville' },
  { dir: 'dm-serif-display', pkg: '@fontsource/dm-serif-display' },
];

const KEEP_SUBSETS = ['latin', 'latin-ext'];
const isKept = (filename) => KEEP_SUBSETS.some((s) => filename.includes(`-${s}-`));

/** 从 fontsource 文件名解析样式与轴组合段：{font}-{subset}-{combo}-{style}.woff2（从尾部数） */
function parseFileMeta(name) {
  const parts = name.replace('.woff2', '').split('-');
  if (parts.length < 4) return null;
  return { style: parts[parts.length - 1], combo: parts[parts.length - 2] };
}

/**
 * CSS 后处理：fontsource 把不同轴组合拆成不同 woff2 文件（wght/opsz/standard/full…），
 * 全量合并时后声明覆盖前声明，最终生效的往往是「仅 wght」的子组合——多轴形同虚设。
 * 本函数只保留每族每样式「轴最全组合」（axes.json 记录的那个组合，跨 subset 全保留），
 * 使 font-variation-settings 的所有轴都真实可调。
 */
function keepFullestAxes(css, dir) {
  const info = AXES_DATA[dir];
  if (!info) return css;
  const targetCombo = {};
  for (const [style, s] of Object.entries(info)) {
    if (!s || !s.file) continue;
    const meta = parseFileMeta(s.file);
    if (meta) targetCombo[meta.style] = meta.combo;
  }
  if (Object.keys(targetCombo).length === 0) return css;
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const kept = blocks.filter((b) => {
    const m = b.match(/url\((?:\.?\/)?files\/([^)]+\.woff2)\)/);
    if (!m) return true;
    const meta = parseFileMeta(m[1]);
    if (!meta) return true;
    const target = targetCombo[meta.style];
    return target === undefined || meta.combo === target;
  });
  return `/* guohub-fonts ${dir} —— 仅保留最全轴组合（${Object.values(targetCombo).join('/')}），全部轴可经 font-variation-settings 调整 */\n` + kept.join('\n');
}

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

  // 3) family 名重写为规范名（全小写、连字符、VF 带 -v），并只保留最全轴组合的声明
  const css = keepFullestAxes(
    merged.replace(/font-family:\s*'[^']+';/g, `font-family: '${dir}';`),
    dir,
  );
  await writeFile(`${outDir}/${dir}.css`, css, 'utf8');

  const shards = copied;
  results.push({ dir, status: '完成', detail: `${cssFiles.length} 个 css 合并，${shards} 个分片` });
}

console.log('===== latin 字族同步结果 =====');
for (const r of results) console.log(`[${r.status}] ${r.dir}：${r.detail}`);
