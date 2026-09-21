# SF03 — buy a later return to the confirmed sweep low

Research-only. Entry-only test requested after SF02, not a live change.

- Resume at [findings](../../research/codex-astra-sfp-sweep-limit-findings-2026-09-20.md).
- Frozen [card](../../research-inputs/range-low-sfp-limit-sf03-2026-09-20.json).
- Reuse the saved **SF01 range-qualified 4h** detections. No rescanning or map reconstruction.
- Baseline market entry versus limits at first sweep low / 0.1% above it.
  Confirm first, wait at most4h, original absolute SL/TP and original signal-risk
  eligibility unchanged. $10k fixed notional, same dates/costs/publication delays.
- 24h primary/72h secondary holding cap from actual entry. Pending orders own
  occupancy too. Each signal gets one attempt, exclusive expiry, no replacement.
- Touch fill versus minute-open-through-cap sensitivity. No price improvement,
  taker fees retained. A resting limit that gaps through the SL fills and loses.
  Before initial placement an already-invalid bracket is cancelled. An unfilled
  order is cancelled if a later minute opens at/above original target.
- Entry-bar high may predate a limit fill. Primary requires close>=TP on that
  minute; stop-first on ambiguous stop/target. Optimistic ordering reported
  separately. This does not establish live order-book queue priority.
- Do not silently widen the stop, reset2R from cheaper entry, use SF02 signals,
  or filter by later recovery. Those would be separate strategies.

## Reuse and verification

```powershell
npx ts-node scripts/structural-limit-entry-tests.ts
npx ts-node scripts/structural-replay-audit-tests.ts
npm run test:setup-replay
npx ts-node scripts/range-low-sfp-limit-study.ts
npx ts-node scripts/range-low-sfp-limit-report.ts
```

Study replays the untouched baseline on the extended structural kernel and
requires exact saved totals/monthly and byte-identical closed-trade CSVs at
both source lags. Candidate actions must be identical after removing only
their entry-limit field. The independent structural audit checks every path,
including pending order expiry/occupancy. Synthetic tests cover causal timing,
fill-bar ordering, gaps, hold clock, cutoff and tampered evidence rejection.

`backtests/range-low-sfp-limit/latest.json` points to the sealed study.
`comparison.json` links every replay and stores baseline parity, results,
monthly rows, removed-winner attribution, intent reasons and causal traces.
Each replay saves `intents-<cell>.json` and `trades-<cell>.csv`; two interactive
maps reuse the chart builder. Completed jobs are hash-verified and reused.
Verification reports live separately under `range-low-sfp-limit-reviews`;
sealed economic artifacts are never patched by report generation.

Screen remains the parent SF01 screen, relative to its same-hold market
baseline, required across both fill models/lags. These are development-data
tests, not new forward evidence. HL recovery analysis and wider SL remain
separate pending work.
