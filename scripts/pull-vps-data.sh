#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pull-vps-data.sh [--dry-run] [--no-data] [user@host]

The remote may instead be supplied through REVERSE_COPY_REMOTE.

Options:
  --dry-run  Preview what rsync would transfer without changing local files.
  --no-data  Skip the large data-journal pass; still pull mutable snapshots,
             bot-state.json, application logs, and PM2 logs.
  --help     Show this help.

Optional environment:
  REVERSE_COPY_SSH_KEY             SSH private key path.
  REVERSE_COPY_SSH_PORT            SSH port.
  REVERSE_COPY_RSYNC_BWLIMIT_KBPS  Rsync bandwidth limit in KiB/s.
EOF
}

fail() {
  printf 'Reverse Copy sync error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 ||
    fail "required command is unavailable: $1"
}

print_epoch_ms() {
  local label="$1"
  local value="$2"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '  %-24s %s\n' "$label" \
      "$(date -u -d "@$((value / 1000))" '+%Y-%m-%d %H:%M:%S UTC')"
  else
    printf '  %-24s unavailable\n' "$label"
  fi
}

json_file_timestamp() {
  local label="$1"
  local file="$2"
  local filter="$3"
  local value=""
  if [[ -f "$file" ]]; then
    value="$(jq -r "${filter} // empty" "$file" 2>/dev/null || true)"
  fi
  print_epoch_ms "$label" "$value"
}

jsonl_tail_timestamp() {
  local label="$1"
  local file="$2"
  local value=""
  if [[ -s "$file" ]]; then
    value="$(
      tail -n 1 "$file" |
        jq -r '.ts // .timestamp // empty' 2>/dev/null ||
        true
    )"
  fi
  print_epoch_ms "$label" "$value"
}

dry_run=0
pull_data=1
remote="${REVERSE_COPY_REMOTE:-}"

while (($# > 0)); do
  case "$1" in
    --dry-run)
      dry_run=1
      ;;
    --no-data)
      pull_data=0
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -*)
      fail "unknown option: $1"
      ;;
    *)
      [[ -z "$remote" ]] ||
        fail "remote was supplied more than once"
      remote="$1"
      ;;
  esac
  shift
done

[[ -n "$remote" ]] || {
  usage >&2
  exit 2
}

if [[ ! "$remote" =~ ^[A-Za-z0-9._-]+@([A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+\])$ ]]; then
  fail "remote must use the form user@host"
fi

for command_name in date grep mkdir rsync ssh ssh-add tail; do
  require_command "$command_name"
done

script_directory="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1
  pwd -P
)"
repository_root="$(
  cd -- "${script_directory}/.." >/dev/null 2>&1
  pwd -P
)"

[[ -f "${repository_root}/package.json" ]] ||
  fail "repository package.json was not found"
grep -Eq '"name"[[:space:]]*:[[:space:]]*"reverse-copy"' \
  "${repository_root}/package.json" ||
  fail "resolved directory is not the Reverse Copy repository"

data_directory="${repository_root}/data"
logs_directory="${repository_root}/logs"
pm2_logs_directory="${logs_directory}/pm2"

mkdir -p "$data_directory" "$logs_directory" "$pm2_logs_directory"

ssh_key="${REVERSE_COPY_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
[[ -f "$ssh_key" ]] || fail "SSH key was not found: $ssh_key"

if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
  eval "$(ssh-agent -s)" >/dev/null
  ssh-add "$ssh_key"
fi

ssh_arguments=(-i "$ssh_key" -o IdentitiesOnly=yes)
rsync_ssh="ssh -i ${ssh_key} -o IdentitiesOnly=yes"

if [[ -n "${REVERSE_COPY_SSH_PORT:-}" ]]; then
  [[ "$REVERSE_COPY_SSH_PORT" =~ ^[0-9]+$ ]] ||
    fail "REVERSE_COPY_SSH_PORT must be numeric"
  ssh_arguments+=(-p "$REVERSE_COPY_SSH_PORT")
  rsync_ssh+=" -p ${REVERSE_COPY_SSH_PORT}"
fi

rsync_arguments=(
  -r
  -z
  --compress-level=1
  --no-times
  --partial
  --human-readable
  --info=progress2
  --protect-args
  --rsync-path="nice -n 10 rsync"
  -e "$rsync_ssh"
)

