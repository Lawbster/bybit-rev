# SF08 / LAWBSTER owner

2026-09-21. **Built locally; disabled, not deployed or armed.**
Reference: [candidate and capital plan](sf08-live-candidate-plan.md).

## Account setup

Add these names to the VPS `.env` yourself; never paste the values into chat or
commit them. Existing un-suffixed credentials remain the ladder's credentials.

```dotenv
BYBIT_API_KEY_LAWBSTER=
BYBIT_API_SECRET_LAWBSTER=
```

`accountAlias: "LAWBSTER"` selects these credentials. There is no fallback to
the ladder key. The authenticated UID must match `expectedAccountUid` and differ
from the ladder's authenticated UID. A different key on the same UID is rejected.
The ladder credentials are used only for a read-only identity query by this owner.
Use trading permission without withdrawal permission; IP-restrict the key to VPS.

This implementation requires a dedicated Unified cross-margin account and HYPE
hedge mode, with both side leverages matching config. It does not change account
mode or leverage. Do not place manual/other automated HYPE trades in this account.
Avoid other cross-margin exposure while qualifying its collateral model.

Defaults: **$10,000 notional, 3x leverage, both enable flags false**. These are
staging defaults, not a capital-adequacy verdict. $20k at 3x cannot open on $5k
available collateral; entry preflight rejects it. The saved 5.29% DD used a
$32k starting account and is not the DD of this $5k allocation.

## What executes

- One SF08 long on HYPEUSDT, separate process and state. No ladder config,
  sizing, maker orders, cooldowns or pause-file changes.
- Shared research/live SF01 detector and action builder; completed 4h bars,
  two-right-bar pivots, original absolute 2R target, 5% padding below the
  original structural stop, and 24h from the scheduled action. The stop is
  **not** 5% below the entry. The actual fill does not move target or stop.
- One market entry; fixed exchange-native full-position market TP/SL with
  LastPrice triggers. No maker execution or averaging. TP rounds up, SL down,
  quantity rounds down to exchange increments.
- Persist intent before submit. Unknown responses retain the same owned intent;
  never blindly resubmit. Partial fills, native exits and timeout-close races
  reconcile against executions and actual exchange quantity. Fees use executions;
  displayed realized PnL is **before funding**.
- Pause/disarm entries only: existing protection, reconciliation and timeout
  management continue. Missing candle context cannot suspend those operations.

### Operational differences from the research fills

Current signals have a 60-second entry window after their scheduled minute.
Startup consumes earlier signals; no historical backlog, deferred entries or
signals queued while another trade is open. Current data must have collector
availability evidence; legacy timestamps are allowed only for historical bootstrap.
Backfill arriving late does not become timely evidence retroactively.

Entry checks reject existing HYPE orders/inventory, insufficient margin/collateral,
stale quotes and quotes already outside the fixed bracket. These checks and real
market/tick fills can change the realized trade list. Signal/target parity is not
an assertion of identical production PnL.

