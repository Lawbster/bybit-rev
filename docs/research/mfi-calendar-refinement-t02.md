# MFI calendar refinement T02: reproduction and artifacts

September 7, 2026. Local research only. This is the bounded follow-up to T01,
not a new live policy or permission to broaden a sweep.

## Scope and authoritative evidence

[Findings](../../research/codex-astra-mfi-calendar-refinement-t02-findings-2026-09-07.md)
answer replacement attribution, the two nearby UTC exclusions, and own-hold
11h/13h controls. The
[frozen card](../../research-inputs/indicators/time-gating-t02-2026-09-07.json)
defines every combination before execution.

Accepted folder:
`backtests/hype/hype-mfi-calendar-refinement-t02-2026-09-07/`.

Manifest SHA256: `1a31364f2f5f5106d37ab66fff2aebb12439d4c2e306c616c7f434e552ba5505`

Independent verification SHA256: `41bd3feebfe05b490abea8d82b12b8d39f776c16f280ff954df38f4d1d563e03`

The result is accepted as a **verified historical experiment**, not as a
passing strategy. All five reviewed filters fail the unchanged full screen.
No result replaces or overwrites earlier C01/C02/T01 evidence.

## Exact timing and controls

- MFI7 on completed 15m bars crosses below 10: signed previous >=−0.8,
  current <−0.8. A crossing is evaluated at the source bar's end.
- Preserve the accepted repaired snapshot, June 1, 2025 seed and September 4,
  2026 19:01 UTC cutoff. Full starts July 1, 2025; recent starts May 17,
  2026 20:43 UTC. Both histories have been mined before.
- Only exclude [15,19), [16,20), [17,21) UTC as specified. Test nearby clocks
  at 12h only; test 11h/13h at original [16,20) only.
- Clock is evaluated at original signal time, not delayed fill time.
  A failed signal is discarded. No reopening catch-up entry.
- The 11h/12h/13h timer starts at **actual entry fill**. Exit receives its
  own 0m/+1m delay. At +1m, total signal-to-close is hold +2 minutes.
- Use original timeout-before-new-signal ordering. Pending/open inventory
  prevents another entry. One fixed $10k long, no TP/SL or averaging.
- Hold changes are passed through the explicit `holdMs` engine option.
  The inherited MFI rule's `fixed12h` exit label is its fixed-timeout
  sentinel, not the authoritative duration for T02. Rows record the actual
  `holdHours` and `holdMs`; baseline IDs are MFI11/MFI12/MFI13.
- Changed-hold clock controls retain the inherited clock-long schedule:
  12h UTC grid or immediately on an earlier close, with their own hold.
  CLOCK11/CLOCK13 are mechanical controls, explicitly counted; they are
  not additional indicator candidates or independently tuned entry clocks.
- Every filtered rule has a same-hold unfiltered parent and a readiness-only
  control. A UTC condition never has missing data, so readiness-only paths
  equal their parents and are reused, not rerun as new economic paths.
- Fees 0.055% each side, plus a separate same-path 5bps/side cost stress.
  Before funding; no maker queue/fill simulation. Cutoff inventory is marked
  using the final close and hypothetical closing fee, not counted as a trade.

## Files and responsibilities

| File | Responsibility |
|---|---|
| `scripts/mfi-calendar-refinement.ts` | Pure approved calendar gate and exact-signal replacement accounting |
| `scripts/mfi-calendar-refinement-tests.ts` | Boundary, delay, discard, own-hold, cutoff, occupancy and attribution fixtures |
| `scripts/hype-mfi-calendar-refinement-study.ts` | Pin verification, archived parity, bounded replays and artifact publication |
| `scripts/mfi-calendar-refinement-results-check.ts` | Separate raw-candle MFI, schedule, fees, DD, monthlies and attribution verification |
| `scripts/indicator-entry-context-features.ts` | Unchanged accepted feature/opportunity adapters |
| `scripts/indicator-entry-context-policy.ts` | Unchanged entry-context engine wrapper |
| `scripts/indicator-combination-engine.ts` | Unchanged one-position replay, execution and account marking |
| `scripts/indicator-combination-analysis.ts` | Unchanged path diagnostics and research screens |

The checker does not import the new gate, attribution helper, or replay
engine. It independently rebuilds MFI using the existing independent
volume-flow reference. New closed-price descriptors are also rebuilt.
Existing descriptive RSI/CRSI/ADX/ATR/RVOL fields are reconciled to the
previously validated pinned implementation, not given a second mathematical
implementation in this study.

## Reproduction

PowerShell, repository root, **local machine only**. These do not read API
keys, submit orders, write bot-state, call PM2, or touch signal files.

