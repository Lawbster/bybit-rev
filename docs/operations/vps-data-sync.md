# VPS Data Sync to Windows

This runbook copies production data, bot state, application logs, and PM2 logs from the VPS into the local Windows checkout through WSL. It is read-only against the VPS and does not change process state, configuration, or exchange state.

## Local destination

Run the commands from WSL. The Windows checkout is mounted at:

```text
/mnt/c/Users/emile/dev/Venzen/venzen-finance/reverse-copy
```

The source host and paths are:

| Content | VPS source | Local destination |
|---|---|---|
| Collector data, portfolio ledger/health and funding/notification records | `/opt/bybit-rev/data/` | `data/` |
| Retained legacy ladder state | `/opt/bybit-rev/bot-state.json` | `bot-state.json` |
| Application logs | `/opt/bybit-rev/logs/` | `logs/` |
| PM2 logs | `/home/deploy/.pm2/logs/` | `logs/pm2/` |

The October 11 portfolio cutover needs no new pull command. The directory passes
already include `hype-portfolio-live` output/error logs, Commander logs and
portfolio fatal diagnostics. Root strategy configs (including the armed
VPS-local portfolio/SFP configs), `.env` and pause/control flags are not copied.
The script does not delete local history or write to the VPS.

## Preferred scripted pull

The repository script performs the reviewed multi-pass sync, checks the remote
paths first, and prints embedded source timestamps after a successful pull.
Run this from WSL:

```bash
cd /mnt/c/Users/emile/dev/Venzen/venzen-finance/reverse-copy

df -h /mnt/c

export REVERSE_COPY_REMOTE="deploy@46.225.80.0"

# Preview first. This checks SSH and remote paths but changes no local files.
bash scripts/pull-vps-data.sh --dry-run

# Perform the pull.
bash scripts/pull-vps-data.sh
```

The script starts an SSH agent and loads `~/.ssh/id_ed25519` when the current
WSL session has no loaded key. A remote can alternatively be supplied as the
final argument:

```bash
bash scripts/pull-vps-data.sh --dry-run deploy@46.225.80.0
```

Use `--no-data` for a smaller operational pull that skips the large collector
journal pass but still refreshes HYPE snapshots, `bot-state.json`, application
logs, and PM2 logs. It also force-refreshes the portfolio's funding and
notification records, even if their size has not changed. HYPE minute and HL
market journals are **not** refreshed by `--no-data`; the summary labels this.

Optional environment:

| Variable | Purpose |
|---|---|
| `REVERSE_COPY_SSH_KEY` | SSH private key path; defaults to `~/.ssh/id_ed25519` |
| `REVERSE_COPY_SSH_PORT` | Non-default SSH port |
| `REVERSE_COPY_RSYNC_BWLIMIT_KBPS` | Positive rsync bandwidth limit in KiB/s |

## Why the data pull has two passes

The first pass uses file size as its quick-change test. This is efficient for large append-only JSONL streams and avoids repeatedly transferring multi-gigabyte history because Windows and Linux modification times differ.

The second pass always refreshes the small rolling snapshots. A rolling JSON file can contain new values while retaining the same byte size, so `--size-only` alone is not sufficient for those files.

Portfolio files covered by this forced-refresh pass (also with `--no-data`):

- `data/HYPEUSDT_portfolio_health.json`
- `data/HYPEUSDT_portfolio_state.json` (checksummed receipt-owned ledger)
- `data/HYPEUSDT_portfolio_state.json.funding.json`
- `data/HYPEUSDT_portfolio_state.json.notified.json`

Optional funding/notification files are copied when present; the pull does not
create them or infer activity from their absence. Their contents do not provide
a common heartbeat, so the summary uses the owner's embedded health,
reconciliation and feed timestamps instead of filesystem modification times.

`--no-times` is required for this checkout under WSL's `/mnt/c` mount. Preserving Linux timestamps with `-t` caused `Operation not permitted` errors when rsync tried to set timestamps on temporary files. No Windows permission change or `chmod` is required.

## Expected result

A successful pull:

- finishes without `failed to set times`;
- leaves no hidden `.filename.random` rsync temporary files;
- refreshes the portfolio ledger/health and mutable funding/notification records,
  retains the legacy state pull, and syncs application/PM2 logs;
- prints embedded HYPE candle, HL taker, portfolio-health, account-reconciliation,
  and portfolio-feed timestamps when `jq` is available;
- leaves live JSONL source timestamps slightly behind the final health snapshots because collectors continue writing during the multi-pass pull.

The pull does not prove current runtime health by itself. After a pull, inspect the embedded source timestamps and health contents rather than relying on local Windows file modification times.

These are separate file copies, not one atomic account backup: the ledger and
health can reflect different ticks. Retired owner health files remain historical
evidence; stale timestamps there do not describe the active portfolio.

Useful local checks:

```bash
tail -n 1 data/HYPEUSDT_1m.jsonl
tail -n 1 data/HYPEUSDT_taker_hyperliquid.jsonl
jq '{writtenAt, mode, entryEnabled, status, error, reconciliation, owners, pending, recovery}' \
  data/HYPEUSDT_portfolio_health.json
tail -n 20 logs/pm2/hype-portfolio-live-out.log
tail -n 20 logs/pm2/hype-portfolio-live-error.log
```

Because the source is live, an immediate second pull can still find a small delta in active streams. That is expected.
