# 正式採用起動画面・原本登録先
2原本とも受領・実測確認済み。ファイル名と SHA-256 は以下。
- PARALAB_GAMES_startup_v8_SFX_reverb.mp4: 29a216ef4da027bb7883b120d082c37695d8c49ee31ae453b7a21a53bf1e77be — 8,667,750 bytes、7.000秒、1080×1920、30fps、210フレーム、H.264/AAC stereo 48kHz、全編デコード正常。
- PENNANT_LAB_title.webp: 8333353a897d7cfc6bd16f759b8eb251078daf4ab1a23efe53fdf3d5ef0587b2 — WebP 864×1536、画像内に開始案内あり。
このディレクトリへ原本2点をそのまま登録。設定済みパスで自動接続する。再生成・再圧縮・トリミング不要。GitHubの原本登録は未完（ローカルとGitHub接続間のバイナリ転送経路なし）。登録後に node scripts/startup-asset-check.cjs で原本照合、実動画ブラウザ再生とAndroid/iOS実機検証を実施。正式パッケージは両原本ハッシュ一致を必須とする。未登録時の開発用フォールバックは残す。
