# Mobile Notes PWA (Netlify auto-deploy)

本仓库用于托管移动端笔记原型（PWA），并通过 Netlify 从 GitHub 自动构建与发布。

## 工作流
- 修改代码 → `git add . && git commit -m "feat: ..." && git push`
- Netlify 自动从 `main` 分支构建并发布
- 如未看到最新变化，请在手机端刷新或在浏览器设置中清除该站点的离线数据（Service Worker 可能仍在缓存旧版本）

## 目录
- `index.html`/`styles.css`/`app.js`：页面与交互
- `db.js`：最小化本地持久化（IndexedDB），仅保存 Markdown 文档
- `sw.js` & `manifest.webmanifest`：PWA 能力（离线与安装）
- `_headers` / `netlify.toml`：静态资源头与缓存策略
- `MOBILE_SPEC.md`：手机功能设计文档

## 开发提示
- 新建笔记：顶部抽屉“新建笔记”或底部“＋ 新建”按钮
- 收藏/删除/复制：在列表项操作
- 历史数据：重启后可在本机继续浏览（IndexedDB 持久化）

\nDeploy check: 2025-09-14T14:36:33Z
