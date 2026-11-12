import { LESSONS } from './data/lessons.js';
import { QUIZZES, FILLS, CODING, BUGS } from './data/quizzes.js';
import { REFERENCE } from './data/reference.js';
import { GLOSSARY } from './data/glossary.js';
import { TEMPLATES } from './data/templates.js';
import { MISTAKES, PACKAGES, ENV_LESSONS } from './data/extras.js';
import { isB64, nameConflict, normalizeFiles, normalizeProgress, normalizeNotebook, renderMarkdown, explainError, checkCodingAnswer,
  nbToIpynb, ipynbToNb, validFileName, PROTOCOL, SCHEMA } from './lib/core.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IMP = {'最重要':0,'重要':1,'応用':2,'専門':3};
const isBinary = isB64;

/* ---------- banner (storage failures, kernel problems, updates) ---------- */
function banner(text, kind = 'warn', actions = ''){
  const b = $('#banner'); b.className = 'banner ' + kind; b.innerHTML = `<span>${esc(text)}</span>${actions}<button class="banner-x" aria-label="閉じる">✕</button>`;
  b.querySelector('.banner-x').onclick = () => b.classList.add('hidden');
}

/* ---------- persistent state (localStorage, namespaced keys only) ---------- */
const PREFIX = 'pystudio:';
let storageWarned = false;
const store = {
  get(k, d){
    let v = null;
    try { v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); }
    catch(e){
      // never silently discard a value we could not read: keep a copy before falling back to the default
      try { if (v != null && localStorage.getItem('pystudio:corrupt-' + k) == null) localStorage.setItem('pystudio:corrupt-' + k, v); } catch(e2){}
      return d;
    }
  },
  set(k, v){
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; }
    catch(e){
      { banner('端末への保存に失敗しました（保存容量の不足など）。大きなファイルや Notebook の画像出力を減らすか、学習状況タブからバックアップを書き出してください。', 'error'); }
      return false;
    }
  },
  keys(){ const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.push(k); } } catch(e){} return out; }
};
// one-time migration hook: schema 1 (no marker) -> 2. Shapes are normalized, never discarded.
if (store.get('schema', 1) < SCHEMA) {
  const raw = store.get('progress', null);
  if (raw) store.set('progress-backup-v1', raw);
  store.set('progress', normalizeProgress(raw, QUIZZES)); store.set('schema', SCHEMA);
}
let files = normalizeFiles(store.get('files', null));
let currentFile = store.get('currentFile', 'main.py');
if (files[currentFile] == null) currentFile = Object.keys(files)[0];
let progress = normalizeProgress(store.get('progress', null), QUIZZES);
let nbCells = normalizeNotebook(store.get('notebook', null));
let nbMeta = store.get('notebookMeta', null);
function saveProgress(){ return store.set('progress', progress); }
function saveFiles(){ const a = store.set('files', files), b = store.set('currentFile', currentFile); return a && b; }
function saveNotebook(){ const a = store.set('notebook', nbCells); const b = nbMeta ? store.set('notebookMeta', nbMeta) : true; return a && b; }
// keep the stored text byte-exact (e.g. CRLF) unless the user really edited it
// Another tab saved: adopt its state before we save again, so this tab can never write back a stale copy.
window.addEventListener('storage', e => {
  if (e.key === PREFIX + 'progress' && e.newValue) { try { progress = normalizeProgress(JSON.parse(e.newValue), QUIZZES); renderLessonList(); } catch(err){} return; }
  if (e.key === PREFIX + 'notebook' && e.newValue) { try { nbCells = normalizeNotebook(JSON.parse(e.newValue)); if (!$('#view-notebook').classList.contains('active') || !nbCells.length) renderNotebook(); } catch(err){} return; }
  if (e.key !== PREFIX + 'files' || !e.newValue) return;
  try {
    const other = normalizeFiles(JSON.parse(e.newValue));
    const changedNames = Object.keys(other).filter(k => other[k] !== files[k]).length;
    if (!changedNames && Object.keys(other).length === Object.keys(files).length) return;
    files = other;
    if (files[currentFile] == null) currentFile = Object.keys(files)[0];
    setEditorValue(displayText(currentFile)); updateReadOnly(); renderTabs(); runDiagnostics();
    banner('別のタブでの変更を取り込みました。複数のタブで同時に編集すると、後から保存した方の内容が残ります。', 'warn');
  } catch(err){}
});
function syncCurrent(){ const f = currentFile; if (files[f] == null || isBinary(files[f])) return; const v = editorValue(); if (v.replace(/\r\n/g, '\n') !== String(files[f]).replace(/\r\n/g, '\n')) files[f] = v; }

/* ---------- kernel (Pyodide worker) ---------- */
let worker = null, gen = 0, runSeq = 0, kernelState = 'starting', startTimer = null, startTimer2 = null;
const pending = new Map();   // id -> {resolve, onStream, gen}
function setStatus(t){ $('#kernelStatus').textContent = t; }
function newWorker(){
  if (worker) worker.terminate();
  flushPending('カーネルが再起動されたため、この実行は完了しませんでした');
  const myGen = ++gen; kernelState = 'starting'; setStatus('カーネル起動中…（初回は Python 本体を数MBダウンロードします）'); $('#kernelRetry').classList.add('hidden');
  worker = new Worker('worker.js');
  clearTimeout(startTimer); clearTimeout(startTimer2);
  startTimer2 = setTimeout(() => { if (myGen === gen && kernelState === 'starting') { kernelState = 'failed'; setStatus('カーネルの起動がタイムアウトしました（回線が不安定、またはCDNに接続できません）。'); $('#kernelRetry').classList.remove('hidden'); flushPending('Python の起動がタイムアウトしました。「再試行」を押してください。'); } }, 90000);
  startTimer = setTimeout(() => { if (myGen === gen && kernelState === 'starting') setStatus('カーネル起動に時間がかかっています。回線状況を確認してください（オフライン時は過去に一度読み込んだ場合のみ起動できます）。'); }, 30000);
  worker.onmessage = ev => {
    if (myGen !== gen) return;               // reply from a replaced worker
    const m = ev.data;
    if (m.type === 'ready') {
      kernelState = 'ready'; clearTimeout(startTimer); clearTimeout(startTimer2);
      if (m.protocol !== PROTOCOL) { banner('アプリが更新されました。ページを再読み込みしてください（編集中のコードは保存済みです）。', 'warn', '<button onclick="location.reload()">再読み込み</button>'); }
      setStatus('カーネル準備完了（Python ' + m.python + ' / Pyodide 0.26.4）'); runDiagnostics();
      return;
    }
    if (m.type === 'init-error') { kernelState = 'failed'; clearTimeout(startTimer); clearTimeout(startTimer2); setStatus('カーネルを起動できませんでした: ' + m.error); $('#kernelRetry').classList.remove('hidden'); flushPending('Python を起動できませんでした（オフライン、または CDN に接続できません）。「再試行」を押してください。'); return; }
    if (m.type === 'status') { setStatus(m.text); return; }
    if (m.type === 'stream') { const p = pending.get(m.id); if (p) { p.acc = (p.acc || []).concat(m.segs); if (p.onStream) p.onStream(m.segs); } return; }
    if (m.id != null && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p.resolve(m); }
    if (m.type === 'loaded') setStatus(m.error ? 'パッケージ読込失敗: ' + m.error : 'パッケージ読込完了: ' + m.packages.join(', '));
    if (m.type === 'result' && m.fatal) crashed('Python カーネルが致命的なエラーで停止しました。新しいカーネルを起動します（変数は失われました）。');
  };
  worker.onerror = e => { if (myGen !== gen) return; e.preventDefault && e.preventDefault(); crashed('カーネルが異常終了しました: ' + (e.message || '不明なエラー') + '。新しいカーネルを起動します（変数は失われました）。'); };
}
function crashed(msg){ banner(msg, 'error'); newWorker(); nbExecCount = 0; }
function callWorker(msg, onStream){
  return new Promise(resolve => { const id = ++runSeq; pending.set(id, { resolve, onStream }); worker.postMessage({ ...msg, id }); });
}
let runChain = Promise.resolve();
function enqueue(fn){ const p = runChain.then(fn); runChain = p.then(() => {}, () => {}); return p; }
let inflight = 0;   // runs from anywhere (Studio, Notebook, lessons, quizzes): the Stop button follows this, not just Studio
const syncStop = () => { for (const id of ['#stopBtn', '#nbStop']) $(id).disabled = inflight <= 0; };
function runPython(code, opts = {}, onStream){
  // every execution / reset goes through one queue: no interleaved stdout or kernel state
  if (kernelState === 'failed') return Promise.resolve({ type:'result', segs:[{ s:'err', t:'Python が起動していません。画面の「再試行」を押してください。\n' }], error:{ type:'Interrupted', message:'kernel not started', text:'' }, images:[], vars:[], ms:0, syntax:null, warnings:[] });
  inflight++; syncStop();
  const p = enqueue(() => callWorker({ type:'run', code, files: opts.files, stdin: opts.stdin ?? '', isolated: !!opts.isolated,
    wantLast: !!opts.wantLast, filename: opts.filename || 'main.py', stream: !!onStream }, onStream));
  p.finally(() => { inflight--; syncStop(); if (inflight <= 0 && kernelState === 'ready' && /読込中/.test($('#kernelStatus').textContent)) setStatus('カーネル準備完了（Python 3.12 / Pyodide 0.26.4）'); });
  return p;
}
function flushPending(reason){
  for (const [, p] of pending) p.resolve({ type:'result', segs:[...(p.acc || []), { s:'err', t: '\n' + reason + '\n' }], error:{ type:'Interrupted', message: reason, text: reason }, images:[], vars:[], ms:0, syntax:null, warnings:[] });
  pending.clear();
}
$('#kernelRetry').addEventListener('click', () => newWorker());
newWorker();

