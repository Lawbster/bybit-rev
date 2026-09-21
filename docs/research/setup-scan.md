# Setup scanner: "where did this library setup occur?"

Research-only tooling, added 2026-09-19. It imports no bot, executor or exchange code,
places no orders and changes no configuration. It answers one question for any
library setup that has a detector: **on this tape, over this window, where did the
setup's causal sequence occur, where did attempts fail, and what happened next?**

It is a descriptive occurrence ledger. It is not a backtest, not a replay and not
evidence of profitability. A scan can feed a frozen study card; it cannot replace one.

## Ask it in plain language

```powershell
npx ts-node scripts/setup-scan.ts list                       # detectors, aliases, library cards
npx ts-node scripts/setup-scan.ts resolve "RF breaker"       # -> PA02
npx ts-node scripts/setup-scan.ts run --setup "RF breaker" --symbol HYPEUSDT --from 2026-03-15 --to 2026-09-15
npx ts-node scripts/setup-scan.ts run --setup PA04 --from 2026-06-01            # --to defaults to the tape end
npx ts-node scripts/setup-scan.ts run --setup PA02 --from 2026-03-15 --charts   # also render charts
npx ts-node scripts/setup-scan.ts show PA02                  # print the latest summary for that setup
npm run test:setup-scan
```

Options: `--lag <seconds>` source publication lag (default 60), `--tape auto|sealed|live`,
`--param key=value` to override a detector default (recorded in the scan key),
`--max-charts N` (default 40, most recent confirmed events), `--quiet`.

The natural-language resolver strips words like "RF", "Rektproof", "setup", "on HYPE"
and matches detector aliases. An ID that exists in the library but has no detector
returns `library_only` with an explicit message, so an agent never silently answers
"none found" for a setup it cannot see.

## What a run produces

`backtests/setup-scans/<key>/` (the key hashes detector id, version, parameters,
symbol, window, lag, tape identity and detector source pins; identical requests
reuse the folder and never rerun):

| File | Contents |
|---|---|
| `summary.md` | Human/agent-readable report: counts by stage, side and month; rejection reasons; confirmed-event table with stage timestamps, proxies and descriptive labels; the detector's declared conventions; tape identity and gaps |
| `events.jsonl` | Every attempt: `stage` (`confirmed`, `rejected`, `expired`, `invalidated`, `pending_at_cutoff`), `reason`, per-stage `{at, knownAt, price}`, frozen `reference` objects, price proxies |
| `labels.jsonl` | Forward labels for confirmed events only: entry proxy (first minute open at/after `knownAt`), 1h/4h/12h/24h returns, 24h MFE/MAE, first barrier (stop/target/both-same-minute/none), censoring |
| `atlas-manifest.json`, `candles-1m.jsonl` | Inputs for the existing renderer: `npm run event-atlas -- --manifest backtests/setup-scans/<key>/atlas-manifest.json` |
| `plan.json`, `complete.json` | Request, detector identity and conventions, tape identity, pins; artifact hashes |

`backtests/setup-scans/latest.json` points `show <ID>` at the newest scan per setup.
Scan folders are generated artifacts and stay out of Git, like other `backtests/`.

## Causal contract every detector must honour

- Only completed bars. A 4h pivot with width 2 is knowable after its second
  right-hand bar closes plus lag; nothing referencing it can be known earlier.
- Every stage records `at` (bar start) and `knownAt` (availability). The event's
  `knownAt` is the maximum over its stages and referenced pivots. The scanner asserts
  `knownAt >= formationAt` and `stage.knownAt <= event.knownAt` on every row.
- Attempts are emitted at the stage they reached, with a reason. Rejected, expired,
  invalidated and pending-at-cutoff rows are part of the denominator.
- Nothing is backdated and no level is redrawn using later price. Prefix invariance
  is tested: truncating the tape must not change events already known.
- Gaps are excluded, never bridged. A bar whose constituent minutes are missing does
  not exist; a pivot needs a contiguous neighbourhood. The summary reports gap counts.
- Forward labels are computed after detection from the entry proxy forward and are
  never inputs to any decision. They are orientation, not economics.

## Tape

`--tape auto` resolves in this order: the sealed LV01 minute cache
(`backtests/level-atlas/<key>/candles.f64`, corrected contiguous history, modeled
availability = bar end + lag) when the symbol is HYPEUSDT and it covers the window; then a
research tape `backtests/tapes/<SYMBOL>_1m.jsonl`; then `data/<SYMBOL>_1m.jsonl` as written
by the collector, deduplicated (last row wins, conflicts counted), with observed `availableAt`
honoured where present. The sealed cache holds HYPE only and is never served for another
symbol. The sources are not identical: the cache carries repairs, the live file carries
gaps. The summary names which one was used.

