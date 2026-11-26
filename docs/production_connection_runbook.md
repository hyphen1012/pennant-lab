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

## Canonical client recovery — 2026-11-26
- Added authenticated slot-scoped read-only order observation and pending reservation list. Client can recover a lost reserve/settle response without consulting store rights, reapplying game effects or replaying advertising. Added account-client methods with bounded schema and exact operation ID checks; orchestration supports explicit reconciliation/cancel and session invalidation. No mutation automatic retry. Committed result is server observation only, not permission to alter legacy local state.
- Added HTTP and client regression for signed proof, pending discovery, uncertain settlement, duplicate ad suppression, account switch and explicit cancellation. Client module remains opt-in/unwired until real trusted game engine and display integration exist; no production activation.

## Google replacement ledger — 2026-11-26
- Supports the narrow immediate, active single-line-item Google VIP replacement when the linked old purchase is already bound to the same verified account. Atomically record the new right and revoke/fence the old chain in SQLite; old-token replays, late notifications and restore/finish cannot reactivate it. Pending purchases do not supersede old rights. Unknown predecessor, cross-account link, competing successor, stale new link and ambiguous multi-item/deferred replacements fail closed. No automatic first-bind from unknown notifications, no actual store purchase enabled. Independent backups and deletion retention must include google_supersession alongside purchases and encrypted google_tokens; preserve anti-replay ownership fencing subject to approved legal policy. Official semantics: https://developer.android.com/google/play/billing/subscriptions and https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2 . Actual sandbox replacement, deferred change, product catalog/discount eligibility and acknowledgement remain open.

## Real headless engine pilot — 2026-11-26
- New server/headless-engine.cjs executes checked-in index.html engine before DOM startup, with exact source anchors, bounded VM execution, server-generated seed and allowlisted commands. Fresh default-team world only; one regular calendar day per command; actual medical mutation and own-club victory observation. No supplied client state/seed or arbitrary code. Existing game source and public assets unchanged. This is a LIMITED staging pilot, not production-ready. Not wired into staging entry or native UI. Event acknowledgement, team creation options, six other reward routes plus manager, full annual flow, VIP income, persistent RNG audit, long saves (>32MiB), performance and multi-user worker isolation remain required. VM timeout is not a sandbox for arbitrary code. Test uses isolated synthetic injury only to exercise real existing treatment function; actual provider transactions remain disabled.

## Canonical large-world storage — 2026-11-26
- Replaces 32MiB raw canonical-world limit with versioned gzip storage for larger server-owned states, up to 256MiB raw / 64MiB compressed. Existing raw JSON rows remain readable, next mutation writes the appropriate encoding. Explicit decoded length, SHA-256, strict base64, fatal UTF-8 and decompression limits. Atomic revision and reward transaction unchanged. No upload or arbitrary client state accepted; existing local/cloud save format untouched. Synthetic >32MiB and corruption/compatibility regression added. Actual 100-year canonical world, CPU/memory under concurrent users, database quotas, per-command serialization costs and independent recovery capacity are still unverified; do not enable production.

## Headless manager and memorial pilot — 2026-11-26
- Expanded real engine pilot with manager continuation (existing tenure >=7 and day >=98; one per season, unlimited future seasons), monthly report acknowledgement only if archived and milestone deferral via existing game function. No rare/injury notice deletion or crisis bypass; unsupported operations still blocked. Existing actual own-club win identities remain unchanged, historical wins from server-owned memorial album and own-club award/facility/championship/retirement/record entries are exposed with stable hashed IDs for non-win sources. Missing explicit team identity excluded. No SNS posting proof. Added actual-match regression and manager/archived-report fixtures. Remains staging-only and not wired into full UI/annual engine. Full reward catalog, VIP revenue, RNG reproducibility, event acknowledgement and concurrency tests remain open.


