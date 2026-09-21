# Tested setups: HYPE research inventory

**SF08, September21: append latest candles; no new trading rule.**
[Findings](codex-astra-sfp-latest-candles-findings-2026-09-21.md).
Same SF01 range4h/absolute2R/24h, original stop vs5% padding,10k and candidate20k.
Cutoff Sep21 00:22; old prefix and open-position clocks preserved. One gap repaired
with separate public witnesses; recorded-arrival sensitivity confirms same events.
Sep15 SFP now closes TP Sep16 11:27: +$240.41/$480.82 at10k/20k vs oldstop-$134.76.
Full5%66W36L +$11,710/DD5.29% (10k), +$23,419/DD9.01% (20k); unchanged44W79L
+$2,842/DD7.92%.72 paths audited, no live changes; existing screen concerns remain.

**SF07, September20: requested 3-6% extra stop padding, every 0.25%.**
[Findings](codex-astra-sfp-wide-stop-grid-findings-2026-09-20.md).
Same SF01 range4h/2R/24h long, $10k, original TP/eligibility retained.
Highest net6% +$11,758/DD5.73%; 5% +$11,495/DD5.29%; both65W36L.
Baseline43W79L +$2,690/DD7.92%; prior3% +$7,497/DD8.47%.
Recent all5-6% identical +$3,232/DD3.06% (0SL), vs+$1,397/DD2.47%.
0/13 complete screen passes: recent DD and worse older months; historical
profitability improvement is real but not deployment qualification.
504 audited paths, 72 controls reused with exact SF01/SF06 archive parity.
Saved top-five monthly and full grid; 6% median actual risk7.93%, not6%.
No HL filters, longer holds, live changes or new engine; best6% chart saved.

**SF06, September20: widen execution SL without moving target.**
[Findings](codex-astra-sfp-wide-stop-findings-2026-09-20.md).
Original SF01 range4h/2R/24h long,10k notional, extra stop-price padding
0.5/1/2/3%, targets/eligibility/entry/cap fixed. Nets+$3,429/4,552/5,883/7,497
vs+$2,690 baseline. Best3%63W41L/DD8.47% vs43W79L/DD7.92%, average loss
$375 vs$196.24 losses convert to wins, larger remaining losses and missed
opportunities fully accounted. Recent2% outperforms3%;0/4 complete screen
passes due DD/monthly costs.180 audited paths, exact archived baseline parity.
No RSI/HL filter, limit entry,72h extension, new map or live changes. Reusable
stop-only option intentionally separate from bracket-retargeting stopBufferPct.

**SF05-HL, September20: blocked-winner HL inspection (zero new economic variants).**
[Findings](codex-astra-sfp-rsi-ema-hl-review-findings-2026-09-20.md).
Exact5 winners/14 losers removed by SF05: HL available for3/4 respectively.
Reuses SF04 entry and15m lead-in.1h buying covers all3 wins but also2/4 losses;
persistent flow/book/OI overlap, no validated rescue condition. Other6 mapped
stops provide broader counterexamples; missing older history explicit. No replay.

**SF05, September20: RSI15<52 AND closed4h >6% above EMA200.**
[Findings](codex-astra-sfp-rsi-ema-findings-2026-09-20.md).
Original SF01 4h/2R/24h only; two variants: entry veto, veto+ongoing exit.
Baseline43W79L +$2,690/DD7.92%; veto38W65L +$2,441/DD6.02%;
veto+exit39W64L +$1,997/DD9.97%.14 avoided losers cost5 larger winners.
Recent exit benefit is two trades; older winner truncation reverses full result.
0/2 cross-period screen passes,108 audited paths, baseline archive parity exact.
No grid, exit-only, wider SL, HL overlay, ladder or live change. Reuses SF01 scan.

**SF04, September20: bounded SFP pressure map (descriptive, zero economic variants).**
[Findings](codex-astra-sfp-pressure-map-findings-2026-09-20.md).
Original SF01 4h/2R/24h executed trades in recorded HL era:13 wins/10 stops,
selection sealed before features. 878 snapshots cover pre-entry, owned trade,
pre-exit and explicitly post-exit readings. RSI/CRSI/VWAP/EMA15m/1h/4h plus
HL flow/depth/OI/funding, geometry, indicator ranges and source-delay sensitivity.
Entry separation weak; weekly-discount descriptive difference, HL15 entry
direction flips by month. Later follow-through distinguishes outcomes but is
not an entry predictor.7/10 stops recover to original TP byentry+72h,2 do not,
1 censored. No filter, wider SL, entry/exit rule or new profitability claim tested.

**SF03, September20: post-confirmation sweep-low limit.** [Findings](codex-astra-sfp-sweep-limit-findings-2026-09-20.md).
Four candidate definitions (offset0/0.1% x hold24/72h), expiry4h; touch/open
execution, source lag60/120s, action delay0/60s and costs are sensitivities.
Original4h range-SFP signal, absolute SL/TP and signal eligibility unchanged.
24h baseline43W79L +$2,690/DD7.92%; touch exact2W46L -$254/DD4.23%;
+0.1%5W48L -$62/DD4.09%. Original winners missed41/43 and39/43;
median stop room0.1% and0.2%. 72h -$254/-$241 vs+$1,223 baseline.
0/4 qualify; independent audit360 paths, exact baseline parity both lags.
Not a wider-stop, HL filter, 15m trigger or hindsight sweep-entry test.

**SF02, September20: earlier SFP confirmation.** [Findings](codex-astra-sfp-earlier-confirmation-findings-2026-09-20.md).
Frozen4h anchors with15m sweep/reclaim versus archived range-SFP4h baseline;
2R24/72h, same dates/sizing/costs/clocks. Two new candidate definitions, controls
reused with exact event/action/result parity; no generic swing control substitution.
24h baseline+$2,690/DD7.92% vs-$2,259/DD14.35%;72h+$1,223/DD11.90%
vs-$2,614/DD15.40%.0/2 pass; older/recent both regress. Earlier reference prices
are cheaper but causal bracket, risk eligibility and occupancy change too.
HL recovery discrimination and wider stops remain separate, not falsified by this test.

**SF01 cross-asset transfer, September20:** [BTC/SOL findings](codex-astra-range-low-sfp-cross-asset-findings-2026-09-20.md).
Exact six definitions per asset (two controls, two primary range filters,
two range-high diagnostics), same HYPE card and window, no threshold search.
0/4 new primary passes: BTC24/72h range -$1,044/-$374 (controls -$3,888/-$3,339);
SOL -$6,818/-$7,448 (controls -$1,914/-$3,314). All new full-window paths lose.
12 additional asset-definition cells; delays/costs/source lags are sensitivities.
Charts and complete monthly evidence saved separately; HYPE not rerun.

**SF01, September20: range-low SFP versus generic swing-low reclaim.**
[Findings](codex-astra-range-low-sfp-findings-2026-09-20.md) /
[card](../research-inputs/range-low-sfp-sf01-2026-09-20.json).
Long-only 4h, fixed $10k, Dec27 2024-Sep15 2026; six definitions:
two generic 2R controls (24/72h), two range-qualified 2R candidates,
two range-high target diagnostics. Source-lag 60/120s and action-delay/cost/
ambiguity sensitivities, not additional independent strategies.
24h/2R: control72W135L +$2,530/DD12.10%; range43W79L +$2,690/DD7.92%.
Average loss both ~$196. **0/2 complete primary screen passes** (monthly
opportunity costs/concentration; 72h also loses net). Range-high24h +$299,
72h -$2,320. No H&S, POC, short mirror or ladder test. Six definitions counted
separately from the older cumulative figures, which omit Fable's scanner work.
Final job `e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b`.

**PA07, September18: first source-library price-action batch.**
[Findings](codex-astra-price-action-setups-findings-2026-09-18.md) /
[card](../research-inputs/price-action-pa07-2026-09-18.json).
PA06 sweep/impulse and PA03 origin-zone first-return, each against simpler
same-family control; longs/shorts × structural/reference2R target. Fixed10k,
24h cap,1h triggers/known4h pivots.8 candidates+8 controls,384 paths,
22,536 independently audited receipts;6 exact archived engine fixtures.
**0/8 candidate upgrades;0/16 absolute qualifiers.** Break-short2R control
$5,312/DD13.19%/226 trades versus retest$2,322/DD5.17%/50. Structural long
control−$7,784/DD37.27% versus retest+$1,537/DD12.88%/48. Only7 recent
retest trades each side; sweep/impulse leaves5long/7short. Existing engine,
935,005-minute cache and renderer reused; causal event map persisted.
**9,338 standalone/205 overlays**. No live changes; source concepts beyond
these precise adaptations are not falsified. Economic job
1ff4e6f0e2438c0b42c4989d433930d092c44135da30ca6be44c57def06f6907.

**LC01, September18: daily NPOC / previous-day-high with indicator context.**
[Findings](codex-astra-level-indicator-findings-2026-09-18.md) /
[card](../research-inputs/level-indicator-lc01-2026-09-18.json).
Four saved entries: NPOC touch long/rejection short, daily-high rejection
short/retest long. Timed12h and TP2/SL3.5 capped12h; CRSI15<=10/>=90,
ROC5-1h<=-2/>=2,CMF20-1h>=.05/<=-.05,and CMF plus2% daily-NPOC room.
32 primary /16 diagnostics (readiness and room-only): **9,322 standalone/205 overlays**.
72 exact LV02 controls;1,008 independently audited paths;1,252 saved contexts.
**0/32 qualify.** NPOC+CMF12h full$15,962->$9,365,DD14.09->4.99%; recent
$602->$1,685,n17. Daily-high+CMF short n13/full$3,042 versus$5,400 and delayed
feature availability substantially changes results. NPOC clearance adds little.
Map/engines/formulas reused; no live changes. Accepted job
115a3a56ddead6e333ee025377aac687a0e9b39a4d48aa8daf6eaf199f4d5247.

**HT03, September18: rejection / failed-breakout high shorts.**
[Findings](codex-astra-high-touch-rejection-findings-2026-09-18.md) /
[card](../research-inputs/high-touch-rejection-ht03-2026-09-18.json).
close_back,>=50% upper wick,first full post-signal5m/15m close-back,
closed-above then first recross below within5m/15m; three unchanged HT01
brackets.18 candidates +9 diagnostic definitions (matched5m/15m waits,
above-close cohort), **9,274 standalone/205 overlays**. Full/older/recent,
0/60s delay and both ambiguity orders:360 paths;36 exact controls matched.
All74,750 anchor decisions and115,974 execution receipts independently
checked.2/3.5 close_back $7,589->7,622/DD10.81->10.61%;recent$437->1,350,
but older-$860, monthly costs and slightly lower win rate. **0/18 qualifiers.**
Stricter wick/recross/timeframe confirmation not an overall improvement.
No POC/HL/ladder/live changes. Accepted job
8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5.

**HT02, September17: POC proximity entry vetoes on HT01 top3 brackets.**
[Findings](codex-astra-high-touch-poc-findings-2026-09-17.md) /
[card](../research-inputs/high-touch-poc-ht02-2026-09-17.json).
Parents exact-touch TP/SL2/3.5,3/3.5,2/3 unchanged.8 level families (previous
D/W/M/all POC; historical naked D/W/M/all) x4 distances0.25/0.5/1/2% x2 side
relations either/below =64 each,192 new. **9,247 standalone/205 overlays**.
36 exact HT01 controls;2,340 full/older/recent xdelay xambiguity paths with
independent minute/POC/ownership audit. Leading weekly POC below2% improves
all3 nets across6paths;2/3.5 $7,589->9,372/DD10.81->9.97%,WR65.15->65.99%.
Small intervention sample, recent delayed still negative, monthly costs:
**0/192 complete or relative passes.**No exit/hold/size/map/live changes.
Accepted job cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704.

**HT01, September17: standalone rolling48h-high short.**
[Findings](codex-astra-high-touch-short-findings-2026-09-17.md) /
[card](../research-inputs/high-touch-short-ht01-2026-09-17.json).
Exact prior-known touch and closed-minute within1%: each timed12h plus all49
2-5% TP/SL pairings in0.5 steps, retaining12h cap. 100 new definitions;
**9,055 standalone/205 overlays**. Full/older/recent x0/60s xambiguity:1,188
paths,884 unique journals, all independently audited;30 exact LV02 controls.
Fixed10k,32k equity forDD,0.055% each side,before funding. No POC/HL/ladder
inputs; highs calculated once. Exact2/3.5 $7,589/DD10.81% versus timed
-$4,338/24.35%; recent+$437 becomes-$463 with extra60s. Near1% best$1,390,
recent-$1,437. **0/100 complete or relative passes.** No live changes.
Job b66baaf224dbeafa68df168cca734c7f9e95e3fe13626c4a178e4525f178e65a.

**LV03, September17: NPOC touch-long24h/no time cap.**
[Findings](codex-astra-poc-exit-cap-findings-2026-09-17.md) /
[card](../research-inputs/poc-exit-cap-lv03-2026-09-17.json).
49 unchanged2-5% TP/SL pairs at24h and no cap =98 new definitions, plus timed24.
12h grid/timed controls already counted;594 paths reproduced exactly. Full/
older/recent x0/60s xambiguity sensitivity:1776 paths,930 unique journals all
independently audited minute-by-minute. No signal/map/size/other-entry changes.
4.5/5:12h$7473,24h$597,no-cap$3708; best24h$3200,no-cap$5034, both recent losses.
Timed12$15962 still higher. No-cap2/5 wins74.48% but nets$2468/DD15.95% versus
own12h$4523/DD10.72%. Open inventory marked, holding times saved. **0/99 complete
or relative passes;8,955 standalone/205 overlays.** No live changes.
Job919d76a621bbdcceee8848111ab58dd1abbca8390c7d3b512beea61ce84ecdca.

**LV02, September17: fixed percentage TP/SL, independent long and short ownership.**
[Findings](codex-astra-level-tpsl-findings-2026-09-17.md) /
[card](../research-inputs/level-tpsl-lv02-2026-09-17.json) /
[complete grids](../backtests/level-tpsl-reports/43dd21c761283a5d7a56b70252dab807b6ad8595d22a5ac60e8c9a0e7f1e0520/grids.md).
32 LV01 raw streams split by direction plus original PB02 touch-long =65 groups.
TP and SL each2/2.5/3/3.5/4/4.5/5%, all49 pairings =3,185 grid definitions;
64 new side-only timed controls, PB02 timed already counted. 3,249 additions,
**8,856 standalone /205 overlays**. 12h cap, fixed10k, taker fees unchanged.
Full/older/recent x0/60s delays xstop/target-first sensitivity;38,610 reported
paths,198 exact archived controls,1,976,551 independently checked receipts.
Daily-low long2.5/4.5 retains timed profit approximately with lower DD;
previous-day-open short3/5 improves full $702->7,412/DD16.98->6.64%, but recent
21 trades and thin older delayed stress margin. No complete or relative pass;
monthly costs remain. Highest sampled long WR70.75% is not profitable recently.
No entry/map/timeframe/hold/HL/sizing search or live changes. Accepted job
43dd21c761283a5d7a56b70252dab807b6ad8595d22a5ac60e8c9a0e7f1e0520.

**LV01, September17: all calculated calendar/VWAP/POC families, independent $10k.**
[Findings](codex-astra-level-playbook-findings-2026-09-17.md) /
[frozen card](../research-inputs/level-playbook-lv01-2026-09-17.json).
32 entry definitions: prior/current ranges, midpoints, seven opens, six VWAPs,
three VWAP stretch-return cells, six latest/naked POC rejections. Each timed12h
or reaction/level stop +2R/12h =64 definitions; 576 window/delay/ambiguity paths.
Saved full-minute atlas; exact POC map reused; six exact PB02 controls.
Full daily NPOC reference $15,962/DD14.09%; monthly VWAP-return $8,683/16.24%,
developing daily range $7,765/15.43%, recent $3,368/6.91%. Older/cost/monthly
failures remain. Daily-range accepted longs +$11,107, shorts -$3,396: attribution,
not side-only policy earnings. Four of32 brackets profitable full-primary;
no strict qualifier. Prior-month-open bracket only4 recent fills, unresolved.
**0/64; 5,607 standalone/205 overlays.** Independent 66,808 map checks,
9,984 signals,105,448 receipts,27,406,237 minutes. No live/ladder changes.
Accepted job e84ae39a0e87b46ec3082ef407b8463dd8769beeddad5177b01357598b2b4a43.

**PH02, September17: actual POC HL-only versus HL+weekly-VWAP entry vetoes.**
[Findings](codex-astra-poc-hl-filter-findings-2026-09-17.md).
Exactly2 new definitions, no exits/shorts/size/map changes. Same48 covered raw
touches;42 baseline fills/$1,676/7.34%DD. B20 fills/$2,203/3.19%, but late and
monthly regressions. C27/$2,387/4.86% improves economics all12 timing/window
comparisons; fails only sample floor in the declared screen. Both inherit
two extra losers/-$561. C uplift-$344 excluding two largest avoided-loss
contributions. C retained frozen lead, not qualified/live. Six exact PB02
controls and36 independent path audits. **0/2;5,543 standalone/205 overlays**.

**PI01/DB01, September17: POC indicator/heavy-loss context and daily bias.**

[Findings](codex-astra-poc-indicator-daily-bias-findings-2026-09-17.md).
24 fixed indicator/HL diagnostic cuts; zero fitted thresholds. Four economic
POC failure probes (long exit and separate short after one/two15m failures),
plus18 daily-bias definitions (4h confirmed pivot widths1/2/3, UTC00/08/16,
prior-day versus opposite-swing targets). 282 paths include controls/delays/
ambiguity, not282 independent rules. Six PB02 baselines exactly reproduced.
Two-close exit improves full net/DD but fails recent/delay/monthly screens;
gain is extra-entry occupancy, not improved changed exits alone. Plain shorts
and all daily-bias cells fail. **0/22;5,541 standalone/205 overlays.**
No map rebuild or live/ladder-size changes. HL+weekly-VWAP remains descriptive.

**PH01, September 17: HL context of existing daily NPOC touch outcomes.**
[Findings](codex-astra-poc-hl-context-findings-2026-09-17.md) /
[card](../research-inputs/poc-hl-context-ph01-2026-09-17.json).
Read-only attribution of accepted PB02 12h primary path, not a filtered replay.
Exact 238-trade baseline; 52 REST-era entries and 42 rich-covered entries.
Covered baseline 25W/17L, +$1,676. Relative selling acceleration warning
12W/12L, -$1,087; complement 13W/5L, +$2,764. Early/late and source-delay
direction agrees, but two June losses dominate negative warning net and
May/August profits would be discarded. Book deterioration secondary/sparse.
Absolute selling, OI, funding and HLP do not give a reliable stand-alone gate.
16 fixed diagnostic predicates, per-month accounting and 16-minute lead-in;
37,440 outcome minutes independently checked, future paths excluded from features.
No new timing/TP rule, no map rebuild, no policy qualification or live changes.
**Zero new economic definitions; 5,519 standalone / 205 overlays unchanged.**
Job f2ddb15b19802d32563db2bdf82088f3b55ad2eb2fffb626c5ec1c2801fe02ca.

