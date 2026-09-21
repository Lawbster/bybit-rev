# PVA01: executed-volume source audit

Research-only first checkpoint for [POC/NPOC](../../research/POC-NPOC-DESIGN.md).
No economic replay, new signal, live process or source-data replacement.

## Commands

```powershell
npx ts-node scripts/poc-volume-source-tests.ts
npx ts-node scripts/poc-volume-audit.ts plan
# Use the printed full key; completed stages refuse replacement.
npx ts-node scripts/poc-volume-audit.ts inventory KEY
npx ts-node scripts/poc-volume-audit.ts samples KEY
npx ts-node scripts/poc-volume-verify.ts KEY
npx ts-node scripts/poc-volume-audit.ts verify KEY
```

Accepted key: `877f6836f8ab3ad6e2bd8c3268479da131890afbeb7c12750a24358d506f5781`.
Read its saved outputs instead of repeating completed stages. Sources, card, local
candles, protected production files and runtime are pinned. Do not sync data during
a job. Interrupted directories remain failed evidence; do not delete them to retry.

PVA01B separately checks individual Binance trades and official candle archives:

```powershell
# Refuses an existing job identity; not a command to repeat a completed audit.
npx ts-node scripts/poc-binance-tape-audit.ts
npx ts-node scripts/poc-binance-tape-verify.ts KEY
```

Accepted key: `a2c29361f307d598ede16d8a4548e0074d27749dd5787279a01abe0c9713a540`.
Its parent PVA01 job is pinned. Source/data changes need a reviewed new identity.

## Artifacts

- `backtests/poc-volume-audit/KEY/plan.json`: card, source/data/runtime fingerprints,
  protected production-file pins.
- `inventory/`: HTTP listing/HEAD/HL-denial evidence, archive register and coverage.
- `samples/`: summaries, candle mismatches, exact-price/minute gzip histograms,
  raw-source identities and checksum links.
- `*-complete.json`: immutable completed-stage artifact hashes; no seal means unfinished.
- `independent-verification.json`: source-row to histogram cross-check.
- `backtests/poc-volume-cache/`: reusable original PVA01 compressed downloads and
  checksum/provenance metadata. Existing files are never silently replaced.
- `backtests/poc-binance-tape-audit/KEY/`: individual Binance archives, candle ZIPs,
  histograms, source comparison and independent verification.

The scripts use built-in Node facilities; no dependencies were added. ZIP support
is a single unencrypted, non-ZIP64 CSV entry. Unexpected formats/precision fail
explicitly. Downloads are bounded; no AWS credentials, paid archive requests or
production collector imports are used.

Full daily ingestion must repeat content/coverage checks: listed dates and a few
valid samples are not a certification of the whole tape. First/last partial source
sessions must not become full profiles. Download timestamps are not original receipt
times. Complete minute histograms must not be exposed before that minute closes;
retain source trades for sub-minute retest questions.

This checkpoint has no final profile grid, NPOC lifecycle or replay profile API yet.
[Findings and source decision](../../research/codex-astra-poc-source-audit-findings-2026-09-17.md).