## 2026-11-26: headless pilot increment
- Actual retirement consultation continuation uses the current selected club player and existing careerEventDone transition; reward settlement remains canonical and atomic. No client snapshots accepted. Natural annual rollover and the complete career UI remain blocked.
- Canonical advance receives a freshly verified entitlement from server authority. Only that trusted context activates the existing vipStatusProvider and actual eligible revenue accounting. No entitlement value is persisted in the game save or accepted in advance commands. Current limited calendar only; production receipts, expiration timing and full annual flow still require testing.
- Optional exact `{team: 0..11}` setup selects a real server-generated club without admitting custom seed/state; legacy `{}` remains accepted. Preserve the PRNG cursor after initial roster generation, rather than resetting it to the initial seed. Add same-snapshot replay regression; comprehensive long-period deterministic audit remains open.
- Staging only; no release/main integration or production activation. CI pending at submission.


## Recruitment reward adapters (staging only)
Connect draft/foreign revival and first-round lottery through existing applyDraftRecovery, applyForeignRecovery, applyLotteryReward. FA/posting/overseas retention uses current own refused request with existing cash requirement. FA signing uses movementPool and movementCanSign, preserves offered years via movementSign; cannot displace a completed rival deal or expired market. No reward for unsupported state; recheck inside atomic settlement. Legacy local reward provider not enabled. Tests use actual generated candidates with isolated fixture negotiation states. Calendar/year rollover, full modern FA UI reward integration and native SSV remain open; do not classify as production ready.


## Canonical calendar inbox increment
- Server view exposes limited injury/rare/current-career event descriptors, never hidden prospect names or abilities. Advance requires explicit acknowledgement of the matching injury or first rare notice; preserves history and injury duration. Career decisions use existing farewell options, contribution, budget and news logic, and explicitly dismiss thanks/farewell notices. No advertisement required to accept retirement.
- Day advancement stops for unresolved career, review and foreign-counter events as well as existing crises/reports. Last-day retirement consultation may still be continued if valid. No auto-accept or skipped rare report.
- This remains regular-season staging. Native inbox views, full off-season flow, postseason, foreign-counter commands and year rollover are not yet connected. Tests use isolated server fixtures; CI required before integration.


## Canonical offseason entry increment
The server uses the existing persisted calendar flow for post-143-game entry, daily offseason clock, award and settlement acknowledgement, and own FA/posting/overseas declaration decisions. No calendar bypass: unsupported ready events block progression. Actual season simulation already computes awards and postseason; no duplicate calculation or rollover. Add missing careerDecisionTick to real daily advancement. Actual one-season entry test uses reserve-isolated existing simulation and requires CI. Draft, cuts, renewals, training, market, commerce, opening and year rollover still require explicit commands and native views.


## Canonical draft and roster cut increment
Explicit annual draft commands for manual nominations/pass, CPU-only progression, sealed lottery reveal, dialogue, actual offer, delegated contract, recovery dismissal and finish. Existing draft functions and original roster projection/cut rules reused. Draft can exceed the future roster limit until cut confirmation; all 12 club projections must then fit. Hidden names and lottery winner remain masked until appropriate reveal (full special player portrait/scout/reveal UX not connected). Separate full-season fixture-driven integration test; no production rollout. Contract renewal and later annual events remain unsupported.


## Canonical renewal and training increment
First/second renewal rounds use the original calendar dates and renewal functions. Individual or bulk offers, optional performance bonuses, release/restore, first-round pending and explicit final release. No repeat offers in a round, no early second round. Autumn training accepts valid individual menus and parks until the real report date. Winter dispatch uses original eligibility (five pro years, max four), destinations, cost and report, with no duplicated charge. First-round and winter integration test uses actual regular season; second round and autumn completion await commerce integration because the fan festival is a real blocking event. No native screen integration or production merge.


