# PM2 VPS Operations

This document records the observed PM2 deployment on the production VPS. It is an inventory and runbook, not an instruction to change process state.

## Production host

| Item | Observed value |
|---|---|
| Host | `ubuntu-4gb-nbg1-1` |
| Deployment user | `deploy` |
| Repository | `/opt/bybit-rev` |
| PM2 home | `/home/deploy/.pm2` |
| Systemd unit | `pm2-deploy.service` |
| Systemd state | enabled |
| Saved process dump | `/home/deploy/.pm2/dump.pm2` |
| Inventory captured | 2026-07-13 |

See [VPS capacity baseline](vps-capacity.md) for the server resource envelope, [Upside readiness](upside-readiness.md) for the read-only GF-900 eligibility monitor, and [HYPE HL short-breakdown forward shadow](hl-short-breakdown-shadow.md) for the optional read-only short-signal observer.
The live S/R support-reopen policy and its audit file are documented in [S/R support reopen](sr-support-reopen.md).

The process list was saved successfully after this inventory was captured. PM2's startup hook resurrects the saved process list through `pm2-deploy.service` after a host reboot. The operator confirms from prior reboots that the seven alarms saved with `status=stopped` remain stopped. See the [PM2 startup documentation](https://pm2.keymetrics.io/docs/usage/startup/).

Do not commit `.env`, the PM2 dump, raw `pm2 jlist` output, or raw environment dumps. They may contain exchange credentials, Discord tokens, or webhook URLs.

## Current process inventory

PM2 IDs, PIDs, uptime, memory, and restart counters are point-in-time observations. Process names are the stable operational identifiers.

