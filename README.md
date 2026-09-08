# guohub-fonts

guohub 的个人 web 字体库（跨项目通用）：**61 个字族 / 50 个可变字体（VF）**，CJK 分片 + fontsource 同步，多 CDN 四层自动降级分发。任何人、任何项目都可以直接通过下面的 URL 消费，**不需要 clone 本仓库、不需要构建**。

## 怎么消费（使用方指南）

### 方式一：一行 CSS 引入单族（最简单）

在 HTML `<head>` 加一条 `<link>`，或 CSS 里 `@import`。四层 URL 内容完全相同，任选其一：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/guohub8080/guohub-fonts@v1.2/english/inter-v/inter-v.css">
```

| 源 | URL 前缀 | 特点 |
|---|---|---|
| jsDelivr 主域 | `https://cdn.jsdelivr.net/gh/guohub8080/guohub-fonts@v1.2/` | 海外最快；tag 永久缓存 |
| jsDelivr 大陆优化域 | `https://fastly.jsdelivr.net/gh/guohub8080/guohub-fonts@v1.2/` | **大陆用户推荐** |
| Cloudflare Pages | `https://guohub-fonts.pages.dev/` | 独立冗余，跟 main 分支 |
| GitHub Pages | `https://guohub8080.github.io/guohub-fonts/` | 最终兜底，跟 main 分支 |

**路径规则**：`{前缀}/{分区}/{族名}/{族名}.css`（CJK 族是 `{分区}/{族名}/result.css`）。分区：`cjk/`、`english/`、`symbols/`。例：

```text
english/inter-v/inter-v.css          # Inter VF（拉丁无衬线）
cjk/syht-cn/result.css               # 思源黑体 CN VF（中文分片）
english/cascadia-mono-v/cascadia-mono-v.css  # Cascadia Mono VF（等宽）
```

引入后直接用族名（= 目录名）：

```css
body { font-family: 'inter-v', system-ui, sans-serif; }
code { font-family: 'cascadia-mono-v', monospace; }
```

**为什么这是「免流量友好」的**：每个族的 CSS 内部用 `unicode-range` 把字体拆成了小分片（CJK 每片几十 KB、拉丁通常 2 片），浏览器只下载页面实际用到的字符所在分片，并强缓存。不用任何 JS。

### 方式二：多源自动降级（生产推荐）

