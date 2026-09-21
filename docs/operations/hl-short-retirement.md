# Retire the old HL short trio

Prepared 2026-09-22; local patch is not proof of VPS deployment. Scope:
`hype-hl-short-live`, `hype-hl-short-shadow`, `hype-hl-short-bpv-shadow` only.
Expected saving from the operator's PM2 snapshot: about 261 MB RSS. Shadows stop
producing forward observations; raw HL/Bybit collection and old evidence remain.
Do not restart/stop the ladder, SF08, maker-TP observer or collectors.

`hl-short-live-config.json`: `retired=true`, `enabled=false`, `entryEnabled=false`.
The watchdog suppresses only these three health sources when the saved live state
and health both confirm flat/clear and contain a zero-quantity reconciliation.
Old timestamps are expected after retirement. Missing/corrupt/conflicting evidence
produces `hl_short_retirement_invalid` (critical); it never silently opts out.
An entry pause alone, or `enabled=false` alone, does not suppress monitoring.
Retirement is not ongoing exchange surveillance; do not open manual HYPE shorts.

## 1. Before pulling: fresh short-account check

On VPS, while the old entry-paused owner is still running:

```bash
cd /opt/bybit-rev
npm run hl-short-live -- --exchange-preflight
```

Use `--exchange-preflight` exactly: the old short CLI does not recognize SF08's
`--preflight` flag and otherwise falls through to owner startup.
Require `exchangeShort.size=0`, `positionIdx=2`, and transactional state with
`position=null`, `pending=null`, `recoveryMode=false`. This uses the MAIN ladder
account, not LAWBSTER. Main long inventory/orders are allowed and left alone.
If the short check is not flat/clear, do not stop its owner or edit its state.

## 2. After this patch has been committed and pushed

Check `git status --short` first. The VPS has an intentionally armed local
`sfp-live-config.json`; preserve it. Do not restore/stash-drop that file or pull a
commit changing it without reconciling the approved LAWBSTER settings.

Paste this entire block. Subshell failure does not close SSH. It builds/tests
before shutdown. PM2 names below are the full names, not truncated table labels.

```bash
(
  set -e
  cd /opt/bybit-rev
  git pull --ff-only
  npm run build
  npx ts-node scripts/operational-watchdog-tests.ts

  jq -e '.retired == true and .enabled == false and .entryEnabled == false' \
    hl-short-live-config.json >/dev/null
  jq -e '(.writtenAt | type) == "number" and
    (now*1000 - .writtenAt) >= 0 and (now*1000 - .writtenAt) < 60000 and
    .entryEnabled == false and .position.active == false and .position.qty == 0 and
    .pending.active == false and .recovery.active == false and
    (.reconciliation.lastAt | type) == "number" and
    (now*1000 - .reconciliation.lastAt) >= 0 and
    (now*1000 - .reconciliation.lastAt) < 60000 and .reconciliation.exchangeQty == 0' \
    data/HYPEUSDT_hl_short_live_health.json >/dev/null
  jq -e '.position == null and .pending == null and .recoveryMode == false and
    .recoveryReason == null and .lastExchangeQty == 0' \
    data/HYPEUSDT_hl_short_live_state.json >/dev/null

  pm2 stop hype-hl-short-live hype-hl-short-shadow hype-hl-short-bpv-shadow
  pm2 restart hype-health-watchdog
  sleep 15
  npm run watchdog -- --once --dry-run
  pm2 save
)
```

If the block fails, do not continue blindly. A successful pull has changed disk
config but not the running short owner's loaded flags (previous entries remain
disabled). If the final watchdog check reports an unrelated incident, inspect it;
the trio may already be stopped. Save PM2 after verifying the intended statuses.

After more than 90 seconds (the old heartbeat threshold), repeat:

```bash
npm run watchdog -- --once --dry-run
pm2 ls --no-color
```

Expected: all three stopped, no stale short/shadow incidents. Ladder, SF08,
watchdog, maker observer and collectors remain online. Keep the stopped PM2 entries
for easy identification; stopped processes consume no process memory. Preserve
state, health, journals and logs in place. Never remove those to silence an alert.

## Re-enabling later

Separate reviewed deployment: set `retired=false`, restart shadows and require
fresh data, repeat the dedicated short preflight, then start the owner with
`enabled=true`, `entryEnabled=false` for monitored reconciliation. Entry re-arming
requires its own strategy approval. Do not use `pm2 restart all`.
