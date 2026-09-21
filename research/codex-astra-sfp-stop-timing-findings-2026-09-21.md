# SFP 5% candidate: stop-loss date/time inspection

## Result

- **Seven actual stops among 102 trades**, costing $4,903.36: 41.18% of all losing dollars. The other 29 losing trades timed out. All seven stops occurred in 2025; none in the 47 trades entered in 2026 through September 21 00:22 UTC.
- **Weekend entries are the strongest descriptive concentration:** 5 stops / 21 trades (23.81%), versus 2 / 81 weekdays (2.47%). But weekend trades lost $2,739 in 2025 and made $1,932 in 2026. This is not a demonstrated persistent calendar edge.
- Six stops entered at 04:01 or 20:01 UTC. Both entry-hour cohorts still made money overall. Stop executions span seven different hours. No time filter was replayed or approved.

## Scope and unchanged controls

Read-only aggregation of the accepted SF08 ledgers; no detector, candles, map, replay, or live configuration rebuilt. Window: December 27, 2024 00:00 through September 21, 2026 00:22 UTC. All dates/times below are UTC.

Original SF01 confirmed 4h range-low SFP, original absolute 2R target and 24h maximum hold, one position at a time. Fixed $10,000 notional, 0.055% modeled fees each side, before funding. Primary source lag 60 seconds, no extra action delay, stop-first execution.

The selected **5% is extra padding below the original structural stop**, not a fixed 5% loss from entry. No higher notional is assumed here.

| Full-window setup | Trades | W / L | Winning $ | Losing $ | Net $ | MTM DD |
|---|---:|---:|---:|---:|---:|---:|
| Original structural stop | 123 | 44 / 79 | 18,291.36 | -15,449.13 | +2,842.23 | 7.92% |
| Selected extra 5% padding | 102 | 66 / 36 | 23,616.20 | -11,906.49 | +11,709.71 | 5.29% |

DD is the archived minute adverse-mark metric on the $32k starting account. Cohort net totals below are historical attribution, not new strategy returns or cohort drawdowns. Different original/padded trade counts reflect occupancy.

## Every stop

| Entry date/time UTC | Entry day | Stop date/time UTC | Held | Net loss at $10k |
|---|---|---|---|---:|
| 2025-01-18 04:01 | Saturday | 2025-01-18 10:19 | 6h 18m | -693.15 |
| 2025-02-24 04:01 | Monday | 2025-02-24 08:47 | 4h 46m | -565.98 |
| 2025-06-21 04:01 | Saturday | 2025-06-21 21:32 | 17h 31m | -963.06 |
| 2025-09-20 20:01 | Saturday | 2025-09-21 16:40 | 20h 39m | -594.01 |
| 2025-09-21 20:01 | Sunday | 2025-09-22 06:00 | 9h 59m | -785.20 |
| 2025-11-30 08:01 | Sunday | 2025-12-01 00:05 | 16h 04m | -683.87 |
| 2025-12-04 20:01 | Thursday | 2025-12-05 13:41 | 17h 40m | -618.09 |

Median time to stop: 16h 04m; range 4h 46m to 20h 39m. No single tight holding-age window. The September 20/21 entries are consecutive-day losses, not two clearly independent calendar replications. The November 30 entry closes in December: entry date and loss-booking date must not be conflated.

Stops by exit month: January 2025 1/-$693.15; February 1/-$565.98; June 1/-$963.06; September 2/-$1,379.20; December 2/-$1,301.96. Every other month has zero stops; that does not mean zero timeout losses.

## Entry weekday: denominators and invisible winners

| Entry day | Trades | W / L | Stops | Stop rate | Winning $ | Losing $ | Net $ |
|---|---:|---:|---:|---:|---:|---:|---:|
| Monday | 18 | 10 / 8 | 1 | 5.56% | 4,256.84 | -2,830.83 | +1,426.01 |
| Tuesday | 18 | 15 / 3 | 0 | 0% | 4,197.63 | -505.08 | +3,692.55 |
| Wednesday | 16 | 11 / 5 | 0 | 0% | 4,884.86 | -889.06 | +3,995.81 |
| Thursday | 17 | 10 / 7 | 1 | 5.88% | 3,609.14 | -1,823.15 | +1,785.99 |
| Friday | 12 | 9 / 3 | 0 | 0% | 2,269.84 | -653.36 | +1,616.48 |
| Saturday | 8 | 3 / 5 | 3 | 37.50% | 1,302.14 | -2,566.48 | -1,264.34 |
| Sunday | 13 | 8 / 5 | 2 | 15.38% | 3,095.75 | -2,638.54 | +457.21 |
| **All trades** | **102** | **66 / 36** | **7** | **6.86%** | **23,616.20** | **-11,906.49** | **+11,709.71** |

