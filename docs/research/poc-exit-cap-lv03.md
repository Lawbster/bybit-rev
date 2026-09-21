# LV03: daily NPOC TP/SL with 24h or no exit cap

September 17, 2026. Local research only. No live changes.
[Frozen card](../../research-inputs/poc-exit-cap-lv03-2026-09-17.json) /
[findings](../../research/codex-astra-poc-exit-cap-findings-2026-09-17.md).

## Scope

The user asked whether the NPOC result improves by removing the 12h maximum
hold or extending it to 24h. Reuse the original daily NPOC touch **long-only**
signals, minute candles and map. Do not broaden to all LV01 entry families.

TP and SL each vary independently over 2/2.5/3/3.5/4/4.5/5%. Run every pair
at 12h (archived control), 24h and uncapped. Add plain 24h timed exit against
the existing plain 12h timed baseline. This is 98 new barrier definitions plus
one timed definition, 99 additions, **8,955 standalone /205 ladder overlays**.

The card was saved before economics. Full December5,2024 12:55 to
September15,2026 20:20 UTC, end exclusive; older/recent reset June1,2026.
Full/older/recent x0/60s additional delay; stop-first primary and target-first
minute ambiguity sensitivity. 149 definitions including controls, 1,776 paths.
Six timed controls and all588 archived NPOC barrier paths reproduce exactly
before any new cap economics are executed.

## Execution and accounting

`poc-exit-cap-engine.ts` is a small adapter to the unchanged LV02 percentage
adapter and PI01 replay. Percentages attach to actual entry fills. Barriers
are modeled as resting immediately after entry; gaps fill at the open, not at
the more favorable threshold. No instant same-minute re-entry after an intrabar
barrier fill. Existing raw-signal timestamps/availability are unchanged.

`capHours: null` means mathematical Infinity internally. It is not an arbitrary
long finite timeout. JSON stores the semantic null cap, never an accidentally
serialized Infinity expiry. Uncapped does **not** remove TP or SL. An untouched
position at the cutoff stays marked and occupied, not classified as a win/loss
or forcibly exited. Independent auditor reconstructs this behavior directly.

One position per independent strategy, $10k actual-entry notional, $32k initial
equity, no compounding. Fees0.055% each actual side, additional5bps/side stress.
Funding, borrowing, margin/liquidation, bid/ask execution and maker queue are
not modeled. Longer holds make those omissions more relevant, not less.
Additional60s delays entry and scheduled timeout; it is not measured protective
order placement latency. Timeout executes at its minute open before that
minute's later high/low. Monthly and final PnL include marked inventory and
hypothetical exit fees; closed W/L amounts exclude the open trade.

Record same-pair12h comparison, original timed12h reference, fixed4.5/5 comparison,
best cell per cap, all monthly deltas, reason counts/dollars, skipped signals,
holding mean/median/p95/max and open age. The full-period cap winner is not a
guaranteed optimum or evidence from an untouched holdout.

## Acceptance and commands

The inherited screen requires positive net and extra-cost-stressed net in every
window/delay path, >=30 full/10 per subwindow trades, no exhausted equity and
no marked month below-$250 versus cash. Relative qualification adds positive
net delta, nonworse DD and no monthly regression below-$250 versus identical
TP/SL with12h cap (timed24 compared with timed12). Do not relax after results.

```powershell
npx ts-node scripts/poc-exit-cap-tests.ts
npx ts-node scripts/poc-exit-cap-study.ts
npx ts-node scripts/poc-exit-cap-verify.ts
npx ts-node scripts/poc-exit-cap-report.ts
```

Do not rerun these merely to read the accepted results. Both economic and
report directories refuse overwrite. Accepted job:
`919d76a621bbdcceee8848111ab58dd1abbca8390c7d3b512beea61ce84ecdca`.
Source/input/protected-live hashes are checked before/after. Parent artifacts
consumed by this study are hash verified; unrelated large journals aren't reread.

Independent verification reconstructs all unique paths minute by minute without
calling the producer: first hits/gaps, ownership, price-relative barriers, fees,
monthly MTM, DD and open age. All930 unique journals passed:155,233 receipts,
90,222,565 minutes,13,832 monthly rows. The1,776 reported paths include legal
reuse of ambiguity-free target-first paths, not1,776 independent confirmations.

[Saved comparisons and trade CSV directory](../../backtests/poc-exit-cap-reports/919d76a621bbdcceee8848111ab58dd1abbca8390c7d3b512beea61ce84ecdca) /
[all grids](../../backtests/poc-exit-cap-reports/919d76a621bbdcceee8848111ab58dd1abbca8390c7d3b512beea61ce84ecdca/grids.md).
