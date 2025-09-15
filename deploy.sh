#!/bin/bash
# 自动将 dev.html 转换为生产版 index.html

set -e

echo "🚀 开始部署：dev.html -> index.html"

# 检查 dev.html 是否存在
if [ ! -f "dev.html" ]; then
    echo "❌ 错误：dev.html 不存在"
    exit 1
fi

# 备份现有的 index.html
if [ -f "index.html" ]; then
    cp index.html index.html.backup
    echo "📦 已备份 index.html -> index.html.backup"
fi

# 转换 dev.html 为生产版本
cat dev.html | \
    # 移除开发版标识
    sed 's/ - 开发版//g' | \
    sed 's/<span style="font-size:.8em;opacity:.7">\[开发\]<\/span>//g' | \
    # 移除开发模式 meta 标签
    sed '/<!-- 开发模式：禁用缓存 -->/,/^$/d' | \
    sed '/<meta http-equiv="Cache-Control"/d' | \
    sed '/<meta http-equiv="Pragma"/d' | \
    sed '/<meta http-equiv="Expires"/d' | \
    # 移除 ?dev=1 参数
    sed 's/?dev=1//g' | \
    # 移除开发模式指示条
    sed '/<!-- 开发模式指示条 -->/,/<\/div>/d' | \
    # 移除 SW 注销脚本，恢复正常 SW 注册
    sed '/<!-- 开发模式：禁用 Service Worker -->/,/<\/script>/d' | \
    # 恢复生产版 JS 引用
    sed 's/app-dev\.js/app.js/g' | \
    # 添加 manifest 引用
    sed 's/<link rel="stylesheet" href="styles\.css">/<link rel="manifest" href="manifest.webmanifest" \/>\n  <link rel="stylesheet" href="styles.css">/' | \
    # 恢复版本记录标题
    sed 's/版本记录 - 开发版/版本记录/g' | \
    # 移除部署按钮，恢复检查更新按钮
    sed 's/<button id="btnDeployToProd"[^>]*>部署到生产<\/button>/<button id="btnCheckUpdate" type="button">检查更新<\/button>\n        <button id="btnApplyUpdate" type="button" style="background:#22c55e; border-color:#22c55e; color:#0b1020;" hidden>立即更新<\/button>/' \
    > index.html

echo "✅ 转换完成：index.html 已生成"

# 显示主要差异
echo "📋 主要变更："
echo "  - 移除开发版标识和缓存禁用"
echo "  - 恢复 Service Worker 注册"
echo "  - 恢复 PWA manifest 引用"
echo "  - 使用生产版 app.js"

# 提示下一步
echo ""
echo "🔄 下一步操作："
echo "  git add index.html"
echo "  git commit -m 'deploy: 从开发版同步到生产版'"
echo "  git push origin main"

echo ""
echo "🎉 部署准备完成！"
