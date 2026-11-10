# 要件照合表 R01〜R26

判定: PASS＝実際に動作を確認／PARTIAL／FAIL／MISSING／BLOCKED／N/A。根拠のテストは tests/ 配下。

| ID | 判定 | 実装 | 根拠・未解決 |
|---|---|---|---|
| R01 実行結果 | PASS | runtime/pystudio.py, worker.js | engine: print/Unicode/float/end=""/stderr順序、content: 全例をCPythonと照合 |
| R02 カーネル状態 | PASS | pystudio.reset, worker | engine+e2e: 保持・リセット・隔離・補助名の漏洩なし・中断後再起動。異常終了(fatal)の自動復帰は実条件を再現できず **未検証** |
| R03 直列化 | PASS | app.js enqueue, worker queue, 世代管理 | e2e連打、engine同時要求。古いWorkerの応答破棄はコード確認のみ（遅延応答を人為再現するテストは未作成）→ PARTIAL寄り |
| R04 無限ループ | PARTIAL | stopBtn→newWorker | e2e: `while True` を中断→再起動→再実行 PASS。再帰・大量print・巨大リストは engine で確認。UI凍結なしの定量計測なし |
| R05 例外表示 | PASS | _error_info, explainError | engine: 種別・行・ファイル・内部フレーム除去。日本語ヒントは種別キー |
| R06 input() | PASS | pystudio._input, stdin | engine: 複数行・空行・EOF・持ち越しなし。対話的入力待ち（実行中に入力）は **未実装**（事前入力方式と明記） |
| R07 パッケージ | PASS | loadPackagesFromImports | 11パッケージを実測。コメント/文字列内importで読込まないことを検証。xlsx→read_excel往復は未検証 |
| R08 静的診断の正確性 | PASS | analyze() | engine: 種類別・行/列。型解析ではない旨を明記 |
| R09 診断の鮮度 | PASS | diagSeq, 入力中ソフト表示 | e2e: 修正後に旧エラーが残らない。診断の入力遅延は未計測 |
| R10 複数ファイル | PASS | files, rename/delete/DL | engine+e2e。フォルダ構造の画面表示は簡易 |
| R11 変数スナップショット | PASS | snapshot() | engine: 型・値・len・名前空間一致。ネスト展開UIは未実装 |
| R12 Notebook | PARTIAL | core.js nbToIpynb | 単体: nbformat4往復（出力・画像・メタ）。e2e: 全セル・最終式・XSS。セル実行順の`[n]`は再現。Jupyter実物との相互運用は未検証 |
| R13 ファイル入出力 | PARTIAL | worker syncFiles/collectChanges | engine: テキスト/バイナリ/cp932/作成・削除反映。Excel/画像のpandas・PIL往復は未検証、2MB超は一覧に保存しない |
| R14 レッスン品質 | PARTIAL | data/lessons.js | 全30本の実走一致。事実誤り訂正済み。教育的妥当性は人手レビューを要し、全文を網羅できていない |
| R15 問題品質 | PASS(自動分) | quizzes.js | 50問を実行/仕様根拠で検証、二重正答・重複を修正。意味判断分は `manual` として根拠を記録 |
| R16 出題バイアス | PASS | content bias | 実測値は AUDIT_EVIDENCE.json |
| R17 演習機能 | PASS | app.js | e2e: 誤答→関連レッスン。ブックマーク/復習のkind:id化。穴埋め6問の位置分散 |
| R18 復習導線 | PARTIAL | goLesson/openKey | 問題→レッスン、レッスン→確認問題、履歴→問題を実装。「戻る」でのスクロール位置保持は未対応 |
| R19 リファレンス・用語集 | PARTIAL | reference.js | 42項目の実走一致・シグネチャ補正。**42項目は網羅的ではない**（組み込み関数の一部）。意味照合は人手分が残る |
| R20 右パネル | PASS | ref-panel | e2e未網羅（ダブルクリック参照は実装、自動テストなし）→ PARTIAL寄り |
| R21 全文検索 | PASS | searchAll | e2e: 環境教材検索→遷移。問題・パッケージも遷移先を実装 |
| R22 保存 | PARTIAL | store, normalize* | 単体: 破損・旧形式の移行。e2e: 再読込復元。容量不足・長期利用は実機未検証 |
| R23 PWA/オフライン | **未検証** | sw.js | 実装のみ。オフライン起動・更新は未実測 |
| R24 UI/UX | PARTIAL | styles.css | 6幅でのはみ出し検査はCSS上クリア（Chromium）。実機・Safari・コントラスト実測は未実施 |
| R25 性能 | **未検証** | — | 定量測定なし（数値を記載しない） |
| R26 セキュリティ | PARTIAL | esc(), renderMarkdown | Markdown/ノートブックのXSSを単体＋e2eで検証。innerHTMLの全面レビュー済み(escで統一)。Pyodide経由のネットワーク送信は制限していない（Workerはサンドボックスではない旨を明記） |