/* ---------- shared output rendering ---------- */
function segsHtml(segs){ return (segs || []).map(s => s.s === 'err' ? `<span class="cerr">${esc(s.t)}</span>` : esc(s.t)).join(''); }
function outputHtml(res, opts = {}){
  let html = segsHtml(res.segs);
  if (res.result != null) html += `<span class="cres">${esc(res.result)}</span>`;
  if (res.error && res.error.type !== 'Interrupted') {
    const ex = explainError(res.error);
    if (ex) html += `\n<span class="chint">💡 ${esc(ex.text)}${ex.mid ? ` <a href="#" data-goto-mistake="${esc(ex.mid)}">よくある間違いで詳しく見る</a>` : ''}</span>`;
  }
  if (res.note) html += `\n<span class="cnote">${esc(res.note)}</span>`;
  if (res.asyncioShim) html += `\n<span class="cnote">※ ブラウザ版では asyncio.run(…) をトップレベルの await として実行しました（通常の Python では asyncio.run がそのまま動きます）。</span>`;
  if (!html && !opts.keepEmpty) html = '（出力なし）';
  return html;
}
function imagesHtml(images){ return (images || []).map((b, i) => `<img class="plot" alt="グラフ出力 ${i + 1}" src="data:image/png;base64,${esc(b)}">`).join(''); }
document.addEventListener('click', e => { const a = e.target.closest('[data-goto-mistake]'); if (a) { e.preventDefault(); __goMistake(a.dataset.gotoMistake); } });

/* ---------- navigation ---------- */
function showView(name){
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.navbtn').forEach(b => { b.classList.toggle('active', b.dataset.view === name); b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false'); });
  $('#searchResults').classList.add('hidden');
  if (name === 'progress') renderProgress();
  if (name === 'studio' && editor) setTimeout(() => editor.layout(), 0);
}
window.showView = showView;
$('#mainNav').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) showView(b.dataset.view); });
$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = cur; store.set('theme', cur);
  if (window.monaco) monaco.editor.setTheme(cur === 'dark' ? 'vs-dark' : 'vs');
});
{ const t = store.get('theme', ''); const dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }

/* ---------- cross-links ---------- */
const refById = Object.fromEntries(REFERENCE.map(r => [r.id, r]));
const termById = Object.fromEntries(GLOSSARY.map(g => [g.id, g]));
const lessonById = Object.fromEntries(LESSONS.map(l => [l.id, l]));
window.__goRef = id => { showView('reference'); selectRef(id); };
window.__goTerm = id => { showView('glossary'); selectTerm(id); };
window.__goLesson = id => { showView('lessons'); selectLesson(id); };
window.__goMistake = id => { showView('mistakes'); selectMistake(id); };
window.__goEnv = id => { showView('env'); const el = document.getElementById('env-' + id); if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); } };
window.__goQuiz = id => { showView('quiz'); const z = QUIZZES.find(x => x.id === id); if (!z) return; setQmode('choice'); quizQueue = [withShuffledOptions(z)]; quizIdx = 0; quizRight = 0; showChoice(); };
function termChips(ids){ return (ids||[]).filter(id => termById[id]).map(id => `<button class="chip" onclick="__goTerm('${id}')">${esc(termById[id].ja)}</button>`).join(''); }
function refChips(ids){ return (ids||[]).filter(id => refById[id]).map(id => `<button class="chip" onclick="__goRef('${id}')">${esc(refById[id].name)}</button>`).join(''); }

/* ---------- global search ---------- */
function searchAll(q){
  const hits = [];
  const has = (...xs) => xs.join(' ').toLowerCase().includes(q);
  REFERENCE.forEach(r => { if (has(r.name, r.id, r.summary, r.category, r.syntax)) hits.push({t:'リファレンス', title:r.name, sub:r.summary, act:`__goRef('${r.id}')`}); });
  GLOSSARY.forEach(g => { if (has(g.ja, g.en, g.def)) hits.push({t:'用語', title:g.ja, sub:g.def, act:`__goTerm('${g.id}')`}); });
  LESSONS.forEach(l => { if (has(l.title, l.body, l.category, l.code)) hits.push({t:'レッスン', title:l.title, sub:l.goal, act:`__goLesson('${l.id}')`}); });
  QUIZZES.forEach(z => { if (has(z.question, z.code || '', z.category, z.options.join(' '))) hits.push({t:'問題', title:z.question.slice(0,60) + (z.code ? '：' + z.code.split('\n')[0].slice(0, 40) : ''), sub:z.category, act:`__goQuiz('${z.id}')`}); });
  MISTAKES.forEach(m => { if (has(m.title, m.cause, m.phenomenon, m.bad)) hits.push({t:'間違い', title:m.title, sub:m.phenomenon, act:`__goMistake('${m.id}')`}); });
  PACKAGES.forEach(p => { if (has(p.name, p.desc, p.field, p.usage)) hits.push({t:'パッケージ', title:p.name, sub:p.desc, act:`__goEnv('pkg-${p.id}')`}); });
  ENV_LESSONS.forEach(e => { if (has(e.title, e.body, e.points.join(' '))) hits.push({t:'環境構築', title:e.title, sub:e.points[0], act:`__goEnv('${e.id}')`}); });
  const rank = h => { const t = h.title.toLowerCase().replace(/\(\)$/, ''); return t === q ? 0 : t.includes(q) ? 1 : 2; };
  return hits.map((h, i) => [h, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
}
$('#globalSearch').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase(); const box = $('#searchResults');
  if (!q) { box.classList.add('hidden'); return; }
  const hits = searchAll(q);
  box.innerHTML = (hits.length > 30 ? `<div class="meta">${hits.length}件中 30件を表示</div>` : '') + (hits.slice(0, 30).map(h => `<button class="item sr" onclick="${h.act}"><span class="badge">${h.t}</span> <b>${esc(h.title)}</b><div class="meta">${esc(h.sub)}</div></button>`).join('') || '<div class="item">該当なし</div>');
  box.classList.remove('hidden');
});
$('#globalSearch').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; $('#searchResults').classList.add('hidden'); } });

