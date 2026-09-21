# SRT02: exact resistance versus up to 0.3% below

Frozen September16,2026 before outcomes. User-requested matched-opportunity
diagnostic, not an alternative strategy replay. Map and existing partials stay.

Reuse SRT01's eight accepted diagnostic paths (two windows, two TP assumptions,
geometry0/60s), retaining the exact same first-qualifying TP/inventory anchors.
Recheck eight archived economic controls and reproduce every exact label.
No data-window extension, new resistance quality rule or threshold search.

Buffered target = `max(averageEntry * 1.01, resistance * 0.997)`.
This is **up to**0.3% below resistance, limited by the existing1% profit floor.
Report floor clipping explicitly. Original zones already satisfy >=1%; never
invent a higher zone or raise a stale0.5% target. Selection remains ordinary1.4%.

When target > current closed price, only later bars can supply a contact.
Use SRT01's fixed lifetime ending at baseline TP/inventory/action changes;
alternate close-trigger uses next-open evidence and excludes competing actions.
If target <= current price, report **already in buffer at intent** separately:
it is not postable at that price under the minute-close proxy and not a past
maker fill. Its optional next-open price is only an immediate-exit observation,
not a newly simulated market order or proof the profit floor would be achieved.

Compare exact, buffered future contacts, already-in-buffer and their union.
Unique ladders and genuinely new ladders are deduplicated; anchor counts remain
correlated. Show new-cohort baseline wins/losses and dollars, monthly contact
counts beside baseline net, timing and fixed-inventory target concession.
Never call cohort baseline losses saved losses or sum anchors as sequential
trades. Faster cycling and new inventory paths remain unknown.

The1% floor is an explicit assumption inherited from SRT01, not a claim that
the user prescribed it or that1% is optimal. This test does not evaluate an
uncapped0.3% offset that could take profits below1%.

## Run locally

```powershell
npx ts-node scripts/resistance-tp-buffer-tests.ts
npx ts-node scripts/resistance-tp-buffer-study.ts plan
npx ts-node scripts/resistance-tp-buffer-study.ts run KEY
npx ts-node scripts/resistance-tp-buffer-verify.ts KEY
npm run research:workflow -- verify KEY
```

Independent checker recomputes target, classification, forward scan, original
expiry boundaries, entry/exit cost arithmetic, cohort/month summaries and exact
controls without calling the buffer worker's implementation. It shares the
established corrected minute loader and accepted causal S/R anchors. No live
config, state, exchange, service, replay-engine or SRT01 artifact changes.
