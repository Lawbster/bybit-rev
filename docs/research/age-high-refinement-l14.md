# L14: refine the 8h + two-day-high pair

September 11, 2026. Local research only; no production/configuration changes.

Completed and independently verified. [Findings](../../research/codex-astra-age-high-refinement-findings-2026-09-11.md).
Accepted key: `4db33309cc7f9399f07f89d979b191752e227c64582928dc02c38aeca715fd3a`.
170 cases,20 exact controls;722,334 fills and54,118,840 minute marks checked.
3/24 aggregate net/DD improvements across four cases;0/24 full monthly passes.

## Question and frozen scope

Can the L13 pair's aggregate profit/loss improvement be made less sensitive to
older months, TP execution assumptions, and local parameter choices? The pair
is a research lead, not a monthly-screen pass. Its recent drawdown also exceeds
that of age8 alone, despite beating the current B17 baseline.

[Frozen card](../../research-inputs/age-high-refinement-2026-09-11.json):

| Axis | Follow-ups, all other parent settings unchanged |
|---|---|
| Ordinary soft-stale deferral cap | 6h, 10h, 12h versus parent 8h |
| Distance below trailing high | 0.5%, 0.75%, 1.25%, 1.5%, 2% versus 1% |
| Minimum surviving-rung age for high exit | 5h, 6h, 8h versus 4h |
| Rolling high horizon | 1, 3, 5, 6 days versus 2 days |
| One companion added to parent | half11; remove deep funding guard; remove S/R partials; remove hot-RSI TP cooldown |
| Two companions added to parent | half11 + each of those three removals; deep-guard removal + S/R removal; deep-guard removal + RSI-cooldown removal |

15 local-setting variants and 9 compositions = **24 new definitions**. No
full Cartesian grid, parameter changes after results, shorts, simultaneous
MFI/high reduction owners, or removals of trend/latch/emergency/forced cooldown.
MFI + age8 already detracted from recent profit in both TP models with sparse
interventions; it is not promoted into another exit owner here. The companion
removals have mixed past results, not a presumption that removal is preferable.

## Controls, periods and execution

20 exact digest/metric controls precede all new variants: L13 baseline,
age8, standalone high2d1, and their pair in four period/model cases (16), plus
the two L09 removal singles in the older period/models (4). Refresh those two
singles in the recent window (4). Then 24 variants x4 cases (96), followed by
parent +24 variants x2 recent models with the high source delayed 60s (50).
**170 fresh executions,120 aligned primary rows.** Existing half11/deep-guard
single peers are reused from verified, identically dated L13 results.

- Older: July 1, 2025 00:00 through August 19, 2026 21:32 UTC.
- Recent: May 17, 2026 20:43 through September 10, 2026 05:08 UTC.
- $32,000 initially flat, $800 x1.35, maximum11, original0.055% per-side fees.
- Same repaired canonical engine, inherited pulse/BTC/latch, transactional
  partial clocks and all unnamed current controls. Both resting-touch and
  close-confirmed TP models; these are different occupancy paths.
- Completed source bars only. Discretionary exits fill at next minute OPEN,
  never the observed high itself. Source60 delays only the rolling-high
  reference, retaining the current HYPE decision price. It is not a market-fill
  latency or maker-queue test. The windows overlap and have been mined before.

Parent semantics: one-way extension of the ordinary 4h soft-stale permission
until surviving-rung age8h, retaining1.4% rather than0.5% while deferred. The
separate high rule can preempt it at age4h: full exit at any depth when the
closed-minute price is within1% of the maximum over2880 contiguous completed
minutes. Unknown coverage cannot force an exit. No PnL floor or new entry veto.
Original ordinary full exits and S/R partials retain priority; full research
exits use the original4-8h boundary cooldown. This is not an8h minimum hold.

## Verification and interpretation

[Worker](../../scripts/hype-age-high-refinement-study.ts),
[policy](../../scripts/age-high-refinement-policy.ts),
[independent audit](../../scripts/age-high-refinement-audit.ts),
[verifier](../../scripts/age-high-refinement-verify.ts),
[tests](../../scripts/age-high-refinement-tests.ts).

Tests cover future-prefix invariance, unknown context, thresholds, every age
cap, clone isolation, exact reduced rung size, fee accounting and cooldown.
Verification separately reconstructs raw rolling maxima with a different
algorithm, every occupied-minute high permission, next-open fills, TP target
creation/rearming, all-minute marked equity/DD, monthly accounting and result
comparisons. All target rearm events are logged, even identical-price rearming
after an add or partial. Original L13 sources are unchanged.

Report B17 and the original pair beside every result. Include completed ladder
W/L and winning/losing dollars, open/unfinished marks, net, drawdown, monthly
MTM and losing dollars. Compare each composition with its companion singles;
do not add independent profits. Separate matched, removed, replacement and
ending-inventory contributions. Rank on smaller recent-model net uplift,
then display older and monthly costs without hiding them.

Inherited strict screen: recent net delta >=$1,000 in both models, older delta
>=0, no DD increase, every monthly delta >=-$250, at least20 recent intervention
episodes, no modeled nonpositive equity. Show aggregate improvement separately
from strict qualification. Target/high sample counts do not establish how often
a disabled guard was independently decisive. No live deployment authorization;
no actual funding settlement, liquidation/shared collateral or maker-fill proof.

```powershell
npx ts-node scripts/age-high-refinement-tests.ts
npx ts-node scripts/hype-age-high-refinement-study.ts plan research-inputs/age-high-refinement-2026-09-11.json
npx ts-node scripts/hype-age-high-refinement-study.ts run KEY
npx ts-node scripts/age-high-refinement-verify.ts KEY
```

The existing `ladder-combination-v1` immutable workflow kind is reused with its
own explicit L14 runner and validated definition; generic workflow `run` is not
the dispatcher for this study. Pins cover prior evidence, current source/data,
new harness/audit/tests and protected production files. Completed jobs are never
overwritten. Raw outputs stay local under the content-addressed job directory.
