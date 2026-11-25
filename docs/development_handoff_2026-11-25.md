# 開発引継ぎ — 2026-11-25 / v0.9.150
## ゲームの基準
本作は架空プロ野球12球団GM経営シミュレーション。参考ゲームPDFは機能・演出・操作性の品質基準であり、素材の複製元ではない。既存合意・無料難易度・施設Lv15高難度/Lv20超高難度、球団間公平な収支、日付進行と並行業務、任意リワード、VIP通常収入1.2倍、SNS投稿と報酬の完全分離を維持。IMMORTAL・輪廻転生の演出階級は測定不能。価格やポイント交換は暫定。本番購入・報酬・外部広告出稿は無断有効化しない。

## 実装済みコミット
- [6350599](https://github.com/hyphen1012/pennant-lab/commit/6350599aab2fdc9007d77326131847eeb244c26e) v149 保存gzip/旧形式読込/書込集約/破損拒否、学習AI対戦補正・探索頻度変更。
- [5c53141](https://github.com/hyphen1012/pennant-lab/commit/5c53141afc6eacb21c7439cc53bbd98f307933c1) 認証必須HTTP台帳・処理照会と回帰試験。本番接続なし。
- [e4c63d4](https://github.com/hyphen1012/pennant-lab/commit/e4c63d4c4e1a3bdd2948b4bd557bf20218eae420) VIP50年比較集約、実際の長期セーブ圧縮率・容量内訳計測。
- [4f2d3fb](https://github.com/hyphen1012/pennant-lab/commit/4f2d3fb78d3f904946745845eeedf5d2b6f43129) v150 VIPラウンジ、3デザイン、追加分析、記念画像強化、前世情報があれば二人構図。

## 検証結果・証拠
- [v148 100年](https://github.com/hyphen1012/pennant-lab/actions/runs/45608724024): 無補填85,800試合、最低資金6.06億、非圧縮JSON約167MB。全年度イベントUI試験とは異なる。
- [v149 学習AI](https://github.com/hyphen1012/pennant-lab/actions/runs/45614259810): 10年×5シード固定/学習。勝利差 +68,-69,+5,+46,+104、計+154、得失点差+606。旧 -21勝/-52得失点差、2/5正から4/5正。強さの一般保証はしない。
- [v149 ブラウザ](https://github.com/hyphen1012/pennant-lab/actions/runs/45614259821): 320/360/430px、327画面状態、検出エラーなし。保存試験用762800→57646バイト。実100年データの圧縮率ではない。美術評価・実機・全分岐網羅とは区別。
- [HTTP台帳回帰](https://github.com/hyphen1012/pennant-lab/actions/runs/45614814542) 成功。模擬検証器のみ。
- [v148 VIP50年](https://github.com/hyphen1012/pennant-lab/actions/runs/45608724026) 4試行完了。1937通常307.51/VIP1414.64億、8821通常264.64/VIP1434.22億。破綻0、全施設Lv20到達0。実手動プレイへの外挿は不可。
- v150 [回帰](https://github.com/hyphen1012/pennant-lab/actions/runs/45615094645)、[ネイティブdebug build](https://github.com/hyphen1012/pennant-lab/actions/runs/45615094611)、[年間モデル比較](https://github.com/hyphen1012/pennant-lab/actions/runs/45615094701)、[Pages](https://github.com/hyphen1012/pennant-lab/actions/runs/45615093983) 成功。
- 未確定: [v150 ブラウザ](https://github.com/hyphen1012/pennant-lab/actions/runs/45615094675)、[v150 VIP50年](https://github.com/hyphen1012/pennant-lab/actions/runs/45615094871)、[実データ100年圧縮計測](https://github.com/hyphen1012/pennant-lab/actions/runs/45614814410)、[自然到達全施設20+5季](https://github.com/hyphen1012/pennant-lab/actions/runs/45608724142)。結果は次回に実ログ確認。実行中を合格としない。

## 残課題の優先順位
1. 上記未確定CIのログ・成果物を精査。自然に最初の球団が全8施設Lv20に到達した時点と5季維持後の12球団を比較する。未到達/途中低下/資金破綻を明記し、補填や優先球団で合格させない。必要なら収支/投資判断を改善し再試験。
2. 学習AIの追加シード・部門別評価。年間全業務の実操作、全画面・特殊演出の視覚監査。通常・倍速・週/月/季スキップ、並行イベント、契約/FA/監督/キャンプ・育成・商業の全分岐。
3. 実データ圧縮率と端末性能の確認、500/1000年シミュレーション・復元・移行・履歴維持。gzipだけで容量・メモリ問題解消とはしない。旧版は圧縮済みセーブを解読できないため移行前バックアップ推奨。
4. AI事前生成の記念素材、最高級演出、共有対象・全広告導線、VIP追加機能とポイント交換。通常機能を有料に移さない。
5. 本番の独立認証・台帳・達成証明・ストア決済/復元/失効/返金・広告検証、プライバシー/権利/審査対策、広告事業基盤。現状は参照実装のみ。実際の出稿・購入・支払いは未実施。
6. Android/iOS署名/実機試験、修正、正式配信。実機監査だけが残った状態にはまだ達していない。

公開URL: https://hyphen1012.github.io/pennant-lab/?v=150
