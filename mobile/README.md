# PENNANT LAB native pilot
Capacitor 8 + community AdMob 8.3.0 (Google Mobile Ads SDK) integration. Web development build remains unchanged/offline-capable. App ID jp.pennantlab.game is provisional; confirm before registration. Generated android/ios/www directories are build products.
- npm install; npm test; npm run prepareWeb; npx cap add android / ios; node configure-native.cjs; npx cap sync android / ios.
- CI builds Android debug APK and unsigned iOS Simulator app; these are not store submissions.
- Default build strictly uses official demo application/ad unit IDs; no real revenue. Release requires PL_PRODUCTION=1 and real Android/iOS PL_ADMOB_*_APP and PL_ADMOB_*_UNIT, plus published consent messages, signing, store registration, privacy disclosures, and platform validation.
- Health endpoint uses HTTPS response content and cache-busting. Native UI blocks when unreachable, daily engine checks at safe boundaries, off-season checks and app resume invalidation. Save storage stays local. No background auto-resume. Demo health endpoint depends on GitHub Pages; availability and ownership need release review.
- Reward only from successful native SDK return, never dismissal; optional ads and consent errors never prevent ordinary online game progress. Native backup shares a local temporary JSON file. Native restore, lifecycle, accessibility, connectivity and ad flows require emulator/device checks.
- Docs: https://capacitorjs.com/docs/getting-started ; https://github.com/capacitor-community/admob/blob/main/docs/rewarded.md ; https://github.com/capacitor-community/admob/blob/main/docs/consent.md

## Billing preparation (no production billing)
- `src/entitlements.cjs` implements a tested, store-neutral entitlement state boundary for the proposed durable ad-skip and time-limited VIP concepts. It denies unknown, stale, revoked, expired and account-mismatched verification, and discards in-flight results after an account switch.
- This is not receipt verification. No store SDK, receipt verifier, purchase UI, prices, product IDs, reward ticket or VIP multiplier is enabled. Integrate the independently verified platform adapter after product design and store account configuration. Never use save data or a local boolean to grant purchases. Restoration and refund/revocation scenarios must be tested against the real stores before release.

- v157: native gate uses monotonic time, expires the prior lease while a renewal is pending, checks expiry before app clicks and refreshes the offline overlay independently of network probes. Device lifecycle and actual physical-device behavior still require testing. Native npm test now includes the account-client reference regression; no live account endpoint is connected.
