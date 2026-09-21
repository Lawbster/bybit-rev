# LC01: daily NPOC / daily-high entries with indicators

## Result

- **0/32 primary combinations qualify.** Four saved entry types, two existing exits, four filters; 16 diagnostic definitions also retained. Both long and short paths were tested at fixed $10,000 notional. This does not rule out indicators or other combinations.
- **Most useful defensive lead: daily NPOC long + positive hourly CMF.** Full net falls $15,962 -> $9,365 while adverse DD falls 14.09% -> 4.99%; June–September net improves $602 -> $1,685. This is a return/risk trade-off, not a full-period profit improvement.
- **Daily-high rejection short + negative CMF is sparse and timing-sensitive:** 10 wins / 3 losses, $3,042 versus its $5,400 parent, DD2.38% versus11.43%. Only two recent trades; increasing feature-publication lag to120s cuts full net to$1,561. Adding NPOC clearance does not establish a better strategy.

No live changes, ladder transfer, short reactivation or deployment recommendation.

## Exact test scope

Period: **2024-12-05 12:55 through 2026-09-15 20:20 UTC**, exclusive end.
Recent: **2026-06-01 onward**. Older/recent accounts start flat independently.
Each strategy is its own $10k fixed-notional account; do not add their profits
as though they were one portfolio. DD uses $32k starting equity and adverse
intrabar marks, not just closed-trade losses.

Fees:0.055% each side, plus a separate additional5bps/side stress. Before
funding; no live maker fees, queue, margin or liquidation claim. No fresh holdout:
these dates have already been researched. End remains Sep15 to isolate this
change from a new data extension.

| Saved entry | Side | Raw opportunities |
|---|---|---:|
| Daily NPOC downward touch, PB02 | Buy |264|
| Daily NPOC rejection from below, LV01/LV02 | Short |11|
| Previous completed UTC day's high rejection | Short |185|
| Previous completed UTC day's high breakout/retest | Buy |166|

The daily high is **not** HT01/HT03's rolling48h high. We preserved the saved
entries, rather than substituting new touch/rejection geometry. The NPOC map
is the accepted Bybit candle-derived volume-profile map, not new tick volume.

Two exits per entry: **12h timed exit with no TP/SL**, and **TP2% / SL3.5% with
a12h cap**. Fixed brackets anchor to actual fill. The first is retained as an
existing control, not assumed to be the correct final exit.

| Filter | Long condition | Short condition |
|---|---|---|
| CRSI extreme | Closed15m research CRSI <=10 | >=90 |
| ROC stretch | Closed1h ROC5 <=-2% | >=+2% |
| CMF alignment | Closed1h CMF20 >=+0.05 | <=-0.05 |
| CMF + NPOC room | CMF plus no other known naked daily POC within2% ahead | Same, underneath |

Readiness-only and room-only are diagnostic controls. All three indicator
values must be finite; **readiness removes no opportunities at the primary
clock**, so indicator effects are not merely warm-up abstention.

Four filters x four entries x two exits =32 primary definitions;16 diagnostics.
Accepted cumulative inventory: **9,322 standalone /205 overlays**. No new
threshold grid or extra economic variants were added after seeing outcomes.

## Full-period comparisons

The tables use60s feature lag, no extra execution delay, stop-first brackets.
Winning/losing dollars are net trade results after the stated fees. Dollar
columns are independently rounded; totals can differ by$1.

### Buys: daily NPOC bounce

| Setup | Wins / losses | Winning $ | Losing $ | Net $ | Avg loss $ | DD |
|---|---:|---:|---:|---:|---:|---:|
| **12h baseline** |125 /113|43,985|-28,023|**15,962**|-248|14.09%|
| + CRSI <=10 |12 /7|5,259|-962|4,297|-137|13.81%|
| + ROC5 <=-2% |32 /26|17,178|-6,040|11,138|-232|14.11%|
| + CMF >=0.05 |48 /37|16,512|-7,148|9,365|-193|4.99%|
| + CMF and NPOC room |48 /35|16,512|-7,086|9,426|-202|4.99%|
| **TP2 / SL3.5 baseline** |161 /97|28,185|-25,261|**2,923**|-260|7.45%|
| + ROC5 <=-2% |43 /18|7,968|-5,081|2,887|-282|6.12%|
| + CMF >=0.05 |57 /29|9,723|-7,591|2,132|-262|6.66%|

The bracketed ROC variant retains nearly all parent net with61 rather than258
trades; additional-cost stressed net improves from$340 to$2,275. However, it
still sacrifices older-period profit, has only six recent trades, and fails
monthly comparisons. It is a cost-efficiency observation, not qualification.

### Shorts: previous-day-high rejection

