export const GLOSSARY = [
 {
  "id": "variable",
  "ja": "変数",
  "en": "variable",
  "importance": "最重要",
  "def": "値（オブジェクト）に名前を付けて参照できるようにしたもの。Pythonの変数は値そのものの入れ物ではなく、オブジェクトへの参照に名前を付けたものである。",
  "easy": "データに『名前の付いた付箋』を貼るイメージ。付箋を貼り替えると別のデータを指すようになる。",
  "example": "x = 10",
  "misconception": "変数の中に値が直接入っていると思いがちだが、実際はオブジェクトへの参照であるため、リストの代入では共有が起きる。",
  "related": [
   "object",
   "scope",
   "mutable"
  ]
 },
 {
  "id": "object",
  "ja": "オブジェクト",
  "en": "object",
  "importance": "最重要",
  "def": "Pythonで扱うすべてのデータの実体。型を持ち、値と操作（メソッド）を持つ。整数も文字列も関数もすべてオブジェクトである。",
  "easy": "プログラムが扱う『もの』そのもの。数字も文字も全部オブジェクト。",
  "example": null,
  "misconception": "関数やクラスはデータではないと思いがちだが、Pythonではそれらもオブジェクトであり変数に代入できる。",
  "related": [
   "type",
   "class",
   "variable"
  ]
 },
 {
  "id": "type",
  "ja": "型",
  "en": "type",
  "importance": "最重要",
  "def": "オブジェクトの種類を表す分類。型によって保持できる値と可能な操作が決まる。int、str、listなどが代表的な型である。",
  "easy": "データの『種類ラベル』。種類が違うとできる操作が違う。",
  "example": "type(10)  # <class 'int'>",
  "misconception": "数値の 10 と文字列の \"10\" は同じだと思いがちだが、型が異なるため演算結果が変わる。",
  "related": [
   "object",
   "type-hint",
   "string"
  ]
 },
 {
  "id": "string",
  "ja": "文字列",
  "en": "string",
  "importance": "最重要",
  "def": "文字の並びを表すイミュータブルな型（str）。引用符で囲んで表し、インデックスやスライスで部分を取り出せる。",
  "easy": "文字の列。文章や名前などを表すときに使う。",
  "example": "s = \"Python\"  # s[0] は 'P'",
  "misconception": "文字列は変更できると思われがちだが、str はイミュータブルで、変更には新しい文字列を作る。",
  "related": [
   "type",
   "mutable",
   "list"
  ]
 },
 {
  "id": "list",
  "ja": "リスト",
  "en": "list",
  "importance": "最重要",
  "def": "順序付きで変更可能な要素の集まりを表す型。角括弧 [] で表し、異なる型の要素を混在させることもできる。",
  "easy": "順番の付いた買い物リストのようなもの。あとから追加や削除ができる。",
  "example": "nums = [1, 2, 3]",
  "misconception": "リストのコピーは nums[:] や copy() でも浅いコピーであり、入れ子のリストは共有される。",
  "related": [
   "tuple",
   "dict",
   "mutable",
   "iterator"
  ]
 },
 {
  "id": "dict",
  "ja": "辞書",
  "en": "dictionary",
  "importance": "最重要",
  "def": "キーと値の対応を保持する型。波括弧 {} でキー: 値の形で表し、キーで高速に値を引ける。",
  "easy": "単語と意味がペアになった本物の辞書のようなもの。キーで値を探す。",
  "example": "user = {\"name\": \"タロウ\", \"age\": 20}",
  "misconception": "辞書は順序がないと思われがちだが、Python 3.7以降は挿入順が保持されることが言語仕様で保証されている。",
  "related": [
   "list",
   "set",
   "mutable"
  ]
 },
 {
  "id": "tuple",
  "ja": "タプル",
  "en": "tuple",
  "importance": "重要",
  "def": "順序付きで変更不可能な要素の集まりを表す型。カンマで区切って作り、通常は丸括弧 () で囲んで表す。",
  "easy": "中身を変えられないリスト。決まった組み合わせを安全に渡すときに使う。",
  "example": "point = (3, 5)",
  "misconception": "要素1つのタプルは (1) では作れず、(1,) とカンマが必要な点がよく誤解される。",
  "related": [
   "list",
   "mutable",
   "set"
  ]
 },
 {
  "id": "set",
  "ja": "集合（セット）",
  "en": "set",
  "importance": "重要",
  "def": "重複する要素を持たない、順序の保証されない要素の集まりを表す型。和集合や積集合などの集合演算ができる。",
  "easy": "同じものを2つ入れない袋。重複を取り除くときに便利。",
  "example": "set([1, 2, 2, 3])  # {1, 2, 3}",
  "misconception": "空の集合は {} では作れない（空の辞書になる）。set() を使う。",
  "related": [
   "dict",
   "list",
   "mutable"
  ]
 },
 {
  "id": "function",
  "ja": "関数",
  "en": "function",
  "importance": "最重要",
  "def": "処理をひとまとめにし、名前を付けて再利用できるようにしたもの。def で定義し、引数を受け取り戻り値を返せる。",
  "easy": "材料を入れると料理が出てくる機械のようなもの。何度も使い回せる。",
  "example": "def add(a, b):\n    return a + b",
  "misconception": "print と return は同じだと思われがちだが、表示は画面に出すだけで、値を呼び出し元へ返すのは return である。",
  "related": [
   "argument",
   "return-value",
   "scope"
  ]
 },
 {
  "id": "argument",
  "ja": "引数",
  "en": "argument / parameter",
  "importance": "最重要",
  "def": "関数を定義する側で受け取る名前を仮引数、呼び出し時に渡す実際の値を実引数と呼ぶ。文脈上まとめて引数と呼ぶことが多い。",
  "easy": "関数の機械に渡す『材料』。渡す材料によって結果が変わる。",
  "example": "add(2, 3)  # 2 と 3 が実引数",
  "misconception": "引数にリストなど変更可能なオブジェクトを渡すと、関数内の変更が呼び出し側にも影響する場合がある。",
  "related": [
   "function",
   "return-value",
   "mutable"
  ]
 },
 {
  "id": "return-value",
  "ja": "戻り値",
  "en": "return value",
  "importance": "最重要",
  "def": "関数が処理を終えて呼び出し元へ返す値。return 文で指定し、指定しなければ None が返る。",
  "easy": "機械から出てくる『出来上がった料理』。受け取って次の処理に使える。",
  "example": "result = add(2, 3)  # result は 5",
  "misconception": "return が無い関数はエラーになると思われがちだが、実際は None を返す仕様である。",
  "related": [
   "function",
   "argument"
  ]
 },
 {
  "id": "scope",
  "ja": "スコープ",
  "en": "scope",
  "importance": "重要",
  "def": "変数（名前）が有効な範囲。関数の中で作った変数は原則その関数の中（ローカル）でのみ有効である。",
  "easy": "名前が通用する『担当エリア』。エリアの外からは見えない。",
  "example": null,
  "misconception": "関数の中で外側の変数に代入すると、代入した時点でその関数内のローカル変数として扱われ、読み取りすらエラーになる場合がある。",
  "related": [
   "variable",
   "function",
   "module"
  ]
 },
 {
  "id": "module",
  "ja": "モジュール",
  "en": "module",
  "importance": "最重要",
  "def": "Pythonのコードを書いたファイル（.py）1つに対応する単位。import することで他のファイルから機能を利用できる。",
  "easy": "機能ごとに分かれた『部品ファイル』。必要なときに読み込んで使う。",
  "example": "import math",
  "misconception": "モジュールとパッケージは混同されがちだが、パッケージはモジュールをまとめたディレクトリである。",
  "related": [
   "package",
   "pip",
   "function"
  ]
 },
 {
  "id": "package",
  "ja": "パッケージ",
  "en": "package",
  "importance": "重要",
  "def": "複数のモジュールを階層的にまとめたディレクトリ、または配布単位としてのライブラリの総称。文脈により意味が異なるため注意が要る。",
  "easy": "部品ファイルを整理して入れた『箱』や、配布される『ソフトの包み』。",
  "example": "import pandas",
  "misconception": "Python標準の用語ではパッケージは __init__.py を持つ（名前空間パッケージを除く）ディレクトリを指し、配布物は正確にはディストリビューションと呼ばれる。",
  "related": [
   "module",
   "pip",
   "virtualenv"
  ]
 },
 {
  "id": "class",
  "ja": "クラス",
  "en": "class",
  "importance": "重要",
  "def": "オブジェクトの設計図を定義する仕組み。属性（データ）とメソッド（操作）をまとめ、インスタンスを生成する元になる。",
  "easy": "たい焼きの『金型』。金型から同じ形のたい焼き（インスタンス）を何個も作れる。",
  "example": "class Dog:\n    pass",
  "misconception": "クラスとインスタンスは同じものと思われがちだが、クラスは設計図、インスタンスは実体である。",
  "related": [
   "instance",
   "inheritance",
   "object"
  ]
 },
 {
  "id": "instance",
  "ja": "インスタンス",
  "en": "instance",
  "importance": "重要",
  "def": "クラスから生成された具体的なオブジェクト。クラスに定義された属性とメソッドを持ち、個別の状態を保持する。",
  "easy": "金型から作られた『たい焼きそのもの』。1つ1つ中身（状態）が違ってよい。",
  "example": "dog = Dog()",
  "misconception": "インスタンスごとに状態は独立するが、変更可能なクラス属性を共有すると全インスタンスに影響する場合がある。",
  "related": [
   "class",
   "object",
   "inheritance"
  ]
 },
 {
  "id": "inheritance",
  "ja": "継承",
  "en": "inheritance",
  "importance": "重要",
  "def": "既存のクラス（親）を受け継いで新しいクラス（子）を定義する仕組み。共通部分を再利用しつつ、差分を追加・上書きできる。",
  "easy": "親の特徴を引き継いで、自分の特徴を足すこと。",
  "example": "class Puppy(Dog):\n    pass",
  "misconception": "継承は多用すればよいものではなく、is-a関係が成り立たない場合は継承より合成（委譲）が適することが多い。",
  "related": [
   "class",
   "instance",
   "object"
  ]
 },
 {
  "id": "exception",
  "ja": "例外",
  "en": "exception",
  "importance": "最重要",
  "def": "実行中に起きた異常な事態をプログラムに通知する仕組みと、その際に発生するオブジェクト。try/except で捕捉して処理できる。",
  "easy": "エラーが起きたときに飛んでくる『非常ベル』。受け止めればプログラムを続けられる。",
  "example": "try:\n    int(\"abc\")\nexcept ValueError:\n    print(\"変換できません\")",
  "misconception": "例外はすべて捕捉すべきと思われがちだが、裸の except で握り潰すと不具合の原因が隠れてしまう。",
  "related": [
   "debug",
   "function",
   "context-manager"
  ]
 },
 {
  "id": "iterator",
  "ja": "イテレータ",
  "en": "iterator",
  "importance": "応用",
  "def": "要素を1つずつ順に取り出せるオブジェクト。__next__ を持ち、for ループは内部でイテレータを使っている。",
  "easy": "本のしおりのように『次はどこか』を覚えていて、1つずつ進めるもの。",
  "example": null,
  "misconception": "イテレータは一度読み切ると元に戻らない。リストはイテレータではなく、iter() でイテレータを取り出す。",
  "related": [
   "generator",
   "list"
  ]
 },
 {
  "id": "generator",
  "ja": "ジェネレータ",
  "en": "generator",
  "importance": "応用",
  "def": "yield を使って値を1つずつ生成する関数、またはそれが返すイテレータ。必要なときに計算するためメモリ効率がよい。",
  "easy": "必要な分だけその場で作る『オンデマンド工場』。全部を一気に作らない。",
  "example": "def count():\n    yield 1\n    yield 2",
  "misconception": "リストを返す関数と同じだと思われがちだが、ジェネレータは値を遅延生成し、巨大なデータでもメモリを圧迫しない。",
  "related": [
   "iterator",
   "function",
   "return-value"
  ]
 },
 {
  "id": "decorator",
  "ja": "デコレータ",
  "en": "decorator",
  "importance": "応用",
  "def": "関数（やクラス）を受け取り、機能を追加・変更した新しい関数を返す関数の使い方。@名前 の形で適用する。",
  "easy": "関数に『ラッピング（包装）』をして機能を足す仕組み。",
  "example": "@my_decorator\ndef greet():\n    pass",
  "misconception": "デコレータは特別な構文専用の何かと思われがちだが、本質は関数を受け取って関数を返す通常の高階関数である。",
  "related": [
   "function",
   "argument"
  ]
 },
 {
  "id": "context-manager",
  "ja": "コンテキストマネージャ",
  "en": "context manager",
  "importance": "重要",
  "def": "with 文で使える、開始時と終了時の処理（資源の確保と解放）を規定するオブジェクト。__enter__ と __exit__ を持つ。",
  "easy": "使い終わったら自動で後片付けしてくれる仕組み。ファイルの閉じ忘れを防ぐ。",
  "example": "with open(\"a.txt\") as f:\n    data = f.read()",
  "misconception": "with はファイル専用と思われがちだが、ロックやデータベース接続など後始末が必要な対象全般に使える。",
  "related": [
   "exception",
   "class",
   "function"
  ]
 },
 {
  "id": "async",
  "ja": "非同期処理",
  "en": "asynchronous programming",
  "importance": "応用",
  "def": "時間のかかる処理（通信や入出力）の完了を待つ間に、別の処理を進める実行方式。Pythonでは async/await と asyncio を使う。",
  "easy": "注文して待つ間に他の仕事をする進め方。1つの作業に張り付かない。",
  "example": "async def fetch():\n    await something()",
  "misconception": "非同期は並列実行（複数CPUでの同時実行）とは異なる。主にI/O待ちの有効活用が目的で、計算自体は速くならない。",
  "related": [
   "function",
   "exception"
  ]
 },
 {
  "id": "virtualenv",
  "ja": "仮想環境",
  "en": "virtual environment",
  "importance": "最重要",
  "def": "プロジェクトごとにPython本体やインストール済みパッケージを分離する仕組み。venv などで作成する。",
  "easy": "プロジェクト専用の『作業部屋』。他の部屋の道具と混ざらない。",
  "example": "python -m venv .venv",
  "misconception": "仮想環境はPython本体を複製するものと思われがちだが、実体は元のPythonへの参照（OSによってはリンクや小さな起動用ファイル）と、専用のパッケージ置き場の組み合わせである。",
  "related": [
   "pip",
   "package",
   "module"
  ]
 },
 {
  "id": "pip",
  "ja": "pip",
  "en": "pip",
  "importance": "最重要",
  "def": "PythonのパッケージをPyPIからインストール・管理する標準ツール。python -m pip の形で使うことが推奨される。",
  "easy": "パッケージを取り寄せる『注文係』。",
  "example": "python -m pip install pandas",
  "misconception": "pip コマンドと python -m pip は同じ環境を指すとは限らない。後者は実行したPythonに対応するpipが確実に使える。",
  "related": [
   "virtualenv",
   "package",
   "library"
  ]
 },
 {
  "id": "api",
  "ja": "API",
  "en": "API (Application Programming Interface)",
  "importance": "重要",
  "def": "プログラム同士が機能やデータをやり取りするための取り決め（窓口）。関数の呼び出し規約やWeb APIのエンドポイントなどを指す。",
  "easy": "決められた『注文方法』。その通りに頼めば決まったものが返ってくる。",
  "example": null,
  "misconception": "APIはWeb APIだけを指すと思われがちだが、ライブラリの関数仕様自体もAPIである。",
  "related": [
   "module",
   "package",
   "test"
  ]
 },
 {
  "id": "test",
  "ja": "テスト",
  "en": "test",
  "importance": "重要",
  "def": "プログラムが期待通りに動くかを検証する作業、およびそのためのコード。pytest などのフレームワークで自動化できる。",
  "easy": "作ったものが正しく動くかの『検品作業』。自動化すると繰り返し確認できる。",
  "example": "def test_add():\n    assert add(2, 3) == 5",
  "misconception": "テストは一度書けば十分と思われがちだが、仕様変更に合わせて更新し続けることで回帰（再発）を防ぐ。",
  "related": [
   "debug",
   "function",
   "api"
  ]
 },
 {
  "id": "debug",
  "ja": "デバッグ",
  "en": "debugging",
  "importance": "重要",
  "def": "プログラムの不具合（バグ）の原因を特定し修正する作業。エラーメッセージの読解、変数の確認、ステップ実行などが手段になる。",
  "easy": "不具合の『探偵仕事』。手がかりを集めて原因を絞り込む。",
  "example": null,
  "misconception": "print で値を出す方法は原始的だと侮られがちだが、変数の変化を追う基本手段として今も有効である。",
  "related": [
   "test",
   "exception",
   "variable"
  ]
 },
 {
  "id": "type-hint",
  "ja": "型ヒント",
  "en": "type hint",
  "importance": "重要",
  "def": "変数や関数の引数・戻り値に期待する型を注釈として書く仕組み。実行時の強制力はなく、静的解析ツール等が利用する。",
  "easy": "あとから読む人への『これは数値のつもりだよ』というメモ。",
  "example": "def add(a: int, b: int) -> int:\n    return a + b",
  "misconception": "型ヒントを書くと実行時に型チェックされると思われがちだが、通常の実行では強制されず、間違った型を渡してもその場ではエラーにならない。",
  "related": [
   "type",
   "function",
   "argument"
  ]
 },
 {
  "id": "algorithm",
  "ja": "アルゴリズム",
  "en": "algorithm",
  "importance": "重要",
  "def": "問題を解くための手順・計算方法。同じ結果でも手順によって処理時間やメモリ使用量（計算量）が大きく変わる。",
  "easy": "料理の『レシピ（手順）』。手順が違うと速さや材料の無駄が変わる。",
  "example": null,
  "misconception": "アルゴリズムは難しい数学専用と思われがちだが、並べ替えや探索など日常的な処理すべてに手順の工夫が存在する。",
  "related": [
   "iterator",
   "function"
  ]
 },
 {
  "id": "mutable",
  "ja": "ミュータブル（変更可能）",
  "en": "mutable",
  "importance": "最重要",
  "def": "作成後に内容を変更できる性質、およびそのような型（list、dict、setなど）。対義語はイミュータブル（変更不可能）で、int、str、tupleなどが該当する。",
  "easy": "あとから中身を書き換えられるノート（リストなど）と、書き換えられない印刷物（文字列など）の違い。",
  "example": "nums = [1, 2]\nnums.append(3)  # 元のリストが変わる",
  "misconception": "イミュータブルな型でも再代入は可能であり、『変更』と『再代入』は別物である点が混同されやすい。",
  "related": [
   "list",
   "string",
   "tuple",
   "variable"
  ]
 },
 {
  "id": "immutable",
  "ja": "イミュータブル（変更不可能）",
  "en": "immutable",
  "importance": "重要",
  "def": "作成後に内容を変更できない性質、およびそのような型（int、str、tuple、frozensetなど）。変更に見える操作は新しいオブジェクトを作る。",
  "easy": "一度印刷したら書き換えられない本。中身を変えたければ新しい本を作る。",
  "example": "s = \"ab\"\ns = s + \"c\"  # 新しい文字列が作られる",
  "misconception": "tuple はイミュータブルでも、要素として持つリストの中身までは固定されない。",
  "related": [
   "mutable",
   "tuple",
   "string"
  ]
 },
 {
  "id": "indentation",
  "ja": "インデント",
  "en": "indentation",
  "importance": "最重要",
  "def": "行頭の空白による字下げ。Pythonではインデントがブロック（処理のまとまり）を表し、構文の一部となる。",
  "easy": "段落の字下げが、そのまま『どのグループか』を決める決まり。",
  "example": "if True:\n    print(\"実行される\")",
  "misconception": "インデントは見た目を整えるだけと思われがちだが、Pythonでは意味そのものを持つ。タブと空白の混在はエラーの原因になる。",
  "related": [
   "function",
   "exception",
   "scope"
  ]
 },
 {
  "id": "library",
  "ja": "ライブラリ",
  "en": "library",
  "importance": "重要",
  "def": "再利用可能なプログラムの集まりの総称。モジュールやパッケージの集合を指し、標準ライブラリと外部ライブラリがある。",
  "easy": "便利な道具が揃った『道具箱』全体のこと。",
  "example": "import math  # 標準ライブラリ",
  "misconception": "ライブラリ、フレームワーク、パッケージは厳密には異なる概念だが、日常会話では混同して使われることが多い。",
  "related": [
   "module",
   "package",
   "pip"
  ]
 }
];
