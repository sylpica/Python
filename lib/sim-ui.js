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

    function linkify(escapedText) {
      if (!termRe) return escapedText;
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
      return '<button type="button" class="sim-line" data-line="' + line + '">' + line + '行目</button>';
    }

    function render(r, code) {
      lastResult = r;
      if (!code || !code.trim()) {
        body.innerHTML = '<p class="note">コードを書くと、実行しなくても動きを説明します。</p>';
        return;
      }
      var html = '';
      var errors = r.diags.filter(function (d) { return d.level === 'error'; });
      var notes = r.diags.filter(function (d) { return d.level !== 'error'; });
      if (errors.length) {
        html += '<div class="sim-sec"><h4>⚠ まず直すところ</h4>' + errors.map(function (d) {
          return '<div class="diag-item error">' + lineBtn(d.line) + ' <strong>' + esc(d.kind) + '</strong>：' + esc(d.msg) + (d.fix ? '<div class="sim-fix">直し方：' + esc(d.fix) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }
      if (notes.length) {
        html += '<div class="sim-sec"><h4>メモ</h4>' + notes.map(function (d) {
          return '<div class="diag-item">' + lineBtn(d.line) + ' ' + esc(d.msg) + '</div>';
        }).join('') + '</div>';
      }
      if (r.parseFailed) {
        html += '<p class="note">文法のエラーを直すと、手順の説明が出ます。</p>';
      } else if (r.steps.length) {
        html += '<div class="sim-sec"><h4>手順（何が起きるか）</h4><ol class="sim-steps">' + r.steps.map(function (s) {
          var pad = Math.min(s.depth || 0, 3) * 14;
          return '<li style="padding-left:' + pad + 'px">' + lineBtn(s.line) + ' ' + linkify(esc(s.text)) + '</li>';
        }).join('') + '</ol></div>';
      }
      if (r.output && r.output.length) {
        html += '<div class="sim-sec"><h4>表示される内容（print の予測）</h4><pre class="sim-out">' + esc(r.output.join('\n')) + '</pre></div>';
      }
      if (r.vars && r.vars.length) {
        html += '<div class="sim-sec"><h4>最終状態（変数）</h4><div class="vars-view">' + r.vars.map(function (v) {
          return '<div>' + esc(v.name) + ' = ' + esc(v.value) + ' <span class="status">（' + esc(v.type) + '）</span></div>';
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
    body.addEventListener('click', function (ev) {
      var lineEl = ev.target.closest ? ev.target.closest('.sim-line') : null;
      if (lineEl) { try { hooks.gotoLine(parseInt(lineEl.getAttribute('data-line'), 10)); } catch (e) { /* ジャンプできなくても致命的ではない */ } return; }
      var termEl = ev.target.closest ? ev.target.closest('.sim-term') : null;
      if (termEl) { try { hooks.goTerm(termEl.getAttribute('data-term')); } catch (e) { /* 同上 */ } }
    });

    setMode(mode, false);
    if (mode === 'auto') run(true);
    // 自動モード：コードの変化を監視して説明し直す（ポーリング。エンジンは数msで終わる）
    setInterval(function () { if (mode === 'auto') run(false); }, 900);
  });
})();
