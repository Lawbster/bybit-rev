# I03: CRSI risk/exit follow-up findings

September 6, 2026. Local standalone research only. No live configuration,
orders, ladder, short-owner, HL/S/R or prior replay source changes.

## TL;DR

- **None of the 12 new exit definitions improves its matching CRSI baseline
  in any of the four window/delay cases: 48/48 net deltas are negative.**
  All eight unchanged baselines reproduce I02 exactly; 0/12 passes either
  predeclared profit or defensive screen. This rejects these exact exit
  modifications, not CRSI or every possible protective exit.
- **The original 15m recovery-above-5 / 12h rule remains the cleaner risk
  comparator:** 142 full-window closes, 74 wins / 68 losses, +$8,684 net,
  8.68% adverse account DD. Adding the least costly tested stop (8%) gives
  144 closes, +$7,852 and **worse 9.64% DD**. Earlier CRSI exits reduce losses
  but remove substantially more winning profit.
- **Preserve the CRSI entry finding, end this bounded CRSI exit pass, move to
  RSI next.** The into-<=5 rule still earns +$11,044 versus recovery +$8,684,
  but its crash path is materially worse. No liquidation or live approval is
  implied. The [indicator register](INDICATOR-FINDINGS.md) records best cases,
  rejected definitions and remaining individual coverage before combinations.

## 1. Exact scope, dates and baselines

| Item | Meaning |
|---|---|
| Pair | Bybit HYPEUSDT final minute candles, explicit repaired overlay |
| Full period | **2025-07-01 00:00 to 2026-09-04 19:01 UTC** |
| Recent period | **2026-05-17 20:43 to 2026-09-04 19:01 UTC**, contained within full |
| Seed | Fixed 2025-06-01 00:00 UTC; no moving restart/reseed |
| Sizing / account | $10,000 fixed entry notional, $32,000 initial equity; one independent position per rule, no compounding |
| Costs | 0.055% entry and exit fees on actual notional; **before funding** |
| Execution | Signals from completed 15m bars; subsequent minute open at boundary, or separate +1m delay on both entry and exit |
| Own baseline | Same entry rule with unchanged 12h timeout from actual fill |
| Grid | 2 entries x 7 exits =14 definitions, **12 new +2 repeated baselines**; 48 variant +8 baseline cases |
| Hypothesis limit | Entries selected after I02; all windows previously mined and overlapping; no untouched holdout |
| Funding / execution limits | Incomplete settlement archive, no historical receipt timestamps, native stop/queue fills, margin/liquidation or joint ladder certification |

**I** = long crossing from CRSI >5 into <=5. **B** = long crossing from
CRSI <=5 back above 5. Both use unrounded CRSI(3,2,prior100) on 15m bars,
not the legacy rounded/current-inclusive live formula.

All entries stay fixed. Exit policies are baseline12h; completed-minute loss
triggers stop3/stop5/stop8 with the original timeout; timeout6h without another
exit; crsi50/crsi80 at the first subsequent completed CRSI >=50/80 or 12h.
No combined exit, TP, partials, new entry threshold, short or extra sweep.

A stop sees only a fully completed minute during which inventory was held.
The model fills at a subsequent available open, **never at an invented perfect
stop price**. A wick may already have recovered by execution, or price may gap
much further. Pending exit intent cannot be replaced. CRSI exits require a
decision strictly after actual entry. Occupied crossings are ignored; after
an early close a new genuine crossing can enter. All paths are rerun.

Context only: long clock net is +$3,305 / +$3,792 full (0/+1m), +$5,038 /
+$5,104 recent. Buy-and-hold with fixed initial quantity is +$11,511 full /
+$8,383 recent before funding. Cash is $0. These are **not** matched exposure,
incremental ladder profit or permission to add all strategies together.

## 2. Full-period wins versus losses: every definition

**July 1, 2025 to September 4, 2026 19:01 UTC; zero modeled delay.**
Dollars rounded. Winning and losing dollars already include trading fees.
Net = winning dollars + losing dollars + final open mark; rounding can differ
by a dollar. Fees must not be subtracted again. DD uses minute adverse price
versus prior close-equity peak, not just closed trades.

