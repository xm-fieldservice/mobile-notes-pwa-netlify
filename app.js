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

// 布局变量：根据真实高度写入，保证 2:1 充满可视区
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

  // 一键调试按钮：进入/退出 dev 模式
  function handleDevToggle(){
    // 如版本弹窗开启，先关闭
    try{ document.getElementById('version-dialog')?.close?.(); }catch{}
    const u = new URL(location.href);
    const p = u.searchParams;
    const isDev = p.get('dev') === '1' || sessionStorage.getItem('DEV_MODE') === '1';
    if (isDev){
      sessionStorage.removeItem('DEV_MODE');
      p.delete('dev'); p.delete('t'); p.delete('sw');
      location.href = u.pathname + (p.toString()? ('?'+p.toString()): '') + u.hash;
    } else {
      sessionStorage.setItem('DEV_MODE','1');
      (async ()=>{ try{ await swClearCaches(); await swUnregisterAll(); }catch{} })();
      p.set('dev','1'); p.set('sw','reset'); p.set('t', Date.now().toString());
      location.href = u.pathname + '?' + p.toString() + u.hash;
    }
  }
  // 版本弹窗中的“调试”按钮作为唯一入口
  document.getElementById('btnDevToggle')?.addEventListener('click', handleDevToggle);
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

// 调试通道：?dev=1 禁用SW并显示开发条；?sw=reset 清缓存+注销SW
const url = new URL(location.href);
const params = url.searchParams;

async function swUnregisterAll(){
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r=> r.unregister().catch(()=>{})));
}
async function swClearCaches(){
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map(k=> caches.delete(k)));
}

(async function devChannel(){
  if (params.get('sw') === 'reset'){
    await swClearCaches();
    await swUnregisterAll();
    params.delete('sw');
    history.replaceState({}, '', url.pathname + '?' + params.toString());
    location.reload();
    return;
  }

  const isDev = params.get('dev') === '1' || sessionStorage.getItem('DEV_MODE') === '1';
  if (isDev){
    // 禁用 SW
    await swUnregisterAll();
    sessionStorage.setItem('DEV_MODE','1');
    // 显示开发条
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:calc(var(--bottombar-h));z-index:60;background:#7c3aed;color:#fff;padding:.35rem .5rem;display:flex;gap:.5rem;align-items:center;justify-content:space-between;font-size:.9rem';
    bar.innerHTML = `
      <div>Dev 模式（禁用SW）</div>
      <div style="display:flex;gap:.35rem;">
        <button id="devHardReload">硬刷新</button>
        <button id="devClearCache">清缓存</button>
        <button id="devForceUpdate">SW更新并应用</button>
      </div>`;
    document.body.appendChild(bar);

    // 样式微调按钮
    ['devHardReload','devClearCache','devForceUpdate'].forEach(id=>{
      const b = bar.querySelector('#'+id); if(b){ b.style.cssText='background:#111827;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:.35rem .6rem'; }
    });

    bar.querySelector('#devHardReload')?.addEventListener('click', ()=>{
      // 追加时间戳参数强制网络加载
      params.set('t', Date.now().toString());
      history.replaceState({}, '', url.pathname + '?' + params.toString());
      location.reload();
    });
    bar.querySelector('#devClearCache')?.addEventListener('click', async ()=>{
      await swClearCaches();
      alert('已清理 CacheStorage');
    });
    bar.querySelector('#devForceUpdate')?.addEventListener('click', async ()=>{
      if (!('serviceWorker' in navigator)) return alert('此环境不支持 SW');
      const reg = await navigator.serviceWorker.getRegistration();
      try{ await reg?.update(); }catch{}
      if (reg?.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
        navigator.serviceWorker.addEventListener('controllerchange', ()=> location.reload());
      } else {
        alert('没有 waiting 的 SW，可先点击硬刷新');
      }
    });
  } else {
    // 正常模式注册 SW
    sessionStorage.removeItem('DEV_MODE');
    registerSW();
  }
})();
// 写入布局变量（首屏与旋转/尺寸变化时）
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
  // 优先使用原生 <dialog>，否则降级为 prompt()
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

// 事件：新建与列表操作
function initMinimalPersistenceUI(){
  // 顶部抽屉“新建笔记”
  qs('#newNote')?.addEventListener('click', ()=> openEditor(''));

  // 新布局：提交当前笔记
  async function submitCurrentNote(){
    const val = (composeInput?.value || '').trim();
    if(!val){ composeInput?.focus(); return; }
    const id = await window.DB.addNote(CURRENT_TOPIC.id, val);
    // 输出框显示
    if (outputBox) outputBox.textContent = val;
    // 最近提交列表追加
    if (recentList){
      const li = document.createElement('li');
      li.style.cssText = 'background: var(--card); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:.5rem;';
      const title = mdFirstLine(val) || '未命名笔记';
      const excerpt = mdExcerpt(val);
      li.innerHTML = `<div><strong>${title}</strong></div><div style="opacity:.8; font-size:.9em;">${excerpt}</div>`;
      recentList.prepend(li);
    }
    // 清空输入
    if (composeInput) composeInput.value = '';
    // 打开右侧抽屉
    closeAll(); setAriaOpen(right, true);
    // 简易提示
    try{ 
      if ('vibrate' in navigator) navigator.vibrate(10);
      if (composeSubmit){ composeSubmit.textContent = '已提交'; setTimeout(()=>{ composeSubmit.textContent = '提交'; }, 900); }
    }catch{}
    await reloadNotes();
  }

  composeSubmit?.addEventListener('click', submitCurrentNote);
  composeInput?.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); submitCurrentNote(); }
  });

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
  const pre = dlg?.querySelector('#changelog');
  const btnCheck = dlg?.querySelector('#btnCheckUpdate');
  const btnApply = dlg?.querySelector('#btnApplyUpdate');
  const historyList = dlg?.querySelector('#history-list');

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
        // 渲染历史版本（只读）
        if (Array.isArray(v.releases) && historyList){
          historyList.innerHTML='';
          for (const r of v.releases.slice(0, 10)){
            const li = document.createElement('li');
            li.style.display='flex';
            li.style.alignItems='center';
            li.style.justifyContent='space-between';
            li.style.gap='.5rem';
            li.innerHTML = `
              <div style="display:flex; flex-direction:column">
                <span><strong>${r.version}</strong> · <span style="opacity:.8">${r.date || ''}</span></span>
                <span style="opacity:.85; font-size:.9em">${Array.isArray(r.features)? r.features[0] || '' : ''}</span>
              </div>
              <div style="display:flex; gap:.35rem">
                <button class="btn-copy-ver" data-version="${r.version}">复制版本</button>
                <button class="btn-open-changelog">查看说明</button>
              </div>
            `;
            historyList.appendChild(li);
          }
        }
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

  // 历史列表的事件代理
  historyList?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    if (btn.classList.contains('btn-copy-ver')){
      const ver = btn.getAttribute('data-version') || '';
      navigator.clipboard.writeText(ver).then(()=>{
        btn.textContent='已复制'; setTimeout(()=> btn.textContent='复制版本', 1000);
      });
    } else if (btn.classList.contains('btn-open-changelog')){
      // 打开根目录 CHANGELOG.md（如无则展示版本记录区域）
      window.open('CHANGELOG.md', '_blank');
    }
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
