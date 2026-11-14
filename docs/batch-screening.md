# 全件一次判定

チャット調査用のオフライン処理。GPT API・ブラウザ操作・通信なし。全件を `calculated`（算定済み）、`excluded`（対象外）、`insufficient`（成約または項目不足）へ振り分け、全件台帳と追加確認キューを保存する。既存拡張のプリウス限定PoCとは独立。

```sh
node scripts/import-cis-cache.mjs CAPTURE.json CACHE.json
node scripts/screen-all.mjs --listings LISTINGS.json --cache CACHE.json --date 2026-11-16 --price-basis assumed-same --out FULL_LEDGER.json --site-report SITE_REPORT.json
```

`--site-report` は省略可能。出力は既存 `archive-report.mjs` の入力になる。公開は従来のSites手順。実データの出力先はGit外に置く。過去の結果や掲載中のSiteをこのコマンドが変更することはない。

## 入出力と判定

- 入力は取得済みTC-Webの `pages[].rows`（13列）または正規化済み `lots`。開始価格は保持するが計算には使わない。未知の車種は乗用車と推定せず保留。乗用車・商用車辞書は `lib/batch-screen.js` の明示リスト。
- 成約は `{"comps": [...]}`。各行に side（buy/sell）、status=sold、market（売却側USS）、period（売却側past4events）、venue、lot、auctionDate、observedAt（時刻付きISO）、model、grade、year、km、score、price（円）、priceBasis を保存する。drive/colorも保存可能。
- 取得7日以内、成約35日以内、USS過去4開催の検索根拠あり、重複排除済みの成約を採用。古い成約を再読込しただけで取得日時を更新しない。取得日時・成約番号不明は採用しない。矛盾する同一成約は全て除外。
- 型式・グレードは文字幅・空白・ハイフン類だけを統一し一致比較。別名や略称の同一視は自動推測しない。年式差0、走行差2万km以内、評価差0.5以内、通常評価のみ。既知の駆動差は除外。不明の駆動・色・装備差は詳細確認事項。
- 両側各3件以上で中央値の差額を計算。予想仕入れ中央値が100万円以内なら算定対象。参考最高額が100万円超なら注意を残す。マイナスもTOP5に含む。費用・修理費未反映。
- 価格基準の既定値unknownでは算定しない。今回のユーザー承認に沿った暫定運用では明示的に `--price-basis assumed-same` を指定し、出力に仮定を残す。開始価格から穴埋めしない。
- `searchQueue` は型式・グレード・年式・距離帯・評価・不足側を束ね、影響案件数順。metadataは検索前の区分・項目確認。自動検索実行ではなく、チャットのブラウザ調査へ渡す追加取得リスト。
- キューの対象を全て確認するまで「全件利益確認済み」と呼ばない。全件処理済みと全件算定済みは別。

## キャッシュの再利用

CISの取得済み11列配列は importer で変換可能。既存TCの自由文は出品番号がなく価格列の誤認余地があるため自動変換しない。次回取得時に上記の成約形式で保存して同じキャッシュへ追加する。過去のSiteの推定中央値自体を独立した成約として数えてはいけない。原成約を再利用する。

2026-11-14の実データ試行：一覧1,235件を全行処理。取得日時付きCIS57件を取り込み。TC自由文2検索群は識別情報不足のため未変換。よってこの試行では仕入れ側根拠不足が残り、新規の利益TOP5は確定していない。
