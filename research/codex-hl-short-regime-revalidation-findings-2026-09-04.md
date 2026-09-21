# HYPE HL Short Regime Revalidation — 2026-09-04

## TL;DR

- The deterioration is real, not a notification, fee, or execution artifact. The live owner has completed **20 shorts for -$3,891.07 net** (7 winners / 13 losers). The causal shadow for those same entries is about **-$3,780 at configured costs** and **-$4,230 at stress costs**.
- The frozen TP 1.95% / SL 4% / 12h strategy remains positive over the expanded May 21–September 3 replay: **57 serial trades, +22.880% / about +$5,720 at configured costs**, or **+17.750% / about +$4,438 at 0.20% stress costs**. But all of that cushion came from the old evidence: the untouched cohort is **14 trades, -20.544% / about -$5,136 stress**, with 4 stops and 8 timeouts.
- **No predeclared causal regime rule passes.** The closest composite is path-sensitive, misses the September failures, and breaches the old-evidence/month gates. Recommendation: **pause new short entries while flat**, keep the transactional owner and telemetry running, and do not deploy a fitted regime filter from this pass.

## Question and verdict

Question: does the frozen `hl_bid_pull_break` short still survive the expanded evidence, and can a small causal higher-timeframe suspension preserve the old edge while preventing the recent loss cluster?

Verdict: **PAUSE NEW SHORT ENTRIES; RETAIN THE OWNER.**

This is a temporary validation/risk-control verdict, not a claim that permanent no-trade beats the strategy over all history. The all-paused comparator gives up the old +38.295 percentage-point stress edge and the full-period +17.750 points. However, the candidate's originally required 30–60 day forward observation has now failed: first-forward was already slightly negative, the genuinely untouched sample lost another 20.544 points, and no causal suspension survives the frozen robustness gate.

Operationally, pausing means `entryEnabled=false` only after confirming both local and exchange short quantity are zero. It does **not** mean disabling execution/reconciliation, stopping the PM2 owner, or changing TP/SL/timeout behavior for an open short. No live config was changed in this research pass.

## Scope and replay discipline

Inputs:

- Historical causal decision grid: `backtests/hype/hl-short-study-2026-08-10/decision-features.csv`
- Production shadow journal: `data/HYPEUSDT_hl_short_breakdown_shadow.jsonl`
- Bybit HYPE one-minute candles: `data/HYPEUSDT_1m.jsonl`

Coverage ends at **2026-09-03 23:45 UTC**. The merged ledger contains 51 historical fires and 21 production-shadow fires, with 8 overlapping timestamps: **64 unique raw signals**. Serial position ownership turns those into 57 exact-entry trades or 56 one-minute-delayed trades because signals arriving while a trade is active are unavailable.

Frozen mechanics:

- TP 1.95%, SL 4%, maximum hold 12h
- 60-minute raw-signal cooldown
- exact next-open and one-minute-delayed entry paths
- stop-first treatment if TP and SL share a minute candle
- 0.11% configured round-trip cost and 0.20% stress cost
- one fixed $25,000 notional unit; results are not compounded

The higher-timeframe variants were frozen before results were inspected. They use only completed 1h/4h bars and trailing data available at the decision timestamp. There are no strategy, config, or execution changes in the harness.

Parity checks passed:

- Prior TP1.95 old-evidence stress baseline reproduced exactly at **+38.294830%**.
- Expanded configured and stress baselines reproduced at **+22.880444%** and **+17.750444%**.
- Signal counts reproduced at historical/shadow/overlap/unique = **51/21/8/64**.
- Every available policy-v2 production close replayed with the same entry price, outcome, and stress PnL: **13/13 exact** and **12/12 serial one-minute-delay** trades.

## Baseline by evidence cohort

All figures below are stress PnL percentage points on one $25,000 short notional. Multiply one point by $250 for the dollar equivalent.

| Cohort | Exact n | Exact stress | +1m n | +1m stress | Read |
|---|---:|---:|---:|---:|---|
| Train | 16 | +18.519% | 16 | +18.959% | Strong |
| Prior test | 20 | +20.552% | 20 | +16.791% | Strong |
| First forward | 7 | -0.777% | 7 | -0.692% | First warning |
| Old evidence total | 43 | +38.295% | 43 | +35.058% | Original edge intact |
| Untouched from Aug 9 | 14 | **-20.544%** | 13 | **-10.441%** | Failed |
| Full expanded | 57 | +17.750% | 56 | +24.617% | Positive, but deteriorated |