| Setup | N; W/L | Winning $ | Losing $ | Open $ | Net $ | Own Δ $ | DD % |
|---|---|---|---|---|---|---|---|
| I baseline12h | 142; 74/68 | 26,201 | -15,291 | 134 | 11,044 | baseline | 15.46 |
| I stop3 | 154; 73/81 | 25,427 | -20,500 | 134 | 5,062 | -5,983 | 19.66 |
| I stop5 | 146; 74/72 | 25,193 | -20,129 | 134 | 5,198 | -5,846 | 20.60 |
| I stop8 | 142; 73/69 | 24,959 | -17,182 | 134 | 7,911 | -3,133 | 13.73 |
| I timeout6h | 153; 75/78 | 16,916 | -13,568 | 134 | 3,482 | -7,562 | 13.86 |
| I crsi50 | 166; 112/54 | 5,928 | -4,421 | 0 | 1,506 | -9,538 | 13.19 |
| I crsi80 | 158; 101/57 | 13,057 | -8,547 | 0 | 4,510 | -6,534 | 12.92 |
| B baseline12h | 142; 74/68 | 23,334 | -14,813 | 163 | 8,684 | baseline | 8.68 |
| B stop3 | 156; 72/84 | 23,256 | -18,696 | 163 | 4,723 | -3,961 | 15.24 |
| B stop5 | 147; 74/73 | 22,947 | -17,615 | 163 | 5,495 | -3,189 | 14.45 |
| B stop8 | 144; 74/70 | 23,038 | -15,350 | 163 | 7,852 | -832 | 9.64 |
| B timeout6h | 154; 72/82 | 14,425 | -14,223 | 163 | 365 | -8,319 | 12.46 |
| B crsi50 | 175; 91/84 | 3,923 | -4,001 | 0 | -77 | -8,762 | 5.64 |
| B crsi80 | 159; 96/63 | 9,482 | -8,338 | 0 | 1,144 | -7,540 | 5.54 |

The 3%/5% loss triggers are not harmless insurance: both entry families lose
more aggregate money on losing trades and suffer higher full-period DD.
B stop8 is the smallest full profit sacrifice (-$832), but does not improve DD
in **any** window/delay case.

## 3. Recent-period comparison

**May 17, 2026 20:43 to September 4, 2026 19:01 UTC; zero modeled delay.**
Same costs, notional and own-entry baselines. This is not a second independent
sample. September and the first recent May interval are partial months.

| Setup | N; W/L | Winning $ | Losing $ | Open $ | Net $ | Own Δ $ | DD % |
|---|---|---|---|---|---|---|---|
| I baseline12h | 33; 21/12 | 8,698 | -2,230 | 134 | 6,603 | baseline | 4.05 |
| I stop3 | 36; 22/14 | 8,748 | -3,025 | 134 | 5,857 | -746 | 3.86 |
| I stop5 | 34; 21/13 | 8,698 | -2,637 | 134 | 6,195 | -407 | 4.07 |
| I stop8 | 33; 21/12 | 8,698 | -2,501 | 134 | 6,331 | -272 | 3.85 |
| I timeout6h | 35; 23/12 | 6,219 | -1,938 | 134 | 4,414 | -2,188 | 3.31 |
| I crsi50 | 39; 28/11 | 1,283 | -697 | 0 | 585 | -6,017 | 1.49 |
| I crsi80 | 38; 25/13 | 3,240 | -1,306 | 0 | 1,934 | -4,668 | 1.97 |
| B baseline12h | 33; 22/11 | 8,055 | -1,946 | 163 | 6,272 | baseline | 4.00 |
| B stop3 | 36; 22/14 | 8,012 | -2,779 | 163 | 5,396 | -875 | 3.62 |
| B stop5 | 34; 22/12 | 8,055 | -2,562 | 163 | 5,656 | -615 | 4.10 |
| B stop8 | 34; 22/12 | 8,055 | -2,147 | 163 | 6,071 | -200 | 4.68 |
| B timeout6h | 36; 21/15 | 5,360 | -2,128 | 163 | 3,396 | -2,876 | 4.27 |
| B crsi50 | 41; 20/21 | 770 | -723 | 0 | 46 | -6,225 | 2.35 |
| B crsi80 | 38; 25/13 | 2,494 | -1,506 | 0 | 988 | -5,284 | 2.74 |

Several earlier exits improve recent DD, but none improves recent net.
For example B stop3 lowers recent DD from 4.00% to 3.62% at a cost of $875;
over the full period it raises DD from 8.68% to 15.24% and loses $3,961.
Do not present the recent benefit without that longer-window cost.

## 4. Delay and cost robustness

Same dates as sections 2/3. Every +1m action uses its actual later open.
Trade membership can change after the timeout/early exit, not just fill price.

