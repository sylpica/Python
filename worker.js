/* Pyodide Web Worker: Python kernel for Python Studio.
   Pyodide v0.26.4 (CPython 3.12.1).
   - Interrupt = terminate this Worker and create a new one (GitHub Pages cannot send the
     COOP/COEP headers that SharedArrayBuffer-based interrupts need). The UI warns first.
   - Every reply carries the request id; the page ignores replies from a worker it replaced.
   - Python helper code lives in runtime/pystudio.py and never runs in the user namespace. */
const PROTOCOL = 3;
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PROJECT = '/home/pyodide';
const OUTPUT_LIMIT = 400000;   // characters kept per run; the rest is counted and dropped

let pyodide = null, rt = null, initError = null;
try { importScripts(PYODIDE_URL + 'pyodide.js'); } catch (e) { initError = 'Pyodide を読み込めませんでした（' + (e && e.message || e) + '）'; }

const ready = (async () => {
  if (initError) throw new Error(initError);
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  const site = '/lib/python3.12/site-packages/';
  for (const f of ['pystudio.py', 'pystudio_mpl.py']) {
    const res = await fetch('runtime/' + f, { cache: 'no-cache' }).catch(() => fetch('runtime/' + f));
    if (!res.ok) throw new Error('runtime/' + f + ' を取得できません (' + res.status + ')');
    pyodide.FS.writeFile(site + f, await res.text());
  }
  pyodide.runPython("import os; os.environ['MPLBACKEND'] = 'module://pystudio_mpl'");
  rt = pyodide.pyimport('pystudio');
  postMessage({ type: 'ready', protocol: PROTOCOL, python: pyodide.runPython('import sys; sys.version.split()[0]') });
})();
ready.catch(e => postMessage({ type: 'init-error', protocol: PROTOCOL, error: String(e && e.message || e) }));

/* ---------- output capture (ordered stdout/stderr segments, partial lines kept) ---------- */
let segs = [], outChars = 0, dropped = 0, streamId = null, streamBuf = [], lastStream = 0;
function pushOut(stream, text, force) {
  if (!text) return;
  if (force) { segs.push({ s: stream, t: text }); if (streamId != null) streamBuf.push({ s: stream, t: text }); return; }
  if (outChars >= OUTPUT_LIMIT) { dropped += text.length; return; }
  if (outChars + text.length > OUTPUT_LIMIT) { dropped += outChars + text.length - OUTPUT_LIMIT; text = text.slice(0, OUTPUT_LIMIT - outChars); }
  outChars += text.length;
  const last = segs[segs.length - 1];
  if (last && last.s === stream) last.t += text; else segs.push({ s: stream, t: text });
  if (streamId != null) {
    streamBuf.push({ s: stream, t: text });
    const now = performance.now();
    if (now - lastStream > 150) flushStream(now);
  }
}
function flushStream(now) {
  if (streamId == null || !streamBuf.length) return;
  postMessage({ type: 'stream', id: streamId, segs: streamBuf });
  streamBuf = []; lastStream = now || performance.now();
}
function writer(stream) {
  const dec = new TextDecoder('utf-8');
  return { write: buf => { pushOut(stream, dec.decode(buf, { stream: true })); return buf.length; } };
}

/* ---------- project files <-> virtual FS ---------- */
const written = new Map();   // name -> fingerprint of what the page sent / last saw
function fingerprint(u8) { let h = 2166136261; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619); } return u8.length + ':' + (h >>> 0); }
function toBytes(content) {
  if (typeof content === 'string' && content.startsWith('base64:')) {
    const bin = atob(content.slice(7)); const u8 = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    return u8;
  }
  return new TextEncoder().encode(String(content ?? ''));
}
function safeName(name) { return typeof name === 'string' && name && !name.startsWith('/') && !name.split('/').some(p => p === '..' || p === '' || p === '.'); }
function syncFiles(files) {
  for (const name of [...written.keys()]) {
    if (!(name in files)) { try { pyodide.FS.unlink(PROJECT + '/' + name); } catch (e) {} written.delete(name); }
  }
  for (const [name, content] of Object.entries(files)) {
    if (!safeName(name)) continue;
    const bytes = toBytes(content); const fp = fingerprint(bytes);
    if (written.get(name) === fp) { try { pyodide.FS.stat(PROJECT + '/' + name); continue; } catch (e) {} }
    const parts = name.split('/');
    for (let d = 1; d < parts.length; d++) { try { pyodide.FS.mkdir(PROJECT + '/' + parts.slice(0, d).join('/')); } catch (e) {} }
    pyodide.FS.writeFile(PROJECT + '/' + name, bytes);
    written.set(name, fp);
  }
}
const FILE_LIMIT = 2 * 1024 * 1024, TOTAL_LIMIT = 4 * 1024 * 1024;
function collectChanges() {
  // files the user's program created / changed / deleted in the project folder
  const changed = [], tooLarge = [], deleted = []; let total = 0; const seen = new Set();
  const walk = (dir, rel) => {
    let names = []; try { names = pyodide.FS.readdir(dir); } catch (e) { return; }
    for (const n of names) {
      if (n === '.' || n === '..' || n === '__pycache__' || n.startsWith('.')) continue;
      const path = dir + '/' + n, relName = rel ? rel + '/' + n : n; let st;
      try { st = pyodide.FS.stat(path); } catch (e) { continue; }
      if (pyodide.FS.isDir(st.mode)) { walk(path, relName); continue; }
      seen.add(relName);
      if (st.size > FILE_LIMIT || total + st.size > TOTAL_LIMIT) { if (!written.has(relName)) tooLarge.push({ name: relName, size: st.size }); continue; }
      const bytes = pyodide.FS.readFile(path); const fp = fingerprint(bytes);
      if (written.get(relName) === fp) continue;
      total += bytes.length; written.set(relName, fp);
      let text = null;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) text = null; } catch (e) { text = null; }
      if (text === null) { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); text = 'base64:' + btoa(bin); }
      changed.push({ name: relName, content: text });
    }
  };
  walk(PROJECT, '');
  for (const name of [...written.keys()]) if (!seen.has(name)) { deleted.push(name); written.delete(name); }
  return { changed, tooLarge, deleted };
}

