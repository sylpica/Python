"""FINAL-B 第3回(M-01〜M-09, L-xx)の修正。置換対象は1回だけ存在することを検証してから適用する。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('app.js', [
    # M-01: writing a file that is open in the editor must update the editor, not be overwritten by it
    ("function openInStudio(name, code){\n  syncCurrent();",
     "function putFile(name, code){\n  files[name] = code;\n  if (name === currentFile) { setEditorValue(displayText(name)); updateReadOnly(); saveFiles(); renderTabs(); runDiagnostics(); }\n  else { saveFiles(); switchFile(name); }\n}\nfunction openInStudio(name, code){\n  syncCurrent();"),
    ("  files[name] = code; saveFiles(); switchFile(name); showView('studio');\n}", "  putFile(name, code); showView('studio');\n}"),
    ("よろしいですか？')) { files[t.file] = t.code; switchFile(t.file); } };", "よろしいですか？')) putFile(t.file, t.code); };"),
    # M-06: results visible on narrow screens
    ("  const con = $('#console'); con.innerHTML = '';", "  reveal('consoleHead');\n  const con = $('#console'); con.innerHTML = '';"),
    ("const reveal = id => {", "function reveal(id){"),
    ("if (el) el.scrollIntoView({ block: 'start' }); } };\nfunction selectLesson", "if (el) el.scrollIntoView({ block: 'start' }); } }\nfunction selectLesson"),
    # M-07: keep keyboard focus
    ("  $('#qNext').addEventListener('click', () => { quizIdx++; showChoice(); });", "  $('#qNext').addEventListener('click', () => { quizIdx++; showChoice(); const o = $('#quizArea .opt'); if (o) o.focus(); });"),
    ("  renderNotebook(); return r;", "  renderNotebook(i); return r;"),
    # M-03: Notebook has its own stdin box
    ("const r = await runPython(c.source, { files, stdin: $('#stdinBox').value, wantLast: true,", "const r = await runPython(c.source, { files, stdin: $('#nbStdin').value, wantLast: true,"),
    # M-09: same Tab / Enter behaviour in every code textarea
    ("let nbTabPass = false;\n$('#nbCells').addEventListener('keydown', e => {\n  const ta = e.target; if (ta.dataset.cell == null || ta.tagName !== 'TEXTAREA') return;\n  const code = nbCells[ta.dataset.cell] && nbCells[ta.dataset.cell].type === 'code';",
     "let nbTabPass = false;\nfunction codeKeys(e){\n  const ta = e.target; if (ta.tagName !== 'TEXTAREA') return;\n  const code = ta.dataset.cell != null ? (nbCells[ta.dataset.cell] && nbCells[ta.dataset.cell].type === 'code') : (ta.id === 'codeAns' || ta.id === 'bugAns');\n  if (!code && ta.dataset.cell == null) return;"),
    ("    if (indent) { e.preventDefault(); ta.setRangeText('\\n' + indent, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }\n  }\n});",
     "    if (indent) { e.preventDefault(); ta.setRangeText('\\n' + indent, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }\n  }\n}\n$('#nbCells').addEventListener('keydown', codeKeys);\n$('#quizArea').addEventListener('keydown', codeKeys);"),
    # L-05 / L-11
    ("  $('#newFileRow').classList.add('hidden'); $('#newFileName').value = '';", "  $('#newFileRow').classList.add('hidden'); $('#newFileName').value = ''; $('#fileRowError').textContent = '';"),
    ("  p.finally(() => { inflight--; syncStop(); });", "  p.finally(() => { inflight--; syncStop(); if (inflight <= 0 && kernelState === 'ready' && /読込中/.test($('#kernelStatus').textContent)) setStatus('カーネル準備完了（Python 3.12 / Pyodide 0.26.4）'); });"),
])

sub('index.html', [
    ('    <div id="nbCells"></div>', '    <details class="stdin-box"><summary>標準入力（input() 用、1行に1つ）</summary>\n      <textarea id="nbStdin" rows="2" placeholder="セルの input() が読む値を改行区切りで" aria-label="Notebook の標準入力"></textarea>\n    </details>\n    <div id="nbCells"></div>'),
    ('<div class="console-head">実行結果', '<div class="console-head" id="consoleHead">実行結果'),
    ('セルの最後の式の値は表示されます。Shift+Enter でセル実行。', 'セルの最後の式の値は表示されます。Shift+Enter でセル実行。Tab は字下げ（Esc のあと Tab で次の項目へ移動）。再読み込み後は出力だけが残り、変数は消えているので、上のセルから実行し直してください。'),
])

sub('lib/core.js', [
    ("/NoneType/.test(msg) ? 'none-handling' : /not callable/.test(msg) ? 'builtin-shadow' : 'str-num-mix'],", "/NoneType/.test(msg) ? 'none-handling' : /not callable/.test(msg) ? 'builtin-shadow' : /concatenate|unsupported operand/.test(msg) ? 'str-num-mix' : null],"),
    ("EOFError: ['input() が読む値がありません。Studio では「標準入力」欄に、input() 1回につき1行ずつ値を書いてから実行してください。', null],", "EOFError: ['input() が読む値がありません。実行前に「標準入力」欄（Studio は実行結果の下、Notebook はセルの上）へ、input() 1回につき1行ずつ値を書いてください。', null],"),
])

sub('styles.css', [
    (".tpl-detail{border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0;max-height:300px;overflow:auto;font-size:.86rem}", ".tpl-detail{border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0;font-size:.86rem;display:flex;flex-direction:column}.tpl-detail .tpl-btns{order:-1;margin:0 0 6px}.tpl-detail h4{order:-2}"),
])
css = open('styles.css', encoding='utf-8').read()
css += '''/* FINAL-B(3) M-02: text on accent / result colours must stay readable in dark theme (was ~2.5:1) */
[data-theme="dark"] .navbtn.active,[data-theme="dark"] .qmode.active,[data-theme="dark"] button.primary,[data-theme="dark"] .tabbar button.active,
[data-theme="dark"] .file-list li.active,[data-theme="dark"] .side-tabs button.active,[data-theme="dark"] .opt.correct,[data-theme="dark"] .opt.wrong,
[data-theme="dark"] .opt.correct .optno,[data-theme="dark"] .opt.wrong .optno{color:#0d1117}
'''
open('styles.css', 'w', encoding='utf-8').write(css)

sub('data/lessons.js', [
    ("自分のファイルにmath.pyのような標準ライブラリと同じ名前を付けると、意図せずそちらが読み込まれて混乱します。", "自分のファイルにrandom.pyのような標準ライブラリと同じ名前を付けると、import randomで自分のファイルの方が読み込まれて混乱します（mathのようにPython本体に組み込まれたモジュールは影響を受けません。また、このアプリでは起動時に読み込み済みの標準ライブラリが使われるため、この現象が再現しない場合があります）。"),
    ("標準ライブラリと同じ名前のファイル（json.pyなど）を自作すると、importでそちらが優先されエラーになることがあります。", "標準ライブラリと同じ名前のファイル（json.pyなど）を自作すると、通常のPythonではimportでそちらが優先されエラーになることがあります（このアプリでは読み込み済みの標準ライブラリが使われ、再現しない場合があります）。"),
    ("CSVの値は文字列のままなので、そのまま計算するとTypeErrorになります。数値列は必ず変換してください。", "CSVの値は文字列のままなので、そのまま計算すると \\\"80\\\" + \\\"95\\\" が \\\"8095\\\" になるなど誤った結果になったり、TypeErrorになったりします。数値列は必ず変換してください。"),
    ("商の整数部分を求める //、", "商を小さい方の整数へ切り下げる //（-7 // 2 は -4）、"),
])
sub('data/quizzes.js', [
    ("タプル (2, 3) にはならず、要素数が合わなくてもエラーにはなりません。", "タプル (2, 3) にはなりません。残りが0個のときは空のリストになります（* の付かない代入先の分の要素が足りない場合は ValueError）。"),
])
sub('data/reference.js', [
    ('"syntax": "zip(iterable1, iterable2, ...)"', '"syntax": "zip(*iterables, strict=False)"'),
    ('"syntax": "map(function, iterable)"', '"syntax": "map(function, iterable, *iterables)"'),
])
sub('data/extras.js', [
    ("実際の通信はブラウザの制約（CORS）を受け、許可されたサーバーにしか届きません（通信は未検証）", "実際の通信はブラウザの制約（CORS）を受け、許可されたサーバーにしか届きません"),
    ("Windowsではインストール時にPATHへ追加する設定を有効にしないと、ターミナルからpythonコマンドが見つからず起動できません。", "Windowsでは、Python 3.14 以降は公式の Python install manager での導入が推奨され、導入後はターミナルから python を使えます。従来のインストーラ（3.15 まで提供）を使う場合は、インストール時にPATHへ追加する設定を有効にしないと、ターミナルからpythonコマンドが見つかりません。"),
    ("which（Windowsでは where）で確認する", "which（Windowsのコマンドプロンプトでは where python、PowerShellでは Get-Command python）で確認する"),
])
print('B3 fixes applied')
