# SF03: confirmed SFP, then buy a return to its sweep low

## TL;DR

- **0/4 complete screen passes.** Two entry offsets x two holding caps; fill models, source lag, action delay and costs are sensitivities, not independent strategies. No live change.
- The cheaper fills reduce loss dollars, but miss almost all original winners. With the original stop unchanged, exact sweep entry normally leaves only 0.1% price room; returning to that low often immediately stops out.
- This rejects the exact entry-only change, not the SFP family or wider-stop/HL alternatives. Those remain untested here. Hindsight entry during the original sweep was never allowed.

## Frozen comparison

2024-12-27T00:00:00Z through 2026-09-15T20:20:00Z, UTC; split 2026-06-01T00:00:00Z. HYPE Bybit perpetual, fixed $10,000 notional, $32,000 DD account. 0.055% taker/side; +5bps/side stress; before funding. Source lag60/120s, action delay0/60s. Saved original **4h range-qualified SF01**, not the losing SF02 15m signal. Original signal-risk0.2-5% eligibility, absolute SL and reference-derived2R TP retained.

At confirmation submit at the first sweep candle low, or 0.1% higher. Exclusive expiry four hours later. One pending/open owner; no retries/replacements. Holding cap starts at actual fill, adding waiting time to total signal age. Charge the limit without favorable gap improvement. This is not a new 2R target measured from the cheaper fill.

Touch assumes a full resting fill; it does not prove queue execution. Open requires minute-open at/below limit and ignores wick-only touches; it is an execution sensitivity, not a lower PnL bound. Initial already-invalid brackets are not submitted; once resting, a gap through SL fills and loses. An unfilled order cancels at a later minute-open above TP. Fill-minute pre-entry highs cannot credit a primary TP; close>=TP is required, with target-first as a separate optimistic bound.

The generic setup-replay reports retain a descriptive screen. This frozen SF03 report/card supersedes it.

## Full-period results: baseline beside each variant

Primary source lag60s, action delay0, stop-first. W/L and dollars are closed trades; net also includes cutoff inventory. Baseline has +$14.86 open MTM; candidates have none.

| Hold | Entry | Wins / losses | Winning $ | Losing $ | Avg loss | Net | Delta vs baseline | DD |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 24h | Market baseline | 43 / 79 | $18,124 | -$15,449 | -$196 | $2,690 | $0 | 7.92% |
| 24h | Sweep +0% (touch) | 2 / 46 | $1,291 | -$1,545 | -$34 | -$254 | -$2,944 | 4.23% |
| 24h | Sweep +0.1% (touch) | 5 / 48 | $2,003 | -$2,065 | -$43 | -$62 | -$2,752 | 4.09% |
| 72h | Market baseline | 41 / 81 | $18,912 | -$17,704 | -$219 | $1,223 | $0 | 11.90% |
| 72h | Sweep +0% (touch) | 2 / 46 | $1,291 | -$1,545 | -$34 | -$254 | -$1,477 | 4.23% |
| 72h | Sweep +0.1% (touch) | 4 / 49 | $1,974 | -$2,215 | -$45 | -$241 | -$1,463 | 4.63% |

## Where the improvement disappears (24h touch model)

| Entry | Fills | Expired / invalidated | Original winners missed | Their original profit | Common-trade improvement | Net removed trades | Open delta | Total delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sweep +0% (touch) | 48 | 70 / 9 | 41 / 43 | $17,122 | $6,399 | $9,328 | -$15 | -$2,944 |
| Sweep +0.1% (touch) | 53 | 66 / 8 | 39 / 43 | $16,617 | $6,661 | $9,398 | -$15 | -$2,752 |

All candidate closed trades in the primary path share baseline IDs; no added closed trades. Delta = common improvement - removed net + open delta. Removed counts include expiry/invalidation/occupancy, not assumed poor signals. Full ID-level attribution is saved.

| Entry | TP / stop / timeout | Stops on fill minute | Median stop distance | Mean filled wait | Fees paid |
|---|---:|---:|---:|---:|---:|
| Sweep +0% (touch) | 2 / 46 / 0 | 26 | 0.10% | 110.0 min | $528 |
| Sweep +0.1% (touch) | 4 / 48 / 1 | 12 | 0.20% | 90.7 min | $583 |

The exact-sweep entry saves money on trades that were already losses, but does not convert any baseline24h losers to winners in the touch model. The +0.1% variant converts one. A usual exact-sweep stop is about $10 price loss plus $11 fees; the small average loss does not mean reliable bounces. Longer holding cannot rescue a trade already stopped. This is conditional on the original tight stop, not evidence against all retest entries.

## Older/recent windows