## Canonical annual commerce increment
Connect existing fan festival scheduling and completion, TV guest selection and live report, fanclub design/fee/perks, sponsor selection, broadcast negotiation and naming rights. Strict typed commands and original calendar/finance handlers; no generic job completion bypass. Actual season integration test extends through second renewal. Remaining: movement market, booking/rollover/preseason, screen integration. CI pending.

## 100-season actual checkpoint results
Run 45785036741 passed both 2- and 100-season storage tests. 50-year JSON 84,559,947 bytes, encoded 14,596,401, RSS 1,808,056,320 bytes; 100-year JSON 167,281,128 bytes, encoded 28,978,862, RSS 3,254,300,672 bytes; complete SHA256 match, closed backup restore, rollback and isolation. 100-year restore 3476.61 ms, view 2333.26 ms, achievements 2425.1 ms (6919). Reserve-isolated, not economy pass or concurrent server SLA. High RSS and latency require separate production resource/concurrency audit; no history deletion.


## Canonical transfer market increment — staging only
- Reuse persisted calendar and real FA/return market rooms, opening-eve/opening/results acknowledgements, original negotiation turn functions, selectable 1–10-year contracts, delayed answers and explicit acknowledgement, CPU closure and compensation confirmation. Expose only own visible offers and public outcomes; never disclose rival bid values or hidden foreign prospects. No generic completion bypass. Free-agent bidding, exchange, trade and compensation dispatch existing functions with strict IDs and bounded input. Annual advancement can cross December only while market is unresolved, not into unsupported rollover; January bound is defensive. Actual full-season commerce check extends to market closure; optional dialogue coverage depends on generated candidates. Full delayed-offer/compensation coverage, all other annual events, exact salary editor, native UI and production tests remain open; CI pending. No main merge.


## Canonical year transition and preseason — staging only
- PR66 initial dedicated CI failed in persisted market news; restored shared job/desk reference after JSON load and applied explicit existing state transitions. Corrected commit 9e1b7ba passed dedicated and aggregate CI. Subsequent exact salary and special-result gates require their own CI.
- PR67 uses actual flowDay/flowRollover/nextSeason rather than constructing a new world: camp site hierarchy, one-time booking fee, rookie entry with staged ability disclosure, decade acknowledgment, self menus and optional support, camp kickoff and scheduled visits, exhibition policy and report, opening promotion and first official match. Reject regular day bypass while preseason or required opening/rookie reports remain. Preserve archive and original engine calendar. Actual full-season integration test now extends to the next opener. CI pending; full native projection and foreign negotiation response paths, long-run multi-year canonical and performance tests remain open. No main merge or production activation.


### Canonical achievement fidelity and individual FA negotiation
- Expand server-derived achievement candidates from the existing album and recorded rare news; maintain previous reward IDs, own-club scope and original record keys. Do not infer awards from headlines or expose undisclosed scout data. Overlapping special and ordinary record entries use one identity.
- Exact FA salary commands use the original negotiation bounds instead of a separate 5億 ceiling. Individual negotiation regression uses a separate generated-world fixture with controlled finances, never the real season under test. Includes delayed response, counter acknowledgement, exact salary, multiple years and duplicate rejection.
- Dedicated integration and aggregate CI required before adoption; native screen connection, real providers, main merge and device validation are not claimed here.


## Canonical staging metadata and storage boundary
PR73 dedicated and aggregate CI passed (45817579618 / 45817579627). Staging game authority may now be enabled explicitly with PL_CANONICAL_GAME_ENABLED=1; default off, production release gate unchanged. Container bundles exact checked-in index.html. Authenticated game/slots returns slot/world/revision metadata only, no stored world or client import. Metadata-first lazy state read avoids decompressing long histories for rejected revision, order observation, committed replay or proof-pending response. Read-only ledger snapshot no longer rewrites wallet for canonical reads; no history deletion. Resource tests use deliberately corrupted isolated state to prove metadata-only reads and guard failures avoid decode; do not infer memory SLA or production readiness. Real auth, load and full native UI remain external or unfinished.


