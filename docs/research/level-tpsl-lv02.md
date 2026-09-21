# LV02: fixed-percentage TP/SL grid on saved level entries

Frozen September 17, 2026. User-requested research, not a live strategy change.
[Card](../../research-inputs/level-tpsl-lv02-2026-09-17.json).

## Question and scope

LV01 tested 12h exits and reaction/level-derived stops with a 2R target. That does
not answer whether fixed percentage targets/stops suit these intraday signals.
LV02 retains the signal definitions and changes exit distances explicitly.

- TP = 2%, 2.5%, 3%, 3.5%, 4%, 4.5%, 5%.
- SL = the same seven values, independently varied: all **49 pairs**.
- All 32 LV01 raw entry streams, **long-only and short-only independently**.
- Original PB02 daily NPOC touch long added as the familiar reference entry.
- 65 entry/direction groups, 3,185 percentage-exit definitions; 64 new directional
  12h references plus the previously tested PB02 reference. This is 3,249 additional
  economic definitions, not 38,610 independent confirmations.

No entry-threshold, confirmation-timeframe, session, HL, indicator-combination,
map or position-size search. No reverse-signal strategy. Values below 2% or above
5% are outside this first declared grid, not ruled out.

## Price, timing and ownership

Entry follows each saved signal's existing confirmation/availability clock.
Use actual delayed minute-open execution price. **TP and SL are percentages of
that fill**, not of the earlier signal close or the reference level.

Long: target = fill x (1 + TP); stop = fill x (1 - SL).
Short: target = fill x (1 - TP); stop = fill x (1 + SL).

Resting barriers assumed armed immediately after entry. First touch closes;
gaps beyond barriers close at actual open. If a one-minute bar touches both,
stop-first is primary and target-first is sensitivity. A gap stop takes priority
over an intrabar target even in target-first mode. This is a price-path model,
not measured stop/limit placement latency, spread or maker-queue execution.

Keep the existing **12h maximum hold**, plus any declared extra exit-action lag.
The target/stop can close at any earlier minute; timeout is a separate reason
and dollar contribution in every row. This is not an unrestricted multi-day hold
or a claim that a 5% target will necessarily be reached intraday.

Filter direction BEFORE executing ownership. Every raw signal can enter when its
own strategy is flat; signals while occupied are skipped. Do not subtract the
opposite direction's fills from a mixed replay. Do not inherit LV01 bracket-risk
eligibility, since its level-derived stop no longer applies. An intrabar close
cannot release the opening price of that same minute for another entry.

## Accounting and comparisons

Canonical historical window December 5, 2024 12:55 to September 15, 2026 20:20 UTC;
June 1, 2026 reset split. Full/older/recent and additional 0/60s action delays.
Fixed $10k entry notional; $32k initial equity, no compounding or ladder.
0.055% taker fees each actual side, before funding; additional 5bps/side stress.
Cutoff inventory is marked, not silently closed or counted as a completed win.

Every cell reports its own **2% TP / 2% SL** reference and its own **12h no-barrier**
reference alongside net, wins/losses, winning/losing amounts, average loss, DD,
TP/SL/timeout counts and dollar contributions. A win is after fees; target-hit
rate is separate. Full-net and win-rate rankings are distinct. High win rate
alone does not certify favorable expectancy.

The frozen complete screen stays unchanged from LV01: positive net and stressed
net in all six window/delay paths; minimum 30 full and ten per subwindow closes;
no exhausted equity; every marked month at least -$250 versus cash. Relative
upgrade additionally requires positive net, nonworse DD and no monthly regression
beyond $250 against its own 2/2 reference across all six paths. Report failures,
not just winners. These are already-mined history partitions, not a holdout.

## Preservation and verification

Reuse accepted LV01 candles/level map/signals; no regeneration. Reproduce all 192
LV01 mixed timed paths and six PB02 paths before the new sweep. Signed zero is
compared in its stored JSON representation; no rounding of economic values.

Each entry/direction group has a `.journals.gz` file of independent gzip members.
`results.json` supplies member offset/length. Each member stores a complete
path's options, fills, accepted signals, cutoff inventory, equity curve, monthly
ledger and stats. Target-first paths with no both-hit ambiguity point to the
identical primary member, preserving storage without inventing a rerun.

Independent auditor checks every path's fill-anchored barriers, first hits, gaps,
fees, ownership, R, open inventory and monthly marks. It verifies minute DD for
all timed paths, every equal-TP/SL diagonal, and the 2/5 and 5/2 corners. Remaining
DD values use the same previously validated replay kernel; they are not claimed
to have each received an independent minute-DD reconstruction.

```powershell
npx ts-node scripts/level-tpsl-tests.ts
npx ts-node scripts/level-tpsl-study.ts
npx ts-node scripts/level-tpsl-verify.ts
```

Identical jobs cannot overwrite existing outputs. No live files, signal controls,
exchange calls or PM2 actions. The new definition count lifts the cumulative
inventory from 5,607 to **8,856 standalone definitions / 205 ladder overlays**.

## Completed checkpoint

[Findings](../../research/codex-astra-level-tpsl-findings-2026-09-17.md) /
[baseline-adjacent tables and monthly deltas](../../backtests/level-tpsl-reports/43dd21c761283a5d7a56b70252dab807b6ad8595d22a5ac60e8c9a0e7f1e0520/review.md) /
[all grids](../../backtests/level-tpsl-reports/43dd21c761283a5d7a56b70252dab807b6ad8595d22a5ac60e8c9a0e7f1e0520/grids.md).
Accepted job `43dd21c761283a5d7a56b70252dab807b6ad8595d22a5ac60e8c9a0e7f1e0520`.
198 controls match; independent first-hit/ownership/accounting audit passed;
38,610 paths. No complete-screen qualifier. No live changes.

The derived presentation is separate from immutable economic output:

```powershell
npx ts-node scripts/level-tpsl-report.ts
```

It reads saved journals only, refuses to overwrite an existing report directory,
and produces selected trade CSVs plus full grid/monthly Markdown. Do not rerun
the producer merely to read or compare its existing results.