**PB02, September 17: daily NPOC touch holding-period comparison.**
[Findings](codex-astra-poc-hold-findings-2026-09-17.md) /
[card](../research-inputs/poc-hold-pb02-2026-09-17.json) /
[method](../docs/research/poc-hold-pb02.md).
Unchanged PB01 daily-naked touch entry, $10k, 0.055% fees per side, no TP/SL.
Fixed holds 1/2/3/4/5/6/8/10h against archived 12h; 0/60s action delays;
full/older/recent resets. All 264 signals reused; occupancy recomputed.
54 paths independently verified, six exact 12h controls, 9,096 receipts;
55 synthetic tests. Full 12h $15,962/DD14.09%, 10h $13,720/13.16%,
3h $5,759/13.76%. Recent 3h $871/4.01% versus 12h $602/7.58%.
Recent improvement concentrated in June 4; extra recent entries lose money.
**0/8 strict relative upgrades.** No new TP/SL, map rebuild or live change.
This does not qualify the parent 12h strategy for deployment.
**5,519 standalone / 205 overlays** (eight additional definitions).
Job ba566f0b7b2c3ebfb0446d8e42bfaf990d99d41e4d36e682230d6dd636117790.

**PB01, September17: standalone POC bounce entries, no ladder.**
[Findings](codex-astra-poc-bounce-findings-2026-09-17.md) /
[card](../research-inputs/poc-bounce-pb01-2026-09-17.json) /
[method](../docs/research/poc-bounce-pb01.md).
30 rules: three Bybit POC periods, latest versus naked, five trigger clocks.
Fixed$10k longs,12h exit,0.055%/side,0/60s delays; full/older/recent resets.
726 paths include90 separately labeled shifted-calendar controls;6 exact
existing clock controls. No map rebuild, Binance mixing, alternate exit or
live changes. Full daily-naked touch$15,962/DD14.09%, clock$14,518/29.24%.
Recent touch$602 falls to$51 with1m extra delay; hourly confirmation$1,298/n18.
0/30 strict passes; daily NPOC is retained as a research lead, sparse weekly/
monthly samples not declared disproven. 186 independent minute-reference
paths and76,090 fill receipts verified. **5,511 standalone /205 overlays**.
Job c3e5a4f66b8c755fa2127b59484477832b00443c9c5e4ba07cf63fbc9f4f8e33.

**SM01, September17: map substitution and OR combinations, Agg10.**
[Findings](codex-astra-sr-multimap-findings-2026-09-17.md) /
[card](../research-inputs/sr-multimap-sm01-2026-09-17.json) /
[Fable handoff](fable-sm01-review-handoff-2026-09-17.md).
Current pulse partial and partial+buffered ordinary TP, each on local14d control,
4H-only, daily-only, local+4H, local+daily, all-three. No touch pooling or stacked
actions; original thresholds/clocks retained. Macro roles stay confirmed.
72 paths: 12 exact SRT03/SRP01 controls,40 primary alternatives,20 recent
geometry+60s checks. Reuse saved macro maps and one persisted local map tape.
Current touch baseline recent$35,784/DD20.39%, longer$61,635/25.09%.
Local+4H buffered TP$37,276/20.46%, $68,395/27.38%; monthly/DD failures.
Recent/longer gains excluding largest positive occupancy component turn negative.
All-three identical; daily-only has0 recent actions and9/6 older partials.
4H-only partial's recent gain reverses older/alternate. **0/10 passes**;
not a rejection of all higher-timeframe S/R. No live changes.
Independent314,220 fills/23,547,806 minute-path checks/31,170 cache checks pass.
**5,481 standalone /205 overlays** (195+10 definitions, not72 independent trials).
Job e5a22ec73d06c663a5fe8d5f72b92bf9ec562e452ef7c5fdc357d83a7803ba49.

**SRL01, September16: remove resistance only from the Agg10 pulse partial.**
[Findings](codex-astra-sr-level-ablation-findings-2026-09-16.md) /
[card](../research-inputs/sr-level-ablation-srl01-2026-09-16.json) /
[Fable handoff](fable-srl01-review-handoff-2026-09-16.md).
16 paths:10 exact SRP01 controls,four primary B,two recent B-pulse60.
Independent inventory plan removes only level presence/proximity; depth,keep3,
profit,pulse,cooldown,healthy14d coverage,all other actions/timing unchanged.
Recent touch A$35,784/DD20.39%/79partials, B$21,673/32.44%/272.
Longer touch A$61,635/25.09%, B$42,187/23.77%. Alternate net deltas
-$20,736 recent/-$14,615 longer. No terminal inventory mismatch. Fewer recent
losers but larger average loss,40 fewer TPs; extra partial proceeds not extra net.
78,619 fills/5,326,898 minutes/167,914 decisions checked; supplemental checker
fixes sparse-rebuild cadence, not economic outputs. **0/1; no live changes.**
SRP01 disabled is NOT neither-filter partial: no completed2x2 or placebo claim.
**5,481 standalone /195 overlays**. Job
e0cdefd3f77b3dcb46144658d67cd70d94d69d0e9239ac21c3a2ac03ecd3baf6.

**SRF01, September16: major-support failure / hard-flatten reach, diagnostic only.**
[Findings](codex-astra-support-flatten-reach-findings-2026-09-16.md) /
[card](../research-inputs/support-flatten-reach-srf01-2026-09-16.json) /
[Fable handoff](fable-srf01-review-handoff-2026-09-16.md).
Four accepted Agg10 controls, unchanged MA01/MS02 macro map/recovery,0/60s joins.
Every-minute native age/PnL/trend matrix and recovering winners. Oldest surviving
age; first6-12h clock-only and>=12h trend-only intersections; next-open inventory
marks with banked partials, not strategy earnings. None of four cited large
losses reaches clock-only. Recent touch4 ladders(2W/2L):-$4,210 attribution;
longer16(6W/10L):-$10,598. Trend-only touch-$8,562/-$4,202; alternate positive
labels are concentrated and do not establish replacement-cycle profits.
Independent3,086,684 minutes/1,678 labels pass; control/source integrity verified.
**Park clock at reach stage, not economic falsification. Zero new definitions,
5,481 standalone/194 overlays unchanged; no live changes.** Job
1d6d910d8afd74281faa7885f0c216c5329e307141c10f714dd9a35836c7c84f.

**SRK01, September16: timer-only resistance add skip, exact Agg10 controls.**
[Findings](codex-astra-resistance-add-skip-findings-2026-09-16.md) /
[card](../research-inputs/resistance-add-skip-srk01-2026-09-16.json) /
[Fable handoff](fable-srk01-review-handoff-2026-09-16.md).
One definition: already five rungs, otherwise approved/affordable timer-only
add, nearest resistance above price within0.3%, three6h-spaced pooled confirmed
touches, healthy14d context. Drop adds exempt; no clock reset, map/partial/size
change. Approved-fill denominator sealed before alternatives, not fired shadows.
12 paths/four exact controls. Recent touch A$35,784/DD20.39%, K$34,268/20.49%;
longer A$61,635/25.09%, K$59,906/25.95%. Alternate deltas+$797/+$368, monthly
failures. All source+60s economics identical. Most vetoes postpone timer adds
briefly; recent loss dollars increase$1,110 despite one extra TP cycle.
Independent62,076 fills/4,630,026 minutes pass. Supplemental diagnostic corrects
five longer-touch next-fill labels (earlier-armed TP); accepted economic outputs
unchanged. **0/1 qualifies; no live changes. 5,481 standalone /194 overlays.** Job
d1fa985cdbdeb598902fb8cc2ea3e59a4c7f37ad464a55bb2e9deeb0348f506c.

**SRR01, September16: selected-TP re-entry, exact Agg10 controls.**
[Findings](codex-astra-resistance-reentry-findings-2026-09-16.md) /
[card](../research-inputs/resistance-reentry-srr01-2026-09-16.json) /
[Fable handoff](fable-srr01-review-handoff-2026-09-16.md).
Two new definitions: D/SRT03 sr_fixed1 plus full-selected-TP-only 4h wait;
same wait with post-fill confirmed5m close > frozen resistance x1.001 release.
No wait after other closes, no support release, map/partial/sizing change.
24 paths: eight exact archived A/D controls, eight primary, eight +60s sources.
Recent touch A $35,784/DD20.39%; W $44,009/17.31%; R $33,826/22.98%.
Longer touch A $61,635/25.09%; W $56,705/30.45%; R $50,129/27.51%.
W improves recent but loses older net and worsens DD; R loses all four primary
net comparisons versus A and fails its additional W comparison. Monthly failures
and concentration retained. September9 lower re-entry does not remove the loss.
312 selected-TP observations preaudited before economics; independent 121,501
fills/9,260,052 minute checks and all wait/source/provenance checks pass.
**0/2 qualifies; no live changes. 5,481 standalone /193 ladder overlays.** Job
341a5509152a8a26d630ed46ea486b1b745360dd5b7ac0dd3f07a527ae210d9d.

**SRT03, September16: resistance TP full economic replay.**
[Findings](codex-astra-resistance-tp-replay-findings-2026-09-16.md) /
[card](../research-inputs/resistance-tp-replay-srt03-2026-09-16.json) /
[Fable handoff](fable-srt03-review-handoff-2026-09-16.md).
Four new definitions: exact qualified resistance; buffered up-to0.3% with
gross1% floor; same-selector fixed1%; global ordinary fixed1%. Current14d
map and partials untouched. Fixed target until inventory/phase change,
all mutation priorities preserved, no same-candle target fills.
36 paths: eight exact B17/Agg10 controls,16 primary and12 geometry60 cases.
Recent resting Agg10$35,784/DD20.39%; buffer$38,206/20.68%, SR-fixed1%
$38,153/20.69%, global1%$33,735/19.92%. Longer resting baseline$61,635/
25.09%; buffer$62,074/28.87%. Alternate buffer delta+$4,026 recent/
$7,436 longer. Economic metrics unchanged under60s geometry delay.
**0/4 passes**: buffered positive net across all four but worse resting DD,
older month up to-$4,111; concentrated benefits. September wick capture
does not remove the next replacement loss. Independent196,837 fills,
13,890,078 minute marks,207,030 target transitions and48 prefixes pass.
No maker/funding/queue certification or live change. Counts **5,481 standalone
/191 ladder overlays**. Job
4fc105f9a542d11411a483c8b8e16d22769e76897ecc4351a3ddb98e2d0cb3f4.

**SRT02, September16: resistance TP leeway, paired opportunity diagnostic.**
[Findings](codex-astra-resistance-tp-buffer-findings-2026-09-16.md) /
[card](../research-inputs/resistance-tp-buffer-srt02-2026-09-16.json).
Exact same SRT01 anchors; one up-to0.3% offset bounded by gross1% profit floor.
Eight geometry/window/model paths, eight archived economic controls checked.
Recent touch baseline $35,784/DD20.39%; future contacted ladders10->16;
alternate6->11. Older101->124/53->89 plus two/one at-intent opportunities.
New large-loss reach is one September wick-only rung2 case; no replacement
path or alternative net/DD computed. Floor binds85-90% of recent anchors.
2,012 matched pairs independently verified. **Not an economic test or live
change; counts remain 5,481 standalone /187 overlays.** No uncapped below1%
target, map/partial modification or buffer sweep. Job
432136567619a78753d9dacf3736be14d3a81b79472d2419a142ebcd33c4fb1c.

**SRT01, September16: resistance-priced TP opportunity/causality diagnostic.**
[Findings](codex-astra-resistance-tp-opportunity-findings-2026-09-16.md) /
[card](../research-inputs/resistance-tp-opportunity-srt01-2026-09-16.json).
Eight archived controls; four accepted Agg10 paths at source0/source60.
Unchanged14d map/current partials. Existing nearest point, ordinary1.4% TP,
1.0% minimum profit, three six-hour-spaced pooled touches; never lifts stale.
Recent touch baseline $35,784/DD20.39%; eligible34, hit10, all baseline winners.
Recent alternate eligible44/hit6/zero hit losers. Longer touch101 hits includes
one January wick-only loser; alternate53 hits/zero losers. No replacement
cycles simulated, no alternative net/DD, no economic qualification.
Independent43,486 fills/3,086,684 checks/2,012 anchors pass. **Zero new trading
definitions: 5,481 standalone /187 overlays. No live changes.** Earlier
HL-tighten failures retained; this diagnostic does not falsify all shading.
Job39a931f5279256962a8b4a35615bc3b69b6d8f1e36db884de2ebacdb65b9bc6d.

**SRP01, September16: exact Agg10 resistance-partial action ablation.**
[Findings](codex-astra-sr-partial-audit-findings-2026-09-16.md) /
[card](../research-inputs/sr-partial-audit-srp01-2026-09-16.json).
24 paths =8 exact B17/Agg10 controls +12 alternatives +4 recent pulse60 cases.
Three new definitions: partials disabled; pulse-free; same-depth hostile pulse.
Unchanged14d30m map, depth6/keep3/profit/distance/cooldown, other gates/exits.
Current leads net in all four window/model sets. Recent touch baseline
$35,784/DD20.39%; disabled $32,942/22.08%; pulse-free $29,935/26.62%;
hostile $31,147/21.63%. Extra23 TPs with disabled do not cover increased losses.
Monthly and concentration tables retain the September benefit of disabling
and the June-tail concentration of current partials' advantage. Older results
are BTC/funding-heavy, not complete-HL validation. **0/3 passes; no live changes.**
Independent115,753 fills,8,413,582 minute marks,33,052 opportunities verified.
Separate audit-only reviewer corrects an unavailable-counter adapter; frozen
economic sources/results preserved. TP shade/timer skip/reach audit untested.
**5,481 standalone /187 ladder overlays**. Job
25df94dde246452319a270441cb8777c4f62f92b70f505b26ede4790f202d42a.

**MA01/MS02, September16: major-level encounters and structural recovery.**
[Findings](codex-astra-major-level-recovery-findings-2026-09-16.md) /
[card](../research-inputs/major-recovery-ms02-2026-09-16.json).
547 atlas events, including120 failure spells. Fixed prior120d4h major map;
new complete1h response and confirmed higher-low/neckline release below old
support. Two rung1-only rules: accepted break / later failed retest. No HL
trading rule, existing-add restriction, partial or exit changes.
20 paths =8 exact B17/Agg10 controls +8 primary +4 recent60s delay cases.
Recent resting baseline $35,784/DD20.39%; break $33,248/19.47%; retest
$36,618/20.40%. Retest gains depend on one June loser and fail alternate TP,
older DD/monthly robustness. Both retain recent July/Sep loss totals and
same11-rung/-$2,296 ending open mark. **0/2 passes; no live changes.**
Independent atlas clock/source/control and full economic verification pass.
Prior local0/8, local-memory0/4, MS01block0/4 results remain counted.
Two new definitions: **5,481 standalone /184 ladder overlays**.
Atlas job945573667abace0162c8efe5b205aa9da5421afbf6384279bc2eda489bb3d763;
replay job99b4db4d3f01f6b00c439ca1b6ef26171224c61eda9ad46dd2b3658f5ff7cd94.

**September16 S/R literature/roadmap review — not an economic experiment.**
[Findings and proposed checkpoints](codex-astra-sr-foundations-and-roadmap-findings-2026-09-16.md).
Crypto/equity/FX evidence reviewed against local S/R-pulse, SRM01 and MS01.
Major-level response/release atlas proposed; no new tested strategy or live
candidate. Inventory unchanged: **5,481 standalone /182 ladder overlays**.

**MS01, September16: separate major-support-failure fresh-ladder block.**
[Findings](codex-astra-major-support-failure-findings-2026-09-16.md) /
[card](../research-inputs/macro-support-entry-ms01-2026-09-16.json).
32 paths: eight exact SRM01 B17/Agg10 controls, sixteen primary alternatives,
eight recent +60s macro-availability sensitivities. Two overlapping windows,
two TP models; current Agg10/14d parent and standard fees unchanged.
Four definitions: any support / resistance-origin flip, each reclaim-only /
24h cap. Nearest known support within3%, two subsequent closed4h failures;
only nextDepth1 veto, no deeper-add or exit changes. 120d macro observer.
Recent resting baseline $35,784/DD20.39%; reclaim $36,485/13.81%, cap
$32,400/20.39%. Reclaim's 65 lost TP cycles and alternative/older failures
prevent upgrade; capped version preserves all recent resting completed losses.
0/4 screen passes. Long reclaim lockouts and nine/six affected recent events.
Independent source/clock/entry/ledger/partial/target checks all pass; no live changes.
Four new long-overlay definitions: **5,481 standalone /182 ladder overlays**.
Job e8c9e0c1d591deca41a16488dab26dc82c9ceebe6bed5a7b99f537302a1c63a2.

**SRM01, September16: local S/R retention plus separate macro observer.**
[Findings](codex-astra-sr-memory-macro-findings-2026-09-16.md) /
[card](../research-inputs/sr-memory-macro-2026-09-16.json).
Eight exact B17/Agg10 controls across two overlapping windows/two TP models;
16 Agg10 alternatives changing only srShadow.recentDays to21/30/60/120.
Current14d leads net in all four comparison sets; 0/4 upgrade qualifiers.
Recent resting14d $35,784/DD20.39%; 21d $27,531/19.01%;30d
$26,494/19.70%;60d $29,384/19.53%;120d $29,319/19.53%.
All recent Agg variants end with identical11-rung/-$2,296 inventory.
Independent126,392 fills,9,260,052 minute marks,4,058 partials verified.
Observer: frozen120d4h/daily confirmed pivots, first-known dates and role
changes;37/1 retained qualified zones. June zone containing$75.401 found
without hardcoding. No macro profit test or new-ladder veto implemented.
Audit-only cooldown/counter-adapter corrections disclosed in method; economic
sources/results unchanged. Four new overlay definitions, no short variants:
**5,481 standalone /178 ladder overlays**. Live config/state unchanged.

**Agg10/B17 September15 drop extension: zero new definitions.**
[Findings](codex-astra-aggressive10-drop-extension-findings-2026-09-15.md).
Four exact September14 controls +four extended runs to September15 20:20 UTC.
Existing current policy versus B17, two TP assumptions; no waiting/half overlay.
Agg10 September touch-$5,032 versus B17-$5,312, and still11 rungs/-$2,296 open.
Independent20,758 fills and1,386,812 minutes pass. This is not an actual-account
maker/funding/liquidation replay or a new $19,450 starting-equity test.

**EQ01 concentration follow-up (September15): no new variants.**
[Three-case analysis](codex-astra-entry-wait-loss-concentration-findings-2026-09-15.md).
Includes replacement ladders, partial-threshold and wick sensitivity; all13
case-sequence cashflows independently checked. Two recent sequences explain
more than the full waiting gain. March re-entry returns most of its apparent
escape. Existing cross-period failures and live policy remain unchanged.

