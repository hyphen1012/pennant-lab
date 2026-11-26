# PENNANT LAB — 本番接続前の作業・合格条件（2026-11-26）

状態：開発ブランチ上の実装／未接続。正式リリース候補版の承認ではない。
公開版 v0.9.189 と正式起動原本は変更しない。PL_PRODUCTION=1 は未完成の接続を誤って販売しないため現時点で意図的に拒否する。単に環境変数を入れて解除する運用は禁止。

## 1. 別担当者から受け取る情報（秘密値はチャット・GitHubへ貼らない）

| 取得先 | 必要な情報 | 設定先・合格条件 |
|---|---|---|
| Apple Developer / App Store Connect | Team ID、確定Bundle ID、アプリID、非消費型広告スキップ、VIP商品ID・月年プラン、サブスクリプショングループ | Bundle ID確定後にnative設定。価格はStoreKitのローカライズ値。App Store Server APIの鍵はサーバーのsecret manager。通知V2をsandbox/productionに分ける。 |
| Google Play Console | 確定package名、商品ID、VIP base plan/offer ID、Play Console連携サービスアカウント、RTDN Pub/Sub | 公式Play Billing SDK・Developer APIを使用。サービスアカウント資格情報はサーバーのみ。署名キーと配信キーを分離。 |
| AdMob | 両OSアプリIDとリワード広告ユニットID、同意メッセージ、SSV callback設定 | mobile/prepare.cjs のPL_ADMOB_ANDROID_APP / PL_ADMOB_ANDROID_UNIT / PL_ADMOB_IOS_APP / PL_ADMOB_IOS_UNIT。開発は公式デモIDのみ。本番はSSV実証後。 |
| 認証 | 発行元、API audience、scope、公開クライアントID、登録済みredirect URI、必要なサーバー認証資格情報 | OAuth/OIDC Authorization Code + PKCE を候補。サーバーintrospection対応プロバイダーはserver/auth-introspection.cjsを利用可能。端末に秘密鍵を置かない。別アカウントの同一メールを統合しない。 |
| API/DB/運用 | HTTPSドメイン、証明書、自動更新、DB永続ボリューム、バックアップ格納先、監視・アラート、削除申請受付 | 開発・検証・本番で鍵、DB、OAuth client、広告・購入検証、通知URLを分ける。GitHub Pagesのhealth.txtは開発専用。 |
| ストア・法務 | プライバシーポリシーURL、規約URL、アプリ内削除導線と外部削除URL、問い合わせ、データ保持期間 | Apple/Googleのアカウント削除・データ申告、広告同意、プライバシー表示を確認。保持の法的根拠は担当者確認。 |

暫定アプリID jp.pennantlab.game は未登録・未確定。価格案は設計書に従うが、本番商品IDや価格を仮定しない。割引VIPはストアの購入条件とサーバー永久権を両方確認し、解約・失効時の扱いを確定してから登録する。

## 2. 接続順と停止条件

