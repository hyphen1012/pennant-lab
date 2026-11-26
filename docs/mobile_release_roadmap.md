# PENNANT LAB 製品化・両ストア配信計画
2026-11-25 ユーザー決定。ゲーム本体の開発と並行して設計し、販売促進・広告宣伝の企画は完成後とする。

## 配信・接続方針
- Google Play（Android）と App Store（iOS）の両方を正式配信対象とする。既存HTML/CSS/JS・画像・学習・試合・セーブはアプリ内で実行する。Capacitor等の共通Web資産＋ネイティブ機能の構成を候補とする。技術選定・SDK要件はアプリ化時に再確認。
- エンジンはネットなしで動作可能な構造を維持する（開発、自動テスト、障害時のデータ保全のため）。ただし正式配信版の通常プレイは実際のインターネット接続を必須とし、オフラインプレイモードを提供しない。現在のGitHub Pages開発版には制限を適用しない。
- 起動・復帰・プレイ開始時に到達性を確認する。OSのネットワーク状態だけでは判定せず、HTTPS到達性検査を用いる。通信断は進行を安全な境界で停止し、セーブ・復元・再接続案内を許可する。処理途中の巻戻し・二重試合・二重報酬・破損を防止し、再接続後に安全に復帰する。判定先の障害、タイムアウト、機内モード、Wi-Fiのみ接続、キャプティブポータル、アプリ復帰を試験する。短時間の通信揺らぎの扱いと確認間隔はアプリ化時に決める。
- 接続必須と広告在庫は区別する。オンラインでも広告が配信されない場合がある。通常進行・通常操作に広告視聴は要求しない。任意の報酬広告でのみ特典を受ける。広告エラー・在庫なし・同意拒否で進行を強制停止しない。未完了視聴・二重付与防止。iOS/Androidの最新広告・プライバシー規約を公開前に確認する。
- ゲーム進行にクラウドAIを使用しない。学習データはセーブ内。接続確認のための小さなHTTPSサービスは候補で、独自サーバーやアカウント登録・クラウド保存の要否は未決定。接続必須とする限りサービス停止リスク・運用費は別途評価する。
- 正式アプリの通信ゲート、ネイティブプロジェクト、広告SDK、ストア登録は未実装・未実施。現段階では仕様決定であって通信制限の完成ではない。

## 段階
1. ゲーム本体・残課題・全画面演出、FA/経営/学習AI長期検証。
2. 早期の両OS試作、署名、端末保存・既存Webセーブ移行、セーフエリア/戻る/中断復帰/性能。
3. 本番通信制御、任意報酬広告、広告同意・データ申告・エラー保護。実機オフライン/再接続/広告失敗試験。
4. 権利・商標・素材監査、プライバシーポリシー、問い合わせ、審査資料。
5. Android内部/クローズドテスト、iOS TestFlight、各ストアの最新審査要件確認。
6. リリース候補版、審査、正式版1.0.0、公開後の運用。宣伝・販売促進の検討はゲーム完成後。

ユーザー側の開発者アカウント登録・本人確認・端末・テスター確保・署名/支払等は、必要時に順次案内する。パスワード・秘密鍵をチャットに貼らない。アプリ内の広告IDや署名情報は適切に管理する。


## v0.9.142 native pilot
Android debug APK / iOS Simulator app のCIビルド成功。mobile/README.md を参照。本番広告ID、署名、ストア登録、実機、接続先運用は未完了。v144で再ビルドを実施する。

## v0.9.145–146 validation (2026-11-25)
- v144: regular regression 18/20; after fixture correction v145 19/20 (legacy smoke still failing). Browser audit and debug native builds v144 succeeded; new index changes now trigger both workflows.
- v144 annual 10-year policy comparison: 6/6 complete, no reserve injection. v145 8/10 complete: seed 12011 in both modes failed in 2034 with club 2 cash -1.92 / -2.31; annual forecast -6.55 / -7.99. Do not mark economics or adaptive performance as proven. Evidence-gated tactics are implemented; controlled synthetic policy checks passed, not a guarantee of a winning record.
- v146: CPU renewal forecasts next-year revenues, payroll and reserves; releases eligible excess-depth players before signing when forecast is insufficient; no cash subsidy and no override of manual GM contracts. Headless annual tests use the same delegated plan for the test GM. Pending CI results. Natural facility acceptance requires eight facilities at Lv.20 and five further annual snapshots, with all twelve clubs' balances/levels recorded. 150-year limit, no bailouts. It is a test, not an achieved milestone.
- Production release is NOT approved: legacy smoke, long endurance, latest browser and builds, native/device verification, production ads, signing and account setup are open. Do not label v146 as RC or 1.0.

