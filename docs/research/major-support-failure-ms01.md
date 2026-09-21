# MS01: major-support failure, fresh ladders only

September 16, 2026. Research only. Rules and screen frozen before economic outcomes in the [experiment card](../../research-inputs/macro-support-entry-ms01-2026-09-16.json).

## Question and boundary

Does blocking a new Agg10 ladder after a known major support fails improve complete portfolio outcomes? Existing ladders, their adds, 14-day local S/R partial exits, Agg10 high exits, TP and cooldowns remain unchanged. No manual $75.401 level, new short, sizing rule or live mutation.

Reuse the verified 120-day, closed-4h macro observer. A strict pivot needs three completed bars to its right; zones need two distinct touches at least 24 hours apart, with frozen center and 0.75% half-width. Daily levels are not tuned in this checkpoint.

## Four frozen variants

| Variant | Eligible support | Release |
|---|---|---|
| any_reclaim | Any qualified support | Two closes above the same upper edge, or retirement |
| flip_reclaim | Resistance origin, now confirmed support | Same |
| any_24h | Any qualified support | Same, or 24 hours after failure |
| flip_24h | Resistance origin, now confirmed support | Same, or 24 hours after failure |

One authoritative watch: nearest upper edge below the completed close, no more than 3% away; ties use touch count, first-known time, then ID. Selection occurs before failure, not retrospectively. While above the watched upper edge, reassess proximity; inside/below the zone, retain its frozen ID and bounds. Two subsequent consecutive closes below the lower edge trigger the block. The shared macro observer must independently report failure for that ID.

Only otherwise eligible, affordable rung-1 entries are vetoed. A failure can become known while holding inventory, but cannot block deeper adds or trigger an exit. While blocked, do not accumulate other levels. Release requires healthy source data; gaps reset consecutive counts. After timeout a still-broken zone cannot immediately re-arm. Macro state carries through pre-window history, while each portfolio starts flat.

## Comparison and accounting

- Recent: May 17, 2026 20:43 through September 15, 2026 20:20 UTC.
- Older/published: July 1, 2025 through August 19, 2026 21:32 UTC.
- Overlapping windows, not independent holdouts; do not sum profits.
- Eight exact archived B17/Agg10 controls, sixteen primary paths (four variants × two windows × two TP models), eight recent +60-second macro-publication sensitivities. Four new definitions, 32 paths.
- Controls must match SRM01 archived raw digests and metrics before alternatives run. Unchanged canonical causal engine and current Agg10 parent.
- $32,000 flat-start equity, $800 × 1.35 up to 11 rungs; standard 0.055% per side. Ending inventory is marked with exit fee. No maker fee bonus, funding cash settlements or liquidation certification; this is not a simulation of today's $19,450 account.
- Resting-touch is the principal TP model; close-confirmed is a sensitivity, not a proposed change to live TP. The extra 60-second delay applies only to the new macro gate.
- Report complete wins/losses and amounts, monthly marked net, DD, missed and replacement completed episodes, distinct failure events that actually veto entries, and open inventory. Minute veto checks are not independent signals.
- Disjoint overlapping episode components show concentration. Removing a component's contribution arithmetically is not a counterfactual rerun; ending open/unfinished contributions remain separate.

Frozen screen: recent net gain at least $1,000; older gain nonnegative; no month worse by over $250; no DD deterioration; at least twenty affected distinct failures in each recent primary model; delayed net nonnegative. Passing would still require forward observation and separate live engineering approval.

## Verification and commands

Source/config/data/state pins; immutable jobs; independent reaggregation and pivot availability/bounds/role checks; exact original macro chronology; past-only prefixes; independently reconstructed watch/block/release state; every allowed/vetoed entry and non-first add; ledger fees/quantities/monthly mark/DD; TP arming and high-exit clocks; actual S/R partial decisions with original pulse inputs. Synthetic tests include checker-corruption rejection.

```powershell
npx ts-node scripts/macro-support-tests.ts
npx ts-node scripts/macro-support-study.ts plan
node --max-old-space-size=8192 -r ts-node/register scripts/macro-support-study.ts run KEY
node --max-old-space-size=8192 -r ts-node/register scripts/macro-support-verify.ts KEY
```

No outcome is available when this method is written. Do not tune definitions after inspecting results or overwrite a claimed run.

## Completed checkpoint

[Full findings](../../research/codex-astra-major-support-failure-findings-2026-09-16.md): all 32 paths and the independent audit completed. Eight archived controls match exactly. None of the four definitions passes the complete frozen screen. Reclaim-only improves recent resting-touch DD/net but loses substantially under the alternative fill model and older window; the 24h cap removes profitable recent cycles without removing completed resting-model losses.

Job: `e8c9e0c1d591deca41a16488dab26dc82c9ceebe6bed5a7b99f537302a1c63a2`. Raw evidence, monthly W/L CSV, comparisons, attribution and verification receipt are under `backtests/research-workflow/<key>/`. Live partial exits and all live settings remain unchanged.
