# HYPE current-regime ladder-pause findings — 2026-08-14

## TL;DR

- The recent damage is real, not a fee illusion or one bad flatten. From `2026-06-15 17:14 UTC` through `2026-08-14 17:14 UTC`, the pulled live long ledger contains 101 batch closes. Thirteen large 11-rung losses total **-$31,679.64**; the other batch closes make **+$18,776.19** and 17 executed S/R partials add **+$1,517.50**, for about **-$11,385.95** net long realized PnL. Account equity is **$21,018.48** versus the recorded **$36,495.97** peak, a **-$15,477.49 / -42.4%** peak drawdown across the account.
- The canonical current-stack replay reproduces the shape closely: **100 closes, 88 TP/stale cycles, 12 hard flattens, -$8,015.65** over the same 60-day window. Hard-flatten cadence has roughly doubled from the one-year average: 12 in 60 days (one every 5.0 days) versus 41 in the one-year replay (roughly one every 10 days). This is a current-regime failure of repeatedly loading the long tail, not merely visible bad luck.
- Changing support-reopen confirmation from the current 15m/1h **OR** to **AND** does not solve it. With exact causal OI/book timestamps, AND is **+$1,192.13** over 60 days but **-$357.36** over the full HL window and leaves hard flattens unchanged at 12/13. The strongest stable result is a persistent **damaged-regime ladder pause**: trigger at a completed 4h close at least 4% below EMA200 plus HL taker sell pressure; block both new entries and adds until structural recovery. It improves both the 60-day and one-year replays by **+$7,799.16**, cuts 60-day hard flattens **12 -> 7**, and has no negative monthly delta.

## Verdict

**PAUSE THE LIVE LONG LADDER, THEN PATCH THE REGIME LATCH.**

The current bot is flat and its existing trend gate is blocked, so the immediate safe state already matches the winning counterfactual. Do not rely on the existing trend gate to keep it there: that gate can rearm during a relief bounce while price remains structurally far below the 4h EMA200. The new latch is meant to stop that premature reloading.

This research does **not** support changing the hard-flatten thresholds, S/R zone construction, base size, or support-reopen OR logic as the primary response.

## What the live ledger says

Pulled live data through `2026-08-14 17:16 UTC`:

| Measure, last 60 days | Live ledger |
|---|---:|
| Batch closes | 101 |
| Large loss / apparent hard-flatten closes | 13 |
| Large-loss PnL | -$31,679.64 |
| Other batch-close PnL | +$18,776.19 |
| Executed S/R partial exits | 17 |
| S/R partial realized PnL | +$1,517.50 |
| Combined long realized PnL | **-$11,385.95** |

The latest live close was `2026-08-14 16:00 UTC`, 11 rungs, **-$1,896.70** after the ladder rebuilt following a profitable partial exit. This is the seventh recent live hard flatten discussed in the operational review, but the 60-day ledger shows the broader issue: 13 large losses, not one isolated event.

The account-level fall from the recorded peak is larger than the reconstructed long ledger because account equity also reflects exact open/close timing, other live components, and any balance changes. The important validation is event shape: the replay produces 100 closes and 12 hard flattens versus 101 and 13 in live records.

## Replay method and no-lookahead controls

The audit script is `scripts/hype-current-regime-60d-audit.ts`. Outputs are under `backtests/hype/current-regime-60d-2026-08-14/`:

- `summary.csv`
- `monthly.csv`
- `forced-closes.csv`
- `pause-intervals.csv`

The replay uses the parity-validated canonical engine and the current execution stack:

- $800 base, 1.35 scale, 11 rungs;
- current 12h / -2% hostile hard flatten and 4h forced-exit cooldown;
- current S/R partial exit: depth 6, keep 3, 0.3% resistance buffer, deteriorating pulse;
- current support reopen: next depth 5, 1% support buffer, HL buy-pressure confirmation;
- the same fee assumptions already present in the canonical engine.

Windows end at `2026-08-14 17:14 UTC`. The primary current-regime window starts `2026-06-15 17:14 UTC`; the audit also runs the full HL window, the last 30 days, and the one-year window beginning `2025-07-01`.

No-lookahead checks:

- All structure inputs use only completed 4h bars whose end timestamp is at or before the 1m decision timestamp.
- HL taker rows are closed 1m windows stamped at their window end; 15m and 1h ratios include only windows available by the decision.
- New support variants use raw OI and order-book snapshot timestamps. A later sample in the same minute cannot affect an earlier decision.
- The rebuilt legacy support confirmation matched the attached canonical series with **0 mismatch minutes**, establishing baseline parity before testing exact-timestamp variants.
- Trace example: the durable current pause triggered at `2026-07-16 20:00 UTC` from the just-completed 4h state at **-4.814% below EMA200**, with closed HL taker ratios **15m 0.7164 / 1h 0.4656**. Nothing after that timestamp was used.

## Current-regime results

| Variant | 60d PnL | Delta | TP/stale | Hard flattens | Max DD |
|---|---:|---:|---:|---:|---:|
| Current stack | -$8,015.65 | — | 88 | 12 | 38.05% |
| Exact-snapshot current OR reopen | -$7,495.02 | +$520.62 | 89 | 12 | — |
| Exact-snapshot AND reopen | -$6,823.52 | +$1,192.13 | 93 | 12 | 37.70% |
| Instant deep-structure + HL sell pause | -$3,159.22 | +$4,856.43 | 87 | 11 | 25.40% |
| Persistent 4h/HL damage latch | **-$216.48** | **+$7,799.16** | 73 | **7** | **22.33%** |
| Damage latch + exact AND reopen | +$1,698.64 | +$9,714.28 | 78 | 7 | 21.44% |
| Fixed $500 base | -$5,009.78 | +$3,005.87 | 88 | 12 | 25.39% |

