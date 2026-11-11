# 収束判定

## 結論: **未収束**（Critical/Highの既知項目は修正・実測済みだが、収束条件を満たせていない）

| 項目 | 結果 |
|---|---|
| Critical | 0件（確認範囲で） |
| High | 既知10件を修正し再検証。公開環境での再確認が**未了**のため0件とは断定しない |
| Medium | 11件修正。残: 目的語に「実行中の対話入力」「戻る時のスクロール保持」ほか（AUDIT_ISSUES.md） |

## FINAL-A / FINAL-B の状況（2026-11-11）
- 第1回 FINAL-B: 指摘あり（High3・Medium11）→修正
- 第1回 FINAL-A: 指摘あり（High2＝保存型XSS・`base64:` 衝突、Medium7）→修正
- 第2回 FINAL-B（別の新規監査者）: 指摘あり（Medium4。教材の事実誤りの指摘はなし）→修正
- **「連続2ラウンドで新たな修正項目なし」は一度も達成していない＝未収束**。修正後版に対する FINAL-A/B の再走が必要

## 収束条件に対する不足
- 条件11「公開環境で主要機能が動作」: 2026-11-11 に公開（main 68af1d5 / gh-pages b91213a）。配信ファイル15点のmd5が全件一致、公開URL上のChromiumで E2E 19件・オフライン10件がPASS。他ブラウザ・実機は未検証
- 条件13: 未検証事項は AUDIT_EVIDENCE.json の `unverified` に分離して記載
- 17.2 の **FINAL-A/FINAL-B（連続2ラウンドの独立最終監査）は未実施**。同一セッションでの自己再確認は独立監査と認めない
- R23/R25 はローカルChromiumでの実測のみ（公開URL・他ブラウザ・実機は未検証）、R03/R04/R20 は一部のみ実測
- 公開前ゲート: `/advisor` は使えないままだったが、ユーザーがゲートを解除したため公開した。**advisor の助言（反論の聴取を含む）は一度も得ていない**

## 再開手順
0. （公開済み）残りは下記2・3。
1. ブランチ `claude/brave-ritchie-vtvzji` を確認、`tests/` で `npm install && node run-all.mjs`（CPYTHON に numpy/pandas 入りの 3.12 を指定）
2. 公開URL検証は `node tests/e2e.smoke.mjs https://sylpica.github.io/Python/` と `e2e.offline.mjs` で再実行可能
3. オフライン実機・Safari/iOS・性能測定・FINAL-A/B を実施
