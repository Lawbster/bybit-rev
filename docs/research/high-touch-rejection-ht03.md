# HT03: rejection versus every touch at the two-day high

Frozen 2026-09-18 before outcomes. Research only; no live changes.
[Card](../../research-inputs/high-touch-rejection-ht03-2026-09-18.json).

## Question and controls

HT01's every-touch short was full-period profitable at its best brackets but
weak recently and failed the screen. HT02's POC vetoes did not repair it.
This separate pass changes the entry mechanism, not targets or POC distance.

Use the same three HT01 brackets: TP/SL 2/3.5%, 3/3.5%, 2/3%. Each is compared
with its **own unchanged exact-touch baseline**, not the ladder. $10k fixed
notional, $32k starting equity/DD convention, 0.055% fees each side, 12h cap.
Same 2024-12-05 12:55 to 2026-09-15 20:20 UTC exclusive end; June1,2026 split.
Do not silently incorporate newly synced candles into this comparison.

| Rule | Entry evidence | Diagnostic control |
|---|---|---|
| close_back | Original touch minute closes below frozen high R | Every touch |
| wick_reject | Above plus upper wick >=50% of nonzero candle range | Every touch |
| confirm_5m | First full post-signal UTC5m candle closes below R | Same clock, no price filter |
| confirm_15m | First full post-signal UTC15m candle closes below R | Same clock, no price filter |
| failed_break_5m | Touch closes above R, first subsequent closed minute below R within5m | Above-close touch cohort |
| failed_break_15m | Same, within15m | Above-close touch cohort |

Six mechanisms x3 brackets =18 candidates. Three diagnostic entry rules x3
=9 additional definitions; **27 new, 9,274 cumulative standalone /205 ladder
overlays**. 36 exact baseline controls, then360 reported paths including both
ambiguity orders. No further parameter search after seeing results.

## Clock and opportunity contract

Reuse all7,475 original saved exact-touch anchors; R is fixed per anchor.
HT01 knew R at the original touch minute's start. That minute and any later
bar become usable only at end+60s. Entry uses the real minute open at receipt
or60s later; never an earlier touch price or a future fill in a filter.

For aligned confirmations, start=ceil(original signal receipt/timeframe)*
timeframe. The entire5m/15m candle is after signal availability. Test that
**first** complete candle once, not any convenient later candle. These are
close-back confirmations; no second touch of R is required. Wait-only controls
use identical clocks and dedup, isolating the price predicate conditional on
the same schedule. They do not compare identical occupied trade cohorts.

Failed-break requires an actual completed close above R, then the earliest
later minute close strictly below R. Deadline is original signal receipt+5m
or15m, inclusive, and applies to the later bar's receipt. Equality does not
count as above/below. The above-close control isolates the initial cohort,
**not** the variable recross wait; do not claim that contrast isolates delay.

Watches never reserve inventory. Each original anchor has its own fixed R and
can be observed while another watch/position exists. Multiple successful
anchors at the same decision minute collapse to earliest original receipt,
then anchor ID. Save the entire eligibility/dedup/censor ledger, not just
traded signals. Raw touches, watches and trades are different denominators.
One position per setup; replay full occupancy and all replacement entries.

Missing minutes fail, rather than interpolate. A last watch is censored if its
required confirmation is unavailable at the tape end. A later prefix may
resolve it; no earlier emitted signal may change under future-data poisoning.

## Reuse and validation

- Reuse saved HT01 groups and the accepted candle atlas; no POC/map rebuild.
- Reuse `runCap`, `exitStats`, `holdingStats`, and the independent `auditShort`.
  Do not change the pinned engine's execution, fee, timeout or ambiguity logic.
- Reproduce all36 parent receipt/stat/monthly/curve/open paths before variants.
- Independently reconstruct anchor highs and every confirmation decision from
  the candles, including rejected, deduplicated and censored anchors.
- Audit every unique execution journal. Shared ID alone is insufficient for
  trade attribution: identity includes actual entry time. Reconcile added minus
  removed closed PnL plus cutoff-open delta; report changed-time entries and
  concentration excluding the two biggest avoided losses.
- Verify current source/input/output hashes before accepting. Reading a saved
  `passed` flag is not verification. Preserve accepted prior files.

## Reporting and unchanged screen

Baseline-adjacent W/L, winning and losing dollars, average loss, marked/closed
net, DD, exposure and TP/SL/timeout counts; full/older/recent and delayed/cost
paths. Top-five candidates get per-month deltas. Controls are labelled, not
promoted as rejection candidates. Report confirmation latency and reach.

Keep positive net/stress in all6 partition/delay paths; >=30 full and10 each
subperiod closes; no exhausted equity; all monthly MTM >=-$250 versus cash.
Relative also needs increased net, nonworse DD and no month below parent by
more than$250. Zero qualifiers is a valid result. Target-first sensitivity
remains visible. No untouched holdout, live availability, funding, queue,
liquidation, margin or shared-account certification.

## Accepted checkpoint

Commands: `npx ts-node scripts/high-touch-rejection-tests.ts`,
`npx ts-node scripts/high-touch-rejection-audit-tests.ts`, then the study,
independent verifier and report scripts with the same prefix.
Do not rerun an accepted job to read its results.

Accepted key `8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5`.
All36 baseline paths matched;360 execution journals/74,750 decisions verified.
**0/18 candidates qualify.**
[Findings](../../research/codex-astra-high-touch-rejection-findings-2026-09-18.md).