### v144 no-reserve regular-season endurance result
100 seasons / 85,800 first-team matches / 71,982 non-no-contest farm matches; minimum observed cash 9.55億円, reserve top-ups 0. Highest observed total infrastructure level 157/160 (park 17, remaining seven 20). This is not a full annual UI/contract simulation or proof of the all-Lv.20 target. The v145 annual facility run completed 15 seasons, then club 2 went negative in 2042. v146 rerun required. Facility maintenance now checks each existing cash-audit checkpoint as well as year-end snapshots.


## 2026-11-25 — Verification evidence and audit expansion (v0.9.146 game)
- Main 490d403: all 20 original regression scripts and Pages deployment passed. Native pilot builds and original browser audit passed against 2b5256e (same game revision). CI 45594356992: 10/10 ten-year annual-model runs, 85,800 first-team matches total, minimum observed cash 2.61億円, no reserve injection. Paired club 0 fixed/adaptive wins: 1937 813/755; 4391 663/661; 8821 782/793; 5107 663/660; 12011 732/763. Aggregate -21 wins, -52 run differential, 2/5 positive win deltas. This is not evidence of adaptive superiority. The fixed policy override still collects samples; other clubs remain adaptive. Added aggregation for future runs, with no manufactured pass criterion for win superiority.
- Browser audit expanded to 320/360/430 widths and real commercial event click sequences (reservation, date advancement, selection, results); the 320 width uses reduced motion. Small control geometry is reported as a diagnostic. All named screens and branches, visual quality, and physical devices remain separate acceptance gates. The new browser run must pass before counting this expansion verified.
- Native connectivity gate now treats document visibility and native lifecycle independently so foreground notifications cannot re-enable a hidden/backgrounded game. Added overlapping lifecycle regression and included native gate test in regular CI. No live ads, credentials, payment entitlement or signed release claimed.
- 100-season and natural all-Lv20 runs 45594357027 / 45594357118 were still in progress at review. Full UI annual flow, all-screen visual audit, adaptive effectiveness, production configuration, IAP design/implementation, actual device and store release remain open. Permanent ad-skip, subscription VIP and social-share rewards are proposals; prices, receipt verification, revocation/refunds, restoring purchases and share reward verification must be finalized before selling them. No mock payment grant in production.

- Facility acceptance refinement: capture the first all-Lv20 checkpoint (including all twelve clubs) during each financial audit, retain minimum levels after that moment, require the first club(s) to maintain five further complete seasons, and stop after that verified interval or the 150-year cap. No selection of a later successful club. Previous run continues under the earlier year-end-only criteria. New CI evidence required.

- Prepared and tested a store-neutral entitlement boundary for proposed lifetime ad skip and VIP expiry; no store transactions or paid effects are enabled. The trusted verifier, product IDs/prices, refunds, restore purchases, account binding, social rewards and store submission still require implementation/approval. User-facing game version remains v0.9.146; no product release claim.


## v0.9.147 製品化追加仕様
[収益化・記念共有設計](monetization_and_memorial.md)参照。新規特殊出現保証の停止、記念アルバムとPNG共有、サーバー用報酬/券/ポイント/VIP分類ルールを実装。サーバー未接続なので報酬・有料権限を付与しない。100年無補填試験成功、全施設試験は別途継続。FA画面の再試験と実機監査は未完了。


## 2026-11-25 — v0.9.149–150 development checkpoint
See [development handoff](development_handoff_2026-11-25.md) for exact commits, CI runs and remaining gates. v149 adds a backwards-reading gzip IndexedDB codec for large saves and coalesces pending writes without deleting history; the prior version cannot read the new compressed record. Keep a backup before migrating. v149 adaptive tactics use opponent-form-adjusted outcomes, reduced exploration and stronger evidence thresholds after warmup. The five paired seeds improved from -21 aggregate wins to +154 (4/5 positive), not a general guarantee. v150 adds VIP preview/verified theme and memorial rendering; no live commerce or trusted provider enabled. v150 regression, native debug build and Pages succeeded. Physical device, full artistic and yearly-UI audit, natural facility max plus five seasons, 500/1000-year actual saves and production credentials remain open.


## v0.9.151–152 priority revision
User confirmed that 500/1000-year play is only a smoke/reference test and previous saves are development test data. Do not block release on 500/1000 full runs or complete old-development-save compatibility. Keep the actual 100-year endurance, preservation of histories and normal save reliability. Added 1000 calendar years and anniversary fixture smoke, not 1000 actual seasons. Production-only native packaging disables scenario start, rare preview actions/menu, achievement preview and the development window.PennantLab surface. Debug native and web remain available for user checks. This is presentation/build separation, not a tamper-proof anti-cheat boundary. See [handoff](development_handoff_2026-11-25.md).