/* ================= Studio ================= */
let editor = null;
let editorReady = false; const readyWaiters = [];
const whenEditorReady = fn => { if (editorReady) fn(); else { setStatus('エディタを読み込み中です。読み込み後に実行します…'); readyWaiters.push(fn); } };   // false while Monaco is loading: never read the (empty, hidden) fallback box as the user's code
function editorValue(){ if (editor) return editor.getValue(); const ta = $('#editorFallback'); return ta.classList.contains('hidden') ? (files[currentFile] ?? '') : ta.value; }
function markEditorReady(){ editorReady = true; readyWaiters.splice(0).forEach(fn => fn()); if (running <= 0) $('#runBtn').disabled = false; $('#runBtn').title = ''; }
let suppressEdit = false;
function setEditorValue(v){ suppressEdit = true; if (editor) editor.setValue(v); else $('#editorFallback').value = v; suppressEdit = false; }
function binaryNote(name){ const len = Math.floor((files[name].length - 7) * 3 / 4); return `# バイナリファイル（または UTF-8 以外の文字コード）: ${name}（約 ${len.toLocaleString()} バイト）\n# エディタでは編集できません。Python からは open("${name}", "rb") や encoding 指定で読み込めます。\n`; }
function displayText(name){ return isBinary(files[name]) ? binaryNote(name) : files[name]; }
function updateReadOnly(){ const ro = isBinary(files[currentFile]); if (editor) editor.updateOptions({ readOnly: ro }); else $('#editorFallback').readOnly = ro; }
function loadScript(src, ms){ return new Promise((res, rej) => { const s = document.createElement('script'); const t = setTimeout(() => rej(new Error('timeout')), ms); s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); rej(new Error('load error')); }; s.src = src; document.head.appendChild(s); }); }
function initEditor(){
  let settled = false, timer = null;
  const fallback = () => { if (settled) return; settled = true; clearTimeout(timer); $('#editor').classList.add('hidden'); const ta = $('#editorFallback'); ta.classList.remove('hidden'); ta.value = displayText(currentFile); ta.addEventListener('input', onEdit); updateReadOnly(); markEditorReady(); $('#editorNote').textContent = 'コードエディタ（Monaco）を読み込めなかったため、簡易エディタで表示しています。'; };
  timer = setTimeout(fallback, 20000);   // Monaco on a hanging CDN must never leave the page without an editor
  loadScript('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js', 10000).then(() => {
    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    window.require(['vs/editor/editor.main'], () => {
      if (settled) return; settled = true; clearTimeout(timer);
      editor = monaco.editor.create($('#editor'), { value: displayText(currentFile), language: 'python', automaticLayout: true,
        fontSize: Number($('#fontSize').value) || 14, minimap: { enabled: false }, tabSize: 4, insertSpaces: true,
        ariaLabel: 'Python コードエディタ', theme: document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs' });
      window.monaco = monaco;
      editor.onDidChangeModelContent(onEdit);
      editor.onDidChangeCursorPosition(() => { if (lastDiag) renderDiagnostics(lastDiag); });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCurrent);
      editor.onMouseDown(e => { if (e.event.detail === 2) lookupWordAtCursor(); });
      $('#editorFallback').classList.add('hidden'); updateReadOnly(); markEditorReady();
      runDiagnostics();
    }, fallback);
  }).catch(fallback);
}
let diagTimer = null, lastEditAt = 0;
function onEdit(){
  if (suppressEdit || isBinary(files[currentFile])) return;
  files[currentFile] = editorValue(); lastEditAt = Date.now(); saveFiles();
  if (editor && window.monaco) monaco.editor.setModelMarkers(editor.getModel(), 'pystudio-run', []);
  clearTimeout(diagTimer); diagTimer = setTimeout(runDiagnostics, 500);
}
/* diagnostics: syntax (real Python parser) + conservative AST warnings, computed in the worker.
   Results carry a sequence number; stale replies are dropped. While the user is still typing
   on/near the line of an "incomplete input" error, it is shown softly and confirmed after a pause. */
let diagSeq = 0, lastDiag = null, softTimer = null; const SOFT_MS = 2500;
function cursorLine(){ if (editor) return editor.getPosition().lineNumber; const ta = $('#editorFallback'); return ta.value.slice(0, ta.selectionStart).split('\n').length; }
async function runDiagnostics(){
  if (kernelState !== 'ready') { $('#diagSummary').textContent = kernelState === 'failed' ? '' : '診断: カーネル起動待ち'; return; }
  const code = isBinary(files[currentFile]) ? '' : editorValue(); const file = currentFile;
  if (!/\.py$/.test(file)) { lastDiag = null; $('#diagList').innerHTML = ''; $('#diagSummary').textContent = ''; setMarkers([]); return; }
  const seq = ++diagSeq;
  const res = await callWorker({ type:'check', code });
  if (seq !== diagSeq || file !== currentFile || code !== editorValue()) return;  // superseded
  lastDiag = res; renderDiagnostics(res);
}
function setMarkers(items){
  if (!(editor && window.monaco)) return;
  const sev = { error: monaco.MarkerSeverity.Error, warn: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info, soft: monaco.MarkerSeverity.Hint };
  monaco.editor.setModelMarkers(editor.getModel(), 'pystudio', items.map(d => ({ severity: sev[d.sev], message: d.msg, startLineNumber: d.line, startColumn: d.col || 1, endLineNumber: d.endLine || d.line, endColumn: Math.max((d.endCol || 200), (d.col || 1) + 1) })));
}
function renderDiagnostics(res){
  clearTimeout(softTimer);
  const items = [];
  if (res.syntax) {
    const s = res.syntax, cl = cursorLine();
    const near = Math.abs(cl - s.line) <= 1 || (res.incomplete && cl >= s.line);
    const soft = near && Date.now() - lastEditAt < SOFT_MS;
    if (soft) softTimer = setTimeout(() => renderDiagnostics(res), SOFT_MS - (Date.now() - lastEditAt) + 30);
    items.push({ sev: soft ? 'soft' : 'error', line: s.line, col: s.col, endLine: s.endLine, endCol: s.endCol, mistake: !soft,
      msg: soft ? `入力途中のため構文はまだ未完成です（${s.msg}）` : `${s.kind}: ${s.msg}（${s.line}行目 ${s.col}列目）` });
  }
  for (const w of res.warnings || []) items.push(w);
  const counts = { error: 0, warn: 0, info: 0 }; items.forEach(d => { if (counts[d.sev] != null) counts[d.sev]++; });
  $('#diagSummary').textContent = res.syntax && items[0].sev === 'soft' ? '診断: 入力中…' : (items.length ? `診断: エラー ${counts.error}・警告 ${counts.warn}・ヒント ${counts.info}` : '診断: 問題なし（構文OK）');
  const icon = { error: '⛔', warn: '⚠', info: 'ℹ', soft: '…' };
  $('#diagList').innerHTML = items.filter(d => d.sev !== 'soft').map(d => `<div class="diag-item ${d.sev}"><button class="linkish" data-goto-line="${d.line}" data-col="${d.col || 1}">${icon[d.sev]} ${d.line}行</button> ${esc(d.msg)}${d.mistake ? ` <button data-view-mistakes="1">よくある間違いで調べる</button>` : ''}</div>`).join('');
  setMarkers(items);
}
$('#diagList').addEventListener('click', e => {
  const g = e.target.closest('[data-goto-line]'); if (g && editor) { const ln = Number(g.dataset.gotoLine); editor.revealLineInCenter(ln); editor.setPosition({ lineNumber: ln, column: Number(g.dataset.col) }); editor.focus(); }
  if (e.target.closest('[data-view-mistakes]')) showView('mistakes');
});
function renderTabs(){
  const names = Object.keys(files);
  $('#tabBar').innerHTML = names.map(f => `<button class="${f === currentFile ? 'active' : ''}" data-file="${esc(f)}" role="tab" aria-selected="${f === currentFile}">${esc(f)}</button>`).join('');
  $('#fileList').innerHTML = names.map(f => `<li class="${f === currentFile ? 'active' : ''}" data-file="${esc(f)}"><span class="fname" title="${esc(f)}">${esc(f)}</span><span class="facts"><button data-dl="${esc(f)}" title="ダウンロード" aria-label="${esc(f)} をダウンロード">⬇</button><button data-ren="${esc(f)}" title="名前変更" aria-label="${esc(f)} の名前を変更">✎</button>${names.length > 1 ? `<button data-del="${esc(f)}" title="削除" aria-label="${esc(f)} を削除">✕</button>` : ''}</span></li>`).join('');
}
function switchFile(f){
  if (files[f] == null) return;
  syncCurrent();
  currentFile = f; setEditorValue(displayText(f)); updateReadOnly(); saveFiles(); renderTabs(); runDiagnostics();
}
function putFile(name, code){
  files[name] = code;
  if (name === currentFile) { setEditorValue(displayText(name)); updateReadOnly(); saveFiles(); renderTabs(); runDiagnostics(); }
  else { saveFiles(); switchFile(name); }
}
function openInStudio(name, code){
  syncCurrent();
  if (files[name] != null && files[name] !== code && !confirm(`「${name}」には既に別の内容（編集済みの可能性があります）があります。元のコードで上書きしますか？\n［キャンセル］で、今あるファイルをそのまま開きます。`)) { switchFile(name); showView('studio'); return; }
  putFile(name, code); showView('studio');
}
$('#tabBar').addEventListener('click', e => { const b = e.target.closest('[data-file]'); if (b) switchFile(b.dataset.file); });
let fileRowMode = 'new', renameFrom = null;
function openFileRow(mode, from){
  fileRowMode = mode; renameFrom = from || null; const row = $('#newFileRow'); row.classList.remove('hidden');
  $('#newFileName').value = from || ''; $('#createFileBtn').textContent = mode === 'new' ? '作成' : '変更'; $('#fileRowError').textContent = '';
  $('#newFileName').focus(); $('#newFileName').select();
}
$('#fileList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { const n = del.dataset.del; if (!confirm(`「${n}」を削除しますか？（元に戻せません）`)) return; delete files[n]; if (currentFile === n) { currentFile = Object.keys(files)[0]; setEditorValue(displayText(currentFile)); updateReadOnly(); } saveFiles(); renderTabs(); runDiagnostics(); return; }
  const dl = e.target.closest('[data-dl]'); if (dl) { downloadFile(dl.dataset.dl); return; }
  const ren = e.target.closest('[data-ren]'); if (ren) { openFileRow('rename', ren.dataset.ren); return; }
  const li = e.target.closest('[data-file]'); if (li) switchFile(li.dataset.file);
});
$('#addFileBtn').addEventListener('click', () => { const row = $('#newFileRow'); if (!row.classList.contains('hidden') && fileRowMode === 'new') row.classList.add('hidden'); else openFileRow('new'); });
function submitFileRow(){
  const name = $('#newFileName').value.trim(); const err = validFileName(name) || (files[name] == null || fileRowMode === 'rename' ? nameConflict(name, files, renameFrom) : null);
  if (err) { $('#fileRowError').textContent = err; return; }
  if (fileRowMode === 'new') {
    if (files[name] != null) { switchFile(name); }
    else { files[name] = ''; switchFile(name); }
  } else if (renameFrom && name !== renameFrom) {
    if (files[name] != null) { $('#fileRowError').textContent = '同じ名前のファイルがあります'; return; }
    if (!isBinary(files[renameFrom]) && renameFrom === currentFile) files[renameFrom] = editorValue();
    const entries = Object.entries(files).map(([k, v]) => k === renameFrom ? [name, v] : [k, v]);
    files = Object.fromEntries(entries); if (currentFile === renameFrom) currentFile = name; saveFiles(); renderTabs();
  }
  $('#newFileRow').classList.add('hidden'); $('#newFileName').value = ''; $('#fileRowError').textContent = '';
}
$('#createFileBtn').addEventListener('click', submitFileRow);
$('#newFileName').addEventListener('keydown', e => { if (e.key === 'Enter') submitFileRow(); if (e.key === 'Escape') $('#newFileRow').classList.add('hidden'); });
function b64ToBytes(b64){ const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
function downloadFile(name){
  const v = name === currentFile && !isBinary(files[name]) ? editorValue() : files[name];
  const blob = isBinary(v) ? new Blob([b64ToBytes(v.slice(7))]) : new Blob([v], { type: 'text/plain;charset=utf-8' });
  downloadBlob(name.split('/').pop(), blob);
}
function mergeChanges(ch, before){
  if (!ch) return '';
  const notes = [], kept = [];
  for (const c of ch.changed) {
    if (before && before[c.name] !== undefined && files[c.name] !== before[c.name]) { kept.push(c.name); continue; }   // the user edited it during the run
    files[c.name] = c.content; notes.push(c.name);
  }
  for (const n of ch.deleted) if (n !== currentFile && files[n] != null && Object.keys(files).length > 1) delete files[n];
  if (ch.changed.length || ch.deleted.length) { saveFiles(); renderTabs(); if (ch.changed.some(c => c.name === currentFile)) setEditorValue(displayText(currentFile)); }
  let msg = notes.length ? `プログラムが作成・更新したファイルをファイル一覧に反映しました: ${notes.join(', ')}` : '';
  if (kept.length) msg += (msg ? '\n' : '') + `実行中に編集された内容を残すため、プログラムの書込みは反映しなかったファイル: ${kept.join(', ')}`;
  if (ch.deleted.length) msg += (msg ? '\n' : '') + `プログラムが削除したファイル（一覧から外しました）: ${ch.deleted.join(', ')}`;
  if (ch.tooLarge.length) msg += (msg ? '\n' : '') + `大きすぎるため一覧に保存しなかったファイル（実行中のカーネル内には残っています）: ${ch.tooLarge.map(t => t.name + '（' + Math.round(t.size / 1024) + 'KB）').join(', ')}`;
  return msg;
}
let running = 0;
function setRunning(d){ running += d; $('#runBtn').disabled = running > 0 || !editorReady; $('#runState').textContent = running > 0 ? '実行中…' : ''; }
async function runCurrent(){
  if (running > 0 || !editorReady) return;   // one Studio run at a time (button is disabled too)
  if (isBinary(files[currentFile])) { $('#console').textContent = `「${currentFile}」は UTF-8 以外の文字コードのため、バイナリとして読み込まれています。実行するには UTF-8 で保存し直してください。`; return; }
  syncCurrent();
  saveFiles();
  if (!/\.py$/.test(currentFile)) { $('#console').textContent = `「${currentFile}」は Python ファイル（.py）ではないため実行できません。`; return; }
  const code = files[currentFile];
  reveal('consoleHead');
  const con = $('#console'); con.innerHTML = ''; $('#plotArea').innerHTML = ''; $('#runTime').textContent = '';
  let streamed = '';
  const snapshotAtStart = { ...files };
  setRunning(1);
  const res = await runPython(code, { files, stdin: $('#stdinBox').value, filename: currentFile }, segs => { streamed += segsHtml(segs); con.innerHTML = streamed; con.scrollTop = con.scrollHeight; });
  setRunning(-1);
  $('#runTime').textContent = `（${res.ms} ms）`;
  const changeMsg = mergeChanges(res.changes, snapshotAtStart);
  con.innerHTML = outputHtml(res) + (changeMsg ? `\n<span class="cnote">${esc(changeMsg)}</span>` : '');
  $('#plotArea').innerHTML = imagesHtml(res.images);
  renderVars(res.vars);
  if (res.error && res.error.line && editor && window.monaco && res.error.file === currentFile) {
    monaco.editor.setModelMarkers(editor.getModel(), 'pystudio-run', [{ severity: monaco.MarkerSeverity.Error, message: `${res.error.type}: ${res.error.message}`, startLineNumber: res.error.line, startColumn: 1, endLineNumber: res.error.line, endColumn: 1000 }]);
  }
  runDiagnostics();
}
function renderVars(vars){
  $('#varsView').innerHTML = vars && vars.length ? `<table class="vars"><tr><th>名前</th><th>型</th><th>値</th></tr>${vars.map(v => `<tr><td>${esc(v.name)}</td><td>${esc(v.type)}${v.len != null ? `<span class="meta">（len ${v.len}）</span>` : ''}</td><td><code>${esc(v.value)}</code></td></tr>`).join('')}</table>` : '（変数なし）';
}
$('#runBtn').addEventListener('click', runCurrent);
function stopKernel(){
  if (confirm('実行を中断します。Python カーネルを作り直すため、変数などの状態は失われます（ファイルは残ります）。よろしいですか？')) {
    newWorker(); nbExecCount = 0; $('#varsView').textContent = '（中断によりカーネルを再起動しました）';
  }
}
$('#stopBtn').addEventListener('click', stopKernel);
$('#nbStop').addEventListener('click', stopKernel);   // the Notebook view has no Studio toolbar: it needs its own stop button
$('#resetKernelBtn').addEventListener('click', async () => { await enqueue(() => callWorker({ type:'reset' })); nbExecCount = 0; renderVars([]); setStatus('カーネルをリセットしました（変数・読み込んだ自作モジュールを消去）'); });
$$('.pkg-btns button').forEach(b => b.addEventListener('click', () => { setStatus(b.dataset.pkg + ' を読み込み中…'); enqueue(() => callWorker({ type:'load', packages:[b.dataset.pkg] })); }));
$('#sampleCsvBtn').addEventListener('click', () => { if (files['sales.csv'] != null && !confirm('「sales.csv」は既にあります。サンプルの内容で上書きしますか？')) return; files['sales.csv'] = 'month,sales\n1,120\n2,150\n3,90\n4,200\n'; saveFiles(); renderTabs(); setStatus('sales.csv を作成しました。pd.read_csv("sales.csv") で読み込めます'); });
$('#fileUpload').addEventListener('change', async e => {
  const list = [...e.target.files]; if (!list.length) return;
  for (const f of list) {
    const err = validFileName(f.name); if (err) { alert(`「${f.name}」は取り込めません: ${err}`); continue; }
    const nc = nameConflict(f.name, files); if (nc) { alert(`「${f.name}」は取り込めません: ${nc}`); continue; }
    if (files[f.name] != null && !confirm(`「${f.name}」は既にあります。上書きしますか？`)) continue;
    const buf = new Uint8Array(await f.arrayBuffer());
    let text = null;
    // keep bytes exactly: UTF-8 (without BOM) is stored as text, anything else as binary
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf); if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); } catch(err2) { text = null; }
    if (text === null) { let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); files[f.name] = 'base64:' + btoa(bin); }
    else files[f.name] = text;
  }
  e.target.value = '';
  saveFiles(); renderTabs(); if (files[list[0].name] != null) switchFile(list[0].name);
});
$('#fontSize').addEventListener('change', e => { const v = Math.min(22, Math.max(11, Number(e.target.value) || 14)); store.set('fontSize', v); if (editor) editor.updateOptions({ fontSize: v }); });
$('#fontSize').value = store.get('fontSize', 14);

