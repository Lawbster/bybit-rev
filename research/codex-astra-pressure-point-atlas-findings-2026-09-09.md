# P01 — HYPE pressure points, full indicator and HL map

## TL;DR

- Mapped **64 mechanical market-drop episodes, 22 forced-close decisions across two separate current-config replay paths, and the 26 user-labelled tops**. Added 677 outcome-independent four-hour market references and 112 overlapping underwater-ladder landmarks. Window: **May 17, 2026 20:43 UTC–September 8, 2026 17:47 UTC**. These counts are separate cohorts, not independent trades to add together.
- There is consistency in the **sequence**, not a universal early sell signal: around the 64 first rolling-12h −3% crossings, median HL 15m buy/sell falls from **1.17 one hour earlier → 0.67 fifteen minutes earlier → 0.54 at the crossing**. Fast RSI/CRSI weaken too. But 1h RSI is still 53.1 at the crossing; slow indicators can retain the preceding strength. At eventual hard flattens, weak slow indicators are common, but they also occur in recoveries.
- **30m MFI14 ≤20 at the existing deep-loss/+60m checkpoint is an additional, small-sample lead**, unlike the broad sell-flow warnings from F01. Touch: 3W/3L; confirmed: 0W/4L. It separates some further deterioration in both paths, survives a one-minute closed-bar delay, but all selected episodes are June/early July. **No exit replay, estimated strategy improvement, new rule, or live change.**

## What the earlier study actually said

The [August 14 user-drop study](codex-hype-user-drop-precursor-findings-2026-08-14.md) examined the 26 four-hour candle **starts** you supplied in UTC+2. We converted them to UTC and used only candles closed at that start—not the selected candle's later close.

It found:

- 18/26 were followed by a low at least 2% lower within 12h; 22/26 by a low at least 3% lower within 24h. **The repaired-history map reproduces both counts.** Your visual selection was meaningful, though selected in hindsight.
- The old 443-boundary reference already had 209/443 (47.2%) −2%/12h outcomes. A drop afterwards was common even without selecting a top.
- Tops often combined **recent strength, nearby resistance and rising OI**. The historical report's median HL taker15 was 1.179: buying still dominated. There was not a universal pre-top sell-flow/book-withdrawal signature.
- Resistance within 1% occurred at 23/26 marks but also 338/443 ordinary boundaries. Proximity alone did not distinguish them.
- A top-watch followed by a **later** confirmed breakdown concentrated the old short results, but excluded trades were still profitable. It was not evidence that immediate shorts or blanket long flattens would improve the portfolio.

That August report predates September's replay repairs. Its old strategy-dollar improvements are **not recertified here**. Also, current primary HL uses explicit end+60s availability and separates native OI from marked USD OI; do not demand numerical identity with older loosely timed pulse summaries.

[F01](codex-astra-failed-recovery-findings-2026-09-08.md) was a narrower question: ten price, flow and support warnings after a ladder was already underwater. It did **not** exhaust all indicators. P01 fills that descriptive gap.

## Current-config baseline, unchanged

Same May 17–September 8 window; $32,000 initial equity, $800 ×1.35, maximum 11 rungs, frozen B17 current policy stack. Short overlay excluded. These are the accepted L09 replay paths, matched exactly to F01's verified archive—not live-account performance or newly optimized runs.

| Replay TP model | Winning episodes | Losing episodes | Winning dollars | Losing dollars | Realized PnL | Open mark | Net incl. open | Max DD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Resting-touch | 295 | 10 | $57,130 | $33,009 | $24,121 | −$3,207 | **$20,914** | 24.69% |
| Close-confirmed | 243 | 11 | $59,238 | $40,192 | $19,046 | −$3,207 | **$15,839** | 31.11% |

These controls charge 0.055% per side. They do not certify exact maker queue fills, complete funding cash flows or exchange liquidation mechanics. An open September ladder stays censored; it is not assigned a future flatten loss.

## What is now mapped

The [frozen card](../research-inputs/pressure-point-atlas-2026-09-09.json) defines:

| Cohort | N | Definition |
| --- | --- | --- |
| Market reference | 677 | Every UTC 4h boundary with a complete subsequent 24h of prices |
| Mechanical market drops | 64 | First completed minute at least 3% below the trailing 12h high; rearm after 60 consecutive minutes within 1% of the rolling high |
| Current B17 forced closes | 10 touch / 12 confirmed | Exact archived close **decision** time, not TP-intent time or retrospectively inferred fill time |
| User-selected tops | 26 | Original UTC+2 candle starts converted to UTC |
| Deep-pressure controls | 112 landmarks | First depth≥9/gross inventory loss≤−3%, plus surviving same-episode +60m; repeated times and models are not independent |

Forced closes include funding exits, not just crashes: touch has 9 hard/emergency exits plus 1 funding exit; confirmed has 10 hard/emergency exits plus 2 funding exits, one profitable. All are preserved rather than silently dropping inconvenient exceptions.

Each market drop, forced close and selected top has **T−12h, −4h, −1h, −15m and T** snapshots. Altogether: 1,349 cohort/offset rows, 1,200 distinct times, **252 numerical fields** and complete source-reference records.