/* ---------- requests ---------- */
async function loadImports(sources) {
  const errors = [];
  for (const src of sources) {
    try {
      await pyodide.loadPackagesFromImports(src, {
        messageCallback: m => { if (/^Loading /.test(m)) postMessage({ type: 'status', text: m.replace(/^Loading /, 'パッケージ読込中: ') }); },
        errorCallback: m => errors.push(m),
      });
    } catch (e) { errors.push(String(e && e.message || e)); }
  }
  return errors;
}

async function runCode(msg) {
  await ready;
  segs = []; outChars = 0; dropped = 0; streamBuf = []; lastStream = performance.now();
  streamId = msg.stream ? msg.id : null;
  pyodide.setStdout(writer('out'));
  pyodide.setStderr(writer('err'));
  const input = new TextEncoder().encode(msg.stdin == null || msg.stdin === '' ? '' : (String(msg.stdin).endsWith('\n') ? String(msg.stdin) : String(msg.stdin) + '\n'));
  let pos = 0;
  pyodide.setStdin({ stdin: () => (pos < input.length ? input[pos++] : null), isatty: false });
  const t0 = performance.now();
  let res = { error: null, result: null, images: [], note: null };
  let changes = null, fatal = false;
  try {
    if (msg.files) syncFiles(msg.files);
    const sources = [msg.code];
    if (msg.files) for (const [n, c] of Object.entries(msg.files)) if (/\.py$/.test(n) && typeof c === 'string' && !c.startsWith('base64:')) sources.push(c);
    if (msg.packages && msg.packages.length) await pyodide.loadPackage(msg.packages);
    const pkgErrors = await loadImports(sources);
    for (const m of pkgErrors) pushOut('err', '[パッケージの読み込みに失敗しました: ' + m + ']\n');
    const json = await rt.run(msg.code, msg.filename || 'main.py', !!msg.isolated, !!msg.wantLast);
    res = JSON.parse(json);
  } catch (e) {
    // only reached when Pyodide itself failed (user exceptions are handled in Python)
    const text = String(e && e.message || e);
    fatal = /fatal error|Pyodide already fatally failed|RuntimeError: memory access out of bounds|Maximum call stack/i.test(text);
    res.error = { type: fatal ? 'KernelError' : 'InternalError', message: text, text, file: null, line: null };
  }
  if (dropped) pushOut('err', `\n[出力が多すぎるため、以降の ${dropped.toLocaleString()} 文字を省略しました]\n`, true);
  if (res.error && res.error.text) pushOut('err', res.error.text, true);
  flushStream(); streamId = null;
  if (msg.files && !msg.isolated && !fatal) { try { changes = collectChanges(); } catch (e) { changes = null; } }
  let vars = [];
  if (!msg.isolated && !fatal) { try { vars = JSON.parse(rt.snapshot()); } catch (e) { vars = []; } }
  postMessage({ type: 'result', id: msg.id, segs, error: res.error, result: res.result, images: res.images || [],
    note: res.note, asyncioShim: !!res.asyncioShim, ms: Math.round(performance.now() - t0), vars, changes, fatal });
}

async function checkCode(msg) {
  await ready;
  let out = { syntax: null, incomplete: false, warnings: [] };
  try { out = JSON.parse(rt.analyze(msg.code, rt.namespace_names())); } catch (e) {}
  postMessage({ type: 'diag', id: msg.id, ...out });
}

let queue = Promise.resolve();
onmessage = (ev) => {
  const msg = ev.data;
  // check is read-only and synchronous; everything else runs strictly one at a time
  if (msg.type === 'check') { handle(msg); return; }
  queue = queue.then(() => handle(msg));
};
async function handle(msg) {
  try {
    if (msg.type === 'run') await runCode(msg);
    else if (msg.type === 'check') await checkCode(msg);
    else if (msg.type === 'load') {
      await ready; let error = null;
      try { await pyodide.loadPackage(msg.packages, { messageCallback: () => {}, errorCallback: m => { error = m; } }); } catch (e) { error = String(e && e.message || e); }
      postMessage({ type: 'loaded', id: msg.id, packages: msg.packages, error });
    } else if (msg.type === 'reset') { await ready; rt.reset(); postMessage({ type: 'reset-done', id: msg.id }); }
  } catch (e) {
    const text = String(e && e.message || e);
    postMessage({ type: msg.type === 'check' ? 'diag' : 'result', id: msg.id, segs: [{ s: 'err', t: text }], error: { type: 'KernelError', message: text, text },
      images: [], vars: [], ms: 0, syntax: null, warnings: [], fatal: !!initError || /fatal/i.test(text) });
  }
}
