# HYPE S/R Latest-Regime and Live-Execution Audit — 2026-08-04

Evidence cutoff: `2026-08-04T20:06Z`.

## TL;DR

- **KEEP THE LIVE S/R POLICY UNCHANGED.** The current causal `30m / 4x4 pivot / 0.45% cluster / 2-touch / 14d memory / 0.30% action buffer` policy still produces **+$7,529 versus no partials** on the full pulse-data replay through this pull, with max drawdown **18.89% versus 23.47%** and one emergency kill versus two.
- **The latest live levels and transactions pass.** There were **five** live partials from July 27 through August 4 (three on August 4), all with exact requested/filled quantity, one candidate followed by one execution, no pending/failed outcome, and **$492.03** realized partial PnL. The two completed August residual ladders subsequently reached TP; the third was still synchronized and open at the cutoff.
- **No history/look-ahead bias was found.** The August `$55.59357143` zone was independently reconstructed exactly from data available before each action: seven confirmed pivots, six highs and one low. One low-severity telemetry nuance remains: `confirmIso` is the first component-pivot confirmation, while the two-touch zone became actionable later.

This does not prove the current geometry is a global mathematical optimum. It does show that it remains the strongest **deployment-grade** choice. A retrospective `5x5` pivot variant ranks higher over the full sample, but loses to baseline on an isolated post-July-13 replay and has no forward/live validation. It is research/shadow material, not a live replacement.

## Scope

The audit answers four separate questions:

1. Did the latest live partials execute and reconcile correctly?
2. Did the selected resistance levels behave plausibly against subsequent price action?
3. Could those levels have used data unavailable at decision time?
4. Does a causal one-factor geometry sweep show that the deployed parameters have become obsolete in the latest regime?

Primary evidence:

- `data/HYPEUSDT_sr_partial_exit_actions.jsonl`
- `data/HYPEUSDT_sr_shadow_signals.jsonl`
- `data/HYPEUSDT_1m.jsonl`
- `data/HYPEUSDT_runtime_health.json`
- `data/HYPEUSDT_status.json`
- `logs/pm2/hedgeguy-bot-out.log`
- `logs/trades_2026-07-27.jsonl`
- `logs/trades_2026-08-04.jsonl`
- `bot-state.json`
- `src/bot/context-manager.ts`
- `src/bot/sr-memory-zones.ts`
- `src/bot/sr-shadow.ts`
- `src/bot/index.ts`
- `scripts/hype-sr-latest-regime-review.ts`

## Aggregate anchor and baseline parity

The existing July 12 validation reported:

- no-partial PnL approximately `$17,920`;
- current S/R partial PnL approximately `$25,803`;
- delta `+$7,883`;
- 86 partials;
- max drawdown improvement from `21.60%` to `16.83%`;
- emergency kills reduced from two to one.

The fresh runner reproduced the canonical cutoff independently:

| Window ending 2026-07-12 00:52 UTC | No partial | Current S/R | Delta |
|---|---:|---:|---:|
| Total PnL | $17,916.45 | $25,799.83 | **+$7,883.39** |
| Partial actions | 0 | 86 | — |
| Max drawdown | 21.60% | 16.83% | **-4.77 pp** |
| Emergency kills | 2 | 1 | -1 |

The independent parameterized zone builder and the existing replay zone builder differed by only `$0.003859` and produced the same 86 actions. This is effectively exact parity and validates the new comparison harness before examining variants.

## Latest live transaction audit

### August 4 events

| Decision time UTC | Depth | Decision / resistance | Closed | Fill | Realized partial PnL | Residual outcome |
|---|---:|---:|---:|---:|---:|---|
| 11:43:34 | 9 | $55.454 / $55.5936 (0.252%) | 6, kept 3; 515.95 HYPE | $55.422693 | **+$144.50** after $31.36 fees | Three-rung TP at 11:52:08, **+$43.66** |
| 15:47:22 | 11 | $55.471 / $55.5936 (0.221%) | 8, kept 3; 991.68 HYPE | $55.454754 | **+$86.66** after $60.41 fees | Rebuilt to seven rungs; TP at 17:45:27, **+$75.03** |
| 19:58:13 | 6 | $55.553 / $55.5936 (0.073%) | 3, kept 3; 148.42 HYPE | $55.546910 | **+$22.51** after $9.05 fees | Still open at cutoff; local/exchange 60.06 HYPE and TP quantity basis 60.06 |

