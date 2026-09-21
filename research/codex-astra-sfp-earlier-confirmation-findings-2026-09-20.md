# SF02 earlier confirmation: HYPEUSDT

2026-09-20. Research only; no live changes. One frozen implementation of the operator screenshot, not a verdict on every SFP definition.

## TL;DR

- 524 baseline low-pivot attempts; 192 control confirmations and 239 candidate confirmations. After risk, ties and occupancy: 24h/2R control 122 closes versus candidate 190.
- 24h/2R earlier confirmation: $2,690 -> -$2,259 (-$4,948), DD 7.92% -> 14.35%. Candidate win rate 36.8%.
- 0/2 comparisons pass the complete frozen screen. 24h primary, 72h secondary; no structural targets in this checkpoint. No threshold changes after results.

## Scope and artifacts

Window **2024-12-27T00:00:00Z to 2026-09-15T20:20:00Z**, split 2026-06-01T00:00:00Z. Fixed $10k notional, $32k starting equity, taker 0.055% each side, before funding; stress adds 5bps/side. Long only. 4h anchors; 4h baseline versus closed15m confirmation. 60s modeled publication lag and next eligible minute open; 120s source-lag and 60s action-delay sensitivities. Existing engine and independent accounting audit unchanged. This is not a ladder replay or live-equity forecast.

[Frozen method](../docs/research/range-low-sfp-early-sf02.md) / [card](../research-inputs/range-low-sfp-early-sf02-2026-09-20.json) / [saved comparison](../backtests/range-low-sfp-early/4e8a026f7d3db11e8b5e0d090e8b22713bc93742a555e90215062e9976a80661/comparison.json) / [verification](../backtests/range-low-sfp-reviews/eb22b7257078e774bdaccafbcf1207241163665c61e016460a7fe62cdc0e4073/verification.json).

[Range replay chart](../backtests/range-low-sfp-early/4e8a026f7d3db11e8b5e0d090e8b22713bc93742a555e90215062e9976a80661/range_sfp-replay.html) / [control replay chart](../backtests/range-low-sfp-early/4e8a026f7d3db11e8b5e0d090e8b22713bc93742a555e90215062e9976a80661/swing_control-replay.html) / [all range attempts](../backtests/range-low-sfp-early/4e8a026f7d3db11e8b5e0d090e8b22713bc93742a555e90215062e9976a80661/range_sfp-scan.html). Charts reuse Fable's renderer, need its CDN chart library, and place zones from availability rather than origin candles. Inspect event timestamps and rejected attempts, not just winners.

## Full-window results (primary clock)

Wins/losses and their dollars are closed trades. Open inventory is marked separately, not counted as a win/loss. Fixed notional is not fixed risk; compare each asset to its own control, not dollars across assets as if risk matched.

| Setup | Target / cap | Wins / losses | Winning $ | Losing $ | Avg loss | Open MTM | Net incl. open | DD |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 4h baseline | 2R / 24h | 43 / 79 | $18,124 | -$15,449 | -$196 | $15 | $2,690 | 7.92% |
| 15m confirmation | 2R / 24h | 70 / 120 | $16,617 | -$18,930 | -$158 | $54 | -$2,259 | 14.35% |
| 4h baseline | 2R / 72h | 41 / 81 | $18,912 | -$17,704 | -$219 | $15 | $1,223 | 11.90% |
| 15m confirmation | 2R / 72h | 68 / 121 | $17,909 | -$20,577 | -$170 | $54 | -$2,614 | 15.40% |

## Older / recent comparisons

| Window | Cap | Control net / DD | Candidate net / DD | Net delta |
|---|---|---:|---:|---:|
| older | 24h | $1,293 / 7.92% | -$1,726 / 12.06% | -$3,019 |
| older | 72h | -$467 / 11.90% | -$2,070 / 13.07% | -$1,603 |
| recent | 24h | $1,397 / 2.47% | -$533 / 4.28% | -$1,930 |
| recent | 72h | $1,690 / 2.99% | -$544 / 4.32% | -$2,233 |

## Monthly marked net (full continuous paths)

Boundary months are partial. Exact monthly W/L dollars remain in each replay's `monthly.csv` linked by comparison.json. These are not independent monthly restarts.

