# Verified candle recovery and unchanged-policy replay

September 5, 2026 (Oslo). Scope: recover the eleven missing HYPE one-minute
candles, retain evidence separately, and rerun the current causal baseline.
Local research only; no live config, state, order, deployment, commit or push.

## TL;DR

- **11/11 missing candles recovered and cross-checked.** All eleven native
  five-minute witnesses and 65 known-neighbour comparisons agree. The corrected
  archive contains 919,086 closed one-minute candles with zero internal gaps.
- **Original synced files are untouched.** Recovery is a separate, explicitly
  selected overlay with saved public responses and SHA-256 fingerprints. No
  interpolated prices, weakened coverage gates or strategy thresholds.
- **All four unchanged-policy cases pass repeat/timing checks, with 100% S/R
  candle coverage.** HL-window total PnL changes by -$2,128.99 / -$694.39 under
  close-confirmed / prior-target-touch TP assumptions. This is a more complete
  baseline, not evidence of a new profitable strategy or exact live parity.

## Recovery evidence

Both original archives were content-hashed before and after retrieval:

| Input | Bytes | SHA-256 |
|---|---:|---|
| `data/HYPEUSDT_1_full.json` | 86,185,778 | `feb790184fb2f32a4b4d0d03f331abf51e708aaf778051011a66e81f85fa3fdf` |
| `data/HYPEUSDT_1m.jsonl` | 23,021,958 | `1e3a6e1617b3d3fc49a98da20c5d39832562f96de6ecadea8bd1ba36b82cbbb9` |

