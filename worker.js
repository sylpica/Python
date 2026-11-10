/* Pyodide Web Worker: Python kernel for Python Studio
   Pyodide v0.26.4 (Python 3.12) - verified CDN availability 2026-11-10.
   Interrupt strategy: GitHub Pages cannot guarantee cross-origin isolation,
   so interruption = terminate this Worker and recreate it (kernel state lost,
   the UI warns about this before terminating). */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;
let ready = (async () => {
  pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
  postMessage({ type: 'ready', python: pyodide.runPython('import sys; sys.version.split()[0]') });
})();

function snapshotVars() {
  try {
    return pyodide.runPython(`
import json, types
_out = []
for _k, _v in list(globals().items()):
    if _k.startswith('_') or isinstance(_v, types.ModuleType) or callable(_v) and getattr(_v, '__module__', None) == 'builtins':
        continue
    try:
        _r = repr(_v)
    except Exception:
        _r = '<repr error>'
    if len(_r) > 120: _r = _r[:120] + '…'
    _out.append({'name': _k, 'type': type(_v).__name__, 'value': _r})
json.dumps(_out[:60])
`);
  } catch (e) { return '[]'; }
}

async function runCode(msg) {
  await ready;
  const t0 = performance.now();
  let stdout = '', stderr = '', error = null, image = null;
  pyodide.setStdout({ batched: s => { stdout += s + '\n'; } });
  pyodide.setStderr({ batched: s => { stderr += s + '\n'; } });
  if (msg.stdin != null) {
    const lines = String(msg.stdin).split('\n');
    let i = 0;
    pyodide.setStdin({ stdin: () => {
      if (i >= lines.length) return null;
      const bytes = new TextEncoder().encode(lines[i++] + '\n');
      return bytes;
    }});
  }
  try {
    // write multi-file project into the virtual FS
    if (msg.files) {
      for (const [name, content] of Object.entries(msg.files)) {
        const parts = name.split('/');
        for (let d = 1; d < parts.length; d++) {
          const dir = parts.slice(0, d).join('/');
          try { pyodide.FS.mkdir(dir); } catch (e) {}
        }
        pyodide.FS.writeFile(name, content);
      }
    }
    if (msg.packages && msg.packages.length) {
      await pyodide.loadPackage(msg.packages);
    }
    await pyodide.runPythonAsync(msg.code);
    // capture a matplotlib figure if one is open
    try {
      image = pyodide.runPython(`
import io, base64
_img = None
try:
    import matplotlib
    import matplotlib.pyplot as _plt
    if _plt.get_fignums():
        _buf = io.BytesIO()
        _plt.savefig(_buf, format='png', dpi=100, bbox_inches='tight')
        _plt.close('all')
        _img = base64.b64encode(_buf.getvalue()).decode()
except Exception:
    _img = None
_img
`);
    } catch (e) { image = null; }
  } catch (e) {
    error = String(e && e.message ? e.message : e);
  }
  postMessage({ type: 'result', id: msg.id, stdout, stderr, error,
    ms: Math.round(performance.now() - t0), image,
    vars: JSON.parse(snapshotVars() || '[]') });
}

async function checkCode(msg) {
  await ready;
  let diag = null;
  try {
    pyodide.globals.set('_code_to_check', msg.code);
    diag = pyodide.runPython(`
import ast, json
_d = None
try:
    ast.parse(_code_to_check)
except SyntaxError as _e:
    _d = {'line': _e.lineno or 1, 'col': _e.offset or 1, 'msg': _e.msg, 'kind': type(_e).__name__}
json.dumps(_d) if _d else 'null'
`);
  } catch (e) { diag = null; }
  postMessage({ type: 'diag', id: msg.id, syntax: diag ? JSON.parse(diag) : null });
}

onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.type === 'run') await runCode(msg);
    else if (msg.type === 'check') await checkCode(msg);
    else if (msg.type === 'load') { await ready; await pyodide.loadPackage(msg.packages); postMessage({ type: 'loaded', packages: msg.packages }); }
    else if (msg.type === 'reset') { await ready; pyodide.runPython(`
import sys
for _k in list(globals().keys()):
    if not _k.startswith('__'):
        del globals()[_k]
`); postMessage({ type: 'reset-done' }); }
  } catch (e) {
    postMessage({ type: 'result', id: msg.id, stdout: '', stderr: '', error: String(e), ms: 0, image: null, vars: [] });
  }
};
