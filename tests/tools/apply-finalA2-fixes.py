"""最終監査 FINAL-A 第2回の指摘(H-1,H-2,M-1,M-2,M-3,L-4,L-5)の修正。置換対象は1回だけ存在することを検証してから適用する。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('worker.js', [
    # H-2: hidden entries are not deleted: they are simply not listed to the page, so they must count as "seen"
    ("      if (n === '.' || n === '..' || n === '__pycache__' || n.startsWith('.')) continue;\n      const path = dir + '/' + n, relName = rel ? rel + '/' + n : n; let st;\n      try { st = pyodide.FS.stat(path); } catch (e) { continue; }",
     "      const path = dir + '/' + n, relName = rel ? rel + '/' + n : n; let st;\n      if (n === '.' || n === '..') continue;\n      if (n === '__pycache__' || n.startsWith('.')) { seenHidden.add(relName); continue; }   // kept on disk, not shown: must not be treated as deleted\n      try { st = pyodide.FS.stat(path); } catch (e) { continue; }"),
    ("  const changed = [], tooLarge = [], deleted = []; let total = 0; const seen = new Set();",
     "  const changed = [], tooLarge = [], deleted = []; let total = 0; const seen = new Set(), seenHidden = new Set();"),
    ("  for (const name of [...written.keys()]) if (!seen.has(name)) { deleted.push(name); written.delete(name); }",
     "  for (const name of [...written.keys()]) if (!seen.has(name) && !seenHidden.has(name) && ![...seenHidden].some(h => name.startsWith(h + '/'))) { deleted.push(name); written.delete(name); }"),
    # M-2: flush the tail of output shortly after it is written, not only when the next write arrives
    ("  if (streamId != null) {\n    streamBuf.push({ s: stream, t: text });\n    const now = performance.now();\n    if (now - lastStream > 150) flushStream(now);\n  }",
     "  if (streamId != null) {\n    streamBuf.push({ s: stream, t: text });\n    const now = performance.now();\n    if (now - lastStream > 150) flushStream(now);\n    else if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flushStream(); }, 160);\n  }"),
    ("function flushStream(now) {", "let flushTimer = null;\nfunction flushStream(now) {"),
])

sub('app.js', [
    # H-1: another tab's save is adopted (replaces our in-memory state), instead of only adding missing names
    ("window.addEventListener('storage', e => {\n  if (e.key !== PREFIX + 'files' || !e.newValue) return;\n  try {\n    const other = normalizeFiles(JSON.parse(e.newValue)); let added = 0;\n    for (const [k, v] of Object.entries(other)) if (files[k] == null) { files[k] = v; added++; }\n    if (added) { saveFiles(); renderTabs(); banner(`別のタブで作成されたファイルを ${added} 件取り込みました。複数のタブで同時に編集すると、同じ名前のファイルは最後に書いた内容が残ります。`, 'warn'); }\n  } catch(err){}\n});",
     "// Another tab saved: adopt its state before we save again, so this tab can never write back a stale copy.\nwindow.addEventListener('storage', e => {\n  if (e.key !== PREFIX + 'files' || !e.newValue) return;\n  try {\n    const other = normalizeFiles(JSON.parse(e.newValue));\n    const changedNames = Object.keys(other).filter(k => other[k] !== files[k]).length;\n    if (!changedNames && Object.keys(other).length === Object.keys(files).length) return;\n    files = other;\n    if (files[currentFile] == null) currentFile = Object.keys(files)[0];\n    setEditorValue(displayText(currentFile)); updateReadOnly(); renderTabs(); runDiagnostics();\n    banner('別のタブでの変更を取り込みました。複数のタブで同時に編集すると、後から保存した方の内容が残ります。', 'warn');\n  } catch(err){}\n});"),
    # M-1: a binary .py cannot be run as text
    ("async function runCurrent(){\n  if (running > 0 || !editorReady) return;   // one Studio run at a time (button is disabled too)\n  syncCurrent();",
     "async function runCurrent(){\n  if (running > 0 || !editorReady) return;   // one Studio run at a time (button is disabled too)\n  if (isBinary(files[currentFile])) { $('#console').textContent = `「${currentFile}」は UTF-8 以外の文字コードのため、バイナリとして読み込まれています。実行するには UTF-8 で保存し直してください。`; return; }\n  syncCurrent();"),
    # M-2: an interrupted run keeps what it already printed
    ("    if (m.type === 'stream') { const p = pending.get(m.id); if (p && p.onStream) p.onStream(m.segs); return; }",
     "    if (m.type === 'stream') { const p = pending.get(m.id); if (p) { p.acc = (p.acc || []).concat(m.segs); if (p.onStream) p.onStream(m.segs); } return; }"),
    ("  for (const [, p] of pending) p.resolve({ type:'result', segs:[{ s:'err', t: reason }],",
     "  for (const [, p] of pending) p.resolve({ type:'result', segs:[...(p.acc || []), { s:'err', t: '\\n' + reason + '\\n' }],"),
    # M-3: keep the last few backups before an import, and say so accurately
    ("    if (!store.set('before-import', { files, progress, notebook: nbCells, at: new Date().toISOString() }) && !confirm(",
     "    const hist = store.get('before-import-history', []); hist.unshift({ files, progress, notebook: nbCells, at: new Date().toISOString() }); store.set('before-import-history', hist.slice(0, 5));\n    if (!store.set('before-import', hist[0]) && !confirm("),
    ("現在のデータは自動で退避します（データ初期化以外では消えません）。", "現在のデータは直前5回分まで自動で退避します（ブラウザの保存領域に残り、この画面からは復元できません）。"),
])

sub('runtime/pystudio.py', [
    # L-4: shadowing is only reported for module-level names (a local variable named sum is fine)
    ("        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in _SHADOW:",
     "        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in _SHADOW and node.id in _MODULE_STORES:"),
    ("    W.sort(key=lambda w: (w['line'], w['col']))\n    res['warnings'] = W[:40]",
     "    W.sort(key=lambda w: (w['line'], w['col']))\n    res['warnings'] = W[:40]"),
])
sub('runtime/pystudio.py', [
    ("    bound = set(dir(builtins)) | _IMPLICIT | set(json.loads(extra_names_json))",
     "    _MODULE_STORES = set()\n    for stmt in tree.body:\n        for t in (stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target] if isinstance(stmt, (ast.AnnAssign, ast.AugAssign)) else []):\n            for n in ast.walk(t):\n                if isinstance(n, ast.Name):\n                    _MODULE_STORES.add(n.id)\n    bound = set(dir(builtins)) | _IMPLICIT | set(json.loads(extra_names_json))"),
])

sub('lib/core.js', [
    # L-5: do not claim an automatic restart that does not happen when the kernel failed to start
    ("    KernelError: ['Python カーネル自体が停止しました。自動で再起動します（変数は失われます）。', null],",
     "    KernelError: ['Python カーネルが停止しました（起動できていない場合は、画面の「再試行」を押してください）。実行中だった場合は、変数が失われている可能性があります。', null],"),
])
print('FINAL-A round 2 fixes applied')
