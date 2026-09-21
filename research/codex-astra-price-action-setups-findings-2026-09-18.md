# PA07 — first source-library setup replays on HYPE

## TL;DR

- **16 definitions tested: 8 candidates and 8 controls.** Two entry families,
  both sides, structural and reference-2R targets, structural stops and a 24h
  cap. Six archived controls match exactly; 384 execution paths and 22,536
  closed-trade receipts audited. **0/8 candidate upgrades qualify.**
- The simpler **structure-break short** is the strongest descriptive result:
  reference2R **+$5,312, 226 trades, 13.19% DD**. Waiting for its origin-zone
  retest reduces DD to5.17% but also reduces net to+$2,322 and trades to50.
- Retest confirmation rescues the tested structural-target longs from
  −$7,784 to+$1,537, but leaves only48 trades/7 recent and gives up recent
  profit. Sweep/impulse leaves only5 long/7 short trades. These precise
  adaptations are screened, **not the entire source library exhausted**.

## What was actually run

[Frozen method](../docs/research/price-action-pa07.md) /
[card](../research-inputs/price-action-pa07-2026-09-18.json) /
[compact acceptance receipt](../research-inputs/price-action-pa07-accepted-2026-09-18.json).

**2024-12-05 12:55 through 2026-09-15 20:20 UTC.** Older ends June1,2026;
recent starts then. Same935,005 saved minutes as prior research, no rebuilding
the full candle/profile history. Each strategy has independent $10,000 fixed
notional and $32,000 starting equity for DD. Taker fees0.055% each side,
**before funding**, plus5bps/side cost stress. No pooled portfolio/ladder result.

Closed1h triggers with pre-known4h pivots; strict2-left/2-right confirmation.
Source publication60s/120s, additional action delay0s/60s. No entry at a past
wick or origin price: market at the next executable minute after confirmation.
Both same-minute stop-first and target-first assumptions were run.

- **Sweep control:** first fresh4h extreme breach/reclaim in the discount/premium
  part of the known bracket. **PA06 candidate:** additionally wait for a later
  opposite impulse within6h; stop and opposing target must remain intact.
- **Break control:** closing1h structure break, known opposite-colour origin
  candle and forward untouched4h target. **PA03 candidate:** wait for first
  distinct zone return/rejection within12h. Full-wick origin box is frozen.
- Both target choices retain the same structural thesis. `reference_2r` is
  twice signal-close-to-stop distance, **not guaranteed 2R at delayed fill**.
  Structural stop risk0.2–5% at signal; actual risk/R recorded at fill.

The sources leave these thresholds, expiries and confirmations discretionary.
These are declared operational versions, not an exact discretionary-trader
replication. The4h bracket is **not** PA01's post-exhaustion anchored range.
The confirmed-return entry is **not** a resting order-block limit.

## Full period — each control immediately above its candidate

Net is marked after costs; all primary paths happen to be flat at this cutoff.
Wins/losses are positive/negative **net trade outcomes**, not TP/SL counts.

|Setup|W/L|Winning $|Losing $|Avg loss $|Net $|DD %|
|---|---:|---:|---:|---:|---:|---:|
|Sweep long, structural control|12/66|5,396|−9,853|−149|−4,457|20.32|
|+ impulse confirmation|3/2|680|−502|−251|179|1.91|
|Sweep long, 2R control|20/58|4,155|−8,961|−154|−4,806|17.45|
|+ impulse confirmation|3/2|776|−502|−251|275|1.90|
|Sweep short, structural control|17/56|6,236|−8,439|−151|−2,203|10.53|
|+ impulse confirmation|4/3|959|−836|−279|123|2.79|
|Sweep short, 2R control|26/47|5,985|−7,670|−163|−1,685|9.17|
|+ impulse confirmation|4/3|1,625|−836|−279|789|2.01|
|Break long, structural control|102/118|23,263|−31,047|−263|−7,784|37.27|
|+ origin retest|19/29|7,942|−6,405|−221|1,537|12.88|
|Break long, 2R control|79/142|28,572|−36,999|−261|−8,427|39.34|
|+ origin retest|18/30|6,399|−6,694|−223|−295|14.06|
|Break short, structural control|120/104|29,490|−24,855|−239|4,635|8.30|
|+ origin retest|22/28|7,901|−6,391|−228|1,511|5.26|
|Break short, 2R control|99/127|35,239|−29,927|−236|5,312|13.19|
|+ origin retest|23/27|8,698|−6,376|−236|2,322|5.17|

## Recent period — June1 through September15,2026

|Setup|W/L|Winning $|Losing $|Avg loss $|Net $|DD %|
|---|---:|---:|---:|---:|---:|---:|
|Break long, structural control|19/12|3,823|−3,059|−255|764|4.26|
|+ origin retest|4/3|793|−402|−134|391|1.16|
|Break short, 2R control|17/28|6,037|−4,774|−171|1,263|6.31|
|+ origin retest|4/3|1,588|−760|−253|828|2.20|
|Break short, structural control|25/18|5,786|−3,431|−191|2,354|4.34|

The wait is not unconditionally better. Long structural wait gives up$373
recent net; short2R wait gives up$435. These include replacement/occupied
opportunities, not a cherry-picked sum of removed losses. Average short loss
does **not** shrink: full-period2R about$236 either way, recent$171→$253.

## Monthly MTM — important comparisons

First/last months partial. Rounding can make monthly sums differ by a few dollars.
`L base/wait`: structural long control/origin retest. `S2 base/wait`: reference2R
short control/origin retest. `S structural`: simpler short with structural target.
Full monthlies for **all16 cells and sensitivities**, including deltas, are saved.

