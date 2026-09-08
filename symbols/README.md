# symbols/ —— 符号字体区

放置纯符号/图形类字体（icon 字体、数学/技术符号字体等）。

**当前为空（预留）**。注意区分：

- tonicml 的音乐记谱字体（`note-sans` / `note-serif` / `minsans-music`）**有意留在使用方仓库**（guookcase 的 `src/dev/components/musicComps/NoteText/fonts/`）——它们是记谱组件的运行时关键资产、总量 <20KB，随构建打包比走 CDN 更稳（网络抖动会导致记谱显示异常），不要搬到这里。
- 适合放这里的：体积较大、可懒加载、非首屏关键的符号字体。
