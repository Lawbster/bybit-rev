# HYPE Damaged-Regime Latch

## Purpose

The damaged-regime latch prevents the long ladder from repeatedly redeploying after HYPE's completed 4h structure has materially broken. It is an entry/add gate only. TP, S/R partial exits, hard flatten, emergency kill, manual flatten, transaction resolution, and reconciliation continue normally.

The main HYPE config enables it with:

- trigger: completed 4h close is at least 4% below 4h EMA200;
- confirmation: healthy causal Hyperliquid taker ratio is <=0.85 over 15m **or** <=0.90 over 1h;
- action: persistently block first entries, time adds, price-drop adds, and S/R support reopens;
- release: two consecutive completed 4h closes with EMA200 distance above -1%.

It does not open/close a position and does not alter any short process.

## Durable State

State is stored under `damagedRegimeLatch` in `bot-state.json`. An active latch survives process restarts, PM2 resurrection, normal TP/flatten cycles, and forced-exit cooldown expiry.

The first startup after migrating from state schema v3 to v4 has one fail-closed safeguard: if the current completed 4h close is already beyond the -4% trigger, the latch bootstraps active even though the old state could not have recorded the earlier HL confirmation. Outside the trigger region it initializes inactive; every later trigger requires fresh, adequately sampled HL taker evidence.

`bot-regime-arm` only clears the older daily red-day breaker. It deliberately does not clear this latch.

## Deployment Preflight

The current live config has the latch enabled. Deploy only with the long bot intentionally paused and use the normal transactional preflight:

```bash
cd /opt/bybit-rev

jq '{pendingOrder,recoveryMode,positions:(.positions|length),damagedRegimeLatch}' bot-state.json
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run test:damaged-regime-latch

pm2 restart hedgeguy-bot
pm2 logs hedgeguy-bot --lines 180 --nostream |
  grep -E 'Damaged-regime latch LIVE|DAMAGED REGIME LATCH|Reconciliation:|S/R context startup'
```

If the latest completed structure is still below -4%, the expected first transition is:

```text
DAMAGED REGIME LATCH: bootstrap armed ...
```

This is expected, not recovery mode and not an execution incident.

## Runtime Verification

```bash
jq '{writtenAt,positions,damagedRegimeLatch,recovery,reconciliation}' \
  data/HYPEUSDT_runtime_health.json

jq '{version,pendingOrder,recoveryMode,damagedRegimeLatch}' bot-state.json
```

While active, status output includes `DAMAGED-REGIME`. `active=true` must continue across a restart. `recoveryBars` may progress from 0 to 1 only on a newly completed qualifying 4h close; the second consecutive qualifying close releases the latch.

The operational watchdog should remain clean because this is an intentional strategy gate, not execution recovery:

```bash
npm run watchdog -- --once --dry-run
```

## Fail-Safe Behavior

- Active + unavailable 4h structure: remain blocked.
- Inactive + incomplete HL evidence: do not manufacture a new trigger; existing trend/risk/regime gates remain authoritative.
- Restart while active: remain blocked before any order path.
- S/R support-reopen candidate while active: outer-gate rejection; no order.
- Manual pause/forced cooldown: latch evaluation continues, so those mechanisms cannot hide or erase a trigger.

To disable the policy operationally, set `filters.damagedRegimeLatch.enabled=false`, build, and restart. The durable active state is retained so re-enabling cannot silently forget prior damage.