## 工程8：購入権限・認証接続の準備（2026-11-26）
- 認証付き /v1/entitlements を追加。信頼済みストア検証アダプタの明示的な永久権・VIP状態、有効期限、検証時刻、アカウント一致を必須化。5分以上古い検証・未来時刻・不正形式・他アカウントは拒否。期限切れVIPは無効化し、報酬請求・利用予約も同一の判定を使用。従来の真偽値だけの検証アダプタは意図的に非互換とし、テストfixtureを更新。
- モバイルの読み取り専用接続モジュールを追加。HTTPS認証、サーバー時刻を基準に単調時計で権限の短期有効性を計算（通信遅延を保守的に差し引く）。同一アカウントのトークン再発行・切替・ログアウトで旧権限と進行中の応答を無効化する。端末時刻変更で権限を延長しない。
- 本番のStoreKit/Google Play Billingの購入・復元・返金/通知検証、認証サービス、実機ライフサイクルとの接続、サーバー上の達成/適用証明は未実装。ゲームのVIP・広告スキップ・報酬は有効化していない。既存の無料プレイ・1.2倍の対象・価格・セーブデータは変更しない。単調時計がOS休止中に進まない環境では復帰時に無効化・再検証が必要（本番接続条件）。独立開発ブランチ、公開未実施。


## 工程8-5〜7：購入復元・統一報酬利用・アカウント移行（2026-11-26）
- ストア検証アダプタにより正規化された購入チェーン（Apple/Google、商品区分、単調増加のrevision、失効状態、有効期限、検証時刻、購入者）をSQLiteで永続化。ストア+チェーンを一意にし、他アカウントへの再バインド/古いrevision/同一revisionの矛盾を拒否。復元は認証付き /v1/restore。通知は信頼できる検証アダプタのみ、未知の購入は認証済み復元を要求。既知の全チェーンを再照合し、古い検証を新しい検証として扱わず、期限・失効を反映。実ストアの商品ID・所有者照合・購入トークン連鎖・revision生成・署名/通知検証・返金確認は外部接続が必要で未実装。
- 広告/広告券/永久権/VIPの共通利用コーディネーターを追加。既存台帳で予約し、広告の場合のみ独立した広告完了証明を要求、権威ある適用アダプタに操作ID/試行番号/方式を渡し、完了証明による台帳確定と再照会を行う。再生SDKの真偽値/予約/再送応答のみでローカル付与しない。通信断・中断・アカウント変更は照会が必要な状態とし自動再付与しない。端末側ゲーム実処理/広告SSV/サーバーでの適用原子性は未接続。
- 認証セッション切替/再発行/ログアウト/明示無効化を購入権限・報酬利用に共有。復元後は検証済み権限を再取得。実認証画面/アカウント削除/本人確認は未実装。
- セーブ移行の独立参照サービスを追加。認証済みアカウント内の3スロット、明示確認、SHA256、サイズ上限（既定256MiB）、注入された形式検証、revision比較による競合防止、SQLite原子的保存、取得時ハッシュ再検査。ローカル原本の削除なし。セーブ中の有料権限/報酬/実績を本番の権威にしない。クラウド配備、HTTPバイナリ転送、既存ゲームへのUI・安全なローカル取込、バックアップ世代管理、削除/保持ポリシーは未接続。旧データの変更なし。
- 上記を工程8の独立PR #28に実装。実課金・本番認証・報酬付与は有効化しない。新規回帰試験をCIに追加。既存公開版と正式起動画面を変更しない。結果確認後のみ統合判断。

- 追加再監査: 明示的な報酬照会・再調停は独立検証済み完了/取消証明のみを台帳に送信、旧試行や応答不明から自動で付与しない。セーブ移行クライアントは取得と書込みを分離し、ハッシュ確認・対象スロット/更新番号の提示・明示確認・セッション世代を必須化。既存ローカルDBに接続するアダプタには原子的revision検査、アカウント分離、旧データ回復コピーを要求。実装は参照境界であり、本番HTTP転送・実機取込UI・実ストア/広告適用アダプタは未接続。再調停・復元・移行の追加回帰をCIとnative npm testに追加。


## 工程8-8A（2026-11-26）セーブ転送・復旧境界
- 8-7 head 9e09411e の総合回帰45737420173、Android/iOS 45737413005 は成功。PR27は実動画ブラウザ45735646427、100年両条件45735646572成功後、main f3938924へ統合。公開・物理端末は別判定。
- 認証付きバイナリHTTP参照サーバーを追加。GET一覧・現行・旧世代、PUT明示承認、SHA256、revision CAS、サイズ・同時処理上限、拒否時に権限付与なし。既定で旧3世代を同一SQLiteトランザクション内で保存、復旧は古いrevisionに戻さず新revisionの通常import。テストは2世代で境界と競合・アカウント分離・永続性を確認する構成。CI未確認。
- 外部TLS、安定した認証ID、共有レート制限、アップロードサイズ/メモリ/ディスク容量制御、実フォーマット検証、外部バックアップと保持・削除、端末側通信と取込UIは本番前の残課題。世代保存は同一DB障害への独立バックアップではない。実課金・報酬は無効のまま。
