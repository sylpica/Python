"""FINAL-A(独立技術監査)指摘 A-02〜A-12 の修正。置換対象は1回だけ存在することを検証してから適用する。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('lib/core.js', [
    ("export function validFileName(name){\n  if (!name) return 'ファイル名を入力してください';",
     "// binary files are stored as 'base64:' + strict base64; anything else is text\nexport const isB64 = v => typeof v === 'string' && /^base64:[A-Za-z0-9+/]*={0,2}$/.test(v) && (v.length - 7) % 4 === 0;\n// a name may not equal a file's folder prefix or sit under an existing file (file/folder collision)\nexport function nameConflict(name, files, except){\n  for (const k of Object.keys(files)) { if (k === except || k === name) continue; if (k.startsWith(name + '/') || name.startsWith(k + '/')) return `「${k}」と、ファイル／フォルダの名前が衝突します`; }\n  return null;\n}\n\nexport function validFileName(name){\n  if (!name) return 'ファイル名を入力してください';\n  if (name in Object.prototype) return 'この名前は使えません（予約された名前です）';"),
    ("const arr = v => Array.isArray(v) ? v : [];",
     "const arr = v => Array.isArray(v) ? v : [];\nconst str = v => typeof v === 'string' ? v : '';\n// notebook output comes from storage / imported files: rebuild it field by field so rendering can never throw\nexport function cleanOutput(o){\n  if (!o || typeof o !== 'object') return null;\n  const e = o.error && typeof o.error === 'object' ? o.error : null;\n  return {\n    segs: arr(o.segs).filter(s => s && typeof s === 'object' && typeof s.t === 'string').map(s => ({ s: s.s === 'err' ? 'err' : 'out', t: s.t })),\n    images: arr(o.images).filter(i => typeof i === 'string' && /^[A-Za-z0-9+/=\\s]*$/.test(i)),\n    result: typeof o.result === 'string' ? o.result : null,\n    error: e ? { type: str(e.type) || 'Error', message: str(e.message), text: str(e.text), file: typeof e.file === 'string' ? e.file : null, line: Number.isInteger(e.line) ? e.line : null } : null,\n    note: typeof o.note === 'string' ? o.note : null, asyncioShim: !!o.asyncioShim,\n  };\n}"),
    ("      if (c.output && typeof c.output === 'object') cell.output = c.output;\n      else if (typeof c.out === 'string' && c.out) cell.output = { segs: [{ s: 'out', t: c.out }], images: [] };  // schema 1",
     "      const out = cleanOutput(c.output);\n      if (out) cell.output = out;\n      else if (typeof c.out === 'string' && c.out) cell.output = { segs: [{ s: 'out', t: c.out }], images: [], result: null, error: null, note: null, asyncioShim: false };  // schema 1"),
    ("(https?:\\/\\/[^)\\s\"']+)\\)/g", "(https?:\\/\\/[^)\\s\"'*<>]+)\\)/g"),
    ("      const o = { segs: [], images: [], result: null, error: null };", "      const o = { segs: [], images: [], result: null, error: null };"),
])

sub('worker.js', [
    ("function toBytes(content) {\n  if (typeof content === 'string' && content.startsWith('base64:')) {",
     "const isB64 = v => typeof v === 'string' && /^base64:[A-Za-z0-9+/]*={0,2}$/.test(v) && (v.length - 7) % 4 === 0;\nfunction toBytes(content) {\n  if (isB64(content)) {"),
    ("function syncFiles(files) {\n", "function syncFiles(files) {\n  const problems = [];\n"),
    ("    const bytes = toBytes(content); const fp = fingerprint(bytes);\n    if (written.get(name) === fp) { try { pyodide.FS.stat(PROJECT + '/' + name); continue; } catch (e) {} }\n    const parts = name.split('/');\n    for (let d = 1; d < parts.length; d++) { try { pyodide.FS.mkdir(PROJECT + '/' + parts.slice(0, d).join('/')); } catch (e) {} }\n    pyodide.FS.writeFile(PROJECT + '/' + name, bytes);\n    written.set(name, fp);\n  }\n}",
     "    try {\n      const bytes = toBytes(content); const fp = fingerprint(bytes);\n      if (written.get(name) === fp) { try { pyodide.FS.stat(PROJECT + '/' + name); continue; } catch (e) {} }\n      const parts = name.split('/');\n      for (let d = 1; d < parts.length; d++) { try { pyodide.FS.mkdir(PROJECT + '/' + parts.slice(0, d).join('/')); } catch (e) {} }\n      pyodide.FS.writeFile(PROJECT + '/' + name, bytes);\n      written.set(name, fp);\n    } catch (e) { problems.push(name); }   // one bad file must not stop every run\n  }\n  return problems;\n}"),
    ("    if (msg.files) syncFiles(msg.files);", "    if (msg.files) for (const n of syncFiles(msg.files)) pushOut('err', `[ファイル「${n}」を仮想ファイルに書き込めませんでした（別のファイル／フォルダと名前が衝突している可能性があります）]\\n`, true);"),
    ("      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) text = null; } catch (e) { text = null; }",
     "      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) text = null; } catch (e) { text = null; }\n      if (text !== null && isB64(text)) text = null;   // text that looks like our binary marker is stored as binary, never ambiguous"),
])

sub('runtime/pystudio.py', [
    ("    else:\n        purge_project_modules()\n", "    else:\n        purge_project_modules()\n        try:\n            os.chdir(PROJECT_DIR)   # a previous os.chdir() must not break the next run\n        except OSError:\n            pass\n"),
])

sub('sw.js', [
    ("k.startsWith('python-studio') &&", "k.startsWith('python-studio-') &&"),
    ("    e.respondWith(fetch(e.request).then(res => {", "    // cache:'no-cache' revalidates with the server, so the HTTP cache (GitHub Pages sends max-age=600)\n    // can never serve a mix of old and new files after a deploy\n    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {"),
])

sub('index.html', [('<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js"></script>\n', '')])

sub('app.js', [
    ("import { normalizeFiles, normalizeProgress,", "import { isB64, nameConflict, normalizeFiles, normalizeProgress,"),
    ("const isBinary = v => typeof v === 'string' && v.startsWith('base64:');", "const isBinary = isB64;"),
    ("      if (!storageWarned) { storageWarned = true; banner('端末への保存に失敗しました", "      { banner('端末への保存に失敗しました"),
    ("function saveProgress(){ store.set('progress', progress); }\nfunction saveFiles(){ store.set('files', files); store.set('currentFile', currentFile); }\nfunction saveNotebook(){ store.set('notebook', nbCells); if (nbMeta) store.set('notebookMeta', nbMeta); }",
     "function saveProgress(){ return store.set('progress', progress); }\nfunction saveFiles(){ const a = store.set('files', files), b = store.set('currentFile', currentFile); return a && b; }\nfunction saveNotebook(){ const a = store.set('notebook', nbCells); const b = nbMeta ? store.set('notebookMeta', nbMeta) : true; return a && b; }\n// keep the stored text byte-exact (e.g. CRLF) unless the user really edited it\nfunction syncCurrent(){ const f = currentFile; if (files[f] == null || isBinary(files[f])) return; const v = editorValue(); if (v.replace(/\\r\\n/g, '\\n') !== String(files[f]).replace(/\\r\\n/g, '\\n')) files[f] = v; }"),
    ("let worker = null, gen = 0, runSeq = 0, kernelState = 'starting', startTimer = null;", "let worker = null, gen = 0, runSeq = 0, kernelState = 'starting', startTimer = null, startTimer2 = null;"),
    ("  clearTimeout(startTimer);\n  startTimer = setTimeout(", "  clearTimeout(startTimer); clearTimeout(startTimer2);\n  startTimer2 = setTimeout(() => { if (myGen === gen && kernelState === 'starting') { kernelState = 'failed'; setStatus('カーネルの起動がタイムアウトしました（回線が不安定、またはCDNに接続できません）。'); $('#kernelRetry').classList.remove('hidden'); flushPending('Python の起動がタイムアウトしました。「再試行」を押してください。'); } }, 90000);\n  startTimer = setTimeout("),
    ("      kernelState = 'ready'; clearTimeout(startTimer);", "      kernelState = 'ready'; clearTimeout(startTimer); clearTimeout(startTimer2);"),
    ("    if (m.type === 'init-error') { kernelState = 'failed'; clearTimeout(startTimer);", "    if (m.type === 'init-error') { kernelState = 'failed'; clearTimeout(startTimer); clearTimeout(startTimer2);"),
    ("function runPython(code, opts = {}, onStream){\n  // every execution / reset goes through one queue: no interleaved stdout or kernel state\n  return enqueue(() => callWorker({ type:'run', code, files: opts.files, stdin: opts.stdin ?? '', isolated: !!opts.isolated,\n    wantLast: !!opts.wantLast, filename: opts.filename || 'main.py', stream: !!onStream }, onStream));\n}",
     "let inflight = 0;   // runs from anywhere (Studio, Notebook, lessons, quizzes): the Stop button follows this, not just Studio\nconst syncStop = () => { $('#stopBtn').disabled = inflight <= 0; };\nfunction runPython(code, opts = {}, onStream){\n  // every execution / reset goes through one queue: no interleaved stdout or kernel state\n  inflight++; syncStop();\n  const p = enqueue(() => callWorker({ type:'run', code, files: opts.files, stdin: opts.stdin ?? '', isolated: !!opts.isolated,\n    wantLast: !!opts.wantLast, filename: opts.filename || 'main.py', stream: !!onStream }, onStream));\n  p.finally(() => { inflight--; syncStop(); });\n  return p;\n}"),
    ("$('#runState').textContent = running > 0 ? '実行中…' : ''; $('#stopBtn').disabled = running <= 0; }", "$('#runState').textContent = running > 0 ? '実行中…' : ''; }"),
    ("  if (!isBinary(files[currentFile]) && files[currentFile] != null) files[currentFile] = editorValue();\n  currentFile = f;", "  syncCurrent();\n  currentFile = f;"),
    ("  if (!isBinary(files[currentFile])) files[currentFile] = editorValue();\n  saveFiles();", "  syncCurrent();\n  saveFiles();"),
    ("  if (!isBinary(files[currentFile])) files[currentFile] = editorValue();\n  const data = {", "  syncCurrent();\n  const data = {"),
    ("  const name = $('#newFileName').value.trim(); const err = validFileName(name);\n  if (err)", "  const name = $('#newFileName').value.trim(); const err = validFileName(name) || (files[name] == null || fileRowMode === 'rename' ? nameConflict(name, files, renameFrom) : null);\n  if (err)"),
    ("    if (files[f.name] != null && !confirm(`「${f.name}」は既にあります。上書きしますか？`)) continue;", "    const nc = nameConflict(f.name, files); if (nc) { alert(`「${f.name}」は取り込めません: ${nc}`); continue; }\n    if (files[f.name] != null && !confirm(`「${f.name}」は既にあります。上書きしますか？`)) continue;"),
    ("<button class=\"item\" onclick=\"__openKey('${esc(h.key)}')\">", "<button class=\"item\" data-open-key=\"${esc(h.key)}\">"),
    ("<button class=\"chip\" onclick=\"__openKey('${esc(b)}')\">", "<button class=\"chip\" data-open-key=\"${esc(b)}\">"),
    ("window.__openKey = openKey;", "window.__openKey = openKey;\n// stored keys are data, never code: they are read from a data attribute, not interpolated into JS\ndocument.addEventListener('click', e => { const el = e.target.closest('[data-open-key]'); if (el) openKey(el.dataset.openKey); });"),
    ("    store.set('before-import', { files, progress, notebook: nbCells, at: new Date().toISOString() });", "    if (!store.set('before-import', { files, progress, notebook: nbCells, at: new Date().toISOString() }) && !confirm('現在のデータを退避できません（保存容量が足りません）。このまま読み込むと現在のデータは失われます。続けますか？')) return;"),
    ("    saveFiles(); saveProgress(); saveNotebook(); setEditorValue(displayText(currentFile)); updateReadOnly(); renderTabs(); renderNotebook(); renderProgress(); renderLessonList();\n    banner('バックアップを読み込みました。', 'ok');",
     "    const saved = [saveFiles(), saveProgress(), saveNotebook()].every(Boolean); setEditorValue(displayText(currentFile)); updateReadOnly(); renderTabs(); renderNotebook(); renderProgress(); renderLessonList();\n    if (saved) banner('バックアップを読み込みました。', 'ok'); else banner('バックアップを画面には読み込みましたが、端末に保存できませんでした（保存容量不足）。再読み込みすると失われます。', 'error');"),
    # async, time-limited Monaco loading
    ("function initEditor(){\n  const fallback = () => { $('#editor')", "function loadScript(src, ms){ return new Promise((res, rej) => { const s = document.createElement('script'); const t = setTimeout(() => rej(new Error('timeout')), ms); s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); rej(new Error('load error')); }; s.src = src; document.head.appendChild(s); }); }\nfunction initEditor(){\n  let settled = false, timer = null;\n  const fallback = () => { if (settled) return; settled = true; clearTimeout(timer); $('#editor')"),
    ("  if (!window.require) return fallback();\n  try {\n    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });\n    window.require(['vs/editor/editor.main'], () => {\n      editor = monaco.editor.create(",
     "  timer = setTimeout(fallback, 20000);   // Monaco on a hanging CDN must never leave the page without an editor\n  loadScript('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js', 10000).then(() => {\n    window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });\n    window.require(['vs/editor/editor.main'], () => {\n      if (settled) return; settled = true; clearTimeout(timer);\n      editor = monaco.editor.create("),
    ("    }, fallback);\n  } catch(e){ fallback(); }\n}", "    }, fallback);\n  }).catch(fallback);\n}"),
])
print('FINAL-A fixes applied')