**EQ01 deep timed-add entry quality (September15): diagnostic checkpoint.**
[Findings](codex-astra-entry-quality-findings-2026-09-15.md) /
[card](../research-inputs/entry-quality-eq01-2026-09-15.json) /
[method](../docs/research/deep-timed-entry-quality-eq01.md).
Eight exact L17 controls: Agg10 vs existing depth8+/0.1%/15m waiting,
two windows/two TP assumptions. First eligible deep timer per episode:
108/116 recent and376/383 longer resting/alternate observations; all deeper
decisions, genuine drops, first entries and waiting intents stored separately.
Eight source descriptor families and12 possible three-way diagnostic cells,
0/60s clocks, raw/repaired BTC. Price labels do not imply executable fills.
Matched/removed/replacement accounting reconciles all total deltas.
BTC-nonnegative waiting contribution negative in all four controls; negative
BTC benefits fail alternate TP and are concentrated. No robust new selector
or conditional economic qualification. Conditional BTC waiting is NEXT,
not already tested. Existing unconditional waiting's failures unchanged.
Independent ledger/source/label audits pass.28,207 missing BTC minutes in a
separate validated research bundle; baseline gate data/raw archives unchanged.
Delivery job466be37a778b2973423c7c6bd894e5b90c4433f7cfcde4bdec24efb0bbe014b3;
v2 keeps intent outcomes strictly separate from source observations. Earlier
3aedc83c export is superseded, not another trading definition.
**Zero trading definitions added:5,481 standalone /174 overlays.**

**RP02 BTC-triggered HYPE-response atlas (September15): descriptive only.**
[Readout](codex-astra-btc-movement-readout-2026-09-15.md) /
[full findings](codex-astra-btc-movement-atlas-findings-2026-09-15.md) /
[card](../research-inputs/btc-movement-atlas-2026-09-15.json).
Same RP01 dates/grid/threshold sizes, but BTC +/-6/10% over4/12/24/48/72h
is the trigger. HYPE is the response.20 event definitions,99 rule-events,
75 timestamps; no trading rules. Missing BTC windows fail unknown, including
April6-25 gap; no reconstruction of missing live availability.0/60s lag.
BTC-10%/48h n2, one future severe drop and two+5% rebounds; both+2% first.
BTC+6%/72h severe6/12 but0/2 recent.0/20 full descriptive passes.
HYPE context/label parity and four baseline digests exact;33,766,111 source
minutes,53,054,400 outcome minutes,31,644 horizons and320 intersections pass.
All events/months/indicator cuts/waits/paired charts saved. Pause/add/exit
portfolio experiments parked. **Counts remain5,481 standalone /174 overlays.**
Job90bc5671f092dd7dc49f407982ec2abf6775d17d71e74b6222e7c83d1ce3dff5.

**RP01 major-rally pullback atlas (September15): descriptive only.**
[Readout](codex-astra-rally-pullback-readout-2026-09-15.md) /
[full findings](codex-astra-rally-pullback-atlas-findings-2026-09-15.md) /
[card](../research-inputs/rally-pullback-atlas-2026-09-15.json).
Ten price-event definitions: +6/+10% over4/12/24/48/72h, first crossing
on completed4h bars,72h minimum separation. 2,644 references,319 rule-events,
221 distinct times. Union July1,2025–September14,2026 15:27 UTC; prior
published/recent windows retained, plus disjoint early/recent views with
boundary outcomes censored. Future2/5/10% decline distinguished from
retracement after further upside.4/8/12/24h waiting-price diagnostics,
0/60s availability, nine candle/indicator flags, two12h confirmation watches,
and frozen unchanged-Agg10 add intersections. No changed portfolio replay.
Leads: fast6%/4h spike7/11 severe declines;10%/48h26/31 moderate and11/31
severe declines, with lower prices after4h in23/31. Ordinary6%/24h rise
does not enrich severe risk. Recent sample counts too small for promotion;
cooldown overlaps many winning ladders. No universal high-RSI/wick warning.
53,054,400 brute-force minute/31,644 horizon checks, four baseline ledgers
pass. Charts include failures AND continuations; all labels separated from
features. No profit estimate, live change or new trading definitions.
Jobc1c9c820759a4cddbaf8270e2763122c819705499f3d8b3eed39caf7400c93ba.
**Counts remain5,481 standalone /174 ladder overlays.**

**L17 waiting x high-exit removal (September 15):**
[Findings](codex-astra-entry-patience-high-interaction-findings-2026-09-15.md) /
[card](../research-inputs/entry-patience-high-interaction-2026-09-15.json) /
[method](../docs/research/entry-patience-high-interaction.md).
Frozen 2x2: Agg10 high exit on/off x no-wait/timer8_cap0.1; 15m expiry.
20 cases (16 primary +4 recent cap-charge); ten exact L16 controls.
Only the age>=4h/within1% of48h-high full exit is removed, not an entry gate.
10h stale TP, sizing, other gates/partials/exits and taker fees unchanged.
Recent resting net/DD: baseline $38,080/20.39%; wait $43,368/20.95%;
no high $32,295/19.59%; no high+wait $36,151/18.71%.
No-high+wait average completed loss $3,544 vs baseline $1,812; ending
11-rung marked loss $6,237 included in net. Waiting benefit without high
is $3,856, smaller than $5,289 with it. Published no-high+wait loses
$12,709 vs baseline with DD +3.14pp. Alternate TP/cap sensitivity does
not rescue absolute performance. **0/3 complete-screen qualifiers**.
Both overlapping windows and full monthly W/L/marked comparisons retained.
Independent 92,628 fills, 6,849,444 marks, 118,754 waiting checks,
4,047,136 TP checks and 1,877,119 high checks. Original 25 fixtures plus
focused single-leg/config/timing tests and typecheck pass. No live changes.
Job574a070f6c1a081269115e28f112f088f8744a39b66010ae321a100c087e88f5.
Two additional ladder combinations; **5,481 standalone /174 ladder overlays**.

**BH03 / L16 entry patience (September14 frozen / overnight completion):**
[Findings](codex-astra-entry-patience-findings-2026-09-14.md) /
[card](../research-inputs/entry-patience-2026-09-14.json) /
[method](../docs/research/entry-patience-bh03-l16.md).
BH03: no new signal or expiry;15m BTC-dip parent under0/2/5/10bps execution
cost each side, identical-cost market benchmarks,0/60s delay and0/5bps raw-open
support.60 cases including12 exact BH02 controls. Full economic replay, not
the earlier post-hoc price-only attribution. Positive capped-price leads retain
monthly costs and unverified execution liquidity; no live promotion.
L16: six new definitions, timer-only nextDepth>=2/>=8 x0/0.1/0.3% below
frozen last-closed-minute reference;15m exclusive expiry, reserved30/60m re-arm,
no chasing, gated cancellation, ordinary price-drop priority. First rung unchanged.
56 runs: eight exact B17/Aggressive10 controls,24 primary,12 recent cap-charge,
12 recent60s activation. Best recent resting lead depth8+0.1% gains$5,289 and
15 TPs but DD worsens0.56pp; recent confirmed loses$3,481, published resting
loses$572 with DD+1.09pp.0/6 incremental full-screen qualifiers.
0% no-extra-pullback rules are unchanged in primary, not evidence of damage;
delay sensitivities still alter their path. No blanket rejection of patience.
Independent264,260 fills/42,492,858 marks/740,459 waiting checks;25 fixtures.
Job4e905058cd291cfb7f2a4b227c9054bbb8760eb2496dc9f5a7d047acce8fe1f6.
**5,481 standalone /172 ladder overlays**; no live/canonical edits or short changes.

**BH02 BTC-dip price cap / expiry (September 14):**
[Findings](codex-astra-btc-dip-price-cap-findings-2026-09-14.md) /
[card](../research-inputs/btc-dip-price-cap-2026-09-14.json) /
[method](../docs/research/btc-dip-price-cap-bh02.md).
Four expiry definitions,5/15/30/60m from signal; cap frozen at completed
HYPE1m close. Parent BTC-0.5%/1h long/12h unchanged.40 cases:8 exact
BH01 controls plus32 variants across two periods,0/60s delays and
minute-open /5bps-through fill proxies. No wick fills or maker fee savings.
All fills charged cap, even below-cap prints.15m best recent expiry but
not a full qualifier:60s net$3,713 primary/$4,409 strict vs original$4,793;
DD8.10/7.83% vs8.52%. Strict15m older$17,035 vs$16,020, DD18.92vs21.40%.
Removed/replacement signals, missed winners, avoided losses, matched
entry-price/exit-timing deltas and all monthly comparisons saved.
Post-hoc print-price sensitivity strict15m recent$6,286 is not an
executable-fill claim; same timestamps, no independently qualified DD.
Zero-delay lenient caps exactly reproduce parent; equality is not a defect,
but positive-delta/monthly failures remain elsewhere.0/4 complete qualifiers.
26,676 fills/17,356,140 marks/15,315 intents plus99 fixture accounts verified.
No ladder or live changes. **5,481 standalone /166 ladder overlays**.

**BH01 BTC-HYPE thresholds (September 14):**
[Findings](codex-astra-btc-hype-threshold-findings-2026-09-14.md) /
[card](../research-inputs/btc-hype-threshold-2026-09-14.json) /
[method](../docs/research/btc-hype-threshold-bh01.md).
216 standalone definitions: gap +/-1/2/4pp or BTC +/-0.5/1/2%, lookback
1h/4h/24h, cross into threshold, HYPE long AND short, hold4h/12h/24h.
18 matched-availability clock controls; two nonoverlapping windows and0/60s
execution delays =936 cases. $10k notional/$32k equity/0.055% fees per side;
no TP/SL, BTC leg, funding or ladder overlay. 47/216 all-case positive net;
27/216 positive cost stress; 0 complete qualifiers. BTC dip0.5%/1h buy/12h
is a broader-period research lead ($20,417/$5,763 older/recent vs clock
$3,087/$5,071), not robust incremental proof: recent60s clock delta-$786.
Gap+2pp/1h buy/24h recent$6,369 vs$6,500 clock; older$4,252 vs$7,423 and
DD31.80% vs29.66%. Strong recent short leaders fail older absolute profit.
All216 rankings, all monthly comparisons, top-five monthly tables and
neighbours preserved; 500,124 fills/406,133,676 marks independently checked.
BTC April outage is excluded causally, not imputed. No live changes.
**5,477 standalone /166 ladder overlays**. HYPE-only matched triggers,
convergence entries and hedged spread legs remain untested in BH01.

**AG10-H1 fractional high windows (September 14):**
[Findings](codex-astra-aggressive10-high-window-findings-2026-09-14.md) /
[card](../research-inputs/aggressive10-high-window-2026-09-14.json) /
[method](../docs/research/aggressive10-fractional-high-window.md).
Exactly2 new definitions:36h or60h rolling-high reference on the current
aggressive10h parent (48h), unchanged1% proximity/age4h/full close/forced
cooldown/sizing/gates. No FR01 half overlay.16 runs:8 exact archived controls
then8 variants, older July2025-Aug19,2026 and recent May17-Sep14 15:27 UTC,
both resting-touch and confirmed TP. Touch net parent$38,080/$61,635
(recent/older),36h$37,646/$58,966,60h$32,830/$57,121.36h DD worsens all
four parent cases.60h recent touch loses$5,249 despite16 extra TPs; June4
matched parent+$222 becomes-$8,500 emergency.36h saves$2,659 on the Sep9
ladder but earlier monthly costs erase the touch advantage. Confirmed
net signs vary;0/2 full passes versus parent or B17. All month deltas,
W/L dollars, monthlyDD and occupancy attribution saved.85,042 fills,
6,159,504 marks,74,112 adds,2,481,279 targets,2,483,790 high checks pass.
No live changes. **5,261 standalone /166 ladder overlays**, L09 separate.
Earlier integer tests were mostly8h/standalone;1.5% proximity is not1.5d.

**FR01 cutoff extension (September 14, through 15:27 UTC):**
[Findings](codex-astra-flow-response-extension-findings-2026-09-14.md).
Same B17/Aggressive10/impact-half rules;14 runs including6 exact old-endpoint
checks,6 primary extensions and2 unchanged60s sensitivities.0 new definitions.
Added-period equity change-$2,703 for parent and half;0 new half interventions.
Full net parent$38,080/$44,219 vs half$41,042/$41,482 (touch/confirmed).
Both finish flat; B17 remains11 rungs/-$6,176 open. September DD included;
July sensitivity failure remains. Counts stay **5,261 /164**, no live changes.

**FR01 selling acceleration versus price impact (September 14):**
[Findings](codex-astra-flow-response-fr01-findings-2026-09-14.md) /
[card](../research-inputs/flow-response-fr01-2026-09-14.json) /
[method](../docs/research/flow-response-fr01.md).
Four new definitions: acceleration-only or acceleration+price-impact,
each half-sizing or temporarily vetoing otherwise-approved depths8-11.
Acceleration=recent15m sell share>=60% AND sell intensity>=1.5x preceding45m;
impact=same-window Bybit return<=-0.20%. Full60-minute unique eligible coverage;
unknown adds no new restraint. Both drop/timer routes, no deferred remainder.
32 runs:8 exact archived B17/Aggressive10 controls,16 primary cases,8 recent
extra60s feature-delay cases. Older July2025-Aug19,2026; recent May17-Sep10,2026.
Unchanged0.055% side fees, no funding/maker/liquidation claims.0/4 full passes.
Impact half recent net$43,745/$44,185 vs parent$40,783/$46,922, DD16.01/19.59%
vs20.39/25.68% (touch/confirmed). July confirmed delta-$5,998; full blocks
flip strongly with1-minute delay. First-event absorption only1-2 parent
ladders, not enough to dismiss that broader mechanism.145,812 fills,
10,491,556 minute marks,133,616 adds and40,946 raw feature checks verified.
All166,118 HL receipt times modeled; all new source windows are as-of bounded.
No live/source-engine changes. **5,261 standalone /164 ladder overlays**;
L09 component profiles separate. No Hawkes fit, decay trigger, whole-ladder
volatility sizing, or further threshold sweep tested here.

**Fable R1 early-history comparison (September 13):**
[Findings](codex-astra-aggressive10-early-window-r1-findings-2026-09-13.md) /
[card](../research-inputs/aggressive10-early-window-r1-2026-09-13.json).
January20-June30,2025, $32k flat start, unchanged B17/guarded10h/aggressive10,
touch and confirmed TP; six primary runs plus one exact archived B17 control.
Zero new definitions: this expands historical coverage, not the overlay count.
B17 net$61,657/$71,579 and DD35.24/30.77%; guarded$69,212/$74,105 and
DD30.26/30.15%; aggressive$78,786/$74,345 and DD29.91/31.41%.
Aggressive confirmed gains only$240 over guarded, while losing more dollars;
extra5bps fixed-path arithmetic reverses that small lead. Both candidates fail
the monthly screen;0/2 complete passes. Six saved ledgers independently
reaccounted:29,930 fills/1,399,680 marks. Early HL/Binance absent; Bybit funding
rates retained as gate inputs, cashflows excluded. No R2-R5 economic rules,
no maker overlay, no live changes. Definition counters remain unchanged.

**AG10-C1 high-exit-only cooldown (September 11):**
[Findings](codex-astra-aggressive10-cooldown-findings-2026-09-11.md) /
[card](../research-inputs/aggressive10-cooldown-2026-09-11.json) /
[method](../docs/research/aggressive10-high-cooldown-c1.md).
Two definitions: aggressive10h high-exit cooldown exactly1h or2h from FULL
two-day-high exit fill. Original4-8h control retained; all other cooldowns,
entries, gates, TP, partials and amounts unchanged. No E1 filters included.
26 runs:12 exact L15 controls,8 primary variants,6 recent source60 repeats.
Both lose aggressive-parent net all four cases.1h recent delta-$5,719/-$6,831;
2h-$7,235/-$8,971 (touch/confirmed). Older1h-$17,904/-$15,255;
2h-$16,737/-$18,370. DD improves only recent confirmed; older touch even
underperforms B17 net/DD.0/2 complete incremental/B17 passes.
38-50 actual earlier recent first-rung reopens per case; high win rates
do not offset larger losing dollars. All six source60 economics unchanged.
Independent124,040 fills/8,632,226 marks/108,130 attempts/12,516 cooldowns
verified. Study-local source derivatives exact; original engine/auditor
unchanged. W/L dollars, monthly comparisons, early cohorts and full-path
attribution saved. No live change. **5,261 standalone /160 ladder overlays**,
L09 component profiles separate. No zero/3h/adaptive cooldown tested.

**AG10-E1 selective deep timer guards (September 11):**
[Findings](codex-astra-aggressive10-selective-findings-2026-09-11.md) /
[frozen card](../research-inputs/aggressive10-selective-2026-09-11.json) /
[method](../docs/research/aggressive10-selective-e1.md).
Exactly two actual trading definitions on unchanged aggressive10h: restore
the original funding-only deep timer guard after the S/R exception when
closed-hour close<VWAP AND ROC<0, or lower hourly high AND close<previous low.
True drop adds, initial entries, qualified support reopens and all other
policy retained. 26 economic runs: 12 exact L15 controls, 8 primary variants,
6 recent source60 checks. B17, guarded10h and aggressive10h shown throughout.
Recent touch deltas versus aggressive +$674/+$720; confirmed -$1,341/-$873.
VWAP older touch +$3,476, confirmed -$2,313; structure older -$2,713/-$2,571.
0/2 complete B17 or incremental passes. Both preserve inherited aggregate
B17 net/DD improvement; neither is a consistent improvement on the parent.
Recent new blocked episodes 17/21 VWAP, 19/25 structure (touch/confirmed).
Full monthly, W/L dollars, occupancy attribution and source60 results saved;
119,204 fills /8,632,226 marks /117,265 add attempts independently checked.
Two pre-economic setup failures retained, no economic results from either.
No combined filter, new HL condition, high-exit cooldown test or live change.
**5,261 standalone /158 ladder overlays**, L09 component profiles separate.

**AG10-D1 selective-permission diagnostic (September 11):**
[Findings](codex-astra-aggressive10-discriminators-findings-2026-09-11.md) /
[lead candidate](AGGRESSIVE-10H-CANDIDATE.md) /
[frozen card](../research-inputs/aggressive10-discriminators-2026-09-11.json).
Eight descriptors applied separately to first hot-TP reopens and first extra
deep timer adds after the original support exception. Four archived aggressive
paths, 1,511 scope observations, 3,022 zero/+60s feature rows, 1,285 qualified
episode IDs; scopes/windows overlap. Twelve B17/guarded/aggressive paths exactly
reaccounted. Whole-ladder selected/complement/unknown W/L, winning/losing dollars,
monthly decision cohorts and concentration; NOT a counterfactual block replay.
VWAP/negative-hour momentum is the priority deep-timer restraint hypothesis;
lower structure catches a valuable June 22 recovery too. Broad HL-selling
vetoes mainly select profitable ladders. Neither permission covers major June
early pullback losses; combined recent loss-dollar coverage 31-48%.
No economic qualifier evaluated, no live change. Eight descriptive definitions,
**zero new trading definitions / zero economic replays**. Counts unchanged:
**5,261 standalone / 156 ladder overlays**, L09 components separate.

