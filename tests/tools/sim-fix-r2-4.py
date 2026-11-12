P='/home/user/Python/lib/sim.js'
s=open(P).read()
def R(old,new,cnt=1):
    global s
    n=s.count(old)
    assert n>=1,(n,old[:90])
    s=s.replace(old,new,1)
# for: dict/set changed size during iteration
R("        let broke = false;\n        const live = isList(it) ? it.__list : null;",
  "        let broke = false;\n        const live = isList(it) ? it.__list : null;\n        const watched = isDict(it) ? it : isView(it) ? it.__view : null, watchedSet = isSet(it) ? it : null;\n        const size0 = watched ? watched.__dict.size : watchedSet ? watchedSet.__set.length : 0;\n        const checkSize = () => { if (watched && watched.__dict.size !== size0) this.err(s.line, 'RuntimeError', '繰り返しの途中で辞書の大きさ（要素数）が変わりました（dictionary changed size during iteration）', '繰り返す前に list(辞書) でキーの一覧を作り、それを使って繰り返してください'); if (watchedSet && watchedSet.__set.length !== size0) this.err(s.line, 'RuntimeError', '繰り返しの途中で集合の大きさが変わりました（Set changed size during iteration）', '繰り返す前に list(集合) で一覧を作ってください'); };")
R("            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; continue; }\n            if (!showSteps) this.quiet--;\n            throw e;\n          }\n          if (!showSteps) this.quiet--;\n        }",
  "            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; checkSize(); continue; }\n            if (!showSteps) this.quiet--;\n            throw e;\n          }\n          if (!showSteps) this.quiet--;\n          checkSize();\n        }")

# slice assignment
R("    if (t.k === 'attr') { this.diag(line, 'note', '対応外', '属性（.名前）への代入はこの説明では解釈できません', ''); return; }\n    this.diag(line, 'note', '対応外', 'この形の代入はこの説明では解釈できません', '');",
  "    if (t.k === 'slice') {\n"
  "      const obj = this.eval(t.obj, env);\n"
  "      const lo = t.lo ? this.eval(t.lo, env) : null, hi = t.hi ? this.eval(t.hi, env) : null, st = t.step ? this.eval(t.step, env) : null;\n"
  "      if (typeof obj === 'string') this.err(line, 'TypeError', '文字列は中身を書き換えられません（文字列は変更できない決まりです）', '新しい文字列を作って代入し直してください');\n"
  "      if (isTuple(obj)) this.err(line, 'TypeError', 'タプルは中身を書き換えられません', '変えたいときはリストを使ってください');\n"
  "      if (isUnk(obj)) return;\n"
  "      if (!isList(obj)) this.err(line, 'TypeError', typeName(obj) + ' にはスライスで代入できません', '');\n"
  "      const ix = this.sliceIdx(obj.__list.length, lo, hi, st, line);\n"
  "      const seq = this.iterable(v, line, true);\n"
  "      if (ix === null || seq === null) { if (seq === null && !isUnk(v) && !isSet(v)) this.err(line, 'TypeError', 'スライスへの代入には、リストなどの並びを渡してください', ''); this.markUnknownList(obj, t.obj, env, line); return; }\n"
  "      if (ix.step === 1) obj.__list.splice(ix.a, Math.max(0, ix.b - ix.a), ...seq);\n"
  "      else { if (seq.length !== ix.idx.length) this.err(line, 'ValueError', '間隔つきスライスへの代入では、要素の数を揃えてください（' + seq.length + ' 個を ' + ix.idx.length + ' 個の場所に入れようとしています）', ''); ix.idx.forEach((k, q) => { obj.__list[k] = seq[q]; }); }\n"
  "      if (record) this.step(line, '「' + exprSrc(t.obj) + '」の一部（スライス）を置き換えます → ' + reprVal(obj));\n"
  "      return;\n"
  "    }\n"
  "    if (t.k === 'attr') { this.diag(line, 'note', '対応外', '属性（.名前）への代入はこの説明では解釈できません', ''); return; }\n    this.diag(line, 'note', '対応外', 'この形の代入はこの説明では解釈できません', '');")