## Canonical free market browsing (staging only)
Authenticated `/v1/game/free-page` reads a bounded page (1–80) or normalized name search from the existing free-agent list. Requires matching slot world ID and revision before decode; no mutation or save change. Same projection and hidden-arrival guard as club view. Native client/session exposes the read, invalidates on mismatch and never retries; existing UI not yet connected. Isolated >80 candidate fixture and actual HTTP session regression added; CI pending. No production or main changes.


## Canonical club identity and slot selection increment
Original club/GM identity editor fields are accepted on canonical creation or explicit confirmed identity update; enum/length/hex validation rejects additional fields, image/CSS payloads and arbitrary state. Actual applyIdentity is used, with safe public team identity in the projection. Session offers authenticated metadata-only slot listing and checks confirmed empty occupancy before issuing creation; server still rejects racing duplicate creation. Dedicated original-engine and HTTP integration checks expanded. Existing game title/setup UI integration still open. No production flag or public release change.


## Canonical slot previews without long-history decode
Nullable preview migration on authority_worlds, updated atomically with each trusted state write including reward settlement. Existing preview-less rows remain occupied and are not decoded for listing. The actual engine derives a bounded public team/GM/year/day/wins/cash/logo projection without VM execution or history copying; no hidden players or client data. Native account client validates the optional preview. Corrupt-world metadata and rollback checks plus actual HTTP slot tests updated. Old backups remain readable, deletion removes the same row. No production activation; native screen wiring still pending.


## Staging native title/setup UI pilot
`PL_CANONICAL_UI_PILOT=1` (default off, requires authenticated staging configuration, rejected in production) applies the source adapter at native packaging. Uses original title/portal/universe artwork and original club setup editor; three slots from server metadata, existing world read or confirmed new world create. No legacy IndexedDB save load/write, local reward or backup export in this pilot. Missing metadata stays occupied; failed list stays unknown; interrupted create is observed, never resent. Account/connection loss invalidates the display. Deliberate post-setup hold until actual main game screens are connected; no replacement management game, no production or public deployment. Slot deletion and further gameplay UI remain open. Compile/anchor regression and browser fixture are separate from physical device/provider checks.


## v0.9.190 canonical roster command increment (staging only)
PR81 UI/test patch ported to the canonical stack in PR82, preserving account and title integration. Add server-side confirmed deterministic recommendation, batting-order insertion and defensive-role replacement using the same original engine helpers. Reject unchanged recommendation, unavailable candidates, invalid roles and blocked/reveal state. Expose bounded eligible player/role pairs and shortage/off-role warning IDs only in the existing visible club projection. Extend real engine and authenticated HTTP lost-response tests. No arbitrary client state, local save or automatic resend; undo journal and actual screen wiring remain open. No public merge or production activation. CI pending.


## Canonical one-step lineup undo
Trusted world stores one bounded previous batting order/fielding assignment and resulting fingerprint. No client snapshot accepted. Require same team/year/day, exact current fingerprint, eligible players and normal management/reveal guards. Clear on successful undo or unrelated game mutation, including reward application; a new roster change replaces the entry. Read-only calls and persistence do not clear it. Revision CAS still applies; invalid or stale operations do not commit. Tests cover reopen, injury, invalid payload, changed roster and HTTP recovery. Actual game screen integration remains open. No production activation.


## Canonical roster screen pilot
Extract the original v190 field/order markup into a shared renderer. Staging pilot supplies bounded visible roster fields and server candidate reasons; no local world assignment, save, or simulation. All changes use the authenticated session commands and show only returned canonical state. A lost response removes the editor until explicit observation of the same world; no automatic replay. Startup/slot and roster UI are connected for staging; full HQ and gameplay remain deliberately held. Browser fixture now exercises original field screen, actual HTTP order and lost undo response, and local-save isolation. Portrait projection contains only visible roster appearance fields. Physical device and full UI remain open; no production activation.


