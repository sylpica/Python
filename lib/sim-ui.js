/* sim-ui.js — 「コード説明」パネルの UI（lib/sim.js の表示層）
   エディタの内容を PySim.simulatePython で解釈し、診断→手順→出力→最終状態の順で表示する。
   表示方法は2モード（自動／ボタン）を localStorage に記憶する。
   app.js（ESモジュール）からは window.__simHooks 経由でのみ連携する。 */
(function () {
  'use strict';
  var MODE_KEY = 'pystudio:sim-mode';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function ready(cb) {
    var tries = 0;
    (function wait() {
      if (window.PySim && window.__simHooks && document.getElementById('simBody')) { cb(); return; }
      if (++tries > 80) return; // 20秒待って来なければ静かに諦める
      setTimeout(wait, 250);
    })();
  }

  ready(function () {
    var hooks = window.__simHooks;
    var body = document.getElementById('simBody');
    var manualRow = document.getElementById('simManualRow');
    var runBtn = document.getElementById('simRunBtn');
    var autoBtn = document.getElementById('simModeAuto');
    var manualBtn = document.getElementById('simModeManual');
    var pathRow = document.getElementById('simPathRow');
    var pathFirstBtn = document.getElementById('simPathFirst');
    var pathPrevBtn = document.getElementById('simPathPrev');
    var pathNextBtn = document.getElementById('simPathNext');
    var pathLastBtn = document.getElementById('simPathLast');
    var pathJumpInput = document.getElementById('simPathJump');
    var pathGoBtn = document.getElementById('simPathGo');
    var pathPosEl = document.getElementById('simPathPos');
    var pathTitleEl = document.getElementById('simPathTitle');
    var pathSortSel = document.getElementById('simPathSort');
    var pathNoteEl = document.getElementById('simPathNote');
    // 分岐パスの表示状態（列挙結果・並び順・現在位置）
    var pathData = null;
    var pathSort = 'default';
    var pathOrder = [];
    var pathPos = 0;
    var mode = 'auto';
    try { mode = localStorage.getItem(MODE_KEY) === 'manual' ? 'manual' : 'auto'; } catch (e) { /* 保存できない環境では自動 */ }
    var lastCode = null;
    var lastResult = null;

    // 用語リンク用パターン（長い用語を優先。英語は3文字以上）
    var termPats = [];
    try {
      (hooks.terms() || []).forEach(function (g) {
        if (g.ja) termPats.push({ s: g.ja, id: g.id });
        if (g.en && g.en.length >= 3 && g.en.indexOf(' ') < 0) termPats.push({ s: g.en, id: g.id });
      });
      termPats.sort(function (a, b) { return b.s.length - a.s.length; });
    } catch (e) { termPats = []; }
    var termRe = null;
    if (termPats.length) {
      var alt = termPats.map(function (p) { return p.s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
      try { termRe = new RegExp('(' + alt + ')', 'g'); } catch (e) { termRe = null; }
    }
    var termId = {};
    termPats.forEach(function (p) { if (!termId[p.s]) termId[p.s] = p.id; });

    // 「…」や '…' "…" の中はユーザーのコード由来の値（文字列・表示内容・変数名）なので、用語リンクにしない
    var subQuoteRe = /(&#39;(?:(?!&#39;)[\s\S])*&#39;|&quot;(?:(?!&quot;)[\s\S])*&quot;)/;
    function linkOuter(seg) {
      return seg.split(subQuoteRe).map(function (part, i) { return i % 2 ? part : linkPart(part); }).join('');
    }
    function linkify(escapedText) {
      if (!termRe) return escapedText;
      // 値の中に 」 が含まれると（例：print("a」リスト")）引用区間が途中で終わってしまうため、
      // 閉じ 」 の直後が定型の助詞・句読点・括弧・空白でない場合は、次の 」 まで区間を延長する
      var out = '', i = 0, n = escapedText.length;
      while (i < n) {
        var open = escapedText.indexOf('「', i);
        if (open < 0) { out += linkOuter(escapedText.slice(i)); break; }
        out += linkOuter(escapedText.slice(i, open));
        var close = escapedText.indexOf('」', open + 1);
        if (close < 0) { out += escapedText.slice(open); break; }
        while (close + 1 < n) {
          var nxCh = escapedText.charAt(close + 1);
          if (/[、。・：；！？\s（）()「」『』【】〈〉《》とをにへはがのではもや]/.test(nxCh)) break;
          if (escapedText.indexOf('&#39;', close + 1) === close + 1 || escapedText.indexOf('&quot;', close + 1) === close + 1) break;
          var nx = escapedText.indexOf('」', close + 1);
          if (nx < 0) break;
          close = nx;
        }
        out += escapedText.slice(open, close + 1);
        i = close + 1;
      }
      return out;
    }
    function linkPart(escapedText) {
      return escapedText.replace(termRe, function (m) {
        var id = termId[m];
        if (!id) return m;
        return '<button type="button" class="term-link sim-term" data-term="' + esc(id) + '">' + m + '</button>';
      });
    }

    function setMode(m, rerun) {
      mode = m;
      try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 保存できなくても動く */ }
      autoBtn.classList.toggle('active', m === 'auto');
      manualBtn.classList.toggle('active', m === 'manual');
      autoBtn.setAttribute('aria-pressed', m === 'auto' ? 'true' : 'false');
      manualBtn.setAttribute('aria-pressed', m === 'manual' ? 'true' : 'false');
      manualRow.classList.toggle('hidden', m !== 'manual');
      if (m === 'auto' && rerun !== false) run(true);
      if (m === 'manual' && !lastResult) body.innerHTML = '<p class="note">「コードを説明する」ボタンを押すと、今のコードの動きを説明します。</p>';
    }

    function lineBtn(line) {
      return '<span class="sim-line">' + line + '行目</span>';
    }
    // 行に紐づく説明エントリを、クリック／Enter／Space で該当コード行へ跳べるボタン相当にする属性。
    // 対応付けはエンジンの構造情報（文の行・行範囲、出力行・変数の代入行）に基づく。行が無いエントリは対象外。
    function jumpAttrs(line, ends) {
      if (!line || line < 1) return null;
      var end = (ends && ends[line]) || line;
      if (end < line) end = line;
      return { line: line, end: end };
    }
    function computeOrder() {
      if (!pathData) { pathOrder = []; return; }
      pathOrder = pathData.paths.map(function (_, i) { return i; });
      if (pathSort === 'long') pathOrder.sort(function (a, b) { return (pathData.paths[b].stepCount - pathData.paths[a].stepCount) || (a - b); });
      else if (pathSort === 'short') pathOrder.sort(function (a, b) { return (pathData.paths[a].stepCount - pathData.paths[b].stepCount) || (a - b); });
    }
    function currentPath() { return pathData.paths[pathOrder[pathPos]]; }
    function pathTitle(p) {
      if (!p.choices || !p.choices.length) return '分岐なし（決まった通りに進みます）';
      var parts = p.choices.slice(0, 3).map(function (c) { return c.line + '行目：' + c.text; });
      if (p.choices.length > 3) parts.push('ほか' + (p.choices.length - 3) + '件の分岐');
      return parts.join(' ／ ');
    }
    function updatePathRow() {
      if (!pathRow) return;
      var show = !!pathData && (pathData.paths.length > 1 || pathData.hasBranches);
      pathRow.classList.toggle('hidden', !show);
      if (!show) return;
      pathPosEl.textContent = (pathPos + 1) + '/' + pathData.paths.length;
      pathTitleEl.textContent = pathTitle(currentPath());
      pathPrevBtn.disabled = pathPos <= 0;
      pathNextBtn.disabled = pathPos >= pathData.paths.length - 1;
      if (pathFirstBtn) pathFirstBtn.disabled = pathPos <= 0;
      if (pathLastBtn) pathLastBtn.disabled = pathPos >= pathData.paths.length - 1;
      if (pathJumpInput) {
        pathJumpInput.max = pathData.paths.length;
        if (document.activeElement !== pathJumpInput) pathJumpInput.value = pathPos + 1; // 入力中は書き換えない
      }
      pathNoteEl.classList.toggle('hidden', !pathData.truncated);
      if (pathData.truncated) pathNoteEl.textContent = '分岐が多いため、表示は最大' + (pathData.maxPaths || 1000) + '件までです。すべての分岐パスは表示されていません。';
      if (pathSortSel.value !== pathSort) pathSortSel.value = pathSort;
    }
    function renderPath() {
      if (!pathData) return;
      updatePathRow();
      render(currentPath().result, lastCode || '', currentPath());
    }
    function movePath(d) {
      if (!pathData) return;
      var np = pathPos + d;
      if (np < 0 || np >= pathData.paths.length) return;
      pathPos = np;
      renderPath();
      body.scrollTop = 0; // 切り替えたパスは頭から読めるように、パネル内スクロールを先頭へ
    }
    // 位置は「今の並び順（ソート後）の中での位置」。先頭・末尾・番号ジャンプはすべてこの並びに対して動く
    function moveTo(p) {
      if (!pathData) return;
      var np = Math.max(0, Math.min(p, pathData.paths.length - 1));
      pathPos = np;
      renderPath();
      body.scrollTop = 0;
    }
    function jumpFromInput() {
      if (!pathData || !pathJumpInput) return;
      var v = parseInt(pathJumpInput.value, 10);
      if (isNaN(v)) { pathJumpInput.value = pathPos + 1; return; } // 空欄・非数値は移動せず、現在の番号に戻す
      moveTo(v - 1); // 範囲外（0以下・合計超え）は moveTo が先頭・末尾へクランプする
      pathJumpInput.value = pathPos + 1; // クランプされた場合は着地した番号を表示する
    }

    // サイドパネルの「使う関数・変数」は、シミュレータが今表示している内容（パス）に連動させる
    function notifyUsed(r) {
      try { if (window.__usedFnsUpdate) window.__usedFnsUpdate(r); } catch (e) { /* パネル連動に失敗しても説明表示は続ける */ }
    }

    function render(r, code, path) {
      lastResult = r;
      if (!code || !code.trim()) {
        body.innerHTML = '<p class="note">コードを書くと、実行しなくても動きを説明します。</p>';
        notifyUsed(null);
        return;
      }
      var ends = r.lineEnds || {};
      var html = '';
      var errors = r.diags.filter(function (d) { return d.level === 'error'; });
      var notes = r.diags.filter(function (d) { return d.level !== 'error'; });
      if (errors.length) {
        html += '<div class="sim-sec"><h4>⚠ まず直すところ</h4>' + errors.map(function (d) {
          var j = jumpAttrs(d.line, ends);
          var cls = 'diag-item error' + (j ? ' sim-jump' : '');
          var attrs = j ? ' tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動"' : '';
          return '<div class="' + cls + '"' + attrs + '>' + lineBtn(d.line) + ' <strong>' + esc(d.kind) + '</strong>：' + esc(d.msg) + (d.fix ? '<div class="sim-fix">直し方：' + esc(d.fix) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }
      if (notes.length) {
        html += '<div class="sim-sec"><h4>メモ</h4>' + notes.map(function (d) {
          var j = jumpAttrs(d.line, ends);
          var cls = 'diag-item' + (j ? ' sim-jump' : '');
          var attrs = j ? ' tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動"' : '';
          return '<div class="' + cls + '"' + attrs + '>' + lineBtn(d.line) + ' ' + esc(d.msg) + '</div>';
        }).join('') + '</div>';
      }
      if (path && path.choices && path.choices.length) {
        html += '<div class="sim-sec"><h4>このパスの分岐</h4><ol class="sim-path-choices">' + path.choices.map(function (c) {
          var j = jumpAttrs(c.line, ends);
          var attrs = j ? ' tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動"' : '';
          var cls = j ? ' class="sim-jump"' : '';
          return '<li' + cls + attrs + '>' + lineBtn(c.line) + ' ' + esc(c.text) + (c.capped ? ' <span class="status">（これ以上は列挙を打ち切りました）</span>' : '') + '</li>';
        }).join('') + '</ol></div>';
      }
      if (r.parseFailed) {
        html += '<p class="note">文法のエラーを直すと、手順の説明が出ます。</p>';
      } else if (r.steps.length) {
        html += '<div class="sim-sec"><h4>手順（何が起きるか）</h4><ol class="sim-steps">' + r.steps.map(function (s) {
          var pad = Math.min(s.depth || 0, 3) * 14;
          var j = jumpAttrs(s.line, ends);
          var attrs = j ? ' tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動"' : '';
          var cls = j ? ' class="sim-jump"' : '';
          return '<li' + cls + attrs + ' style="padding-left:' + pad + 'px">' + lineBtn(s.line) + ' ' + linkify(esc(s.text)) + '</li>';
        }).join('') + '</ol></div>';
      }
      if (r.output && r.output.length) {
        html += '<div class="sim-sec"><h4>表示される内容（print の予測）</h4><div class="sim-out">' + r.output.map(function (text, i) {
          var ln = (r.outputLines || [])[i] || 0;
          var j = jumpAttrs(ln, ends);
          var shown = text === '' ? ' ' : esc(text);
          if (!j) return '<div class="sim-outline">' + shown + '</div>';
          return '<div class="sim-outline sim-jump" tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動">' + shown + '</div>';
        }).join('') + '</div></div>';
      }
      if (r.vars && r.vars.length) {
        html += '<div class="sim-sec"><h4>最終状態（変数）</h4><div class="vars-view">' + r.vars.map(function (v) {
          var j = jumpAttrs(v.line, ends);
          var inner = esc(v.name) + ' = ' + esc(v.value) + ' <span class="status">（' + esc(v.type) + '）</span>';
          if (!j) return '<div>' + inner + '</div>';
          return '<div class="sim-jump" tabindex="0" role="button" data-line="' + j.line + '" data-end="' + j.end + '" title="クリックでコードの ' + j.line + ' 行目へ移動">' + inner + '</div>';
        }).join('') + '</div></div>';
      }
      if (!errors.length && !r.steps.length && !r.parseFailed) {
        html += '<p class="note">説明できる手順がありませんでした。</p>';
      }
      html += '<p class="note sim-foot">この説明は、コードを実行せずに読み解いた予測です。表示中のファイル1つだけを対象にします。input() やファイルの中身など実行時に決まる値は、その旨を示します。実際の結果は「実行」で確認してください。</p>';
      body.innerHTML = html;
      if (!r.parseFailed) notifyUsed(r); // 文法エラーで打ちかけの間は、パネル側は直前の表示を保つ
    }

    function run(force) {
      var code;
      try { code = hooks.code(); } catch (e) { return; }
      if (!force && code === lastCode) return;
      lastCode = code;
      code = code || '';
      var pr = null;
      try { pr = window.PySim.simulatePythonPaths ? window.PySim.simulatePythonPaths(code) : null; }
      catch (e) { body.innerHTML = '<p class="note">説明の作成に失敗しました。</p>'; return; }
      if (pr && pr.paths && pr.paths.length) {
        pathData = pr;
        pathPos = 0;
        computeOrder();
        renderPath();
        return;
      }
      pathData = null;
      updatePathRow();
      if (pr && pr.fatalResult) { render(pr.fatalResult, code); return; }
      var r;
      try { r = window.PySim.simulatePython(code); }
      catch (e) { body.innerHTML = '<p class="note">説明の作成に失敗しました。</p>'; return; }
      render(r, code);
    }

    autoBtn.addEventListener('click', function () { setMode('auto'); });
    manualBtn.addEventListener('click', function () { setMode('manual'); });
    runBtn.addEventListener('click', function () { run(true); });
    if (pathPrevBtn) pathPrevBtn.addEventListener('click', function () { movePath(-1); });
    if (pathNextBtn) pathNextBtn.addEventListener('click', function () { movePath(1); });
    if (pathFirstBtn) pathFirstBtn.addEventListener('click', function () { moveTo(0); });
    if (pathLastBtn) pathLastBtn.addEventListener('click', function () { if (pathData) moveTo(pathData.paths.length - 1); });
    if (pathGoBtn) pathGoBtn.addEventListener('click', function () { jumpFromInput(); });
    if (pathJumpInput) pathJumpInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); jumpFromInput(); }
    });
    if (pathSortSel) pathSortSel.addEventListener('change', function () {
      pathSort = pathSortSel.value;
      if (!pathData) return;
      var cur = pathOrder[pathPos];
      computeOrder();
      pathPos = pathOrder.indexOf(cur);
      if (pathPos < 0) pathPos = 0;
      renderPath();
    });
    // 左右キーでもパスを切り替える。除外は「左右キーに本来の意味がある要素」だけに限る：
    // テキスト入力欄・選択欄・編集可能な要素・コードエディタ内。それ以外のボタン等にフォーカスがあっても切り替わる。
    document.addEventListener('keydown', function (ev) {
      if (!pathData || !pathRow || pathRow.classList.contains('hidden')) return;
      var studio = document.getElementById('view-studio');
      if (studio && !studio.classList.contains('active')) return; // 別の画面を見ている間は切り替えない
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target;
      if (t) {
        var tag = (t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
        if (t.closest && t.closest('#editor')) return;
      }
      ev.preventDefault();
      movePath(ev.key === 'ArrowLeft' ? -1 : 1);
    });
    function doJump(el) {
      var ln = parseInt(el.getAttribute('data-line'), 10);
      var en = parseInt(el.getAttribute('data-end'), 10) || ln;
      if (!ln) return;
      var prev = body.querySelectorAll('.sim-jump.sim-sel');
      for (var i = 0; i < prev.length; i++) prev[i].classList.remove('sim-sel');
      el.classList.add('sim-sel');
      try { hooks.gotoLine(ln, en); } catch (e) { /* ジャンプできなくても致命的ではない */ }
      // 行ジャンプ先の表示（ハイライト・スクロール）はそのままに、キーボードのフォーカスだけジャンプ元の項目へ戻す。
      // gotoLine がエディタへフォーカスを移すため、戻さないと「項目をクリックした直後に左右キーでパスを切り替える」導線が切れてしまう。
      try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* フォーカスを戻せなくてもジャンプ自体は済んでいる */ } }
    }
    body.addEventListener('click', function (ev) {
      var termEl = ev.target.closest ? ev.target.closest('.sim-term') : null;
      if (termEl) { try { hooks.goTerm(termEl.getAttribute('data-term')); } catch (e) { /* 同上 */ } return; }
      var jumpEl = ev.target.closest ? ev.target.closest('.sim-jump') : null;
      if (jumpEl) doJump(jumpEl);
    });
    body.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var t = ev.target;
      if (!t.classList || !t.classList.contains('sim-jump')) return; // 用語ボタン等の本来の操作は妨げない
      ev.preventDefault();
      doJump(t);
    });

    setMode(mode, false);
    if (mode === 'auto') run(true);
    // 自動モード：コードの変化を監視して説明し直す（ポーリング。エンジンは数msで終わる）
    // ボタンモード：説明したあとにコードが変わったら、表示中の説明が古いことを示す
    setInterval(function () {
      if (mode === 'auto') { run(false); return; }
      var code; try { code = hooks.code(); } catch (e) { return; }
      var stale = !!lastResult && lastCode !== null && code !== lastCode;
      var el = body.querySelector('.sim-stale');
      if (stale && !el) body.insertAdjacentHTML('afterbegin', '<p class="note sim-stale">コードが変更されました。下の説明は変更前のコードのものです。「コードを説明する」を押すと最新の内容で説明します。</p>');
      else if (!stale && el) el.remove();
    }, 900);
  });
})();
