# Shared HYPE portfolio: cutover runbook

Status, 2026-10-11: executable build; **not deployed or armed**. Trading rules live
in [the maintained overview](live-strategy-overview-2026-09-25.md#shared-account-portfolio--built-not-armed).
This page is the operational procedure, not a second strategy definition.

The combined-loop check passes: three setup slots plus the main ladder share the
simulated hedge account; the maker TP owns only the main quantity; a setup exit
still executes while entries are paused; outgoing collateral remains reserved
through its minute, including a restart. This is wiring evidence, not a full
historical portfolio replay or a live venue-fill guarantee.

## Preconditions

- Account UID 555249668, HYPE hedge mode, both sides 25x, cross margin. The bot
  never changes leverage or account mode. Unsuffixed BYBIT credentials only.
- Old main/SFP/HL-short trading owners stopped; both accounts flat with no
  unresolved orders. Keep `bot-pause` and `lawbster-sfp-pause`.
- Preserve VPS-local `sfp-live-config.json`, `bot-state.json`, `.env` and both tiny
  probe reports. Do not reset/stash-drop them to make a pull succeed.
- Only deploy a reviewed commit. `git status --short` before pulling; reconcile
  any local file also changed by that commit. No `git reset --hard`.

## 1. Transfer the existing bootstrap once

From local PowerShell, after creating `data/portfolio` on the VPS:

```powershell
scp backtests/portfolio-feed-bootstrap/88cd5182ee20dd09/hype-warmup.jsonl.gz deploy@46.225.80.0:/opt/bybit-rev/data/portfolio/hype-warmup.jsonl.gz
```

The 24,505,646-byte packet is historical warmup, not historical live evidence.
Expected SHA256:
`b57af6877889cb63e148ff6f92e78f6cfd06a475e6bc1825b215d0c2f5f8fdd8`.
Do not regenerate it or commit the dataset. Continuous local collector/repair
minutes must bridge its Oct 10 12:51 UTC end to the present. A gap is a blocker,
not permission to fill candles from the future. A much later deployment may need
a one-time verified bootstrap extension; copying only the most recent tail is
not enough if it no longer spans that gap.

## 2. Build and read-only preflight

After the release commit is pulled, run as deploy in `/opt/bybit-rev`:

```bash
npm run build
node dist/bot/portfolio-live.js --preflight
```

Require correct UID, flat long/short, zero orders, no full-side protection,
expected equity and `bootstrapHashMatches:true`. `readyToArm:false` is deliberate.
The main config content hash ignores whitespace/line endings; semantic drift
blocks startup. Do not replace the pin just to bypass a mismatch.

October 11 preflight correction: account-info responses may omit the top-level
server timestamp (as documented by Bybit). Only that endpoint permits omission;
the request and whole snapshot still expire after five seconds, and any supplied
timestamp is checked. Startup/preflight failures now emit a sanitized endpoint
and reason, not a generic stop message. No trading rules or enable flags changed.

## 3. Observe only

Back up config/state to `$HOME` first. Then:

```bash
(
set -euo pipefail
cd /opt/bybit-rev
test -f bot-pause
test -f lawbster-sfp-pause
touch portfolio-pause
cp portfolio-live-config.json "$HOME/portfolio-live-config.pre-observe.$(date -u +%Y%m%dT%H%M%SZ).json"
cp bot-state.json "$HOME/bot-state.pre-portfolio.$(date -u +%Y%m%dT%H%M%SZ).json"
TMP="$(mktemp ./portfolio-live-config.json.XXXXXX)"
jq '.enabled=true | .mode="observe" | .entryEnabled=false' portfolio-live-config.json > "$TMP"
mv -- "$TMP" portfolio-live-config.json
pm2 start dist/bot/portfolio-live.js --name hype-portfolio-live --kill-timeout 30000 -- --initialize-flat
pm2 restart hype-health-watchdog
pm2 save
)
```

First initialization requires flat saved legacy state and imports its risk/latch/
cooldown memory. It does not edit that file or import any positions. Observe mode
refuses every exchange write, even with a stray flatten signal. Do not run a
second copy with `--once` while PM2 owns its locks.

After warmup, paste these compact checks:

```bash
jq '{ageSeconds:((now*1000-.writtenAt)/1000),mode,entryEnabled,status,error,tickMs,reconciliation,pending,recovery,feed,mainInputs}' data/HYPEUSDT_portfolio_health.json
npm run watchdog -- --once --dry-run
```

Healthy observing must show mode observe, entries false, a current heartbeat,
flat reconciled quantities, no pending/recovery, current continuous minute
coverage, and healthy main sources. Review actual tick/receipt latency before
arming: long API cycles can miss one-minute entry windows. Startup-only freshness
is not enough; verify after warmup and across a subsequent minute boundary.

## Release boundary

No live-mode/arming command is approved by this runbook yet. Remaining: real
adapter/feed observation plus coupled signal-to-order/capital acceptance against
the archived parent. Component tests and tiny probes are not that acceptance.
After review, activation is one configuration change and restart of **only**
`hype-portfolio-live`; legacy owners must remain stopped.

## Controls and recovery

- `touch portfolio-pause`: entry pause, exits continue in live mode.
- `touch portfolio-flatten`: persistent all-owner drain, also pauses entries.
- `rm portfolio-pause`: only removes the pause; cannot enable a disabled config.
- `touch portfolio-regime-arm`: explicit reset of the daily red/green breaker
  only. It does not clear damaged-regime or transaction recovery.
- Configuration changes require restarting the new owner. Never switch to observe
  while it holds inventory; observe startup requires flatness.
- Old Discord `-pause/-resume/-closeladder` control old signal files, **not this
  portfolio**. Use the commands above. Old rung-size overrides do not apply.
- Unknown fills/child ownership: keep entries paused, inspect Bybit and the
  checksummed ledger. Never delete state/locks to clear an incident.
- After a crash a lease may need manual recovery: verify the exact recorded PID
  is dead, PM2 owner stopped and no other writer exists before removing that exact
  stale lock. No automatic stale-lock stealing.
- Rollback to old owners is **flat-only** after all portfolio child/entry orders
  are terminal. Stop the portfolio, disable its takeover config, reconcile old
  flat state and actual account, then explicitly choose which legacy owner to
  restart. Never start the old bot over virtual portfolio inventory.

Collectors keep running. Maker-TP shadow for the retired main can be stopped
after cutover; the portfolio watchdog does not interpret its old heartbeat.