**L15 regime attribution, not a new experiment (September11):**
[Findings](codex-astra-age10-regime-attribution-findings-2026-09-11.md).
Six existing policies x two periods/two TP models;24 saved paths reaccounted,
0 new definitions,0 economic replays. Completed-calendar down/sideways and
causal UTC-day-start 28d/7d labels are kept separate; no labels enter trading.
Guarded10h improves combined down and sideways months in both models, but
all alternatives lag B17 in the uptrend-pullback bucket in all four cases.
Recent bucket n=9 days/3 stints; June6-12 dominates. No universal bearish
winner or live filter validated; no screen relaxation. Counters unchanged.

**L15 10h/gate factorial (September11):**
[Findings](codex-astra-age10-gate-factorial-findings-2026-09-11.md) /
[frozen method](../docs/research/age10-gate-factorial-l15.md).
Exactly3 new definitions:10h +2d/1% high exit with no RSI TP cooldown,
no deep funding timer-add guard, or neither guard. Six prior policies are
controls, not recounted; together eight factorial cells plus B17.46 fresh
replays:24 exact controls +12 variants +10 recent high-source60 repeats.
All3 improve aggregate B17 net/DD across both periods/models; **0/3 monthly
passes**. Aggressive10h recent$40,783/20.39% touch and$46,922/25.68% confirmed,
older$61,635/25.09% and$64,976/30.17%. Recent touch trails aggressive8h by
$1,351; older confirmed DD worsens0.48pp versus aggressive8h. Older touch
losing dollars remain$7,990 above B17; February monthly delta-$7,769.
48 entry-attribution comparisons separate matched/removed/replacement net
from same-path hypothetical guard flags; no causal PnL-per-rung claim.
All10 source60 unchanged. Independent208,935 fills/15,405,122 marks pass.
No engine/live changes. No selective relaxation or high-exit-only cooldown
variant run; those remain separate future experiments. **5,261 standalone /
156 ladder overlays**, L09 profiles separate. Same Sep10 05:08UTC cutoff.

**L14 age/high refinement (September11):**
[Findings](codex-astra-age-high-refinement-findings-2026-09-11.md) /
[frozen method](../docs/research/age-high-refinement-l14.md).
Exactly24 new definitions anchored on age8 +2d/1% high exit. TP caps6/10/12h;
high widths0.5/0.75/1.25/1.5/2%; high-exit minimum ages5/6/8h; high windows
1/3/5/6d; four separate companion additions (half11, no deep funding guard,
no S/R partials, no hot-RSI TP cooldown) and five explicitly frozen pairs of
those companions. No adaptive grid, new indicator, simultaneous MFI exit,
trend/latch/emergency/forced-cooldown removal, short overlay or live change.
170 fresh replays:20 exact controls +4 refreshed singles +96 primary variants
+50 source60. Same Sep10cutoff,32000capital and0.055% per-side fees. All24
improve recent marked net in both models;22 improve completed net. Only10h,
12h and3d refinements improve aggregate net/DD versus B17 all four cases;
**0/24 complete-screen passes**, no new variant dominates the parent all four.
Best recent double-removal net$42,134/$40,616, DD20.40%/25.84%; older touch
DD30.87% versus B17 28.17% and losing dollars increase.10h is the cleaner
cross-period continuation, not a monthly pass. Half11 can miss an original
TP by raising weighted-average entry, then suffer a later emergency loss;
the traced June4-6 case is independently verified.43/50 source60 outcomes
identical, remaining net changes -$56.32..+$14.08; all top-five unchanged.
Independent722,334 fills/54,118,840 marks/26,064,868 target checks/
26,003,071 high permissions/629,301 size checks. **5,261 standalone /153
ladder overlays**, L09 profiles separate. Full baseline/parent/single-peer
comparisons, W/L dollars, monthly deltas, costs and attribution preserved.

**L13 winning-mechanism pairs (September11):**
[Findings](codex-astra-winning-ladder-combinations-findings-2026-09-11.md) /
[frozen method](../docs/research/winning-ladder-combinations-l13.md).
Exactly8 new definitions: `{age8,minus_soft_stale}` crossed separately with
`{last11_50,minus_deep_stress,mfi_weekly_half,exit_2d_1pct}`. Seven singles
including B17; no conflicting TP-policy pair, triple, new threshold or live
change.86 runs:28 exact archived singles,14 refreshed recent singles,32 pairs,
12 recent source60 repeats. Older reproduced singles reused, not recounted.
Three pairs improve baseline aggregate net/DD all four cases (age8+high,
no-stale+half11,no-stale+no-guard); **0/8 full-screen passes** and no pair
improves both constituents' net/DD in all four. Age8+high is the strongest
loss-reduction lead: recent touch losing dollars$25,546 versus$33,009, net
$16,340 including$3,351 end/unfinished advantage, but monthly/TP-model costs.
Age8+no-guard beats its constituents recently but older touch DD worsens.
MFI cuts added to either TP leg reduce recent net versus that TP leg alone.
All delayed-source economics unchanged. Independent356,888 fills/27,200,074
minute marks. Audit-only phase/rearm refinements recorded separately, original
economic pins/results unchanged. **5,261 standalone /129 ladder overlays**;
L09 components separate. Cutoff Sep10 05:08 UTC. No claim to exhaust other
combinations; standalone indicators/shorts not pooled with ladder dollars.

**L12 intermediate highs / BTC leniency (September10):**
[Findings](codex-astra-near-high-btc-extension-findings-2026-09-10.md) /
[frozen method](../docs/research/near-high-btc-extension-l12.md).
Adds36 definitions:20 raw block/exit x2/3/4/5/6d x1%/2%;16 BTC-exception
add rules x1/2/3/4/5/6/7/30d x1%/2%. BTC strong = within1% of its own same-N-day
high AND nonnegative closed-close4h return. Only removes the new experiment's
deep>=8 veto; no outer-gate override or BTC exception to stale exits. Missing
BTC cannot authorize leniency. Same B17, fees, windows and exit cooldown.
222 fresh executions: six exact controls,144 primary,72 recent source60.
**0/36 complete-screen passes.** Raw L11 peers reused, not new executions.
Recent 2d/1% and5-7d/2% stale exits improve net/DD in both TP models, but fail
older/monthly tests. Touch gains are heavily final-inventory driven: completed
net delta +$200 for2d/1%, -$869 for5d/2%, -$250 for6d/2%. All five ranked recent
leaders unchanged under source60. BTC sometimes improves raw peers but does
not qualify against B17;30d never relaxes recent adds (only16.98% coverage,
zero observed strong minutes). Not a family-wide rejection or live change.
Independent 1,044,436 fills /68,790,968 marks /1,302,671 add permissions /
10,131,788 occupied exit checks, with independent gapped BTC/HYPE maxima.
**5,261 standalone /121 ladder overlays**, L09 components separate.
Other BTC definitions, BTC-conditioned exits, rollover/rejection confirmation,
initial/shallow blocks and other proximity/stale thresholds remain untested here.

**L11 near-high controls (September10):**
[Findings](codex-astra-near-high-ladder-findings-2026-09-10.md) /
[frozen method](../docs/research/near-high-ladder-l11.md).
Adds12 definitions: trailing24h/7d/30d high ×1%/2% proximity, independently
(a) veto otherwise-approved nextDepth>=8 adds, both timer/drop; or
(b) full exit at any depth, oldest surviving age>=4h, with standard4–8h cooldown.
No action combinations, loss-only selection, new indicator or HL filter.
78 cases: six exact accepted controls,48 primary,24 recent source60 repeats.
**0/12 complete-screen passes.** Weekly/monthly2% exits are retained recent
leads, not upgrades: recent touch baseline$20,887/DD24.69% becomes$23,054/$24,259
and19.58%; older/monthly failures persist. Monthly recent n20/19 is thin by
the fixed20-episode gate. Report separates completed PnL from the$1,925 touch
end-inventory/unfinished-partial advantage. Both chosen leads unchanged at60s.
All highs, every add/occupied exit decision and accounting independently
verified. No live changes. **5,261 standalone /85 ladder overlays**, L09
component profiles separate. LegacyAug20daily-high72 remains superseded, not
rerun/certified wholesale. Rejection confirmation, shallow/initial blocks,
other widths/ages, retained near-high warnings and TP headroom remain untested
by this pass. Latest economic cutoff05:08 UTC; later19:05 runtime excluded.

**RR03 / L10 (September10):**
[Trajectory findings](codex-astra-recovery-trajectory-findings-2026-09-10.md) /
[construction findings](codex-astra-ladder-construction-findings-2026-09-10.md).
RR03 reuses692 fixed4h clocks and55 original pressure observations,0/60s
availability, comparing raw/BTC/SOL four-hour path categories with a single
past-fitted beta per sequence. No new trading definitions; no consistent exit
discrimination and no BTC/SOL condition attached to the following replay.
L10 adds exactly six definitions: next-depth>=8 half/one hourlyATR spacing;
gross<=-1% fresh8/9-rung entry-cost ceilings; first-post-partial60m wait versus
0.3% pullback/4h expiry. Both add routes, existing gates/exits/TP/clock unchanged.
38 cases: six exact archived/refreshed B17 controls,24 primary variants across
published/recent windows and both TP paths, eight ATR source60 repetitions.
All recent net results trail B17; **0/6 full-screen qualifiers**. First complete
construction batch, not an exhaustive rejection of dynamic exposure control.
194,635 fills,14,072,032 minute marks,1,322,463 add decisions independently checked.
Register now **5,261 standalone /73 ladder overlays**; L09 components separate.
One job aborted before outcomes on post-cutoff file appends; exact prefix/row
checks plus six exact controls certified the retry, not another hypothesis.
No live config/source, canonical engine, commit/push/deployment change.

**RR02 SOL/BTC comparison (September10):**
[Findings](codex-astra-sol-btc-comparison-findings-2026-09-10.md).
One new reference asset, matched HYPE/BTC/SOL samples, unchanged RR01 features;
2,749 hourly and682 four-hour return observations. Fixed causal next-hour
models versus past-mean and HYPE-own-lag controls;0/60s availability, no lag grid
or multi-factor blend. SOL tracks better at4h but neither forecast wins and
pressure-point discrimination remains model-sensitive. Zero new trading
definitions; standalone/ladder counts unchanged. No net-PnL claim or live change.

**RR01 / frozen refresh (September10):**
[Findings](codex-astra-relative-reversion-findings-2026-09-10.md).
Two descriptive families (BTC-relative returns, past-fit residual persistence),
692 fixed4h clocks and55 existing primary pressure landmarks across two TP
paths, each under0/60s arrival assumptions. Zero new trading definitions;
no qualified exit signal. Local runner also reproduces six F06 recent controls
exactly and extends B17/age8/no-soft across both TP models toSeptember10 05:08
UTC. No additional completed episodes or qualification change. Counts remain
5,261 standalone /67 ladder overlays; L09 components separate. This is not a
reset of prior trials or a migration of every historical study into the runner.

Checked September 10, 2026; updated through F06 conditional soft-stale TP,
F05 recovery-event/action isolation,
F04 weekly-MFI exit replay, F03 context,
F02 MFI exit replay, P01 atlas and F01 diagnostics,
L09 component audit, L08 conditional-half11 and L07 single-indicator ladder
vetoes, I01–I11 individual studies, C01/C02 combinations, T01 calendar exclusions
and T02's bounded MFI calendar/hold follow-up plus selected R01 refinements.
H00 subsequently attaches descriptive HL/S/R evidence without adding strategies.
No live changes, commit or push. This is the control sheet for the recent ladder work,
plus pointers to relevant older studies. It is **not an exhaustive census of
every historical scratch experiment** in this repository.

**Accepted economic F06:** [conditional soft-stale TP](codex-astra-conditional-soft-stale-findings-2026-09-10.md).
Four new definitions: defer eligible 0.5% TP to normal 1.4%, bounded at oldest
remaining age 8h, under healthy 4h structure, hourly day-VWAP/ROC recovery, known
resistance room, or unconditional age-only control. One-way deferral permission;
ordinary post-release TP behavior, construction, S/R trims and forced exits intact.
**56 verified cases / eight exact B17 and no-soft-stale controls; 0/4 complete
passes.** Two original windows/models, source60 and release60 sensitivities.
Recent touch B17 / structure / VWAP / resistance / age8 net:
$20,914 / $29,478 / $20,083 / $19,294 / $29,759. Confirmed:
$15,839 / $21,450 / $19,578 / $16,229 / $24,407.
All three contexts trail age8 in both recent models. Age8 nevertheless worsens
older touch DD 28.17% -> 36.85%, March 2026 delta -$7,126 and recent July -$1,907;
structure older touch net -$9,700. Not uniformly reduced bleeding or deployment
qualification. Fixed 0.055%/side fees; no maker/funding certificate.
Independent 289,354 fills, 21,320,264 minute marks and complete minute-by-minute
target-policy reconstruction. Initial 20-case attempt invalidated due to a
proximity-buffer lookup mismatch; preserved, corrected to frozen intent and all
56 final cases rerun. Does not reject all conditional TP designs.
Adds four to 63 = **67 ladder overlays**; 5,261 standalone unchanged; L09's 33
other component profiles remain separate. Construction-control batch is next
and still unrun; no more F05 half-exit filters or live changes.
[Card](../research-inputs/conditional-soft-stale-2026-09-10.json) /
[method](../docs/research/conditional-soft-stale-f06.md).

**Accepted economic F05:** [recovery mechanisms and action isolation](codex-astra-recovery-mechanism-findings-2026-09-10.md).
Two exact-weekly controls (freeze-only, half with ordinary adds); support-break/
retest/failure, rebound-failure, ineffective-buying then price failure, and
selling+native-OI then price failure, each freeze-only or half-plus-freeze.
Broad rules: one depth>=6/gross<=-1.5% arm at a new closed5m observation,6h
expiry, causal frozen references and explicit invalidation; no MFI requirement.
**10 new definitions,124 cases,28 exact archived controls**; non-HL rules use
both original windows/models, HL only the genuinely available recent window;
source60/action60 separate. Weekly controls economically equal B17/old weekly
half respectively. Support-half gains published net/DD but recent touch loses
$641, confirmed gains$1,164, and monthly/source-delay failures persist. Rebound
and HL half rules substantially lose recovery dollars. **0/10 complete passes**,
not a blanket rejection of these families.631,826fills/42,007,540minute marks
independently checked. Default research engine unchanged; opt-in ordinary-add
flag and byte-exact pre-F05 reference documented. No live changes.
Adds10 to53 = **63 ladder overlays**;5,261 standalone unchanged; L09's33
non-current component profiles remain separate. No new soft-stale or sizing
variants in this batch. [Card](../research-inputs/recovery-mechanisms-2026-09-10.json) /
[method](../docs/research/recovery-mechanisms-f05.md).

**Accepted economic F04:** [MFI-half with weekly VWAP](codex-astra-mfi-weekly-exit-findings-2026-09-09.md).
One new definition: original MFI-half additionally requiring latest completed
1h close below actual UTC-week VWAP and five-hour ROC <= 0. No retries or second
PnL threshold; a veto leaves ordinary adds/exits unchanged. Actual cut remains
pro-rata 50% with no further episode adds. Three setups, two overlapping windows,
two TP models, source/fill delays: **28 runs, 16 exact archived controls**.
Published B17/original/weekly net: touch $46,832 / $44,570 / $48,825; confirmed
$19,490 / $23,832 / $26,590. Recent weekly equals original, $24,303 / $20,893,
versus B17 $20,914 / $15,839. Older weekly vetoes improve the original half rule,
but touch DD and older monthly losses still fail. **0/1 new variants qualifies**;
no live change. Adds one to prior 52 = **53 ladder overlays**, not 28 strategies.
L09 reconstruction/removal profiles remain separate. All gains are research
replays with unchanged fees, not certified live earnings.
[Card](../research-inputs/mfi-weekly-exit-2026-09-09.json) /
[method](../docs/research/mfi-weekly-exit.md).

**Accepted descriptive F03:** [half-exit recovery context](codex-astra-mfi-recovery-context-findings-2026-09-09.md).
Reuses and independently re-accounts F02 baseline/MFI-half (eight paths), not
another economic sweep.216 eligible checkpoints,50 overlapping selected cases
at32 distinct UTC times. Twelve frozen context contrasts plus four-offset
indicator/HL/SR trajectories; source60s missingness explicit. Weekly VWAP
separates four harmful older cuts/model without removing helpful cuts; recent
cases all below VWAP and remaining older months still costly. **No filtered
portfolio net/DD certified, no deployment qualification, zero added trading
definitions.** At F03 the ladder-overlay count stayed 52. The proposed exact
weekly-VWAP filter has now been tested separately in F04 above; F03 itself
remains a descriptive study, not another economic definition.
[Card](../research-inputs/mfi-recovery-context-2026-09-09.json) /
[method](../docs/research/mfi-recovery-context.md).

**Accepted economic F02:** [MFI distress exits](codex-astra-mfi-distress-exit-findings-2026-09-09.md).
Exactly four new exit-overlay definitions: unfiltered50/100% and completed30m
MFI14<=20-filtered50/100%. First depth>=9/gross-3%, evaluate same episode at+60m;
no second loss threshold. Half pro rata with no later episode adds; full uses
existing forced cooldown. Current B17 unchanged control.44runs including four
exact old controls; source60s and exit60s separate. Recent MFI half+$3,389/+$5,054
and lower DD, but published touch-$2,262/higher DD and older monthly costs.
**0/4 complete-screen passes.** Blind cuts rejected under these rules; retain
the selective mechanism as a research question, not an always-on upgrade.
No live changes. Adds4 to prior48 ladder overlays=52; L09's33 non-current
reconstruction/removal profiles remain a separate category. Not44 new strategies.
[Card](../research-inputs/mfi-distress-exit-2026-09-09.json) /
[method](../docs/research/mfi-distress-exit.md).

**Accepted descriptive P01:** [pressure-point atlas](codex-astra-pressure-point-atlas-findings-2026-09-09.md).
64 mechanical drops,22 current-B17 modeled forced exits,26 human-selected tops;
677 reference boundaries and112 overlapping deep-loss landmarks. All validated
indicator families at standard parameters on5m/15m/30m/1h/4h, full HL/SR context,
252 fields and109 fixed descriptive bins. Zero trading definitions or policy
replays; archived baseline totals unchanged. MFI30m<=20 at deep−3%/+60m has small,
early-only cross-model downside concentration, not a qualified live candidate.
Do not count109 bins as109 profitable/falsified strategies. [Method](../docs/research/pressure-point-atlas.md).

**Accepted descriptive F01:** [failed-recovery discrimination](codex-astra-failed-recovery-findings-2026-09-08.md).
Four current B17 archived paths reverified, not four new economic simulations.
695 non-independent landmarks: first depth>=9 at -3/-5%, then separately +60m
if the same episode remains deep. Ten predeclared price/VWAP, HL, native/marked
OI and frozen support-break/retest bins. Winners, earlier closes and censored
episodes retained explicitly. **0/10 primary diagnostic hypotheses retained;
zero new trading definitions.** Recent two-window selling selects 7W/1L touch
and 8W/0L confirmed; subsequent recovery exceeds remaining downside.
Do not call the diagnostic balances simulated exit profits or add these ten
bins to the economic strategy count. All monthly cohorts and timing sensitivity
are preserved. No live action. [Method](../docs/research/failed-recovery-discrimination.md)
and [frozen card](../research-inputs/failed-recovery-2026-09-08.json).

