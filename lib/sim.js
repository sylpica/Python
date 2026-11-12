/* sim.js — Python コード説明エンジン（実行シミュレーション）
   コードを実行せず、字句解析→構文解析→部分評価で「何が起きるか」を日本語で説明する。
   決定的な値はエンジン自身が計算した実値のみ。input()・random・ファイル内容など
   実物依存の値は「実行時に決まる値」として伝播させ、数値を捏造しない。
   対応外の構文は診断として正直に示し、説明を捏造しない。
   ブラウザ（window.PySim）と Node（module.exports）の両方で動く。 */
'use strict';

/* ============ 値モデル ============ */
const UNK = (desc) => ({ __unk: true, desc: desc || '実行時に決まる値' });
const isUnk = (v) => !!v && typeof v === 'object' && v.__unk === true;
// 数値は {__num:true, v:Number, f:boolean(floatか)} で表す（int/float の区別を保つ）
const NUM = (v, f) => ({ __num: true, v, f: !!f });
const isNum = (v) => !!v && typeof v === 'object' && v.__num === true;
const BOOL = (b) => ({ __bool: true, v: !!b });
const isBool = (v) => !!v && typeof v === 'object' && v.__bool === true;
const NONE = { __none: true };
const isNone = (v) => v === NONE;
// リスト {__list:[...]} / タプル {__tuple:[...]} / 辞書 {__dict:Map} / 集合 {__set:[...]}
const LIST = (a) => ({ __list: a || [] });
const isList = (v) => !!v && typeof v === 'object' && Array.isArray(v.__list);
const TUPLE = (a) => ({ __tuple: a || [] });
const isTuple = (v) => !!v && typeof v === 'object' && Array.isArray(v.__tuple);
const DICT = (m) => ({ __dict: m || new Map() });
const isDict = (v) => !!v && typeof v === 'object' && v.__dict instanceof Map;
const SET = (a) => ({ __set: a || [] });
const isSet = (v) => !!v && typeof v === 'object' && Array.isArray(v.__set);
const FUNC = (def, env) => ({ __func: true, def, env });
const isFunc = (v) => !!v && typeof v === 'object' && v.__func === true;
const BUILTIN = (name) => ({ __builtin: name });
const RANGE = (a) => ({ __range: a }); // a = [数値...]（遅延せず実配列で持つ。上限あり）
const TYPEVAL = (name) => ({ __type: name }); // type() の結果
// zip / enumerate / map / filter / reversed の結果（一度読み切ると空になる。表示はアドレスを含むため不明扱い）
const ITER = (a, kind) => ({ __iter: a, kind, used: false });
const isIter = (v) => !!v && typeof v === 'object' && Array.isArray(v.__iter);
const VIEW = (d, which) => ({ __view: d, which });
const isView = (v) => !!v && typeof v === 'object' && v.__view !== undefined;
function viewItems(v) { const out = []; for (const e of v.__view.__dict.values()) out.push(v.which === 'keys' ? e.k : v.which === 'values' ? e.v : TUPLE([e.k, e.v])); return out; }
// 関数内で代入される名前の「代入前」の状態（読むと UnboundLocalError）
const UNBOUND = { __unbound: true };
const SAFE = (n) => Number.isSafeInteger(n);
const BIG = () => ({ __unk: true, desc: 'とても大きな整数・この説明では正確に計算しません' });

function typeName(v) {
  if (isUnk(v)) return '不明';
  if (isNum(v)) return v.f ? 'float' : 'int';
  if (isBool(v)) return 'bool';
  if (isNone(v)) return 'NoneType';
  if (typeof v === 'string') return 'str';
  if (isList(v)) return 'list';
  if (isTuple(v)) return 'tuple';
  if (isDict(v)) return 'dict';
  if (isSet(v)) return 'set';
  if (isFunc(v) || v && v.__builtin) return 'function';
  if (v && v.__range) return 'range';
  if (v && v.__type) return 'type';
  if (isIter(v)) return v.kind;
  if (isView(v)) return 'dict_' + v.which;
  return '不明';
}
function truthy(v) {
  if (isUnk(v)) return null; // 判定できない
  if (isBool(v)) return v.v;
  if (isNone(v)) return false;
  if (isNum(v)) return v.v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (isList(v)) return v.__list.length > 0;
  if (isTuple(v)) return v.__tuple.length > 0;
  if (isDict(v)) return v.__dict.size > 0;
  if (isSet(v)) return v.__set.length > 0;
  return true;
}
function pyFloatRepr(x) {
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
}
function reprVal(v, depth) {
  depth = depth || 0;
  if (isUnk(v)) return '（' + v.desc + '）';
  if (isNum(v)) return fmtNum(v);
  if (isBool(v)) return v.v ? 'True' : 'False';
  if (isNone(v)) return 'None';
  if (typeof v === 'string') return pyStrRepr(v);
  if (depth > 3) return '…';
  if (isList(v)) return '[' + v.__list.map(x => reprVal(x, depth + 1)).join(', ') + ']';
  if (isTuple(v)) return v.__tuple.length === 1 ? '(' + reprVal(v.__tuple[0], depth + 1) + ',)' : '(' + v.__tuple.map(x => reprVal(x, depth + 1)).join(', ') + ')';
  if (isDict(v)) { const ps = []; for (const e of v.__dict.values()) ps.push(reprVal(e.k, depth + 1) + ': ' + reprVal(e.v, depth + 1)); return '{' + ps.join(', ') + '}'; }
  if (isSet(v)) return v.__set.length ? '{' + v.__set.map(x => reprVal(x, depth + 1)).join(', ') + '}' : 'set()';
  if (v && v.__type) return "<class '" + v.__type + "'>";
  if (isFunc(v)) return '関数 ' + v.def.name;
  if (v && v.__builtin) return '組み込み関数 ' + v.__builtin;
  if (v && v.__range) { const r = v.rng || [0, v.__range.length, 1]; return 'range(' + r[0] + ', ' + r[1] + (r[2] !== 1 ? ', ' + r[2] : '') + ')'; }
  if (isIter(v)) return '（' + v.kind + ' オブジェクト）';
  if (isView(v)) return 'dict_' + v.which + '(' + reprVal(LIST(viewItems(v)), depth) + ')';
  return '（実行時に決まる値）'; // 表示できない内部の値は出さない
}
// Python の str の repr（' を含み " を含まなければ " で囲む。制御文字はエスケープ）
function pyStrRepr(v) {
  const q = v.includes("'") && !v.includes('"') ? '"' : "'";
  let out = '';
  for (const ch of v) {
    const c = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === q) out += '\\' + q;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0');
    else out += ch;
  }
  return q + out + q;
}
function strVal(v) { // print / str() 用：文字列はそのまま、それ以外は repr とほぼ同じ
  if (typeof v === 'string') return v;
  if (isUnk(v)) return '（' + v.desc + '）';
  return reprVal(v);
}
function eqVal(a, b) {
  if (isUnk(a) || isUnk(b)) return null;
  if (isNum(a) && isNum(b)) return a.v === b.v;
  if (isBool(a) && isBool(b)) return a.v === b.v;
  if (isBool(a) && isNum(b)) return (a.v ? 1 : 0) === b.v;
  if (isNum(a) && isBool(b)) return a.v === (b.v ? 1 : 0);
  if (isNone(a) || isNone(b)) return a === b;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  if (isList(a) && isList(b)) return a.__list.length === b.__list.length && a.__list.every((x, i) => eqVal(x, b.__list[i]) === true);
  if (isTuple(a) && isTuple(b)) return a.__tuple.length === b.__tuple.length && a.__tuple.every((x, i) => eqVal(x, b.__tuple[i]) === true);
  if (isDict(a) && isDict(b)) {
    if (a.__dict.size !== b.__dict.size) return false;
    for (const e of a.__dict.values()) { const bv = dictGet(b, e.k); if (bv === undefined) return false; const r = eqVal(e.v, bv); if (r !== true) return r; }
    return true;
  }
  if (isSet(a) && isSet(b)) return a.__set.length === b.__set.length && a.__set.every(x => b.__set.some(y => eqVal(x, y) === true));
  const tn = (x) => x && x.__type ? x.__type : x && x.__builtin && ['int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set'].includes(x.__builtin) ? x.__builtin : null;
  if (tn(a) && tn(b)) return tn(a) === tn(b);
  return a === b;
}
function dictKeyId(v) {
  if (isNum(v)) return 'n:' + (v.v === 0 ? 0 : v.v);
  if (isBool(v)) return 'b:' + v.v;
  if (typeof v === 'string') return 's:' + v;
  if (isNone(v)) return 'z:';
  if (isTuple(v)) return 't:' + v.__tuple.map(dictKeyId).join('|');
  return null; // ハッシュ化できない
}
function dictGet(d, k) { const id = dictKeyId(k); if (id === null) return undefined; return d.__dict.get(id)?.v; }
function dictSet(d, k, v) { const id = dictKeyId(k); if (id === null) return false; d.__dict.set(id, { k, v }); return true; }

/* ============ 字句解析：論理行への分割 ============ */
class SimDiag extends Error { constructor(line, kind, msg, fix) { super(msg); this.line = line; this.kind = kind; this.fix = fix || ''; } }

// ソースを論理行 [{line, indent, text}] に分ける。括弧内の改行は1行に結合する。
function splitLines(src) {
  const diags = [];
  const rawLines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let depth = 0; const stack = [];
  let buf = null; // {line, indent, parts:[]}
  let carry = null; // 前の行から続く三連引用符
  for (let li = 0; li < rawLines.length; li++) {
    const raw = rawLines[li];
    const startedInTriple = carry !== null;
    let i = 0, inStr = null, esc = false, commentAt = -1, triple = carry;
    for (; i < raw.length; i++) {
      const c = raw[i];
      if (esc) { esc = false; continue; }
      if (triple) { if (raw.substr(i, 3) === triple) { i += 2; triple = null; } continue; }
      if (inStr) { if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") {
        if (raw.substr(i, 3) === c + c + c) { triple = c + c + c; i += 2; continue; }
        inStr = c; continue;
      }
      if (c === '#') { commentAt = i; break; }
      if (c === '(' || c === '[' || c === '{') { depth++; stack.push({ c, line: li + 1 }); }
      if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth < 0) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '閉じ括弧「' + c + '」に対応する開き括弧がありません', fix: '括弧の対応を確認してください' }); depth = 0; }
        else stack.pop();
      }
    }
    if (inStr) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '文字列が閉じられていません（引用符 ' + inStr + ' が不足）', fix: '行末に ' + inStr + ' を足してください' }); continue; }
    carry = triple;
    const code = commentAt >= 0 ? raw.slice(0, commentAt) : raw;
    if (!buf) {
      let ind = 0, j = 0;
      while (j < code.length && (code[j] === ' ' || code[j] === '\t')) { ind += code[j] === '\t' ? 4 : 1; j++; }
      buf = { line: li + 1, indent: ind, parts: [] };
    }
    let piece = startedInTriple ? code : code.replace(/^\s+/, '');
    if (!triple) piece = piece.replace(/\s+$/, '');
    buf.parts.push({ s: piece, nl: startedInTriple });
    if (depth <= 0 && !triple) {
      const text = joinParts(buf.parts);
      if (text.trim()) out.push({ line: buf.line, indent: buf.indent, text });
      buf = null; depth = 0;
    }
  }
  if (carry && buf) diags.push({ line: buf.line, level: 'error', kind: 'SyntaxError', msg: '三連引用符の文字列が閉じられていません', fix: '""" または \'\'\' で閉じてください' });
  else if (buf && joinParts(buf.parts).trim()) out.push({ line: buf.line, indent: buf.indent, text: joinParts(buf.parts) });
  if (stack.length) { const b = stack[stack.length - 1]; diags.push({ line: b.line, level: 'error', kind: 'SyntaxError', msg: '括弧「' + b.c + '」が閉じられていません', fix: '対応する閉じ括弧を足してください' }); }
  return { lines: out, diags };
}

function joinParts(parts) { return parts.map((p, k) => k === 0 ? p.s : (p.nl ? '\n' : ' ') + p.s).join(''); }
/* 行内トークナイザ：1論理行の text をトークン列にする */
function lexText(text, lineNo) {
  const toks = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isNameS = (c) => /[A-Za-z_ぁ-んァ-ヶ一-龠]/.test(c);
  const isNameC = (c) => /[A-Za-z0-9_ぁ-んァ-ヶ一-龠]/.test(c);
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    // 文字列（f文字列・r文字列の接頭辞つき）
    let prefix = '';
    if ((c === 'f' || c === 'F' || c === 'r' || c === 'R') && (text[i + 1] === '"' || text[i + 1] === "'")) prefix = c.toLowerCase();
    if (c === '"' || c === "'" || prefix) {
      const q = prefix ? text[i + 1] : c;
      let j = prefix ? i + 2 : i + 1;
      let val = '';
      if (text.substr(j - 1, 3) === q + q + q) { // 三連引用符
        const close = text.indexOf(q + q + q, j + 2);
        if (close < 0) throw new SimDiag(lineNo, 'SyntaxError', '三連引用符の文字列が閉じられていません', '""" または \'\'\' で閉じてください');
        let raw = text.slice(j + 2, close);
        if (prefix !== 'r') raw = raw.replace(/\\(.)/g, (m0, e) => e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === "'" ? "'" : e === '"' ? '"' : '\\' + e);
        toks.push({ t: 'STR', v: raw, f: prefix === 'f', line: lineNo }); i = close + 3; continue;
      }
      while (j < text.length && text[j] !== q) {
        if (text[j] === '\\' && j + 1 < text.length) {
          const e = text[j + 1];
          if (prefix === 'r') { val += '\\' + e; j += 2; continue; }
          val += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === "'" ? "'" : e === '"' ? '"' : '\\' + e;
          j += 2; continue;
        }
        val += text[j]; j++;
      }
      if (j >= text.length) throw new SimDiag(lineNo, 'SyntaxError', '文字列が閉じられていません', '引用符 ' + q + ' を足してください');
      toks.push({ t: 'STR', v: val, f: prefix === 'f', line: lineNo });
      i = j + 1; continue;
    }
    if (c === '0' && /[xXoObB]/.test(text[i + 1] || '')) {
      const base = { x: 16, o: 8, b: 2 }[text[i + 1].toLowerCase()]; let j = i + 2;
      while (j < text.length && /[0-9a-fA-F_]/.test(text[j])) j++;
      const v = parseInt(text.slice(i + 2, j).replace(/_/g, ''), base);
      if (Number.isNaN(v)) throw new SimDiag(lineNo, 'SyntaxError', '数値の書き方が正しくありません', '');
      toks.push({ t: 'NUM', v, f: false, line: lineNo }); i = j; continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(text[i + 1] || ''))) {
      let j = i, isF = false;
      while (j < text.length && (isDigit(text[j]) || text[j] === '_')) j++;
      if (text[j] === '.') { isF = true; j++; while (j < text.length && isDigit(text[j])) j++; }
      if (text[j] === 'e' || text[j] === 'E') { isF = true; j++; if (text[j] === '+' || text[j] === '-') j++; while (j < text.length && isDigit(text[j])) j++; }
      const raw = text.slice(i, j).replace(/_/g, '');
      toks.push({ t: 'NUM', v: parseFloat(raw), f: isF, line: lineNo });
      i = j; continue;
    }
    if (isNameS(c)) {
      let j = i;
      while (j < text.length && isNameC(text[j])) j++;
      toks.push({ t: 'NAME', v: text.slice(i, j), line: lineNo });
      i = j; continue;
    }
    const three = text.substr(i, 3), two = text.substr(i, 2);
    if (three === '**=' || three === '//=') { toks.push({ t: 'OP', v: three, line: lineNo }); i += 3; continue; }
    if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**', '//', '->', ':='].includes(two)) { toks.push({ t: 'OP', v: two, line: lineNo }); i += 2; continue; }
    if ('+-*/%()[]{},:.;=<>@&|^~'.includes(c)) { toks.push({ t: 'OP', v: c, line: lineNo }); i++; continue; }
    throw new SimDiag(lineNo, 'SyntaxError', '解釈できない文字「' + c + '」があります', '半角の記号で書かれているか確認してください');
  }
  toks.push({ t: 'END', line: lineNo });
  return toks;
}

