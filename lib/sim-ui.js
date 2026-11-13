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
    function render(r, code) {
      lastResult = r;
      if (!code || !code.trim()) {
        body.innerHTML = '<p class="note">コードを書くと、実行しなくても動きを説明します。</p>';
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
    }

    function run(force) {
      var code;
      try { code = hooks.code(); } catch (e) { return; }
      if (!force && code === lastCode) return;
      lastCode = code;
      var r;
      try { r = window.PySim.simulatePython(code || ''); }
      catch (e) { body.innerHTML = '<p class="note">説明の作成に失敗しました。</p>'; return; }
      render(r, code || '');
    }

    autoBtn.addEventListener('click', function () { setMode('auto'); });
    manualBtn.addEventListener('click', function () { setMode('manual'); });
    runBtn.addEventListener('click', function () { run(true); });
    function doJump(el) {
      var ln = parseInt(el.getAttribute('data-line'), 10);
      var en = parseInt(el.getAttribute('data-end'), 10) || ln;
      if (!ln) return;
      var prev = body.querySelectorAll('.sim-jump.sim-sel');
      for (var i = 0; i < prev.length; i++) prev[i].classList.remove('sim-sel');
      el.classList.add('sim-sel');
      try { hooks.gotoLine(ln, en); } catch (e) { /* ジャンプできなくても致命的ではない */ }
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
