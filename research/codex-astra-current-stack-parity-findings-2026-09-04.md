# Current-stack replay parity and performance attribution

Audit date: 2026-09-04. Copied runtime-health cutoff: **19:02:21.177 UTC**.
Research only: no live code/config/state edits, exchange calls, deployment, or strategy variants.

## TL;DR

- **Exact replay-to-live parity is NOT established.** The published August 20 control reproduces at **$82,912.67 / 1,035 closes**, but its default indicator start leaves **459,159 trading minutes** without RSI/CRSI/slope context. Populating the same window gives **$65,177.46 / 987 closes**. Separately, the S/R research pulse adapter demonstrably reads samples up to the end of the decision's minute before they existed. Neither replay is a certified profit forecast.
- **Recent live long accounting is substantially better than the mixed 60-day picture.** Since stable maker operation resumed August 31: **10 batch closes + 5 S/R partials = +$2,699.85 booked long PnL**, versus **-$1,664.45 from two shorts** before the short pause. These are realized exit-time cohorts, not measured causal uplift from maker TP or the latch.
- **Live execution/accounting evidence: 6 retained filled-maker receipts match 6 batch records; all 20 short closes reconcile exactly to short state.** However, long funding bookkeeping is stuck at zero, open-fill history is not durably journaled by the new path, and maker fee arithmetic uses configured rates rather than an exported actual-fee ledger. Repair research/attribution boundaries before interpreting a new optimization sweep. No live policy change justified by this audit.

## Scope, evidence and current stack

HEAD at inspection: `db4fda1`. There are pre-existing uncommitted research-preservation/documentation changes; this is not a pristine historical checkout.

Configuration inspected: $800 base, 1.35 scale, 11 rungs, 25x leverage; TP 1.4%, stale TP 0.5%; S/R partial exit and support-reopen enabled; damaged-regime latch enabled; maker TP enabled with configured 0.02% maker / 0.055% taker fees. Short execution owner remains enabled but **entryEnabled=false**, flat, no pending, no recovery.

The current copied main state has 11 rungs, **696.31 HYPE**, no pending transaction/recovery, and an active maker TP. Runtime reconciliation reports 696.31 exchange quantity, with only floating-point residual. Latest equity sample: **$26,837.65 at 19:02:02**, price $85.20. Current ladder gross unrealized PnL at that quote is **-$440.15**, before unbooked open-position fees/funding. These are snapshot observations, not a fresh exchange assertion.

Deployment boundaries recovered from PM2 evidence:

| UTC boundary | Interpretation |
|---|---|
| Aug 14 18:40:11 | Damaged latch bootstrap armed at -5.65% versus EMA200 |
| Aug 17 08:00:47 | Latch released after its two completed recovery bars |
| Aug 31 22:32:48 | Maker TP first enabled |
| Aug 31 23:15:03 / 23:15:57 | Tick-normalization fix restarted; operator resumed adds |
| Sep 4 00:24:31 | Short owner restarted flat with entries disabled |

The **exact current combined configuration has only about 18.6 hours of observation**, not 60 days. The maker-stable cohort is 3.82 days and starts with a carry-in ladder. Different prior configurations must not be silently treated as one live trial.

## Live performance attribution

All dollar PnL below is **already net of the fees booked by each close path**. Do not subtract the fee column again. Funding/cash flows are not fully reconciled to exchange settlements.

| Exit-time cohort | Batch closes / PnL | S/R partials / PnL | Combined long journal | Short closes / PnL |
|---|---:|---:|---:|---:|
| Last 60 days, Jul 6 19:02 onward; mixed configurations | 87 / -$6,330.35 | 26 / +$2,341.26 | **-$3,989.09** | 20 / **-$3,891.07** |
| Latch deployment onward | 56 / +$9,287.24 | 9 / +$823.76 | **+$10,111.00** | 9 / **-$3,770.05** |
| Stable maker operation onward | 10 / +$2,146.25 | 5 / +$553.61 | **+$2,699.85** | 2 / **-$1,664.45** |
| Current short-paused stack | 2 / +$329.49 | 1 / +$89.50 | **+$418.99** | 0 / $0 |

