P='/home/user/Python/lib/sim.js'
s=open(P).read()
def R(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n==cnt,(n,old[:90])
    s=s.replace(old,new)

R("""      case 'strip': return S(() => obj.trim(), 0, 0);
      case 'lstrip': return S(() => obj.replace(/^\\s+/, ''), 0, 0);
      case 'rstrip': return S(() => obj.replace(/\\s+$/, ''), 0, 0);
      case 'split': return S(() => {
        if (args.length === 0) return LIST(obj.split(/\\s+/).filter(x => x !== ''));
        const sep = args[0]; if (typeof sep !== 'string') this.err(line, 'TypeError', 'split() の区切りは文字列にしてください', '');
        if (sep === '') this.err(line, 'ValueError', '区切りに空文字列は使えません', '');
        return LIST(obj.split(sep));
      }, 0, 1);""",
"""      case 'strip': case 'lstrip': case 'rstrip': return S(() => {
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
      }""")
R("""      case 'find': return S(() => typeof args[0] === 'string' ? NUM(obj.indexOf(args[0]), false) : UNK(), 1, 1);
      case 'index': return S(() => { const at = typeof args[0] === 'string' ? obj.indexOf(args[0]) : -1; if (at < 0) this.err(line, 'ValueError', '文字列「' + args[0] + '」は見つかりません', 'find() を使うと、無いときに -1 が返ります'); return NUM(at, false); }, 1, 1);
      case 'count': return S(() => typeof args[0] === 'string' && args[0] !== '' ? NUM(obj.split(args[0]).length - 1, false) : NUM(0, false), 1, 1);
      case 'startswith': return S(() => typeof args[0] === 'string' ? BOOL(obj.startsWith(args[0])) : UNK(), 1, 1);
      case 'endswith': return S(() => typeof args[0] === 'string' ? BOOL(obj.endsWith(args[0])) : UNK(), 1, 1);""",
"""      case 'find': case 'index': case 'rfind': case 'rindex': case 'count': case 'startswith': case 'endswith': return S(() => {
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
      }, 1, 3);""")
R("      case 'join': return S(() => { const seq = this.iterable(args[0], line, true); if (seq === null) return UNK();",
  "      case 'join': return S(() => { const seq = this.iterable(args[0], line, true); if (seq === null || seq.some(isUnk)) return UNK();")

# helpers
R("function pyStrRepr(v) {",
"""function isPyWs(ch) { return /^[\\s\\x1c-\\x1f\\x85]$/.test(ch) && ch !== '\\ufeff'; }
// str.split / rsplit（sep=None は空白区切り。maxsplit は -1 で無制限）
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
function pyStrRepr(v) {""")

# list pop / index
R("      case 'pop': { if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); let i = args.length && isNum(args[0]) ? Math.trunc(args[0].v) : obj.__list.length - 1;",
  "      case 'pop': { if (args.length > 1) arityErr('0〜1 個'); if (args.length && isUnk(args[0])) { if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); obj.__list.pop(); for (let k = 0; k < obj.__list.length; k++) obj.__list[k] = UNK('取り出し後の要素'); return UNK('取り出した要素'); } const pi = args.length ? this.intIndex(args[0], line, 'pop() の番号') : null; if (!obj.__list.length) this.err(line, 'IndexError', '空のリストから pop() はできません', ''); let i = pi !== null ? pi : obj.__list.length - 1;")
R("      case 'index': { const at = obj.__list.findIndex(x => eqVal(x, args[0]) === true); if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); return NUM(at, false); }\n      case 'count': return NUM(obj.__list",
  "      case 'index': { if (!args.length || args.length > 3) arityErr('1〜3 個'); if (args.some(isUnk) || obj.__list.some(isUnk)) return UNK(); const L = obj.__list.length; const bd = (v, d) => { if (v === undefined) return d; let k = this.intIndex(v, line, '開始・終了位置'); if (k < 0) { k += L; if (k < 0) k = 0; } return Math.min(k, L); }; const st = bd(args[1], 0), en = bd(args[2], L); let at = -1; for (let k = st; k < en; k++) if (eqVal(obj.__list[k], args[0]) === true) { at = k; break; } if (at < 0) this.err(line, 'ValueError', reprVal(args[0]) + ' はリストにありません', ''); return NUM(at, false); }\n      case 'count': return NUM(obj.__list")

# dict update
R("      case 'update': { if (isDict(args[0])) { for (const e of args[0].__dict.values()) dictSet(obj, e.k, e.v); this.step(line, '辞書をまとめて更新します → ' + reprVal(obj)); } return NONE; }",
  "      case 'update': {\n        if (args.length > 1) arityErr('0〜1 個');\n        if (args.length) {\n          const a0 = args[0]; if (isUnk(a0)) { this.diag(line, 'note', '注意', '更新に使う値が実行時に決まるため、辞書の中身は分からなくなります', ''); obj.__dict.clear(); return NONE; }\n          if (isDict(a0)) { for (const e of a0.__dict.values()) dictSet(obj, e.k, e.v); }\n          else { const seq = this.iterable(a0, line, true); if (seq === null) this.err(line, 'TypeError', typeName(a0) + ' では辞書を更新できません', ''); for (const p of seq) { const kv = isList(p) ? p.__list : isTuple(p) ? p.__tuple : typeof p === 'string' ? Array.from(p) : null; if (!kv || kv.length !== 2) this.err(line, 'ValueError', 'update() には (キー, 値) の組の並びを渡してください', ''); this.needHash(kv[0], line); dictSet(obj, kv[0], kv[1]); } }\n        }\n        for (const k of Object.keys(kwargs || {})) dictSet(obj, k, this.eval(kwargs[k], env));\n        this.step(line, '辞書をまとめて更新します → ' + reprVal(obj)); return NONE;\n      }")

# unknown methods / attributes on known types -> AttributeError; math module
R("  // モジュール属性など\n  if (obj && typeof obj === 'object' && obj.__unk) return UNK();",
  "  // モジュール属性など\n  if (isUnk(obj) && obj.mod === 'math') return this.mathCall(name, args, line);\n  if (obj && typeof obj === 'object' && obj.__unk) return UNK();\n  { const tn = typeName(obj); if (TYPE_ATTRS[tn] && !TYPE_ATTRS[tn].has(name)) this.err(line, 'AttributeError', tn + ' には「' + name + '」という属性（メソッド）はありません', '綴りを確認するか、リファレンスで使えるメソッドを確認してください'); }")
R("  if (isUnk(obj)) return UNK();\n  if (isNone(obj)) this.err(line, 'AttributeError', 'None にはメソッド「' + name + '」がありません",
  "  if (isUnk(obj) && obj.mod === 'math') return this.mathCall(name, args, line);\n  if (isUnk(obj)) return UNK();\n  if (isNone(obj)) this.err(line, 'AttributeError', 'None にはメソッド「' + name + '」がありません")
R("      if (isUnk(obj)) return UNK();\n      if (isNone(obj)) this.err(n.line, 'AttributeError', 'None には属性「' + n.name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');\n      return UNK('属性「' + n.name + '」の値');",
  "      if (isUnk(obj) && obj.mod === 'math' && n.name in MATH_CONST) return NUM(MATH_CONST[n.name], true);\n      if (isUnk(obj)) return UNK();\n      if (isNone(obj)) this.err(n.line, 'AttributeError', 'None には属性「' + n.name + '」がありません（値が None になっていないか確認してください）', 'return を書き忘れた関数の戻り値などで None になっていないか確認してください');\n      { const tn = typeName(obj); if (TYPE_ATTRS[tn] && !TYPE_ATTRS[tn].has(n.name)) this.err(n.line, 'AttributeError', tn + ' には属性「' + n.name + '」はありません', '綴りを確認するか、リファレンスで使える名前を確認してください'); }\n      return UNK('属性「' + n.name + '」の値');")
R("        for (const nm of importNames(s.text || '')) env.set(nm, UNK('モジュール「' + nm + '」の内容'));",
  "        for (const nm of importNames(s.text || '')) env.set(nm, UNK('モジュール「' + nm + '」の内容'));\n"
  "        { const t = (s.text || '').trim(); let m;\n"
  "          if ((m = /^import\\s+math(?:\\s+as\\s+(\\w+))?\\s*$/.exec(t))) { const u = UNK('モジュール「math」の内容'); u.mod = 'math'; env.set(m[1] || 'math', u); }\n"
  "          else if ((m = /^from\\s+math\\s+import\\s+\\(?(.+?)\\)?\\s*$/.exec(t))) for (const part of m[1].split(',')) { const p = part.trim().split(/\\s+as\\s+/); if (p[0] in MATH_CONST) env.set((p[1] || p[0]).trim(), NUM(MATH_CONST[p[0]], true)); } }")
R("Interp.prototype.cmpVals = function (a, b, line) {",
  "// math モジュールの関数：値が決まり、結果が JavaScript と CPython で同じになるものだけ計算する\n"
  "Interp.prototype.mathCall = function (name, args, line) {\n"
  "  if (args.some(isUnk)) return UNK('math.' + name + ' の結果');\n"
  "  const x = args[0]; const num = isNum(x) ? x.v : isBool(x) ? (x.v ? 1 : 0) : null;\n"
  "  if (['sqrt', 'log', 'log2', 'log10', 'floor', 'ceil', 'fabs'].includes(name) && args.length === 1 && num === null) this.err(line, 'TypeError', 'math.' + name + '() には数値を渡してください', '');\n"
  "  if (num === null || args.length !== 1) return UNK('math.' + name + ' の結果');\n"
  "  if (name === 'sqrt') { if (num < 0) this.err(line, 'ValueError', '負の数の平方根は求められません（math domain error）', '負になる可能性があるなら、先に条件で確かめてください'); return NUM(Math.sqrt(num), true); }\n"
  "  if (name === 'log' || name === 'log2' || name === 'log10') { if (num <= 0) this.err(line, 'ValueError', '0 以下の数の対数は求められません（math domain error）', ''); return UNK('math.' + name + ' の結果'); }\n"
  "  if (name === 'fabs') return NUM(Math.abs(num), true);\n"
  "  if (name === 'floor' || name === 'ceil') { if (!Number.isFinite(num)) this.err(line, Number.isNaN(num) ? 'ValueError' : 'OverflowError', '無限大や NaN は整数にできません', ''); const r = name === 'floor' ? Math.floor(num) : Math.ceil(num); return SAFE(r) ? NUM(r === 0 ? 0 : r, false) : BIG(); }\n"
  "  return UNK('math.' + name + ' の結果');\n"
  "};\n"
  "Interp.prototype.cmpVals = function (a, b, line) {")
open(P,'w').write(s); print('ok')