Research tapes for other symbols are built once with

```powershell
npx ts-node scripts/build-research-tape.ts --symbol SOLUSDT --from 2024-12-05 --to 2026-09-17
npm run test:research-tape
```

which merges the local Bybit linear 1m sources under `data/` (history files first, then the
collector stream) and fills whatever is still missing from Bybit's public v5 kline endpoint
through the same bounded fetcher the collector uses for repairs. The output carries a `src`
per row and a manifest with sources, fetched ranges, remaining gaps and a hash. It writes only
under `backtests/tapes/`; nothing under `data/` changes. BTCUSDT and SOLUSDT tapes covering
2024-12-05 to 2026-09-17 were built on 2026-09-19.

## Detectors shipped

Added 2026-09-20: `SF01` / `sf01-v1`, [range-low SFP](range-low-sfp-sf01.md).
Long-only 4h known-low first sweep / closed reclaim; `requireRange=0` is the
generic swing-low control. Exact frozen six-cell study: `npm run research:sf01`;
tests: `npm run test:sf01`; saved-evidence report:
`npx ts-node scripts/range-low-sfp-report.ts`. Complete runs verify hashes and
return without re-running. The method links the source image and conventions.

| ID | Version | What it operationalises | Card |
|---|---|---|---|
| PA02 | `pa02-scan-v1` | Named breaker: context pivot, opposite-colour origin zone inside its bar, sweep of the prior opposite pivot, zone failure close, structural HH/LL close, first retest that closes back out of the zone. Retests that close inside the zone are rejected; completed sequences without the sweep are emitted as rejected `no_sweep_before_fail` rows (the generic failed-zone control) | `price-action.md#PA02` |
| PA04 | `pa04-scan-v1` | Closed-break reclaim: outside close beyond a known pivot, close back inside within 24h; breaks that never reclaim are emitted as expired | `price-action.md#PA04` |
| PA03 | `pa07-v1` | PA07's origin-zone return, verbatim, with its break-only control rows tagged `pa07_control_row` | `price-action.md#PA03` |
| PA06 | `pa07-v1` | PA07's sweep plus impulse, verbatim, with its sweep-only control rows tagged | `price-action.md#PA06` |
| MR01 | `mr01-scan-v1` | Monday-range raid (D9, library CTX02): Monday [00:00, 24:00) UTC range usable from Tuesday, wick raid of an extreme with a close back inside, MSB, zone retest (or `--param entryMode=msb`), stop beyond the raid extreme, target the opposite Monday extreme if untouched since Tuesday. `--param rangeDay=3` runs the same sequence on a Wednesday range as the control | `context.md#CTX02` |
| PA05 | `pa05-scan-v1` | Three-tap: confirmed pivot, 1.5% departure, wick sweep with a close back inside within 24h, second departure, first return within 0.3% of the level (touch mode closes holding it; `--param entryMode=reaction` waits for a close beyond that bar). Stop beyond the sweep extreme, target the nearest untouched opposite pivot. Returns without a sweep are the rejected `two_tap_no_sweep` control rows | `price-action.md#PA05` |
| RS01 | `rs01-scan-v1` | Range reversal after exhaustion, from Rektproof's "Reversal Setup" infographic of 2026-09-15 (X status 2100054415172620757, copy in `research/filedump/ethreversalsetup.png`): exhaustion low, range high, FVG on the way down, sweep of the low, MSB back into the range, demand retest (or MSB entry with `--param entryMode=msb`), stop under the sweep extreme, target above the range high. Sequences without the FVG are emitted as rejected `no_fvg` control rows. The PA01 family with the anchoring the PDFs never gave; the library has no RS01 card yet | `price-action.md#PA01` |
| OB01 | `ob01-scan-v1` | Personal orderblock entry (D1a pp6-9 / D1b pp5-8, library PA03 with MOD02): sweep of a known 1h pivot with a close back inside within 24h, MSB close beyond the last interior pivot within 72h (no interior pivot rejects the attempt as `no_interior_high`), block = last opposing-close bar between sweep and MSB, leg frozen at the MSB close (sweep extreme to MSB extreme), resting price = 0.705 of the leg measured back from its end and required inside the block (`ote_outside_block` otherwise; `--param entryLevel=edge` rests at the block edge instead and needs no such check). Stop 0.1% beyond the block far edge, target the nearest untouched opposite pivot. The scan only fixes the resting price; the fill is modelled by the replay with `--entry-limit proxy` (rest from the MSB known-at, `touch` or `open` fill, cancel on stop or target trade-through, expiry; long only) and compared against `market` at the MSB | `price-action.md#PA03` |

