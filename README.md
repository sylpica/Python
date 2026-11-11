# Python総合学習 Studio

Pythonを「学ぶ → 書く → 試す → 間違える → 調べる → 修正する → 理解する → 応用する」まで1つのアプリで完結させる、日本語の総合学習・実験・開発環境です。無料・ログイン不要・バックエンド不要の静的Webアプリで、GitHub Pagesで公開します。

公開URL: https://sylpica.github.io/Python/

## 主要機能

- **Python Studio**: Monaco Editor（構文ハイライト・複数ファイルタブ・検索置換・折りたたみ）、Pyodide Web Workerによる実Python実行（状態保持カーネル／リセット／中断=Worker再生成）、標準入力、変数スナップショット、Matplotlibグラフ画像表示、NumPy/pandas/Matplotlibのオンデマンド読込、CSVサンプル作成、ファイル取込
- **リアルタイム診断**: 本物のPythonパーサ（ast.parse）による構文診断＋軽量ヒューリスティクス警告（未定義名の可能性・変更可能なデフォルト引数・None比較・組み込み名上書き）。型の完全推論は行わず、断定できないものは「可能性」と表示します
- **Notebook**: コード/Markdownセル、セル単位・全実行、共有カーネル、.ipynb インポート/エクスポート
- **レッスン**: 30本（入門〜上級・応用）。全コード例は実Pythonで実行検証し期待出力と一致を確認済み。その場で実行／Studio連携／学習済管理
- **問題演習**: 四択50問（正解位置 12/13/13/12、実走検証済み）、穴埋め6問、コーディング4問（実行結果で判定）、バグ修正4問（実行して判定）。履歴・復習・苦手管理
- **リファレンス**: 42項目（網羅ではなく主要項目）（組み込み関数・メソッド・構文・標準ライブラリ・NumPy/pandas）。重要度・検索・ソート、例の実行、エディタのカーソル語連携
- **用語集**: 34語。重要度順ソート、レッスン等からの相互リンク
- **よくある間違い**: 15項目（誤コード→現象→原因→正コード）。Studioのエラーからも逆引き
- **環境・パッケージ**: 環境構築教材12本、パッケージカタログ14件（通常環境への導入とブラウザ内対応状況を区別して表示）
- **全体検索・学習状況**: 全コンテンツ横断検索、進捗・履歴・エクスポート/インポート（JSON）
- **PWA**: manifest + Service Worker。アプリ本体と学習データはキャッシュされオフライン閲覧可（Pyodide本体・追加パッケージは初回DLが必要）

## 技術構成

- 静的ESモジュール（ビルド工程なし）+ Monaco Editor 0.52.2（CDN）
- Python実行: Pyodide 0.26.4（CPython 3.12系）を Web Worker で分離
- 保存: localStorage（学習記録・作業ファイル・Notebook・UI状態）
- コンテンツは `data/` 配下の構造化データとして一元管理し、相互リンクはIDで管理（リンク先の実在を自動監査）

## 既知の制約（ブラウザ版Python）

- subprocess、ソケット通信、OS依存パッケージ、一部ネイティブ拡張は使用できません
- 実行中断は Worker の終了・再生成方式のため、中断するとカーネル状態（変数）は失われます（UIで事前に明示）
- 静的診断は構文解析＋ヒューリスティクスで、本格的な型チェッカー（Pyright等）相当の推論は行いません
- input() は Studio の「標準入力」欄から事前に与えた行を読みます

## ローカルでの確認とテスト

```bash
python3 -m http.server 8000    # http://localhost:8000
cd tests && npm install && node run-all.mjs   # core / engine / content / e2e
```

教材の全コード例の照合には numpy 1.26.4・pandas 2.2.0 入りの CPython 3.12 を `CPYTHON=/path/to/python` で指定します（未指定時は該当例を「未検証」として記録）。e2e は Chromium（Playwright）と CDN への接続が必要です。

## 監査記録

AUDIT_MASTER_REPORT.md / AUDIT_ISSUES.md / AUDIT_REQUIREMENTS_MATRIX.md / AUDIT_EVIDENCE.json / AUDIT_CONVERGENCE_REPORT.md を参照。現時点の判定は「未収束」（公開環境・オフライン・他ブラウザは未検証）です。