Three failed protection-verification polls request an owned market reduction.
Unresolved partial entries are cancelled before further inventory mutation.
An absent or insufficient observed liquidation-price buffer also requests exit.
For cross margin, Bybit supplies an **estimate**, sometimes blank—not a guaranteed
liquidation boundary. Blank values are treated conservatively, not as safety.
[Position API](https://bybit-exchange.github.io/docs/v5/position),
[native TP/SL API](https://bybit-exchange.github.io/docs/v5/position/trading-stop).
Capital stress/replay and actual-account checks remain required before arming.

## Safe preparation commands

After these files are committed/deployed, from `/opt/bybit-rev`:

```bash
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run test:sfp-live
npm run sfp-live -- --once --dry-run
npm run sfp-live -- --preflight
```

Dry-run reads local candles only: no exchange requests, state writes or orders.
Preflight reads Bybit only, prints whitelisted account/instrument information,
and does not submit/cancel orders or change mode/leverage. Initially it reports
`expectedAccountUid_not_pinned`; copy the verified dedicated UID into config.
Resolve any mode/leverage errors on the dedicated account, not the ladder account.
Require zero unowned position and zero orders for the first start. The preflight's
`identityAndModeReady` is not permission to trade or proof of sufficient collateral.

Do **not** enable entries yet. Remaining gates:

1. Review code and disabled deployment; verify actual UID, mode, funds and prices.
2. Replay the $5k SFP / approximately $18k ladder allocation, including funding,
   margin limits and skipped entries; review the previously failed historical screen.
3. Observe forward candle timing; explicitly approve a controlled exchange
   execution/protection/recovery test and the forward-observation/promotion decision.

Following those checks, monitoring with `enabled=true, entryEnabled=false` uses
the actual account and manages any owned exposure. It must not be mistaken for
`--dry-run`. Suggested process command for that later reviewed stage:

```bash
pm2 start dist/bot/sfp-live.js --name hype-sfp-live \
  --cwd /opt/bybit-rev --kill-timeout 120000 --restart-delay 10000
```

No ladder restart or flatten is needed just to introduce the separate account
owner. Restart the watchdog separately when deploying its new coverage. Never
use `pm2 restart all` for this rollout. Check health, then `pm2 save` after review.

## Pause and recovery

```bash
touch lawbster-sfp-pause
jq '{status,recovery,position,pending,protectionConfirmed,reconciliation,decision}' \
  data/HYPEUSDT_lawbster_sfp_health.json
npm run watchdog -- --once --dry-run
```

The file stops entries without restarting. Removing it resumes eligibility for
future signals only. Config is read once: an `entryEnabled` config change needs
an SF08-only restart. Do not set `enabled=false` or stop its owner with inventory
or an unresolved order; use the pause file instead.

The UID/symbol/long lock is `data/account-owners/<UID>-HYPEUSDT-1.lock`.
Clean shutdown releases it. Abrupt termination retains it deliberately: no
PID-only stale-lock takeover. After a crash, verify the old process is gone,
keep entries paused, inspect the exact account's positions/orders and saved
intent, then remove **only that verified stale lock** and restart this owner.
Never delete the position state to bypass recovery. After restart, unknown orders
remain fail-closed until exchange evidence resolves them. Evidence older than
seven days requires manual review. This availability limitation means a process
outage can delay the 24h timeout; native TP/SL are the independent protection.

Health covers stale/mismatched owner, recovery, pending intents, unconfirmed
protection, overdue timeout and unavailable candle context. Notifications say
`LAWBSTER / SF08`; they use the existing Discord transport. Journal receipt IDs
deduplicate possible at-least-once delivery after restart. These new `data/` and
`logs/` paths are covered by the existing VPS sync; credentials stay in `.env`.

## Implementation verification

- 22 coordinator/account/state cases, including two actual child-process exits
  around entry submission, and delayed close evidence without duplicate submission.
- 10 mocked exchange-adapter cases: identity redaction, rounding, margin/quote
  rejection, exact order parameters, rejection ambiguity and execution validation.
- 22 accepted SF08 artifact hashes verified. 35 parity assertions; 235 rolling
  boundaries including 110 negative controls. Exact full-history confirmed events
  and actions at 60/120-second source lag. Future poisoning, missing and late bars
  checked. Five earliest historical boundaries lacked live-style 32-day warmup
  and were explicitly excluded, not counted as parity passes.
- SF01 detector, setup-replay, collector repair and operational watchdog tests;
  full/VPS typechecks and build passed. Accepted research artifacts unmodified.
- Compiled local dry-run processed 44,899 minutes in approximately 0.4s; RSS
  snapshot about 225 MiB. This is a Windows one-shot, not a VPS steady-state
  memory guarantee. Local source was behind the current 4h decision, correctly
  producing `latest_4h_missing_or_late` with no signals/orders.

No authenticated exchange preflight or order was performed during development.
No portfolio rerun, new performance qualification, funding or live deployment
is implied by these tests.
