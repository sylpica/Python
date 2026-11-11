// Pure helpers shared by the page and the Node tests (no DOM access here).
export const PROTOCOL = 3;   // must match worker.js
export const SCHEMA = 2;     // localStorage data schema

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_MAIN = '# Python Studio へようこそ\nnumbers = [10, 20, 30]\nprint("合計:", sum(numbers))\nprint("平均:", sum(numbers) / len(numbers))\n';

export function validFileName(name){
  if (!name) return 'ファイル名を入力してください';
  if (name.length > 120) return 'ファイル名が長すぎます';
  if (/^\/|\\/.test(name)) return '先頭の / や \\ は使えません（フォルダは a/b.py のように書きます）';
  if (name.split('/').some(p => p === '' || p === '.' || p === '..')) return '空のフォルダ名・. ・.. は使えません';
  if (/[\u0000-\u001f<>:"|?*]/.test(name)) return '使えない文字（< > : " | ? * や制御文字）が含まれています';
  return null;
}

export function normalizeFiles(raw){
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) if (!validFileName(k) && (typeof v === 'string')) out[k] = v;
  }
  if (!Object.keys(out).length) out['main.py'] = DEFAULT_MAIN;
  return out;
}

const arr = v => Array.isArray(v) ? v : [];
// schema 1 stored quiz results as raw ids ("q012"), fill questions by their text and coding
// tasks by title; schema 2 uses kind:id keys. Unknown entries are kept as-is (never dropped).
export function migrateKey(k, quizzes = []){
  if (typeof k !== 'string') return null;
  if (/^(quiz|fill|code|bug):/.test(k)) {
    const LEGACY = { 'code:合計と平均': 'code:sum-avg', 'code:偶数だけ抽出': 'code:evens', 'code:文字数カウント': 'code:char-count', 'code:FizzBuzz（1〜15）': 'code:fizzbuzz',
      'bug:= と == の混同': 'bug:eq', 'bug:コロンの付け忘れ': 'bug:colon', 'bug:文字列と数値の混同': 'bug:str-num', 'bug:インデントミス': 'bug:indent' };
    return LEGACY[k] || k;
  }
  if (quizzes.some(z => z.id === k)) return 'quiz:' + k;
  const FILL_LEGACY = { 'リストの長さを求めるコード: print(___(items))': 'f-len', '辞書でキーが無いときに None を返す: value = d.___("key")': 'f-get',
    '0から4まで繰り返す: for i in ___(5):': 'f-range', '文字列を分割する: parts = text.___(",")': 'f-split', '例外を捕まえる: ___ ValueError:': 'f-except', 'ファイルを開く: ___ open("a.txt") as f:': 'f-with' };
  if (FILL_LEGACY[k]) return 'fill:' + FILL_LEGACY[k];
  return k;
}
export function normalizeProgress(raw, quizzes = []){
  const p = raw && typeof raw === 'object' ? raw : {};
  const uniq = xs => [...new Set(xs.filter(x => typeof x === 'string'))];
  return {
    lessonsDone: uniq(arr(p.lessonsDone)),
    history: arr(p.history).filter(h => h && typeof h === 'object').map(h => ({ t: typeof h.t === 'string' ? h.t : '', key: migrateKey(h.key || h.label, quizzes) || '?', ok: !!h.ok })),
    bookmarks: uniq(arr(p.bookmarks).map(k => migrateKey(k, quizzes))),
    wrong: uniq(arr(p.wrong).map(k => migrateKey(k, quizzes))),
  };
}
export function normalizeNotebook(raw){
  const cells = arr(raw).filter(c => c && typeof c === 'object').map(c => {
    const type = ['code', 'markdown', 'raw'].includes(c.type) ? c.type : 'code';
    const cell = { type, source: typeof c.source === 'string' ? c.source : '' };
    if (type === 'code') {
      if (Number.isInteger(c.count)) cell.count = c.count;
      if (c.output && typeof c.output === 'object') cell.output = c.output;
      else if (typeof c.out === 'string' && c.out) cell.output = { segs: [{ s: 'out', t: c.out }], images: [] };  // schema 1
    }
    if (c.extra && typeof c.extra === 'object') cell.extra = c.extra;
    return cell;
  });
  return cells.length ? cells : [{ type: 'markdown', source: '# Notebook\nセルを実行して結果を確認しましょう。' }, { type: 'code', source: 'x = 21\nx * 2' }];
}

