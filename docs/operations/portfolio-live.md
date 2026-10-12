# Shared HYPE portfolio: cutover runbook

Status, 2026-10-12 07:03:37 UTC: after deploying the add-expiry repair `2fcac75`,
the owner is **live, entries paused**, with one 9.15-HYPE main rung and a verified
resting maker TP at $88.58. Startup exposed `minute_feed_gap` at the October 10
bootstrap boundary. Keep the owner running to service exits. The journal
catch-up repair below is locally verified but not yet confirmed deployed.

Historical activation, 2026-10-11: operator-confirmed **live and armed** on hypehedgeguy.
The pasted health snapshot, with reconciliation at 11:37:06 UTC, shows mode live,
entries true, healthy, long/short quantities zero, no pending/recovery/error,
equity $19,045.56 and tick 11.969s. Watchdog dry-run reports no incidents.
This confirms activation, not a production trade or an incident-free history.
The earlier observe snapshot verified repeated evaluation of all setup builders.
Trading rules live
in [the maintained overview](live-strategy-overview-2026-09-25.md#operational-live-config-explained).
This page is the operational procedure, not a second strategy definition.
Initial cutover instructions below are retained for reference; do not repeat
initialization or restart old owners after the completed activation.

The combined-loop check passes: three setup slots plus the main ladder share the
simulated hedge account; the maker TP owns only the main quantity; a setup exit
still executes while entries are paused; outgoing collateral remains reserved
through its minute, including a restart. This is wiring evidence, not a full
historical portfolio replay or a live venue-fill guarantee.

## October 12 add expiry repair

The first eligible add repeatedly cancelled its maker TP and then failed because
the approval or its underlying account/price evidence had expired. The local
repair obtains fresh evidence and reruns the unchanged exit/add gates after
terminal cancellation, retaining the original inventory identity. A fill during
cancellation cannot become a new ladder. Freshness is checked again after the
final account read, immediately before entry submission; the five-second bound
is unchanged. Only genuinely unsubmitted reservations are released on failure.

The shared loop now attempts exit/TP servicing even if an add throws. A durable
state-write failure still stops trading instead of attempting repair orders.
Missing/unknown exchange evidence can still delay protection; this is not a
guarantee of uninterrupted TP coverage or execution.

Deploy only a reviewed committed build, preserve the VPS-local live config and
`portfolio-pause`, and restart only `hype-portfolio-live`. Do not initialize state
or restart old owners. Before resuming, verify fresh paused health, matching
exchange/owned quantity, no recovery/unresolved mutations, and one correctly
sized reduce-only TP. After resuming, check the next naturally eligible add:
one new rung or an explicit valid gate, no repeated identical TP cancellations,
and the target resized to the remaining main quantity. No forced test trade is
required. The repair does not change sizing, strategy gates, targets or alarms.

## October 12 candle journal catch-up repair

The old loader read only the last 1 MB of each journal on startup. Once those
bytes no longer contained the first minute after the pinned bootstrap, the
worker could never join its historical prefix to the live feed. The synced
main journal's 1 MB tail began at October 10 14:48 UTC, after the required
12:51 UTC minute; the missing bridge was present earlier in the same file.

The loader now scans local journals from the beginning once, discards rows
before the bootstrap overlap, then resumes at a byte cursor. Reads use 256 KiB
chunks and at most 8 MiB per file per refresh; no full-file buffer or REST
backfill. Unchanged complete files are only stat'ed. Incomplete records wait
for their newline; rotation/truncation restarts the scan. Valid future-dated
publications wait until their recorded availability and are not silently lost.
Consumer observation time remains the availability of newly ingested history.
Gaps, conflicts and the existing pending-buffer limit still fail closed.

Read-only verification joined all **2,499 minutes** from October 10 12:51 UTC
through the synced journal's October 12 06:30 UTC cutoff in five bounded passes,
with zero pending candles/conflicts. The 19 feed tests, seven feed-health groups
and both production typechecks pass. No strategy, account, bootstrap, candle
file or alert threshold changed, and no exchange calls were made.

Deploy with entries paused, preserve live configs/state and restart only
`hype-portfolio-live`. Do not initialize or regenerate the bootstrap. Inspect
`feed.loader.bytesRead` and `unreadBytes` for catch-up progress, then require a
current `feed.health.through`, `gapAt:null`, no loader/policy/input error and
fresh healthy paused account reconciliation before resuming. A real missing
candle must remain blocked; do not clear an incident by bypassing that check.
Verify the remaining quantity and correctly sized reduce-only TP on Bybit.

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

## 4. Shared-book acceptance and paused live start

`scripts/portfolio-joint-receipt-parity.ts` reconstructs the sealed combined
ladder/setup/MACD book using the production lot ledger. Evidence:
`backtests/portfolio-joint-receipt-parity/ef58d80524e4f355/verification.json`.
In each TP model it reconciles all 406,851 minute-close equity marks and every
monthly total; 7,385 / 7,201 receipts and 6,073 / 5,965 decision groups match.
At $19,047.16 seed capital, no archived admission changes. Rechecking with the
live cash mark after observed exits, while retaining outgoing collateral,
also changes no approval (minimum standard-path headroom $6,116.58).

This closes the shared-account receipt/capital composition check. Together with
the source/allocator parity and assembled-loop tests, it supports proceeding to
a **paused live-mode check**. It does not claim a fresh full-history run of the
live main-policy detector, an asynchronous exchange simulator, guaranteed fills,
or liquidation safety. Signals/main actions in this audit are sealed inputs;
the known stress-path risks in the builder handoff still apply. Do not describe
this as a new profitable strategy result or add it to the archived earnings.

No new daemon code was required; an operator already running `a18e5f3` need not
pull/build again for this step. Keep old owners stopped. Run as deploy:

```bash
(
set -euo pipefail
cd /opt/bybit-rev
test -f bot-pause
test -f lawbster-sfp-pause
test -f portfolio-pause
test ! -e portfolio-flatten
jq -e '.enabled == true and .mode == "observe" and .entryEnabled == false and
  .expectedAccountUid == "555249668" and .initialEquity == 19047.16' portfolio-live-config.json >/dev/null
jq -e '(now*1000-.writtenAt | . >= 0 and . < 30000) and
  .uid == "555249668" and .status == "healthy" and .mode == "observe" and
  .entryEnabled == false and .error == null and .recovery == null and
  (.pending | type == "array" and length == 0) and
  .reconciliation.longQty == 0 and .reconciliation.shortQty == 0 and
  (now*1000-.reconciliation.at | . >= 0 and . < 15000)' data/HYPEUSDT_portfolio_health.json >/dev/null
cp portfolio-live-config.json "$HOME/portfolio-live-config.pre-live.$(date -u +%Y%m%dT%H%M%SZ).json"
TMP="$(mktemp ./portfolio-live-config.json.XXXXXX)"
jq '.mode="live" | .entryEnabled=true' portfolio-live-config.json > "$TMP"
mv -- "$TMP" portfolio-live-config.json
pm2 restart hype-portfolio-live
pm2 save
)
```

The pause file still blocks every entry. After warmup, inspect:

```bash
jq '{ageSeconds:((now*1000-.writtenAt)/1000),processStartedAt,uid,mode,
  configuredEntryEnabled,entryEnabled,status,error,tickMs,reconciliation,
  pending,recovery,mainInputs,feedError:.feed.health.policyError,
  gapAt:.feed.health.gapAt}' data/HYPEUSDT_portfolio_health.json
npm run watchdog -- --once --dry-run
```

Require a **new process identity**, `mode:live`, `configuredEntryEnabled:true`,
effective `entryEnabled:false`, fresh healthy/flat reconciliation, no pending or
recovery, no feed/main-input error and a clean watchdog before removing the
portfolio pause. Do not remove the legacy pauses. That staged check passed;
the operator then removed only `portfolio-pause` and returned the live/armed
snapshot recorded above. No further restart or activation is required.

## Controls and recovery

- `touch portfolio-pause`: entry pause, exits continue in live mode.
- `touch portfolio-flatten`: persistent all-owner drain, also pauses entries.
- `rm portfolio-pause`: only removes the pause; cannot enable a disabled config.
- `touch portfolio-regime-arm`: explicit reset of the daily red/green breaker
  only. It does not clear damaged-regime or transaction recovery.
- Configuration changes require restarting the new owner. Never switch to observe
  while it holds inventory; observe startup requires flatness.
- Commander migration is operator-confirmed deployed on October 11. Default/HYPE
  commands target the portfolio exclusively (table below). Old rung-size and
  Discord regime overrides are refused for HYPE.
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

## Discord controls and status (October 11)

Operator-confirmed after deployment: Commander acknowledged pause/resume and
reported entries armed, healthy, flat with no pending work at 13:01:26 UTC.
The subsequent locally synced 13:10 UTC health is separate dated evidence.

The existing command channel is still the access boundary. Anyone allowed to
post there can issue these commands; keep it private. No new credentials or
process are needed. Commander writes signals only; the portfolio remains the
sole exchange writer.

| Discord command | Effect |
|---|---|
| `-status` | Read the latest portfolio health: ladder depth, three slots, MACD short, owner quantities/cost/estimated PnL, protection, deadlines, gates and health |
| `-pause` | Save `portfolio-pause`; no new entries/adds once checked, exits keep running. Already-submitted orders may still fill |
| `-resume` | Remove only `portfolio-pause`, after fresh healthy live/account evidence, enabled config, no active drain/exit, and no pending mutation/reservation |
| `-flatten` | Save pause first, then persistent `portfolio-flatten`: drain **all owners**, including late fills; leave entries paused |

Each accepts `hype` or `portfolio` as its optional argument. `-close hype`,
`-close portfolio` and the old `-closeladder` alias now flatten **the whole
portfolio**, not only main rungs. `-help` explains this scope. Explicit SUI/FART
commands retain their separate legacy routing. There is no HYPE fallback to old
files if the portfolio config/health is absent or invalid.

Replies acknowledge a **saved request**, not an exchange fill or an already
completed pause. Check `-status` afterward. Flatten still needs a running owner
and a reachable venue; if it is stalled, inspect Bybit directly. No command
restarts a dead owner, clears recovery, enables a disabled config, or touches
`bot-pause` / `lawbster-sfp-pause`. Do not remove those old pauses.

Resume requires health <=30s old and account evidence <=60s old. Resting
protection is not treated as an unfinished mutation; open transactions and
reservations block resume. A valid monitor schema is required, so updating only
Commander will not enable resume over the older owner build. A pending flatten
file or active exit prevents resume. Commands older than 90s (or future-dated)
are rejected rather than replayed; startup skips the existing channel history.
Polling is serial to avoid duplicate execution during slow Discord replies.

The same read-only summary is available without Discord or a new daemon:

```bash
node dist/bot/portfolio-status.js
pm2 logs hype-portfolio-live --lines 45
```

The owner prints once a minute, plus changes to positions, receipts, protection,
mode and health. This uses the existing snapshot; **no additional exchange reads
or trading decisions**. Gates are the actual tick results, not parallel
recomputations. Realized PnL is the portfolio ledger since activation, net of
trading fees and before separately shown funding; it does not import the old
ladder's startup PnL. Unrealized PnL uses last bid/ask before exit fees. Exposure
is entry cost, not margin or a live mark. Protection means last verified; stale
health/account evidence is marked, not silently substituted with old state.
Timed/indicator positions without a price stop are labelled as such by design.

Deployment of this observability/control update does not change strategy rules.
Preserve the armed VPS-local configs. Build/test before restarting. Pause entries,
wait for fresh health with no non-resting pending transactions, reservations,
recovery or active drain, then restart **only `hype-portfolio-live` and
`commander`**, never the old owners. Verify fresh owner health/status and the
new Commander online message. Test `-status` and `-pause`, then `-resume` only
when ready to re-arm. **Do not test `-flatten` against real positions unless
you actually intend to close them.** Keep the watchdog/collectors running.

Local checks: `npm run test:portfolio-commander`, build and VPS typecheck. The
control tests use temporary files only, not the real command channel or venue.

## Feed refresh and alert classification (October 11)

Operator-confirmed deployed: the 13:01:26 UTC status shows an 11.7s tick with a
952ms feed snapshot, no gap and no feed fault. This does not prove historical
ladder-context readiness; the separate recovery correction below is pending.

The synced 12:34:57 UTC health shows a 11,739ms tick, no pending orders or
recovery, and a feed snapshot rejected for freshness. The setup stage completed
5,349ms before health publication. The old worker refreshed only on owner
requests, so serial exchange work could outlast its five-second snapshot budget.
This is a real temporary inability to use those inputs, not proof of bad candles.

The read-only worker now refreshes autonomously one second after each completion,
single-flight, independently of owner REST work. Unchanged journal files are only
stat'ed and existing feature caches are reused; no extra Bybit calls or daemon.
Health sampling occurs after awaited funding work, using a current clock.
Snapshots must still be at most five seconds old and in the current decision
minute. Candle availability, gaps and source errors remain checked; a heartbeat
does not make stale candles tradable. No sizing, entry, exit or cooldown rule is
changed, and the owner never waits for a worker refresh to service exits.

Health, console and on-demand status separate transport freshness from data
faults. `feed.diagnostics` records snapshot time/age, received time, required
decision minute, candle-through time, gap and fault. `degradation` maintains
separate fault and feed-delay clocks.

| Condition | Watchdog treatment |
|---|---|
| Refresh delay / minute rollover / bootstrap under 60s | Visible in health/status; no feed-delay incident yet; dependent decisions still fail closed |
| Timing-only delay lasting at least 60s | `portfolio_feed_delayed`, warning; subject to the existing two-sample warning lifecycle |
| Timing-only delay lasting at least five minutes | Same incident escalates to critical |
| Worker failure/exit, invalid worker clock, or recovery | Critical `portfolio_degraded`, without the timing grace |
| Candle gap, loader/policy/input error, account/execution error | Critical degradation after the existing 60s sustained-fault threshold; never downgraded to a timing warning |

Missing owner heartbeat, identity/config mismatch and unconfirmed transactions
retain their separate checks. Independent exits remain serviced by the running
owner; feed-dependent exits still require valid inputs. The watchdog remains
alert-only. Old health schemas retain conservative critical handling.

For subsequent deployment, keep armed VPS-local
configs preserved, entries paused and pending mutations/recovery/drain clear.
Build before restarting `hype-portfolio-live`; verify fresh health, then restart
`hype-health-watchdog` to load the new classification. Also restart `commander`
when its control/status code changes. Keep collectors running and never
restart retired owners. Inspect the following before re-arming, then check a
subsequent setup publication window (not just one healthy tick):

```bash
jq '{ageSeconds:((now*1000-.writtenAt)/1000),status,error,tickMs,degradation,feed:.feed.diagnostics,reconciliation,pending,recovery}' data/HYPEUSDT_portfolio_health.json
npm run watchdog -- --once --dry-run
```

Local checks: `test:portfolio-feed-health`, `test:portfolio-feed`,
`test:portfolio-setup-runtime`, Commander/watchdog regression tests and both
production typechecks. The worker test holds the owner quiet for 6.5s and verifies
fresh snapshots continue without requests; stale/current-minute rejection and
fault priority are tested separately. No live test orders are needed for this fix.

## Historical-context recovery (October 11, deployed)

Operator-confirmed at **2026-10-11 13:33:12 UTC** after deploying `3651c4a`:
live, entries armed, healthy, all owners flat, no pending work/recovery,
14-day history **4,032/4,032**, no missing inputs. The missing-context gate
cleared; normal trend/damaged-regime blocks remained. This is dated operator
evidence, not a continuous health claim. The compact current rule map is the
[tabbed operator guide](live-strategy-overview.html).

The operator's new startup log stops at four pages with `backfillStop=api_error`.
Synced health around 13:10 UTC still reports `overextended_context_unavailable`
despite a ready minute feed. Historical initialization returned normally after
an interrupted backfill; the portfolio marked it prepared, while later refreshes
checked only six hours and fetched the newest 200 five-minute candles. This
could leave the required 14-day history incomplete without a health incident.
The log alone does not distinguish an API rejection from a local request/startup
timeout, or identify all failed entry sub-checks.

The correction is input recovery/observability only, not strategy tuning:

- Startup keeps its existing seed and hydration behavior. Background recovery
  targets the configured 14-day requirement (4,032 closed 5m bars); existing older
  seed/fetched rows are retained. Portfolio RSI/CRSI still come from the canonical
  minute worker, and S/R uses its unchanged configured map window.
- Incomplete initialization remains visible. With recent context healthy, a
  background request fetches one page ending at the first missing historical
  candle. Successful partial repairs resume after 10s; failed/no-progress repairs
  retry after 30s, then 60s, 120s, 240s, capped at 5m. Healthy history stops repair.
  Recent-candle refreshes take priority. No repeated seed reload or exchange
  account/order calls are added.
- Requests share the existing single-flight ownership. A timed-out request must
  settle before another can start. Late results are checked against the request's
  start time; a candle that was forming then is not silently treated as final.
  The order-management loop never awaits repair.
- The original entry predicate is unchanged and shared with diagnostics. Health
  now checks the full required history and fresh-entry inputs, so six healthy
  hours cannot conceal missing 14-day coverage. Sustained missing history uses
  the existing critical input-fault path, not the refresh-delay warning path.
- `mainContext` in health reports coverage, first missing timestamp, original
  hydration result/error, request status and repair backoff. `overextended`
  shows current missing inputs and RSI/CRSI; `report.add.decision.entryContext`
  records the exact values/checks used by that add decision when evaluated.
  Console/Discord status shows required versus available bars and retry details.

Local verification reproduces interrupted startup, interior gaps, no progress,
late completion, single-flight ownership, exponential retry, healing and the
unchanged entry predicate. Existing context-manager and main-policy tests are
reused. Deployment is confirmed above; strategy thresholds and sizing are unchanged.

For a future redeployment, after build and the usual paused-entry/pending-work preflight, restart only
`hype-portfolio-live` for recovery and health reporting. Restart `commander` too
to load the richer Discord formatter. The already-deployed watchdog understands
the existing critical input-fault classification; it needs no new rule.
Do not restart the old owners or bypass the gate. Check:

```bash
jq '{status,error,mainInputs,mainContext,entryCheck:.report.add.decision.entryContext}' data/HYPEUSDT_portfolio_health.json
```

Expect `mainContext.coverage.healthy=true`, 4,032/4,032 bars, and no missing
overextension inputs after recovery. Normal trend/damaged-regime blocks may
remain. Recovery has no guaranteed deadline during a genuine source outage.

## PM2 cleanup after cutover

October 11: operator requested removal of unused non-HYPE alarms, the retired
HL-short trio and the old maker-TP shadow. Preserve Commander, HYPE alarm,
collectors, portfolio and watchdog online; preserve the existing stable-corridor
entry stopped. Keep legacy main/SFP entries stopped. The proposed inventory is
in the [overview](live-strategy-overview-2026-09-25.md#current-pm2-services-and-cleanup).
Cleanup is now operator-confirmed by the October 11 PM2 list: six online and
three stopped, with all eleven removal candidates absent. Stable corridor and
the two old owners remain stopped. No post-cleanup watchdog output was included
in that paste; the last clean watchdog evidence is the earlier activation check.
The commands below are the completed procedure, not another task to run.

The read-only check below uses saved retirement evidence, not a new exchange
flatness check: the portfolio may now legitimately hold its own short. Do not
start or run the retired short CLI. The PM2 backup stays privately under `.pm2`;
it can contain environment secrets, so do not paste or commit it. Do not restore
all processes from this backup over a running portfolio.

```bash
(
set -e
cd /opt/bybit-rev
jq -e '.enabled == true and .mode == "live" and .expectedAccountUid == "555249668"' portfolio-live-config.json >/dev/null
node -e 'const r=require("./dist/bot/hl-short-retirement").readHlShortRetirement(process.cwd(),"HYPEUSDT"); if(!r.retired || r.error) throw Error("Stop: HL retirement evidence invalid");'
cp -p "$HOME/.pm2/dump.pm2" "$HOME/.pm2/dump.pre-portfolio-cleanup.$(date -u +%Y%m%dT%H%M%SZ).pm2"
pm2 delete alarm-BLUAIUSDT alarm-DUSKUSDT alarm-RIVERUSDT alarm-SIRENUSDT alarm-STGUSDT alarm-TAOUSDT alarm-VVVUSDT
pm2 delete hype-hl-short-live hype-hl-short-shadow hype-hl-short-bpv-shadow
pm2 delete hype-maker-tp-shadow
pm2 save
pm2 list
npm run watchdog -- --once --dry-run
)
```

`pm2 delete` removes these process registrations (and stops the maker observer),
not their source, data or history. Preserve the HL retired state/health files:
the watchdog still uses them to validate retirement. Portfolio takeover already
suppresses the old maker shadow's heartbeat, so no watchdog restart or new
opt-out is required. Investigate any unexpected incident; do not delete evidence
to silence it. Removing already-stopped entries is list cleanup, not RAM saving;
the maker observer is the only running process removed, about 95 MB in the
operator's snapshot. No changes are made to the separate stable-corridor project.
