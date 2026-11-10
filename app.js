import { LESSONS } from './data/lessons.js';
import { QUIZZES } from './data/quizzes.js';
import { REFERENCE } from './data/reference.js';
import { GLOSSARY } from './data/glossary.js';
import { MISTAKES, PACKAGES, ENV_LESSONS } from './data/extras.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IMP = {'最重要':0,'重要':1,'応用':2,'専門':3};

/* ---------- persistent state (localStorage; large code kept per-file keys) ---------- */
const store = {
  get(k, d){ try { const v = localStorage.getItem('pystudio:'+k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('pystudio:'+k, JSON.stringify(v)); } catch(e){} }
};
let files = store.get('files', { 'main.py': '# Python Studio へようこそ\nnumbers = [10, 20, 30]\nprint("合計:", sum(numbers))\nprint("平均:", sum(numbers) / len(numbers))\n' });
let currentFile = store.get('currentFile', 'main.py');
if (!files[currentFile]) currentFile = Object.keys(files)[0];
let progress = store.get('progress', { lessonsDone: [], history: [], bookmarks: [], wrong: [] });
let nbCells = store.get('notebook', [ {type:'markdown', source:'# Notebook\nセルを実行して結果を確認しましょう。'}, {type:'code', source:'x = 21\nprint(x * 2)'} ]);
function saveProgress(){ store.set('progress', progress); }
function saveFiles(){ store.set('files', files); store.set('currentFile', currentFile); }

/* ---------- kernel (Pyodide worker) ---------- */
let worker = null, runSeq = 0; const pending = new Map();
function newWorker(){
  if (worker) worker.terminate();
  worker = new Worker('worker.js');
  worker.onmessage = ev => {
    const m = ev.data;
    if (m.type === 'ready') { $('#kernelStatus').textContent = 'カーネル準備完了（Python ' + m.python + ' / Pyodide 0.26.4）'; runDiagnostics(); }
    if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.type === 'loaded') { $('#kernelStatus').textContent = 'パッケージ読込完了: ' + m.packages.join(', '); }
    if (m.type === 'reset-done') { $('#kernelStatus').textContent = 'カーネルをリセットしました'; }
  };
}
function callWorker(msg){ return new Promise(res => { const id = ++runSeq; pending.set(id, res); worker.postMessage({...msg, id}); }); }
let runChain = Promise.resolve();
function runPython(code, opts = {}){
  // serialize all executions: concurrent runs would interleave stdout/kernel state
  const p = runChain.then(() => callWorker({ type:'run', code, files: opts.files, stdin: opts.stdin, packages: opts.packages }));
  runChain = p.then(() => {}, () => {});
  return p;
}
function flushPending(reason){
  for (const [, res] of pending) res({ type:'result', stdout:'', stderr:'', error: reason, ms:0, image:null, vars:[], syntax:null });
  pending.clear();
}
newWorker();

/* ---------- navigation ---------- */
function showView(name){
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $('#searchResults').classList.add('hidden');
  if (name === 'progress') renderProgress();
}
$('#mainNav').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) showView(b.dataset.view); });
$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme === 'dark' ? '' : 'dark';
  document.documentElement.dataset.theme = cur; store.set('theme', cur);
  if (window.monaco) monaco.editor.setTheme(cur === 'dark' ? 'vs-dark' : 'vs');
});
if (store.get('theme','') === 'dark') document.documentElement.dataset.theme = 'dark';

/* ---------- cross-links ---------- */
const refById = Object.fromEntries(REFERENCE.map(r => [r.id, r]));
const termById = Object.fromEntries(GLOSSARY.map(g => [g.id, g]));
const lessonById = Object.fromEntries(LESSONS.map(l => [l.id, l]));
window.__goRef = id => { showView('reference'); selectRef(id); };
window.__goTerm = id => { showView('glossary'); selectTerm(id); };
window.__goLesson = id => { showView('lessons'); selectLesson(id); };
window.__goMistake = id => { showView('mistakes'); selectMistake(id); };
function termChips(ids){ return (ids||[]).filter(id => termById[id]).map(id => `<button class="chip" onclick="__goTerm('${id}')">${esc(termById[id].ja)}</button>`).join(''); }
function refChips(ids){ return (ids||[]).filter(id => refById[id]).map(id => `<button class="chip" onclick="__goRef('${id}')">${esc(refById[id].name)}</button>`).join(''); }

/* ---------- global search ---------- */
$('#globalSearch').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase(); const box = $('#searchResults');
  if (!q) { box.classList.add('hidden'); return; }
  const hits = [];
  REFERENCE.forEach(r => { if ((r.name+r.summary+r.category).toLowerCase().includes(q)) hits.push({t:'リファレンス', title:r.name, sub:r.summary, act:`__goRef('${r.id}')`}); });
  GLOSSARY.forEach(g => { if ((g.ja+g.en+g.def).toLowerCase().includes(q)) hits.push({t:'用語', title:g.ja, sub:g.def, act:`__goTerm('${g.id}')`}); });
  LESSONS.forEach(l => { if ((l.title+l.body+l.category).toLowerCase().includes(q)) hits.push({t:'レッスン', title:l.title, sub:l.goal, act:`__goLesson('${l.id}')`}); });
  QUIZZES.forEach(z => { if ((z.question+z.category).toLowerCase().includes(q)) hits.push({t:'問題', title:z.question.slice(0,60), sub:z.category, act:`showView('quiz')`}); });
  MISTAKES.forEach(m => { if ((m.title+m.cause+m.phenomenon).toLowerCase().includes(q)) hits.push({t:'間違い', title:m.title, sub:m.phenomenon, act:`__goMistake('${m.id}')`}); });
  PACKAGES.forEach(p => { if ((p.name+p.desc+p.field).toLowerCase().includes(q)) hits.push({t:'パッケージ', title:p.name, sub:p.desc, act:`showView('env')`}); });
  box.innerHTML = hits.slice(0, 20).map(h => `<div class="item" onclick="${h.act}"><span class="badge">${h.t}</span> <b>${esc(h.title)}</b><div class="meta">${esc(h.sub)}</div></div>`).join('') || '<div class="item">該当なし</div>';
  box.classList.remove('hidden');
});
window.showView = showView;