## Canonical world CAS and headquarters first slice (staging)
Advance requires the exact world UUID and revision before decoding state. The two remaining direct regression callers were updated. Headquarters pilot reuses the original hero, displays bounded date/rank/payroll/fans/opponent and last score, and sends one calendar-day command. All unsupported event boundaries remain blocked, never acknowledged silently. Lost replies clear the screen until a same-world read; no replay. Full duty navigation, event screens, speed and skip remain open. Public PR81 is independent; no production authority activation.


## Canonical calendar playback slice (staging)
Expose existing calendar targets and bounded routine report summaries. Authenticated day command defers only verified archived non-explicit reports, never important events. Fix invalid milestone deferral function reference. Client loops over individually committed days with normal/fast/skip pacing, explicit season confirmation, pause at request boundary, same-session resume, visibility stop and no mutation retry. Full match/news presentation, full archives, durable cross-session playback target and event UI remain open. Long-term load is not yet qualified; no production activation.


## Canonical read-only roster and standings slice
Reuse original player cards and standings table with explicit projection arguments. Render own player portrait, affinity, ability strip, condition and season stats from the server snapshot; never use a local world or expose hidden scout candidates. Standings limited to twelve clubs. No mutation, no history deletion. Career history, player memo, training mutations and full detail parity remain open. Staging only.


## Canonical roster operations and paged free market (staging)
- Add authenticated rotation selection from eligible healthy first-team SP candidates; existing rotation entries swap, server verifies selection and revision. Farm auto/manual and explicit promotion/demotion use existing club commands. Free agents now use the existing authenticated revision-bound free-page route, 30 rows per page with name search, previous/next and explicit cost/salary signing confirmation. No arbitrary client roster state, automatic mutation resend, local saves or production activation. Sign command is now also held until arrival/reveal disclosure permits it.
- Browser regression covers read-only search/page navigation, failed read hides stale data and recovers by read only, rotation swap and farm mode persistence. Remaining: direct browser verification of promotion/demotion and signing, original presentation parity, full career history/GM memo, annual event integration and performance; CI not yet confirmed. No engine economics changes.


## Canonical club economics and training UI (staging)
- Connect all eight facility upgrades/downgrades, current/next annual maintenance, explicit cost confirmation and no refund on downgrade; show server forecast/reserve, stadium capacity and original level-dependent stadium SVG, original facility images/illustration fallback and grade bars. Five seat prices are validated and committed together; travel and support use original server commands. Manager tactics, hiring and eligible renewal are connected; per-player focus uses the original skill set. Farm movement availability is projected using the engine's actual demotion rule; manual moves switch to manual as in the original game. Existing production holds remain.
- Browser tests cover actual medical upgrade debit, no-refund downgrade, ticket price, travel, manager tactics and training focus. Manager hiring/renewal/support and other facility branches still need full UI testing and visual parity audit. Existing costs are unchanged.


## Canonical player career history and GM memo (staging)
- Add authenticated, own-player-only, world/revision-bound player-page endpoint, ten saved years per page; official and farm totals use the original engine accumulation and remain separate. Ability history uses saved annual snapshots, with missing data explicitly absent. Titles are bounded per year (overflow count shown; original records retained). No extra career payload in the daily snapshot. A read never advances the revision. GM memo is saved explicitly through a validated own-player mutation with original 2000 UTF-16 code-unit limit; UTF-8 JSON budget increased only for memo commands. No auto-retry, no local state mutation, no pre-reveal access.
- Added engine and browser tests for paging, totals, rival rejection, read-only revision, memo length/escaping and Japanese persistence. Remaining: historical transfer-by-club and prior-life detail parity, end-to-end visual audit, further load profiling. No production activation.


