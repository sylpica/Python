"""lib/sim.js 監査修正 その2: 構文（for/while-else、return a,b、/、星付き代入、del/assert/raise/global/nonlocal、デコレータ、
class/try/with/match で飛ばした部分）と実行（print の end、UnboundLocalError、デフォルト引数の共有、上限・不明時の扱い）。"""
P = 'lib/sim.js'
s = open(P, encoding='utf-8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, (a[:100], s.count(a))
    s = s.replace(a, b)


# ---------- 飛ばしたブロックの中で代入される名前・print の有無（捏造を防ぐため） ----------
sub("function skipBlock(lines, i, indent) {",
    """function namesInLines(lines, from, to) {
  const names = new Set(); let prints = false;
  for (let k = from; k < to; k++) {
    const t = lines[k].text;
    if (/\\bprint\\s*\\(/.test(t)) prints = true;
    let m;
    if ((m = /^(?:class|def)\\s+(\\w+)/.exec(t))) names.add(m[1]);
    if ((m = /^for\\s+([\\w\\s,*()]+?)\\s+in\\b/.exec(t))) m[1].split(/[\\s,()*]+/).filter(Boolean).forEach(n => names.add(n));
    if ((m = /\\bas\\s+(\\w+)\\s*:?\\s*$/.exec(t))) names.add(m[1]);
    if ((m = /^import\\s+([\\w.]+)/.exec(t))) names.add(m[1].split('.')[0]);
    if ((m = /^from\\s+\\S+\\s+import\\s+(.+)$/.exec(t))) m[1].split(',').forEach(x => { const n = x.trim().split(/\\s+as\\s+/).pop().trim(); if (/^\\w+$/.test(n)) names.add(n); });
    if ((m = /^([\\w\\s,*()]+?)\\s*(?::[^=]+)?(?:[+\\-*/%]|\\/\\/|\\*\\*)?=(?!=)/.exec(t))) m[1].split(/[\\s,()*]+/).filter(n => /^[A-Za-z_]\\w*$/.test(n)).forEach(n => names.add(n));
  }
  return { names: [...names], prints };
}
function skipBlock(lines, i, indent) {""")
sub("""    if (t0.v === 'class') return { stmts: [{ k: 'unsupported', what: 'クラス定義（class）', line: L.line }], next: skipBlock(lines, i, indent) };
    if (t0.v === 'try') {
      let nx = skipBlock(lines, i, indent);
      while (nx < lines.length && lines[nx].indent === indent && /^(except|finally|else)\\b/.test(lines[nx].text)) nx = skipBlock(lines, nx, indent);
      return { stmts: [{ k: 'unsupported', what: '例外処理（try）', line: L.line }], next: nx };
    }
    if (t0.v === 'async') return { stmts: [{ k: 'unsupported', what: '非同期（async）', line: L.line }], next: skipBlock(lines, i, indent) };
    if (t0.v === 'with') return { stmts: [{ k: 'unsupported', what: 'with 文', line: L.line }], next: skipBlock(lines, i, indent) };""",
    """    const skipped = (what, nx) => { const r = namesInLines(lines, i, nx); return { stmts: [{ k: 'unsupported', what, line: L.line, names: r.names, prints: r.prints }], next: nx }; };
    if (t0.v === 'class') return skipped('クラス定義（class）', skipBlock(lines, i, indent));
    if (t0.v === 'try') {
      let nx = skipBlock(lines, i, indent);
      while (nx < lines.length && lines[nx].indent === indent && /^(except|finally|else)\\b/.test(lines[nx].text)) nx = skipBlock(lines, nx, indent);
      return skipped('例外処理（try）', nx);
    }
    if (t0.v === 'async') return skipped('非同期（async）', skipBlock(lines, i, indent));
    if (t0.v === 'with') return skipped('with 文', skipBlock(lines, i, indent));
    if (t0.v === 'match' && /^match\\s+.+:\\s*$/.test(L.text)) return skipped('match 文', skipBlock(lines, i, indent));""")

# デコレータ: 式を読む（定義に適用する）
sub("  if (t0.t === 'OP' && t0.v === '@') return { stmts: [{ k: 'decorator', line: L.line }], next: i + 1 };",
    "  if (t0.t === 'OP' && t0.v === '@') { tc.next(); return { stmts: [{ k: 'decorator', expr: parseExpr(tc, L.line), line: L.line }], next: i + 1 }; }")

# def の位置専用 / を受け付ける
sub("  while (!tc.isOp(')')) {\n    let star = 0;",
    "  while (!tc.isOp(')')) {\n    if (tc.isOp('/')) { tc.next(); if (!tc.eatOp(',')) break; continue; } // 位置専用の区切り\n    let star = 0;")

# for / while の else
sub("""  const s = parseSuite(lines, i, indent, tc, L.line);
  return { stmts: [{ k: 'for', target, iter, body: s.body, line: L.line }], next: s.next };""",
    """  const s = parseSuite(lines, i, indent, tc, L.line);
  const el = parseLoopElse(lines, s.next, indent);
  return { stmts: [{ k: 'for', target, iter, body: s.body, elseBody: el.body, line: L.line }], next: el.next };""")
sub("""  const s = parseSuite(lines, i, indent, tc, L.line);
  return { stmts: [{ k: 'while', cond, body: s.body, line: L.line }], next: s.next };
}""", """  const s = parseSuite(lines, i, indent, tc, L.line);
  const el = parseLoopElse(lines, s.next, indent);
  return { stmts: [{ k: 'while', cond, body: s.body, elseBody: el.body, line: L.line }], next: el.next };
}
function parseLoopElse(lines, at, indent) {
  if (at < lines.length && lines[at].indent === indent) {
    const tc2 = new TC(lexText(lines[at].text, lines[at].line));
    if (tc2.isName('else')) { tc2.next(); tc2.expectOp(':', lines[at].line); const s2 = parseSuite(lines, at, indent, tc2, lines[at].line); return { body: s2.body, next: s2.next }; }
  }
  return { body: null, next: at };
}""")

# 星付き代入ターゲット
sub("""function parseTarget(tc, line) {
  // 代入・for のターゲット：名前 / タプル / 添字
  const first = parsePostfix(tc, line, true);
  if (tc.isOp(',')) {
    const items = [first];
    while (tc.eatOp(',')) { if (tc.isOp(':') || tc.isName('in')) break; items.push(parsePostfix(tc, line, true)); }""",
    """function parseTargetItem(tc, line) {
  if (tc.isOp('*')) { tc.next(); return { k: 'starred', t: parsePostfix(tc, line, true), line }; }
  return parsePostfix(tc, line, true);
}
function parseTarget(tc, line) {
  // 代入・for のターゲット：名前 / タプル / 添字 / 星付き
  const first = parseTargetItem(tc, line);
  if (tc.isOp(',') || first.k === 'starred') {
    const items = [first];
    while (tc.eatOp(',')) { if (tc.isOp(':') || tc.isName('in') || tc.isOp('=') || tc.atEnd()) break; items.push(parseTargetItem(tc, line)); }""")

# 単純文: return a, b / global / nonlocal / raise / del / assert
sub("    if (t.v === 'return') { tc.next(); const e = tc.atEnd() || tc.isOp(';') ? null : parseExpr(tc, line); return { k: 'return', expr: e, line }; }",
    "    if (t.v === 'return') { tc.next(); const e = tc.atEnd() || tc.isOp(';') ? null : parseExprList(tc, line); return { k: 'return', expr: e, line }; }")
sub("""    if (t.v === 'global' || t.v === 'nonlocal') { tc.next(); while (!tc.atEnd() && !tc.isOp(';')) tc.next(); return { k: 'unsupported', what: t.v + ' 宣言', line }; }
    if (t.v === 'raise') { tc.next(); while (!tc.atEnd() && !tc.isOp(';')) tc.next(); return { k: 'unsupported', what: 'raise 文', line }; }
    if (t.v === 'del') { tc.next(); parseExpr(tc, line); return { k: 'unsupported', what: 'del 文', line }; }""",
    """    if (t.v === 'global' || t.v === 'nonlocal') { tc.next(); const names = []; while (!tc.atEnd() && !tc.isOp(';')) { const n = tc.next(); if (n.t === 'NAME') names.push(n.v); } return { k: 'global', kind: t.v, names, line }; }
    if (t.v === 'raise') { tc.next(); let e = null; if (!tc.atEnd() && !tc.isOp(';')) e = parseExpr(tc, line); while (!tc.atEnd() && !tc.isOp(';')) tc.next(); return { k: 'raise', e, line }; }
    if (t.v === 'del') { tc.next(); const targets = []; do { targets.push(parsePostfix(tc, line)); } while (tc.eatOp(',')); return { k: 'del', targets, line }; }""")
sub("    if (t.v === 'assert') { tc.next(); parseExpr(tc, line); return { k: 'unsupported', what: 'assert 文', line }; }",
    "    if (t.v === 'assert') { tc.next(); const e = parseExpr(tc, line); const msg = tc.eatOp(',') ? parseExpr(tc, line) : null; return { k: 'assert', e, msg, line }; }")

# ---------- 実行時の上限・環境（global/nonlocal・未束縛） ----------
sub("const MAX_ITERS = 10000;", "const MAX_ITERS = 10000;   // while 1つあたりの繰り返し上限（超えたら説明を打ち切る）\nconst MAX_RANGE = 100000;  // range を展開する上限（超えたら不明値）\nconst MAX_WORK = 300000;   // 全体の繰り返しの上限（超えたら説明を打ち切る）")
sub("""class Env {
  constructor(parent) { this.vars = new Map(); this.parent = parent || null; }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  set(name, v) { this.vars.set(name, v); }""",
    """class Env {
  constructor(parent) { this.vars = new Map(); this.parent = parent || null; this.decl = null; }
  get(name) {
    if (this.decl && this.decl.has(name)) return this.decl.get(name).get(name);
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  set(name, v) { if (this.decl && this.decl.has(name)) { this.decl.get(name).set(name, v); return; } this.vars.set(name, v); }
  del(name) { if (this.decl && this.decl.has(name)) return this.decl.get(name).del(name); const had = this.vars.has(name) && this.vars.get(name) !== UNBOUND; if (had) this.vars.delete(name); return had; }""")

# 静的な走査の補助
sub("class Interp {\n  constructor() {",
    """function walkNodes(node, fn) {
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
    else if (n.k === 'import') { const m = /^\\s*(?:from\\s+[\\w.]+\\s+)?import\\s+([\\w.]+)/.exec(n.text || ''); if (m) set.add(m[1].split('.')[0]); }
  });
  return set;
}
function declaredNames(stmts) { const set = new Set(); walkNodes(stmts, n => { if (n.k === 'global') n.names.forEach(x => set.add(x)); }); return set; }
function hasNode(stmts, pred) { let f = false; walkNodes(stmts, n => { if (!f && pred(n)) f = true; }); return f; }
const isPrintCall = (n) => n.k === 'call' && n.fn && n.fn.k === 'name' && n.fn.name === 'print';
class Interp {
  constructor() {""")
sub("    this.iters = 0; this.depth = 0; this.quiet = 0;\n    this.stopped = false;",
    "    this.iters = 0; this.depth = 0; this.quiet = 0; this.work = 0;\n    this.stopped = false; this.outText = ''; this.pendingDec = []; this.truncated = false;")
sub("  err(line, kind, msg, fix) { throw new SimDiag(line, kind, msg, fix); }",
    """  err(line, kind, msg, fix) { throw new SimDiag(line, kind, msg, fix); }
  emitLine(text) { if (this.outText && !this.outText.endsWith('\\n')) this.outText += '\\n'; this.outText += text + '\\n'; }
  tick() { if (++this.work > MAX_WORK) throw new Flow('budget'); }
  // 実行されたか分からない部分: 中で代入される名前は「実行時に決まる値」にし、print があればその旨の出力行を出す
  unknownBlock(blocks, env, why) {
    const names = new Set(); let prints = false;
    for (const b of blocks) { if (!b) continue; assignedNames(b).forEach(n => names.add(n)); if (hasNode(b, isPrintCall)) prints = true; }
    for (const n of names) env.set(n, UNK(why));
    if (prints) this.emitLine('（' + why + 'によって決まる出力）');
  }""")

# run: 出力をテキストで組み立てる、上限で打ち切った場合
sub("""  run(stmts) {
    try { this.execBlock(stmts, this.globals, {}); }
    catch (e) {
      if (e instanceof SimDiag) this.diag(e.line, 'error', e.kind, e.message, e.fix);
      else if (e instanceof Flow) { /* トップレベルの return 等は文法側で扱う */ }
      else throw e;
    }
    const vars = [];
    for (const [name, v] of this.globals.vars) {
      if (isFunc(v)) vars.push({ name, value: '関数 ' + name + '（定義）', type: 'function' });
      else vars.push({ name, value: reprVal(v), type: typeName(v) });
    }
    return { diags: this.diags, steps: this.steps, output: this.output, vars };""",
    """  run(stmts) {
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
    this.output = t === '' ? [] : (t.endsWith('\\n') ? t.slice(0, -1) : t).split('\\n');
    return { diags: this.diags, steps: this.steps, output: this.output, vars };""")

# 文の実行
sub("""      case 'unsupported':
        this.diag(s.line, 'note', '対応外', '「' + s.what + '」はこの説明では解釈できません。その部分の値は「実行時に決まる値」として扱います', '実際の動きは実行して確認してください');
        return;
      case 'decorator':
        this.diag(s.line, 'note', '対応外', 'デコレータ（@ で始まる行）はこの説明では解釈しません。次の定義は、飾り付けなしとして扱います', '');
        return;""",
    """      case 'unsupported':
        this.diag(s.line, 'note', '対応外', '「' + s.what + '」はこの説明では解釈できません。その部分の値は「実行時に決まる値」として扱います', '実際の動きは実行して確認してください');
        for (const n of s.names || []) env.set(n, UNK('「' + s.what + '」で決まる値'));
        if (s.prints) this.emitLine('（「' + s.what + '」の中の出力は実行時に決まります）');
        this.pendingDec = [];
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
      }""")

sub("""          if (t === null) {
            this.step(s.line, '条件「' + exprSrc(arm.cond) + '」は実行時に決まる値を含むため、どちらに進むかは実行してみないと分かりません（この説明では分岐の中身は省略します）');
            return;
          }""",
    """          if (t === null) {
            this.step(s.line, '条件「' + exprSrc(arm.cond) + '」は実行時に決まる値を含むため、どちらに進むかは実行してみないと分かりません（この説明では分岐の中身は省略し、中で代入される変数は「実行時に決まる値」とします）');
            const from = s.arms.indexOf(arm);
            this.unknownBlock([...s.arms.slice(from).map(a => a.body), s.elseBody], env, '実行時の条件');
            return;
          }""")

# for: 上限は全体の作業量で見る、else、反復対象が不明のとき
sub("""        if (seq === null) { this.step(s.line, '繰り返しの対象が実行時に決まるため、回数は分かりません'); return; }""",
    """        if (seq === null) { this.step(s.line, '繰り返しの対象が実行時に決まるため、回数は分かりません（中で代入される変数は「実行時に決まる値」とします）'); this.unknownBlock([[{ k: 'for', target: s.target, body: [] }], s.body, s.elseBody], env, '実行時の繰り返し'); return; }""")
sub("          if (++this.iters > MAX_ITERS) this.err(s.line, '無限ループの疑い', '繰り返しが ' + MAX_ITERS + ' 回を超えました。無限ループになっている可能性があります', '繰り返しを止める条件（カウンタの更新や break）があるか確認してください');\n          const showSteps = idx === 0 || idx === seq.length - 1;",
    "          this.tick();\n          const showSteps = idx === 0 || idx === seq.length - 1;")
sub("""        if (!broke && seq.length > 2) this.step(s.line, '（2回目から ' + (seq.length - 1) + ' 回目までの手順は省略しました。変数の最終状態は下の「最終状態」に出ます）');
        return;""",
    """        if (!broke && seq.length > 2) this.step(s.line, '（2回目から ' + (seq.length - 1) + ' 回目までの手順は省略しました。変数の最終状態は下の「最終状態」に出ます）');
        if (!broke && s.elseBody) { this.step(s.line, 'break せずに繰り返しが終わったので、else の中身を実行します'); this.execBlock(s.elseBody, env, ctx); }
        return;""")

# while: 状態が変わらない無限ループの検出、上限、else、条件が不明のとき
sub("""      case 'while': {
        let count = 0;
        while (true) {
          const c = this.eval(s.cond, env);
          const t = truthy(c);
          if (t === null) {
            if (count === 0) this.step(s.line, 'while の条件「' + exprSrc(s.cond) + '」は実行時に決まる値を含むため、繰り返しの回数は分かりません');
            break;
          }
          if (!t) { if (count > 0) this.step(s.line, '条件「' + exprSrc(s.cond) + '」がうそ（False）になったので、繰り返しを終わります（合計 ' + count + ' 回）'); break; }
          if (++this.iters > MAX_ITERS) this.err(s.line, '無限ループの疑い', 'while の繰り返しが ' + MAX_ITERS + ' 回を超えました。条件がずっと本当（True）のままになっていませんか', 'ループの中で条件に関わる変数を変えているか、break があるか確認してください');
          count++;""",
    """      case 'while': {
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
            const snap = condNames.map(n => { const v = env.get(n); return v === undefined ? '∅' : reprVal(v); }).join('\\u0001');
            if (prevSnap !== null && snap === prevSnap) this.err(s.line, '無限ループの疑い', 'while の条件「' + exprSrc(s.cond) + '」に関わる値が繰り返しの中で変わらないため、条件がずっと本当（True）のままで終わりません', 'ループの中で条件に関わる変数を変えているか、break があるか確認してください');
            prevSnap = snap;
          }
          if (count >= MAX_ITERS) throw new Flow('budget');
          this.tick();
          count++;""")
sub("""            if (e instanceof Flow && e.kind === 'break') { this.step(s.line, 'break で繰り返しを抜けます'); if (!showSteps) this.quiet--; break; }
            if (e instanceof Flow && e.kind === 'continue') { if (!showSteps) this.quiet--; continue; }
            if (!showSteps) this.quiet--;
            throw e;
          }
          if (!showSteps) this.quiet--;
        }
        return;
      }
      case 'def': {
        env.set(s.name, FUNC(s, env === this.globals ? this.globals : env));
        this.step(s.line, '関数「' + s.name + '」を定義します（この時点では中身は実行しません。呼び出されたときに動きます）');
        return;
      }""",
    """            if (e instanceof Flow && e.kind === 'break') { this.step(s.line, 'break で繰り返しを抜けます'); if (!showSteps) this.quiet--; broke = true; break; }
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
      }""")

# 代入: 星付き、未束縛
sub("      const before = env.get(t.name);\n      env.set(t.name, v);",
    "      let before = env.get(t.name); if (before === UNBOUND) before = undefined;\n      env.set(t.name, v);")
sub("""      if (items.length !== t.items.length) this.err(line, 'ValueError', '分ける数と代入先の数が合いません（値 ' + items.length + ' 個 → 代入先 ' + t.items.length + ' 個）', '左側の変数の数と、右側の要素の数を揃えてください');
      t.items.forEach((it, i2) => this.assignTo(it, items[i2], env, line, record));
      return;""",
    """      const si = t.items.findIndex(x => x.k === 'starred');
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
      return;""")
sub("""    if (t.k === 'name') {
      const v = env.get(t.name);
      if (v === undefined) this.err(line, 'NameError',""",
    """    if (t.k === 'name') {
      const v = env.get(t.name);
      if (v === UNBOUND) this.err(line, 'UnboundLocalError', '関数の中で代入している変数「' + t.name + '」を、代入する前に使っています（関数の中で代入した名前は、その関数のローカル変数になります）', '外側の変数を書き換えたいなら global ' + t.name + ' と宣言するか、引数と戻り値で受け渡してください');
      if (v === undefined) this.err(line, 'NameError',""")
sub("""  iterable(v, line, silent) {
    if (isUnk(v)) return null;""",
    """  iterable(v, line, silent) {
    if (isUnk(v)) return null;
    if (isIter(v)) { if (v.used) return []; v.used = true; return v.__iter.slice(); }""")
sub("    if (typeof v === 'string') return v.split('').map(ch => ch);", "    if (typeof v === 'string') return Array.from(v);")

open(P, 'w', encoding='utf-8').write(s)
print('sim-fix-2 applied')