/* ================= Studio ================= */
let editor = null;
function editorValue(){ return editor ? editor.getValue() : $('#editorFallback').value; }
function setEditorValue(v){ if (editor) editor.setValue(v); else $('#editorFallback').value = v; }
function initEditor(){
  const fallback = () => { $('#editor').classList.add('hidden'); const ta = $('#editorFallback'); ta.classList.remove('hidden'); ta.value = files[currentFile]; ta.addEventListener('input', onEdit); };
  if (!window.require) return fallback();
  try {
    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
    window.require(['vs/editor/editor.main'], () => {
      editor = monaco.editor.create($('#editor'), { value: files[currentFile], language: 'python', automaticLayout: true,
        fontSize: Number($('#fontSize').value) || 14, minimap: { enabled: false }, theme: document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs' });
      window.monaco = monaco;
      editor.onDidChangeModelContent(onEdit);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runCurrent);
      editor.onMouseDown(e => { if (e.event.detail === 2) lookupWordAtCursor(); });
      $('#editorFallback').classList.add('hidden');
      runDiagnostics();
    }, fallback);
  } catch(e){ fallback(); }
}
let diagTimer = null;
function onEdit(){
  if (typeof files[currentFile] === 'string' && files[currentFile].startsWith('base64:')) return; // binary files are not edited as text
  files[currentFile] = editorValue(); saveFiles(); renderTabs();
  clearTimeout(diagTimer); diagTimer = setTimeout(runDiagnostics, 650);
}
function heuristicDiags(code){
  const out = []; const lines = code.split('\n');
  const builtins = new Set('print len sum min max range enumerate zip sorted type int str float list dict set tuple abs round open input isinstance map filter bool repr chr ord id hash any all next iter reversed'.split(' '));
  const defined = new Set(builtins);
  lines.forEach((l, idx) => {
    let m = l.match(/^\s*(?:from\s+\S+\s+import\s+(.+)|import\s+(.+))/); if (m) (m[1]||m[2]).split(',').forEach(x => { const n = x.trim().split(' as ').pop().trim(); if (n && n !== '*') defined.add(n); });
    m = l.match(/^\s*def\s+(\w+)\s*\(([^)]*)\)/); if (m) { defined.add(m[1]); m[2].split(',').forEach(p => { const n = p.trim().split('=')[0].replace('*','').trim(); if (n) defined.add(n); }); }
    m = l.match(/^\s*class\s+(\w+)/); if (m) defined.add(m[1]);
    m = l.match(/^\s*for\s+([\w\s,]+)\s+in\s/); if (m) m[1].split(',').forEach(x => defined.add(x.trim()));
    m = l.match(/^\s*(\w+)\s*(?:=[^=]|\+=|-=|\*=|\/=)/); if (m) defined.add(m[1]);
    m = l.match(/^\s*with\s+.+\s+as\s+(\w+)/); if (m) defined.add(m[1]);
    if (/def\s+\w+\([^)]*=\s*(\[\]|\{\})/.test(l)) out.push({sev:'warn', line: idx+1, msg:'変更可能なデフォルト引数（[] や {}）は呼び出し間で共有されます', fix:'デフォルトを None にして関数内で作り直す'});
    if (/==\s*None|!=\s*None/.test(l)) out.push({sev:'warn', line: idx+1, msg:'None との比較は == ではなく is / is not が推奨されます', fix:null});
    if (/^\s*(print|len|sum|list|dict|str|int|type|input|id)\s*=/.test(l)) out.push({sev:'warn', line: idx+1, msg:'組み込み関数名を変数で上書きしています。後でその関数が使えなくなります', fix:null});
  });
  // assigned but never read again (possibility only, worded as such)
  lines.forEach((l, idx) => {
    const m = l.match(/^(\w+)\s*=[^=]/);
    if (!m || m[1].startsWith('_')) return;
    const uses = (code.match(new RegExp('\\b' + m[1] + '\\b', 'g')) || []).length;
    if (uses <= 1) out.push({sev:'warn', line: idx+1, msg:`変数「${m[1]}」は代入されていますが、他で使われていない可能性があります`, fix:null});
  });
  const used = new Set(); let inStr = false;
  lines.forEach((l, i) => {
    const stripped = l.replace(/(['"]).*?\1/g, '').replace(/#.*/, '');
    for (const mm of stripped.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) { if (!defined.has(mm[1]) && !/^(if|elif|while|for|return|and|or|not|in|is)$/.test(mm[1])) out.push({sev:'warn', line:i+1, msg:`「${mm[1]}」は未定義の可能性があります（関数呼び出しとして使われていますが定義が見当たりません）`, fix:null}); }
  });
  const seen = new Set(); return out.filter(d => { const k = d.line + d.msg; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
}
let diagSeq = 0;
async function runDiagnostics(){
  const code = editorValue(); if (!code.trim()) { $('#diagList').innerHTML = ''; $('#diagSummary').textContent = ''; return; }
  const seq = ++diagSeq;
  const res = await callWorker({ type:'check', code });
  if (seq !== diagSeq) return; // a newer edit already superseded this result
  const items = [];
  if (res.syntax) items.push({ sev:'error', line: res.syntax.line, msg: `${res.syntax.kind}: ${res.syntax.msg}（${res.syntax.line}行目 ${res.syntax.col}列目）`, fix: null, mistakeHint: true });
  items.push(...heuristicDiags(code));
  $('#diagSummary').textContent = items.length ? `診断 ${items.length}件` : '診断: 問題なし（構文OK）';
  $('#diagList').innerHTML = items.map(d => `<div class="diag-item ${d.sev === 'error' ? 'error' : 'warn'}">${d.sev === 'error' ? '⛔' : '⚠'} ${esc(d.msg)}${d.fix ? `<div class="kv">修正の考え方: ${esc(d.fix)}</div>` : ''}${d.mistakeHint ? `<button onclick="showView('mistakes')">よくある間違いで調べる</button>` : ''}</div>`).join('');
  if (editor && window.monaco) {
    const markers = items.map(d => ({ severity: d.sev === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.msg, startLineNumber: d.line, startColumn: 1, endLineNumber: d.line, endColumn: 200 }));
    monaco.editor.setModelMarkers(editor.getModel(), 'pystudio', markers);
  }
}
function renderTabs(){
  $('#tabBar').innerHTML = Object.keys(files).map(f => `<button class="${f === currentFile ? 'active' : ''}" data-file="${esc(f)}">${esc(f)}</button>`).join('');
  $('#fileList').innerHTML = Object.keys(files).map(f => `<li class="${f === currentFile ? 'active' : ''}" data-file="${esc(f)}"><span>${esc(f)}</span>${Object.keys(files).length > 1 ? `<button class="del" data-del="${esc(f)}" title="削除">✕</button>` : ''}</li>`).join('');
}
function switchFile(f){ if (files[f] == null) return; if (!(typeof files[currentFile] === 'string' && files[currentFile].startsWith('base64:'))) files[currentFile] = editorValue(); currentFile = f; setEditorValue(files[f].startsWith('base64:') ? '# バイナリファイル（編集不可）: ' + f + '\n# Pythonからは通常のファイルとして読み込めます' : files[f]); saveFiles(); renderTabs(); runDiagnostics(); }
$('#tabBar').addEventListener('click', e => { const b = e.target.closest('[data-file]'); if (b) switchFile(b.dataset.file); });
$('#fileList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]'); if (del) { delete files[del.dataset.del]; if (currentFile === del.dataset.del) currentFile = Object.keys(files)[0]; setEditorValue(files[currentFile]); saveFiles(); renderTabs(); return; }
  const li = e.target.closest('[data-file]'); if (li) switchFile(li.dataset.file);
});
$('#addFileBtn').addEventListener('click', () => {
  const name = prompt('新しいファイル名（例: utils.py）'); if (!name) return;
  files[name] = ''; switchFile(name);
});
function explainError(errText){
  const rules = [
    [/IndentationError/, 'インデント（字下げ）が揃っていません。スペース4つで統一し、前の行と深さを確認してください。', 'indent'],
    [/SyntaxError/, '文法エラーです。コロンや括弧の閉じ忘れが多い原因です。', 'colon'],
    [/NameError: name '(\w+)'/, '未定義の名前を使っています。タイプミスか、定義より前に使っていないか確認してください。', null],
    [/TypeError/, '型が合っていません。文字列と数値を混ぜていないか確認してください。', 'str-num'],
    [/IndexError/, '範囲外の添字です。len() で長さを確認してください。', 'index-range'],
    [/KeyError/, '辞書に存在しないキーです。.get() の利用も検討してください。', 'dict-key'],
    [/ModuleNotFoundError|ImportError/, 'モジュールが見つかりません。名前の綴りと、ブラウザ環境で使えるライブラリかを確認してください。', 'import-error'],
    [/ZeroDivisionError/, '0で割っています。除数が0になるケースを先に分けてください。', null],
  ];
  for (const [re, text, mid] of rules) if (re.test(errText)) return { text, mid };
  return null;
}
async function runCurrent(){
  const code = editorValue(); const btn = $('#runBtn'); btn.disabled = true;
  const t = performance.now();
  const res = await runPython(code, { files, stdin: $('#stdinBox').value });
  btn.disabled = false;
  $('#runTime').textContent = `（${res.ms} ms）`;
  let html = '';
  if (res.stdout) html += esc(res.stdout);
  if (res.stderr) html += `<span class="cerr">${esc(res.stderr)}</span>`;
  if (res.error) {
    html += `<span class="cerr">${esc(res.error)}</span>`;
    const ex = explainError(res.error);
    if (ex) html += `\n<span>💡 ${esc(ex.text)}${ex.mid ? ` <a href="#" onclick="__goMistake('${ex.mid}');return false" style="color:#7ee787">よくある間違いで詳しく見る</a>` : ''}</span>`;
  }
  $('#console').innerHTML = html || '（出力なし）';
  const img = $('#plotImage');
  if (res.image) { img.src = 'data:image/png;base64,' + res.image; img.classList.remove('hidden'); } else img.classList.add('hidden');
  $('#varsView').innerHTML = res.vars && res.vars.length ? res.vars.map(v => `${esc(v.name)}: ${esc(v.type)} = ${esc(v.value)}`).join('<br>') : '（変数なし）';
  runDiagnostics();
}
$('#runBtn').addEventListener('click', runCurrent);
$('#stopBtn').addEventListener('click', () => {
  if (confirm('実行を中断します。Workerを再生成するためカーネルの変数状態は失われます。よろしいですか？')) {
    flushPending('実行が中断されました'); newWorker(); $('#console').textContent = '中断しました（カーネル再生成）。'; $('#runBtn').disabled = false;
  }
});
$('#resetKernelBtn').addEventListener('click', async () => { await callWorker({type:'reset'}); $('#varsView').textContent = 'リセット済み'; });
$$('.pkg-btns button').forEach(b => b.addEventListener('click', async () => { $('#kernelStatus').textContent = b.dataset.pkg + ' を読み込み中…'; worker.postMessage({type:'load', packages:[b.dataset.pkg]}); }));
$('#sampleCsvBtn').addEventListener('click', () => { files['sales.csv'] = 'month,sales\n1,120\n2,150\n3,90\n4,200\n'; saveFiles(); renderTabs(); alert('sales.csv を作成しました。pandasで pd.read_csv("sales.csv") と試せます。'); });
$('#fileUpload').addEventListener('change', async e => {
  for (const f of e.target.files) {
    if (/\.(xlsx|png|jpe?g|gif|webp|ico)$/i.test(f.name)) {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = ''; buf.forEach(b => { bin += String.fromCharCode(b); });
      files[f.name] = 'base64:' + btoa(bin);
    } else {
      files[f.name] = await f.text();
    }
  }
  saveFiles(); renderTabs(); switchFile(e.target.files[0].name);
});
$('#fontSize').addEventListener('change', e => { if (editor) editor.updateOptions({ fontSize: Number(e.target.value) }); });
/* ----- side panel: reference & glossary always visible ----- */
let sideTab = 'ref';
function renderSideList(){
  const q = ($('#sideSearch').value || '').toLowerCase();
  $('#sideTabRef').classList.toggle('active', sideTab === 'ref');
  $('#sideTabGloss').classList.toggle('active', sideTab === 'gloss');
  if (sideTab === 'ref') {
    const list = REFERENCE.filter(r => !q || (r.name + r.summary + r.category + r.id).toLowerCase().includes(q))
      .sort((a, b) => (IMP[a.importance] - IMP[b.importance]) || a.name.localeCompare(b.name));
    $('#sideList').innerHTML = list.map(r => `<div class="side-item" onclick="__sideRef('${r.id}')"><span>${esc(r.name)}</span><span class="meta">${esc(r.importance)}・${esc(r.category)}</span></div>`).join('') || '<div class="side-item">該当なし</div>';
  } else {
    const list = GLOSSARY.filter(g => !q || (g.ja + g.en + g.def).toLowerCase().includes(q))
      .sort((a, b) => (IMP[a.importance] - IMP[b.importance]) || a.ja.localeCompare(b.ja));
    $('#sideList').innerHTML = list.map(g => `<div class="side-item" onclick="__sideTerm('${g.id}')"><span>${esc(g.ja)}</span><span class="meta">${esc(g.importance)}・${esc(g.en)}</span></div>`).join('') || '<div class="side-item">該当なし</div>';
  }
}
$('#sideTabRef').addEventListener('click', () => { sideTab = 'ref'; renderSideList(); });
$('#sideTabGloss').addEventListener('click', () => { sideTab = 'gloss'; renderSideList(); });
$('#sideSearch').addEventListener('input', renderSideList);
window.__sideRef = id => { const r = refById[id]; if (r) { sideTab = 'ref'; renderSideList(); showSideRef(r); } };
window.__sideTerm = id => { const g = termById[id]; if (g) { sideTab = 'gloss'; renderSideList(); showSideTerm(g); } };

function lookupWordAtCursor(){
  let word = '';
  if (editor) { const pos = editor.getPosition(); const w = editor.getModel().getWordAtPosition(pos); word = w ? w.word : ''; }
  else { const ta = $('#editorFallback'); const s = ta.selectionStart; const m = ta.value.slice(0, s).match(/[\w.]+$/); word = m ? m[0] : ''; }
  if (!word) { $('#sideDetail').textContent = '単語の上にカーソルを置いてください。'; return; }
  const cand = [word, word.split('.').pop()];
  for (const c of cand) {
    const r = REFERENCE.find(x => x.id === c || x.name.replace(/\(\)$/,'') === c || x.id.endsWith('.' + c));
    if (r) { sideTab = 'ref'; renderSideList(); return showSideRef(r); }
    const g = GLOSSARY.find(x => x.en === c || x.id === c);
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
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && $('#view-studio').classList.contains('active') && !editor) runCurrent(); });

/* ================= Notebook ================= */
function renderNotebook(){
  $('#nbCells').innerHTML = nbCells.map((c, i) => `<div class="nb-cell">
    <div class="toolbar"><span class="badge">${c.type === 'code' ? 'コード' : 'Markdown'}</span>
      <button data-nb="up" data-i="${i}">↑</button><button data-nb="down" data-i="${i}">↓</button>
      ${c.type === 'code' ? `<button data-nb="run" data-i="${i}" class="primary">▶ 実行</button>` : ''}
      <button data-nb="del" data-i="${i}">削除</button></div>
    <textarea data-cell="${i}" rows="${c.type === 'code' ? 5 : 3}">${esc(c.source)}</textarea>
    ${c.type === 'markdown' ? `<div class="nb-md">${esc(c.source).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="nb-out" id="nbOut${i}">${esc(c.out || '')}</div></div>`).join('');
  store.set('notebook', nbCells);
}
$('#nbCells').addEventListener('input', e => { const i = e.target.dataset.cell; if (i != null) { nbCells[i].source = e.target.value; store.set('notebook', nbCells); } });
$('#nbCells').addEventListener('click', async e => {
  const b = e.target.closest('[data-nb]'); if (!b) return; const i = Number(b.dataset.i);
  if (b.dataset.nb === 'del') nbCells.splice(i, 1);
  if (b.dataset.nb === 'up' && i > 0) [nbCells[i-1], nbCells[i]] = [nbCells[i], nbCells[i-1]];
  if (b.dataset.nb === 'down' && i < nbCells.length - 1) [nbCells[i+1], nbCells[i]] = [nbCells[i], nbCells[i+1]];
  if (b.dataset.nb === 'run') { const r = await runPython(nbCells[i].source, { stdin: '' }); nbCells[i].out = (r.stdout || '') + (r.error ? '\n' + r.error : ''); }
  renderNotebook();
});
$('#nbAddCode').addEventListener('click', () => { nbCells.push({type:'code', source:''}); renderNotebook(); });
$('#nbAddMd').addEventListener('click', () => { nbCells.push({type:'markdown', source:''}); renderNotebook(); });
$('#nbRunAll').addEventListener('click', async () => {
  for (let i = 0; i < nbCells.length; i++) if (nbCells[i].type === 'code') { const r = await runPython(nbCells[i].source, { stdin: '' }); nbCells[i].out = (r.stdout || '') + (r.error ? '\n' + r.error : ''); renderNotebook(); }
});
$('#nbExport').addEventListener('click', () => {
  const nb = { cells: nbCells.map(c => ({ cell_type: c.type === 'code' ? 'code' : 'markdown', source: c.source.split('\n').map(s => s + '\n'), metadata: {}, ...(c.type === 'code' ? { outputs: [], execution_count: null } : {}) })), metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 5 };
  download('notebook.ipynb', JSON.stringify(nb, null, 2), 'application/json');
});
$('#nbImport').addEventListener('change', async e => {
  const nb = JSON.parse(await e.target.files[0].text());
  nbCells = nb.cells.map(c => ({ type: c.cell_type === 'code' ? 'code' : 'markdown', source: Array.isArray(c.source) ? c.source.join('') : (c.source || '') }));
  renderNotebook();
});
function download(name, text, type = 'text/plain'){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= Lessons ================= */
function renderLessonList(){
  const q = ($('#lessonFilter').value || '').toLowerCase();
  $('#lessonList').innerHTML = LESSONS.filter(l => !q || (l.title + l.body).toLowerCase().includes(q)).map(l =>
    `<div class="item" onclick="__goLesson('${l.id}')"><b>${esc(l.title)}</b> ${progress.lessonsDone.includes(l.id) ? '<span class="badge ok">学習済</span>' : ''}<div class="meta">${esc(l.level)}・${esc(l.category)}</div></div>`).join('');
}
$('#lessonFilter').addEventListener('input', renderLessonList);
function selectLesson(id){
  const l = lessonById[id]; if (!l) return; renderLessonList();
  $('#lessonDetail').innerHTML = `<h2>${esc(l.title)}</h2><div class="kv">${esc(l.level)}・${esc(l.category)}</div>
    <p><b>学習目標:</b> ${esc(l.goal)}</p>
    <p style="white-space:pre-wrap">${esc(l.body)}</p>
    <h3>コード</h3><pre>${esc(l.code)}</pre>
    <div class="toolbar"><button class="primary" data-lesson-run="${l.id}">▶ その場で実行</button><button data-lesson-studio="${l.id}">Studioで試す</button><button data-lesson-done="${l.id}">${progress.lessonsDone.includes(l.id) ? '学習済を解除' : '学習済にする'}</button></div>
    <div id="lessonOut"></div>
    <p><b>期待される出力</b></p><pre>${esc(l.expected)}</pre>
    <p>⚠ <b>よくある間違い:</b> ${esc(l.pitfalls)}</p>
    <div>${termChips(l.terms)} ${refChips(l.refs)}</div>`;
}
$('#lessonDetail').addEventListener('click', async e => {
  const run = e.target.closest('[data-lesson-run]'); const st = e.target.closest('[data-lesson-studio]'); const dn = e.target.closest('[data-lesson-done]');
  if (run) { const l = lessonById[run.dataset.lessonRun]; const r = await runPython(l.code, { stdin: '' }); $('#lessonOut').innerHTML = `<pre>${esc((r.stdout || '') + (r.error ? '\n' + r.error : ''))}</pre><p class="kv">${r.error ? 'エラーになりました' : (r.stdout.replace(/\n$/,'') === l.expected.replace(/\n$/,'') ? '✅ 期待出力と一致' : '期待出力と異なる場合はコードと見比べてください')}</p>`; }
  if (st) { const l = lessonById[st.dataset.lessonStudio]; files['lesson_' + l.id + '.py'] = l.code; switchFile('lesson_' + l.id + '.py'); showView('studio'); }
  if (dn) { const id = dn.dataset.lessonDone; progress.lessonsDone = progress.lessonsDone.includes(id) ? progress.lessonsDone.filter(x => x !== id) : [...progress.lessonsDone, id]; saveProgress(); selectLesson(id); }
});

/* ================= Quiz ================= */
const FILLS = [
  { q:'リストの長さを求めるコード: print(___(items))', options:['len','count','size','length'], answer:0, lesson:'lists', explain:'要素数は len() で求めます。count はメソッド名、size/length はPythonの組み込みではありません。' },
  { q:'辞書でキーが無いときに None を返す: value = d.___("key")', options:['get','find','search','fetch'], answer:0, lesson:'dict-operations', explain:'dict.get はキーが無ければ None（または指定した既定値）を返します。' },
  { q:'0から4まで繰り返す: for i in ___(5):', options:['range','loop','count','seq'], answer:0, lesson:'loops', explain:'range(5) が 0,1,2,3,4 を生成します。' },
  { q:'文字列を分割する: parts = text.___(",")', options:['split','cut','divide','parse'], answer:0, lesson:'string-methods', explain:'str.split は区切りで分割してリストを返します。' },
  { q:'例外を捕まえる: ___ ValueError:', options:['except','catch','handle','error'], answer:0, lesson:'exceptions', explain:'Pythonの例外捕捉は except です。catch は他の言語の書き方です。' },
  { q:'ファイルを開く: ___ open("a.txt") as f:', options:['with','using','open','as'], answer:0, lesson:'context-manager', explain:'with文で開くと自動で閉じられます。' },
];
const CODING = [
  { title:'合計と平均', desc:'リスト numbers の合計と平均を「合計: X」「平均: Y」の形式で表示してください', starter:'numbers = [10, 20, 30, 40]\n# ここにコードを書く\n', test:'assert True', expect:'合計: 100\n平均: 25.0', hint:'sum() と len() を使います', lesson:'lists' },
  { title:'偶数だけ抽出', desc:'1から10までの偶数だけをリストにして表示してください', starter:'# 内包表記がおすすめです\n', test:'', expect:'[2, 4, 6, 8, 10]', hint:'[x for x in range(1, 11) if x % 2 == 0]', lesson:'comprehensions' },
  { title:'文字数カウント', desc:'文字列 "banana" の各文字の出現回数を辞書で表示してください', starter:'s = "banana"\ncounts = {}\n# ここにコードを書く\nprint(counts)\n', test:'', expect:"{'b': 1, 'a': 3, 'n': 2}", hint:'for文で1文字ずつ数え、.get() を使うと簡潔です', lesson:'dict-operations' },
  { title:'FizzBuzz（1〜15）', desc:'1から15まで、3の倍数はFizz、5の倍数はBuzz、両方はFizzBuzz、それ以外は数字を表示（1行に1つ）', starter:'', test:'', expect:'1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', hint:'% 演算子で余りを見ます。両方の条件を先に判定します', lesson:'conditionals' },
];
const BUGS = [
  { title:'= と == の混同', bad:'x = 5\nif x = 5:\n    print("5です")\n', expect:'5です', hint:'比較には == を使います', lesson:'conditionals' },
  { title:'コロンの付け忘れ', bad:'for i in range(3)\n    print(i)\n', expect:'0\n1\n2', hint:'for文の末尾に : が必要です', lesson:'loops' },
  { title:'文字列と数値の混同', bad:'age = "20"\nprint(age + 5)\n', expect:'25', hint:'int() で数値に変換します', lesson:'variables-types' },
  { title:'インデントミス', bad:'if True:\nprint("ok")\n', expect:'ok', hint:'if の中身は字下げします', lesson:'conditionals' },
];
let qmode = 'choice', quizQueue = [], quizIdx = 0, quizRight = 0, optShuffle = store.get('optShuffle', true);
function shuffled(arr){ const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function withShuffledOptions(z){
  if (!optShuffle) return z;
  const order = shuffled(z.options.map((_, i) => i));
  return { ...z, options: order.map(i => z.options[i]), answer: order.indexOf(z.answer) };
}
function bmKey(z){ return qmode === 'choice' ? 'quiz:' + (z.id || z.question) : 'fill:' + z.q; }
function bmButton(z){
  const on = progress.bookmarks.includes(bmKey(z));
  return `<button data-bm="1" title="ブックマーク">${on ? '★ ブックマーク中' : '☆ ブックマーク'}</button>`;
}
function recordQuiz(label, ok){ progress.history.push({ t: new Date().toISOString(), label, ok }); if (!ok && !progress.wrong.includes(label)) progress.wrong.push(label); if (ok) progress.wrong = progress.wrong.filter(x => x !== label); saveProgress(); }
function startQuiz(){
  const area = $('#quizArea');
  if (qmode === 'choice') {
    quizQueue = shuffled(QUIZZES).slice(0, 10).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice();
  } else if (qmode === 'fill') {
    quizQueue = shuffled(FILLS).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showFill();
  } else if (qmode === 'code') {
    area.innerHTML = CODING.map((c, i) => `<div class="item" onclick="__codeTask(${i})"><b>${esc(c.title)}</b><div class="meta">${esc(c.desc)}</div></div>`).join('') || '';
  } else {
    area.innerHTML = BUGS.map((c, i) => `<div class="item" onclick="__bugTask(${i})"><b>${esc(c.title)}</b><div class="meta">バグを直して実行してください</div></div>`).join('');
  }
}
function showChoice(){
  const z = quizQueue[quizIdx]; if (!z) { $('#quizArea').innerHTML = `<div class="explain">終了: ${quizRight} / ${quizQueue.length} 正解</div>`; return; }
  $('#quizScore').textContent = `${quizIdx + 1} / ${quizQueue.length}　正解 ${quizRight}`;
  $('#quizArea').innerHTML = `<p><span class="badge">${esc(z.category)}</span><span class="badge">${esc(z.level)}</span> ${bmButton(z)}</p><p><b>${esc(z.question)}</b></p>
  ${z.code ? `<pre class="code">${esc(z.code)}</pre>` : ''}
  ${z.options.map((o, i) => `<button class="opt" data-opt="${i}">${esc(o)}</button>`).join('')}<div id="qExplain"></div>`;
}
function showFill(){
  const z = quizQueue[quizIdx]; if (!z) { $('#quizArea').innerHTML = `<div class="explain">終了: ${quizRight} / ${quizQueue.length} 正解</div>`; return; }
  $('#quizScore').textContent = `${quizIdx + 1} / ${quizQueue.length}　正解 ${quizRight}`;
  $('#quizArea').innerHTML = `<p><b>穴埋め</b> ${bmButton(z)}</p><pre class="code">${esc(z.q)}</pre>
  ${z.options.map((o, i) => `<button class="opt" data-opt="${i}">${esc(o)}</button>`).join('')}<div id="qExplain"></div>`;
}
$('#quizArea').addEventListener('click', async e => {
  const bk = e.target.closest('[data-bmkey]');
  if (bk) { const k = bk.dataset.bmkey; bookmark(k.split(':')[0], k.slice(k.indexOf(':') + 1)); bk.textContent = progress.bookmarks.includes(k) ? '★ ブックマーク中' : '☆ ブックマーク'; return; }
  const bm = e.target.closest('[data-bm]');
  if (bm) { const z = quizQueue[quizIdx]; bookmark(bmKey(z).split(':')[0], bmKey(z).slice(bmKey(z).indexOf(':') + 1)); bm.textContent = progress.bookmarks.includes(bmKey(z)) ? '★ ブックマーク中' : '☆ ブックマーク'; return; }
  const b = e.target.closest('[data-opt]'); if (!b) return;
  const z = quizQueue[quizIdx]; const pick = Number(b.dataset.opt); const ok = pick === z.answer;
  if (ok) quizRight++;
  recordQuiz((qmode === 'choice' ? z.id || z.question : z.q), ok);
  $$('#quizArea .opt').forEach((o, i) => { o.disabled = true; if (i === z.answer) o.classList.add('correct'); else if (i === pick) o.classList.add('wrong'); });
  const lessonBtn = (!ok && z.lesson && lessonById[z.lesson]) ? `<button onclick="__goLesson('${z.lesson}')">📖 関連レッスン「${esc(lessonById[z.lesson].title)}」で復習</button> ` : '';
  $('#qExplain').innerHTML = `<div class="explain">${ok ? '✅ 正解' : '❌ 不正解'}<br>${esc(z.explanation || z.explain)}</div>${lessonBtn}<button class="primary" id="qNext">次の問題</button>`;
  $('#qNext').addEventListener('click', () => { quizIdx++; qmode === 'choice' ? showChoice() : showFill(); });
  if (e.target.closest('[data-run-code]')) return;
});
window.__codeTask = i => {
  const c = CODING[i];
  $('#quizArea').innerHTML = `<h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><p class="kv">ヒント: ${esc(c.hint)}</p>
  <div class="toolbar"><button data-bmkey="code:${esc(c.title)}">${progress.bookmarks.includes('code:' + c.title) ? '★ ブックマーク中' : '☆ ブックマーク'}</button></div>
  <textarea id="codeAns" class="editor" style="height:180px">${esc(c.starter)}</textarea>
  <div class="toolbar"><button class="primary" id="codeRun">▶ 実行して判定</button></div><div id="codeOut"></div>`;
  $('#codeRun').addEventListener('click', async () => {
    const r = await runPython($('#codeAns').value, { stdin: '' });
    const ok = !r.error && r.stdout.replace(/\n$/, '') === c.expect;
    recordQuiz('code:' + c.title, ok);
    $('#codeOut').innerHTML = `<pre>${esc((r.stdout || '') + (r.error || ''))}</pre><div class="explain">${ok ? '✅ テスト合格（期待出力と一致）' : '❌ 期待出力と異なります<br>期待: <pre>' + esc(c.expect) + '</pre>' + (c.lesson && lessonById[c.lesson] ? `<button onclick="__goLesson('${c.lesson}')">📖 関連レッスン「${esc(lessonById[c.lesson].title)}」で復習</button>` : '')}</div>`;
  });
};
window.__bugTask = i => {
  const c = BUGS[i];
  $('#quizArea').innerHTML = `<h3>${esc(c.title)}</h3><p>下のコードにはバグがあります。直して実行してください。</p><p class="kv">ヒント: ${esc(c.hint)}</p>
  <div class="toolbar"><button data-bmkey="bug:${esc(c.title)}">${progress.bookmarks.includes('bug:' + c.title) ? '★ ブックマーク中' : '☆ ブックマーク'}</button></div>
  <textarea id="bugAns" class="editor" style="height:140px">${esc(c.bad)}</textarea>
  <div class="toolbar"><button class="primary" id="bugRun">▶ 実行して判定</button><button id="bugGood">修正例を見る</button></div><div id="bugOut"></div>`;
  $('#bugRun').addEventListener('click', async () => {
    const code = $('#bugAns').value; const r = await runPython(code, { stdin: '' });
    const ok = !r.error && r.stdout.replace(/\n$/, '') === c.expect && code !== c.bad;
    recordQuiz('bug:' + c.title, ok);
    $('#bugOut').innerHTML = `<pre>${esc((r.stdout || '') + (r.error || ''))}</pre><div class="explain">${ok ? '✅ 修正できました' : 'まだ直っていません。エラーメッセージとヒントを見てください<br>' + (c.lesson && lessonById[c.lesson] ? `<button onclick="__goLesson('${c.lesson}')">📖 関連レッスン「${esc(lessonById[c.lesson].title)}」で復習</button>` : '')}</div>`;
  });
  $('#bugGood').addEventListener('click', () => { const m = MISTAKES.find(x => x.title && c.title.includes(x.title.split(' ')[0])); $('#bugOut').innerHTML = m ? `<pre>${esc(m.good)}</pre><p>${esc(m.cause)}</p>` : '解説は「よくある間違い」を参照してください'; });
};
$$('.qmode').forEach(b => b.addEventListener('click', () => { qmode = b.dataset.qmode; $$('.qmode').forEach(x => x.classList.toggle('active', x === b)); startQuiz(); }));
$('#shuffleBtn').addEventListener('click', () => startQuiz());
$('#optShuffleBtn').addEventListener('click', () => {
  optShuffle = !optShuffle; store.set('optShuffle', optShuffle);
  $('#optShuffleBtn').textContent = '選択肢シャッフル: ' + (optShuffle ? 'ON' : 'OFF');
  if (qmode === 'choice' || qmode === 'fill') startQuiz();
});
$('#bookmarkQuizBtn').addEventListener('click', () => {
  const marked = QUIZZES.filter(z => progress.bookmarks.includes('quiz:' + z.id));
  if (!marked.length) { $('#quizArea').innerHTML = '<div class="explain">ブックマークした四択問題がまだありません。問題の ☆ から追加できます。</div>'; return; }
  qmode = 'choice'; $$('.qmode').forEach(x => x.classList.toggle('active', x.dataset.qmode === 'choice'));
  quizQueue = shuffled(marked).map(withShuffledOptions); quizIdx = 0; quizRight = 0; showChoice();
});
$('#reviewWrongBtn').addEventListener('click', () => {
  if (!progress.wrong.length) { $('#quizArea').innerHTML = '<div class="explain">復習対象はありません。</div>'; return; }
  qmode = 'choice'; quizQueue = QUIZZES.filter(z => progress.wrong.includes(z.id)).map(withShuffledOptions); if (!quizQueue.length) { $('#quizArea').innerHTML = '<div class="explain">四択の復習対象はありません（コーディング等は各モードから再挑戦できます）。</div>'; return; }
  quizIdx = 0; quizRight = 0; showChoice();
});

/* ================= Reference ================= */
function renderRefList(){
  const q = ($('#refSearch').value || '').toLowerCase(); const sort = $('#refSort').value;
  let list = REFERENCE.filter(r => !q || (r.name + r.summary + r.category + r.id).toLowerCase().includes(q));
  list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'category' ? a.category.localeCompare(b.category) || (IMP[a.importance] - IMP[b.importance]) : (IMP[a.importance] - IMP[b.importance]) || a.name.localeCompare(b.name));
  $('#refList').innerHTML = list.map(r => `<div class="item" onclick="__goRef('${r.id}')"><b>${esc(r.name)}</b> <span class="badge ${r.importance === '最重要' ? 'hot' : ''}">${esc(r.importance)}</span><div class="meta">${esc(r.category)}・${esc(r.summary)}</div></div>`).join('');
}
$('#refSearch').addEventListener('input', renderRefList);
$('#refSort').addEventListener('change', renderRefList);
function selectRef(id){
  const r = refById[id]; if (!r) return; renderRefList();
  $('#refDetail').innerHTML = `<h2>${esc(r.name)}</h2><div class="kv">${esc(r.category)}・重要度 ${esc(r.importance)}・${esc(r.level)}</div>
  <p>${esc(r.summary)}</p><h3>構文</h3><pre>${esc(r.syntax)}</pre>
  <p><b>引数:</b> ${esc(r.args)}<br><b>戻り値:</b> ${esc(r.returns)}</p>
  <h3>使用例</h3><pre>${esc(r.example)}</pre>
  <div class="toolbar"><button class="primary" data-ref-run="${r.id}">▶ 例を実行</button><button data-ref-studio="${r.id}">Studioで開く</button></div>
  <div id="refOut"></div><p><b>出力:</b> ${esc(r.expected)}</p>
  <p>⚠ <b>よくある間違い・注意:</b> ${esc(r.pitfalls)}</p>
  <div>${refChips(r.related)} ${r.lesson && lessonById[r.lesson] ? `<button class="chip" onclick="__goLesson('${r.lesson}')">関連レッスン</button>` : ''}</div>
  <p class="kv">公式: <a href="https://docs.python.org/ja/3/" target="_blank" rel="noopener">Python公式ドキュメント</a></p>`;
}
$('#refDetail').addEventListener('click', async e => {
  const run = e.target.closest('[data-ref-run]'); const st = e.target.closest('[data-ref-studio]');
  if (run) { const r = refById[run.dataset.refRun]; const inp = r.id === 'input' ? 'タロウ\n' : ''; const res = await runPython(r.example, { stdin: inp }); $('#refOut').innerHTML = `<pre>${esc((res.stdout || '') + (res.error || ''))}</pre>`; }
  if (st) { const r = refById[st.dataset.refStudio]; files['ref_' + r.id.replace(/\W/g, '_') + '.py'] = r.example; switchFile(Object.keys(files).find(f => f.startsWith('ref_'))); showView('studio'); }
});

/* ================= Glossary ================= */
function renderGlossList(){
  const q = ($('#glossSearch').value || '').toLowerCase(); const sort = $('#glossSort').value;
  let list = GLOSSARY.filter(g => !q || (g.ja + g.en + g.def).toLowerCase().includes(q));
  list.sort((a, b) => sort === 'name' ? a.ja.localeCompare(b.ja) : (IMP[a.importance] - IMP[b.importance]) || a.ja.localeCompare(b.ja));
  $('#glossList').innerHTML = list.map(g => `<div class="item" onclick="__goTerm('${g.id}')"><b>${esc(g.ja)}</b> <span class="badge ${g.importance === '最重要' ? 'hot' : ''}">${esc(g.importance)}</span><div class="meta">${esc(g.en)}・${esc(g.def)}</div></div>`).join('');
}
$('#glossSearch').addEventListener('input', renderGlossList);
$('#glossSort').addEventListener('change', renderGlossList);
function selectTerm(id){
  const g = termById[id]; if (!g) return; renderGlossList();
  $('#glossDetail').innerHTML = `<h2>${esc(g.ja)} <span class="kv">${esc(g.en)}</span></h2><div class="kv">重要度 ${esc(g.importance)}</div>
  <p><b>定義:</b> ${esc(g.def)}</p><p><b>やさしく言うと:</b> ${esc(g.easy)}</p>
  ${g.example ? `<h3>例</h3><pre>${esc(g.example)}</pre>` : ''}
  <p>⚠ <b>よくある誤解:</b> ${esc(g.misconception)}</p>
  <div>${termChips(g.related)}</div>`;
}

/* ================= Mistakes ================= */
function renderMistakeList(){
  const q = ($('#mistakeSearch').value || '').toLowerCase();
  $('#mistakeList').innerHTML = MISTAKES.filter(m => !q || (m.title + m.cause + m.phenomenon + m.bad).toLowerCase().includes(q)).map(m =>
    `<div class="item" onclick="__goMistake('${m.id}')"><b>${esc(m.title)}</b><div class="meta">${esc(m.phenomenon)}</div></div>`).join('');
}
$('#mistakeSearch').addEventListener('input', renderMistakeList);
function selectMistake(id){
  const m = MISTAKES.find(x => x.id === id); if (!m) return; renderMistakeList();
  $('#mistakeDetail').innerHTML = `<h2>${esc(m.title)}</h2>
  <h3>誤ったコード</h3><pre>${esc(m.bad)}</pre>
  <p><b>起きる現象:</b> ${esc(m.phenomenon)}</p><p><b>原因:</b> ${esc(m.cause)}</p>
  <h3>正しいコード</h3><pre>${esc(m.good)}</pre>
  <div class="toolbar"><button data-mistake-try="${m.id}">Studioで修正を試す</button></div>
  <div>${termChips(m.related)}</div>`;
}
$('#mistakeDetail').addEventListener('click', e => {
  const b = e.target.closest('[data-mistake-try]'); if (!b) return;
  const m = MISTAKES.find(x => x.id === b.dataset.mistakeTry);
  files['mistake_' + m.id + '.py'] = m.bad; switchFile('mistake_' + m.id + '.py'); showView('studio');
});

/* ================= Env & Packages ================= */
function renderEnv(){
  $('#envList').innerHTML = ENV_LESSONS.map(e => `<div class="card"><h4>${esc(e.title)}</h4><p>${esc(e.body)}</p><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('');
  $('#pkgTable').innerHTML = `<table><tr><th>パッケージ</th><th>分野</th><th>用途</th><th>代表的な使い方</th><th>通常環境への導入</th><th>ブラウザ内</th><th>公式</th></tr>
  ${PACKAGES.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.field)}</td><td>${esc(p.desc)}</td><td><code>${esc(p.usage)}</code></td><td><code>${esc(p.install)}</code></td><td><span class="badge ${p.browser === '動作確認済み' ? 'ok' : ''}">${esc(p.browser)}</span></td><td><a href="${esc(p.official)}" target="_blank" rel="noopener">公式</a></td></tr>`).join('')}</table>`;
}

/* ================= Progress ================= */
function bookmark(kind, id){ const k = kind + ':' + id; progress.bookmarks = progress.bookmarks.includes(k) ? progress.bookmarks.filter(x => x !== k) : [...progress.bookmarks, k]; saveProgress(); }
function renderProgress(){
  const total = progress.history.length, right = progress.history.filter(h => h.ok).length;
  $('#progressSummary').innerHTML = `
    <div class="card"><h4>レッスン</h4><p>${progress.lessonsDone.length} / ${LESSONS.length} 学習済</p></div>
    <div class="card"><h4>演習</h4><p>${total} 回解答・正解 ${right} 回${total ? `（${Math.round(right / total * 100)}%）` : ''}</p></div>
    <div class="card"><h4>復習対象</h4><p>${progress.wrong.length} 件</p></div>
    <div class="card"><h4>収録コンテンツ</h4><p>レッスン ${LESSONS.length}／四択 ${QUIZZES.length}／リファレンス ${REFERENCE.length}／用語 ${GLOSSARY.length}／間違い ${MISTAKES.length}</p></div>`;
  $('#historyView').innerHTML = progress.history.slice(-30).reverse().map(h => `<div class="item">${h.ok ? '✅' : '❌'} ${esc(h.label)} <span class="meta">${esc(h.t.slice(0, 10))}</span></div>`).join('') || 'まだ履歴がありません';
  $('#bookmarkView').innerHTML = progress.bookmarks.map(b => {
    let label = b;
    if (b.startsWith('quiz:')) { const z = QUIZZES.find(x => x.id === b.slice(5)); if (z) label = '四択: ' + z.question.slice(0, 40); }
    return `<span class="chip">${esc(label)}</span>`;
  }).join('') || 'なし';
}
$('#exportBtn').addEventListener('click', () => {
  download('python-studio-backup.json', JSON.stringify({ version: 1, files, progress, notebook: nbCells }, null, 2), 'application/json');
});
$('#importData').addEventListener('change', async e => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (d.files) { files = d.files; currentFile = Object.keys(files)[0]; }
    if (d.progress) progress = d.progress;
    if (d.notebook) nbCells = d.notebook;
    saveFiles(); saveProgress(); setEditorValue(files[currentFile]); renderTabs(); renderNotebook(); renderProgress(); alert('読み込みました');
  } catch(err){ alert('読み込みに失敗しました: ' + err.message); }
});
$('#wipeBtn').addEventListener('click', () => { if (confirm('学習記録と作業ファイルを初期化しますか？')) { localStorage.clear(); location.reload(); } });

/* ================= init ================= */
renderTabs(); renderNotebook(); renderLessonList(); renderRefList(); renderGlossList(); renderMistakeList(); renderEnv(); renderSideList();
$('#optShuffleBtn').textContent = '選択肢シャッフル: ' + (optShuffle ? 'ON' : 'OFF');
startQuiz(); initEditor();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