Exact-entry untouched composition was 2 TPs, 4 stops, and 8 timeouts. Win rate fell from **79.1%** over the 43 old-evidence trades to **28.6%** over the 14 untouched trades. Configured-path drawdown within the untouched sequence was 19.906 percentage points.

Documentation correction, 2026-09-04: the original sentence incorrectly said
4 TPs. The baseline/exact rows in `variant-trades.csv` contain 2 TPs, 4 stops
and 8 timeouts (14 trades total). The 4 winning trades include profitable
timeouts. The stress total remains -20.5443867465 percentage points; no replay,
strategy, or verdict was changed by this correction.

The one-minute path is less negative mainly because the August 20 signal changes from an exact-entry stop to a delayed-entry TP, and an overlapping August 24 signal becomes unavailable. That is useful execution sensitivity, but it does not restore positive expectancy.

## Live evidence

The local transactional state is flat and current through 2026-09-03 23:46 UTC. Its 20 completed live shorts are:

| Period/reason | n | Net PnL |
|---|---:|---:|
| July closes | 4 | +$371.19 |
| August closes | 14 | -$2,597.81 |
| September closes | 2 | -$1,664.45 |
| Native TP/SL combined | 9 | -$1,856.31 |
| Timeouts | 10 | -$1,995.39 |
| Protection-failure close | 1 | -$39.37 |
| **All live closes** | **20** | **-$3,891.07** |

Total fees allocated to those trades are $551.23. Replaying the same 20 opened signal IDs from the production shadow produces **-15.121% / about -$3,780 at configured costs** and **-16.921% / about -$4,230 at stress costs**. The live result sits inside that band. The loss is therefore signal/market expectancy, not principally exchange execution.

## Frozen regime-rule ranking

Every delta is versus the unchanged baseline, in stress-PnL percentage points. `Old` ends before the untouched Aug 9 cutoff. `New` is the untouched cohort. Both exact and +1m paths were mandatory.

| Variant | Old exact Δ | Old +1m Δ | New exact Δ | New +1m Δ | Full exact Δ | Full +1m Δ | Worst old-month Δ | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Ext≥15 + 7d≥10 + 24h≤0 suspension | -1.019 | -1.459 | +6.650 | +2.450 | +5.631 | +0.991 | -1.050 | Fail |
| Suspend EMA200 extension ≥15% | -15.019 | -15.459 | +19.881 | +9.988 | +4.862 | -5.471 | -8.719 | Fail |
| Persistent rally latch | -11.601 | -12.080 | +13.095 | +3.202 | +1.493 | -8.878 | -6.382 | Fail |
| Suspend EMA200 extension ≥20% | -11.519 | -11.959 | +10.850 | +0.700 | -0.669 | -11.259 | -6.969 | Fail |
| Ext≥15 + 7d≥15 suspension | -11.519 | -11.959 | +10.850 | +0.700 | -0.669 | -11.259 | -6.969 | Fail |
| Suspend after 7d return ≥20% | -13.969 | -14.409 | +10.850 | +0.700 | -3.119 | -13.709 | -7.000 | Fail |
| Allow only local-down regime | -24.704 | -25.195 | +20.432 | +10.240 | -4.272 | -14.955 | -14.934 | Fail |
| Allow only original down regime | -27.154 | -27.645 | +19.881 | +9.988 | -7.273 | -17.657 | -13.184 | Fail |
| Suspend bull alignment | -17.582 | -17.620 | +6.650 | -3.500 | -10.932 | -21.120 | -8.750 | Fail |
| Bull + ext≥10 + 7d≥10 suspension | -18.303 | -18.304 | +6.650 | -3.500 | -11.653 | -21.804 | -8.750 | Fail |
| All paused diagnostic | -38.295 | -35.058 | +20.544 | +10.441 | -17.750 | -24.617 | -23.121 | Diagnostic |

Frozen promotion gate:

