# Ladder component audit (L09)

Frozen September 8, 2026. Research only; this is not permission to change a live
configuration or run a sweep on the trading VPS.

## Question and controls

Reconstruct the current policy from a bare time-only ladder, then remove each
active component separately from the full policy. The bare ladder is the requested
**baseline**; the full current policy is a separate **current-stack control**.

Both retain $800 base, 1.35 multiplier, 11 retained rungs, 30-minute ordinary add
interval, normal 1.4% batch TP, 25x modeled affordability, and 0.055% trading fees
on each side. Initial equity is $32,000, matching previous research, not the
configuration's $1,000 synthetic fallback or an authenticated account balance.
No equity-proportional sizing, new short, or shared-wallet model is introduced.

The [frozen card](../../research-inputs/ladder-components-2026-09-08.json) specifies
all thresholds, ordering, periods, dependencies, and the research screen.
[Component wiring](../../scripts/ladder-component-policy.ts) enumerates the exact
17 active components. Eighteen cumulative policies plus seventeen removals yield
**34 distinct configurations**: full-minus-latch duplicates the penultimate
cumulative policy and is referenced rather than rerun as a new configuration.

Each runs in both periods and both accepted TP models: **136 core cases**.
Six full-current archive checks include those four controls plus two old recent
cutoffs, for **138 executions total**. Comparison periods:

- July 1, 2025 00:00 to August 19, 2026 21:32 UTC: same long period as the old
  approximately $65k result; do not silently extend it when explaining that figure.
- May 17, 2026 20:43 to September 8, 2026 17:47 UTC: recent HL-rich period through
  the latest verified copied minute. Separately initialized flat, not a subtotal
  of the longer path. These overlap and are not independent validation sets.

## Meaning of the switches

The sequence is explanatory, **not historical deployment chronology**. A gain
when adding one layer applies to that particular preceding stack. Full-minus-one
measures the layer's marginal effect in the current stack. Neither decomposes
profit into additive, order-independent contributions or finds a global optimum.

Some switches genuinely interact:

- Disabling `filters.trendBreak` makes live `checkTrendGate()` return unblocked.
  Its result also feeds hard flatten. The matching ablation therefore removes
  that permission too; it is not mislabeled as an entry-only trend experiment.
- Removing deep funding stress makes its support-reopen exception redundant.
  The remaining exception cannot independently authorize a new entry.
- Daily breaker and damaged latch are reconstructed separately; only then are
  the enabled arrays combined. Removing one never silently removes the other.
- Removing forced-exit cooldown uses the already supported numeric `0h` engine
  calculation; TP cooldown is independent and stays enabled in that removal.
- S/R selected-ID partials preserve the actual last-add timestamp, consistent
  with transactional live state. They do not use the legacy retained-rung reanchor.

The only shared harness source edit is adding `0h` to the TypeScript parameter
union. Runtime calculation already supported it. Preflight reverses that exact
textual change in memory and verifies the previous source hash, then checks six
complete current result digests. All other original engine/policy sources must
match the accepted L08 hashes. No production runtime file is changed.

## Execution and survival boundaries

Read the [causal replay contract](current-stack-replay.md). Both models decide on
known data and fill later: close-confirmed/next-open or a subsequent touch of an
already active TP. Neither is an exact maker/exchange implementation or a guaranteed
upper/lower bound. Configured maker status is preserved in evidence but is **not
claimed to be economically simulated**. Funding settlements are not included.

Bare ladders can book only profitable exits while hiding large open losses.
Report realized PnL and open mark, completed-episode win/loss dollars including
partials, minimum equity, adverse-path drawdown, inventory underwater duration,
and longest flat-to-flat/open episode. First modeled equity <=0 is explicitly
marked **NON_SURVIVABLE_DIAGNOSTIC**; later profits do not resurrect that account.
Positive modeled equity still does not certify Bybit liquidation safety. The
entry-cost/25 comparison is only an initial-margin stress diagnostic, not a
maintenance-margin or liquidation formula. Low-before-TP is an adverse intrabar
marking assumption; the exact ordering is unavailable from minute OHLC.

## Evidence and reproduction

```powershell
npx.cmd ts-node scripts/ladder-component-tests.ts
npx.cmd ts-node scripts/ladder-component-edge-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-component-study.ts
node --max-old-space-size=6144 -r ts-node/register scripts/ladder-component-results-check.ts
npx.cmd ts-node scripts/ladder-component-report.ts
```

For a fresh rerun, choose a new output directory:

```powershell
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-component-study.ts --out backtests/hype/ladder-components-rerun
node --max-old-space-size=6144 -r ts-node/register scripts/ladder-component-results-check.ts backtests/hype/ladder-components-rerun
```

Do not sync inputs during a run. The runner refuses existing output directories,
pins raw data, config and source hashes, and rechecks them at completion. Appended
or changed data is intentionally rejected by this frozen reproducibility wrapper;
future extensions need a separately documented manifest, not edited expected totals.

Artifacts include all effective configurations, six control digests, per-fill
before/after inventory, closes/partials, independent cash/fee/drawdown checks,
monthly MTM/cash/W/L, bare/current/previous-stage comparisons, and same-entry
changed/removed/replacement episode contributions. The separate checker loads
raw prices independently and reconstructs accounting from saved fills; it does
not claim to be a second independent strategy engine. Month-end MTM includes
carried inventory rather than allocating a whole holding-period return to its exit.

The `longestHeld` diagnostic records the observation at which a new maximum
duration was reached; its `closed` flag is not end-of-replay position status
(a close can execute at the same boundary as that observation). Use the matched
episode's close record and `metrics.openDepth` for final inventory status.

An ablation can be retained for follow-up only if the frozen screen passes both
models and periods. Historical data has already been mined; even a screen pass
is not live promotion. Disabled shadows, watchdogs, transaction safety, and fee
execution are enumerated as outside the economic ablations, not called useless
because a minute-price engine does not model them.
