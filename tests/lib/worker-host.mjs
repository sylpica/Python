// Runs the production worker.js inside Node with the npm build of Pyodide 0.26.4
// (same version the app loads from the CDN). Only the browser globals the worker
// touches are provided; message handling is the real code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function startWorker() {
  const { loadPyodide } = require('pyodide');
  const src = fs.readFileSync(path.join(ROOT, 'worker.js'), 'utf8');
  let listener = () => {};
  const g = {
    importScripts: () => {},
    loadPyodide: () => loadPyodide({ stdin: () => null }),
    postMessage: m => listener(structuredClone(m)),
    fetch: async url => {
      const p = path.join(ROOT, String(url));
      if (!fs.existsSync(p)) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, status: 200, text: async () => fs.readFileSync(p, 'utf8') };
    },
    performance, TextDecoder, TextEncoder, atob, btoa, console,
  };
  const deliver = new Function(...Object.keys(g), `let onmessage;\n${src}\n;return m => onmessage({ data: m });`)(...Object.values(g));
  let seq = 0; const pending = new Map(); const events = [];
  let readyResolve; const readyP = new Promise(r => { readyResolve = r; });
  listener = m => {
    events.push(m);
    if (m.type === 'ready' || m.type === 'init-error') readyResolve(m);
    if (m.type === 'stream' && pending.has(m.id)) pending.get(m.id).streams.push(m);
    else if (m.id != null && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p.resolve({ ...m, streams: p.streams }); }
  };
  const call = msg => new Promise(resolve => { const id = ++seq; pending.set(id, { resolve, streams: [] }); deliver({ ...msg, id }); });
  const ready = await readyP;
  const text = r => (r.segs || []).map(s => s.t).join('');
  const stdout = r => (r.segs || []).filter(s => s.s === 'out').map(s => s.t).join('');
  return { ready, call, events, text, stdout,
    run: (code, opts = {}) => call({ type: 'run', code, ...opts }),
    check: code => call({ type: 'check', code }),
    reset: () => call({ type: 'reset' }) };
}