| Month | Control 24h | Candidate 24h | Delta | Control 72h | Candidate 72h | Delta |
|---|---:|---:|---:|---:|---:|---:|
| 2024-12 | $361 | $221 | -$141 | $361 | $221 | -$141 |
| 2025-01 | $764 | $660 | -$105 | $764 | $660 | -$105 |
| 2025-02 | $716 | -$946 | -$1,663 | $716 | -$946 | -$1,663 |
| 2025-03 | -$613 | -$412 | $201 | -$613 | -$412 | $201 |
| 2025-04 | $1,709 | -$240 | -$1,949 | $1,709 | -$240 | -$1,949 |
| 2025-05 | -$554 | -$110 | $444 | -$554 | -$110 | $444 |
| 2025-06 | -$815 | $1,245 | $2,060 | -$815 | $1,343 | $2,158 |
| 2025-07 | -$330 | $774 | $1,104 | -$419 | $842 | $1,261 |
| 2025-08 | $222 | $100 | -$122 | $222 | $100 | -$122 |
| 2025-09 | $236 | -$167 | -$403 | $236 | -$167 | -$403 |
| 2025-10 | -$419 | -$425 | -$6 | -$607 | -$425 | $182 |
| 2025-11 | -$219 | -$816 | -$597 | -$492 | -$1,386 | -$894 |
| 2025-12 | $189 | -$104 | -$292 | -$469 | -$1,126 | -$657 |
| 2026-01 | -$443 | -$609 | -$166 | -$845 | -$44 | $801 |
| 2026-02 | $822 | $19 | -$803 | $822 | $19 | -$803 |
| 2026-03 | -$592 | -$754 | -$163 | -$118 | -$239 | -$120 |
| 2026-04 | -$136 | -$405 | -$269 | -$134 | -$405 | -$272 |
| 2026-05 | $392 | $244 | -$148 | -$234 | $244 | $478 |
| 2026-06 | $1,042 | -$511 | -$1,553 | $1,247 | -$511 | -$1,758 |
| 2026-07 | $209 | -$675 | -$884 | $209 | -$675 | -$884 |
| 2026-08 | $632 | $620 | -$12 | $812 | $600 | -$212 |
| 2026-09 | -$486 | $34 | $520 | -$578 | $43 | $621 |

## Execution / cost sensitivity (full window, 24h/2R)

| Source lag | Action delay | Stress | Control net | Candidate net |
|---|---|---|---:|---:|
| 60s | 0s | none | $2,690 | -$2,259 |
| 60s | 0s | +5bps/side | $1,458 | -$4,168 |
| 60s | 60s | none | $2,632 | -$1,671 |
| 60s | 60s | +5bps/side | $1,400 | -$3,571 |
| 120s | 0s | none | $2,632 | -$1,671 |
| 120s | 0s | +5bps/side | $1,400 | -$3,571 |
| 120s | 60s | none | $2,457 | -$1,434 |
| 120s | 60s | +5bps/side | $1,225 | -$3,334 |

Source lag and action delay can generate the same fill clock: these are sensitivities, not independent evidence.

## Frozen screen

### Earlier confirmation 2R / 24h: FAIL

- lag60000/full: net below control
- lag60000/full: DD above control
- lag60000/older: net below control
- lag60000/older: DD above control
- lag60000/recent: net below control
- lag60000/recent: DD above control
- lag60000/2025-02: monthly delta -$1,663
- lag60000/2025-04: monthly delta -$1,949
- lag60000/2025-09: monthly delta -$403
- lag60000/2025-11: monthly delta -$597
- lag60000/2025-12: monthly delta -$292
- lag60000/2026-02: monthly delta -$803
- lag60000/2026-04: monthly delta -$269
- lag60000/2026-06: monthly delta -$1,553
- lag60000/2026-07: monthly delta -$884
- lag60000: PF below 1.1
- lag60000: top five winners exceed net
- lag60000: nonpositive window/cost/delay case
- lag120000/full: net below control
- lag120000/full: DD above control
- lag120000/older: net below control
- lag120000/older: DD above control
- lag120000/recent: net below control
- lag120000/recent: DD above control
- lag120000/2025-02: monthly delta -$1,486
- lag120000/2025-04: monthly delta -$2,013
- lag120000/2025-09: monthly delta -$290
- lag120000/2025-11: monthly delta -$497
- lag120000/2025-12: monthly delta -$259
- lag120000/2026-02: monthly delta -$778
- lag120000/2026-04: monthly delta -$293
- lag120000/2026-06: monthly delta -$1,424
- lag120000/2026-07: monthly delta -$891
- lag120000: PF below 1.1
- lag120000: top five winners exceed net
- lag120000: nonpositive window/cost/delay case

### Earlier confirmation 2R / 72h: FAIL

