# SF05-HL — the five blocked winners versus losing trades

## Answer

- **Only3 of the5 winners have HL history.** They earned$811; the other2 earned$1,484 and predate collection. Of14 blocked losers, only4 have HL history ($524 losses). We cannot explain all$2,295 with this feed.
- The3 covered winners have buy-dominant1h flow, but so do2/4 blocked losers and4/6 other mapped stops.15m selling, an ask-heavy book and falling OI also occur in winners. There is **no clean observed separator**.
- The useful distinction to retain descriptively is **short-term selling within stronger1h flow**, sometimes alongside declining OI. It describes the August winners, but also overlaps September failures. No rescue rule, new earnings, wider stop, replay or live change is claimed.

## Scope and coverage

Reuses the exact SF05 baseline and removed-trade ledger, and SF04 saved pre-entry
snapshots. Original4h range-SFP,2R,24h cap,$10k notional, standard taker fees,
before funding. SF05 baseline43W/79L,+$2,690/DD7.92%; entry veto38W/65L,
+$2,441/DD6.02%. These remain unchanged; this is **inspection, not another replay**.

Primary comparison is5 blocked winners versus14 blocked losers. Broader context
uses6 additional mapped stops and10 other mapped winners. The10 mapped stops
are not all79 historical losing trades: older losses lack the relevant history,
and SF04 explicitly excluded the Sep11 losing timeout. That timeout is listed
as unmapped, not misclassified as lacking an actual HL feed.

HL taker/book/asset context begin May17,2026; OI/funding begin Apr25.
All12 unmapped members of the19 blocked trades predate **every** loaded source.
No historical HL values are synthesized from candles or later observations.
The3 covered winners represent only35.3% of the lost winning dollars.

## The five sacrificed winners

HL ratios are buy/sell notional: above1 means more aggressive buying.
OI is native position quantity change, not price-driven dollar OI.
Every reading below is available by original entry, not the later TP.

| Entry UTC | Original net $ | HL15m buy/sell | HL1h buy/sell | Native OI4h change | Book imbalance0.5% |
|---|---:|---:|---:|---:|---:|
|2025-04-14 00:01|+584|Unavailable|Unavailable|Unavailable|Unavailable|
|2026-02-05 20:01|+900|Unavailable|Unavailable|Unavailable|Unavailable|
|2026-06-19 08:01|+267|1.73|1.21|-0.41%|-0.446|
|2026-08-24 20:01|+284|0.92|1.11|-1.60%|-0.012|
|2026-08-28 20:01|+259|0.36|1.55|-3.90%|-0.040|

All five originally reached their structural2R target. Negative book imbalance
means more displayed asks than bids; it is not proof those asks execute.

- **June19:** aggressive buying over15m/1h, despite an ask-heavy snapshot and
  **40.5% falling displayed bid depth** over15m. Last5m buying share was falling
  versus the preceding10m. Requiring a visibly improving book would reject this winner.
- **August24:** slightly sell-dominant15m against buy-dominant1h; OI decreased1.60%
  over4h. Last5m buying share improved, but the book remained slightly ask-heavy.
- **August28:** strong15m selling (0.36) inside a buy-dominant hour (1.55), with
  OI down3.90% over4h. This can be described as a bounce following reduced open
  exposure, but OI alone cannot identify liquidation, short covering or the causal reason.

## Direct comparison: the four covered blocked losers

| Entry UTC | Original net $ | HL15m buy/sell | HL1h buy/sell | Native OI4h change | Book imbalance0.5% |
|---|---:|---:|---:|---:|---:|
|2026-06-02 20:01|-249|2.26|0.78|-0.72%|+0.324|
|2026-06-21 08:01|-45|0.35|0.44|-0.04%|+0.395|
|2026-09-08 00:01|-110|0.72|1.47|-0.43%|-0.217|
|2026-09-08 08:01|-120|1.35|2.55|-1.04%|-0.026|

1h flow distinguishes the two June losses from the covered winners, but **does
not distinguish either September loss**. One September loser had stronger1h
buying than every winner. June2 also shows that a last15m buying burst can occur
inside an otherwise sell-dominant hour and still stop out.

All4 stopped trades later touched their original TP by entry+72h. These are not
the two non-recovering SF04 cases. A promising HL filter here would therefore
need to distinguish successful entries from premature entries/stop geometry,
not simply bullish versus bearish eventual direction.