单源可能抽风（尤其大陆访问 jsDelivr 主域）。guookcase 主仓库的懒加载器把四层做成 `onerror` 自动降级链，可直接抄：[`webfontLoader.ts`](https://github.com/guohub8080/guookcase/blob/main/src/dev/store/useGlobalSettings/webfontLoader.ts)。核心逻辑 20 行：注入 `<link>` → 失败自动换下一个源 → 全部失败回落系统字体（`font-display: swap` 保证渲染不受影响）。

### 方式三：全量入口（调试/预览用）

`{前缀}/fonts.css` 引入全部 61 族（如 `https://guohub-fonts.pages.dev/fonts.css`）——只适合调试，**不要在生产用**（注册了所有族的 CSS 元数据）。

### 多轴字体的用法（VF 进阶）

多轴族（如 Roboto Flex 13 轴、Fraunces 的 SOFT/WONK）用 `font-variation-settings` 调轴：

```css
.fancy {
  font-family: 'fraunces-v', serif;
  font-variation-settings: 'SOFT' 100, 'WONK' 1;  /* 软笔 + 俏皮形 */
}
```

每个族的可用轴/范围/默认值见 [`scripts/axes.json`](scripts/axes.json)（从产物 woff2 的 fvar 表提取，权威）。浏览器里打开 `{前缀}/index.html` 可视化试轴。

### 版本与缓存（重要）

- jsDelivr 两层**必须引用 tag**（`@v1.2`）：tag 永久不可变缓存。**不要用 `@main`**（只缓存 12 小时且不可控）；
- Pages 两层跟 main 分支，更新即时；
- 升级字体后我会 bump 新 tag（v1.3、v1.4…），你把 URL 里的 `@v1.2` 改成新 tag 即完成升级。

## 预览 / 自检

浏览器打开任一源的 `/index.html`（如 [guohub-fonts.pages.dev](https://guohub-fonts.pages.dev/)）：61 族样张 + 每卡字重/每轴滑杆 + 字号控制 + 许可徽章 + 官网出处。**全部正常渲染 = 该 CDN 节点可用**。

## 目录结构（按风格分区）

```
cjk/        中日韩字族（cn-font-split 分片：result.css + {family}-v-{n}.woff2）
english/    拉丁字族（fontsource 分片：{族名}.css + files/*.woff2），内部按风格排序见 index.html
symbols/    符号字族（预留；音乐记谱字体有意留在使用方仓库）
sources/    源字体（不进 git；下载地址与版本锚点在 fonts.config.json）
scripts/    build.mjs（CJK 分片）、sync-latin.mjs（拉丁同步+最全轴组合过滤）、axes.json（轴定义）
index.html  预览/自检页（深色 specimen，交互式字重/轴/字号）
fonts.css   全量入口（调试用）
```

## 字体清单与许可（61 族 / 50 VF）

| 分区 | 字族 | 许可证 |
|---|---|---|
| CJK | `minsans-v`（MiSans VF v4.009）、`syht-cn-v`（思源黑体 CN VF v2.005）、`syst-cn-v`（思源宋体 CN VF v2.003）——分片 | MiSans ⚠️ 免费商用见条款；思源 SIL OFL ✅ |
| CJK | `smiley-sans`（得意黑 v2.0.1，静态直存） | SIL OFL ✅ |
| 等宽 | `jb-mono`、`cascadia-mono-v`、`fira-code-v`、`inconsolata-v`、`martian-mono-v`、`spline-sans-mono-v`、`red-hat-mono-v`、`ibm-plex-mono`（静态） | SIL OFL ✅ |
| Sans VF | `inter-v`、`source-sans-3-v`、`noto-sans-v`、`roboto-flex-v`（13 轴）、`open-sans-v`、`montserrat-v`、`raleway-v`、`manrope-v`、`space-grotesk-v`、`outfit-v`、`plus-jakarta-sans-v`、`oswald-v`、`archivo-v`、`public-sans-v`、`work-sans-v`、`rubik-v`、`dm-sans-v`、`figtree-v`、`lexend-v`、`sora-v`、`jost-v`、`quicksand-v`、`saira-v`、`epilogue-v`、`anybody-v` | SIL OFL ✅ |
| Serif VF | `source-serif-4-v`、`newsreader-v`、`literata-v`、`noto-serif-v`、`roboto-serif-v`、`lora-v`、`playfair-display-v`、`merriweather-v`、`fraunces-v`、`crimson-pro-v`、`bitter-v`、`eb-garamond-v`、`bodoni-moda-v`、`cormorant-v`、`vollkorn-v` | SIL OFL ✅ |
| 特色 VF | `recursive-v`（五轴）、`shantell-sans-v`、`caveat-v`、`darker-grotesque-v` | SIL OFL ✅ |
| 静态 | `ubuntu`（UFL，官方无 VF）、`ibm-plex-sans`、`ibm-plex-serif`、`libre-baskerville`、`dm-serif-display` | UFL / SIL OFL ✅ |

> 命名规范：目录名 = CSS family 名，全小写、连字符；**VF 以 `-v` 结尾**，静态不带。61/61 免费可商用。
> 微软 Consolas 等专有字体**禁止**加入本仓库。

## 分片策略（fonts.config.json）

分片解决「单次访问下载多少」：CJK 整字体 15–18MB → 页面实际用字只下载 30–80 片 ≈ 0.5–2MB。CJK 任务策略集中在 `defaults`（`languageAreas`/`autoSubset`/`reduceMins`/`fontFeature`/`css.compress`/`swap`）；拉丁族继承 fontsource 官方分片，`sync-latin.mjs` 只保留 latin/latin-ext subset（`KEEP_SUBSETS` 可调）。

## 构建与接入新字体

两类任务，链路不同（详见 AGENTS.md 的坑清单）：

**CJK**：源字体放 `sources/cjk/` → `fonts.config.json` 加 `split` 任务 → `node scripts/build.mjs`。
**拉丁**：`pnpm add -D <fontsource 包>` → `scripts/sync-latin.mjs` 的 `FONTS` 加一行 → `node scripts/sync-latin.mjs`（自动重写 family 名为规范名 + 只留最全轴组合）。新多轴族需重跑 `scripts/axes.json` 提取。

**发布**：commit → bump 新 tag → `git push origin main --tags` → 通知使用方改 tag。
