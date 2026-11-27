# UltimateLAB audit ledger — H020

Internal audit scope, not a quality certificate. Source: mobile/canonical-title-pilot.cjs at 091688af85aa524438ae31acf6a0c082a4ce55c3, canonical render dispatcher, canonicalOpsPages, canonicalAnnualJobs, canonicalCommerceJobs, movement-market special branch. All entries are OPEN for visual/audio/device signoff even when regression tests pass. Preserve successful existing work; only change material defects. For each entry subsequently record defect/severity, target quality, action or reason to retain, before/after evidence, regression SHA/run, device evidence, limitations. Do not treat route presence as function or UX completion.

## Canonical page inventory (16)

| ID | Screen | Specific audit focus | Visual/audio/device |
|---|---|---|---|
| canonical-ready | 接続済み世界の入口 | 試験用文言/正式導線 | OPEN |
| canonical-hq | 本部 | 試合結果・日付・速度・音響・狭幅 | OPEN |
| canonical-roster | スタメン編成 | フィールド/一覧、任命・交代・色・長押し | OPEN |
| canonical-players | 全選手 | 復帰位置・長い一覧・色 | OPEN |
| canonical-player | 選手詳細 | 上半身・能力・履歴・GMメモ | OPEN |
| canonical-standings | 順位表 | 東西・球団ロゴ・横幅 | OPEN |
| canonical-reports | 試合・新聞・10年史 | 実記録・再検索・復旧 | OPEN |
| canonical-achievements | 実績 | 記念演出・秘匿・取得条件 | OPEN |
| canonical-rewards | 交換・権利 | 消費確認・失効・未接続品 | OPEN |
| canonical-events | 年間業務/重要報告 | 優先順・非強制・秘匿・音響 | OPEN |
| canonical-rotation | 先発ローテ | 直感配置・状態 | OPEN |
| canonical-farm | 一軍二軍 | 昇降格・一覧維持 | OPEN |
| canonical-free | 自由契約 | 検索・ページ・通信復旧 | OPEN |
| canonical-facilities | 施設・球場 | Lv表示・客席/チケット重なり | OPEN |
| canonical-manager | 監督室 | 空間・上半身・会話・スクロール | OPEN |
| canonical-trade | トレード | 相手球団・比較・確認・再照会 | OPEN |

## Annual jobs and market (23)

| ID | Event | Audit status |
|---|---|---|
| awards-all | 表彰 | OPEN |
| settlement | 収支 | OPEN |
| movement-declarations | 移籍宣言 | OPEN |
| movement-market | 移籍市場（専用遷移） | OPEN |
| draft | ドラフト | OPEN |
| roster-cut | 戦力外 | OPEN |
| renewal1 | 契約更改1 | OPEN |
| renewal2 | 契約更改2 | OPEN |
| autumn | 秋季キャンプ | OPEN |
| winter | ウインターリーグ | OPEN |
| booking | キャンプ地予約 | OPEN |
| self | 自主トレ | OPEN |
| winter-return | 派遣帰国 | OPEN |
| camp | 春季キャンプ | OPEN |
| exhibition | オープン戦 | OPEN |
| fan-fest | ファン感謝デー | OPEN |
| fanclub | ファンクラブ | OPEN |
| tv | テレビ出演 | OPEN |
| sponsor | スポンサー | OPEN |
| broadcast | 放映権 | OPEN |
| naming | 命名権 | OPEN |
| opening-promo | 開幕イベント | OPEN |
| offdesk-opening | 開幕準備 | OPEN |

## Additional surfaces not counted as canonical routes

Startup video, title, world slots/portal/delete, setup, replay match/digest/newspaper, award and mystery event variants, foreign negotiation, account/auth/consent, error/reconnect, audio settings, operating-system sharing, storefront and external native surfaces. Legacy index.html routes and nested modal variants require separate full enumeration; the current counts are not all game screens. Test at narrow/mobile/tablet sizes, large text, reduced motion, offline/reconnect, background/resume, hardware audio; use licensed assets only. Evaluate visual coherence, direct manipulation, hierarchy, immersion, BGM/SFX, state integrity and performance. All are OPEN for physical device evidence.

## Existing partial evidence (not closed)

PR176 HQ confirmed score browser; PR178 archive retry browser; PR181 roster return browser; PR173 mystery presentation browser; PR168 awards audio regression. Prior user-reported camp rest image, size mismatch, facility overlay and lineup color require actual device recheck. Do not mark any of these as newly verified by this inventory.


## H022 journey gate audit — Q1-MKT-001

External context: SEGA official notice 2025-02-07, https://www.sega.co.jp/release/250207_1.html : FM25 cancellation after UI/graphics renewal and quality work took longer than planned. This is a single case, not evidence of causal effect or quantitative risk for our game. Adopt only the missing journey-level evidence requirement; do not duplicate existing screen/RC gates.

Evidence inspected at PR184 ad25867012e170576b27d58c6e45624c07584823: scripts/canonical-title-browser-check.cjs (run 45965226250 success), scripts/canonical-trade-browser-check.cjs (45965226240 success). Real HTTP to test service with simulated native bridge; fixture paths and conditional branches do not certify all variants.

| Journey | Existing observed browser test code | Missing release evidence |
|---|---|---|
| Launch → world choice → setup → HQ → reopen | title/portal/create/reopen, offline and lost response, long-press delete/cancel | official media on devices, actual auth/OS lifecycle, cold start and audio |
| HQ → calendar/match → score/reports → HQ | step, lost response/re-read, weekly/normal/replay conditional, search and read retry, decade reread | full monthly/normal/fast/skip and off-season parallel flow; motion, audio, accessibility |
| Roster → edit → save → player history → return | swap/undo/refresh, long list scroll, focus/memo, rotation/farm actions | touch drag and manager auto, color/field/list, all positions, accessibility, physical device |
| Recruitment → compare → commit → continue | free agent search/paging/conditional sign; separate trade quote/invalidation/cancel/lost commit | FA/foreign/draft/renewal/cut full consecutive journeys, budget/rights, actual UI |
| Club → facility/price/travel/manager → continue | medical up/down, conditional price, travel, manager entry/order | all facility levels, overlays, camp illustrations, GM transfer/termination, physical devices |
| Annual business → report → continue | no-current-job, fixture rookie/foreign reveal, decade read; existing isolated annual regression not full journey | uninterrupted year through 23 jobs/market, ordinary report nonblocking, special priority/secret state, off-season concurrent operations |
| Achievements/rewards → exchange/use → refresh | real HTTP memorial claim, ticket/treatment, decor, preview/share via fixture, lost settlement | actual store/SSV, native share, rights revocation, offline/reconnect and all device variants |

Adopt under existing UL-PENNANT/T009: before/after evidence at same deterministic save and candidate SHA for each touched journey; preserve game state, navigation, action order, authoritative revision, error/retry, normal and interrupted flow. Record tested viewport/device/OS, input mode, audio/motion preferences, actual screenshot/video and known limitations. No mandatory cosmetic rewrite where adequate; retain with evidence. No quality signoff based only on CI or screenshots. Require a full sequential annual journey in addition to isolated jobs, and actual device walkthroughs. All physical device and release gates remain OPEN; no new independent task IDs and no release/expense/authority changes.