# del slice
R("          this.diag(s.line, 'note', '対応外', 'この形の del はこの説明では解釈できません', '');\n          if (t.k === 'slice' || t.k === 'attr')",
  "          if (t.k === 'slice') {\n"
  "            const obj = this.eval(t.obj, env);\n"
  "            const lo = t.lo ? this.eval(t.lo, env) : null, hi = t.hi ? this.eval(t.hi, env) : null, st = t.step ? this.eval(t.step, env) : null;\n"
  "            if (isUnk(obj)) continue;\n"
  "            if (!isList(obj)) this.err(s.line, 'TypeError', typeName(obj) + ' の要素は del で消せません', '');\n"
  "            const ix = this.sliceIdx(obj.__list.length, lo, hi, st, s.line);\n"
  "            if (ix === null) { this.markUnknownList(obj, t.obj, env, s.line); continue; }\n"
  "            const kill = new Set(ix.idx); const keep = obj.__list.filter((_, k) => !kill.has(k)); obj.__list.length = 0; obj.__list.push(...keep);\n"
  "            this.step(s.line, '「' + exprSrc(t.obj) + '」の一部（スライス）を消します → ' + reprVal(obj));\n"
  "            continue;\n"
  "          }\n"
  "          this.diag(s.line, 'note', '対応外', 'この形の del はこの説明では解釈できません', '');\n          if (t.k === 'attr')")
R("Interp.prototype.sliceGet = function (obj, lo, hi, st, line) {",
  "// スライスが指す番号の一覧（CPython の slice.indices と同じ規則）。番号が実行時に決まるなら null\n"
  "Interp.prototype.sliceIdx = function (len, lo, hi, st, line) {\n"
  "  for (const b of [lo, hi, st]) if (b !== null && !isNone(b) && !isUnk(b) && !(isBool(b) || (isNum(b) && !b.f))) this.err(line, 'TypeError', 'スライスの番号には整数か None を使ってください', '');\n"
  "  if ([lo, hi, st].some(b => b && isUnk(b))) return null;\n"
  "  const iv = b => b === null || isNone(b) ? null : isBool(b) ? (b.v ? 1 : 0) : b.v;\n"
  "  const step = iv(st) === null ? 1 : iv(st);\n"
  "  if (step === 0) this.err(line, 'ValueError', 'スライスの間隔（3つ目の数）を 0 にはできません', '');\n"
  "  const adj = (v, def, lowB, highB) => { if (v === null) return def; if (v < 0) { v += len; if (v < lowB) v = lowB; } else if (v > highB) v = highB; return v; };\n"
  "  const a = step > 0 ? adj(iv(lo), 0, 0, len) : adj(iv(lo), len - 1, -1, len - 1);\n"
  "  const b = step > 0 ? adj(iv(hi), len, 0, len) : adj(iv(hi), -1, -1, len - 1);\n"
  "  const idx = []; if (step > 0) for (let k = a; k < b; k += step) idx.push(k); else for (let k = a; k > b; k += step) idx.push(k);\n"
  "  return { a, b, step, idx };\n"
  "};\n"
  "Interp.prototype.markUnknownList = function (obj, baseNode, env, line) {\n"
  "  this.diag(line, 'note', '注意', '書き換える範囲が実行時に決まるため、このリストの中身は分からなくなります', '');\n"
  "  if (baseNode && baseNode.k === 'name') env.set(baseNode.name, UNK('書き換えられたリスト'));\n"
  "  else { const n = obj.__list.length; for (let k = 0; k < n; k++) obj.__list[k] = UNK('書き換えられたかもしれない要素'); }\n"
  "};\n"
  "Interp.prototype.sliceGet = function (obj, lo, hi, st, line) {")
open(P,'w').write(s); print('ok')
