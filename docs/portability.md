# 別Workへの移行（V1 / 1.0.0）

2026-11-15版。[変更履歴](../CHANGELOG.md)と[Ready手順](../skills/uss-market-search/references/startup-ready.md)を参照。起動・認証手順は操作ツールで実行し、常駐ウィンドウの有無だけで失敗判定しない。

## 必要なもの
リポジトリ全体をcloneし、Node.js 20以上を用意する（追加npm依存なし）。`skills/auction-desk-poc` と `skills/uss-market-search` を移行先のスキル保存先へ登録する。スキルを単独コピーしても判定コードは付属しないため、リポジトリの場所を移行先のチャットに伝える。文書内の `scripts/` `lib/` `web/` `docs/` はリポジトリルート基準。

ブラウザ操作ツール、ログイン済みChrome、TC-Web/JUの契約、CIS USBキーと対応ローカル環境が必要。ブラウザID・タブID・Cookie・USB認証は移行しない。移行先で利用可能なブラウザを発見しログインする。CISは相場検索まで到達したことを確認。GPT APIは不要。旧Chrome拡張は現行運用には使わない。

Site公開には移行先のSites接続と対象Siteへの編集権限が必要。既存Siteを引き継ぐ場合は接続ツールで取得し、source helperで専用ソースを開いてから更新する。既存の共有範囲を維持する。権限がない場合は所有者の設定が必要で、別Siteへ会員データを自動転送しない。Sheets納品にはGoogle Drive/Sheets接続が別途必要。

## 仮確定した調査
関東・国産乗用車・商用車除外、対象出品日1日、仕入れ予想中央値100万円以内。開催一覧の車種別出品件数で取得優先順位を決める。各車種の一部型式・年式帯から取得した場合は全車種・全出品の判定済みと呼ばない。

同型式・同年式・同グレード、距離±20,000km、評価±0.5、両市場3成約以上。取得7日以内・成約35日以内の根拠だけ再利用。USS過去4開催は過去4週間と区別する。開始価格は仕入れ予想に使わない。両社価格基準不明は保留し、明示的に認められた暫定比較のみ assumed-same。修理費・諸経費・色・装備差・評価制度差は未補正と表示。

各車種の算定可能な最大差額案件を1台選んでTOP5。マイナスも表示。5車種未満なら水増ししない。故障記載、判読不能、見送り判断を残す。既存履歴は変更せず新IDを追加する。

## 再現する処理
```sh
node scripts/import-cis-cache.mjs market-cache/capture.json market-cache/cis.json
node scripts/merge-captured-comps.mjs market-cache/capture.json market-cache/existing.json market-cache/cis.json market-cache/merged.json
node scripts/screen-all.mjs --listings market-cache/listings.json --cache market-cache/merged.json --date YYYY-MM-DD --out market-cache/result.json --site-report market-cache/report.json
node scripts/sync-site.mjs SITE_CHECKOUT
node scripts/archive-report.mjs market-cache/report.json SITE_CHECKOUT/dist/history
node --test tests/*.test.mjs
```
空の既存相場は `{"comps":[]}`。暫定同一価格基準を認められた調査のみ screen-all に `--price-basis assumed-same` を追加する。取得はブラウザの表示DOMから行う。CISは11セル配列、TCテキスト一覧は16セルとrecordKeyを保存。各検索グループにqueryとobservedAtを付ける。TCのrecordKeyは出品番号ではなく画面のレコード識別子。原表記・日時を保持し、不明値を埋めない。

生成reportは保存相場の機械再判定という説明を既定で含む。ライブ追加取得した場合は取得数・検索範囲・詳細確認数・故障・仮定を実績に合わせて編集してからarchiveする。Sitesの同梱手順で保存・公開成功まで確認する。コード更新だけではSiteは更新されない。

## ハードコードと変更箇所
- `lib/batch-screen.js`: 乗用車名allowlist、商用車判定、予算・鮮度・類似条件、車種重複なしTOP5。未知車種は保留。車名allowlistは全車種網羅ではない。
- `extension/core.js`: 全半角・年式・会場名の正規化と統計。旧拡張用判定は現行調査では使用しない。
- `scripts/import-cis-cache.mjs`, `scripts/merge-captured-comps.mjs`: 表の列位置と単位。レイアウト変更時は標本照合してから更新。
- `web/history-model.js`, `scripts/archive-report.mjs`: 履歴形式・上書き防止。Site専用ソースに実データを保存。
- `extension/` と `web/connector.html`: 旧試験実装。移行先で起動・配布しない。現行バッチが参照する core.js は保持する。

グレード略記の個別対応は汎用ルールへ自動昇格しない。今回のFC26 Vセレク対応は暫定で、キャッシュの原表記と対応理由を維持して再確認する。

## 引き継がれないもの
このリポジトリに会員データ、成約キャッシュ、調査履歴JSON、認証情報は含めない。過去履歴は既存Site専用ソースに残る。必要な相場キャッシュは承認済みの保管先から別途取得する。キャッシュなしでも新規調査は可能だが再取得が必要。Sites/Google接続、共有権限、ブラウザセッション、作業フォルダも移行先で設定する。

## USBキー常駐ソフト
CIS認証で停止した場合、既存の「セキュリティキー」アプリが停止中なら起動して再試行することは承認済み。詳細は `skills/uss-market-search/references/cis-workflow.md` を参照。移行先のアプリ所在は再確認し、クラウドからローカルUSBへ接続できるとは仮定しない。
