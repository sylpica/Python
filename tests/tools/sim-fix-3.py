"""lib/sim.js 監査修正 その3: 式の評価と組み込み関数（print の end、round、int(基数)、float('inf')、sum、len、key 引数、
enumerate start、dict、map/filter/repr、大きな整数、比較、属性、ハッシュ不可、関数呼び出し、内包表記）。"""
P = 'lib/sim.js'
s = open(P, encoding='utf-8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, (a[:100], s.count(a))
    s = s.replace(a, b)


PY_BUILTINS = ("abs all any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod "
               "enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter "
               "len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice "
               "sorted staticmethod str sum super tuple type vars zip "
               "Exception BaseException ValueError TypeError KeyError IndexError ZeroDivisionError NameError AttributeError RuntimeError "
               "StopIteration AssertionError ImportError ModuleNotFoundError OSError FileNotFoundError NotImplementedError ArithmeticError "
               "LookupError OverflowError RecursionError UnicodeError EOFError KeyboardInterrupt SystemExit")
sub("const BUILTIN_NAMES = ['print',", "const PY_BUILTINS = new Set('" + PY_BUILTINS + "'.split(' '));\nconst BUILTIN_NAMES = ['print',")
sub("const ARITY = { print: [0, 99], len: [1, 1], range: [1, 3], str: [0, 1], int: [1, 2], float: [1, 1],",
    "const ARITY = { repr: [1, 1], map: [2, 99], filter: [2, 2], hex: [1, 1], bin: [1, 1], oct: [1, 1], format: [1, 2], print: [0, 99], len: [1, 1], range: [1, 3], str: [0, 1], int: [0, 2], float: [0, 1],")
sub("const ARITY = {", "BUILTIN_NAMES.push('repr', 'map', 'filter', 'hex', 'bin', 'oct', 'format');\nconst ARITY = {")
sub("sorted: [1, 1], reversed: [1, 1]", "sorted: [1, 1], reversed: [1, 1]")
sub("min: [1, 99], max: [1, 99]", "min: [0, 99], max: [0, 99]")

# 名前の評価
sub("""      const v = env.get(n.name);
      if (v !== undefined) return v;
      if (BUILTIN_NAMES.includes(n.name)) return BUILTIN(n.name);""",
    """      const v = env.get(n.name);
      if (v === UNBOUND) this.err(n.line, 'UnboundLocalError', '関数の中で代入している変数「' + n.name + '」を、代入する前に使っています（関数の中で代入した名前は、その関数のローカル変数になります）', '外側の変数を使いたいなら global ' + n.name + ' と宣言するか、引数として渡してください');
      if (v !== undefined) return v;
      if (BUILTIN_NAMES.includes(n.name) || PY_BUILTINS.has(n.name)) return BUILTIN(n.name);""")
sub("    case 'num': return NUM(n.v, n.f);\n    case 'str': return n.v;\n    case 'bool': return BOOL(n.v);",
    "    case 'num': return !n.f && !SAFE(n.v) ? BIG() : NUM(n.v, n.f);\n    case 'str': return n.v;\n    case 'bool': return BOOL(n.v);")
# 集合のハッシュ不可
sub("    case 'set': { const arr = []; for (const it of n.items) { const v = this.eval(it.e, env); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } return SET(arr); }",
    "    case 'set': { const arr = []; for (const it of n.items) { const v = this.eval(it.e, env); this.needHash(v, n.line); if (!arr.some(x => eqVal(x, v) === true)) arr.push(v); } return SET(arr); }")
sub("    case 'tuple': return TUPLE(n.items.map(x => this.eval(x.e, env)));",
    "    case 'tuple': { const arr = []; for (const it of n.items) { if (it.e && it.e.k === 'star') { const seq = this.iterable(this.eval(it.e.e, env), n.line, true); if (seq === null) return UNK(); arr.push(...seq); } else arr.push(this.eval(it.e, env)); } return TUPLE(arr); }")
# 属性の値（呼び出し以外）：不明値。None の属性は AttributeError
sub("      return { __method: true, obj, name: n.name, line: n.line };\n    }",
    "      if (isUnk(obj)) return UNK();\n      if (isNone(obj)) this.err(n.line, 'AttributeError', 'None には属性「' + n.name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');\n      return UNK('属性「' + n.name + '」の値');\n    }")

# 大きな整数は捏造しない（結果が安全な整数の範囲を超えたら不明値）
sub("Interp.prototype.binOp = function (op, l, r, line) {",
    """Interp.prototype.binOp = function (op, l, r, line) {
  const res = this.binOp0(op, l, r, line);
  if (isNum(res) && !res.f && !SAFE(res.v)) return BIG();
  if (isNum(res) && res.f && !Number.isFinite(res.v) && isNum(l) && isNum(r) && Number.isFinite(l.v) && Number.isFinite(r.v)) {
    if (op === '**') this.err(line, 'OverflowError', '計算結果が大きすぎて小数（float）で表せません', '');
    return res;
  }
  return res;
};
Interp.prototype.binOp0 = function (op, l, r, line) {""")
sub("    if (isList(l) && isNum(rn)) return LIST(repeatArr(l.__list, rn.v));\n    if (isNum(ln) && isList(r)) return LIST(repeatArr(r.__list, ln.v));\n    if (isTuple(l) && isNum(rn)) return TUPLE(repeatArr(l.__tuple, rn.v));\n    if (isNum(ln) && isTuple(r)) return TUPLE(repeatArr(r.__tuple, ln.v));",
    "    if ((isList(l) || isTuple(l)) && isNum(rn) && !rn.f) { const a = repeatArr(isList(l) ? l.__list : l.__tuple, rn.v); return a === null ? UNK('とても長い並び') : isList(l) ? LIST(a) : TUPLE(a); }\n    if (isNum(ln) && !ln.f && (isList(r) || isTuple(r))) { const a = repeatArr(isList(r) ? r.__list : r.__tuple, ln.v); return a === null ? UNK('とても長い並び') : isList(r) ? LIST(a) : TUPLE(a); }")
sub("function repeatArr(a, n) { const out = []; if (n > 0 && a.length * n <= 100000) for (let i = 0; i < n; i++) out.push(...a); return out; }",
    "function repeatArr(a, n) { if (n <= 0) return []; if (a.length * n > 100000) return null; const out = []; for (let i = 0; i < n; i++) out.push(...a); return out; }")
sub("  if (s.length * n > 100000) { self.diag(line, 'note', '注意', '文字列の繰り返しが大きすぎるため、結果は省略します', ''); return UNK('とても長い文字列'); }",
    "  if (s.length * n > 100000) { self.diag(line, 'note', '注意', '文字列の繰り返しが大きすぎるため、結果は省略します', ''); return UNK('とても長い文字列'); }\n  if (n > 0 && !Number.isInteger(n)) return UNK();")

# 並び同士の大小比較（辞書式）
sub("""  if (isNum(ln) && isNum(rn)) c = ln.v < rn.v ? -1 : ln.v > rn.v ? 1 : 0;
  else if (typeof l === 'string' && typeof r === 'string') c = l < r ? -1 : l > r ? 1 : 0;""",
    """  if (isNum(ln) && isNum(rn)) c = ln.v < rn.v ? -1 : ln.v > rn.v ? 1 : 0;
  else if (typeof l === 'string' && typeof r === 'string') { const a = Array.from(l), b = Array.from(r); c = 0; for (let i = 0; i < Math.min(a.length, b.length) && !c; i++) { const x = a[i].codePointAt(0), y = b[i].codePointAt(0); c = x < y ? -1 : x > y ? 1 : 0; } if (!c) c = a.length < b.length ? -1 : a.length > b.length ? 1 : 0; }
  else if ((isList(l) && isList(r)) || (isTuple(l) && isTuple(r))) {
    const a = isList(l) ? l.__list : l.__tuple, b = isList(r) ? r.__list : r.__tuple; c = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const e = eqVal(a[i], b[i]); if (e === null) return UNK(); if (e) continue;
      const lt = this.compare('<', a[i], b[i], line); if (isUnk(lt)) return UNK(); c = lt.v ? -1 : 1; break;
    }
    if (!c) c = a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }""")

# 文字列はコードポイント単位
sub("    const arr = typeof obj === 'string' ? obj.split('') : isList(obj) ? obj.__list : obj.__tuple;\n    if (!isNum(idx))",
    "    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;\n    if (!isNum(idx))")
sub("    const arr = typeof obj === 'string' ? obj.split('') : isList(obj) ? obj.__list : obj.__tuple;\n    let a = norm(",
    "    const arr = typeof obj === 'string' ? Array.from(obj) : isList(obj) ? obj.__list : obj.__tuple;\n    let a = norm(")

# 関数を値として呼ぶ（デコレータ・key・map/filter 用）
sub("Interp.prototype.evalArgs = function (n, env) {",
    """Interp.prototype.callFn = function (fv, args, env, line) {
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
Interp.prototype.evalArgs = function (n, env) {""")

# ユーザー関数: 未束縛ローカル、定義時のデフォルト引数、ジェネレータ
sub("""  const local = new Env(fn.env || this.globals); // 定義された場所のスコープを親にする（入れ子関数のクロージャ対応）""",
    """  if (def.isGen === undefined) def.isGen = hasNode(def.body, x => x.k === 'unkexpr' && x.what === 'yield');
  if (def.isGen) { this.diag(line, 'note', '対応外', 'ジェネレータ関数「' + def.name + '」（yield を含む関数）の中身はこの説明では順に実行しません。作られる値は「実行時に決まる値」として扱います', ''); return UNK('ジェネレータ「' + def.name + '」が作る値'); }
  const local = new Env(fn.env || this.globals); // 定義された場所のスコープを親にする（入れ子関数のクロージャ対応）
  if (!def.localNames) { const decl = declaredNames(def.body); def.localNames = [...assignedNames(def.body)].filter(x => !decl.has(x) && !params.some(p => p.name === x)); }
  for (const x of def.localNames) local.set(x, UNBOUND);""")
sub("    if (p.def) { local.set(p.name, this.eval(p.def, fn.env || this.globals)); continue; }",
    "    if (p.def) { local.set(p.name, fn.defaults && p.name in fn.defaults ? fn.defaults[p.name] : this.eval(p.def, fn.env || this.globals)); continue; }")

# 組み込み関数
sub("""    case 'print': {
      const sep = kw.sep !== undefined && typeof kw.sep === 'string' ? kw.sep : ' ';
      const text = args.map(a => strVal(a)).join(sep);
      this.output.push(text);
      this.step(line, '画面に「' + text + '」と表示します');
      return NONE;
    }""",
    """    case 'print': {
      const sep = kw.sep !== undefined && typeof kw.sep === 'string' ? kw.sep : ' ';
      const end = kw.end !== undefined && typeof kw.end === 'string' ? kw.end : '\\n';
      const text = args.map(a => strVal(a)).join(sep);
      this.outText += text + end;
      this.step(line, '画面に「' + text + '」と表示します' + (end !== '\\n' ? '（改行の代わりに ' + reprVal(end) + ' を付けます）' : ''));
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
    }""")
sub("""      if (typeof v === 'string') return NUM(v.length, false);""", """      if (typeof v === 'string') return NUM(Array.from(v).length, false);
      if (isIter(v)) this.err(line, 'TypeError', v.kind + ' オブジェクトには長さ（len）がありません', 'list() で並びに変えてから len() を使ってください');""")
sub("""      if (step === 0) this.err(line, 'ValueError', 'range() の3つ目（間隔）を 0 にはできません', '');
      const arr = [];
      if (step > 0) for (let x = start; x < stop && arr.length <= MAX_ITERS; x += step) arr.push(NUM(x, false));
      else for (let x = start; x > stop && arr.length <= MAX_ITERS; x += step) arr.push(NUM(x, false));
      return RANGE(arr);""",
    """      if (step === 0) this.err(line, 'ValueError', 'range() の3つ目（間隔）を 0 にはできません', '');
      const count = step > 0 ? Math.max(0, Math.ceil((stop - start) / step)) : Math.max(0, Math.ceil((start - stop) / -step));
      if (count > MAX_RANGE) return UNK('要素がとても多い range（この説明では展開しません）');
      const arr = [];
      for (let k = 0; k < count; k++) arr.push(NUM(start + k * step, false));
      const r = RANGE(arr); r.rng = [start, stop, step]; return r;""")
sub("""      if (typeof v === 'string') {
        const t = v.trim();
        if (/^[+-]?\\d+$/.test(t)) return NUM(parseInt(t, 10), false);
        this.err(line, 'ValueError', '文字列「' + v + '」は整数に変換できません', 'int() で変えられるのは "123" のような数字だけの文字列です');
      }""",
    """      if (typeof v === 'string') {
        let base = args.length > 1 && isNum(args[1]) ? Math.trunc(args[1].v) : 10;
        let t = v.trim().replace(/_/g, ''); let sign = 1;
        if (/^[+-]/.test(t)) { if (t[0] === '-') sign = -1; t = t.slice(1); }
        const pm = /^0([xob])/i.exec(t);
        if (pm) { const pb = { x: 16, o: 8, b: 2 }[pm[1].toLowerCase()]; if (base === 0 || base === pb) { base = pb; t = t.slice(2); } }
        if (base === 0) base = 10;
        const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
        if (t && [...t.toLowerCase()].every(ch => digits.includes(ch))) { const n = parseInt(t, base) * sign; return SAFE(n) ? NUM(n, false) : BIG(); }
        this.err(line, 'ValueError', '文字列「' + v + '」は整数に変換できません', 'int() で変えられるのは "123" のような数字だけの文字列です');
      }""")
sub("      if (isNum(v)) return NUM(Math.trunc(v.v), false);\n      if (isBool(v)) return NUM(v.v ? 1 : 0, false);",
    "      if (args.length === 0) return NUM(0, false);\n      if (isNum(v)) { if (!Number.isFinite(v.v)) this.err(line, Number.isNaN(v.v) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数に変換できません', ''); const n = Math.trunc(v.v); return SAFE(n) ? NUM(n === 0 ? 0 : n, false) : BIG(); }\n      if (isBool(v)) return NUM(v.v ? 1 : 0, false);")
sub("      if (typeof v === 'string') { const t = v.trim(); if (/^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$/.test(t)) return NUM(parseFloat(t), true);",
    "      if (args.length === 0) return NUM(0, true);\n      if (typeof v === 'string') { const t = v.trim().replace(/_/g, ''); const sp = /^([+-]?)(inf|infinity|nan)$/i.exec(t); if (sp) return NUM(/nan/i.test(sp[2]) ? NaN : (sp[1] === '-' ? -Infinity : Infinity), true); if (/^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$/.test(t)) return NUM(parseFloat(t), true);")
sub("""    case 'list': case 'tuple': case 'set': {
      if (args.length === 0) return name === 'list' ? LIST() : name === 'tuple' ? TUPLE() : SET();
      const seq = this.iterable(args[0], line, true);
      if (seq === null) { if (isUnk(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }
      if (name === 'list') return LIST(seq);
      if (name === 'tuple') return TUPLE(seq);
      const out = []; for (const x of seq) if (!out.some(y => eqVal(x, y) === true)) out.push(x);""",
    """    case 'list': case 'tuple': case 'set': {
      if (args.length === 0) return name === 'list' ? LIST() : name === 'tuple' ? TUPLE() : SET();
      const seq = this.iterable(args[0], line, true);
      if (seq === null) { if (isUnk(args[0])) return UNK(); this.err(line, 'TypeError', typeName(args[0]) + ' は ' + name + '() で変換できません', ''); }
      if (name === 'list') return LIST(seq);
      if (name === 'tuple') return TUPLE(seq);
      const out = []; for (const x of seq) { this.needHash(x, line); if (!out.some(y => eqVal(x, y) === true)) out.push(x); }""")
sub("""    case 'dict': {
      if (args.length === 0) return DICT();
      if (isDict(args[0])) { const d = DICT(); for (const [id, e] of args[0].__dict) d.__dict.set(id, e); return d; }
      this.diag(line, 'note', '対応外', 'この形の dict() は解釈できません', '');
      return UNK();
    }
    case 'sum': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      let acc = args[1] || NUM(0, false);
      for (const x of seq) acc = this.binOp('+', acc, x, line);
      return acc;
    }
    case 'min': case 'max': {
      let items = args.length === 1 ? this.iterable(args[0], line) : args;
      if (items === null) return UNK();
      if (!items.length) this.err(line, 'ValueError', name + '() に空の集まりを渡すことはできません', '要素が1つ以上あるときに使ってください');
      let best = items[0];
      for (const x of items.slice(1)) { const c = this.compare(name === 'min' ? '<' : '>', x, best, line); if (isBool(c) && c.v) best = x; }
      return best;
    }""",
    """    case 'dict': {
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
      if (typeof acc === 'string') this.err(line, 'TypeError', 'sum() で文字列は連結できません', '文字列の連結には \\'\\'.join(...) を使ってください');
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
    }""")
sub("""    case 'round': {
      const v = args[0]; if (isUnk(v)) return UNK();
      if (!isNum(v)) this.err(line, 'TypeError', 'round() は数値に使います', '');
      if (args.length === 2 && isNum(args[1])) { const p = Math.pow(10, Math.trunc(args[1].v)); return NUM(Math.round(v.v * p) / p, true); }
      return NUM(Math.round(v.v), false);
    }
    case 'sorted': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      const rev = kw.reverse !== undefined && truthy(kw.reverse) === true;
      const arr = seq.slice();
      arr.sort((a, b) => { const c = this.cmpVals(a, b, line); return rev ? -c : c; });
      return LIST(arr);
    }
    case 'reversed': { const seq = this.iterable(args[0], line); if (seq === null) return UNK(); return LIST(seq.slice().reverse()); }
    case 'enumerate': {
      const seq = this.iterable(args[0], line); if (seq === null) return UNK();
      const start = args[1] && isNum(args[1]) ? Math.trunc(args[1].v) : 0;
      return LIST(seq.map((x, i) => TUPLE([NUM(start + i, false), x])));
    }
    case 'zip': {
      const seqs = args.map(a => this.iterable(a, line, true));
      if (seqs.some(s => s === null)) return UNK();
      const len = Math.min(...seqs.map(s => s.length));
      const out = [];
      for (let i = 0; i < len; i++) out.push(TUPLE(seqs.map(s => s[i])));
      return LIST(out);
    }
    case 'type': return TYPEVAL(typeName(args[0]));""",
    """    case 'round': {
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
    case 'type': return isUnk(args[0]) ? UNK('型は実行時に決まります') : TYPEVAL(typeName(args[0]));""")
sub("    case 'ord': { const v = args[0]; if (typeof v === 'string' && v.length === 1)", "    case 'ord': { const v = args[0]; if (isUnk(v)) return UNK(); if (typeof v === 'string' && Array.from(v).length === 1)")
sub("""    case 'open': this.diag(line, 'note', '対応外', 'ファイルを開く処理（open）はこの説明では中身を読みません。読み取った内容は「実行時に決まる値」として扱います', ''); return UNK('ファイルの内容');
  }
  return UNK();
};""",
    """    case 'open': this.diag(line, 'note', '対応外', 'ファイルを開く処理（open）はこの説明では中身を読みません。読み取った内容は「実行時に決まる値」として扱います', ''); return UNK('ファイルの内容');
  }
  this.diag(line, 'note', '対応外', '組み込みの「' + name + '」はこの説明では解釈しません。結果は「実行時に決まる値」として扱います', '');
  return UNK(name + ' の結果');
};""")

# メソッド: None の属性、list.sort の key、set.add のハッシュ
sub("Interp.prototype.callMethod = function (obj, name, args, kwargs, env, line) {\n  if (isUnk(obj)) return UNK();",
    "Interp.prototype.callMethod = function (obj, name, args, kwargs, env, line) {\n  if (isUnk(obj)) return UNK();\n  if (isNone(obj)) this.err(line, 'AttributeError', 'None にはメソッド「' + name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');")
sub("      case 'sort': { const rev = kwargs && kwargs.reverse !== undefined ? truthy(this.eval(kwargs.reverse, env)) === true : false; obj.__list.sort((a, b) => this.cmpVals(a, b, line)); if (rev) obj.__list.reverse(); this.step(line, 'リストを並べ替えます → ' + reprVal(obj)); return NONE; }",
    "      case 'sort': {\n        const rev = kwargs && kwargs.reverse !== undefined ? truthy(this.eval(kwargs.reverse, env)) === true : false;\n        const keyFn = kwargs && kwargs.key ? this.eval(kwargs.key, env) : null;\n        const keys = this.keyed(obj.__list, keyFn && !isNone(keyFn) ? keyFn : null, env, line);\n        if (keys === null) { const n = obj.__list.length; obj.__list.length = 0; for (let i = 0; i < n; i++) obj.__list.push(UNK('並べ替え後の要素')); this.step(line, 'リストを並べ替えます（並べ替えの基準が実行時に決まるため、結果は分かりません）'); return NONE; }\n        const idx = obj.__list.map((_, i) => i); const vals = obj.__list.slice();\n        idx.sort((a, b) => { const c = this.cmpVals(keys[a], keys[b], line); return (rev ? -c : c) || a - b; });\n        obj.__list.length = 0; idx.forEach(i => obj.__list.push(vals[i]));\n        this.step(line, 'リストを並べ替えます → ' + reprVal(obj)); return NONE;\n      }")
sub("      case 'add': obj.__set.push(args[0]);", "      case 'add': this.needHash(args[0], line); obj.__set.push(args[0]);")
sub("  if (obj && obj.__range && name === 'count') return NUM(obj.__range.filter(x => eqVal(x, args[0]) === true).length, false);",
    "  if (obj && obj.__range && name === 'count') return NUM(obj.__range.filter(x => eqVal(x, args[0]) === true).length, false);\n  if (isTuple(obj) && name === 'count') return NUM(obj.__tuple.filter(x => eqVal(x, args[0]) === true).length, false);\n  if (isTuple(obj) && name === 'index') { const at = obj.__tuple.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はタプルにありません', ''); return NUM(at, false); }")

# 内包表記: 反復対象や条件が不明なら結果全体を不明値にする（空の結果を捏造しない）
sub("""  function* gen(idx) {
    if (idx >= n.gens.length) { yield true; return; }
    const g = n.gens[idx];
    const seq = self.iterable(self.eval(g.iter, child), n.line, true);
    if (seq === null) return;
    for (const item of seq) {
      self.assignToQuiet(g.target, item, child);
      let ok = true;
      for (const c of g.conds) { const t = truthy(self.eval(c, child)); if (t !== true) { ok = false; break; } }
      if (ok) yield* gen(idx + 1);
    }
  }
  let unk = false;""",
    """  let unk = false;
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
  }""")
sub("""    if (n.k === 'listcomp') results.push(this.eval(n.elt, child));
    else if (n.k === 'setcomp') { const v = this.eval(n.elt, child); if (!results.some(x => eqVal(x, v) === true)) results.push(v); }
    else { const k = this.eval(n.keyE, child); const v = this.eval(n.valE, child); results.push([k, v]); }""",
    """    if (unk) break;
    if (n.k === 'listcomp') results.push(this.eval(n.elt, child));
    else if (n.k === 'setcomp') { const v = this.eval(n.elt, child); this.needHash(v, n.line); if (!results.some(x => eqVal(x, v) === true)) results.push(v); }
    else { const k = this.eval(n.keyE, child); const v = this.eval(n.valE, child); if (isUnk(k)) { unk = true; break; } this.needHash(k, n.line); results.push([k, v]); }""")
sub("  if (unk) return UNK('内包表記の結果');", "  if (unk) return UNK('内包表記の結果（実行時に決まる）');")
sub("""Interp.prototype.assignToQuiet = function (t, v, env) {
  if (t.k === 'name') { env.set(t.name, v); return; }""",
    """Interp.prototype.assignToQuiet = function (t, v, env) {
  if (t.k === 'name') { env.set(t.name, v); return; }
  if (t.k === 'starred') { this.assignToQuiet(t.t, v, env); return; }""")

open(P, 'w', encoding='utf-8').write(s)
print('sim-fix-3 applied')
