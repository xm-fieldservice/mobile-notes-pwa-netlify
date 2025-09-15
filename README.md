# Mobile Notes PWA (Netlify auto-deploy)

一个基于 PWA 技术的移动端笔记应用，支持离线使用和本地存储。

## 功能特性

- 移动端优化的响应式设计
- 本地 IndexedDB 存储
- Service Worker 离线支持
- Markdown 格式笔记
- 现代化 UI 设计
- PWA 安装支持

## 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- IndexedDB 本地存储
- Service Worker PWA
- 响应式设计

## 开发工作流

### 本地开发
```bash
# 启动本地开发服务器
cd mobile-notes-pwa-netlify
python3 -m http.server 8080

# 开发地址
# 主页面：http://localhost:8080/
# 开发页面：http://localhost:8080/dev.html
```

### 开发 -> 生产部署
```bash
# 1. 在 dev.html 完成功能开发
# 2. 运行自动转换脚本
./deploy.sh

# 3. 提交并推送
git add index.html
git commit -m "deploy: 从开发版同步到生产版"
git push origin main
```

### 文件说明
- `dev.html` - 开发版本（禁用缓存，直连调试）
- `app-dev.js` - 开发版 JS（无 Service Worker）
- `index.html` - 生产版本（完整 PWA 功能）
- `app.js` - 生产版 JS（包含 Service Worker）
- `deploy.sh` - 自动转换脚本

## 部署

项目配置为自动部署到 Netlify。推送到 main 分支即可触发自动部署。

## 许可证

MIT License

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
