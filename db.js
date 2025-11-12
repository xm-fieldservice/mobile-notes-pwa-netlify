// 简易 IndexedDB 持久化（仅存 Markdown 笔记与默认议题）
// 暴露到 window.DB，供 app.js 使用

(function(){
  const DB_NAME = 'mobile-notes-db';
  const DB_VER = 1;
  const STORES = { topics: 'topics', notes: 'notes', meta: 'meta' };

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.topics)) {
          const s = db.createObjectStore(STORES.topics, { keyPath: 'id' });
          s.createIndex('by_updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORES.notes)) {
          const s = db.createObjectStore(STORES.notes, { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_topicId_createdAt', ['topicId','createdAt']);
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode, cb){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      try {
        const ret = cb(s);
        // 支持 Promise
        if (ret && typeof ret.then === 'function') {
          ret.then((v)=>{ result = v; }).catch(reject);
        }
        // 支持 IDBRequest
        else if (ret && typeof ret === 'object' && 'onsuccess' in ret) {
          ret.onsuccess = () => { result = ret.result; };
          ret.onerror = () => reject(ret.error);
        } else {
          result = ret;
        }
      } catch (e) { reject(e); }
    });
  }

  async function getMeta(key){
    const rec = await tx(STORES.meta, 'readonly', (s) => s.get(key));
    return rec || null;
  }
  async function setMeta(key, value){
    return tx(STORES.meta, 'readwrite', (s) => s.put({ key, value }));
  }

  async function ensureDefaultTopic(){
    // 读取 currentTopicId
    const cur = await getMeta('currentTopicId');
    if (cur && cur.value) return cur.value;
    // 尝试读取任意 topic
    const any = await tx(STORES.topics, 'readonly', (s)=> s.getAll());
    if (any && any.length){
      const id = any[0].id;
      await setMeta('currentTopicId', id);
      return id;
    }
    // 创建默认议题
    const id = crypto.randomUUID();
    const now = Date.now();
    const topic = { id, name:'默认议题', tags:[], favorite:false, archived:false, createdAt:now, updatedAt:now };
    await tx(STORES.topics, 'readwrite', (s)=> s.put(topic));
    await setMeta('currentTopicId', id);
    return id;
  }

  async function getCurrentTopic(){
    const cur = await getMeta('currentTopicId');
    if (!cur || !cur.value) return null;
    const id = cur.value;
    return tx(STORES.topics, 'readonly', (s)=> s.get(id));
  }

  async function listTopics(){
    return tx(STORES.topics, 'readonly', (s)=> s.getAll());
  }

  async function createTopic(name){
    const id = crypto.randomUUID();
    const now = Date.now();
    const topic = { id, name, tags:[], favorite:false, archived:false, createdAt:now, updatedAt:now };
    await tx(STORES.topics, 'readwrite', (s)=> s.put(topic));
    await setMeta('currentTopicId', id);
    return topic;
  }

  async function listNotesByTopic(topicId){
    return tx(STORES.notes, 'readonly', (s)=> new Promise((resolve, reject)=>{
      const idx = s.index('by_topicId_createdAt');
      const range = IDBKeyRange.bound([topicId, -Infinity], [topicId, Infinity]);
      const out = [];
      const req = idx.openCursor(range, 'prev');
      req.onsuccess = (e)=>{
        const cur = e.target.result;
        if (cur){ out.push(cur.value); cur.continue(); } else resolve(out);
      };
      req.onerror = (e)=> reject(e.target.error);
    }));
  }

  async function addNote(topicId, contentMD){
    const now = Date.now();
    const note = { topicId, contentMD, favorite:false, createdAt: now };
    const id = await tx(STORES.notes, 'readwrite', (s)=> new Promise((resolve,reject)=>{
      const req = s.add(note);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    }));
    // 更新 topic 的 updatedAt
    const topic = await tx(STORES.topics, 'readonly', (s)=> s.get(topicId));
    if (topic) {
      await tx(STORES.topics, 'readwrite', (s)=> s.put({ ...topic, updatedAt: now }));
    }
    return { id, ...note };
  }

  async function deleteNote(id){
    return tx(STORES.notes, 'readwrite', (s)=> s.delete(id));
  }

  async function toggleFavoriteNote(id, val){
    return tx(STORES.notes, 'readwrite', (s)=> new Promise((resolve,reject)=>{
      const getReq = s.get(id);
      getReq.onsuccess = ()=>{
        const v = getReq.result; if(!v) return resolve();
        v.favorite = !!val;
        const putReq = s.put(v);
        putReq.onsuccess = ()=> resolve();
        putReq.onerror = ()=> reject(putReq.error);
      };
      getReq.onerror = ()=> reject(getReq.error);
    }));
  }

  window.DB = {
    ensureDefaultTopic,
    getCurrentTopic,
    listTopics,
    createTopic,
    listNotesByTopic,
    addNote,
    deleteNote,
    toggleFavoriteNote,
  };
  (function(){
    try{
      const params = new URLSearchParams(location.search);
      const SERVER_MODE = (params.get('server') === '1') || (localStorage.getItem('SERVER_MODE') === '1');
      if (SERVER_MODE) {
        const base = localStorage.getItem('SERVER_BASE') || (location.protocol + '//' + location.hostname + ':3000');
        const postJSON = async (path, payload) => {
          const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        };
        window.DB.addNote = async (topicId, contentMD) => {
          const body = { topic_id: String(topicId || ''), final_md: String(contentMD || ''), mode: 'note', team_config_path: null, policy: { index_vector: 0, index_graphrag: 0, index_table: 0 } };
          const res = await postJSON('/submit', body);
          const now = Date.now();
          return { id: res && res.note_id ? res.note_id : '', topicId, contentMD, favorite: false, createdAt: now };
        };
        window.DB.listNotesByTopic = async () => { return []; };
        window.DB.deleteNote = async () => {};
        window.DB.toggleFavoriteNote = async () => {};
      }
    }catch{}
  })();
})();
