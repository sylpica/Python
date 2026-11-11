"""FINAL-B(独立監査)指摘のコード修正。各置換対象が1回だけ存在することを検証してから適用する（追跡用に保存）。"""


def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)


sub('runtime/pystudio.py', [
    ("    '/lib/python312.zip/_pyodide',\n", "    '/lib/python312.zip/_pyodide',\n    '/lib/python312.zip/ast.py',\n    '/lib/python3.12/ast.py',\n"),
    ("""    try:
        for num in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(num).savefig(buf, format='png', dpi=100, bbox_inches='tight')
            images.append(base64.b64encode(buf.getvalue()).decode('ascii'))
        plt.close('all')
""", """    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            for num in plt.get_fignums():
                buf = io.BytesIO()
                plt.figure(num).savefig(buf, format='png', dpi=100, bbox_inches='tight')
                images.append(base64.b64encode(buf.getvalue()).decode('ascii'))
            plt.close('all')
        glyph = False
        for w in caught:
            if 'missing from' in str(w.message) and 'Glyph' in str(w.message):
                glyph = True      # one line instead of one warning per character
            else:
                warnings.showwarning(w.message, w.category, w.filename, w.lineno)
        if glyph:
            sys.stderr.write('[グラフ] 日本語などの一部の文字は、ブラウザ版 Matplotlib の既定フォントに含まれていないため □ で表示されます。タイトルやラベルは英語にすると正しく表示されます。\\n')
"""),
    ("reset()\n\n\n# ---------------------------------------------------------------- execution",
     "# pandas 2.2 prints a long pyarrow notice on first import; it is not an error and not actionable here\nwarnings.filterwarnings('ignore', message=r'(?s).*Pyarrow will become a required dependency.*')\nreset()\n\n\n# ---------------------------------------------------------------- execution"),
])

