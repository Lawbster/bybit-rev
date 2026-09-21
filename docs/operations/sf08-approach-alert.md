# SF08: one imminent-setup warning

Implemented locally 2026-09-22; not yet deployed. Observational only. No strategy,
account, sizing, timing, entry/exit or native protection changes.

## Trigger and message

Within the last **10 minutes before a UTC 4h candle closes**, send
`HYPEUSDT: LAWBSTER / SF08 entry approaching` only when:

- The exact SF01 detector's known range, first 0.1% sweep and provisional reclaim
  qualify. Confirmed anchors only; consumed highs, gaps, publication delays, old
  sweeps and expiry retain their normal rules.
- The same SF08 bracket builder accepts the original 0.2%-5% structural risk,
  original 2R target, and additional 5% stop padding. Preview prices may change.
- The owner is armed, entry-unpaused, flat, not pending/recovering, past its entry
  watermark/cooldown, with healthy decision context and a flat exchange observation
  less than 30 seconds old. Discord must be configured.

The message includes range low/high, latest known minute close, sweep-to-reclaim
extreme, UTC 4h close time, provisional TP/SL, source-minute end and setup ID.
It is **not** a trade signal or win-probability estimate. Final closed-bar and live
account/margin/quote checks remain necessary. Actual decisions retain the 60s
post-close availability lag. A fast/late setup can legitimately enter without a
warning; trading never waits for an alert.

No approach-distance notices, stage-by-stage updates, countdowns, cancellation
alerts or extra startup messages. Normal trade notifications are unchanged.

## Causality, load and delivery

- Closed 4h bars/pivots are cached from the existing owner scan. No retained copy
  of its 32-day minute array. Only during the 10-minute window, at most once per
  minute, read a bounded 1 MiB tail for the current 4h prefix. No new PM2 process
  and no additional exchange requests.
- All observed minutes must already be closed/available, with the same modeled
  60s lag and receipt rules as the owner. The whole prefix must be continuous and
  current. Future data never supplies a sweep, reclaim or pivot. The unfinished
  4h prefix is explicitly provisional; preview events remain non-executable.
- Persistent claim before HTTP: at most one warning per setup, and at most one
  setup per 4h close, across restarts. Do not delete the sidecar to reset it.
- Only a definite HTTP429 rejection may retry, respecting `Retry-After` or JSON
  `retry_after`, up to three attempts and only while the setup remains eligible
  in the same pre-close window. Ambiguous network failure/crash is **not retried**:
  this favors no duplicates over guaranteed delivery. A rejected/failed warning
  can therefore be missed. It never delays an entry or creates a later backlog.
- Delivery and candle I/O run outside the awaited owner loop. Trading state is
  untouched. A corrupt/unwritable alert ledger disables only approach notices;
  health/watchdog expose the fault as a warning. Existing trade-notification and
  ladder transport retry behavior is unchanged by this narrow implementation.

Sidecar: `data/HYPEUSDT_lawbster_sfp_state.json.approach-notifications.json`.
Retention is 45 days, longer than the detector's maximum setup lifetime.
Health: `.approachAlert` in the normal SFP health snapshot. Its `lastDelivery`
can be `sent`, `rate_limited`, `failed`; `error` is observer failure, not trade
recovery. Watchdog incident: `sfp_approach_alert_unavailable` (warning).

## Verification and rollout

```bash
npm run test:sfp-approach
npm run test:sfp-live
npm run test:sfp-parity
npm run build
```

The full parity check uses local archived research artifacts; it need not run on
VPS. It compares frozen 60/120s events/actions and all 235 rolling boundaries,
including equality with/without the new cache. Focused tests cover causality,
missing/late/conflicting data, consumption/risk, expiry, restart/crash dedup,
nonblocking I/O, HTTP429 timing and read/write failures. No real exchange or
Discord calls are part of these tests.

After commit/push, preserve the VPS's armed `sfp-live-config.json`; it is not
changed by this patch. Deploy outside the 10-minute warning / entry window.
While flat with no pending/recovery, pause new entries, pull/build/test, restart
only `hype-sfp-live` and `hype-health-watchdog`, verify fresh healthy account
reconciliation and `.approachAlert.error == null`, then remove the SFP pause and
save PM2. Do not restart the ladder or revive retired short processes. If a trade
is open, leave its manager running and wait for a reviewed safe restart point.

```bash
jq '{status,entryEnabled,position,pending,recovery,approachAlert}' \
  data/HYPEUSDT_lawbster_sfp_health.json
npm run watchdog -- --once --dry-run
```

Do not generate a synthetic live setup just to test Discord. A preview alert
does not grant new authority to change a position. Manual overrides, if chosen,
must remain isolated to LAWBSTER and separately attributed from strategy results.