## Canonical annual office first slice (staging)
- Add dated job board with scheduled/ready/active/waiting/done labels, offseason start/day commands, first three explicitly supported events (awards, settlement, FA/overseas departure requests) and archived review/month/milestone summaries. Awards reuse original portrait and achievement styling; annual finance uses the original annual arithmetic, with no additional payments. Important pending events and unsupported jobs remain held and never auto-completed. No full annual UI parity or production activation.
- Real 143-game season harness verifies award and finance projections and existing lifecycle checks. Browser verifies fresh season board and unchanged revision; actual annual browser traversal, full report visual/audio parity, draft, renewal, training, recruitment and reward event UI remain open.


## Canonical draft and roster-cut UI (staging)
- Wire original draft phases, server-side three-task scouting budget, estimated ranges (secret prospects return no real ability, name or appearance), per-announcement confirmation or explicit summary, sealed lottery stages, three-question recruitment, offer levels and role, roster projection and explicit cut confirmation. Reuse existing rare cinema and portrait styling. Unresolved ad recovery remains optional but provider UI is not connected. No fake ad success or automatic draw selection.
- Real annual engine regression now covers research budget/idempotent rejection and sequential announcement cursor. Full browser traversal, original timed animations/audio, complete pre-draft season scouting and rare recovery UI remain open. Staging only; no production activation.


## Canonical renewal, training and preseason UI (staging)
- Connect two-round renewal, individual and bulk offers, bonus options, retire/release/restore and final confirmation; autumn/self training intensity and focus, winter map/assignment (four-player maximum), pre-paid camp selection with original map and terrain visuals, visit choices including correct rest illustration, winter return and recorded training deltas, exhibition policy/meeting, three-scene digest with explicit skip/confirmation, and team-color/logo score list. Self-care is optional and comes after planning, with review available. Only server commands mutate game state. No new economy formulas.
- Actual annual engine harness covers self-plan review, camp prepaid accounting, exhibition results and mandatory digest confirmation. Full event browser traversal, automatic cinematic timing and final appearance review remain open. No production activation.


## Canonical transfer market UI (staging)
- Connect eve/opening/results market news, eligible room entry, staged special-result acknowledgements, dialogue with actual player speech and trust/satisfaction/caution, salary bounds, one-to-ten-year contracts, explicit offer/reply/counter/withdrawal, home/date progression, free-agent salary offers, one-to-one trades, exchange draft and eligible compensation. Trade candidates are projected only inside the active other-market room, not daily snapshots. Server remains the sole decision authority. Existing FA simulation rules unchanged; ad-assisted recovery UI, normal in-season trade, full cinematic parity and browser traversal remain open.
- Annual engine regression verifies market room transitions and projection/offer bounds, trade pool eligibility shape and removal after CPU close. No production activation.


## Canonical commercial events and season opener (staging)
- Connect all seven commerce jobs, actual sponsor risk and selected contract sum, fanclub name/design/fee/perks and original member-card layout with sticky preview, true membership result and celebration, media guest selection (five) and long-press read-only detail, fan festival booking/live/report, broadcast negotiation, naming rights, opening promotion and season opening acknowledgement. Reuse original art helpers with explicit authoritative team argument instead of local-world lookup. No economy formulas modified. Long press does not select a player. All game mutations remain server-validated.
- Annual engine regression verifies sponsor and fanclub actual contract data. Full commercial browser walkthrough, animation/audio timing and viewport parity require further testing. No production activation.


## Canonical important inbox first connection (staging)
- Connect explicitly acknowledged injury, retirement consultation and farewell selection (maximum five, original fees and authority), rookie staged arrival, finance terminal decision with confirmation, rare-category and decade acknowledgements. No fabricated loan or ad proof; medical and retirement ad UI remains pending. Rare news full text/cinematic and decade presentation are not complete. Rookie secret names masked until stage two; actual ability and appearance seed withheld for every rookie until stage two. Roster and player history remain blocked before finish. No main or production activation. Added isolated rookie stage regression to the existing manager/roster check; visual/browser walkthrough and other important-event branches require additional tests.