There are also **two historical realized-state increases totaling approximately $36.09** with no matching batch/partial journal rows: Aug 19 21:22 (+$25.69) and 21:31 (+$10.40). They coincide with the already-known delayed-native-close/notification incidents. These explain the aggregate long ledger residual; they are not silently added as fabricated trades or classified from price tolerance. The old close receipts are no longer retained. Consequently the first two long-journal rows are not exhaustive realized-state totals.

Between available equity samples, maker-era realized-state change agrees with batch + partial PnL within **$0.002**. The short-paused cohort also agrees within **$0.002**. Earlier sample windows leave the $36.09 historical journal discrepancy above.

| Calendar slice within the 60-day window | Batch PnL | S/R partial PnL | Short PnL |
|---|---:|---:|---:|
| Jul 6 cutoff through Jul 31 | -$10,508.88 | +$839.40 | +$371.19 |
| Aug 1-31 | +$2,032.29 | +$948.25 | -$2,597.81 |
| Sep 1-4 cutoff | +$2,146.25 | +$553.61 | -$1,664.45 |

The 87 batch records comprise **78 positive closes totaling +$12,457.55 and 9 negative closes totaling -$18,787.90**. That is the visible tail-versus-cycle trade-off, not a fees-only explanation. Historical close reasons are absent on 30 rows, so this audit does not relabel all losses as hard flattens. Since the latch deployment there are no *recorded, classified* hard-flatten exits; that does not measure how many the latch prevented.

Equity moved from the first 60-day sample's $35,017.34 to $26,837.65 (**-$8,179.69**). Maker-era sampled equity rose **$572.35**, not $2,699.85: shorts, changing unrealized inventory, fees/funding timing and any cash flows also affect account equity. The current paused-short cohort booked +$418.99 while sampled equity moved -$48.35; the open ladder is still marked down. A realized-close ledger is not a mark-to-market portfolio return.

## Findings, prioritized

### H1 — Research pulse lookups use future-in-the-minute samples

Location: `scripts/hype-dormant-edge-replay.ts:36` (`minuteLast`), `:150` (`now=c.endTs`), `:206` onward (OI/order-book lookup).

The adapter floors raw sample timestamps to minute starts, retains the last sample per bucket, and permits the bucket whose key equals decision time. Thus a decision at minute boundary T can consume a raw sample from T+46 seconds. This is actual source-time look-ahead, not merely an unknown network-latency assumption.

Reproduction from copied data at **2026-09-04 07:40:00 UTC**:

| Field | Last genuinely available source | Old minute lookup source |
|---|---|---|
| HL book imbalance 0.5% | 07:39:46.840, **-0.1245650** | **07:40:46.843**, -0.1316442 |
| HL asset OI value | 07:39:48.936, **2,055,317,504.15** | **07:40:49.852**, 2,059,648,723.75 |

All 86,400 retained order-book minute buckets and 86,391 asset-context buckets in the inspected 60-day slice have last-sample timestamps later than their minute-start keys. This does **not** mean 86,400 trades changed; the threshold/action impact is not measured here. OI feeds the partial-exit deterioration test; book/OI feed support-reopen confirmation.

Impact: historical S/R action comparisons using this adapter do not pass the no-look-ahead requirement. This finding is about the **research adapter**, not a claim that live code can see future samples. Funding/taker window conventions and arrival-time handling also need their own audit; shifting every stream by an arbitrary minute is not automatically correct.

Parity requirement: raw source/availability timestamps must survive alignment; only eligible observations may enter each decision. Test append-future-data invariance and trace executed candidates. Profit impact remains unmeasured; do not use either headline below as a corrected causal return.

### H2 — Published long-window control silently lacks two configured filters

Locations: `scripts/hype-freerun-canonical-replay.ts:293` (default `START_TS`), `:649` (null context arrays), `:678` (skip before feature start), `:1615` (RSI TP cooldown), `:2012` (overextended entry), `:2206` (feature start calculation); `scripts/hype-rung11-daily-high-delay-audit.ts:325` builds once, then separately starts one-year trades.

