import re
P='/home/user/Python/lib/sim.js'
s=open(P).read()
def R(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:80])
    s=s.replace(old,new)

# typeName for builtins
R("  if (isFunc(v) || v && v.__builtin) return 'function';",
  "  if (v && v.__builtin) return TYPE_BUILTINS.includes(v.__builtin) ? 'type' : 'builtin_function_or_method';\n  if (isFunc(v)) return 'function';")
R("const SAFE = (n) => Number.isSafeInteger(n);",
  "const SAFE = (n) => Number.isSafeInteger(n);\nconst TYPE_BUILTINS = ['int', 'float', 'str', 'bool', 'list', 'tuple', 'dict', 'set', 'range', 'type', 'object', 'frozenset', 'bytes', 'complex'];\n"
  "// 型ごとの属性名（CPython 3.12 の dir() から。存在しない名前は AttributeError）\n"
  "const TYPE_ATTRS = {\n"
  "  str: 'capitalize casefold center count encode endswith expandtabs find format format_map index isalnum isalpha isascii isdecimal isdigit isidentifier islower isnumeric isprintable isspace istitle isupper join ljust lower lstrip maketrans partition removeprefix removesuffix replace rfind rindex rjust rpartition rsplit rstrip split splitlines startswith strip swapcase title translate upper zfill',\n"
  "  list: 'append clear copy count extend index insert pop remove reverse sort',\n"
  "  dict: 'clear copy fromkeys get items keys pop popitem setdefault update values',\n"
  "  tuple: 'count index',\n"
  "  set: 'add clear copy difference difference_update discard intersection intersection_update isdisjoint issubset issuperset pop remove symmetric_difference symmetric_difference_update union update',\n"
  "  int: 'as_integer_ratio bit_count bit_length conjugate denominator from_bytes imag is_integer numerator real to_bytes',\n"
  "  float: 'as_integer_ratio conjugate fromhex hex imag is_integer real',\n"
  "  bool: 'as_integer_ratio bit_count bit_length conjugate denominator from_bytes imag is_integer numerator real to_bytes',\n"
  "  NoneType: ''\n"
  "};\n"
  "for (const k of Object.keys(TYPE_ATTRS)) TYPE_ATTRS[k] = new Set(TYPE_ATTRS[k].split(' ').filter(Boolean));\n"
  "const MATH_CONST = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, nan: NaN };")

# set repr
R("  if (isSet(v)) return v.__set.length ? '{' + v.__set.map(x => reprVal(x, depth + 1)).join(', ') + '}' : 'set()';",
  "  if (isSet(v)) { if (!v.__set.length) return 'set()'; const ord = setOrder(v); if (ord) return '{' + ord.map(x => reprVal(x, depth + 1)).join(', ') + '}'; const inner = v.__set.map(x => reprVal(x, depth + 1)).join(', '); return /[（）]/.test(inner) ? '（集合・表示の並び順は実行時に決まります）' : '（集合 {' + inner + '}・表示の並び順は実行時に決まります）'; }")
R("// Python の str の repr",
  "// 集合の表示順を CPython と同じに決められるときだけ、その順を返す（それ以外は null）。\n"
  "// 0 以上の小さな整数だけで、すべてハッシュ表の大きさ未満なら、CPython の表は昇順に並ぶ。\n"
  "// 文字列などはハッシュがプロセスごとに変わるため、順序は決められない。\n"
  "function setOrder(v) {\n"
  "  const a = v.__set; if (a.length < 2) return a.slice();\n"
  "  const nums = a.map(x => isBool(x) ? (x.v ? 1 : 0) : (isNum(x) && Number.isInteger(x.v) && x.v >= 0 ? x.v : -1));\n"
  "  if (nums.some(x => x < 0)) return null;\n"
  "  let size = 8, fill = 0;\n"
  "  for (let used = 1; used <= a.length; used++) { fill = used; if (fill * 5 >= (size - 1) * 3) { const minused = used > 50000 ? used * 2 : used * 4; size = 8; while (size <= minused) size *= 2; } }\n"
  "  if (nums.some(x => x >= size)) return null;\n"
  "  return a.map((x, i) => [nums[i], x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);\n"
  "}\n"
  "// Python の str の repr")

