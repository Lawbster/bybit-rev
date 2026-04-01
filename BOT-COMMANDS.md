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
| Tail live logs | `Get-Content logs\bot_*.log -Tail 20` | `tail -20 logs/bot_*.log` |
| Follow logs live | `Get-Content logs\bot_*.log -Wait` | `tail -f logs/bot_*.log` |
| Check if paused | `Test-Path bot-pause` | `ls bot-pause` |

## Process Management (Ubuntu VPS)

| Action | Command |
|--------|---------|
| Start in background | `nohup npm run bot > /dev/null 2>&1 &` |
| Start with pm2 | `pm2 start npm --name 2moon -- run bot` |
| Stop with pm2 | `pm2 stop 2moon` |
| View pm2 logs | `pm2 logs 2moon` |
| Restart | `pm2 restart 2moon` |

## Modes

Set `mode` in `bot-config.json`:

| Mode | Description |
|------|-------------|
| `dry-run` | No orders, public API only. Safe to test |
| `paper` | Real orders on subaccount (zero balance). Uses `BYBIT_SUBACOUNT_*` keys |
| `live` | Real orders on main account. Uses `BYBIT_API_*` keys |
