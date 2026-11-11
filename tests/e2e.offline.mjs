// Offline / update / persistence checks with a real Service Worker (Chromium, local server).
// node tests/e2e.offline.mjs [baseUrl]   (needs CDN access once, to fill the cache)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { test, eq, ok, summary } from './lib/mini-test.mjs';
const BASE = process.argv[2] || 'http://localhost:8765/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const ready = () => page.waitForFunction(() => document.querySelector('#kernelStatus')?.textContent.includes('準備完了'), null, { timeout: 180000 });
const setCode = c => page.evaluate(v => window.monaco.editor.getEditors()[0].setValue(v), c);
const run = async () => { await page.click('#runBtn'); await page.waitForFunction(() => !document.querySelector('#runBtn').disabled, null, { timeout: 120000 }); };
const t0 = Date.now();
await page.goto(BASE); await ready(); const firstReadyMs = Date.now() - t0;
await page.waitForFunction(() => window.monaco, null, { timeout: 60000 });
await test('service worker controls the page after first visit', async () => { await page.reload(); await ready(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }); });
await test('numpy loaded online is available offline later (cached by the browser)', async () => { await setCode('import numpy as np\nprint(int(np.arange(3).sum()))'); await run(); ok((await page.textContent('#console')).includes('3')); });
await setCode('print("saved-offline-code")'); await page.waitForTimeout(400);
await ctx.setOffline(true);
await test('offline reload: app shell, Monaco and Python start from cache', async () => {
  const t = Date.now(); await page.reload(); await ready(); await page.waitForFunction(() => window.monaco, null, { timeout: 60000 }); const ms = Date.now() - t;
  console.log('       offline start ms:', ms);
  eq(await page.evaluate(() => window.monaco.editor.getEditors()[0].getValue()), 'print("saved-offline-code")');
});
await test('offline: code runs and lessons open', async () => { await run(); ok((await page.textContent('#console')).includes('saved-offline-code')); await page.click('[data-view="lessons"]'); await page.click('#lessonList .item >> nth=0'); ok((await page.textContent('#lessonDetail')).length > 100); });
await test('offline: already-loaded package (numpy) still imports', async () => { await page.click('[data-view="studio"]'); await setCode('import numpy as np\nprint(int(np.arange(4).sum()))'); await run(); ok((await page.textContent('#console')).includes('6'), await page.textContent('#console')); });
await ctx.setOffline(false);
await test('back online: saved data intact', async () => { await page.reload(); await ready(); ok((await page.evaluate(() => Object.keys(window.__pystudio.files))).includes('main.py')); });
await test('update: old app caches are replaced, CDN cache kept, foreign caches untouched', async () => {
  const names = await page.evaluate(async () => { await caches.open('other-app-cache'); await caches.open('python-studio-app-v1-old'); const r = await navigator.serviceWorker.getRegistration(); await r.update(); await new Promise(r => setTimeout(r, 500)); return caches.keys(); });
  ok(names.includes('other-app-cache'), 'foreign cache must survive: ' + names);
  ok(names.some(n => n.startsWith('python-studio-cdn')), 'cdn cache present: ' + names);
  // old caches are removed on the next activation: force one by reloading after registering again
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.unregister(); });
  await page.reload(); await page.waitForTimeout(2500);
  const after = await page.evaluate(() => caches.keys());
  ok(!after.includes('python-studio-app-v1-old'), 'old app cache removed: ' + after); ok(after.includes('other-app-cache'), 'foreign cache kept: ' + after); ok(after.some(n => n.startsWith('python-studio-cdn')), 'cdn kept: ' + after);
});
await test('A-10 only caches named python-studio-* are removed (python-studiox-* of another app survives)', async () => { await page.evaluate(async () => { await caches.open('python-studiox-other'); await caches.open('python-studio-old-thing'); const r = await navigator.serviceWorker.getRegistration(); if (r) await r.unregister(); }); await page.reload(); await page.waitForTimeout(2500); const names = await page.evaluate(() => caches.keys()); ok(names.includes('python-studiox-other'), names.join()); ok(!names.includes('python-studio-old-thing'), names.join()); });
await test('corrupt saved data: app still starts and recovers', async () => {
  await page.evaluate(() => { localStorage.setItem('pystudio:files', '{broken'); localStorage.setItem('pystudio:progress', '"str"'); localStorage.setItem('pystudio:notebook', '5'); });
  await page.reload(); await ready(); eq(await page.evaluate(() => Object.keys(window.__pystudio.files)), ['main.py']); eq(await page.evaluate(() => window.__pystudio.nbCells.length), 2);
});
await test('legacy schema-1 data migrates without loss', async () => {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pystudio:progress', JSON.stringify({ lessonsDone: ['loops'], history: [{ t: '2026-01-01T00:00:00Z', label: 'q012', ok: false }], bookmarks: ['quiz:q001'], wrong: ['q012'] })); localStorage.setItem('pystudio:notebook', JSON.stringify([{ type: 'code', source: 'print(1)', out: '1' }])); });
  await page.reload(); await ready();
  const p = await page.evaluate(() => window.__pystudio.progress); eq(p.lessonsDone, ['loops']); eq(p.wrong, ['quiz:q012']); eq(p.history[0].key, 'quiz:q012');
  eq(await page.evaluate(() => window.__pystudio.nbCells[0].output.segs[0].t), '1');
  eq(await page.evaluate(() => JSON.parse(localStorage.getItem('pystudio:schema'))), 2);
  ok(await page.evaluate(() => localStorage.getItem('pystudio:progress-backup-v1') !== null), 'raw v1 backup kept');
});
await test('backup export -> wipe -> import round trip', async () => {
  await page.evaluate(() => { const a = window.__pystudio; a.files['keep.py'] = 'print("kept")'; });
  await page.click('[data-view="progress"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const path = await dl.path(); const json = JSON.parse(require('node:fs').readFileSync(path, 'utf8'));
  ok(json.schema === 2 && json.progress.lessonsDone.includes('loops'));
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready();
  page.on('dialog', d => d.accept()); await page.click('[data-view="progress"]'); await page.setInputFiles('#importData', path); await page.waitForTimeout(800);
  eq(await page.evaluate(() => window.__pystudio.progress.lessonsDone), ['loops']);
});
console.log('       first start (cold, with CDN download) ms:', firstReadyMs);
await browser.close();
summary('offline: ');