/* ---------- Markdown (safe subset: everything is escaped first, links only http/https) ---------- */
function inline(s){
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s"']+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
export function renderMarkdown(src){
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre>${esc(buf.join('\n'))}</pre>`); continue; }
    let m = l.match(/^(#{1,6})\s+(.*)$/); if (m) { out.push(`<h${m[1].length + 2 > 6 ? 6 : m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2 > 6 ? 6 : m[1].length + 2}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/, ''))}</li>`); out.push(`<ul>${items.join('')}</ul>`); continue; }
    if (/^\s*\d+\.\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*\d+\.\s+/, ''))}</li>`); out.push(`<ol>${items.join('')}</ol>`); continue; }
    if (!l.trim()) { i++; continue; }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,6}\s|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) para.push(inline(lines[i++]));
    out.push(`<p>${para.join('<br>')}</p>`);
  }
  return out.join('');
}

/* ---------- error explanations (by exception type, not by text matching) ---------- */
export function explainError(err){
  if (!err || !err.type) return null;
  const msg = err.message || '';
  const T = {
    IndentationError: ['インデント（字下げ）が揃っていません。ブロックの中はスペース4つで統一し、前の行との深さを確認してください。', 'indentation-error'],
    TabError: ['タブとスペースが混在しています。どちらか（通常はスペース4つ）に統一してください。', 'indentation-error'],
    SyntaxError: [/expected ':'/.test(msg) ? '行末のコロン（:）が抜けています。if・for・def・class などの行末に必要です。'
      : /Maybe you meant '=='/.test(msg) ? '比較には == を使います。= は代入です。' : '文法エラーです。表示された行とその直前の行で、括弧・引用符・コロンの閉じ忘れを確認してください。',
      /expected ':'/.test(msg) ? 'missing-colon' : /Maybe you meant '=='/.test(msg) ? 'eq-vs-assign' : null],
    UnboundLocalError: ['関数の中で代入している名前は、その関数のローカル変数として扱われます。外側の変数を書き換えたいなら global／nonlocal、または引数と戻り値を使います。', 'scope-misunderstanding'],
    NameError: ['未定義の名前を使っています。綴りの誤り、定義より前での使用、import 忘れ、またはカーネルのリセットで消えた変数を確認してください。', null],
    TypeError: [/NoneType/.test(msg) ? 'None に対して演算・呼び出しをしています。return を書き忘れた関数の戻り値などを確認してください。'
      : /not callable/.test(msg) ? '呼び出せない値を () で呼んでいます。組み込み関数名を変数で上書きしていないか確認してください。'
      : /concatenate|unsupported operand/.test(msg) ? '型の組み合わせが不正です。文字列と数値を混ぜていないか確認し、int() や str() で変換してください。' : '型が合っていません。引数の数や型を確認してください。',
      /NoneType/.test(msg) ? 'none-handling' : /not callable/.test(msg) ? 'builtin-shadow' : 'str-num-mix'],
    IndexError: ['範囲外の添字です。インデックスは 0 から len()-1 までです。', 'index-out-of-range'],
    KeyError: ['辞書に存在しないキーです。キーの綴りを確認するか、.get(キー, 既定値) を使ってください。', 'dict-missing-key'],
    ModuleNotFoundError: ['モジュールが見つかりません。名前の綴り、自作ファイルの場合はファイル名（.py を除いた名前）、外部ライブラリの場合はブラウザ版 Python（Pyodide）に収録されているかを確認してください（「環境・パッケージ」に対応状況があります）。', null],
    ImportError: ['import に失敗しました。モジュール内に指定した名前があるか、循環 import になっていないかを確認してください。', null],
    ZeroDivisionError: ['0 で割っています。除数が 0 になるケースを先に判定してください。', null],
    AttributeError: ['そのオブジェクトにその属性・メソッドはありません。型（type() で確認）と綴りを確認してください。None になっていないかも確認しましょう。', null],
    ValueError: ['値の内容が不適切です（例: int("abc")）。変換前の値を確認してください。', null],
    EOFError: ['input() が読む値がありません。Studio では「標準入力」欄に、input() 1回につき1行ずつ値を書いてから実行してください。', null],
    RecursionError: ['再帰が深すぎます（上限は既定で約1000段）。終了条件があるか、ループで書けないか確認してください。', null],
    MemoryError: ['メモリが足りません。ブラウザ版 Python は使えるメモリに上限があります。データを小さくしてください。', null],
    OverflowError: ['値が大きすぎて扱えません（ブラウザ版 Python は 32bit 環境のため、要素数などの上限が通常版より小さい場合があります）。', null],
    FileNotFoundError: ['ファイルが見つかりません。Studio のファイル一覧にある名前か、プログラムで先に作成したかを確認してください。', null],
    AssertionError: ['assert の条件が False でした。期待した値と実際の値を print して確かめてください。', null],
    KernelError: ['Python カーネル自体が停止しました。自動で再起動します（変数は失われます）。', null],
  };
  const hit = T[err.type]; if (!hit) return null;
  return { text: hit[0], mid: hit[1] };
}

