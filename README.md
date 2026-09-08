# guohub-fonts

guohub 的个人 web 字体仓库（跨项目通用）：CJK 字体用 [cn-font-split](https://www.npmjs.com/package/cn-font-split) 分片构建，多 CDN 分发。**任何项目引用本仓库都只写 CDN URL，不复制字体文件。**

## 目录结构（按用途分区）

```
guohub-fonts/
  fonts.config.json    # 字体任务清单 + 分片策略（改这个，别改脚本）
  scripts/build.mjs    # 构建脚本（pnpm build）
  sources/             # 源字体（不进 git；cjk/ english/ 与产物分区对应）
  cjk/             # 中文字体（CJK，cn-font-split 分片）
    minsans/           #   每族 = result.css + {family}-v-{index}.woff2 分片
    syht-cn/
    syst-cn/
  english/             # 英文/等宽字体（小体积直存，不分片；CSS 与字体同目录）
    jb-mono/           #   jb-mono.css + 两个 woff2，自包含
  symbols/             # 符号字体（预留，见该目录 README；音乐记谱字体有意留在使用方仓库）
  fonts.css            # 全量入口（调试用；主站默认不用它，按族懒加载）
```

## 字体清单与许可（41 族）

| 分区 | 字族 | 许可证 |
|---|---|---|
| CJK | `cjk/minsans`（MiSans VF v4.009）、`cjk/syht-cn`（思源黑体 CN VF v2.005）、`cjk/syst-cn`（思源宋体 CN VF v2.003）——均 cn-font-split 分片 | MiSans ⚠️ 免费商用见条款；思源 SIL OFL ✅ |
| CJK | `cjk/smiley-sans`（得意黑 v2.0.1，静态 1.3MB 直存） | SIL OFL ✅ |
| 等宽 | `jb-mono`、`cascadia-mono-v`、`fira-code-v`、`inconsolata-v`、`martian-mono-v`、`spline-sans-mono-v`、`ibm-plex-mono`（静态） | SIL OFL ✅ |
| Sans VF | `inter-v`、`source-sans-3-v`、`noto-sans-v`、`roboto-flex-v`、`open-sans-v`、`montserrat-v`、`raleway-v`、`manrope-v`、`space-grotesk-v`、`outfit-v`、`plus-jakarta-sans-v`、`oswald-v`、`archivo-v`、`public-sans-v`、`work-sans-v` | SIL OFL ✅ |
| Serif VF | `source-serif-4-v`、`newsreader-v`、`literata-v`、`noto-serif-v`、`roboto-serif-v`、`lora-v`、`playfair-display-v`、`merriweather-v`、`fraunces-v`、`crimson-pro-v`、`bitter-v` | SIL OFL ✅ |
| 静态 | `ibm-plex-sans`、`ibm-plex-serif`、`libre-baskerville`、`dm-serif-display` | SIL OFL ✅ |

> 命名规范：目录名 = CSS family 名，全小写、连字符；**VF 以 `-v` 结尾**（inter-v），静态字重版不带（ibm-plex-mono）。
> 微软 Consolas 等专有字体**禁止**加入本仓库。JP 族已砍掉（中文内容用不上）。
> 拉丁字族由 `pnpm sync:latin`（= `node scripts/sync-latin.mjs`）从 fontsource 同步；`ubuntu`/`barlow` 因 fontsource 无 VF 包未收录。

## 分片策略（fonts.config.json）

分片解决的是「单次访问下载多少」：整字体 16–18MB → 页面实际用字只下载 30–80 片 ≈ 0.5–2MB。策略集中在 `fonts.config.json` 的 `defaults`（单个任务可用 `overrides` 覆盖）：

| 选项 | 值 | 作用 |
|---|---|---|
| `languageAreas` | `true` | 同语言字符聚合到同片，中文页面命中更集中 |
| `autoSubset` | `true` | 分片超过目标大小时自动再拆 |
| `reduceMins` | `true` | 合并碎片小包，减少请求数 |
| `fontFeature` | `true` | 保留连字/字距等特性 |
| `css.fontDisplay` | `"swap"` | 字体未加载完先用系统字体渲染，不阻塞 |
| `css.compress` | `true` | 压缩生成的 CSS 产物（现有 result.css 已做等价手工压缩） |
| `testHtml` / `reporter` | `false` | 不生成测试页等杂项产物 |
| `renameOutputFont` | `{family}-v-[index].woff2` | 产物命名（主站引用依赖此形态，勿改） |

**按需调优**（一般不需要动）：
- `chunkSize`：单分片目标大小（字节），如 `70 * 1024`。片更小 → 按需更精细但片数更多、CSS 更大；默认值即 Google Fonts 同款粒度。
- `maxAllowSubsetsCount`：最大分片数上限（与 chunkSize 可能互相牵制）。
- 某内容域字符（如音乐符号区、假名区）需要独立成片时，在任务的 `overrides.subsets` 里传 Unicode 码点区间。

## 构建与接入新字体

两类任务，链路不同：

**CJK 大字体（分片构建）**：

```bash
# 1. 源字体放入 sources/cjk/（文件名与 fonts.config.json 的 source 字段一致）
# 2. 在 fonts.config.json 增加任务（type: "split"）
pnpm build          # 3. 生成/更新分片产物
# 4. 检查 cjk/{族}/result.css 的 font-family 名，提交产物
```

**拉丁字族（fontsource 同步）**：在 `scripts/sync-latin.mjs` 的 `FONTS` 清单加一条（`dir` = 规范 family 名，`pkg` = fontsource 包名），然后：

```bash
pnpm add -D <fontsource 包名>
node scripts/sync-latin.mjs   # ⚠️ 直接 node 执行；pnpm run 有 OOM 坑（见 AGENTS.md）
```

脚本自动：拷贝分片（只留 latin/latin-ext）→ 合并包内全部样式 css → **family 名重写为规范名**（全小写连字符、VF 带 -v）。

**发布（两类通用）**：

```bash
git add -A && git commit -m "feat: ..."
git tag v2 && git push origin main --tags   # tag 必须推：jsDelivr 的 @tag 引用靠它
```

使用方（如 guookcase）把 `webfontLoader.ts` 里 `WEBFONT_CDN_SOURCES` 的 `@v1` 改成 `@v2` 即可。

## 多 CDN 分发（大陆可达性：自动降级）

使用方按族懒注入，失败自动降级到下一层（四层全挂才回落系统字体）：

```
https://cdn.jsdelivr.net/gh/guohub8080/guohub-fonts@v1/cjk/{族}/result.css   # 主源
https://fastly.jsdelivr.net/gh/guohub8080/guohub-fonts@v1/cjk/{族}/result.css # jsDelivr 大陆优化域
https://guohub-fonts.pages.dev/cjk/{族}/result.css                            # Cloudflare Pages
https://guohub8080.github.io/guohub-fonts/cjk/{族}/result.css                 # GitHub Pages 兜底
```

**上线清单（一次性）：**

1. 建公开仓库 `guohub8080/guohub-fonts` 并 push（含 tag）：`git push -u origin main --tags`
2. GitHub 仓库 Settings → Pages 部署 main 分支（第 4 层兜底，与引用方站点同可达性）
3. Cloudflare Pages → Connect to Git → 选本仓库；Framework preset 选 **None**，Build command **留空**，Build output directory 填 **`/`**；项目名 `guohub-fonts`
4. 验证：`https://guohub-fonts.pages.dev/cjk/minsans/result.css` 返回 CSS

**必须用 tag 引用**：jsDelivr 对 tag 永久不可变缓存；`@main` 只缓存 12 小时且无法主动失效。