## Median comparisons, with broader losing context

These are descriptive group summaries, not thresholds. Individual spans overlap.

| Entry feature | Blocked winners n=3 | Blocked losers n=4 | Other mapped stops n=6 |
|---|---:|---:|---:|
|HL15m buy/sell|0.92|1.03|1.19|
|HL1h buy/sell|1.21|1.13|1.18|
|HL4h buy/sell|0.93|0.77|0.90|
|Book imbalance0.5%|-0.040|+0.149|-0.072|
|Native OI4h change|-1.60%|-0.57%|-0.28%|

Full1h ranges: winners1.11–1.55; blocked losers0.44–2.55; other stops0.80–1.65.
Full4h OI ranges: winners-3.90% to-0.41%; blocked losers-1.04% to-0.04%; other
stops-1.51% to+1.30%. The deeper OI contraction of the August winners is worth
recording, but is dominated by two dates and has no established classification edge.
Funding, large-trade balance and instantaneous flow acceleration have mixed signs;
all available HL fields and ranges are saved rather than cherry-picking only a
favorable metric.

## What the preceding15 minutes show

16 one-minute snapshots from entry-15m through entry. These are heavily overlapping
rolling windows, **not16 independent observations**.

| Entry UTC | Outcome | Snapshots with1h buy/sell >1 | 15m flow at -15m → entry |
|---|---|---:|---:|
|2026-06-02 20:01|Stop|0/16|0.98 →2.26|
|2026-06-19 08:01|Win|15/16|0.91 →1.73|
|2026-06-21 08:01|Stop|0/16|0.69 →0.35|
|2026-08-24 20:01|Win|16/16|1.05 →0.92|
|2026-08-28 20:01|Win|16/16|1.85 →0.36|
|2026-09-08 00:01|Stop|16/16|1.07 →0.72|
|2026-09-08 08:01|Stop|16/16|1.82 →1.35|

Persistence does not fix the September overlap. Two of the winners developed
stronger15m selling into entry; assuming every worsening short window means
failure would sacrifice them. Conversely, the June2 loss had improving15m buying.

Additional60s information delay leaves all3 winners and2/4 blocked losers
buy-dominant on1h. Book values are noisier: Sep8 00:01 changes from-0.217 at the
primary snapshot to+0.055 one minute earlier. A latest-book sign rule would be
sensitive to which sample arrived, without solving the general separation problem.

## Limits and conclusion

Only June contains both covered blocked wins and losses (1 versus2). August has
the other2 winners; September has the other2 losers, both on the same day.
This is seven trades across six dates, not a cross-regime validation sample.
The observed OI contrast may be a month/regime difference rather than a useful filter.

**What survives:**1h flow provides context that15m RSI and EMA distance miss.
**What does not follow:** that stronger1h buying, a better book, or more OI decline
can recover the five winners while retaining the avoided losses. Older2 winners
cannot be checked, and recent counterexamples are explicit. No new rule was tested.

## Saved evidence / verification

Job `backtests/sfp-rsi-ema-hl/ff4016e1d2fb213bb8324010752c987f0f4c7b2f6d753c7864f85f7a3b908541`.
[Target-trade ledger](../backtests/sfp-rsi-ema-hl/ff4016e1d2fb213bb8324010752c987f0f4c7b2f6d753c7864f85f7a3b908541/target-trades.json) /
[all pre-entry HL features](../backtests/sfp-rsi-ema-hl/ff4016e1d2fb213bb8324010752c987f0f4c7b2f6d753c7864f85f7a3b908541/features.csv) /
[group ranges and delay sensitivity](../backtests/sfp-rsi-ema-hl/ff4016e1d2fb213bb8324010752c987f0f4c7b2f6d753c7864f85f7a3b908541/feature-summary.csv).

SF04/SF05 consumed artifact hashes verified against their original manifests;
trade IDs, entry times and net outcomes reconciled;7,866 saved source-clock
checks passed. Uses accepted modeled availability/legacy sample-time proxies,
not a claim of proven historical network arrival. Pre-entry only; no outcome-time
features used as predictors. Existing raw feeds and full replay were not re-read
or rebuilt. Consumer cache is content-addressed and hash checked.

Reproduce: `npx ts-node scripts/sfp-rsi-ema-hl-review.ts`.
No live files/configs, strategies, commits or pushes changed.
