P='/home/user/Python/lib/sim.js'
s=open(P).read()
def R(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)

# --- index helpers
R("Interp.prototype.subGet = function (obj, idx, line) {\n  if (isUnk(obj) || isUnk(idx)) return UNK();\n  if (typeof obj === 'string' || isList(obj) || isTuple(obj)) {\n    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;\n    if (!isNum(idx)) this.err(line, 'TypeError', '番号（インデックス）には整数を使ってください', '');",
  "// 添字として使える整数か確かめる（bool は 0/1 として使える。float などは TypeError）\n"
  "Interp.prototype.intIndex = function (idx, line, what) {\n"
  "  if (isBool(idx)) return idx.v ? 1 : 0;\n"
  "  if (!isNum(idx) || idx.f) this.err(line, 'TypeError', (what || '番号（インデックス）') + 'には整数を使ってください（' + typeName(idx) + ' は使えません）', '');\n"
  "  return idx.v;\n"
  "};\n"
  "Interp.prototype.subGet = function (obj, idx, line) {\n  if (isUnk(obj) || isUnk(idx)) return UNK();\n  if (typeof obj === 'string' || isList(obj) || isTuple(obj)) {\n    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;\n    idx = NUM(this.intIndex(idx, line), false);")
R("  if (obj && obj.__range) {\n    if (!isNum(idx)) this.err(line, 'TypeError', '番号には整数を使ってください', '');",
  "  if (obj && obj.__range) {\n    idx = NUM(this.intIndex(idx, line), false);")
R("  if (isList(obj)) {\n    if (!isNum(idx)) this.err(line, 'TypeError', '番号には整数を使ってください', '');",
  "  if (isUnk(idx) && isList(obj)) { for (let k = 0; k < obj.__list.length; k++) obj.__list[k] = UNK('書き換えられたかもしれない要素'); return; }\n  if (isList(obj)) {\n    idx = NUM(this.intIndex(idx, line), false);")
# slice bounds must be ints/None
R("  const norm = (v, len, def) => { if (v === null || v === undefined) return def; if (!isNum(v)) return def;",
  "  for (const b of [lo, hi, st]) if (b !== null && b !== undefined && !isNone(b) && !isUnk(b) && !(isBool(b) || (isNum(b) && !b.f))) this.err(line, 'TypeError', 'スライスの番号には整数か None を使ってください', '');\n  if ([lo, hi, st].some(b => b && isUnk(b))) return UNK();\n  const norm = (v, len, def) => { if (v === null || v === undefined || isNone(v)) return def; if (isBool(v)) v = NUM(v.v ? 1 : 0, false); if (!isNum(v)) return def;")

# --- builtins
R("    case 'chr': { const v = args[0]; if (isNum(v)) return String.fromCodePoint(Math.trunc(v.v)); return UNK(); }",
  "    case 'chr': { const v = args[0]; if (isUnk(v)) return UNK(); const n = this.intIndex(v, line, 'chr() の引数'); if (!(n >= 0 && n <= 0x10FFFF)) this.err(line, 'ValueError', 'chr() の引数は 0〜1114111（0x10FFFF）の範囲にしてください', ''); return String.fromCodePoint(n); }")
R("    case 'hex': case 'bin': case 'oct': { const v = args[0]; if (isUnk(v)) return UNK(); if (!isNum(v) || v.f)",
  "    case 'hex': case 'bin': case 'oct': { let v = args[0]; if (isUnk(v)) return UNK(); if (isBool(v)) v = NUM(v.v ? 1 : 0, false); if (!isNum(v) || v.f)")
R("    case 'abs': { const v = args[0]; if (isUnk(v)) return UNK(); if (isNum(v))",
  "    case 'abs': { const v = args[0]; if (isUnk(v)) return UNK(); if (isBool(v)) return NUM(v.v ? 1 : 0, false); if (isNum(v))")
R("    case 'bool': { const t = truthy(args[0]);", "    case 'bool': { if (!args.length) return BOOL(false); const t = truthy(args[0]);")
R("bool: [1, 1],", "bool: [0, 1], next: [1, 2], iter: [1, 1],")
R("BUILTIN_NAMES.push('repr', 'map', 'filter', 'hex', 'bin', 'oct', 'format');", "BUILTIN_NAMES.push('repr', 'map', 'filter', 'hex', 'bin', 'oct', 'format', 'next', 'iter');")
R("    case 'min': case 'max': {\n",
  "    case 'min': case 'max': {\n      if (!args.length) this.err(line, 'TypeError', name + '() には少なくとも1つの引数が必要です', '');\n")
R("      if (!v.f) return v;\n      if (!Number.isFinite(v.v))",
  "      if (!v.f) return v;\n      if (Number.isFinite(v.v) && Math.abs(v.v) >= 2 ** 53) return BIG(); // とても大きな小数はすでに整数値（桁数が多く正確には示さない）\n      if (!Number.isFinite(v.v))")
