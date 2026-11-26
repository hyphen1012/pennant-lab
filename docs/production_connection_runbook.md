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