/* ---------- coding task grading: output of the learner's code, plus hidden variants ---------- */
const norm = s => String(s ?? '').replace(/\r\n/g, '\n').split('\n').map(x => x.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
const stdoutOf = r => (r.segs || []).filter(s => s.s === 'out').map(s => s.t).join('');
export async function checkCodingAnswer(task, code, run){
  const first = await run(code);
  if (first.error) return { ok: false, first, reason: 'エラーが発生しました（' + first.error.type + '）', expect: task.expect, cases: 0 };
  if (norm(stdoutOf(first)) !== norm(task.expect)) return { ok: false, first, reason: '出力が期待と異なります', expect: task.expect, cases: 0 };
  let cases = 1;
  for (const v of task.variants || []) {
    if (!code.includes(v.replace[0])) return { ok: false, first, reason: `最初に与えられた行「${v.replace[0]}」は消さずに、その変数を使って計算してください（別の値でも正しく動くかを確認します）`, expect: null, cases };
    const r = await run(code.split(v.replace[0]).join(v.replace[1]));
    if (r.error || norm(stdoutOf(r)) !== norm(v.expect)) return { ok: false, first, reason: `別の入力（${v.replace[1]}）では期待どおりになりませんでした。値を直接書かず、変数から計算してください`, expect: v.expect, cases };
    cases++;
  }
  return { ok: true, first, cases };
}

/* ---------- .ipynb (nbformat 4) ---------- */
const lines = s => { const parts = String(s).split('\n'); return parts.map((p, i) => i < parts.length - 1 ? p + '\n' : p).filter((p, i) => !(i === parts.length - 1 && p === '')); };
const joinSrc = s => Array.isArray(s) ? s.join('') : String(s ?? '');
export function nbToIpynb(cells, meta){
  const nb = { cells: [], metadata: meta && typeof meta === 'object' ? meta : { kernelspec: { display_name: 'Python 3 (Pyodide)', language: 'python', name: 'python3' }, language_info: { name: 'python', version: '3.12' } }, nbformat: 4, nbformat_minor: 5 };
  cells.forEach((c, i) => {
    const extra = c.extra || {};
    const base = { cell_type: c.type, id: extra.id || ('cell-' + i), metadata: extra.metadata || {}, source: lines(c.source) };
    if (c.type === 'markdown' && extra.attachments) base.attachments = extra.attachments;
    if (c.type === 'code') {
      const outputs = []; const o = c.output;
      if (o) {
        for (const s of o.segs || []) {
          if (o.error && s.s === 'err' && o.error.text && s.t.includes(o.error.text)) { const pre = s.t.slice(0, s.t.indexOf(o.error.text)); if (pre) outputs.push({ output_type: 'stream', name: 'stderr', text: lines(pre) }); continue; }
          outputs.push({ output_type: 'stream', name: s.s === 'err' ? 'stderr' : 'stdout', text: lines(s.t) });
        }
        for (const img of o.images || []) outputs.push({ output_type: 'display_data', data: { 'image/png': img, 'text/plain': ['<Figure>'] }, metadata: {} });
        if (o.result != null) outputs.push({ output_type: 'execute_result', execution_count: c.count ?? null, data: { 'text/plain': lines(o.result) }, metadata: {} });
        if (o.error && o.error.type !== 'Interrupted') outputs.push({ output_type: 'error', ename: o.error.type, evalue: o.error.message || '', traceback: String(o.error.text || '').split('\n').filter(Boolean) });
      }
      Object.assign(base, { execution_count: c.count ?? null, outputs });
    }
    nb.cells.push(base);
  });
  return nb;
}
export function ipynbToNb(nb){
  if (!nb || typeof nb !== 'object' || !Array.isArray(nb.cells)) throw new Error('cells がありません（.ipynb 形式ではありません）');
  if (nb.nbformat != null && nb.nbformat < 4) throw new Error('nbformat ' + nb.nbformat + ' は未対応です（4 以降に対応）');
  const cells = nb.cells.map(c => {
    if (!c || typeof c !== 'object') throw new Error('不正なセルがあります');
    const type = c.cell_type === 'code' ? 'code' : c.cell_type === 'raw' ? 'raw' : 'markdown';
    const cell = { type, source: joinSrc(c.source) };
    const extra = {}; if (c.id) extra.id = c.id; if (c.metadata && Object.keys(c.metadata).length) extra.metadata = c.metadata; if (c.attachments) extra.attachments = c.attachments;
    if (Object.keys(extra).length) cell.extra = extra;
    if (type === 'code') {
      if (Number.isInteger(c.execution_count)) cell.count = c.execution_count;
      const o = { segs: [], images: [], result: null, error: null };
      for (const out of Array.isArray(c.outputs) ? c.outputs : []) {
        if (out.output_type === 'stream') o.segs.push({ s: out.name === 'stderr' ? 'err' : 'out', t: joinSrc(out.text) });
        else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
          const d = out.data || {};
          if (d['image/png']) o.images.push(joinSrc(d['image/png']).replace(/\s+/g, ''));
          else if (d['text/plain'] != null) { if (out.output_type === 'execute_result') o.result = joinSrc(d['text/plain']); else o.segs.push({ s: 'out', t: joinSrc(d['text/plain']) + '\n' }); }
        } else if (out.output_type === 'error') {
          // ANSI colour codes from IPython tracebacks are stripped for plain-text display
          const text = (Array.isArray(out.traceback) ? out.traceback.join('\n') : '').replace(/\u001b\[[0-9;]*m/g, '');
          o.error = { type: String(out.ename || 'Error'), message: String(out.evalue || ''), text: text + '\n' }; o.segs.push({ s: 'err', t: text + '\n' });
        }
      }
      if (o.segs.length || o.images.length || o.result != null || o.error) cell.output = o;
    }
    return cell;
  });
  return { cells: cells.length ? cells : normalizeNotebook(null), metadata: nb.metadata && typeof nb.metadata === 'object' ? nb.metadata : null };
}
