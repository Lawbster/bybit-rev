# L12: adjacent high horizons and a fixed BTC exception

Frozen before economic results, September 10, 2026. Local research only. No trading, live configuration, state, sizing or deployment changes.

## Question and scope

Follow L11 with rolling **2/3/4/5/6-day highs**, alongside its existing 1/7/30-day references. Test whether BTC remaining strong usefully relaxes the experimental deep-add block. Do not equate a recent high with proven resistance or rejection.

- Raw extensions: 2/3/4/5/6 days x 1%/2% proximity x separate deep-add block/stale full exit = **20 definitions**.
- BTC extension: 1/2/3/4/5/6/7/30 days x 1%/2% HYPE proximity, add blocks only = **16 definitions**.
- Same baseline B17: $32,000 initial equity; $800 x1.35, max11; existing gates, damaged latch, S/R partial/reopen, stale/forced exits. Shorts not included. Discovery fees remain 0.055% per side, without maker uplift or long-funding settlement.
- High-only new blocks apply to otherwise-approved, affordable nextDepth>=8 timer AND true price-drop adds. No initial/shallow-entry block and no gate override.
- Stale exit applies at any occupied depth once the oldest surviving rung is >=4h old and HYPE is near its reference high. Ordinary exits and pending intentions retain priority. Next-minute-open full close, with the unchanged non-TP cooldown until the second 4h boundary after fill (4–8h). No loss-only selection or new PnL floor.

## BTC definition and causality

BTC strong = its latest available completed-minute close is within **1% of its own matching-N-day rolling high**, AND its **4h closed-close return is nonnegative**. These thresholds are fixed, not searched.

Only if the new HYPE rule would veto an otherwise-approved deep add, and both HYPE and BTC context are known, may BTC strength remove that experimental veto. BTC weakening or missing retains the original experimental block. BTC never overrides existing trend/risk/latch/funding/SR approvals. No BTC exception to stale exits.

Rolling high needs exactly N*1440 continuous closed minute bars. BTC needs an exact completed source at decision time and an exact closed price four hours earlier. Gaps are not forward-filled. Existing BTC risk-gate calculations remain unchanged; the new stricter context is separate. Current HYPE breakouts count as near-high, including above an older reference.

Source60 sensitivity delays HYPE reference-high availability and all BTC strength inputs 60s. HYPE's current closed decision price remains observed. No eventual calendar high, future candle or same-bar wick execution is used.

The local BTC history has missing minutes, including an older multi-week gap. Coverage is audited by horizon/window and on actual raw-veto opportunities. Unknown BTC means **no exception**, not evidence of weakness. Long horizons can be coverage-limited for weeks after even a one-minute gap. Do not reject the entire BTC concept based on a heavily coverage-limited rule.

## Economics and reuse

Use the exact L11 snapshot/windows, not a silent latest-data refresh:

- Published: 2025-07-01 00:00 UTC through 2026-08-19 21:32 UTC.
- Recent: 2026-05-17 20:43 UTC through 2026-09-10 05:08 UTC.
- Separate close-confirmed and resting-touch TP assumptions in each window.
- Six fresh exact control reproductions, including the two original September8 recent controls.
- 36*4 primary +36*2 recent/source60 +6 controls = **222 new economic executions**.
- Raw 1/7/30-day peers are reused from independently verified L11. Reused rows are not counted as new definitions or executions. For each BTC variant report both change versus unchanged B17 and versus its matching raw high-only rule.

Frozen primary screen: recent net delta >=$1,000 under both TP models, published net delta >=0, no increased max drawdown, no monthly MTM delta below -$250, >=20 intervention episodes in each recent model, no modeled nonpositive equity. Source-delay robustness is reviewed separately. These are overlapping previously researched windows, not untouched validation. No live qualification from retrospective testing alone.

## Verification and outputs

Card: `research-inputs/near-high-btc-extension-2026-09-10.json`.

Worker/policy: `scripts/hype-near-high-extension-study.ts`, `scripts/near-high-extension-policy.ts`. Neither changes the canonical replay engine or live bot.

Tests: `npx ts-node scripts/near-high-extension-tests.ts`. Independent audit: `npx ts-node scripts/near-high-extension-verify.ts JOB_KEY`. Framework hashes are a separate integrity check, not evidence of economic qualification.

The independent audit recomputes HYPE and gapped BTC highs using prefix/suffix maxima, all effective/raw vetoes, BTC closed-close timing and missingness, every occupied stale-exit decision, next-open fills, cooldowns, fees, MTM/monthly accounting, baseline parity and matched/replacement attribution.

Artifacts include results, ranking, baseline comparisons, BTC-versus-raw comparisons, monthly/overview CSVs, BTC coverage/gap audit, high-index arrays, every add permission, every occupied exit hook, complete inventory ledgers, and first intervention/leniency traces per episode. Final report must show baseline-adjacent wins/losses, winning/losing dollars, final open mark, unfinished partial PnL, net and drawdown; monthly deltas and sacrificed/replacement TP cycles are mandatory.
