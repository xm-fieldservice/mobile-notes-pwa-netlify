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

// 按钮事件
function initButtons() {
  const map = [
    { btn: '#btnLeftMenu', target: left },
    { btn: '#btnRightMenu', target: right },
    { btn: '#btnTopMenu', target: topD },
    { btn: '#btnTopMenu2', target: topD },
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

// PWA：安装提示
function initPWAInstall() {
  let deferredPrompt = null;
  const btn = qs('#installPWA');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });
  btn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    btn.hidden = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    console.log('安装结果:', outcome);
  });
}

// 注册 Service Worker（根路径）
async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js', { scope: '/' });
      console.log('SW 注册成功');
    } catch (e) {
      console.warn('SW 注册失败', e);
    }
  }
}

// 初始化
initButtons();
initGestures();
initPWAInstall();
registerSW();

// =====================
// 最小可用：本地持久化（仅 Markdown 文档）
// 依赖 window.DB（见 db.js）
// =====================

const listEl = qs('.note-list');
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
  listEl.innerHTML = '';
  if(!notes || !notes.length){
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = '<h3>暂无笔记</h3><p>点击顶部抽屉的“新建笔记”或底部“＋ 新建”开始记录。</p>';
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
          <button value="cancel">取消</button>
          <button id="btnSaveNote" value="default" style="background:#22c55e; border-color:#22c55e; color:#0b1020;">保存</button>
        </div>
      </form>
    `;
    document.body.appendChild(dlg);
  }
  const ta = dlg.querySelector('#note-textarea');
  ta.value = initial || '';
  dlg.showModal();
  const saveBtn = dlg.querySelector('#btnSaveNote');
  saveBtn.onclick = async (e)=>{
    e.preventDefault();
    const content = ta.value.trim();
    if(!content){ dlg.close(); return; }
    await window.DB.addNote(CURRENT_TOPIC.id, content);
    dlg.close();
    await reloadNotes();
  };
}

// 事件：新建与列表操作
function initMinimalPersistenceUI(){
  // 顶部抽屉“新建笔记”
  qs('#newNote')?.addEventListener('click', ()=> openEditor(''));

  // 底部“＋ 新建”复用
  qs('#btnTopMenu2')?.addEventListener('click', ()=> openEditor(''));

  // 列表事件代理
  listEl.addEventListener('click', async (e)=>{
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
  const pre = dlg?.querySelector('#changelog');
  const btnCheck = dlg?.querySelector('#btnCheckUpdate');
  const btnApply = dlg?.querySelector('#btnApplyUpdate');

  function setBadge(on){
    try {
      if ('setAppBadge' in navigator && typeof navigator.setAppBadge === 'function'){
        if (on) navigator.setAppBadge(1); else navigator.clearAppBadge();
      }
    } catch {}
    const vbtn = qs('#btnVersion');
    if (on) vbtn?.classList.add('has-update'); else vbtn?.classList.remove('has-update');
    if (btnApply) btnApply.hidden = !on;
  }

  async function fetchVersion(){
    try {
      const r = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function checkUpdate(){
    const reg = await navigator.serviceWorker.getRegistration();
    // 触发 SW 更新检查
    try { await reg?.update(); } catch {}
    // 版本比对
    const remote = await fetchVersion();
    if (remote){
      // 简易比较：与已加载文本中“当前版本”行比对，或仅以存在新 waiting 为准
    }
    // 若有 waiting 直接亮起按钮
    if (reg?.waiting){ setBadge(true); return; }
    setBadge(false);
  }

  async function applyUpdate(){
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting){
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', ()=> location.reload());
    } else {
      await checkUpdate();
    }
  }
  btn?.addEventListener('click', async ()=>{
    try {
      const [vres, cres] = await Promise.all([
        fetch('version.json', { cache: 'no-cache' }),
        fetch('CHANGELOG.md', { cache: 'no-cache' })
      ]);
      let text = '';
      if (vres.ok) {
        const v = await vres.json();
        text += `当前版本: ${v.version}\n构建时间: ${v.buildTime}\n\n`;
        if (Array.isArray(v.releases)) {
          for (const r of v.releases) {
            text += `## ${r.version} - ${r.date}\n- ${Array.isArray(r.features)? r.features.join('\n- '): ''}\n\n`;
          }
        }
      }
      if (cres.ok) {
        const ctext = await cres.text();
        text += `\n==== CHANGELOG ====:\n\n${ctext}`;
      }
      if (pre) pre.textContent = text || '暂无版本记录';
    } catch (e) {
      if (pre) pre.textContent = '加载版本记录失败';
    }
    dlg?.showModal();
  });

  btnCheck?.addEventListener('click', checkUpdate);
  btnApply?.addEventListener('click', applyUpdate);

  // 应用启动与前台时尝试检查
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) checkUpdate(); });
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(()=> checkUpdate());
  }
})();

(async function bootstrap(){
  if(!window.DB){
    console.warn('DB 未就绪，持久化不可用');
    return;
  }
  const topicId = await window.DB.ensureDefaultTopic();
  CURRENT_TOPIC = await window.DB.getCurrentTopic();
  initMinimalPersistenceUI();
  await reloadNotes();
})();