/* ============ 構文解析 ============ */
class TC { // トークンカーソル
  constructor(toks) { this.toks = toks; this.i = 0; }
  peek(k) { return this.toks[Math.min(this.i + (k || 0), this.toks.length - 1)]; }
  next() { return this.toks[this.i++]; }
  atEnd() { return this.peek().t === 'END'; }
  isOp(v) { const t = this.peek(); return t.t === 'OP' && t.v === v; }
  isName(v) { const t = this.peek(); return t.t === 'NAME' && t.v === v; }
  eatOp(v) { if (this.isOp(v)) { this.i++; return true; } return false; }
  expectOp(v, line) { if (!this.eatOp(v)) throw new SimDiag(line, 'SyntaxError', '「' + v + '」が来るはずの場所に別のものがあります', '記号の書き方を確認してください'); }
}

const KEYWORDS = ['if', 'elif', 'else', 'for', 'while', 'def', 'return', 'break', 'continue', 'pass', 'import', 'from', 'as', 'and', 'or', 'not', 'in', 'is', 'class', 'try', 'except', 'finally', 'with', 'lambda', 'global', 'nonlocal', 'raise', 'yield', 'assert', 'del', 'async', 'await', 'True', 'False', 'None'];

function parseProgram(lines) {
  const r = parseBlock(lines, 0, -1);
  return r.stmts;
}
function parseBlock(lines, start, parentIndent) {
  const stmts = [];
  let i = start;
  let myIndent = null;
  while (i < lines.length) {
    const L = lines[i];
    if (L.indent <= parentIndent) break;
    if (myIndent === null) myIndent = L.indent;
    if (L.indent < myIndent) break;
    if (L.indent > myIndent) throw new SimDiag(L.line, 'IndentationError', 'インデントが想定より深くなっています', '行頭の空白の数を、周りの行と揃えてください');
    const s = parseStatement(lines, i, myIndent);
    stmts.push(...s.stmts);
    i = s.next;
  }
  return { stmts, next: i };
}
// 複合文の本体：次行ブロック or 同一行の「: 文」
function parseSuite(lines, i, headerIndent, tc, lineNo) {
  if (tc && !tc.atEnd()) { // 同一行スイート
    const body = parseSimpleStmts(tc, lineNo);
    return { body, next: i + 1 };
  }
  if (i + 1 >= lines.length || lines[i + 1].indent <= headerIndent)
    throw new SimDiag(lineNo, 'IndentationError', '「:」のあとに、インデントした文が必要です', '次の行を空白4つで字下げしてください');
  const r = parseBlock(lines, i + 1, headerIndent);
  return { body: r.stmts, next: r.next };
}
function parseStatement(lines, i, indent) {
  const L = lines[i];
  const toks = lexText(L.text, L.line);
  const tc = new TC(toks);
  const t0 = tc.peek();
  if (t0.t === 'NAME') {
    if (t0.v === 'def') return parseDef(lines, i, indent, tc);
    if (t0.v === 'if') return parseIf(lines, i, indent, tc);
    if (t0.v === 'for') return parseFor(lines, i, indent, tc);
    if (t0.v === 'while') return parseWhile(lines, i, indent, tc);
    const skipped = (what, nx) => { const r = namesInLines(lines, i, nx); return { stmts: [{ k: 'unsupported', what, line: L.line, names: r.names, prints: r.prints, returns: r.returns }], next: nx }; };
    if (t0.v === 'class') return skipped('クラス定義（class）', skipBlock(lines, i, indent));
    if (t0.v === 'try') {
      let nx = skipBlock(lines, i, indent);
      while (nx < lines.length && lines[nx].indent === indent && /^(except|finally|else)\b/.test(lines[nx].text)) nx = skipBlock(lines, nx, indent);
      return skipped('例外処理（try）', nx);
    }
    if (t0.v === 'async') return skipped('非同期（async）', skipBlock(lines, i, indent));
    if (t0.v === 'with') return skipped('with 文', skipBlock(lines, i, indent));
    if (t0.v === 'match' && /^match\s+.+:\s*$/.test(L.text)) return skipped('match 文', skipBlock(lines, i, indent));
    if (t0.v === 'import' || t0.v === 'from') return { stmts: [{ k: 'import', text: L.text, line: L.line }], next: i + 1 };
    if (t0.v === 'elif' || t0.v === 'else') throw new SimDiag(L.line, 'SyntaxError', '「' + t0.v + '」に対応する if がありません', 'if と同じ深さのインデントで書いてください');
  }
  if (t0.t === 'OP' && t0.v === '@') { tc.next(); return { stmts: [{ k: 'decorator', expr: parseExpr(tc, L.line), line: L.line }], next: i + 1 }; }
  const ss = parseSimpleStmts(tc, L.line);
  return { stmts: ss, next: i + 1 };
}
// import 文で使えるようになる名前（as の別名・複数指定に対応）
function importNames(text) {
  const t = text.trim(); let m;
  if ((m = /^from\s+\S+\s+import\s+\(?(.+?)\)?\s*$/.exec(t))) return m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop().trim()).filter(x => /^\w+$/.test(x));
  if ((m = /^import\s+(.+)$/.exec(t))) return m[1].split(',').map(x => { const p = x.trim().split(/\s+as\s+/); return p.length > 1 ? p[1].trim() : p[0].trim().split('.')[0]; }).filter(x => /^\w+$/.test(x));
  return [];
}
function namesInLines(lines, from, to) {
  const names = new Set(); let prints = false, returns = false;
  for (let k = from; k < to; k++) {
    const t = lines[k].text;
    if (/\bprint\s*\(/.test(t)) prints = true;
    let m;
    if ((m = /^(?:async\s+)?(?:class|def)\s+(\w+)/.exec(t))) names.add(m[1]);
    if (/^return\b/.test(t)) returns = true;
    if ((m = /^for\s+([\w\s,*()]+?)\s+in\b/.exec(t))) m[1].split(/[\s,()*]+/).filter(Boolean).forEach(n => names.add(n));
    if ((m = /\bas\s+(\w+)\s*:?\s*$/.exec(t))) names.add(m[1]);
    if (/^(?:import|from)\s/.test(t)) importNames(t).forEach(n => names.add(n));
    if ((m = /^([\w\s,*()]+?)\s*(?::[^=]+)?(?:[+\-*/%]|\/\/|\*\*)?=(?!=)/.exec(t))) m[1].split(/[\s,()*]+/).filter(n => /^[A-Za-z_]\w*$/.test(n)).forEach(n => names.add(n));
  }
  return { names: [...names], prints, returns };
}
function skipBlock(lines, i, indent) {
  let j = i + 1;
  while (j < lines.length && lines[j].indent > indent) j++;
  return j;
}
function parseDef(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // def
  const nameTok = tc.next();
  if (nameTok.t !== 'NAME') throw new SimDiag(L.line, 'SyntaxError', '関数名が必要です', 'def のあとに名前を書いてください（例：def greet():）');
  tc.expectOp('(', L.line);
  const params = [];
  let seenStar = false;
  while (!tc.isOp(')')) {
    if (tc.isOp('/')) { tc.next(); if (!tc.eatOp(',')) break; continue; } // 位置専用の区切り
    let star = 0;
    if (tc.isOp('**')) { tc.next(); star = 2; seenStar = true; }
    else if (tc.isOp('*')) {
      tc.next(); star = 1; seenStar = true;
      if (tc.isOp(')') || tc.isOp(',')) { params.push({ name: null, bare: true }); if (!tc.eatOp(',')) break; continue; }
    }
    const p = tc.next();
    if (p.t !== 'NAME') throw new SimDiag(L.line, 'SyntaxError', '引数の名前が必要です', '');
    let ann = null;
    if (tc.isOp(':')) { tc.next(); ann = parseExpr(tc, L.line); } // 引数の型注釈（__annotations__ 用に保持）
    let def = null;
    if (tc.eatOp('=')) def = parseExpr(tc, L.line);
    params.push({ name: p.v, def, star, kwOnly: seenStar && star === 0, ann });
    if (!tc.eatOp(',')) break;
  }
  tc.expectOp(')', L.line);
  let retAnn = null;
  if (tc.isOp('->')) { tc.next(); retAnn = parseExpr(tc, L.line); } // 戻り値の型注釈（保持）
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  return { stmts: [{ k: 'def', name: nameTok.v, params, body: s.body, line: L.line, retAnn }], next: s.next };
}
function parseIf(lines, i, indent, tc) {
  const L = lines[i];
  const arms = [];
  let cur = i, curTc = tc, kw = 'if';
  let elseBody = null;
  while (true) {
    curTc.next(); // if / elif
    const cond = parseExpr(curTc, lines[cur].line);
    curTc.expectOp(':', lines[cur].line);
    const s = parseSuite(lines, cur, indent, curTc, lines[cur].line);
    arms.push({ cond, body: s.body, line: lines[cur].line, kw });
    cur = s.next;
    if (cur < lines.length && lines[cur].indent === indent) {
      const t2 = lexText(lines[cur].text, lines[cur].line);
      const tc2 = new TC(t2);
      if (tc2.isName('elif')) { curTc = tc2; kw = 'elif'; continue; }
      if (tc2.isName('else')) {
        tc2.next(); tc2.expectOp(':', lines[cur].line);
        const s2 = parseSuite(lines, cur, indent, tc2, lines[cur].line);
        elseBody = s2.body; cur = s2.next;
      }
    }
    break;
  }
  return { stmts: [{ k: 'if', arms, elseBody, line: L.line }], next: cur };
}
function parseFor(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // for
  const target = parseTarget(tc, L.line);
  if (!tc.isName('in')) throw new SimDiag(L.line, 'SyntaxError', 'for のあとには「in」が必要です', '例：for x in [1, 2, 3]:');
  tc.next();
  const iter = parseExpr(tc, L.line);
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  const el = parseLoopElse(lines, s.next, indent);
  return { stmts: [{ k: 'for', target, iter, body: s.body, elseBody: el.body, line: L.line }], next: el.next };
}
function parseWhile(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // while
  const cond = parseExpr(tc, L.line);
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  const el = parseLoopElse(lines, s.next, indent);
  return { stmts: [{ k: 'while', cond, body: s.body, elseBody: el.body, line: L.line }], next: el.next };
}
function parseLoopElse(lines, at, indent) {
  if (at < lines.length && lines[at].indent === indent) {
    const tc2 = new TC(lexText(lines[at].text, lines[at].line));
    if (tc2.isName('else')) { tc2.next(); tc2.expectOp(':', lines[at].line); const s2 = parseSuite(lines, at, indent, tc2, lines[at].line); return { body: s2.body, next: s2.next }; }
  }
  return { body: null, next: at };
}
function parseTargetItem(tc, line) {
  if (tc.isOp('*')) { tc.next(); return { k: 'starred', t: parsePostfix(tc, line, true), line }; }
  return parsePostfix(tc, line, true);
}
function parseTarget(tc, line) {
  // 代入・for のターゲット：名前 / タプル / 添字 / 星付き
  const first = parseTargetItem(tc, line);
  if (tc.isOp(',') || first.k === 'starred') {
    const items = [first];
    while (tc.eatOp(',')) { if (tc.isOp(':') || tc.isName('in') || tc.isOp('=') || tc.atEnd()) break; items.push(parseTargetItem(tc, line)); }
    return { k: 'ttuple', items, line };
  }
  return first;
}
function parseSimpleStmts(tc, line) {
  const out = [];
  while (!tc.atEnd()) {
    if (tc.eatOp(';')) continue;
    out.push(parseSimple(tc, line));
    if (!tc.atEnd() && !tc.isOp(';')) throw new SimDiag(line, 'SyntaxError', '文の終わり方が正しくありません', '1行に複数の文を書くときは「;」で区切ってください');
  }
  return out;
}
function parseSimple(tc, line) {
  const t = tc.peek();
  if (t.t === 'NAME') {
    if (t.v === 'return') { tc.next(); const e = tc.atEnd() || tc.isOp(';') ? null : parseExprList(tc, line); return { k: 'return', expr: e, line }; }
    if (t.v === 'break') { tc.next(); return { k: 'break', line }; }
    if (t.v === 'continue') { tc.next(); return { k: 'continue', line }; }
    if (t.v === 'pass') { tc.next(); return { k: 'pass', line }; }
    if (t.v === 'global' || t.v === 'nonlocal') { tc.next(); const names = []; while (!tc.atEnd() && !tc.isOp(';')) { const n = tc.next(); if (n.t === 'NAME') names.push(n.v); } return { k: 'global', kind: t.v, names, line }; }
    if (t.v === 'raise') { tc.next(); let e = null; if (!tc.atEnd() && !tc.isOp(';')) e = parseExpr(tc, line); while (!tc.atEnd() && !tc.isOp(';')) tc.next(); return { k: 'raise', e, line }; }
    if (t.v === 'del') { tc.next(); const targets = []; do { targets.push(parsePostfix(tc, line)); } while (tc.eatOp(',')); return { k: 'del', targets, line }; }
    if (t.v === 'import' || t.v === 'from') { const parts = []; while (!tc.atEnd() && !tc.isOp(';')) { const x = tc.next(); parts.push(x.v); } return { k: 'import', text: parts.join(' ').replace(/ \. /g, '.').replace(/ ,/g, ','), line }; }
    if (t.v === 'assert') { tc.next(); const e = parseExpr(tc, line); const msg = tc.eatOp(',') ? parseExpr(tc, line) : null; return { k: 'assert', e, msg, line }; }
  }
  // 代入か式か：ターゲットを試しに読んで = が来るか見る
  const save = tc.i;
  try {
    let tgt = parseTarget(tc, line);
    // 型注釈つき代入 x: int = 5（注釈は読み飛ばす）
    if (tgt.k === 'name' && tc.isOp(':')) { tc.next(); parseExpr(tc, line); }
    if (tc.isOp('=') || tc.isOp('+=') || tc.isOp('-=') || tc.isOp('*=') || tc.isOp('/=') || tc.isOp('//=') || tc.isOp('%=') || tc.isOp('**=')) {
      const op = tc.next().v;
      if (op === '=') {
        // 連鎖代入 a = b = 5：次のターゲットがさらに = を伴う間、ターゲットとして集める
        const targets = [tgt];
        while (true) {
          const sv = tc.i;
          try {
            const t2 = parseTarget(tc, line);
            if (tc.isOp('=')) { tc.next(); targets.push(t2); continue; }
          } catch (e) { /* ターゲットではない */ }
          tc.i = sv;
          break;
        }
        const rhs = parseExprList(tc, line);
        if (targets.length === 1) return { k: 'assign', target: tgt, expr: rhs, line };
        return { k: 'assignmulti', targets, expr: rhs, line };
      }
      const rhs = parseExprList(tc, line);
      return { k: 'aug', target: tgt, op: op.slice(0, -1), expr: rhs, line };
    }
  } catch (e) { /* 式として読み直す */ }
  tc.i = save;
  const e = parseExpr(tc, line);
  return { k: 'expr', expr: e, line };
}
function parseExprList(tc, line) {
  const first = parseExpr(tc, line);
  if (tc.isOp(',')) {
    const items = [first];
    while (tc.eatOp(',')) { if (tc.atEnd() || tc.isOp(';')) break; items.push(parseExpr(tc, line)); }
    return { k: 'tuple', items: items.map(x => ({ e: x })), line };
  }
  return first;
}

/* 式パーサ（優先順位の低い順） */
function parseExpr(tc, line) { return parseIfExp(tc, line); }
function parseIfExp(tc, line) {
  const then = parseOr(tc, line);
  if (tc.isName('if')) {
    tc.next();
    const cond = parseOr(tc, line);
    if (!tc.isName('else')) throw new SimDiag(line, 'SyntaxError', '条件式（三項演算子）には else が必要です', '「値1 if 条件 else 値2」の形で書いてください');
    tc.next();
    const els = parseExpr(tc, line);
    return { k: 'ifexp', cond, then, els, line };
  }
  return then;
}
function parseOr(tc, line) {
  let l = parseAnd(tc, line);
  while (tc.isName('or')) { tc.next(); l = { k: 'boolop', op: 'or', items: [l, parseAnd(tc, line)], line }; }
  return l;
}
function parseAnd(tc, line) {
  let l = parseNot(tc, line);
  while (tc.isName('and')) { tc.next(); l = { k: 'boolop', op: 'and', items: [l, parseNot(tc, line)], line }; }
  return l;
}
function parseNot(tc, line) {
  if (tc.isName('not')) { tc.next(); return { k: 'un', op: 'not', e: parseNot(tc, line), line }; }
  return parseCmp(tc, line);
}
function parseCmp(tc, line) {
  const first = parseBitOr(tc, line);
  const pairs = [];
  while (true) {
    let op = null;
    const t = tc.peek();
    if (t.t === 'OP' && ['==', '!=', '<', '<=', '>', '>='].includes(t.v)) { op = t.v; tc.next(); }
    else if (tc.isName('in')) { op = 'in'; tc.next(); }
    else if (tc.isName('is')) { tc.next(); op = tc.isName('not') ? (tc.next(), 'is not') : 'is'; }
    else if (tc.isName('not') && tc.peek(1).t === 'NAME' && tc.peek(1).v === 'in') { op = 'not in'; tc.next(); tc.next(); }
    if (!op) break;
    pairs.push({ op, e: parseBitOr(tc, line) });
  }
  return pairs.length ? { k: 'cmp', first, pairs, line } : first;
}
function parseBitOr(tc, line) {
  let l = parseBitAnd(tc, line);
  while (tc.isOp('|')) { tc.next(); l = { k: 'bin', op: '|', l, r: parseBitAnd(tc, line), line }; }
  return l;
}
function parseBitAnd(tc, line) {
  let l = parseArith(tc, line);
  while (tc.isOp('&')) { tc.next(); l = { k: 'bin', op: '&', l, r: parseArith(tc, line), line }; }
  return l;
}
function parseArith(tc, line) {
  let l = parseTerm(tc, line);
  while (tc.isOp('+') || tc.isOp('-')) { const op = tc.next().v; l = { k: 'bin', op, l, r: parseTerm(tc, line), line }; }
  return l;
}
function parseTerm(tc, line) {
  let l = parseUnary(tc, line);
  while (tc.isOp('*') || tc.isOp('/') || tc.isOp('//') || tc.isOp('%') || tc.isOp('@')) { const op = tc.next().v; l = { k: 'bin', op, l, r: parseUnary(tc, line), line }; }
  return l;
}
function parseUnary(tc, line) {
  if (tc.isOp('-') || tc.isOp('+') || tc.isOp('~')) { const op = tc.next().v; return { k: 'un', op, e: parseUnary(tc, line), line }; }
  return parsePower(tc, line);
}
function parsePower(tc, line) {
  const base = parsePostfix(tc, line);
  if (tc.isOp('**')) { tc.next(); return { k: 'bin', op: '**', l: base, r: parseUnary(tc, line), line }; }
  return base;
}
function parsePostfix(tc, line) { return parsePostfix2(tc, line, false); }
function parsePostfix2(tc, line, forTarget) {
  let e = parseAtom(tc, line);
  while (true) {
    if (tc.isOp('(')) {
      tc.next();
      const args = [], kwargs = {};
      let star = null;
      while (!tc.isOp(')')) {
        if (tc.isOp('**')) { tc.next(); args.push({ dstar: true, e: parseExpr(tc, line) }); }
        else if (tc.isOp('*')) { tc.next(); star = parseExpr(tc, line); args.push({ star: true, e: star }); }
        else if (tc.peek().t === 'NAME' && tc.peek(1).t === 'OP' && tc.peek(1).v === '=') { const kn = tc.next().v; tc.next(); kwargs[kn] = parseExpr(tc, line); }
        else { const e0 = parseExpr(tc, line); if (tc.isName('for')) { const gens = parseGens(tc, line); args.push({ e: { k: 'listcomp', elt: e0, gens, line } }); } else args.push({ e: e0 }); }
        if (!tc.eatOp(',')) break;
      }
      tc.expectOp(')', line);
      e = { k: 'call', fn: e, args, kwargs, line };
    } else if (tc.isOp('[')) {
      tc.next();
      let lo = null, hi = null, step = null, isSlice = false, idx = null;
      if (!tc.isOp(':') && !tc.isOp(']')) idx = parseExpr(tc, line);
      if (tc.isOp(':')) {
        isSlice = true; lo = idx; idx = null; tc.next();
        if (!tc.isOp(':') && !tc.isOp(']')) hi = parseExpr(tc, line);
        if (tc.isOp(':')) { tc.next(); if (!tc.isOp(']')) step = parseExpr(tc, line); }
      }
      tc.expectOp(']', line);
      if (!isSlice && idx === null) throw new SimDiag(line, 'SyntaxError', '[ ] の中に番号やキーがありません', '');
      e = isSlice ? { k: 'slice', obj: e, lo, hi, step, line } : { k: 'sub', obj: e, idx, line };
    } else if (tc.isOp('.')) {
      tc.next();
      const at = tc.next();
      if (at.t !== 'NAME') throw new SimDiag(line, 'SyntaxError', '「.」のあとには名前（メソッド名など）が必要です', '');
      e = { k: 'attr', obj: e, name: at.v, line };
    } else break;
  }
  return e;
}
function parseAtom(tc, line) {
  const t = tc.next();
  if (t.t === 'NUM') return { k: 'num', v: t.v, f: t.f, line };
  if (t.t === 'STR') {
    // 連続文字列リテラルの連結
    let v = t.v, f = t.f;
    while (tc.peek().t === 'STR') { const n = tc.next(); v += n.v; f = f || n.f; }
    if (f) return parseFStr(v, line);
    return { k: 'str', v, line };
  }
  if (t.t === 'NAME') {
    if (t.v === 'True') return { k: 'bool', v: true, line };
    if (t.v === 'False') return { k: 'bool', v: false, line };
    if (t.v === 'None') return { k: 'none', line };
    if (t.v === 'yield' || t.v === 'await') {
      const nt = tc.peek();
      if (nt.t !== 'END' && !(nt.t === 'OP' && [')', ']', '}', ',', ';', ':'].includes(nt.v))) parseExpr(tc, line);
      return { k: 'unkexpr', what: t.v, line };
    }
    if (t.v === 'lambda') { // 引数リストを読み飛ばす
      while (!tc.isOp(':') && !tc.atEnd()) tc.next();
      if (tc.isOp(':')) { tc.next(); parseExpr(tc, line); }
      return { k: 'lambda', line };
    }
    if (KEYWORDS.includes(t.v)) throw new SimDiag(line, 'SyntaxError', 'キーワード「' + t.v + '」はここでは使えません', '変数名や値の書き方を確認してください');
    return { k: 'name', name: t.v, line };
  }
  if (t.t === 'OP' && t.v === '(') {
    if (tc.isOp(')')) { tc.next(); return { k: 'tuple', items: [], line }; }
    const first = parseExpr(tc, line);
    if (tc.isName('for')) { const gens = parseGens(tc, line); tc.expectOp(')', line); return { k: 'listcomp', elt: first, gens, line }; }
    if (tc.isOp(',')) {
      const items = [{ e: first }];
      while (tc.eatOp(',')) { if (tc.isOp(')')) break; items.push({ e: parseExpr(tc, line) }); }
      tc.expectOp(')', line);
      return { k: 'tuple', items, line };
    }
    tc.expectOp(')', line);
    return first;
  }
  if (t.t === 'OP' && t.v === '[') {
    if (tc.isOp(']')) { tc.next(); return { k: 'list', items: [], line }; }
    const items = [];
    const first = parseCompItem(tc, line);
    if (first.comp) { tc.expectOp(']', line); return first.comp; }
    items.push(first);
    while (tc.eatOp(',')) { if (tc.isOp(']')) break; items.push(parseCompItem(tc, line)); }
    tc.expectOp(']', line);
    return { k: 'list', items, line };
  }
  if (t.t === 'OP' && t.v === '{') {
    if (tc.isOp('}')) { tc.next(); return { k: 'dict', pairs: [], line }; }
    const firstK = parseExpr(tc, line);
    if (tc.isOp(':')) {
      tc.next();
      const firstV = parseExpr(tc, line);
      if (tc.isName('for')) { const gens = parseGens(tc, line); tc.expectOp('}', line); return { k: 'dictcomp', keyE: firstK, valE: firstV, gens, line }; }
      const pairs = [{ k: firstK, v: firstV }];
      while (tc.eatOp(',')) { if (tc.isOp('}')) break; const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); }
      tc.expectOp('}', line);
      return { k: 'dict', pairs, line };
    }
    if (tc.isName('for')) { const gens = parseGens(tc, line); tc.expectOp('}', line); return { k: 'setcomp', elt: firstK, gens, line }; }
    const items = [{ e: firstK }];
    while (tc.eatOp(',')) { if (tc.isOp('}')) break; items.push({ e: parseExpr(tc, line) }); }
    tc.expectOp('}', line);
    return { k: 'set', items, line };
  }
  if (t.t === 'OP' && t.v === '*') { const e = parseExpr(tc, line); return { k: 'star', e, line }; }
  throw new SimDiag(line, 'SyntaxError', '式の読み取りに失敗しました（「' + (t.v !== undefined ? t.v : t.t) + '」のあたり）', '括弧や演算子の書き方を確認してください');
}
function parseCompItem(tc, line) {
  if (tc.isOp('*')) { tc.next(); return { star: true, e: parseExpr(tc, line) }; }
  const e = parseExpr(tc, line);
  if (tc.isName('for')) { const gens = parseGens(tc, line); return { comp: { k: 'listcomp', elt: e, gens, line } }; }
  return { e };
}
function parseGens(tc, line) {
  const gens = [];
  while (tc.isName('for')) {
    tc.next();
    const target = parseTarget(tc, line);
    if (!tc.isName('in')) throw new SimDiag(line, 'SyntaxError', '内包表記には in が必要です', '');
    tc.next();
    const iter = parseOr(tc, line);
    const conds = [];
    while (tc.isName('if')) { tc.next(); conds.push(parseOr(tc, line)); }
    gens.push({ target, iter, conds });
  }
  return gens;
}
function parseFStr(raw, line) {
  // f文字列：{式} と {式:書式} を分解する。{{ }} はリテラル。
  const parts = [];
  let cur = '', i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '{' && raw[i + 1] === '{') { cur += '{'; i += 2; continue; }
    if (c === '}' && raw[i + 1] === '}') { cur += '}'; i += 2; continue; }
    if (c === '{') {
      let depth = 1, j = i + 1, inner = '';
      while (j < raw.length && depth > 0) { if (raw[j] === '{') depth++; else if (raw[j] === '}') { depth--; if (!depth) break; } inner += raw[j]; j++; }
      if (depth > 0) throw new SimDiag(line, 'SyntaxError', 'f文字列の { が閉じられていません', '対応する } を足してください');
      if (cur) { parts.push({ s: cur }); cur = ''; }
      let exprText = inner, fmt = null, conv = null, doc = null;
      const colonAt = findFmtColon(inner);
      if (colonAt >= 0) { exprText = inner.slice(0, colonAt); fmt = inner.slice(colonAt + 1); }
      const cm = /!([rsa])\s*$/.exec(exprText);
      if (cm) { conv = cm[1]; exprText = exprText.slice(0, cm.index); }
      if (/=\s*$/.test(exprText) && !/[=!<>]=\s*$/.test(exprText)) { doc = exprText; exprText = exprText.replace(/=\s*$/, ''); }
      const sub = new TC(lexText(exprText.trim(), line));
      const e = parseExpr(sub, line);
      parts.push({ e, fmt, conv, doc });
      i = j + 1; continue;
    }
    cur += c; i++;
  }
  if (cur) parts.push({ s: cur });
  return { k: 'fstr', parts, line };
}
function findFmtColon(s) {
  // スライス・辞書リテラル・ラムダを含まない単純な式では、トップレベルの : を書式区切りとみなす
  let depth = 0, inStr = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") inStr = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

/* ============ 解釈（部分評価） ============ */
const MAX_STEPS = 400;
const MAX_ITERS = 10000;   // while 1つあたりの繰り返し上限（超えたら説明を打ち切る）
const MAX_RANGE = 100000;  // range を展開する上限（超えたら不明値）
const MAX_WORK = 300000;   // 全体の繰り返しの上限（超えたら説明を打ち切る）
const MAX_CALL_DEPTH = 40;

class Env {
  constructor(parent) { this.vars = new Map(); this.parent = parent || null; this.decl = null; }
  get(name) {
    if (this.decl && this.decl.has(name)) return this.decl.get(name).get(name);
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  set(name, v) { if (this.decl && this.decl.has(name)) { this.decl.get(name).set(name, v); return; } this.vars.set(name, v); }
  del(name) { if (this.decl && this.decl.has(name)) return this.decl.get(name).del(name); const had = this.vars.has(name) && this.vars.get(name) !== UNBOUND; if (had) this.vars.delete(name); return had; }
  hasOwn(name) { return this.vars.has(name); }
}
class Flow extends Error { constructor(kind, value) { super(kind); this.kind = kind; this.value = value; } }

function exprSrc(n) {
  if (!n) return '';
  switch (n.k) {
    case 'num': return fmtNum(NUM(n.v, n.f));
    case 'str': return "'" + n.v + "'";
    case 'bool': return n.v ? 'True' : 'False';
    case 'none': return 'None';
    case 'name': return n.name;
    case 'fstr': return 'f"…"';
    case 'list': return '[' + n.items.map(x => exprSrc(x.e)).join(', ') + ']';
    case 'tuple': return '(' + n.items.map(x => exprSrc(x.e)).join(', ') + ')';
    case 'dict': return '{' + n.pairs.map(p => exprSrc(p.k) + ': ' + exprSrc(p.v)).join(', ') + '}';
    case 'set': return '{' + n.items.map(x => exprSrc(x.e)).join(', ') + '}';
    case 'bin': return exprSrc(n.l) + ' ' + n.op + ' ' + exprSrc(n.r);
    case 'boolop': return n.items.map(exprSrc).join(' ' + n.op + ' ');
    case 'un': return n.op === 'not' ? 'not ' + exprSrc(n.e) : n.op + exprSrc(n.e);
    case 'cmp': return exprSrc(n.first) + n.pairs.map(p => ' ' + p.op + ' ' + exprSrc(p.e)).join('');
    case 'call': return exprSrc(n.fn) + '(…)';
    case 'attr': return exprSrc(n.obj) + '.' + n.name;
    case 'sub': return exprSrc(n.obj) + '[' + exprSrc(n.idx) + ']';
    case 'slice': return exprSrc(n.obj) + '[' + (n.lo ? exprSrc(n.lo) : '') + ':' + (n.hi ? exprSrc(n.hi) : '') + ']';
    case 'ifexp': return exprSrc(n.then) + ' if ' + exprSrc(n.cond) + ' else ' + exprSrc(n.els);
    case 'listcomp': return '[… for … in …]';
    default: return '…';
  }
}

function walkNodes(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) walkNodes(x, fn); return; }
  fn(node);
  if (node.k === 'def') { for (const p of node.params || []) if (p.def) walkNodes(p.def, fn); return; } // 入れ子の関数の中身は別のスコープ
  for (const key of Object.keys(node)) { if (key === 'line') continue; const v = node[key]; if (v && typeof v === 'object') walkNodes(v, fn); }
}
function addTargetNames(t, set) {
  if (!t) return;
  if (t.k === 'name') set.add(t.name);
  else if (t.k === 'ttuple') t.items.forEach(x => addTargetNames(x, set));
  else if (t.k === 'tuple') t.items.forEach(x => addTargetNames(x.e, set));
  else if (t.k === 'starred') addTargetNames(t.t, set);
}
function assignedNames(stmts) {
  const set = new Set();
  walkNodes(stmts, n => {
    if (n.k === 'assign' || n.k === 'aug') addTargetNames(n.target, set);
    else if (n.k === 'assignmulti') n.targets.forEach(t => addTargetNames(t, set));
    else if (n.k === 'for') addTargetNames(n.target, set);
    else if (n.k === 'def') set.add(n.name);
    else if (n.k === 'del') n.targets.forEach(t => addTargetNames(t, set));
    else if (n.k === 'unsupported' && n.names) n.names.forEach(x => set.add(x));
    else if (n.k === 'import') importNames(n.text || '').forEach(x => set.add(x));
  });
  return set;
}
function declaredNames(stmts) { const set = new Set(); walkNodes(stmts, n => { if (n.k === 'global') n.names.forEach(x => set.add(x)); }); return set; }
function hasNode(stmts, pred) { let f = false; walkNodes(stmts, n => { if (!f && pred(n)) f = true; }); return f; }
const isPrintCall = (n) => n.k === 'call' && n.fn && n.fn.k === 'name' && n.fn.name === 'print';
class Interp {
  constructor() {
    this.diags = []; this.steps = []; this.output = [];
    this.globals = new Env(null);
    this.iters = 0; this.depth = 0; this.quiet = 0; this.work = 0;
    this.stopped = false; this.outText = ''; this.pendingDec = []; this.truncated = false;
  }
  diag(line, level, kind, msg, fix) { this.diags.push({ line, level, kind, msg, fix: fix || '' }); }
  step(line, text) {
    if (this.quiet > 0) return;
    if (this.steps.length >= MAX_STEPS) {
      if (!this.stepsCapped) { this.steps.push({ line, text: '（手順が多いため、以降の繰り返し部分は省略します）', depth: this.depth }); this.stepsCapped = true; }
      return;
    }
    this.steps.push({ line, text, depth: this.depth });
  }
  err(line, kind, msg, fix) { throw new SimDiag(line, kind, msg, fix); }
  emitLine(text) { if (this.outText && !this.outText.endsWith('\n')) this.outText += '\n'; this.outText += text + '\n'; }
  tick() { if (++this.work > MAX_WORK) throw new Flow('budget'); }
  // 実行されたか分からない部分: 中で代入される名前は「実行時に決まる値」にし、print があればその旨の出力行を出す
  unknownBlock(blocks, env, why) {
    const names = new Set(); let prints = false;
    for (const b of blocks) { if (!b) continue; assignedNames(b).forEach(n => names.add(n)); if (hasNode(b, isPrintCall)) prints = true; }
    for (const n of names) env.set(n, UNK(why));
    if (prints) this.emitLine('（' + why + 'によって決まる出力）');
  }