The caller trades from July 1, 2025 while default feature computation begins only around May 15, 2026. Null RSI disables the RSI-dependent TP cooldown; null slope/CRSI/RSI prevents the overextended-entry block from firing. The 4H EMA trend gate is a separate series and is **not** missing for that entire interval.

Same policy, data and trading window, July 1, 2025 through Aug 19, 2026 21:32 UTC:

| Diagnostic | Published/default feature start | Full-window feature start |
|---|---:|---:|
| Feature `SIM_START` | May 17, 2026 | July 1, 2025 |
| Missing-context trading minutes | 459,159 | 0 |
| Net simulated PnL | $82,912.67 | $65,177.46 |
| Full closes | 1,035 | 987 |
| TP + stale-TP cycles | 974 | 925 |
| Hard flattens / emergency kills | 36 / 3 | 37 / 3 |
| Max DD, $32k simulated initial equity | 22.10% | 25.57% |

**Difference: -$17,735.21**, from changing feature coverage, not strategy thresholds. Both runs still share H1 and other execution assumptions. This is not an estimate of money lost live or a new deployable strategy result.

Causal trace: both runs close episode 6 at **July 2, 2025 16:12 UTC**. With complete context, then-observable RSI is **63.62**, arming the 30-minute cooldown; re-entry occurs at 16:42. Default context has RSI=null, no RSI cooldown, and re-enters at 16:34 once its remaining time-add constraint clears. Source minute is 16:11-16:12; the populated RSI uses the forming-hour value known by that decision, not the eventual 17:00 close.

Monthly diagnostic, populated minus default context; NOT a variant ranking:

| Month | Default PnL | Populated PnL | Delta |
|---|---:|---:|---:|
| 2025-07 | $1,691.09 | $330.17 | -$1,360.92 |
| 2025-08 | $6,146.89 | $2,062.95 | -$4,083.94 |
| 2025-09 | $7,011.15 | $4,458.48 | -$2,552.67 |
| 2025-10 | $12,737.01 | $9,608.59 | -$3,128.41 |
| 2025-11 | $593.53 | $2,817.00 | +$2,223.47 |
| 2025-12 | $1,510.37 | -$137.64 | -$1,648.01 |
| 2026-01 | $9,346.13 | $7,040.13 | -$2,305.99 |
| 2026-02 | $738.46 | -$157.52 | -$895.98 |
| 2026-03 | $8,217.28 | $8,532.47 | +$315.18 |
| 2026-04 | $6,149.21 | $5,359.99 | -$789.22 |
| 2026-05 | $21,979.29 | $18,470.57 | -$3,508.72 |
| 2026-06 | $9,806.24 | $9,806.24 | $0 |
| 2026-07 | -$4,185.62 | -$4,185.62 | $0 |
| 2026-08 through cutoff | $1,171.63 | $1,171.63 | $0 |

This isolates why the old headline cannot certify the full configured stack. It does **not** establish that recent HL-era comparisons have the same start-date defect: their feature window already covers their trading window, and Jun-Aug results in this particular diagnostic coincide. H1 remains independently applicable.

### H3 — Current live episodes cannot be reconstructed from the old open journal

Locations: `scripts/hype-freerun-canonical-replay.ts:1000` (`loadLiveEpisodes`), `:1033` (requires `OPEN_LONG`); `src/bot/index.ts:3603` logs a decision before `executeLongOpenTransaction`; legacy `src/bot/executor.ts:1285` still logs `OPEN_LONG` but the active detailed path does not.

Latest successful HYPE `OPEN_LONG` journal row is **July 11 23:35:30.182 UTC**. Current closes continue being recorded. The old episode loader skips closes when it has no logged opens. Running its parity mode is therefore not evidence of current episode parity.

The copied state retains only **64 recent long-open receipts** and **64 maker receipts**, most maker receipts being cancelled-zero-fill replacements rather than trades. All 64 retained long opens match their decision-time records in this audit, but 128 maker-era decision attempts exist and attempts are not fills. `completedAt` on these open receipts is the caller's decision time, not authoritative exchange `execTime`. The decision label still says `5.12-phase-A` (`src/bot/shadow-logger.ts:285`); it is not a reliable current config fingerprint.