/* ----- side panel: reference & glossary always visible ----- */
let sideTab = 'ref';
function renderSideList(){
  const q = ($('#sideSearch').value || '').toLowerCase();
  $('#sideTabRef').classList.toggle('active', sideTab === 'ref'); $('#sideTabRef').setAttribute('aria-selected', sideTab === 'ref');
  $('#sideTabGloss').classList.toggle('active', sideTab === 'gloss'); $('#sideTabGloss').setAttribute('aria-selected', sideTab === 'gloss');
  if (sideTab === 'ref') {
    const list = REFERENCE.filter(r => !q || (r.name + r.summary + r.category + r.id).toLowerCase().includes(q))
      .sort((a, b) => (IMP[a.importance] - IMP[b.importance]) || a.name.localeCompare(b.name));
    $('#sideList').innerHTML = list.map(r => `<button class="side-item" onclick="__sideRef('${r.id}')"><span>${esc(r.name)}</span><span class="meta">${esc(r.importance)}・${esc(r.category)}</span></button>`).join('') || '<div class="side-item">該当なし</div>';
  } else {
    const list = GLOSSARY.filter(g => !q || (g.ja + g.en + g.def).toLowerCase().includes(q))
      .sort((a, b) => (IMP[a.importance] - IMP[b.importance]) || a.ja.localeCompare(b.ja));
    $('#sideList').innerHTML = list.map(g => `<button class="side-item" onclick="__sideTerm('${g.id}')"><span>${esc(g.ja)}</span><span class="meta">${esc(g.importance)}・${esc(g.en)}</span></button>`).join('') || '<div class="side-item">該当なし</div>';
  }
}
$('#sideTabRef').addEventListener('click', () => { sideTab = 'ref'; renderSideList(); });
$('#sideTabGloss').addEventListener('click', () => { sideTab = 'gloss'; renderSideList(); });
$('#sideSearch').addEventListener('input', renderSideList);
window.__sideRef = id => { const r = refById[id]; if (r) { sideTab = 'ref'; renderSideList(); showSideRef(r); } };
window.__sideTerm = id => { const g = termById[id]; if (g) { sideTab = 'gloss'; renderSideList(); showSideTerm(g); } };

function lookupWordAtCursor(){
  let word = '', dotted = '';
  if (editor) {
    const pos = editor.getPosition(); const model = editor.getModel(); const w = model.getWordAtPosition(pos); word = w ? w.word : '';
    if (w) { const line = model.getLineContent(pos.lineNumber); const m = line.slice(0, w.endColumn - 1).match(/[\w.]+$/); dotted = m ? m[0] : word; }
  } else { const ta = $('#editorFallback'); const s = ta.selectionStart; const m = ta.value.slice(0, s).match(/[\w.]+$/); dotted = m ? m[0] : ''; word = dotted.split('.').pop(); }
  if (!word) { $('#sideDetail').textContent = '単語の上にカーソルを置いてください。'; return; }
  const last2 = dotted.split('.').slice(-2).join('.');
  for (const c of [dotted, last2, word]) {
    const r = REFERENCE.find(x => x.id === c || x.name.replace(/\(\)$/,'') === c) || (c === word ? REFERENCE.find(x => x.id.endsWith('.' + c)) : null);
    if (r) { sideTab = 'ref'; renderSideList(); return showSideRef(r); }
    const g = GLOSSARY.find(x => x.en.toLowerCase() === c.toLowerCase() || x.id === c);
    if (g) { sideTab = 'gloss'; renderSideList(); return showSideTerm(g); }
  }
  $('#sideDetail').innerHTML = `「${esc(word)}」のリファレンス項目は見つかりませんでした。全体検索も試してください。`;
}
function showSideRef(r){
  $('#sideDetail').innerHTML = `<h3 style="margin:2px 0">${esc(r.name)} <span class="badge">${esc(r.importance)}</span></h3>
  <p>${esc(r.summary)}</p><pre>${esc(r.syntax)}</pre>
  <p class="kv">引数: ${esc(r.args)}／戻り値: ${esc(r.returns)}</p>
  <pre>${esc(r.example)}</pre><p class="kv">出力: ${esc(r.expected)}</p>
  <p>⚠ ${esc(r.pitfalls)}</p>
  <button class="chip" onclick="__goRef('${r.id}')">詳細を開く</button> ${r.lesson && lessonById[r.lesson] ? `<button class="chip" onclick="__goLesson('${r.lesson}')">関連レッスン</button>` : ''}`;
}
function showSideTerm(g){
  $('#sideDetail').innerHTML = `<h3 style="margin:2px 0">${esc(g.ja)}（${esc(g.en)}）</h3><p>${esc(g.def)}</p><p class="kv">${esc(g.easy)}</p>
  <button class="chip" onclick="__goTerm('${g.id}')">用語詳細を開く</button>`;
}
$('#refWordBtn').addEventListener('click', lookupWordAtCursor);