The August partials realized **$253.67**. The two completed residuals added **$118.68**. These are observed amounts, not the incremental counterfactual benefit versus no partial.

Transaction invariants:

- all three candidates have exactly one matching `executed` row;
- requested quantity equals filled quantity at instrument precision;
- actual fill price, rather than the quote or resistance price, owns PnL accounting;
- fill slippage fully explains the difference between estimated and realized net PnL;
- each action has a durable receipt and unique `orderLinkId`;
- no recent `pending` or `failed` S/R action exists;
- post-action TP quantity was resynchronized;
- at the cutoff, `pending=false`, recovery was off, context was `4032/4032`, and reconciliation reported exact local/exchange equality.

### July 27 events

| Decision time UTC | Level | Realized partial PnL | Subsequent clean price action |
|---|---:|---:|---|
| 10:52:13 | $60.5276, action 0.298% below | **+$171.77** | Price never reached the level; fell 0.87% in 1h and 4.68% in 4h |
| 13:41:03 | $60.0397, action 0.193% below | **+$66.59** | Next high stopped 0.084% below the level; price fell 4.01% in 1h and 4.53% in 4h |

These two events are strong examples of the intended behavior: bank profitable rungs slightly before a causal resistance zone while pulse deteriorates. The ladder later rebuilt and hard-flattened; the visible later loss does not reveal the no-partial counterfactual.

All five July 27–August 4 partials realized **$492.03**.

## Price action versus the August resistance zone

The three August actions reused the same mature memory zone at `$55.59357143`.

| Action | Next 15m high vs zone | Next 60m path | First two-close acceptance above zone | Read |
|---|---:|---|---|---|
| 11:43 | $55.536, **0.104% below** | Residual TP at 11:52; price accepted above at 12:07 | 12:07 | Zone initially capped the TP path; action was early enough to bank and TP the residual before breakout |
| 15:47 | $55.583, **0.019% below** | Rejected to $55.213, **-0.465%** from action; broke later | 17:35 | Very accurate resistance; it capped price for about 1h47 before the later TP breakout |
| 19:58 | $55.681, **0.157% above** | Only seven minutes of post-event data | 20:01 | Immediate acceptance; too little future data to grade the final outcome |

The level is behaving as a **zone**, not an impenetrable price. Two of three August approaches showed an initial cap; one broke immediately. The policy does not require a perfect reversal: it banks profitable rungs inside a 0.30% approach buffer and lets the residual ladder participate in a breakout.

## Exact causal reconstruction

The August level reconstructed exactly from one-minute data truncated at each decision:

| Pivot bar UTC | Confirmation UTC | Price | Side |
|---|---|---:|---|
| Jul 28 01:00 | Jul 28 03:30 | $55.578 | support |
| Jul 28 22:00 | Jul 29 00:30 | $55.744 | resistance |
| Jul 29 06:30 | Jul 29 09:00 | $55.591 | resistance |
| Jul 29 14:00 | Jul 29 16:30 | $55.534 | resistance |
| Jul 29 18:30 | Jul 29 21:00 | $55.531 | resistance |
| Jul 31 06:00 | Jul 31 08:30 | $55.664 | resistance |
| Jul 31 13:00 | Jul 31 15:30 | $55.513 | resistance |

Mean: **$55.59357143**, exactly matching live telemetry.

No-look-ahead properties:

- pivots require four completed right-side 30m bars;
- `confirmTs` is the end of the fourth right-side bar;
- a pivot is unavailable while `confirmTs > decision time`;
- the 14-day window is based on confirmation time;
- the live action additionally requires exact continuous 5m coverage through the latest closed bar;
- forming 5m OHLC values are upserted and later finalized, while a forming 30m bar cannot confirm a pivot until its end;
- the action price itself is the current WebSocket ticker, which is contemporaneous live evidence rather than a future candle close.