sub('app.js', [
    ("function editorValue(){ return editor ? editor.getValue() : $('#editorFallback').value; }",
     "let editorReady = false;   // false while Monaco is loading: never read the (empty, hidden) fallback box as the user's code\nfunction editorValue(){ if (editor) return editor.getValue(); const ta = $('#editorFallback'); return ta.classList.contains('hidden') ? (files[currentFile] ?? '') : ta.value; }\nfunction markEditorReady(){ editorReady = true; if (running <= 0) $('#runBtn').disabled = false; $('#runBtn').title = ''; }"),
    ("ta.addEventListener('input', onEdit); updateReadOnly(); $('#editorNote')", "ta.addEventListener('input', onEdit); updateReadOnly(); markEditorReady(); $('#editorNote')"),
    ("      $('#editorFallback').classList.add('hidden'); updateReadOnly();\n      runDiagnostics();", "      $('#editorFallback').classList.add('hidden'); updateReadOnly(); markEditorReady();\n      runDiagnostics();"),
    ("async function runCurrent(){\n  if (running > 0) return;", "async function runCurrent(){\n  if (running > 0 || !editorReady) return;"),
    ("function setRunning(d){ running += d; $('#runBtn').disabled = running > 0;", "function setRunning(d){ running += d; $('#runBtn').disabled = running > 0 || !editorReady;"),
    ("function selectLesson(id){\n  const l = lessonById[id]; if (!l) return; renderLessonList();",
     "const reveal = id => { if (matchMedia('(max-width:900px)').matches) { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); } };\nfunction selectLesson(id){\n  const l = lessonById[id]; if (!l) return; renderLessonList(); setTimeout(() => reveal('lessonDetail'), 0);"),
    ("function selectRef(id){\n  const r = refById[id]; if (!r) return; renderRefList();", "function selectRef(id){\n  const r = refById[id]; if (!r) return; renderRefList(); setTimeout(() => reveal('refDetail'), 0);"),
    ("function selectTerm(id){\n  const g = termById[id]; if (!g) return; renderGlossList();", "function selectTerm(id){\n  const g = termById[id]; if (!g) return; renderGlossList(); setTimeout(() => reveal('glossDetail'), 0);"),
    ("function selectMistake(id){\n  const m = MISTAKES.find(x => x.id === id); if (!m) return; renderMistakeList();", "function selectMistake(id){\n  const m = MISTAKES.find(x => x.id === id); if (!m) return; renderMistakeList(); setTimeout(() => reveal('mistakeDetail'), 0);"),
    ("  return hits;\n}\n$('#globalSearch')",
     "  const rank = h => { const t = h.title.toLowerCase().replace(/\\(\\)$/, ''); return t === q ? 0 : t.includes(q) ? 1 : 2; };\n  return hits.map((h, i) => [h, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);\n}\n$('#globalSearch')"),
    ("function setQmode(m){ qmode = m; $$('.qmode').forEach(x => { x.classList.toggle('active', x.dataset.qmode === m); x.setAttribute('aria-selected', x.dataset.qmode === m); }); }",
     "function setQmode(m){ qmode = m; $$('.qmode').forEach(x => { x.classList.toggle('active', x.dataset.qmode === m); x.setAttribute('aria-pressed', x.dataset.qmode === m); }); }"),
    ("filename: `<cell ${i + 1}>` });", "filename: `セル ${i + 1}` });"),
    ("$('#nbCells').addEventListener('keydown', e => { const i = e.target.dataset.cell;",
     "let nbTabPass = false;\n$('#nbCells').addEventListener('keydown', e => {\n  const ta = e.target; if (ta.dataset.cell == null || ta.tagName !== 'TEXTAREA') return;\n  const code = nbCells[ta.dataset.cell] && nbCells[ta.dataset.cell].type === 'code';\n  if (e.key === 'Escape') { nbTabPass = true; return; }\n  if (code && e.key === 'Tab' && !e.shiftKey && !nbTabPass && !e.ctrlKey && !e.metaKey) { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }\n  nbTabPass = false;\n  if (code && e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && ta.selectionStart === ta.selectionEnd) {\n    const before = ta.value.slice(0, ta.selectionStart); const line = before.slice(before.lastIndexOf('\\n') + 1); const indent = line.match(/^ */)[0] + (/:\\s*$/.test(line) ? '    ' : '');\n    if (indent) { e.preventDefault(); ta.setRangeText('\\n' + indent, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }\n  }\n});\n$('#nbCells').addEventListener('keydown', e => { const i = e.target.dataset.cell;"),
    ("<tr id=\"env-pkg-${p.id}\"><td><b>${esc(p.name)}</b></td><td>${esc(p.field)}</td><td>${esc(p.desc)}</td><td>${esc(p.usage)}</td><td><code>${esc(p.install)}</code></td><td><span",
     "<tr id=\"env-pkg-${p.id}\"><td data-l=\"パッケージ\"><b>${esc(p.name)}</b></td><td data-l=\"分野\">${esc(p.field)}</td><td data-l=\"用途\">${esc(p.desc)}</td><td data-l=\"代表的な使い方\">${esc(p.usage)}</td><td data-l=\"通常環境への導入\"><code>${esc(p.install)}</code></td><td data-l=\"ブラウザ内\"><span"),
    ("</td><td><a href=\"${esc(p.official)}\" target=\"_blank\" rel=\"noopener\">公式</a></td></tr>`).join('')}</table></div>`;",
     "</td><td data-l=\"公式\"><a href=\"${esc(p.official)}\" target=\"_blank\" rel=\"noopener\">${esc(p.name)} 公式</a></td></tr>`).join('')}</table></div>`;"),
    ("renderEnv(); renderSideList(); renderTplList();",
     "renderEnv(); renderSideList(); renderTplList(); if ($('.navbtn.active')) $('.navbtn.active').setAttribute('aria-current', 'page'); $('#runBtn').disabled = true; $('#runBtn').title = 'エディタを読み込み中です';"),
])

sub('index.html', [('<div class="toolbar" role="tablist" aria-label="問題形式">', '<div class="toolbar" role="group" aria-label="問題形式">')])

css = open('styles.css', encoding='utf-8').read()
css += '''/* FINAL-B fixes */
@media (max-width:900px){ .topbar{position:static} .search-results{top:0} .ref-panel{position:static} }
@media (max-width:600px){
 .nav{flex:0 0 100%}
 #pkgTable table,#pkgTable tbody,#pkgTable tr,#pkgTable td{display:block;width:100%}
 #pkgTable tr:first-child{display:none}
 #pkgTable tr{border:1px solid var(--line);border-radius:8px;margin:8px 0;padding:4px 8px}
 #pkgTable td{border:none;padding:3px 0}
 #pkgTable td::before{content:attr(data-l) "：";color:var(--mut);font-size:12px}
}
'''
open('styles.css', 'w', encoding='utf-8').write(css)
readme = open('README.md', encoding='utf-8').read().replace('環境構築教材10本', '環境構築教材12本')
open('README.md', 'w', encoding='utf-8').write(readme)
print('code fixes applied')
