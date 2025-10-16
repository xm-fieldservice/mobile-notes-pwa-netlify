// 开发版 JS - 基于 app.js 但移除 SW 相关逻辑, 添加部署功能

// 基础选择器
const qs = (s, root = document) => root.querySelector(s);
const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

// 元素引用
const left = qs('#left-drawer');
const right = qs('#right-drawer');
const topD = qs('#top-drawer');
const backdrop = qs('#backdrop');

// 打开/关闭抽屉的辅助
function setAriaOpen(el, open) {
  if (!el) return;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
  const btns = qsa(`[aria-controls="${el.id}"]`);
  btns.forEach((b) => b.setAttribute('aria-expanded', String(open)));
  const anyOpen = qsa('.drawer.open').length > 0;
  backdrop.hidden = !anyOpen;
}
function closeAll() {
  [left, right, topD].forEach((el) => setAriaOpen(el, false));
}

// 布局变量: 根据真实高度写入, 保证 2:1 充满可视区
function setLayoutVars(){
  const tb = qs('.topbar');
  const bb = qs('.bottombar');
  const r = document.documentElement;
  if (tb) r.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  if (bb) r.style.setProperty('--bottombar-h', bb.offsetHeight + 'px');
}

// 按钮事件
function initButtons() {
  const map = [
    { btn: '#btnLeftMenu', target: left },
    { btn: '#btnRightMenu', target: right },
    { btn: '#btnTopMenu', target: topD },
  ];
  map.forEach(({ btn, target }) => {
    const el = qs(btn);
    el?.addEventListener('click', () => {
      const open = !target.classList.contains('open');
      closeAll();
      setAriaOpen(target, open);
    });
  });

  // 关闭按钮
  qsa('.btn-close').forEach((b) => {
    b.addEventListener('click', () => {
      const sel = b.getAttribute('data-close');
      const el = sel ? qs(sel) : b.closest('.drawer');
      setAriaOpen(el, false);
    });
  });

  // 背景点击关闭
  backdrop.addEventListener('click', closeAll);

  // 部署到生产按钮
  document.getElementById('btnDeployToProd')?.addEventListener('click', async () => {
    if (confirm('确认将当前开发版本部署到生产环境？')) {
      try {
        // 复制 dev.html 内容到 index.html（去掉开发标识）
        const response = await fetch('dev.html');
        let content = await response.text();
        
        // 移除开发模式标识和脚本
        content = content
          .replace(/<span style="font-size:.8em;opacity:.7">\[开发\]<\/span>/, '')
          .replace(/版本记录 - 开发版/, '版本记录')
          .replace(/开发模式 - 直连无缓存/, '加载中…')
          .replace(/<div style="position:fixed[^>]*>[\s\S]*?<\/div>\s*<script>[\s\S]*?<\/script>/m, '')
          .replace(/app-dev\.js\?dev=1/g, 'app.js')
          .replace(/\?dev=1/g, '');
        
        // 这里应该调用 API 更新 index.html, 暂时提示手动操作
        alert('开发完成！请手动将 dev.html 的改动同步到 index.html');
      } catch (e) {
        alert('部署失败：' + e.message);
      }
    }
  });

  // 连接服务器按钮：使用事件委托确保 PWA 环境下可用
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnConnectServer') {
      const serverBase = prompt('请输入服务器地址（例如：http://172.19.128.194:3000）', 'http://172.19.128.194:3000');
      if (serverBase && serverBase.trim()) {
        localStorage.setItem('SERVER_BASE', serverBase.trim());
        localStorage.setItem('SERVER_MODE', '1');
        alert('服务器已配置，页面即将刷新以启用服务器模式');
        location.reload();
      }
    }
  });
}