The invisible cost is explicit: the persistent latch gives up 15 profitable TP/stale cycles in the 60-day replay. It also avoids five hard flattens, for a net **+$7,799.16**. Over the last 30 days it would have allowed the already-open July 16 episode to close at **-$1,760.85**, then stayed paused: zero later TP cycles, but five later hard flattens avoided, again net **+$7,799.16**.

The $500-base row is risk reduction, not an edge fix: it still takes all 12 hard flattens. It is not a substitute for stopping invalid regime exposure.

## Aggregate stability

The proposed latch outcome is insensitive to the tested damage threshold from 2% through 4% below EMA200 and to one-, two-, or three-completed-4h recovery confirmation. All variants converge on the same economically relevant pause interval and the same result. The conservative 4% trigger is preferred because it avoids turning ordinary shallow pullbacks into a shutdown condition.

| Window | Current PnL | 4% + HL latch PnL | Delta | Hard flattens current -> latch |
|---|---:|---:|---:|---:|
| Full HL history | $16,665.44 | $24,464.60 | **+$7,799.16** | 13 -> 8 |
| Last 60 days | -$8,015.65 | -$216.48 | **+$7,799.16** | 12 -> 7 |
| Last 30 days | -$9,560.01 | -$1,760.85 | **+$7,799.16** | 6 -> 1 |
| One year | $73,941.88 | $81,741.04 | **+$7,799.16** | 41 -> 36 |

Monthly delta versus current:

| Month | Delta |
|---|---:|
| 2025-07 through 2026-06 | $0.00 in every month |
| 2026-07 | **+$4,118.03** |
| 2026-08 through Aug 14 | **+$3,681.14** |

This passes the project deployment research gate on the available history: positive net delta well above $1k, no month worse, a mechanically explainable effect, and causal inputs.

The combined latch + AND support-reopen row has a larger headline delta, but it is not the recommended patch. Exact AND confirmation alone is **-$357.36** over the full HL period, and the combo makes May **-$1,366.75** worse. The extra combo PnL is path interaction, not a stable standalone support edge.

## Proposed live rule

Recommended candidate: `ladder_lock_deep4_hl_sell_release_2x4h_inside1`.

Trigger the durable pause when both are true:

1. the latest completed 4h close is at least **4% below its 200 EMA**; and
2. closed HL taker flow shows sell pressure: **15m buy/sell <= 0.85 OR 1h buy/sell <= 0.90**.

While active:

- block first long entries;
- block every long add, including time adds, price-drop adds, and S/R support reopens;
- keep reconciliation, TP, partial exits, hard flatten, emergency kill, and position protection fully operational;
- do not affect the independent short owner.

Release after **two consecutive completed 4h closes within 1% below EMA200**. One-, two-, and three-bar release variants have identical historical PnL here; two bars is the middle operational choice. A live implementation must persist the latch across restarts and publish its trigger evidence, age, and release progress.

Data-health behavior should fail closed: if the latch is active, missing HL or 4h data must never clear it. If structure is already at or below -4% and HL inputs are unhealthy, new long entries/adds should remain blocked until the trigger can be resolved.

Startup needs historical reconstruction or an explicit durable bootstrap. At the current data end the candidate pause has been continuously active since `2026-07-16 20:00 UTC`; simply evaluating the latest HL minute on restart could miss that durable intent.

## What happened to the support-reopen OR question

It was tested directly rather than dismissed:

| Support confirmation | Full HL delta | 60d delta | 30d delta | Full-HL hard flattens |
|---|---:|---:|---:|---:|
| Current legacy OR | baseline | baseline | baseline | 13 |
| Exact-snapshot OR | -$478.82 | +$520.62 | +$37.07 | 13 |
| Exact-snapshot AND | -$357.36 | +$1,192.13 | -$722.99 | 13 |

The 15m warning is useful as part of a **persistent structural regime trigger**. It is not sufficient as a minute-by-minute add blocker or as an isolated support-reopen tweak:

- pausing on HL 15m <= 0.85 by itself loses **-$12,892.51** versus current over the full HL window;
- AND support confirmation reduces reopen count but does not reduce hard-flatten count;
- the durable 4h + HL latch is what prevents the bot from reloading during a month-long damaged structure.

## Limitations and confidence

- HL history begins in May 2026, so the trigger has only one prolonged damaged-regime episode. Threshold sensitivity is strong, but this is not multiple independent crypto bear cycles.
- The 60-day window starts flat and is path-dependent. The same **+$7,799.16** delta also appears in the full-HL and one-year runs, which removes dependence on the 60-day start state.
- The exact live ledger and simulator differ in fill timing and rollout timing; use the near-identical close/flatten counts as parity evidence, not a claim that simulated dollars equal exchange dollars.
- The release after a prolonged pause has not occurred yet. Earlier short pause/release intervals are causal and harmless, but the first future structural recovery should be monitored closely.

Confidence is **high that the long ladder should remain paused in the current state**, and **medium-high that the persistent latch is the correct implementation candidate**. The support-reopen OR logic should stay unchanged in the minimal patch.

## Recommended next action

1. Keep the long ladder from reopening while the bot is flat and the current damaged-regime condition remains active.
2. Implement the persistent latch as a focused, tested operational strategy gate with no sizing, exit, S/R-zone, or transaction-coordinator changes.
3. Replay-parity test startup reconstruction, restart persistence, active-position management, unhealthy HL data, and the two-4h-bar release.
4. Deploy only after the runtime health/watchdog surfaces the latch state and the bot reports that entries/adds are blocked while all exit and reconciliation paths remain healthy.
