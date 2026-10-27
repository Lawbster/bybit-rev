# Shared HYPE portfolio: cutover runbook

Latest operator report, **October 26, 2026 (Europe/Oslo report date):** deposited
**5,249.2517517 USDT** into hypehedgeguy, UID 555249668. Reported post-deposit
equity is **$23,593.87 with one open position**. Exact transfer UTC, transaction ID,
free collateral and position details were not provided; no independent exchange
query was made. Record this as an **external capital contribution, not trading
P&L**. Do not reset realized P&L, strategy state or historical replay seeds.
No configuration, sizing or live controls changed for this accounting note.

The operator's October 25 pasted health confirms AA01 sizing loaded in live mode,
healthy, reconciled at **01:08:33.712 UTC**, with 113.55 HYPE long, no pending work
or recovery. Entries were paused then. The newer synced **October 27 08:32:35 UTC**
snapshot has entries armed but is degraded by `minute_feed_gap`: all owners flat,
no pending work/recovery, equity/free $23,296.70. The fix below is not yet confirmed
deployed. Neither snapshot is a current exchange query.

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

## October 27 invalid-minute repair — prepared, not deployed

**Incident:** the 07:37 and 07:38 UTC HYPE candles were stamped received
783–788ms before their close. Four raw rows (two copies per minute) were rejected
by the portfolio. The collector's repair scan counted those records as present,
reported zero missing minutes, and never fetched usable replacements. At the
08:32:35 snapshot, 53 later minutes waited behind that gap. The earlier L2 timeout
fully closed 168.17 HYPE at 06:17:12 UTC; it is not an outstanding position.

Bybit timestamp-window errors and Binance timeouts also occurred. Account reads
subsequently recovered. The operator's clock check was synchronized, with no
time-sync journal entries in the incident window; the timing trigger is still
unknown. This patch fixes the persistent repair blockage, not NTP or API latency.

**Patch:** publication-tagged one-minute rows must satisfy the portfolio's
source/identity, numeric candle and receipt/close clock rules to suppress repair.
Apply that check both when finding gaps and after the REST request, so an invalid
concurrent row cannot cancel its replacement. Legacy price-only coverage and
five-minute handling are unchanged. Raw data is preserved; valid REST replacements
are appended to `data/candle-repairs/` with their actual new availability time.
No historical publication is invented. Trading validity checks, sizing, state,
signals and Discord alert thresholds are unchanged. Real gaps still alert.

**Verification:** test suites and the HTML test mode were skipped at the
operator's explicit request. Production typecheck, diff review, HTML regeneration
and freshness check only. Recovery after deployment is not yet observed.

**Deploy:** pause portfolio entries; preserve VPS-local configs and state; pull
and build, then restart **`bybit-collect` only**. Leave `hype-portfolio-live`
running: it already consumes appended repair rows. The repair worker runs at
startup, then cycles streams every 30 seconds (about six minutes per full cycle).
Wait for fresh repair health and portfolio health, current feed `through`,
`gapAt:null`, no loader/policy error, healthy account reconciliation and no recovery.
Then guarded Discord `-resume`, `-status`, and `pm2 save`. If still degraded,
retain the pause and inspect the reported cause; do not rewrite candles, clear
state, reseed the cache or replay expired entry windows. No automated VPS action
was performed here.

## October 25 ADX sizing

See [verification, capital limit and remaining evidence gaps](portfolio-adx-sizing-2026-10-25.md).
Explicit profile `AA01-PA07-3x-L2-R5-2x-others-1.3x-v1`: PA07 $20k,
L2/R5 $13,333.33 each, SF08/CRSI $8,666.67 each, R3 $13k; ladder unchanged.
The previous `PAL02-PA07-3x-others-1.3x-v1` meaning is preserved: L2/R5 are
$8,666.67 there. [October 23 evidence](portfolio-selective-sizing-2026-10-23.md)
is historical, not the new allocation. Missing field means baseline
`HS01-base-v1`. Repository config stays disabled/observe and baseline-sized.
There is no deployment, automatic config migration, equity compounding or
position top-up in this commit. The historical HTML chart remains baseline.

