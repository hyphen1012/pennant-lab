# H010 統合・直接JSON投影試作

PR156を基点にPR157の4ファイルを同じblob内容で統合。PR157の元枝は変更しない。停止時復旧の運用条件は従来通り。

圧縮済みDB rowのハッシュ/長さ/UTF-8整合を検証したJSONテキストを読み取り専用VMに渡し、ホスト側JSON.parse・JSON.stringifyと巨大なwrapper文字列の生成を省く。VMごとに独立してparse/seed/世界形状検証を実施し、view/actionsの正規化を共有しない。既存codec.decode、mutation、既定worker設定は維持。directText:trueの明示試作のみ。2/100年の同じ実生成世界で同期/従来worker/圧縮worker/直接text workerの出力SHA、時間、maxRSSを比較し、従来と直接textの両HTTP破損復旧・再起動も比較する。メモリ減少は計測前に保証しない。OS上限、正式バックアップ運用、本番未有効。
