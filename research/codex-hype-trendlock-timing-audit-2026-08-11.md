# HYPE trend-lock and hard-flatten timing audit — 2026-08-11

## TL;DR

- The August 11 hard flatten was operationally correct and locally/exchange-accounted cleanly. The painful timing is real: the current trend gate rearmed at the August 10 20:00 UTC close while HYPE remained 6.2% below its 4H EMA200, captured one +$196.43 live TP cycle, immediately recycled, and then flattened the new 11-rung ladder for -$1,780.09.
- The hard-flatten cooldown is **not** what has been suppressing recent recoveries. In the causal recent-30-day replay, immediate reentry, fixed 8h/12h cooldowns, no-new-low confirmation, and VWAP-reclaim confirmation all produced the same result as baseline because the hostile trend gate remained the controlling blocker. As of the data cutoff, the post-flatten bounce had also not reached the normal 1.4% first-rung TP distance.
- **No live change is justified.** Stricter trend locks avoid the recent losses mainly by refusing to trade after July 20, but lose money over the one-year window. Fixed TP cooldowns are decisively worse. A tiny EMA50 slope margin is the only research candidate with positive full-window results, but it does not save the latest flatten and is not strong enough to promote from this search.

## Scope and method

Data cutoff: approximately `2026-08-11T18:22:00Z`.

The review used:

- the pulled PM2 and trade logs;
- `bot-state.json` and current runtime health snapshots;
- the canonical freerun ladder replay from `2025-07-01` through the cutoff;
- causal completed 4H bars only;
- the exact current trend rule: block when the completed 4H close is below EMA200 **and** the EMA50 slope is negative;
- current 12h / -2% hostile-trend hard-flatten behavior;
- the existing RSI-gated TP cooldown unless a test explicitly replaced it.

Replay parity checks passed with zero mismatches for the current trend state and zero mismatches for the existing red-day regime state. No incomplete 4H candle was used to decide a block or rearm.

Research outputs are under `backtests/hype/trendlock-timing-review-2026-08-11/`.

## What actually happened on August 10–11

The live sequence was:

1. The trend gate had remained hostile from August 7 20:00 through August 10 16:00 UTC.
2. At August 10 20:00, the completed 4H close was $55.865, 6.19% below EMA200, but EMA50 slope turned +0.0656%. Under the current conjunction rule, that was a legitimate rearm.
3. That ladder reached 11 rungs and closed at TP on August 11 01:24 for **+$196.43 net**.
4. RSI cooldown logic explicitly allowed immediate reentry. The next ladder opened seconds later and reached 11 rungs by 05:35.
5. The completed 4H bars at 00:00, 04:00, 08:00, and 12:00 all retained slightly positive EMA50 slope, so the trend gate remained clear even though price stayed deeply below EMA200.
6. At 16:00, close $53.880 was 9.33% below EMA200 and EMA50 slope turned -0.0809%. The ladder was 14.6h old and -2.84%, so the hard flatten correctly fired.
7. The exchange fill was $53.7843 against $55.3737 average entry: **-$1,780.09 net**, including $64.79 fees.

Relevant live log evidence:

- `logs/pm2/hedgeguy-bot-out.log:2254020` — first ladder TP trigger;
- `logs/pm2/hedgeguy-bot-out.log:2263644` — hard-flatten defer shadow observation;
- `logs/pm2/hedgeguy-bot-out.log:2263645` — actual hard-flatten decision;
- `logs/pm2/hedgeguy-bot-out.log:2263647` — confirmed batch-close accounting.

After the flatten, local and exchange long quantities were both zero, `pendingOrder` was null, and recovery mode was false. This was not a transaction/reconciliation defect.

## Is the recent pain statistically real?

Yes. It is no longer just one visible bad event.

| Recent live span | Net PnL |
|---|---:|
| July 27 hard flatten | -$1,683.99 |
| August 4–5 full-close wins (7) | +$801.68 |
| August 7 hard flatten | -$2,961.34 |
| August 11 first ladder TP | +$196.43 |
| August 11 hard flatten | -$1,780.09 |
| **Net across these closes** | **-$5,427.31** |

The causal current-stack replay over the most recent 30 days is -$9,457.78 with six hard flattens and 30.8% maximum drawdown. Post-July-20 it is -$6,913.20 with four hard flattens. The regime has therefore been hostile to the ladder, not merely emotionally noisy.

The invisible upside still matters: the current gate allowed the August 4–5 sequence and the first August 11 TP. Any proposed strict lock must be charged for those forfeited cycles, not only credited for avoiding the visible flattens.

## Is hard-flatten cooldown cooking recoveries?

No evidence supports that claim in the recent period.

| Forced-exit reentry policy | One-year delta | Recent 30d delta | Post-Jul-20 delta |
|---|---:|---:|---:|
| Immediate | -$11,575.66 | $0.00 | $0.00 |
| Fixed 8h | -$1,461.56 | $0.00 | $0.00 |
| Fixed 12h | -$5,582.81 | $0.00 | $0.00 |
| No new low for 4h | -$4,994.88 | $0.00 | $0.00 |
| VWAP reclaim | -$13,576.47 | $0.00 | $0.00 |

All five recent paths converge because the trend block, not cooldown expiry, controls reentry. Altering the hard-flatten cooldown would not have opened a recent recovery ladder earlier.

At the cutoff, HYPE had traded from $53.77 to a post-flatten high near $54.29 and ended near $54.14. That is at most about +0.94% from the actual exit, below the normal 1.4% TP distance. There was no completed missed ladder TP yet.

## Does the trend blocker rearm too easily?