**Capital:** all owners at maximum need about $22,464 before extra stop-risk
reserves. The October 26 reported equity is about $1,130 above that estimate;
this is not free collateral or guaranteed admission headroom, especially with
open-position P&L and extra reserves. Existing capital guards
refuse new entries/adds, without changing old quantities or forcing a close.
An invalid profile fails closed for new risk but leaves owned exits serviced.
Commander refuses resume if config and running profile do not match.

### Sizing cutover

Only the operator runs this on the VPS. Do not start any retired owner or run
`--initialize-flat`. Protect pending fills and current inventory throughout.

1. `cd /opt/bybit-rev`; `git status --short`. Preserve all VPS-local armed
   config and pause/state files. This release does **not** change
   `portfolio-live-config.json`; stop if pull would overwrite unrelated local work.
2. `touch portfolio-pause` (or Discord `-pause`). Wait for fresh healthy status,
   `entryEnabled:false`, no recovery, no unconfirmed mutations/reservations or
   active exits. Reconcile current exchange quantities/open orders. Confirm
   existing maker/bracket protection, if any; old-size positions can remain.
3. `git pull --ff-only`, then `npm run build` as separate commands; stop on any
   error. Do not restart old services. Backup config before changing only the
   sizing field:

```bash
(
set -euo pipefail
cd /opt/bybit-rev
test -f portfolio-pause
jq -e '.expectedAccountUid == "555249668" and .exchangeLeverage == 25 and
  .enabled == true and .mode == "live" and .entryEnabled == true and
  ((.sizingProfile // "HS01-base-v1") as $p |
    ["HS01-base-v1", "PAL02-PA07-3x-others-1.3x-v1", "AA01-PA07-3x-L2-R5-2x-others-1.3x-v1"] | index($p) != null)' portfolio-live-config.json >/dev/null
jq -e '(now*1000-.writtenAt < 30000) and .status == "healthy" and
  .entryEnabled == false and .error == null and .recovery == null and
  .monitor.pendingMutations == 0 and .monitor.reservations == 0 and
  .monitor.activeExits == 0 and (all(.pending[]; .resting == true))' data/HYPEUSDT_portfolio_health.json >/dev/null
cp portfolio-live-config.json "$HOME/portfolio-live-config.pre-sizing.$(date -u +%Y%m%dT%H%M%SZ).json"
TMP="$(mktemp ./portfolio-live-config.json.XXXXXX)"
jq '.sizingProfile = "AA01-PA07-3x-L2-R5-2x-others-1.3x-v1"' portfolio-live-config.json > "$TMP"
mv -- "$TMP" portfolio-live-config.json
pm2 restart hype-portfolio-live
pm2 restart commander hype-health-watchdog
)
```

4. Leave pause in place until the **new process** has fresh healthy health,
   expected profile/tickets, synchronized quantities, no unresolved work and
   verified protection. Use the following read-only view; compare its start time
   with your restart and its quantities against Bybit:

```bash
jq '{ageSeconds:((now*1000-.writtenAt)/1000),processStartedAt,status,error,
  sizingProfile,tickets,entryEnabled,reconciliation,pending,recovery,
  owners:.monitor.owners,reservations:.monitor.reservations,
  activeExits:.monitor.activeExits}' data/HYPEUSDT_portfolio_health.json
npm run watchdog -- --once --dry-run
```

5. Only after accepting that evidence: Discord `-resume`, then `-status` for
   armed acknowledgement and the selected profile. No unconditional `rm` of
   pause/recovery/state files. `pm2 save` preserves the intended process list.
   First L2/R5 fill should show actual rounded notional near $13,333, not a top-up
   to existing positions. Record the effective UTC restart/profile acknowledgement
   with the retained pre-change config. Keep SA01's old forward registration
   immutable; do not pool changed sizing into its frozen allocation result.

### Compatible rollback

Pause entries and drain pending work as above. On **this or a later compatible
build**, change only `.sizingProfile` to `"PAL02-PA07-3x-others-1.3x-v1"` (the
previous selection), or `"HS01-base-v1"` (original tickets), restart the portfolio,
confirm fresh health/protection and intended tickets, then guarded resume.
New entries return to old sizes; existing larger positions and submitted
obligations keep their actual quantities and exits.