/* ----- study templates: explanation with glossary term links + load & run ----- */
const TERM_PATTERNS = (() => {
  const pats = [];
  for (const g of GLOSSARY) { pats.push({ s: g.ja, id: g.id }); if (g.en && g.en.length >= 4 && !g.en.includes(' ')) pats.push({ s: g.en, id: g.id }); }
  pats.sort((a, b) => b.s.length - a.s.length);
  return pats;
})();
function linkTerms(text){
  // single pass over the raw text so inserted markup is never rescanned
  let out = '', i = 0;
  while (i < text.length) {
    let hit = null;
    for (const p of TERM_PATTERNS) { if (text.startsWith(p.s, i)) { hit = p; break; } }
    if (hit) { out += `<button class="term-link" onclick="__sideTerm('${hit.id}')">${esc(hit.s)}</button>`; i += hit.s.length; }
    else { out += esc(text[i]); i += 1; }
  }
  return out;
}
let selectedTpl = null;
function renderTplList(){
  $('#tplList').innerHTML = TEMPLATES.map(t => `<li class="${selectedTpl === t.id ? 'active' : ''}"><button class="tpl-item" onclick="__tpl('${t.id}')">${esc(t.title)} <span class="meta">${esc(t.level)}</span></button></li>`).join('');
}
window.__tpl = id => {
  selectedTpl = id; renderTplList();
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  const d = $('#tplDetail'); d.classList.remove('hidden');
  d.innerHTML = `<h4>${esc(t.title)} <span class="badge">${esc(t.level)}</span></h4>
    <p>${linkTerms(t.explain)}</p>
    <p class="kv">想定出力:</p><pre>${esc(t.expected)}</pre>
    <div class="tpl-btns">
      <button class="primary" onclick="__tplOpen('${t.id}')">エディタで開く</button>
      <button onclick="__tplRun('${t.id}')">開いて実行</button>
      <button onclick="__tplReset('${t.id}')">元のコードに戻す</button>
    </div>
    <p class="kv">解説の中の下線付きの言葉を押すと、右パネルに用語の説明が出ます。</p>`;
};
function tplFile(t){ if (files[t.file] == null) files[t.file] = t.code; switchFile(t.file); }
window.__tplOpen = id => { const t = TEMPLATES.find(x => x.id === id); if (t) tplFile(t); };
window.__tplReset = id => { const t = TEMPLATES.find(x => x.id === id); if (t && confirm('「' + t.file + '」を元のコードに戻します（編集内容は失われます）。よろしいですか？')) putFile(t.file, t.code); };
window.__tplRun = id => { const t = TEMPLATES.find(x => x.id === id); if (t) { tplFile(t); whenEditorReady(runCurrent); } };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && $('#view-studio').classList.contains('active') && !editor) { e.preventDefault(); runCurrent(); } });

