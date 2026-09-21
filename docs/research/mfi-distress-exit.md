# F02: deep-loss MFI exit replay

Research only. The user approved this bounded five-case experiment following the
P01 pressure atlas. It is not permission to modify or deploy a trading policy.

## Frozen experiment

See [the study card](../../research-inputs/mfi-distress-exit-2026-09-09.json).
Baseline is **L09 B17, current configuration**, not the bare ladder and not an old
optimistic replay. $32,000 starting capital; $800 x1.35/max11; all current gates,
ordinary exits, S/R actions and damaged-regime latch retained. Shorts excluded.

The first closed minute at depth>=9 and gross inventory PnL<=-3% starts a timer.
Exactly 60 minutes later, require the **same episode** to remain open/depth>=9.
It does not have to remain below -3%. Evaluate once; an invalid checkpoint is not
a license to retry later. Existing ordinary exits and S/R reductions have priority.

| Case | Extra action at a valid checkpoint |
|---|---|
| baseline | None; observe the same checkpoint |
| blind_half | Pro-rata 50% reduction |
| blind_full | Full exit |
| mfi_half | 50% only if latest available completed 30m MFI14<=20 |
| mfi_full | Full exit only if MFI14<=20 |

Missing MFI does not trigger the experimental exit. Existing protections continue.
MFI uses typical price and actual candle volume, not aggressor flow or HL volume.
It needs 15 completed 30m bars to compute 14 signed flows. June1,2025 is the fixed
seed shared with P01; the latest bucket must be complete and available by decision
time. Unrepaired feature gaps abort, rather than silently filling stale context.

Half-exits reduce quantity and cost pro rata, retaining rung IDs/levels/timestamps,
average entry and lastAddTime. They **block all future adds for that episode**,
including after a later ordinary S/R trim. All ordinary exit rules still run.
Full exits apply the existing forced cooldown to the fill timestamp:
`(floor(fillAt / 4h) + 2) * 4h`, followed by ordinary gates. The simulation runs
the changed exposure and replacement episodes, not a fixed baseline trade list.

## Models and timing

- Recent: May17,2026 20:43 through Sep8,2026 17:47 UTC.
- Published long history: Jul1,2025 through Aug19,2026 21:32 UTC.
- Each starts flat with $32,000. The windows overlap and have different initial
  exposure histories; do not pool them or subtract their net totals as periods.
- Both accepted resting-touch and close-confirmed TP models. Neither is an exact
  maker/native matching-engine simulation or a guaranteed fill bound.
- All new exit decisions use the now-closed minute. They fill at the next bar's
  open, never that just-observed close or the earlier intrabar low.
- Primary: 20 runs including four exact old controls. 60-second source delay:
  eight MFI cases. 60-second additional experimental-order delay: 16 cases.
  **44 runs, four new policy definitions.** Blind rules do not depend on MFI, so
  their source-delay controls are identical and are not redundantly simulated.
- Source delay uses only bars whose end+delay<=decision; at a 30m boundary it
  intentionally uses the previous available bar, just as in P01's sensitivity.
- Additional execution delay preserves the original intent until execution;
  higher-priority ordinary exits can supersede it. No revised future MFI decides
  whether to retrospectively fill that intent. Pending end-of-history orders are
  not fabricated fills.
- Fees: 0.055% per side. Allocated opening and closing fees charged once for each
  reduction, residual marked with its own remaining fee reserve. Actual funding
  settlements, shared-account short PnL and Bybit maintenance margin excluded.
- Extra 5bps each side is a **fixed-resulting-path cost stress**, not a new
  affordability/liquidation replay. Do not label it a full fee-model rerun.

## Verification and limitations

The optional engine hook does nothing without a supplied research controller.
All four B17 result digests and independent accounting must match the accepted
L09 archive before any new variant runs. All other archive sources/raw inputs
are hash-pinned. Two admitted source changes are confined to the research engine
and independent accounting checks, never production bot logic/configuration.

An independent raw-minute audit reconstructs first distress, MFI values from
15x30 constituents, fee allocation, realized/open PnL, adverse-minute equity,
monthly MTM and completed-episode W/L. It checks surviving quantities, no rebuilding,
same-episode identity, full-close cooldown and source/fill availability. Separate
fixtures cover future-data mutation, prefix identity, invalid checkpoints, ordinary
exit priority, delayed execution, and a half-exit followed by an ordinary S/R trim.

Selection is exploratory: the MFI lead was chosen after P01's 109 diagnostic bins,
and its recent examples were concentrated in June/early July. This is not a fresh
holdout. Existing monthly/profit/drawdown screens still apply; even passing those
does not authorize live deployment. A later forward observation period is required.

## Reproduction and artifacts

Run locally from repository root; a fresh `backtests/` output directory is required.

```powershell
npx ts-node scripts/mfi-distress-exit-tests.ts
npx ts-node scripts/mfi-distress-exit-integration-tests.ts
node --max-old-space-size=6144 -r ts-node/register scripts/hype-mfi-distress-exit-study.ts
node --max-old-space-size=6144 -r ts-node/register scripts/mfi-distress-exit-check.ts
```

Default output: `backtests/hype/hype-mfi-distress-exit-2026-09-09/`.
The manifest pins inputs/source/card, and `baseline-parity.json` records exact
controls. `results.json`, `overview.csv`, `monthly.csv`, `comparisons.json` and
`ranking.json` retain all cases, including failures and delayed variants. Each
case has full inventory events, checkpoint observations, close/partial CSVs and
a summary. `verification.json` and `execution-traces.json` come from the separate
raw-data checker. Keep these generated outputs local; preserve the card, scripts,
method and curated findings in version control.
