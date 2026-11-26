# Account ledger — development reference
Node 22 SQLite transactions persist claims, vouchers, points, cosmetic exchange and reward reservations per authenticated account. No deployed web service, payment credentials or public deployment is included. Host must implement independent authentication, server-authoritative achievement issuance, StoreKit / Play receipt verification including revocation and expiry, verified reward-application acknowledgements, TLS, rate limits, backups, recovery and privacy/deletion controls. The test fixture adapters are intentionally not suitable for deployment. A local save and SNS share completion are never authoritative proofs. The account DB must not be bundled into the game app. Pending reservations require reconciliation after lost connections; no automatic grant based on a client callback. This reference does not yet solve server-side validation of locally simulated baseball results.


## HTTP reference adapter
`account-http.cjs` provides the account-ledger HTTP boundary. A host must inject a trusted service (including identity, event, entitlement and reward verification) and an explicit rate limiter. The adapter does not bind a public port or enable the game to claim production rewards. It validates methods, paths, JSON size and authentication, and can query an order's status for recovery. Run `node scripts/account-http-check.cjs` under Node 22 for test-fixture verification. Test adapters are not production credentials. A live deployment additionally requires HTTPS, monitoring, backups, privacy/deletion policy, secure client integration, store receipt/refund/revocation verification, advertising verification and authoritative achievement/application proofs.

## Client and limiter references
`mobile/src/account-client.cjs` is an HTTPS-only account HTTP adapter with bounded request time, session-generation isolation, no automatic mutation retries, wallet/order response validation, and order lookup for ambiguous operations. Its responses are observations, not authorization to apply a reward. `server/rate-limit.cjs` is a bounded single-process IP/token limiter; use shared atomic limits for multiple instances, and configure trusted ingress appropriately. Neither is connected to a live service or the game. No test credentials or local achievement proofs may become production authority.


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