**Accepted L09:** [bare-to-current component audit](codex-astra-ladder-components-findings-2026-09-08.md).
17 existing components,18 cumulative policies and17 full-minus-one references;
full-minus-latch equals B16. **34 distinct configs /136 core cases plus2 extra
cutoff controls=138 executions; six current archive digests exact.** Bare baseline
retains800x1.35/max11/30-minute timer/1.4%TP; current B17 is separate. Same published
Jul2025-Aug19 and recent May17-Sep8 periods, both TP assumptions, flat32000.
No new thresholds, indicators, short trades, or exact-maker execution claims.
Bare long DD75-77%, longest cycle245days; one non-bare intermediate insolvent.
Soft-stale and deep-funding-guard removal improve aggregate net/DD in all4 cases,
but monthly failures prevent promotion. S/R removal is positive net yet recent
touch gain only150 and recent gross losses worse. **0/17 complete-screen removals.**
713,740 fills /52,094,382 raw-minute accounting marks /1,302 monthly rows verified.
Inventory accounting: prior48 ladder-overlay definitions remain; L09 adds33
non-current reconstruction/removal profiles plus the repeated current control.
Do not conflate those profiles, modeled cases, or historical scratch studies.
[Card](../research-inputs/ladder-components-2026-09-08.json) /
[method](../docs/research/ladder-component-audit.md) /
outputs `backtests/hype/hype-ladder-components-2026-09-08/`.

**Accepted L08:** [conditional half-size rung11](codex-astra-conditional-half11-findings-2026-09-08.md).
Exactly three new rules, separately: completed4h close<canonical EMA200 OR
ret12h<=-2%; closed-hour close<own-UTC-day VWAP AND ROC5<=0%; healthy
HL15<=0.85 AND HL1h<=0.90. Next depth exactly11 after full baseline
affordability; both timer and genuine drop adds. No veto or exit change.
Full baseline plus repeated unconditional last11_50, original two windows/two
TP models, then same recent paths carried through Sep8 17:47UTC. Additional
15/60s lag only for the HL overlay. **34 cases,8 archived controls exact;
6,144 raw deep-context checks and9,853,310 independent minute equity checks.
Zero profit/defensive qualifiers.** Recent resting gains reverse under
close-confirmed exits; unknown delayed HL data returns to baseline, not alpha.
**Cumulative5,261 standalone /48 ladder definitions**. No live changes.
[Frozen card](../research-inputs/sr-pulse-encounters/conditional-half11-2026-09-08.json),
local outputs `backtests/hype/hype-conditional-half11-2026-09-08/`.

**September8 regroup, descriptive only:** [live attribution and deep-loss recovery cohorts](codex-astra-live-ladder-regroup-findings-2026-09-08.md).
Live cutoff September8 17:48UTC; historical labels retain original price prefixes
and four corrected baseline paths. First depth≥9 /gross≤−3% or−5% per episode;
349 overlapping observations and2,411 closed baseline episodes independently
checked. **At that descriptive checkpoint:5,261 standalone /45 ladder unchanged.**
Its three proposed conditional half-rung11 rules were subsequently tested in
L08 above; none qualified or deployed.

**Accepted H01:** [four HL/S/R conditions plus four interaction controls](codex-astra-indicator-hl-sr-filters-h01-findings-2026-09-08.md).
On R01-08: taker15(T)<taker15(T−15m); book0.5 imbalance(T)<imbalance(T−15m);
native OI1h change≥0; or two closed5m prices below T−15m support by>0.1%.
Each separately, plus its original-Bollinger-without-CMF control. Fixed12h/$10k;
0/15/60s extra HL delivery and0/+1m actions. **8 new definitions, cumulative
5,261 standalone /45 ladder.** 114 logical cases independently verified;
all six baseline paths exact. Zero recent exploratory qualifiers; unavailable
full-history HL screen is not a pass. No predicate grid or live/ladder change.
[Frozen card](../research-inputs/indicators/context-filters-h01-2026-09-08.json),
[method](../docs/research/indicator-hl-sr-filters-h01.md),
[results/failures](../research-inputs/indicators/h01-retained-results-2026-09-08.json).

**Accepted descriptive H00:** [all-opportunity HL/S/R context](codex-astra-indicator-hl-sr-context-h00-findings-2026-09-07.md).
14 original signals, including rejected/occupied; 84 archived decisions and
72 overlapping trade rows, not 72 independent trades. All 14 have full source
coverage under the frozen arrival model; all six recent baseline cases exact.
Independent raw math/selection, 628 zone snapshots and flat exports verified.
**Zero new strategy definitions; 5,253 standalone /45 ladder unchanged.**
No context-filter ranking, readiness strategy or actual ladder variant tested.
[Frozen card](../research-inputs/indicators/context-h00-2026-09-07.json),
[method](../docs/research/indicator-hl-sr-context-h00.md),
[accepted v2 snapshot](../research-inputs/indicators/h00-context-summary-2026-09-07.json).
Receipt-time assumptions and sparse-sample/counterexample limits remain explicit.

**Accepted R01:** [nine selected mechanism refinements](codex-astra-indicator-refinement-r01-findings-2026-09-07.md).
MACD4h long + VWAP: hourly >−0.25%, >+0.25%, or30m >0%;
MACD4h short + preceding-ATR shock veto: hourly ≤0.75, ≤1.25, or30m ≤1;
Bollinger4h downside short + CMF20: hourly <+0.05, <−0.05, or30m <0.
No entry, exit, sizing or calendar changes. **9 new definitions; cumulative
5,253 standalone /45 ladder.** 68 primary plus48 readiness logical cases,
all116 independently verified,32 archived parent/pair/clock comparisons exact.
R01-08 passes profit only; zero defensive/strict qualifiers. Recent11 closes
and one additional removed loss supply all gain versus the old CMF0 pair.
All nine outcomes, including negative neighbors and the identical-path
R01-03/C01-20 comparison, are retained. No new HL/SR or ladder variant yet.
[Frozen card](../research-inputs/indicators/refinement-r01-2026-09-07.json),
[method](../docs/research/indicator-refinement-r01.md),
[snapshot](../research-inputs/indicators/r01-retained-candidates-2026-09-07.json),
[staged handoff](../docs/research/indicator-hl-sr-ladder-path-2026-09-07.md).

**Accepted T02:** [MFI replacement attribution and local timing checks](codex-astra-mfi-calendar-refinement-t02-findings-2026-09-07.md).
Exactly four new filters: 15–19/12h, 17–21/12h, 16–20/11h and 16–20/13h;
repeat original 16–20/12h. Two new own-hold MFI baselines and two mechanical
clock controls are counted explicitly: **8 new definitions, cumulative
5,244 standalone / 45 ladder**. 44 primary cases plus 20 reused readiness
logical cases; all 64 independently verified, 12 archived controls exact.
Zero complete qualifiers. Earlier clock and 13h hold help their own parents;
later clock loses recent increment, 11h loses all four increments. No crossed
clock×hold grid, new descriptor filters, HL/SR or ladder variants. Original
recent benefit is concentrated in a few replacement episodes.
[Frozen card](../research-inputs/indicators/time-gating-t02-2026-09-07.json),
[method](../docs/research/mfi-calendar-refinement-t02.md),
[retained outcomes](../research-inputs/indicators/t02-retained-candidates-2026-09-07.json).

**Accepted C02/T01:** [32 further pairs](codex-astra-indicator-combinations-c02-findings-2026-09-07.md)
then [12 independent calendar exclusions](codex-astra-indicator-time-gating-t01-findings-2026-09-07.md).
All 296/112 logical cases verified; 40/16 archived controls reproduced before
variants. Zero complete profit/defensive/strict qualifiers. T01-05 improves
MFI full/recent net and DD at both delays but breaches the monthly budget;
C02-27/32 have smaller cross-window gains below the recent-profit budget.
**44 new definitions; cumulative 5,236 standalone / 45 ladder.**
[Retained evidence](COMBINATION-CANDIDATES.md) includes exact failures.
[Roadmap](../docs/research/indicator-combinations-next-steps-2026-09-07.md):
S01 waiting confirmation, new HL/SR mixtures and ladder transfer remain
unrun; selected R01 refinement and T02's narrow follow-up above are complete.
No automatic expanded sweep or live change.

**Accepted C01:** [32-combination findings](codex-astra-indicator-combinations-c01-findings-2026-09-07.md).
Eight exact existing standalone entries, four one-at-a-time conditions each:
128 new window/delay cases, 64 repeated parent/component/clock cases and 128
logical readiness-only controls (all equal to parents and deduplicated).
All **320 logical cases independently verified**, with original baselines
reproduced before variants. Zero profit, defensive or inherited strict-screen
qualifiers. Added **32 new definitions: 5,192 standalone / 45 ladder** at C01.
C01-30 is sample-limited/below-budget; C01-20 has a small positive change but
fails dollar/monthly budgets. No automatic refinement or live promotion.
Pending field-guide families remain deferred, not rejected.
[Exact card](../research-inputs/indicators/combinations-c01-2026-09-07.json),
[method](../docs/research/indicator-combinations-c01-study.md),
[all 32 ranking/failure records](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/ranking.json).

**Separate descriptive sidequest, September 7:** [actual TP / HL event atlas](codex-astra-tp-hl-event-atlas-findings-2026-09-07.md).
327 classified long TPs, 28 S/R partials, 20 separate short closes, plus the
forced/unclassified long baseline. -15..0 minute profiles and ordinary-market
references are observations, not tested indicator combinations or ladder
variants. **Zero added definitions; the then-current 5,160 standalone / 45
ladder definitions were unchanged by the atlas.** Preserved for future decision-time studies, with timing
and cohort-selection limits. [Reproduction/schema](../docs/research/tp-hl-event-atlas.md).

**New, separate study I01:** [validated indicators / standalone trades](codex-astra-indicator-standalone-findings-2026-09-05.md).
Its 16 definitions are NOT added into the 45 ladder definitions counted below.
They are one-position fixed-notional long/short rules, not ladder add blockers.

**Subsequent I02:** [CRSI timeframe/extreme expansion](codex-astra-crsi-extremes-findings-2026-09-05.md).
36 rule slots, 34 new plus two repeated I01 rules: **50 distinct standalone
definitions across I01/I02**, separate from the 45 ladder definitions. These
are not 50 indicator families or 50 live configurations.

**Subsequent I03:** [CRSI risk/exit follow-up](codex-astra-crsi-risk-exit-findings-2026-09-06.md)
adds 12 new definitions and repeats two I02 baselines: **62 distinct standalone
definitions across I01/I02/I03**. The [indicator coverage register](INDICATOR-FINDINGS.md)
keeps best cases, caveats and remaining individual work visible before combinations.

**Subsequent I04:** [RSI14 standalone expansion](codex-astra-rsi-standalone-findings-2026-09-06.md)
tests 210 definitions,206 new plus4 repeated I01 controls: **268 distinct
standalone definitions through I04**, still separate from the45 ladder rules.
14 adequately sampled longs survive the net/cost/delay shortlist;0 strict
qualifiers. No other indicators, HL/SR combinations or live changes in I04.

**Subsequent I05:** [ROC standalone expansion](codex-astra-roc-standalone-findings-2026-09-06.md)
tests600 definitions,596 new plus4 repeated I01 controls: **864 distinct
standalone definitions through I05**, separate from45 ladder rules.32 longs
and1 short survive sample/net/delay/extra costs;0 complete strict qualifiers.
All2,408 cases verified. MACD was not part of I05; no indicator/HL/SR combinations.

**Subsequent I06:** [MACD standalone](codex-astra-macd-standalone-findings-2026-09-06.md)
adds300 definitions, no repeated MACD rules: **1,164 distinct standalone
definitions through I06**, separate from45 ladder rules. Ten longs and seven
shorts meet the descriptive sample/net/delay/extra-cost subset; zero complete
strict qualifiers. All1,208 cases independently verified; no live changes.

**Subsequent I07:** [Bollinger standalone](codex-astra-bollinger-standalone-findings-2026-09-06.md)
adds 240 new definitions, no repeats: **1,404 distinct standalone definitions
through I07**, separate from 45 ladder rules. 25 long/2 short descriptive
survivors; zero strict qualifiers. All 968 cases independently verified.
ADX/DMI was next; I08 below is now accepted. No ladder or combination change.

**Subsequent I08:** [ADX/DMI standalone](codex-astra-adx-dmi-standalone-findings-2026-09-06.md)
adds 540 new definitions, zero repeats: **1,944 distinct standalone definitions
through I08**, separate from45 ladder rules. 35 long/2 short descriptive
survivors, zero complete qualifiers;2,168 cases independently verified.
The leading ADX gate adds only $213 full /$47 recent versus its plain DI
control. Subsequent I09 ATR/efficiency is accepted below; no combinations.

**Subsequent I09:** [ATR movement / efficiency standalone](codex-astra-atr-efficiency-standalone-findings-2026-09-06.md)
adds720 new definitions, zero repeats: **2,664 distinct standalone definitions
through I09**, separate from45 ladder rules. 39 long descriptive survivors
(8 ATR/31 ER),zero strict; no short survivor.2,888 cases independently
verified. Leading dip entries retain October crash risk; hourly efficiency
continuation has lower DD but missed upside. I10 VWAP/RVOL is accepted below; no combinations.

**Subsequent I10:** [VWAP/RVOL standalone](codex-astra-vwap-volume-standalone-findings-2026-09-06.md)
has400 VWAP slots (four I01 repeats),240 RVOL strategies and60 new plain-price
controls:696 new, **3,360 distinct standalone definitions through I10**, still
separate from45 ladder definitions.43 descriptive survivors (41 long/2 short
exits),zero strict;2,808 cases independently verified. Positive entries retain
monthly/crash/selection risks. OBV/MFI/CMF are separately completed in I11; no combinations.

**Subsequent I11:** [OBV/MFI/CMF standalone](codex-astra-volume-flow-standalone-findings-2026-09-07.md)
adds1,800 new definitions,zero repeats: **5,160 distinct standalone
definitions through I11**,separate from45 ladder rules.114 long/4 short
descriptive survivors,zero strict;7,208 cases independently verified.
MFI and selected recovery/continuation paths differ from profit-leading
crash-exposed dips;neutral exits often cut rebound profit. No combinations.

## The short answer

- Recent full-ladder experiments contain **45 distinct intervention definitions**:
  17 exposure rules, 12 genuine-drop pulse rules, 6 persistent holds, and 6 new
  sizing rules, plus 4 individual indicator vetoes. The sizing study also repeats
  the existing cap10 control.
- That is **46 study-variant slots / 184 window-model cases**, not 184 different
  setups. Each variant runs in two overlapping windows under two TP models.
  Baseline checks, verification reruns and archived controls are additional
  computations, not additional hypotheses.
- **11 definitions have results with the latest transactional partial clock**:
  the 6 sizing rules, cap10, and 4 indicator vetoes. The other **34 definitions only have earlier
  clock results**. They were tested, but their latest-current-stack ranking is
  not established. This does not erase their historical results or justify an
  automatic rerun of the entire grid.
- **0 variants met every predeclared profit or defensive screen in their
  respective studies.** That is not the same as every variant losing money,
  every condition having enough observations, or every conceivable HL/SR rule
  being rejected. No strategy change from these studies was deployed.

## I01. Indicator stages 1-2 (separate from L01-L07)

| Scope | Frozen definition |
|---|---|
| Formula validation | RSI14, CRSI(3,2,prior100), ROC5, ATR14/ATR%, ADX/+DI/-DI, UTC daily actual-turnover VWAP, prior20 RVOL; seven families / ten fields |
| Directional entries | `rsi_recovery`: long recross30 / short recross70; `crsi_recovery`: recross20/80; `roc_cross`: zero crossover; `vwap_cross`: same-UTC-day price crossover |
| Exact strategy IDs | `{rsi_recovery,crsi_recovery,roc_cross,vwap_cross}_{long,short}_{fixed12h,indicator_or12h}` =16; all explicitly listed in the frozen card |
| Exits | 12h from fill, or indicator recovery/reversal exit plus same timeout; no TP/SL grid |
| Controls | `clock_long`, `clock_short`, same $10k fixed-notional rolling12h, $32k initial equity; cash/buy-hold contextual only |
| Windows | Full2025-07-01 00:00..2026-09-04 19:01 UTC; recent2026-05-17 20:43..same cutoff; overlapping, previously mined |
| Models/cases | 1h closed decisions; immediate next-open and +1m delay to every market action;16x2windowsx2delays=64strategy cases,8clock control cases |
| Costs/limits | 0.055% each side; +5bps/side fixed-path stress; no complete funding/actual arrival/liquidation/live execution certification |
| Outcome | 0/16 pass complete screen; all eight short definitions lose in both windows/delays; no standalone deployment candidate |
| Not tested | New ladder policies, indicator combinations, HL/S/R combinations, thresholds/timeframes/TP/SL optimization |

The individual indicator exits use RSI/CRSI50, ROC reversal, or price opposite
current daily VWAP. Exact thresholds, rearm, midnight, expiry, delay and seed
conventions: [frozen card](../research-inputs/indicators/standalone-2026-09-05.json).
Actual math differs explicitly from legacy rounded/current-inclusive CRSI and
volume-ratio definitions; live gates remain unchanged. ATR/ADX/RVOL bins are
descriptive outcome strata, not additional strategy definitions. Independent
verification repeats are not new hypotheses.

Evidence: `backtests/hype/hype-indicator-standalone-2026-09-05/`, including
`manifest.json`, `validation.json`, `verification.json`, all16 rankings and
all72 case summaries/monthly ledgers. [Engineering guide](../docs/research/indicator-standalone-study.md).

## I02. CRSI standalone extremes (return to stage 2)

| Scope | Frozen definition / evidence |
|---|---|
| Timeframes / extremes | 15m, 30m, 1h; upper80/90/95 and mirrored lower20/10/5 |
| Entry modes | Into extreme: long crosses down into <=L / short up into >=U; back-out: long recrosses >L / short recrosses <U |
| Exact IDs | `crsi_{15,30,60}m_{80,90,95}_{into,back_out}_{long,short}` =36 definitions; 34 new, two repeat I01's 1h80 back-out rules |
| Fixed execution | I01's $10k notional, $32k equity, 12h from actual fill, 0.055%/side fees, +5bps/side stress; no funding, TP/SL, averaging or new indicator exits |
| Windows | Same I01 full/recent periods and fixed June1,2025 seed; overlapping and previously mined |
| Cases | 144 strategy cases +8 side-clock controls =152; 16 old/new/saved overlap checks are validation, not extra hypotheses |
| Positive finding | 15m into<=5: +$11,044 full / +$6,603 recent; back>5: +$8,684 / +$6,272; n=142/33 each, positive delay/cost sensitivities |
| Risk distinction | Recovery entry lowers full DD15.46% to8.68%, giving up$2,360; immediate-entry October winning trade first floats -$4,187 on$10k notional |
| Qualification | 0/36 complete strict screen, due monthly opportunity-cost regressions for useful longs; all18 tested shorts negative both windows/delays. Not a blanket CRSI rejection |
| Verification | 10 new independent test groups; 152 cases, 32,068 trade rows, 1,520 monthly rows; independent CRSI/crossing completeness, fills/fees/equity audit |
| Not tested | Different CRSI formulas, 4h/daily bars, momentum entries, variable holds/TP/SL, new regimes, ladder policies or indicator/HL/S/R combinations |

