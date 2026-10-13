# HYPE portfolio first trades review

For Emil. Reviewed October 13, 2026. The pull contains candles through **12:04 UTC**
and health through **12:05:29 UTC**: roughly 32 hours after the first fill.

**The filled trades and accounting mostly behave as intended, but live is not an
exact replay match.** The ladder's first add was delayed by the earlier fault,
and a separate restart-history issue suppressed an SF08 entry this morning.
The later CRSI timeout is not in this pull.

## Completed trades

Net includes entry and exit fees, before funding. One completed ladder is one
trade, and PA07's five exit receipts are one exit, not five trades.

| Setup | Entry UTC | Exit UTC | Why it closed | Live net | Minute replay net |
|---|---|---|---|---:|---:|
| Ladder, 3 rungs | Oct 12 04:00 | Oct 12 08:01 | 48h high exit | −$6.89 | Separate comparison below |
| PA07 short | Oct 12 12:01 | Oct 12 23:27 | Target | +$327.25 | +$326.23 |
| CRSI long | Oct 12 12:01 | Oct 13 00:02 | Timeout | −$378.72 | −$383.01 |
| ADX R5 short | Oct 12 17:01 | Oct 13 05:02 | Timeout | +$71.17 | +$67.55 |
| MACD R3 short | Oct 13 00:01 | Oct 13 12:02 | Timeout | −$127.64 | −$156.54 |
| **Closed total** | | | **2 wins, 3 losses** | **−$114.84** | |

Funding adds **$0.10**. All 100 execution receipts reconcile to the saved ledger;
an independent entry-value/exit-value/fee calculation matches each closed trade.
The closed setup trades did $37.83 better than their minute-open equivalents in
this sample. Different fill prices, seconds-level timing and lot/tick rounding explain that
difference; it is not evidence of an execution edge.

The second CRSI long opened Oct 13 at **00:16:07 UTC**, 82.50 HYPE at an average
**$80.8091**. It was still open in the pull, due **12:17:07 UTC**. Its saved
12:05 health estimated +$85.46 unrealized before exit fees; this is not realized
profit and uses a different price/time from the operator's later status.

## What matched and what did not

The saved tape was extended by **4,273 minutes**, without replacing the historical
bootstrap. All **481 archived raw setup signals** still match by identity.
All five live setup entries reproduce, with their expected owner/source choices;
the extra CRSI signal at 00:46 correctly remained blocked by existing CRSI exposure.

Setup fills arrived **8–31 seconds** after the model's scheduled minute. The
completed timed exits filled **5–16 seconds after their actual live deadlines**.
Their deadlines deliberately follow first fill plus 12h plus the existing
one-minute execution allowance. PA07's target filled within the same minute as
the replay. The minute replay cannot certify exact intraminute fill prices.

**SF08 did not match.** A range-low reclaim should publish at **Oct 13 04:01 UTC**
using the collector's original publication times. Live never admitted it.
Reproducing the restart's catch-up observation times changes that same setup to
`late_context`: the SFP detector sees older formation candles as arriving late.
Both versions were checked on candles ending at 04:00, before entry, so this
finding does not rely on later prices. PA07 still survives that reconstruction.
The saved console reports a sealed entry window but does not retain every old
per-source rejection; the reproduced mechanism explains the omission without
claiming an archived live rejection row exists.

### Ladder comparison

Its first buy filled at 04:00, but the next rung did not fill until **07:20**.
That includes the already diagnosed add-expiry fault and the operator's pause;
it is not a clean strategy-parity period. After the repair/resume, the next add
came at **07:51**, followed by the 48h-high exit at **08:01**.

Post-repair orders show the TP resized to **21.46**, then **38.05 HYPE**, and
cancelled for the exit. Repeated add-expiry/TP-replacement churn did not recur.
The uninterrupted replay built **9 rungs**, starting at 04:00 with its first add
at 04:18, and closed at **08:00 for +$21.09** under both TP models. Live instead
built **3 rungs** and closed at **08:01 for −$6.89**, a **$27.99 shortfall** against
that counterfactual. This includes different inventory, prices and exit timing;
it is not a measurement of the bug's isolated cost. The replay starts flat at
activation and does not import the live owner's legacy control memory or pauses.

Both archived ladder parents reproduced exactly before extending the run. This
is an independent ladder comparison plus the shared-slot/setup replay above,
not an exact end-to-end replay of the coupled live account. The extended indicator
series is saved for reuse. One newly available BTC close changed the old cache's
last-minute return; the sealed historical prefix was preserved, with that
boundary difference recorded explicitly.

## Remaining operational issues

- No new fatal/error-journal entries after the repair, no portfolio stderr
  output, and no unresolved orders or recovery at the synced cutoff.
- Brief missing-input statuses remain frequent: **277 high-input episodes** and
  **57 minute-feed-gap episodes** in the post-repair console sample. These
  cleared by subsequent logged snapshots, within 46s and 34s respectively.
  The completed tape has no missing minutes. These are sampled status episodes,
  not a measure of downtime or proof that every decision ran.
- Five `10006` responses occurred around **03:25 and 03:27 UTC**. This is Bybit's
  API rate-limit code, not a candle-refresh label. No entry or timed exit in
  this trade cohort was due in those minutes. [Bybit error reference](https://bybit-exchange.github.io/docs/v5/error).
- Logged ticks have a **14.2s median**, **32.4s 95th percentile**, and **44s maximum**.
  Snapshot/account reads still warrant attention; a healthy latest status does
  not establish an uninterrupted history.

The next correctness issue is SFP history across restart. Keep original
publication, worker observation and trading eligibility distinct; do not remove
freshness checks simply to make the missing trade appear. No signal or execution
timing policy was changed during this review, and this short sample is not a
strategy-performance verdict.

## Discord change

**Implemented locally, not deployed:** close notifications show net realized
PnL including allocated entry/exit fees, explicitly before funding. Entry
notifications show average fill and entry fees and state that PnL is not yet
realized. Split child receipts for one exchange order share a summary; long
floating-point quantities are cleaned up. No old notifications are resent by
clearing their delivery state.

## Evidence and reruns

- [Receipt, setup replay and timing summary](../../backtests/portfolio-first-trades/e703632ab5517dae/summary.json)
- [Detailed setup comparison](../../backtests/portfolio-first-trades/e703632ab5517dae/comparison.json)
- [Outcome-independent restart reproducer](../../backtests/portfolio-sfp-restart-probe/46c1e7c08681d2f8/report.json)
- [Ladder parent parity and extended replay](../../backtests/portfolio-first-main/678983fc97a230c4/summary.json)
- [Append-only indicator provenance](../../backtests/portfolio-first-main/678983fc97a230c4/append-only-provenance.json)
- `npx.cmd ts-node scripts/portfolio-first-trades-audit.ts` reuses an unchanged
  sealed audit; changed inputs receive a separate output directory.
- `npx.cmd ts-node scripts/portfolio-fill-summary-tests.ts` checks partial-fee
  allocation, long/short signs, grouped fills, immutability and mismatch rejection.
- `npx.cmd ts-node scripts/portfolio-first-main-replay.ts` reuses the saved ladder
  run when its inputs match; do not rebuild the full indicator series manually.

No live configuration, account or accepted research archive was modified.
Nothing was committed, pushed or deployed.