| Process | State | Launch target | Configuration / purpose | Snapshot note |
|---|---|---|---|---|
| `hedgeguy-bot` | online | `dist/bot/index.js` | Main live HYPE ladder; default `bot-config.json` | 2h uptime, 14 cumulative restarts, 383.3 MB |
| `wed-short-bot` | online | `dist/bot/wed-short.js` | HYPE Wednesday short; `wed-short-config.json` is `runoutOnly` | 22d uptime, 0 restarts |
| `commander` | online | `npm run commander` | Discord command listener | 22d uptime, 0 restarts |
| `alarm-HYPEUSDT` | online | `npm run discord-alarms` | HYPE alarm monitor; `SYMBOL=HYPEUSDT` | 22d uptime, 0 restarts |
| `alarm-RIVERUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=RIVERUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-SIRENUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=SIRENUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-VVVUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=VVVUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-TAOUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=TAOUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-STGUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=STGUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-BLUAIUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=BLUAIUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `alarm-DUSKUSDT` | stopped | `npm run discord-alarms` | `SYMBOL=DUSKUSDT` | Intentionally preserve stopped state unless explicitly approved |
| `pf0-short-bot` | online | `dist/bot/pf0-short.js` | SUI pump-failure short; `pf0-short-config.json` is `runoutOnly` | 22d uptime, 0 restarts |
| `sui-ladder` | online | `npm run sui-ladder` | SUI ladder; `sui-ladder-config.json` is `runoutOnly` | 22d uptime, 0 restarts |
| `fart-ladder` | online | `npm run fart-ladder` | FARTCOIN ladder; `fart-ladder-config.json` is `runoutOnly` | 22d uptime, 0 restarts |
| `bybit-collect` | online | `npm run collect` | Bybit/Binance market-data collector | 22d uptime, 0 restarts |
| `hl-collect` | online | `/usr/bin/bash -c "npm run hl-collect"` | Hyperliquid HYPE collector | CWD is `/opt/bybit-rev/data`; 22d uptime, 0 restarts |
| `hype-health-watchdog` | online | `dist/bot/operational-watchdog.js --symbol=HYPEUSDT` | Read-only, alert-only production health watchdog | 2h uptime, 0 restarts |

All processes use PM2 fork mode with autorestart enabled. No captured process has a configured cron restart, memory restart limit, restart delay, minimum uptime, or maximum restart count.

The main bot's cumulative restart count of 14 is not by itself an incident because deployments also increment it. Treat an increase without a known deployment or manual restart as actionable.

### Runtime artifact distinction

These processes run compiled JavaScript and require `npm run build` before restart:

- `hedgeguy-bot`
- `wed-short-bot`
- `pf0-short-bot`
- `hype-health-watchdog`
- `hype-hl-short-shadow` once the forward-shadow process has been intentionally installed

These processes launch npm scripts backed by `ts-node`; a source pull affects them only after their named process is restarted:

- `commander`
- all `alarm-*` processes
- `sui-ladder`
- `fart-ladder`
- `bybit-collect`
- `hl-collect`

The `hl-collect` CWD is unusual: `/opt/bybit-rev/data`, while its npm package is rooted at `/opt/bybit-rev`. It is confirmed online and producing data. Do not normalize this launch shape without first proving the replacement command against current output files and watchdog health.

## Routine inspection

```bash
cd /opt/bybit-rev
pm2 ls --no-color
pm2 logs <process-name> --lines 100
pm2 describe <process-name>
```

Expected steady state:

- The ten processes listed as online remain online.
- The seven non-HYPE alarm processes remain stopped.
- Restart counters do not increase without a known reason.
- `hype-health-watchdog` remains quiet when healthy.
- `hedgeguy-bot` updates `data/HYPEUSDT_runtime_health.json` approximately every ten seconds.
- The watchdog updates `data/HYPEUSDT_upside_readiness.json` approximately every five minutes once the main runtime snapshot exposes readiness inputs.

Main HYPE health checks:

```bash
stat -c '%y %s bytes' data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
jq . data/HYPEUSDT_operational_watchdog_state.json
jq '{writtenAt, account, market, forcedExit, grindMid, counts30d, eligibility}' data/HYPEUSDT_upside_readiness.json
```

The dry run must report `"incidents": []` before starting or trusting the watchdog after a deployment. Dry-run mode sends no Discord alert and does not mutate lifecycle state.

The upside-readiness file is shadow telemetry only. `eligibility.wouldUseBaseUsdt` never changes bot configuration, position size, or order behavior. A flat-to-open transition is also recorded in `data/HYPEUSDT_upside_readiness_opens.jsonl` for forward observation.

If `hype-hl-short-shadow` has been installed, it must update `data/HYPEUSDT_hl_short_breakdown_shadow_health.json` approximately every five seconds. Its full start, verification, state and incident procedure is in [HYPE HL short-breakdown forward shadow](hl-short-breakdown-shadow.md). An absent health file is ignored until the process has been started once; after creation, stale or degraded telemetry is reported by the watchdog.

Collector checks:

```bash
tail -n 1 data/collector_health.jsonl | jq .
stat -c '%y %n' data/HYPEUSDT_oi_live_hyperliquid.jsonl
```

## Deployment rules

1. Restart only the named processes affected by a change. Do not use `pm2 restart all` as a routine deploy command.
2. Do not start stopped alarms as a side effect of deployment.
3. For source changes, run the production build/type gate before any restart.
4. For execution or durable-state changes to the main bot, stop it first, snapshot `bot-state.json`, and verify `pendingOrder=null` plus local/exchange HYPE quantity synchronization before starting the new build.
5. Preserve live configuration unless the change explicitly includes an independently reviewed configuration update.
6. Run `pm2 save` only after the intended process topology or stopped/online state is confirmed.

Standard build gate:

```bash
cd /opt/bybit-rev
git pull --ff-only
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
```

Example observability-only deployment affecting the main bot and watchdog:

```bash
pm2 restart hedgeguy-bot
stat -c '%y %s bytes' data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
pm2 restart hype-health-watchdog
pm2 ls --no-color
```

Do not restart the watchdog until the main bot is publishing a fresh runtime snapshot and the dry run is clean.

After an intentional topology or status change:

```bash
pm2 ls --no-color
pm2 save
systemctl is-enabled pm2-deploy.service
```

## Named process actions

```bash
pm2 restart <process-name>
pm2 stop <process-name>
pm2 start <process-name>
pm2 logs <process-name> --lines 100
```

Starting a currently stopped process is an operational change, not a health check. Confirm its symbol, configuration, account/position slot, and intended live/runout behavior before starting it.

## Incident triage

### Main bot restart count increased unexpectedly

```bash
pm2 describe hedgeguy-bot
pm2 logs hedgeguy-bot --lines 200
pm2 logs hype-health-watchdog --lines 200
npm run watchdog -- --once --dry-run
```

Do not repeatedly restart the bot before identifying whether it has retained a pending transaction or entered recovery mode.

### Watchdog alerted

1. Read the incident key, severity, active-since time, and evidence in Discord.
2. Run `npm run watchdog -- --once --dry-run` to obtain a current read-only evaluation.
3. Inspect the named producer or bot logs.
4. Do not assume a `cleared` alert authorizes trading or state mutation; it only reports healthy observations.
5. The watchdog never restarts processes, writes signal files, polls the exchange, or submits orders.

Additional main-process incident keys:

- `main_loop_stale`: runtime snapshots are fresh but the main trading loop has stopped completing cycles;
- `long_without_tp_intent`: a local long has had no durable desired native TP intent beyond the grace period;
- `tp_intent_qty_mismatch`: the desired TP's local quantity basis differs from the current local long quantity;
- `main_process_restarted`: the durable process-start identity changed, whether from an intentional deployment or an unexpected restart.

Optional forward-shadow incident keys after `hype-hl-short-shadow` has been installed:

- `hl_short_shadow_heartbeat_stale`: its atomic health snapshot is older than 90 seconds;
- `hl_short_shadow_degraded`: its heartbeat is fresh but source coverage or decision telemetry is unhealthy.

### Collector stream stale

```bash
pm2 logs bybit-collect --lines 200
pm2 logs hl-collect --lines 200
tail -n 1 data/collector_health.jsonl | jq .
```

Restart only the collector demonstrated to be unhealthy. Confirm its file timestamps recover and wait for the watchdog's two-sample clear lifecycle.

## Persistence and recovery

The observed persistence chain is:

```text
systemd pm2-deploy.service
  -> PM2 as user deploy
  -> /home/deploy/.pm2/dump.pm2
  -> saved process list