| Setup | Full 0m net | Full +1m net | Full +1m Δ | Recent 0m net | Recent +1m net | Recent +1m Δ |
|---|---|---|---|---|---|---|
| I baseline12h | 11,044 | 10,773 | baseline | 6,603 | 6,222 | baseline |
| I stop3 | 5,062 | 4,264 | -6,509 | 5,857 | 5,366 | -856 |
| I stop5 | 5,198 | 6,233 | -4,540 | 6,195 | 5,937 | -285 |
| I stop8 | 7,911 | 7,098 | -3,675 | 6,331 | 6,011 | -211 |
| I timeout6h | 3,482 | 3,258 | -7,515 | 4,414 | 4,183 | -2,038 |
| I crsi50 | 1,506 | 1,398 | -9,375 | 585 | 196 | -6,026 |
| I crsi80 | 4,510 | 3,082 | -7,691 | 1,934 | 1,442 | -4,780 |
| B baseline12h | 8,684 | 7,744 | baseline | 6,272 | 6,023 | baseline |
| B stop3 | 4,723 | 5,002 | -2,742 | 5,396 | 5,839 | -184 |
| B stop5 | 5,495 | 4,974 | -2,770 | 5,656 | 5,512 | -512 |
| B stop8 | 7,852 | 7,430 | -314 | 6,071 | 5,897 | -126 |
| B timeout6h | 365 | 433 | -7,311 | 3,396 | 3,668 | -2,355 |
| B crsi50 | -77 | -514 | -8,258 | 46 | 143 | -5,880 |
| B crsi80 | 1,144 | -57 | -7,801 | 988 | 897 | -5,127 |

All 48 own-baseline deltas are negative. Ten of 12 alternatives remain
positive before funding in all four cases; eight survive all four extra-cost
tests. Positive absolute PnL alone is not an improvement over the existing
CRSI rule.

Extra stress is **additional 5bps each side** on actual turnover including
marked end exit, holding the trade path fixed. I baseline stressed full/recent
net is $9,608 / $6,259 at zero delay and $9,337 / $5,878 delayed. B baseline
is $7,249 / $5,928 and $6,309 / $5,680. It retains the original entry evidence.

Failed all-case cost survival: I crsi50, B timeout6h, B crsi50 and B crsi80.
In particular B crsi80's apparent +$1,144 full zero-delay net becomes -$447
with extra costs; at +1m it is already -$57 before that stress.

## 5. Ranking and screens

Ranked by **full zero-delay delta versus the same entry's 12h baseline**,
not by picking the favorable recent case. Complete failed criteria are saved
in `ranking.json`.

| Rank / policy | Full Δ 0m | Full Δ +1m | Recent Δ 0m | Recent Δ +1m | Worst monthly Δ | Profit / defensive |
|---|---|---|---|---|---|---|
| 1. B stop8 | -832 | -314 | -200 | -126 | -487 | fail / fail |
| 2. I stop8 | -3,133 | -3,675 | -272 | -211 | -3,450 | fail / fail |
| 3. B stop5 | -3,189 | -2,770 | -615 | -512 | -863 | fail / fail |
| 4. B stop3 | -3,961 | -2,742 | -875 | -184 | -1,601 | fail / fail |
| 5. I stop5 | -5,846 | -4,540 | -407 | -285 | -3,452 | fail / fail |
| 6. I stop3 | -5,983 | -6,509 | -746 | -856 | -3,645 | fail / fail |
| 7. I crsi80 | -6,534 | -7,691 | -4,668 | -4,780 | -2,431 | fail / fail |
| 8. B crsi80 | -7,540 | -7,801 | -5,284 | -5,127 | -2,351 | fail / fail |
| 9. I timeout6h | -7,562 | -7,515 | -2,188 | -2,038 | -1,858 | fail / fail |
| 10. B timeout6h | -8,319 | -7,311 | -2,876 | -2,355 | -1,683 | fail / fail |
| 11. B crsi50 | -8,762 | -8,258 | -6,225 | -5,880 | -2,651 | fail / fail |
| 12. I crsi50 | -9,538 | -9,375 | -6,017 | -6,026 | -2,948 | fail / fail |

Profit screen was positive delta in every case, no monthly marked regression,
positive net/stress, >=30 full/10 recent closes, and no account equity
exhaustion. Defensive screen retained positive/stress/sample/solvency checks,
allowed at most 10% net sacrifice per case and $500 monthly regression,
required no worse DD anywhere and >=20% relative full DD reduction in both
delays. These were frozen before outcomes, not new live thresholds.

