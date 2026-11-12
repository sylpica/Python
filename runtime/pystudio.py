"""Python-side runtime for Python Studio (runs inside the Pyodide Web Worker).

Responsibilities:
- keep the shared user namespace (Studio + Notebook) separate from helper code,
  so helper imports never leak into user code (e.g. `json` must stay undefined
  until the user imports it);
- run code with real tracebacks (internal frames removed, real file names);
- capture matplotlib figures (plt.show() and figures left open);
- static analysis for the editor (syntax + conservative AST warnings).
"""
import ast
import base64
import builtins
import importlib
import inspect
import io
import json
import linecache
import os
import re
import sys
import traceback
import warnings

PROJECT_DIR = '/home/pyodide'
SANDBOX_DIR = '/tmp/pystudio_sandbox'
_INTERNAL_PREFIXES = (
    '/lib/python3.12/site-packages/pystudio',
    '/lib/python312.zip/_pyodide',
    '/lib/python312.zip/ast.py',
    '/lib/python3.12/ast.py',
    '/lib/python312.zip/pyodide',
    '/lib/python3.12/site-packages/_pyodide',
    '/lib/python3.12/site-packages/pyodide',
)

user_ns = {}
images = []          # base64 PNGs captured during the current run
_run_counter = 0


def _new_namespace():
    return {'__name__': '__main__', '__builtins__': builtins, '__doc__': None}


def purge_project_modules():
    """Forget modules imported from the project folder so edits to utils.py are
    picked up on the next run (same idea as Spyder's user module reloader)."""
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, '__file__', None) or ''
        if f.startswith(PROJECT_DIR + '/') or f.startswith(SANDBOX_DIR + '/'):
            del sys.modules[name]
    importlib.invalidate_caches()


def reset():
    global user_ns
    user_ns = _new_namespace()
    purge_project_modules()
    _close_figures()
    images.clear()


# ---------------------------------------------------------------- input()
def _input(prompt=''):
    """Like builtins.input, and echoes the consumed line the way a terminal
    shows what the user typed (stdin is pre-supplied in the browser)."""
    if prompt:
        sys.stdout.write(str(prompt))
    sys.stdout.flush()
    line = sys.stdin.readline()
    if not line:
        raise EOFError('EOF when reading a line')
    if line.endswith('\n'):
        line = line[:-1]
    sys.stdout.write(line + '\n')
    return line


builtins.input = _input


# ---------------------------------------------------------------- matplotlib
def _close_figures():
    mpl = sys.modules.get('matplotlib.pyplot')
    if mpl is not None:
        try:
            mpl.close('all')
        except Exception:
            pass


def capture_figures():
    plt = sys.modules.get('matplotlib.pyplot')
    if plt is None:
        return
    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            for num in plt.get_fignums():
                buf = io.BytesIO()
                plt.figure(num).savefig(buf, format='png', dpi=100, bbox_inches='tight')
                images.append(base64.b64encode(buf.getvalue()).decode('ascii'))
            plt.close('all')
        glyph = False
        for w in caught:
            if 'missing from' in str(w.message) and 'Glyph' in str(w.message):
                glyph = True      # one line instead of one warning per character
            else:
                warnings.showwarning(w.message, w.category, w.filename, w.lineno)
        if glyph:
            sys.stderr.write('[グラフ] 日本語などの一部の文字は、ブラウザ版 Matplotlib の既定フォントに含まれていないため □ で表示されます。タイトルやラベルは英語にすると正しく表示されます。\n')
    except Exception as e:  # never hide the user's own output because of capture
        sys.stderr.write(f'[グラフの取得に失敗しました: {type(e).__name__}: {e}]\n')


# pandas 2.2 prints a long pyarrow notice on first import; it is not an error and not actionable here
warnings.filterwarnings('ignore', message=r'(?s).*Pyarrow will become a required dependency.*')
reset()


# ---------------------------------------------------------------- execution
class _AsyncioRunToAwait(ast.NodeTransformer):
    """asyncio.run() cannot start a second event loop inside Pyodide (the
    browser already runs one). A module-level `asyncio.run(coro)` is executed
    as top-level `await coro` instead, which runs the same coroutine."""

    def __init__(self):
        self.changed = False

    def _is_run(self, node):
        return (isinstance(node, ast.Call) and len(node.args) == 1 and not node.keywords
                and isinstance(node.func, ast.Attribute) and node.func.attr == 'run'
                and isinstance(node.func.value, ast.Name) and node.func.value.id == 'asyncio')

    def visit_Call(self, node):
        self.generic_visit(node)
        if self._is_run(node):
            self.changed = True
            return ast.copy_location(ast.Await(value=node.args[0]), node)
        return node

    # code inside def/lambda/class keeps the real asyncio.run (not at top level)
    def visit_FunctionDef(self, node):
        return node

    visit_AsyncFunctionDef = visit_FunctionDef
    visit_Lambda = visit_FunctionDef
    visit_ClassDef = visit_FunctionDef

    def rewrite_module(self, tree):
        return self.visit(tree)


def _internal(filename):
    return any(filename.startswith(p) for p in _INTERNAL_PREFIXES) or filename == __file__


