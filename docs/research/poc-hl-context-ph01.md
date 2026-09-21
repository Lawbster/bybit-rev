# PH01: HL context of daily NPOC touch wins and losses

Research-only, September 17, 2026. This is **event attribution, not a new
filtered strategy replay**. The live ladder, shorts and POC geometry are unchanged.

## Frozen question and baseline

Use the accepted PB02 full-history **12h** daily-NPOC touch long path:
238 closes, 125 wins / 113 losses, +$15,962.22. Same $10k notional,
0.055% taker fees each side, no TP/SL or funding. Entries are next-minute
opens after the completed first-touch minute, not hypothetical fills at the POC.

[Card](../../research-inputs/poc-hl-context-ph01-2026-09-17.json) is written
before outcomes are joined. PB02 manifests and exact PB01 baseline fields are
verified before enrichment. No map or signal regeneration. Same candle cutoff:
September 15, 2026 20:20 UTC. No raw download or live account access.

The earliest HL-era selection begins April 25. Funding, REST OI and HLP start
then; rich taker/book/asset/candle feeds start May 17. All source histories are
inventoried, but only event-adjacent observations are retained in memory.

## Information clocks and features

Each trade has 16 independent snapshots, one per minute from decision minus
15 minutes through the decision. Use only observations available by that
snapshot, with exact millisecond book/asset clocks; do not floor future samples
into the current minute. No feature uses future trade outcomes.

- Legacy taker and HL candles: modeled bucket end plus 60 seconds. Actual
  recorded receipt/write times, where present, are respected. Thus the 15m
  primary taker window normally contains 14 known buckets, not the unpublished
  just-ended touch bucket. Five-minute flow normally has four known buckets.
- Book/asset observations without original receipts use sample-time proxies.
  Historical availability is **modeled, not proven live receipt**.
- Freshness: book 30s, asset 90s, REST OI/funding 180s, HLP 15m. Non-coarse,
  non-truncated band requirements remain mandatory; missing is null, not zero.
- 15m/1h taker ratios are ratios of summed notional, not mean minute ratios.
- Acceleration = buy-notional share in the known recent 5m window minus that
  share in the prior 10m. This measures **relative buy/sell pressure**, not an
  assertion that absolute sell turnover increased.
- OI changes use native units, with separate USD-marked fields. A fall in
  marked OI is not automatically deleveraging. OI does not reveal which side
  initiated the position or whether a liquidation occurred.
- Aggregated book depth changes do not prove individual cancellations,
  order ownership, spoofing, liquidity absorption or executable queue depth.
- HLP APR and distributable amounts remain descriptive; changes are not
  identified investor inflows/outflows.
- Bybit pre-entry price returns inherit PB02's corrected-history closed-bar
  model. They are not a claim that recovered candles were received live then.

Extra-source-delay sensitivity queries all context at decision minus 60s,
keeping the same outcome cohort. Separately, same-ID delayed-execution outcomes
come from the already accepted PB02 +1m path. These are distinct sensitivities.

## Comparisons and limits

Fourteen primary features; 16 fixed diagnostic predicates, not an optimized
classifier. July 15 00:00 UTC is the predeclared chronological split. Report
per-feature denominators and a common healthy taker/book/asset cohort; do not
attribute missing-source calendar differences to trading edge.

Every predicate has condition, complement, unknown, early/late and monthly
W/L/dollar accounting. Every month here groups by **entry month**, not monthly
portfolio MTM; PB02 uses MTM tables and can therefore allocate cross-month
trades differently. AUC is the probability that a randomly selected winner
has a higher feature value than a loser, not a trained classifier's accuracy.
The split is a historical stability check, not a pristine unseen holdout.

These are **original-trade subsets**. Removing a trade could admit previously
occupied signals; that was not simulated. No subset PnL is labeled filtered
strategy profit and no subset drawdown or full-history uplift is inferred.
No trading configuration passes or fails its economic screen in PH01.

Post-entry MFE/MAE and 1h/3h returns are separately named outcome labels.
They help distinguish no bounce from bounce-then-reversal. A historical +1%
high is not proof of an executable 1% maker TP or a profitable TP policy.

## Reproduction and saved files

```powershell
node -r ts-node/register scripts/tp-hl-event-tests.ts
node -r ts-node/register scripts/poc-hl-context-tests.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-hl-context.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-hl-context-verify.ts backtests/poc-hl-context/KEY
node --max-old-space-size=4096 -r ts-node/register scripts/poc-hl-context-path-verify.ts backtests/poc-hl-context/KEY
```

Accepted outputs are immutable. Reuse the existing KEY for reading; the runner
refuses to overwrite it. Plan pins source hashes, code and the frozen card.

- `events.csv`: UTC dates, POC band, entry/exit, PnL, all pulse features,
  coverage and separate outcome labels; suitable for manual review.
- `events.json`: additional delayed-execution and coverage details.
- `pre-entry-trajectories.json`: every -15..0 snapshot with source references.
- `retained-observations.json`: normalized source evidence with raw file/line.
- `feature-comparisons.json`, `paired-lead-in.json`: all distributions.
- `partitions.json`, `core-cohort-partitions.json`, `source-delay-partitions.json`:
  fixed comparisons, missing denominators, all monthlies and trade IDs.
- `partitions-monthly.csv`, `report.md`: readable comparisons.
- `independent-verification.json`, `path-verification.json`: clock/arithmetic
  and separate outcome-path audit receipts.

Existing engine timing tests plus ten new tests cover missing data, chronological
partitions, source delay, native OI and future-source/late-publication poisoning.
Independent checks verify 90,336 source references, 1,344 flow calculations,
672 book calculations, 48 partition tables, and 37,440 outcome-path minutes.
Zero additional economic definitions; research inventory remains
5,519 standalone / 205 overlays.
