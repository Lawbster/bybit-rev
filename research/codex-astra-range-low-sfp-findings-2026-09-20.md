# SF01 range-low SFP: HYPE first replay

2026-09-20. Research only; no live changes. One frozen implementation of the operator screenshot, not a verdict on every SFP definition.

## TL;DR

- 524 low-pivot attempts; 321 generic confirmed reclaims and 192 range-qualified reclaims. After risk, ties and occupancy: 24h/2R control 207 closes versus range 122.
- 24h/2R range filter: $2,530 -> $2,690 ($160), DD 12.10% -> 7.92%. The win-rate is 35.2%, not a high-win-rate result.
- 0/2 primary comparisons pass the complete frozen screen. Far-range targets are diagnostics, not qualified alternatives. No threshold changes after results.

## Scope and artifacts

Window **2024-12-27T00:00:00Z to 2026-09-15T20:20:00Z**, split 2026-06-01T00:00:00Z. Fixed $10k notional, $32k DD denominator, taker 0.055% each side, before funding; stress adds 5bps/side. Long only. Closed 4h confirmation, 60s modeled publication lag and next eligible minute open; 120s source-lag and 60s action-delay sensitivities. Existing engine and independent accounting audit unchanged. This is not a ladder replay or live-equity forecast.

[Frozen method](../docs/research/range-low-sfp-sf01.md) / [card](../research-inputs/range-low-sfp-sf01-2026-09-20.json) / [saved comparison](../backtests/range-low-sfp/e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b/comparison.json) / [verification](../backtests/range-low-sfp-reviews/8f659ae699d3dbc4e16bd7b05ed3cfc4bfff1757718a0e63940c8288ba09ea56/verification.json).

[Range replay chart](../backtests/range-low-sfp/e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b/range_sfp-replay.html) / [control replay chart](../backtests/range-low-sfp/e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b/swing_control-replay.html) / [all range attempts](../backtests/range-low-sfp/e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b/range_sfp-scan.html). Charts reuse Fable's renderer, need its CDN chart library, and place zones from availability rather than origin candles. Inspect event timestamps and rejected attempts, not just winners.

## Full-window results (primary clock)

Wins/losses and their dollars are closed trades. Net includes marked open inventory; every listed cell ends with an open position worth about $15 net, which is not counted as a win. Fixed notional is not fixed risk.

| Setup | Target / cap | Wins / losses | Winning $ | Losing $ | Avg loss | Net incl. open | DD |
|---|---|---:|---:|---:|---:|---:|---:|
| swing_control | 2R / 24h | 72 / 135 | $28,909 | -$26,393 | -$196 | $2,530 | 12.10% |
| range_sfp | 2R / 24h | 43 / 79 | $18,124 | -$15,449 | -$196 | $2,690 | 7.92% |
| range_sfp | range high (diagnostic) / 24h | 31 / 90 | $17,119 | -$16,835 | -$187 | $299 | 16.53% |
| swing_control | 2R / 72h | 68 / 138 | $31,678 | -$30,210 | -$219 | $1,483 | 15.48% |
| range_sfp | 2R / 72h | 41 / 81 | $18,912 | -$17,704 | -$219 | $1,223 | 11.90% |
| range_sfp | range high (diagnostic) / 72h | 24 / 95 | $17,786 | -$20,121 | -$212 | -$2,320 | 21.32% |

## Older / recent comparisons

| Window | Cap | Control net / DD | Range net / DD | Net delta |
|---|---|---:|---:|---:|
| older | 24h | $1,174 / 12.10% | $1,293 / 7.92% | $118 |
| older | 72h | -$870 / 14.69% | -$467 / 11.90% | $403 |
| recent | 24h | $1,356 / 2.60% | $1,397 / 2.47% | $41 |
| recent | 72h | $2,354 / 2.93% | $1,690 / 2.99% | -$664 |

## Monthly marked net (full continuous paths)

Boundary months are partial. Exact monthly W/L dollars remain in each replay's `monthly.csv` linked by comparison.json. These are not independent monthly restarts.