1. HTTPS配備、検証用DB、認証（実在するOAuth/OIDCプロバイダーの選定）。アクセストークンを毎リクエスト検証、発行元・audience・有効期限・scope・不変sub一致。不明なIDは拒否。端末の安全な資格情報保管、再認証・logout・失効、休止復帰を実装。メールを永続IDにしない。
2. 3スロットのローカルaccount namespaceとクラウド画面を接続。guestの数字キーは自動でアカウントに帰属させない。明示取込・対象・revision・日時・容量確認、上書き前復旧コピー、通信断後の照会。既存gzip形式と100年実データでサイズ/互換検証。通常セーブとCASは同一キー体系にする。バックアップを別ストレージに保管。
3. StoreKit 2 / Google Play Billingの実SDKを実装。購入済み・保留・中断・キャンセル・復元・失効・返金・サブスク更新を区別。購入トークン/署名のサーバー検証、購入者紐付け、Apple original transaction / Google token chain、通知の認証と順序逆転・再送対策。取引ごとのサーバー承認後のみfinish/acknowledge。本番通知は公開前にsandboxで確認。
4. リワード広告SSV：署名を公式公開鍵で検証、予約に不透明トークンを割当、広告ユニット・報酬種別/量・試行番号を照合、transaction_idを永続一意化。署名済みコールバックの実データでエスケープ・時刻単位・鍵ローテーションを確認。広告SDK完了通知は本番報酬に使わない。権威ある適用処理と台帳の再調停が完成するまで報酬禁止。
5. SNS実績は端末セーブを信用しない。サーバーで実績を再計算/検証できる仕組みの設計・実装が必要。投稿・レビュー・高評価を条件にしない。ローカルシミュレーションの記録検証が未解決の間は本番報酬を無効にする。
6. 削除：アプリ内と外部Webに入口、本人再確認・対象確認、セッション失効、ゲーム/広告/認証データ削除、法定保持対象は別管理。購入復元や既存サブスク解約手順を説明し、削除を解約の代替にしない。本人確認から削除完了まで再試行可能・監査可能にする。
7. 運用：TLS終端・厳格CORSまたはnative安全通信、レート制限、アップロード/解凍の上限、ディスクquota、DB監視、暗号化された独立バックアップ、復旧演習、秘密管理・監査ログ（トークン/購入証明/セーブ本体はログ禁止）。通知の再送/再調停、異常検知、障害対応担当・データ保持を決定する。
8. リリースゲート：上記実装と試験を根拠にmobile/production-readiness.cjsの項目を個別に解消。正式素材SHA、開発画面除外、オンライン必須、広告任意、無課金難易度、購入復元、VIP期限、課金/広告の失敗時無付与、保存競合、100年耐久、複数seed AI、Android/iOSビルド、実機、ストア審査を別々に記録。署名済み製品を生成してから実機合格・ストア提出の順。debug APK / Simulator appは正式配布物ではない。

## 3. 今回の実装状況・残課題

- 実ゲームのIndexedDB数字キー保存に永続revisionと削除tombstoneを追加。旧レコードはrevision 0。古いバージョンのアプリと同時操作した場合の保証は未検証。実ゲームの通常保存CASと、別キーのaccount参照アダプタはまだ接続されていない。
- account保存アダプタは同一DBのアカウント別キーでCAS・直前世代の復旧コピーを原子的に置換する。ゲーム画面、account lifecycle、通常保存との統合と復旧UIは未完了。同一DBのコピーは独立バックアップではない。
- gzip構造検証はゲームv2の基本構造・チームID・選手ID等をチェックし、解凍上限を設定。ゲーム内の全整合性・100年実データ・権利や達成の正当性は証明しない。
- lifecycle、認証introspection、購入状態フロー、SSV署名、予約証明台帳は単体境界。実プロバイダー・実SDK・通知受信HTTP・本番報酬適用・削除実行・外部バックアップは未実装または未接続。SSVは現段階でASCIIのみを許容する保守的実装であり、公式コールバック実例で互換性を確認するまで本番禁止。
- 既存のネイティブSDK完了ベース報酬は開発専用に限定し、本番ビルド自体を未解決条件がある間拒否する。ユーザー向けの無料ゲーム仕様や公開版は変更しない。

## 4. 公式資料（2026-11-26 確認）

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ （アカウント作成時のアプリ内削除、ログインの同等選択肢、アプリ内購入）
- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Account Deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Billing: https://developer.android.com/google/play/billing/integrate
- Google Play Billing security: https://developer.android.com/google/play/billing/security
- AdMob SSV: https://developers.google.com/admob/android/ssv （署名対象の順序、ECDSA/SHA-256、公開鍵更新、transaction_id）


## 2026-11-26 — account cloud integration (stacked on PR36)