```

Useful checks after a host reboot:

```bash
systemctl status pm2-deploy.service --no-pager
pm2 ls --no-color
npm run watchdog -- --once --dry-run
```

Do not run `pm2 save` while the process list is accidentally incomplete or while an intentionally online process is temporarily stopped for diagnosis. Saving at that point would make the temporary state the reboot state.

The operator confirms that this installed PM2 setup preserves the seven stopped alarm entries as stopped across reboots.

## Known documentation boundaries

- This inventory records observed PM2 state, not the original commands used to create every process.
- Secret environment values are intentionally excluded.
- The stopped status of the seven non-HYPE alarms is observed and preserved, but the historical reason for each stop is not recorded here.
- A checked-in `ecosystem.config.cjs` is deliberately deferred. The current deployment mixes compiled JavaScript, npm/`ts-node`, a bash wrapper with a non-root CWD, and intentionally stopped entries. Converting that into executable infrastructure should be a separately reviewed migration, not inferred from inventory alone.

## Safe inventory refresh

Never paste raw `pm2 jlist`. Use an explicit allowlist that excludes environment contents:

```bash
pm2 jlist | jq '[.[] | {
  name: .name,
  script: .pm2_env.pm_exec_path,
  cwd: .pm2_env.pm_cwd,
  args: .pm2_env.args,
  interpreter: .pm2_env.exec_interpreter,
  exec_mode: .pm2_env.exec_mode,
  instances: .pm2_env.instances,
  autorestart: .pm2_env.autorestart,
  restart_delay: .pm2_env.restart_delay,
  max_restarts: .pm2_env.max_restarts,
  min_uptime: .pm2_env.min_uptime,
  cron_restart: .pm2_env.cron_restart,
  max_memory_restart: .pm2_env.max_memory_restart,
  out_log: .pm2_env.pm_out_log_path,
  error_log: .pm2_env.pm_err_log_path,
  status: .pm2_env.status
}]'
```
