# 統合監査報告書（Python総合学習 Studio）— 独立再監査

- 対象: sylpica/Python、起点コミット 4d9d2f5、作業ブランチ `claude/brave-ritchie-vtvzji`
- 実施日: 2026-11-10 ／ 前回の「収束」判定は根拠として採用せず、コードと実測で再判定した
- 指摘一覧: AUDIT_ISSUES.md ／ 要件照合: AUDIT_REQUIREMENTS_MATRIX.md ／ 機械的証跡: AUDIT_EVIDENCE.json ／ 判定: AUDIT_CONVERGENCE_REPORT.md

## 方法
1. 全ソース（app.js/worker.js/sw.js/data/*）を精読し、前回報告との差異を確認
2. **本番 worker.js をそのまま Pyodide 0.26.4（Node）で動かすテスト基盤**を作成（モックなし）。実行・診断・ファイル・パッケージ・asyncio・入出力を 64 件検証
3. 全コード例（レッスン30・リファレンス42・用語集・よくある間違い15・問題）を **CPython 3.12.3（numpy 1.26.4 / pandas 2.2.0、Pyodide と同一版）と Pyodide の両方**で実行し期待値と照合
4. 実ブラウザ（Chromium, Playwright）で18シナリオ（実行・診断・入力・複数ファイル・NumPy/Matplotlib・中断復帰・再読込復元・レッスン隔離・演習・検索・Notebook XSS）を実操作
5. 11パッケージを Pyodide で実際に import・実行して対応状況を計測

## 主要発見（重大度順・詳細は AUDIT_ISSUES.md）
- High 10件: 名前空間の汚染（Studioとレッスン／補助コードの漏洩）、`end=""` 出力消失、traceback の内部フレーム混入、asyncio.run 不可、コーディング問題の採点が直書きでも合格、教材の事実誤り、SW の他アプリキャッシュ削除、異常終了からの復帰不能 ほか
- Medium 11件、教材訂正 10群（二重正答 q008、重複問題 q039、再現しない誤例 modify-while-iterating 等）

## 修正結果（実測）
| スイート | 総数 | 成功 | 失敗 | スキップ |
|---|---|---|---|---|
| core（純粋関数） | 11 | 11 | 0 | 0 |
| engine（本番worker, Pyodide 0.26.4） | 64 | 64 | 0 | 0 |
| content（CPython+Pyodide 全例実走） | 185 | 185 | 0 | 0 |
| e2e（Chromium実操作） | 18 | 18 | 0 | 0 |
| e2e.offline（実SW・オフライン・移行・バックアップ） | 10 | 10 | 0 | 0 |

内容: レッスン30、四択50、穴埋め6、コーディング4、バグ修正4、リファレンス42、用語34、間違い15、パッケージ14、環境教材12。コード例 115 件を実行（一致 105／不一致 0／実行対象外 10＝シェルコマンド・断片で理由を記録）。
正答位置（保存データ）12/13/13/12（χ²=0.08）、最長選択肢が唯一の最長かつ正答 7/50（14%）、固定5シードでの出題時分布も記録（AUDIT_EVIDENCE.json）。

## 残存・未検証（「問題なし」に含めない）
AUDIT_ISSUES.md 末尾および AUDIT_EVIDENCE.json の `unverified` 参照。特に **公開サイト未デプロイ・未検証**、オフライン実機、Safari/iOS/Firefox、スクリーンリーダー、性能の定量値は未計測。