Weekend entries are only 20.59% of filled trades but account for 5/7 stops. Their complete cohort contains **11 winners worth $4,397.88**, versus 10 losers costing $5,205.02; net -$807.14. Weekdays net +$12,516.84.

Removing the weekend cohort is not equivalent to earning another $807.14: skipping entries changes occupancy and may admit different future signals. No counterfactual filter earnings are claimed.

## Does the weekend pattern persist?

Grouped by entry year, not exit year:

| Period/cohort | Trades | W / L | Stops | Net $ |
|---|---:|---:|---:|---:|
| 2025 weekends | 13 | 5 / 8 | 5 | -2,739.34 |
| 2025 weekdays | 41 | 28 / 13 | 2 | +7,810.90 |
| 2026 weekends | 8 | 6 / 2 | 0 | +1,932.21 |
| 2026 weekdays | 39 | 26 / 13 | 0 | +4,344.72 |

One additional weekday winner in December 2024 contributed $361.23. The selected strategy's 2026 losses are all timeouts; no 2026 stop sample exists with which to confirm the weekend association. The original-stop control also has a negative 2025 weekend cohort (-$1,150.67) and positive 2026 weekend cohort (+$1,148.39); these overlap in signals and are not independent confirmation.

## Entry hour

| Entry UTC | Trades | W / L | Stops | Stop rate | Net $ |
|---|---:|---:|---:|---:|---:|
| 00:01 | 16 | 12 / 4 | 0 | 0% | +2,934.80 |
| 04:01 | 23 | 12 / 11 | 3 | 13.04% | +1,637.23 |
| 08:01 | 19 | 12 / 7 | 1 | 5.26% | +1,063.70 |
| 12:01 | 10 | 7 / 3 | 0 | 0% | +2,294.45 |
| 16:01 | 19 | 13 / 6 | 0 | 0% | +2,667.50 |
| 20:01 | 15 | 10 / 5 | 3 | 20.00% | +1,112.02 |

The six four-hour slots and minute `:01` come from confirmed 4h setup timing plus the modeled 60-second availability lag, not a discovered minute-of-hour edge. The 04/20 cohorts together have 22 winners / 16 losers and net **+$2,749.25**, despite containing six stops. A blanket hour exclusion would remove profitable historical cohorts; its actual effect would still require a separate occupancy-aware replay.

Stop execution hours are 00, 06, 08, 10, 13, 16 and 21 UTC, one each. This is descriptive only, not an hourly stop-hazard estimate normalized by time in market. Exit times are outcomes, not information available when entering.

## Verification and disposition

- Reused SF08 job `54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e` in `backtests/sfp-latest-candles/`.
- SHA-256 verified against `complete.json`: `comparison.json`, original and padded full-window $10k/60s trade ledgers, and padded full-window $10k/120s ledger.
- Original and selected counts, net and every exit-month total reconcile to accepted `comparison.json`.
- All seven stopped signal identities and stop execution timestamps are identical in the 120-second availability sensitivity; entries move to `:02`.
- Exact input ledger: `pad5-10000-lag60000-full-delay0-stop-normal-trades.json`; control: `pad0-10000-lag60000-full-delay0-stop-normal-trades.json`. Read `entryAt`, `exitAt`, `reason`, `net` from these saved rows; classify calendar fields in UTC. No raw candle scan is needed to reproduce these tables.

**Conclusion:** weekend-entry concentration is real in this sample, especially Saturday, but is based on seven stops, includes clustered losses, and does not persist as negative weekend net in 2026. Time-of-day alone is not supported as an exclusion. This inspection neither changes the existing cross-period screen result nor establishes live readiness. No new rule, time gate, config, or production change.
