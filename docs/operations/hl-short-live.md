# HYPE $25k Transactional Short Owner

This runbook covers the dedicated live owner for the frozen `hl_bid_pull_break` signal. Production was armed on 2026-07-16 after the exchange preflight, disarmed process soak and watchdog checks passed. The checked-in desired state now matches production:

- `enabled=true` authorizes exchange reconciliation and management of the dedicated HYPE short side;
- `entryEnabled=true` authorizes new entries from the frozen signal journal;
- notional is fixed at `$25,000`;
- leverage remains `25x` to match the existing HYPE long side in Bybit cross-margin hedge mode (about `$1,000` initial margin for this fixed notional before account-level effects);
- exit policy is frozen at TP `2%`, SL `4%`, maximum hold `12h`;
- only one HYPE short may exist at a time on Bybit hedge-side `positionIdx=2`.

The two flags have deliberately different shutdown semantics. Setting only `entryEnabled=false` blocks new entries while the owner continues protecting and closing any existing short. Setting `enabled=false` disables exchange management and is safe only when the exchange short, local position, pending transaction and recovery state are all clear.

The signal logic remains owned by `hype-hl-short-shadow`. The live owner consumes only its deterministic `signal` journal events. It does not recompute a parallel signal and does not replay historical events when state is first initialized.

## What happens to TP and SL

No manual TP/SL placement is required.

1. Before submitting an entry, the owner writes a durable `short_open` intent.
2. The market entry includes provisional full-position TP and SL prices derived from the pre-submit quote. Both use `LastPrice` triggers and market execution.
3. API acceptance is not treated as a fill. The owner waits for terminal order/execution evidence.
4. After the actual average fill is known, it sets TP `2%` below and SL `4%` above that fill in one paired `setTradingStop` request.
5. It re-reads the exchange position and requires both exact tick-normalized prices to be present.
6. If protection cannot be confirmed three times, it submits a durable reduce-only full close. Unknown submission status remains pending/recovery rather than being guessed.

Native TP/SL closure is imported from exact Buy-side short-close execution evidence. Closed-PnL is fallback evidence only and must have a unique Buy-side order identity, matching quantity and matching time window. PnL is never reconstructed from a quote or trigger price.

Committed opens and full closes use the existing `DISCORD_WEBHOOK_HYPEUSDT` transport for lifecycle confirmations. Delivery failure is logged but never changes transaction or protection behavior.

## Ownership cleanup

HYPE `positionIdx=2` now has one intended owner:

- `wed-short-bot` is retired and should be removed from PM2;
- `src/bot/wed-short.ts` refuses to start for HYPE, preventing accidental resurrection from an old PM2 entry;
- `bot-config.json` must retain `hedge.enabled=false`;
- the main HYPE bot refuses live startup if hedge execution is enabled or if stale local `hedgePosition` state remains;
- PF0 and other symbol-specific short helpers are not changed.

Do not delete legacy state files. They are evidence for the retirement preflight and should be archived after the migration is complete.

## Build and test gate

From `/opt/bybit-rev`:

```bash
git pull --ff-only
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run test:hl-short-live
npx ts-node scripts/operational-health-tests.ts
npx ts-node scripts/operational-watchdog-tests.ts
npm run hl-short-live -- --once --dry-run
```

The last command is read-only and must report:

- `executionEnabled: true`;
- `entryEnabled: true`;
- `frozenNotionalUsdt: 25000`;
- TP `2`, SL `4`, maximum hold `12h`;
- fresh healthy shadow inputs;
- an existing signal journal.

## Completed initial migration

Steps 1-4 below record the one-time migration completed on production on 2026-07-16. Do not repeat the legacy retirement or create another PM2 owner during a routine deployment. For a genuinely fresh installation, first set both config flags to `false`, complete the disarmed preflight and soak, then arm only after all checks pass.

### Step 1: read-only exchange preflight

This is the operator-friendly replacement for manually finding Bybit's hedge-side position. It performs authenticated reads but cannot place or cancel an order:

```bash
npm run hl-short-live -- --exchange-preflight
```

Require all of these to be `true`:

```text
checks.exchangeFlat
checks.legacyFlat
checks.newStateFlat
checks.shadowHealthy
checks.mainHedgeDisabled
checks.mainHedgeFlat
checks.mainPendingClear
checks.leverageMatchesLong
safeToRetireLegacy
safeToArm
```

The exchange block must show `size: 0`, `positionIdx: 2`. If any check is false or unknown, stop and investigate; do not edit state to force a pass.

### Step 2: retire the old HYPE short owner

Only after `safeToRetireLegacy=true`:

