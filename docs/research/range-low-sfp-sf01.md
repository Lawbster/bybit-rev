# SF01: range-low swing failure, frozen first pass

2026-09-20. Research only. [Card](../../research-inputs/range-low-sfp-sf01-2026-09-20.json).
Source: the operator's BTC 4h screenshot `longfromtheSFPpftheRangeLow.jpg`.
The screenshot suggests a sweep/reclaim long; its arrows are not evidence of
future returns. All numerical choices below are research conventions.

## Definition and control

- Work on completed 4h bars. Strict pivot lows need two bars on each side;
  publication is after the second right bar closes plus source lag.
- Consider the first 0.1% breach below each published low within 30 days.
  No old level can acquire a second first sweep. If the low already breached
  during the publication/next-4h-bar wait, retire it. Missing or late context
  rejects the attempt; never bridge a gap.
- Reclaim: the sweep bar or a later completed bar closes strictly above the
  low, within 24h after the sweep bar ends. Stop is 0.1% below the lowest low
  through reclaim. Entry is the first minute open at/after reclaim availability,
  plus action delay. There is no fill at the earlier sweep wick.
- **A: swing control** takes all such confirmed reclaims.
- **B: range SFP** selects anchors known before sweep start: low at least 24h old;
  a later, already published pivot high at least 2% above it; choose the highest
  such known high (earliest occurrence breaks equal-price ties); and that high
  has not been exceeded after its own candle and before the sweep. Both range
  anchors are fixed before the sweep; pre-sweep path validation uses only bars
  available by confirmation (including the preceding bar's publication lag).
  Reclaim must close below range high and
  that target must not have traded through during the sweep/reclaim sequence.
  These checks define a range context, not an institutional-liquidity claim.
- A and B share event IDs, stop, confirmation and reference price. Primary
  comparison uses identical 2R targets and 24h/72h holds. Two additional B
  diagnostics target the frozen range high; no global TP/SL sweep.
- One position per independent cell. Same-minute ties use the existing replay
  ordering; occupied, rejected, expired and unconfirmed signals remain counted.

The conditional range information is recorded on A too; B only changes which
events trade. This permits an exact candidate-subset check without cloning
execution logic. This is not RS01: no exhaustion, FVG, MSB or demand retest.

## Data and accounting

HYPE sealed minute history; study window 2024-12-27 through 2026-09-15 20:20 UTC,
split 2026-06-01. Existing source availability is modeled, not original receipt.
Warmup uses only available pre-window history. Compare source lags 60/120s and
action delays 0/60s. Keep stop-first / target-first intraminute bounds.
Fixed $10k notional, $32k equity denominator for DD, 0.055% taker fee each side,
additional 5bps/side stress; no funding, margin, liquidation or maker simulation.
Open inventory is marked at cutoff. Not fixed-risk sizing or portfolio overlay.

## Verification / decision

Reuse `setup-scan-core`, `setup-replay`, `poc-indicator-bias-engine`, its independent
accounting audit, and `setup-chart`. Pin new detector/card/source, verify saved
input/output hashes, test prefix invariance, future poisoning, late bars, gaps,
first-sweep identity, next-open entry, and B-as-subset-of-A.
No canonical ladder parity claim: this is a separate standalone parent.

Before treating a primary B as a lead: at both source lags, net no lower and DD
no higher than its own A in full/older/recent windows; each full-path monthly
delta >= -$250; >=30 trades and >=10 per split; PF >=1.1; net positive after
removing top-five winners; stress and delayed economics positive. A pass is
still in-sample and does not authorize live deployment.

Report baseline-adjacent wins/losses, dollars, average loss, net, DD, months,
counts/rejections/occupancy, source-delay sensitivity, and a source-to-fill trace.
Render 4h/1h charts for all detected attempts before reading economic rankings.
Use immutable artifact keys, not the cross-asset `latest` pointer.

## Explicitly excluded

Volume profile / POC / VWAP confluence (the screenshot's finished profile is not
known at earlier entries), new parameter tuning, other timeframes, H&S fakeout,
short mirrors, live changes. Preserve these as separate questions.

## Frozen BTC/SOL transfer, September 20

The operator requested the same strategy on BTC and SOL after HYPE. The
[transfer card](../../research-inputs/range-low-sfp-sf01-transfer-2026-09-20.json)
pins the original card hash and changes only symbol/input tape. Use the saved
Bybit minute tapes, verify their actual hashes against manifests, and preserve
every parent parameter, window, control, sizing and qualification threshold.
No cross-asset threshold fitting. These histories were used in other research;
they are not untouched holdouts or independent forward samples. Fixed notional
implies different dollar risk per asset. This does not test short positions.

Run `npm run research:sf01 -- --symbol BTCUSDT` (then SOLUSDT). Saved study
paths are in `backtests/range-low-sfp/latest-<SYMBOL>.json`; HYPE's existing
pointer/artifacts stay unchanged. Generate each report with
`npx ts-node scripts/range-low-sfp-report.ts --study <immutable-directory> --out <asset-findings.md>`.
Reuse saved outputs on repeated runs. The execution engine and detector are
unchanged; only the thin driver/report accept multiple symbols.
