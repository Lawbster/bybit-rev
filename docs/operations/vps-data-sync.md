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

## Complete pull

Paste this block into WSL:

```bash
cd /mnt/c/Users/emile/dev/Venzen/venzen-finance/reverse-copy

mkdir -p data logs logs/pm2

# Cache the SSH key so its passphrase is entered once per WSL session.
if ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)"
  ssh-add ~/.ssh/id_ed25519
fi

REMOTE="deploy@46.225.80.0"

# Large historical and append-only data streams.
rsync -rz --no-times --size-only --partial --info=progress2 \
  "${REMOTE}:/opt/bybit-rev/data/" \
  ./data/

# Mutable snapshots that may change without changing file size.
rsync -rz --no-times --ignore-times \
  --include='HYPEUSDT_5.json' \
  --include='HYPEUSDT_15.json' \
  --include='HYPEUSDT_240.json' \
  --include='HYPEUSDT_*_health.json' \
  --include='HYPEUSDT_*_state.json' \
  --include='HYPEUSDT_status.json' \
  --include='HYPEUSDT_upside_readiness.json' \
  --include='*.lock' \
  --exclude='*' \
  "${REMOTE}:/opt/bybit-rev/data/" \
  ./data/

# Current transactional bot state.
rsync -z --no-times --ignore-times \
  "${REMOTE}:/opt/bybit-rev/bot-state.json" \
  ./bot-state.json

# Application-generated logs.
rsync -rz --no-times --size-only --partial --info=progress2 \
  "${REMOTE}:/opt/bybit-rev/logs/" \
  ./logs/

# PM2 process output and error logs.
rsync -rz --no-times --size-only --partial --info=progress2 \
  "${REMOTE}:/home/deploy/.pm2/logs/" \
  ./logs/pm2/

printf '\nSync complete: '
date -u
```

## Why the data pull has two passes

The first pass uses file size as its quick-change test. This is efficient for large append-only JSONL streams and avoids repeatedly transferring multi-gigabyte history because Windows and Linux modification times differ.

The second pass always refreshes the small rolling snapshots. A rolling JSON file can contain new values while retaining the same byte size, so `--size-only` alone is not sufficient for those files.

`--no-times` is required for this checkout under WSL's `/mnt/c` mount. Preserving Linux timestamps with `-t` caused `Operation not permitted` errors when rsync tried to set timestamps on temporary files. No Windows permission change or `chmod` is required.

## Expected result

A successful pull:

- finishes without `failed to set times`;
- leaves no hidden `.filename.random` rsync temporary files;
- updates `bot-state.json`, health snapshots, and PM2 logs to the pull time;
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
