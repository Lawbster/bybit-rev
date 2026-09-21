# SF02: earlier SFP confirmation, unchanged 4h range anchors

2026-09-20. [Frozen card](../../research-inputs/range-low-sfp-early-sf02-2026-09-20.json).
Research only. Parent [SF01](range-low-sfp-sf01.md); all execution/accounting reused.

## Exact change

The archived HYPE **range-qualified 4h SFP**, not the generic swing control,
is the baseline. Candidate keeps strict width2 pivots on completed4h candles
but scans sweep/reclaim on completed15m bars. Both anchors must be published
before the first sweep bar begins; whole trigger bars start after low publication.
High selection, range age/height, swept-low identity and one attempt per pivot
are unchanged. Gaps/late inputs reject. All candidate signals count, including
ones for which a later4h reclaim never confirms.

Do not relabel future4h-qualified rows as early signals. Stops use only the
minimum of completed15m bars from sweep through reclaim, with the original
0.1% buffer. The later4h low is unavailable and forbidden. Entry is next eligible
minute after publication, and2R comes from that causal reclaim close and stop.
Thus timing **also changes the bracket and risk-filter eligibility**, not just
execution price. No constant future4h TP/SL borrowed. The24h reclaim deadline
is still measured from sweep-bar end, which now occurs on the15m clock.

Same Dec27 2024-Sep15 2026 20:20 UTC window, June1 split, $10k fixed notional,
$32k starting equity, 0.055% fee/side before funding, 5bps/side stress,
60/120s publication,0/60s delay,0.2%-5% initial risk bounds, one position and
full occupancy.24h hold is primary;72h secondary. No other targets/timeframes,
HL filters, retest entry, stop widening, live changes, or asset transfer.

## Verification and saved data

`scripts/range-low-sfp-early-study.ts` verifies parent receipts/tape hashes and
unchanged scan/execution/accounting infrastructure pins. Default4h detection
must exactly reproduce all archived attempts at both source lags; action,
rejection/tie and result arrays must match. Reuse parent results rather than
rerun an unchanged replay.15m support is an optional clock in the existing
detector; default serialized events unchanged.

`scripts/setup-detectors/sf02-early-tests.ts` checks mixed clocks, first attempt,
publication, same4h future poisoning, prefix invariance, late data and gaps.
Existing SF01 tests still pass. Shared report also checks five historical
prefixes, every confirmed stage clock and output hashes. Replay retains its
independent accounting audit and same-minute ambiguity bounds.

Paired attribution matches **closed trades by original pivot ID**. It reconciles
net change as common-ID PnL changes + added closed trades - removed closed
trades + open-MTM difference. Added closed trades can arise from risk eligibility,
new signals or occupancy; do not label all as new false confirmations. An open
trade at cutoff is not a new closed win/loss. Matched signal price comparisons
are reclaim references, not an assertion that every executable entry was cheaper.

Run: `npx ts-node scripts/range-low-sfp-early-study.ts`.
Report: `npx ts-node scripts/range-low-sfp-report.ts --study <saved-directory> --out <findings.md>`.
Saved paths: `backtests/range-low-sfp-early/latest.json`, with immutable full keys.
Charts reuse existing renderer and add15m beside1h/4h views. Saved parent HTML
and the accepted HYPE study remain unchanged. The scanner's SF01 family metadata
describes its default4h conventions; the frozen SF02 card and saved
`triggerTfMinutes=15` parameter define this variant.

## Decision and subsequent checkpoint

Same full/older/recent, monthly-delta, DD, sample, PF, concentration and cost/delay
screen as SF01. Rank against own4h baseline, not against cash alone. Historical
development data, including the operator's reviewed outcomes, not a holdout.

The user separately requested a **recent HL review of baseline stops that fail
to regain the original target within72h**, then a possible filtered/wider-stop
replay. That work remains separate: preserve source-time availability; distinguish
features known before entry (entry block candidates) from later features (exit
management candidates); censor incomplete72h outcomes; count recovering winners
and skipped trades. Do not turn these future recovery labels into entry inputs
or choose stop distances from each trade's future trough.
