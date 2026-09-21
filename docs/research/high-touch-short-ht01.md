# HT01: standalone short at the rolling two-day high

Frozen September17,2026. User-requested local research only. No live change.
[Card](../../research-inputs/high-touch-short-ht01-2026-09-17.json).

## What is and is not borrowed from the ladder

Aggressive10 closes a surviving ladder from age4h when its completed-minute
close is within1% of the highest high over2880 continuous closed minutes.
The reference includes the just-closed minute. This is a full long exit, not
the separate S/R partial-exit rule, and not evidence that reversing short wins.

This study tests two independent entry predicates, no inventory prerequisites:

1. **Exact touch.** For observation minute[t,t+1m), freeze the rolling48h high
   ending at t-1m. With the declared60s publication allowance it is known at t.
   Signal when low<=high-reference<=high during the observation minute.
   A gap wholly above the reference is not a touch. No rejection/red-close
   requirement is added; a breakout touch may still close above the reference.
2. **Near-high1%.** The completed minute closes within1% of the rolling48h
   maximum including that minute. This matches the live price/context predicate,
   not live age, gates, TP priority, freshness execution or cooldown behavior.

Both signals are available at observationEnd+60s. Entry is the actual minute
open then, or60s later in sensitivity. **Never a retrospective fill at the high
or earlier touch price.** Exact-touch reference is intentionally one minute
behind the observation start to be known in advance under the same allowance.

Every qualifying minute emits a raw signal, saved with its exact source window.
One position per independent setup, no overlapping shorts. Signals while
occupied are skipped; after flat, another eligible signal can enter. No extra
cooldown, daily limit or first-touch restriction. Save contiguous qualifying
episode counts separately; many adjacent raw minutes are highly correlated.
Require full48h warmup; incomplete tape is rejected, not silently filled.

## Frozen economics

Each entry: timed12h no-barrier baseline and49 TP/SL combinations. TP and SL
independently2/2.5/3/3.5/4/4.5/5%; barriers retain a12h maximum hold. No24h or
uncapped expansion. Actual-fill-anchored short target and stop, gap exits at
actual open, stop-first on both-hit minutes, target-first sensitivity. An
intrabar exit cannot reuse that minute's already-passed opening price.

Fixed$10k per entry, one position, no compounding. Fees0.055% each actual side,
before funding; extra5bps/side stress. DD uses$32k initial equity and minute
adverse-price marks. Cutoff open inventory is marked with hypothetical exit fee
and kept out of closed W/L. No margin, borrow/liquidation or maker-queue claim.
Extra60s affects entry and scheduled timeout, not resting protection latency.

Full December5,2024 12:55 to September15,2026 20:20 UTC, exclusive end. Older/
recent reset June1. Same canonical minute cache as prior research, but **no POC,
NPOC, S/R map, HL or indicator inputs enter the strategy**. Rolling highs are
computed once and persisted; no reconstruction for every grid cell.

100 new definitions,1,188 reported window/delay/ambiguity paths. Cumulative
**9,055 standalone /205 ladder overlays**. These correlated trials are not an
untouched holdout. Own timed and own2/2 controls remain beside each result.

## Verification and screening

Before new economics, reproduce30 archived LV02 short paths: timed,2/2,3/5,
all three windows/two delays and applicable ambiguity orders. These are engine
regression controls, not the new short strategy's profitability baseline.

Independent reference audit uses block-prefix/suffix maxima, not the producer's
monotone deque. It checks every rolling-high minute, every qualifying/nonqualifying
entry opportunity, exact source/receipt clocks and contiguous episode counts.
Sampled windows also compare directly with the live pure high-context function.
Every unique execution journal receives independent minute first-hit/gap/fees/
ownership/monthly/DD reconstruction. Tests cover future-prefix/poison stability,
gaps, publication lag, short direction, both-hit and open cutoff positions.

Inherited screen: all6 window/delay nets and extra-cost nets positive, at least
30 full and10 per subperiod closes, no exhausted equity, every marked month
>=-$250 versus cash. Relative additionally improves own timed net, nonworsens
DD and keeps each monthly delta>=-$250. Failures are reported, not relaxed.

```powershell
npx ts-node scripts/high-touch-short-tests.ts
npx ts-node scripts/high-touch-short-study.ts
npx ts-node scripts/high-touch-short-verify.ts
npx ts-node scripts/high-touch-short-report.ts
```

Existing identical outputs cannot be overwritten. Read accepted journals and
reports instead of rerunning. Source/input/live-file hashes are pinned. No VPS
commands, exchange calls, configuration changes, commits or deployments.

## Accepted results

[Findings](../../research/codex-astra-high-touch-short-findings-2026-09-17.md),
[saved comparisons and monthlies](../../backtests/high-touch-short-reports/b66baaf224dbeafa68df168cca734c7f9e95e3fe13626c4a178e4525f178e65a/review.md),
[all grids](../../backtests/high-touch-short-reports/b66baaf224dbeafa68df168cca734c7f9e95e3fe13626c4a178e4525f178e65a/grids.md).
Accepted job b66baaf224dbeafa68df168cca734c7f9e95e3fe13626c4a178e4525f178e65a;
[independent verification](../../backtests/high-touch-short/b66baaf224dbeafa68df168cca734c7f9e95e3fe13626c4a178e4525f178e65a/independent-verification.json)
passed all1,188 paths. **0/100 qualifiers.** Exact-touch2/3.5 improves full net
and DD, but recent/cost/delay/monthly weaknesses remain. Live unchanged.
