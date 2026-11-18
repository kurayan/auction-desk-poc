---
name: uss-market-search
description: Chromeでログイン済みのUSS・CISの過去落札情報を検索する。JUナビ・TC-Webの出品予定車と仕入れ相場を照合し、USS転売時の価格差が見込める候補を整理する。過去相場、類似車検索、オークション間売買の候補調査に使用する。
---

# USS 過去相場検索

通常の利益候補調査は [Auction Deskの対象・終了条件](../auction-desk-poc/SKILL.md) と [軽量取得](references/lightweight.md) を使う。続きは対象日・会場・再開位置を引き継ぐ。個別検索では依頼の条件を優先し、目的や結果を左右する不足条件だけを確認する。

CISの単独検索は調査用Chromeの既存タブから相場検索 → ダイレクト検索へ進む。検索結果で会場、期間、対象件数、価格単位を確認する。過去4開催と過去4週間は異なる。落札の原表示、出品番号、条件差を残し、一覧の概算距離と出品票の実数を区別する。未確認の略記・評価・価格基準を推測しない。

- 起動・認証・Readyのみの依頼は[Ready手順](references/startup-ready.md)。TCのセッション切れは調査用Chromeで再ログインして再開する。
- 初回・画面変更時は[CIS操作](references/cis-workflow.md)。会場間比較の条件や画面経路は[比較手順](references/cross-auction.md)。
- 調査の保存・公開は[Site履歴](../auction-desk-poc/references/chat-history.md)。Sheets指定時は[納品手順](references/sheets-delivery.md)。

操作は画面で確認した要素を使う。検索に入札・落札・出品・有料申込を含めない。認証情報や会員固有URLを記録しない。
