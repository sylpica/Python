"""lib/sim.js 監査修正 その1: 値の表示・数値・文字列・組み込み関数（CPython 3.12 と一致させる／分からないものは捏造しない）。
各置換対象は1回だけ存在することを検証してから適用する。"""
P = 'lib/sim.js'
s = open(P, encoding='utf-8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, (a[:90], s.count(a))
    s = s.replace(a, b)


# ---------- 値モデル: 使い切りイテレータ・未束縛ローカル ----------
sub("const TYPEVAL = (name) => ({ __type: name }); // type() の結果",
    "const TYPEVAL = (name) => ({ __type: name }); // type() の結果\n"
    "// zip / enumerate / map / filter / reversed の結果（一度読み切ると空になる。表示はアドレスを含むため不明扱い）\n"
    "const ITER = (a, kind) => ({ __iter: a, kind, used: false });\n"
    "const isIter = (v) => !!v && typeof v === 'object' && Array.isArray(v.__iter);\n"
    "// 関数内で代入される名前の「代入前」の状態（読むと UnboundLocalError）\n"
    "const UNBOUND = { __unbound: true };\n"
    "const SAFE = (n) => Number.isSafeInteger(n);\n"
    "const BIG = () => ({ __unk: true, desc: 'とても大きな整数（この説明では正確に計算しません）' });")
sub("  if (v && v.__type) return 'type';\n  return '不明';\n}",
    "  if (v && v.__type) return 'type';\n  if (isIter(v)) return v.kind;\n  return '不明';\n}")

# ---------- float の repr（CPython と同じ最短表現・指数の規則） ----------
sub("""function fmtNum(n) {
  if (!isNum(n)) return String(n);
  if (!n.f) return String(Math.trunc(n.v));
  if (Number.isInteger(n.v) && Math.abs(n.v) < 1e16) return n.v.toFixed(1); // Python の float は 3.0 のように出す
  return String(n.v);
}""", """function pyFloatRepr(x) {
  if (Number.isNaN(x)) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const neg = x < 0; const e1 = Math.abs(x).toExponential(); // 最短で往復できる桁（JS と Python は同じ桁を選ぶ）
  const [mant, expS] = e1.split('e'); const exp = parseInt(expS, 10); const digits = mant.replace('.', '');
  let out;
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) { const ip = digits.slice(0, exp + 1).padEnd(exp + 1, '0'); const fp = digits.slice(exp + 1); out = ip + '.' + (fp || '0'); }
    else out = '0.' + '0'.repeat(-exp - 1) + digits;
  } else out = digits[0] + (digits.length > 1 ? '.' + digits.slice(1) : '') + 'e' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  return (neg ? '-' : '') + out;
}
function fmtNum(n) {
  if (!isNum(n)) return String(n);
  if (!n.f) return String(Math.trunc(n.v));
  return pyFloatRepr(n.v);
}
// x の正確な10進値を、小数 p 桁に「偶数丸め」する（Python の round / 書式 f と同じ規則）。文字列を返す
function decFixed(x, p) {
  const neg = x < 0 || Object.is(x, -0); const ax = Math.abs(x);
  const exact = ax.toFixed(Math.min(100, p + 60)); // 2進数の正確な値（ほぼ全ての値で末尾まで正確）
  const [ip, fp0] = exact.split('.'); const fp = fp0 || '';
  let keep = (ip + fp.slice(0, p)).split('').map(Number); const rest = fp.slice(p);
  const first = rest ? Number(rest[0]) : 0; const tail = rest.slice(1);
  let up = first > 5 || (first === 5 && /[1-9]/.test(tail)) || (first === 5 && !/[1-9]/.test(tail) && keep.length && keep[keep.length - 1] % 2 === 1);
  if (up) { let i = keep.length - 1; while (i >= 0) { if (keep[i] === 9) { keep[i] = 0; i--; } else { keep[i]++; break; } } if (i < 0) keep.unshift(1); }
  const intLen = keep.length - p; const sInt = keep.slice(0, intLen).join('') || '0'; const sFrac = keep.slice(intLen).join('');
  const body = p > 0 ? sInt + '.' + sFrac : sInt;
  const isZero = !/[1-9]/.test(body);
  return (neg && !isZero ? '-' : (neg && isZero && x !== 0 ? '-' : '')) + body;
}""")

sub("  if (v && v.__range) return 'range(' + v.__range.map(fmtNum).join(', ') + ')';\n  return String(v);\n}",
    "  if (v && v.__range) { const r = v.rng || [0, v.__range.length, 1]; return 'range(' + r[0] + ', ' + r[1] + (r[2] !== 1 ? ', ' + r[2] : '') + ')'; }\n"
    "  if (isIter(v)) return '（' + v.kind + ' オブジェクト）';\n"
    "  return '（実行時に決まる値）'; // 表示できない内部の値は出さない\n}")

# ハッシュできない値（集合の要素・辞書のキー）
sub("function dictKeyId(v) {\n  if (isNum(v)) return 'n:' + v.v;",
    "function dictKeyId(v) {\n  if (isNum(v)) return 'n:' + (v.v === 0 ? 0 : v.v);")

# ---------- 字句: 0x/0o/0b、三連引用符（複数行） ----------
sub("    if (isDigit(c) || (c === '.' && isDigit(text[i + 1] || ''))) {",
    "    if (c === '0' && /[xXoObB]/.test(text[i + 1] || '')) {\n"
    "      const base = { x: 16, o: 8, b: 2 }[text[i + 1].toLowerCase()]; let j = i + 2;\n"
    "      while (j < text.length && /[0-9a-fA-F_]/.test(text[j])) j++;\n"
    "      const v = parseInt(text.slice(i + 2, j).replace(/_/g, ''), base);\n"
    "      if (Number.isNaN(v)) throw new SimDiag(lineNo, 'SyntaxError', '数値の書き方が正しくありません', '');\n"
    "      toks.push({ t: 'NUM', v, f: false, line: lineNo }); i = j; continue;\n"
    "    }\n"
    "    if (isDigit(c) || (c === '.' && isDigit(text[i + 1] || ''))) {")
sub("      const q = prefix ? text[i + 1] : c;\n      let j = prefix ? i + 2 : i + 1;\n      let val = '';",
    "      const q = prefix ? text[i + 1] : c;\n      let j = prefix ? i + 2 : i + 1;\n      let val = '';\n"
    "      if (text.substr(j - 1, 3) === q + q + q) { // 三連引用符\n"
    "        const close = text.indexOf(q + q + q, j + 2);\n"
    "        if (close < 0) throw new SimDiag(lineNo, 'SyntaxError', '三連引用符の文字列が閉じられていません', '\"\"\" または \\'\\'\\' で閉じてください');\n"
    "        let raw = text.slice(j + 2, close);\n"
    "        if (prefix !== 'r') raw = raw.replace(/\\\\(.)/g, (m0, e) => e === 'n' ? '\\n' : e === 't' ? '\\t' : e === '\\\\' ? '\\\\' : e === \"'\" ? \"'\" : e === '\"' ? '\"' : '\\\\' + e);\n"
    "        toks.push({ t: 'STR', v: raw, f: prefix === 'f', line: lineNo }); i = close + 3; continue;\n"
    "      }")

# 複数行にまたがる三連引用符を論理行にまとめる（中身の改行と行頭空白は保つ）
sub("""  let buf = null; // {line, indent, parts:[]}
  for (let li = 0; li < rawLines.length; li++) {
    const raw = rawLines[li];
    let i = 0, inStr = null, esc = false, commentAt = -1, triple = null;""",
    """  let buf = null; // {line, indent, parts:[]}
  let carry = null; // 前の行から続く三連引用符
  for (let li = 0; li < rawLines.length; li++) {
    const raw = rawLines[li];
    const startedInTriple = carry !== null;
    let i = 0, inStr = null, esc = false, commentAt = -1, triple = carry;""")
sub("""    if (triple) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '三連引用符の文字列が閉じられていません', fix: '""" + '"""' + """ または \\'\\'\\' で閉じてください' }); continue; }
    const code = commentAt >= 0 ? raw.slice(0, commentAt) : raw;
    if (!buf) {
      let ind = 0, j = 0;
      while (j < code.length && (code[j] === ' ' || code[j] === '\\t')) { ind += code[j] === '\\t' ? 4 : 1; j++; }
      buf = { line: li + 1, indent: ind, parts: [] };
    }
    buf.parts.push(code.trim());
    if (depth <= 0) {
      const text = buf.parts.join(' ');
      if (text) out.push({ line: buf.line, indent: buf.indent, text });
      buf = null; depth = 0;
    }
  }
  if (buf && buf.parts.join(' ').trim()) out.push({ line: buf.line, indent: buf.indent, text: buf.parts.join(' ') });""",
    """    carry = triple;
    const code = commentAt >= 0 ? raw.slice(0, commentAt) : raw;
    if (!buf) {
      let ind = 0, j = 0;
      while (j < code.length && (code[j] === ' ' || code[j] === '\\t')) { ind += code[j] === '\\t' ? 4 : 1; j++; }
      buf = { line: li + 1, indent: ind, parts: [] };
    }
    let piece = startedInTriple ? code : code.replace(/^\\s+/, '');
    if (!triple) piece = piece.replace(/\\s+$/, '');
    buf.parts.push({ s: piece, nl: startedInTriple });
    if (depth <= 0 && !triple) {
      const text = joinParts(buf.parts);
      if (text.trim()) out.push({ line: buf.line, indent: buf.indent, text });
      buf = null; depth = 0;
    }
  }
  if (carry && buf) diags.push({ line: buf.line, level: 'error', kind: 'SyntaxError', msg: '三連引用符の文字列が閉じられていません', fix: '""" + '"""' + """ または \\'\\'\\' で閉じてください' });
  else if (buf && joinParts(buf.parts).trim()) out.push({ line: buf.line, indent: buf.indent, text: joinParts(buf.parts) });""")
sub("/* 行内トークナイザ：1論理行の text をトークン列にする */",
    "function joinParts(parts) { return parts.map((p, k) => k === 0 ? p.s : (p.nl ? '\\n' : ' ') + p.s).join(''); }\n/* 行内トークナイザ：1論理行の text をトークン列にする */")

# ---------- f文字列: !r / !s / = （自己説明） ----------
sub("""      let exprText = inner, fmt = null;
      const colonAt = findFmtColon(inner);
      if (colonAt >= 0) { exprText = inner.slice(0, colonAt); fmt = inner.slice(colonAt + 1); }
      if (exprText.endsWith('=')) exprText = exprText.slice(0, -1);
      const sub = new TC(lexText(exprText.trim(), line));
      const e = parseExpr(sub, line);
      parts.push({ e, fmt });""",
    """      let exprText = inner, fmt = null, conv = null, doc = null;
      const colonAt = findFmtColon(inner);
      if (colonAt >= 0) { exprText = inner.slice(0, colonAt); fmt = inner.slice(colonAt + 1); }
      const cm = /!([rsa])\\s*$/.exec(exprText);
      if (cm) { conv = cm[1]; exprText = exprText.slice(0, cm.index); }
      if (/=\\s*$/.test(exprText) && !/[=!<>]=\\s*$/.test(exprText)) { doc = exprText; exprText = exprText.replace(/=\\s*$/, ''); }
      const sub = new TC(lexText(exprText.trim(), line));
      const e = parseExpr(sub, line);
      parts.push({ e, fmt, conv, doc });""")
sub("""        const v = this.eval(p.e, env);
        if (isUnk(v)) { hasUnk = true; out += '（実行時に決まる値）'; continue; }
        out += fmtSpec(v, p.fmt);""",
    """        const v = this.eval(p.e, env);
        if (p.doc) out += p.doc;
        if (isUnk(v) || isIter(v)) { hasUnk = true; out += '（実行時に決まる値）'; continue; }
        let base = v;
        if (p.conv === 'r' || p.conv === 'a' || (p.doc && !p.fmt && !p.conv)) base = reprVal(v);
        else if (p.conv === 's') base = strVal(v);
        const fs = fmtSpec(base, p.fmt);
        if (fs === null) { hasUnk = true; out += '（実行時に決まる値）'; this.diag(n.line, 'note', '対応外', '書式指定「' + p.fmt + '」はこの説明では扱いません。その部分は「実行時に決まる値」として示します', ''); continue; }
        out += fs;""")

# ---------- 書式指定ミニ言語（扱えない指定は null = 不明） ----------
start = s.index('function fmtSpec(v, fmt) {')
end = s.index('/* ============ 入口 ============ */')
s = s[:start] + r"""function padTo(s, fill, align, width) {
  const len = [...s].length; if (len >= width) return s; const n = width - len;
  if (align === '<') return s + fill.repeat(n);
  if (align === '^') { const l = Math.floor(n / 2); return fill.repeat(l) + s + fill.repeat(n - l); }
  return fill.repeat(n) + s;
}
function groupDigits(intPart, g) { return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, g); }
// Python の書式指定（format spec）。扱えない組み合わせは null（＝実行時に決まる値として示す）を返す
function fmtSpec(v, fmt) {
  if (fmt === null || fmt === undefined || fmt === '') return strVal(v);
  const m = /^(?:([\s\S])?([<>^=]))?([+\- ]?)(#?)(0?)(\d*)([,_]?)(?:\.(\d+))?([bcdeEfFgGnosxX%]?)$/.exec(fmt);
  if (!m) return null;
  let [, fill, align, sign, alt, zero, width, group, prec, type] = m;
  if (fill !== undefined && align === undefined) { fill = undefined; }
  if (!fill) fill = zero && !align ? '0' : ' ';
  if (zero && !align) align = '=';
  width = width ? parseInt(width, 10) : 0; prec = prec !== undefined ? parseInt(prec, 10) : null;
  if (typeof v === 'string') {
    if ((type && type !== 's') || sign || group || alt || align === '=') return null;
    const body = prec !== null ? [...v].slice(0, prec).join('') : v;
    return padTo(body, fill, align || '<', width);
  }
  if (!isNum(v)) return null; // bool・リストなどの書式は扱わない
  const x = v.v; if (!Number.isFinite(x)) return null;
  const neg = x < 0 || (v.f && Object.is(x, -0)); const ax = Math.abs(x);
  let body;
  if (!type) { if (prec !== null) return null; body = v.f ? pyFloatRepr(ax) : String(ax); }
  else if (type === 'd' || type === 'n') { if (v.f || prec !== null) return null; body = String(ax); }
  else if (type === 'f' || type === 'F' || type === '%') { const p = prec === null ? 6 : prec; body = decFixed(type === '%' ? ax * 100 : ax, p).replace(/^-/, '') + (type === '%' ? '%' : ''); }
  else if (type === 'e' || type === 'E') { const p = prec === null ? 6 : prec; body = ax.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') body = body.toUpperCase(); }
  else if ('bxXo'.includes(type)) { if (v.f || prec !== null) return null; const base = { b: 2, o: 8, x: 16, X: 16 }[type]; body = ax.toString(base); if (type === 'X') body = body.toUpperCase(); if (alt) body = '0' + (type === 'X' ? 'X' : type) + body; }
  else return null;
  if (group) { const at = body.search(/[.e%]/); const ip = at < 0 ? body : body.slice(0, at); body = groupDigits(ip, group) + (at < 0 ? '' : body.slice(at)); }
  const signStr = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
  const a = align || '>';
  if (a === '=') return signStr + padTo(body, fill, '>', Math.max(0, width - signStr.length));
  return padTo(signStr + body, fill, a, width);
}

""" + s[end:]

open(P, 'w', encoding='utf-8').write(s)
print('sim-fix-1 applied')