| Setup | Wins / losses | Winning $ | Losing $ | Net $ | Avg loss $ | DD |
|---|---:|---:|---:|---:|---:|---:|
| **12h baseline** |94 /84|27,821|-22,422|**5,400**|-267|11.43%|
| + CRSI >=90 |4 /7|2,217|-3,655|-1,438|-522|11.88%|
| + ROC5 >=2% |34 /33|12,988|-12,034|954|-365|11.51%|
| + CMF <=-0.05 |10 /3|3,676|-634|3,042|-211|2.38%|
| + CMF and NPOC room |9 /2|3,462|-453|3,009|-227|2.38%|
| **TP2 / SL3.5 baseline** |119 /63|21,094|-16,167|**4,927**|-257|5.70%|
| + CMF <=-0.05 |10 /3|1,749|-683|1,067|-228|1.54%|
| + CMF and NPOC room |9 /2|1,560|-502|1,058|-251|1.54%|

CMF's timed short win rate rises52.81% ->76.92%; adding room produces81.82%,
but on only11 trades. The room condition removes one winner and one loser,
costs$34 net and does not reduce DD. Its higher win rate is not added edge.
One $1,610 winner supplies about53% of CMF's full net.

### Remaining entry families

| Entry / exit | Baseline W/L | Baseline net / DD | What the filters did |
|---|---:|---:|---|
| Daily-high retest buy /12h |73 /82|$704 /16.29%|CMF -$1,619; ROC -$749; CRSI admits zero trades|
| Daily-high retest buy /2/3.5 |94 /71|-$3,010 /12.34%|CMF -$4,324; ROC -$705 on five trades; CRSI zero|
| NPOC rejection short /12h |5 /6|$675 /5.43%|CMF $1,660 /5.68%, only3W/2L|
| NPOC rejection short /2/3.5 |6 /5|-$182 /2.64%|CMF $395 /2.16%, only4W/1L|

Buying a breakout/retest and simultaneously demanding deep oversold CRSI
produces no entries in this saved series. Avoiding a losing baseline by doing
nothing is not a profitable strategy. The NPOC-short family is too sparse to
support a conclusion; its improved dollars are not a robust discovery.

## Recent-period comparison: June1–September15,2026

All rows below use the12h exit.

| Setup | Wins / losses | Winning $ | Losing $ | Net $ | Avg loss $ | DD |
|---|---:|---:|---:|---:|---:|---:|
| **NPOC buy baseline** |23 /17|4,786|-4,184|**602**|-246|7.58%|
| + CMF |11 /6|2,164|-480|1,685|-80|2.52%|
| + ROC |5 /1|1,755|-364|1,390|-364|2.51%|
| **Daily-high short baseline** |11 /17|2,387|-4,961|**-2,575**|-292|11.14%|
| + CMF |2 /0|279|0|279|—|0.46%|

NPOC+CMF is the more credible of these descriptive leads:17 recent trades,
not two or six. Nevertheless its older net is$7,680 versus$15,361 baseline,
and August2026 gives up$977. It does not preserve upside across periods.

## Loss avoidance and the profits sacrificed

- NPOC+CMF removes155 baseline trades:79 winners worth$28,141 and76 losers
  costing$20,875. Two replacement winners add$668. Exact delta:-$6,598.
  Losses of at least$300 fall37 ->7; their loss dollars fall$18,805 ->$3,891.
  The worst closed loss remains about$1,008. Lower DD is real in this replay,
  but not a guarantee against a future tail.
- NPOC+ROC removes183 baseline trades and adds three replacement winners
  worth$2,783. Full delta remains-$4,824. Its$11,138 filtered result is not the
  earlier descriptive subset's$8,355: changed occupancy admits new trades.
- Daily-high+CMF removes165 baseline trades:84 winners worth$24,145 and81
  losers costing$21,788. No replacements; delta-$2,357. Recent improvement
  predominantly comes from abstaining, not a proven frequent short signal.

NPOC room has limited reach: among264 raw NPOC-buy opportunities, only four
have another qualifying daily NPOC within2% overhead. Room alone improves
12h net by just$64, with unchanged DD. Combined with CMF it adds$62 and no
DD benefit. On daily-high shorts, room alone costs$1,875. On the11 NPOC-short
opportunities it blocks none. These results do not establish a useful
three-way level/indicator interaction.

## Monthly marked net: selected descriptive leads beside their parents

Full-account monthlies, not separately restarted monthly simulations. Complete
monthlies for every case are saved; the sealed review also includes all top-five
primary delta rankings, including sparse and zero-trade results.

