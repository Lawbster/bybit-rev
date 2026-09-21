# SF01: unchanged range-low SFP on BTC and SOL

2026-09-20. Research only; no live, ladder, or short changes.

## Conclusion

- **BTC:** the range filter reduces losses, but neither 2R hold is profitable. 24h: 128 closed trades, -$1,044 versus control -$3,888. 72h: 127 closes, -$374 versus -$3,339. Lower drawdown is not a positive edge.
- **SOL:** the range filter makes net worse in both older and recent windows. 24h: 119 closes, -$6,818 versus control -$1,914. 72h: 117 closes, -$7,448 versus -$3,314.
- **0/4 new primary comparisons pass.** Together with HYPE, 0/6 pass. This frozen version has not transferred into a robust standalone strategy; it does not falsify every SFP definition. No tuning or additional filters added after viewing outcomes.

## Same experiment, different assets

[Original method](../docs/research/range-low-sfp-sf01.md) /
[frozen transfer card](../research-inputs/range-low-sfp-sf01-transfer-2026-09-20.json).

**December 27, 2024 to September 15, 2026, 20:20 UTC.** Split June 1, 2026.
4h long-only first sweep/reclaim; generic swing-low control versus known-range
qualification. 2R exits with 24h/72h caps; range-high target diagnostics.
Same stops, risk bounds, fees, signals, source lags and qualification screen as HYPE.
2R is based on signal reference price/stop; actual next-open fills can change realized R.

$10,000 fixed notional, $32,000 starting-equity basis for drawdown,
0.055% taker fee each side, before funding. Same-minute ambiguity bounded by
stop-first/target-first runs. Test 60/120s modeled publication and 0/60s action delay,
plus 5bps/side execution stress. Fixed notional is **not** equal risk across assets.
These are separate one-position paths, not a three-asset portfolio.

Existing BTC/SOL Bybit minute tapes reused; actual hashes checked against manifests.
No gaps/conflicts in loaded slices. History starts December 5, so only the available
22 pre-window days warm up the detector, not a fabricated full 32 days. As with HYPE,
older levels outside the tape cannot be known. Publication times are modeled, not
original historical API receipt times. Assets/history are not untouched holdouts.

## Baseline-adjacent results

Primary clock: 60s publication lag, zero additional delay, standard costs, stop-first.
Winning/losing dollars are closed trades; net also includes open inventory.
Each BTC cell ends with -$52.23 open MTM; each SOL cell -$88.49, neither counted as a loss.

| Asset | Setup | Cap | Wins / losses | Winning $ | Losing $ | Avg loss | Net incl. open | DD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| BTC | Swing control | 24h | 87 / 146 | $13,890 | -$17,726 | -$121 | -$3,888 | 15.64% |
| BTC | Range SFP | 24h | 47 / 81 | $8,574 | -$9,566 | -$118 | -$1,044 | 9.71% |
| BTC | Swing control | 72h | 80 / 143 | $17,219 | -$20,506 | -$143 | -$3,339 | 18.07% |
| BTC | Range SFP | 72h | 48 / 79 | $10,936 | -$11,258 | -$143 | -$374 | 8.75% |
| SOL | Swing control | 24h | 74 / 119 | $18,011 | -$19,836 | -$167 | -$1,914 | 13.80% |
| SOL | Range SFP | 24h | 37 / 82 | $8,319 | -$15,049 | -$184 | -$6,818 | 21.43% |
| SOL | Swing control | 72h | 62 / 123 | $20,778 | -$24,003 | -$195 | -$3,314 | 13.04% |
| SOL | Range SFP | 72h | 35 / 82 | $9,810 | -$17,169 | -$209 | -$7,448 | 23.55% |

HYPE reference, preserved rather than rerun: 24h control +$2,530/DD12.10% versus
range +$2,690/DD7.92%; 72h control +$1,483/DD15.48% versus range +$1,223/DD11.90%.
[Accepted HYPE findings](codex-astra-range-low-sfp-findings-2026-09-20.md).

Ranked by full-window net improvement: BTC72h +$2,965; BTC24h +$2,845;
SOL72h -$4,134; SOL24h -$4,904. None is a profitable primary path.
The range-high diagnostics do not rescue transfer: BTC -$2,733/-$1,759
and SOL -$8,470/-$9,201 at 24h/72h respectively.

## What filtering does and does not establish

BTC generic/range confirmations: 325/176, from 531 pivot attempts; SOL 284/167,
from 514. Range confirmations match their control events exactly before replay.
Risk exclusions, same-minute ties and position occupancy further reduce executed
counts. Every independent cell includes occupancy; fewer signals are not automatically
the same as removing losing trades from the control. Both winners and losses shrink
on BTC; SOL loses substantially more winning dollars than losing dollars.

The full screen retains monthly costs, older/recent comparisons, DD, sample size,
PF, top-five concentration and stressed/delayed returns. Both BTC primaries have
monthly opportunity costs beyond $250 and PF below 1.1; BTC72h also regresses
recent net/DD. SOL loses the primary comparison in both split windows. Full monthly
tables and exact failure lists are in the asset reports below.

## Saved evidence and maps

- [BTC findings, monthly table and verification](codex-astra-range-low-sfp-btc-findings-2026-09-20.md).
  [Range replay map](../backtests/range-low-sfp/8ae227b682b0480a2aed7b473f94b9423d4cf2cdbed2ced9bdb39439d377013c/range_sfp-replay.html).
- [SOL findings, monthly table and verification](codex-astra-range-low-sfp-sol-findings-2026-09-20.md).
  [Range replay map](../backtests/range-low-sfp/61ceb3c456824986d6ab49ac0ce9c2e0871a1ba024af3528ca05a8172d08be04/range_sfp-replay.html).

Each report also links the control map and all-attempt map. HTML uses the existing
chart CDN. Saved hashes verified: 79 artifacts per asset, 176/167 primary confirmed
stage clocks, five historical prefix cuts per asset. Replay accounting audit passed
for all cells. Synthetic SF01 causality/control-subset tests, replay tests and TypeScript
check passed. Thin driver/report parameterized; detector/execution code unchanged.
HYPE accepted artifacts and pointer preserved. No fresh strategy redesign implied.