def _filter_te(te, seen=None):
    seen = set() if seen is None else seen
    if te is None or id(te) in seen:
        return
    seen.add(id(te))
    te.stack = traceback.StackSummary.from_list([fs for fs in te.stack if not _internal(fs.filename)])
    _filter_te(te.__cause__, seen)
    _filter_te(te.__context__, seen)


def _error_info(e, filename):
    te = traceback.TracebackException(type(e), e, e.__traceback__, compact=True)
    _filter_te(te)
    text = ''.join(te.format())
    line = None
    file = None
    if isinstance(e, SyntaxError):
        file, line = e.filename, e.lineno
    else:
        for fs in reversed(te.stack):
            if fs.filename == filename or fs.filename.startswith(PROJECT_DIR + '/') or not fs.filename.startswith('/'):
                file, line = fs.filename, fs.lineno
                break
    if file and file.startswith(PROJECT_DIR + '/'):
        file = file[len(PROJECT_DIR) + 1:]
    return {'type': type(e).__name__, 'message': str(e), 'text': text, 'file': file, 'line': line}


async def run(code, filename='main.py', isolated=False, want_last=False):
    """Execute code. Returns a JSON string with error/result/images."""
    global _run_counter
    _run_counter += 1
    images.clear()
    ns = _new_namespace() if isolated else user_ns
    old_cwd = os.getcwd()
    if isolated:
        os.makedirs(SANDBOX_DIR, exist_ok=True)
        os.chdir(SANDBOX_DIR)
    else:
        purge_project_modules()
        try:
            os.chdir(PROJECT_DIR)   # a previous os.chdir() must not break the next run
        except OSError:
            pass
    linecache.cache[filename] = (len(code), None, code.splitlines(True), filename)
    result = None
    error = None
    note = None
    shim = False
    try:
        tree = ast.parse(code, filename)
        fixer = _AsyncioRunToAwait()
        tree = fixer.rewrite_module(tree)
        if fixer.changed:
            shim = True
            ast.fix_missing_locations(tree)
        last = None
        if want_last and tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        co = compile(tree, filename, 'exec', flags=flags)
        r = eval(co, ns)
        if inspect.iscoroutine(r):
            await r
        if last is not None:
            v = eval(compile(last, filename, 'eval', flags=flags), ns)
            if inspect.iscoroutine(v):
                v = await v
            if v is not None:
                ns['_'] = v
                try:
                    result = repr(v)
                except Exception as re_err:
                    result = f'<repr() でエラー: {type(re_err).__name__}>'
    except SystemExit as e:
        if e.code not in (None, 0):
            error = _error_info(e, filename)
        else:
            note = 'sys.exit() でプログラムが終了しました'
    except BaseException as e:  # KeyboardInterrupt etc. are reported, never swallowed
        error = _error_info(e, filename)
    finally:
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
        capture_figures()
        if isolated:
            os.chdir(old_cwd)
    return json.dumps({'error': error, 'result': result, 'images': list(images), 'note': note,
                       'asyncioShim': shim})


def snapshot(limit=80):
    out = []
    for k, v in list(user_ns.items()):
        if k.startswith('_') or inspect.ismodule(v):
            continue
        try:
            r = repr(v)
        except Exception:
            r = '<repr() でエラー>'
        if len(r) > 200:
            r = r[:200] + '…'
        item = {'name': k, 'type': type(v).__name__, 'value': r}
        try:
            if hasattr(v, '__len__') and not isinstance(v, type):
                item['len'] = len(v)
        except Exception:
            pass
        out.append(item)
        if len(out) >= limit:
            break
    return json.dumps(out)


def namespace_names():
    return json.dumps([k for k in user_ns if not k.startswith('__')])


# ---------------------------------------------------------------- analysis
_INCOMPLETE = re.compile(r"never closed|unexpected EOF|expected an indented block|"
                         r"unterminated triple-quoted|incomplete input|expected ':'$")
_SHADOW = {'list', 'dict', 'str', 'int', 'float', 'set', 'tuple', 'print', 'input', 'len', 'sum',
           'min', 'max', 'type', 'id', 'open', 'range', 'map', 'filter', 'sorted', 'next', 'iter',
           'bool', 'format', 'object', 'dir', 'vars', 'hash', 'all', 'any', 'abs', 'round', 'zip'}
_IMPLICIT = {'__name__', '__file__', '__doc__', '__builtins__', '__spec__', '__loader__',
             '__package__', '__annotations__', '__dict__', '__class__', '__qualname__', '__module__',
             '__path__', '__debug__'}


def _span(node):
    return {'line': node.lineno, 'col': node.col_offset + 1,
            'endLine': getattr(node, 'end_lineno', None) or node.lineno,
            'endCol': (getattr(node, 'end_col_offset', None) or node.col_offset) + 1}