**Do not roll back the binary below support for any sizing profile in its state,
including terminal history.** The October 23 binary does not know AA01 tags.
Do not edit tags, resize state, reset receipts or restore a
stale config/state backup to bypass this. A binary rollback needs a separately
reviewed compatible transition. Default legacy owner stops remain in force.

## October 20 execution-latency correction — local, not deployed

**Problem:** the October 18 PA07 timeout was due at 12:01:00 UTC but filled at
12:01:54.372. Its close intent was recorded at 12:01:54.104: almost all the
delay preceded submission, rather than waiting for Bybit to fill. The composed
owner repeatedly reread the same account and protections inside one pass.
Sampled healthy status medians were 12.8s with no structural bracket, 30.7s
with one and 47.1s with two. The old single-ladder owner did not have this
multi-controller servicing path.

**Correction, strategy rules unchanged:**

- Share successful, unchanged maintenance checks only inside one serial loop
  and for less than five seconds, including read time. Inventory, receipt,
  reservation or exit changes, pending evidence, recovery, errors, expiry and
  a new loop prevent reuse. Admission, submissions and cancellations still
  perform fresh validation; this is not permission to trade on cached evidence.
- Run independent TP/SL read requests concurrently, but keep exchange writes
  and receipt application serial and retain the full identity/receipt checks.
- Record due setup exits before slow reads; service exits first, before queued
  entries and again before the loop finishes. The existing cancel/reconcile/
  residual-close path still applies. No earlier strategy exit or wider entry
  window is introduced.
- Deliver Discord start/fill messages outside the trading loop, one at a time.
  Preserve saved notification IDs and receipt-derived PnL. Allow at least 5s
  between successful deliveries and 60s after failure; no per-tick retry storm.

**What to watch:** status/Commander now show account-read time, protection-read
time, refresh/reuse counts and maximum setup-exit lateness. The health file
adds `performance`, including funding-read time. These are measured durations,
not a promise that future API calls or market fills meet a fixed latency.

One watchdog incident, `portfolio_execution_delayed`, warns for loops over 10s
sustained for 60s, or setup exits at least 30s overdue. It becomes critical for
an exit at least 60s late, or loops over 30s sustained for five minutes.
Warnings retain the watchdog's two-sample activation; clearing needs 60s of
healthy owner measurements plus its two healthy samples. Existing reminders
remain 4h for warnings / 30m for critical incidents. Data, ownership and pending
receipt faults retain priority; suppressing a secondary latency message does
not falsely clear its incident. No alert automatically pauses or trades.

**Verification:** the composed two-bracket simulation performs one account
snapshot and one observation per bracket on an unchanged pass. Focused checks
cover expiry, external fills after reuse, unresolved receipts, due-intent order,
restart/ownership races and notification backoff/lifecycle. This proves reduced
duplicate work, not a live millisecond result. Existing strategy replay evidence
is unchanged.

Deploy only after review/commit, preserving VPS-local configs and all state.
Pause entries, build, restart **`hype-portfolio-live` and
`hype-health-watchdog`** (owner timing plus alert reader); Commander needs no
restart unless its own deployed build differs. Do not start retired owners.
Require fresh paused health, matching account inventory/protection and no
recovery or unresolved mutation before resuming. Observe the next natural
entry/exit and compare:

```bash
jq '{writtenAt,status,error,tickMs,performance,reconciliation,pending,recovery}' \
  data/HYPEUSDT_portfolio_health.json
npm run watchdog -- --once --dry-run
```

Do not force a test trade or increase freshness/alert limits to make latency
appear healthy. A long API read can still prevent reuse; the new measurements
identify that case.

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

## October 13 first trades review

The [operator report](portfolio-first-trades-2026-10-13.md) reconciles all 100
execution receipts and extends the setup replay through October 13 12:04 UTC.
The repaired ladder added twice, resized its TP, then closed at its 48h-high
rule. Repeated add-approval expiry and TP cancel/recreate churn did not recur.

Outstanding: SF08's 04:01 UTC signal appears with original collector publication
times but disappears when catch-up history is marked observed at the October 12
restart (`late_context`). This is reproduced on a prefix ending before entry,
not inferred from the trade outcome. The correction is included in the October 13
release below; deployment is unconfirmed. Brief missing-input snapshots and five
API rate-limit errors also remain.

