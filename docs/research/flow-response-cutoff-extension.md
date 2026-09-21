# FR01 cutoff extension: September 14

User-requested update of the existing current-Aggressive10 versus impact-half
comparison. No threshold search or live change. The original FR01 job and
its September 10 endpoint remain immutable.

## Scope frozen before outcomes

- Same May 17, 2026 20:43 UTC flat-$32,000 start; extend only the end to
  September 14, 2026 15:27 UTC, the common local HYPE/BTC candle endpoint.
- B17, Aggressive10, impact-half; resting-touch and close-confirmed TP.
- Six exact old-endpoint bridge runs precede six extended primary cases.
- Two impact-half cases retain the original additional 60-second feature-lag
  sensitivity. Fourteen runs; zero new trading definitions.
- All inventory, partial realization, cooldown and open PnL carries through
  September 10. No restarting flat for the four-day addition.
- Existing fee model and monthly -$250 screen stay unchanged. These dates
  were observed before requesting the extension, not an untouched holdout.

## Data handling

`flow-response-extension-data.ts` audits the local tails and writes a separate
Bybit public-GET witness for the missing September 12 06:44 HYPE candle,
validated against adjacent minutes and native five-minute OHLC/volume.
The older repair evidence is retained. No synced file or recorded availability
timestamp is changed. Reconstructed OHLC is corrected exchange history, not
proof that the collector delivered that minute live.

`flow-response-extension-btc-check.ts` independently recovers the corresponding
BTC minute into an evidence bundle and verifies all hourly closes are exactly
unchanged with/without it. The inherited BTC gate uses those hourly closes;
the FR01 strategies do not consume the auxiliary four-hour BTC-return feature.
Therefore no change to the canonical BTC loader or gate is needed.

Missing HL endings September 13 08:38, 08:39 and 08:40 UTC and duplicate
buckets are not reconstructed. Original unknown-evidence behavior applies.
Historical HL receipts remain modeled rather than proven.

## Run and verify

Run the data-witness commands once (they refuse overwrite), then:

```powershell
npx ts-node scripts/flow-response-tests.ts
npx ts-node scripts/flow-response-extension.ts plan
npx ts-node scripts/flow-response-extension.ts run KEY
npx ts-node scripts/flow-response-extension-verify-v2.ts KEY
npx ts-node scripts/flow-response-monthly-report.ts KEY
```

The verifier reuses the independent raw-flow reference, inventory/fee ledger
and every-opportunity TP/high-exit auditors. It checks extended execution
prefixes against the old endpoint and recomputes intrabar-low drawdown since
that endpoint separately from full-period drawdown. Monthly reporting keeps
completed-ladder outcomes separate from monthly marked-equity changes.

All inputs, strategy sources, protected live files and outputs are hashed;
accepted artifacts are never overwritten. Research files alone are added.

Use verifier v2 for this run: the saved worker output omits the redundant
age-counter summary. V2 reconstructs it from recorded transitions, checks the
old summaries against FR01, and retains every original minute/target/fill check.
Its own source hash is checked before/after and recorded alongside the original
plan's immutable source/output pins. See the findings' tooling notes.
