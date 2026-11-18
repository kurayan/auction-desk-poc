---
name: auction-desk-poc
description: Auction Deskのチャット調査・全件バッチ判定・Site履歴を実行・保守する。出品案件単位の候補調査、根拠付きランキングとGoogle Sheets登録、接続不具合の診断に使う。
---

# Auction Desk

通常調査は関東の1開催日、国産乗用車（商用車除外）、仕入れ予想中央値100万円以内。継続依頼は直前の条件と保存済みの再開位置を引き継ぐ。

1. 開催一覧の車種別台数が多い順に、取得済みの出品と成約から照合する。不足分はログイン済みChromeで[軽量取得](../uss-market-search/references/lightweight.md)。起動・認証が必要な時だけ[Ready手順](../uss-market-search/references/startup-ready.md)。TCの再ログインは保存済み情報で行う。
2. 同型式・同年式・同グレード、距離±2万km、評価±0.5、各市場3成約以上。R・RA等を通常評価に混ぜない。USSは過去4開催、取得7日以内・成約35日以内。比較可能な車両本体価格を使い、基準不明は保留。暫定同一基準はユーザーが認めた場合のみ。開始価格を仕入れ予想に使わない。
3. 諸経費前差額が正の案件の詳細・出品票を確認し、同一車種は最大差額の1台を残す。異なる3車種が揃ったら確認範囲のTOP3を確定する。不足なら次の検索群へ進む。対象を調べ切ったら実数と理由を記録する。色・装備・会社間評価差、故障・修理費、見送り判断を明示する。
4. 成約個票・取得日時・確認範囲を[Site履歴](references/chat-history.md)に保存し、既存Siteに公開してChromeで当該記録を開く。

全件調査の指定時は `docs/batch-screening.md` に従い全入力行を判定する。個別のUSS相場検索は [uss-market-search](../uss-market-search/SKILL.md)。Sheets納品は依頼時に[納品手順](../uss-market-search/references/sheets-delivery.md)を使う。コード変更後は `node --test tests/*.test.mjs`。移行時は `docs/portability.md` を参照。
