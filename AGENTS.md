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

## 已知坑（实测踩过的错误档案，务必绕开）

1. **cn-font-split 的 Node 侧全线不可用**（7.4.0 / 7.4.3 均如此；Node 22 / Node 23 / Bun 三运行时都验证过崩溃）：
   - 主入口 `cn-font-split` 走 Node FFI，但 `libffi-aarch64-apple-darwin.dylib` **不随 npm 包发布** → 静态 import 正常、**异步**崩溃 ERR_FFI（还会先跑 137 秒再 heap OOM，别被「import OK」骗到——当时我们只验证了 import，没验证执行）；
   - WASM 入口 `dist/wasm/index.mjs` 的 `fontSplit` 崩 `TypeError: t is not a function`——它需要传 `wasm: new StaticWasm(buffer)` 初始化参数，而 wasm 二进制 `libffi-wasm32-wasip1.wasm` 同样**不随包发布**；官方 CLI 下载命令 `cn-font-split i wasm32-wasip1` 本身打包损坏（`ERR_MODULE_NOT_FOUND: proto.mjs`），GitHub releases 也无该资产；
   - **结论：`fonts[]` 里的 `split` 任务当前跑不通**，CJK 三族分片产物是历史存量。新增 CJK 字体走「woff2 直存 + 手写 css」路径（参考 `smiley-sans`）；单文件 OTF→WOFF2 转换可用 `python3 -m fontTools.ttLib.woff2 compress <in.otf> -o <out.woff2>`（需 `pip3 install fonttools brotli`）。cn-font-split 修复后可恢复 split 链路。
2. **`pnpm run <script>` 会 OOM**：pnpm v11 的依赖预检全量扫描 node_modules（cn-font-split/fontsource 海量小文件）时内存爆炸（137 秒后 4GB heap OOM），**与 script 内容无关**（纯 cp/cat 命令也炸）。执行 script 一律直接 `node scripts/xxx.mjs` 或等价 shell 命令；`pnpm build` 若也触发，用 `node scripts/build.mjs`。
3. **pnpm workspace 根污染**：家目录存在 `~/package.json` 时，pnpm 会把它当 workspace 根，把本仓库依赖装进 `~/node_modules/.pnpm`（软链指向家目录，引发各种诡异路径与加载异常）。已用根目录 `pnpm-workspace.yaml`（`packages: []`）自立门户——**不要删除该文件**；新建脚本仓库时同样注意。
4. **fontsource 不是所有字体都有 VF 包**：`@fontsource-variable/ubuntu`、`@fontsource-variable/barlow` 均 404（实测）。且 `pnpm add` 一次装多个包时**其中一个 404 会导致同组部分包静默丢失**——批量安装后必须 `ls node_modules/@fontsource-variable/` 核对数量，缺的单独补装。
5. **新字体入库前必须实测 VF 身份**：不能凭印象判断是否可变字体（得意黑曾误判——官方发行实为静态单字重，下载后查 `fvar` 表才发现）。判定方法：`python3 -c "from fontTools.ttLib import TTFont; print('fvar' in TTFont('<文件>'))"`——有 fvar 才是 VF，命名才带 `-v`。
6. **Mimosa hook 会拦截 Bash 写配置文件**：通过 `python3 -c`/heredoc 直接改 `package.json` 等安全敏感文件会被 PreToolUse hook 拒绝（防绕过扫描）——改这类文件一律用 Write/Edit 工具。
7. **发布相关**：
   - tag 一经 push 即冻结（jsDelivr 永久缓存），**绝不 force 重指已 push 的 tag**，改动一律 bump 新 tag（v1.1 → v1.2 …）；
   - GitHub API 可用钥匙串凭据创建仓库/开 Pages（`git credential fill` 取 token，不回显）；gh CLI 未登录时这是替代路径。

## 目录结构与两类任务

```
cjk/        CJK 字族（cn-font-split 分片：result.css + {family}-v-{n}.woff2）
english/    拉丁/等宽字族（fontsource 分片：{族名}.css + files/*.woff2）
symbols/    符号字族（预留，见其 README——NoteText 音乐字体有意留在使用方仓库）
sources/    源字体（.gitignore 全部字体格式，不进 git；下载地址在 fonts.config.json）
scripts/    build.mjs（CJK 分片）、sync-latin.mjs（拉丁同步 + 最全轴组合过滤）、
            axes.json（各族轴定义，fontTools 从 woff2 fvar 表提取，权威）
index.html  预览页（深色 specimen：61 族样张 + 字重/每轴/字号交互滑杆 + 许可徽章 + 官网出处）
```

- **CJK 任务**（`fonts.config.json` 的 `fonts[]`，type `split`/`copy`）：源放 `sources/cjk/` → `pnpm build`。版本锚点写在任务 `label`（如 MiSans VF v4.009），重下载对齐版本。
- **拉丁任务**（`syncTasks` + `scripts/sync-latin.mjs` 的 `FONTS` 清单）：来自 fontsource 包，`pnpm add -D` 后跑同步脚本。脚本会：**把 css 里的 family 名重写为规范名**、只保留 `latin`/`latin-ext` 分片（`KEEP_SUBSETS` 可调）、**只保留每族每样式「轴最全组合」的 @font-face**（fontsource 把不同轴组合拆成不同 woff2——wght/opsz/standard/full…，全量合并会互相覆盖导致多轴形同虚设，这个过滤是多轴可调的前提）。
- **多轴数据**：新增/更新拉丁族后必须重新生成 `scripts/axes.json`（fontTools 读 fvar；预览页的 `AXES` 内嵌表与滑杆依赖它——拖滑杆写 `font-variation-settings`）。

## 预览页（index.html）机制

- 分区**按风格单一维度**组织（CJK / Sans / Serif / Mono / 特色 / Roboto Flex 旗舰），多轴与静态字体混在风格区里、靠控件形态区分——不要按「轴数量」再开新区（曾因衬线被劈成两处被用户否决）。
- 卡片交互全部由页尾脚本按数据表生成（`AXES`/`WEIGHT_RANGES`/`ORIGINS`/`LICENSES`）：多轴卡每轴一杆、单轴 VF 字重杆、静态卡字重按钮、每卡字号杆。**族名提取依赖 `.fam` 的首文本节点**（徽章 span 是后加的，整体 textContent 会污染族名——曾因此全页多轴滑杆失效）。
- 样张语言必须匹配字体覆盖：CJK 族用双语、拉丁族纯英文（中文会走回退栈，属误导性预览）。

## 命名规范（强制）

**目录名 = CSS family 名 = 使用方注册表 key**，三者必须一致：

- 全小写、连字符，禁止空格；
- **可变字体以 `-v` 结尾**（`inter-v`、`cascadia-mono-v`），静态字重版不带（`ibm-plex-mono`）；
- CJK 族带语言后缀：`-cn` 简体、`-tc` 繁体、`-jp` 日文、`-kr` 韩文。

当前规模：**61 族 / 50 VF**（清单见 README 表格）。README 的「怎么消费」章节是外部使用方的第一入口——**改 URL/路径/tag 规则时必须同步更新它**。

## 发布流程（缓存语义）

jsDelivr 两层引用 `@tag`（**永久不可变缓存**）；GitHub Pages / Cloudflare Pages 跟随 `main`。因此：

1. 改产物 → commit；
2. **bump 新 tag**（v1.1 → v1.2 → …，新增/修改均 bump；tag 一经 push 即冻结、绝不重指）→ `git push origin main --tags`；
3. 通知使用方把 `webfontLoader.ts` 里的 `@v1.1` 改成新 tag。

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