| Month | Control 24h | Range 24h | Delta | Control 72h | Range 72h | Delta | Range-high 24h | Range-high 72h |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024-12 | $111 | $361 | $251 | $111 | $361 | $251 | -$194 | -$194 |
| 2025-01 | -$25 | $764 | $790 | -$25 | $764 | $790 | $1,227 | $415 |
| 2025-02 | $1,522 | $716 | -$806 | $1,452 | $716 | -$736 | $63 | $63 |
| 2025-03 | -$512 | -$613 | -$101 | -$512 | -$613 | -$101 | -$1,330 | -$1,835 |
| 2025-04 | $2,661 | $1,709 | -$952 | $3,204 | $1,709 | -$1,495 | $1,187 | $1,229 |
| 2025-05 | $61 | -$554 | -$615 | -$846 | -$554 | $292 | -$554 | -$554 |
| 2025-06 | -$1,431 | -$815 | $616 | -$1,431 | -$815 | $616 | -$815 | -$815 |
| 2025-07 | -$136 | -$330 | -$194 | -$385 | -$419 | -$34 | -$309 | -$645 |
| 2025-08 | $47 | $222 | $175 | $822 | $222 | -$599 | $304 | $304 |
| 2025-09 | -$181 | $236 | $417 | -$110 | $236 | $346 | -$631 | -$631 |
| 2025-10 | -$535 | -$419 | $116 | -$723 | -$607 | $116 | -$973 | -$1,161 |
| 2025-11 | -$1,104 | -$219 | $885 | -$1,700 | -$492 | $1,208 | -$1,077 | -$1,350 |
| 2025-12 | $749 | $189 | -$560 | $92 | -$469 | -$560 | $868 | $675 |
| 2026-01 | -$109 | -$443 | -$334 | -$511 | -$845 | -$334 | -$737 | -$947 |
| 2026-02 | $760 | $822 | $62 | $760 | $822 | $62 | $994 | $994 |
| 2026-03 | -$135 | -$592 | -$456 | $124 | -$118 | -$242 | -$628 | $323 |
| 2026-04 | -$607 | -$136 | $471 | -$605 | -$134 | $471 | $78 | -$402 |
| 2026-05 | $39 | $392 | $353 | -$587 | -$234 | $353 | $1,865 | $1,786 |
| 2026-06 | $939 | $1,042 | $103 | $1,144 | $1,247 | $103 | $508 | -$210 |
| 2026-07 | -$298 | $209 | $506 | -$62 | $209 | $270 | -$209 | -$52 |
| 2026-08 | $1,095 | $632 | -$463 | $1,590 | $812 | -$778 | $919 | $1,444 |
| 2026-09 | -$381 | -$486 | -$105 | -$318 | -$578 | -$260 | -$258 | -$759 |

## Execution / cost sensitivity (full window, 24h/2R)

| Source lag | Action delay | Stress | Control net | Range net |
|---|---|---|---:|---:|
| 60s | 0s | none | $2,530 | $2,690 |
| 60s | 0s | +5bps/side | $448 | $1,458 |
| 60s | 60s | none | $2,385 | $2,632 |
| 60s | 60s | +5bps/side | $303 | $1,400 |
| 120s | 0s | none | $2,385 | $2,632 |
| 120s | 0s | +5bps/side | $303 | $1,400 |
| 120s | 60s | none | $2,173 | $2,457 |
| 120s | 60s | +5bps/side | $91 | $1,225 |

Source lag and action delay can generate the same fill clock: these are sensitivities, not independent evidence.

## Frozen screen

### Range 2R / 24h: FAIL

- lag60000/2025-02: monthly delta -$806
- lag60000/2025-04: monthly delta -$952
- lag60000/2025-05: monthly delta -$615
- lag60000/2025-12: monthly delta -$560
- lag60000/2026-01: monthly delta -$334
- lag60000/2026-03: monthly delta -$456
- lag60000/2026-08: monthly delta -$463
- lag60000: top five winners exceed net
- lag120000/2025-02: monthly delta -$817
- lag120000/2025-04: monthly delta -$945
- lag120000/2025-05: monthly delta -$626
- lag120000/2025-12: monthly delta -$556
- lag120000/2026-01: monthly delta -$324
- lag120000/2026-03: monthly delta -$448
- lag120000/2026-08: monthly delta -$480
- lag120000: top five winners exceed net

### Range 2R / 72h: FAIL

