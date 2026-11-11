export const MISTAKES = [
 {
  "id": "eq-vs-assign",
  "title": "= と == の混同",
  "bad": "x = 5\nif x = 5:\n    print(\"5です\")",
  "phenomenon": "SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='? が発生し、プログラムが1行も実行されない。",
  "cause": "= は代入、== は比較。if の条件には比較が必要。",
  "good": "x = 5\nif x == 5:\n    print(\"5です\")",
  "related": [
   "variable"
  ]
 },
 {
  "id": "is-vs-eq",
  "title": "is と == の混同",
  "bad": "a = [1, 2]\nb = [1, 2]\nprint(a is b)  # False になる",
  "phenomenon": "中身が同じリストなのに False になり、比較結果が期待と違う。",
  "cause": "is は同一オブジェクトかどうか、== は値が等しいかを比較する。",
  "good": "a = [1, 2]\nb = [1, 2]\nprint(a == b)  # True",
  "related": [
   "object",
   "mutable",
   "list"
  ]
 },
 {
  "id": "indentation-error",
  "title": "インデントミス",
  "bad": "if True:\nprint(\"実行\")",
  "phenomenon": "IndentationError: expected an indented block after 'if' statement on line 1 が発生する。",
  "cause": "Pythonではインデントがブロックを表す。if の後は字下げが必須。",
  "good": "if True:\n    print(\"実行\")",
  "related": [
   "indentation",
   "exception"
  ]
 },
 {
  "id": "missing-colon",
  "title": "コロンの付け忘れ",
  "bad": "for i in range(3)\n    print(i)",
  "phenomenon": "SyntaxError: expected ':' が発生する。",
  "cause": "if、for、def、class などの行末にはコロンが必要。",
  "good": "for i in range(3):\n    print(i)",
  "related": [
   "indentation",
   "function"
  ]
 },
 {
  "id": "str-num-mix",
  "title": "文字列と数値の混同",
  "bad": "age = \"20\"  # input() で受け取った値も文字列\nprint(age + 1)",
  "phenomenon": "TypeError: can only concatenate str (not \"int\") to str が発生する。",
  "cause": "input() の戻り値は常に文字列であり、数値演算には変換が必要。",
  "good": "age = int(\"20\")  # input() の値なら int(input(\"年齢: \")) と変換する\nprint(age + 1)",
  "related": [
   "string",
   "type"
  ]
 },
 {
  "id": "none-handling",
  "title": "None の扱いの誤り",
  "bad": "def add(a, b):\n    print(a + b)\nresult = add(2, 3)\nprint(result * 2)",
  "phenomenon": "5 と表示された後、None と数値の演算で TypeError: unsupported operand type(s) for *: 'NoneType' and 'int' になる。",
  "cause": "return のない関数は None を返す。表示（print）と返却（return）は別物。",
  "good": "def add(a, b):\n    return a + b\nresult = add(2, 3)\nprint(result * 2)",
  "related": [
   "return-value",
   "function"
  ]
 },
 {
  "id": "index-out-of-range",
  "title": "添字の範囲外参照",
  "bad": "nums = [10, 20]\nprint(nums[2])",
  "phenomenon": "IndexError: list index out of range が発生する。",
  "cause": "インデックスは 0 から始まり、最後は len(nums)-1。有効範囲は 0〜1。",
  "good": "nums = [10, 20]\nprint(nums[len(nums) - 1])",
  "related": [
   "list",
   "exception"
  ]
 },
 {
  "id": "dict-missing-key",
  "title": "辞書に存在しないキーへのアクセス",
  "bad": "user = {\"name\": \"タロウ\"}\nprint(user[\"age\"])",
  "phenomenon": "KeyError: 'age' が発生する。",
  "cause": "存在しないキーを [] で参照すると KeyError になる。",
  "good": "user = {\"name\": \"タロウ\"}\nprint(user.get(\"age\", \"不明\"))",
  "related": [
   "dict",
   "exception"
  ]
 },
 {
  "id": "mutable-default-arg",
  "title": "変更可能なデフォルト引数",
  "bad": "def add_item(item, items=[]):\n    items.append(item)\n    return items\nprint(add_item(1))\nprint(add_item(2))",
  "phenomenon": "2回目の呼び出しで [1, 2] となり、前回の結果が残ってしまう。",
  "cause": "デフォルト値は関数定義時に1度だけ作られ、リストのような変更可能なオブジェクトは呼び出し間で共有される。",
  "good": "def add_item(item, items=None):\n    if items is None:\n        items = []\n    items.append(item)\n    return items",
  "related": [
   "mutable",
   "argument",
   "function"
  ]
 },
 {
  "id": "shallow-copy",
  "title": "浅いコピーと深いコピーの混同",
  "bad": "a = [[1, 2], [3, 4]]\nb = a.copy()\nb[0].append(99)\nprint(a)",
  "phenomenon": "元の a まで [[1, 2, 99], [3, 4]] に変わってしまう。",
  "cause": "copy() は浅いコピーで、外側だけが複製され、入れ子のリストは共有される。",
  "good": "import copy\na = [[1, 2], [3, 4]]\nb = copy.deepcopy(a)\nb[0].append(99)\nprint(a)",
  "related": [
   "mutable",
   "list",
   "object"
  ]
 },
 {
  "id": "float-error",
  "title": "浮動小数点数の誤差",
  "bad": "print(0.1 + 0.2 == 0.3)  # False\nprint(0.1 + 0.2)",
  "phenomenon": "0.30000000000000004 と表示され、等値比較が False になる。",
  "cause": "小数を2進数で正確に表せないため、表現誤差が生じる。",
  "good": "from decimal import Decimal\nprint(Decimal(\"0.1\") + Decimal(\"0.2\") == Decimal(\"0.3\"))  # True",
  "related": [
   "type",
   "algorithm"
  ]
 },
 {
  "id": "builtin-shadow",
  "title": "組み込み関数名の上書き",
  "bad": "list = [1, 2, 3]\nprint(list(\"abc\"))",
  "phenomenon": "TypeError: 'list' object is not callable が発生する。",
  "cause": "組み込み関数と同じ名前を変数に使うと、その名前で関数を呼べなくなる。",
  "good": "nums = [1, 2, 3]\nprint(list(\"abc\"))",
  "related": [
   "variable",
   "function",
   "list"
  ]
 },
 {
  "id": "scope-misunderstanding",
  "title": "変数スコープの誤解",
  "bad": "count = 0\ndef inc():\n    count += 1\ninc()",
  "phenomenon": "UnboundLocalError: cannot access local variable 'count' where it is not associated with a value が発生する（Python 3.11 以降の文言。3.10 以前は local variable 'count' referenced before assignment）。",
  "cause": "関数内で代入した名前はその関数のローカル変数とみなされ、外側の変数を直接書き換えられない。",
  "good": "count = 0\ndef inc():\n    global count\n    count += 1\ninc()\nprint(count)",
  "related": [
   "scope",
   "variable",
   "function"
  ]
 },
 {
  "id": "modify-while-iterating",
  "title": "リスト反復中の変更",
  "bad": "nums = [2, 4, 6, 7]\nfor n in nums:\n    if n % 2 == 0:\n        nums.remove(n)\nprint(nums)",
  "phenomenon": "偶数を全部消したつもりが [7] ではなく [4, 7] と表示され、要素が飛ばされる。",
  "cause": "反復中に要素を削除すると後続の要素の位置がずれ、チェックが飛ぶ。",
  "good": "nums = [2, 4, 6, 7]\nnums = [n for n in nums if n % 2 != 0]\nprint(nums)",
  "related": [
   "list",
   "iterator",
   "mutable"
  ]
 },
 {
  "id": "missing-return",
  "title": "戻り値の書き忘れ",
  "bad": "def twice(x):\n    result = x * 2\nprint(twice(5))",
  "phenomenon": "計算しているはずなのに None と表示される。",
  "cause": "関数内で値を計算しても、return しなければ呼び出し元へ返らない。",
  "good": "def twice(x):\n    result = x * 2\n    return result\nprint(twice(5))",
  "related": [
   "return-value",
   "function"
  ]
 }
];