Impact: exact longer-horizon opening quantities, fills, fees, timing and episode paths are not recoverable from the current journal alone. The two Aug 19 missing close rows are an additional historical notification/journal gap, not a failure to include those profits in local realized state.

Parity requirement: durable order/execution-identified open/partial/full-close records and config provenance, including delayed/startup imports, without treating attempted opens as successful trades. Do not overwrite state or synthesize fills from quoted decision prices to make an episode loader agree.

### M1 — Long funding accounting never initializes its settlement cursor

Locations: `src/bot/index.ts:2140`, `src/bot/state.ts:158`, `src/bot/state.ts:1154`.

Current state has `lastFundingSettlement=0`, `totalFunding=0`. With zero cursor, the loop sets `lastBucket=currentBucket`; `currentBucket > lastBucket` is false. The only writer of a nonzero cursor is inside the deduction path that this condition prevents. It remains false across subsequent buckets, not just the first startup cycle.

Impact: local realized PnL/funding totals cannot be treated as exchange-net performance. Exchange wallet/equity can still include real funding charges; this is not a claim that the account pays no funding, nor an explanation for the whole drawdown. The replay explicitly omits long funding too. Exact missing amount requires exchange settlement records; this audit does not guess it or back-charge synthetic funding into state. A fix must avoid double-counting against wallet refreshes and preserve actual zero/negative rates.

### M2 — Maker fees reconcile as configured arithmetic, not actual fee verification

Location: `src/bot/state.ts:533` computes entry notional x entry fee rate plus exit notional x maker fee rate.

Six retained filled-maker receipts have execution IDs and unique multi-field batch matches. Their PnL and fee identities agree to floating-point precision (fee residual below $1e-12). Across these six, same-fill modeled taker-to-maker saving is **$76.47**.

That is **not** proof of exact fees billed, total maker-period savings, queue fill probability or net counterfactual improvement. There are ten maker-era batch closes, but only six corresponding filled-maker receipts remain in the bounded ring. Sep 1 03:37 is still `EXTERNAL_CLOSE_UNCLASSIFIED`; do not classify it as pure maker from approximate fees/price. Shadow estimates are not live exchange settlement evidence.

### M3 — Current maker/state timing is not modeled by the minute engine

Locations: `src/bot/state.ts:555` and `:850` reset/reanchor `lastAddTime` after transactional reductions; legacy `closeAllPositions` at `:275` leaves it unchanged. The canonical engine deliberately preserves `lastAddTs` after full closes. This is a code-level current-stack mismatch; its PnL contribution has not been isolated.

Other explicit gaps: maker posting/tick rounding, cancellations/replacement, partial fills, two-second touch grace, native-race and residual-market execution; 10-second live adds versus minute decisions; price-drop adds use the minute low and simulated `min(close, trigger)` price (`scripts/hype-freerun-canonical-replay.ts:2047`, `:2139`); manual pauses/recovery delays; shared account funding/cash flows. A candle range alone cannot prove the ordering or executability of those fills.

A non-certified unchanged-policy comparator, flat at Aug 14 deployment, produced **$14,589.76 realized, 64 batch closes and 15 trims**, versus the live journal's $10,111.00 / 56 / 9. Its net including open PnL is $14,558.45. **Do not interpret the $4,478.76 realized gap as missed attainable profit.** H1, timing and seed/execution differences preclude attributing that gap to any specific gate or operational issue.

The assembled 919,075-minute price series has **11 individual missing minutes**, including Aug 4 00:20 and Aug 28 05:49. Latest available minute ends at **19:01 UTC**, although the requested cutoff is 19:02. All 95 post-Aug-19 4H close windows inspected have their actual closing-minute values; lowest EMA200 distance is +18.28%, so extending the archived inactive latch introduces no new trigger in that diagnostic. Interior minute gaps still prevent full OHLC coverage certification. Main runtime's healthy 14-day **5m** coverage is a different dataset/check.

