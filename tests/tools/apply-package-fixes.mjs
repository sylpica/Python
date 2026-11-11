// Package catalog: browser status labels come from measurement on Pyodide 0.26.4 (tests/engine + probe 2026-11-10).
import fs from 'node:fs';
const F = '/home/user/Python/data/extras.js';
const src = fs.readFileSync(F, 'utf8');
const get = n => JSON.parse(src.match(new RegExp('export const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]);
const M = get('MISTAKES'), P = get('PACKAGES'), E = get('ENV_LESSONS');
const S = {
  numpy: ['import で利用可', 'Pyodide 同梱 1.26.4。import すると自動で読み込みます', 'import numpy as np\na = np.array([1, 2, 3])\nprint(a * 10, a.mean())'],
  scipy: ['import で利用可', 'Pyodide 同梱 1.12.0（初回読込は数十MB）', 'from scipy import stats\nprint(round(stats.norm.cdf(1.96), 4))'],
  pandas: ['import で利用可', 'Pyodide 同梱 2.2.0', 'import pandas as pd\ndf = pd.DataFrame({"name": ["a", "b"], "score": [80, 90]})\nprint(df)\nprint(df["score"].mean())'],
  matplotlib: ['import で利用可', 'Pyodide 同梱 3.5.2。plt.show() で画像として表示。日本語フォントは含まれないため日本語ラベルは文字化けします', 'import matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [2, 4, 3], marker="o")\nplt.title("sample")\nplt.show()'],
  seaborn: ['micropip で追加可', 'Pyodide に同梱されていないため、コード内で import micropip; await micropip.install("seaborn") を実行（PyPI から取得、要オンライン）', 'import micropip\nawait micropip.install("seaborn")\nimport seaborn as sns\nimport matplotlib.pyplot as plt\nsns.histplot([1, 2, 2, 3, 3, 3])\nplt.show()'],
  statsmodels: ['import で利用可', 'Pyodide 同梱 0.14.2', 'import numpy as np\nimport statsmodels.api as sm\nx = np.array([1, 2, 3, 4])\ny = 2 * x + 1\nres = sm.OLS(y, sm.add_constant(x)).fit()\nprint(res.params.round(3))'],
  'scikit-learn': ['import で利用可', 'Pyodide 同梱 1.4.2（import 名は sklearn）', 'from sklearn.linear_model import LinearRegression\nm = LinearRegression().fit([[0], [1], [2]], [1, 3, 5])\nprint(m.coef_, m.intercept_)'],
  openpyxl: ['micropip で追加可', 'Pyodide に同梱されていないため micropip でインストール（要オンライン）。pandas.read_excel も openpyxl を必要とします', 'import micropip\nawait micropip.install("openpyxl")\nimport openpyxl\nwb = openpyxl.Workbook()\nwb.active["A1"] = "こんにちは"\nwb.save("sample.xlsx")\nprint(openpyxl.load_workbook("sample.xlsx").active["A1"].value)'],
  pillow: ['import で利用可', 'Pyodide 同梱 10.2.0（import 名は PIL）', 'from PIL import Image\nimg = Image.new("RGB", (40, 20), "orange")\nimg.save("orange.png")\nprint(img.size)'],
  requests: ['import で利用可', 'Pyodide 同梱 2.31.0。import は確認済み。実際の通信はブラウザの制約（CORS）を受け、許可されたサーバーにしか届きません（通信は未検証）', null],
  fastapi: ['通常環境向け', 'サーバーを起動する用途のため、ブラウザ内では使いません', null],
  pytest: ['import で利用可', 'Pyodide 同梱 8.1.1。import は確認済み。通常は PC のターミナルで pytest コマンドとして使います', null],
  ruff: ['通常環境向け', 'コマンドラインツール', null], mypy: ['通常環境向け', 'コマンドラインツール', null],
};
for (const p of P) { const s = S[p.id]; if (!s) throw new Error(p.id); p.browser = s[0]; p.browserNote = s[1]; if (s[2]) p.sample = s[2]; else delete p.sample; }
for (const p of P) if (p.id === 'requests') p.usage = 'Web APIの呼び出しやWebページの取得に使う。';
const OFFICIAL = { 'python-and-cpython': 'https://docs.python.org/ja/3.12/', versions: 'https://devguide.python.org/versions/', 'install-and-path': 'https://docs.python.org/ja/3.12/using/index.html', 'terminal-and-repl': 'https://docs.python.org/ja/3.12/tutorial/interpreter.html', 'vscode-and-jupyter': 'https://code.visualstudio.com/docs/python/python-tutorial', venv: 'https://docs.python.org/ja/3.12/library/venv.html', 'pip-and-pypi': 'https://pip.pypa.io/en/stable/', uv: 'https://docs.astral.sh/uv/', 'requirements-and-pyproject': 'https://packaging.python.org/ja/latest/guides/writing-pyproject-toml/', 'git-integration': 'https://docs.github.com/ja/get-started' };
for (const e of E) e.official = OFFICIAL[e.id];
const ver = E.find(e => e.id === 'versions'); ver.body = ver.body.replace('3.12や3.13のように', '3.13、3.14のように'); if (!ver.body.includes('3.14')) throw new Error('ver');
const inst = E.find(e => e.id === 'install-and-path'); inst.body = inst.body.replace('whichやwhereで確認する', 'which（Windowsでは where）で確認する');
E.splice(E.findIndex(e => e.id === 'uv') + 1, 0,
  { id: 'conda', title: 'conda（Anaconda／Miniforge）', body: 'condaはPython本体とライブラリをまとめて管理できるパッケージ・環境管理ツールで、Anaconda や Miniforge（conda-forge を既定にした軽量版）で導入します。conda create -n 名前 python=3.12 で環境を作り、conda activate 名前 で切り替えます。NumPyやSciPyのようにC言語などで書かれた部分を含むライブラリを、OSに合わせたビルド済みの形で入れやすいのが特徴で、科学技術計算の分野で広く使われてきました。pipとvenvの組み合わせと役割が重なるため、1つの環境の中で conda と pip を無秩序に混ぜるとどちらが何を入れたか分からなくなり、依存関係が壊れる原因になります。使う場合は、まず conda で入れられるものを入れ、足りないものだけを pip で補う順序にします。なお Anaconda の配布物には組織の規模によって有償となる利用条件があるため、業務では利用規約を確認してください。', points: ['Python本体ごと環境を管理できる', 'conda と pip を無秩序に混ぜない', '業務利用では配布元の利用条件を確認する'], official: 'https://docs.conda.io/' },
  { id: 'browser-python', title: 'このアプリのPython（Pyodide）と通常のPythonの違い', body: 'このアプリはPyodide 0.26.4（CPython 3.12.1 をWebAssemblyに移植したもの）をブラウザ内で動かしています。言語仕様と標準ライブラリのほとんどは通常のPythonと同じですが、次の点が異なります。①外部ライブラリは pip ではなく、Pyodide 同梱のもの（NumPy・pandas・Matplotlib など）を import すると自動で読み込み、同梱されていない純Pythonのライブラリは import micropip; await micropip.install("名前") で追加します。②ファイルはブラウザ内の仮想ファイルシステムに保存され、PCのフォルダには書き込みません。③subprocess・ソケット通信・スレッドの多くは使えず、Webへの通信はブラウザの制約（CORS）を受けます。④32bit環境のため、巨大なリストなどは通常版より早く限界に達します。⑤input() は実行前に「標準入力」欄へ書いた行を順に読みます。ここで動いたコードは通常のPythonでも基本的にそのまま動きますが、PCで使うときは pip でライブラリを入れる必要があります。', points: ['中身は CPython 3.12 の移植版', '同梱ライブラリは import で自動読込、それ以外は micropip', 'ファイルとネットワークにブラウザ由来の制約がある'], official: 'https://pyodide.org/en/0.26.4/usage/wasm-constraints.html' });
fs.writeFileSync(F, [['MISTAKES', M], ['PACKAGES', P], ['ENV_LESSONS', E]].map(([n, v]) => `export const ${n} = ${JSON.stringify(v, null, 1)};\n`).join('\n'));
console.log('packages updated', P.length, E.length);