Indicator clocks: **5m, 15m, 30m, 1h and 4h**. Families: RSI, CRSI, ROC, MACD, Bollinger, ADX/DMI, ATR, efficiency, UTC day/week VWAP, ordinary/time-of-day relative volume, OBV, MFI and CMF. We use their validated standard parameters, not every possible period or threshold. No claim that every indicator family or combination is exhausted.

HL: 5/15/60/240m taker flow, large-trade and activity summaries, 0.25/0.5/2% book bands, changes/persistence, native and marked OI, mark price, funding/premium, HLP vault observations and closed HL candles. Missing, stale, ambiguous or incomplete observations remain unknown. HLP changes are not asserted to be investor inflows/outflows.

S/R uses the current closed-prefix 30m memory-zone configuration, retaining confirmed zone identities and availability. Repaired candle history supplies continuous indicator input; historical receipt time is not thereby proven.

## Sequence before the mechanically identified drops

Medians; 64 events, except some early HL snapshots have 62–63 usable observations. This aligns events retrospectively for description; it is **not a predictive accuracy test**. Fifteen minutes before the −3% threshold may already be well into the decline.

| Reading | Ordinary 4h reference | 4h before crossing | 1h before | 15m before | At −3% crossing |
| --- | --- | --- | --- | --- | --- |
| HL 15m buy/sell | 1.03 | 1.07 | **1.17** | **0.67** | **0.54** |
| HL 1h buy/sell | 1.03 | 1.09 | 0.99 | 0.82 | 0.66 |
| 15m RSI14 | 51.3 | 57.3 | 51.7 | 44.9 | 41.7 |
| 15m CRSI | 51.1 | 63.0 | 47.7 | 27.4 | 20.2 |
| 1h RSI14 | 52.0 | 60.1 | 57.5 | 55.4 | **53.1** |
| 1h ADX14 | 25.0 | 23.7 | 23.0 | 23.7 | 23.7 |
| 1h close vs day VWAP | +0.17% | +0.73% | +0.37% | +0.10% | −0.20% |
| Native HL OI 4h change | −0.01% | +0.22% | +0.08% | −0.08% | −0.08% |

HL15≤0.85 appears in **22/64** one hour before, **43/64** fifteen minutes before and **46/64** at the crossing. Useful description of deteriorating participation, but not proof that fading every such reading pays.

Important counterpoint: by the **hard/emergency flatten decision**, 1h RSI was below 50 in 9/9 touch and 10/10 confirmed cases, and −DI dominated in both sets. Yet HL15 was **buy-dominant at 5/9 touch and 6/10 confirmed exits**. Some late exits occur during rebound attempts inside a still-damaged slower structure—not during maximum immediate sell pressure.

Some slow-trend consistency is expected from selection: the existing hard-flatten policy itself requires hostile trend conditions. It is not independent evidence that adding another trend-based exit would help.

## Does the reading distinguish future drops from ordinary periods?

Reference: 303/677 (**44.8%**) future −2%/12h outcomes and 68/677 (**10.0%**) future −5%/12h outcomes. Counts are overlapping sampled windows, **not independent crashes or trade win rates**. Comparison baselines below use identical known-data rows.

| Reading at completed 4h boundary | Known baseline −2%/12h | Flagged −2%/12h | Known baseline −5%/12h | Flagged −5%/12h |
| --- | --- | --- | --- | --- |
| HL15≤0.85 | 301/673, 44.7% | 98/240, **40.8%** | 67/673, 10.0% | 20/240, **8.3%** |
| HL1h≤0.90 | 299/668, 44.8% | 111/249, 44.6% | 66/668, 9.9% | 27/249, 10.8% |
| 4h RSI≥70 | 303/677, 44.8% | 27/45, **60.0%** | 68/677, 10.0% | 6/45, 13.3% |
| 4h ADX≥25 | 303/677, 44.8% | 180/352, 51.1% | 68/677, 10.0% | 47/352, 13.4% |
| 1h volume≥1.5× same UTC slot's prior-20-day mean | 303/677, 44.8% | 65/117, **55.6%** | 68/677, 10.0% | 15/117, 12.8% |
| 15m MFI14≥80 | 303/677, 44.8% | 14/30, 46.7% | 68/677, 10.0% | 6/30, **20.0%** |

This is the difference between **symptom consistency** and **advance discrimination**. Broad HL selling does not independently identify higher subsequent drop risk at these reference times. Overbought and volume readings show some association, not a licensed flatten rule.

There are only **three** 15m CRSI≥95 readings on the four-hour sampling grid. That is not enough to reject CRSI extremes; it also does not mean CRSI≥95 only occurred three times in continuous trading. Transient intermediate signals need a separate full-frequency test.

Calendar matters: the baseline severe-drop rate is **15.2% before July 15 versus 4.6% after**. The 15m MFI≥80 association is 4/17 (23.5%) early and 2/13 (15.4%) late, but it has 0/6 severe outcomes in July. No universal monthly pattern. The complete top-five monthly comparison is in the generated tables; all 109 fixed bins, including negative/null results, are in the JSON.

