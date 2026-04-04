# Execution Environment Reference

## Local Machine (this repo)

- Simulations (`sim-*.ts`)
- Backtesting (`backtest-v2.ts`, `backtest-ws.ts`)
- Signal analysis / research scripts
- Historical data analysis (reading from `data/`)
- Strategy development and testing

All offline work runs here. Data files already present in `data/`.

## VPS (Ubuntu, pm2)

- Live bot execution (`hedgeguy-bot`, `wed-short-bot`)
- Discord alarms (`alarm-{SYMBOL}`, 8 instances)
- Discord commander
- Live data fetching (`fetch-candles.ts`, `data-collector.ts`)
- Any Bybit API calls that need authenticated access or continuous uptime
- Live data collection (candles, OI, funding, orderbook snapshots)

## Rule

If it reads static files and produces analysis → runs locally.
If it talks to Bybit API live or needs to stay running → runs on VPS.
