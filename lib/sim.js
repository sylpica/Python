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
const EXC = (kind, text, argRepr) => ({ __exc: true, kind, text, argRepr: argRepr || '' }); // except ... as e で束縛する例外値（str(e) が分かるときだけ作る）
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
const ITER = (a, kind) => ({ __iter: a, kind, used: false, pos: 0 });
const EXH = Symbol('exhausted'); // zip/map の歩調消費で「取り尽くした」を表す目印
const isIter = (v) => !!v && typeof v === 'object' && Array.isArray(v.__iter);
const VIEW = (d, which) => ({ __view: d, which });
const isView = (v) => !!v && typeof v === 'object' && v.__view !== undefined;
function viewItems(v) { const out = []; for (const e of v.__view.__dict.values()) out.push(v.which === 'keys' ? e.k : v.which === 'values' ? e.v : TUPLE([e.k, e.v])); return out; }
// 関数内で代入される名前の「代入前」の状態（読むと UnboundLocalError）
const UNBOUND = { __unbound: true };
const SAFE = (n) => Number.isSafeInteger(n);
const TYPE_BUILTINS = ['int', 'float', 'str', 'bool', 'list', 'tuple', 'dict', 'set', 'range', 'type', 'object', 'frozenset', 'bytes', 'complex'];
// 型ごとの属性名（CPython 3.12 の dir() から。存在しない名前は AttributeError）
const TYPE_ATTRS = {
  str: 'capitalize casefold center count encode endswith expandtabs find format format_map index isalnum isalpha isascii isdecimal isdigit isidentifier islower isnumeric isprintable isspace istitle isupper join ljust lower lstrip maketrans partition removeprefix removesuffix replace rfind rindex rjust rpartition rsplit rstrip split splitlines startswith strip swapcase title translate upper zfill',
  list: 'append clear copy count extend index insert pop remove reverse sort',
  dict: 'clear copy fromkeys get items keys pop popitem setdefault update values',
  tuple: 'count index',
  set: 'add clear copy difference difference_update discard intersection intersection_update isdisjoint issubset issuperset pop remove symmetric_difference symmetric_difference_update union update',
  int: 'as_integer_ratio bit_count bit_length conjugate denominator from_bytes imag is_integer numerator real to_bytes',
  float: 'as_integer_ratio conjugate fromhex hex imag is_integer real',
  bool: 'as_integer_ratio bit_count bit_length conjugate denominator from_bytes imag is_integer numerator real to_bytes',
  NoneType: ''
};
for (const k of Object.keys(TYPE_ATTRS)) TYPE_ATTRS[k] = new Set(TYPE_ATTRS[k].split(' ').filter(Boolean));
const MATH_CONST = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, nan: NaN };
const BIG = () => ({ __unk: true, desc: 'とても大きな整数・この説明では正確に計算しません' });
const ELLIPSIS = { __ellipsis: true };
const isEllipsis = (v) => v === ELLIPSIS;
// 束縛メソッド参照（xs.append を変数に入れた形）。呼ぶと本物のメソッドとして動く
const METHODREF = (obj, name) => ({ __method: true, obj, name });
const isMethodRef = (v) => !!v && typeof v === 'object' && v.__method === true;
// 追跡できない書き換えを受けた値は、その場で「不明」に変える（別名からも不明に見える）
function poison(v, desc) {
  if (!v || typeof v !== 'object' || isUnk(v) || isFunc(v)) return;
  for (const k of Object.keys(v)) delete v[k];
  v.__unk = true; v.desc = desc || '中身が実行時に決まる値';
}
const isMutableVal = (v) => isList(v) || isDict(v) || isSet(v) || isTuple(v) || (v && !!v.__range) || isIter(v);

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
  if (v && v.__builtin) return TYPE_BUILTINS.includes(v.__builtin) ? 'type' : 'builtin_function_or_method';
  if (isFunc(v)) return 'function';
  if (v && v.__range) return 'range';
  if (v && v.__type) return 'type';
  if (isIter(v)) return v.kind;
  if (isView(v)) return 'dict_' + v.which;
  if (isMethodRef(v)) return 'builtin_function_or_method';
  if (isEllipsis(v)) return 'ellipsis';
  if (v && v.__class) return 'type';
  if (v && v.__exc) return v.kind;
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
// double の正確な10進展開：{digits, scale}（値 = digits × 10^scale、digits は末尾ゼロを除いた整数文字列）
function exactDecimal(ax) {
  if (ax === 0) return { digits: '0', scale: 0 };
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, ax);
  const bits = buf.getBigUint64(0);
  const expBits = Number((bits >> 52n) & 0x7ffn);
  let mant = bits & ((1n << 52n) - 1n);
  let e2;
  if (expBits === 0) e2 = -1074; else { mant |= (1n << 52n); e2 = expBits - 1075; }
  let digits, scale;
  if (e2 >= 0) { digits = (mant << BigInt(e2)).toString(); scale = 0; }
  else { digits = (mant * (5n ** BigInt(-e2))).toString(); scale = e2; }
  while (digits.length > 1 && digits.endsWith('0')) { digits = digits.slice(0, -1); scale++; }
  return { digits, scale };
}
function incDigits(s) { const a = s.split(''); let i = a.length - 1; while (i >= 0 && a[i] === '9') { a[i] = '0'; i--; } if (i < 0) return '1' + a.join(''); a[i] = String(Number(a[i]) + 1); return a.join(''); }
// 桁文字列 head と捨てる部分 rest から、偶数丸めで切り上げるか決める
function roundUpHalfEven(head, rest) {
  if (!rest) return false;
  if (rest[0] > '5') return true;
  if (rest[0] < '5') return false;
  if (/[1-9]/.test(rest.slice(1))) return true;
  return (head.charCodeAt(head.length - 1) - 48) % 2 === 1;
}
// x の正確な10進値を、小数 p 桁に「偶数丸め」する（Python の round / 書式 f と同じ規則）。文字列を返す
function decFixed(x, p) {
  const neg = x < 0 || Object.is(x, -0); const ax = Math.abs(x);
  if (!Number.isFinite(ax)) return String(x);
  const { digits, scale } = exactDecimal(ax);
  const total = digits.length + scale + p; // round(|x| × 10^p) の桁数（捨てる位置）
  let kept;
  if (total >= digits.length) kept = digits + '0'.repeat(total - digits.length);
  else if (total <= 0) kept = total === 0 && roundUpHalfEven('0', digits) ? '1' : '0';
  else { const head = digits.slice(0, total); kept = roundUpHalfEven(head, digits.slice(total)) ? incDigits(head) : head; }
  let body;
  if (p === 0) body = kept;
  else { const s = kept.padStart(p + 1, '0'); body = s.slice(0, s.length - p) + '.' + s.slice(s.length - p); }
  const sign = neg && (/[1-9]/.test(body) || ax > 0 || Object.is(x, -0)) ? '-' : '';
  return sign + body;
}
/* ============ int()/float() の文字列解釈（CPython の規則） ============ */
// Unicode の10進数字（Nd）を ASCII に直す。各ブロックの「0」のコードポイント表を使う
const ND_ZEROS = [0x30, 0x660, 0x6F0, 0x7C0, 0x966, 0x9E6, 0xA66, 0xAE6, 0xB66, 0xBE6, 0xC66, 0xCE6, 0xD66, 0xDE6, 0xE50, 0xED0, 0xF20, 0x1040, 0x1090, 0x17E0, 0x1810, 0x1946, 0x19D0, 0x1A80, 0x1A90, 0x1B50, 0x1BB0, 0x1C40, 0x1C50, 0xA620, 0xA8D0, 0xA900, 0xA9D0, 0xA9F0, 0xAA50, 0xABF0, 0xFF10];
function normDigits(s) {
  if (!/[^\x00-\x7F]/.test(s)) return s;
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 128) { out += ch; continue; }
    let rep = null;
    for (const z of ND_ZEROS) { const d = cp - z; if (d >= 0 && d <= 9) { rep = String(d); break; } }
    out += rep === null ? ch : rep;
  }
  return out;
}
// アンダースコアは「数字どうしの間」だけ（int では基数接頭辞の直後の1個も可）。CPython の規則
function usOkInt(body, afterPrefix) {
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '_') continue;
    const prevOk = (i > 0 && /[0-9A-Za-z]/.test(body[i - 1])) || (afterPrefix && i === 0);
    const nextOk = i + 1 < body.length && /[0-9A-Za-z]/.test(body[i + 1]);
    if (!prevOk || !nextOk) return false;
  }
  return true;
}
function usOkFloat(t) {
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '_') continue;
    if (!/[0-9]/.test(t[i - 1] || '') || !/[0-9]/.test(t[i + 1] || '')) return false;
  }
  return true;
}
// 文字列→整数（CPython 規則）。{n} か {big:true}（安全な範囲外）か {err:true}（ValueError）を返す
function pyIntFromStr(v, baseArg) {
  let t = normDigits(v.trim());
  let neg = false;
  if (/^[+-]/.test(t)) { neg = t[0] === '-'; t = t.slice(1); }
  let base = baseArg, pre = false;
  const pm = /^0([xXoObB])/.exec(t);
  if (pm) { const pb = { x: 16, o: 8, b: 2 }[pm[1].toLowerCase()]; if (base === 0 || base === pb) { base = pb; t = t.slice(2); pre = true; } }
  if (base === 0) base = 10;
  if (!t || !usOkInt(t, pre)) return { err: true };
  const body = t.replace(/_/g, '');
  if (!body) return { err: true };
  if (baseArg === 0 && !pre && body.length > 1 && body[0] === '0') return { err: true }; // int("010", 0) は ValueError
  if (base === 10 && body.length > 4300) return { err: true }; // CPython の桁数制限
  if (body.length > 6000) return { big: true };
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let n = 0n; const B = BigInt(base);
  for (const ch of body) { const d = digits.indexOf(ch.toLowerCase()); if (d < 0 || d >= base) return { err: true }; n = n * B + BigInt(d); }
  if (neg) n = -n;
  if (n <= 9007199254740991n && n >= -9007199254740991n) return { n: Number(n) };
  return { big: true };
}
// pow(base, exp, mod) の BigInt 実装（負の指数はモジュラ逆数、結果の符号は mod に従う）
function modInvBig(a, m) { // m は正。gcd が 1 でなければ null
  let r0 = ((a % m) + m) % m, r1 = m, s0 = 1n, s1 = 0n;
  while (r1 !== 0n) { const q = r0 / r1; const r2 = r0 - q * r1; r0 = r1; r1 = r2; const s2 = s0 - q * s1; s0 = s1; s1 = s2; }
  if (r0 !== 1n) return null;
  return ((s0 % m) + m) % m;
}
function modPowBig(b, e, m) { // m != 0。{v:BigInt} か {err:'inv'}（逆数が無い）
  const negMod = m < 0n; const am = negMod ? -m : m;
  let base = ((b % am) + am) % am;
  let exp = e;
  if (exp < 0n) { const inv = modInvBig(base, am); if (inv === null) return { err: 'inv' }; base = inv; exp = -exp; }
  let r = am === 1n ? 0n : 1n;
  let bb = base, ee = exp;
  while (ee > 0n) { if (ee & 1n) r = (r * bb) % am; bb = (bb * bb) % am; ee >>= 1n; }
  if (negMod && r !== 0n) r -= am;
  return { v: r };
}
// 指数表記（書式 e）用：|x| を有効桁 p+1 桁に偶数丸めした {body, exp}
function decExp(x, p) {
  const ax = Math.abs(x);
  if (ax === 0) return { body: '0' + (p ? '.' + '0'.repeat(p) : ''), exp: 0 };
  const { digits, scale } = exactDecimal(ax);
  let exp = digits.length - 1 + scale;
  const need = p + 1;
  let kept;
  if (digits.length <= need) kept = digits.padEnd(need, '0');
  else { const head = digits.slice(0, need); kept = roundUpHalfEven(head, digits.slice(need)) ? incDigits(head) : head; if (kept.length > need) { kept = kept.slice(0, need); exp++; } }
  return { body: kept[0] + (p ? '.' + kept.slice(1) : ''), exp };
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
  if (isSet(v)) { if (!v.__set.length) return 'set()'; const ord = setOrder(v); if (ord) return '{' + ord.map(x => reprVal(x, depth + 1)).join(', ') + '}'; const inner = v.__set.map(x => reprVal(x, depth + 1)).join(', '); return /[（）]/.test(inner) ? '（集合・表示の並び順は実行時に決まります）' : '（集合 {' + inner + '}・表示の並び順は実行時に決まります）'; }
  if (v && v.__type) return "<class '" + v.__type + "'>";
  if (v && v.__class) return "<class '" + v.cname + "'>";
  if (v && v.__exc) return v.kind + '(' + v.argRepr + ')';
  if (isEllipsis(v)) return 'Ellipsis';
  if (isMethodRef(v)) return '（組み込みメソッド ' + v.name + '）';
  if (isFunc(v)) return '関数 ' + v.def.name;
  if (v && v.__builtin) return '組み込み関数 ' + v.__builtin;
  if (v && v.__range) { const r = v.rng || [0, v.__range.length, 1]; return 'range(' + r[0] + ', ' + r[1] + (r[2] !== 1 ? ', ' + r[2] : '') + ')'; }
  if (isIter(v)) return '（' + v.kind + ' オブジェクト）';
  if (isView(v)) return 'dict_' + v.which + '(' + reprVal(LIST(viewItems(v)), depth) + ')';
  return '（実行時に決まる値）'; // 表示できない内部の値は出さない
}
// 集合の表示順を CPython と同じに決められるときだけ、その順を返す（それ以外は null）。
// 0 以上の小さな整数だけで、すべてハッシュ表の大きさ未満なら、CPython の表は昇順に並ぶ。
// 文字列などはハッシュがプロセスごとに変わるため、順序は決められない。
function setOrder(v) {
  const a = v.__set; if (a.length < 2) return a.slice();
  const nums = a.map(x => isBool(x) ? (x.v ? 1 : 0) : (isNum(x) && Number.isInteger(x.v) && x.v >= 0 ? x.v : -1));
  if (nums.some(x => x < 0)) return null;
  let size = 8, fill = 0;
  for (let used = 1; used <= a.length; used++) { fill = used; if (fill * 5 >= (size - 1) * 3) { const minused = used > 50000 ? used * 2 : used * 4; size = 8; while (size <= minused) size *= 2; } }
  if (nums.some(x => x >= size)) return null;
  return a.map((x, i) => [nums[i], x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
}
// Python の str の repr（' を含み " を含まなければ " で囲む。制御文字はエスケープ）
function isPyWs(ch) { return /^[\s\x1c-\x1f\x85]$/.test(ch) && ch !== '\ufeff'; }
// str.split / rsplit（sep=None は空白区切り。maxsplit は -1 で無制限）
// タイトルケースが通常の大文字変換と異なる文字（合字と ǅ 系）。title()/capitalize() の先頭文字に使う
const TITLECASE = { 'ﬀ': 'Ff', 'ﬁ': 'Fi', 'ﬂ': 'Fl', 'ﬃ': 'Ffi', 'ﬄ': 'Ffl', 'ﬅ': 'St', 'ﬆ': 'St', 'ǆ': 'ǅ', 'ǉ': 'ǈ', 'ǌ': 'ǋ', 'ǳ': 'ǲ', 'ǆ́': 'ǅ́' };
function pyTitlecase(ch) { return TITLECASE[ch] || ch.toUpperCase(); }
// CPython の str.title()：大文字小文字のある文字が「単語の先頭」でタイトルケース、それ以外で小文字になる（アポストロフィも単語の区切り）
function pyTitle(s) {
  const CASED = /[\p{Ll}\p{Lu}\p{Lt}]/u;
  let out = '', prevCased = false;
  for (const ch of s) { if (CASED.test(ch)) { out += prevCased ? ch.toLowerCase() : pyTitlecase(ch); prevCased = true; } else { out += ch; prevCased = false; } }
  return out;
}
function pySplit(s, sep, max, fromRight) {
  if (sep === null) {
    const a = Array.from(s); const out = [];
    if (!fromRight) {
      let i = 0; const n = a.length;
      while (true) { while (i < n && isPyWs(a[i])) i++; if (i >= n) break; if (max >= 0 && out.length === max) { out.push(a.slice(i).join('')); break; } let j = i; while (j < n && !isPyWs(a[j])) j++; out.push(a.slice(i, j).join('')); i = j; }
      return out;
    }
    let j = a.length;
    while (true) { while (j > 0 && isPyWs(a[j - 1])) j--; if (j <= 0) break; if (max >= 0 && out.length === max) { out.unshift(a.slice(0, j).join('')); break; } let i = j; while (i > 0 && !isPyWs(a[i - 1])) i--; out.unshift(a.slice(i, j).join('')); j = i; }
    return out;
  }
  const parts = s.split(sep);
  if (max < 0 || parts.length <= max + 1) return parts;
  if (!fromRight) return parts.slice(0, max).concat([parts.slice(max).join(sep)]);
  return [parts.slice(0, parts.length - max).join(sep)].concat(parts.slice(parts.length - max));
}
const NONPRINT_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}\p{Zs}]$/u;
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
    else if (c !== 0x20 && NONPRINT_RE.test(ch)) { // CPython が「表示できない文字」としてエスケープする範囲
      if (c <= 0xff) out += '\\x' + c.toString(16).padStart(2, '0');
      else if (c <= 0xffff) out += '\\u' + c.toString(16).padStart(4, '0');
      else out += '\\U' + c.toString(16).padStart(8, '0');
    }
    else out += ch;
  }
  return q + out + q;
}
// print / str() 用の完全な表示（入れ子の深さで省略しない。循環参照は CPython と同じく [...] 等で示す）
function reprFull(v, seen) {
  seen = seen || new Set();
  if (isUnk(v)) return '（' + v.desc + '）';
  if (isNum(v)) return fmtNum(v);
  if (isBool(v)) return v.v ? 'True' : 'False';
  if (isNone(v)) return 'None';
  if (typeof v === 'string') return pyStrRepr(v);
  if (isEllipsis(v)) return 'Ellipsis';
  if (isList(v) || isTuple(v) || isDict(v) || isSet(v)) {
    if (seen.has(v)) return isList(v) ? '[...]' : isTuple(v) ? '(...)' : '{...}';
    seen.add(v);
    let out;
    if (isList(v)) out = '[' + v.__list.map(x => reprFull(x, seen)).join(', ') + ']';
    else if (isTuple(v)) out = v.__tuple.length === 1 ? '(' + reprFull(v.__tuple[0], seen) + ',)' : '(' + v.__tuple.map(x => reprFull(x, seen)).join(', ') + ')';
    else if (isDict(v)) { const ps = []; for (const e of v.__dict.values()) ps.push(reprFull(e.k, seen) + ': ' + reprFull(e.v, seen)); out = '{' + ps.join(', ') + '}'; }
    else if (!v.__set.length) out = 'set()';
    else { const ord = setOrder(v); const inner = (ord || v.__set).map(x => reprFull(x, seen)).join(', '); out = ord ? '{' + inner + '}' : (/[（）]/.test(inner) ? '（集合・表示の並び順は実行時に決まります）' : '（集合 {' + inner + '}・表示の並び順は実行時に決まります）'); }
    seen.delete(v);
    return out;
  }
  return reprVal(v);
}
function strVal(v) { // print / str() 用：文字列はそのまま、それ以外は repr とほぼ同じ
  if (typeof v === 'string') return v;
  if (isUnk(v)) return '（' + v.desc + '）';
  if (v && v.__exc) return v.text; // 例外の str() はメッセージそのもの
  return reprFull(v);
}
function eqVal(a, b) {
  if (isUnk(a) || isUnk(b)) return null;
  if (a === b) return true; // 同じオブジェクト同士は等しい（NaN が自分自身と等しくなるのもこのため）
  if ((a && a.__exc) || (b && b.__exc)) return false; // 例外の等しさは同一オブジェクトのときだけ（上で処理済み）
  if (isNum(a) && isNum(b)) return a.v === b.v;
  if (a && b && a.__range && b.__range) {
    const ra = a.rng, rb = b.rng;
    if (ra && rb) return ra[0] === rb[0] && ra[1] === rb[1] && ra[2] === rb[2];
    return a.__range.length === b.__range.length && a.__range.every((x, i) => eqVal(x, b.__range[i]) === true);
  }
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
  if (isBool(v)) return 'n:' + (v.v ? 1 : 0);
  if (typeof v === 'string') return 's:' + v;
  if (isNone(v)) return 'z:';
  if (isTuple(v)) { const ids = v.__tuple.map(dictKeyId); if (ids.some(x => x === null)) return null; return 't:' + ids.join('|'); }
  return null; // ハッシュ化できない
}
function dictGet(d, k) { const id = dictKeyId(k); if (id === null) return undefined; return d.__dict.get(id)?.v; }
function dictSet(d, k, v) { const id = dictKeyId(k); if (id === null) return false; const cur = d.__dict.get(id); d.__dict.set(id, { k: cur ? cur.k : k, v }); return true; }

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
  let carryStr = null; // 行継続（\）で次の行へ続く通常の文字列の引用符
  let pendingGlue = null; // 行継続（\）のとき、次の部品を空白なしでつなぐ
  for (let li = 0; li < rawLines.length; li++) {
    const raw = rawLines[li];
    const startedInTriple = carry !== null;
    const startedInStr = carryStr !== null;
    let i = 0, inStr = carryStr, esc = false, commentAt = -1, triple = carry;
    let inF = false, fExpr = 0, inInner = null; // f文字列の式 {…} の中では引用符を再利用できる（PEP 701）。式内の括弧・文字列を正しく数えるための状態
    for (; i < raw.length; i++) {
      const c = raw[i];
      if (esc) { esc = false; continue; }
      if (triple) { if (raw.substr(i, 3) === triple) { i += 2; triple = null; } continue; }
      if (inInner) { if (c === '\\') esc = true; else if (c === inInner) inInner = null; continue; }
      if (fExpr > 0) { // f文字列の式の中：通常のコードとして走査する
        if (c === '"' || c === "'") { inInner = c; continue; }
        // # はコメントにしない：書式指定の # フラグ（f"{255:#x}"）をコメントと誤認しないため
        if (c === '(' || c === '[') { depth++; stack.push({ c, line: li + 1 }); continue; }
        if (c === '{') { depth++; stack.push({ c, line: li + 1 }); fExpr++; continue; }
        if (c === ')' || c === ']') { depth--; if (depth < 0) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '閉じ括弧「' + c + '」に対応する開き括弧がありません', fix: '括弧の対応を確認してください' }); depth = 0; } else stack.pop(); continue; }
        if (c === '}') { depth--; if (depth < 0) { depth = 0; } else stack.pop(); fExpr--; continue; }
        continue;
      }
      if (inStr && inF) { // f文字列の本文：{ で式に入る。}} はリテラル
        if (c === '\\') { esc = true; continue; }
        if (c === inStr) { inStr = null; inF = false; continue; }
        if (c === '{') { if (raw[i + 1] === '{') { i++; continue; } depth++; stack.push({ c, line: li + 1 }); fExpr = 1; continue; }
        if (c === '}' && raw[i + 1] === '}') { i++; continue; }
        continue;
      }
      if (inStr) { if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") {
        if (raw.substr(i, 3) === c + c + c) { triple = c + c + c; i += 2; continue; }
        inStr = c;
        const mPre = /([fFrRbBuU]{1,2})$/.exec(raw.slice(0, i));
        inF = !!(mPre && /[fF]/.test(mPre[1]) && !/[\p{L}\p{Nd}_]/u.test(raw[i - mPre[1].length - 1] || ''));
        continue;
      }
      if (c === '#') { commentAt = i; break; }
      if (c === '(' || c === '[' || c === '{') { depth++; stack.push({ c, line: li + 1 }); }
      if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth < 0) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '閉じ括弧「' + c + '」に対応する開き括弧がありません', fix: '括弧の対応を確認してください' }); depth = 0; }
        else stack.pop();
      }
    }
    // 行末の単独バックスラッシュ（コメント外・奇数個）は行継続
    let contLine = false;
    if (!triple && commentAt < 0) {
      const t = raw.replace(/\s+$/, '');
      let bs = 0; for (let k = t.length - 1; k >= 0 && t[k] === '\\'; k--) bs++;
      contLine = bs % 2 === 1;
    }
    if (inStr && !contLine) { diags.push({ line: li + 1, level: 'error', kind: 'SyntaxError', msg: '文字列が閉じられていません（引用符 ' + inStr + ' が不足）', fix: '行末に ' + inStr + ' を足してください' }); carryStr = null; continue; }
    carryStr = contLine && inStr ? inStr : null;
    carry = triple;
    let code = commentAt >= 0 ? raw.slice(0, commentAt) : raw;
    if (contLine) code = code.replace(/\s+$/, '').slice(0, -1);
    if (!buf) {
      let ind = 0, j = 0;
      while (j < code.length && (code[j] === ' ' || code[j] === '\t')) { ind += code[j] === '\t' ? 4 : 1; j++; }
      buf = { line: li + 1, indent: ind, parts: [] };
    }
    let piece = startedInTriple || startedInStr ? code : code.replace(/^\s+/, '');
    if (!triple && !inStr) piece = piece.replace(/\s+$/, '');
    const part = { s: piece, nl: startedInTriple };
    if (pendingGlue !== null) { part.glue = pendingGlue; pendingGlue = null; }
    buf.parts.push(part);
    if (contLine) pendingGlue = '';
    if (depth <= 0 && !triple && !contLine) {
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

function joinParts(parts) { return parts.map((p, k) => k === 0 ? p.s : (p.glue !== undefined ? p.glue : (p.nl ? '\n' : ' ')) + p.s).join(''); }
// Python の文字列エスケープを解釈する。\N{...}（文字名引き）は解釈できず null を返す
function decodePyStr(raw, lineNo) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') { out += c; continue; }
    const e = raw[i + 1];
    if (e === undefined) { out += '\\'; break; }
    i++;
    if (e === 'n') out += '\n';
    else if (e === 't') out += '\t';
    else if (e === 'r') out += '\r';
    else if (e === 'b') out += '\b';
    else if (e === 'f') out += '\f';
    else if (e === 'v') out += '\v';
    else if (e === 'a') out += '\x07';
    else if (e === '\\') out += '\\';
    else if (e === "'") out += "'";
    else if (e === '"') out += '"';
    else if (e === '\n') { /* 行継続：何も残さない */ }
    else if (e === 'x') { const h = raw.substr(i + 1, 2); if (!/^[0-9a-fA-F]{2}$/.test(h)) throw new SimDiag(lineNo, 'SyntaxError', '\\x のあとには16進数2桁が必要です', '例：\\x41 は「A」です'); out += String.fromCodePoint(parseInt(h, 16)); i += 2; }
    else if (e === 'u') { const h = raw.substr(i + 1, 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) throw new SimDiag(lineNo, 'SyntaxError', '\\u のあとには16進数4桁が必要です', ''); out += String.fromCodePoint(parseInt(h, 16)); i += 4; }
    else if (e === 'U') { const h = raw.substr(i + 1, 8); if (!/^[0-9a-fA-F]{8}$/.test(h)) throw new SimDiag(lineNo, 'SyntaxError', '\\U のあとには16進数8桁が必要です', ''); const cp = parseInt(h, 16); if (cp > 0x10FFFF) throw new SimDiag(lineNo, 'SyntaxError', '\\U の値が大きすぎます', ''); out += String.fromCodePoint(cp); i += 8; }
    else if (e === 'N') { if (raw[i + 1] === '{') return null; out += '\\N'; }
    else if (e >= '0' && e <= '7') { let oct = e, k = 0; while (k < 2 && raw[i + 1] >= '0' && raw[i + 1] <= '7') { oct += raw[i + 1]; i++; k++; } out += String.fromCodePoint(parseInt(oct, 8)); }
    else out += '\\' + e; // 解釈できないエスケープは CPython と同じくバックスラッシュごと残す
  }
  return out;
}
/* 行内トークナイザ：1論理行の text をトークン列にする */
function lexText(text, lineNo) {
  const toks = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isNameS = (c) => /^[\p{L}\p{Nl}_]$/u.test(c);
  const isNameC = (c) => /^[\p{L}\p{Mn}\p{Mc}\p{Nd}\p{Pc}\p{Nl}\u200c\u200d]$/u.test(c);
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    // 文字列（接頭辞つき：f / r / b / u の組み合わせに対応）
    let prefix = '';
    { const m = /^[fFrRbBuU]{1,2}(?=["'])/.exec(text.slice(i, i + 3)); if (m) prefix = m[0].toLowerCase(); }
    if (c === '"' || c === "'" || prefix) {
      const isRaw = prefix.includes('r'), isF = prefix.includes('f'), isB = prefix.includes('b');
      if (isB && isF) throw new SimDiag(lineNo, 'SyntaxError', 'b と f の接頭辞は組み合わせられません', '');
      const start = i + prefix.length;
      const q = text[start];
      let raw = '', closed = false;
      if (text.substr(start, 3) === q + q + q) { // 三連引用符
        const close = text.indexOf(q + q + q, start + 3);
        if (close < 0) throw new SimDiag(lineNo, 'SyntaxError', '三連引用符の文字列が閉じられていません', '""" または \'\'\' で閉じてください');
        raw = text.slice(start + 3, close);
        closed = true;
        i = close + 3;
      } else if (isF) {
        // f文字列（Python 3.12 / PEP 701）：式 {…} の中では同じ引用符を再利用できるため、
        // 式ブレースの深さを追い、式の中の引用符は文字列の終わりとみなさない
        let j = start + 1, depth = 0;
        while (j < text.length) {
          const ch = text[j];
          if (depth === 0) {
            if (ch === '\\' && !isRaw && j + 1 < text.length) { raw += ch + text[j + 1]; j += 2; continue; }
            if (ch === '{') { if (text[j + 1] === '{') { raw += '{{'; j += 2; continue; } depth = 1; raw += ch; j++; continue; }
            if (ch === '}') { if (text[j + 1] === '}') { raw += '}}'; j += 2; continue; } raw += ch; j++; continue; }
            if (ch === q) { closed = true; break; }
            raw += ch; j++; continue;
          }
          if (ch === '"' || ch === "'") { const q2 = ch; raw += ch; j++; while (j < text.length && text[j] !== q2) { if (text[j] === '\\' && j + 1 < text.length) { raw += text[j] + text[j + 1]; j += 2; } else { raw += text[j]; j++; } } if (j < text.length) { raw += text[j]; j++; } continue; }
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          raw += ch; j++;
        }
        if (!closed) throw new SimDiag(lineNo, 'SyntaxError', '文字列が閉じられていません', '引用符 ' + q + ' を足してください');
        i = j + 1;
      } else {
        let j = start + 1;
        while (j < text.length) {
          if (text[j] === '\\' && j + 1 < text.length) { raw += text[j] + text[j + 1]; j += 2; continue; }
          if (text[j] === q) { closed = true; break; }
          raw += text[j]; j++;
        }
        if (!closed) throw new SimDiag(lineNo, 'SyntaxError', '文字列が閉じられていません', '引用符 ' + q + ' を足してください');
        i = j + 1;
      }
      if (isB) { toks.push({ t: 'BYTES', line: lineNo }); continue; }
      if (!isRaw) {
        const dec = decodePyStr(raw, lineNo);
        if (dec === null) { toks.push({ t: 'STR', v: '', f: isF, unkstr: true, line: lineNo }); continue; }
        raw = dec;
      }
      toks.push({ t: 'STR', v: raw, f: isF, line: lineNo });
      continue;
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
      let cx = false;
      if (text[j] === 'j' || text[j] === 'J') { cx = true; j++; }
      toks.push({ t: 'NUM', v: parseFloat(raw), f: isF || cx, cx, line: lineNo });
      i = j; continue;
    }
    { const ch0 = String.fromCodePoint(text.codePointAt(i));
      if (isNameS(ch0)) {
        let j = i, name = '';
        while (j < text.length) { const ch = String.fromCodePoint(text.codePointAt(j)); if (!isNameC(ch)) break; name += ch; j += ch.length; }
        toks.push({ t: 'NAME', v: name, line: lineNo });
        i = j; continue;
      } }
    if (text.substr(i, 3) === '...') { toks.push({ t: 'ELLIPSIS', line: lineNo }); i += 3; continue; }
    const three = text.substr(i, 3), two = text.substr(i, 2);
    if (three === '**=' || three === '//=' || three === '<<=' || three === '>>=') { toks.push({ t: 'OP', v: three, line: lineNo }); i += 3; continue; }
    if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**', '//', '->', ':=', '<<', '>>', '|=', '&=', '^='].includes(two)) { toks.push({ t: 'OP', v: two, line: lineNo }); i += 2; continue; }
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
    throw new SimDiag(i + 1 < lines.length ? lines[i + 1].line : lineNo, 'IndentationError', '「:」のあとに、インデントした文が必要です', '次の行を空白4つで字下げしてください');
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
    const skipped = (what, nx) => { const r = namesInLines(lines, i, nx); return { stmts: [{ k: 'unsupported', what, line: L.line, names: r.names, roots: r.roots, prints: r.prints, returns: r.returns }], next: nx }; };
    if (t0.v === 'class') return parseClass(lines, i, indent, tc);
    if (t0.v === 'try') return parseTry(lines, i, indent, tc);
    if (t0.v === 'async') return skipped('非同期（async）', skipBlock(lines, i, indent));
    if (t0.v === 'with') return parseWith(lines, i, indent, tc);
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
  const names = new Set(); const roots = new Set(); let prints = false, returns = false;
  const IDENT = '[\\p{L}\\p{Nl}_][\\p{L}\\p{Mn}\\p{Mc}\\p{Nd}\\p{Pc}\\p{Nl}]*';
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
    // Unicode の変数名への代入と、添字代入・変更系メソッドの受け手（根）も拾う
    const nameRe = new RegExp('(' + IDENT + ')\\s*(?::[^=]+)?(?:[+\\-*/%]|//|\\*\\*)?=(?!=)', 'gu');
    let nm; while ((nm = nameRe.exec(t))) names.add(nm[1]);
    const rootRe = new RegExp('^(' + IDENT + ')\\s*(?:\\[|\\.(?:append|extend|insert|pop|remove|sort|reverse|clear|update|add|discard|setdefault|popitem)\\s*\\()', 'u');
    if ((m = rootRe.exec(t))) roots.add(m[1]);
  }
  return { names: [...names], roots: [...roots], prints, returns };
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
function parseTry(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // try
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  let cur = s.next;
  const handlers = [];
  let elseBody = null, finallyBody = null;
  while (cur < lines.length && lines[cur].indent === indent) {
    const tcx = new TC(lexText(lines[cur].text, lines[cur].line));
    if (tcx.isName('except')) {
      tcx.next();
      let types = null, asName = null;
      if (!tcx.isOp(':')) {
        const names = [];
        let depth = 0;
        while (!tcx.atEnd()) {
          const tk = tcx.peek();
          if (tk.t === 'OP' && tk.v === ':' && depth === 0) break;
          if (tk.t === 'NAME' && tk.v === 'as' && depth === 0) break;
          if (tk.t === 'OP' && (tk.v === '(' || tk.v === '[')) depth++;
          if (tk.t === 'OP' && (tk.v === ')' || tk.v === ']')) depth--;
          if (tk.t === 'NAME' && !KEYWORDS.includes(tk.v)) names.push(tk.v);
          tcx.next();
        }
        types = names;
        if (tcx.isName('as')) { tcx.next(); const an = tcx.next(); if (an.t === 'NAME') asName = an.v; }
      }
      tcx.expectOp(':', lines[cur].line);
      const sh = parseSuite(lines, cur, indent, tcx, lines[cur].line);
      handlers.push({ types, asName, body: sh.body, line: lines[cur].line });
      cur = sh.next; continue;
    }
    if (tcx.isName('else')) { tcx.next(); tcx.expectOp(':', lines[cur].line); const sh = parseSuite(lines, cur, indent, tcx, lines[cur].line); elseBody = sh.body; cur = sh.next; continue; }
    if (tcx.isName('finally')) { tcx.next(); tcx.expectOp(':', lines[cur].line); const sh = parseSuite(lines, cur, indent, tcx, lines[cur].line); finallyBody = sh.body; cur = sh.next; continue; }
    break;
  }
  if (!handlers.length && !finallyBody) throw new SimDiag(L.line, 'SyntaxError', 'try には except か finally が必要です', 'except: か finally: を続けて書いてください');
  return { stmts: [{ k: 'try', body: s.body, handlers, elseBody, finallyBody, line: L.line }], next: cur };
}
function parseWith(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // with
  const items = [];
  while (true) {
    const e = parseExpr(tc, L.line);
    let asName = null;
    if (tc.isName('as')) { tc.next(); const an = tc.next(); if (an.t === 'NAME') asName = an.v; }
    items.push({ e, asName });
    if (!tc.eatOp(',')) break;
  }
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  return { stmts: [{ k: 'with', items, body: s.body, line: L.line }], next: s.next };
}
function parseClass(lines, i, indent, tc) {
  const L = lines[i];
  tc.next(); // class
  const nameTok = tc.next();
  if (nameTok.t !== 'NAME') throw new SimDiag(L.line, 'SyntaxError', 'クラス名が必要です', 'class のあとに名前を書いてください');
  if (tc.isOp('(')) { // 基底クラスなどは読み飛ばす
    let depth = 0;
    do { const tk = tc.next(); if (tk.t === 'OP' && tk.v === '(') depth++; else if (tk.t === 'OP' && tk.v === ')') depth--; if (tk.t === 'END') break; } while (depth > 0);
  }
  tc.expectOp(':', L.line);
  const s = parseSuite(lines, i, indent, tc, L.line);
  return { stmts: [{ k: 'class', name: nameTok.v, body: s.body, line: L.line }], next: s.next };
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
    // 型注釈つき代入 x: int = 5（注釈は読み飛ばす）。値がなければ注釈だけの文
    if (tgt.k === 'name' && tc.isOp(':')) { tc.next(); parseExpr(tc, line); if (!tc.isOp('=') && !tc.isOp('+=') && !tc.isOp('-=') && !tc.isOp('*=') && !tc.isOp('/=') && !tc.isOp('//=') && !tc.isOp('%=') && !tc.isOp('**=') && !tc.isOp('|=') && !tc.isOp('&=') && !tc.isOp('^=') && !tc.isOp('<<=') && !tc.isOp('>>=')) return { k: 'annassign', target: tgt, line }; }
    if (tc.isOp('=') || tc.isOp('+=') || tc.isOp('-=') || tc.isOp('*=') || tc.isOp('/=') || tc.isOp('//=') || tc.isOp('%=') || tc.isOp('**=') || tc.isOp('|=') || tc.isOp('&=') || tc.isOp('^=') || tc.isOp('<<=') || tc.isOp('>>=')) {
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
  if (tc.peek().t === 'NAME' && tc.peek(1).t === 'OP' && tc.peek(1).v === ':=') { // ワルラス演算子（名前 := 式）
    const name = tc.next().v; tc.next();
    const e = parseExpr(tc, line);
    return { k: 'walrus', name, e, line };
  }
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
  let l = parseBitXor(tc, line);
  while (tc.isOp('|')) { tc.next(); l = { k: 'bin', op: '|', l, r: parseBitXor(tc, line), line }; }
  return l;
}
function parseBitXor(tc, line) {
  let l = parseBitAnd(tc, line);
  while (tc.isOp('^')) { tc.next(); l = { k: 'bin', op: '^', l, r: parseBitAnd(tc, line), line }; }
  return l;
}
function parseBitAnd(tc, line) {
  let l = parseShift(tc, line);
  while (tc.isOp('&')) { tc.next(); l = { k: 'bin', op: '&', l, r: parseShift(tc, line), line }; }
  return l;
}
function parseShift(tc, line) {
  let l = parseArith(tc, line);
  while (tc.isOp('<<') || tc.isOp('>>')) { const op = tc.next().v; l = { k: 'bin', op, l, r: parseArith(tc, line), line }; }
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
        else { const e0 = parseExpr(tc, line); if (tc.isName('for')) { const gens = parseGens(tc, line); args.push({ e: { k: 'listcomp', gen: true, elt: e0, gens, line } }); } else args.push({ e: e0 }); }
        if (!tc.eatOp(',')) break;
      }
      tc.expectOp(')', line);
      e = { k: 'call', fn: e, args, kwargs, line };
    } else if (tc.isOp('[')) {
      tc.next();
      let lo = null, hi = null, step = null, isSlice = false, idx = null;
      if (!tc.isOp(':') && !tc.isOp(']')) { idx = parseExpr(tc, line); if (tc.isOp(',')) { const items = [{ e: idx }]; while (tc.eatOp(',')) { if (tc.isOp(']')) break; items.push({ e: parseExpr(tc, line) }); } idx = { k: 'tuple', items, line }; } }
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
  if (t.t === 'NUM') { if (t.cx) return { k: 'cxlit', line }; return { k: 'num', v: t.v, f: t.f, line }; }
  if (t.t === 'ELLIPSIS') return { k: 'ellipsis', line };
  if (t.t === 'BYTES') return { k: 'byteslit', line };
  if (t.t === 'STR') {
    if (t.unkstr) return { k: 'unkexpr', what: '\\N{...}（文字の名前で書くエスケープ）を含む文字列', line };
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
      let what = t.v;
      if (t.v === 'yield' && tc.isName('from')) { tc.next(); what = 'yield from'; }
      const nt = tc.peek();
      if (nt.t !== 'END' && !(nt.t === 'OP' && [')', ']', '}', ',', ';', ':'].includes(nt.v))) parseExpr(tc, line);
      return { k: 'unkexpr', what, line };
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
    if (tc.isName('for')) { const gens = parseGens(tc, line); tc.expectOp(')', line); return { k: 'listcomp', gen: true, elt: first, gens, line }; }
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
    if (tc.isOp('**')) {
      const pairs = [];
      do { if (tc.isOp('}')) break; if (tc.isOp('**')) { tc.next(); pairs.push({ dstar: parseOr(tc, line) }); } else { const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); } } while (tc.eatOp(','));
      tc.expectOp('}', line);
      return { k: 'dict', pairs, line };
    }
    const firstK = parseExpr(tc, line);
    if (tc.isOp(':')) {
      tc.next();
      const firstV = parseExpr(tc, line);
      if (tc.isName('for')) { const gens = parseGens(tc, line); tc.expectOp('}', line); return { k: 'dictcomp', keyE: firstK, valE: firstV, gens, line }; }
      const pairs = [{ k: firstK, v: firstV }];
      while (tc.eatOp(',')) { if (tc.isOp('}')) break; if (tc.isOp('**')) { tc.next(); pairs.push({ dstar: parseOr(tc, line) }); continue; } const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); }
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
      while (j < raw.length && depth > 0) {
        const cj = raw[j];
        if (cj === '"' || cj === "'") { inner += cj; j++; while (j < raw.length && raw[j] !== cj) { if (raw[j] === '\\' && j + 1 < raw.length) { inner += raw[j] + raw[j + 1]; j += 2; } else { inner += raw[j]; j++; } } if (j < raw.length) { inner += raw[j]; j++; } continue; }
        if (cj === '{') depth++; else if (cj === '}') { depth--; if (!depth) break; }
        inner += cj; j++;
      }
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
  set(name, v) { if (this.decl && this.decl.has(name)) { this.decl.get(name).set(name, v); return; } this.vars.set(name, v); if (this.track) this.track.map.set(name, this.track.line); }
  del(name) { if (this.decl && this.decl.has(name)) return this.decl.get(name).del(name); const had = this.vars.has(name) && this.vars.get(name) !== UNBOUND; if (had) { this.vars.delete(name); if (this.track) this.track.map.delete(name); } return had; }
  hasOwn(name) { return this.vars.has(name); }
}
class Flow extends Error { constructor(kind, value) { super(kind); this.kind = kind; this.value = value; } }
// try の except で捕まえられる診断か（エンジン内部の都合で出す診断と、文法エラーは捕まえられない）
const NONCATCH_KINDS = new Set(['対応外', '説明の上限', '無限ループの疑い', 'SyntaxError', 'IndentationError']);
function isCatchableDiag(e) { return e instanceof SimDiag && !NONCATCH_KINDS.has(e.kind); }

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
    case 'dict': return '{' + n.pairs.map(p => p.dstar ? '**' + exprSrc(p.dstar) : exprSrc(p.k) + ': ' + exprSrc(p.v)).join(', ') + '}';
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
    case 'listcomp': return n.gen ? '(… for … in …)' : '[… for … in …]';
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
    else if (n.k === 'class') set.add(n.name);
    else if (n.k === 'annassign') addTargetNames(n.target, set);
    else if (n.k === 'walrus') set.add(n.name);
    else if (n.k === 'with') n.items.forEach(it => { if (it.asName) set.add(it.asName); });
    else if (n.k === 'del') n.targets.forEach(t => addTargetNames(t, set));
    else if (n.k === 'unsupported' && n.names) n.names.forEach(x => set.add(x));
    else if (n.k === 'import') importNames(n.text || '').forEach(x => set.add(x));
  });
  return set;
}
const MUTATING_METHODS = new Set(['append', 'extend', 'insert', 'pop', 'remove', 'sort', 'reverse', 'clear', 'update', 'add', 'discard', 'setdefault', 'popitem', 'intersection_update', 'difference_update', 'symmetric_difference_update']);
function rootNameOf(node) { let n = node; while (n && (n.k === 'sub' || n.k === 'attr' || n.k === 'slice')) n = n.obj; return n && n.k === 'name' ? n.name : null; }
// ブロックの中で添字代入・変更系メソッドで「中身が書き換わるかもしれない」名前の根を集める
function mutatedRoots(stmts) {
  const roots = new Set();
  walkNodes(stmts, n => {
    if (n.k === 'assign' || n.k === 'aug') { const r = rootNameOf(n.target); if (r && n.target.k !== 'name') roots.add(r); }
    else if (n.k === 'assignmulti') n.targets.forEach(t => { const r = rootNameOf(t); if (r && t.k !== 'name') roots.add(r); });
    else if (n.k === 'del') n.targets.forEach(t => { const r = rootNameOf(t); if (r && t.k !== 'name') roots.add(r); });
    else if (n.k === 'call' && n.fn && n.fn.k === 'attr' && MUTATING_METHODS.has(n.fn.name)) { const r = rootNameOf(n.fn.obj); if (r) roots.add(r); }
  });
  return roots;
}
function declaredNames(stmts) { const set = new Set(); walkNodes(stmts, n => { if (n.k === 'global') n.names.forEach(x => set.add(x)); }); return set; }
function hasNode(stmts, pred) { let f = false; walkNodes(stmts, n => { if (!f && pred(n)) f = true; }); return f; }
const isPrintCall = (n) => n.k === 'call' && n.fn && n.fn.k === 'name' && n.fn.name === 'print';
class Interp {
  constructor() {
    this.diags = []; this.steps = []; this.output = [];
    this.globals = new Env(null);
    this.globals.track = { map: new Map(), line: 0 }; // グローバル変数の最終代入行（「最終状態」から該当行へ跳ぶため）
    this.outSegs = []; // 出力を行単位で対応付けるためのセグメント列 {text, line}
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
  err(line, kind, msg, fix, excStr, excRepr) { const d = new SimDiag(line, kind, msg, fix); if (excStr !== undefined) { d.excStr = excStr; d.excRepr = excRepr || ''; } throw d; }
  emitRaw(text, line) { this.outSegs.push({ text, line: line || 0 }); this.outText += text; }
  emitLine(text, line) { if (this.outText && !this.outText.endsWith('\n')) this.emitRaw('\n', 0); this.emitRaw(text + '\n', line || 0); }
  tick() { if (++this.work > MAX_WORK) throw new Flow('budget'); }
  // 実行されたか分からない部分: 中で代入される名前は「実行時に決まる値」にし、print があればその旨の出力行を出す
  unknownBlock(blocks, env, why, line) {
    const names = new Set(); const roots = new Set(); let prints = false;
    for (const b of blocks) { if (!b) continue; assignedNames(b).forEach(n => names.add(n)); mutatedRoots(b).forEach(n => roots.add(n)); if (hasNode(b, isPrintCall)) prints = true; }
    for (const n of names) env.set(n, UNK(why));
    for (const n of roots) { if (names.has(n)) continue; const cur = env.get(n); if (isMutableVal(cur)) poison(cur, why + 'で書き換えられたかもしれない値'); }
    if (prints) this.emitLine('（' + why + 'によって決まる出力）', line || 0);
  }
  // 実行されたか分からない部分の中に return がある場合、関数はそこで戻るかもしれない
  maybeReturnUnknown(blocks, ctx) {
    if (ctx && ctx.inFunc && hasNode(blocks, x => x.k === 'return')) throw new Flow('return', UNK('実行時に決まる戻り値'));
  }

  run(stmts) {
    try { this.execBlock(stmts, this.globals, {}); }
    catch (e) {
      if (e instanceof RangeError) { // 深い入れ子・巨大な式でも例外を外へ漏らさない（正直に打ち切る）
        this.truncated = true;
        this.diag(0, 'note', '説明の上限', 'コードの入れ子や計算が大きすぎて、この説明では最後まで追いきれませんでした。以降の出力と最終状態は実行して確認してください', '');
        this.emitLine('（大きすぎるため、ここから先の出力は省略します）');
      }
      else if (e instanceof SimDiag) this.diag(e.line, 'error', e.kind, e.message, e.fix);
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
      const vline = this.globals.track.map.get(name) || 0; // 最後に代入された行（「最終状態」から該当行へ跳ぶため）
      if (this.truncated) vars.push({ name, value: '（途中で打ち切ったため不明）', type: '不明', line: vline });
      else if (isFunc(v)) vars.push({ name, value: '関数 ' + name + '（定義）', type: 'function', line: vline });
      else { const s = reprFull(v); vars.push({ name, value: s.length > 20000 ? s.slice(0, 20000) + '…' : s, type: typeName(v), line: vline }); }
    }
    // 出力セグメントを表示行へ組み立て、各行に対応するコード行（print 等の文の行）を並行に持つ
    const outArr = [], outLineMap = [];
    let curOut = '', curOutLine = 0;
    for (const seg of this.outSegs) {
      const parts = seg.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) { if (!curOutLine) curOutLine = seg.line; outArr.push(curOut); outLineMap.push(curOutLine); curOut = ''; curOutLine = 0; }
        if (parts[i]) { if (!curOutLine) curOutLine = seg.line; curOut += parts[i]; }
      }
    }
    if (curOut !== '') { outArr.push(curOut); outLineMap.push(curOutLine); }
    this.output = outArr; this.outputLines = outLineMap;
    return { diags: this.diags, steps: this.steps, output: this.output, outputLines: this.outputLines, vars };
  }
  execBlock(stmts, env, ctx) { for (const s of stmts) this.execStmt(s, env, ctx); }

  // 文の実行中は「いま実行している文の行」を記録し、グローバル変数への代入行の追跡に使う（入れ子は保存・復帰）
  execStmt(s, env, ctx) {
    const tr = this.globals.track; const prev = tr.line;
    if (s && s.line) tr.line = s.line;
    try { this.execStmtBody(s, env, ctx); } finally { tr.line = prev; }
  }

  execStmtBody(s, env, ctx) {
    switch (s.k) {
      case 'pass': return;
      case 'unsupported':
        this.diag(s.line, 'note', '対応外', '「' + s.what + '」はこの説明では解釈できません。その部分の値は「実行時に決まる値」として扱います', '実際の動きは実行して確認してください');
        for (const n of s.names || []) env.set(n, UNK('「' + s.what.replace(/（(.*?)）/g, ' $1') + '」で決まる値'));
        for (const n of s.roots || []) { const cur = env.get(n); if (isMutableVal(cur)) poison(cur, '「' + s.what.replace(/（(.*?)）/g, ' $1') + '」の中で書き換えられたかもしれない値'); }
        if (s.prints) this.emitLine('（「' + s.what.replace(/（(.*?)）/g, ' $1') + '」の中の出力は実行時に決まります）', s.line);
        this.pendingDec = [];
        if (s.returns && ctx.inFunc) { this.step(s.line, 'この部分の中で return する可能性があるため、関数の戻り値は実行時に決まります'); throw new Flow('return', UNK('実行時に決まる戻り値')); }
        return;
      case 'try': {
        let pending = null, simErr = null;
        try { this.execBlock(s.body, env, ctx); }
        catch (e) { if (isCatchableDiag(e)) simErr = e; else pending = e; }
        if (simErr) {
          const h = s.handlers.find(hh => hh.types === null || hh.types.includes(simErr.kind) || hh.types.includes('Exception') || hh.types.includes('BaseException'));
          if (!h) pending = simErr;
          else {
            this.step(s.line, 'エラー（' + simErr.kind + '）が起きたので、except の中身を実行します');
            if (h.asName) env.set(h.asName, simErr.excStr != null ? EXC(simErr.kind, simErr.excStr, simErr.excRepr) : UNK('発生したエラー（' + simErr.kind + '）'));
            try { this.execBlock(h.body, env, ctx); } catch (e2) { pending = e2; }
            if (h.asName) env.del(h.asName);
          }
        } else if (!pending && s.elseBody) {
          try { this.execBlock(s.elseBody, env, ctx); } catch (e2) { pending = e2; }
        }
        if (s.finallyBody) {
          try { this.execBlock(s.finallyBody, env, ctx); } catch (e3) { pending = e3; }
        }
        if (pending) throw pending;
        return;
      }
      case 'with': {
        let genCtx = false;
        for (const it of s.items) { const v = this.eval(it.e, env); if (isIter(v) || (isUnk(v) && v.desc !== 'ファイルの内容')) genCtx = true; if (it.asName) env.set(it.asName, UNK('with で開いた値')); } // open() の戻り（ファイルの内容）だけは出入りで出力を伴わない既知の形として除外する
        if (genCtx) { // @contextmanager のジェネレータ等：出入りのタイミングで出る出力・副作用は再現できないため、正直にプレースホルダで示す
          this.diag(s.line, 'note', '対応外', 'この with の出入りで行われる処理（出入りの出力や後片付け）はこの説明では再現しません。出入りの出力は「実行時に決まる値」として示します', '');
          this.emitRaw('（with に入るときの出力は実行時に決まります）\n', s.line);
          this.execBlock(s.body, env, ctx);
          this.emitRaw('（with を出るときの出力は実行時に決まります）\n', s.line);
          return;
        }
        this.execBlock(s.body, env, ctx);
        return;
      }
      case 'class': {
        const classEnv = new Env(env);
        try { this.execBlock(s.body, classEnv, { ...ctx, inFunc: false, inLoop: false }); } catch (e) { if (!(e instanceof Flow)) throw e; }
        env.set(s.name, { __class: true, cname: s.name, cenv: classEnv });
        this.step(s.line, 'クラス「' + s.name + '」を定義します（中身の代入はクラスの属性になります）');
        return;
      }
      case 'annassign': return; // 型注釈だけの文：名前は作られない（関数内では代入前の名前として扱う）
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
            if (isUnk(idx)) { if (isMutableVal(obj)) poison(obj, '消されたかもしれない値'); continue; }
            if (isUnk(obj)) continue;
            if (isList(obj)) { this.subGet(obj, idx, s.line); let i = Math.trunc(idx.v); if (i < 0) i += obj.__list.length; obj.__list.splice(i, 1); this.step(s.line, 'リストの [' + reprVal(idx) + '] を消します → ' + reprVal(obj)); continue; }
            if (isDict(obj)) { this.subGet(obj, idx, s.line); obj.__dict.delete(dictKeyId(idx)); this.step(s.line, '辞書のキー ' + reprVal(idx) + ' を消します'); continue; }
            this.err(s.line, 'TypeError', typeName(obj) + ' の要素は del で消せません', '');
          }
          if (t.k === 'slice') {
            const obj = this.eval(t.obj, env);
            const lo = t.lo ? this.eval(t.lo, env) : null, hi = t.hi ? this.eval(t.hi, env) : null, st = t.step ? this.eval(t.step, env) : null;
            if (isUnk(obj)) continue;
            if (!isList(obj)) this.err(s.line, 'TypeError', typeName(obj) + ' の要素は del で消せません', '');
            const ix = this.sliceIdx(obj.__list.length, lo, hi, st, s.line);
            if (ix === null) { this.markUnknownList(obj, t.obj, env, s.line); continue; }
            const kill = new Set(ix.idx); const keep = obj.__list.filter((_, k) => !kill.has(k)); obj.__list.length = 0; obj.__list.push(...keep);
            this.step(s.line, '「' + exprSrc(t.obj) + '」の一部（スライス）を消します → ' + reprVal(obj));
            continue;
          }
          this.diag(s.line, 'note', '対応外', 'この形の del はこの説明では解釈できません', '');
          if (t.k === 'attr') { const base = t.obj; if (base && base.k === 'name') env.set(base.name, UNK('del の結果')); }
        }
        return;
      }
      case 'assert': {
        const t = truthy(this.eval(s.e, env));
        if (t === null) { this.step(s.line, 'assert の条件は実行時に決まります'); return; }
        if (!t) { const mv = s.msg ? this.eval(s.msg, env) : null; const known = mv !== null && !isUnk(mv); this.err(s.line, 'AssertionError', known ? strVal(mv) : 'assert の条件がうそ（False）でした', '', known ? strVal(mv) : undefined, known ? reprVal(mv) : undefined); }
        this.step(s.line, 'assert の条件を確かめます（本当（True）なので続けます）');
        return;
      }
      case 'raise': {
        if (!s.e) { this.diag(s.line, 'note', '対応外', '引数のない raise はこの説明では解釈できません', ''); return; }
        let kind = null, msg = '', excStr, excRepr;
        if (s.e.k === 'call' && s.e.fn.k === 'name') {
          kind = s.e.fn.name;
          const vals = s.e.args.map(a => this.eval(a.e, env));
          if (vals.length === 1 && !isUnk(vals[0])) { msg = strVal(vals[0]); excStr = msg; excRepr = reprVal(vals[0]); } // str(例外) は引数の文字列化と一致する
          else if (vals.length === 0) { excStr = ''; excRepr = ''; }
          else if (vals.length > 1 && vals.every(v => !isUnk(v))) { excStr = reprVal(TUPLE(vals)); excRepr = vals.map(v => reprVal(v)).join(', '); } // str はタプル表記、repr は引数を並べた形
          else if (vals.length) msg = '（実行時に決まる値）';
        }
        else if (s.e.k === 'name') { kind = s.e.name; excStr = ''; excRepr = ''; }
        if (!kind) { this.diag(s.line, 'note', '対応外', 'この形の raise はこの説明では解釈できません', ''); return; }
        this.err(s.line, kind, msg || kind + ' を発生させました', '', excStr, excRepr);
      }
      case 'import': {
        this.diag(s.line, 'note', 'import', 'import はこの説明では中身を読み込みません。import した名前は「実行時に決まる値」として扱います', '');
        for (const nm of importNames(s.text || '')) env.set(nm, UNK('モジュール「' + nm + '」の内容'));
        { const t = (s.text || '').trim(); let m;
          if ((m = /^import\s+math(?:\s+as\s+(\w+))?\s*$/.exec(t))) { const u = UNK('モジュール「math」の内容'); u.mod = 'math'; env.set(m[1] || 'math', u); }
          else if ((m = /^from\s+math\s+import\s+\(?(.+?)\)?\s*$/.exec(t))) for (const part of m[1].split(',')) { const p = part.trim().split(/\s+as\s+/); if (p[0] in MATH_CONST) env.set((p[1] || p[0]).trim(), NUM(MATH_CONST[p[0]], true)); } }
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
        const t = s.target;
        if (t.k === 'sub') { // 添字は1回だけ評価する（CPython と同じ。x[idx()] += 1 で idx() は1回だけ呼ばれる）
          const obj = this.eval(t.obj, env);
          const idx = this.eval(t.idx, env);
          if (isUnk(obj) || isUnk(idx)) { const rn = rootNameOf(t); if (rn) { const curR = env.get(rn); if (isMutableVal(curR)) poison(curR, '書き換えられたかもしれない値'); } return; }
          const curS = this.subGet(obj, idx, s.line);
          const rhsS = this.eval(s.expr, env);
          const nvS = this.binOpInPlace(s.op, curS, rhsS, s.line);
          if (nvS !== INPLACE_DONE) this.subSet(obj, idx, nvS, s.line);
          this.step(s.line, '「' + exprSrc(t.obj) + '」の [' + reprVal(idx) + '] を ' + s.op + '= で書き換えます → ' + reprVal(obj));
          return;
        }
        const cur = this.readTarget(t, env, s.line);
        const rhs = this.eval(s.expr, env);
        const nv = this.binOpInPlace(s.op, cur, rhs, s.line);
        if (nv === INPLACE_DONE) { if (t.k === 'name') this.step(s.line, '「' + t.name + '」の中身を直接書き換えます → ' + reprVal(cur)); }
        else this.assignTo(t, nv, env, s.line, true);
        return;
      }
      case 'if': {
        for (const arm of s.arms) {
          const c = this.eval(arm.cond, env);
          const t = truthy(c);
          if (t === null) {
            this.step(s.line, '条件「' + exprSrc(arm.cond) + '」は実行時に決まる値を含むため、どちらに進むかは実行してみないと分かりません（この説明では分岐の中身は省略し、中で代入される変数は「実行時に決まる値」とします）');
            const from = s.arms.indexOf(arm);
            this.unknownBlock([...s.arms.slice(from).map(a => a.body), s.elseBody], env, '実行時の条件', s.line);
            this.maybeReturnUnknown([...s.arms.slice(from).map(a => a.body), s.elseBody], ctx);
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
        if (isIter(it)) {
          this.materialize(it);
          if (it.failed) { this.step(s.line, '繰り返しの対象が実行時に決まるため、回数は分かりません（中で代入される変数は「実行時に決まる値」とします）'); this.unknownBlock([[{ k: 'for', target: s.target, body: [] }], s.body, s.elseBody], env, '実行時の繰り返し', s.line); this.maybeReturnUnknown([s.body], ctx); return; }
          const total = it.__iter.length - (it.pos || 0);
          this.step(s.line, '「' + exprSrc(s.iter) + '」から1つずつ「' + targetName(s.target) + '」に取り出して、' + total + '回繰り返します');
          let brokeI = false, idxI = 0;
          while ((it.pos || 0) < it.__iter.length) {
            this.tick();
            const item = it.__iter[it.pos || 0]; it.pos = (it.pos || 0) + 1;
            const showI = idxI === 0;
            if (!showI) this.quiet++;
            if (idxI === 0) this.step(s.line, '― 1回目 ―');
            this.assignTo(s.target, item, env, s.line, false);
            try { this.execBlock(s.body, env, { ...ctx, inLoop: true }); }
            catch (e) {
              if (e instanceof Flow && e.kind === 'break') { this.step(s.line, 'break で繰り返しを抜けます'); brokeI = true; if (!showI) this.quiet--; break; }
              if (e instanceof Flow && e.kind === 'continue') { if (!showI) this.quiet--; idxI++; continue; }
              if (!showI) this.quiet--;
              throw e;
            }
            if (!showI) this.quiet--;
            idxI++;
          }
          if (!brokeI && idxI > 2) this.step(s.line, '（2回目以降の手順は省略しました。変数の最終状態は下の「最終状態」に出ます）');
          if (!brokeI && s.elseBody) { this.step(s.line, 'break せずに繰り返しが終わったので、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
          return;
        }
        const seq = this.iterable(it, s.line);
        if (seq === null) { this.step(s.line, '繰り返しの対象が実行時に決まるため、回数は分かりません（中で代入される変数は「実行時に決まる値」とします）'); this.unknownBlock([[{ k: 'for', target: s.target, body: [] }], s.body, s.elseBody], env, '実行時の繰り返し', s.line); this.maybeReturnUnknown([s.body], ctx); return; }
        this.step(s.line, '「' + exprSrc(s.iter) + '」の要素を1つずつ「' + targetName(s.target) + '」に入れて、' + seq.length + '回繰り返します');
        let broke = false;
        const live = isList(it) ? it.__list : null;
        const watched = isDict(it) ? it : isView(it) ? it.__view : null, watchedSet = isSet(it) ? it : null;
        const size0 = watched ? watched.__dict.size : watchedSet ? watchedSet.__set.length : 0;
        const checkSize = () => { if (watched && watched.__dict.size !== size0) this.err(s.line, 'RuntimeError', '繰り返しの途中で辞書の大きさ（要素数）が変わりました（dictionary changed size during iteration）', '繰り返す前に list(辞書) でキーの一覧を作り、それを使って繰り返してください'); if (watchedSet && watchedSet.__set.length !== size0) this.err(s.line, 'RuntimeError', '繰り返しの途中で集合の大きさが変わりました（Set changed size during iteration）', '繰り返す前に list(集合) で一覧を作ってください'); };
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
            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; checkSize(); continue; }
            if (!showSteps) this.quiet--;
            throw e;
          }
          if (!showSteps) this.quiet--;
          checkSize();
        }
        const total = live ? live.length : seq.length;
        if (!broke && total > 2) this.step(s.line, '（' + (total === 3 ? '2回目' : '2回目から ' + (total - 1) + ' 回目まで') + 'の手順は省略しました。変数の最終状態は下の「最終状態」に出ます）');
        if (!broke && s.elseBody) { this.step(s.line, 'break せずに繰り返しが終わったので、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
        return;
      }
      case 'while': {
        let count = 0, prevSnap = null, broke = false, stallCount = 0;
        const watchSet = new Set(); walkNodes(s.cond, n => { if (n.k === 'name') watchSet.add(n.name); });
        assignedNames([s.body]).forEach(n => watchSet.add(n));
        mutatedRoots([s.body]).forEach(n => watchSet.add(n));
        const watchList = [...watchSet];
        const canStall = !hasNode(s.cond, n => n.k === 'call' || n.k === 'attr') && !hasNode(s.body, n => n.k === 'break' || n.k === 'return' || n.k === 'raise');
        while (true) {
          const c = this.eval(s.cond, env);
          const t = truthy(c);
          if (t === null) {
            this.step(s.line, 'while の条件「' + exprSrc(s.cond) + '」は実行時に決まる値を含むため、繰り返しの回数は分かりません（中で代入される変数は「実行時に決まる値」とします）');
            this.unknownBlock([s.body, s.elseBody], env, '実行時の繰り返し', s.line);
            this.maybeReturnUnknown([s.body], ctx);
            return;
          }
          if (!t) { if (count > 0) this.step(s.line, '条件「' + exprSrc(s.cond) + '」がうそ（False）になったので、繰り返しを終わります（合計 ' + count + ' 回）'); break; }
          if (canStall) {
            // 監視対象の値が5回続けてまったく変わらないときだけ「無限ループの疑い」とする（1回だけ変わらない正しいループは多い）
            const snap = watchList.map(n => { const v = env.get(n); return v === undefined ? '∅' : reprVal(v); }).join('\u0001');
            if (prevSnap !== null && snap === prevSnap) { if (++stallCount >= 5) this.err(s.line, '無限ループの疑い', 'while の条件「' + exprSrc(s.cond) + '」に関わる値が繰り返しの中で変わらないため、条件がずっと本当（True）のままで終わりません', 'ループの中で条件に関わる変数を変えているか、break があるか確認してください'); }
            else stallCount = 0;
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
    if (t.k === 'attr') return this.eval({ k: 'attr', obj: t.obj, name: t.name, line }, env); // クラス属性などの読み取り（複合代入の現在値）
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
      if (isUnk(obj) || isUnk(idx)) { // 場所が決まらない書き換えは、根のオブジェクト全体を「不明」にする（古い値を確定値として残さない）
        const rn = rootNameOf(t);
        if (rn) { const cur = env.get(rn); if (isMutableVal(cur)) poison(cur, '書き換えられたかもしれない値'); }
        if (!isUnk(obj) && isMutableVal(obj)) poison(obj, '書き換えられたかもしれない値');
        return;
      }
      this.subSet(obj, idx, v, line);
      if (record) this.step(line, '「' + exprSrc(t.obj) + '」の [' + reprVal(idx) + '] を ' + reprVal(v) + ' にします');
      return;
    }
    if (t.k === 'tuple') { // (a, b) = ... の丸括弧つき分割代入
      this.assignTo({ k: 'ttuple', items: t.items.map(x => x.e), line }, v, env, line, record);
      return;
    }
    if (t.k === 'slice') {
      const obj = this.eval(t.obj, env);
      const lo = t.lo ? this.eval(t.lo, env) : null, hi = t.hi ? this.eval(t.hi, env) : null, st = t.step ? this.eval(t.step, env) : null;
      if (typeof obj === 'string') this.err(line, 'TypeError', '文字列は中身を書き換えられません（文字列は変更できない決まりです）', '新しい文字列を作って代入し直してください');
      if (isTuple(obj)) this.err(line, 'TypeError', 'タプルは中身を書き換えられません', '変えたいときはリストを使ってください');
      if (isUnk(obj)) return;
      if (!isList(obj)) this.err(line, 'TypeError', typeName(obj) + ' にはスライスで代入できません', '');
      const ix = this.sliceIdx(obj.__list.length, lo, hi, st, line);
      const seq = this.iterable(v, line, true);
      if (ix === null || seq === null) { if (seq === null && !isUnk(v) && !isSet(v)) this.err(line, 'TypeError', 'スライスへの代入には、リストなどの並びを渡してください', ''); this.markUnknownList(obj, t.obj, env, line); return; }
      if (ix.step === 1) { const nl = obj.__list.slice(0, ix.a); for (const x of seq) nl.push(x); for (let k = Math.max(ix.a, ix.b); k < obj.__list.length; k++) nl.push(obj.__list[k]); obj.__list.length = 0; for (const x of nl) obj.__list.push(x); } // スプレッド展開は巨大な並びで RangeError になるため手作業で組み直す（同じ配列を保ち別名にも反映）
      else { if (seq.length !== ix.idx.length) this.err(line, 'ValueError', '間隔つきスライスへの代入では、要素の数を揃えてください（' + seq.length + ' 個を ' + ix.idx.length + ' 個の場所に入れようとしています）', ''); ix.idx.forEach((k, q) => { obj.__list[k] = seq[q]; }); }
      if (record) this.step(line, '「' + exprSrc(t.obj) + '」の一部（スライス）を置き換えます → ' + reprVal(obj));
      return;
    }
    if (t.k === 'attr') {
      const obj = this.eval(t.obj, env);
      if (obj && obj.__class) { obj.cenv.vars.set(t.name, v); if (record) this.step(line, 'クラス「' + obj.cname + '」の属性「' + t.name + '」を ' + reprVal(v) + ' にします'); return; } // クラス属性は読み取りと同じ保存先へ書く（古い値を確定値として残さない）
      if (isUnk(obj)) return; // インスタンス等、対象が不明な値への代入は値も不明のままにする
      this.diag(line, 'note', '対応外', '属性（.名前）への代入はこの説明では解釈できません', '');
      return;
    }
    this.diag(line, 'note', '対応外', 'この形の代入はこの説明では解釈できません', '');
  }
  iterable(v, line, silent) {
    if (isUnk(v)) return null;
    if (isIter(v)) { this.materialize(v); if (v.failed) return null; const r = v.__iter.slice(v.pos || 0); v.pos = v.__iter.length; return r; }
    if (isView(v)) return viewItems(v);
    if (isList(v)) return v.__list.slice();
    if (isTuple(v)) return v.__tuple.slice();
    if (typeof v === 'string') return Array.from(v);
    if (isDict(v)) { const ks = []; for (const e of v.__dict.values()) ks.push(e.k); return ks; }
    if (isSet(v)) { const ord = setOrder(v); if (ord) return ord; if (this.orderFree) return v.__set.slice(); return null; } // 並び順が実行時に決まる集合は、順序に関係しない使い方でだけ展開する
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
BUILTIN_NAMES.push('repr', 'map', 'filter', 'hex', 'bin', 'oct', 'format', 'next', 'iter');
const ARITY = { repr: [1, 1], map: [2, 99], filter: [2, 2], hex: [1, 1], bin: [1, 1], oct: [1, 1], format: [1, 2], print: [0, 99], len: [1, 1], range: [1, 3], str: [0, 1], int: [0, 2], float: [0, 1], bool: [0, 1], next: [1, 2], iter: [1, 1], list: [0, 1], tuple: [0, 1], set: [0, 1], dict: [0, 1], sum: [1, 2], min: [0, 99], max: [0, 99], abs: [1, 1], round: [1, 2], sorted: [1, 1], reversed: [1, 1], enumerate: [1, 2], zip: [0, 99], type: [1, 1], input: [0, 1], isinstance: [2, 2], ord: [1, 1], chr: [1, 1], divmod: [2, 2], pow: [2, 3], any: [1, 1], all: [1, 1], open: [1, 3] };

Interp.prototype.eval = function (n, env) {
  if (!n) return UNK();
  switch (n.k) {
    case 'num': return !n.f && !SAFE(n.v) ? BIG() : NUM(n.v, n.f);
    case 'str': return n.v;
    case 'bool': return BOOL(n.v);
    case 'none': return NONE;
    case 'ellipsis': return ELLIPSIS;
    case 'byteslit': return UNK('バイト列（bytes）');
    case 'cxlit': return UNK('複素数');
    case 'walrus': { const v = this.eval(n.e, env); this.assignTo({ k: 'name', name: n.name, line: n.line }, v, env, n.line, false); return v; }
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
    case 'set': { const arr = []; for (const it of n.items) { let vs; if (it.e && it.e.k === 'star') { const prev = this.orderFree; this.orderFree = true; vs = this.iterable(this.eval(it.e.e, env), n.line); this.orderFree = prev; if (vs === null) return UNK(); } else vs = [this.eval(it.e, env)]; for (const v of vs) { this.needHash(v, n.line); if (isUnk(v)) return UNK(); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } } return SET(arr); }
    case 'dict': {
      const d = DICT();
      for (const p of n.pairs) { if (p.dstar) { const dv = this.eval(p.dstar, env); if (isUnk(dv)) return UNK(); if (!isDict(dv)) this.err(n.line, 'TypeError', '** のあとには辞書を書いてください', ''); for (const e of dv.__dict.values()) dictSet(d, e.k, e.v); continue; } const k = this.eval(p.k, env); const v = this.eval(p.v, env); if (!isUnk(k) && !dictSet(d, k, v)) this.err(n.line, 'TypeError', '辞書のキーにできない型です（' + typeName(k) + '）', 'キーには文字列や数値を使ってください'); if (isUnk(k)) return UNK(); }
      return d;
    }
    case 'un': {
      const v = this.eval(n.e, env);
      if (n.op === 'not') { const t = truthy(v); return t === null ? UNK() : BOOL(!t); }
      if (isUnk(v)) return UNK();
      if (isBool(v)) { const nv = v.v ? 1 : 0; return NUM(n.op === '-' ? -nv : n.op === '+' ? nv : ~nv, false); }
      if (isNum(v)) {
        if (n.op === '~') { if (v.f) this.err(n.line, 'TypeError', '小数には ~（ビット反転）は使えません', '整数に対して使ってください'); const tv = Math.trunc(v.v); return NUM(Math.abs(tv) < 2147483648 ? ~tv : Number(~BigInt(tv)), false); }
        return n.op === '-' ? NUM(-v.v, v.f) : v;
      }
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
      if (n.l && n.l.k === 'bin') { // 左肩の長い連鎖（0 + 1 + … + 1999）は再帰せず左から畳む（スタック超過の回避）
        const chain = [];
        let cur = n;
        while (cur && cur.k === 'bin') { chain.unshift(cur); cur = cur.l; }
        let acc = this.eval(cur, env);
        for (const nd of chain) acc = this.binOp(nd.op, acc, this.eval(nd.r, env), nd.line);
        return acc;
      }
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
      if (isUnk(obj) && obj.mod === 'math' && n.name in MATH_CONST) return NUM(MATH_CONST[n.name], true);
      if (isUnk(obj)) return UNK();
      if (isNone(obj)) this.err(n.line, 'AttributeError', 'None には属性「' + n.name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');
      if (isNum(obj) && (n.name === 'real' || n.name === 'imag')) return n.name === 'real' ? obj : NUM(0, obj.f);
      if (isBool(obj) && (n.name === 'real' || n.name === 'imag')) return NUM(n.name === 'real' ? (obj.v ? 1 : 0) : 0, false);
      if (isNum(obj) && !obj.f && n.name === 'numerator') return obj;
      if (isNum(obj) && !obj.f && n.name === 'denominator') return NUM(1, false);
      if (obj && obj.__range && obj.rng && (n.name === 'start' || n.name === 'stop' || n.name === 'step')) return NUM(obj.rng[n.name === 'start' ? 0 : n.name === 'stop' ? 1 : 2], false);
      if (obj && obj.__class) { if (obj.cenv.vars.has(n.name)) return obj.cenv.vars.get(n.name); return UNK('クラス属性「' + n.name + '」の値'); }
      { const tn = typeName(obj); if (TYPE_ATTRS[tn] && !TYPE_ATTRS[tn].has(n.name)) this.err(n.line, 'AttributeError', tn + ' には属性「' + n.name + '」はありません', '綴りを確認するか、リファレンスで使える名前を確認してください'); }
      { const tn = typeName(obj); if (TYPE_ATTRS[tn] && TYPE_ATTRS[tn].has(n.name) && (typeof obj === 'string' || isList(obj) || isDict(obj) || isSet(obj) || isTuple(obj) || (obj && obj.__range) || isNum(obj) || isBool(obj))) return METHODREF(obj, n.name); }
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

const INPLACE_DONE = { __inplace: true };
// 複合代入（+= など）：リスト・集合・辞書の一部は CPython では同じオブジェクトを書き換える（別名にも反映される）
Interp.prototype.binOpInPlace = function (op, cur, rhs, line) {
  if (isList(cur) && (op === '+' || op === '*')) {
    if (op === '+') {
      const seq = this.iterable(rhs, line, true);
      if (seq === null) { if (!isUnk(rhs)) this.err(line, 'TypeError', 'リストに足せるのは、リストや文字列などの「並び」だけです', '右側は並びにしてください'); poison(cur, '書き換えられたかもしれないリスト'); return INPLACE_DONE; }
      for (const x of seq) cur.__list.push(x);
      return INPLACE_DONE;
    }
    if (!isNum(rhs) || rhs.f) this.err(line, 'TypeError', 'リストの繰り返し回数には整数を使ってください', '');
    const n = Math.trunc(rhs.v);
    if (n <= 0) { cur.__list.length = 0; return INPLACE_DONE; }
    const orig = cur.__list.slice();
    if (orig.length * n > 100000) { poison(cur, 'とても長いリスト'); return INPLACE_DONE; }
    cur.__list.length = 0;
    for (let k = 0; k < n; k++) for (const x of orig) cur.__list.push(x);
    return INPLACE_DONE;
  }
  if (isSet(cur) && isSet(rhs) && (op === '|' || op === '&' || op === '-' || op === '^')) {
    const res = this.binOp(op, cur, rhs, line);
    if (isSet(res)) { cur.__set.length = 0; for (const x of res.__set) cur.__set.push(x); }
    else poison(cur, '書き換えられたかもしれない集合');
    return INPLACE_DONE;
  }
  if (isDict(cur) && op === '|' && isDict(rhs)) {
    for (const e of rhs.__dict.values()) dictSet(cur, e.k, e.v);
    return INPLACE_DONE;
  }
  return this.binOp(op, cur, rhs, line);
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
    if (typeof l === 'string' && typeof r === 'string') { if (l.length + r.length > 200000) return UNK('とても長い文字列'); return l + r; }
    if (isList(l) && isList(r)) { if (l.__list.length + r.__list.length > 200000) return UNK('とても長いリスト'); return LIST(l.__list.concat(r.__list)); }
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
    if (typeof l === 'string' && isNum(rn)) { if (isNum(r) && r.f) this.typeErr(line, op, l, r); return repeatStr(l, rn.v, line, this); }
    if (isNum(ln) && typeof r === 'string') { if (isNum(l) && l.f) this.typeErr(line, op, l, r); return repeatStr(r, ln.v, line, this); }
    if ((isList(l) || isTuple(l)) && isNum(rn) && !rn.f) { const a = repeatArr(isList(l) ? l.__list : l.__tuple, rn.v); return a === null ? UNK('とても長い並び') : isList(l) ? LIST(a) : TUPLE(a); }
    if (isNum(ln) && !ln.f && (isList(r) || isTuple(r))) { const a = repeatArr(isList(r) ? r.__list : r.__tuple, ln.v); return a === null ? UNK('とても長い並び') : isList(r) ? LIST(a) : TUPLE(a); }
    this.typeErr(line, op, l, r);
  }
  if (op === '/' || op === '//' || op === '%') {
    if (isNum(ln) && isNum(rn)) {
      if (rn.v === 0) this.err(line, 'ZeroDivisionError', '0 で割り算（または余り）を求めることはできません', '割る数が 0 にならないよう、条件で分けるか値を確認してください');
      if (op === '/') return NUM(ln.v / rn.v, true);
      if (ln.f || rn.f) { const dm = floatDivmod(ln.v, rn.v, line, this); return NUM(op === '//' ? dm.q : dm.m, true); }
      // 整数同士は BigInt で正確に（double の割り算では切り捨ての境界を間違えることがある）
      const A = BigInt(Math.trunc(ln.v)), B = BigInt(Math.trunc(rn.v));
      let q = A / B; if (A % B !== 0n && ((A < 0n) !== (B < 0n))) q -= 1n;
      return NUM(Number(op === '//' ? q : A - q * B), false);
    }
    if (op === '%' && typeof l === 'string') { this.diag(line, 'note', '対応外', '文字列の % 書式はこの説明では解釈できません', 'f文字列（f"…{値}…"）を使うと説明できます'); return UNK(); }
    this.typeErr(line, op, l, r);
  }
  if (op === '**') {
    if (isNum(ln) && isNum(rn)) {
      if (ln.v === 0 && rn.v < 0) this.err(line, 'ZeroDivisionError', '0 を負の数で累乗することはできません', '');
      if (!ln.f && !rn.f && rn.v >= 0) { // 整数の累乗は BigInt で正確に求め、安全な範囲を超えたら正直に「不明」を返す
        const E = Math.trunc(rn.v);
        if (E > 10000) return BIG();
        const R = BigInt(Math.trunc(ln.v)) ** BigInt(E);
        const n = Number(R);
        return SAFE(n) && BigInt(n) === R ? NUM(n, false) : BIG();
      }
      if (ln.v < 0 && !Number.isInteger(rn.v)) return UNK('複素数の結果'); // (-2) ** 0.5 は複素数になる
      const res = Math.pow(ln.v, rn.v);
      return NUM(res, ln.f || rn.f || rn.v < 0 || !Number.isInteger(res));
    }
    this.typeErr(line, op, l, r);
  }
  if (op === '|' || op === '&' || op === '^' || op === '<<' || op === '>>') {
    if (isBool(l) && isBool(r) && op !== '<<' && op !== '>>') return BOOL(op === '|' ? (l.v || r.v) : op === '&' ? (l.v && r.v) : (l.v !== r.v));
    if (isSet(l) && isSet(r) && op !== '<<' && op !== '>>') {
      if (op === '|') { const a = l.__set.slice(); for (const x of r.__set) if (!a.some(y => eqVal(x, y) === true)) a.push(x); return SET(a); }
      if (op === '&') return SET(l.__set.filter(x => r.__set.some(y => eqVal(x, y) === true)));
      const kept = l.__set.filter(x => !r.__set.some(y => eqVal(x, y) === true)); for (const x of r.__set) if (!l.__set.some(y => eqVal(x, y) === true) && !kept.some(y => eqVal(x, y) === true)) kept.push(x); return SET(kept); // 対称差：右だけにある要素を足す（共通要素は足さない）
    }
    if (op === '|' && isDict(l) && isDict(r)) { const d = DICT(); for (const e of l.__dict.values()) dictSet(d, e.k, e.v); for (const e of r.__dict.values()) dictSet(d, e.k, e.v); return d; }
    if ((op === '|' || op === '&') && isView(l) && isView(r) && l.which === 'keys' && r.which === 'keys') {
      const a = viewItems(l), b = viewItems(r);
      return SET(op === '&' ? a.filter(x => b.some(y => eqVal(x, y) === true)) : [...a, ...b.filter(x => !a.some(y => eqVal(x, y) === true))]);
    }
    if (isNum(ln) && isNum(rn)) {
      if (ln.f || rn.f) this.typeErr(line, op, l, r); // 小数にビット演算は使えない
      const A = BigInt(Math.trunc(ln.v)), B = BigInt(Math.trunc(rn.v));
      let R;
      if (op === '|') R = A | B;
      else if (op === '&') R = A & B;
      else if (op === '^') R = A ^ B;
      else {
        if (B < 0n) this.err(line, 'ValueError', 'シフトの回数を負の数にはできません', '');
        if (B > 100000n) return BIG();
        R = op === '<<' ? A << B : A >> B;
      }
      const n = Number(R);
      return SAFE(n) && BigInt(n) === R ? NUM(n, false) : BIG();
    }
    this.typeErr(line, op, l, r);
  }
  return UNK();
};
// CPython の float の // と %（float_divmod と同じ計算：余りの符号は割る数に合わせる）
function floatDivmod(x, y, line, self) {
  if (Number.isNaN(x) || Number.isNaN(y)) return { q: NaN, m: NaN };
  if (!Number.isFinite(x)) self.err(line, 'ValueError', '無限大では割り算の切り捨て・余りは求められません', '');
  if (!Number.isFinite(y)) { // 割る数が無限大：余りは x または ±inf、商は 0 か -1
    const m0 = x % y;
    const m = m0 !== 0 && ((y < 0) !== (m0 < 0)) ? m0 + y : m0;
    return { q: x !== 0 && ((x < 0) !== (y < 0)) ? -1 : 0, m };
  }
  let mod = x % y;
  let div = (x - mod) / y;
  if (mod !== 0) { if ((y < 0) !== (mod < 0)) { mod += y; div -= 1; } } // CPython の float_divmod：余りの符号を割る数に合わせるとき商も1引く（0.5 // -3 は -1.0）
  else mod = y < 0 || Object.is(y, -0) ? -0 : 0;
  let q = Math.floor(div);
  if (div - q > 0.5) q += 1;
  if (q === 0) q = ((x < 0 || Object.is(x, -0)) !== (y < 0 || Object.is(y, -0))) ? -0 : 0; // 商が 0 のときの符号は通常の割り算 x/y に従う（-0.5 // -3 は 0.0、0.0 // -3 は -0.0）
  return { q, m: mod };
}
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
function repeatArr(a, n) { if (n <= 0) return []; if (a.length * n > 100000) return null; const out = []; for (let i = 0; i < n; i++) for (const x of a) out.push(x); return out; }

Interp.prototype.compare = function (op, l, r, line) {
  if (op === 'in' || op === 'not in') {
    let res = null;
    if (isUnk(l) || isUnk(r)) res = null;
    else if (typeof r === 'string' && typeof l === 'string') res = r.includes(l);
    else if (isList(r)) res = r.__list.some(x => eqVal(x, l) === true);
    else if (isTuple(r)) res = r.__tuple.some(x => eqVal(x, l) === true);
    else if (isSet(r)) res = r.__set.some(x => eqVal(x, l) === true);
    else if (isDict(r)) { if (dictKeyId(l) === null) this.err(line, 'TypeError', typeName(l) + ' は辞書のキーにできません（ハッシュできない型です）', ''); res = dictGet(r, l) !== undefined || [...r.__dict.values()].some(e => eqVal(e.k, l) === true); }
    else if (isIter(r)) {
      this.materialize(r);
      if (r.failed) res = null;
      else {
        let k = r.pos || 0; res = false;
        while (k < r.__iter.length) { const e = eqVal(r.__iter[k], l); if (e === null) { res = null; break; } k++; if (e) { res = true; break; } }
        if (res !== null) r.pos = res ? k : r.__iter.length; // CPython の in は、見つけた所までイテレータを進める
      }
    }
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
  else if (isSet(l) && isSet(r)) {
    const sub = l.__set.every(x => r.__set.some(y => eqVal(x, y) === true));
    const sup = r.__set.every(x => l.__set.some(y => eqVal(x, y) === true));
    return BOOL(op === '<' ? sub && !sup : op === '<=' ? sub : op === '>' ? sup && !sub : sup);
  }
  else this.err(line, 'TypeError', typeName(l) + ' と ' + typeName(r) + ' は大小比較（' + op + '）ができません', '比べる相手は同じ型（数値同士・文字列同士）にしてください');
  if (c === null) return UNK();
  return BOOL(op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0);
};

// 添字として使える整数か確かめる（bool は 0/1 として使える。float などは TypeError）
Interp.prototype.intIndex = function (idx, line, what) {
  if (isBool(idx)) return idx.v ? 1 : 0;
  if (!isNum(idx) || idx.f) this.err(line, 'TypeError', (what || '番号（インデックス）') + 'には整数を使ってください（' + typeName(idx) + ' は使えません）', '');
  return idx.v;
};
Interp.prototype.subGet = function (obj, idx, line) {
  if (isUnk(obj) || isUnk(idx)) return UNK();
  if (typeof obj === 'string' || isList(obj) || isTuple(obj)) {
    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;
    idx = NUM(this.intIndex(idx, line), false);
    let i = Math.trunc(idx.v);
    if (i < 0) i += arr.length;
    if (i < 0 || i >= arr.length) this.err(line, 'IndexError', arr.length ? '番号 ' + fmtNum(idx) + ' の要素はありません（要素は ' + arr.length + ' 個で、番号は 0〜' + (arr.length - 1) + ' です）' : '番号 ' + fmtNum(idx) + ' の要素はありません（要素は0個です）', '番号が要素の数を超えていないか確認してください。後ろから数えるときは -1 が最後です');
    return typeof obj === 'string' ? arr[i] : arr[i];
  }
  if (isDict(obj)) {
    if (dictKeyId(idx) === null) this.err(line, 'TypeError', typeName(idx) + ' は辞書のキーにできません（ハッシュできない型です）', 'キーには文字列・数値・タプルなどを使ってください');
    const v = dictGet(obj, idx);
    if (v === undefined) {
      if ([...obj.__dict.values()].some(e => eqVal(e.k, idx) === true)) return obj.__dict.get(dictKeyId(idx)).v;
      this.err(line, 'KeyError', 'キー ' + reprVal(idx) + ' は辞書にありません', 'キーの綴りを確認するか、.get(' + reprVal(idx) + ') を使うと無いときに None が返ります');
    }
    return v;
  }
  if (obj && obj.__range) {
    idx = NUM(this.intIndex(idx, line), false);
    let i = Math.trunc(idx.v); if (i < 0) i += obj.__range.length;
    if (i < 0 || i >= obj.__range.length) this.err(line, 'IndexError', 'range の範囲外の番号です', '');
    return obj.__range[i];
  }
  this.err(line, 'TypeError', typeName(obj) + ' には [ ] で要素を取り出す使い方はできません', '');
  return UNK();
};
Interp.prototype.subSet = function (obj, idx, v, line) {
  if (isUnk(obj)) return;
  if (isUnk(idx)) { if (isMutableVal(obj)) poison(obj, '書き換えられたかもしれない値'); return; }
  if (isList(obj)) {
    idx = NUM(this.intIndex(idx, line), false);
    let i = Math.trunc(idx.v); if (i < 0) i += obj.__list.length;
    if (i < 0 || i >= obj.__list.length) this.err(line, 'IndexError', '番号 ' + fmtNum(idx) + ' の要素はありません（リストは ' + obj.__list.length + ' 個）', '末尾に足すときは append() を使ってください');
    obj.__list[i] = v; return;
  }
  if (isDict(obj)) { if (!dictSet(obj, idx, v)) this.err(line, 'TypeError', '辞書のキーにできない型です（' + typeName(idx) + '）', 'キーには文字列や数値を使ってください'); return; }
  if (typeof obj === 'string') this.err(line, 'TypeError', '文字列は中身を書き換えられません（文字列は変更できない決まりです）', '新しい文字列を作って代入し直してください');
  if (isTuple(obj)) this.err(line, 'TypeError', 'タプルは中身を書き換えられません', '変えたいときはリストを使ってください');
  this.err(line, 'TypeError', typeName(obj) + ' には [ ] で代入できません', '');
};
// スライスが指す番号の一覧（CPython の slice.indices と同じ規則）。番号が実行時に決まるなら null
Interp.prototype.sliceIdx = function (len, lo, hi, st, line) {
  for (const b of [lo, hi, st]) if (b !== null && !isNone(b) && !isUnk(b) && !(isBool(b) || (isNum(b) && !b.f))) this.err(line, 'TypeError', 'スライスの番号には整数か None を使ってください', '');
  if ([lo, hi, st].some(b => b && isUnk(b))) return null;
  const iv = b => b === null || isNone(b) ? null : isBool(b) ? (b.v ? 1 : 0) : b.v;
  const step = iv(st) === null ? 1 : iv(st);
  if (step === 0) this.err(line, 'ValueError', 'スライスの間隔（3つ目の数）を 0 にはできません', '');
  const adj = (v, def, lowB, highB) => { if (v === null) return def; if (v < 0) { v += len; if (v < lowB) v = lowB; } else if (v > highB) v = highB; return v; };
  const a = step > 0 ? adj(iv(lo), 0, 0, len) : adj(iv(lo), len - 1, -1, len - 1);
  const b = step > 0 ? adj(iv(hi), len, 0, len) : adj(iv(hi), -1, -1, len - 1);
  const idx = []; if (step > 0) for (let k = a; k < b; k += step) idx.push(k); else for (let k = a; k > b; k += step) idx.push(k);
  return { a, b, step, idx };
};
Interp.prototype.markUnknownList = function (obj, baseNode, env, line) {
  this.diag(line, 'note', '注意', '書き換える範囲が実行時に決まるため、このリストの中身は分からなくなります', '');
  if (baseNode && baseNode.k === 'name') env.set(baseNode.name, UNK('書き換えられたリスト'));
  else { const n = obj.__list.length; for (let k = 0; k < n; k++) obj.__list[k] = UNK('書き換えられたかもしれない要素'); }
};
Interp.prototype.sliceGet = function (obj, lo, hi, st, line) {
  if (isUnk(obj)) return UNK();
  if (typeof obj === 'string' || isList(obj) || isTuple(obj) || (obj && obj.__range)) {
    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : isTuple(obj) ? obj.__tuple : obj.__range;
    const ix = this.sliceIdx(arr.length, lo, hi, st, line); // CPython の slice.indices と同じ切り詰め規則
    if (ix === null) return UNK();
    const out = ix.idx.map(k => arr[k]);
    if (typeof obj === 'string') return out.join('');
    if (obj && obj.__range) { const r = RANGE(out); if (obj.rng) { const ns = obj.rng[0] + ix.a * obj.rng[2], nstep = obj.rng[2] * ix.step; r.rng = [ns, ns + out.length * nstep, nstep]; } return r; }
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
  if (fn && fn.__class) { this.diag(n.line, 'note', '対応外', 'クラス「' + fn.cname + '」のインスタンスそのものは追跡しません。値は「実行時に決まる値」として扱います（__init__ の処理は実行します）', ''); return this.instantiate(fn, args, n.kwargs, env, n.line); }
  if (isUnk(fn)) { for (const a of args) if (isMutableVal(a)) poison(a, '呼び出しで書き換えられたかもしれない値'); return UNK(); }
  this.err(n.line, 'TypeError', typeName(fn) + ' は呼び出し（ ）ができません', '関数名のあとに ( ) を付けて呼び出します。変数と関数を取り違えていないか確認してください');
  return UNK();
};
// インスタンスそのものは追跡しない（UNK）が、__init__ は実行して副作用（クラス属性や外側の変数の書き換え）を追う
Interp.prototype.instantiate = function (cls, args, kwargs, env, line) {
  const inst = UNK('「' + cls.cname + '」のインスタンス');
  const init = cls.cenv && cls.cenv.vars.get('__init__');
  if (isFunc(init)) {
    try { this.callUserFunc(init, [inst, ...args], kwargs || {}, env, line); }
    catch (e) { if (!(e instanceof Flow && e.kind === 'return')) throw e; }
  }
  return inst;
};
Interp.prototype.callFn = function (fv, args, env, line) {
  if (isUnk(fv)) { for (const a of args) if (isMutableVal(a)) poison(a, '呼び出しで書き換えられたかもしれない値'); return UNK(); }
  if (fv && fv.__builtin) return this.callBuiltin(fv.__builtin, args, {}, env, line, null);
  if (fv && fv.__method) return this.callMethod(fv.obj, fv.name, args, {}, env, line);
  if (fv && fv.__class) return this.instantiate(fv, args, {}, env, line);
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
    if (a.star) { const seq = this.iterable(this.eval(a.e, env), n.line, true); if (seq === null) return null; for (const x of seq) args.push(x); }
    else args.push(this.eval(a.e, env));
  }
  return args;
};
Interp.prototype.callUserFunc = function (fn, args, kwargs, env, line) {
  this.tick(); // 関数呼び出しも作業量の予算を消費する（fib のような指数爆発を止めるため）
  const def = fn.def;
  const params = def.params;
  const posParams = params.filter(p => !p.bare && !p.star && !p.kwOnly);
  const starParam = params.find(p => p.star === 1 && p.name);
  const kwParam = params.find(p => p.star === 2);
  const kwNames = Object.keys(kwargs);
  if (args.length > posParams.length && !starParam)
    this.err(line, 'TypeError', '関数「' + def.name + '」の引数が多すぎます（' + posParams.length + ' 個までなのに ' + args.length + ' 個渡しています）', '呼び出しの引数の数を確認してください');
  if (def.isGen === undefined) def.isGen = hasNode(def.body, x => x.k === 'unkexpr' && (x.what === 'yield' || x.what === 'yield from'));
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
  let ret = NONE; const prevOF = this.orderFree; this.orderFree = false;
  try { this.execBlock(def.body, local, { inFunc: true }); }
  catch (e) { if (e instanceof Flow && e.kind === 'return') ret = e.value; else { this.depth--; this.orderFree = prevOF; throw e; } }
  this.depth--; this.orderFree = prevOF;
  this.step(line, '関数「' + def.name + '」は ' + reprVal(ret) + ' を返します');
  return ret;
};

const ORDER_FREE = new Set(['sorted', 'sum', 'min', 'max', 'any', 'all', 'set', 'len']);
Interp.prototype.callBuiltin = function (name, args, kwargs, env, line, node) {
  const prev = this.orderFree; this.orderFree = ORDER_FREE.has(name);
  try { return this.callBuiltin0(name, args, kwargs, env, line, node); } finally { this.orderFree = prev; }
};
Interp.prototype.callBuiltin0 = function (name, args, kwargs, env, line, node) {
  const ar = ARITY[name];
  if (ar && (args.length < ar[0] || args.length > ar[1])) {
    this.err(line, 'TypeError', name + '() の引数の数が合いません（' + (ar[0] === ar[1] ? ar[0] + ' 個' : ar[0] + '〜' + ar[1] + ' 個') + '必要ですが、' + args.length + ' 個渡しています）', 'リファレンスで ' + name + ' の使い方を確認してください');
  }
  const kw = {};
  for (const k of Object.keys(kwargs || {})) kw[k] = this.eval(kwargs[k], env);
  switch (name) {
    case 'print': {
      let sep = ' ', end = '\n';
      if (kw.sep !== undefined && !isNone(kw.sep)) { if (isUnk(kw.sep)) { this.emitRaw('（実行時に決まる値）\n', line); return NONE; } if (typeof kw.sep !== 'string') this.err(line, 'TypeError', 'print() の sep は文字列か None にしてください', ''); sep = kw.sep; }
      if (kw.end !== undefined && !isNone(kw.end)) { if (isUnk(kw.end)) { this.emitRaw('（実行時に決まる値）\n', line); return NONE; } if (typeof kw.end !== 'string') this.err(line, 'TypeError', 'print() の end は文字列か None にしてください', ''); end = kw.end; }
      const text = args.map(a => strVal(a)).join(sep);
      this.emitRaw(text + end, line);
      this.step(line, '画面に「' + text + '」と表示します' + (end !== '\n' ? '（改行の代わりに ' + reprVal(end) + ' を付けます）' : ''));
      return NONE;
    }
    case 'repr': return isUnk(args[0]) || isIter(args[0]) ? UNK() : reprVal(args[0]);
    case 'iter': { const v = args[0]; if (isUnk(v)) return UNK(); if (isIter(v)) return v; const kind = isList(v) ? 'list_iterator' : isTuple(v) ? 'tuple_iterator' : typeof v === 'string' ? (/^[\x00-\x7f]*$/.test(v) ? 'str_ascii_iterator' : 'str_iterator') : isDict(v) ? 'dict_keyiterator' : isSet(v) ? 'set_iterator' : v && v.__range ? 'range_iterator' : null; const seq = kind ? this.iterable(v, line, true) : null; if (seq === null) { if (kind) return UNK(); this.err(line, 'TypeError', typeName(v) + ' は繰り返しに使えません', ''); } return ITER(seq, kind); }
    case 'next': { const v = args[0]; if (isUnk(v)) return UNK(); if (!isIter(v)) this.err(line, 'TypeError', typeName(v) + ' は next() に使えません（イテレータではありません）', 'iter() でイテレータにしてから使ってください'); { this.materialize(v); if (v.failed) return UNK(); } const pos = v.pos || 0; if (pos < v.__iter.length) { v.pos = pos + 1; this.step(line, v.kind + ' から次の値 ' + reprVal(v.__iter[pos]) + ' を取り出します'); return v.__iter[pos]; } if (args.length > 1) return args[1]; this.err(line, 'StopIteration', 'これ以上取り出せる値がありません', 'next(it, 既定値) のように2つ目を渡すと、終わったときにその値が返ります'); return UNK(); }
    case 'format': { if (isUnk(args[0])) return UNK(); const r = fmtSpec(args[0], args.length > 1 ? args[1] : ''); return r === null ? UNK('format の結果') : r; }
    case 'hex': case 'bin': case 'oct': { let v = args[0]; if (isUnk(v)) return UNK(); if (isBool(v)) v = NUM(v.v ? 1 : 0, false); if (!isNum(v) || v.f) this.err(line, 'TypeError', name + '() には整数を渡してください', ''); const base = { hex: 16, bin: 2, oct: 8 }[name]; const pre = { hex: '0x', bin: '0b', oct: '0o' }[name]; return (v.v < 0 ? '-' : '') + pre + Math.abs(v.v).toString(base); }
    case 'map': {
      const takers = []; // ITER 引数はカーソルを共有して歩調を合わせて取る（同じイテレータを2回渡しても CPython と同じになる）
      for (const a of args.slice(1)) {
        if (isIter(a)) { { this.materialize(a); if (a.failed) return UNK(); } takers.push(() => ((a.pos || 0) < a.__iter.length ? a.__iter[(a.pos = (a.pos || 0) + 1) - 1] : EXH)); }
        else { const seq = this.iterable(a, line); if (seq === null) return UNK(); let i = 0; takers.push(() => (i < seq.length ? seq[i++] : EXH)); }
      }
      const out = [];
      while (takers.length) { const row = []; let done = false; for (const t of takers) { const r = t(); if (r === EXH) { done = true; break; } row.push(r); } if (done) break; const r = this.callFn(args[0], row, env, line); if (isUnk(r) && isUnk(args[0])) return UNK(); out.push(r); }
      return ITER(out, 'map');
    }
    case 'filter': {
      const seq = this.iterable(args[1], line); if (seq === null) return UNK(); const out = [];
      for (const x of seq) { const r = isNone(args[0]) ? x : this.callFn(args[0], [x], env, line); const t = truthy(r); if (t === null) return UNK(); if (t) out.push(x); }
      return ITER(out, 'filter');
    }
    case 'input': {
      this.step(line, 'キーボードからの入力を待ちます（入力された値は実行時に決まります）');
      if (args.length && typeof args[0] === 'string') this.emitRaw(args[0], line); // プロンプトは改行なしで表示される
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
      const ns = args.map(a => { if (isUnk(a)) return null; if (isBool(a)) return a.v ? 1 : 0; if (!isNum(a) || a.f) this.err(line, 'TypeError', 'range() の引数は整数にしてください（' + typeName(a) + ' は使えません）', ''); return a.v; });
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
    case 'str': return args.length === 0 ? '' : isUnk(args[0]) ? UNK(args[0].desc) : isIter(args[0]) ? UNK(args[0].kind + ' オブジェクトの文字列表現') : strVal(args[0]);
    case 'int': {
      const v = args[0];
      if (isUnk(v)) return UNK();
      if (args.length === 0) return NUM(0, false);
      if (args.length > 1) { const b = args[1]; if (isUnk(b)) return UNK(); const bn = this.intIndex(b, line, 'int() の基数'); if (!(bn === 0 || (bn >= 2 && bn <= 36))) this.err(line, 'ValueError', 'int() の基数は 2〜36 か 0 にしてください', ''); if (typeof v !== 'string') this.err(line, 'TypeError', '基数を指定するときは、int() に文字列を渡してください', ''); }
      if (isNum(v)) { if (!Number.isFinite(v.v)) this.err(line, Number.isNaN(v.v) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数に変換できません', ''); const n = Math.trunc(v.v); return SAFE(n) ? NUM(n === 0 ? 0 : n, false) : BIG(); }
      if (isBool(v)) return NUM(v.v ? 1 : 0, false);
      if (typeof v === 'string') {
        let base = 10;
        if (args.length > 1) { const b = args[1]; if (isBool(b)) base = b.v ? 1 : 0; else if (isNum(b) && !b.f) base = b.v; }
        const r = pyIntFromStr(v, base);
        if (r.err) this.err(line, 'ValueError', '文字列「' + v + '」は整数に変換できません', 'int() で変えられるのは "123" のような数字だけの文字列です（アンダースコアは数字の間だけ使えます）');
        return r.big ? BIG() : NUM(r.n, false);
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
      if (typeof v === 'string') { const t = normDigits(v.trim()); if (!usOkFloat(t)) this.err(line, 'ValueError', '文字列「' + v + '」は小数に変換できません', ''); const tu = t.replace(/_/g, ''); const sp = /^([+-]?)(inf|infinity|nan)$/i.exec(tu); if (sp) return NUM(/nan/i.test(sp[2]) ? NaN : (sp[1] === '-' ? -Infinity : Infinity), true); if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(tu)) return NUM(parseFloat(tu), true); this.err(line, 'ValueError', '文字列「' + v + '」は小数に変換できません', ''); }
      this.err(line, 'TypeError', typeName(v) + ' は float() で変換できません', '');
      return UNK();
    }
    case 'bool': { if (!args.length) return BOOL(false); const t = truthy(args[0]); return t === null ? UNK() : BOOL(t); }
    case 'list': case 'tuple': case 'set': {
      if (args.length === 0) return name === 'list' ? LIST() : name === 'tuple' ? TUPLE() : SET();
      const seq = this.iterable(args[0], line, true);
      if (seq === null) { if (isUnk(args[0]) || isSet(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }
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
      if (!args.length) this.err(line, 'TypeError', name + '() には少なくとも1つの引数が必要です', '');
      let items = args.length === 1 ? this.iterable(args[0], line) : args;
      if (items === null) return UNK();
      if (!items.length) { if (kw.default !== undefined) return kw.default; this.err(line, 'ValueError', name + '() に空の集まりを渡すことはできません', '要素が1つ以上あるときに使ってください'); }
      const keys = this.keyed(items, kw.key && !isNone(kw.key) ? kw.key : null, env, line); if (keys === null) return UNK();
      let bi = 0;
      for (let i = 1; i < items.length; i++) { const c = this.compare(name === 'min' ? '<' : '>', keys[i], keys[bi], line); if (isUnk(c)) return UNK(); if (c.v) bi = i; }
      return items[bi];
    }
    case 'abs': { const v = args[0]; if (isUnk(v)) return UNK(); if (isBool(v)) return NUM(v.v ? 1 : 0, false); if (isNum(v)) return NUM(Math.abs(v.v), v.f); this.err(line, 'TypeError', typeName(v) + ' には abs() は使えません', '数値に使ってください'); return UNK(); }
    case 'round': {
      const v = args[0]; if (isUnk(v)) return UNK();
      const nd = args.length > 1 ? args[1] : kw.ndigits;
      if (isBool(v)) return NUM(v.v ? 1 : 0, false);
      if (!isNum(v)) this.err(line, 'TypeError', 'round() は数値に使います', '');
      if (nd !== undefined && !isNone(nd)) {
        if (isUnk(nd)) return UNK();
        if (!isNum(nd) || nd.f) this.err(line, 'TypeError', 'round() の2つ目（桁数）には整数を使ってください', '');
        const p = nd.v;
        if (!v.f) { if (p >= 0) return v; return UNK('round の結果'); }
        if (!Number.isFinite(v.v)) return v;
        if (p < 0 || p > 30) return UNK('round の結果');
        return NUM(parseFloat(decFixed(v.v, p)), true); // 2進数の正確な値を偶数丸め（round(2.675, 2) は 2.67）
      }
      if (!v.f) return v;
      if (Number.isFinite(v.v) && Math.abs(v.v) >= 2 ** 53) return BIG(); // とても大きな小数はすでに整数値（桁数が多く正確には示さない）
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
      const lens = [], takers = []; // ITER 引数はカーソルを共有して1つずつ取る（zip(it, it) が [(1, 2), (3, 4)] になる）
      for (const a of args) {
        if (isIter(a)) { { this.materialize(a); if (a.failed) return UNK(); } lens.push(a.__iter.length - (a.pos || 0)); takers.push(() => ((a.pos || 0) < a.__iter.length ? a.__iter[(a.pos = (a.pos || 0) + 1) - 1] : EXH)); }
        else { const seq = this.iterable(a, line, true); if (seq === null) return UNK(); lens.push(seq.length); let i = 0; takers.push(() => (i < seq.length ? seq[i++] : EXH)); }
      }
      if (kw.strict !== undefined && truthy(kw.strict) === true && lens.length > 1 && !lens.every(l => l === lens[0])) this.err(line, 'ValueError', 'zip(..., strict=True) では、並びの長さが揃っていないとエラーになります', '');
      const out = [];
      while (takers.length) { const row = []; let done = false; for (const t of takers) { const r = t(); if (r === EXH) { done = true; break; } row.push(r); } if (done) break; out.push(TUPLE(row)); }
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
    case 'chr': { const v = args[0]; if (isUnk(v)) return UNK(); const n = this.intIndex(v, line, 'chr() の引数'); if (!(n >= 0 && n <= 0x10FFFF)) this.err(line, 'ValueError', 'chr() の引数は 0〜1114111（0x10FFFF）の範囲にしてください', ''); return String.fromCodePoint(n); }
    case 'divmod': { const a = args[0], b = args[1]; if (isUnk(a) || isUnk(b)) return UNK(); if (!(isNum(a) || isBool(a)) || !(isNum(b) || isBool(b))) this.err(line, 'TypeError', 'divmod() には数値を渡してください', ''); if ((isBool(b) ? (b.v ? 1 : 0) : b.v) === 0) this.err(line, 'ZeroDivisionError', '0 で割ることはできません', ''); return TUPLE([this.binOp('//', a, b, line), this.binOp('%', a, b, line)]); }
    case 'pow': {
      if (args.length === 3) {
        const [b, e, m] = args;
        if (isUnk(b) || isUnk(e) || isUnk(m)) return UNK();
        const bad = x => !(isBool(x) || (isNum(x) && !x.f));
        if (bad(b) || bad(e) || bad(m)) this.err(line, 'TypeError', 'pow() に3つ目（割る数）を渡すときは、3つとも整数にしてください', '');
        const bv = isBool(b) ? (b.v ? 1 : 0) : b.v, ev = isBool(e) ? (e.v ? 1 : 0) : e.v, mv = isBool(m) ? (m.v ? 1 : 0) : m.v;
        if (!SAFE(bv) || !SAFE(ev) || !SAFE(mv)) return UNK('pow の結果');
        if (mv === 0) this.err(line, 'ValueError', 'pow() の3つ目（割る数）を 0 にはできません', '');
        const r = modPowBig(BigInt(bv), BigInt(ev), BigInt(mv));
        if (r.err) this.err(line, 'ValueError', 'pow() の底と割る数が互いに素でないため、負の指数の逆数が求められません', '');
        return SAFE(Number(r.v)) ? NUM(Number(r.v), false) : BIG();
      }
      return this.binOp('**', args[0], args[1], line);
    }
    case 'any': case 'all': {
      const v0 = args[0];
      if (isIter(v0)) { // イテレータは途中まで消費して短絡する（CPython と同じ消費位置になる）
        { this.materialize(v0); if (v0.failed) return UNK(); }
        let known = (v0.pos || 0) >= v0.__iter.length;
        while ((v0.pos || 0) < v0.__iter.length) { const x = v0.__iter[v0.pos || 0]; v0.pos = (v0.pos || 0) + 1; const t = truthy(x); if (t === null) continue; known = true; if (name === 'any' && t) return BOOL(true); if (name === 'all' && !t) return BOOL(false); }
        return known ? BOOL(name === 'all') : UNK();
      }
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
// math モジュールの関数：値が決まり、結果が JavaScript と CPython で同じになるものだけ計算する
Interp.prototype.mathCall = function (name, args, line) {
  if (args.some(isUnk)) return UNK('math.' + name + ' の結果');
  const x = args[0]; const num = isNum(x) ? x.v : isBool(x) ? (x.v ? 1 : 0) : null;
  if (['sqrt', 'log', 'log2', 'log10', 'floor', 'ceil', 'fabs'].includes(name) && args.length === 1 && num === null) this.err(line, 'TypeError', 'math.' + name + '() には数値を渡してください', '');
  if (num === null || args.length !== 1) return UNK('math.' + name + ' の結果');
  if (name === 'sqrt') { if (num < 0) this.err(line, 'ValueError', '負の数の平方根は求められません（math domain error）', '負になる可能性があるなら、先に条件で確かめてください'); return NUM(Math.sqrt(num), true); }
  if (name === 'log' || name === 'log2' || name === 'log10') { if (num <= 0) this.err(line, 'ValueError', '0 以下の数の対数は求められません（math domain error）', ''); return UNK('math.' + name + ' の結果'); }
  if (name === 'fabs') return NUM(Math.abs(num), true);
  if (name === 'floor' || name === 'ceil') { if (!Number.isFinite(num)) this.err(line, Number.isNaN(num) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数にできません', ''); const r = name === 'floor' ? Math.floor(num) : Math.ceil(num); return SAFE(r) ? NUM(r === 0 ? 0 : r, false) : BIG(); }
  return UNK('math.' + name + ' の結果');
};
Interp.prototype.cmpVals = function (a, b, line) {
  if (isUnk(a) || isUnk(b)) return 0;
  const c = this.compare('<', a, b, line);
  if (isBool(c)) return c.v ? -1 : (eqVal(a, b) === true ? 0 : 1);
  return 0;
};

Interp.prototype.callMethod = function (obj, name, args, kwargs, env, line) {
  if (isUnk(obj) && obj.mod === 'math') return this.mathCall(name, args, line);
  if (isUnk(obj)) return UNK();
  if (isNone(obj)) this.err(line, 'AttributeError', 'None にはメソッド「' + name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');
  const arityErr = (need) => this.err(line, 'TypeError', 'メソッド「' + name + '」の引数の数が合いません（' + need + '）', 'リファレンスで使い方を確認してください');
  if (typeof obj === 'string') {
    const S = (f, min, max) => { if (args.length < min || args.length > max) arityErr(min === max ? min + ' 個必要' : min + '〜' + max + ' 個'); return f(); };
    switch (name) {
      case 'upper': return S(() => obj.toUpperCase(), 0, 0);
      case 'lower': return S(() => obj.toLowerCase(), 0, 0);
      case 'title': return S(() => pyTitle(obj), 0, 0);
      case 'capitalize': return S(() => { const a = Array.from(obj); return a.length ? pyTitlecase(a[0]) + a.slice(1).join('').toLowerCase() : ''; }, 0, 0);
      case 'strip': case 'lstrip': case 'rstrip': return S(() => {
        const c = args[0]; if (c !== undefined && isUnk(c)) return UNK();
        if (c !== undefined && !isNone(c) && typeof c !== 'string') this.err(line, 'TypeError', name + '() の引数は文字列か None にしてください', '');
        const set = c === undefined || isNone(c) ? null : new Set(Array.from(c));
        const drop = ch => set ? set.has(ch) : isPyWs(ch);
        const a = Array.from(obj); let i = 0, j = a.length;
        if (name !== 'rstrip') while (i < j && drop(a[i])) i++;
        if (name !== 'lstrip') while (j > i && drop(a[j - 1])) j--;
        return a.slice(i, j).join('');
      }, 0, 1);
      case 'split': case 'rsplit': {
        const sepA = args.length > 0 ? args[0] : kwargs && kwargs.sep ? this.eval(kwargs.sep, env) : NONE;
        const maxA = args.length > 1 ? args[1] : kwargs && kwargs.maxsplit ? this.eval(kwargs.maxsplit, env) : NUM(-1, false);
        if (args.length > 2) arityErr('0〜2 個');
        if (isUnk(sepA) || isUnk(maxA)) return UNK();
        if (!isNone(sepA) && typeof sepA !== 'string') this.err(line, 'TypeError', name + '() の区切りは文字列か None にしてください', '');
        const mx = this.intIndex(maxA, line, 'maxsplit ');
        if (sepA === '') this.err(line, 'ValueError', '区切りに空文字列は使えません', '');
        return LIST(pySplit(obj, isNone(sepA) ? null : sepA, mx < 0 ? -1 : mx, name === 'rsplit'));
      }
      case 'join': return S(() => { const seq = this.iterable(args[0], line, true); if (seq === null || seq.some(isUnk)) return UNK(); if (!seq.every(x => typeof x === 'string')) this.err(line, 'TypeError', 'join() は文字列の集まりに使います', '数値の集まりは str() で変えてから使ってください'); return seq.join(obj); }, 1, 1);
      case 'replace': return S(() => {
        if (args.some(isUnk)) return UNK();
        if (typeof args[0] !== 'string' || typeof args[1] !== 'string') this.err(line, 'TypeError', 'replace() には文字列を2つ渡してください', '');
        const oldS = args[0], newS = args[1];
        let cnt = args[2] !== undefined ? this.intIndex(args[2], line, 'replace() の回数') : -1;
        if (cnt < 0) cnt = Infinity;
        if (oldS === '') { // 空文字列の置換は、文字の間と両端へ挿入する
          const a = Array.from(obj); let out = '', used = 0, pos = 0;
          while (pos <= a.length && used < cnt) { out += newS; used++; if (pos < a.length) { out += a[pos]; } pos++; }
          return out + a.slice(pos).join('');
        }
        let out = '', i = 0, used = 0; // 置き換えた部分は再び探さない（1回だけ走査する）
        while (used < cnt) { const at = obj.indexOf(oldS, i); if (at < 0) break; out += obj.slice(i, at) + newS; i = at + oldS.length; used++; }
        return out + obj.slice(i);
      }, 2, 3);
      case 'find': case 'index': case 'rfind': case 'rindex': case 'count': case 'startswith': case 'endswith': return S(() => {
        if (args.some(isUnk)) return UNK();
        const nd = args[0], tupleOk = name === 'startswith' || name === 'endswith';
        const needles = tupleOk && isTuple(nd) ? nd.__tuple : [nd];
        for (const x of needles) if (typeof x !== 'string') this.err(line, 'TypeError', name + '() に渡す文字列の引数が ' + typeName(x) + ' になっています（文字列にしてください）', '');
        const a = Array.from(obj), L = a.length;
        const bound = (v, def) => { if (v === undefined || isNone(v)) return def; let k = this.intIndex(v, line, '開始・終了位置'); if (k < 0) { k += L; if (k < 0) k = 0; } return k; };
        const st = bound(args[1], 0), en = Math.min(bound(args[2], L), L);
        if (name === 'startswith' || name === 'endswith') { if (st > L) return BOOL(false); const sub = a.slice(st, Math.max(st, en)).join(''); return BOOL(needles.some(x => (st <= en || x === '') && (name === 'startswith' ? sub.startsWith(x) : sub.endsWith(x)) && (st <= en || Array.from(x).length === 0))); }
        if (st > L || st > en) { if (name === 'count') return NUM(nd === '' && st <= L && st <= en ? 1 : 0, false); if (name === 'index' || name === 'rindex') this.err(line, 'ValueError', '文字列「' + nd + '」は見つかりません', 'find() を使うと、無いときに -1 が返ります'); return NUM(-1, false); }
        const sub = a.slice(st, en).join('');
        if (name === 'count') return NUM(nd === '' ? Array.from(sub).length + 1 : sub.split(nd).length - 1, false);
        const at = name[0] === 'r' ? sub.lastIndexOf(nd) : sub.indexOf(nd);
        if (at < 0) { if (name === 'index' || name === 'rindex') this.err(line, 'ValueError', '文字列「' + nd + '」は見つかりません', 'find() を使うと、無いときに -1 が返ります'); return NUM(-1, false); }
        return NUM(st + Array.from(sub.slice(0, at)).length, false);
      }, 1, 3);
      case 'isdigit': return S(() => BOOL(/^[\p{Nd}\p{No}]+$/u.test(obj)), 0, 0);
      case 'isdecimal': return S(() => BOOL(/^\p{Nd}+$/u.test(obj)), 0, 0);
      case 'isnumeric': return S(() => BOOL(/^\p{N}+$/u.test(obj)), 0, 0);
      case 'isalpha': return S(() => BOOL(/^[\p{L}\p{Alphabetic}]+$/u.test(obj)), 0, 0);
      case 'isalnum': return S(() => BOOL(/^[\p{L}\p{Alphabetic}\p{N}]+$/u.test(obj)), 0, 0);
      case 'isspace': return S(() => BOOL(obj.length > 0 && Array.from(obj).every(isPyWs)), 0, 0);
      case 'isascii': return S(() => BOOL(/^[\x00-\x7F]*$/.test(obj)), 0, 0);
      case 'isidentifier': return S(() => BOOL(/^[\p{L}\p{Nl}_][\p{L}\p{Mn}\p{Mc}\p{Nd}\p{Pc}\p{Nl}\u200c\u200d]*$/u.test(obj)), 0, 0);
      case 'islower': return S(() => BOOL(/[\p{Ll}\p{Lu}\p{Lt}]/u.test(obj) && !/[\p{Lu}\p{Lt}]/u.test(obj)), 0, 0);
      case 'isupper': return S(() => BOOL(/[\p{Ll}\p{Lu}\p{Lt}]/u.test(obj) && !/[\p{Ll}]/u.test(obj)), 0, 0);
      case 'format': this.diag(line, 'note', '対応外', '文字列の format() はこの説明では解釈できません', 'f文字列を使うと説明できます'); return UNK();
    }
  }
  if (isList(obj)) {
    switch (name) {
      case 'append': if (args.length !== 1) arityErr('1 個必要'); obj.__list.push(args[0]); this.step(line, 'リストの末尾に ' + reprVal(args[0]) + ' を追加します（要素は ' + obj.__list.length + ' 個になりました）'); return NONE;
      case 'extend': { const seq = this.iterable(args[0], line, true); if (seq === null) { poison(obj, '書き換えられたかもしれないリスト'); return NONE; } if (obj.__list.length + seq.length > 200000) { poison(obj, 'とても長いリスト'); return NONE; } for (const x of seq) obj.__list.push(x); this.step(line, 'リストに ' + seq.length + ' 個の要素を追加します（要素は ' + obj.__list.length + ' 個になりました）'); return NONE; }
      case 'insert': { if (args.length !== 2) arityErr('番号と値の2個必要'); if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれないリスト'); return NONE; } if (!isNum(args[0]) && !isBool(args[0])) arityErr('番号と値の2個必要'); let i = Math.trunc(args[0].v); if (i < 0) i = Math.max(0, obj.__list.length + i); if (i > obj.__list.length) i = obj.__list.length; obj.__list.splice(i, 0, args[1]); this.step(line, 'リストの ' + i + ' 番目に ' + reprVal(args[1]) + ' を入れます'); return NONE; }
      case 'pop': { if (args.length > 1) arityErr('0〜1 個'); if (args.length && isUnk(args[0])) { if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); obj.__list.pop(); for (let k = 0; k < obj.__list.length; k++) obj.__list[k] = UNK('取り出し後の要素'); return UNK('取り出した要素'); } const pi = args.length ? this.intIndex(args[0], line, 'pop() の番号') : null; if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); let i = pi !== null ? pi : obj.__list.length - 1; if (i < 0) i += obj.__list.length; if (i < 0 || i >= obj.__list.length) this.err(line, 'IndexError', 'pop() の番号が範囲外です', ''); const v = obj.__list.splice(i, 1)[0]; this.step(line, 'リストから ' + reprVal(v) + ' を取り出して消します'); return v; }
      case 'remove': { if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれないリスト'); return NONE; } const at = obj.__list.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); obj.__list.splice(at, 1); this.step(line, 'リストから ' + reprVal(args[0]) + ' を消します'); return NONE; }
      case 'index': { if (!args.length || args.length > 3) arityErr('1〜3 個'); if (args.some(isUnk) || obj.__list.some(isUnk)) return UNK(); const L = obj.__list.length; const bd = (v, d) => { if (v === undefined) return d; let k = this.intIndex(v, line, '開始・終了位置'); if (k < 0) { k += L; if (k < 0) k = 0; } return Math.min(k, L); }; const st = bd(args[1], 0), en = bd(args[2], L); let at = -1; for (let k = st; k < en; k++) if (eqVal(obj.__list[k], args[0]) === true) { at = k; break; } if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); return NUM(at, false); }
      case 'count': if (isUnk(args[0])) return UNK(); return NUM(obj.__list.filter(x => eqVal(x, args[0]) === true).length, false);
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
      case 'get': { if (isUnk(args[0])) return UNK(); this.needHash(args[0], line); const v = dictGet(obj, args[0]); if (v !== undefined) return v; if ([...obj.__dict.values()].some(e => eqVal(e.k, args[0]) === true)) return obj.__dict.get(dictKeyId(args[0])).v; return args.length > 1 ? args[1] : NONE; }
      case 'keys': return VIEW(obj, 'keys');
      case 'values': return VIEW(obj, 'values');
      case 'items': return VIEW(obj, 'items');
      case 'update': {
        if (args.length > 1) arityErr('0〜1 個');
        if (args.length) {
          const a0 = args[0]; if (isUnk(a0)) { this.diag(line, 'note', '注意', '更新に使う値が実行時に決まるため、辞書の中身は分からなくなります', ''); poison(obj, '更新されたかもしれない辞書'); return NONE; }
          if (isDict(a0)) { for (const e of a0.__dict.values()) dictSet(obj, e.k, e.v); }
          else { const seq = this.iterable(a0, line, true); if (seq === null) this.err(line, 'TypeError', typeName(a0) + ' では辞書を更新できません', ''); for (const p of seq) { const kv = isList(p) ? p.__list : isTuple(p) ? p.__tuple : typeof p === 'string' ? Array.from(p) : null; if (!kv || kv.length !== 2) this.err(line, 'ValueError', 'update() には (キー, 値) の組の並びを渡してください', ''); this.needHash(kv[0], line); dictSet(obj, kv[0], kv[1]); } }
        }
        for (const k of Object.keys(kwargs || {})) dictSet(obj, k, this.eval(kwargs[k], env));
        this.step(line, '辞書をまとめて更新します → ' + reprVal(obj)); return NONE;
      }
      case 'pop': { if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれない辞書'); return UNK('取り出した値'); } const id = dictKeyId(args[0]); if (id === null || !obj.__dict.has(id)) { if (args.length > 1) return args[1]; this.err(line, 'KeyError', 'キー ' + reprVal(args[0]) + ' は辞書にありません', ''); } const v = obj.__dict.get(id).v; obj.__dict.delete(id); this.step(line, '辞書からキー ' + reprVal(args[0]) + ' を消します'); return v; }
      case 'setdefault': { if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれない辞書'); return UNK('辞書の値'); } this.needHash(args[0], line); const cur = dictGet(obj, args[0]); if (cur !== undefined) return cur; dictSet(obj, args[0], args.length > 1 ? args[1] : NONE); return args.length > 1 ? args[1] : NONE; }
      case 'popitem': { if (!obj.__dict.size) this.err(line, 'KeyError', 'popitem(): 辞書が空です', ''); const entries = [...obj.__dict.entries()]; const last = entries[entries.length - 1]; obj.__dict.delete(last[0]); this.step(line, '辞書から最後の組を取り出します'); return TUPLE([last[1].k, last[1].v]); }
      case 'copy': { const d = DICT(); for (const [id, e] of obj.__dict) d.__dict.set(id, e); return d; }
      case 'clear': obj.__dict.clear(); this.step(line, '辞書を空にします'); return NONE;
    }
  }
  if (isSet(obj)) {
    switch (name) {
      case 'add': this.needHash(args[0], line); obj.__set.push(args[0]); if (!obj.__set.slice(0, -1).some(x => eqVal(x, args[0]) === true)) this.step(line, '集合に ' + reprVal(args[0]) + ' を追加します'); else obj.__set.pop(); return NONE;
      case 'remove': { if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } const at = obj.__set.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'KeyError', reprVal(args[0]) + ' は集合にありません', ''); obj.__set.splice(at, 1); return NONE; }
      case 'discard': { if (isUnk(args[0])) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } const at = obj.__set.findIndex(x => eqVal(x, args[0]) === true); if (at >= 0) obj.__set.splice(at, 1); return NONE; }
      case 'update': { const seq = this.iterable(args[0], line, true); if (seq === null) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } for (const x of seq) { this.needHash(x, line); if (!obj.__set.some(y => eqVal(x, y) === true)) obj.__set.push(x); } this.step(line, '集合に要素を追加します → ' + reprVal(obj)); return NONE; }
      case 'clear': obj.__set.length = 0; this.step(line, '集合を空にします'); return NONE;
      case 'pop': { if (!obj.__set.length) this.err(line, 'KeyError', '空の集合から pop() はできません', ''); poison(obj, '要素が取り出された集合'); return UNK('取り出した要素'); }
      case 'intersection_update': { const seq = this.iterable(args[0], line, true); if (seq === null) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } const kept = obj.__set.filter(x => seq.some(y => eqVal(x, y) === true)); obj.__set.length = 0; for (const x of kept) obj.__set.push(x); return NONE; }
      case 'difference_update': { const seq = this.iterable(args[0], line, true); if (seq === null) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } const kept = obj.__set.filter(x => !seq.some(y => eqVal(x, y) === true)); obj.__set.length = 0; for (const x of kept) obj.__set.push(x); return NONE; }
      case 'symmetric_difference_update': { const seq = this.iterable(args[0], line, true); if (seq === null) { poison(obj, '書き換えられたかもしれない集合'); return NONE; } const kept = obj.__set.filter(x => !seq.some(y => eqVal(x, y) === true)); const add = seq.filter(x => !obj.__set.some(y => eqVal(x, y) === true)); obj.__set.length = 0; for (const x of kept) obj.__set.push(x); for (const x of add) { this.needHash(x, line); if (!obj.__set.some(y => eqVal(x, y) === true)) obj.__set.push(x); } return NONE; }
      case 'union': { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); const out = obj.__set.slice(); for (const x of seq) if (!out.some(y => eqVal(x, y) === true)) out.push(x); return SET(out); }
      case 'intersection': { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); return SET(obj.__set.filter(x => seq.some(y => eqVal(x, y) === true))); }
      case 'difference': { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); return SET(obj.__set.filter(x => !seq.some(y => eqVal(x, y) === true))); }
      case 'symmetric_difference': { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK(); const kept = obj.__set.filter(x => !seq.some(y => eqVal(x, y) === true)); for (const x of seq) if (!obj.__set.some(y => eqVal(x, y) === true) && !kept.some(y => eqVal(x, y) === true)) kept.push(x); return SET(kept); }
      case 'copy': return SET(obj.__set.slice());
    }
  }
  if (obj && obj.__range && name === 'count') { if (isUnk(args[0])) return UNK(); return NUM(obj.__range.filter(x => eqVal(x, args[0]) === true).length, false); }
  if (obj && obj.__range && name === 'index') { if (isUnk(args[0])) return UNK(); const at = obj.__range.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' は range の中にありません', ''); return NUM(at, false); }
  if (isTuple(obj) && name === 'count') { if (isUnk(args[0])) return UNK(); return NUM(obj.__tuple.filter(x => eqVal(x, args[0]) === true).length, false); }
  if (isTuple(obj) && name === 'index') { if (isUnk(args[0])) return UNK(); const at = obj.__tuple.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はタプルにありません', ''); return NUM(at, false); }
  // モジュール属性など
  if (isUnk(obj) && obj.mod === 'math') return this.mathCall(name, args, line);
  if (obj && obj.__class) { if (obj.cenv.vars.has(name)) return obj.cenv.vars.get(name); return UNK('クラス属性「' + name + '」の値'); }
  if (obj && typeof obj === 'object' && obj.__unk) return UNK();
  { const tn = typeName(obj); if (TYPE_ATTRS[tn] && !TYPE_ATTRS[tn].has(name)) this.err(line, 'AttributeError', tn + ' には「' + name + '」という属性（メソッド）はありません', '綴りを確認するか、リファレンスで使えるメソッドを確認してください'); }
  this.diag(line, 'note', '対応外', typeName(obj) + ' の「' + name + '」はこの説明では解釈できません', 'リファレンスで使い方を確認し、実際の動きは実行して確かめてください');
  return UNK(typeName(obj) + '.' + name + ' の結果');
};

Interp.prototype.evalComp = function (n, env) {
  if (n.k === 'listcomp' && n.gen) { // ジェネレータ式は作るだけでは中身を評価しない（CPython と同じ遅延評価）
    const it = ITER([], 'generator');
    it.lazy = { n, env };
    return it;
  }
  const r = this.compResults(n, env);
  if (r.unk) return UNK('実行時に決まる内包表記の結果');
  if (n.k === 'listcomp') return LIST(r.items);
  if (n.k === 'setcomp') return SET(r.items);
  const d = DICT();
  for (const [k, v] of r.items) dictSet(d, k, v);
  return d;
};
// 遅延評価のジェネレータを、初めて消費される時点で実体化する
Interp.prototype.materialize = function (it) {
  if (!it || !it.lazy || it.done) return;
  it.done = true;
  const r = this.compResults(it.lazy.n, it.lazy.env);
  if (r.unk) { it.failed = true; it.__iter = []; }
  else it.__iter = r.items;
};
Interp.prototype.compResults = function (n, env) {
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
    if (n.k === 'listcomp' || n.k === 'genexpr') results.push(this.eval(n.elt, child)); // genexpr も要素式を集める（分岐が無いと空扱いになり any/all が反転する）
    else if (n.k === 'setcomp') { const v = this.eval(n.elt, child); this.needHash(v, n.line); if (!results.some(x => eqVal(x, v) === true)) results.push(v); }
    else { const k = this.eval(n.keyE, child); const v = this.eval(n.valE, child); if (isUnk(k)) { unk = true; break; } this.needHash(k, n.line); results.push([k, v]); }
    if (results.length > 10000) { unk = true; break; }
  }
  return { unk, items: results };
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
  else if (type === 'f' || type === 'F' || type === '%') { const p = prec === null ? 6 : prec; const scaled = type === '%' ? ax * 100 : ax; body = (Number.isFinite(scaled) ? decFixed(scaled, p).replace(/^-/, '') : (type === 'F' ? 'INF' : 'inf')) + (type === '%' ? '%' : ''); }
  else if (type === 'e' || type === 'E') { const p = prec === null ? 6 : prec; const de = decExp(ax, p); body = de.body + 'e' + (de.exp < 0 ? '-' : '+') + String(Math.abs(de.exp)).padStart(2, '0'); if (type === 'E') body = body.toUpperCase(); }
  else if ('bxXo'.includes(type)) { if (v.f || prec !== null) return null; const base = { b: 2, o: 8, x: 16, X: 16 }[type]; body = ax.toString(base); if (type === 'X') body = body.toUpperCase(); if (alt) body = '0' + (type === 'X' ? 'X' : type) + body; }
  else return null;
  if (group) { const at = body.search(/[.e%]/); const ip = at < 0 ? body : body.slice(0, at); body = groupDigits(ip, group) + (at < 0 ? '' : body.slice(at)); }
  const signStr = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
  const a = align || '>';
  if (a === '=') return signStr + padTo(body, fill, '>', Math.max(0, width - signStr.length));
  return padTo(signStr + body, fill, a, width);
}

/* ============ 入口 ============ */
// 各文の開始行→終了行の対応（複合文は本体の最後の行まで）。説明文から該当コード範囲へ跳ぶための構造情報。
function computeLineEnds(stmts) {
  const map = {};
  const endOf = (node) => {
    let e = (node && typeof node.line === 'number') ? node.line : 0;
    if (node && typeof node === 'object') for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object') e = Math.max(e, endOf(x)); } else if (v && typeof v === 'object') e = Math.max(e, endOf(v)); }
    return e;
  };
  const reg = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) reg(x); return; }
    if (typeof node.line === 'number') { const e = endOf(node); if (!(node.line in map) || map[node.line] < e) map[node.line] = e; }
    for (const k of Object.keys(node)) { if (k === 'line') continue; const v = node[k]; if (v && typeof v === 'object') reg(v); }
  };
  try { reg(stmts); } catch (e) { return {}; } // 深すぎる入れ子等では範囲なし（開始行のみ）に倒す
  return map;
}
// コード中で使われている関数・メソッドの呼び出しと、自作関数の定義行を集める（サイドパネル表示用）。
function collectUsed(stmts) {
  const calls = []; const seen = new Set(); const defLines = {};
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const x of node) walk(x); return; }
    if (node.k === 'call' && node.fn) {
      if (node.fn.k === 'name') { const key = 'f:' + node.fn.name; if (!seen.has(key)) { seen.add(key); calls.push({ name: node.fn.name, kind: 'func' }); } }
      else if (node.fn.k === 'attr') { const key = 'm:' + node.fn.name; if (!seen.has(key)) { seen.add(key); calls.push({ name: node.fn.name, kind: 'method' }); } }
    }
    if (node.k === 'def' && node.name && !(node.name in defLines)) defLines[node.name] = node.line || 0;
    for (const k of Object.keys(node)) { const v = node[k]; if (v && typeof v === 'object') walk(v); }
  };
  try { walk(stmts); } catch (e) { return { usedCalls: [], defLines: {} }; }
  return { usedCalls: calls, defLines };
}
function simulatePython(code) {
  const { lines, diags } = splitLines(String(code || ''));
  const allDiags = diags.slice();
  if (!lines.length) return { diags: allDiags, steps: [], output: [], outputLines: [], vars: [], lineEnds: {}, usedCalls: [], defLines: {}, empty: true };
  let stmts;
  try { stmts = parseProgram(lines); }
  catch (e) {
    if (e instanceof SimDiag) { allDiags.push({ line: e.line, level: 'error', kind: e.kind, msg: e.message, fix: e.fix }); return { diags: allDiags, steps: [], output: [], outputLines: [], vars: [], lineEnds: {}, usedCalls: [], defLines: {}, parseFailed: true }; }
    if (e instanceof RangeError) { allDiags.push({ line: 1, level: 'error', kind: '対応外', msg: 'コードの入れ子が深すぎて、この説明では読み取れませんでした', fix: '' }); return { diags: allDiags, steps: [], output: [], outputLines: [], vars: [], lineEnds: {}, usedCalls: [], defLines: {}, parseFailed: true }; }
    throw e;
  }
  const interp = new Interp();
  const r = interp.run(stmts);
  const used = collectUsed(stmts);
  return { diags: allDiags.concat(r.diags), steps: r.steps, output: r.output, outputLines: r.outputLines || [], vars: r.vars, lineEnds: computeLineEnds(stmts), usedCalls: used.usedCalls, defLines: used.defLines };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { simulatePython };
if (typeof window !== 'undefined') window.PySim = { simulatePython };