// 手势：使用 Pointer Events 简化
function initGestures() {
  const edgeLeft = qs('.edge-left');
  const edgeRight = qs('.edge-right');
  const edgeTop = qs('.edge-top');

  const THRESHOLD_OPEN = 50; // 触发打开阈值
  let startX = 0, startY = 0, tracking = false, dir = null;

  function onDown(e, which) {
    tracking = true; dir = which;
    startX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
    startY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
  }
  function onMove(e) {
    if (!tracking) return;
    const x = e.clientX ?? (e.touches?.[0]?.clientX || 0);
    const y = e.clientY ?? (e.touches?.[0]?.clientY || 0);
    if (dir === 'left') {
      const dx = x - startX;
      if (dx > 0 && dx > THRESHOLD_OPEN) { closeAll(); setAriaOpen(left, true); tracking = false; }
    } else if (dir === 'right') {
      const dx = startX - x;
      if (dx > 0 && dx > THRESHOLD_OPEN) { closeAll(); setAriaOpen(right, true); tracking = false; }
    } else if (dir === 'top') {
      const dy = y - startY;
      if (dy > 0 && dy > THRESHOLD_OPEN) { closeAll(); setAriaOpen(topD, true); tracking = false; }
    }
  }
  function onUp() { tracking = false; dir = null; }

  [['pointerdown','pointermove','pointerup'], ['touchstart','touchmove','touchend']].forEach(([down, move, up]) => {
    edgeLeft?.addEventListener(down, (e) => onDown(e, 'left'), { passive: true });
    edgeRight?.addEventListener(down, (e) => onDown(e, 'right'), { passive: true });
    edgeTop?.addEventListener(down, (e) => onDown(e, 'top'), { passive: true });
    window.addEventListener(move, onMove, { passive: true });
    window.addEventListener(up, onUp, { passive: true });
  });
}

// 初始化
initButtons();
initGestures();
setLayoutVars();
window.addEventListener('resize', setLayoutVars);

// =====================
// 最小可用：本地持久化（仅 Markdown 文档）
// 依赖 window.DB（见 db.js）
// =====================

const listEl = qs('.note-list');
const outputBox = qs('#outputBox');
const composeInput = qs('#composeInput');
const composeSubmit = qs('#composeSubmit');
const recentList = qs('#recent-submits');
let CURRENT_TOPIC = null;