### Rare notice / rookie disclosure follow-up (draft)
Reuse existing news, medical, consult, farewell and join cinema helpers. Archived news text is exposed only for confirmed registered players; unresolved or prospect news is category-only. Rookie past-life appearance is projected only at stage 2, permitting the original composite cinema when eligible. No invented article or asset. No production enablement. Visual/audio parity and device walkthrough remain open.

## Consolidated inbox branch
PR107 retains its stronger disclosure and cinema projection; PR106's packaged browser rookie response-loss fixture, unrelated command guard and decade regression are ported. Do not merge both siblings independently. No production changes.

## Canonical staging rewards screen
Use existing canonical reward orchestration through the selected session. Explicit ticket/verified entitlement only, no native ad request or fake proof. Pending orders can be reconciled or explicitly cancelled; unknown outcomes require a read, never retry. Screen obtains fresh authoritative wallet/actions before presenting choices. All eight engine reward routes are displayed only when the server lists them; actual ad SDK/SSV, achievements UI, per-route browser validation and production remain pending. Session fixture tests lost settlement response.

## Archived match and latest newspaper (staging)
Project a bounded actual last own-club match (innings, score, teams/emblems, events, box stats and two-entry default bench report) and the last recorded daily/weekly paper. Read-only screen; no client simulation and no synthetic match stats. No full historical pagination, live inning playback, weekly mail detail or original cinematic equivalence yet. Existing engine fixture checks exact scores and read-only state. No public or production activation.

## Memorial achievement wallet UI (staging)
Bounded 1–40 item achievement-page endpoint with world/revision check. Reuses existing verified event IDs and own-club eligibility; no new rewards for sharing or client-asserted events. Explicit claim choice, server wallet refresh, duplicate/cooldown/capacity messages, unknown outcome refresh without replay. Current implementation still scans the existing achievement index before slicing; persistent indexed history and SNS art/share remain open. HTTP projection and confirmation regression added; per-claim browser and provider tests remain open. No production activation.

## Committed date and inning playback (staging)
PR113: use original watchReplaySteps with bounded projection and exact final scores; no synthetic scoring moments. Normal/fast day progression presents actual committed date, inning replay and original newspaper layout, skip retains current direct progression. Replay/skip/pause is presentation-only after revision confirmation. On session change discard transient state, reward/achievement notes and caches. Engine score consistency and browser replay skip regression. Original portrait effects/audio and full parity remain open. No production activation.

## Bounded match and newspaper history (staging)
PR114: year-filtered reverse chronological own-club matches and archived daily/weekly papers, 1 match or up to 3 papers per read. Server world/revision check, bounded 256 KiB page; no mutations, no invented historical data. Confidential events hold access. Historical player/club presentation uses current saved registry; old missing box stats remain missing. Full state is still decoded per request; indexing and resource isolation remain open. Engine/HTTP regression. No production activation.

## Ticket exchange and real HTTP reward regression (staging)
PR116: expose only the existing 1-point ticket exchange, with confirmation, server wallet reread and no automatic retries. Do not expose purchases of unconnected cosmetic benefits. Isolated packaged-browser fixture persists a test memorial record and 8-day injury; exercises actual HTTP claim, exchange, special treatment, deliberately lost settlement response, read-only recovery and exact one-ticket/one-revision deduction. No fake ad proof or production activation. Other reward routes still require browser coverage.

## Regular season trade (staging)
PR117: explicit rival selection, eligible roster and original gmTradeQuote read via revision-checked endpoint. Confirmed execution uses original gmTradeExecute (max 3 per side, signed fee, July 31, protected players, roster and both budgets). Revalidate quote at commit. No client mutation. Actual engine fixture tests cash conservation, duplicate and confirmation guards. Browser walk-through pending. No production enablement.