- lag60000/full: net below control
- lag60000/full: DD above control
- lag60000/older: net below control
- lag60000/older: DD above control
- lag60000/recent: net below control
- lag60000/recent: DD above control
- lag60000/2025-02: monthly delta -$1,663
- lag60000/2025-04: monthly delta -$1,949
- lag60000/2025-09: monthly delta -$403
- lag60000/2025-11: monthly delta -$894
- lag60000/2025-12: monthly delta -$657
- lag60000/2026-02: monthly delta -$803
- lag60000/2026-04: monthly delta -$272
- lag60000/2026-06: monthly delta -$1,758
- lag60000/2026-07: monthly delta -$884
- lag60000: PF below 1.1
- lag60000: top five winners exceed net
- lag60000: nonpositive window/cost/delay case
- lag120000/full: net below control
- lag120000/full: DD above control
- lag120000/older: net below control
- lag120000/older: DD above control
- lag120000/recent: net below control
- lag120000/recent: DD above control
- lag120000/2025-02: monthly delta -$1,486
- lag120000/2025-04: monthly delta -$2,013
- lag120000/2025-09: monthly delta -$290
- lag120000/2025-11: monthly delta -$792
- lag120000/2025-12: monthly delta -$611
- lag120000/2026-02: monthly delta -$778
- lag120000/2026-04: monthly delta -$300
- lag120000/2026-06: monthly delta -$1,625
- lag120000/2026-07: monthly delta -$891
- lag120000: PF below 1.1
- lag120000: top five winners exceed net
- lag120000: nonpositive window/cost/delay case

## Earlier entry and full-path attribution

192 shared confirmed pivot IDs, 176 confirm earlier, 47 additional signals and 0 lost signals. All 192 shared IDs retain the same high anchor. Median confirmation advance 2.25h; median reclaim-reference price difference -0.394%. These are signal references, not identical filled-trade cohorts.

| Hold | Shared closed IDs / PnL delta | Added closed / net | Removed closed / net | Open MTM delta | Total delta |
|---|---:|---:|---:|---:|---:|
| long__r2__hold24h | 120 / -$1,825 | 70 / -$3,449 | 2 / -$286 | $39 | -$4,948 |
| long__r2__hold72h | 120 / -$1,195 | 69 / -$3,593 | 2 / -$912 | $39 | -$3,836 |

At24h, 23 shared baseline losers become wins, but 14 baseline winners become losses. 1 baseline winner ($167) is absent from the candidate closed-trade list. Added trades include changed risk eligibility and occupancy, not just newly detected confirmations. Attribution reconciles common delta + added net - removed net + open delta to total net delta.

Average initial dollar stop risk per closed trade: $224 baseline versus $153 candidate. Stop exits 73 -> 116; TP exits 35 -> 62. So a cheaper entry and higher win count are not necessarily better dollars: the causal stop/2R bracket also changes.

## What changed, what did not

- The trigger clock changes first-sweep eligibility, reclaim timing and causally known stop/2R brackets. This is not a pure fill-price improvement with a future4h stop/target. New15m signals include false starts that4h would reject.
- 4h baseline events/actions match archived artifacts exactly and replay/accounting engine pins remain unchanged. Results are reused, not silently replaced; paired trade attribution is saved in comparison.json.
- Both anchors must be published before sweep start; reclaim trades occur after source lag. Five historical prefix cuts and all confirmed stage clocks pass. Synthetic future-poison/gap/late-bar tests also pass.
- Chart zone publication was repaired; origin timestamps remain formation metadata. Existing saved HTML pages are not silently overwritten and need regeneration to adopt the fix.
- H&S fakeout, short mirrors, POC/VWAP/HL confluence, maker fills/funding, and live ladder integration remain untested in this pass. No live deployment claim.

## Source-to-fill trace

```json
{
  "event": {
    "id": "SF01:long:pivot:14400000:low:1735286400000:25.8",
    "setup": "SF01",
    "version": "sf01-v1",
    "side": 1,
    "stage": "confirmed",
    "formationAt": 1735631100000,
    "knownAt": 1735632060000,
    "stages": {
      "level": {
        "at": 1735286400000,
        "knownAt": 1735329660000,
        "price": 25.8
      },
      "sweep": {
        "at": 1735630200000,
        "knownAt": 1735631160000,
        "price": 25.572
      },
      "range": {
        "at": 1735430400000,
        "knownAt": 1735473660000,
        "price": 29.562
      },
      "reclaim": {
        "at": 1735631100000,
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
      "anchorTfMinutes": 240,
      "triggerTfMinutes": 15,
      "zone": {
        "low": 25.8,
        "high": 29.562,
        "originAt": 1735286400000,
        "availableAt": 1735631160000
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
    "evidence": "{\"level\":1735286400000,\"sweep\":1735630200000,\"range\":1735430400000,\"reclaim\":1735631100000}",
    "signalUtc": "2024-12-31T08:01:00.000Z",
    "entryUtc": "2024-12-31T08:01:00.000Z",
    "exitUtc": "2024-12-31T11:51:00.000Z"
  }
}
```