[Frozen card](../research-inputs/indicators/crsi-extremes-2026-09-05.json),
[reproduction guide](../docs/research/crsi-extremes-study.md).
Evidence: `backtests/hype/hype-crsi-extremes-2026-09-05/`.
The lower-frequency <=5 long pair is exploratory positive evidence, not a live
upgrade. Do not repeat I01's narrow tests and label the whole family exhausted.

## I03. CRSI risk/exit follow-up (standalone, bounded)

| Scope | Frozen definition / evidence |
|---|---|
| Entries retained | 15m upper 95 mirrored lower 5, long into <=5 and recovery >5; no new thresholds/shorts |
| Exact IDs | `crsi_15m_95_{into,back_out}_long__{baseline12h,stop3,stop5,stop8,timeout6h,crsi50,crsi80}` |
| New definitions / cases | 12 new exits +2 repeated own baselines; 48 variant cases +8 baseline cases =56 |
| Dates / costs | Same I01/I02 full/recent windows, $10k fixed entry/$32k equity, 0.055% each side, 0/+1m action delay, +5bps/side extra stress, no funding |
| Exit timing | Held previous-minute low for observed stop, then actual subsequent open/delay; no invented threshold fill; timeout from fill; CRSI exit strictly after entry |
| Baseline | Same CRSI entry's unchanged 12h path, not the clock or ladder; 8 cases exactly reproduce old engine and saved I02 ledgers/months/stats |
| Result | All 48 variant cases have lower net; 0/12 profit and 0/12 defensive qualifiers |
| Least costly alternative | Recovery >5 plus 8% observed stop: full +$7,852 vs +$8,684 baseline, DD 9.64% vs 8.68%; recent +$6,071 vs +$6,272. Not a risk upgrade |
| Risk caveat | Into crash stops avoid deepest October low but lose $1,427 vs recovered baseline +$1,242; observed stop is not a hard 3/5/8% loss cap |
| Verification | 13 new test groups; 56 cases, 5,256 trade rows, 560 months independently audited; 3 feature/14 strategy prefixes; ranking screens independently reviewed |
| Not tested | Stop+indicator mixtures, native stop fills, trailing/partial/ATR exits, new entry levels, RSI expansion, HL/SR/indicator combinations, ladder/shared-account overlay |

[Frozen card](../research-inputs/indicators/crsi-risk-exit-2026-09-06.json),
[method](../docs/research/crsi-risk-exit-study.md), local artifacts
`backtests/hype/hype-crsi-risk-exit-2026-09-06/`.
The bounded CRSI pass stopped here; I04 below is the subsequent RSI study.
An unhelpful tested exit does not erase the positive I02 entry finding.

## I04. RSI14 standalone expansion (individual indicator only)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Wilder RSI14, same explicit I01 seed; closed5m/15m/30m/1h/4h |
| Levels / entries | Upper60/70/80/90/95, mirrored lower40/30/20/10/5; into extreme versus recovery out; both sides |
| Extreme IDs | `rsi_{5,15,30,60,240}m_{60,70,80,90,95}_{into,back_out}_{long,short}_{fixed12h,indicator_or12h}` =200 |
| Center IDs | `rsi_{5,15,30,60,240}m_center50_{long,short}_fixed12h` =10; trend crossing, not extreme fade |
| New definitions / cases | 210 definitions =206 new +4 repeated I01;840 strategy cases +8 clock controls =848 |
| Dates / costs | Same I01 full/recent periods, $10k/$32k,0.055%/side,+1m action-delay case,+5bps/side stress; no funding |
| Exits | 12h from fill, or first subsequent closed RSI50 normalization capped at12h; no stops/targets/trailing |
| Baselines | Same-side rolling12h clocks; each neutral exit also retains identical entry/fixed12h companion;24 exact old-engine/saved overlaps before outcomes |
| Full-net leaders | 15m into<=40/12h +$8,458 full /+$3,775 recent;5m into<=30/12h +$8,388 /+$5,067; clocks +$3,305 /+$5,038 |
| Qualifications | 14 sample/net/stress/solvency shortlist cases, all long;0/210 complete strict-screen qualifiers; monthly regressions retained |
| Shorts / scarce levels | All53 adequately sampled short definitions lose full immediate;51 lose allfour; no95/5 crossings,90/10 too sparse, not family rejection |
| Risk / interpretation | Top-five oversold longs hold through October crash with49–52% gross adverse price moves;4h RSI50 long lowerDD but concentrated winners; some RSI50 exits help, unlike a universal CRSI inference |
| Verification | 10 new groups;848 cases,104,143 trade records,8,480 months independently audited;15 feature/210 engine prefixes;read-only pinned path supplement |
| Not tested | Other RSI lengths, daily, persistence, divergence, TP/SL/new exits, ladder/shared account, indicator or HL/SR combinations |

[Frozen card](../research-inputs/indicators/rsi-standalone-2026-09-06.json),
[method](../docs/research/rsi-standalone-study.md), local accepted evidence:
`backtests/hype/hype-rsi-standalone-2026-09-06/`. All210 exact ranked definitions,
monthly top-five comparisons and baseline W/L dollars are in the linked findings.
Verification/path repeats are not new strategies. I05 below subsequently
completes the ROC pass; I06 separately tests MACD below.

## I05. ROC standalone expansion (individual indicator only)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Unrounded percentage return to1/5/12 closed bars ago; closed5m/15m/30m/1h/4h, N+1 contiguous closes |
| Momentum entries | Long crosses >+M, short <-M; M=0/1/2/4% |
| Fade / recovery entries | Into: long crosses <=-M, short >=+M; back-out: long recrosses >-M, short <+M; M=1/2/4% |
| Exact IDs | `roc_{5,15,30,60,240}m_n{1,5,12}_m{0,1,2,4}_{momentum,into,back_out}_{long,short}_{fixed12h,indicator_or12h}`; magnitude0 only momentum |
| New definitions / cases | 600 definitions =596 new +4 repeated I01;2,400 strategy cases +8 clock controls =2,408 |
| Dates / costs | Same I01 full/recent windows, $10k/$32k,0.055%/side,0/+1m action delay,+5bps/side stress; before funding |
| Exits | 12h from fill, or subsequent ROC zero: reversal for momentum, normalization for fades; no instant entry-bar exit, no TP/SL |
| Baselines | Same-side rolling12h and identical entry/fixed12h companions;24 exact old/new/saved ledger/stat/month/open overlaps before outcomes |
| Full-net leaders | Hourly ROC12 into-1%/12h +$12,223 full /+$7,122 recent;30m ROC1 into-1%/12h +$10,645 /+$7,920; clocks +$3,305 /+$5,038 |
| Qualifications | 32 long/1 short sample/net/delay/extra-cost survivors;0/600 complete strict qualifiers;72 insufficient-sample definitions inconclusive |
| Short / mechanism | 5m ROC12 into+4% short, normalization exit +$3,165 full /+$834 recent; +1m+$1,751/+$411; delayed/stressed recent only+$211,n20 |
| Risk | Top-five dip longs51–53% worst adverse October price; genuine losing months remain; short timing/winner concentration; ROC recovery can reflect denominator roll rather than price rebound |
| Verification | 11 new groups;45 feature/600 engine prefixes;2,408 cases,970,004 trade rows,24,080 months independently checked; read-only path scans |
| Not tested | Other lags/levels/daily, acceleration/persistence/divergence, normalization, new TP/SL/exits, MACD, new ladder/shared-account or indicator/HL/SR combinations |

[Card](../research-inputs/indicators/roc-standalone-2026-09-06.json),
[method](../docs/research/roc-standalone-study.md), accepted local folder
`backtests/hype/hype-roc-standalone-2026-09-06/`. All600 ranked definitions,
monthly top-five/raw-top-five comparisons, baseline W/L dollars, timing/cost
and path failures are in the linked findings. Records overlap, not970k unique
opportunities. Source/card/findings may be committed after review; bulk outputs
remain local. No live change/commit/push in I05. I06 is the later MACD pass.

## I06. MACD standalone (individual indicator only)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Independent SMA-seeded fast/slow EMA, signal EMA of valid MACD lines, histogram=line-signal; closed5m/15m/30m/1h/4h |
| Presets | 6/13/5,12/26/9,24/52/18; null warmup, truezero valid, raw price units |
| Entry meanings | Signal crossing; same crossing with trend-sign or counter-sign; zero-line crossing; three-closed-bar histogram slope turn |
| Exact IDs | `macd_{5,15,30,60,240}m_{6_13_5,12_26_9,24_52_18}_{signal_cross,signal_trend,signal_counter,zero_cross,hist_turn}_{long,short}_{fixed12h,indicator_or12h}` |
| New definitions / cases | 300 new, zero MACD repeats;1,200 strategy cases +8 repeated clock controls =1,208 |
| Dates / costs | Same I01 full2025-07-01..2026-09-04 19:01 UTC/recent2026-05-17 20:43..same cutoff; $10k/$32k,0.055% each side,0/+1m actions,+5bps/side stress,before funding |
| Exits | 12h from actual fill or subsequent mode-specific reversal/normalization capped at12h; no TP/SL, entry-time exit or future pivot |
| Baseline parity | Eight old/new/saved clock ledger/month/stat/open cases exact BEFORE new outcomes; each indicator exit also compares its own fixed12h entry baseline |
| Positive long distinction | 30m standard histogram-turn/12h +$11,094 full /+$4,311 recent, DD19.59% /10.55%;4h standard signal/reversal +$8,905 /+$2,623, DD6.93% /2.84%; long clocks +$3,305 /+$5,038 |
| Positive shorts | Seven descriptive survivors, all4h12/26/9; signal/reversal +$2,047 full /+$1,849 recent,n91/25; zero-line/reversal +$2,607 /+$285,n47/11; clocks -$22,283 /-$9,887 |
| Qualification | 10 long/7 short sample/net/delay/cost survivors;0/300 complete strict qualifiers;12 sparse definitions inconclusive,25 equity-exhausted definitions diagnostic only |
| Risks | Genuine losing months, substantial foregone long upside, concentrated short winners; histogram turn still51.51% gross October adverse move; no live leverage/margin certification |
| Verification | Eight new groups/300 boundaries;45 feature/300 strategy prefixes;1,208 cases,606,491 trade records,12,080 months independently checked; pinned read-only path checks |
| Not tested | Other presets/daily, magnitude/PPO/ATR normalization, divergence/persistence/multitimeframe, price stops/targets, ladder/shared account, indicator/HL/S/R combinations |

[Card](../research-inputs/indicators/macd-standalone-2026-09-06.json),
[method](../docs/research/macd-standalone-study.md), accepted local evidence:
`backtests/hype/hype-macd-standalone-2026-09-06/`. All300 ranked definitions,
top-five and raw-top-five monthly baselines, W/L dollars, cost/timing and path
failures are preserved in the findings. Counts overlap, not606k unique trades.
No new strategy was added by the read-only report/path breakdowns. No live
change/commit/push. Bollinger was next; subsequent I07 is recorded below, not a combination.

## I07. Bollinger standalone (individual indicator only)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Current-inclusive SMA, population SD denominator N; closed 5m/15m/30m/1h/4h; percentB fraction and bandwidth percent |
| Parameters | 20/50 closes ×2/3 SD; null warmup; zero SD blocks crossing; no rounding/reseed/gap bridge |
| Entries | Fresh outside-band breakout, fade into opposite band, reclaim back inside; both sides; moving bands can cause a reclaim without price rebound |
| Exact IDs | `bollinger_{5,15,30,60,240}m_n{20,50}_k{2,3}_{breakout,into,reclaim}_{long,short}_{fixed12h,indicator_or12h}` |
| New definitions / cases | 5×2×2×3×2×2 =240 new; zero Bollinger repeats; 960 strategy cases +8 repeated clock controls =968 |
| Dates / costs | Full2025-07-01 00:00..2026-09-04 19:01 UTC; recent2026-05-17 20:43..same end; $10k/$32k,0.055% each side,0/+1m actions,extra5bps/side,before funding |
| Exits | 12h from fill or subsequent mode-specific midpoint capped at12h; not a guaranteed TP, no entry-time exit; occupancy fully recomputed |
| Baseline parity | Eight old/new/saved clock ledger/month/stat/open cases exact before new outcomes; midpoint rules retain own fixed12h companions |
| Positive long contrast | 15m50/2 into lower/midpoint +$10,417 full /+$3,487 recent,DD16.42% /4.90%; 30m20/3 breakout/midpoint +$5,983 /+$2,062,DD7.17% /4.01%; long clock +$3,305 /+$5,038 |
| Positive short | 4h20/2 breakdown/fixed12h +$2,865 /+$907,n67/13; full+1m drops to+$746,n59,extra-cost+$157; short clock -$22,283 /-$9,887 |
| Qualification | 25 long/2 short descriptive survivors; 0/240 complete strict; 32 sparse definitions; two equity-exhausted definitions diagnostic only |
| Risks | All five leading dip/reclaim longs hold October collapse,49–53% gross adverse moves; breakout winners concentrated; short occupancy delay matters; all monthly failures retained |
| Verification | Eight new test groups/240 boundaries;60 feature/240 strategy prefixes;968 cases,174,379 trade records,9,680 months independently checked; readonly paths and all pins pass |
| Not tested | Squeezes/width expansion/persistence, other widths/periods, Donchian/Keltner, price TP/SL/trailing, ladder/shared account, indicator/HL/S/R combinations |

[Card](../research-inputs/indicators/bollinger-standalone-2026-09-06.json),
[method](../docs/research/bollinger-standalone-study.md), accepted local evidence:
`backtests/hype/hype-bollinger-standalone-2026-09-06/`. All240 ranked IDs,
top-five/raw-top-five monthly controls, W/L dollars and risks are in findings.
Records overlap; 174,379 is not a count of unique independent trades.
The incomplete `-aborted-checker-typecheck/` directory is excluded; fresh
accepted run followed a compile-only checker annotation fix, grid unchanged.
Reporting/path breakdowns add no definitions. No live/config change, commit
or push. Subsequent I08 ADX/DMI is below; no combinations.

## I08. ADX/DMI standalone (individual indicator only)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Explicit Wilder mean seed, TR from bar1, strict-winner DM/ties zero; 5m/15m/30m/1h/4h closed bars; null warmup, zero valid; no rounding/reseed/gap bridge |
| Parameters | Tied DI/ADX lengths7/14/28; period14 exact shared-array parity; no separate smoothing-length product |
| Entries | Plain fresh DI cross; same cross AND ADX>=20/25/40; ADX crossing above20/25/40 with aligned DI; known peak>=40/50 fading still-dominant DI |
| Exact IDs | `adx_{5,15,30,60,240}m_n{7,14,28}_{mode}_t{threshold}_{long,short}_{fixed12h,indicator_or12h}`; valid mode/level pairs in card, no Cartesian invalid levels |
| New definitions / cases | 5×3×9×2×2=540 new; zero standalone DMI repeats;2,160 strategy cases+8 repeated clocks=2,168 |
| Dates / costs | Full2025-07-01 00:00..2026-09-04 19:01 UTC; recent2026-05-17 20:43..same cutoff; $10k/$32k,0.055% each side,0/+1m both actions,extra5bps/side,before funding |
| Exits / occupancy | Fixed12h or subsequent DI reversal/normalization capped12h; no entry-observation exit; pending immutable, occupied crossings skipped, no strength-rejected catch-up |
| Own controls | Eight prior/new/saved clock ledger/month/stat/cutoff cases exact; all strength gates retain same-period/side/exit unfiltered DI; optional exits retain own fixed12h |
| Long attribution | 4h N7 DI+ADX>=20/12h +$6,852 full /+$3,174 recent, versus plain DI +$6,639 /+$3,127: only+$213 /+$47; DD13.43%→10.08% full; long clock +$3,305 /+$5,038 |
| Other long | 15m N28 ADX>25 bullish/12h +$6,687 /+$2,891,DD6.21% /4.08%; not an incremental ladder result |
| Short contrast | 30m N14 ADX>40 bearish/12h +$1,860 /+$1,863,n62/15; delayed+extra-cost +$1,008 /+$1,542; other4h N28 DI short only+$14 full delayed/stressed; short clock -$22,283 /-$9,887 |
| Qualification | 35 long/2 short descriptive;0/540 complete strict;359 adequately sampled,181 sparse;15 equity-exhausted definitions diagnostic only |
| Risks | Prior-trend memory in high ADX; best peak-fade long holds51.54% October adverse move; topfive continuation longs still7.63–9.59% adverse; short winners concentrated; all monthly opportunity costs retained |
| Verification | Eight new groups/540 rule boundaries;45 feature/540 strategy prefixes;2,168 cases,466,909 trade rows,21,680 monthly rows independently checked; read-only paths and all pins pass |
| Not tested | Independent smoothing, other clocks/periods, persistent DI/rising-only ADX/slope rules, low-strength fades, price TP/SL/trailing, ladder/shared account, indicator/HL/S/R combinations |

[Card](../research-inputs/indicators/adx-dmi-standalone-2026-09-06.json),
[method](../docs/research/adx-dmi-standalone-study.md),
[all540 ranked definitions, W/L and topfive/rawtopfive monthly controls](codex-astra-adx-dmi-standalone-findings-2026-09-06.md).
Accepted local directory: `backtests/hype/hype-adx-dmi-standalone-2026-09-06/`.
Trade-row count includes overlapping cases, not independent market trades.
Eight old clocks remain exact; same-account ladder baseline was not substituted
for this deliberately different standalone model. No live/config/short change,
commit or push. I09 ATR/efficiency is accepted below; no combinations.

## I09. ATR movement / efficiency (separate individual branches)