|Month|L base $|L wait $|S2 base $|S2 wait $|S structural $|
|---|---:|---:|---:|---:|---:|
|2024-12|−517|0|1,078|876|1,359|
|2025-01|−854|447|766|−544|1,301|
|2025-02|−803|−267|−280|−344|−617|
|2025-03|−2,524|−973|1,610|337|864|
|2025-04|−447|−313|305|733|619|
|2025-05|−1,576|−303|−406|−362|−356|
|2025-06|−1,439|−288|−341|−234|−151|
|2025-07|−187|−175|1,288|115|763|
|2025-08|−181|−517|−2,147|74|−549|
|2025-09|−229|−41|−315|270|−680|
|2025-10|−520|134|−899|−56|−167|
|2025-11|−1,117|960|−8|611|−200|
|2025-12|990|426|−368|141|−94|
|2026-01|−212|−29|1,801|600|926|
|2026-02|−1,691|29|1,134|−1,108|167|
|2026-03|71|446|393|292|112|
|2026-04|545|734|617|−412|−124|
|2026-05|2,144|874|−179|504|−890|
|2026-06|−376|297|259|751|1,018|
|2026-07|1,324|175|2,407|272|1,806|
|2026-08|−122|−81|−1,923|−549|−914|
|2026-09|−63|0|521|354|444|

## What limits confidence

**Screen unchanged:** positive full/older/recent net and stressed net under all
source/action delays; at least30 full and10 per subperiod trades; every monthly
MTM ≥−$250 versus cash. Upgrade must also beat its same-side/target control on
net without worse DD or any monthly delta below−$250. No candidate passes;
no control passes the absolute monthly screen either.

- Short break2R net remains **$5,005–5,312** across timing assumptions; worst
  stressed full net$2,749. But August2025 costs$2,147 and August2026$1,923 at
  primary timing. **Positive overall is not month-safe.** Removing its five
  largest winners leaves only$869; concentration matters.
- Short break structural nets$4,327–4,635 across timing assumptions with lower
  DD; recent$2,354 beats the2R control. Removing its five biggest winners makes
  full net about−$499. Target selection involves a real payoff trade-off.
- Long structural retest nets$1,537–1,606 across clocks, but only7 recent
  trades; removing its five biggest winners yields−$2,559. Not robust proof.
- Of159 valid sweep/reclaim formations, **98 invalidate** during the wait,
  **41 expire**, and20 reach the impulse stage. Risk checks/occupancy leave
  only5 long and7 short fills. Do not optimize thresholds to rescue this tiny
  cohort or claim the entire sweep concept fails.
- Of680 qualified origin formations,109 reach the confirmed first-return
  stage.171 first returns fall in the publication-overlap hour and are rejected
  conservatively; this is a material **entry-model limitation**, not proof those
  opportunities would be untradeable with minute-level confirmation/limits.
- Funding, tick/lot normalization, spread, queue and liquidation are not modeled.
  Cost stress is additional cost accounting, not a fill guarantee. Corrected
  candle history is not actual historical collector availability. All prior
  history is development data, no untouched holdout claim.

## Reuse and verification

Economic job:
`backtests/price-action/1ff4e6f0e2438c0b42c4989d433930d092c44135da30ca6be44c57def06f6907`

Reusable event map:
`backtests/price-action-events/88e2b6c3d2134782638ff5ea2cd7bb53eff1029613c683d4a34bbdc34a0e480d`

- `events-60000.json.gz` / `events-120000.json.gz`: full1h/4h bars, confirmed
  pivots,2,618 lifecycle rows and968 raw signals per clock. Saved once and reused
  across targets, windows and fills; no profile map rebuilt.
- `predecision-atlas/index.html`:16 first-chronological long/short examples,
  clipped to information available at the decision. Existing SVG renderer reused.
  Economic results did not select chart examples.
- `baseline-parity.json`: all6 archived raw-opportunity control paths match
  exactly, including receipts, ownership, monthly, curve and all stats.
- `receipt-verification.json`:384 independent arithmetic/ownership paths,
  22,536 receipts, gaps/ambiguity, open inventory, fees/R and minute DD/monthlies.
- `independent-verification.json`: complete pivot inventory, all1,936 signal
  source sequences across both clocks, three nonempty historical prefixes per
  clock. Synthetic future-poison, long/short origin and sweep, failure/expiry,
  latency, month-boundary and mutation-rejection tests pass separately.
- `report.md`, `results.csv`, `comparison-results.json`, `comparison-monthly.json`,
  `ranking.json`, per-cell trade CSVs and gzipped journals preserve all cases.

Only new detector, thin runner/report, and reusable structural receipt audit
were necessary. Existing aggregation, structural execution, costs, saved
candles, hashing/CSV and chart renderer reused. No accepted engine or live file
changed by this study. Existing unrelated maintenance edits remain untouched.

## Next coverage, not a parameter rescue

1. Add **PA04 closed-outside break/reclaim** and **PA05 distinct third visit** on
   the saved pivots with own simpler controls. They are not tested by this batch.
2. Then strict **PA02 named breaker**, preserving original-zone→sweep→failure→
   new structure→retest lineage. Do not rename this batch's ordinary origin
   return a breaker. PA01 still needs its post-exhaustion range anchor frozen.
3. Keep the structure-break short and lower-DD retest paths as **descriptive
   comparison leads**. A minute-confirmed or resting-limit origin variant would
   be a separate execution study, not a quiet replacement of these outcomes.

No HL/indicator combinations, BTC overlay, ladder change or live promotion.
Inventory advances **9,322→9,338 standalone**, overlays unchanged205.
