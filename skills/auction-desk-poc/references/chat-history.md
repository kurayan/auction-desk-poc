# チャット調査 → Site記録

現在の主経路はチャット依頼。ユーザーが車種・条件を指定し、調査を行った後にSiteへ結果を記録する。拡張PoCのプリウス制限をチャット調査へ適用しない。調査自体はログイン済みChromeの表示情報を確認し、案件と比較根拠を収集する。Sitesの更新と調査実行を混同せず、調査していない日を調査日としない。

## 保存形式

web/history-model.js の validateReport が形式を定義する。schemaVersion=1。トップレベルは id, researchedOn, researchedAt, title, status, summary, conditions, limitations, coverage, candidates, provenance。

- id: 英小文字・数字・ハイフンの一意値。例 `2026-11-12-101500-prius`。同日でも調査ごとに別ID。
- researchedOn: 日本時間の調査実行日 YYYY-MM-DD。開催日や公開日を使わない。
- researchedAt: 時刻が記録されていればタイムゾーン付きISO日時。不明な過去記録は null。時刻を捏造しない。
- conditions: 日本語ラベルと文字列値の辞書。
- limitations / coverage: 文字列配列。確認不足、検索条件、件数／総数、対象期間を残す。
- candidates: rank（不確定ならnull）, name, venue, lot, auctionDate, vehicle, km, score, status, reason, nextAction, buyLow, buyHigh, sellLow, sellHigh, spread, evidence。
- 金額・距離は数値。不明はnull。金額は円。開始価格を買値予測に変換しない。価格基準未確認なら spread=null。
- evidence: side, date, venue, lot, vehicle, km, score, price, note の配列。noteに条件差・原表示の注意点を記録。
- provenance: 保存元・移行元・訂正対象を記述。認証情報や会員固有URLを入れない。

## 公開手順

1. Sitesの手順で既存Siteの取得・ソースopenを済ませる。既存Site IDと公開範囲を維持する。
2. 調査結果JSONをGit管理外の作業用ファイルに保存する。
3. 画面変更がある場合だけ `node scripts/sync-site.mjs SITE_CHECKOUT`。履歴フォルダはコピー元で上書きしない。
4. `node scripts/archive-report.mjs REPORT.json SITE_CHECKOUT/dist/history`。同じIDの変更は拒否される。訂正は新しいIDで追加して訂正理由を書く。同一内容の再実行は重複しない。
5. Sitesのsource helperで履歴を含めてcommit/push/packageし、既存Siteへdeployする。これがSite全体の更新単位。公開成功前は登録完了と言わない。
6. 完了後 `https://SITE/#run=ID` を返す。古い記録を削除せず、件数が追加されていることを確認する。

履歴はSiteの配信ファイルと専用ソースに保存される。ブラウザlocalStorageに依存しない。一般コード用のGitHubには実際の調査JSONをpushしない。Siteに任意のアップロード口やAPIキーを追加する必要はない。毎回のチャット作業で公開する方式であり、バックグラウンド自動調査ではない。

## 現在の表示方針（2026-11-14訂正）
差額が大きい順のTOP5（最大5件）を表示し、マイナスも含める。未算定は順位に入れず元の記録に保持する。履歴は消さず、取得日時付き相場は条件一致と鮮度を確認して再利用する。過去の出品を現在の仕入れ候補として混ぜない。表示順位は保存されたrankではなく差額から算出する。

## 全件の一次判定

一覧取得後は `scripts/screen-all.mjs` で全行処理する（形式・コマンドは `docs/batch-screening.md`）。5件を先に選んで全件判定を代用しない。全件台帳の算定済み・対象外・不足の合計を入力件数と照合する。`searchQueue` の重複条件をまとめて追加取得し、取得時刻と出品識別情報付きキャッシュへ追記して再実行する。未知区分や相場不足を利益なしと扱わない。Site用JSONは `--site-report` で生成できる。既存履歴の推定値を成約として数えず、原成約のみ再利用する。
