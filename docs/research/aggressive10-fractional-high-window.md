# AG10-H1: 36h / 48h / 60h rolling-high exit

Frozen before outcomes on 2026-09-14. User-requested narrow refinement, not
another multi-indicator or half-size experiment.

- Two new definitions: Aggressive10 with 36h or 60h high; parent remains48h.
- Keep 1% proximity, minimum age4h, full close, no profit floor, ordinary exit
  priority,10h soft-stale cap, existing live gate removals and4-8h forced cooldown.
- Prior integer high-window tests were primarily on the8h anchor. A width of
  **1.5%** in L14 was proximity, not a1.5-day window. Do not conflate them.
- Sixteen runs:8 exact archived controls first (B17 and48h parent across two
  periods and two TP models), then8 variants. No adaptive follow-up grid.
- Recent May17 20:43–Sep14 15:27 UTC; older July1,2025–Aug19,2026 21:32 UTC.
  Both flat-start at$32k, no boundary resets inside a run. Windows overlap.
- Closed-minute reference windows only; next-open market exits, no perfect-high
  fills. Both previously resting touch and close-confirmed TP assumptions.
- Independent full event/fee/mark accounting, every-minute high-exit and TP
  policy audit. Different-algorithm rolling-max checks, prefix/future poisoning,
  exact expiration, gap and minimum-age fixtures. Persist all causal traces.
- Recent net hurdle+$1k, older>=0, no DD increase, every month>=-$250, evaluated
  against48h parent and separately B17; no screen relaxation. Aggregate benefit
  alone is not a deployment pass. No live or carry-in-ladder changes.

Accepted replay baseline is the repaired September causal engine, not the
superseded favorable legacy sim. All inherited policies/data/fees unchanged.
Historical candle repairs do not prove original receipt, old pulse timestamps
may use the established modeled availability. No new HL features are introduced.
Live maker economics are not recreated; fee assumption remains0.055%/side.

Run locally:

```powershell
npx ts-node scripts/aggressive10-high-window-tests.ts
npx ts-node scripts/aggressive10-high-window-study.ts plan
npx ts-node scripts/aggressive10-high-window-study.ts run <full-key>
npx ts-node scripts/aggressive10-high-window-verify.ts <full-key>
```

Job outputs are immutable. Never edit pinned sources after planning or overwrite
an accepted job. Report completed ladder wins/losses separately from marked-open
PnL, monthly marked net and drawdown. Show both favorable and adverse examples;
matched-entry comparisons do not account for all changed occupancy, so retain
removed/replacement ladder attribution too.
