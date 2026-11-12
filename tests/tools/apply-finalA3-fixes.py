"""最終監査 FINAL-A 第3回の指摘の修正。置換対象は1回だけ存在することを検証してから適用する。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('app.js', [
    # A-01 / A-02: other tabs' progress and Notebook are adopted too, not only the file list
    ("window.addEventListener('storage', e => {\n  if (e.key !== PREFIX + 'files' || !e.newValue) return;",
     "window.addEventListener('storage', e => {\n  if (e.key === PREFIX + 'progress' && e.newValue) { try { progress = normalizeProgress(JSON.parse(e.newValue), QUIZZES); renderLessonList(); } catch(err){} return; }\n  if (e.key === PREFIX + 'notebook' && e.newValue) { try { nbCells = normalizeNotebook(JSON.parse(e.newValue)); if (!$('#view-notebook').classList.contains('active') || !nbCells.length) renderNotebook(); } catch(err){} return; }\n  if (e.key !== PREFIX + 'files' || !e.newValue) return;"),
    # A-04: corrupt stored data is kept (copied aside once) before the default is used
    ("  get(k, d){ try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },",
     "  get(k, d){\n    let v = null;\n    try { v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); }\n    catch(e){\n      // never silently discard a value we could not read: keep a copy before falling back to the default\n      try { if (v != null && localStorage.getItem('pystudio:corrupt-' + k) == null) localStorage.setItem('pystudio:corrupt-' + k, v); } catch(e2){}\n      return d;\n    }\n  },"),
    # A-03: a file the user typed in while a run was going is not overwritten by the program's write
    ("function mergeChanges(ch){\n  if (!ch) return '';\n  const notes = [];\n  for (const c of ch.changed) { files[c.name] = c.content; notes.push(c.name); }",
     "function mergeChanges(ch, before){\n  if (!ch) return '';\n  const notes = [], kept = [];\n  for (const c of ch.changed) {\n    if (before && before[c.name] !== undefined && files[c.name] !== before[c.name]) { kept.push(c.name); continue; }   // the user edited it during the run\n    files[c.name] = c.content; notes.push(c.name);\n  }"),
    ("  let msg = notes.length ? `プログラムが作成・更新したファイルをファイル一覧に反映しました: ${notes.join(', ')}` : '';",
     "  let msg = notes.length ? `プログラムが作成・更新したファイルをファイル一覧に反映しました: ${notes.join(', ')}` : '';\n  if (kept.length) msg += (msg ? '\\n' : '') + `実行中に編集された内容を残すため、プログラムの書込みは反映しなかったファイル: ${kept.join(', ')}`;\n  if (ch.deleted.length) msg += (msg ? '\\n' : '') + `プログラムが削除したファイル（一覧から外しました）: ${ch.deleted.join(', ')}`;"),
    ("  const changeMsg = mergeChanges(res.changes);\n  con.innerHTML", "  const changeMsg = mergeChanges(res.changes, snapshotAtStart);\n  con.innerHTML"),
    ("  let streamed = '';\n  setRunning(1);", "  let streamed = '';\n  const snapshotAtStart = { ...files };\n  setRunning(1);"),
    # A-09: after a failed/timed-out kernel start, a run returns at once instead of waiting forever
    ("function runPython(code, opts = {}, onStream){\n  // every execution / reset goes through one queue: no interleaved stdout or kernel state\n  inflight++; syncStop();",
     "function runPython(code, opts = {}, onStream){\n  // every execution / reset goes through one queue: no interleaved stdout or kernel state\n  if (kernelState === 'failed') return Promise.resolve({ type:'result', segs:[{ s:'err', t:'Python が起動していません。画面の「再試行」を押してください。\\n' }], error:{ type:'Interrupted', message:'kernel not started', text:'' }, images:[], vars:[], ms:0, syntax:null, warnings:[] });\n  inflight++; syncStop();"),
    # A-06: a UTF-8 file with a byte-order mark is text (the mark is dropped), not binary
    ("    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf); if (text.charCodeAt(0) === 0xFEFF) text = null; } catch(err2) { text = null; }",
     "    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf); if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); } catch(err2) { text = null; }"),
    # A-08: keep only the most recent import backup, so backups cannot use up the storage space
    ("store.set('before-import-history', hist.slice(0, 5));", "store.set('before-import-history', hist.slice(0, 1));"),
    ("    const nf = d.files ? normalizeFiles(d.files) : null;",
     "    const nf = d.files ? normalizeFiles(d.files) : null;\n    if (nf) for (const k of Object.keys(nf)) { if (nameConflict(k, nf, k)) delete nf[k]; }   // A-13: names that collide with a folder/file are dropped"),
])

sub('lib/core.js', [
    # A-14: Windows reserved device names cannot be file names
    ("  if (name in Object.prototype) return 'この名前は使えません（予約された名前です）';",
     "  if (name in Object.prototype) return 'この名前は使えません（予約された名前です）';\n  if (name.split('/').some(p => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\\..*)?$/i.test(p))) return 'Windows で使えない名前です（CON, NUL, COM1 など）';"),
])

sub('runtime/pystudio.py', [
    # A-11: only names bound by a module-level assignment target count (a subscript key is a read, not a binding)
    ("            for n in ast.walk(t):\n                if isinstance(n, ast.Name):\n                    _MODULE_STORES.add(n.id)",
     "            for n in ast.walk(t):\n                if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):\n                    _MODULE_STORES.add(n.id)"),
    # A-11 (second part): a store inside a function or class body is a local, never the module-level name
    ("        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in _SHADOW and node.id in _MODULE_STORES:",
     "        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in _SHADOW and node.id in _MODULE_STORES and id(node) in _MODULE_LEVEL_IDS:"),
    ("    _MODULE_STORES = set()\n",
     "    _MODULE_STORES = set()\n    _MODULE_LEVEL_IDS = set()\n    for stmt in tree.body:\n        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):\n            continue\n        for n in ast.walk(stmt):\n            if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):\n                _MODULE_LEVEL_IDS.add(id(n))\n"),
])

sub('sw.js', [
    # A-10: the CDN cache is versioned with the app, so a bad (e.g. HTTP 500) entry is dropped at the next update
    ("const CDN_CACHE = 'python-studio-cdn-v1';", "const CDN_CACHE = 'python-studio-cdn-' + VERSION;"),
])
print('FINAL-A round 3 fixes applied')