The general PA01 anchoring question remains open;
RS01 uses the one anchoring the source states (0 at the swing high after the exhaustion
low, 1 at the untapped low).

Every numerical choice a detector makes that the PDFs do not specify is listed in the
detector's `conventions` and printed in each summary. Changing one is a new version.

## Adding a detector (for agents)

1. Read the library card (`npx ts-node scripts/setup-library.ts show PA05`) and
   `research/setup-library/PRIMITIVES.md`. Write down the ordered stages and the
   operational choices the source leaves open; those become `conventions`.
2. Create `scripts/setup-detectors/<id>-<slug>.ts` exporting a `SetupDetector`:
   `id`, `version`, `title`, `family`, `aliases`, `libraryCard`, `defaults`, `conventions`,
   `warmupMs`, and `detect(ctx)`. Use `ctx.bars(tf)`, `ctx.pivots(tf, width)`,
   `ctx.hit(...)`, `latestPivot` and `nextUntouchedPivot` from `setup-scan-core`.
   Emit one row per attempt with `stages`, `reference` and `proxies`.
3. Register it in `scripts/setup-detectors/index.ts` and add synthetic-tape tests
   to `scripts/setup-scan-tests.ts`: one confirmed long, the mirrored short, one
   rejection per stage, and a prefix-invariance loop. Run `npm run test:setup-scan`.
4. Do not tune conventions after looking at real-tape outcomes. If a convention must
   change, bump `version`; old scans stay valid under their key.

## Replaying a scan as trades (exploratory numbers)

`scripts/setup-replay.ts` turns a scan's confirmed events into bracketed trades and replays
them with the accepted structural-bracket engine PA07 used (`poc-indicator-bias-engine.replay`),
checked by its independent audit (`structural-replay-audit`). No new execution or accounting
code was written for this layer.

```powershell
npx ts-node scripts/setup-replay.ts run --setup PA02 --from 2024-12-27 --to 2026-09-15 --split 2026-06-01
npx ts-node scripts/setup-replay.ts run --scan <scan key> --sides long --targets structural,r2 --holds 24,48
npx ts-node scripts/setup-replay.ts show PA02
npm run test:setup-replay
```

Cells are `side × target × hold`. Targets: `structural` (the scan's nearest untouched opposite
pivot at known-at; events without one are rejected), `rN` (reference close ± N × stop
distance), `tpN` (N% from the reference, scan stop kept) or `tpNslM` (N% target and M% stop, both
from the reference; the scan stop and stop buffer are not used, the risk filter still applies, so
raise `--risk-max` for wide stops). The reference is the retest, reclaim or impulse stage price, else
the last stage; `--ref <stage>` (for example `--ref msb`) measures every bracket from that stage
instead and rejects rows without it. Stop is the scan's stop proxy, optionally widened. Entry is the open of the first
minute at/after known-at plus action delay. Each cell is a separate $10k-notional account with
one position at a time; overlapping events are skipped and counted. Every cell runs the full
window plus an optional older/recent split, at delay 0 and 60s, stop-first and target-first on
same-minute ambiguity, and with a +5 bps/side cost stress. Risk outside 0.2 to 5% of the
reference close is rejected. Output under `backtests/setup-replays/<key>/`: `report.md`,
`results.csv`, `monthly.csv`, `trades-<cell>.csv`, `actions.json` (rejections and ties),
`audit.json`.