| Hold | Entry | Older baseline net / DD | Older candidate net / DD | Recent baseline net / DD | Recent candidate net / DD |
|---|---|---:|---:|---:|---:|
| 24h | Sweep +0% (touch) | $1,293 / 7.92% | -$128 / 3.85% | $1,397 / 2.47% | -$126 / 0.55% |
| 24h | Sweep +0.1% (touch) | $1,293 / 7.92% | -$50 / 3.91% | $1,397 / 2.47% | -$12 / 0.72% |
| 72h | Sweep +0% (touch) | -$467 / 11.90% | -$128 / 3.85% | $1,690 / 2.99% | -$126 / 0.55% |
| 72h | Sweep +0.1% (touch) | -$467 / 11.90% | -$228 / 4.40% | $1,690 / 2.99% | -$12 / 0.72% |

## Monthly marked net and delta versus same-hold baseline

### 24h

| Month | Baseline | Exact sweep | Delta | Sweep +0.1% | Delta |
|---|---:|---:|---:|---:|---:|
| 2024-12 | $361 | $0 | -$361 | $0 | -$361 |
| 2025-01 | $764 | $1,148 | $383 | $1,117 | $352 |
| 2025-02 | $716 | -$21 | -$737 | -$31 | -$747 |
| 2025-03 | -$613 | -$344 | $269 | -$373 | $240 |
| 2025-04 | $1,709 | -$21 | -$1,730 | -$31 | -$1,740 |
| 2025-05 | -$554 | -$21 | $533 | -$62 | $492 |
| 2025-06 | -$815 | -$42 | $773 | -$62 | $753 |
| 2025-07 | -$330 | -$84 | $246 | -$124 | $206 |
| 2025-08 | $222 | -$21 | -$243 | -$31 | -$253 |
| 2025-09 | $236 | -$383 | -$619 | -$422 | -$659 |
| 2025-10 | -$419 | -$42 | $377 | $469 | $888 |
| 2025-11 | -$219 | $59 | $278 | $29 | $248 |
| 2025-12 | $189 | -$21 | -$210 | -$31 | -$220 |
| 2026-01 | -$443 | -$105 | $338 | -$155 | $288 |
| 2026-02 | $822 | -$63 | -$885 | -$124 | -$946 |
| 2026-03 | -$592 | -$21 | $571 | -$2 | $589 |
| 2026-04 | -$136 | -$63 | $73 | -$93 | $43 |
| 2026-05 | $392 | -$84 | -$476 | -$124 | -$516 |
| 2026-06 | $1,042 | -$42 | -$1,084 | -$62 | -$1,104 |
| 2026-07 | $209 | $0 | -$209 | $174 | -$35 |
| 2026-08 | $632 | $0 | -$632 | $0 | -$632 |
| 2026-09 | -$486 | -$84 | $402 | -$124 | $362 |

### 72h

| Month | Baseline | Exact sweep | Delta | Sweep +0.1% | Delta |
|---|---:|---:|---:|---:|---:|
| 2024-12 | $361 | $0 | -$361 | $0 | -$361 |
| 2025-01 | $764 | $1,148 | $383 | $1,117 | $352 |
| 2025-02 | $716 | -$21 | -$737 | -$31 | -$747 |
| 2025-03 | -$613 | -$344 | $269 | -$373 | $240 |
| 2025-04 | $1,709 | -$21 | -$1,730 | -$31 | -$1,740 |
| 2025-05 | -$554 | -$21 | $533 | -$62 | $492 |
| 2025-06 | -$815 | -$42 | $773 | -$62 | $753 |
| 2025-07 | -$419 | -$84 | $335 | -$124 | $295 |
| 2025-08 | $222 | -$21 | -$243 | -$31 | -$253 |
| 2025-09 | $236 | -$383 | -$619 | -$422 | -$659 |
| 2025-10 | -$607 | -$42 | $565 | $469 | $1,076 |
| 2025-11 | -$492 | $59 | $551 | $29 | $521 |
| 2025-12 | -$469 | -$21 | $448 | -$31 | $438 |
| 2026-01 | -$845 | -$105 | $740 | -$155 | $690 |
| 2026-02 | $822 | -$63 | -$885 | -$124 | -$946 |
| 2026-03 | -$118 | -$21 | $97 | -$181 | -$62 |
| 2026-04 | -$134 | -$63 | $71 | -$93 | $41 |
| 2026-05 | -$234 | -$84 | $150 | -$124 | $110 |
| 2026-06 | $1,247 | -$42 | -$1,289 | -$62 | -$1,309 |
| 2026-07 | $209 | $0 | -$209 | $174 | -$35 |
| 2026-08 | $812 | $0 | -$812 | $0 | -$812 |
| 2026-09 | -$578 | -$84 | $494 | -$124 | $454 |

## Execution, delay and cost sensitivity

Net dollars. Each baseline uses the same hold and clock. All model/lag monthly rows remain in saved JSON/CSV.