**0 profit qualifiers; 0 defensive qualifiers.** B stop8 passes the net
retention and $500 monthly bound but fails the DD requirements. B crsi50/80
can reduce DD enough but fail profit/cost/retention. The other alternatives
also fail profit retention and/or the DD/monthly bounds. No sample-size rule
was relaxed after seeing results.

## 6. Month-by-month: top five alternatives, both baselines visible

These are the five highest-ranked alternatives, **not five qualified
candidates**. Show each baseline's marked net, then the alternative's delta
versus its own I or B baseline. A variant's monthly net = that baseline + delta.
All dollars rounded; values below $0.50 display zero. Monthly marks allocate
inventory changes/fees to their actual month, not all to final exit month.

### Full, zero delay

| Month | I baseline $ | B baseline $ | B stop8 Δ$ | I stop8 Δ$ | B stop5 Δ$ | B stop3 Δ$ | I stop5 Δ$ |
|---|---|---|---|---|---|---|---|
| 2025-07 | 700 | 295 | 0 | 0 | +17 | +401 | -3 |
| 2025-08 | 1,725 | 1,569 | 0 | 0 | +192 | -1,060 | -297 |
| 2025-09 | -817 | -672 | 0 | 0 | -146 | -564 | -622 |
| 2025-10 | 1,198 | 333 | -487 | -2,669 | -812 | -1,601 | -3,221 |
| 2025-11 | -31 | -231 | 0 | 0 | 0 | +75 | -872 |
| 2025-12 | 40 | 131 | 0 | 0 | -801 | -55 | -126 |
| 2026-01 | -563 | -484 | -145 | -193 | -548 | +411 | -83 |
| 2026-02 | 1,500 | 982 | 0 | 0 | -476 | -165 | -215 |
| 2026-03 | 1,224 | 867 | 0 | 0 | 0 | -480 | 0 |
| 2026-04 | -766 | -789 | 0 | 0 | 0 | -47 | 0 |
| 2026-05 | 2,348 | 2,388 | 0 | 0 | 0 | 0 | 0 |
| 2026-06 | 3,414 | 2,819 | -200 | -272 | -615 | +47 | -407 |
| 2026-07 | -348 | 4 | 0 | 0 | 0 | -384 | 0 |
| 2026-08 | 1,158 | 1,224 | 0 | 0 | 0 | -538 | 0 |
| 2026-09 | 262 | 248 | 0 | 0 | 0 | 0 | 0 |

### Full, +1m delay

| Month | I baseline $ | B baseline $ | B stop8 Δ$ | I stop8 Δ$ | B stop5 Δ$ | B stop3 Δ$ | I stop5 Δ$ |
|---|---|---|---|---|---|---|---|
| 2025-07 | 570 | 316 | 0 | 0 | -51 | +419 | +76 |
| 2025-08 | 1,774 | 1,392 | 0 | 0 | +237 | -959 | -318 |
| 2025-09 | -835 | -718 | 0 | 0 | -230 | -522 | -207 |
| 2025-10 | 1,461 | 122 | -416 | -3,450 | -863 | -1,106 | -3,452 |
| 2025-11 | -1 | -259 | 0 | 0 | 0 | -404 | 0 |
| 2025-12 | -10 | 144 | 0 | 0 | -671 | -191 | -132 |
| 2026-01 | -328 | -710 | +229 | -14 | -252 | +647 | -24 |
| 2026-02 | 1,408 | 1,043 | 0 | 0 | -429 | -78 | -198 |
| 2026-03 | 1,061 | 810 | 0 | 0 | 0 | -375 | 0 |
| 2026-04 | -827 | -883 | 0 | 0 | 0 | +12 | 0 |
| 2026-05 | 2,361 | 2,494 | 0 | 0 | 0 | 0 | 0 |
| 2026-06 | 3,166 | 2,499 | -126 | -211 | -512 | +90 | -285 |
| 2026-07 | -364 | -24 | 0 | 0 | 0 | -304 | 0 |
| 2026-08 | 1,105 | 1,273 | 0 | 0 | 0 | +30 | 0 |
| 2026-09 | 232 | 245 | 0 | 0 | 0 | 0 | 0 |

### Recent, zero delay

