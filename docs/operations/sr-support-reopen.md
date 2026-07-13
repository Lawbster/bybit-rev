# S/R Support-Reopen Live Action

This action narrowly reopens a time-based ladder add that `deepAddStressGuard`
would otherwise block. It does not create a new order path, change rung sizing,
raise maximum depth, or bypass the normal long transaction coordinator.

## Exact policy

The action is considered only when all of the following are true:

- `deepAddStressGuard` is actively blocking the add;
- the add is time-based, not a true price-drop add;
- the replay parameter requires next depth at least five; because the current
  deep-stress guard begins with five open rungs, the effective live add is rung
  six or deeper;
- continuous configured S/R candle coverage is healthy;
- the 30-minute memory-zone engine is current;
- confirmed support is no more than 1% below price;
- HL taker buy/sell notional is at least 1.20 over a healthy 15-minute or
  one-hour window;
- the HL 0.5% book has bid imbalance at least 0.20 or ask/bid ratio at most
  0.75;
- HL asset OI has expanded at least 0.25% over one hour or 0.75% over four
  hours;
- the original deep-stress block is funding-only, matching the tested replay;
- order-book, taker, and asset-context freshness checks pass.

The evidence is recomputed immediately before order flow. If the original
stress condition has cleared, the add proceeds as an ordinary add. If stress
remains but any support/HL evidence has expired, the add remains blocked.

## Gates that remain authoritative

After the narrow stress override, the existing add path still applies:

- 4H trend-break gate;
- BTC one-hour risk-off gate and cooldown;
- ladder-local age/PnL block;
- daily regime breaker;
- legacy S/R skip-add if enabled;
- maximum ladder depth;
- margin availability;
- `orderInFlight` and `LongSideGuard`;
- durable long-open transaction coordination and reconciliation.

The current regime configuration uses five consecutive red daily closes to
block new entries/adds and two green daily closes to re-arm.

## Telemetry

Action lifecycle rows are appended best-effort to:

```text
data/HYPEUSDT_sr_support_reopen_actions.jsonl
```

Possible events:

- `blocked_outer`: support reopen passed, but an ordinary outer gate blocked;
- `revalidation_blocked`: evidence expired before order flow;
- `candidate`: all gates passed and the normal open transaction was attempted;
- `executed`: the normal open transaction committed;
- `failed`: the transaction did not commit and its durable transaction result
  is included when available.

The normal `ladder_add` decision row includes the support zone and confirmation
components. The existing trade log and pending transaction remain the source of
truth for order state.

## Deployment checks

Before restart, use the normal live-bot preflight: snapshot `bot-state.json`,
verify `pendingOrder=null`, and verify local/exchange HYPE long quantity sync.

After build and restart, confirm:

```bash
pm2 logs hedgeguy-bot --lines 150 --nostream | grep -E 'S/R context startup|S/R support-reopen LIVE|Reconciliation:'
npm run watchdog -- --once --dry-run
```

Expected startup text includes healthy continuous 14-day S/R coverage and:

```text
S/R support-reopen LIVE: enabled ... outer gates remain authoritative
```

The watchdog dry run must contain no incidents.

## Rollback

Set `srSupportReopenAction.enabled` to `false`, rebuild, and restart only
`hedgeguy-bot`. Disabling this action restores the existing deep-add stress
block behavior; it does not affect S/R partial exits or transaction recovery.