# dict keys: 1 == True == 1.0 share a key; keep first key object
R("  if (isBool(v)) return 'b:' + v.v;", "  if (isBool(v)) return 'n:' + (v.v ? 1 : 0);")
R("function dictSet(d, k, v) { const id = dictKeyId(k); if (id === null) return false; d.__dict.set(id, { k, v }); return true; }",
  "function dictSet(d, k, v) { const id = dictKeyId(k); if (id === null) return false; const cur = d.__dict.get(id); d.__dict.set(id, { k: cur ? cur.k : k, v }); return true; }")

# genexp parse
R("args.push({ e: { k: 'listcomp', elt: e0, gens, line } }); }", "args.push({ e: { k: 'listcomp', gen: true, elt: e0, gens, line } }); }")
R("tc.expectOp(')', line); return { k: 'listcomp', elt: first, gens, line }; }", "tc.expectOp(')', line); return { k: 'listcomp', gen: true, elt: first, gens, line }; }")
R("  if (n.k === 'listcomp') return LIST(results);", "  if (n.k === 'listcomp') return n.gen ? ITER(results, 'generator') : LIST(results);")
R("    case 'listcomp': return '[… for … in …]';", "    case 'listcomp': return n.gen ? '(… for … in …)' : '[… for … in …]';")

# tuple subscript a[1, 2]
R("      if (!tc.isOp(':') && !tc.isOp(']')) idx = parseExpr(tc, line);\n",
  "      if (!tc.isOp(':') && !tc.isOp(']')) { idx = parseExpr(tc, line); if (tc.isOp(',')) { const items = [{ e: idx }]; while (tc.eatOp(',')) { if (tc.isOp(']')) break; items.push({ e: parseExpr(tc, line) }); } idx = { k: 'tuple', items, line }; } }\n")

# dict literal with ** unpacking
R("    if (tc.isOp('}')) { tc.next(); return { k: 'dict', pairs: [], line }; }\n",
  "    if (tc.isOp('}')) { tc.next(); return { k: 'dict', pairs: [], line }; }\n"
  "    if (tc.isOp('**')) {\n"
  "      const pairs = [];\n"
  "      do { if (tc.isOp('}')) break; if (tc.isOp('**')) { tc.next(); pairs.push({ dstar: parseOr(tc, line) }); } else { const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); } } while (tc.eatOp(','));\n"
  "      tc.expectOp('}', line);\n"
  "      return { k: 'dict', pairs, line };\n"
  "    }\n")
R("      while (tc.eatOp(',')) { if (tc.isOp('}')) break; const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); }",
  "      while (tc.eatOp(',')) { if (tc.isOp('}')) break; if (tc.isOp('**')) { tc.next(); pairs.push({ dstar: parseOr(tc, line) }); continue; } const kk = parseExpr(tc, line); tc.expectOp(':', line); pairs.push({ k: kk, v: parseExpr(tc, line) }); }")
R("    case 'dict': return '{' + n.pairs.map(p => exprSrc(p.k) + ': ' + exprSrc(p.v)).join(', ') + '}';",
  "    case 'dict': return '{' + n.pairs.map(p => p.dstar ? '**' + exprSrc(p.dstar) : exprSrc(p.k) + ': ' + exprSrc(p.v)).join(', ') + '}';")
R("      for (const p of n.pairs) { const k = this.eval(p.k, env);",
  "      for (const p of n.pairs) { if (p.dstar) { const dv = this.eval(p.dstar, env); if (isUnk(dv)) return UNK(); if (!isDict(dv)) this.err(n.line, 'TypeError', '** のあとには辞書を書いてください', ''); for (const e of dv.__dict.values()) dictSet(d, e.k, e.v); continue; } const k = this.eval(p.k, env);")
# set literal with *x
R("    case 'set': { const arr = []; for (const it of n.items) { const v = this.eval(it.e, env); this.needHash(v, n.line); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } return SET(arr); }",
  "    case 'set': { const arr = []; for (const it of n.items) { let vs; if (it.e && it.e.k === 'star') { const prev = this.orderFree; this.orderFree = true; vs = this.iterable(this.eval(it.e.e, env), n.line); this.orderFree = prev; if (vs === null) return UNK(); } else vs = [this.eval(it.e, env)]; for (const v of vs) { this.needHash(v, n.line); if (isUnk(v)) return UNK(); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } } return SET(arr); }")

open(P,'w').write(s)
print('ok')