R("    case 'str': return args.length === 0 ? '' : strVal(args[0]);",
  "    case 'str': return args.length === 0 ? '' : isUnk(args[0]) ? UNK(args[0].desc) : isIter(args[0]) ? UNK(args[0].kind + ' オブジェクトの文字列表現') : strVal(args[0]);")
R("    case 'repr': return isUnk(args[0]) ? UNK() : reprVal(args[0]);",
  "    case 'repr': return isUnk(args[0]) || isIter(args[0]) ? UNK() : reprVal(args[0]);\n"
  "    case 'iter': { const v = args[0]; if (isUnk(v)) return UNK(); if (isIter(v)) return v; const kind = isList(v) ? 'list_iterator' : isTuple(v) ? 'tuple_iterator' : typeof v === 'string' ? (/^[\\x00-\\x7f]*$/.test(v) ? 'str_ascii_iterator' : 'str_iterator') : isDict(v) ? 'dict_keyiterator' : isSet(v) ? 'set_iterator' : v && v.__range ? 'range_iterator' : null; const seq = kind ? this.iterable(v, line, true) : null; if (seq === null) { if (kind) return UNK(); this.err(line, 'TypeError', typeName(v) + ' は繰り返しに使えません', ''); } return ITER(seq, kind); }\n"
  "    case 'next': { const v = args[0]; if (isUnk(v)) return UNK(); if (!isIter(v)) this.err(line, 'TypeError', typeName(v) + ' は next() に使えません（イテレータではありません）', 'iter() でイテレータにしてから使ってください'); const pos = v.pos || 0; if (pos < v.__iter.length) { v.pos = pos + 1; this.step(line, v.kind + ' から次の値 ' + reprVal(v.__iter[pos]) + ' を取り出します'); return v.__iter[pos]; } if (args.length > 1) return args[1]; this.err(line, 'StopIteration', 'これ以上取り出せる値がありません', 'next(it, 既定値) のように2つ目を渡すと、終わったときにその値が返ります'); return UNK(); }")
# int with base
R("      if (isNum(v)) { if (!Number.isFinite(v.v))",
  "      if (args.length > 1) { const b = args[1]; if (isUnk(b)) return UNK(); const bn = this.intIndex(b, line, 'int() の基数'); if (!(bn === 0 || (bn >= 2 && bn <= 36))) this.err(line, 'ValueError', 'int() の基数は 2〜36 か 0 にしてください', ''); if (typeof v !== 'string') this.err(line, 'TypeError', '基数を指定するときは、int() に文字列を渡してください', ''); }\n      if (isNum(v)) { if (!Number.isFinite(v.v))")
# list/tuple/set of an unordered set
R("      if (seq === null) { if (isUnk(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }",
  "      if (seq === null) { if (isUnk(args[0]) || isSet(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }")

# --- iterable: iterator position; set order
R("    if (isIter(v)) { if (v.used) return []; v.used = true; return v.__iter.slice(); }",
  "    if (isIter(v)) { const r = v.__iter.slice(v.pos || 0); v.pos = v.__iter.length; return r; }")
R("    if (isSet(v)) return v.__set.slice();\n    if (v && v.__range) return v.__range.slice();\n    if (!silent)",
  "    if (isSet(v)) { const ord = setOrder(v); if (ord) return ord; if (this.orderFree) return v.__set.slice(); return null; } // 並び順が実行時に決まる集合は、順序に関係しない使い方でだけ展開する\n    if (v && v.__range) return v.__range.slice();\n    if (!silent)")
# orderFree wrapper around builtins
R("Interp.prototype.callBuiltin = function (name, args, kwargs, env, line, node) {\n",
  "const ORDER_FREE = new Set(['sorted', 'sum', 'min', 'max', 'any', 'all', 'set', 'len']);\n"
  "Interp.prototype.callBuiltin = function (name, args, kwargs, env, line, node) {\n"
  "  const prev = this.orderFree; this.orderFree = ORDER_FREE.has(name);\n"
  "  try { return this.callBuiltin0(name, args, kwargs, env, line, node); } finally { this.orderFree = prev; }\n"
  "};\n"
  "Interp.prototype.callBuiltin0 = function (name, args, kwargs, env, line, node) {\n")
R("  this.depth++;\n  let ret = NONE;\n  try { this.execBlock(def.body, local, { inFunc: true }); }\n  catch (e) { if (e instanceof Flow && e.kind === 'return') ret = e.value; else { this.depth--; throw e; } }\n  this.depth--;",
  "  this.depth++;\n  let ret = NONE; const prevOF = this.orderFree; this.orderFree = false;\n  try { this.execBlock(def.body, local, { inFunc: true }); }\n  catch (e) { if (e instanceof Flow && e.kind === 'return') ret = e.value; else { this.depth--; this.orderFree = prevOF; throw e; } }\n  this.depth--; this.orderFree = prevOF;")

open(P,'w').write(s); print('ok')