| Month | I baseline $ | B baseline $ | B stop8 Δ$ | I stop8 Δ$ | B stop5 Δ$ | B stop3 Δ$ | I stop5 Δ$ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 2,116 | 1,976 | 0 | 0 | 0 | 0 | 0 |
| 2026-06 | 3,414 | 2,819 | -200 | -272 | -615 | +47 | -407 |
| 2026-07 | -348 | 4 | 0 | 0 | 0 | -384 | 0 |
| 2026-08 | 1,158 | 1,224 | 0 | 0 | 0 | -538 | 0 |
| 2026-09 | 262 | 248 | 0 | 0 | 0 | 0 | 0 |

### Recent, +1m delay

| Month | I baseline $ | B baseline $ | B stop8 Δ$ | I stop8 Δ$ | B stop5 Δ$ | B stop3 Δ$ | I stop5 Δ$ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 2,083 | 2,030 | 0 | 0 | 0 | 0 | 0 |
| 2026-06 | 3,166 | 2,499 | -126 | -211 | -512 | +90 | -285 |
| 2026-07 | -364 | -24 | 0 | 0 | 0 | -304 | 0 |
| 2026-08 | 1,105 | 1,273 | 0 | 0 | 0 | +30 | 0 |
| 2026-09 | 232 | 245 | 0 | 0 | 0 | 0 | 0 |

All 560 monthly rows, including W/L counts, winning/losing dollars, paid fees,
closed net and marked net for all 14 definitions and both delays, remain in
`monthly.csv` / `monthly.json`. The October crash explains much of the
into-stop cost, but several stop variants also sacrifice other months;
this is not solely one adverse exit chosen in hindsight.

## 7. What changes: protection, recovered wins and new opportunities

The following is a **saved-ledger decomposition**, not another simulation.
Full period, zero delay. Pair completed trades by the same causal entry
signal. Different exits can create additional or missed entry opportunities.

Total delta = shared-entry delta + additional-trade net **minus** missed
baseline-trade net + final-open-mark delta. A missed losing baseline trade
therefore contributes positively. This identity was checked for all 24
full-window variant/delay cases.

| Policy | Shared-entry Δ $ | Additional closes / net $ | Missed baseline closes / net $ | End-mark Δ $ | Total Δ $ |
|---|---|---|---|---|---|
| I stop3 | -6,221 | 13 / -53 | 1 / -291 | 0 | -5,983 |
| I stop5 | -5,176 | 4 / -670 | 0 / +0 | 0 | -5,846 |
| I stop8 | -3,133 | 0 / +0 | 0 / +0 | 0 | -3,133 |
| I timeout6h | -8,404 | 11 / +842 | 0 / +0 | 0 | -7,562 |
| I crsi50 | -9,979 | 24 / +575 | 0 / +0 | -134 | -9,538 |
| I crsi80 | -7,093 | 16 / +693 | 0 / +0 | -134 | -6,534 |
| B stop3 | -3,990 | 15 / -225 | 1 / -254 | 0 | -3,961 |
| B stop5 | -1,903 | 6 / -1,119 | 1 / +168 | 0 | -3,189 |
| B stop8 | -713 | 2 / -119 | 0 / +0 | 0 | -832 |
| B timeout6h | -8,936 | 12 / +617 | 0 / +0 | 0 | -8,319 |
| B crsi50 | -8,762 | 33 / +164 | 0 / +0 | -163 | -8,762 |
| B crsi80 | -7,518 | 17 / +142 | 0 / +0 | -163 | -7,540 |

The CRSI50 result illustrates why win rate alone is misleading:

- **I:** 112/166 wins (67.5%), up from 74/142 (52.1%), but net falls from
  $11,044 to $1,506. Among the paired entries, early exit improves the
  baseline-losing trades by **$13,351**, while removing **$23,330** from
  baseline winners. Its 24 additional closes contribute only $575.
- **B:** early CRSI50 improves paired baseline losers by **$13,637**, but
  removes **$22,399** from baseline winners. The 33 additional closes add
  only $164, leaving -$77 net versus baseline +$8,684.

Thus the invisible upside is measurable: original holds capture later
recovery, not just bigger eventual losses. This does not mean holding is
always safe; the crash below demonstrates the real risk it accepts.

## 8. Exact causal crash trace: October 10, 2025 UTC

The into signal was known at **21:15**, CRSI **3.844946582351047**,
computed from the 15m candle ending then. Zero-delay entry was **$35.753**.

1. The held 21:15 minute low was $34.704, still just above the 3% trigger
   $34.68041. No stop decision may use the future 21:16 low yet.