## What looks good / invisible upside boundary

- Stable maker-period realized totals reconcile to the close/partial journal; the $36.09 historical omission does not recur there.
- Current long quantity is synced; maker intent active; no current pending/recovery. Short entries are paused and short inventory is flat.
- Six retained filled maker receipts match their reported batch economics. Twenty short closes account for all short-state realized PnL and fees.
- S/R partials booked positive PnL in the inspected cohorts. Latest Sep 4 partial closed 468.63 HYPE at 86.35977637, +$89.50 net booked, leaving three rungs, with healthy 14-day context in its event.
- The broad live rebound after Aug 14 and recurring positive cycles must be included alongside the earlier losses. But neither booked partial profits nor an absence of flattens measures incremental benefit: extra cycles, avoided cascades and counterfactual residual inventory require a causal common baseline. This audit does **not** pretend to have enumerated those counterfactual wins.

## Sign-off and remaining work

**First-pass audit complete; exact current-stack parity remains unsigned.** No new strategy variants were tested, so variant ranking / top-five deployment gate / falsification-ledger additions are not applicable. The reproduced control is the published free-running engine, not an independent `sim-exact.ts` equivalence certification.

Before an optimization result can be relied on: repair and regression-test feature-start coverage and raw-timestamp alignment; certify the baseline again; preserve enough live execution/fee/funding/config evidence to attribute discrepancies; then separately test maker-aware execution/state timing. No source repair, account mutation, live config change or deployment was performed here. The present findings do not by themselves justify unpausing shorts, disabling S/R, or retuning the long gates.

## Reproduction / artifacts

New research entry points:

- `scripts/hype-current-stack-attribution.ts`: strict JSON parsing, input SHA-256/unchanged-during-read checks, period/month totals, receipt joins, residual intervals and raw pulse timestamp probes.
- `scripts/hype-current-stack-parity-replay.ts`: unchanged canonical engine; explicit feature-start diagnostic, published control check, coverage/causal trace and optional non-certified recent comparator.
- `scripts/current-stack-attribution-tests.ts`: timestamp, duplicate/conflict, unique close-match, ambiguous-match rejection and fee/PnL arithmetic tests.

Final local outputs under `backtests/hype/current-stack-parity-2026-09-04/`:

- `audit-ledger/`: `summary.json`, input `manifest.json`, individual close/partial/open/maker matches, operational timeline, `equity-realized-residuals.json`.
- `final-default-context/`: reproduced control, monthly totals, decision trace, recent diagnostic, candle/latch coverage.
- `final-full-context/`: populated-context control and monthly totals, trace, coverage and failed published-control check.
- Earlier `replay*`, `ledger*` directories are development attempts, not the final report artifacts.

PowerShell, local only; output directories must be new (the scripts refuse overwrite):

```powershell
npx.cmd ts-node scripts/current-stack-attribution-tests.ts
$env:ATTRIBUTION_OUT = 'backtests/hype/current-stack-parity-rerun/ledger'
npx.cmd ts-node scripts/hype-current-stack-attribution.ts

$env:PARITY_CONTEXT_START = '2026-05-17T20:43:00Z'
$env:PARITY_OUT = 'backtests/hype/current-stack-parity-rerun/default-context'
npx.cmd ts-node scripts/hype-current-stack-parity-replay.ts

$env:PARITY_CONTEXT_START = '2025-07-01T00:00:00Z'
$env:PARITY_OUT = 'backtests/hype/current-stack-parity-rerun/full-context'
npx.cmd ts-node scripts/hype-current-stack-parity-replay.ts
Remove-Item Env:ATTRIBUTION_OUT, Env:PARITY_CONTEXT_START, Env:PARITY_OUT
```

Raw market/state/log inputs remain local/ignored. Ledger manifests hash the inspected inputs; replay manifests pin source/config/archived interval/control files, **not a historical immutable raw-market snapshot**. Continued data syncs can change a later reproduction. Preserve the local input snapshot if exact future reproduction is required. TypeScript tests, both production no-emit builds and `git diff --check` passed; those checks do not certify trading profitability or causal parity.