October 13 notification update, **deployment unconfirmed**: filled orders show average price
and fees; closes show receipt-derived net realized PnL including allocated entry
and exit fees, excluding funding. Entries explicitly say PnL is not realized.
Child-fill intents sharing an exchange order are grouped; delivery preserves
the existing notified-link file (the October 20 patch makes it asynchronous).
No old message
backfill, account writes, strategy or alert thresholds are changed.

## October 13 SF08 restart-history correction — deployment unconfirmed

The worker now keeps **collector publication and worker observation separately**.
SF08/PA07 structure is rebuilt with original publication times; an entry still
requires every dependency to have been observed by its original entry boundary.
A restart no longer labels all historical formation bars as late. Genuine late
collector/repair publications, missing data and entries whose window passed
remain blocked. Bootstrap prices remain modelled warmup, not live receipt evidence.

The [isolated release incident regression](../../backtests/portfolio-sfp-restart-fix/23e39be977aacd43/verification.json)
reproduces the old miss and restores the October 13 04:01 SF08 through the actual
production source cache, with the replay's exact signal ID, stop and target.
The post-restart PA07 publication also remains identical. Synthetic checks cover
late worker inputs, late repairs, future data and no historical catch-up entry.
The feed, remaining-source and lifecycle suites pass; the existing feed parity
check matches 86,395 aggregate bars, 122,146 indicator features and 104 main features.
The staged release (excluding unrelated working-tree research changes) also
passes the full build, VPS typecheck, restart/PnL regressions and HTML checks.

No detector thresholds, sizing, slots, bracket policy, entry windows, shared
capital rules or indicator receipt clocks change. No account/state/collector
files are edited. The cache uses one extra numeric timestamp per minute (about
8 MB per million minutes), with no extra exchange calls or per-tick rebuild.

When deployment is authorized, use the existing paused-entry maintenance flow
and restart only `hype-portfolio-live`. Preserve configs, notified-link state,
positions and the pinned bootstrap; **do not initialize or replay missed entries**.
Confirm `feed.health.structuralClock` is
`source_publication_with_worker_observation_gate`, feed catch-up is complete,
and account/protection health is current before resuming. A new build does not
retroactively open the missed October 13 trade.

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

## October 15 high-input rollover correction — local, not deployed

The October 15 console contains 185 high-only degraded snapshots, all at seconds
0–6 of a minute. The separate 48h-high reader briefly lacked the newest closed
minute, while the worker feed and 14-day entry context were healthy. Status then
retained that sample until the owner finished another roughly 30s loop. The
old “missing inputs: none” line covered only overextended-entry inputs.

- Reuse the one-second, single-flight refresh pump for **public 1m high-context
  candles only**, independent of owner REST work. Stop it when the owner shuts
  down. The reader still avoids requests for complete windows and retains its
  10s retry throttle; this is not one exchange request per second.
- For less than 10s after minute rollover, classify `high_minute_rollover` as a
  timing delay only if the prior 2,880-bar window validates, exactly the newest
  bar is missing, and there is no fetch error. `healthy`/`decisionReady` remain
  false: no stale-window fallback and no late-entry or exit-window extension.
- Older gaps, malformed bars, fetch errors and missing latest bars beyond that
  grace retain the fault path. Other faults still take priority. Existing
  sustained-fault/watchdog thresholds are unchanged.
- `mainMissingInputs` lists the main health check's actual missing inputs;
  `mainContext.high` exposes coverage, timestamps, refresh pending/error and
  timing classification. Console/Commander show a separate **Ladder 48h high**
  line. SF08 and the other setup policies are unchanged.

Offline checks cover rollover/recovery, holes/invalid bars, API failure, the
unchanged 30s high-exit decision window, refresh without owner ticks, shutdown,
watchdog classification and status. No historical strategy retuning or exchange
writes. This does not optimize the owner's remaining REST latency.

On deployment, update/restart only `hype-portfolio-live`, `hype-health-watchdog`
and `commander`, following the existing pause/reconcile procedure. Keep collectors
running and old owners stopped. Observe several minute boundaries, not just one
healthy snapshot:

```bash
jq '{status,error,degradation,mainMissingInputs,high:.mainContext.high,tickMs}' data/HYPEUSDT_portfolio_health.json
```

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