- old-evidence exact and +1m delta each at least -1.0 point
- untouched exact and +1m improvement each at least +4.0 points
- positive full-period delta on both entry paths
- no old month worse than -1.0 point
- at least 30 old-evidence trades retained on both paths
- explainable causal mechanism

**Passing variants: 0.**

## Why the nearest result is still a rejection

The nearest rule suspends shorts when price is at least 15% above the completed-4h EMA200, the trailing seven-day return is at least +10%, and the trailing 24-hour return is nonpositive.

It blocks three August 24 fires:

| Decision UTC | Baseline exact result | EMA200 distance | 24h return | 7d return |
|---|---:|---:|---:|---:|
| Aug 24 08:30 | -4.200% stop | +24.04% | -2.03% | +30.49% |
| Aug 24 13:45 | +1.750% TP | +26.12% | -1.66% | +33.35% |
| Aug 24 17:30 | -4.200% stop | +23.60% | -3.09% | +31.60% |

Exact entry sees all three trades, so removing them adds +6.650 points. With a one-minute delay, the 13:45 TP remains open until 17:45, making the 17:30 signal unavailable even in baseline. The rule therefore removes only one stop and one TP, worth +2.450 points. It also leaves the Sep 1 -2.586% timeout and Sep 3 -4.200% stop untouched.

It narrowly misses the old aggregate thresholds too: -1.019 exact, -1.459 delayed, and -1.050 in June. Its apparently attractive full exact delta is concentrated in one same-day cluster and falls to +0.991 with one minute of entry perturbation. That is not sufficient evidence for a live regime filter.

## Monthly stability and invisible upside

| Month | Baseline exact stress | Nearest-rule exact stress | Δ |
|---|---:|---:|---:|
| May | +8.719% | +8.750% | +0.031% |
| June | +23.121% | +22.071% | -1.050% |
| July | +10.327% | +10.327% | 0.000% |
| August | -17.630% | -10.980% | +6.650% |
| September | -6.786% | -6.786% | 0.000% |

The invisible cost of broad pausing is large: old profitable shorts produced +38.295 stress points, about $9,574 on one $25,000 notional. Even the expanded full replay remains +17.750 points. That is why this pass does not declare the short permanently dead or retrofit a broad bull-market block.

The opposing evidence is now also large enough to act on operationally: 21 production-shadow fires across roughly the originally requested forward-observation duration, 20 actual live closes, two consecutive negative completion months, and a 14-trade untouched replay cohort. Continuing to spend risk while searching for a fitted rule is not justified.

## No-lookahead audit

For the Sep 3 16:15 UTC signal:

- the signal is the completed 16:00–16:15 15m decision and exact entry is the 16:15 one-minute open;
- 1h and 4h features use only bars whose end is `<=16:15` (the last eligible 4h bar ended at 16:00);
- 24h and 7d returns use the last completed minute at 16:14 against 16:14 exactly one day/seven days earlier;
- causal values were EMA200 distance +17.05%, trailing 24h +2.29%, and trailing 7d -1.21%, so the nearest rule correctly did not block it; the trade later stopped.

No exit bar is consulted when deciding whether a variant admits a signal. Exit simulation begins only after admission and uses stop-first minute OHLC handling.

## Recommendation

1. While the exchange short and transactional state are flat, set only the short owner's **new-entry permission** off.
2. Keep the live owner, reconciliation, shadow, BPV counterfactual, and watchdog online. This preserves safety and continues collecting the exact evidence needed to determine whether expectancy recovers.
3. Do not change TP1.95, SL4, the 12h timeout, size, or deploy any rule in this matrix. Those are not the identified fault and no replacement passed.
4. Re-open the decision only with a newly frozen hypothesis and a new untouched cohort. Do not tune the near-miss thresholds around the August 24 cluster.

## Reproduction

```powershell
npx ts-node scripts/hype-hl-short-regime-revalidation.ts
npx tsc --noEmit --pretty false
```

Artifacts are written to `backtests/hype/hl-short-regime-revalidation-2026-09-04/`:

- `run.json`
- `signal-features.csv`
- `variant-summary.csv`
- `cohort-results.csv`
- `monthly-results.csv`
- `variant-trades.csv`