| Scope | Frozen definition / evidence |
|---|---|
| Formula / clocks | Five closed clocks5m/15m/30m/1h/4h; ATR14 signed one-bar close change divided by PRECEDING ATR; ER signed N-bar displacement / absolute N-change travel |
| Math boundary | Exact shared ATR14 parity; prior scale excludes current shock; zero scale null; ER N10/20/40, flat travel gives valid0; ordinary ER unsigned, no KAMA certification |
| Parameters / entries | ATR0.5/1/2; ER0.25/0.50/0.75; fresh trend/into/recovery crossings both sides; direction explicit, not inferred from unsigned volatility |
| Exact IDs | `{atr_move,efficiency}_{5,15,30,60,240}m_n{period}_{trend,into,recovery}_t{threshold}_{long,short}_{fixed12h,indicator_or12h}`; only four valid family/period sets and branch-specific thresholds |
| New definitions / cases | 180 ATR +540 ER=720 new, zero repeats;2,880 strategy cases+8 repeated clocks=2,888 |
| Dates / costs | Full2025-07-01 00:00..2026-09-04 19:01 UTC; recent2026-05-17 20:43..same cutoff; $10k/$32k,0.055% each side,before funding;0/+1m both actions,extra5bps/side |
| Exits / occupancy | Fixed12h or first subsequent signed-zero condition capped12h; pending immutable, occupied crossings skipped, no entry-bar exit or queued re-entry |
| Own controls | Eight saved/new clock ledgers/monthlies/stats/cutoff cases exact before outcomes; optional exits retain own fixed12h; not canonical ladder totals |
| Long clock | +$3,305 full /+$5,038 recent,n861/219,DD33.09% /12.94% |
| ATR leads | A1 30m below-0.5 long/12h +$11,876 /+$7,439,n736/185; delayed recent edge shrinks to$179 over clock. A2 5m below-2 +$11,127 /+$5,796,n386/101 |
| Efficiency leads | E1 30m ER10 below-0.25 long/12h +$12,441 /+$4,694,n555/140. E5 1h ER20 above+0.25 long/zero-or12h +$7,341 /+$3,781,n235/62,DD12.39% /4.42% |
| Exit contrast | E5 zero exit adds$2,651 /$300 over own12h and cuts DD; A1 zero exit turns+$11,876 into-$14,736 full immediate |
| Short contrast | R1 30m ER20 above+0.5 short/12h +$2,265 /-$1,027,n119/32; short clock-$22,283 /-$9,887. No descriptive short survivor;252 adequate/108 sparse |
| Qualification | 39 long descriptive (8 ATR,31 ER);0/720 strict;504 adequate,216 sparse;31 equity-exhausted diagnostics |
| Risks | All overall topfive buy weakness and hold October49–51% adverse moves; metric recovery need not mean price bounce; E5 has missed-upside and concentration costs |
| Verification | Eight new groups,720 boundaries;60 feature/720 engine prefixes;2,888 cases,1,128,453 trade records,28,880 monthly records independently verified;34 read-only path cases; all pins match |
| Not tested | Other periods/levels, ATR stops/targets/sizing/volatility filters, KAMA, persistent/unsigned ER conditioning, funding/liquidation/shared collateral, ladder/indicator/HL/S/R combinations |

[Card](../research-inputs/indicators/atr-efficiency-standalone-2026-09-06.json),
[method](../docs/research/atr-efficiency-standalone-study.md),
[all720 ranked definitions, W/L and topfive/per-branch/raw monthly controls](codex-astra-atr-efficiency-standalone-findings-2026-09-06.md).
Accepted local directory: `backtests/hype/hype-atr-efficiency-standalone-2026-09-06/`.
Overlapping trade records are not independent market trades. No live/config,
ladder, short unpause, commit or push. I10 follows below; no combinations.

## I10. VWAP/RVOL standalone (separate individual branches)

| Scope | Frozen definition / evidence |
|---|---|
| Clocks / sides | Completed5m/15m/30m/1h/4h, both sides |
| VWAP | Actual quote turnover/base volume; UTC-day or Monday-week complete prefix; entry crossings must share anchor; exits use current anchor |
| VWAP levels | Trend0/0.5/1/2%; into/recovery0.5/1/2%; 400 slots, including4 hourly daily trend0% I01 repeats |
| RVOL | Current volume / PRIOR20 bars or exact same-UTC-slot PRIOR20 calendar days; fresh1.5x/2x/3x crossing; follow/fade close-minus-prior-close direction |
| RVOL / plain controls | 240 strategies;60 plain direction controls (20 fixed12h,40 reference-specific normalization exits), no volume entry condition |
| Exits | 12h or first subsequent VWAP-zero/RVOL<=1,capped12h; actual fill starts timeout; no entry-observation exit or deferred occupied signal |
| Exact IDs | `{vwap,rvol,bar_direction}_{5,15,30,60,240}m_{day,week,rolling20,time20}_{trend,into,recovery,follow,fade}_t{threshold}_{long,short}_{fixed12h,indicator_or12h}`; only family-specific combinations in card, not full product |
| Counts | 640 strategy slots+60 price controls=700;696 new/4 repeats;2,560 strategy cases+240 price-control cases+8 clocks=2,808 |
| Dates / costs | Full2025-07-01 00:00..2026-09-04 19:01 UTC; recent2026-05-17 20:43..same; $10k/$32k,0.055% each side,before funding;0/+1m both actions,extra5bps/side |
| Baseline parity | 24 saved I01 cases exact:4 repeated VWAP+2 clocks×four cases. Long clock+$3,305 full /+$5,038 recent,n861/219,DD33.09% /12.94%; not ladder baseline |
| VWAP lead | V1 5m daily distance crosses below−2%,long12h:+$13,302 full /+$3,098 recent,n302/64,DD15.76% /8.27%; delayed+$11,799 /+$3,030 |
| RVOL lead | R1 5m same-time20 RVOL>3 on down close-change,long12h:+$10,568 /+$5,537,n531/135; own no-volume control+$1,999 /+$4,592; own-control edge survives delay |
| Short evidence | 4h prior20 RVOL>2/down-change short:fixed12h +$1,770 /+$1,056,normalization-or12h +$2,064 /+$718;n68/13 immediate. Two exits of one entry,not independent signals |
| Qualification | 43 descriptive:18 VWAP long,23 RVOL long,2 RVOL short.0 strict.620 strategy slots sampled,20 sparse;18 equity-exhausted diagnostics. Plain controls:30/60 exhausted |
| Risks | All V1–V5/R1–R5 hold>50% October adverse move; missed May/August upside; RVOL improvement not universal; short concentration and November losses |
| Verification | Eight new groups;24 exact old/saved cases;15 feature/700 engine prefixes;2,808 cases,2,171,455 trade records,28,080 monthly rows independently verified;48 pinned read-only path cases+4 short inspections;all pins match |
| Pending at I10 | OBV/MFI/CMF subsequently completed separately in I11;event anchors,other RVOL versions,indicator/HL/S/R combinations,ladder/shared-account,funding/receipt/liquidation/queue remain untested |

[Card](../research-inputs/indicators/vwap-volume-standalone-2026-09-06.json),
[method](../docs/research/vwap-volume-standalone-study.md),
[all700 ranked slots / W/L / paired monthly results](codex-astra-vwap-volume-standalone-findings-2026-09-06.md).
Accepted local directory:`backtests/hype/hype-vwap-volume-standalone-2026-09-06/`.
Overlapping trade records are not unique market trades. No live/config/short
change,commit,push or subsequent combination study.

## I11. OBV/MFI/CMF standalone (three separate families)

| Scope | Frozen definition / evidence |
|---|---|
| Clocks / sides | Completed5m/15m/30m/1h/4h,both sides,strict fresh crossings |
| OBV | Raw zero seed; entry value=N-bar signed-volume change divided by ALL N volume;periods10/20/40;trend0/.25/.5/.75,into/recovery.25/.5/.75 |
| MFI | Typical-price directional flow;periods7/14/28;trend centered0/.2/.6/.8,into/recovery.6/.8/.9 =long raw20/10/5,short80/90/95;ties ignored,no directional flow=null |
| CMF | Volume-weighted within-bar close location;periods10/20/40;trend0/.05/.2/.5,into/recovery.05/.2/.5;flat-range numerator0,volume retained |
| Exits |12h or first subsequent mode-specific centered zero (MFI raw50),capped12h;timeout from fill,no entry-observation exit |
| Exact IDs | `{obv,mfi,cmf}_{5,15,30,60,240}m_n{period}_{trend,into,recovery}_t{threshold}_{long,short}_{fixed12h,indicator_or12h}`;only exact family-specific grids in card |
| Counts |600 per family=1,800 new definitions,zero repeats;7,200 strategy+8 clock cases=7,208;5,160 distinct standalone definitions throughI11,45 ladder unchanged |
| Dates / costs |Full2025-07-01 00:00..2026-09-04 19:01 UTC;recent2026-05-17 20:43..same;$10k/$32k,0.055% each side,before funding;0/+1m BOTH actions,extra5bps/side |
| Baseline |All8 saved I01 clock cases exact. Clock long+$3,305 full/+$5,038 recent,n861/219,DD33.09%/12.94%;clock short−$22,283/−$9,887;not the ladder |
| OBV lead |G1 5mOBV10 below−.75,long12h:+$14,477/+$6,787,n480/121,DD18.37%/6.24%;delayed+$14,426/+$6,996;holds49.05% October adverse move |
| MFI lead |M1 15mMFI7 belowraw10,long12h:+$13,112/+$3,957,n441/106,DD10.19%/7.18%;delayed+$10,761/+$3,311;flat atOctober low both delays,worst fulladverse12.43%/12.46% |
| CMF lead |G4 5mCMF20 below−.2,long12h:+$13,441/+$7,243,n629/159,DD23.03%/9.05%;holds53.23% October adverse move |
| Distinct path / missed upside |O4 OBV recovery reduces fullDD but worsens recentDD versus own into control;C5 30mCMF10 above0 avoidsOctober low,but delayedfullDD15.66→23.33%;MFI/OBV miss substantialMay clock profit |
| Own exit controls |G1 fullnet+$14,477→−$8,828 at neutral;M1+$13,112→+$4,502;G4+$13,441→+$907;earlier exits alter occupancy and subsequent entries |
| Short evidence |4 descriptive definitions,only3 entries:4hOBV40>.25 fade(two identical exit ledgers),4hMFI28<50 trend,4hCMF10 backbelow+.2;small profit and concentrated winners |
| Qualification |118 descriptive=114 long/4 short;0 strict.1,222 sampled,578 sparse;72 exhausted diagnostics nonexecutable.900shorts,618 sampled,642 losing allfour |
| Verification |10 new groups;8 exact saved clocks;135 feature/1,800 engine prefixes;7,208 cases,2,102,236 overlapping trade rows,72,080 months independently verified;62 pinned paths+16 read-only delayed-path inspections;all pins match |
| Untested |Volume-removal controls,OBV MA/channel/divergence,MFI divergence,CMF21,other clocks/periods/levels/persistence/price gates,stops/TP/partials,funding/receipt/liquidation,ladder/shared-account,indicator/HL/S/R combinations |

[Card](../research-inputs/indicators/volume-flow-standalone-2026-09-07.json),
[method](../docs/research/volume-flow-standalone-study.md),
[all1,800 ranked definitions / W/L / paired monthly and path comparisons](codex-astra-volume-flow-standalone-findings-2026-09-07.md).
Accepted local directory:`backtests/hype/hype-volume-flow-standalone-2026-09-07/`.
These candle proxies do not establish actual aggressor flow or independent
volume value over price alone. No live/config/state changes,short unpause,
new ladder policy,combination run,commit or push.

## C01. First bounded indicator combinations

| Scope | Frozen definition / accepted evidence |
|---|---|
| Entries | A1/A2: 15m CRSI into <=5 / recovery >5; A3: 15m MFI7 into <10; A4: 30m CMF10 above0; A5/A6: 4h MACD12/26/9 bullish/bearish histogram crossing; A7: 30m ADX14 >40 with bearish DI; A8: short fade of 4h normalized OBV40 >0.25 |
| Conditions | Each entry separately AND 4h DMI14 agreement, 1h signed ER20 veto, 1h prior20 RVOL >=1.5, or 1h close on trade-side of its own UTC-day VWAP |
| Exact IDs | C01-01..32; four consecutive condition IDs per entry, immutable card |
| Timing | Fresh closed-bar crossing; latest expected completed B bar available at A; missing fails closed; false/occupied crossings discarded; no later catch-up |
| Inventory / exits | One independent $10k position, fixed 12h from actual fill, 0/+1m BOTH entry and exit; no sizing/TP/SL/ladder changes |
| Windows / costs | Full 2025-07-01 00:00..2026-09-04 19:01 UTC; recent 2026-05-17 20:43..same; $32k equity; 0.055% each side; before funding; extra 5bps/side stress |
| Counts | 32 new definitions / 128 strategy cases; 64 repeated controls; 128 logical readiness cases deduplicated to identical parents; 320 independently verified cases; cumulative 5,192 standalone / 45 ladder |
| Baseline | Each exact A-only parent, plus A with B-readiness-only; all 64 archived controls and 56 all-true engine cases exact; clocks/component controls are context, not substitutes |
| Outcome | Zero profit/defensive/old-strict qualifiers; 3 full immediate positive deltas, 26 negative, 3 unchanged; only C01-30/20 positive deltas in all four cases |
| Main boundaries | C01-30 small sample / insufficient recent increment; C01-20 small gain / monthly failure; C01-14 recent-only gain worsens full risk; C01-07 defense loses too much profit; C01-11 materially harmful |
| Verification | 14 focused fixture groups; 32 feature/opportunity/condition prefixes and 32 path prefixes; independent formulas/opportunities/minute accounting/screens; 37,253 trade rows, 75,062 crossing rows, 3,200 month rows |
| Untested | Other thresholds/anchors, waits, triples, alternative exits, HL/S/R, ladder/shared account, funding/live publication/liquidation; no automatic refinement |

[Card](../research-inputs/indicators/combinations-c01-2026-09-07.json),
[method](../docs/research/indicator-combinations-c01-study.md),
[baseline-first W/L, all 32 rankings and top-five monthlies](codex-astra-indicator-combinations-c01-findings-2026-09-07.md).
Accepted local directory: `backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/`.
Original unversioned attempt is incomplete, not accepted. No source/data
rebaseline, live change, short unpause, commit or push.

## C02. Second bounded entry/context batch

| Scope | Frozen definition / accepted evidence |
|---|---|
| Parents | CRSI15m recovery, RSI14 5m dip, ROC12 1h dip, MFI7 15m dip, MACD4h long/short, ATR14 30m dip, Bollinger20/2 4h short; exact archived IDs in card |
| Conditions | Each separately AND1h improving side-signed MACD histogram, fixed-role ADX25, absolute close change / preceding ATR14 <=1, or side-signed CMF20 >0 |
| IDs | C02-01..32; P1..8 x Q1..4; no triples/new exits/HL/SR/calendar |
| Controls / cases | 40 saved controls,32 all-true engine cases exact;128 pair cases +40 repeated +128 logical readiness =296 verified cases |
| Timing / costs | Same C01 closed-bar contract, windows, $10k/$32k,12h actual-fill hold,0/+1m both actions,0.055% each side; before funding |
| Outcome | Zero complete profit/defensive/strict qualifiers; C02-27/32 positive incremental net all four cases but recent gain below budget |
| Failure controls | RSI+shock and MACD-long+improvement raise full net but lower recent net; all32 attempts retained |
| Verification | 49,427 trades,148,572 crossings,2,960 month rows independently checked;20 feature/32 path prefixes |
| Count | 32 new definitions;5,224 standalone /45 ladder at completion |

[Card](../research-inputs/indicators/combinations-c02-2026-09-07.json),
[findings](codex-astra-indicator-combinations-c02-findings-2026-09-07.md),
[method](../docs/research/indicator-entry-context-studies.md).
Accepted: `backtests/hype/hype-indicator-combinations-c02-2026-09-07/`.

## T01. Calendar attribution and single-block entry exclusions

| Scope | Frozen definition / accepted evidence |
|---|---|
| Parents | Unfiltered MFI7 15m dip below10 long; CMF10 30m cross above0 long; chosen before calendar audit |
| Exclusions | One fixed UTC4h interval at a time:00-04/04-08/08-12/12-16/16-20/20-24; original signal time, no queued entries; exits unrestricted |
| IDs | T01-01..06 MFI, T01-07..12 CMF; no multiple exclusions or weekday filter |
| Descriptive first | All opportunities, occupied signals, slots, exposure, signal-origin W/L and separate exit-clock PnL; weekday/weekend descriptive only; saved before replays |
| Controls / cases | 16 archived controls and8 all-true engine cases exact;48 pair +16 repeated +48 logical readiness =112 verified cases |
| Dates / costs | Same C01/C02 contract; $10k standalone, not ladder incremental PnL; before funding |
| Best evidence | T01-05 MFI excluding16-20: full immediate $13,112 -> $16,153;recent $3,957 -> $4,968;lower DD, same direction +1m |
| Qualification | Zero complete passes; T01-05 profit fails only monthly budget (worst-$525.07), defense also immediate full-DD reduction below20%; no CMF exclusion improves all four cases |
| Mechanism caveat | Excluded MFI baseline clock cohort was profitable; later newly enabled entries drive improvement. Same block harms CMF |
| Verification | 36,793 trades,79,066 crossings,1,120 month rows and696 calendar rows independently checked;10 feature/12 path prefixes |
| Count | 12 new definitions; **5,236 standalone /45 ladder** cumulative |

[Card](../research-inputs/indicators/time-gating-t01-2026-09-07.json),
[findings](codex-astra-indicator-time-gating-t01-findings-2026-09-07.md),
[method](../docs/research/indicator-entry-context-studies.md).
Accepted: `backtests/hype/hype-indicator-time-gating-t01-2026-09-07/`.
At the T01 checkpoint S01/R01/HL/SR/ladder transfer were unrun. Subsequent
bounded T02 and R01 results are recorded above; new HL/SR and ladder transfer
remain unrun. No live/config changes.

## 1. What baseline means for the ladder studies

The recent studies are **long ladder only**, not a joint long/short portfolio
optimization. The unchanged baseline retains the configured policies:

| Surface | Baseline |
|---|---|
| Sizing | $800 base, 1.35 scale, maximum 11 positions |
| Add eligibility | 30-minute timer OR 0.3% drop from the last add, subject to existing gates |
| TP / stale TP | 1.4%; reduced to 0.5% after 4 hours |
| Forced exits | Existing hostile 12h/-2% hard flatten, -14% emergency exit and funding guard |
| Existing gates | Trend, BTC risk-off, regime breaker, damaged-regime latch, overextension, throttle and deep stress policy |
| Existing S/R actions | Resistance partial exits and narrow support-reopen exception remain enabled |
| S/R geometry | 30m zones, 4-left/4-right confirmed pivots, 0.45% clustering, 2 touches, 14-day memory |
| Research account | Starts flat with $32,000 modeled equity; not the config file's initialCapital field |
| Research costs | 0.055% each side; final open inventory marked and included |

Sources: [long config](../bot-config.json), [sizing definition](../research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json),
[engine wrapper](../scripts/hype-ladder-sizing-study.ts).

Current config has maker TP enabled, but these research executions do **not**
certify its actual queue fills, fees or native handoff. Nor do they certify actual
funding, lot fragmentation, ten-second live timing, outages, liquidation or
shared-account behavior. The dedicated short config has entryEnabled=false;
that config observation is not an authenticated exchange-state check.

### The four comparison cases and the two baseline versions

Recent window: **2026-05-17 20:43 to 2026-09-04 19:01 UTC**.
Longer window: **2025-07-01 00:00 to 2026-08-19 21:32 UTC**.

Resting-touch fills a previously armed TP on a later bar's touch. Close-confirmed
waits for a completed close confirmation and fills at the next open. Market
actions otherwise use causal next-open execution. Neither is exact live fills.

| Case | Earlier-clock baseline net / DD | Corrected-clock baseline net / DD |
|---|---:|---:|
| Recent / resting-touch | $21,983.77 / 23.36% | $22,759.92 / 24.69% |
| Recent / close-confirmed | $17,413.84 / 31.10% | $17,468.13 / 31.11% |
| Longer / resting-touch | $43,005.85 / 33.00% | $46,832.49 / 28.17% |
| Longer / close-confirmed | $17,071.51 / 47.74% | $19,489.63 / 45.65% |

