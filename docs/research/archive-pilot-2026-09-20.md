# Archive pilot — 2026-09-20

Workflow: [research archive](research-archive.md).
No trading code/configuration, raw collection feeds, or accepted study contents changed.

## Completed pilot

Source: `backtests/hype/hype-vwap-volume-standalone-2026-09-06`.
Eligibility: 24h quiet period and existing `verification.json` with `passed=true`.

Archive ID: `71153010c7a5ac85b09ed80bffcac496269663a0a01c0644de808fad8573bb8c`.

| Measurement | Bytes | Decimal size |
|---|---:|---:|
| Original files, 13 total | 2,164,525,086 | 2.165 GB |
| Portable compressed archive objects, 13 total | 517,023,279 | 517 MB |
| Retained originals after NTFS compression (compact-reported storage) | 1,168,171,783 | 1.168 GB |
| NTFS reduction on originals | 996,353,303 | 996 MB |

Portable archive reduction: approximately 76.1%. This is measured full-file
compression, not the earlier sample estimate. All 13 original content hashes
were checked unchanged after NTFS compression. Original paths remain intact.

The portable archive and the NTFS-compressed originals are **two copies**, not
additive savings: while the archive remains locally cached, their combined
payload is about 1.685 GB. OneDrive `Free up space` can release the archive's
cached payload after upload is confirmed. No original was removed.

## Verification

- Streaming archive storage checks stored and decoded SHA-256/size.
- Full restore test rebuilt all 13 files into a new scratch tree, verified them,
  saved the receipt, then removed only that scratch tree.
- Focused suites: storage core, 29 CLI checks, 13 independent safety checks.
- Safety coverage includes corrupt/truncated objects, traversal and junctions,
  source changes during archiving, busy locks, young/incomplete inputs, duplicate
  reuse, same-job identity, and a concurrent restore-target collision.
- Full project and VPS TypeScript checks passed.

Receipts under `docs/research/archive-catalog/`:

- `<ID>.json`: exact paths, content hashes, stored objects and hashes.
- `<ID>.restore-test.json`: successful full local restore.
- `<ID>.ntfs-compression.json`: native compact output and unchanged-hash assertion.

Cloud objects were published only inside the approved personal OneDrive
`TradingResearch/reverse-copy/` vault. No other OneDrive contents were modified.
The receipts confirm the **local** vault, not Microsoft server-side upload.

At 2026-09-20 15:07 UTC, the operator confirmed the 517 MB archive had synced.
This is recorded separately in `<ID>.operator-sync-confirmation.json`; it does
not replace an independent remote-download/restore check. Originals remain intact.

At 2026-09-20 15:12 UTC, the operator-provided OneDrive web download
`TradingResearch.zip` was independently verified without using cached OneDrive
objects. Its manifest matched the local catalog byte-for-byte; all 13 compressed
objects matched their stored SHA-256/size, and all 13 fully decompressed contents
matched their original SHA-256/size (2,164,525,086 bytes). No unexpected files.
The ZIP was streamed, not extracted over the workspace. Detailed evidence:
`<ID>.web-download-verification.json`. The earlier local full disk restore plus
this web-download content check establish the pilot's verified cloud round trip.

## Next boundary

Cloud upload and downloaded archive contents are verified for this pilot snapshot.
An explicit dependency-aware eviction plan is still required before deleting
originals. Current automation never deletes historical sources. The queue intentionally
contains only this pilot; additional completed jobs are opt-in, not auto-discovered.
No scheduled task or background service was installed. No commit or push was made.