if [[ -n "${REVERSE_COPY_RSYNC_BWLIMIT_KBPS:-}" ]]; then
  [[ "$REVERSE_COPY_RSYNC_BWLIMIT_KBPS" =~ ^[1-9][0-9]*$ ]] ||
    fail "REVERSE_COPY_RSYNC_BWLIMIT_KBPS must be a positive integer"
  rsync_arguments+=(
    "--bwlimit=${REVERSE_COPY_RSYNC_BWLIMIT_KBPS}"
  )
fi

if ((dry_run == 1)); then
  rsync_arguments+=(--dry-run --itemize-changes)
fi

printf 'Reverse Copy pull-only VPS sync\n'
printf 'Remote: %s\n' "$remote"
printf 'Local:  %s\n' "$repository_root"
if ((dry_run == 1)); then
  printf 'Mode:   DRY RUN — no local files will be changed\n\n'
else
  printf 'Mode:   LIVE PULL — VPS remains read-only\n\n'
fi

printf 'Checking SSH and reviewed VPS paths...\n'
ssh "${ssh_arguments[@]}" "$remote" \
  "command -v nice >/dev/null &&
   command -v rsync >/dev/null &&
   test -r /opt/bybit-rev/data &&
   test -r /opt/bybit-rev/logs &&
   test -r /opt/bybit-rev/bot-state.json &&
   test -r /home/deploy/.pm2/logs &&
   printf '  Remote UTC: ' &&
   date -u '+%Y-%m-%d %H:%M:%S UTC'" ||
  fail "SSH failed or one or more reviewed remote paths are unavailable"

if ((pull_data == 1)); then
  printf '\n[1/5] Syncing large collector journals and data files...\n'
  rsync "${rsync_arguments[@]}" --size-only \
    "${remote}:/opt/bybit-rev/data/" \
    "${data_directory}/"
else
  printf '\n[1/5] Skipping large data-journal pass (--no-data).\n'
fi

printf '\n[2/5] Refreshing mutable HYPE health/state snapshots...\n'
rsync "${rsync_arguments[@]}" --ignore-times \
  --include='HYPEUSDT_5.json' \
  --include='HYPEUSDT_15.json' \
  --include='HYPEUSDT_240.json' \
  --include='HYPEUSDT_*_health.json' \
  --include='HYPEUSDT_*_state.json' \
  --include='HYPEUSDT_status.json' \
  --include='HYPEUSDT_upside_readiness.json' \
  --include='*.lock' \
  --exclude='*' \
  "${remote}:/opt/bybit-rev/data/" \
  "${data_directory}/"

printf '\n[3/5] Refreshing transactional bot-state.json...\n'
rsync "${rsync_arguments[@]}" --ignore-times \
  "${remote}:/opt/bybit-rev/bot-state.json" \
  "${repository_root}/bot-state.json"

printf '\n[4/5] Syncing application-generated logs...\n'
rsync "${rsync_arguments[@]}" --size-only \
  "${remote}:/opt/bybit-rev/logs/" \
  "${logs_directory}/"

printf '\n[5/5] Syncing PM2 output and error logs...\n'
rsync "${rsync_arguments[@]}" --size-only \
  "${remote}:/home/deploy/.pm2/logs/" \
  "${pm2_logs_directory}/"

printf '\nSync complete: '
date -u '+%Y-%m-%d %H:%M:%S UTC'

if ((dry_run == 1)); then
  printf 'Dry run only; run again without --dry-run to perform the pull.\n'
elif command -v jq >/dev/null 2>&1; then
  printf '\nEmbedded source freshness:\n'
  jsonl_tail_timestamp "HYPE 1m candle" \
    "${data_directory}/HYPEUSDT_1m.jsonl"
  jsonl_tail_timestamp "HL taker stream" \
    "${data_directory}/HYPEUSDT_taker_hyperliquid.jsonl"
  json_file_timestamp "Runtime health" \
    "${data_directory}/HYPEUSDT_runtime_health.json" '.writtenAt'
  json_file_timestamp "Short live health" \
    "${data_directory}/HYPEUSDT_hl_short_live_health.json" '.writtenAt'
  json_file_timestamp "Bot status" \
    "${data_directory}/HYPEUSDT_status.json" '.ts'
  printf '\nCollectors continue writing during the pull, so small trailing deltas are normal.\n'
else
  printf 'Install jq to include embedded source timestamps in the final summary.\n'
fi