function mdFirstLine(md){
  if(!md) return '';
  const line = md.split(/\r?\n/).find(Boolean) || '';
  return line.replace(/^#+\s*/, '').slice(0, 80);
}

function mdExcerpt(md){
  if(!md) return '';
  const lines = md.split(/\r?\n/).filter(Boolean);
  return (lines.slice(1, 4).join(' ') || '').slice(0, 160);
}

function renderNotes(notes){
  if (!listEl) return; // 新布局下无列表区
  listEl.innerHTML = '';
  if(!notes || !notes.length){
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = '<h3>暂无笔记</h3><p>点击顶部抽屉的"新建笔记"开始记录。</p>';
    listEl.appendChild(li);
    return;
  }
  for(const n of notes){
    const li = document.createElement('li');
    li.className = 'note-item';
    li.dataset.id = n.id;
    const title = mdFirstLine(n.contentMD) || '未命名笔记';
    const excerpt = mdExcerpt(n.contentMD);
    li.innerHTML = `
      <h3>${title}</h3>
      <p>${excerpt}</p>
      <div style="display:flex; gap:.5rem; margin-top:.5rem">
        <button class="btn-fav" aria-label="收藏">${n.favorite ? '★ 已收藏' : '☆ 收藏'}</button>
        <button class="btn-copy" aria-label="复制到剪贴板">⧉ 复制</button>
        <button class="btn-del" aria-label="删除">🗑️ 删除</button>
      </div>
    `;
    listEl.appendChild(li);
  }
}

async function reloadNotes(){
  const notes = await window.DB.listNotesByTopic(CURRENT_TOPIC.id);
  renderNotes(notes);
}

function openEditor(initial=''){
  // 优先使用原生 <dialog>, 否则降级为 prompt()
  const supportsDialog = typeof window.HTMLDialogElement !== 'undefined';
  if (supportsDialog) {
    // 动态创建一个简单的对话框
    let dlg = document.getElementById('note-editor');
    if(!dlg){
      dlg = document.createElement('dialog');
      dlg.id = 'note-editor';
      dlg.style.cssText = 'max-width: 96vw; width: 680px; border:1px solid rgba(255,255,255,.15); background:#0b1224; color:#e5e7eb; border-radius:12px; padding:0;';
      dlg.innerHTML = `
        <form method="dialog" style="display:flex; flex-direction:column; gap:.5rem; padding: .75rem;">
          <h3 style="margin:.25rem 0">新建/编辑笔记</h3>
          <textarea id="note-textarea" style="min-height: 40vh; resize: vertical; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#0b1020; color:#e5e7eb; padding:.75rem"></textarea>
          <div style="display:flex; gap:.5rem; justify-content:flex-end;">
            <button value="cancel" type="button" id="btnCancelNote">取消</button>
            <button id="btnSaveNote" value="default" style="background:#22c55e; border-color:#22c55e; color:#0b1020;">保存</button>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);
    }
    const ta = dlg.querySelector('#note-textarea');
    ta.value = initial || '';
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      // 非常规环境（旧浏览器）降级到 prompt
      const content = (window.prompt('请输入笔记内容（Markdown）：', initial || '') || '').trim();
      if(content){ window.DB.addNote(CURRENT_TOPIC.id, content).then(reloadNotes); }
      return;
    }
    const saveBtn = dlg.querySelector('#btnSaveNote');
    const cancelBtn = dlg.querySelector('#btnCancelNote');
    saveBtn.onclick = async (e)=>{
      e.preventDefault();
      const content = ta.value.trim();
      if(!content){ dlg.close(); return; }
      await window.DB.addNote(CURRENT_TOPIC.id, content);
      dlg.close();
      await reloadNotes();
    };
    cancelBtn.onclick = (e)=>{ e.preventDefault(); dlg.close(); };
  } else {
    // 完全不支持 <dialog> 的浏览器使用 prompt() 简易输入
    const content = (window.prompt('请输入笔记内容（Markdown）：', initial || '') || '').trim();
    if(content){ window.DB.addNote(CURRENT_TOPIC.id, content).then(reloadNotes); }
  }
}

// 全局提交函数（无需等待 DB）
async function submitCurrentNote(){
  console.log('submitCurrentNote 被调用');
  const inputEl = document.querySelector('#composeInput');
  const outputEl = document.querySelector('#outputBox');
  // 右侧抽屉“刚提交”列表元素（容错：兼容旧 id）
  let recentEl = document.querySelector('#recent-submits') || document.querySelector('#recentList');
  const submitBtn = document.querySelector('#composeSubmit');
  
  const val = (inputEl?.value || '').trim();
  console.log('输入值:', val);
  
  if(!val){ 
    console.log('输入为空, 聚焦输入框');
    inputEl?.focus(); 
    return; 
  }
  
  // 立即更新 UI（无需等待 DB）
  if (outputEl) {
    outputEl.textContent = val;
    console.log('输出框已更新');
  }
  if (inputEl) {
    inputEl.value = '';
    console.log('输入框已清空');
  }
  
  // 最近提交列表追加并持久化
  console.log('recent-submits 元素:', recentEl);
  if (recentEl){
    const beforeCount = recentEl.children.length;
    const li = document.createElement('li');
    li.style.cssText = 'background: var(--card); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:.5rem; cursor:pointer;';
    li.dataset.content = val; // 存储完整内容
    const title = mdFirstLine(val) || '未命名笔记';
    const excerpt = mdExcerpt(val);
    li.innerHTML = `<div><strong>${title}</strong></div><div style="opacity:.8; font-size:.9em;">${excerpt}</div>`;
    
    // 点击列表项显示完整内容
    li.addEventListener('click', () => {
      if (outputEl) {
        outputEl.textContent = val;
        console.log('点击列表项, 输出框已更新为:', val);
      }
    });
    
    recentEl.prepend(li);
    const afterCount = recentEl.children.length;
    console.log('列表已添加项目: 之前数量 =', beforeCount, '现在数量 =', afterCount);
    
    // 持久化到 localStorage
    saveRecentList();
  }
  
  // 打开右侧抽屉
  const rightDrawer = document.querySelector('#right-drawer');
  console.log('准备打开右侧抽屉, 元素 =', rightDrawer);
  if (rightDrawer){
    closeAll();
    setAriaOpen(rightDrawer, true);
    console.log('右侧抽屉已打开, aria-hidden =', rightDrawer.getAttribute('aria-hidden'), 'classList =', rightDrawer.className);
  } else {
    console.warn('未找到 #right-drawer 元素, 请检查 dev.html 结构');
  }
  
  // 简易提示
  try{ 
    if ('vibrate' in navigator) navigator.vibrate(10);
    if (submitBtn){ 
      submitBtn.textContent = '已提交'; 
      setTimeout(()=>{ submitBtn.textContent = '提交'; }, 900);
      console.log('按钮文本已更新');
    }
  }catch{}
  
  // 如果 DB 可用, 保存到数据库
  if (window.DB && CURRENT_TOPIC) {
    try {
      await window.DB.addNote(CURRENT_TOPIC.id, val);
      await reloadNotes();
      console.log('已保存到数据库');
    } catch (e) {
      console.warn('保存到数据库失败:', e);
    }
  }
}

// 持久化最近提交列表
function saveRecentList() {
  const recentEl = document.querySelector('#recent-submits') || document.querySelector('#recentList');
  if (!recentEl) return;
  
  const items = Array.from(recentEl.children).map(li => ({
    content: li.dataset.content,
    title: li.querySelector('strong')?.textContent || '未命名笔记',
    excerpt: li.querySelector('div:last-child')?.textContent || ''
  }));
  
  localStorage.setItem('recentSubmissions', JSON.stringify(items));
  console.log('最近提交列表已保存到 localStorage');
}

// 恢复最近提交列表
function loadRecentList() {
  const recentEl = document.querySelector('#recent-submits') || document.querySelector('#recentList');
  if (!recentEl) return;
  
  try {
    const saved = localStorage.getItem('recentSubmissions');
    if (!saved) return;
    
    const items = JSON.parse(saved);
    recentEl.innerHTML = '';
    
    items.forEach(item => {
      const li = document.createElement('li');
      li.style.cssText = 'background: var(--card); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:.5rem; cursor:pointer;';
      li.dataset.content = item.content;
      li.innerHTML = `<div><strong>${item.title}</strong></div><div style="opacity:.8; font-size:.9em;">${item.excerpt}</div>`;
      
      // 点击列表项显示完整内容
      li.addEventListener('click', () => {
        const outputEl = document.querySelector('#outputBox');
        if (outputEl) {
          outputEl.textContent = item.content;
          console.log('点击列表项, 输出框已更新为:', item.content);
        }
      });
      
      recentEl.appendChild(li);
    });
    
    console.log('已恢复', items.length, '个最近提交项目');
  } catch (e) {
    console.warn('恢复最近提交列表失败:', e);
  }
}

// 页面加载完成后绑定事件
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成, 开始绑定事件');
  
  const composeSubmitBtn = document.querySelector('#composeSubmit');
  const composeInputArea = document.querySelector('#composeInput');
  
  console.log('composeSubmit:', composeSubmitBtn);
  console.log('composeInput:', composeInputArea);

  composeSubmitBtn?.addEventListener('click', () => {
    console.log('提交按钮被点击');
    submitCurrentNote();
  });

  console.log('事件绑定完成');
  
  // 右侧“刚提交”列表：事件代理，点击任意项联动输出框
  const recentContainer = document.querySelector('#recent-submits') || document.querySelector('#recentList');
  const outputEl2 = document.querySelector('#outputBox');
  recentContainer?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || !recentContainer.contains(li)) return;
    const content = li.dataset.content || '';
    if (outputEl2) {
      outputEl2.textContent = content;
      console.log('点击右侧会话项, 输出框联动更新');
    }
    const rightDrawer = document.querySelector('#right-drawer');
    if (rightDrawer && !rightDrawer.classList.contains('open')) {
      closeAll();
      setAriaOpen(rightDrawer, true);
    }
  });

  // 页面加载时恢复最近提交列表
  loadRecentList();
});

// 事件：新建与列表操作
function initMinimalPersistenceUI(){
  // 顶部抽屉"新建笔记"
  qs('#newNote')?.addEventListener('click', ()=> openEditor(''));

  // 列表事件代理
  listEl?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const li = e.target.closest('li.note-item');
    const id = Number(li?.dataset.id);
    if(btn.classList.contains('btn-del')){
      if(confirm('确认删除该笔记？此操作不可恢复')){
        await window.DB.deleteNote(id);
        await reloadNotes();
      }
    } else if(btn.classList.contains('btn-fav')){
      const on = btn.textContent.includes('已收藏');
      await window.DB.toggleFavoriteNote(id, !on);
      await reloadNotes();
    } else if(btn.classList.contains('btn-copy')){
      // 读取该笔记内容再复制
      const notes = await window.DB.listNotesByTopic(CURRENT_TOPIC.id);
      const n = notes.find(x=> x.id === id);
      if(n){ await navigator.clipboard.writeText(n.contentMD || ''); }
      btn.textContent = '✔ 已复制';
      setTimeout(()=> btn.textContent = '⧉ 复制', 1000);
    }
  });
}

(function initVersionLog(){
  const btn = qs('#btnVersion');
  const dlg = document.getElementById('version-dialog');
  
  btn?.addEventListener('click', async ()=>{
    if (dlg) dlg.showModal();
  });
})();

(async function bootstrap(){
  if(!window.DB){
    console.warn('DB 未就绪, 持久化不可用');
    return;
  }
  const topicId = await window.DB.ensureDefaultTopic();
  CURRENT_TOPIC = await window.DB.getCurrentTopic();
  initMinimalPersistenceUI();
  await reloadNotes();
})();