- lag60000/full: net below control
- lag60000/recent: net below control
- lag60000/recent: DD above control
- lag60000/2025-02: monthly delta -$736
- lag60000/2025-04: monthly delta -$1,495
- lag60000/2025-08: monthly delta -$599
- lag60000/2025-12: monthly delta -$560
- lag60000/2026-01: monthly delta -$334
- lag60000/2026-08: monthly delta -$778
- lag60000/2026-09: monthly delta -$260
- lag60000: PF below 1.1
- lag60000: top five winners exceed net
- lag60000: nonpositive window/cost/delay case
- lag120000/full: net below control
- lag120000/recent: net below control
- lag120000/recent: DD above control
- lag120000/2025-02: monthly delta -$744
- lag120000/2025-04: monthly delta -$1,501
- lag120000/2025-08: monthly delta -$546
- lag120000/2025-12: monthly delta -$556
- lag120000/2026-01: monthly delta -$324
- lag120000/2026-08: monthly delta -$793
- lag120000: PF below 1.1
- lag120000: top five winners exceed net
- lag120000: nonpositive window/cost/delay case

## What changed, what did not

- Range qualification with the same 2R exit reduces trade count/exposure and DD; it does not materially reduce average loss. It removes winners too. This is modest filtering, not evidence of a high-confidence bounce.
- The range-high target holds out for a more distant exit and worsens economics here. POC or midpoint targets were not tested; do not treat their outcomes as known.
- Both anchors must be published before sweep start; reclaim trades occur after source lag. Five historical prefix cuts and all confirmed stage clocks pass. Synthetic future-poison/gap/late-bar tests also pass.
- Chart zone publication was repaired; origin timestamps remain formation metadata. Existing saved HTML pages are not silently overwritten and need regeneration to adopt the fix.
- H&S fakeout, other timeframes, short mirrors, POC/VWAP/HL confluence, maker fills/funding, and live ladder integration remain untested. No live deployment claim.

## Source-to-fill trace

```json
{
  "event": {
    "id": "SF01:long:pivot:14400000:low:1735286400000:25.8",
    "setup": "SF01",
    "version": "sf01-v1",
    "side": 1,
    "stage": "confirmed",
    "formationAt": 1735617600000,
    "knownAt": 1735632060000,
    "stages": {
      "level": {
        "at": 1735286400000,
        "knownAt": 1735329660000,
        "price": 25.8
      },
      "sweep": {
        "at": 1735617600000,
        "knownAt": 1735632060000,
        "price": 25.572
      },
      "range": {
        "at": 1735430400000,
        "knownAt": 1735473660000,
        "price": 29.562
      },
      "reclaim": {
        "at": 1735617600000,
        "knownAt": 1735632060000,
        "price": 26.028
      }
    },
    "reference": {
      "low": {
        "id": "pivot:14400000:low:1735286400000:25.8",
        "kind": "low",
        "price": 25.8,
        "pivotAt": 1735286400000,
        "confirmationEnd": 1735329600000,
        "availableAt": 1735329660000,
        "timeframe": 14400000,
        "width": 2
      },
      "rangeHigh": {
        "id": "pivot:14400000:high:1735430400000:29.562",
        "kind": "high",
        "price": 29.562,
        "pivotAt": 1735430400000,
        "confirmationEnd": 1735473600000,
        "availableAt": 1735473660000,
        "timeframe": 14400000,
        "width": 2
      },
      "rangeQualified": true,
      "rangeReason": "qualified",
      "zone": {
        "low": 25.8,
        "high": 29.562,
        "originAt": 1735286400000,
        "availableAt": 1735632060000
      }
    },
    "proxies": {
      "entry": 26.028,
      "stop": 25.546428,
      "target": 29.562
    },
    "notes": []
  },
  "trade": {
    "id": "SF01:long:pivot:14400000:low:1735286400000:25.8",
    "signalAt": "1735632060000",
    "entryAt": "1735632060000",
    "exitAt": "1735645860000",
    "entryPrice": "26.022",
    "exitPrice": "26.991144",
    "side": "1",
    "qty": "384.2902159711014",
    "pricePnl": "372.4325570670971",
    "fees": "11.204837906386903",
    "net": "361.2277191607102",
    "reason": "target",
    "target": "26.991144",
    "stop": "25.546428",
    "r": "1.9765393479851645",
    "touchedBoth": "false",
    "evidence": "{\"level\":1735286400000,\"sweep\":1735617600000,\"range\":1735430400000,\"reclaim\":1735617600000}",
    "signalUtc": "2024-12-31T08:01:00.000Z",
    "entryUtc": "2024-12-31T08:01:00.000Z",
    "exitUtc": "2024-12-31T11:51:00.000Z"
  }
}
```