- Account-scoped IndexedDB game records and preview keys now use the verified account namespace. Numeric guest slots remain separate; no implicit migration. Login is after the original title tap when OAuth is configured. Cloud management is title-only and holds the save-slot lock until completion. The account namespace cannot change during a running game.
- Cloud dialog: list, server timestamps, source/target slot and revision confirmation, gzip upload/download, previous server revision, local previous generation recovery, cancellation. Existing timestamps are nullable. Local recovery is not an independent backup.
- OAuth public-client configuration: PL_ACCOUNT_API_URL, PL_OAUTH_AUTHORIZE_URL, PL_OAUTH_TOKEN_URL, PL_OAUTH_ISSUER, PL_OAUTH_CLIENT_ID, PL_OAUTH_SCOPE, PL_OAUTH_REDIRECT_URI. All must be configured together; HTTPS API/endpoints and exact registered redirect required. Provisional redirect jp.pennantlab.game://auth/callback must be updated if app ID changes. Native browser and callback registration are implemented; provider selection, CORS, exact redirect registration, Android/iOS physical-device flow remain unverified. No client secret is placed in the app. Access/refresh tokens are memory-only; cold start reauthentication. Logout clears the app session, not necessarily provider browser SSO.
- The runtime revalidates identity and invalidates the entitlement lease on suspend, background, connectivity loss, or account changes. No actual paid game effects enabled. Authenticated identity route /v1/identity is not a purchase proof.
- PR36 verification 45752090316 failed because the old smoke IndexedDB fixture omitted readonly completion. Browser audit 45752090312 failed because old codec/performance fixtures used non-game slots 98/99. Repair fixtures in this branch, not production slot limits; use isolated real scratch DB. PR36 100-season run 45752090358 and native debug 45752084139 succeeded. New branch results are separate.
- Added native OAuth fixture and real browser game/cloud UI test. Actual external IdP, real store billing, SSV ingestion/reward application, account deletion execution, independent backup and production service remain open. Release blocker stays in place.
- Facility trial F 45751665717 did not meet the unchanged 50+5 condition across the three seeds; do not adopt it wholesale. Keep latest public version unchanged.


## 2026-11-26 — service integration (stacked on corrected PR37)
- PR37 initial verification failed because isolated save VM lacked accountCurrent; browser cloud test failed on an incorrectly scoped Playwright locator. Both test fixtures fixed at df6f076c; new CI required. PR37 real IndexedDB CAS browser test previously passed. Do not infer full game/cloud success.
- Server runtime composes account, save, purchase, ad proof, and deletion databases on one loopback HTTP listener. CORS exact allowlist, body bounds, rate limiter, /healthz and /health.txt, aggregate metrics. Staging-only entrypoint reads introspection secret from file; all purchase/reward/deletion reauth verifiers deny by default. TLS ingress example and Dockerfile are not deployed. For Docker loopback listener use a same-network-namespace/host-network TLS proxy; never expose plain HTTP. Data directory mode 0700 and mounted independently. Single process; no distributed limiter or production monitoring yet.
- AdMob SSV key resolver uses fixed official key URL with bounded response and <=24h cache; callback endpoint verifies signature and binds opaque custom_data to an authenticated pending order; SDK callback never grants reward. Server evidence required even if the completion adapter reports ad application. Real callback fixture, native SDK SSV option, authoritative game action/application, and all ad sites remain open. No signed callback can modify game state directly.
- Durable deletion requests require verified recent reauthentication and quarantine ordinary account access. A request is NOT completion. Existing in-flight mutations must be drained before an offline purge; provider deletion, data erasure, legal retention, external web and in-app paths still needed. No active external account deletion executed.
- Offline backup/verify/restore CLI uses SQLite backup API, quick_check and SHA256 manifest for 5 DBs. Explicit stop-writers confirmation; target separate private directory; no live overwrite. Operator must use independent encrypted/off-host storage and conduct restoration drill; deletion tombstones must be reconciled before any restored service is reopened. Example: node server/backup-cli.cjs backup /data /backup --writers-stopped; restore BACKUP NEW_DIR --new-directory. Test fixtures are not a production drill.
- Trial G PR38, F baseline; defer elite investments only if a viable mature stadium project is within 4 forecast years and competing expense would delay funding beyond style-specific threshold. Same 50+5 test, no cost/reserve/cash changes. Adoption pending.
- Production blockers remain; native billing, real providers, account deletion and authoritative reward paths not approved; published v0.9.189 untouched.