Relevant implementation surfaces:

- `src/bot/context-manager.ts:89` refresh and upsert;
- `src/bot/context-manager.ts:119` closed-bar coverage;
- `src/bot/context-manager.ts:235` timestamp replacement for forming/final candles;
- `src/bot/sr-memory-zones.ts:110` pivot/right-side confirmation;
- `src/bot/sr-memory-zones.ts:132` causal clustering;
- `src/bot/sr-memory-zones.ts:176` decision-time confirmed-touch filtering;
- `src/bot/index.ts:1358` context refresh;
- `src/bot/index.ts:1383` 30m-boundary zone rebuild;
- `src/bot/index.ts:1779` live partial action path.

### Low-severity telemetry nuance

`resistance.confirmIso` reports the earliest component pivot (`2026-07-28T03:30Z`). Because `minTouches=2`, the zone was not actionable until the second component confirmed at `2026-07-29T00:30Z`.

This does **not** create look-ahead or affect execution: `confirmedTouches()` enforces the two-touch minimum at the decision timestamp, and every August action occurred several days later. It only means `confirmIso` should be read as “earliest component confirmation,” not “first eligible zone time.”

## Causal parameter sweep

All variants changed one level-construction/action dimension and used only pivots confirmed at or before each replay minute. Ladder behavior, exits, pulse gate, fees, and all non-S/R config remained unchanged.

### Full pulse-data window through August 4

| Rank | Variant | Delta vs no partial | Partials | Max DD | EK | Assessment |
|---:|---|---:|---:|---:|---:|---|
| 1 | 30m, **5x5 pivot** | +$9,084 | 68 | 18.45% | 1 | Retrospective candidate; not forward validated |
| 2 | 30m, 21d memory | +$7,699 | 110 | 18.60% | 1 | Only +$170 over current; inside practical path/noise concern |
| 3 | **Current 30m / 4x4 / 14d / 0.30%** | **+$7,529** | 94 | **18.89%** | **1** | Strongest deployment-grade choice |
| 4 | Minimum 3 touches | +$5,887 | 55 | 19.81% | 1 | Positive but materially weaker |
| 5 | 60m levels | +$5,773 | 42 | 19.54% | 1 | Positive but materially weaker |
| 6 | 0.60% cluster | +$5,534 | 81 | 19.19% | 2 | Weaker and loses EK improvement |
| 7 | 0.40% action buffer | +$5,311 | 101 | 19.71% | 1 | Acting earlier is worse; August delta negative |
| 8 | 0.20% action buffer | +$5,217 | 76 | 19.64% | 2 | Tighter trigger gives up substantial full-window edge |
| 9 | 0.30% cluster | +$4,776 | 70 | 19.30% | 1 | Weaker |
| 10 | 3x3 pivot | +$3,051 | 99 | 19.64% | 1 | Too reactive over full window |
| 11 | 0.25% action buffer | +$1,612 | 79 | 24.92% | 2 | Unstable path interaction |
| 12 | Resistance pivots only | +$1,160 | 52 | 23.61% | 2 | Mixed high/low memory zones are materially better |
| 13 | 7d memory | -$61 | 55 | 23.49% | 2 | Falsified over full window |
| 14 | 15m levels | -$5,256 | 98 | 33.73% | 2 | Strongly falsified |

Baseline no-partial result: `$12,176.73`, max drawdown `23.47%`, two emergency kills. Current result: `$19,705.66`, max drawdown `18.89%`, one emergency kill.

### Monthly delta versus no partial

| Variant | May | June | July | August* | Total |
|---|---:|---:|---:|---:|---:|
| 5x5 pivot | -$286 | +$5,240 | +$4,074 | +$57 | +$9,084 |
| 21d memory | -$908 | +$5,826 | +$2,724 | +$57 | +$7,699 |
| **Current** | **-$908** | **+$5,137** | **+$3,243** | **+$57** | **+$7,529** |
| 3-touch | -$167 | +$3,342 | +$2,655 | +$57 | +$5,887 |
| 60m | -$624 | +$4,682 | +$1,592 | +$123 | +$5,773 |

