# L2/R5 sizing update — October 25

Original pre-deployment verification report. Subsequent operator health confirms
AA01 loaded on October 25; the October 26 deposit/equity record is in the
[runbook](portfolio-live.md). The historical checks below retain their original
capital assumptions. No VPS commands, credentials or exchange orders were used
in this verification. The operator selected AA01 despite
its failed economic screen; this package implements that choice, not a new
profitability endorsement.

## Change

Profile `AA01-PA07-3x-L2-R5-2x-others-1.3x-v1` raises new L2 and R5 tickets to
`(20000/3)*2`, or **$13,333.33 each** before quantity rounding. PA07 stays $20k,
SF08/CRSI $8,666.67, R3 $13k. Ladder, slots, signal clocks, exits, priority,
leverage and capital guards are unchanged. No additional ADX gate.

Existing baseline and October 23 profile meanings are preserved. Old positions,
partial fills, pending submissions and protections are not resized on restart.
Status displays each source's new-entry ticket. Commander/watchdog still require
configuration and running profile to agree; no extra alert family was added.

## Verification

- **Exact controls:** parent and selected AA01 paths, both 2026 and continuous
  older history; every fill, request, decision, saved ledger summary/monthly and
  lot record matches. No allocation search was repeated.
- **Live wiring:** production 0.01-HYPE rounding, actual source-poll to allocation
  and simulated exchange, same-clock slot competition, mixed sizing, partial
  and ambiguous receipts, restart, compatible rollback and low-capital refusal.
  L2/R5 request 133.33 HYPE at $100; old orders keep their original quantity.
- **Causal capital:** refused auxiliary tickets change occupancy and later
  opportunities. Independent cash/funding and capital checks pass all 12 paths.
  Every archived main add still passes admission; no refused main add was
  fabricated. Guards were not relaxed.
- **Checks:** sizing 6 groups, setup runtime 32 cases, Commander/status 11
  groups; project and VPS typechecks, build, HTML generation/test/check. The
  staged release is checked separately from unrelated local research edits.

## Replay cross-check, not expected returns

2026 fresh-flat $19,047.16, January 1 → October 23 19:27 UTC; fees/funding included.
Every window was previously researched. Adverse scenarios alter **auxiliary**
execution, not the archived main ladder's fills/decisions.

| Execution | Previous selection net / DD | New selection net / DD |
|---|---:|---:|
| Production quantity grid | $90,926 / 33.08% | $95,311 / 34.10% |
| Auxiliary market fills 5bp adverse | $85,741 / 34.05% | $89,664 / 35.19% |
| Also auxiliary fills 1 minute late | $84,944 / 33.59% | $88,731 / 34.66% |

Original admission and submitted quantity are retained under delay. Timed exits
are delayed; structural targets/stops and deadlines remain native. Minimum
new-selection admitted headroom is $833 in the last row. These are not
order-book, exchange liquidation or full-stack adverse-execution tests.

Fresh-flat starts with **$18,667.09**, no inherited profits, delayed/adverse
auxiliary execution, through the same cutoff:

| Start | Previous selection net / DD | New selection net / DD | New capital refusals |
|---|---:|---:|---:|
| August 1 | $12,419 / 21.90% | $13,510 / 21.45% | 0 |
| October 1 | −$2,395 / 22.09% | −$2,022 / 20.97% | 2 |

The older continuous nominal paths were capital-infeasible. With actual
auxiliary refusals and subsequent opportunities replayed, each refuses one
ticket and passes the independent capital proof: parent $209,065 / 47.45% DD;
new $215,866 / 42.61% DD. Main admission remains feasible on both corrected
paths. These replace the impossible nominal paths **for this capital model
only**; they do not establish venue-level executability or prospective returns.

## Capital and deployment

The snapshot used for this verification was **October 23 19:28:43 UTC**,
equity/free $18,667.09, flat and no pending orders. It is not current account
evidence; subsequent capital and deployment reports are recorded in the runbook.

Maximum ladder + PA07 + L2 + R5 + R3 is about $119,424 gross and requires
**$22,464** internally including new auxiliary fees, before extra bracket
reserves: about $3,797 more than the dated balance. New trades/adds may therefore
be refused. No compounding, resizing to fit, leverage increase or forced close
was introduced.

**Economic screen remains FAIL.** AA01's 34.10% observed 2026 drawdown is not a
loss cap; monthly, percentage-DD, average-loss and multiplicity checks failed.
No new-profile live fills have been witnessed. Follow the
[paused cutover and compatible profile rollback](portfolio-live.md#october-25-adx-sizing).
Do not roll back to a binary unable to read AA01-tagged historical orders.
Record the effective restart UTC/profile separately; SA01 remains immutable.

## Evidence

Local card: `research-inputs/portfolio-sizing-aa02-2026-10-25.json`.
Final accepted output: `backtests/portfolio-sizing-aa02/` — manifest, exact
controls, results, receipt paths, capital checks and completion seal.
Run with `node -r ts-node/register/transpile-only scripts/portfolio-sizing-verification.cjs research-inputs/portfolio-sizing-aa02-2026-10-25.json`.
The reused research driver/library and raw artifacts remain local, separate
from the scoped production deployment commit.

Two development attempts are retained but **not accepted**: the serialization
check encountered JSON's normalization of negative zero; the scope check exposed
an aliasing bug in the new verification adapter that truncated the second
profile's main path. The final driver isolates each scope and asserts the
zero-stress result still equals its sealed control after fresh-start cases.
No production engine, frozen hypothesis or expected result was changed.