| Hold | Entry | Lag60 net / DD | +60s delay net | Stressed net | Lag120 net / DD | Optimistic target-first net |
|---|---|---:|---:|---:|---:|---:|
| 24h | Market baseline | $2,690 / 7.92% | $2,632 | $1,458 | $2,632 / 7.83% | $2,690 |
| 24h | Sweep +0% (touch) | -$254 / 4.23% | -$254 | -$735 | -$254 / 4.23% | -$254 |
| 24h | Sweep +0% (open) | $219 / 4.13% | $219 | -$231 | $219 / 4.13% | $219 |
| 24h | Sweep +0.1% (touch) | -$62 / 4.09% | -$62 | -$593 | -$62 / 4.09% | -$62 |
| 24h | Sweep +0.1% (open) | -$767 / 5.90% | -$767 | -$1,247 | -$767 / 5.90% | -$767 |
| 72h | Market baseline | $1,223 / 11.90% | $1,111 | -$9 | $1,111 / 11.78% | $1,223 |
| 72h | Sweep +0% (touch) | -$254 / 4.23% | -$254 | -$735 | -$254 / 4.23% | -$254 |
| 72h | Sweep +0% (open) | $219 / 4.13% | $219 | -$231 | $219 / 4.13% | $219 |
| 72h | Sweep +0.1% (touch) | -$241 / 4.63% | -$241 | -$771 | -$241 / 4.63% | -$241 |
| 72h | Sweep +0.1% (open) | -$987 / 6.56% | -$987 | -$1,467 | -$987 / 6.56% | -$987 |

## Qualification and verification

Screen inherited from SF01: net>=matched baseline and DD<=baseline in full/older/recent, no month worse by more than $250, >=30 full/10 per split trades, PF>=1.1, net excluding top-five winners positive, all cost/delay cases positive; both publication lags and both entry-fill models required.

- Sweep +0%, 24h: **FAIL**. net below baseline; sample; monthly opportunity cost; PF; winner concentration; nonpositive window/stress/delay or equity exhaustion.
- Sweep +0%, 72h: **FAIL**. net below baseline; sample; monthly opportunity cost; PF; winner concentration; nonpositive window/stress/delay or equity exhaustion.
- Sweep +0.1%, 24h: **FAIL**. net below baseline; sample; monthly opportunity cost; PF; winner concentration; nonpositive window/stress/delay or equity exhaustion.
- Sweep +0.1%, 72h: **FAIL**. net below baseline; sample; monthly opportunity cost; PF; winner concentration; nonpositive window/stress/delay or equity exhaustion.

Original archived baseline: 36 result rows and byte-identical closed-trade CSVs at lag60000; 36 result rows and byte-identical closed-trade CSVs at lag120000. Non-entry action fields, rejections, ties, windows and full monthly outputs match. All 360 replay cells independently audited; saved source/artifact hashes verified. Synthetic tests cover pending occupancy, exclusive expiry, delayed activation, gap-through-stop, entry-bar sequencing, hold clock, cutoff, prefix invariance and audit tampering.

Causal trace: Jan8,2025 sweep low $21.207 becomes known at04:01 UTC after the4h close+60s. Order fills only on the later05:54 return, then stops at05:55 at$21.185793 for-$20.99 after fees. The original sweep itself is never counted as a fill. Full event, intent and trade are in comparison.json.

Development sample, informed by the user's manual review, not untouched out-of-sample proof. Funding and live queue/tick effects are not modeled. These costs/results do not justify deployment.

## Stored artifacts / resume

- Job: `2d61717152fd4cf0cb5ac714e99eeb7a55790474189a4cd77731ad544397a436` under `backtests/range-low-sfp-limit/`; comparison contains all results, monthly paths, attribution, provenance and causal traces.
- Each linked setup-replay directory has trade CSVs, intent lifecycles, receipts and results. Re-run the study to verify/reuse; it does not reconstruct the S/R map or rerun detection.
- [Exact-sweep interactive replay](../backtests/range-low-sfp-limit/2d61717152fd4cf0cb5ac714e99eeb7a55790474189a4cd77731ad544397a436/sweep-0-replay.html).
- [Sweep +0.1% interactive replay](../backtests/range-low-sfp-limit/2d61717152fd4cf0cb5ac714e99eeb7a55790474189a4cd77731ad544397a436/sweep-0.1-replay.html).
- [Frozen card](../research-inputs/range-low-sfp-limit-sf03-2026-09-20.json) / [method](../docs/research/range-low-sfp-limit-sf03.md).
- Next already-requested branch: HL availability-aware context on original4h stops, distinguishing72h recovery/non-recovery with censoring. Only then a separately declared wider-SL replay. No new filters or stops were selected from SF03.
