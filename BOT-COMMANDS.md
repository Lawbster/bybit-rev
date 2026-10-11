# 2Moon Bot — Manual Commands

## Current HYPE portfolio (October 11 control update)

Implemented locally; deployment of the Commander/status update is not yet
confirmed. After deploying both owner and Commander:

| Discord | Action |
|---|---|
| `-status` | Portfolio health, ladder, three setup slots and MACD short |
| `-pause` | Block new entries/adds; keep exits running |
| `-resume` | Remove portfolio pause after health/pending checks |
| `-flatten` | Request **all portfolio positions** closed; leave paused |

Optional argument: `hype` or `portfolio`. `-closeladder` / `-close hype` also
flatten **all owners**, not just the main ladder. Replies acknowledge requests,
not fills; follow with `-status`. Keep the command channel private.

File-only status: `node dist/bot/portfolio-status.js`.
SSH controls: `touch portfolio-pause`, `touch portfolio-flatten`; neither
requires a restart. Full safety/deployment details: [portfolio runbook](docs/operations/portfolio-live.md).
Keep `bot-pause` and `lawbster-sfp-pause`; do not restart old owners.

## Historical standalone ladder commands — NOT the active portfolio

The sections below describe the retired owner. Do not use them for the current
portfolio. All commands run from the project root directory.

## Signal Files

| Action | Windows (PowerShell) | Ubuntu (VPS) |
|--------|---------------------|--------------|
| Pause (no new adds) | `New-Item bot-pause` | `touch bot-pause` |
| Resume | `Remove-Item bot-pause` | `rm bot-pause` |
| Flatten all + pause | `New-Item bot-flatten` | `touch bot-flatten` |
| Resume after flatten | `Remove-Item bot-pause` | `rm bot-pause` |

- **Pause**: stops new adds, TP watcher + exit stack stay active
- **Flatten**: closes all positions, then auto-pauses. Resume manually when ready
- Bot checks signals every 10s

## Bot Startup

| Action | Command |
|--------|---------|
| Start bot | `npm run bot` |
| Start with custom config | `npm run bot -- --config=my-config.json` |
| Generate config template | `npm run bot -- --init` |

## Quick Checks

| Action | Windows (PowerShell) | Ubuntu (VPS) |
|--------|---------------------|--------------|
| View state | `Get-Content bot-state.json` | `cat bot-state.json` |
| View today's equity log | `Get-Content logs\equity_*.jsonl` | `cat logs/equity_*.jsonl` |
| View today's trades | `Get-Content logs\trades_*.jsonl` | `cat logs/trades_*.jsonl` |
| Tail live logs | `Get-Content logs\bot_*.log -Tail 20` | `pm2 logs hedgeguy-bot --lines 20` |
| Follow logs live | `Get-Content logs\bot_*.log -Wait` | `pm2 logs hedgeguy-bot` |
| Check if paused | `Test-Path bot-pause` | `ls bot-pause` |

## Process Management (Ubuntu VPS)

| Action | Command |
|--------|---------|
| View logs live | `pm2 logs hedgeguy-bot` |
| Stop | `pm2 stop hedgeguy-bot` |
| Restart | `pm2 restart hedgeguy-bot` |
| Status | `pm2 status` |
| Start fresh (after rebuild) | `pm2 stop hedgeguy-bot && npm run build && pm2 start hedgeguy-bot` |
| Rebuild + restart one-liner | `git pull && npm run build && pm2 restart hedgeguy-bot` |

## Modes

Set `mode` in `bot-config.json`:

| Mode | Description |
|------|-------------|
| `dry-run` | No orders, public API only. Safe to test |
| `paper` | Real orders on subaccount (zero balance). Uses `BYBIT_SUBACOUNT_*` keys |
| `live` | Real orders on main account. Uses `BYBIT_API_*` keys |
