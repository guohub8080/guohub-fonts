# AGENTS.md

为在本仓库（`guohub-fonts` —— guohub 的个人 web 字体库，跨项目通用）工作的 AI agent 提供指引。

## 仓库定位与核心原则

**产物直接进 git，零构建部署。** 仓库内容 = 站点内容：push 后 jsDelivr / GitHub Pages / Cloudflare Pages 原样分发，任何一层都**不跑 Build**。这是「四个 CDN 即插即用」的前提，不要改成「源码进 git + 部署时构建」的形态（会让 jsDelivr 两层失效）。

使用方（如 guookcase）不复制任何字体文件，只按 CDN URL 引用，详见其 `src/dev/store/useGlobalSettings/webfontLoader.ts`（按族懒加载 + 四层自动降级）。

## 命令

包管理器：**pnpm**。

```bash
pnpm build              # CJK 分片构建（读 fonts.config.json，缺源任务自动跳过）
node scripts/sync-latin.mjs   # 拉丁字族同步（⚠️ 直接 node 执行，别用 pnpm run，见下）
```

**已知坑（务必绕开）**：

1. **`pnpm run` 会 OOM**：pnpm v11 的依赖预检全量扫描 node_modules（cn-font-split/fontsource 海量小文件）时内存爆炸（137 秒后 heap OOM）。执行 script 一律直接 `node scripts/xxx.mjs` 或等价 shell 命令。
2. **cn-font-split 的 Node 侧当前全线不可用**（7.4.0/7.4.3 均如此，Node 22/23/Bun 都试过）：
   - 主入口（`cn-font-split`）走 Node FFI，但 `libffi-aarch64-apple-darwin.dylib` 不随 npm 包发布 → ERR_FFI 异步崩溃；
   - WASM 入口（`dist/wasm/index.mjs`）的 `fontSplit` 需要传入 `wasm: new StaticWasm(buffer)`，而 wasm 二进制（`libffi-wasm32-wasip1.wasm`）也不随包发布，官方 CLI 下载命令 `cn-font-split i wasm32-wasip1` 本身打包损坏（ERR_MODULE_NOT_FOUND）、GitHub releases 亦无该资产；
   - **结论：`fonts[]` 里的 `split` 任务目前跑不通**（栈会崩在 wasm 初始化），CJK 三族的分片产物是历史生成的存量。新增 CJK 小字体走「woff2 直存 + 手写 css」的 copy/直存路径（参考 smiley-sans）。等 cn-font-split 修复后恢复 split 链路。
3. **pnpm workspace 根污染**：家目录 `~/package.json` 曾让 pnpm 把本仓库依赖装进 `~/node_modules`（引发各种诡异路径）。已用根目录 `pnpm-workspace.yaml`（`packages: []`）自立门户——**不要删除该文件**。
4. **fontsource 无 VF 包的字体**（如 ubuntu、barlow）不能强行 `@fontsource-variable/` 安装（404），只能静态收录或不收。

## 目录结构与两类任务

```
cjk/        CJK 字族（cn-font-split 分片：result.css + {family}-v-{n}.woff2）
english/    拉丁/等宽字族（fontsource 分片：{family}.css + files/*.woff2）
symbols/    符号字族（预留，见其 README——NoteText 音乐字体有意留在使用方仓库）
sources/    源字体（.gitignore 全部字体格式，不进 git；下载地址在 fonts.config.json）
scripts/    build.mjs（CJK 分片）、sync-latin.mjs（拉丁同步）
```

- **CJK 任务**（`fonts.config.json` 的 `fonts[]`，type `split`/`copy`）：源放 `sources/cjk/` → `pnpm build`。版本锚点写在任务 `label`（如 MiSans VF v4.009），重下载对齐版本。
- **拉丁任务**（`syncTasks` + `scripts/sync-latin.mjs` 的 `FONTS` 清单）：来自 fontsource 包，`pnpm add -D` 后跑同步脚本。脚本会**把 css 里的 family 名重写为规范名**，并只保留 `latin`/`latin-ext` 分片（`KEEP_SUBSETS` 可调）。

## 命名规范（强制）

**目录名 = CSS family 名 = 使用方注册表 key**，三者必须一致：

- 全小写、连字符，禁止空格；
- **可变字体以 `-v` 结尾**（`inter-v`、`cascadia-mono-v`），静态字重版不带（`ibm-plex-mono`）；
- CJK 族带语言后缀：`-cn` 简体、`-tc` 繁体、`-jp` 日文、`-kr` 韩文。

## 发布流程（缓存语义）

jsDelivr 两层引用 `@tag`（**永久不可变缓存**）；GitHub Pages / Cloudflare Pages 跟随 `main`。因此：

1. 改产物 → commit；
2. **打新 tag**（v2、v3…，破坏性修改才 bump，加字体可复用当前 tag 但需 force 重指后确认未 push 过旧版）→ `git push origin main --tags`；
3. 通知使用方把 `webfontLoader.ts` 里的 `@v1` 改成新 tag。

## 许可证红线

- **微软专有字体（Consolas 等）禁止入库**——任何形态都不行（曾因版权移除）；
- MiSans 为小米免费商用许可，公开分发 woff2 属灰色地带（已存在，知悉即可）；
- SIL OFL（思源系、JetBrains Mono、Cascadia、fontsource 全部拉丁字族）可放心分发；
- 新字体入库前先查许可证，并把许可写进 README 表格。

## 上线清单（一次性）

1. 公开仓库 `guohub8080/guohub-fonts`，push 带 `--tags`；
2. GitHub Settings → Pages → main 分支（兜底层）；
3. Cloudflare Pages 连仓库：preset=**None**、Build command **留空**、Output directory **`/`**、项目名 `guohub-fonts`；
4. 验证：`https://guohub-fonts.pages.dev/index.html` 全字族正常渲染。