```bash
pm2 stop wed-short-bot
npm run hl-short-live -- --exchange-preflight
pm2 delete wed-short-bot
pm2 ls --no-color
```

There is no separate main-hedge PM2 process. Its live path is retired by the config/state guards above. Confirm the config directly:

```bash
jq '.hedge.enabled' bot-config.json
jq '.hedgePosition' bot-state.json
```

Expected values are `false` and `null`.

### Step 3: install the new owner disarmed

Start the compiled owner while both flags remain false:

```bash
pm2 start dist/bot/hl-short-live.js --name hype-hl-short-live
sleep 15
pm2 logs hype-hl-short-live --lines 100 --nostream
jq '{executionOwner, enabled, entryEnabled, status, statusReasons, journal, shadow, position, pending, recovery}' \
  data/HYPEUSDT_hl_short_live_health.json
```

Expected state is `executionOwner=true`, `enabled=false`, `entryEnabled=false`, `status="disabled"`, no position, no pending transaction and no recovery.
The process also holds an exclusive PID lock under `data/`; a duplicate live-owner process refuses to start.

Restart the watchdog so its compiled evaluator knows the new health contract:

```bash
pm2 restart hype-health-watchdog
sleep 15
npm run watchdog -- --once --dry-run
```

Require `incidents: []`. Then persist the intended topology:

```bash
pm2 save
systemctl is-enabled pm2-deploy.service
```

At this point the legacy owner is gone and the new owner is installed but cannot trade.

### Step 4: arm after review

Arming is a separate live-config decision. First stop only the disarmed process and repeat the exchange preflight:

```bash
pm2 stop hype-hl-short-live
npm run hl-short-live -- --exchange-preflight
[ ! -f data/HYPEUSDT_hl_short_live_state.json ] || cp data/HYPEUSDT_hl_short_live_state.json \
  data/HYPEUSDT_hl_short_live_state.pre-arm-$(date -u +%Y%m%dT%H%M%SZ).json
```

If the state file does not exist yet, that is acceptable; the first disarmed start should normally have created it. Require `safeToArm=true`, then change only these two fields in `hl-short-live-config.json`:

```json
"enabled": true,
"entryEnabled": true
```

Start and verify:

```bash
pm2 start hype-hl-short-live
sleep 15
pm2 logs hype-hl-short-live --lines 150 --nostream
jq '{enabled, entryEnabled, status, statusReasons, position, pending, recovery, reconciliation}' \
  data/HYPEUSDT_hl_short_live_health.json
npm run watchdog -- --once --dry-run
pm2 save
```

Expected flat steady state is `enabled=true`, `entryEnabled=true`, `status="healthy"`, `position.active=false`, `pending.active=false`, `recovery.active=false`, and no watchdog incidents.

## Normal operation and deployment

The repository is now intentionally armed. A normal pull should preserve `enabled=true` and `entryEnabled=true`; do not treat those values as an accidental local config change. Before restarting the owner, confirm there is exactly one `hype-hl-short-live` process and inspect its durable health/state. The owner reconciles an existing managed position on restart, but a duplicate process is never permitted.

After a build that affects this owner:

```bash
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
pm2 restart hype-hl-short-live
sleep 15
```

Then perform the steady-state checks:

```bash
jq '{writtenAt, enabled, entryEnabled, status, statusReasons, position, pending, recovery, reconciliation, totals}' \
  data/HYPEUSDT_hl_short_live_health.json
pm2 logs hype-hl-short-live --lines 150 --nostream
npm run watchdog -- --once --dry-run
```

The health file should update about every five seconds. An open position must always show `protectionStatus="confirmed"`. The watchdog raises critical incidents for recovery, an unprotected managed position, a stale enabled heartbeat, or a long-lived pending order.

To block new entries while allowing an existing short to finish safely, leave `enabled=true` and change only `entryEnabled=false`, then restart the owner. Never set `enabled=false` while a position, pending intent or recovery state exists; startup deliberately refuses that unsafe combination.

## Incident handling

For any of these incidents, do not start another short owner or manually clear JSON state:

- `hl_short_live_recovery`;
- `hl_short_live_unprotected`;
- `hl_short_live_pending_stale`;
- `hl_short_live_heartbeat_stale`.

Inspect:

```bash
pm2 logs hype-hl-short-live --lines 250 --nostream
jq . data/HYPEUSDT_hl_short_live_health.json
jq . data/HYPEUSDT_hl_short_live_state.json
npm run hl-short-live -- --exchange-preflight
```

The coordinator is intentionally fail-closed. `not_found` alone never clears a durable intent, quantity mismatch never creates an unsubmitted fake close order, and an exchange-flat position is not cleared locally without unique close evidence.
