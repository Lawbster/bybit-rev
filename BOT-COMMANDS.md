# 2Moon Bot — Manual Commands

All commands run from the project root directory.

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
