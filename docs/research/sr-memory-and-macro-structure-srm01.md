# SRM01: local memory sensitivity and separate macro structure

September16,2026. Approved research only; no live gate, config or process changes.

## Frozen scope

[Card](../../research-inputs/sr-memory-macro-2026-09-16.json) was written before outcomes. Two distinct questions:

1. Does longer memory improve the current Agg10 partial-exit stack? Keep 30m/4x4/0.45%/two touches and all execution, fees, entry and exit settings unchanged. Compare 14/21/30/60/120 days. The readiness horizon changes with retention, just as production currently specifies.
2. Can an offline 4h/daily observer retain major resistance/support provenance across months? No macro trading policy or profit test at this checkpoint. The user's $75.401 is only a post-hoc reporting reference, never an input to level construction.

## Economic comparisons

- Recent: May17,2026 20:43 through September15,2026 20:20 UTC.
- Published/older: July1,2025 00:00 through August19,2026 21:32 UTC.
- Windows overlap; neither is an untouched holdout. Each starts independently flat at $32,000; do not add their profits.
- Each window/model first reproduces B17 and current Agg10 exactly: eight archived digest and metric controls. Four longer-memory variants then run on two windows and both TP assumptions: sixteen variants, twenty-four total paths, four new overlay definitions.
- Same repaired historical candles and quality-aware pulse tape as the September15 extension. No new history reconstruction, neutral substitution for missing HL, fee bonus, sizing or maker fill simulator. Retain 0.055% each side, inventory mark including hypothetical exit fee, all re-entries and transaction-preserving partial clocks.
- Resting-touch is the main price model; close-confirmed is sensitivity, not a proposal to delay live exchange TP to a candle close. Funding signals gate decisions, but funding cash settlements and exchange liquidation are not modeled.
- Economic screen: recent increment at least $1,000, older increment nonnegative, no individual month more than $250 worse, no DD deterioration, at least twenty changed partial episodes in each recent model. Passing this screen would still not authorize deployment or skip forward observation.

## Macro observer

Source windows and lifecycle are deliberately simple and frozen:

- Complete 4h and UTC daily candles only; three completed bars on each side confirm a strict pivot. A gap cannot be silently bridged to confirm it.
- Fixed first-pivot center; half-width 0.75% for 4h, 1% for daily. Later pivots may join but cannot drag the historical center or boundaries. Closest existing same-timeframe zone wins, earlier origin breaks ties.
- Two distinct pivot episodes, separated by at least24h for4h or7d for daily. Touches retain pivot and availability timestamps.
-120-day confirmation memory. Touches expire; when a qualified zone has fewer than two remaining touches it retires. A retired ID never silently revives. This is an explicit prototype lifecycle, not an optimal decay model.
- Two subsequent consecutive completed closes beyond bounds confirm a role change. A later wick into a support zone with a close above its upper bound records the first held retest after each flip. This is not a record of every subsequent touch or a buy permission.
- Full-window continuity is reported separately. Gaps reset consecutive-close counters. Old zones remain observable but do not imply healthy/new-trade permission.
- The daily observer is slower and stricter by design; a sparse result is preserved, not tuned after viewing outcomes.

No profit target, stop, cooldown, block, sizing, order or execution module is part of this observer. Future work must decide which known nearby zone is authoritative, how overlaps are treated, and how a new-ladder block expires/re-arms before economic replay. Testing every old support break as an unconditional veto is not implicitly approved.

## Verification

Unchanged causal engine, shared production S/R engine, immutable input/source/config/state hashes and rejected overwrites. Synthetic local-memory tests exercise nonempty prefix equality, future poisoning, expiry, insufficient warmup and gaps. Macro tests exercise delayed right-side confirmation, episode spacing, frozen bounds, strict chronology, gaps, source-delay and retirement. Real macro prefixes and +60s observation delays are checked; an independent checker re-aggregates source candles and validates every recorded pivot and role-change close.

The economic reviewer independently reconstructs quantities, fees, realized/marked PnL, DD and monthly totals; checks every Agg10 high exit and TP intent; rebuilds actual partial decisions using their original pulse and selected inventory; checks recorded zone touches and real prefix snapshots.

The initially pinned `sr-memory-verify.ts` has an audit-only cooldown-start error (fill time instead of decision time). It is preserved untouched with the frozen job. Use `sr-memory-review.ts`, which corrects that assertion to the unchanged engine's `decisionAt + cooldown`. The reusable target auditor also expected controller counters this job did not persist: the review-local copy retains every target-price/arming/transition assertion, returns reconstructed counts, and does not claim unavailable summary-counter parity. No economic definition or simulation result was changed. The review receipt fingerprints its checker. Macro's independent checker was added after the observational run; its fingerprint is likewise recorded.

```powershell
npx ts-node scripts/sr-memory-tests.ts
npx ts-node scripts/sr-memory-study.ts plan
node --max-old-space-size=8192 -r ts-node/register scripts/sr-memory-study.ts run KEY
node --max-old-space-size=8192 -r ts-node/register scripts/sr-memory-review.ts KEY

npx ts-node scripts/macro-sr-tests.ts
npx ts-node scripts/macro-sr-study.ts plan
node --max-old-space-size=8192 -r ts-node/register scripts/macro-sr-study.ts run MACRO_KEY
node --max-old-space-size=8192 -r ts-node/register scripts/macro-sr-check.ts MACRO_KEY
```

Completed jobs cannot be rerun into the same directory. A source/data change requires a newly pinned plan; do not remove claims or overwrite accepted evidence. An earlier unexecuted economic plan preceded a TypeScript checker fix and is not another trial.

## Completed checkpoint

[Findings and monthly comparisons](../../research/codex-astra-sr-memory-macro-findings-2026-09-16.md): all 24 paths and independent reviews passed; all sixteen longer-memory alternatives have lower net than their matching 14d Agg10 control. Keep local memory unchanged. The separate macro observer identifies the June/August role-reversal area, but has no trading-policy result yet.

- Economic key: `e430bb3e92c4cdd506a123851bb348fa32d1283733ada325ccf4159e5b34dab8`.
- Macro key: `2c11fded5e577d465ceffd46c83c12c7546ecc97f590cf3d3e0ef7529105f5d6`.
- Receipts and immutable result files live under `backtests/research-workflow/<key>/`.