Mechanically, yes: while below EMA200, **any** positive EMA50 slope clears the current trend block. On August 11 00:00 the slope was only +0.0064% per completed 4H bar, so a near-flat EMA50 was treated as recovery confirmation.

However, the obvious stricter replacements do not generalize.

| Variant | One-year PnL | Delta | Recent 30d delta | Post-Jul-20 delta | One-year max DD | Verdict |
|---|---:|---:|---:|---:|---:|---|
| Current baseline | $72,345.34 | — | — | — | 20.50% | Reference |
| Disable trend gate | $82,065.90 | +$9,720.55 | -$2,192.30 | -$1,844.57 | 37.94% | Tail risk unacceptable; recent worse |
| Block whenever below EMA200 | $54,645.05 | -$17,700.29 | +$6,913.20 | +$6,913.20 | 22.91% | Fails full window |
| Hostile or >2% below EMA200 | $68,480.03 | -$3,865.32 | +$6,913.20 | +$6,913.20 | 20.50% | Avoids recent loss by making zero post-Jul-20 trades |
| Require +0.01% EMA50 slope | $73,901.93 | +$1,556.59 | +$2,872.40 | +$2,872.40 | 20.50% | Research-only; does not save latest loss |
| Require +0.02% EMA50 slope | $68,671.85 | -$3,673.49 | +$2,582.34 | +$2,582.34 | 20.50% | Fails full window |
| Require +0.05% EMA50 slope | $69,142.05 | -$3,203.29 | +$4,298.92 | +$4,298.92 | 20.50% | Fails full window |
| Require 2 clean 4H bars | $54,738.56 | -$17,606.78 | +$725.53 | — | 24.84% | Fails badly |
| Require 3 clean 4H bars | $46,699.60 | -$25,645.74 | -$288.08 | — | 25.37% | Fails badly |
| Require 4 clean 4H bars | $39,576.53 | -$32,768.81 | +$3,857.97 | — | 27.89% | Fails badly |

The strict 2%-below-EMA rule demonstrates the overfit clearly. Its monthly deltas include +$4,118 in July 2026, but -$6,627 in October 2025 and -$2,041 in November 2025. It protects this decline by abandoning too much proven rebound capture.

The +0.01% slope margin is the only variant that clears a nominal full-window PnL threshold while preserving maximum drawdown. Its monthly deltas range from -$948.50 to +$2,903.09. But it fails the mechanism test for the event under review:

- it delays the second August 11 ladder from 01:26 to 04:00;
- that delayed ladder still hard-flattens at 16:00;
- August is $30.69 worse than baseline;
- most of its aggregate gain comes from changed July path dependence, not repeatedly preventing premature recovery entries.

Because this candidate was found by searching the same history on which it is scored, +$1,556.59 is not enough evidence to change live behavior. It is at most suitable for a pre-registered shadow with the exact live gate inputs.

## Would a TP cooldown have prevented the immediate recycle?

Not robustly.

| TP cooldown after every winning close | One-year delta | Recent 30d delta | Post-Jul-20 delta |
|---|---:|---:|---:|
| 30m | -$18,524.66 | -$265.56 | -$38.41 |
| 60m | -$19,221.76 | -$1,267.75 | -$841.98 |
| 120m | -$32,100.98 | -$317.73 | -$734.94 |
| 240m | -$28,625.77 | +$1,129.67 | +$171.68 |

A 30-minute delay only shifts the simulated losing reentry from 01:26 to 01:55 and slightly worsens the loss. Longer fixed cooldowns radically alter profitable path capture and are highly unstable by month. The current RSI-aware immediate reentry is painful in this instance, but fixed post-TP delays are decisively falsified as a general fix.

## Is the hard-flatten decision itself too early?

The August 11 defer shadow benefited from waiting 30 minutes: the estimated improvement was approximately $183.36. But the live forward shadow now has three resolved observations:

- July 16: -$236.67 versus immediate flatten;
- August 7: -$10.44;
- August 11: +$183.36;
- **net: -$63.74**.

That is still mixed and net negative. Earlier hard-flatten clocks also fail the one-year stability test:

| Hard-flatten age | One-year delta | Recent 30d delta | One-year max DD |
|---|---:|---:|---:|
| Current 12h | — | — | 20.50% |
| 10h | -$3,016.47 | -$339.74 | 23.72% |
| 8h | -$7,436.70 | +$1,404.78 | 31.15% |

Removing the hostile-trend requirement from the 12h flatten is worse: -$37,253.56 over one year, 111 hard flattens versus 39, and -$3,746.90 over the recent 30 days.

## Current live risk posture

At the cutoff the bot is flat, reconciled, and trend-blocked. The last completed 4H close was about $53.88 versus EMA200 about $59.43, with negative EMA50 slope. A renewed close below $52 does not expose the ladder under the present state; the trend gate continues to prevent new long entries until the completed 4H trend condition clears.

The operational concern is therefore not that the bot is currently buying the breakdown. It is that a shallow positive EMA50 inflection can rearm it while price remains deeply below EMA200. The tested strict fixes protect this particular regime at too high a historical opportunity cost.

## Verdict

**KEEP CURRENT LIVE CONFIG.** The last three flatten outcomes are genuinely bad and the current rearm mechanism is permissive, but none of the direct timing changes passes the full evidence bar:

1. positive full-window net PnL;
2. acceptable per-month stability;
3. a mechanism that actually prevents the reviewed failure;
4. causal/no-lookahead evaluation.

The +0.01% EMA50 slope margin passes the first two only narrowly and fails the third on the latest event. It should not be promoted from this search. If more work is authorized, the smallest defensible next step is an exact-input, alert-only shadow for that single margin—not a live gate change and not another broad filter sweep.

No production code or live configuration was changed by this audit.