```powershell
npx.cmd ts-node scripts/mfi-calendar-refinement-tests.ts
npx.cmd ts-node scripts/indicator-entry-context-tests.ts
npx.cmd ts-node scripts/indicator-combination-tests.ts

# A new directory is mandatory. Do not overwrite accepted artifacts.
npx.cmd ts-node scripts/hype-mfi-calendar-refinement-study.ts --out backtests/hype/hype-mfi-calendar-refinement-t02-2026-09-07-rerun
npx.cmd ts-node scripts/mfi-calendar-refinement-results-check.ts backtests/hype/hype-mfi-calendar-refinement-t02-2026-09-07-rerun

npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
git diff --check
```

The runner deliberately aborts if a pinned source/input/artifact has changed.
Do not remove that protection just to run on newly pulled candles. A fresh
data cutoff or changed research source requires a separate documented card.
The two 11h/13h unfiltered MFI paths match the inherited standalone engine,
not a fabricated archival baseline that did not previously exist.

The runner's immutable `validation.json` says independent verification is
pending at publication time. The subsequently written
`verification.json: passed=true` is the authoritative completion record.
A missing/failed independent record means the study is not accepted.

## Artifact schema and how to use it

| Artifact | Use |
|---|---|
| `manifest.json` | Frozen card, source hashes, copied input hashes, protected live-file hashes, runtime version |
| `inputs/` | Exact copied T01 historical/stream/repair files; no latest-data rebaseline |
| `results.json`, `summary.csv` | Own-hold baseline and filter W/L, dollars, net, fees, DD, stress |
| `trades.jsonl` | Completed fills and entry features, keyed by window/delay/rule |
| `decisions.jsonl` | Every MFI crossing, provenance, calendar decision, occupancy result |
| `monthly.json/csv` | Marked calendar-month net plus completed-trade W/L; own-hold baseline deltas |
| `replacement-attribution.json` | All five filters × four cases: exact common/removed/new cohorts, blocker links, episodes, descriptor distributions |
| `changed-trades.csv` | Original T01-05 changed trades in all four cases, with closed pre-entry descriptors |
| `diagnostics.json` | Adverse paths, extreme trades and ex-post exposure-scaled own-parent controls |
| `causal-traces.json` | Accepted and rejected source-timed example per filter |
| `overlap-parity.json` | Twelve exact archived-case comparisons |
| `availability-controls.json` | Twenty readiness logical controls and explicit reuse |
| `ranking.json`, `shortlist.json` | Five rankings, all failure reasons, zero complete qualifiers |
| `verification.json` | Independent proof counts and artifact hashes |

All event times are UTC epoch milliseconds. A new trade is one whose exact
`signalAt` is absent from the same-hold parent ledger. Its
`oppositeBlockingSignalAt` identifies the parent inventory that skipped it.
A removed trade is either directly calendar-blocked or subsequently
displaced by variant inventory. Common trades must be numerically identical.

An episode is a connected set of overlapping changed inventory intervals,
including pending-entry time. Episodes have no future role in the policy:
they are descriptive after-the-fact attribution only. Top-episode removal
sensitivities subtract saved contributions; they are **not** alternate
counterfactual replays with rebuilt occupancy.

`signalMonthContributions` allocates eventual completed PnL by entry signal
month. It is **not** marked monthly PnL; do not use it for the monthly screen.
Open-mark differences reconcile separately from completed contributions.
Original T01-05 has zero open difference; 13h parent/filter each carry the
same open position at the cutoff.

## Counts and acceptance boundary

Four new filters, two new MFI hold baselines and two new clock controls add
eight definitions. Original T01-05/MFI12/clock12 are repeated. There are
44 primary economic cases and 20 reused readiness logical cases: 64 total.

Independent verification checked 20,213 completed ledger rows, 25,948
decisions, 640 marked month rows and 1,355 changed-trade rows. These totals
include overlapping windows and duplicated readiness paths; never report
them as independent trades. Twelve archived cases matched exactly and
eleven real-data prefix comparisons passed.

The profit screen still requires +$500 full /+$200 recent in both delays,
DD no worse and every marked monthly parent/readiness delta >=−$320,
along with sample/net/stress/solvency checks. The defense screen additionally
requires 90% positive-parent retention, fewer losing dollars, full DD at
least 20% and 1pp lower, recent DD no worse and improvement beyond simple
exposure scaling. Strict-clock screening is separate. No threshold was
relaxed after results.

These results do not establish a universal session effect, a causal
institutional-flow story, a new RSI/RVOL threshold, or a live-ladder gate.
S01, broader R01, HL/S/R combinations and actual ladder transfer remain
outside this run.

