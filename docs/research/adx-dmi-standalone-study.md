# I08: ADX/DMI standalone study

Research only; follows I07 Bollinger. The user asked to continue with ADX/DMI.
No live/config/ladder/short-state changes, combinations, commit or push.

## Frozen questions and scope

[Study card](../../research-inputs/indicators/adx-dmi-standalone-2026-09-06.json).
Direction comes from +DI minus -DI. ADX measures strength, not direction.
Common 20/25 reference readings are context, not proven HYPE thresholds.
[Fidelity DMI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/DMI),
[TradingView ADX](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/).

Five clocks: 5m/15m/30m/1h/4h. Periods 7/14/28, with ADX smoothing length
tied to the DI length. Nine entry definitions per clock/period:

| Entry | Thresholds | Exact meaning |
|---|---|---|
| DI cross | 0 (unfiltered) | Fresh signed DI spread from<=0 to>0 in entry direction; ADX need not yet be available |
| Strong DI cross | 20/25/40 | Same fresh DI cross AND current ADX>=threshold; no delayed catch-up if rejected |
| ADX strength cross | 20/25/40 | Previous ADX<=threshold, current>threshold AND current DI has entry-side sign |
| ADX peak fade | 40/50 | Older ADX<=previous, current<previous, previous>=threshold; current DI direction opposite entry side |

Each uses long/short and two exits: **5×3×9×2×2=540 new definitions**.
Across two windows and two delays: 2,160 strategy cases plus eight repeated
clock controls = **2,168 cases**. The period14 math is repeated validation,
not a repeated prior standalone entry. Strength-gated crosses compare their
own unfiltered DI-cross, same clock/period/side/exit, with full occupancy replay.

Exits: fixed12h from actual entry, or earliest subsequent closed DI condition
capped at12h. Continuation longs exit spread<=0, shorts>=0; peak-fade longs
exit spread>=0, shorts<=0. This is not a guaranteed profitable TP. Timeout
wins ties; no reuse of the entry observation. Pending decisions are immutable,
occupied signals are skipped and a fresh crossing is required after exit.

## Formula identity and timing

`adx-dmi-wilder-sma-seed-v1`: TR starts at bar1, using previous close and
current high/low. Up=high-prevHigh, down=prevLow-low. Only the strictly larger,
positive move contributes DM; equal moves contribute zero to both.

Wilder means seed the first N changes with an arithmetic mean and update
(previous×(N-1)+observation)/N. DI=100×smoothedDM/smoothedTR, zeroTR gives0.
DX=100×abs(plusDI-minusDI)/(plusDI+minusDI), zero sum gives0.
ADX is the same smoothing of N valid DX values. DI first valid indexN,
ADX index2N-1. Warmup is null, true zero valid, no rounding or gap bridge.
Both periods use a fixed seed, not a sliding/reseeded window.

Source timestamps are UTC bar starts. Only fully completed contiguous bars
can influence a decision; current forming candles are never used.
Three-bar peak means the downturn is already observed, not a future maximum.
Falling ADX can accompany continuing price/DI direction; it is a hypothesis
for a fade, not an assumed reversal.

ADX also retains memory of the preceding trend: high ADX at a fresh DI flip
does not prove the new direction is already strong. The filtered-versus-plain
DI comparison tests that familiar conjunction without assuming it is correct.

Independent fixtures cover the installed library, hand-calculated seed/tied
moves/flat bars, scale/translation/mirror invariance, all540 rule boundaries,
causal timing, delayed exits/occupancy, and old accounting comparisons.
Actual period14 arrays must exactly match the shared accepted module on
every tested clock. Prior pinned files are not edited.

## Dates, costs and controls

- Full: **2025-07-01 00:00 →2026-09-04 19:01 UTC**.
- Recent: **2026-05-17 20:43 →same cutoff**, overlapping, not a holdout.
- Fixed seed June1; same fingerprinted I01 minute tape and explicit11-minute
  repair overlay. No downloaded history or raw-data edits.
- $10,000 fixed entry notional, $32,000 initial equity, one independent
  position per rule; no averaging/compounding.
- 0.055% trading fee per side, actual executed notional. **Before funding**:
  complete settlement evidence unavailable.
- Next minute-open under modeled zero publication lag; separate+1m on BOTH
  entry and exit. End positions marked with hypothetical exit fee, not closes.