## The additional underwater-ladder finding

Compare the **same surviving deep ladder 60 minutes after its first −3% inventory loss**. Values below show what eventually happened on the unchanged path, not what a new exit policy would earn.

| Path / subset | Completed W / L | Winning dollars | Losing dollars | Further downside after checkpoint | Subsequent recovery after checkpoint |
| --- | --- | --- | --- | --- | --- |
| Touch: **all checkpoint episodes** | **21 / 5** | **$5,472** | **$28,389** | **$19,266** | **$43,463** |
| Touch: 30m MFI14≤20 | 3 / 3 | $714 | $18,651 | $12,017 | $5,239 |
| Confirmed: **all checkpoint episodes** | **19 / 8** | **$6,397** | **$38,541** | **$24,435** | **$45,726** |
| Confirmed: 30m MFI14≤20 | 0 / 4 | $0 | $19,116 | $10,941 | $833 |

Each baseline also has **one open/censored** episode excluded from outcome dollars. MFI-selected episodes are all completed.

This is more selective than simply being under VWAP or having −DI dominate. But:

- N is **6 and 4**, with shared market episodes across models—not 10 independent confirmations.
- Selected observations are all **June 2–July 13**. No selected completed case validates it in late July/August/September.
- One confirmed episode eventually lost money but **recovered $833 after the checkpoint**. That is why lifetime loss cannot be called avoidable loss.
- The exact selected MFI memberships survive the one-minute closed-bar delay. That is a timing check, not evidence of new-regime robustness.
- Post-hoc selection from 109 descriptive bins raises data-mining risk. The standard MFI threshold was fixed before joining outcomes, but choosing it now is still exploratory.

Another small lead is a **0.5% book-imbalance decline >0.15 over the preceding 15m**, at that same checkpoint: touch 2W/2L, $12,362 further downside versus $3,937 recovery; confirmed 0W/2L, $3,040 downside versus $833 recovery. Different episodes explain each path and the samples remain tiny. Book imbalance is aggregated displayed depth, not proof of individual cancellations. This is not yet a causal replay of an exit.

Conversely, 1h −DI dominance selects touch **18W/5L**, with $19,266 further downside versus **$39,010 recovery**. Seeing it at virtually every flatten is insufficient justification to exit every occurrence.

## Timing and verification

- All feature snapshots exclude future prices; forward lows/returns are stored as labels separately. Full-prefix recomputation and extreme-future tests pass.
- Fixed indicator seed June 1, 2025. Research CRSI is prior-only and unrounded; it is not silently substituted for the legacy rounded live display formula.
- Closed-bar+60s sensitivity uses the **previous fully available bar**, not a forming bar. The 4h grid is exactly on close boundaries, so it intentionally exposes the largest update-boundary difference.
- Legacy HL primary availability is bucket-end+60s. Adding another 60s leaves only 13/15 usable buckets and makes HL15 unknown under the 14-sample floor. **673/677 known primary reference rows become zero known delayed rows**; do not claim historical delivery robustness. HL1h remains usable in the same 668 rows. Book/OI clocks are unchanged by this legacy-bucket lag sensitivity; it is not an all-stream network-delay stress.
- Two accepted B17 controls match exactly. No new economic replay was run; no live/config/state/strategy file changed.
- Independent checks: 1,200 contexts, 64 drop detections, 677 full market labels, **211,391 distinct raw source rows / 447,469 references**, 3,522 flow windows, 38 full-file as-of selection probes, all 2,616 market-bin tables, and all primary pressure-bin dollar summaries.
- Existing indicator math/timing, MACD, Bollinger, ADX/DMI, ATR/efficiency, VWAP, volume-flow, TP/HL and new P01 tests pass; normal/VPS and explicit research typechecks pass.

No candidate satisfies an economic promotion gate here because **no economic variant was tested**. This neither licenses a change nor falsifies every combination. The useful output is a reusable event map plus narrower hypotheses that explicitly retain their counterexamples.

## Files and reuse

Accepted artifacts: `backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/`.

- [Readable aggregate/monthly tables](../backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/tables.md).
- [All 112 event-by-event timelines](../backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/event-guide.md).
- [Full numerical snapshots CSV](../backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/snapshots.csv).
- `contexts.jsonl`: source clocks, raw file/line references, quality, primary/delayed indicators, HL, and known S/R zones.
- `events.json`, `grid.json`, `pressure.json`: separate event definitions and outcome labels.
- `market-bin-comparisons.json`, `pressure-bin-comparisons.json`, `feature-distributions.json`: complete comparisons, including missingness.
- `selected-pressure-details.*`, `selected-pressure-monthly.*`: selected memberships, recovery costs and delay checks.
- `manifest.json`, `validation.json`, `verification.json`, `report-manifest.json`: input/source/output integrity and checks.

The first local bundle is superseded solely for CSV escaping; v2 uses standards-compliant doubled quotes for embedded event JSON. Strategy definitions and numerical JSON outputs were unchanged.

See [method/run instructions](../docs/research/pressure-point-atlas.md). No commit, push or deployment performed.