## Native billing integration (experimental, transactions disabled)
- Actual StoreKit 2 and Google Play Billing 9.1.0 plugin sources, generated native project registration, current localized price queries, purchase/pending/cancel, restore and finish implementations. Native purchase/finish hard-disabled until real provider verification and sandbox tests. No consumable or unverified right granted.
- PL_BILLING_CATALOG_JSON optional, requires OAuth/API config; object with android and ios arrays of {id,type,label,basePlan?}. Real registered store identifiers only; no sample purchase IDs in production. Current implementation requires unique product IDs and a single explicit base plan per Android subscription product; discount eligibility, upgrades/downgrades, multi-offer handling and provider reconciliation need approval before sales. Product catalog UI is read-only, transactions remain disabled.
- Apple appAccountToken is deterministic UUID derived from verified account hash; Google obfuscatedAccountId is the account hash. Real receipt verifier must validate ownership and environment, chain identity and the account binding. /v1/purchase-finish independently re-verifies the particular receipt and active status before authorizing SDK finish. Provider-specific receipt and notification verification remain absent, and staging entry denies them. Do not relax gates merely to ship a binary.
- Native SDK builds are debug/Simulator, not device/store sandbox transactions. See https://developer.android.com/google/play/billing/integrate and https://developer.apple.com/documentation/storekit/transaction/unfinished.


## Account deletion and native ad evidence (2026-11-26)
- In-app account deletion UI requires PL_DELETION_ENABLED=1, an actual HTTPS PL_DELETION_URL and configured OAuth/API. External URL must be the actual functioning public deletion resource; it is not provided by this branch. The provider must guarantee introspected auth_time represents fresh user authentication. Server PL_REAUTH_ENABLED=1 is opt-in after provider verification. A separate token, same account and <=120 seconds are required. No real user deletion performed during development.
- Accepted request quarantines the server account; explicit local purge removes only the authenticated account's 3 records/recovery copies and hints, leaving revision tombstones to prevent stale overwrite. No purge on ambiguous or rejected request. Offline executor requires stopped writers, exact request ID, verified provider revocation, reviewed purchase retention and verified backup reconciliation; retries are idempotent and incomplete steps remain processing. No actual provider revocation or retention/backup policy adapter has been deployed. External web request/status UI, provider-specific revocation and cross-device cleanup still required.
- AdMob native SSV adapter passes opaque customData and checks authenticated server evidence, never SDK success. Bounded status polling only; interruption returns no proof. Real production callback, consent and native ad display must be tested after credentials. Production block remains; actual authoritative application of rewards to game actions and all event integration remain unimplemented. No advertising revenue or reward grant enabled by this change.
- Previous PRs 37/39/40 and independent G PR38 remain draft; consult latest CI before integration. No main/Pages deployment.


## Store provider verification — 2026-11-26
- Official Apple App Store Server Library 3.1.0 and Google Auth Library 10.5.0 server dependencies; staging opt-in PL_STORE_VERIFY_ENABLED=1. Apple sandbox only; Google test purchases permitted in staging. Actual credentials remain absent. Native purchase/finish and production gates are unchanged.
- Apple signed transaction and notification validation with official root certificates and online checks; current nonconsumable transaction or subscription status fetched before rights. Google productsv2/subscriptionsv2 lookup, account ID, configured product, environment policy, refund and cancellation/expiry, consumption and quantity checks. Google RTDN push authenticates signed Google identity token, exact audience, email, subscription and package; requery current state instead of applying notification order. Unknown signed notifications are acknowledged without creating ownership. Google linked-token active replacements intentionally reject until atomic supersession; family-sharing/ambiguous multi-product offers reject. Expired Google API 410 only treated as terminal when previously terminal and expired. Other provider outages fail closed.
- Google token chain is SHA256, raw token encrypted AES-256-GCM in purchases.sqlite. Preserve the separate 32-byte key in independently controlled recovery storage; deletion retention adapter must treat google_tokens explicitly. Server clock/order and provider sandbox fixtures need real validation before production.
- Credentials/config: PL_APPLE_BUNDLE_ID, PL_APPLE_APP_ID, PL_APPLE_ROOT_CERT_FILES (JSON array of DER files), PL_APPLE_PRIVATE_KEY_FILE, PL_APPLE_KEY_ID, PL_APPLE_ISSUER_ID; PL_GOOGLE_PACKAGE_NAME, PL_GOOGLE_SERVICE_ACCOUNT_FILE, PL_GOOGLE_PUSH_AUDIENCE, PL_GOOGLE_PUSH_EMAIL, PL_GOOGLE_PUSH_SUBSCRIPTION, PL_GOOGLE_TOKEN_KEY_FILE; PL_SERVER_STORE_CATALOG_JSON ({apple:[{id,product}],google:[{id,product}]}, product permanent/vip). No actual provider IDs or credentials committed. Apple POST /v1/store/apple-notification, Google POST /v1/store/google-notification; both disabled absent storeConfig. Production notifications, linked purchases, backend acknowledgement, store sandbox transactions and full receipt lifecycle still require approval.


