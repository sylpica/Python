// FINAL-B(独立監査)指摘への教材・テンプレート修正。old文字列が1回だけ存在することを検証してから置換する。
import fs from 'node:fs';
const D = '/home/user/Python/data/';
const loadArr = (file, name) => JSON.parse(fs.readFileSync(D + file, 'utf8').match(new RegExp('export const ' + name + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]);
const by = (a, id) => { const x = a.find(o => o.id === id); if (!x) throw new Error('missing ' + id); return x; };
const fix = (o, f, a, b) => { if ((o[f].split(a).length - 1) !== 1) throw new Error(`fix failed ${o.id}.${f}: ${a}`); o[f] = o[f].replace(a, b); };
const L = loadArr('lessons.js', 'LESSONS');
fix(by(L, 'variables-types'), 'body', '変数名は意味が分かる名前を付け、', '小数（float）は2進数で近似して保存されるため、0.1 + 0.2 は 0.30000000000000004 のようにわずかな誤差を含みます。また、0・空文字列・空のリストなどは条件式で偽（False）として扱われます。変数名は意味が分かる名前を付け、');
fix(by(L, 'operators'), 'body', '論理演算子 and、or、not', 'is は「同じオブジェクトか」、== は「値が等しいか」を調べる演算子で、通常の値の比較には == を使います。論理演算子 and、or、not');
fix(by(L, 'strings'), 'body', 'f文字列を使うと変数を文字列の中に埋め込め、数値も自然に表示できます。', 'f文字列を使うと変数を文字列の中に埋め込め、数値も自然に表示できます。{pi:.2f} のように書式を指定すると、小数点以下の桁数を揃えて表示できます。');
fix(by(L, 'loops'), 'body', '要素とインデックスを同時に使いたい場合はenumerate()、', '要素とインデックスを同時に使いたい場合はenumerate()（enumerate(items, start=1) のように start を指定すると番号を1から始められます）、');
fix(by(L, 'tuple-slice'), 'body', 'スライスで得られるのは常に新しいオブジェクトであり、元の並びは変更されません。', 'スライスは元の並びを変更せず、リストでは新しいリストを返します。代入の左側に * を付けると（first, *rest = [1, 2, 3]）、残りの要素をリストにまとめて受け取れます。');
fix(by(L, 'file-io'), 'body', '（Windowsでは省略時にUTF-8以外になることがあります）', '（Python 3.14 以前では、省略時の文字コードが環境依存で、Windowsなどで UTF-8 以外になることがあります。3.15 から既定が UTF-8 になりますが、どの版でも明示しておけば確実です）');
fs.writeFileSync(D + 'lessons.js', `export const LESSONS = ${JSON.stringify(L, null, 1)};\n`);

const R = loadArr('reference.js', 'REFERENCE');
fix(by(R, 'open'), 'pitfalls', 'encoding を省略すると環境依存になり文字化けの原因になる。', 'Python 3.14 以前では encoding を省略すると環境依存（Windows では UTF-8 以外）になり文字化けの原因になる（3.15 から既定は UTF-8）。常に明示すると確実。');
by(R, 'sorted').syntax = 'sorted(iterable, /, *, key=None, reverse=False)';
fix(by(R, 'sorted'), 'args', 'key: 並べ替え基準', 'key: 並べ替え基準（key と reverse はキーワードで指定する）');
fs.writeFileSync(D + 'reference.js', `export const REFERENCE = ${JSON.stringify(R, null, 1)};\n`);

const src = fs.readFileSync(D + 'extras.js', 'utf8');
const M = JSON.parse(src.match(/export const MISTAKES = (\[[\s\S]*?\n\]);/)[1]), P = JSON.parse(src.match(/export const PACKAGES = (\[[\s\S]*?\n\]);/)[1]), E = JSON.parse(src.match(/export const ENV_LESSONS = (\[[\s\S]*?\n\]);/)[1]);
fix(by(E, 'versions'), 'body', '3.13、3.14のように', '3.13〜3.15のように');
fix(by(E, 'venv'), 'body', '有効化はOSごとにコマンドが異なります。', '有効化はOSごとにコマンドが異なり、macOS・Linuxでは source .venv/bin/activate、Windows の PowerShell では .venv\\Scripts\\Activate.ps1（実行ポリシーで拒否された場合は Set-ExecutionPolicy -Scope CurrentUser RemoteSigned を確認）、コマンドプロンプトでは .venv\\Scripts\\activate.bat です。無効化は deactivate です。');
fix(by(E, 'uv'), 'body', 'pip互換の使い方もできるため', '仮想環境は uv venv、パッケージの導入は uv pip install パッケージ名 で行え、pip互換の使い方もできるため');
fs.writeFileSync(D + 'extras.js', [['MISTAKES', M], ['PACKAGES', P], ['ENV_LESSONS', E]].map(([n, v]) => `export const ${n} = ${JSON.stringify(v, null, 1)};\n`).join('\n'));

const Q = fs.readFileSync(D + 'quizzes.js', 'utf8');
const h = 'for 文で1文字ずつ取り出し、counts[ch] = counts.get(ch, 0) + 1 と数えます（collections.Counter を使っても構いません）';
if (!Q.includes(h)) throw new Error('hint'); 
fs.writeFileSync(D + 'quizzes.js', Q.replace(h, 'for 文で1文字ずつ取り出し、counts[ch] = counts.get(ch, 0) + 1 と数えます。collections.Counter を使う場合は、表示が Counter(...) にならないよう dict(Counter(s)) と変換します'));

const T = fs.readFileSync(D + 'templates.js', 'utf8');
let t2 = T;
const rep = (a, b) => { if ((t2.split(a).length - 1) !== 1) throw new Error('tpl ' + a); t2 = t2.replace(a, b); };
rep('return int(price * (1 + rate))', 'return round(price * (1 + rate))');
rep('税率を変える、3つ目の引数を足すなど、関数の形を変えて実験してください。', '税率を変える、3つ目の引数を足すなど、関数の形を変えて実験してください。金額は小数の誤差（0.1 や 0.15 は2進数で正確に表せません）が出やすいため、ここでは round() で丸めています。int() は切り捨てなので、誤差で1円ずれることがあります。');
rep('print(f"税込: {int(total + tax)}円")', 'print(f"税込: {round(total + tax)}円")');
rep('int() は型を整数に変換する関数です。', 'round() は小数を丸めて整数にする関数です（int() は小数部を切り捨てます）。');
fs.writeFileSync(D + 'templates.js', t2);
console.log('final fixes applied');