2. The completed 21:16 minute low was $30.526. At **21:17**, that observation
   crosses all three 3%/5%/8% thresholds. All three zero-delay stops fill the
   **21:17 open $30.688**, net **-$1,426.89** including fees.
3. With +1m execution delay, entry is 21:16 at $34.934, stop is still observed
   at 21:17, and fill is **21:18 at $29.865**, net **-$1,461.22**.
4. The unchanged zero-delay baseline instead exits October 11 09:15 at
   $40.235 for **+$1,241.91**; delayed baseline exits 09:17 at $40.287 for
   **+$1,520.48**.

**Important avoided risk:** before recovering, the baseline stayed exposed
through the 21:21 low $20.784, approximately **-41.87% / -40.50%** from
the two entries. Stops avoided that later exposure. It is incorrect to call
them worthless because a hindsight recovery happened. It is equally incorrect
to claim an observed 3% trigger capped losses at 3% or improved the whole
strategy: this model realizes about 14% loss in that event, and its aggregate
stop results are worse.

For B entry, the same day's baseline enters 21:45 at $39.241 and closes next
day +$341.75. Its 5%/8% triggers react at 22:47, **after** the 22:46 wick to
$35.85, and fill the rebounded $38.713 for -$145.48. That illustrates the
specific observed-minute exit model: it is not a resting native stop fill.

## 9. CRSI disposition and handoff

**Keep documented:**

- Best full net among previously tested CRSI entries remains I02 15m into
  <=10: +$12,202, but recent +$3,465 trails clock +$5,038 and full DD is
  18.91%. It was not part of this risk follow-up.
- The selected **15m into <=5 / 12h** remains the higher-net comparator:
  +$11,044 full / +$6,603 recent, with substantial crash-path risk.
- The **15m recovery >5 / 12h** remains the more risk-conscious comparator
  of these entries: +$8,684 / +$6,272, DD 8.68% / 4.00%, n142/33.
  Recovery avoids that specific October low; it is not guaranteed cascade
  protection. Both original rules retain delay/cost-positive evidence but
  still fail I02's no-month-worse-than-clock gate.
- The 12 new exits are **not supported as upgrades under these definitions**.
  Do not erase the useful original entry result or claim every protective
  implementation/CRSI exit has been exhausted.

Stop refining this selected CRSI pair for now. **RSI is next**, followed by
the agreed individual-indicator queue in [INDICATOR-FINDINGS](INDICATOR-FINDINGS.md).
RSI/ROC/VWAP still have only narrow I01 directional tests; ADX/ATR/RVOL math is
validated but not a standalone direction signal by itself. New formula families
need independent accuracy/timing tests before PnL runs. No indicator mixtures,
HL/S/R combinations, portfolio overlay or live promotion was run in I03.

## 10. Evidence and verification

- [Frozen I03 card](../research-inputs/indicators/crsi-risk-exit-2026-09-06.json)
- [Engineering / reproduction guide](../docs/research/crsi-risk-exit-study.md)
- [I02 entry findings](codex-astra-crsi-extremes-findings-2026-09-05.md)
- Runner: `scripts/hype-crsi-risk-exit-study.ts`
- Engine: `scripts/crsi-risk-exit-engine.ts`
- Tests / independent audit: `scripts/crsi-risk-exit-tests.ts`,
  `scripts/crsi-risk-exit-results-check.ts`
- Local artifacts: `backtests/hype/hype-crsi-risk-exit-2026-09-06/`

**Passed:** 13 new synthetic test groups; 10 previous CRSI, 12 feature-math
and 11 closed-timing groups; both TypeScript configurations. All eight
unchanged baseline ledgers/months/stats match both the old engine and saved
I02 results exactly. Three actual-data feature-prefix and 14 strategy-prefix
checks pass. Input/old-source hashes are unchanged.

Independent artifact verification passes **56 cases, 5,256 trade rows,
560 monthly rows**, reconstructing 15m CRSI, every eligible crossing,
occupied skips, first eligible exit, delayed prices, fees, inventory, monthly
and minute equity/DD. Counts overlap across windows/models; they are not
5,256 independent market trades. A separate read-only review also reproduced
all 12 ranking orders/screen failure sets. The main ledger audit explicitly
does not itself regenerate ranking screens.

Generated output and raw data remain local. This work neither commits nor
pushes anything; no live state/config or existing pinned replay source was
edited. No additional risk/exit grid was tried after these outcomes.