| Month | NPOC baseline | NPOC CMF | Delta | NPOC ROC | Delta | Daily-high short baseline | Short CMF | Delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|2024-12|1,189|1,887|698|-647|-1,836|10|0|-10|
|2025-01|2,267|611|-1,656|653|-1,614|2,135|0|-2,135|
|2025-02|-387|-600|-212|-296|92|3,346|2,010|-1,336|
|2025-03|50|480|430|1,510|1,460|-846|0|846|
|2025-04|2,863|987|-1,876|956|-1,907|-130|0|130|
|2025-05|33|-128|-161|874|841|-607|0|607|
|2025-06|3,080|1,132|-1,948|858|-2,222|-861|-278|584|
|2025-07|647|1,053|405|398|-250|1,235|214|-1,021|
|2025-08|-93|446|539|181|275|758|400|-358|
|2025-09|-738|711|1,448|-212|526|1,094|-180|-1,274|
|2025-10|1,904|241|-1,663|651|-1,253|1,247|0|-1,247|
|2025-11|926|-296|-1,222|1,239|313|540|207|-333|
|2025-12|-933|342|1,275|-246|687|1,028|-141|-1,169|
|2026-01|782|-369|-1,151|2,058|1,276|-956|0|956|
|2026-02|1,646|703|-944|1,739|93|1,037|0|-1,037|
|2026-03|692|55|-638|32|-660|567|382|-185|
|2026-04|667|79|-588|0|-667|-378|150|528|
|2026-05|766|346|-420|0|-766|-1,244|0|1,244|
|2026-06|-977|252|1,229|980|1,957|-455|0|455|
|2026-07|-225|666|891|376|600|563|192|-370|
|2026-08|1,596|619|-977|0|-1,596|-2,318|86|2,404|
|2026-09|207|148|-59|34|-173|-365|0|365|

## Timing, cost and qualification

| 12h setup | Primary net / DD | +60s action delay |120s feature lag | Both delays |
|---|---:|---:|---:|---:|
| NPOC+CMF buy |$9,365 /4.99%|$8,784 /4.71%|$8,815 /4.99%|$8,319 /4.77%|
| Daily-high+CMF short |$3,042 /2.38%|$3,023 /2.32%|$1,561 /5.74%|$1,646 /5.82%|

Recent NPOC+CMF remains positive after action delay:$1,205 before extra cost.
Recent CMF short falls$279 ->$42 with the longer feature lag ($35 with both).
The short selection is meaningfully sensitive to which finalized hourly CMF
has arrived. Do not treat a60s modeled arrival as an observed exchange SLA.
Target-first versus stop-first changes no net result in these saved bracket
paths; that is an observed sensitivity result, not general intrabar certainty.

No primary rule passes the predeclared full/older/recent, sample, cost-stress,
monthly cash, own-parent net/DD/monthly and source-delay screen. The combined
rule also must improve on CMF-only and room-only; it does not. We did not
relax the screen because the original parent has bad months.

Conclusion: retain **NPOC+CMF as a defensive research lead**, and the bracketed
NPOC+ROC result as a turnover-efficiency observation. Daily-high+CMF needs
more independent evidence before its small winning cohort supports a new
short strategy. CRSI extremes at these specific entries and the extra NPOC
clearance did not deliver a general improvement. No broader family is ruled out.

## Reuse and verification

Accepted job:
`backtests/level-indicator/115a3a56ddead6e333ee025377aac687a0e9b39a4d48aa8daf6eaf199f4d5247`

- **72 exact archived controls** reproduced stats, accepted entries, trade
  receipts, monthly accounts, open inventory and curve before variants.
- **1,008 paths independently checked**,57,108 receipts,26,193,534 position
  minutes and14,784 monthly rows. The verifier repeats144 baseline checks
  because the same72 controls appear under two feature-lag assumptions.
- **1,252 saved contexts**:626 original opportunities x two source lags.
  Indicator bar-end/availability clocks, raw map lifecycle projection,
  nearest-level direction/origin exclusion and every filter checked.
- Six feature-prefix checks plus synthetic future-price/volume/map-lifecycle
  poison tests passed. Existing indicator formulas and established long/short
  execution auditors were reused, not rewritten. This establishes causal
  behavior under the modeled clocks, not historical live receipt evidence.
- Transitive source/input hashes and output seals checked; protected live
  files unchanged. Scoped strict typecheck and LC01 fixtures passed.

Useful saved artifacts: `results.csv`, `monthly.csv`, `ranking.json`,
`contexts.json.gz`, each case's trade/ownership journal, `baseline-parity.json`,
and `independent-verification.json`. The immutable `review.md` was generated
before verification and retains that heading; the subsequent verification
receipt and accepted locator record its final status. Do not rebuild maps or
rerun accepted jobs for another view of this result.

[Frozen method](../docs/research/level-indicator-lc01.md) /
[card](../research-inputs/level-indicator-lc01-2026-09-18.json).
