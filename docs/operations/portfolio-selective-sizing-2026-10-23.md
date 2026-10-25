# Selective sizing: PA07 $20k, other auxiliaries 1.3x

Prepared locally on October 23; **not evidence of deployment**. The operator
selected PAL02 `PA07_3`. No VPS command, exchange request or order was issued here.

## What changes

Explicit new-entry profile `PAL02-PA07-3x-others-1.3x-v1`:
PA07 $20,000; SF08/L2/R5/CRSI $8,666.67 each; R3 $13,000.
The ladder, three shared slots, signals, targets, stops, deadlines, priority and
capital equations are unchanged. Exchange leverage remains 25x; internal budgets
remain main25/aux3. No compounding or automatic resizing to fit available cash.

An absent config field means `HS01-base-v1`, not the new sizing. New reservations
carry their sizing identity. Old untagged reservations remain baseline-sized;
pending submissions, partial fills, terminal history and existing protection are
not rewritten. An invalid sizing config blocks entries/adds, raises health trouble
and refuses Discord resume while reconciliation and owned exits continue.
Status displays the effective profile and new-entry tickets. Config/health
mismatch raises the existing restart-required incident, not a new alert stream.

## Verification

| Check | Result |
|---|---|
| Archived current / uniform1.5 / PA07_3 controls | PASS: every fill, decision, request, cash ledger and minute mark identical; 7,444 receipts and 508 raw candidates per control |
| Production lot rounding bridge | PASS: selected nominal net $90,925.63 versus archived $90,926.30; rounding difference −$0.67. Signals/ladder unchanged |
| Actual source-poll → new tickets → simulated exchange | PASS, including same-clock group, restart, old/new inventory and quantities |
| Pending/ambiguous response/partial fill/late receipt | PASS: original intent retained, no top-up, duplicate submission or premature slot release |
| PA07 3x bracket alongside another short | PASS: partial TP leaves 120 of 200 HYPE; own close cannot consume the other owner's 66.66 HYPE |
| Low capital and fresh pre-submit check | PASS: unsafe new tickets refused; no resizing |
| Legacy synced ledger | PASS: 333 orders / 621 executions load unchanged under the new validator |
| Build and project/VPS types; affected suites | PASS; commands below |
| New sizing observed on real venue / prospective PA07 lifecycle | NOT TESTED; no live action in this pass |
| Full-stack adverse execution with recomputed ladder decisions | NOT TESTED. Stress below changes auxiliary execution only |
| Exchange maintenance-margin/liquidation, depth, subminute fills | NOT TESTED; internal budget is not a liquidation model |
| PAL02 frozen economic screen | FAIL, unchanged. Implementation correctness is not economic qualification |

## Replay checks, not a return forecast

January 1–October 23 19:27 UTC, starting flat at $19,047.16. All history was
previously researched. Fees and settled funding included. Every raw auxiliary
candidate is replayed; a capital refusal changes subsequent occupancy rather than
being deleted from a completed trade log. Independent receipt/funding accounting
and archived-style decision/fill capital proofs agree.

| Execution assumption | Current net / DD | Selected net / DD |
|---|---:|---:|
| Production 0.01-HYPE quantity grid | $78,919 / 34.58% | $90,926 / 33.08% |
| Auxiliary market fills 5bp adverse | $75,861 / 35.16% | $85,741 / 34.05% |
| Also auxiliary fills 1 minute late | $75,338 / 34.88% | $84,944 / 33.59% |

Delay scenario: original admission time and submission quantity retained; timed
non-bracket exits delayed too. Structural stops/targets and original structural
deadlines remain native. Resting-touch main receipts are unchanged, with main
admission checked; the replay aborts rather than pretend a refused rung filled.
This is **not** a full adverse rerun of the main strategy. OHLC cannot establish
venue latency, partial-fill likelihood or the order of events within a minute.

In the last row selected fees are $33,254, funding cost $416, minimum admitted
headroom $2,696, mean losing lot $633 and worst lot −$7,060 (including ladder).
Monthly/source totals, refusals and complete receipts are saved in the evidence
below. Dollar drawdown and a prospective live shadow are not certified by this
compact follow-up; PAL02's nominal dollar DD remains $8,866.56.

## Starting with today's smaller stack

Latest local health: **October 23 19:28:43 UTC, $18,667.09 equity/free, flat**.
Not current exchange evidence. Two fresh flat-start checks use this equity, no
earlier profits, the same historical signal warmup and delayed/adverse auxiliary
execution:

| Fresh start → October 23 | Current net / DD | Selected net / DD |
|---|---:|---:|
| August 1 | $13,827 / 21.22% | $12,419 / 21.90% |
| October 1 | −$2,781 / 23.74% | −$2,395 / 22.09% |

The October selected path refuses **one** new ticket, replays later opportunities
and remains accounting/capital-valid; minimum admitted headroom is only **$81**.
This is not comfortable headroom or a claim that October was profitable.

At the theoretical maximum, ladder $59,757 + PA07 $20,000 + two $8,666.67 slots +
R3 $13,000 require about **$19,324** of internal capital including new auxiliary
fees, before extra stop-risk reserves. This exceeds the dated balance by about
**$657**. Both baseline/selected fixtures at $19,047, $18,667, $15k and $10k preserve
refusals. Do not weaken the guard or raise leverage to force all owners in.

## Risks and release decision

Selected sizing improves full-window profit, but is not a uniformly safer rule.
PAL02's August is $2,101 worse than current, average losses rise, and its gain
over uniform1.5 disappears without July. The fresh August test is worse too.
The operator chose the candidate despite the frozen economic-screen failure.

**Engineering package prepared; automatic activation is not part of the commit.**
Fresh account/order evidence and a paused, reconciled cutover are still required.
No certification is made for the untested items above. The handoff's full
prospective/full-main stress coverage remains incomplete; do not label it passed.
Historical allocation report; the newer October 25 selection has its own
[verification and compatible cutover](portfolio-adx-sizing-2026-10-25.md).

## Reproduction and evidence

Local frozen cards: `research-inputs/portfolio-sizing-pal03-2026-10-23.json`
and `portfolio-sizing-pal03-v2-2026-10-23.json`. Accepted original PAL02 artifacts
are untouched. Final verification:
`backtests/portfolio-sizing-pal03-v2-r3/{manifest,controls,results,complete}.json`.
Each case also has receipt paths and capital checks. Earlier PAL03 directories
are preserved: tests exposed immediate-entry/exit receipt ordering in an
unexercised gap case; the final revision fixes and tests it. No historical raw
candidate had that gap. Final economics reproduce the earlier rows unchanged.

Local research driver: `scripts/portfolio-sizing-verification.cjs` reuses the
existing research replay, adds causal capital hooks and never accesses a venue.
It requires the local research library and sealed data, not just a deployment
checkout. These research-library changes/artifacts are separate from the scoped
runtime deployment package.

Relevant checks (all exit 0): `npm run build`; `npx tsc -p tsconfig.vps.json
--noEmit`; `npx ts-node scripts/portfolio-sizing-tests.ts` (5 groups); foundation
(22), execution (26), attached brackets (27), protection (18), shared account
(12), setup runtime (31), lifecycle (18), commander/status (11), feed health (9),
and local overlap replay (13). Existing crash-child checks were reused.
The release also regenerates/tests/checks the human HTML overview from the staged
deployment tree, not unrelated uncommitted research changes.