def analyze(code, extra_names_json='[]'):
    """Return JSON: {'syntax': {...}|None, 'incomplete': bool, 'warnings': [...]}.
    Warnings are deliberately conservative (scope-insensitive): a name counts as
    defined if it is bound anywhere in the file, imported, a builtin, or already
    present in the running kernel. Star imports disable undefined-name checks."""
    res = {'syntax': None, 'incomplete': False, 'warnings': []}
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        try:
            tree = ast.parse(code)
            compile(tree, '<check>', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        except SyntaxError as e:
            msg = e.msg or 'invalid syntax'
            res['syntax'] = {'line': e.lineno or 1, 'col': e.offset or 1,
                             'endLine': getattr(e, 'end_lineno', None) or e.lineno or 1,
                             'endCol': getattr(e, 'end_offset', None) or (e.offset or 1) + 1,
                             'msg': msg, 'kind': type(e).__name__}
            res['incomplete'] = bool(_INCOMPLETE.search(msg))
            return json.dumps(res)
        except Exception:
            return json.dumps(res)
    W = res['warnings']
    for w in caught:
        if issubclass(w.category, SyntaxWarning):
            ln = getattr(w, 'lineno', 1) or 1
            W.append({'line': ln, 'col': 1, 'endLine': ln, 'endCol': 200, 'sev': 'warn',
                      'code': 'syntax-warning', 'msg': f'SyntaxWarning: {w.message}'})
    _MODULE_STORES = set()
    _MODULE_LEVEL_IDS = set()
    for stmt in tree.body:
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        for n in ast.walk(stmt):
            if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
                _MODULE_LEVEL_IDS.add(id(n))
    for stmt in tree.body:
        for t in (stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target] if isinstance(stmt, (ast.AnnAssign, ast.AugAssign)) else []):
            for n in ast.walk(t):
                if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                    _MODULE_STORES.add(n.id)
    bound = set(dir(builtins)) | _IMPLICIT | set(json.loads(extra_names_json))
    star = False
    loads = []
    stored_module_level = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            if isinstance(node.ctx, (ast.Store, ast.Del)):
                bound.add(node.id)
            else:
                loads.append(node)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            bound.add(node.name)
        elif isinstance(node, ast.arg):
            bound.add(node.arg)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                if a.name == '*':
                    star = True
                else:
                    bound.add(a.asname or a.name.split('.')[0])
        elif isinstance(node, ast.ExceptHandler) and node.name:
            bound.add(node.name)
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            bound.update(node.names)
        elif isinstance(node, (ast.MatchAs, ast.MatchStar)) and getattr(node, 'name', None):
            bound.add(node.name)
        elif isinstance(node, ast.MatchMapping) and node.rest:
            bound.add(node.rest)
        elif type(node).__name__ in ('TypeVar', 'ParamSpec', 'TypeVarTuple'):
            bound.add(node.name)
    if not star:
        reported = set()
        for n in loads:
            if n.id not in bound and n.id not in reported:
                reported.add(n.id)
                W.append({**_span(n), 'sev': 'warn', 'code': 'undefined-name',
                          'msg': f'「{n.id}」は定義が見つかりません（実行すると NameError になる可能性があります）'})
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            for d in list(node.args.defaults) + [x for x in node.args.kw_defaults if x is not None]:
                mutable = isinstance(d, (ast.List, ast.Dict, ast.Set, ast.ListComp, ast.DictComp, ast.SetComp)) or (
                    isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id in ('list', 'dict', 'set') and not d.args)
                if mutable:
                    W.append({**_span(d), 'sev': 'warn', 'code': 'mutable-default',
                              'msg': '変更可能なデフォルト引数（[] や {}）は呼び出し間で共有されます。None を既定にして関数内で作り直すのが定石です'})
        elif isinstance(node, ast.Compare):
            left = node.left
            for op, right in zip(node.ops, node.comparators):
                if isinstance(op, (ast.Eq, ast.NotEq)) and any(isinstance(x, ast.Constant) and x.value is None for x in (left, right)):
                    W.append({**_span(node), 'sev': 'info', 'code': 'none-compare',
                              'msg': 'None との比較には == / != ではなく is / is not を使うのが推奨されます（PEP 8）'})
                left = right
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id in _SHADOW and node.id in _MODULE_STORES and id(node) in _MODULE_LEVEL_IDS:
            W.append({**_span(node), 'sev': 'warn', 'code': 'builtin-shadow',
                      'msg': f'組み込みの「{node.id}」を上書きしています。以後この名前で組み込み関数を呼べなくなります'})
    # module-level assignment never read anywhere (hint only)
    loaded_ids = {n.id for n in loads}
    for stmt in tree.body:
        targets = []
        if isinstance(stmt, ast.Assign):
            targets = [t for t in stmt.targets if isinstance(t, ast.Name)]
        elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name) and stmt.value is not None:
            targets = [stmt.target]
        for t in targets:
            if not t.id.startswith('_') and t.id not in loaded_ids and t.id not in stored_module_level:
                stored_module_level[t.id] = True
                W.append({**_span(t), 'sev': 'info', 'code': 'unused',
                          'msg': f'変数「{t.id}」はこのファイル内で読み出されていません（変数の状態パネルでは確認できます）'})
    W.sort(key=lambda w: (w['line'], w['col']))
    res['warnings'] = W[:40]
    return json.dumps(res)