  run(stmts) {
    try { this.execBlock(stmts, this.globals, {}); }
    catch (e) {
      if (e instanceof SimDiag) this.diag(e.line, 'error', e.kind, e.message, e.fix);
      else if (e instanceof Flow && e.kind === 'budget') {
        this.truncated = true;
        this.diag(0, 'note', '説明の上限', '繰り返しが多いため、ここで説明を打ち切りました。以降の出力と最終状態は実行して確認してください', '');
        this.emitLine('（繰り返しが多いため、ここから先の出力は省略します）');
      }
      else if (e instanceof Flow) { /* トップレベルの return 等は文法側で扱う */ }
      else throw e;
    }
    const vars = [];
    for (const [name, v] of this.globals.vars) {
      if (v === UNBOUND) continue;
      if (this.truncated) vars.push({ name, value: '（途中で打ち切ったため不明）', type: '不明' });
      else if (isFunc(v)) vars.push({ name, value: '関数 ' + name + '（定義）', type: 'function' });
      else vars.push({ name, value: reprVal(v), type: typeName(v) });
    }
    const t = this.outText;
    this.output = t === '' ? [] : (t.endsWith('\n') ? t.slice(0, -1) : t).split('\n');
    return { diags: this.diags, steps: this.steps, output: this.output, vars };
  }
  execBlock(stmts, env, ctx) { for (const s of stmts) this.execStmt(s, env, ctx); }

