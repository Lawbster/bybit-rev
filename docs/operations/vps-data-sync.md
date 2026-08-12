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
| Collector and health data | `/opt/bybit-rev/data/` | `data/` |
| Main ladder state | `/opt/bybit-rev/bot-state.json` | `bot-state.json` |
| Application logs | `/opt/bybit-rev/logs/` | `logs/` |
| PM2 logs | `/home/deploy/.pm2/logs/` | `logs/pm2/` |

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
logs, and PM2 logs.

Optional environment:

| Variable | Purpose |
|---|---|
| `REVERSE_COPY_SSH_KEY` | SSH private key path; defaults to `~/.ssh/id_ed25519` |
| `REVERSE_COPY_SSH_PORT` | Non-default SSH port |
| `REVERSE_COPY_RSYNC_BWLIMIT_KBPS` | Positive rsync bandwidth limit in KiB/s |

## Why the data pull has two passes

The first pass uses file size as its quick-change test. This is efficient for large append-only JSONL streams and avoids repeatedly transferring multi-gigabyte history because Windows and Linux modification times differ.

The second pass always refreshes the small rolling snapshots. A rolling JSON file can contain new values while retaining the same byte size, so `--size-only` alone is not sufficient for those files.

`--no-times` is required for this checkout under WSL's `/mnt/c` mount. Preserving Linux timestamps with `-t` caused `Operation not permitted` errors when rsync tried to set timestamps on temporary files. No Windows permission change or `chmod` is required.

## Expected result

A successful pull:

- finishes without `failed to set times`;
- leaves no hidden `.filename.random` rsync temporary files;
- updates `bot-state.json`, health snapshots, and PM2 logs to the pull time;
- prints the latest embedded HYPE candle, HL taker, runtime-health, short-health,
  and bot-status timestamps when `jq` is available;
- leaves live JSONL source timestamps slightly behind the final health snapshots because collectors continue writing during the multi-pass pull.

The pull does not prove current runtime health by itself. After a pull, inspect the embedded source timestamps and health contents rather than relying on local Windows file modification times.

Useful local checks:

```bash
tail -n 1 data/HYPEUSDT_1m.jsonl
tail -n 1 data/HYPEUSDT_taker_hyperliquid.jsonl
jq '{writtenAt, mode, websocket, context, reconciliation, transaction, recovery, positions}' \
  data/HYPEUSDT_runtime_health.json
jq '{writtenAt, status, statusReasons, position, pending, recovery}' \
  data/HYPEUSDT_hl_short_live_health.json
tail -n 20 logs/pm2/hedgeguy-bot-out.log
```

Because the source is live, an immediate second pull can still find a small delta in active streams. That is expected.
