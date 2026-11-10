// Minimal test helpers (no dependencies). Reports every test; exits 1 on any failure.
let pass = 0, fail = 0; const failures = [];
export async function test(name, fn) {
  try { await fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').join('\n       ')); }
}
export function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
export function ok(v, msg) { if (!v) throw new Error('assertion failed' + (msg ? ': ' + msg : '')); }
export function summary(label = '') {
  console.log(`\n${label}total=${pass + fail} pass=${pass} fail=${fail} skip=0`);
  if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exitCode = 1; }
  return { pass, fail };
}