  execStmt(s, env, ctx) {
    switch (s.k) {
      case 'pass': return;
      case 'unsupported':
        this.diag(s.line, 'note', '対応外', '「' + s.what + '」はこの説明では解釈できません。その部分の値は「実行時に決まる値」として扱います', '実際の動きは実行して確認してください');
        for (const n of s.names || []) env.set(n, UNK('「' + s.what.replace(/（(.*?)）/g, ' $1') + '」で決まる値'));
        if (s.prints) this.emitLine('（「' + s.what.replace(/（(.*?)）/g, ' $1') + '」の中の出力は実行時に決まります）');
        this.pendingDec = [];
        if (s.returns && ctx.inFunc) { this.step(s.line, 'この部分の中で return する可能性があるため、関数の戻り値は実行時に決まります'); throw new Flow('return', UNK('実行時に決まる戻り値')); }
        return;
      case 'decorator':
        this.pendingDec.push(s);
        return;
      case 'global': {
        for (const n of s.names) {
          if (env === this.globals) continue;
          if (s.kind === 'global') { if (!env.decl) env.decl = new Map(); env.decl.set(n, this.globals); continue; }
          let e = env.parent; while (e && e !== this.globals && !e.vars.has(n)) e = e.parent;
          if (!e || e === this.globals) this.err(s.line, 'SyntaxError', 'nonlocal の「' + n + '」に対応する外側の関数の変数がありません', '');
          if (!env.decl) env.decl = new Map(); env.decl.set(n, e);
        }
        this.step(s.line, (s.kind === 'global' ? 'グローバル' : '外側の関数') + 'の変数「' + s.names.join('、') + '」を、この関数の中から書き換えられるようにします');
        return;
      }
      case 'del': {
        for (const t of s.targets) {
          if (t.k === 'name') { if (!env.del(t.name)) this.err(s.line, 'NameError', '変数「' + t.name + '」はありません', ''); this.step(s.line, '変数「' + t.name + '」を消します'); continue; }
          if (t.k === 'sub') {
            const obj = this.eval(t.obj, env), idx = this.eval(t.idx, env);
            if (isUnk(obj) || isUnk(idx)) continue;
            if (isList(obj)) { this.subGet(obj, idx, s.line); let i = Math.trunc(idx.v); if (i < 0) i += obj.__list.length; obj.__list.splice(i, 1); this.step(s.line, 'リストの [' + reprVal(idx) + '] を消します → ' + reprVal(obj)); continue; }
            if (isDict(obj)) { this.subGet(obj, idx, s.line); obj.__dict.delete(dictKeyId(idx)); this.step(s.line, '辞書のキー ' + reprVal(idx) + ' を消します'); continue; }
            this.err(s.line, 'TypeError', typeName(obj) + ' の要素は del で消せません', '');
          }
          this.diag(s.line, 'note', '対応外', 'この形の del はこの説明では解釈できません', '');
          if (t.k === 'slice' || t.k === 'attr') { const base = t.obj; if (base && base.k === 'name') env.set(base.name, UNK('del の結果')); }
        }
        return;
      }
      case 'assert': {
        const t = truthy(this.eval(s.e, env));
        if (t === null) { this.step(s.line, 'assert の条件は実行時に決まります'); return; }
        if (!t) this.err(s.line, 'AssertionError', s.msg ? strVal(this.eval(s.msg, env)) : 'assert の条件がうそ（False）でした', '');
        this.step(s.line, 'assert の条件を確かめます（本当（True）なので続けます）');
        return;
      }
      case 'raise': {
        if (!s.e) { this.diag(s.line, 'note', '対応外', '引数のない raise はこの説明では解釈できません', ''); return; }
        let kind = null, msg = '';
        if (s.e.k === 'call' && s.e.fn.k === 'name') { kind = s.e.fn.name; if (s.e.args.length) { const v = this.eval(s.e.args[0].e, env); msg = isUnk(v) ? '（実行時に決まる値）' : strVal(v); } }
        else if (s.e.k === 'name') kind = s.e.name;
        if (!kind) { this.diag(s.line, 'note', '対応外', 'この形の raise はこの説明では解釈できません', ''); return; }
        this.err(s.line, kind, msg || kind + ' を発生させました', '');
      }
      case 'import': {
        this.diag(s.line, 'note', 'import', 'import はこの説明では中身を読み込みません。import した名前は「実行時に決まる値」として扱います', '');
        for (const nm of importNames(s.text || '')) env.set(nm, UNK('モジュール「' + nm + '」の内容'));
        return;
      }
      case 'expr': {
        const v = this.eval(s.expr, env);
        if (s.expr.k === 'call' && s.expr.fn.k === 'attr') this.methodStepNote(s.expr, v);
        return;
      }
      case 'assign': {
        const v = this.eval(s.expr, env);
        this.assignTo(s.target, v, env, s.line, true);
        return;
      }
      case 'assignmulti': {
        const v = this.eval(s.expr, env);
        for (const t of s.targets) this.assignTo(t, v, env, s.line, true);
        return;
      }
      case 'aug': {
        const cur = this.readTarget(s.target, env, s.line);
        const rhs = this.eval(s.expr, env);
        const nv = this.binOp(s.op, cur, rhs, s.line);
        this.assignTo(s.target, nv, env, s.line, true);
        return;
      }
      case 'if': {
        for (const arm of s.arms) {
          const c = this.eval(arm.cond, env);
          const t = truthy(c);
          if (t === null) {
            this.step(s.line, '条件「' + exprSrc(arm.cond) + '」は実行時に決まる値を含むため、どちらに進むかは実行してみないと分かりません（この説明では分岐の中身は省略し、中で代入される変数は「実行時に決まる値」とします）');
            const from = s.arms.indexOf(arm);
            this.unknownBlock([...s.arms.slice(from).map(a => a.body), s.elseBody], env, '実行時の条件');
            return;
          }
          this.step(arm.line, '条件「' + exprSrc(arm.cond) + '」は ' + (t ? '本当（True）' : 'うそ（False）') + (t ? ' なので、この中身を実行します' : ' なので、この中身は飛ばします'));
          if (t) { this.execBlock(arm.body, env, ctx); return; }
        }
        if (s.elseBody) { this.step(s.line, 'どの条件にも当てはまらないため、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
        return;
      }
      case 'for': {
        const it = this.eval(s.iter, env);
        const seq = this.iterable(it, s.line);
        if (seq === null) { this.step(s.line, '繰り返しの対象が実行時に決まるため、回数は分かりません（中で代入される変数は「実行時に決まる値」とします）'); this.unknownBlock([[{ k: 'for', target: s.target, body: [] }], s.body, s.elseBody], env, '実行時の繰り返し'); return; }
        this.step(s.line, '「' + exprSrc(s.iter) + '」の要素を1つずつ「' + targetName(s.target) + '」に入れて、' + seq.length + '回繰り返します');
        let broke = false;
        const live = isList(it) ? it.__list : null;
        for (let idx = 0; idx < (live ? live.length : seq.length); idx++) {
          if (live) seq[idx] = live[idx];
          this.tick();
          const showSteps = idx === 0 || idx === (live ? live.length : seq.length) - 1;
          if (!showSteps) this.quiet++;
          if (idx === 0) this.step(s.line, '― 1回目 ―');
          if (idx === seq.length - 1 && seq.length > 1) this.step(s.line, '― 最後の回（' + seq.length + '回目）―');
          this.assignTo(s.target, seq[idx], env, s.line, false);
          try { this.execBlock(s.body, env, { ...ctx, inLoop: true }); }
          catch (e) {
            if (e instanceof Flow && e.kind === 'break') { this.step(s.line, 'break で繰り返しを抜けます'); broke = true; if (!showSteps) this.quiet--; break; }
            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; continue; }
            if (!showSteps) this.quiet--;
            throw e;
          }
          if (!showSteps) this.quiet--;
        }
        const total = live ? live.length : seq.length;
        if (!broke && total > 2) this.step(s.line, '（' + (total === 3 ? '2回目' : '2回目から ' + (total - 1) + ' 回目まで') + 'の手順は省略しました。変数の最終状態は下の「最終状態」に出ます）');
        if (!broke && s.elseBody) { this.step(s.line, 'break せずに繰り返しが終わったので、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
        return;
      }
      case 'while': {
        let count = 0, prevSnap = null, broke = false;
        const condNames = []; walkNodes(s.cond, n => { if (n.k === 'name') condNames.push(n.name); });
        const canStall = !hasNode(s.cond, n => n.k === 'call' || n.k === 'attr') && !hasNode(s.body, n => n.k === 'break' || n.k === 'return' || n.k === 'raise');
        while (true) {
          const c = this.eval(s.cond, env);
          const t = truthy(c);
          if (t === null) {
            this.step(s.line, 'while の条件「' + exprSrc(s.cond) + '」は実行時に決まる値を含むため、繰り返しの回数は分かりません（中で代入される変数は「実行時に決まる値」とします）');
            this.unknownBlock([s.body, s.elseBody], env, '実行時の繰り返し');
            return;
          }
          if (!t) { if (count > 0) this.step(s.line, '条件「' + exprSrc(s.cond) + '」がうそ（False）になったので、繰り返しを終わります（合計 ' + count + ' 回）'); break; }
          if (canStall) {
            const snap = condNames.map(n => { const v = env.get(n); return v === undefined ? '∅' : reprVal(v); }).join('\u0001');
            if (prevSnap !== null && snap === prevSnap) this.err(s.line, '無限ループの疑い', 'while の条件「' + exprSrc(s.cond) + '」に関わる値が繰り返しの中で変わらないため、条件がずっと本当（True）のままで終わりません', 'ループの中で条件に関わる変数を変えているか、break があるか確認してください');
            prevSnap = snap;
          }
          if (count >= MAX_ITERS) throw new Flow('budget');
          this.tick();
          count++;
          const showSteps = count <= 1;
          if (!showSteps) this.quiet++;
          if (count === 1) this.step(s.line, '条件「' + exprSrc(s.cond) + '」が本当（True）の間、繰り返します');
          try { this.execBlock(s.body, env, { ...ctx, inLoop: true }); }
          catch (e) {
            if (e instanceof Flow && e.kind === 'break') { this.step(s.line, 'break で繰り返しを抜けます'); if (!showSteps) this.quiet--; broke = true; break; }
            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; continue; }
            if (!showSteps) this.quiet--;
            throw e;
          }
          if (!showSteps) this.quiet--;
        }
        if (!broke && s.elseBody) { this.step(s.line, 'break せずに繰り返しが終わったので、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
        return;
      }
      case 'def': {
        let fn = FUNC(s, env === this.globals ? this.globals : env);
        // デフォルト引数は定義のときに1回だけ作られる（変更可能な値は呼び出し間で共有される）
        fn.defaults = {};
        for (const p of s.params) if (p.def) fn.defaults[p.name] = this.eval(p.def, env);
        this.step(s.line, '関数「' + s.name + '」を定義します（この時点では中身は実行しません。呼び出されたときに動きます）');
        const decs = this.pendingDec; this.pendingDec = [];
        for (let k = decs.length - 1; k >= 0; k--) {
          const dv = this.eval(decs[k].expr, env);
          fn = this.callFn(dv, [fn], env, decs[k].line);
          this.step(decs[k].line, 'デコレータ「' + exprSrc(decs[k].expr) + '」を関数「' + s.name + '」に適用します');
        }
        env.set(s.name, fn);
        return;
      }
      case 'return': {
        if (!ctx.inFunc) this.err(s.line, 'SyntaxError', 'return は関数の外では使えません', 'return は def の中でのみ書いてください');
        const v = s.expr ? this.eval(s.expr, env) : NONE;
        this.step(s.line, '呼び出し元へ ' + reprVal(v) + ' を返して、関数を終わります');
        throw new Flow('return', v);
      }
      case 'break': if (!ctx.inLoop) this.err(s.line, 'SyntaxError', 'break は繰り返しの外では使えません', 'break は for / while の中で書いてください'); throw new Flow('break');
      case 'continue': if (!ctx.inLoop) this.err(s.line, 'SyntaxError', 'continue は繰り返しの外では使えません', 'continue は for / while の中で書いてください'); throw new Flow('continue');
    }
  }
  methodStepNote() { /* メソッドの副作用は eval 側で手順に記録する */ }

  readTarget(t, env, line) {
    if (t.k === 'name') {
      const v = env.get(t.name);
      if (v === UNBOUND) this.err(line, 'UnboundLocalError', '関数の中で代入している変数「' + t.name + '」を、代入する前に使っています（関数の中で代入した名前は、その関数のローカル変数になります）', '外側の変数を書き換えたいなら global ' + t.name + ' と宣言するか、引数と戻り値で受け渡してください');
      if (v === undefined) this.err(line, 'NameError', '変数「' + t.name + '」はまだ作られていません（値が入っていません）', '使う前に「' + t.name + ' = 値」のように代入してください。綴りの違いにも注意してください');
      return v;
    }
    if (t.k === 'sub') {
      const obj = this.eval(t.obj, env);
      const idx = this.eval(t.idx, env);
      return this.subGet(obj, idx, line);
    }
    this.err(line, '対応外', 'この形の読み取りは解釈できません', '');
  }
  assignTo(t, v, env, line, record) {
    if (t.k === 'name') {
      let before = env.get(t.name); if (before === UNBOUND) before = undefined;
      env.set(t.name, v);
      if (record) {
        if (before === undefined) this.step(line, '「' + t.name + '」に ' + reprVal(v) + ' を代入します');
        else if (reprVal(before) !== reprVal(v)) this.step(line, '「' + t.name + '」を ' + reprVal(before) + ' から ' + reprVal(v) + ' に変えます');
        else this.step(line, '「' + t.name + '」に ' + reprVal(v) + ' を代入します（値は変わりません）');
      }
      return;
    }
    if (t.k === 'ttuple') {
      const items = isList(v) ? v.__list : isTuple(v) ? v.__tuple : (!isUnk(v) ? this.iterable(v, line, true) : null);
      if (items === null) {
        if (isUnk(v)) { for (const it of t.items) this.assignTo(it, UNK(), env, line, record); return; }
        this.err(line, 'TypeError', '値を分けて代入できません（' + typeName(v) + ' はバラバラにできません）', '右側はリストやタプルのように、要素を分けられる値にしてください');
      }
      const si = t.items.findIndex(x => x.k === 'starred');
      if (si >= 0) {
        const after = t.items.length - si - 1;
        if (items.length < t.items.length - 1) this.err(line, 'ValueError', '分ける値が足りません（少なくとも ' + (t.items.length - 1) + ' 個必要ですが ' + items.length + ' 個です）', '');
        t.items.forEach((it, i2) => {
          if (i2 < si) this.assignTo(it, items[i2], env, line, record);
          else if (i2 === si) this.assignTo(it.t, LIST(items.slice(si, items.length - after)), env, line, record);
          else this.assignTo(it, items[items.length - (t.items.length - i2)], env, line, record);
        });
        return;
      }
      if (items.length !== t.items.length) this.err(line, 'ValueError', '分ける数と代入先の数が合いません（値 ' + items.length + ' 個 → 代入先 ' + t.items.length + ' 個）', '左側の変数の数と、右側の要素の数を揃えてください');
      t.items.forEach((it, i2) => this.assignTo(it, items[i2], env, line, record));
      return;
    }
    if (t.k === 'sub') {
      const obj = this.eval(t.obj, env);
      const idx = this.eval(t.idx, env);
      this.subSet(obj, idx, v, line);
      if (record) this.step(line, '「' + exprSrc(t.obj) + '」の [' + reprVal(idx) + '] を ' + reprVal(v) + ' にします');
      return;
    }
    if (t.k === 'tuple') { // (a, b) = ... の丸括弧つき分割代入
      this.assignTo({ k: 'ttuple', items: t.items.map(x => x.e), line }, v, env, line, record);
      return;
    }
    if (t.k === 'attr') { this.diag(line, 'note', '対応外', '属性（.名前）への代入はこの説明では解釈できません', ''); return; }
    this.diag(line, 'note', '対応外', 'この形の代入はこの説明では解釈できません', '');
  }
  iterable(v, line, silent) {
    if (isUnk(v)) return null;
    if (isIter(v)) { if (v.used) return []; v.used = true; return v.__iter.slice(); }
    if (isView(v)) return viewItems(v);
    if (isList(v)) return v.__list.slice();
    if (isTuple(v)) return v.__tuple.slice();
    if (typeof v === 'string') return Array.from(v);
    if (isDict(v)) { const ks = []; for (const e of v.__dict.values()) ks.push(e.k); return ks; }
    if (isSet(v)) return v.__set.slice();
    if (v && v.__range) return v.__range.slice();
    if (!silent) this.err(line, 'TypeError', typeName(v) + ' は繰り返し（for）に使えません', 'for にはリスト・文字列・range() などの「並び」を指定してください');
    return null;
  }
}
function targetName(t) {
  if (t.k === 'name') return t.name;
  if (t.k === 'ttuple') return t.items.map(targetName).join(', ');
  return '要素';
}

/* ============ 式の評価 ============ */
const PY_BUILTINS = new Set('abs all any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip Exception BaseException ValueError TypeError KeyError IndexError ZeroDivisionError NameError AttributeError RuntimeError StopIteration AssertionError ImportError ModuleNotFoundError OSError FileNotFoundError NotImplementedError ArithmeticError LookupError OverflowError RecursionError UnicodeError EOFError KeyboardInterrupt SystemExit'.split(' '));
const BUILTIN_NAMES = ['print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'tuple', 'dict', 'set', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'enumerate', 'zip', 'type', 'input', 'isinstance', 'ord', 'chr', 'divmod', 'pow', 'any', 'all', 'open'];
BUILTIN_NAMES.push('repr', 'map', 'filter', 'hex', 'bin', 'oct', 'format');
const ARITY = { repr: [1, 1], map: [2, 99], filter: [2, 2], hex: [1, 1], bin: [1, 1], oct: [1, 1], format: [1, 2], print: [0, 99], len: [1, 1], range: [1, 3], str: [0, 1], int: [0, 2], float: [0, 1], bool: [1, 1], list: [0, 1], tuple: [0, 1], set: [0, 1], dict: [0, 1], sum: [1, 2], min: [0, 99], max: [0, 99], abs: [1, 1], round: [1, 2], sorted: [1, 1], reversed: [1, 1], enumerate: [1, 2], zip: [1, 99], type: [1, 1], input: [0, 1], isinstance: [2, 2], ord: [1, 1], chr: [1, 1], divmod: [2, 2], pow: [2, 3], any: [1, 1], all: [1, 1], open: [1, 3] };

Interp.prototype.eval = function (n, env) {
  if (!n) return UNK();
  switch (n.k) {
    case 'num': return !n.f && !SAFE(n.v) ? BIG() : NUM(n.v, n.f);
    case 'str': return n.v;
    case 'bool': return BOOL(n.v);
    case 'none': return NONE;
    case 'name': {
      const v = env.get(n.name);
      if (v === UNBOUND) this.err(n.line, 'UnboundLocalError', '関数の中で代入している変数「' + n.name + '」を、代入する前に使っています（関数の中で代入した名前は、その関数のローカル変数になります）', '外側の変数を使いたいなら global ' + n.name + ' と宣言するか、引数として渡してください');
      if (v !== undefined) return v;
      if (BUILTIN_NAMES.includes(n.name) || PY_BUILTINS.has(n.name)) return BUILTIN(n.name);
      this.err(n.line, 'NameError', '変数「' + n.name + '」はまだ作られていません（値が入っていません）', '使う前に代入してください。綴り（大文字・小文字）が合っているかも確認してください');
      return UNK();
    }
    case 'fstr': {
      let out = '', hasUnk = false;
      for (const p of n.parts) {
        if (p.s !== undefined) { out += p.s; continue; }
        const v = this.eval(p.e, env);
        if (p.doc) out += p.doc;
        if (isUnk(v) || isIter(v)) { hasUnk = true; out += '（実行時に決まる値）'; continue; }
        let base = v;
        if (p.conv === 'r' || p.conv === 'a' || (p.doc && !p.fmt && !p.conv)) base = reprVal(v);
        else if (p.conv === 's') base = strVal(v);
        const fs = fmtSpec(base, p.fmt);
        if (fs === null) { hasUnk = true; out += '（実行時に決まる値）'; this.diag(n.line, 'note', '対応外', '書式指定「' + p.fmt + '」はこの説明では扱いません。その部分は「実行時に決まる値」として示します', ''); continue; }
        out += fs;
      }
      return hasUnk ? UNK('文字列の一部が実行時に決まる値') : out;
    }
    case 'list': {
      const arr = [];
      for (const it of n.items) {
        if (it.star) { const sv = this.eval(it.e, env); const seq = this.iterable(sv, n.line, true); if (seq === null) return UNK(); arr.push(...seq); }
        else arr.push(this.eval(it.e, env));
      }
      return LIST(arr);
    }
    case 'tuple': { const arr = []; for (const it of n.items) { if (it.e && it.e.k === 'star') { const seq = this.iterable(this.eval(it.e.e, env), n.line, true); if (seq === null) return UNK(); arr.push(...seq); } else arr.push(this.eval(it.e, env)); } return TUPLE(arr); }
    case 'set': { const arr = []; for (const it of n.items) { const v = this.eval(it.e, env); this.needHash(v, n.line); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } return SET(arr); }
    case 'dict': {
      const d = DICT();
      for (const p of n.pairs) { const k = this.eval(p.k, env); const v = this.eval(p.v, env); if (!isUnk(k) && !dictSet(d, k, v)) this.err(n.line, 'TypeError', '辞書のキーにできない型です（' + typeName(k) + '）', 'キーには文字列や数値を使ってください'); if (isUnk(k)) return UNK(); }
      return d;
    }
    case 'un': {
      const v = this.eval(n.e, env);
      if (n.op === 'not') { const t = truthy(v); return t === null ? UNK() : BOOL(!t); }
      if (isUnk(v)) return UNK();
      if (isNum(v)) return n.op === '-' ? NUM(-v.v, v.f) : n.op === '+' ? v : NUM(~Math.trunc(v.v), false);
      if (isBool(v)) return n.op === '-' ? NUM(v.v ? -1 : 0, false) : v;
      this.err(n.line, 'TypeError', typeName(v) + ' には符号（' + n.op + '）を付けられません', '数値に対して使ってください');
      return UNK();
    }
    case 'boolop': {
      let result = this.eval(n.items[0], env);
      for (let i = 1; i < n.items.length; i++) {
        const t = truthy(result);
        if (n.op === 'and' && t === false) return result;
        if (n.op === 'or' && t === true) return result;
        if (t === null) return UNK();
        result = this.eval(n.items[i], env);
      }
      return result;
    }
    case 'bin': {
      const l = this.eval(n.l, env), r = this.eval(n.r, env);
      return this.binOp(n.op, l, r, n.line);
    }
    case 'cmp': {
      let left = this.eval(n.first, env);
      for (const p of n.pairs) {
        const right = this.eval(p.e, env);
        const res = this.compare(p.op, left, right, n.line);
        if (isBool(res) && !res.v) return BOOL(false);
        if (isUnk(res)) return UNK();
        left = right;
      }
      return BOOL(true);
    }
    case 'ifexp': {
      const c = this.eval(n.cond, env); const t = truthy(c);
      if (t === null) return UNK();
      return this.eval(t ? n.then : n.els, env);
    }
    case 'sub': {
      const obj = this.eval(n.obj, env); const idx = this.eval(n.idx, env);
      return this.subGet(obj, idx, n.line);
    }
    case 'slice': {
      const obj = this.eval(n.obj, env);
      const lo = n.lo ? this.eval(n.lo, env) : null, hi = n.hi ? this.eval(n.hi, env) : null, st = n.step ? this.eval(n.step, env) : null;
      return this.sliceGet(obj, lo, hi, st, n.line);
    }
    case 'attr': {
      const obj = this.eval(n.obj, env);
      if (obj && obj.__type && (n.name === '__name__' || n.name === '__qualname__')) return obj.__type;
      if (isFunc(obj) && n.name === '__annotations__') {
        const d = DICT();
        const toType = (v) => (v && v.__builtin && ['int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set'].includes(v.__builtin)) ? TYPEVAL(v.__builtin) : v;
        for (const p of obj.def.params) if (p.ann) dictSet(d, p.name, toType(this.eval(p.ann, obj.env || env)));
        if (obj.def.retAnn) dictSet(d, 'return', toType(this.eval(obj.def.retAnn, obj.env || env)));
        return d;
      }
      if (isUnk(obj)) return UNK();
      if (isNone(obj)) this.err(n.line, 'AttributeError', 'None には属性「' + n.name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');
      return UNK('属性「' + n.name + '」の値');
    }
    case 'call': return this.evalCall(n, env);
    case 'listcomp': case 'setcomp': case 'dictcomp': return this.evalComp(n, env);
    case 'lambda': this.diag(n.line, 'note', '対応外', 'lambda（無名関数）はこの説明では解釈できません', '通常の def で書くと説明できます'); return UNK('lambda の結果');
    case 'unkexpr': this.diag(n.line, 'note', '対応外', '「' + n.what + '」はこの説明では解釈できません。関係する値は「実行時に決まる値」として扱います', ''); return UNK(n.what + ' の結果');
    case 'star': return this.eval(n.e, env);
    case '__val': return n.v;
  }
  return UNK();
};

Interp.prototype.binOp = function (op, l, r, line) {
  const res = this.binOp0(op, l, r, line);
  if (isNum(res) && !res.f && !SAFE(res.v)) return BIG();
  if (isNum(res) && res.f && !Number.isFinite(res.v) && isNum(l) && isNum(r) && Number.isFinite(l.v) && Number.isFinite(r.v)) {
    if (op === '**') this.err(line, 'OverflowError', '計算結果が大きすぎて小数（float）で表せません', '');
    return res;
  }
  return res;
};
Interp.prototype.binOp0 = function (op, l, r, line) {
  if (op === '@') { this.diag(line, 'note', '対応外', '演算子 @ はこの説明では解釈できません', ''); return UNK(); }
  if (isUnk(l) || isUnk(r)) return UNK();
  const ln = isBool(l) ? NUM(l.v ? 1 : 0, false) : l, rn = isBool(r) ? NUM(r.v ? 1 : 0, false) : r;
  if (op === '+') {
    if (isNum(ln) && isNum(rn)) return NUM(ln.v + rn.v, ln.f || rn.f);
    if (typeof l === 'string' && typeof r === 'string') return l + r;
    if (isList(l) && isList(r)) return LIST(l.__list.concat(r.__list));
    if (isTuple(l) && isTuple(r)) return TUPLE(l.__tuple.concat(r.__tuple));
    this.typeErr(line, op, l, r);
  }
  if (op === '-') {
    if (isNum(ln) && isNum(rn)) return NUM(ln.v - rn.v, ln.f || rn.f);
    if (isSet(l) && isSet(r)) return SET(l.__set.filter(x => !r.__set.some(y => eqVal(x, y) === true)));
    this.typeErr(line, op, l, r);
  }
  if (op === '*') {
    if (isNum(ln) && isNum(rn)) return NUM(ln.v * rn.v, ln.f || rn.f);
    if (typeof l === 'string' && isNum(rn)) return repeatStr(l, rn.v, line, this);
    if (isNum(ln) && typeof r === 'string') return repeatStr(r, ln.v, line, this);
    if ((isList(l) || isTuple(l)) && isNum(rn) && !rn.f) { const a = repeatArr(isList(l) ? l.__list : l.__tuple, rn.v); return a === null ? UNK('とても長い並び') : isList(l) ? LIST(a) : TUPLE(a); }
    if (isNum(ln) && !ln.f && (isList(r) || isTuple(r))) { const a = repeatArr(isList(r) ? r.__list : r.__tuple, ln.v); return a === null ? UNK('とても長い並び') : isList(r) ? LIST(a) : TUPLE(a); }
    this.typeErr(line, op, l, r);
  }
  if (op === '/' || op === '//' || op === '%') {
    if (isNum(ln) && isNum(rn)) {
      if (rn.v === 0) this.err(line, 'ZeroDivisionError', '0 で割り算（または余り）を求めることはできません', '割る数が 0 にならないよう、条件で分けるか値を確認してください');
      if (op === '/') return NUM(ln.v / rn.v, true);
      if (op === '//') { const q = Math.floor(ln.v / rn.v); return NUM(q, ln.f || rn.f); }
      const m = ln.v - Math.floor(ln.v / rn.v) * rn.v; return NUM(m, ln.f || rn.f);
    }
    if (op === '%' && typeof l === 'string') { this.diag(line, 'note', '対応外', '文字列の % 書式はこの説明では解釈できません', 'f文字列（f"…{値}…"）を使うと説明できます'); return UNK(); }
    this.typeErr(line, op, l, r);
  }
  if (op === '**') {
    if (isNum(ln) && isNum(rn)) {
      if (ln.v === 0 && rn.v < 0) this.err(line, 'ZeroDivisionError', '0 を負の数で累乗することはできません', '');
      const res = Math.pow(ln.v, rn.v);
      return NUM(res, ln.f || rn.f || rn.v < 0 || !Number.isInteger(res));
    }
    this.typeErr(line, op, l, r);
  }
  if (op === '|' || op === '&') {
    if (isSet(l) && isSet(r)) {
      if (op === '|') { const a = l.__set.slice(); for (const x of r.__set) if (!a.some(y => eqVal(x, y) === true)) a.push(x); return SET(a); }
      return SET(l.__set.filter(x => r.__set.some(y => eqVal(x, y) === true)));
    }
    if (isNum(ln) && isNum(rn)) return NUM(op === '|' ? (Math.trunc(ln.v) | Math.trunc(rn.v)) : (Math.trunc(ln.v) & Math.trunc(rn.v)), false);
    if (isBool(l) && isBool(r)) return BOOL(op === '|' ? (l.v || r.v) : (l.v && r.v));
    this.typeErr(line, op, l, r);
  }
  return UNK();
};
Interp.prototype.typeErr = function (line, op, l, r) {
  let fix = '型を確認してください。文字列と数値をくっつけたいときは str() で文字列に変えます';
  if (typeof l === 'string' && isNum(r) && op === '+') fix = '文字列に数値をくっつけるときは str() で文字列に変えてください（例："合計は" + str(x)）';
  if (isNum(l) && typeof r === 'string' && op === '+') fix = '数値に文字列を足すことはできません。int() や float() で数値に変えるか、str() で文字列同士にしてください';
  this.err(line, 'TypeError', typeName(l) + ' と ' + typeName(r) + ' の間では「' + op + '」は使えません', fix);
};
function repeatStr(s, n, line, self) {
  if (n < 0) return '';
  if (s.length * n > 100000) { self.diag(line, 'note', '注意', '文字列の繰り返しが大きすぎるため、結果は省略します', ''); return UNK('とても長い文字列'); }
  if (n > 0 && !Number.isInteger(n)) return UNK();
  return s.repeat(Math.trunc(n));
}
function repeatArr(a, n) { if (n <= 0) return []; if (a.length * n > 100000) return null; const out = []; for (let i = 0; i < n; i++) out.push(...a); return out; }

Interp.prototype.compare = function (op, l, r, line) {
  if (op === 'in' || op === 'not in') {
    let res = null;
    if (isUnk(l) || isUnk(r)) res = null;
    else if (typeof r === 'string' && typeof l === 'string') res = r.includes(l);
    else if (isList(r)) res = r.__list.some(x => eqVal(x, l) === true);
    else if (isTuple(r)) res = r.__tuple.some(x => eqVal(x, l) === true);
    else if (isSet(r)) res = r.__set.some(x => eqVal(x, l) === true);
    else if (isDict(r)) res = dictGet(r, l) !== undefined || [...r.__dict.values()].some(e => eqVal(e.k, l) === true);
    else if (r && r.__range) res = r.__range.some(x => eqVal(x, l) === true);
    else if (isView(r)) res = viewItems(r).some(x => eqVal(x, l) === true);
    else this.err(line, 'TypeError', typeName(r) + ' に対して in は使えません', '右側は文字列・リスト・辞書などの「集まり」にしてください');
    if (res === null) return UNK();
    return BOOL(op === 'in' ? res : !res);
  }
  if (op === '==') { const e = eqVal(l, r); return e === null ? UNK() : BOOL(e); }
  if (op === '!=') { const e = eqVal(l, r); return e === null ? UNK() : BOOL(!e); }
  if (op === 'is' || op === 'is not') {
    let res = null;
    if (isNone(l) || isNone(r)) res = isNone(l) && isNone(r);
    else if (isBool(l) && isBool(r)) res = l.v === r.v;
    else if (isUnk(l) || isUnk(r)) res = null;
    else {
      this.diag(line, 'note', '注意', 'is は「同じものかどうか」を見る演算子です。値の比較には == を使うのが普通です', '');
      const mut = (x) => isList(x) || isDict(x) || isSet(x) || isFunc(x) || isIter(x);
      if (mut(l) || mut(r)) res = l === r; // 別々に作ったリストなどは別のもの
      else res = null; // 数値・文字列・タプルが同じものかは Python の実装によって変わる
    }
    if (res === null) return UNK();
    return BOOL(op === 'is' ? res : !res);
  }
  // 順序比較
  if (isUnk(l) || isUnk(r)) return UNK();
  const ln = isBool(l) ? NUM(l.v ? 1 : 0, false) : l, rn = isBool(r) ? NUM(r.v ? 1 : 0, false) : r;
  let c = null;
  if (isNum(ln) && isNum(rn)) c = ln.v < rn.v ? -1 : ln.v > rn.v ? 1 : 0;
  else if (typeof l === 'string' && typeof r === 'string') { const a = Array.from(l), b = Array.from(r); c = 0; for (let i = 0; i < Math.min(a.length, b.length) && !c; i++) { const x = a[i].codePointAt(0), y = b[i].codePointAt(0); c = x < y ? -1 : x > y ? 1 : 0; } if (!c) c = a.length < b.length ? -1 : a.length > b.length ? 1 : 0; }
  else if ((isList(l) && isList(r)) || (isTuple(l) && isTuple(r))) {
    const a = isList(l) ? l.__list : l.__tuple, b = isList(r) ? r.__list : r.__tuple; c = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const e = eqVal(a[i], b[i]); if (e === null) return UNK(); if (e) continue;
      const lt = this.compare('<', a[i], b[i], line); if (isUnk(lt)) return UNK(); c = lt.v ? -1 : 1; break;
    }
    if (!c) c = a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }
  else this.err(line, 'TypeError', typeName(l) + ' と ' + typeName(r) + ' は大小比較（' + op + '）ができません', '比べる相手は同じ型（数値同士・文字列同士）にしてください');
  if (c === null) return UNK();
  return BOOL(op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0);
};

Interp.prototype.subGet = function (obj, idx, line) {
  if (isUnk(obj) || isUnk(idx)) return UNK();
  if (typeof obj === 'string' || isList(obj) || isTuple(obj)) {
    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;
    if (!isNum(idx)) this.err(line, 'TypeError', '番号（インデックス）には整数を使ってください', '');
    let i = Math.trunc(idx.v);
    if (i < 0) i += arr.length;
    if (i < 0 || i >= arr.length) this.err(line, 'IndexError', '番号 ' + fmtNum(idx) + ' の要素はありません（要素は ' + arr.length + ' 個で、番号は 0〜' + (arr.length - 1) + ' です）', '番号が要素の数を超えていないか確認してください。後ろから数えるときは -1 が最後です');
    return typeof obj === 'string' ? arr[i] : arr[i];
  }
  if (isDict(obj)) {
    const v = dictGet(obj, idx);
    if (v === undefined) {
      if ([...obj.__dict.values()].some(e => eqVal(e.k, idx) === true)) return obj.__dict.get(dictKeyId(idx)).v;
      this.err(line, 'KeyError', 'キー ' + reprVal(idx) + ' は辞書にありません', 'キーの綴りを確認するか、.get(' + reprVal(idx) + ') を使うと無いときに None が返ります');
    }
    return v;
  }
  if (obj && obj.__range) {
    if (!isNum(idx)) this.err(line, 'TypeError', '番号には整数を使ってください', '');
    let i = Math.trunc(idx.v); if (i < 0) i += obj.__range.length;
    if (i < 0 || i >= obj.__range.length) this.err(line, 'IndexError', 'range の範囲外の番号です', '');
    return obj.__range[i];
  }
  this.err(line, 'TypeError', typeName(obj) + ' には [ ] で要素を取り出す使い方はできません', '');
  return UNK();
};
Interp.prototype.subSet = function (obj, idx, v, line) {
  if (isUnk(obj)) return;
  if (isList(obj)) {
    if (!isNum(idx)) this.err(line, 'TypeError', '番号には整数を使ってください', '');
    let i = Math.trunc(idx.v); if (i < 0) i += obj.__list.length;
    if (i < 0 || i >= obj.__list.length) this.err(line, 'IndexError', '番号 ' + fmtNum(idx) + ' の要素はありません（リストは ' + obj.__list.length + ' 個）', '末尾に足すときは append() を使ってください');
    obj.__list[i] = v; return;
  }
  if (isDict(obj)) { if (!dictSet(obj, idx, v)) this.err(line, 'TypeError', '辞書のキーにできない型です（' + typeName(idx) + '）', 'キーには文字列や数値を使ってください'); return; }
  if (typeof obj === 'string') this.err(line, 'TypeError', '文字列は中身を書き換えられません（文字列は変更できない決まりです）', '新しい文字列を作って代入し直してください');
  if (isTuple(obj)) this.err(line, 'TypeError', 'タプルは中身を書き換えられません', '変えたいときはリストを使ってください');
  this.err(line, 'TypeError', typeName(obj) + ' には [ ] で代入できません', '');
};
Interp.prototype.sliceGet = function (obj, lo, hi, st, line) {
  const step = st && isNum(st) ? Math.trunc(st.v) : 1;
  if (st && isNum(st) && st.v === 0) this.err(line, 'ValueError', 'スライスの間隔（3つ目の数）を 0 にはできません', '');
  if (isUnk(obj)) return UNK();
  const norm = (v, len, def) => { if (v === null || v === undefined) return def; if (!isNum(v)) return def; let i = Math.trunc(v.v); if (i < 0) i += len; return Math.max(0, Math.min(len, i)); };
  if (typeof obj === 'string' || isList(obj) || isTuple(obj)) {
    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;
    let a = norm(lo, arr.length, step < 0 ? arr.length - 1 : 0);
    let b = norm(hi, arr.length, step < 0 ? -1 : arr.length);
    const out = [];
    if (step > 0) for (let i = a; i < b; i += step) out.push(arr[i]);
    else for (let i = a; i > b; i += step) out.push(arr[i]);
    if (typeof obj === 'string') return out.join('');
    return isList(obj) ? LIST(out) : TUPLE(out);
  }
  this.diag(line, 'note', '対応外', typeName(obj) + ' のスライスはこの説明では解釈できません', '');
  return UNK();
};

/* ============ 呼び出し ============ */
Interp.prototype.evalCall = function (n, env) {
  if (n.args.some(a => a.dstar)) { // f(**d): 辞書の中身をキーワード引数として展開する
    const kwargs = { ...n.kwargs };
    for (const a of n.args) if (a.dstar) { const d = this.eval(a.e, env); if (isUnk(d)) return UNK(); if (!isDict(d)) this.err(n.line, 'TypeError', '** のあとには辞書を書いてください', ''); for (const e of d.__dict.values()) { if (typeof e.k !== 'string') this.err(n.line, 'TypeError', 'キーワード引数の名前は文字列にしてください', ''); kwargs[e.k] = { k: '__val', v: e.v }; } }
    n = { ...n, args: n.args.filter(a => !a.dstar), kwargs };
  }
  // メソッド呼び出し
  if (n.fn.k === 'attr') {
    const obj = this.eval(n.fn.obj, env);
    const args = this.evalArgs(n, env);
    if (args === null) return UNK();
    return this.callMethod(obj, n.fn.name, args, n.kwargs, env, n.line);
  }
  const fn = this.eval(n.fn, env);
  const args = this.evalArgs(n, env);
  if (args === null) return UNK();
  if (fn && fn.__builtin) return this.callBuiltin(fn.__builtin, args, n.kwargs, env, n.line, n);
  if (isFunc(fn)) return this.callUserFunc(fn, args, n.kwargs, env, n.line);
  if (fn && fn.__method) return this.callMethod(fn.obj, fn.name, args, n.kwargs, env, n.line);
  if (isUnk(fn)) return UNK();
  this.err(n.line, 'TypeError', typeName(fn) + ' は呼び出し（ ）ができません', '関数名のあとに ( ) を付けて呼び出します。変数と関数を取り違えていないか確認してください');
  return UNK();
};
Interp.prototype.callFn = function (fv, args, env, line) {
  if (isUnk(fv)) return UNK();
  if (fv && fv.__builtin) return this.callBuiltin(fv.__builtin, args, {}, env, line, null);
  if (isFunc(fv)) return this.callUserFunc(fv, args, {}, env, line);
  this.err(line, 'TypeError', typeName(fv) + ' は呼び出し（ ）ができません', '');
  return UNK();
};
Interp.prototype.needHash = function (v, line) {
  if (!isUnk(v) && dictKeyId(v) === null) this.err(line, 'TypeError', typeName(v) + ' は集合の要素や辞書のキーにできません（ハッシュできない型です）', 'リストはタプルに変えると使えます');
};
// key 関数の値を求める。不明が混ざれば null
Interp.prototype.keyed = function (items, keyFn, env, line) {
  const out = [];
  for (const x of items) { const k = keyFn ? this.callFn(keyFn, [x], env, line) : x; if (isUnk(k)) return null; out.push(k); }
  return out;
};
Interp.prototype.evalArgs = function (n, env) {
  const args = [];
  for (const a of n.args) {
    if (a.dstar) continue;
    if (a.star) { const seq = this.iterable(this.eval(a.e, env), n.line, true); if (seq === null) return null; args.push(...seq); }
    else args.push(this.eval(a.e, env));
  }
  return args;
};
Interp.prototype.callUserFunc = function (fn, args, kwargs, env, line) {
  const def = fn.def;
  const params = def.params;
  const posParams = params.filter(p => !p.bare && !p.star && !p.kwOnly);
  const starParam = params.find(p => p.star === 1 && p.name);
  const kwParam = params.find(p => p.star === 2);
  const kwNames = Object.keys(kwargs);
  if (args.length > posParams.length && !starParam)
    this.err(line, 'TypeError', '関数「' + def.name + '」の引数が多すぎます（' + posParams.length + ' 個までなのに ' + args.length + ' 個渡しています）', '呼び出しの引数の数を確認してください');
  if (def.isGen === undefined) def.isGen = hasNode(def.body, x => x.k === 'unkexpr' && x.what === 'yield');
  if (def.isGen) { this.diag(line, 'note', '対応外', 'ジェネレータ関数「' + def.name + '」（yield を含む関数）の中身はこの説明では順に実行しません。作られる値は「実行時に決まる値」として扱います', ''); return UNK('ジェネレータ「' + def.name + '」が作る値'); }
  const local = new Env(fn.env || this.globals); // 定義された場所のスコープを親にする（入れ子関数のクロージャ対応）
  if (!def.localNames) { const decl = declaredNames(def.body); def.localNames = [...assignedNames(def.body)].filter(x => !decl.has(x) && !params.some(p => p.name === x)); }
  for (const x of def.localNames) local.set(x, UNBOUND);
  const named = {};
  posParams.forEach((p, i) => { if (i < args.length) named[p.name] = args[i]; });
  const extraKw = {};
  for (const k of kwNames) {
    if (params.some(p => p.name === k)) {
      if (named[k] !== undefined) this.err(line, 'TypeError', '関数「' + def.name + '」の引数「' + k + '」に値が2つ渡されています', '');
      named[k] = this.eval(kwargs[k], env);
    } else if (kwParam) extraKw[k] = this.eval(kwargs[k], env);
    else this.err(line, 'TypeError', '関数「' + def.name + '」に引数「' + k + '」はありません', '引数名の綴りを確認してください');
  }
  for (const p of params) {
    if (p.bare) continue;
    if (p.star === 1) { local.set(p.name, TUPLE(args.slice(posParams.length))); continue; }
    if (p.star === 2) { const d = DICT(); for (const k of Object.keys(extraKw)) dictSet(d, k, extraKw[k]); local.set(p.name, d); continue; }
    if (named[p.name] !== undefined) { local.set(p.name, named[p.name]); continue; }
    if (p.def) { local.set(p.name, fn.defaults && p.name in fn.defaults ? fn.defaults[p.name] : this.eval(p.def, fn.env || this.globals)); continue; }
    this.err(line, 'TypeError', '関数「' + def.name + '」の引数「' + p.name + '」の値が渡されていません（必須の引数です）', '呼び出しの引数を確認してください');
  }
  this.step(line, '関数「' + def.name + '」を呼び出します（' + params.filter(p => !p.bare).map((p) => p.name + ' = ' + reprVal(local.get(p.name))).join('、') + '）');
  if (this.depth >= MAX_CALL_DEPTH) { this.diag(line, 'note', '注意', '関数の呼び出しが深くなりすぎたため、ここで止めます（再帰が終わらない可能性があります）', '自分自身を呼び出すときは、止まる条件があるか確認してください'); return UNK(); }
  this.depth++;
  let ret = NONE;
  try { this.execBlock(def.body, local, { inFunc: true }); }
  catch (e) { if (e instanceof Flow && e.kind === 'return') ret = e.value; else { this.depth--; throw e; } }
  this.depth--;
  this.step(line, '関数「' + def.name + '」は ' + reprVal(ret) + ' を返します');
  return ret;
};

Interp.prototype.callBuiltin = function (name, args, kwargs, env, line, node) {
  const ar = ARITY[name];
  if (ar && (args.length < ar[0] || args.length > ar[1])) {
    this.err(line, 'TypeError', name + '() の引数の数が合いません（' + (ar[0] === ar[1] ? ar[0] + ' 個' : ar[0] + '〜' + ar[1] + ' 個') + '必要ですが、' + args.length + ' 個渡しています）', 'リファレンスで ' + name + ' の使い方を確認してください');
  }
  const kw = {};
  for (const k of Object.keys(kwargs || {})) kw[k] = this.eval(kwargs[k], env);
  switch (name) {
    case 'print': {
      const sep = kw.sep !== undefined && typeof kw.sep === 'string' ? kw.sep : ' ';
      const end = kw.end !== undefined && typeof kw.end === 'string' ? kw.end : '\n';
      const text = args.map(a => strVal(a)).join(sep);
      this.outText += text + end;
      this.step(line, '画面に「' + text + '」と表示します' + (end !== '\n' ? '（改行の代わりに ' + reprVal(end) + ' を付けます）' : ''));
      return NONE;
    }
    case 'repr': return isUnk(args[0]) ? UNK() : reprVal(args[0]);
    case 'format': { if (isUnk(args[0])) return UNK(); const r = fmtSpec(args[0], args.length > 1 ? args[1] : ''); return r === null ? UNK('format の結果') : r; }
    case 'hex': case 'bin': case 'oct': { const v = args[0]; if (isUnk(v)) return UNK(); if (!isNum(v) || v.f) this.err(line, 'TypeError', name + '() には整数を渡してください', ''); const base = { hex: 16, bin: 2, oct: 8 }[name]; const pre = { hex: '0x', bin: '0b', oct: '0o' }[name]; return (v.v < 0 ? '-' : '') + pre + Math.abs(v.v).toString(base); }
    case 'map': {
      const seqs = args.slice(1).map(a => this.iterable(a, line)); if (seqs.some(x => x === null)) return UNK();
      const len = Math.min(...seqs.map(x => x.length)); const out = [];
      for (let i = 0; i < len; i++) { const r = this.callFn(args[0], seqs.map(x => x[i]), env, line); if (isUnk(r) && isUnk(args[0])) return UNK(); out.push(r); }
      return ITER(out, 'map');
    }
    case 'filter': {
      const seq = this.iterable(args[1], line); if (seq === null) return UNK(); const out = [];
      for (const x of seq) { const r = isNone(args[0]) ? x : this.callFn(args[0], [x], env, line); const t = truthy(r); if (t === null) return UNK(); if (t) out.push(x); }
      return ITER(out, 'filter');
    }
    case 'input': {
      this.step(line, 'キーボードからの入力を待ちます（入力された値は実行時に決まります）');
      return UNK('入力された値');
    }
    case 'len': {
      const v = args[0];
      if (isUnk(v)) return UNK();
      if (typeof v === 'string') return NUM(Array.from(v).length, false);
      if (isIter(v)) this.err(line, 'TypeError', v.kind + ' オブジェクトには長さ（len）がありません', 'list() で並びに変えてから len() を使ってください');
      if (isList(v)) return NUM(v.__list.length, false);
      if (isTuple(v)) return NUM(v.__tuple.length, false);
      if (isDict(v)) return NUM(v.__dict.size, false);
      if (isSet(v)) return NUM(v.__set.length, false);
      if (isView(v)) return NUM(v.__view.__dict.size, false);
      if (v && v.__range) return NUM(v.__range.length, false);
      this.err(line, 'TypeError', typeName(v) + ' には長さ（len）がありません', 'len() は文字列・リスト・辞書など「集まり」に使います');
      return UNK();
    }
    case 'range': {
      const ns = args.map(a => { if (!isNum(a)) { if (isUnk(a)) return null; this.err(line, 'TypeError', 'range() の引数は整数にしてください', ''); } return Math.trunc(a.v); });
      if (ns.some(x => x === null)) return UNK();
      let start = 0, stop, step = 1;
      if (ns.length === 1) stop = ns[0]; else if (ns.length === 2) { start = ns[0]; stop = ns[1]; } else { start = ns[0]; stop = ns[1]; step = ns[2]; }
      if (step === 0) this.err(line, 'ValueError', 'range() の3つ目（間隔）を 0 にはできません', '');
      const count = step > 0 ? Math.max(0, Math.ceil((stop - start) / step)) : Math.max(0, Math.ceil((start - stop) / -step));
      if (count > MAX_RANGE) return UNK('要素がとても多い range・この説明では展開しません');
      const arr = [];
      for (let k = 0; k < count; k++) arr.push(NUM(start + k * step, false));
      const r = RANGE(arr); r.rng = [start, stop, step]; return r;
    }
    case 'str': return args.length === 0 ? '' : strVal(args[0]);
    case 'int': {
      const v = args[0];
      if (isUnk(v)) return UNK();
      if (args.length === 0) return NUM(0, false);
      if (isNum(v)) { if (!Number.isFinite(v.v)) this.err(line, Number.isNaN(v.v) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数に変換できません', ''); const n = Math.trunc(v.v); return SAFE(n) ? NUM(n === 0 ? 0 : n, false) : BIG(); }
      if (isBool(v)) return NUM(v.v ? 1 : 0, false);
      if (typeof v === 'string') {
        let base = args.length > 1 && isNum(args[1]) ? Math.trunc(args[1].v) : 10;
        let t = v.trim().replace(/_/g, ''); let sign = 1;
        if (/^[+-]/.test(t)) { if (t[0] === '-') sign = -1; t = t.slice(1); }
        const pm = /^0([xob])/i.exec(t);
        if (pm) { const pb = { x: 16, o: 8, b: 2 }[pm[1].toLowerCase()]; if (base === 0 || base === pb) { base = pb; t = t.slice(2); } }
        if (base === 0) base = 10;
        const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
        if (t && [...t.toLowerCase()].every(ch => digits.includes(ch))) { const n = parseInt(t, base) * sign; return SAFE(n) ? NUM(n, false) : BIG(); }
        this.err(line, 'ValueError', '文字列「' + v + '」は整数に変換できません', 'int() で変えられるのは "123" のような数字だけの文字列です');
      }
      this.err(line, 'TypeError', typeName(v) + ' は int() で変換できません', '');
      return UNK();
    }
    case 'float': {
      const v = args[0];
      if (isUnk(v)) return UNK();
      if (isNum(v)) return NUM(v.v, true);
      if (isBool(v)) return NUM(v.v ? 1 : 0, true);
      if (args.length === 0) return NUM(0, true);
      if (typeof v === 'string') { const t = v.trim().replace(/_/g, ''); const sp = /^([+-]?)(inf|infinity|nan)$/i.exec(t); if (sp) return NUM(/nan/i.test(sp[2]) ? NaN : (sp[1] === '-' ? -Infinity : Infinity), true); if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NUM(parseFloat(t), true); this.err(line, 'ValueError', '文字列「' + v + '」は小数に変換できません', ''); }
      this.err(line, 'TypeError', typeName(v) + ' は float() で変換できません', '');
      return UNK();
    }
    case 'bool': { const t = truthy(args[0]); return t === null ? UNK() : BOOL(t); }
    case 'list': case 'tuple': case 'set': {
      if (args.length === 0) return name === 'list' ? LIST() : name === 'tuple' ? TUPLE() : SET();
      const seq = this.iterable(args[0], line, true);
      if (seq === null) { if (isUnk(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }
      if (name === 'list') return LIST(seq);
      if (name === 'tuple') return TUPLE(seq);
      const out = []; for (const x of seq) { this.needHash(x, line); if (!out.some(y => eqVal(x, y) === true)) out.push(x); }
      return SET(out);
    }
    case 'dict': {
      const d = DICT();
      if (args.length) {
        if (isUnk(args[0])) return UNK();
        if (isDict(args[0])) { for (const [id, e] of args[0].__dict) d.__dict.set(id, e); }
        else {
          const seq = this.iterable(args[0], line, true); if (seq === null) { this.err(line, 'TypeError', typeName(args[0]) + ' から dict() は作れません', ''); }
          for (const p of seq) { const kv = isList(p) ? p.__list : isTuple(p) ? p.__tuple : null; if (!kv || kv.length !== 2) this.err(line, 'ValueError', 'dict() には (キー, 値) の組の並びを渡してください', ''); if (isUnk(kv[0])) return UNK(); this.needHash(kv[0], line); dictSet(d, kv[0], kv[1]); }
        }
      }
      for (const k of Object.keys(kw)) dictSet(d, k, kw[k]);
      return d;
    }
    case 'sum': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      let acc = args.length > 1 ? args[1] : kw.start !== undefined ? kw.start : NUM(0, false);
      if (seq.some(isUnk) || isUnk(acc)) return UNK();
      if (typeof acc === 'string') this.err(line, 'TypeError', 'sum() で文字列は連結できません', '文字列の連結には \'\'.join(...) を使ってください');
      const allNum = [acc, ...seq].every(x => isNum(x) || isBool(x));
      if (allNum && [acc, ...seq].some(x => isNum(x) && x.f)) { // Python 3.12 の sum は小数を補償加算する
        let sm = 0, cmp = 0;
        for (const x of [acc, ...seq]) { const v = isBool(x) ? (x.v ? 1 : 0) : x.v; const t = sm + v; if (Math.abs(sm) >= Math.abs(v)) cmp += (sm - t) + v; else cmp += (v - t) + sm; sm = t; }
        return NUM(sm + cmp, true);
      }
      for (const x of seq) acc = this.binOp('+', acc, x, line);
      return acc;
    }
    case 'min': case 'max': {
      let items = args.length === 1 ? this.iterable(args[0], line) : args;
      if (items === null) return UNK();
      if (!items.length) { if (kw.default !== undefined) return kw.default; this.err(line, 'ValueError', name + '() に空の集まりを渡すことはできません', '要素が1つ以上あるときに使ってください'); }
      const keys = this.keyed(items, kw.key && !isNone(kw.key) ? kw.key : null, env, line); if (keys === null) return UNK();
      let bi = 0;
      for (let i = 1; i < items.length; i++) { const c = this.compare(name === 'min' ? '<' : '>', keys[i], keys[bi], line); if (isUnk(c)) return UNK(); if (c.v) bi = i; }
      return items[bi];
    }
    case 'abs': { const v = args[0]; if (isUnk(v)) return UNK(); if (isNum(v)) return NUM(Math.abs(v.v), v.f); this.err(line, 'TypeError', typeName(v) + ' には abs() は使えません', '数値に使ってください'); return UNK(); }
    case 'round': {
      const v = args[0]; if (isUnk(v)) return UNK();
      const nd = args.length > 1 ? args[1] : kw.ndigits;
      if (isBool(v)) return NUM(v.v ? 1 : 0, false);
      if (!isNum(v)) this.err(line, 'TypeError', 'round() は数値に使います', '');
      if (nd !== undefined && !isNone(nd)) {
        if (isUnk(nd)) return UNK();
        const p = Math.trunc(nd.v);
        if (!v.f) { if (p >= 0) return v; return UNK('round の結果'); }
        if (!Number.isFinite(v.v)) return v;
        if (p < 0 || p > 30) return UNK('round の結果');
        return NUM(parseFloat(decFixed(v.v, p)), true); // 2進数の正確な値を偶数丸め（round(2.675, 2) は 2.67）
      }
      if (!v.f) return v;
      if (!Number.isFinite(v.v)) this.err(line, Number.isNaN(v.v) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数に丸められません', '');
      const n = parseInt(decFixed(v.v, 0), 10); // 偶数丸め（round(2.5) は 2）
      return SAFE(n) ? NUM(n === 0 ? 0 : n, false) : BIG();
    }
    case 'sorted': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      const rev = kw.reverse !== undefined && truthy(kw.reverse) === true;
      const keys = this.keyed(seq, kw.key && !isNone(kw.key) ? kw.key : null, env, line); if (keys === null) return UNK();
      const idx = seq.map((_, i) => i);
      idx.sort((a, b) => { const c = this.cmpVals(keys[a], keys[b], line); return (rev ? -c : c) || a - b; });
      return LIST(idx.map(i => seq[i]));
    }
    case 'reversed': { const seq = this.iterable(args[0], line); if (seq === null) return UNK(); return ITER(seq.slice().reverse(), 'reversed'); }
    case 'enumerate': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      const sv = args.length > 1 ? args[1] : kw.start;
      if (sv !== undefined && isUnk(sv)) return UNK();
      const start = sv !== undefined && isNum(sv) ? Math.trunc(sv.v) : 0;
      return ITER(seq.map((x, i) => TUPLE([NUM(start + i, false), x])), 'enumerate');
    }
    case 'zip': {
      const seqs = args.map(a => this.iterable(a, line, true));
      if (seqs.some(s => s === null)) return UNK();
      const len = seqs.length ? Math.min(...seqs.map(s => s.length)) : 0;
      const out = [];
      for (let i = 0; i < len; i++) out.push(TUPLE(seqs.map(s => s[i])));
      return ITER(out, 'zip');
    }
    case 'type': return isUnk(args[0]) ? UNK('型は実行時に決まります') : TYPEVAL(typeName(args[0]));
    case 'isinstance': {
      const want = args[1];
      if (isUnk(args[0])) return UNK();
      if (want && want.__type) return BOOL(typeName(args[0]) === want.__type || (want.__type === 'int' && isBool(args[0])));
      if (want && want.__builtin) { const map = { int: 'int', float: 'float', str: 'str', bool: 'bool', list: 'list', dict: 'dict', tuple: 'tuple', set: 'set' }; const wn = map[want.__builtin]; if (wn) return BOOL(typeName(args[0]) === wn || (wn === 'int' && isBool(args[0]))); }
      return UNK();
    }
    case 'ord': { const v = args[0]; if (isUnk(v)) return UNK(); if (typeof v === 'string' && Array.from(v).length === 1) return NUM(v.codePointAt(0), false); this.err(line, 'TypeError', 'ord() は1文字の文字列に使います', ''); return UNK(); }
    case 'chr': { const v = args[0]; if (isNum(v)) return String.fromCodePoint(Math.trunc(v.v)); return UNK(); }
    case 'divmod': { const a = args[0], b = args[1]; if (isNum(a) && isNum(b)) { if (b.v === 0) this.err(line, 'ZeroDivisionError', '0 で割ることはできません', ''); return TUPLE([this.binOp('//', a, b, line), this.binOp('%', a, b, line)]); } return UNK(); }
    case 'pow': { let r = this.binOp('**', args[0], args[1], line); if (args.length === 3) { if (isNum(r) && isNum(args[2])) { if (args[2].v === 0) this.err(line, 'ValueError', 'pow() の3つ目（割る数）を 0 にはできません', ''); r = this.binOp('%', NUM(Math.trunc(r.v), false), args[2], line); } } return r; }
    case 'any': case 'all': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      let known = seq.length === 0; // 空なら any=False / all=True で確定
      for (const x of seq) { const t = truthy(x); if (t === null) continue; known = true; if (name === 'any' && t) return BOOL(true); if (name === 'all' && !t) return BOOL(false); }
      return known ? BOOL(name === 'all') : UNK();
    }
    case 'open': this.diag(line, 'note', '対応外', 'ファイルを開く処理（open）はこの説明では中身を読みません。読み取った内容は「実行時に決まる値」として扱います', ''); return UNK('ファイルの内容');
  }
  this.diag(line, 'note', '対応外', '組み込みの「' + name + '」はこの説明では解釈しません。結果は「実行時に決まる値」として扱います', '');
  return UNK(name + ' の結果');
};
Interp.prototype.cmpVals = function (a, b, line) {
  if (isUnk(a) || isUnk(b)) return 0;
  const c = this.compare('<', a, b, line);
  if (isBool(c)) return c.v ? -1 : (eqVal(a, b) === true ? 0 : 1);
  return 0;
};

Interp.prototype.callMethod = function (obj, name, args, kwargs, env, line) {
  if (isUnk(obj)) return UNK();
  if (isNone(obj)) this.err(line, 'AttributeError', 'None にはメソッド「' + name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');
  const arityErr = (need) => this.err(line, 'TypeError', 'メソッド「' + name + '」の引数の数が合いません（' + need + '）', 'リファレンスで使い方を確認してください');
  if (typeof obj === 'string') {
    const S = (f, min, max) => { if (args.length < min || args.length > max) arityErr(min === max ? min + ' 個必要' : min + '〜' + max + ' 個'); return f(); };
    switch (name) {
      case 'upper': return S(() => obj.toUpperCase(), 0, 0);
      case 'lower': return S(() => obj.toLowerCase(), 0, 0);
      case 'title': return S(() => obj.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()), 0, 0);
      case 'capitalize': return S(() => obj.charAt(0).toUpperCase() + obj.slice(1).toLowerCase(), 0, 0);
      case 'strip': return S(() => obj.trim(), 0, 0);
      case 'lstrip': return S(() => obj.replace(/^\s+/, ''), 0, 0);
      case 'rstrip': return S(() => obj.replace(/\s+$/, ''), 0, 0);
      case 'split': return S(() => {
        if (args.length === 0) return LIST(obj.split(/\s+/).filter(x => x !== ''));
        const sep = args[0]; if (typeof sep !== 'string') this.err(line, 'TypeError', 'split() の区切りは文字列にしてください', '');
        if (sep === '') this.err(line, 'ValueError', '区切りに空文字列は使えません', '');
        return LIST(obj.split(sep));
      }, 0, 1);
      case 'join': return S(() => { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); if (!seq.every(x => typeof x === 'string')) this.err(line, 'TypeError', 'join() は文字列の集まりに使います', '数値の集まりは str() で変えてから使ってください'); return seq.join(obj); }, 1, 1);
      case 'replace': return S(() => { if (typeof args[0] !== 'string' || typeof args[1] !== 'string') this.err(line, 'TypeError', 'replace() には文字列を2つ渡してください', ''); if (args[0] === '') return obj; const cnt = args[2] && isNum(args[2]) ? Math.trunc(args[2].v) : -1; let out = obj, used = 0; while (cnt < 0 || used < cnt) { const at = out.indexOf(args[0]); if (at < 0) break; out = out.slice(0, at) + args[1] + out.slice(at + args[0].length); used++; if (cnt < 0 && used > 10000) break; } return out; }, 2, 3);
      case 'find': return S(() => typeof args[0] === 'string' ? NUM(obj.indexOf(args[0]), false) : UNK(), 1, 1);
      case 'index': return S(() => { const at = typeof args[0] === 'string' ? obj.indexOf(args[0]) : -1; if (at < 0) this.err(line, 'ValueError', '文字列「' + args[0] + '」は見つかりません', 'find() を使うと、無いときに -1 が返ります'); return NUM(at, false); }, 1, 1);
      case 'count': return S(() => typeof args[0] === 'string' && args[0] !== '' ? NUM(obj.split(args[0]).length - 1, false) : NUM(0, false), 1, 1);
      case 'startswith': return S(() => typeof args[0] === 'string' ? BOOL(obj.startsWith(args[0])) : UNK(), 1, 1);
      case 'endswith': return S(() => typeof args[0] === 'string' ? BOOL(obj.endsWith(args[0])) : UNK(), 1, 1);
      case 'isdigit': return S(() => BOOL(/^\d+$/.test(obj)), 0, 0);
      case 'isalpha': return S(() => BOOL(/^[^\d\s\W]+$/u.test(obj) && obj.length > 0), 0, 0);
      case 'format': this.diag(line, 'note', '対応外', '文字列の format() はこの説明では解釈できません', 'f文字列を使うと説明できます'); return UNK();
    }
  }
  if (isList(obj)) {
    switch (name) {
      case 'append': if (args.length !== 1) arityErr('1 個必要'); obj.__list.push(args[0]); this.step(line, 'リストの末尾に ' + reprVal(args[0]) + ' を追加します（要素は ' + obj.__list.length + ' 個になりました）'); return NONE;
      case 'extend': { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); obj.__list.push(...seq); this.step(line, 'リストに ' + seq.length + ' 個の要素を追加します（要素は ' + obj.__list.length + ' 個になりました）'); return NONE; }
      case 'insert': { if (args.length !== 2 || !isNum(args[0])) arityErr('番号と値の2個必要'); let i = Math.trunc(args[0].v); if (i < 0) i = Math.max(0, obj.__list.length + i); if (i > obj.__list.length) i = obj.__list.length; obj.__list.splice(i, 0, args[1]); this.step(line, 'リストの ' + i + ' 番目に ' + reprVal(args[1]) + ' を入れます'); return NONE; }
      case 'pop': { if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); let i = args.length && isNum(args[0]) ? Math.trunc(args[0].v) : obj.__list.length - 1; if (i < 0) i += obj.__list.length; if (i < 0 || i >= obj.__list.length) this.err(line, 'IndexError', 'pop() の番号が範囲外です', ''); const v = obj.__list.splice(i, 1)[0]; this.step(line, 'リストから ' + reprVal(v) + ' を取り出して消します'); return v; }
      case 'remove': { const at = obj.__list.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); obj.__list.splice(at, 1); this.step(line, 'リストから ' + reprVal(args[0]) + ' を消します'); return NONE; }
      case 'index': { const at = obj.__list.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); return NUM(at, false); }
      case 'count': return NUM(obj.__list.filter(x => eqVal(x, args[0]) === true).length, false);
      case 'sort': {
        const rev = kwargs && kwargs.reverse !== undefined ? truthy(this.eval(kwargs.reverse, env)) === true : false;
        const keyFn = kwargs && kwargs.key ? this.eval(kwargs.key, env) : null;
        const keys = this.keyed(obj.__list, keyFn && !isNone(keyFn) ? keyFn : null, env, line);
        if (keys === null) { const n = obj.__list.length; obj.__list.length = 0; for (let i = 0; i < n; i++) obj.__list.push(UNK('並べ替え後の要素')); this.step(line, 'リストを並べ替えます（並べ替えの基準が実行時に決まるため、結果は分かりません）'); return NONE; }
        const idx = obj.__list.map((_, i) => i); const vals = obj.__list.slice();
        idx.sort((a, b) => { const c = this.cmpVals(keys[a], keys[b], line); return (rev ? -c : c) || a - b; });
        obj.__list.length = 0; idx.forEach(i => obj.__list.push(vals[i]));
        this.step(line, 'リストを並べ替えます → ' + reprVal(obj)); return NONE;
      }
      case 'reverse': obj.__list.reverse(); this.step(line, 'リストの並びを逆にします → ' + reprVal(obj)); return NONE;
      case 'copy': return LIST(obj.__list.slice());
      case 'clear': obj.__list.length = 0; this.step(line, 'リストを空にします'); return NONE;
    }
  }
  if (isDict(obj)) {
    switch (name) {
      case 'get': { const v = dictGet(obj, args[0]); if (v !== undefined) return v; if ([...obj.__dict.values()].some(e => eqVal(e.k, args[0]) === true)) return obj.__dict.get(dictKeyId(args[0])).v; return args.length > 1 ? args[1] : NONE; }
      case 'keys': return VIEW(obj, 'keys');
      case 'values': return VIEW(obj, 'values');
      case 'items': return VIEW(obj, 'items');
      case 'update': { if (isDict(args[0])) { for (const e of args[0].__dict.values()) dictSet(obj, e.k, e.v); this.step(line, '辞書をまとめて更新します → ' + reprVal(obj)); } return NONE; }
      case 'pop': { const id = dictKeyId(args[0]); if (id === null || !obj.__dict.has(id)) { if (args.length > 1) return args[1]; this.err(line, 'KeyError', 'キー ' + reprVal(args[0]) + ' は辞書にありません', ''); } const v = obj.__dict.get(id).v; obj.__dict.delete(id); this.step(line, '辞書からキー ' + reprVal(args[0]) + ' を消します'); return v; }
      case 'setdefault': { const cur = dictGet(obj, args[0]); if (cur !== undefined) return cur; dictSet(obj, args[0], args.length > 1 ? args[1] : NONE); return args.length > 1 ? args[1] : NONE; }
      case 'copy': { const d = DICT(); for (const [id, e] of obj.__dict) d.__dict.set(id, e); return d; }
      case 'clear': obj.__dict.clear(); this.step(line, '辞書を空にします'); return NONE;
    }
  }
  if (isSet(obj)) {
    switch (name) {
      case 'add': this.needHash(args[0], line); obj.__set.push(args[0]); if (!obj.__set.slice(0, -1).some(x => eqVal(x, args[0]) === true)) this.step(line, '集合に ' + reprVal(args[0]) + ' を追加します'); else obj.__set.pop(); return NONE;
      case 'remove': { const at = obj.__set.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'KeyError', reprVal(args[0]) + ' は集合にありません', ''); obj.__set.splice(at, 1); return NONE; }
      case 'discard': { const at = obj.__set.findIndex(x => eqVal(x, args[0]) === true); if (at >= 0) obj.__set.splice(at, 1); return NONE; }
      case 'union': { const seq = this.iterable(args[0], line, true) || []; const out = obj.__set.slice(); for (const x of seq) if (!out.some(y => eqVal(x, y) === true)) out.push(x); return SET(out); }
      case 'intersection': { const seq = this.iterable(args[0], line, true) || []; return SET(obj.__set.filter(x => seq.some(y => eqVal(x, y) === true))); }
      case 'difference': { const seq = this.iterable(args[0], line, true) || []; return SET(obj.__set.filter(x => !seq.some(y => eqVal(x, y) === true))); }
      case 'copy': return SET(obj.__set.slice());
    }
  }
  if (obj && obj.__range && name === 'count') return NUM(obj.__range.filter(x => eqVal(x, args[0]) === true).length, false);
  if (isTuple(obj) && name === 'count') return NUM(obj.__tuple.filter(x => eqVal(x, args[0]) === true).length, false);
  if (isTuple(obj) && name === 'index') { const at = obj.__tuple.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はタプルにありません', ''); return NUM(at, false); }
  // モジュール属性など
  if (obj && typeof obj === 'object' && obj.__unk) return UNK();
  this.diag(line, 'note', '対応外', typeName(obj) + ' の「' + name + '」はこの説明では解釈できません', 'リファレンスで使い方を確認し、実際の動きは実行して確かめてください');
  return UNK(typeName(obj) + '.' + name + ' の結果');
};

Interp.prototype.evalComp = function (n, env) {
  const child = new Env(env);
  const results = [];
  const self = this;
  let unk = false;
  function* gen(idx) {
    if (idx >= n.gens.length) { yield true; return; }
    const g = n.gens[idx];
    const it = self.eval(g.iter, child);
    const seq = self.iterable(it, n.line, isUnk(it));
    if (seq === null) { unk = true; return; }
    for (const item of seq) {
      self.tick();
      self.assignToQuiet(g.target, item, child);
      let ok = true;
      for (const c of g.conds) { const t = truthy(self.eval(c, child)); if (t === null) { unk = true; return; } if (t !== true) { ok = false; break; } }
      if (ok) yield* gen(idx + 1);
    }
  }
  for (const _ of gen(0)) {
    if (unk) break;
    if (n.k === 'listcomp') results.push(this.eval(n.elt, child));
    else if (n.k === 'setcomp') { const v = this.eval(n.elt, child); this.needHash(v, n.line); if (!results.some(x => eqVal(x, v) === true)) results.push(v); }
    else { const k = this.eval(n.keyE, child); const v = this.eval(n.valE, child); if (isUnk(k)) { unk = true; break; } this.needHash(k, n.line); results.push([k, v]); }
    if (results.length > 10000) { unk = true; break; }
  }
  if (unk) return UNK('実行時に決まる内包表記の結果');
  if (n.k === 'listcomp') return LIST(results);
  if (n.k === 'setcomp') return SET(results);
  const d = DICT();
  for (const [k, v] of results) dictSet(d, k, v);
  return d;
};
Interp.prototype.assignToQuiet = function (t, v, env) {
  if (t.k === 'name') { env.set(t.name, v); return; }
  if (t.k === 'starred') { this.assignToQuiet(t.t, v, env); return; }
  if (t.k === 'ttuple') { const items = isList(v) ? v.__list : isTuple(v) ? v.__tuple : []; t.items.forEach((it, i) => this.assignToQuiet(it, items[i] || UNK(), env)); }
  if (t.k === 'tuple') { const items = isList(v) ? v.__list : isTuple(v) ? v.__tuple : []; t.items.forEach((it, i) => this.assignToQuiet(it.e, items[i] || UNK(), env)); }
};

function padTo(s, fill, align, width) {
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

/* ============ 入口 ============ */
function simulatePython(code) {
  const { lines, diags } = splitLines(String(code || ''));
  const allDiags = diags.slice();
  if (!lines.length) return { diags: allDiags, steps: [], output: [], vars: [], empty: true };
  let stmts;
  try { stmts = parseProgram(lines); }
  catch (e) {
    if (e instanceof SimDiag) { allDiags.push({ line: e.line, level: 'error', kind: e.kind, msg: e.message, fix: e.fix }); return { diags: allDiags, steps: [], output: [], vars: [], parseFailed: true }; }
    throw e;
  }
  const interp = new Interp();
  const r = interp.run(stmts);
  return { diags: allDiags.concat(r.diags), steps: r.steps, output: r.output, vars: r.vars };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { simulatePython };
if (typeof window !== 'undefined') window.PySim = { simulatePython };