`--entry-limit sweep|proxy` replaces the market entry with a resting limit order handled by
`scripts/structural-limit-entry.ts`: `sweep` rests at the sweep-stage price plus
`--entry-offset-pct` (Astra's SF03 study), `proxy` rests at the detector's own resting price in
`proxies.entry` (OB01's 0.705 level or block edge). The order rests from known-at until
`--entry-expiry-hours` (default 72), fills on touch or, with `--entry-model open`, only when a
minute opens through it, and is cancelled when the stop or the target trades through first. The
hold clock starts at the fill. Long only; the cell's single slot is occupied while an order rests,
so compare against a market run on the same submitted ids (`intents-<cell>.json` lists them), not
on totals. Rows are rejected `no_entry_proxy`, `no_sweep_stage`, `limit_entry_long_only` or
`limit_outside_bracket` when the order cannot be placed.

`--rows rejected:<reason>` replays a named non-confirmed row set instead, which is how a
setup's own control is compared: for PA02, `--rows rejected:no_sweep_before_fail` replays the
generic failed-zone sequences that completed without the prior sweep.

The report applies PA07's standalone screen descriptively. Passing it is not qualification:
there is no frozen card, the best cell is selected after the fact, and the windows are
development data. Use the report to choose one or two definitions worth freezing.

## Charting a scan or replay (visual fidelity review)

`scripts/setup-chart.ts` writes one self-contained `chart.html` beside a replay's `report.md`
(or a scan's `summary.md`). It reads only the artifacts already written and recomputes nothing.

```powershell
npx ts-node scripts/setup-chart.ts --setup PA02                 # latest replay for the setup, else its latest scan
npx ts-node scripts/setup-chart.ts --replay <key or prefix>     # a specific replay run
npx ts-node scripts/setup-chart.ts --scan <key> --rows all      # scan only, with rejected/expired attempts listed
npm run test:setup-chart
```

Options: `--tf 1h,15m` (default; any of 5m/15m/30m/1h/2h/4h or minutes), `--rows confirmed|all`,
`--tape auto|sealed|live|scan-file`, `--out <file>`. The page loads TradingView lightweight-charts from
jsdelivr once; all data is embedded (1h plus 15m bars for the scan span, roughly 3 to 5 MB for the full tape).

Candles come from the same tape the scan used, loaded with the scanner's own loader over the exact span
recorded in the scan's `plan.json`, so every event has candles. The scan's `candles-1m.jsonl` is not
used for this: it is only a slice around the charted events (96h before the earliest of the last
`maxChartEvents` confirmed events). If the scan tape cannot be loaded, or `--tape scan-file` is given,
the page falls back to that slice and says so in its header. A tape whose hash differs from the one the
scan recorded is flagged there as well.

What it shows for a selected trade or event: the immutable zone from its publication time, each
reference pivot as a dotted line from its availability forward, every stage marked at its bar with a
dashed vertical line at its known-at, the entry, stop and target actually replayed between entry and
exit, and a shade over everything after the event's known-at labelled as outcome. The details panel
lists each stage's `at`, `known-at` and latency. Cells are selectable; rejected actions and discarded
ties are listed beside the trades so the denominator stays visible. Keys: j / k step, f refit.

Publication fix (2026-09-20): `originAt` no longer starts a qualified zone box.
Use explicit zone availability / zone-stage confirmation; if absent, conservatively
start at event availability. Origin remains formation metadata in the stages.
Existing exported HTML is a snapshot: regenerate to a **new output path** to
adopt the fix without overwriting archived artifacts.

Use it to ask "is this what the source drew?" on chronological examples, accepted and rejected. Do
not use it to tune conventions: the page prints the detector's conventions on purpose, and changing
one after looking at outcomes here is a new version, not a fix.

## The ledger: what has been tried, on which symbol, and where the leads are

`scripts/setup-ledger.ts` generates `research/setup-ledger.md` and `.json` from every replay and
scan folder on disk, across symbols. For each replay run it records the identity (setup, version,
symbol, window, non-default parameters, entry mode, row filter, targets, holds), the top cells by
full-window net with nine descriptive screens (full and stress net positive, both windows positive,
no month below −$250, net above the top-5 winners, 30 trades, PF ≥ 1.10, positive at 60s delay and
under target-first ambiguity), the best cell per side, and a status from the hand-kept overlay
`research/setup-ledger-notes.json` (exploratory, lead, parked, falsified, control, card). Scans that
were never replayed are listed too, so an occurrence ledger is not rebuilt by accident.

```powershell
npx ts-node scripts/setup-ledger.ts build             # regenerate after any scan or replay
npx ts-node scripts/setup-ledger.ts lookup RS01 SOL   # runs matching all terms, with their top cells
npx ts-node scripts/setup-ledger.ts lookup lead       # by status
npm run test:setup-ledger
```

Check the ledger before running a scan or replay. Numbers in the page are read from the artifacts
each time and are never typed; edit the notes file for statuses, then rebuild. The ledger is a lookup
of exploratory results and feeds `research/TESTED-SETUPS.md`, which stays the curated register for
frozen cards; nothing is promoted there without a card.

## Reading a summary honestly

- "90 confirmed breakers in six months" means 90 completed sequences under these
  conventions, most of them overlapping and correlated. It says nothing about edge.
- Forward labels use a next-minute-open entry proxy with no fees, slippage, fills,
  occupancy or sizing. A high share of `target` first barriers is not a result.
- A scan is the start of the [card workflow](../../research/setup-library/CARD-TEMPLATE.md):
  it supplies the opportunity set and the failure denominator that a frozen economic
  card then replays with controls. Attach scan keys to a card; never attach scan
  labels to the library as evidence.