export const PACKAGES = [
 {
  "id": "numpy",
  "name": "NumPy",
  "field": "数値計算",
  "desc": "多次元配列（ndarray）と高速な数値演算を提供する基盤ライブラリ。",
  "usage": "科学技術計算やデータ分析の土台。配列同士の演算や統計処理に使う。",
  "install": "python -m pip install numpy",
  "browser": "import で利用可",
  "official": "https://numpy.org/",
  "browserNote": "Pyodide 同梱 1.26.4。import すると自動で読み込みます",
  "sample": "import numpy as np\na = np.array([1, 2, 3])\nprint(a * 10, a.mean())"
 },
 {
  "id": "scipy",
  "name": "SciPy",
  "field": "数値計算",
  "desc": "NumPyの上に最適化、積分、統計、信号処理などの高度な数値計算を提供する。",
  "usage": "科学技術計算全般。統計検定や数値積分などに使う。",
  "install": "python -m pip install scipy",
  "browser": "import で利用可",
  "official": "https://scipy.org/",
  "browserNote": "Pyodide 同梱 1.12.0（初回読込は数十MB）",
  "sample": "from scipy import stats\nprint(round(stats.norm.cdf(1.96), 4))"
 },
 {
  "id": "pandas",
  "name": "pandas",
  "field": "データ分析",
  "desc": "表形式データ（DataFrame）を扱うためのライブラリ。",
  "usage": "CSV等の読み込み、集計、加工、可視化前の整形に使う。",
  "install": "python -m pip install pandas",
  "browser": "import で利用可",
  "official": "https://pandas.pydata.org/",
  "browserNote": "Pyodide 同梱 2.2.0",
  "sample": "import pandas as pd\ndf = pd.DataFrame({\"name\": [\"a\", \"b\"], \"score\": [80, 90]})\nprint(df)\nprint(df[\"score\"].mean())"
 },
 {
  "id": "matplotlib",
  "name": "Matplotlib",
  "field": "可視化",
  "desc": "折れ線・棒グラフ・散布図など多様なグラフを描くライブラリ。",
  "usage": "データの可視化や論文・レポート用図の作成に使う。",
  "install": "python -m pip install matplotlib",
  "browser": "import で利用可",
  "official": "https://matplotlib.org/",
  "browserNote": "Pyodide 同梱 3.5.2。plt.show() で画像として表示。日本語フォントは含まれないため日本語ラベルは文字化けします",
  "sample": "import matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [2, 4, 3], marker=\"o\")\nplt.title(\"sample\")\nplt.show()"
 },
 {
  "id": "seaborn",
  "name": "Seaborn",
  "field": "可視化",
  "desc": "Matplotlibを土台に、統計グラフを簡潔に美しく描くライブラリ。",
  "usage": "分布や相関などの統計可視化に使う。",
  "install": "python -m pip install seaborn",
  "browser": "micropip で追加可",
  "official": "https://seaborn.pydata.org/",
  "browserNote": "Pyodide に同梱されていないため、コード内で import micropip; await micropip.install(\"seaborn\") を実行（PyPI から取得、要オンライン）",
  "sample": "import micropip\nawait micropip.install(\"seaborn\")\nimport seaborn as sns\nimport matplotlib.pyplot as plt\nsns.histplot([1, 2, 2, 3, 3, 3])\nplt.show()"
 },
 {
  "id": "statsmodels",
  "name": "statsmodels",
  "field": "統計",
  "desc": "回帰分析や時系列分析など、統計モデルの推定と検定を提供する。",
  "usage": "重回帰、ロジスティック回帰、ARIMAなどの統計解析に使う。",
  "install": "python -m pip install statsmodels",
  "browser": "import で利用可",
  "official": "https://www.statsmodels.org/",
  "browserNote": "Pyodide 同梱 0.14.2",
  "sample": "import numpy as np\nimport statsmodels.api as sm\nx = np.array([1, 2, 3, 4])\ny = 2 * x + 1\nres = sm.OLS(y, sm.add_constant(x)).fit()\nprint(res.params.round(3))"
 },
 {
  "id": "scikit-learn",
  "name": "scikit-learn",
  "field": "機械学習",
  "desc": "分類・回帰・クラスタリングなど代表的な機械学習手法を提供する。",
  "usage": "機械学習モデルの学習と評価の標準的な入口として使う。",
  "install": "python -m pip install scikit-learn",
  "browser": "import で利用可",
  "official": "https://scikit-learn.org/",
  "browserNote": "Pyodide 同梱 1.4.2（import 名は sklearn）",
  "sample": "from sklearn.linear_model import LinearRegression\nm = LinearRegression().fit([[0], [1], [2]], [1, 3, 5])\nprint(m.coef_, m.intercept_)"
 },
 {
  "id": "openpyxl",
  "name": "openpyxl",
  "field": "Excel処理",
  "desc": "Excelファイル（.xlsx）の読み書きを行うライブラリ。",
  "usage": "Excel帳票の生成や、スプレッドシートデータの取り込みに使う。",
  "install": "python -m pip install openpyxl",
  "browser": "micropip で追加可",
  "official": "https://openpyxl.readthedocs.io/",
  "browserNote": "Pyodide に同梱されていないため micropip でインストール（要オンライン）。pandas.read_excel も openpyxl を必要とします",
  "sample": "import micropip\nawait micropip.install(\"openpyxl\")\nimport openpyxl\nwb = openpyxl.Workbook()\nwb.active[\"A1\"] = \"こんにちは\"\nwb.save(\"sample.xlsx\")\nprint(openpyxl.load_workbook(\"sample.xlsx\").active[\"A1\"].value)"
 },
 {
  "id": "pillow",
  "name": "Pillow",
  "field": "画像処理",
  "desc": "画像の読み込み、リサイズ、変換、保存などを行うライブラリ（PILの後継）。",
  "usage": "画像の加工やサムネイル生成などに使う。",
  "install": "python -m pip install Pillow",
  "browser": "import で利用可",
  "official": "https://python-pillow.org/",
  "browserNote": "Pyodide 同梱 10.2.0（import 名は PIL）",
  "sample": "from PIL import Image\nimg = Image.new(\"RGB\", (40, 20), \"orange\")\nimg.save(\"orange.png\")\nprint(img.size)"
 },
 {
  "id": "requests",
  "name": "requests",
  "field": "Web通信",
  "desc": "HTTP通信を簡潔に書けるライブラリ。",
  "usage": "Web APIの呼び出しやWebページの取得に使う。",
  "install": "python -m pip install requests",
  "browser": "import で利用可",
  "official": "https://requests.readthedocs.io/",
  "browserNote": "Pyodide 同梱 2.31.0。import は確認済み。実際の通信はブラウザの制約（CORS）を受け、許可されたサーバーにしか届きません（通信は未検証）"
 },
 {
  "id": "fastapi",
  "name": "FastAPI",
  "field": "Web開発",
  "desc": "型ヒントを活用して高速なWeb APIを構築するフレームワーク。",
  "usage": "Web APIサーバーの開発に使う。サーバー側で動かすものでブラウザ内実行の対象ではない。",
  "install": "python -m pip install fastapi",
  "browser": "通常環境向け",
  "official": "https://fastapi.tiangolo.com/",
  "browserNote": "サーバーを起動する用途のため、ブラウザ内では使いません"
 },
 {
  "id": "pytest",
  "name": "pytest",
  "field": "自動テスト",
  "desc": "テストを簡潔に書けて強力な自動テストフレームワーク。",
  "usage": "単体テストや回帰テストの実行に使う。",
  "install": "python -m pip install pytest",
  "browser": "import で利用可",
  "official": "https://docs.pytest.org/",
  "browserNote": "Pyodide 同梱 8.1.1。import は確認済み。通常は PC のターミナルで pytest コマンドとして使います"
 },
 {
  "id": "ruff",
  "name": "Ruff",
  "field": "コード品質",
  "desc": "Rust製の高速なリンター／フォーマッター。",
  "usage": "コードの静的チェックと整形に使う。コマンドラインツールでありブラウザ内Pythonで使うものではない。",
  "install": "python -m pip install ruff",
  "browser": "通常環境向け",
  "official": "https://docs.astral.sh/ruff/",
  "browserNote": "コマンドラインツール"
 },
 {
  "id": "mypy",
  "name": "mypy",
  "field": "型チェック",
  "desc": "型ヒントに基づく静的型チェッカー。",
  "usage": "型の不整合を実行前に検出するために使う。開発支援ツールでありブラウザ内実行の対象ではない。",
  "install": "python -m pip install mypy",
  "browser": "通常環境向け",
  "official": "https://mypy-lang.org/",
  "browserNote": "コマンドラインツール"
 }
];

