# BH01: BTC move and BTC-HYPE return-gap thresholds

Frozen before outcomes on September 14, 2026. Research only; live files untouched.

## Question and prior coverage

The July BTC cross-study described correlations, return quintiles and ladder
landmarks. September RR01/RR02 described relative returns and linear prediction.
L12 tested BTC strength as an exception to near-high ladder add blocks. None is
this standalone threshold-trading experiment. Existing HYPE ROC tests are not
BTC threshold tests.

## Frozen scope

At each UTC 15-minute boundary t, use the latest completed 1m closes:
R(asset,L,t) = 100 * (close[t-1m] / close[t-L-1m] - 1).
Gap = R(HYPE,L,t) - R(BTC,L,t), in percentage points. A positive gap means
HYPE outperformed BTC; it does NOT mean either asset necessarily rose.

- Lookback L: 1h, 4h, 24h.
- Gap thresholds: +/-1, 2, 4 percentage points.
- BTC return thresholds: +/-0.5, 1, 2 percent.
- Cross INTO each extreme, both long and short HYPE; hold 4h, 12h, 24h.
- 216 signal definitions, 18 matched-availability clock controls, two periods
  and two execution delays = 936 economic cases. No parameter search beyond this.
- Older: Jan20,2025-May17,2026 exclusive. Recent: May17-Sep14,2026 15:27 UTC
  exclusive. Periods do not overlap; both have been researched before.
- $10,000 constant notional, $32,000 initial equity, 0.055% per side.
  No funding modeled. Additional 0.05% per side stress on the same fills.

## Causality and occupancy

Require every minute in both assets' L+1 closing-price window. Previous decision
must also be ready and exactly 15 minutes earlier. Do not bridge BTC gaps or
impute returns. The clock control uses this identical readiness mask. A BTC gap
does not interrupt HYPE position management or censor an existing trade.

Threshold crossing is previous signed metric < threshold and current signed
metric >= threshold. A persistent extreme creates no further crossings. Signals
arriving while occupied or pending are counted and discarded, not queued.

Use the existing C01 standalone engine unchanged. Entry at decision minute open
(the next bar after the closed source), plus 0/60s modeled delay. Timeout is
actual entry + hold; exit also delayed 0/60s. No entry-bar high/low/close in the
decision. No TP or stop in this first pass. Historical receipt latency is unknown;
the delay test is not an actual arrival replay.

Net includes marked open inventory and an estimated closing fee. DD includes
minute-adverse prices against prior close-equity peaks; no guessed intraminute
peak ordering. Monthly marked net includes open inventory. Completed W/L dollars
are separate. Each rule owns a separate simulated account, not simultaneous trades.

## Acceptance and reporting

Independent verification reconstructs every crossing from raw candles with an
alternative contiguous-window algorithm, every accepted/occupied signal and fill,
fees, monthly marks and minute-level DD. Controls use the canonical standalone
engine, not sim-exact's unrelated ladder semantics. There are no ladder mutations.

For the complete research screen, all four period/delay cases must have positive
net, strictly positive net delta versus the same clock control, positive stressed
net, no worse adverse DD, at least 30 older/10 recent completed trades, and every
monthly marked delta >= 0. Failure is not a universal rejection of cross-asset
signals. Passing would still not establish live readiness or an incremental
portfolio benefit. Show baseline alongside leaders, W/L dollars, average loss,
monthly comparisons, sample size, sensitivity and winning-trade concentration.

No SOL, HL/SR, beta regression, TP/SL or ladder combinations added. In particular,
raw-gap success cannot establish incremental BTC value beyond HYPE's own momentum
without a subsequent matched HYPE-only comparison.

## Reproduce

```powershell
node -r ts-node/register scripts/btc-hype-threshold-tests.ts
node -r ts-node/register scripts/btc-hype-threshold-study.ts plan
node --max-old-space-size=6144 -r ts-node/register scripts/btc-hype-threshold-study.ts run JOB_KEY
node --max-old-space-size=6144 -r ts-node/register scripts/btc-hype-threshold-verify.ts JOB_KEY
```
