# Reuse-first research workflow

Updated 2026-09-20. Local research tooling only. Astra remains Extra High by operator
choice. No model settings, live config, strategy, accepted engine or artifact
is changed by this workflow.

## What changes

1. **Read a checkpoint, not months of chat.** Start at
   `research/CURRENT-CHECKPOINT.md`; load the relevant method/card/findings.
   Search the tested register for lineage, not the entire raw-data library.
2. **Inspect saved results before executing.** An accepted unchanged job is
   read, not rerun. Existing `research-workflow.ts` and study-specific runners
   already fingerprint inputs and reject duplicates. Keep using them; do not
   introduce another dispatcher or treat all study entrypoints as identical.
3. **Reuse engines and datasets.** Import existing execution/accounting helpers,
   use saved causal maps/features, and write only the new policy or thin driver.
   Do not clone an engine, map builder or report generator for each threshold.
4. **Work single-agent by default.** Spawn subagents only when the user explicitly
   requests them. Astra handles design, implementation, causality and final review
   directly. Keep implementation scoped and verification proportional to risk.
   If delegation is requested, use a bounded brief, avoid duplicated work, and
   do not delegate when doing the task directly would be cheaper.
5. **Return evidence references, not dumps.** Save full local execution logs and
   detailed tables. Show command status, compact summary, anomalies and paths.
   Prefer existing report slices to repeatedly generating extraction programs.

The optional worker template below is not permission to spawn agents. Use it
only after an explicit user request. Official guidance notes that comparable
subagent workflows consume more tokens; no cost saving is assumed.
[Official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Reuse decision before every run

| Request | Action |
|---|---|
| Explain/rank an already accepted run | Read saved report and the required ledger rows; no replay |
| New table from the same evidence | Reuse report/inspection tooling; preserve original artifacts |
| New filter/exit/parameter | New frozen card and minimal adapter; exact parent controls before variants |
| New candles or changed engine/map/source timing | New input identity and relevant parity/causality checks; never label stale cache current |

No cache hit is inferred from a filename, mtime, `latest.json`, or a saved
`passed: true`. Before consuming evidence for a new run, use the existing
source/output hash checks. Preserve accepted input clocks, same-bar ambiguity
semantics, fees, cutoffs and missing-data policy. Do not edit a pinned shared
source and silently accept a changed historical baseline.

## Compact inspection command

```powershell
# Shape only: array lengths and object fields, not full contents.
npx ts-node scripts/research-peek.ts research-inputs/high-touch-poc-ht02-2026-09-17.json

# Scalars from a small manifest; JSON pointers select exact fields.
npx ts-node scripts/research-peek.ts backtests/high-touch-poc/latest.json /key /accepted /directory
```

`research-peek.ts` is read-only, supports JSON/gzip, and bounds input/output.
It refuses large files instead of flooding context; use the existing study
report for large journals. Objects/arrays are summarized, not silently treated
as the whole dataset. This command does **not** verify hashes or economic
correctness and is not a replacement for the independent verifier.

Tests: `npx ts-node scripts/research-peek-tests.ts`.

## Worker brief template (explicit user request only)

Only when the user requests delegation, copy this into a short spawn brief;
use only the relevant files. Give code ownership to one worker per file, and
do not ask the reviewer to rebuild the same implementation independently.
Use the requested scope and current model settings, not a fixed worker-model
recommendation from this document. No nested delegation or full-history forks.

```text
Task: <one bounded implementation or extraction>
Delegation requested: <user's explicit request and scope>.
Role/model: <requested role; user-selected or current configured model/effort>.
Read: AGENTS.md + <method/card> + <relevant reference files>.
Parent/job: <exact immutable key, data cutoff, baseline definition>.
Own/edit: <explicit files>; all other files are read-only.
Reuse: <engine/functions, saved map/features, report/check commands>.
Change: <one frozen behavior and acceptance criteria>.
Do not change: live files, parent definitions, accepted artifacts, clocks,
fees, execution priority, monthly screen, or trial inventory.
Verify: <focused tests and required baseline/causality checks>.
Return: files, command results, anomalies, artifact paths; <=200 words.
No nested agents, no parameter expansion, no raw-data dumps.
```

## Verification is unchanged

For **new economic work**, not a read-only question. Independent verification
means separate evidence/checks, not a requirement to spawn a reviewer:

- Reproduce exact own-parent baseline before variants; use canonical ladder
  parity when testing the ladder, not as a substitute for standalone controls.
- Audit the new decision's availability clock, future-data poisoning and
  incomplete-bar behavior; trace actual decisions to original sources.
- Retain independent receipt/accounting checks, full occupancy and replacement
  trades, cutoff inventory, both applicable TP/ambiguity assumptions, and delays.
- Keep baseline-adjacent W/L, winning/losing dollars, average loss, marked versus
  realized net, DD, monthly deltas, concentration and costs. No monthly-screen
  relaxation. A verified run can still have zero qualifying strategies.
- The main Astra agent reviews the diff and acceptance evidence. Stop on
  unexplained baseline divergence rather than patching the expected output.

## Handoff and progress discipline

Completed-study storage: use [research archive](research-archive.md) and the
explicit `research-archive-config.json` queue. Run `npm run research:archive -- plan`
before `run`; preserve accepted inputs/outputs. A local OneDrive publication is
not cloud confirmation and does not authorize deletion. Restore archived inputs
to their original paths and verify hashes before replays, never during them.

Update `CURRENT-CHECKPOINT.md` after each completed checkpoint with the exact
key, selected references, unresolved question and what was **not** tested.
Keep it a short navigation aid, not a second findings document. A new chat can
start there without pasting this full conversation.

Avoid broad `git status` untracked dumps, repeated full-file reads and busy
polling. Scope status/diffs to task paths; use `rg -n` and selected ranges.
Return complete selected instruction files when required, but select only
relevant references. Keep expensive local jobs running to completion and
inspect their saved logs; the simulation itself does not require model turns.

No quota-saving percentage is promised. Compare comparable future research
passes for generated/reasoning/input tokens and duplicated work; do not run
extra studies or discard verification just to demonstrate savings.