- Same-side rolling12h clocks, not exposure-matched; own fixed12h exit and
  unfiltered DI-cross companions where applicable.
- Extra5bps/side on the same traded/marked turnover. Not real publication
  history, slippage paths, margin, liquidation or shared-account safety.
- Cash and fixed-initial-quantity buy/hold are contextual controls only.
  These are not incremental ladder dollars or an overlay on the live short.

## Screens, reporting and verification

Same strict screen:>=30 full/10 recent closes both delays, positive net and
own-clock delta allfour cases, no monthly marked delta below-1e-8, positive
extra-cost net and no equity exhaustion. A separate descriptive subset
requires sample/net/cost/solvency in allfour and ranks full immediate net;
retain all clock/monthly failures. This is not a relaxed deployment gate.

Report baseline W/L counts/dollars, open mark, net/DD, full/recent separately,
delays/costs, own-exit and unfiltered-entry comparisons, monthly topfive and
rawtopfive deltas, path risks/concentration and all540 definitions.
Sparse entries are inconclusive; post-equity-exhaustion trades diagnostic.

Eight old/new/saved I01 clock ledger/stat/month/open comparisons must be exact
before strategy outcomes. Actual-data45 feature-prefix and540 strategy-prefix
checks. Independent checker directly aggregates OHLC and uses array-form
recurrences, reconstructing all eligible and skipped signals, first exits,
prices, fees, marks, months, minute DD and ranking; no feature/strategy imports.
Source/input/output hashes checked before/after. Completed validation AND
independent verification required. Read-only path checker adds no strategies.

Not tested: separate ADX smoothing periods, daily, DI magnitudes, rising-only
gates, ADX slope levels, low-strength fades, price stops/targets/trailing,
other indicator/HL/S/R conditions, ladder gates/sizing/shared-account effects.
Passing a bounded study does not exhaust or approve the family.

## Reproduce locally, not on VPS

```bash
npx ts-node scripts/adx-dmi-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-adx-dmi-standalone-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/adx-dmi-standalone-results-check.ts backtests/hype/hype-adx-dmi-standalone-2026-09-06
npx ts-node scripts/adx-dmi-standalone-path-check.ts backtests/hype/hype-adx-dmi-standalone-2026-09-06
```

Runner accepts only optional `--out backtests/NEW_DIRECTORY`, refuses overwrite.
Generated artifacts remain local. Sources/card/findings can be reviewed for
Git; this task does not authorize committing or pushing them.

## Accepted September6 result

Accepted folder: `backtests/hype/hype-adx-dmi-standalone-2026-09-06/`.
[Findings / all540 IDs and monthly/W-L baselines](../../research/codex-astra-adx-dmi-standalone-findings-2026-09-06.md).

- 540 new definitions,2,168 cases; zero complete qualifiers,37 descriptive
  survivors (35 long/2 short),359 adequately sampled,181 sparse;15 definitions
  exhaust modeled equity in at least one case.
- Leading4h N7 DI+ADX>=20 long adds only $213 full/$47 recent immediate
  versus its own unfiltered DI control, while reducing full DD13.43%→10.08%.
  Long clock still earns more recently. Best descriptive peak-fade long
  holds October's51.54% adverse price move; no crash-protection claim.
- Independent verifier completed2,168 cases,466,909 overlapping trade rows,
  21,680 monthly rows and eight exact prior clock cases. Forty-five feature
  prefixes,540 strategy prefixes, period14 shared parity, both TypeScript
  configurations and focused tests pass. All source/input/artifact pins match.

The read-only path helper checks selected topfive/rawtopfive/clocks. The
findings additionally inspect these two existing IDs from the same fixed
grid via an in-memory ID-list extension, not an edited/pinned helper or a
new strategy run:

- `adx_240m_n28_di_cross_t0_short_fixed12h` (S2).
- `adx_15m_n7_adx_peak_fade_t50_long_fixed12h` (F1).

To reproduce those extra path diagnostics, use the helper's existing
calculation with these IDs in a separate local copy/in-memory module; retain
the accepted source files unchanged. Do not rerun the strategy or change
entry/exit rules just to inspect its completed ledger.

No unfinished I08 strategy directory is accepted as evidence. Generated
artifacts remain local, source/card are pinned, findings/register updates
add no trials. Proposed next individual area is ATR/efficiency, not automatic
combinations or a live change.
