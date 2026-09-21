# Entry patience x two-day-high exit: frozen interaction test

September 15, 2026. User-requested research, not a live change.

The user calls this a high blocker. The actual leg is a full ladder exit
at age >=4h when price is within 1% of the trailing 48h high. It is not an
entry gate. Disabling it also removes the cooldowns caused by those exits;
other forced-close cooldowns remain unchanged.

## Frozen matrix

Four arms: Aggressive10 unchanged; Aggressive10 + waiting; high-exit removed;
high-exit removed + waiting. The waiting rule is the strongest recent L16
lead, timer8_cap0.1, not a new search over thresholds:

- Otherwise-approved timed adds at next depth 8-11 only.
- Freeze the last completed minute price, require 0.1% improvement.
- 15-minute exclusive expiry; reserve the existing 30/60m interval before rearm.
- First entry and genuine price-drop adds remain unchanged.
- Existing gates, inventory changes and exits cancel pending opportunities.
- Require closed-minute qualification followed by next-open qualification;
  no fills from a future wick or reference reanchoring.

Two windows: May 17 20:43 to September 14 15:27 UTC, 2026; and July 1, 2025
to August 19 21:32 UTC, 2026. These overlap and are not independent holdouts.
Reuse the accepted repaired candles and cutoff; no new fetch or data change.

Both resting-touch TP and close-confirmed sensitivity: 16 primary cases.
Repeat waiting arms on recent data charging the cap instead of a lower open:
four sensitivities, 20 total. Ten high-on arms must reproduce L16 exactly
before ten new high-off cases run. No extra expiry/offset/indicator search.

$32,000 flat-start equity, $800 x1.35, 11 rungs; unchanged 10h soft-stale TP
deferral, removed deep-stress timer and hot-RSI TP cooldown as in Aggressive10.
Keep all remaining gates/exits/partials/sizing identical. Charge 0.055% each
side, no maker rebate or fee credit, no funding settlement or liquidation
certification. Actual live carried-in B17 inventory is not seeded here.

## Interpretation and qualification

Always show the unmodified Aggressive10 baseline. Also calculate:

1. Waiting benefit with high exit = high-on/wait minus high-on/no-wait.
2. Waiting benefit without high exit = high-off/wait minus high-off/no-wait.
3. Interaction = (2) minus (1). Positive means removing the exit improves
   waiting's relative effect; it does NOT prove better absolute performance.

Show net, win/loss count and dollars, average loss, DD, TP/forced/hard-flatten
counts, ending marked positions, fees, monthly results and changes. Attribute
matched, removed and replacement episodes to avoid equating fewer losses
with improvement while ignoring lost winners/recoveries.

Screen each modification against unchanged Aggressive10: recent primary net
delta >=$1,000, published delta >0, no DD increase, no month below -$250,
positive recent cap-charge delta, and no modeled nonpositive equity. Apply
to both TP assumptions. Interaction findings remain informative if no arm
passes, but do not justify live deployment.

## Verification

Pin inherited data/source/protected inputs and new runner/checker before runs.
Preserve accepted jobs. Verify exact archived engine digests and metrics for
ten controls, then independently reconstruct all fill accounting, minute
marks, waiting state transitions, closed-bar TP targets and high decisions.
High-off arms must contain zero high-exit decisions/orders. Synthetic tests
check the single-leg removal, unchanged config and clock/source causality.
Reports/indices only; no live config, strategy code, state, exchange writes,
commit, push or deployment.
