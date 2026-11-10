// Study templates: explanation + runnable code. Explanation text auto-links glossary terms in the UI.
export const TEMPLATES = [
  {
    id: 'tpl-calc', title: '変数と計算', level: '入門', file: 'tpl_calc.py',
    code: 'price = 120\ncount = 3\ntotal = price * count\ntax = total * 0.1\nprint(f"小計: {total}円")\nprint(f"税込: {int(total + tax)}円")',
    expected: '小計: 360円\n税込: 396円',
    explain: '変数に数値を代入し、計算結果を別の変数に保存する基本形です。f文字列（f"...{変数}..."）で値を文章に埋め込みます。price や count の値を変えて実行し、出力がどう変わるか確認してください。int() は型を整数に変換する関数です。'
  },
  {
    id: 'tpl-branch', title: '条件分岐（if / elif / else）', level: '入門', file: 'tpl_branch.py',
    code: 'score = 72\nif score >= 80:\n    grade = "A"\nelif score >= 60:\n    grade = "B"\nelse:\n    grade = "C"\nprint(f"{score}点は {grade} 判定です")',
    expected: '72点は B 判定です',
    explain: '条件分岐は上から順に条件を評価し、最初に成り立ったブロックだけを実行します。ブロックの範囲はインデント（字下げ）で表すのがPythonの決まりです。score を 85 や 40 に変えて、判定が切り替わる境界を確認してください。文字列の比較や and / or との組み合わせも試せます。'
  },
  {
    id: 'tpl-list-loop', title: 'リストとループ', level: '入門', file: 'tpl_list_loop.py',
    code: 'nums = [4, 8, 15, 16, 23, 42]\ntotal = 0\nfor n in nums:\n    total += n\nprint("合計:", total)\nprint("最大:", max(nums))\nprint("2倍:", [n * 2 for n in nums])',
    expected: '合計: 108\n最大: 42\n2倍: [8, 16, 30, 32, 46, 84]',
    explain: 'リストの要素を for ループで1つずつ取り出し、変数に累計していく書き方です。最後の行は内包表記といい、リストから新しいリストを1行で作れます。nums の中身を変えたり、偶数だけを集める条件（if n % 2 == 0）を内包表記に足したりして実験してください。'
  },
  {
    id: 'tpl-dict-count', title: '辞書で数える', level: '基礎', file: 'tpl_dict_count.py',
    code: 'text = "tea coffee tea juice tea coffee"\ncounts = {}\nfor word in text.split():\n    counts[word] = counts.get(word, 0) + 1\nfor word, c in counts.items():\n    print(word, c)',
    expected: 'tea 3\ncoffee 2\njuice 1',
    explain: '辞書は「キーと値の対応表」で、単語のような重複するものを数えるのに向いています。get(キー, 初期値) は、キーがまだ無いときに初期値を返すので、初めて出た単語でもエラーになりません。text の文章を自分の好きな文に変えて、出現回数を数えてみてください。'
  },
  {
    id: 'tpl-func', title: '関数の定義と引数', level: '基礎', file: 'tpl_func.py',
    code: 'def price_with_tax(price, rate=0.1):\n    return int(price * (1 + rate))\n\nprint(price_with_tax(1000))\nprint(price_with_tax(1000, rate=0.08))',
    expected: '1100\n1080',
    explain: '関数は処理に名前を付けて再利用できるようにしたものです。引数の rate=0.1 はデフォルト引数で、省略すると 0.1 が使われます。return で戻り値を呼び出し元に返します。税率を変える、3つ目の引数を足すなど、関数の形を変えて実験してください。'
  },
  {
    id: 'tpl-strings', title: '文字列の加工', level: '基礎', file: 'tpl_strings.py',
    code: 'name = "  Yuya Kohno  "\nprint(name.strip())\nparts = "2026-11-10".split("-")\nprint(parts)\nprint("/".join(parts))\nprint("Python".replace("Py", "My"))',
    expected: 'Yuya Kohno\n[\'2026\', \'11\', \'10\']\n2026/11/10\nMython',
    explain: '文字列のメソッドで、空白の除去（strip）、分割（split）、結合（join）、置換（replace）ができます。split の結果はリストになります。文字列はイミュータブル（変更不可能）なので、メソッドは元の文字列を書き換えず、新しい文字列を戻り値として返します。'
  },
  {
    id: 'tpl-try', title: '例外処理（try / except）', level: '基礎', file: 'tpl_try.py',
    code: 'def divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return "ゼロでは割れません"\n\nprint(divide(10, 2))\nprint(divide(10, 0))',
    expected: '5.0\nゼロでは割れません',
    explain: '例外は、実行中に起きるエラーを「投げる」仕組みです。try の中で例外が起きると、except のブロックに処理が移り、プログラム全体は止まりません。except に捕まえる例外の種類を指定するのが基本です。b に文字列を渡すとどうなるか（TypeError は捕まえられません）も確認してください。'
  },
  {
    id: 'tpl-class', title: 'クラスとインスタンス', level: '応用', file: 'tpl_class.py',
    code: 'class Counter:\n    def __init__(self):\n        self.value = 0\n    def inc(self):\n        self.value += 1\n        return self.value\n\nc = Counter()\nprint(c.inc())\nprint(c.inc())\nprint(c.inc())',
    expected: '1\n2\n3',
    explain: 'クラスは「データと振る舞い」をひとまとめにした設計図で、そこから作った実物がインスタンスです。__init__ は生成時に呼ばれる初期化メソッドで、self はインスタンス自身を指します。Counter をもう1つ作ると別々に数えられることや、dec() メソッドを足す実験をしてみてください。'
  },
  {
    id: 'tpl-fileio', title: 'ファイルの読み書き', level: '応用', file: 'tpl_fileio.py',
    code: 'with open("study_memo.txt", "w", encoding="utf-8") as f:\n    f.write("一行目\\n二行目\\n")\n\nwith open("study_memo.txt", encoding="utf-8") as f:\n    lines = f.read().splitlines()\nprint(len(lines), "行")\nprint(lines[0])',
    expected: '2 行\n一行目',
    explain: 'with 文（コンテキストマネージャ）でファイルを開くと、ブロックを抜けるときに自動で閉じられます。このアプリではブラウザ内の仮想ファイルシステムに書かれるので、左のファイル一覧に study_memo.txt が増えるのも確認できます。書き込む文章を変えて、読み戻した結果と比べてください。'
  },
  {
    id: 'tpl-csv', title: 'CSVの集計', level: '応用', file: 'tpl_csv.py',
    code: 'import csv, io\n\ndata = "month,sales\\n1,120\\n2,150\\n3,90\\n"\ntotal = 0\nfor row in csv.DictReader(io.StringIO(data)):\n    total += int(row["sales"])\nprint("売上合計:", total)',
    expected: '売上合計: 360',
    explain: 'csv モジュールはCSV形式を辞書の並びとして読めます。DictReader は1行を「列名: 値」の辞書にするので、row["sales"] のように列名で取り出せます。値は文字列なので、計算には int() での型変換が必要です。data の数値を変えたり、行を足したりして合計の変化を確認してください。'
  }
];
