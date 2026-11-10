# 統合監査報告書（Python総合学習 Studio）

- 対象リポジトリ: sylpica/Python（公開URL: https://sylpica.github.io/Python/ ）
- 監査開始コミット: main cc728a8 / gh-pages a97ef74
- 監査完了コミット: 本文書の配信コミット時点（main / gh-pages）
- 実施日: 2026-11-10
- 詳細な指摘一覧: AUDIT_ISSUES.md（A-01〜A-12）

## ラウンド記録

### Round 1: 全体調査・要件照合
- 構造・技術構成・保存方式・PWA・公開形態を棚卸し。静的解析で High 3件（A-01 NumPy自動ロード欠如、A-02 リセット応答不整合、A-03 実行の非直列化）、Medium 5件、Low 2件を抽出。

### Round 2: 重大問題の修正＋回帰テスト
- A-01〜A-09 を修正。回帰テスト `tests/verify.mjs` を新設（レッスン・リファレンス全コード例のローカル Python 3.12 実走照合、相互リンク実在、正解位置の偏り上限）。
- 結果: lessons=30 quizzes=50 reference=42 glossary=34 mistakes=15、positions=12/13/13/12、ALL CHECKS PASS。

### Round 3: 実ブラウザ検証（公開URL、旧プロファイル）
- 成功: カーネル状態保持、リセット、実行前診断（SyntaxError の行列表示）、Notebook 全セル実行。
- 失敗3件はサーバー配信物の md5 一致確認により「旧 Service Worker のキャッシュ残留」と切り分け、A-10 [High] として修正（アプリ資産をネットワーク優先へ、キャッシュ v4）。

### Round 3b: 実ブラウザ再検証（新規プロファイル）
- 右パネル常時表示（タブ・検索・一覧）、NumPy 自動ロード（出力 6）、input()（hello Taro、変数表示）、誤答時の関連レッスンボタン（「📖 関連レッスン「演算子」で復習」）、選択肢シャッフルの実動作を確認。全件成功。

### Round 4: 最終監査A（技術・データ）
- tests/verify.mjs 再実行: ALL CHECKS PASS（データ・リンク・偏りの再発なし）。

### Round 5: 最終監査B（利用シナリオ）＋修正と再検証
- 成功: 保存・復元（再読込でコード復元）、pandas（sales.csv 合計 560、DataFrame 表示）。
- 発見: A-11 [High] Matplotlib が Worker 内で ImportError（DOM 前提バックエンド）→ MPLBACKEND=Agg で修正。A-12 [Medium] ファイル作成の prompt() 依存 → インライン入力化。
- 再検証: Matplotlib（done 出力＋折れ線グラフ画像表示）、複数ファイル import（utils.py 作成→ from utils import double → 42）。全件成功。

## 収束判定

- Critical: 0件 / High: 0件（発見した High 5件は全て修正し、実ブラウザで修正後確認済み）
- 主要機能の受け入れ: 実行・診断・Notebook・レッスン・演習（4形式）・リファレンス・用語集・間違い・環境教材・検索・保存/復元・バックアップ・複数ファイル・NumPy/pandas/Matplotlib を公開環境で確認
- 回帰テスト: tests/verify.mjs 全件パス
- 教材の重大な事実誤認: 全コード例の実走照合で解消済み
- 異なる観点の最終監査（A: 技術・データ、B: 利用シナリオ・UI）で、新規の修正必要項目は検出されなかった（B で検出された2件は修正・再検証後に解消し、その後の再検証はクリーン）

**判定: 自律監査ループは収束し、開発は完成と判定する。**

## 未検証・既知の制約（完成判定から除外して明記）

- オフライン状態での実起動・実行（Service Worker の実地確認）は未検証。オンライン前提の初回取得が必要な資産がある
- 無限ループ実行中の中断（Worker 再生成方式）は実ブラウザ未検証
- .xlsx の Python 側読込（openpyxl 経由）は未検証。取込自体はバイナリ保持まで実装・静的確認済み
- スマートフォン 375px 幅での実表示確認は未実施（CSS のレスポンシブ規則のみ）
- ステップ実行・ブレークポイントは未実装（変数スナップショットで代替する設計を明記済み）
- コード補完は Monaco 標準水準（Python 専用の型推論補完ではない）
- パネル幅のドラッグ調整とエディタ全画面は未実装
