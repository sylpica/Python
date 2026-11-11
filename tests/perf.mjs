// Local performance measurement (Chromium, local server, CDN via the sandbox proxy). Prints and writes tests/output/perf.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
const out = { measuredAt: new Date().toISOString(), env: { browser: 'Chromium ' + b.version(), host: 'Linux sandbox, headless, local http.server, CDN through proxy', note: '1回計測または記載回数の中央値。実ユーザー環境の値ではない' } };
const ms = async f => { const t = performance.now(); await f(); return Math.round(performance.now() - t); };
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ready = () => p.waitForFunction(() => document.querySelector('#kernelStatus')?.textContent.includes('準備完了'), null, { timeout: 180000 });
const setCode = c => p.evaluate(v => window.monaco.editor.getEditors()[0].setValue(v), c);
const run = async () => { await p.click('#runBtn'); await p.waitForFunction(() => !document.querySelector('#runBtn').disabled, null, { timeout: 180000 }); };
out.editorVisibleMs = await ms(async () => { await p.goto(BASE); await p.waitForFunction(() => window.monaco, null, { timeout: 60000 }); });
out.coldKernelReadyMs = await ms(ready);
await p.reload(); out.warmReloadToReadyMs = await ms(async () => { await ready(); await p.waitForFunction(() => window.monaco); });
await setCode('print(1)'); out.firstRunMs = await ms(run);
const runs = []; for (let i = 0; i < 7; i++) { await setCode(`print(${i})`); runs.push(await ms(run)); } out.repeatRunMs = { samples: runs, median: median(runs) };
for (const [k, c] of [['numpyLoadMs', 'import numpy as np\nprint(np.__version__)'], ['pandasLoadMs', 'import pandas as pd\nprint(pd.__version__)'], ['matplotlibLoadMs', 'import matplotlib.pyplot as plt\nplt.plot([1,2])\nplt.show()']]) { await setCode(c); out[k] = await ms(run); }
await setCode('import numpy as np\nimport pandas as pd\nprint(1)'); out.secondImportRunMs = await ms(run);
await setCode('for i in range(100000):\n    print(i)'); out.bigOutput100kLinesMs = await ms(run);
out.bigOutputConsoleChars = (await p.textContent('#console')).length;
await setCode('x = 1'); await run();
const typing = []; for (let i = 0; i < 20; i++) typing.push(await p.evaluate(() => { const e = window.monaco.editor.getEditors()[0]; const t = performance.now(); e.trigger('k', 'type', { text: 'a' }); return performance.now() - t; }));
out.keystrokeBlockingMs = { max: Math.round(Math.max(...typing) * 10) / 10, median: Math.round(median(typing) * 10) / 10 };
await p.click('[data-view="notebook"]'); out.viewSwitchMs = await ms(async () => { await p.click('[data-view="lessons"]'); await p.click('#lessonList .item >> nth=3'); });
await p.fill('#globalSearch', 'list'); out.searchMs = await ms(async () => { await p.waitForSelector('#searchResults .item'); });
// long-use: 40 runs, heap + worker count + listeners
await p.click('[data-view="studio"]');
const heap0 = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
for (let i = 0; i < 40; i++) { await setCode(`s = "x" * 1000\nprint(len(s), ${i})`); await run(); }
const heap1 = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
out.longUse40Runs = { jsHeapBeforeMB: heap0 && Math.round(heap0 / 1e5) / 10, jsHeapAfterMB: heap1 && Math.round(heap1 / 1e5) / 10, lastRunMs: Number((await p.textContent('#runTime')).match(/\d+/)[0]) };
await b.close();
fs.mkdirSync(new URL('./output/', import.meta.url).pathname, { recursive: true }); fs.writeFileSync(new URL('./output/perf.json', import.meta.url).pathname, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