/* ================= Notebook ================= */
let nbExecCount = 0;
function cellOutHtml(c){ if (!c.output) return ''; return outputHtml(c.output, { keepEmpty: true }) + imagesHtml(c.output.images); }
function renderNotebook(focusIdx){
  $('#nbCells').innerHTML = nbCells.map((c, i) => `<div class="nb-cell ${c.type}">
    <div class="toolbar"><span class="badge">${c.type === 'code' ? `コード [${c.count ?? ' '}]` : c.type === 'raw' ? 'Raw' : 'Markdown'}</span>
      <button data-nb="up" data-i="${i}" aria-label="上へ移動">↑</button><button data-nb="down" data-i="${i}" aria-label="下へ移動">↓</button>
      ${c.type === 'code' ? `<button data-nb="run" data-i="${i}" class="primary">▶ 実行</button>` : ''}
      <button data-nb="del" data-i="${i}">削除</button></div>
    <textarea data-cell="${i}" rows="${c.type === 'code' ? Math.max(3, Math.min(20, c.source.split('\n').length + 1)) : 3}" spellcheck="false" aria-label="セル ${i + 1}">${esc(c.source)}</textarea>
    ${c.type === 'markdown' ? `<div class="nb-md">${renderMarkdown(c.source)}</div>` : ''}
    ${c.type === 'code' ? `<div class="nb-out" id="nbOut${i}">${cellOutHtml(c)}</div>` : ''}</div>`).join('');
  saveNotebook();
  if (focusIdx != null) { const t = $(`[data-cell="${focusIdx}"]`); if (t) t.focus(); }
}
$('#nbCells').addEventListener('input', e => {
  const i = e.target.dataset.cell; if (i == null) return;
  nbCells[i].source = e.target.value; saveNotebook();
  if (nbCells[i].type === 'markdown') { const md = e.target.parentElement.querySelector('.nb-md'); if (md) md.innerHTML = renderMarkdown(e.target.value); }
});
let nbTabPass = false;
function codeKeys(e){
  const ta = e.target; if (ta.tagName !== 'TEXTAREA') return;
  const code = ta.dataset.cell != null ? (nbCells[ta.dataset.cell] && nbCells[ta.dataset.cell].type === 'code') : (ta.id === 'codeAns' || ta.id === 'bugAns');
  if (!code && ta.dataset.cell == null) return;
  if (e.key === 'Escape') { nbTabPass = true; return; }
  if (code && e.key === 'Tab' && !e.shiftKey && !nbTabPass && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
  nbTabPass = false;
  if (code && e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {
    const before = ta.value.slice(0, ta.selectionStart); const line = before.slice(before.lastIndexOf('\n') + 1); const indent = line.match(/^ */)[0] + (/:\s*$/.test(line) ? '    ' : '');
    if (indent) { e.preventDefault(); ta.setRangeText('\n' + indent, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }
}
$('#nbCells').addEventListener('keydown', codeKeys);
$('#quizArea').addEventListener('keydown', codeKeys);
$('#nbCells').addEventListener('keydown', e => { const i = e.target.dataset.cell; if (i != null && (e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter' && nbCells[i].type === 'code') { e.preventDefault(); runCell(Number(i)); } });
async function runCell(i){
  const c = nbCells[i]; const out = $('#nbOut' + i); if (out) out.innerHTML = '<span class="cnote">実行中…</span>';
  const r = await runPython(c.source, { files, stdin: $('#nbStdin').value, wantLast: true, filename: `セル ${i + 1}` });
  const changeMsg = mergeChanges(r.changes);
  c.count = r.error && r.error.type === 'Interrupted' ? null : ++nbExecCount;
  c.output = { segs: r.segs, result: r.result, images: r.images, error: r.error, note: [r.note, changeMsg].filter(Boolean).join('\n') || null };
  renderNotebook(i); return r;
}
$('#nbCells').addEventListener('click', async e => {
  const b = e.target.closest('[data-nb]'); if (!b) return; const i = Number(b.dataset.i);
  if (b.dataset.nb === 'del') { if (nbCells[i].source.trim() && !confirm('このセルを削除しますか？')) return; nbCells.splice(i, 1); }
  if (b.dataset.nb === 'up' && i > 0) [nbCells[i-1], nbCells[i]] = [nbCells[i], nbCells[i-1]];
  if (b.dataset.nb === 'down' && i < nbCells.length - 1) [nbCells[i+1], nbCells[i]] = [nbCells[i], nbCells[i+1]];
  if (b.dataset.nb === 'run') { await runCell(i); return; }
  renderNotebook();
});
$('#nbAddCode').addEventListener('click', () => { nbCells.push({type:'code', source:''}); renderNotebook(nbCells.length - 1); });
$('#nbAddMd').addEventListener('click', () => { nbCells.push({type:'markdown', source:''}); renderNotebook(nbCells.length - 1); });
$('#nbRunAll').addEventListener('click', async () => {
  for (let i = 0; i < nbCells.length; i++) if (nbCells[i].type === 'code') { const r = await runCell(i); if (r.error) { banner(`セル ${i + 1} でエラーが発生したため、全セル実行を止めました。`, 'warn'); break; } }
});
$('#nbExport').addEventListener('click', () => downloadBlob('notebook.ipynb', new Blob([JSON.stringify(nbToIpynb(nbCells, nbMeta), null, 1)], { type: 'application/x-ipynb+json' })));
$('#nbImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const { cells, metadata } = ipynbToNb(JSON.parse(await f.text()));
    if (nbCells.some(c => c.source.trim()) && !confirm(`現在の Notebook（${nbCells.length}セル）を「${f.name}」（${cells.length}セル）で置き換えますか？`)) return;
    nbCells = cells; nbMeta = metadata; nbExecCount = 0; renderNotebook();
  } catch(err){ alert('.ipynb を読み込めませんでした: ' + err.message); }
});
function downloadBlob(name, blob){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ================= Lessons ================= */
function renderLessonList(){
  const q = ($('#lessonFilter').value || '').toLowerCase();
  $('#lessonList').innerHTML = LESSONS.filter(l => !q || (l.title + l.body + l.category).toLowerCase().includes(q)).map(l =>
    `<button class="item" onclick="__goLesson('${l.id}')"><b>${esc(l.title)}</b> ${progress.lessonsDone.includes(l.id) ? '<span class="badge ok">学習済</span>' : ''}<div class="meta">${esc(l.level)}・${esc(l.category)}</div></button>`).join('');
}
$('#lessonFilter').addEventListener('input', renderLessonList);
function relatedQuizzes(lessonId){ return QUIZZES.filter(z => z.lesson === lessonId); }
function reveal(id){ if (matchMedia('(max-width:900px)').matches) { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); } }
function selectLesson(id){
  const l = lessonById[id]; if (!l) return; renderLessonList(); setTimeout(() => reveal('lessonDetail'), 0);
  const qs = relatedQuizzes(id);
  $('#lessonDetail').innerHTML = `<h2>${esc(l.title)}</h2><div class="kv">${esc(l.level)}・${esc(l.category)}</div>
    <p><b>学習目標:</b> ${esc(l.goal)}</p>
    <p style="white-space:pre-wrap">${esc(l.body)}</p>
    <h3>コード</h3><pre>${esc(l.code)}</pre>
    <div class="toolbar"><button class="primary" data-lesson-run="${l.id}">▶ その場で実行</button><button data-lesson-studio="${l.id}">Studioで試す</button><button data-lesson-done="${l.id}">${progress.lessonsDone.includes(l.id) ? '学習済を解除' : '学習済にする'}</button></div>
    <div id="lessonOut"></div>
    <p><b>期待される出力</b></p><pre>${esc(l.expected)}</pre>
    <p>⚠ <b>よくある間違い:</b> ${esc(l.pitfalls)}</p>
    <div>${termChips(l.terms)} ${refChips(l.refs)}</div>
    ${qs.length ? `<p><b>このレッスンの確認問題（${qs.length}問）</b></p><div class="toolbar"><button data-lesson-quiz="${l.id}">▶ 確認問題を解く</button></div>` : ''}`;
}
const normOut = s => String(s ?? '').replace(/\r\n/g, '\n').split('\n').map(x => x.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
$('#lessonDetail').addEventListener('click', async e => {
  const run = e.target.closest('[data-lesson-run]'), st = e.target.closest('[data-lesson-studio]'), dn = e.target.closest('[data-lesson-done]'), qz = e.target.closest('[data-lesson-quiz]');
  if (run) {
    const l = lessonById[run.dataset.lessonRun]; $('#lessonOut').innerHTML = '<p class="kv">実行中…（初回はPythonの起動に時間がかかります）</p>';
    const r = await runPython(l.code, { isolated: true, filename: `<lesson ${l.id}>` });
    const out = (r.segs || []).filter(s => s.s === 'out').map(s => s.t).join('');
    $('#lessonOut').innerHTML = `<pre class="console">${outputHtml(r)}</pre>${imagesHtml(r.images)}<p class="kv">${r.error ? 'エラーになりました' : (normOut(out) === normOut(l.expected) ? '✅ 期待出力と一致' : '⚠ 期待出力と異なります（コードを変更した場合や環境差の可能性があります）')}</p>`;
  }
  if (st) { const l = lessonById[st.dataset.lessonStudio]; openInStudio('lesson_' + l.id.replace(/\W/g, '_') + '.py', l.code); }
  if (dn) { const id = dn.dataset.lessonDone; progress.lessonsDone = progress.lessonsDone.includes(id) ? progress.lessonsDone.filter(x => x !== id) : [...progress.lessonsDone, id]; saveProgress(); selectLesson(id); }
  if (qz) { showView('quiz'); setQmode('choice'); quizQueue = shuffled(relatedQuizzes(qz.dataset.lessonQuiz)).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice(); }
});

/* ================= Quiz ================= */
let qmode = 'choice', quizQueue = [], quizIdx = 0, quizRight = 0, optShuffle = store.get('optShuffle', true);
function shuffled(arr){ const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function withShuffledOptions(z){
  if (!optShuffle) return z;
  const order = shuffled(z.options.map((_, i) => i));
  return { ...z, options: order.map(i => z.options[i]), answer: order.indexOf(z.answer) };
}
const qkey = z => z.question != null ? 'quiz:' + z.id : 'fill:' + z.id;
function bmButton(key){ const on = progress.bookmarks.includes(key); return `<button data-bmkey="${esc(key)}" aria-pressed="${on}">${on ? '★ ブックマーク中' : '☆ ブックマーク'}</button>`; }
function recordQuiz(key, ok){ progress.history.push({ t: new Date().toISOString(), key, ok }); if (progress.history.length > 2000) progress.history = progress.history.slice(-2000); if (!ok && !progress.wrong.includes(key)) progress.wrong.push(key); if (ok) progress.wrong = progress.wrong.filter(x => x !== key); saveProgress(); }
function labelOf(key){
  const [kind, ...rest] = key.split(':'); const id = rest.join(':');
  if (kind === 'quiz') { const z = QUIZZES.find(x => x.id === id); return z ? '四択: ' + z.question.slice(0, 36) + (z.code ? '（' + z.code.split('\n')[0].slice(0, 24) + '）' : '') : key; }
  if (kind === 'fill') { const z = FILLS.find(x => x.id === id); return z ? '穴埋め: ' + z.q : key; }
  if (kind === 'code') { const c = CODING.find(x => x.id === id); return c ? 'コーディング: ' + c.title : key; }
  if (kind === 'bug') { const c = BUGS.find(x => x.id === id); return c ? 'バグ修正: ' + c.title : key; }
  return key;
}
function setQmode(m){ qmode = m; $$('.qmode').forEach(x => { x.classList.toggle('active', x.dataset.qmode === m); x.setAttribute('aria-pressed', x.dataset.qmode === m); }); }
function startQuiz(){
  const area = $('#quizArea'); $('#quizScore').textContent = '';
  if (qmode === 'choice') { quizQueue = shuffled(QUIZZES).slice(0, 10).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice(); }
  else if (qmode === 'fill') { quizQueue = shuffled(FILLS).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice(); }
  else if (qmode === 'code') area.innerHTML = CODING.map(c => `<button class="item" onclick="__codeTask('${c.id}')"><b>${esc(c.title)}</b> ${progress.wrong.includes('code:' + c.id) ? '<span class="badge hot">要復習</span>' : ''}<div class="meta">${esc(c.desc)}</div></button>`).join('');
  else area.innerHTML = BUGS.map(c => `<button class="item" onclick="__bugTask('${c.id}')"><b>${esc(c.title)}</b> ${progress.wrong.includes('bug:' + c.id) ? '<span class="badge hot">要復習</span>' : ''}<div class="meta">バグを直して実行してください</div></button>`).join('');
}
function showChoice(){
  const z = quizQueue[quizIdx];
  if (!z) { $('#quizArea').innerHTML = `<div class="explain">終了: ${quizRight} / ${quizQueue.length} 正解</div><div class="toolbar"><button class="primary" onclick="__restartQuiz()">もう一度</button>${progress.wrong.length ? '<button onclick="__reviewWrong()">間違えた問題を復習</button>' : ''}</div>`; $('#quizScore').textContent = ''; return; }
  $('#quizScore').textContent = `問題 ${quizIdx + 1} / ${quizQueue.length} ・ 正解 ${quizRight}`;
  const isFill = z.question == null;
  $('#quizArea').innerHTML = `<p>${isFill ? '<span class="badge">穴埋め</span>' : `<span class="badge">${esc(z.category)}</span><span class="badge">${esc(z.level)}</span>`} ${bmButton(qkey(z))}</p>
  ${isFill ? `<p><b>空欄 ___ に入るものを選んでください</b></p><pre class="code">${esc(z.q)}</pre>` : `<p><b>${esc(z.question)}</b></p>${z.code ? `<pre class="code">${esc(z.code)}</pre>` : ''}`}
  <div role="group" aria-label="選択肢">${z.options.map((o, i) => `<button class="opt" data-opt="${i}"><span class="optno">${'ABCD'[i]}</span> ${esc(o)}</button>`).join('')}</div><div id="qExplain" aria-live="polite"></div>`;
}
window.__restartQuiz = () => startQuiz();
$('#quizArea').addEventListener('click', e => {
  const bk = e.target.closest('[data-bmkey]');
  if (bk) { toggleBookmark(bk.dataset.bmkey); const on = progress.bookmarks.includes(bk.dataset.bmkey); bk.textContent = on ? '★ ブックマーク中' : '☆ ブックマーク'; bk.setAttribute('aria-pressed', on); return; }
  const b = e.target.closest('[data-opt]'); if (!b || b.disabled) return;
  const z = quizQueue[quizIdx]; const pick = Number(b.dataset.opt); const ok = pick === z.answer;
  if (ok) quizRight++;
  recordQuiz(qkey(z), ok);
  $$('#quizArea .opt').forEach((o, i) => { o.disabled = true; if (i === z.answer) o.classList.add('correct'); else if (i === pick) o.classList.add('wrong'); });
  const lessonBtn = (!ok && z.lesson && lessonById[z.lesson]) ? `<button onclick="__goLesson('${z.lesson}')">📖 関連レッスン「${esc(lessonById[z.lesson].title)}」で復習</button> ` : '';
  const tryBtn = z.code ? `<button data-try-code="1">Studioで試す</button> ` : '';
  $('#qExplain').innerHTML = `<div class="explain">${ok ? '✅ 正解' : '❌ 不正解（正解は ' + 'ABCD'[z.answer] + '）'}<br>${esc(z.explanation || z.explain)}</div><div class="toolbar">${lessonBtn}${tryBtn}<button class="primary" id="qNext">次の問題</button></div>`;
  $('#qNext').addEventListener('click', () => { quizIdx++; showChoice(); const o = $('#quizArea .opt'); if (o) o.focus(); });
  $('#qNext').focus();
});
$('#quizArea').addEventListener('click', e => { if (e.target.closest('[data-try-code]')) { const z = quizQueue[quizIdx]; openInStudio('quiz_' + z.id + '.py', z.code + '\n'); } });
window.__codeTask = id => {
  const c = CODING.find(x => x.id === id);
  $('#quizArea').innerHTML = `<h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><details><summary>ヒント</summary><p class="kv">${esc(c.hint)}</p></details>
  <div class="toolbar">${bmButton('code:' + c.id)}<button onclick="__restartQuiz()">一覧へ戻る</button></div>
  <textarea id="codeAns" class="editor" style="height:180px" spellcheck="false" aria-label="解答コード">${esc(c.starter)}</textarea>
  <div class="toolbar"><button class="primary" id="codeRun">▶ 実行して判定</button></div><div id="codeOut" aria-live="polite"></div>`;
  $('#codeRun').addEventListener('click', async () => {
    $('#codeOut').innerHTML = '<p class="kv">判定中…</p>';
    const verdict = await checkCodingAnswer(c, $('#codeAns').value, code => runPython(code, { isolated: true, filename: '<answer>' }));
    recordQuiz('code:' + c.id, verdict.ok);
    $('#codeOut').innerHTML = `<pre class="console">${outputHtml(verdict.first)}</pre><div class="explain">${verdict.ok ? '✅ テスト合格（' + verdict.cases + '件のテストで期待出力と一致）' : '❌ ' + esc(verdict.reason) + (verdict.expect != null ? '<br>期待: <pre>' + esc(verdict.expect) + '</pre>' : '') + (c.lesson && lessonById[c.lesson] ? `<button onclick="__goLesson('${c.lesson}')">📖 関連レッスン「${esc(lessonById[c.lesson].title)}」で復習</button>` : '')}</div>`;
  });
};
window.__bugTask = id => {
  const c = BUGS.find(x => x.id === id);
  $('#quizArea').innerHTML = `<h3>${esc(c.title)}</h3><p>下のコードにはバグがあります。直して実行してください。期待される出力: <code>${esc(c.expect.replace(/\n/g, ' / '))}</code></p><details><summary>ヒント</summary><p class="kv">${esc(c.hint)}</p></details>
  <div class="toolbar">${bmButton('bug:' + c.id)}<button onclick="__restartQuiz()">一覧へ戻る</button></div>
  <textarea id="bugAns" class="editor" style="height:140px" spellcheck="false" aria-label="修正するコード">${esc(c.bad)}</textarea>
  <div class="toolbar"><button class="primary" id="bugRun">▶ 実行して判定</button><button id="bugGood">修正例を見る</button></div><div id="bugOut" aria-live="polite"></div>`;
  $('#bugRun').addEventListener('click', async () => {
    const code = $('#bugAns').value; const r = await runPython(code, { isolated: true, filename: '<answer>' });
    const out = (r.segs || []).filter(s => s.s === 'out').map(s => s.t).join('');
    const ok = !r.error && normOut(out) === normOut(c.expect);
    recordQuiz('bug:' + c.id, ok);
    $('#bugOut').innerHTML = `<pre class="console">${outputHtml(r)}</pre><div class="explain">${ok ? '✅ 修正できました' : 'まだ直っていません。エラーメッセージとヒントを見てください<br>' + (c.lesson && lessonById[c.lesson] ? `<button onclick="__goLesson('${c.lesson}')">📖 関連レッスン「${esc(lessonById[c.lesson].title)}」で復習</button>` : '')}</div>`;
  });
  $('#bugGood').addEventListener('click', () => { const m = MISTAKES.find(x => x.id === c.mistake); $('#bugOut').innerHTML = `<pre>${esc(c.good)}</pre>${m ? `<p>${esc(m.cause)} <button class="chip" onclick="__goMistake('${m.id}')">よくある間違い「${esc(m.title)}」</button></p>` : ''}`; });
};
$$('.qmode').forEach(b => b.addEventListener('click', () => { setQmode(b.dataset.qmode); startQuiz(); }));
$('#shuffleBtn').addEventListener('click', () => startQuiz());
$('#optShuffleBtn').addEventListener('click', () => {
  optShuffle = !optShuffle; store.set('optShuffle', optShuffle);
  $('#optShuffleBtn').textContent = '選択肢シャッフル: ' + (optShuffle ? 'ON' : 'OFF'); $('#optShuffleBtn').setAttribute('aria-pressed', optShuffle);
  if (qmode === 'choice' || qmode === 'fill') startQuiz();
});
$('#bookmarkQuizBtn').addEventListener('click', () => {
  const marked = [...QUIZZES.filter(z => progress.bookmarks.includes('quiz:' + z.id)), ...FILLS.filter(z => progress.bookmarks.includes('fill:' + z.id))];
  if (!marked.length) { $('#quizArea').innerHTML = '<div class="explain">ブックマークした四択・穴埋め問題がまだありません。問題の ☆ から追加できます。</div>'; return; }
  setQmode('choice'); quizQueue = shuffled(marked).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice();
});
window.__reviewWrong = () => {
  const qs = [...QUIZZES.filter(z => progress.wrong.includes('quiz:' + z.id)), ...FILLS.filter(z => progress.wrong.includes('fill:' + z.id))];
  const others = progress.wrong.filter(k => /^(code|bug):/.test(k));
  if (!qs.length) { $('#quizArea').innerHTML = `<div class="explain">${others.length ? '四択・穴埋めの復習対象はありません。未合格のコーディング／バグ修正: ' + others.map(k => esc(labelOf(k))).join('、') : '復習対象はありません。'}</div>`; return; }
  setQmode('choice'); quizQueue = qs.map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice();
};
$('#reviewWrongBtn').addEventListener('click', () => __reviewWrong());

/* ================= Reference ================= */
function renderRefList(){
  const q = ($('#refSearch').value || '').toLowerCase(); const sort = $('#refSort').value;
  let list = REFERENCE.filter(r => !q || (r.name + r.summary + r.category + r.id).toLowerCase().includes(q));
  list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'category' ? a.category.localeCompare(b.category) || (IMP[a.importance] - IMP[b.importance]) : (IMP[a.importance] - IMP[b.importance]) || a.name.localeCompare(b.name));
  $('#refList').innerHTML = list.map(r => `<button class="item" onclick="__goRef('${r.id}')"><b>${esc(r.name)}</b> <span class="badge ${r.importance === '最重要' ? 'hot' : ''}">${esc(r.importance)}</span><div class="meta">${esc(r.category)}・${esc(r.summary)}</div></button>`).join('');
}
$('#refSearch').addEventListener('input', renderRefList);
$('#refSort').addEventListener('change', renderRefList);
function selectRef(id){
  const r = refById[id]; if (!r) return; renderRefList(); setTimeout(() => reveal('refDetail'), 0);
  $('#refDetail').innerHTML = `<h2>${esc(r.name)}</h2><div class="kv">${esc(r.category)}・重要度 ${esc(r.importance)}・${esc(r.level)}</div>
  <p>${esc(r.summary)}</p><h3>構文</h3><pre>${esc(r.syntax)}</pre>
  <p><b>引数:</b> ${esc(r.args)}<br><b>戻り値:</b> ${esc(r.returns)}</p>
  <h3>使用例</h3><pre>${esc(r.example)}</pre>
  <div class="toolbar"><button class="primary" data-ref-run="${r.id}">▶ 例を実行</button><button data-ref-studio="${r.id}">Studioで開く</button></div>
  <div id="refOut"></div><p><b>出力:</b></p><pre>${esc(r.expected)}</pre>
  <p>⚠ <b>よくある間違い・注意:</b> ${esc(r.pitfalls)}</p>
  <div>${refChips(r.related)} ${r.lesson && lessonById[r.lesson] ? `<button class="chip" onclick="__goLesson('${r.lesson}')">関連レッスン</button>` : ''}</div>
  <p class="kv">公式: <a href="${esc(r.doc || 'https://docs.python.org/ja/3.12/')}" target="_blank" rel="noopener">${r.doc ? 'このページの公式ドキュメント' : 'Python公式ドキュメント'}</a></p>`;
}
$('#refDetail').addEventListener('click', async e => {
  const run = e.target.closest('[data-ref-run]'); const st = e.target.closest('[data-ref-studio]');
  if (run) { const r = refById[run.dataset.refRun]; $('#refOut').innerHTML = '<p class="kv">実行中…</p>'; const res = await runPython(r.example, { stdin: r.stdin || '', isolated: true, filename: `<ref ${r.id}>` }); $('#refOut').innerHTML = `<pre class="console">${outputHtml(res)}</pre>${imagesHtml(res.images)}`; }
  if (st) { const r = refById[st.dataset.refStudio]; if (r.stdin && !$('#stdinBox').value.trim()) $('#stdinBox').value = r.stdin; openInStudio('ref_' + r.id.replace(/\W/g, '_') + '.py', r.example); }
});

/* ================= Glossary ================= */
function renderGlossList(){
  const q = ($('#glossSearch').value || '').toLowerCase(); const sort = $('#glossSort').value;
  let list = GLOSSARY.filter(g => !q || (g.ja + g.en + g.def).toLowerCase().includes(q));
  list.sort((a, b) => sort === 'name' ? a.ja.localeCompare(b.ja, 'ja') : (IMP[a.importance] - IMP[b.importance]) || a.ja.localeCompare(b.ja, 'ja'));
  $('#glossList').innerHTML = list.map(g => `<button class="item" onclick="__goTerm('${g.id}')"><b>${esc(g.ja)}</b> <span class="badge ${g.importance === '最重要' ? 'hot' : ''}">${esc(g.importance)}</span><div class="meta">${esc(g.en)}・${esc(g.def)}</div></button>`).join('');
}
$('#glossSearch').addEventListener('input', renderGlossList);
$('#glossSort').addEventListener('change', renderGlossList);
function selectTerm(id){
  const g = termById[id]; if (!g) return; renderGlossList(); setTimeout(() => reveal('glossDetail'), 0);
  const lessons = LESSONS.filter(l => (l.terms || []).includes(id));
  $('#glossDetail').innerHTML = `<h2>${esc(g.ja)} <span class="kv">${esc(g.en)}</span></h2><div class="kv">重要度 ${esc(g.importance)}</div>
  <p><b>定義:</b> ${esc(g.def)}</p><p><b>やさしく言うと:</b> ${esc(g.easy)}</p>
  ${g.example ? `<h3>例</h3><pre>${esc(g.example)}</pre>` : ''}
  <p>⚠ <b>よくある誤解:</b> ${esc(g.misconception)}</p>
  <div>${termChips(g.related)}</div>
  ${lessons.length ? `<p><b>この用語が出てくるレッスン:</b> ${lessons.map(l => `<button class="chip" onclick="__goLesson('${l.id}')">${esc(l.title)}</button>`).join('')}</p>` : ''}`;
}

/* ================= Mistakes ================= */
function renderMistakeList(){
  const q = ($('#mistakeSearch').value || '').toLowerCase();
  $('#mistakeList').innerHTML = MISTAKES.filter(m => !q || (m.title + m.cause + m.phenomenon + m.bad).toLowerCase().includes(q)).map(m =>
    `<button class="item" onclick="__goMistake('${m.id}')"><b>${esc(m.title)}</b><div class="meta">${esc(m.phenomenon)}</div></button>`).join('');
}
$('#mistakeSearch').addEventListener('input', renderMistakeList);
function selectMistake(id){
  const m = MISTAKES.find(x => x.id === id); if (!m) return; renderMistakeList(); setTimeout(() => reveal('mistakeDetail'), 0);
  $('#mistakeDetail').innerHTML = `<h2>${esc(m.title)}</h2>
  <h3>誤ったコード</h3><pre>${esc(m.bad)}</pre>
  <p><b>起きる現象:</b> ${esc(m.phenomenon)}</p><p><b>原因:</b> ${esc(m.cause)}</p>
  <h3>正しいコード</h3><pre>${esc(m.good)}</pre>
  <div class="toolbar"><button data-mistake-try="${m.id}">Studioで修正を試す</button></div>
  <div>${termChips(m.related)}</div>`;
}
$('#mistakeDetail').addEventListener('click', e => {
  const b = e.target.closest('[data-mistake-try]'); if (!b) return;
  const m = MISTAKES.find(x => x.id === b.dataset.mistakeTry); openInStudio('mistake_' + m.id.replace(/\W/g, '_') + '.py', m.bad);
});

/* ================= Env & Packages ================= */
function renderEnv(){
  $('#envList').innerHTML = ENV_LESSONS.map(e => `<div class="card" id="env-${e.id}"><h4>${esc(e.title)}</h4><p>${esc(e.body)}</p><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>${e.official ? `<p class="kv"><a href="${esc(e.official)}" target="_blank" rel="noopener">公式資料</a></p>` : ''}</div>`).join('');
  $('#pkgTable').innerHTML = `<div class="table-wrap"><table><tr><th>パッケージ</th><th>分野</th><th>用途</th><th>代表的な使い方</th><th>通常環境への導入</th><th>ブラウザ内（Pyodide 0.26.4）</th><th>公式</th></tr>
  ${PACKAGES.map(p => `<tr id="env-pkg-${p.id}"><td data-l="パッケージ"><b>${esc(p.name)}</b></td><td data-l="分野">${esc(p.field)}</td><td data-l="用途">${esc(p.desc)}</td><td data-l="代表的な使い方">${esc(p.usage)}</td><td data-l="通常環境への導入"><code>${esc(p.install)}</code></td><td data-l="ブラウザ内"><span class="badge ${/^import で利用可/.test(p.browser) ? 'ok' : ''}">${esc(p.browser)}</span>${p.browserNote ? `<div class="meta">${esc(p.browserNote)}</div>` : ''}${p.sample ? `<div><button data-pkg-try="${p.id}">サンプルを実行</button></div>` : ''}</td><td data-l="公式"><a href="${esc(p.official)}" target="_blank" rel="noopener">${esc(p.name)} 公式</a></td></tr>`).join('')}</table></div>`;
}
$('#pkgTable').addEventListener('click', e => { const b = e.target.closest('[data-pkg-try]'); if (!b) return; const p = PACKAGES.find(x => x.id === b.dataset.pkgTry); openInStudio('pkg_' + p.id.replace(/\W/g, '_') + '.py', p.sample); });

/* ================= Progress ================= */
function toggleBookmark(k){ progress.bookmarks = progress.bookmarks.includes(k) ? progress.bookmarks.filter(x => x !== k) : [...progress.bookmarks, k]; saveProgress(); }
function openKey(k){
  const [kind, ...rest] = k.split(':'); const id = rest.join(':');
  if (kind === 'quiz') __goQuiz(id);
  else if (kind === 'fill') { const z = FILLS.find(x => x.id === id); if (z) { showView('quiz'); setQmode('fill'); quizQueue = [withShuffledOptions(z)]; quizIdx = 0; quizRight = 0; showChoice(); } }
  else if (kind === 'code') { showView('quiz'); setQmode('code'); __codeTask(id); }
  else if (kind === 'bug') { showView('quiz'); setQmode('bug'); __bugTask(id); }
}
window.__openKey = openKey;
// stored keys are data, never code: they are read from a data attribute, not interpolated into JS
document.addEventListener('click', e => { const el = e.target.closest('[data-open-key]'); if (el) openKey(el.dataset.openKey); });
function renderProgress(){
  const total = progress.history.length, right = progress.history.filter(h => h.ok).length;
  $('#progressSummary').innerHTML = `
    <div class="card"><h4>レッスン</h4><p>${progress.lessonsDone.length} / ${LESSONS.length} 学習済</p></div>
    <div class="card"><h4>演習</h4><p>${total} 回解答・正解 ${right} 回${total ? `（${Math.round(right / total * 100)}%）` : ''}</p></div>
    <div class="card"><h4>復習対象</h4><p>${progress.wrong.length} 件 ${progress.wrong.length ? '<button onclick="showView(\'quiz\');__reviewWrong()">復習する</button>' : ''}</p></div>
    <div class="card"><h4>収録コンテンツ</h4><p>レッスン ${LESSONS.length}／四択 ${QUIZZES.length}／穴埋め ${FILLS.length}／コーディング ${CODING.length}／バグ修正 ${BUGS.length}／リファレンス ${REFERENCE.length}／用語 ${GLOSSARY.length}／間違い ${MISTAKES.length}</p></div>`;
  $('#historyView').innerHTML = progress.history.slice(-30).reverse().map(h => `<button class="item" data-open-key="${esc(h.key)}">${h.ok ? '✅' : '❌'} ${esc(labelOf(h.key))} <span class="meta">${esc(String(h.t).slice(0, 16).replace('T', ' '))}</span></button>`).join('') || 'まだ履歴がありません';
  $('#bookmarkView').innerHTML = progress.bookmarks.map(b => `<button class="chip" data-open-key="${esc(b)}">${esc(labelOf(b))}</button>`).join('') || 'なし';
}
$('#exportBtn').addEventListener('click', () => {
  syncCurrent();
  const data = { app: 'python-studio', schema: SCHEMA, exportedAt: new Date().toISOString(), files, currentFile, progress, notebook: nbCells, notebookMeta: nbMeta,
    settings: { theme: store.get('theme', ''), optShuffle, fontSize: store.get('fontSize', 14) } };
  downloadBlob('python-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
});
$('#importData').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || typeof d !== 'object' || !(d.files || d.progress || d.notebook)) throw new Error('Python Studio のバックアップ形式ではありません');
    const nf = d.files ? normalizeFiles(d.files) : null;
    if (nf) for (const k of Object.keys(nf)) { if (nameConflict(k, nf, k)) delete nf[k]; }   // A-13: names that collide with a folder/file are dropped
    const summaryText = `${nf ? Object.keys(nf).length + 'ファイル、' : ''}${d.progress ? '学習記録、' : ''}${d.notebook ? 'Notebook、' : ''}`.replace(/、$/, '');
    if (!confirm(`バックアップ（${summaryText}）で現在のデータを置き換えます。よろしいですか？\n読み込むと現在のデータは置き換わります。元に戻せないため、先に「全データを書出（JSON）」でバックアップを取ってください（直前の状態はブラウザ内に残りますが、この画面からは復元できません）。`)) return;
    const hist = store.get('before-import-history', []); hist.unshift({ files, progress, notebook: nbCells, at: new Date().toISOString() }); store.set('before-import-history', hist.slice(0, 1));
    if (!store.set('before-import', hist[0]) && !confirm('現在のデータを退避できません（保存容量が足りません）。このまま読み込むと現在のデータは失われます。続けますか？')) return;
    if (nf) { files = nf; currentFile = d.currentFile && nf[d.currentFile] != null ? d.currentFile : Object.keys(files)[0]; }
    if (d.progress) progress = normalizeProgress(d.progress, QUIZZES);
    if (d.notebook) { nbCells = normalizeNotebook(d.notebook); nbMeta = d.notebookMeta || null; }
    if (d.settings) { if (typeof d.settings.optShuffle === 'boolean') { optShuffle = d.settings.optShuffle; store.set('optShuffle', optShuffle); } if (d.settings.theme) store.set('theme', d.settings.theme); if (d.settings.fontSize) store.set('fontSize', d.settings.fontSize); }
    const saved = [saveFiles(), saveProgress(), saveNotebook()].every(Boolean); setEditorValue(displayText(currentFile)); updateReadOnly(); renderTabs(); renderNotebook(); renderProgress(); renderLessonList();
    if (saved) banner('バックアップを読み込みました。', 'ok'); else banner('バックアップを画面には読み込みましたが、端末に保存できませんでした（保存容量不足）。再読み込みすると失われます。', 'error');
  } catch(err){ alert('読み込みに失敗しました: ' + err.message); }
});
$('#wipeBtn').addEventListener('click', () => {
  if (confirm('このアプリの学習記録・作業ファイル・Notebook・設定をすべて削除しますか？（他のサイトやアプリのデータには影響しません）')) {
    for (const k of store.keys()) { try { localStorage.removeItem(k); } catch(e){} }
    location.reload();
  }
});

/* ================= init ================= */
renderTabs(); renderNotebook(); renderLessonList(); renderRefList(); renderGlossList(); renderMistakeList(); renderEnv(); renderSideList(); renderTplList(); if ($('.navbtn.active')) $('.navbtn.active').setAttribute('aria-current', 'page'); $('#runBtn').disabled = true; $('#runBtn').title = 'エディタを読み込み中です';
$('#optShuffleBtn').textContent = '選択肢シャッフル: ' + (optShuffle ? 'ON' : 'OFF'); $('#optShuffleBtn').setAttribute('aria-pressed', optShuffle);
startQuiz(); initEditor();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__pystudio = { get files(){ return files; }, get progress(){ return progress; }, get nbCells(){ return nbCells; }, get kernelState(){ return kernelState; } };
