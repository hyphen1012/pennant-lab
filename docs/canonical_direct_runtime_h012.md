# H012 direct-text staging composition

PR158 12/12合格。100年同一SHA・encoded 5516.515ms/2301556KiB→direct 3271.354ms/1156344KiB、HTTP5696.351ms/2455048KiB→3357.654ms/1283548KiB。明示projectionMode:'direct-text'のステージング構成を追加し、既存の注入Workerとの併用・不正mode・canonical engine無し・RSS閾値無し・heavyLimit>1・productionを起動前に拒否。未指定は従来通りWorker無し。実HTTPの読み取り、確定変異、再起動して旧方式へ戻して一致を試験。2GiBは試験のsoft admissionのみ、OS上限や本番値ではない。配備・本番変更なし。