## Canonical game authority (not deployed)
- Audited eight await rewardAdProvider call sites: draft/foreign revival, disabled opening special guarantee, draft lottery, shared FA/posting retention and market sign, retirement, manager, medical roster and injury popup. The eight active semantic routes are draft-revival, foreign-revival, lottery, fa-retention, fa-sign, retirement, manager, medical. Medical UI routes must deduplicate one injury across calendar years; lottery one season; manager once per season and unlimited seasons. No resurrection of opening special guarantee.
- New game-authority.cjs stores canonical world state, action journal and wallet in account.sqlite transaction; engine-created worlds only (no imported client snapshot), optimistic revisions, pending action lock, server-derived operation and achievement IDs, explicit cancel and replay-safe outcome. SSV proof required for ad mode; paid lease rechecked; ticket consumption and mutation rollback together. canonical-care.cjs implements real medical halving and manager year continuation rules. Other routes tested through fixture engine, NOT actual season engine. No HTTP endpoint/live client integration enabled. Need server-side deterministic full game engine or server-authoritative event log, canonical setup/advance commands, RNG, migration decision, private/public projections, actual route mutation tests, secure runtime binding and real provider tests before release. 32 MiB canonical world cap is provisional, must profile 100+ year state or split storage. No client save is achievement/reward authority; no local completion or posting action qualifies.
- Authority tables included in existing account.sqlite backup and offline deletion. Production gates intact. Trial G rejected; H PR43 based on F with existing price/attendance bounds and weekday/weekend optimization; 55-year results pending.


## Recovery and settlement isolation — 2026-11-26
- Offline restore now requires stopped writers plus a separate current deletion SQLite registry. Old snapshot tombstones must match the latest registry without regressing state or timestamp. All current tombstones are copied into restored data; completed requests are returned to processing, quarantined, and require idempotent deletion/retention/backup reconciliation again. Do not substitute a historical registry or serve restored data if the latest registry is lost. This cannot establish that an operator-provided registry is truly current; an independently protected current registry and operational recovery drill remain necessary.
- New restore CLI: node server/backup-cli.cjs restore BACKUP NEW_DIR --writers-stopped LATEST_DELETION_SQLITE. Previous --new-directory-only command intentionally rejected. No live database is overwritten.
- Reference wallet reserve/finish cannot change canonical game action orders; canonical reserve rejects an order owned by a different settlement path. Added regression for legacy completion bypass and post-backup deletion quarantine. Full game engine connection remains open, and production gates stay closed.

## Canonical service HTTP boundary — 2026-11-26
- Added bounded authenticated /v1/game/{create,read,advance,reserve,settle,cancel,achievements,claim} routes. Only a trusted in-process engine injected into createServiceRuntime can enable them. Staging entry intentionally supplies no engine; returns 503, and production remains blocked. No client snapshot or seed is accepted by the boundary; engine must enforce command validation. Reference game claims/reservations/finish are disabled when canonical engine is active, preventing competing game authorities. Wallet and verified purchase routes remain. Existing signed ad proof registry is used for settlement, not direct callback mutation. CORS preflight supports hyphenated purchase-finish route.
- Added HTTP integration regression with fixture engine, real treatment rule, signed test ad, same-account/slot boundary, CAS/replay, legacy isolation and deletion quarantine. This is not a full season engine or real SDK/SSV test; full trusted engine, client game connection and external services remain open.