The correction preserves the last actual add time after partial exits, matching
the active transactional live path. Earlier studies reset it to the latest
surviving rung's entry time. **Do not subtract an old variant total from a new
baseline**, or describe old no-qualifier results as a completed new-clock search.
The sizing study reproduces the old baselines explicitly before the correction.

All windows have been examined before; none is a new untouched holdout. Pulse
rules cannot be validated before the HL data exists. Unknown historical pulse
leaves the stateless experimental overlay inactive, not retrospectively filled.

## 2. Study map: what actually ran

| ID | Question | Actual scope | Result and present evidence status |
|---|---|---|---|
| L01 | Does S/R response plus HL flow predict a move? | 8 fixed descriptive cells; 509 encounters / 507 usable | 0/8 advanced; some sparse/empty cells. Not ladder PnL or a traded strategy. Independent of the later ladder partial-clock repair. |
| L02 | Which existing deep adds contribute losses? | 3 attribution hypotheses at depths 6-11; 15/60-minute waiting-price diagnostics; 4 unchanged baselines | 0/3 advanced. No delay policy was replayed. Historical ladder attribution uses the earlier partial clock. |
| L03 | Block timer/near-resistance/weak-context adds? | 17 variants x 4 cases | 0/17 passed full screens; some combinations hardly/never intervened. Earlier clock; only cap10 subsequently rerun corrected. |
| L04 | Require HL confirmation on real price-drop adds? | 12 variants x 4 cases | 0/12 passed full screens. Some profit-positive rules worsened risk; broad confirmation lost recoveries. Earlier clock only. |
| L05 | Keep the pulse block until flow itself clears? | 6 variants x 4 cases, compared with exact nonpersistent controls | 0/6 passed full screens. A different gate-lifetime test, not just a duplicate L04 run. Earlier clock only. |
| L06 | Reduce deep size or cap remaining dollar exposure? | 7 variants x 4 cases; 6 new definitions plus cap10 control | 0/7 passed full screens. All cut DD in all four cases, with differing profit costs. Corrected clock. |
| L07 | Can a single closed-hour indicator improve the last add? | 4 individual rung-11 vetoes x 4 cases; baseline deep-fill attribution | 0/4 passed full screens. ROC improves recent profit but worsens recent resting DD and loses longer resting profit. Corrected clock; no combinations. |
| L08 | Half-size rung11 only in weak structure/VWAP-ROC/two-window HL? | 3 new conditions, baseline and repeated half11, original/extended periods plus HL delivery repeats;34 cases | 0/3 passed. Corrected transactional clock; no new exits. |
| L09 | Is every current component justified versus bare and full current? | 18 cumulative states +17 leave-one-out references,34 distinct configs;136 core cases +2 extra cutoff controls | 0/17 removal screens passed. Soft-stale/deep funding are aggregate net/DD refinement leads with monthly costs. Bare long DD75-77%; current not globally optimal. |

The L01 observation window starts **20:45**, two minutes later than the ladder
window. It uses 1h/4h future markouts only as outcome labels, not decision inputs.
L02 attributes existing fills; attribution PnL is not profit from removing a rung.

### L01: all eight descriptive S/R/flow cells

Support hold + buying; support hold + selling; support break + buying; support
break + selling; resistance hold + buying; resistance hold + selling; resistance
break + buying; resistance break + selling. Buy/sell ratios use >=1.2 / <=0.85.
Geometry is unchanged; there is no zone-parameter search or portfolio simulator.

[Definition](../research-inputs/sr-pulse-encounters/hype-2026-09-05.json) /
[findings](codex-astra-sr-pulse-encounter-findings-2026-09-05.md).

### L02: the three attribution hypotheses

Deep timer-only adds near resistance, the same plus sell-dominant taker15m,
and the same plus buy-dominant taker15m with nonpositive 15m price return.
Comparisons inspect depth/time/EMA context and 15/60-minute delayed-price labels.
These are **not three implemented delay strategies**.

[Definition](../research-inputs/sr-pulse-encounters/ladder-deep-adds-2026-09-05.json) /
[findings](codex-astra-ladder-deep-add-attribution-findings-2026-09-05.md).

### L03: all 17 exposure-control definitions

Each paired row is tested at **next depth >=11** and **next depth >=9**. With
max11, the latter means rungs 9-11, not rung 9 alone. Timer-only means the add
does not also qualify for the price-drop trigger. All original gates run first.

Near resistance = 0-0.3% below a known healthy zone. Weak = completed 4h close
not above EMA200 **OR** trailing 12h return <=-2%. Selling = taker15m <=0.85.
Positive confirmation = taker15m >=1.2 **AND** taker1h >=1 **AND** ret15m >0.

| Exact IDs | Change |
|---|---|
| cap10 | Never add rung 11; keep other existing policies |
| drop_only_d11 / drop_only_d9 | Block all timer-only adds at selected depths; genuine drops remain eligible |
| sr_timer_d11 / sr_timer_d9 | Block timer-only adds near resistance |
| sr_all_d11 / sr_all_d9 | Block both timer and genuine-drop adds near resistance |
| weak_timer_d11 / weak_timer_d9 | Block timer-only adds in weak context |
| sr_weak_timer_d11 / sr_weak_timer_d9 | Block timer-only adds near resistance AND weak context |
| sr_sell_timer_d11 / sr_sell_timer_d9 | Block timer-only adds near resistance AND selling flow |
| sr_weak_sell_timer_d11 / sr_weak_sell_timer_d9 | Block timer-only adds near resistance AND weak context AND selling flow |
| sr_confirm_timer_d11 / sr_confirm_timer_d9 | Near resistance, require positive confirmation for timer-only adds |

The strict weak+resistance+selling conjunction had no interventions in the saved
study. That is **unobserved**, not a tested demonstration of harmful expectancy.

[Definition](../research-inputs/sr-pulse-encounters/ladder-exposure-controls-2026-09-05.json) /
[policy](../scripts/ladder-exposure-policy.ts) /
[findings](codex-astra-ladder-exposure-controls-findings-2026-09-05.md).

### L04: all 12 genuine-drop pulse definitions

Every rule requires an otherwise-approved genuine price-drop add. Timer-only
adds are untouched. The same >=11 / >=9 depth pairs apply.

| Exact IDs | Additional condition |
|---|---|
| drop_sell15_d11 / drop_sell15_d9 | Block if taker15m <=0.85 |
| drop_sell_either_d11 / drop_sell_either_d9 | Block if taker15m <=0.85 OR taker1h <=0.9 |
| drop_confirm15_d11 / drop_confirm15_d9 | Require taker15m >=1.0 |
| drop_confirm_both_d11 / drop_confirm_both_d9 | Require taker15m >=1.2 AND taker1h >=1.0 |
| drop_sr_sell15_d11 / drop_sr_sell15_d9 | Only near resistance, block if taker15m <=0.85 |
| drop_sr_confirm_d11 / drop_sr_confirm_d9 | Only near resistance, require 15m >=1.2 AND 1h >=1.0 AND ret15m >0 |

Required pulse needs 14/55 minute samples for 15m/1h and source age <=90s.
Unknown required data makes the overlay inactive. A rebound can make an add
timer-only and outside this rule; that limitation motivated L05.

[Definition](../research-inputs/sr-pulse-encounters/ladder-drop-pulse-2026-09-05.json) /
[policy](../scripts/ladder-drop-pulse-policy.ts) /
[findings](codex-astra-ladder-drop-pulse-findings-2026-09-05.md).

### L05: all six persistent-hold definitions

| Exact IDs | Original L04 rule held until pulse clears |
|---|---|
| hold_drop_sell15_d11 / hold_drop_sell15_d9 | Selling15 veto; release when taker15m >0.85 |
| hold_drop_confirm_both_d11 / hold_drop_confirm_both_d9 | Require 15m >=1.2 AND 1h >=1.0 |
| hold_drop_sr_confirm_d11 / hold_drop_sr_confirm_d9 | Same confirmation plus ret15m >0, armed near resistance |

Once armed by a genuine-drop veto, a timer becoming eligible or leaving the
zone does not release the same episode/next-depth slot. Inventory/episode
changes reset it. Unknown pulse cannot arm or clear a hold. This missing-data
behavior differs from L04 and is recorded, not hidden as perfect isolation.
There was no hold-duration, hysteresis-threshold or timeout sweep.

[Definition](../research-inputs/sr-pulse-encounters/ladder-persistent-pulse-2026-09-05.json) /
[policy](../scripts/ladder-persistent-pulse-policy.ts) /
[findings](codex-astra-ladder-persistent-pulse-findings-2026-09-05.md).

### L06: all seven corrected-clock sizing definitions

| Exact ID | Change from unchanged baseline |
|---|---|
| last11_75 | Rung 11 order at 75% of original requested size |
| last11_50 | Rung 11 order at 50% of original requested size |
| deep9_75 | Each requested rung 9-11 at 75% of its original size |
| deep9_50 | Each requested rung 9-11 at 50% of its original size |
| cost_cap10 | Cap surviving entry-cost exposure at $43,672.13 |
| cost_cap10_half11 | Cap surviving entry-cost exposure at $51,714.75 |
| cap10_control | Same rule definition as L03 cap10, now rerun with corrected clock |

Standard rung 11 is $16,085.24; halving it means about $8,042.62, **not half
the whole ladder**. Fractions are not recursively compounded. Dollar caps count
existing retained inventory after partials, clip otherwise-approved adds, and
skip if less than $800 cap room remains. They are entry-cost caps, not marked
notional/margin caps, and do not forcibly sell existing exposure. Original
full-request affordability is retained. No gate or exit threshold is tuned.

[Definition](../research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json) /
[policy](../scripts/ladder-sizing-policy.ts) /
[findings, wins/losses and monthly comparisons](codex-astra-ladder-sizing-findings-2026-09-05.md).

### L07: all four individual indicator definitions

All original gates and affordability run first. Each rule independently vetoes
next depth 11 under the latest fully closed 1h condition; rungs 1-10, sizes,
exits, S/R logic and transactional partial clock are unchanged. Re-evaluate
later eligible minutes, with no persistent hold or fake pending order.

| Exact ID | Additional veto condition |
|---|---|
| rsi_hot_d11 | RSI14 >=70 |
| crsi_hot_d11 | CRSI(3,2,prior100) >=80 |
| roc_weak_d11 | Five-hour ROC <=0% |
| below_vwap_d11 | Last completed hourly close below its own UTC-day actual-turnover VWAP |

Fixed June 1, 2025 seed; no forming/future/stale feature fallback. Unknown
required data leaves the research overlay inactive and is counted (zero in
these runs). Both timer-only and genuine-drop adds are covered. Attribution
records depth >=9 as context, not extra depth-9 interventions. ATR/ADX/RVOL
were logged, not traded. Four canonical corrected baselines reproduce first;
20 total cases received independent formula, veto and inventory verification.

[Definition](../research-inputs/indicators/ladder-single-2026-09-05.json) /
[policy](../scripts/ladder-indicator-policy.ts) /
[findings and monthly W/L comparisons](codex-astra-ladder-single-indicator-findings-2026-09-05.md).

## 3. What has NOT been tested by this recent sequence

This boundary applies to L01-L07, **not a claim these ideas never appeared in
older local research**:

- Half-size rung 11 only under weak EMA context, near resistance, or hostile
  pulse. L06 sizing was unconditional once a baseline add was approved.
- A cross-product of sizing rules AND the L03-L05 blockers.
- A new long exit sweep, earlier flatten timing or partial-exit threshold sweep.
- A new S/R geometry search (timeframe, pivot confirmation, clustering, memory).
- New long-add veto combinations using HL order-book changes, OI changes,
  liquidations or funding alongside taker flow. These streams are not generally
  unused: some belong to baseline support-reopen context and older short work.
- A complete new search of base size, scale factor, TP, timer and max rungs.
- A corrected-clock shared-account long-plus-short optimization.
- Exact live maker/native execution, funding and outage parity, or a fresh
  untouched forward sample for these 45 rule definitions.
- Combinations of the new closed-bar indicators with each other or with HL/S/R;
  different L07 thresholds, shorter timeframes, sticky lifetimes or other depths.

Therefore **we have not established that the current config is globally optimal**.
We have tested specific alternatives and can say what passed or failed their
specified screens. This list is not authorization to start any untested branch.

## 4. Relevant older research: check before calling an idea new

These are historical findings and duplicate-search pointers. Except for the
recent short revalidation evidence, they are not refreshed current-stack
certifications. In particular, older long results predate the September
execution/input and partial-clock repairs. An old document saying "causal" or
"baseline matched" does not certify the latest model.

| Topic / dated study | Already covered | Status / source |
|---|---|---|
| Indicator x pulse, May 1 (5.15b/5.15c) | Taker, long/short-ratio and Bybit book-withdrawal base signals crossed with RSI/BB/EMA/ROC/volume/CRSI filters | Historical 6.5-day mined sample, several failures; not corrected current-ladder validation. [Ledger](codex-short-signal-results.md), sections 5.15b/5.15c. [Educational feature guide](../docs/research/indicator-field-guide.md); no new variants tested there. |
| Rung11 near daily/24h high, Aug 20 | 72 variants: 0.25-3% same-threshold waits; arm 0.25/0.5/0.75 then release 0.75/1/1.5/2%; UTC-day vs rolling24h; timer-only vs all | No qualifier under that engine; 4 windows through Aug19. [Findings](codex-hype-rung11-daily-high-delay-findings-2026-08-20.md). Not rerun corrected. |
| Trend re-entry and flatten timing, Aug 11 | Trend locking, rearming and cooldown/recovery trade-offs | [Findings](codex-hype-trendlock-timing-audit-2026-08-11.md); historical long model. |
| Damaged regime / support reopen, Aug 14 | Support confirmation OR vs AND, immediate/persistent regime pause, damage/recovery thresholds, $500-base comparator | Latch selected historically; OR retained. [Findings](codex-hype-current-regime-ladder-pause-findings-2026-08-14.md). Current baseline contains latch; its original selection grid was not rerun here. |
| Short signal families, Jul 16 | Book deterioration + taker selling + price breakdown; other OI/funding/liquidation and price/flow combinations | [Original findings](codex-hl-short-system-findings-2026-07-16.md); original short's later forward failure supersedes an old "proven" label. |
| Short architecture, Jul 16 | 460 single/parallel/adverse/favorable/hybrid/repeated-signal structures | No robust superior equal-capital structure; extra-slot sample thin. [Findings](codex-hl-short-architecture-findings-2026-07-16.md). Historical May-Jul cohort. |
| Shared-account shorts and size, Jul 16 | Long+short overlay, $500 size increments through $60k, fees/delay/margin controls | Historical coexistence/size study, not L06 or a latest-clock joint replay. [Ledger](codex-short-signal-results.md). |
| Short exit mitigation, Jul 16 | 121 policies: stops 2.5-6%, holds 4-24h, break-even, trailing, partials, reclaim and flow-based exits | No family winner passed. [Findings](codex-hl-short-exit-mitigation-findings-2026-07-16.md). 36 serial baseline trades. |
| Short final-hour timeout, Aug 10 | 40 causal final-hour selectors using trailing rank/low or observed rebound | No robust replacement; 43 completed baseline trades, 9 timeouts. [Findings](codex-hl-short-timeout-window-findings-2026-08-10.md). Entry cutoff Aug9 11:44:59 UTC. |
| Short nearby TP, Aug 10 | 1.50-2.50% in 0.05-point steps; 20 alternatives plus 2% baseline | 1.95% chosen historically. [Findings](codex-hl-short-nearby-tp-findings-2026-08-10.md). Same 43-trade cohort, plus live-fill comparison. |
| Short uptrend/regime suspension, Sep 4 | 10 suspension rules plus all-paused diagnostic: down-regime allowlists, bull alignment, EMA extension, rallies/composites, persistent latch | No rule passed both exact/+1m paths through Sep3 23:45. [Findings](codex-hl-short-regime-revalidation-findings-2026-09-04.md). Short entries paused after forward failure. |

Older fee/maker studies, live audits, safety tests and observational shadows are
separate evidence classes. An online shadow is not itself a completed strategy
replay. Read [research index](README.md), [older signal ledger](codex-short-signal-results.md)
and [handover](../MODEL-HANDOVER-2026-09-04.md) for other topics. This register does
not flatten old studies into one interchangeable PnL leaderboard.

## 5. What was intentionally repeated, and what was not a new simulation

| Work | Why it exists | Count as another setup? |
|---|---|---|
| Baseline digest checks at each stage | Detect infrastructure drift before comparing variants | No |
| Reproduce old clock, then corrected baseline | Identify and isolate a real replay/live state-transition repair | No |
| cap10 in L03 and L06 | Revalidate the same control under corrected clock beside sizing | No new rule; a new model-version result |
| L05 vs stored L04 controls | Isolate persistence instead of pretending a different gate is identical | Six new hold definitions; stored controls are not new simulations |
| L06 full deterministic verification rerun | Check reproducibility and independent accounting | No |
| Post-partial inventory audit | Explain retained exposure and clock semantics | No |
| Half-rung11 win/loss and month tables | Regroup accepted saved episodes and monthly marks | **No rerun and no new setup** |

## 6. Control before the next analysis

Before starting a new parameter sweep, show the user a small study card:

1. Question and exact baseline/config/model version.
2. Existing study IDs consulted; why this is not repeating them.
3. Exact frozen rule list and thresholds; number of new configurations and cases.
4. Exact dates, costs, timing, evidence gaps and untouched/previously-mined status.
5. What stays unchanged, qualification criteria and intended deliverables.
6. Whether the task is **saved-result analysis**, **repair revalidation**, **new
   data refresh**, or **new hypothesis**.

Get the user's go-ahead for that bounded sweep. No automatic extra families or
post-result threshold expansion. For an answer obtainable from saved results,
do not run the engine again. A rerun needs a named reason: corrected model,
material new data, missing evidence, or a genuinely changed frozen rule. Passing
that bookkeeping check is not a deployment approval.

## 7. Exact local evidence locations

L03-L06 results, baselines, rankings and validation records were inspected to
verify IDs/counts/status. The earlier 72-variant high-delay count was also
checked against its 292-row summary (72 + baseline, across four windows).
Older short counts above are from their dated reports/ledger, not new reruns.

| Study | Local generated evidence directory |
|---|---|
| L01 | backtests/hype/hype-sr-pulse-encounters-2026-09-05-final/ |
| L02 | backtests/hype/hype-ladder-deep-add-attribution-2026-09-05-validated/ |
| L03 | backtests/hype/hype-ladder-exposure-controls-2026-09-05/ |
| L04 | backtests/hype/hype-ladder-drop-pulse-2026-09-05/ |
| L05 | backtests/hype/hype-ladder-persistent-pulse-2026-09-05/ |
| L06 accepted | backtests/hype/hype-ladder-sizing-2026-09-05-validated/ |
| L07 accepted | backtests/hype/hype-ladder-single-indicator-2026-09-05/ |

For L03-L06 use results.json, baseline.json, ranking.json, validation.json and
their monthly/episode evidence. L06's earlier non-validated-named output folder
is a separate verification run, not another set of hypotheses. Preserve raw
data and generated outputs locally; this inventory does not upload them.