`*` August contains only data through August 4 20:06 UTC and is not a completed month.

The current policy remains positive and within the project's monthly stability bar. It is not dependent on the latest few actions.

## Latest regime check

At the cutoff:

- HYPE was about **9.0% below its 14-day high** and **8.9% above its 14-day low**;
- runtime readiness placed the completed 4h close at `$55.571` versus 4h EMA200 `$60.153`;
- price was still below EMA200, but the live compound trend gate was clear because the gate requires both below-EMA200 and a falling EMA50;
- trailing returns were approximately `+0.5%` over 1h, `+0.6%` over 4h, `+2.3%` over 24h, `+0.5%` over 7d, and `-7.2%` over 14d.

This is a short-term recovery inside a still-damaged medium-term structure, exactly the kind of regime where resistance banking can help but breakouts remain possible.

An isolated flat-start replay from July 13 through August 4 produced:

| Variant | Delta vs no partial | Max DD |
|---|---:|---:|
| 7d memory | +$846 | 22.15% |
| 60m levels | +$500 | 23.29% |
| 0.20% action buffer | +$172 | 24.33% |
| **Current** | **+$93** | **24.35%** |
| 5x5 pivot | -$30 | 24.74% |

This subwindow has only 7 current-policy actions and is path-dependent. It is useful as a regime diagnostic, not as a replacement calibration. In particular, the 7-day memory looks best only in this short red slice while being slightly negative over the full pulse window. That is exactly why changing live geometry from recent behavior alone would be overfitting.

Extending the original continuous replay from July 12 through August 4 reduced the current policy's aggregate advantage from `+$7,883` to `+$7,529`. The recent regime therefore has not added to the historical edge, but the deterioration is small relative to the existing advantage and does not establish a regime failure.

## What looks good

- Exact baseline/candidate parity at the prior canonical cutoff.
- Exact independent reconstruction of the live August resistance and touch count.
- Every pivot used by the live zone was confirmed days before the actions.
- Continuous 14-day context coverage was healthy for every recent event.
- Live trigger values matched config: depth, ladder PnL, plan net profit, resistance distance, pulse deterioration, keep-three plan, and cooldown.
- Fill-based accounting and durable receipts worked on all recent actions.
- The selected resistance zones produced plausible, often strong, subsequent reactions.
- The 30m/14d geometry survives a broad one-factor causal sweep; several more reactive or shorter-memory definitions are decisively worse.
- The current action buffer beats both tighter and wider nearby alternatives over the aggregate window.

## Findings

### Critical / high

None.

### Medium

None requiring a live patch or config change.

### Low

**L1 — `confirmIso` is earliest component confirmation, not zone-eligibility time.**

- Reproduction: the August zone reports July 28 03:30 UTC, but the second required touch confirmed July 29 00:30 UTC.
- Impact: audit/observability wording can overstate zone age. Execution remains causal and correct.
- Recommendation: no immediate patch. If this telemetry is changed later, add a separate `eligibleAt` while preserving the component `confirmTs`.

## Verdict

**Operational execution: PASS.**

**No-look-ahead/history-bias audit: PASS.**

**Strategy calibration: KEEP CURRENT LIVE SETTINGS.**

The current levels are not perfect ceilings, nor should they be. They are mature causal memory zones used as a profit-banking region with a deteriorating-pulse gate. Recent live price action and the extended causal replay support that design.

Do not alter live S/R settings from this pass. The `5x5` pivot result is the only meaningful research follow-up, but it should first run as a shadow/forward comparison because its apparent advantage comes from the already-observed historical window and it did not improve the isolated latest regime.

## Verification

```text
npx tsc --noEmit --pretty false
npx ts-node scripts/sr-context-safety-tests.ts
npx ts-node scripts/context-manager-tests.ts
npx ts-node scripts/partial-close-transaction-tests.ts
git diff --check
```

All passed.

Replay:

```powershell
npx ts-node scripts/hype-sr-latest-regime-review.ts `
  --start=2026-05-17T20:43:00Z `
  --end=2026-08-04T20:06:00Z
```
