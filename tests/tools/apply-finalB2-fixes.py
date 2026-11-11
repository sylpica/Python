"""FINAL-A 追加分 + FINAL-B 再走(N-xx)の修正。置換対象は1回だけ存在することを検証してから適用する。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('index.html', [
    ('<button id="nbRunAll" class="primary">▶▶ 全セル実行</button>', '<button id="nbRunAll" class="primary">▶▶ 全セル実行</button>\n      <button id="nbStop" disabled>■ 中断</button>'),
    ('<div id="editorNote" class="note"></div>', '<div id="editorNote" class="note">Tab は字下げです。キーボードでエディタから出るには Ctrl+M のあと Tab を押します。</div>'),
])

sub('app.js', [
    ("const syncStop = () => { $('#stopBtn').disabled = inflight <= 0; };", "const syncStop = () => { for (const id of ['#stopBtn', '#nbStop']) $(id).disabled = inflight <= 0; };"),
    ("$('#stopBtn').addEventListener('click', () => {\n  if (confirm(", "function stopKernel(){\n  if (confirm("),
    ("    newWorker(); nbExecCount = 0; $('#varsView').textContent = '（中断によりカーネルを再起動しました）';\n  }\n});",
     "    newWorker(); nbExecCount = 0; $('#varsView').textContent = '（中断によりカーネルを再起動しました）';\n  }\n}\n$('#stopBtn').addEventListener('click', stopKernel);\n$('#nbStop').addEventListener('click', stopKernel);   // the Notebook view has no Studio toolbar: it needs its own stop button"),
    # N-01: never overwrite an existing, different file silently
    ("function openInStudio(name, code){ files[name] = code; saveFiles(); switchFile(name); showView('studio'); }",
     "function openInStudio(name, code){\n  syncCurrent();\n  if (files[name] != null && files[name] !== code && !confirm(`「${name}」には既に別の内容（編集済みの可能性があります）があります。元のコードで上書きしますか？\\n［キャンセル］で、今あるファイルをそのまま開きます。`)) { switchFile(name); showView('studio'); return; }\n  files[name] = code; saveFiles(); switchFile(name); showView('studio');\n}"),
    ("$('#sampleCsvBtn').addEventListener('click', () => { files['sales.csv'] =", "$('#sampleCsvBtn').addEventListener('click', () => { if (files['sales.csv'] != null && !confirm('「sales.csv」は既にあります。サンプルの内容で上書きしますか？')) return; files['sales.csv'] ="),
    ("if (st) { const r = refById[st.dataset.refStudio]; if (r.stdin) $('#stdinBox').value = r.stdin;", "if (st) { const r = refById[st.dataset.refStudio]; if (r.stdin && !$('#stdinBox').value.trim()) $('#stdinBox').value = r.stdin;"),
    # N-02: another tab must never make this tab drop files
    ("function syncCurrent(){", "window.addEventListener('storage', e => {\n  if (e.key !== PREFIX + 'files' || !e.newValue) return;\n  try {\n    const other = normalizeFiles(JSON.parse(e.newValue)); let added = 0;\n    for (const [k, v] of Object.entries(other)) if (files[k] == null) { files[k] = v; added++; }\n    if (added) { saveFiles(); renderTabs(); banner(`別のタブで作成されたファイルを ${added} 件取り込みました。複数のタブで同時に編集すると、同じ名前のファイルは最後に書いた内容が残ります。`, 'warn'); }\n  } catch(err){}\n});\nfunction syncCurrent(){"),
    # N-03: queue the run until the editor is ready
    ("let editorReady = false;", "let editorReady = false; const readyWaiters = [];\nconst whenEditorReady = fn => { if (editorReady) fn(); else { setStatus('エディタを読み込み中です。読み込み後に実行します…'); readyWaiters.push(fn); } };"),
    ("function markEditorReady(){ editorReady = true;", "function markEditorReady(){ editorReady = true; readyWaiters.splice(0).forEach(fn => fn());"),
    ("window.__tplRun = id => { const t = TEMPLATES.find(x => x.id === id); if (t) { tplFile(t); runCurrent(); } };", "window.__tplRun = id => { const t = TEMPLATES.find(x => x.id === id); if (t) { tplFile(t); whenEditorReady(runCurrent); } };"),
])

sub('lib/core.js', [
    ("  const msg = err.message || '';\n  const T = {", "  const msg = err.message || '';\n  if (/Failed to fetch|Can't fetch metadata|pypi\\.org|NetworkError|ERR_INTERNET|ClientConnectorError/i.test(msg + ' ' + (err.text || ''))) return { text: 'ネットワークからの取得に失敗しました。オンラインか確認してください（micropip はPyPIから、パッケージはCDNから取得します。オフラインでは、一度読み込んだものしか使えません）。', mid: null };\n  const T = {"),
])

css = open('styles.css', encoding='utf-8').read()
css += '''/* FINAL-A/B(2) fixes: contrast and layout */
.opt.correct,.opt.wrong,.opt.correct:disabled,.opt.wrong:disabled{opacity:1;font-weight:600}
.opt.correct::after{content:" ✓ 正解";margin-left:6px}.opt.wrong::after{content:" ✗ 選んだ答え";margin-left:6px}
.opt:disabled:not(.correct):not(.wrong){opacity:.6}
a{color:var(--acc)}
[data-theme="dark"] a{color:#79b8ff}
#sideDetail{min-height:110px}
'''
open('styles.css', 'w', encoding='utf-8').write(css)


def replace_text(path, a, b):
    s = open(path, encoding='utf-8').read()
    assert s.count(a) == 1, (path, a, s.count(a))
    open(path, 'w', encoding='utf-8').write(s.replace(a, b))


replace_text('data/reference.js', '"syntax": "list.sort(key=None, reverse=False)"', '"syntax": "list.sort(*, key=None, reverse=False)"')
replace_text('data/reference.js', '小数 float を int にすると小数部は切り捨てられる', '小数 float を int にすると小数部は切り捨てられる（0 に近い方向へ。int(-2.5) は -2）')
print('B2 fixes applied')