The original merged history has 919,075 candles. The cutoff is September 4,
2026 19:01 UTC, and recovery completed at September 4 22:29:43.345 UTC
(September 5 locally). Requests used the public linear-market candle endpoint
with exact symbol, interval and timestamp windows. See the
[Bybit kline specification](https://bybit-exchange.github.io/docs/v5/market/kline).
No credentials, private account calls or order methods were used.

| Missing minute (UTC, 2026) | Exact 1m obtained | Native 5m OHLCV/turnover match |
|---|---|---|
| April 20 16:20 | Yes | Yes |
| April 25 09:38 | Yes | Yes |
| April 25 20:12 | Yes | Yes |
| April 26 15:25 | Yes | Yes |
| June 4 17:35 | Yes | Yes |
| June 4 17:40 | Yes | Yes |
| June 23 18:31 | Yes | Yes |
| July 15 06:29 | Yes | Yes |
| July 17 00:52 | Yes | Yes |
| August 4 00:20 | Yes | Yes |
| August 28 05:49 | Yes | Yes |

There were 22 public requests: seven surrounding one-minute candles and one
native five-minute candle for each gap. One-minute constituents reproduce native
five-minute open/high/low/close, volume and turnover. Every available local
neighbour also matches; the 65 comparisons include overlapping evidence windows,
not necessarily 65 unique minutes. Agreement tolerance is
`1e-7 + 1e-10 * max(abs(a), abs(b))`, not a percentage price-drift allowance.
Native five-minute checks are a second aggregation check from the same exchange,
not an independent exchange or proof against retrospective data revisions.

Saved evidence:

- `backtests/hype/candle-repair-2026-09-05/repair.json`
- `backtests/hype/candle-repair-2026-09-05/validation.json`
- Repair SHA-256:
  `a8169356a401f65e7a3c58a86f9507782759035de059c5bca0a27b2d142bc61d`.

The bundle contains raw responses, request URLs, retrieval timestamps, per-response
hashes, generator hash and original archive hashes. Preserve these ignored local
artifacts privately with their raw input snapshot. They are not uploaded to Git.

## Implementation and causality checks

- [Recovery generator](../scripts/recover-candle-gaps.ts): bounded public GETs,
  request timeouts, exclusive output creation, no archive writes.
- [Repair validator](../scripts/replay-candle-repair.ts): exact evidence identity,
  response hashes, five-minute aggregation and neighbour validation on each load;
  refuses duplicate targets and any existing-candle overwrite.
- [Canonical loader](../scripts/hype-freerun-canonical-replay.ts): an optional
  repair file, absent by default. Indicators are rebuilt after insertion; existing
  indicator arrays are never shifted/spliced in place.
- [Acceptance runner](../scripts/hype-replay-current-stack-validation.ts): first
  reproduces the old control using untouched archives, then runs the unchanged
  policy on corrected history. Records coverage, content hashes, execution timing
  and repeated-result equality.

Recovered price bars become eligible only at their original close timestamp.
Future surrounding witness bars validate the downloaded data but are not passed
to historical decision features. Their September retrieval is **not** relabelled
as an April-August live receipt: this is corrected exchange-history research, not
a reconstruction of what the collector delivered during an outage.

A focused actual-data trace used the first missing candle, April 20 16:20 UTC:

| Query time | Latest eligible 5m starts | Original coverage | Corrected coverage |
|---|---|---|---|
| 16:20 | 16:15 | 4,032/4,032, healthy | 4,032/4,032, healthy |
| 16:24 | 16:15 | 4,032/4,032, healthy | 4,032/4,032, healthy |
| 16:25 | 16:20 | 0/4,032, unhealthy | 4,032/4,032, healthy |

Thus the repaired five-minute candle does not enter S/R before 16:25. The old
coverage failure occurs when that missing aggregate is actually required, not
earlier. Zero continuous bars at 16:25 means the latest required bar is absent,
not that the whole historical archive is empty.

An additional prefix regression caught and fixed a new-loader edge case: a query
ending exactly at the repaired minute's close originally rejected it because its
right neighbour was outside the requested prefix. Full-snapshot bounds remain
strict, while shorter prefixes permit that now-closed final repaired candle.
Both direct validator and actual loader prefix tests now pass. The initial full
run was stopped for this fix; its incomplete output is not an accepted result.
The focused suite also verifies restored 4,032-bar coverage through the actual
shared S/R context without admitting the unfinished five-minute candle.

See [the model contract and commands](../docs/research/current-stack-replay.md#optional-verified-candle-repair).

## Full-window comparison

Successful new acceptance run:
`backtests/hype/current-stack-repaired-candles-2026-09-05-validated/`.
The comparator is the four causal cases saved at
`backtests/hype/current-stack-foundation-2026-09-04/`, not a newly optimized policy.

The historical legacy control first reproduced exactly on the **original**
archives: $64,976.97226041745, 990 full closes and 106 partials. The causal baseline
is deliberately not forced to equal that older retrospective execution model.

Each new window starts separately, flat, with $32,000 modeled equity, the unchanged
$800 / 1.35 / 11-rung policy, and 0.055% modeled taker fees on each side. No maker
fee credit or actual funding settlement is included. Two TP execution assumptions
are compared; neither is a guaranteed bound on realized account returns.

- **Longer window:** July 1, 2025 through August 19, 2026 21:32 UTC.
- **HL window:** May 17, 2026 20:43 through September 4, 2026 19:01 UTC.

| Window / TP assumption | Old total PnL | Corrected total PnL | Delta | Old / corrected max DD |
|---|---:|---:|---:|---:|
| Longer / close-confirmed | $19,687.36 | $17,071.51 | -$2,615.85 | 47.74% / 47.74% |
| Longer / prior-target touch | $41,670.88 | $43,005.85 | +$1,334.96 | 33.00% / 33.00% |
| HL / close-confirmed | $19,542.83 | $17,413.84 | -$2,128.99 | 28.51% / 31.10% |
| HL / prior-target touch | $22,678.15 | $21,983.77 | -$694.39 | 23.79% / 23.36% |

The longer cases end flat. The corrected HL cases both finish with eleven open
rungs: close-confirmed realized PnL is $18,711.60 plus -$1,297.77 open PnL;
touch realized PnL is $22,286.09 plus -$302.32 open PnL. Open PnL includes modeled
exit fees. The original HL touch case instead ended with six rungs and -$0.99
open PnL, so realized-only comparisons omit a material inventory difference.

### Coverage and event counts

| Window / assumption | Old / corrected full closes | Old / corrected partials | Old / corrected normal + stale TP cycles | Old / corrected hard flattens |
|---|---:|---:|---:|---:|
| Longer / close-confirmed | 860 / 847 | 121 / 177 | 797 / 784 | 37 / 37 |
| Longer / prior-target touch | 1,025 / 1,010 | 128 / 186 | 966 / 950 | 35 / 36 |
| HL / close-confirmed | 263 / 251 | 27 / 72 | 251 / 239 | 8 / 8 |
| HL / prior-target touch | 319 / 299 | 27 / 79 | 309 / 288 | 6 / 7 |

Emergency-kill and funding-spike-close counts are unchanged within each pair:
4/22 for longer close-confirmed, 2/22 for longer touch, and 2/2 for both HL cases.

The corrected longer cases evaluate 597,453 minute rows, with zero unhealthy S/R
minutes, versus 111,929 unhealthy rows previously (81.27% healthy). Corrected HL
cases evaluate 158,299 rows, with zero unhealthy S/R minutes, versus 94,058 unhealthy
rows previously (40.58% healthy). Both corrected windows are **100% healthy for
the configured S/R candle-coverage check**, not universally healthy for every HL
input or exact live operation. The old denominators exclude ten/seven missing
minute rows, respectively. Diagnostic coverage counts include times when other
gates already prevented trades; they are not counts of otherwise-eligible actions.

Restored coverage permits many more modeled partials, while full TP cycling falls.
For example, the HL cases gain 45/52 partials but lose 12/21 normal/stale TP cycles.
This enumerates both sides of the path change; neither more partials nor fewer
flattens alone establishes improvement. Recovered prices also rebuild indicators
and support-reopen context. No ablation was run to assign each PnL dollar to a
single mechanism, and the repaired-vs-gapped comparison is not an S/R on/off test.

### Per-month realized PnL change versus the gapped causal baseline

These are infrastructure-comparison deltas, not strategy-variant rankings. Each
month before the first April repair is exactly unchanged in the longer cases.
HL May/September and longer August are partial months under their stated windows.

| Month | Longer close-confirmed delta | Longer touch delta | HL close-confirmed delta | HL touch delta |
|---|---:|---:|---:|---:|
| 2025-07 | $0 | $0 | n/a | n/a |
| 2025-08 | $0 | $0 | n/a | n/a |
| 2025-09 | $0 | $0 | n/a | n/a |
| 2025-10 | $0 | $0 | n/a | n/a |
| 2025-11 | $0 | $0 | n/a | n/a |
| 2025-12 | $0 | $0 | n/a | n/a |
| 2026-01 | $0 | $0 | n/a | n/a |
| 2026-02 | $0 | $0 | n/a | n/a |
| 2026-03 | $0 | $0 | n/a | n/a |
| 2026-04 | +$272.27 | +$702.79 | n/a | n/a |
| 2026-05 | -$759.13 | +$434.39 | $0 | $0 |
| 2026-06 | +$750.56 | -$18.41 | +$750.56 | -$18.41 |
| 2026-07 | -$2,879.55 | +$216.18 | -$2,879.55 | +$216.18 |
| 2026-08 | $0 | $0 | $0 | $0 |
| 2026-09 | n/a | n/a | $0 | -$590.83 |

Corrected HL-window realized May/June/July/August/September totals are
$17,158.08 / -$974.88 / -$9,281.90 / $10,947.92 / $862.39 for close-confirmed,
and $13,271.60 / $1,457.18 / -$4,389.95 / $9,753.46 / $2,193.79 for touch.
The touch realized delta totals -$393.06; its remaining -$301.33 total-PnL delta
comes from the changed final open inventory, not a missing accounting row.

### Acceptance and temporal checks

The final `validation.json` records:

- `legacyControlMatched=true`, `repeatedResultsEqual=true` (four cases, two
  executions each on one corrected feature build).
- `noRetrospectiveFills=true`, no pending market intents at any case's cutoff.
- `sourceAndInputMetadataUnchanged=true` and
  `originalCandleContentHashesUnchanged=true`.
- `remainingCandleGaps=0`, `strategyVariantsTested=0`,
  `exactLiveParityCertified=false`.

An additional CSV comparison checks the complete longer-window event prefix
before April 20 16:20 UTC, not just monthly sums. Old/corrected rows are identical:
590 closes, 90 partials and 5,615 executions for close-confirmed; 713 closes,
97 partials and 6,363 executions for touch. Later recovered candles therefore
did not change those recorded pre-repair events. Prefix loader tests separately
cover candle eligibility at the exact closing boundary.

The repeated runs establish determinism, not independent-model agreement.
Original price files and the repair are content-hashed; other raw inputs use
the pre-existing size/mtime checks. The incomplete first output directory has
no final acceptance record and must not be used as a result.

## Tests and limits

Passed locally: `replay-candle-repair-tests.ts`, `replay-current-stack-tests.ts`,
`replay-causality-tests.ts`, `sr-support-reopen-tests.ts`,
`sr-context-safety-tests.ts`, both TypeScript no-emit builds and `git diff --check`.
Repair tests include response corruption, wrong identity/URLs, neighbour and
aggregate mismatches, missing constituents, duplicate/overwrite rejection,
default opt-out, input immutability and exact-close/prefix behavior.

This repairs the price-archive prerequisite only. Historical HL receipt uncertainty,
exact maker/native trigger and partial-fill execution, actual funding/fee settlement,
durable open journals and shared-wallet attribution remain separate limitations.
The repaired history has already been researched; it is not a fresh holdout.
Zero strategy variants are tested here, so no strategy ranking, promotion or
falsification-ledger update applies.

**Verdict:** the eleven-candle coverage blocker is repaired for this frozen
snapshot. Use the corrected baseline for subsequent local HL/S/R work, preserving
both TP assumptions and all remaining execution/accounting qualifications.
Do not choose an execution assumption because it produces the larger PnL, and
do not tune or deploy a live strategy from this data repair alone.