export const ENV_LESSONS = [
 {
  "id": "python-and-cpython",
  "title": "PythonとCPython",
  "body": "Pythonとは、読みやすさを重視した汎用プログラミング言語の仕様と、その標準実装であるCPythonを中心としたエコシステム全体を指す言葉です。公式サイトで配布されているPythonはCPythonであり、書いたコードをインタプリタが読み取りながら実行します。実装には他にもPyPyなどがありますが、学習や実務の標準はCPythonです。バージョンごとに文法や標準ライブラリが少しずつ拡張されるため、自分が使うPythonのバージョンを把握しておくことが、ドキュメントを読む際の前提になります。まずはpython --versionで確認する習慣を付けましょう。",
  "points": [
   "Pythonは言語仕様、CPythonはその標準実装",
   "公式配布物はCPythonである",
   "使うバージョンを常に確認する"
  ],
  "official": "https://docs.python.org/ja/3.12/"
 },
 {
  "id": "versions",
  "title": "Pythonのバージョン",
  "body": "Pythonは現在3系が主流であり、3.13〜3.15のように細かくバージョンが上がっていきます。マイナーバージョンが上がると新しい文法や機能が追加され、古い書き方が非推奨になることもあります。一方で、ライブラリによっては最新バージョンへの対応が遅れる場合があるため、実務では安定したバージョンを選ぶことも重要です。また、各バージョンにはサポート期限があり、期限を過ぎた版はセキュリティ修正を受けられません。プロジェクトでは使うバージョンを明示し、チームで揃えることがトラブル防止につながります。新機能を追うことと、安定性を取ることのバランスを考えて選びましょう。",
  "points": [
   "現行はPython 3系が主流",
   "ライブラリ対応と安定性で版を選ぶ",
   "サポート期限を意識する"
  ],
  "official": "https://devguide.python.org/versions/"
 },
 {
  "id": "install-and-path",
  "title": "インストールとPATH",
  "body": "PythonをPCにインストールする際は、公式サイトのインストーラを使うのが基本です。Windowsではインストール時にPATHへ追加する設定を有効にしないと、ターミナルからpythonコマンドが見つからず起動できません。PATHとは、コマンド名から実行ファイルの場所を探すための仕組みで、OSが管理する検索リストのようなものです。インストール後はターミナルでpython --versionと表示されるか必ず確認してください。表示されない場合は、インストール先やPATH設定を見直します。macOSやLinuxではOS付属のPythonと自分で入れたPythonが混在することがあるため、どのPythonが起動しているかをwhich（Windowsでは where）で確認する習慣が大切です。",
  "points": [
   "公式インストーラを使う",
   "PATH追加を忘れない",
   "導入後にバージョン表示で確認する"
  ],
  "official": "https://docs.python.org/ja/3.12/using/index.html"
 },
 {
  "id": "terminal-and-repl",
  "title": "ターミナルとREPL",
  "body": "ターミナルは文字でコンピュータに命令を出す窓口であり、Pythonの実行やツールの操作はここから行います。引数なしでpythonと入力するとREPLと呼ばれる対話モードが始まり、式を入力するとすぐに結果が表示されます。短いコードの実験や関数の動きの確認にはREPLが最適で、学習の初期段階では特に活用する価値があります。一方、まとまった処理はファイルに保存して実行するのが基本であり、履歴も残ります。REPLを終了するにはexit()またはショートカットキーを使います。ターミナル操作に慣れることは、仮想環境やパッケージ管理など、この先のすべての作業の土台になります。",
  "points": [
   "ターミナルは命令の窓口",
   "REPLは短い実験に最適",
   "本格的な処理はファイルに保存して実行"
  ],
  "official": "https://docs.python.org/ja/3.12/tutorial/interpreter.html"
 },
 {
  "id": "vscode-and-jupyter",
  "title": "VS CodeとJupyter",
  "body": "VS Codeはマイクロソフト製の軽量なコードエディタで、Python拡張機能を入れることで補完、実行、デバッグまでを1つの画面で行えます。大規模なプログラムや複数ファイルの開発に向いています。一方、Jupyter Notebookはコードと説明文と実行結果を1つの文書にまとめられる環境で、データ分析や試行錯誤、学習記録に適しています。どちらが優れているかではなく、目的による使い分けが大切です。アプリの開発はVS Code、データの探索や実験はJupyterという組み合わせが一般的です。本アプリのNotebookモードは、このJupyterの考え方をブラウザで再現したものです。",
  "points": [
   "VS Codeは開発全般に強い",
   "Jupyterは実験と記録に強い",
   "目的で使い分ける"
  ],
  "official": "https://code.visualstudio.com/docs/python/python-tutorial"
 },
 {
  "id": "venv",
  "title": "仮想環境（venv）",
  "body": "仮想環境とは、プロジェクトごとに独立したPython実行環境を作る仕組みで、標準搭載のvenvで作成できます。仮想環境を使うと、プロジェクトAで入れたライブラリの更新がプロジェクトBを壊すといった事故を防げます。有効化すると、その環境専用のPythonとpipが使われるようになります。実務ではプロジェクトごとに必ず仮想環境を作ることが事実上の標準です。作成はpython -m venv .venv、有効化はOSごとにコマンドが異なり、macOS・Linuxでは source .venv/bin/activate、Windows の PowerShell では .venv\\Scripts\\Activate.ps1（実行ポリシーで拒否された場合は Set-ExecutionPolicy -Scope CurrentUser RemoteSigned を確認）、コマンドプロンプトでは .venv\\Scripts\\activate.bat です。無効化は deactivate です。有効化を忘れるとシステム側の環境にインストールしてしまうため、作業開始時にプロンプトの表示で有効化状態を確認する習慣を付けましょう。",
  "points": [
   "プロジェクトごとに環境を分離する",
   "作成は python -m venv .venv",
   "有効化の確認を習慣にする"
  ],
  "official": "https://docs.python.org/ja/3.12/library/venv.html"
 },
 {
  "id": "pip-and-pypi",
  "title": "pipとPyPI",
  "body": "pipはPythonのパッケージをインストールする標準ツールであり、PyPIはパッケージが公開されている公式の配布サイトです。python -m pip install パッケージ名と実行すると、PyPIから取得して現在の環境へ導入されます。python -m pipという書き方が推奨されるのは、意図したPython環境に対応するpipを確実に使うためです。インストール時は名前の綴りに注意してください。似た名前の悪意あるパッケージが公開される事例もあり、公式ドキュメントで正しい名前を確認することが安全につながります。導入済みの一覧はpip listやpip freezeで確認できます。",
  "points": [
   "pipは導入ツール、PyPIは配布サイト",
   "python -m pip の形が確実",
   "パッケージ名は公式情報で確認する"
  ],
  "official": "https://pip.pypa.io/en/stable/"
 },
 {
  "id": "uv",
  "title": "高速な管理ツール uv",
  "body": "uvはRustで書かれた高速なPythonパッケージ・プロジェクト管理ツールで、近年注目を集めています。仮想環境の作成、パッケージのインストール、バージョン解決などを従来のpipやvenvより大幅に高速に行えることが特徴です。仮想環境は uv venv、パッケージの導入は uv pip install パッケージ名 で行え、pip互換の使い方もできるため、既存の知識を活かしながら移行しやすい設計になっています。チーム開発ではプロジェクトの依存関係や使うPythonの版をuvがまとめて管理してくれる場面も増えています。ただし比較的新しいツールであるため、職場や教材がpip前提の場合はまずpipとvenvを正しく理解し、その上でuvを効率化の手段として学ぶ順序が安全です。",
  "points": [
   "uvは高速な統合管理ツール",
   "pip互換の使い方も可能",
   "基礎はpipとvenvを先に理解する"
  ],
  "official": "https://docs.astral.sh/uv/"
 },
 {
  "id": "conda",
  "title": "conda（Anaconda／Miniforge）",
  "body": "condaはPython本体とライブラリをまとめて管理できるパッケージ・環境管理ツールで、Anaconda や Miniforge（conda-forge を既定にした軽量版）で導入します。conda create -n 名前 python=3.12 で環境を作り、conda activate 名前 で切り替えます。NumPyやSciPyのようにC言語などで書かれた部分を含むライブラリを、OSに合わせたビルド済みの形で入れやすいのが特徴で、科学技術計算の分野で広く使われてきました。pipとvenvの組み合わせと役割が重なるため、1つの環境の中で conda と pip を無秩序に混ぜるとどちらが何を入れたか分からなくなり、依存関係が壊れる原因になります。使う場合は、まず conda で入れられるものを入れ、足りないものだけを pip で補う順序にします。なお Anaconda の配布物には組織の規模によって有償となる利用条件があるため、業務では利用規約を確認してください。",
  "points": [
   "Python本体ごと環境を管理できる",
   "conda と pip を無秩序に混ぜない",
   "業務利用では配布元の利用条件を確認する"
  ],
  "official": "https://docs.conda.io/"
 },
 {
  "id": "browser-python",
  "title": "このアプリのPython（Pyodide）と通常のPythonの違い",
  "body": "このアプリはPyodide 0.26.4（CPython 3.12.1 をWebAssemblyに移植したもの）をブラウザ内で動かしています。言語仕様と標準ライブラリのほとんどは通常のPythonと同じですが、次の点が異なります。①外部ライブラリは pip ではなく、Pyodide 同梱のもの（NumPy・pandas・Matplotlib など）を import すると自動で読み込み、同梱されていない純Pythonのライブラリは import micropip; await micropip.install(\"名前\") で追加します。②ファイルはブラウザ内の仮想ファイルシステムに保存され、PCのフォルダには書き込みません。③subprocess・ソケット通信・スレッドの多くは使えず、Webへの通信はブラウザの制約（CORS）を受けます。④32bit環境のため、巨大なリストなどは通常版より早く限界に達します。⑤input() は実行前に「標準入力」欄へ書いた行を順に読みます。ここで動いたコードは通常のPythonでも基本的にそのまま動きますが、PCで使うときは pip でライブラリを入れる必要があります。",
  "points": [
   "中身は CPython 3.12 の移植版",
   "同梱ライブラリは import で自動読込、それ以外は micropip",
   "ファイルとネットワークにブラウザ由来の制約がある"
  ],
  "official": "https://pyodide.org/en/0.26.4/usage/wasm-constraints.html"
 },
 {
  "id": "requirements-and-pyproject",
  "title": "requirements.txtとpyproject.toml",
  "body": "requirements.txtは、プロジェクトが必要とするパッケージとそのバージョンを1行ずつ列挙したファイルで、pip install -r requirements.txtでまとめて再現できます。一方、pyproject.tomlはプロジェクト自体の情報や依存関係、ツールの設定をまとめる現在の標準的な設定ファイルです。自作パッケージの配布や本格的な開発ではpyproject.tomlが中心になります。どちらを使う場合でも、バージョンを記録しておくことが環境の再現性を保つ鍵です。他の人が同じ環境を再構築できる状態にしておくことは、実務における基本的な配慮と言えます。",
  "points": [
   "requirements.txtは依存の一覧",
   "pyproject.tomlは現在の標準設定ファイル",
   "バージョン記録が再現性を保つ"
  ],
  "official": "https://packaging.python.org/ja/latest/guides/writing-pyproject-toml/"
 },
 {
  "id": "git-integration",
  "title": "Git・GitHubとの連携",
  "body": "Gitはプログラムの変更履歴を管理する仕組みで、GitHubはその履歴をオンラインで共有するサービスです。コードをGitで管理すると、いつ、誰が、何を変えたかが分かり、問題が起きたときに以前の状態へ戻すこともできます。Pythonプロジェクトでは、ソースコードや依存関係の記録ファイルはGitで管理し、仮想環境そのものや大きなデータファイルは管理対象から外すのが一般的です。その指定には.gitignoreファイルを使います。学習段階からコミットを小まめに残す習慣を付けると、実験的な変更も安心して試せるようになります。公開範囲の設定にも注意し、認証情報をコードに含めないことが重要です。",
  "points": [
   "変更履歴をGitで管理する",
   "仮想環境は管理対象から外す",
   "認証情報をコードに含めない"
  ],
  "official": "https://docs.github.com/ja/get-started"
 }
];
