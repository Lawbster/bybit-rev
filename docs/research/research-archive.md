# Research archive: local SSD + OneDrive

Local research tooling only. No replay, bot, strategy, production data collector,
or accepted study source is modified by this workflow.

First measured archive/restore and NTFS-compression results:
[September 20 pilot](archive-pilot-2026-09-20.md).

## Storage contract

| Tier | Contents | Behavior |
|---|---|---|
| Repository/Git | Scripts, findings, queue, small archive manifests and restore-test receipts | Navigation and exact original-path/hash inventory |
| Local SSD outside OneDrive | Current data, reused maps/features, active studies | Replays read ordinary local paths; no cloud reads during execution |
| OneDrive vault | Immutable compressed objects and study manifests | Completed research archive; explicit restore before reuse |

Default vault: `%OneDriveConsumer%/TradingResearch/reverse-copy`, falling back to
`%OneDrive%`. `RESEARCH_ARCHIVE_ROOT` or `--vault <absolute path>` overrides it.
The vault directory must already exist; a typo must not create a new cloud root.

```text
TradingResearch/reverse-copy/
  objects/sha256/<first-two-hash-characters>/<original-file-sha256>.gz
  objects/sha256/<first-two-hash-characters>/<original-file-sha256>.raw
  studies/<archive-id>.json
  raw/       (reserved; no existing contents changed)
  catalog/   (reserved; portable manifests currently live in studies/)
```

Compression is streaming gzip level 6 with bounded memory, staged outside
OneDrive in ignored `.research-archive/staging/`. Only a complete verified object
is moved into the vault. Across volumes, a completed object is copied, verified
again and published; a slowly growing compression stream is never written there.
Already compressed
formats are stored unchanged (`.raw` is the object's storage suffix, not a change
to the original file). Exact duplicate contents share one object within a codec;
each original path remains in its study manifest. This avoids one huge archive,
allows individual original files to be reconstructed, and reuses duplicate
baseline journals across studies. No extra compression dependency is installed.

Portable gzip archives and transparent NTFS compression are separate layers.
NTFS compression can save local disk without changing file paths/content, but
does not make the cloud upload smaller. The optional `compress-local` command
uses Windows `compact.exe /C /Q` on the exact archived files, not the whole repo.
It verifies original hashes before and after, requires the completed-job queue,
and skips already compressed formats. Normal `run` does not change NTFS attributes.
Do not queue actively used replay inputs for this operation; decompression has a
CPU cost even though paths and contents remain transparent to existing readers.

## Commands

From the repository root, PowerShell:

```powershell
# Preview the explicit queue; no file publication.
npm run research:archive -- plan

# Compress -> verify -> publish -> record local manifest. Originals stay put.
npm run research:archive -- run

# Small local index; does not hydrate cloud objects.
npm run research:archive -- status

# Substitute the full archive ID printed by run/status.
npm run research:archive -- verify <archive-id>
npm run research:archive -- restore-test <archive-id>
npm run research:archive -- restore <archive-id>

# Optional local disk savings without removing the originals (Windows NTFS).
npm run research:archive -- compress-local <archive-id>
```

`verify` checks stored checksums AND decoded original bytes/checksums.
`restore-test` performs a full restore to a new local scratch directory, records
a receipt, then deletes ONLY that newly created scratch directory after path
checks. On failure, scratch stays for inspection. `restore` reinstates missing
files at their original repo-relative paths. It preflights existing files and
refuses conflicting content rather than overwriting it.

Archive manifests are also copied to `docs/research/archive-catalog/` for local
lookup and future Git inclusion. They are metadata, not proof of remote upload.
Nothing is automatically committed. Scratch belongs to ignored `.research-archive/`.

## Queue and automation

`research-archive-config.json` is the explicit allowlist. Initial pilot: the
completed September 6 VWAP/volume standalone study. To add a completed job:

```json
{
  "source": "backtests/family/completed-job",
  "completion": { "file": "verification.json", "field": "passed", "equals": true }
}
```

A `state.json` with `status: "complete"`, or another top-level completion field,
can be used instead. The proof is a storage eligibility check, NOT a new economic
qualification. Queue membership means the operator/agent considers the directory
finished and no research writer is using it. Minimum quiet age defaults to 24h.
No broad scanning or automatic archiving of newly written results is performed.

For legacy completion receipts without a boolean/status field, use
`"completion": {"file": "complete.json", "sha256": "<exact full SHA-256>"}`
after reviewing that receipt. This pins the evidence of completion without
editing an accepted artifact just to fit the archiver.

Running `run` repeatedly is safe: unchanged studies retain the same archive ID;
existing objects are verified and reused. A later changed snapshot receives a new
ID without replacing the historical one. Use this command after research sessions
or from a future user-approved scheduled task. No scheduler is installed and no
existing research dispatcher is modified. Keep one writer machine per vault.

Locks fail closed rather than stealing another writer's lock. After a hard kill,
inspect the reported lock and unfinished temporary objects; confirm no archive
process is running before recovery. Do not delete shared objects speculatively.
Source additions, removals and changes during snapshotting abort manifest publication.

## Scope and dependencies

This version archives the explicitly selected directory, **not its transitive
dependency graph**. Original study manifests/pins are preserved verbatim. Inputs
outside that directory remain where they are; the archive is not represented as
a standalone reproducible study bundle. Keep active canonical candles, repair
manifests and reusable maps local. Archive frozen dependency directories as their
own explicit jobs before considering any future eviction of them.

Only specific `backtests/<family>/<job>` directories qualify. Live `data/`, logs,
`.git`, dependencies, `.env`, credentials and bot state are outside the automation.
Symlink/junction escapes, unsafe paths, incomplete temp files, corrupt archives,
restore conflicts, young files and busy locks are rejected.
Individual files are capped at 16 GiB; partition larger artifacts intentionally.
Archive IDs/checksums prove integrity, not authenticity against someone able to
replace both content and manifests. Retain the independent local/Git catalog.

Space preflight conservatively reserves the selected source size plus margin for
publication, and full uncompressed size for restore, leaving at least 2 GiB by
default. This can refuse a deduplicated or highly compressible job that would fit:
prefer safety and partition a very large archive intentionally. OneDrive may keep
both original and published copies locally until archival cleanup is approved.

## No automatic deletion or cloud-completion claim

`run` verifies the **local OneDrive folder**. It does not authenticate to Microsoft
Graph, check server-side bytes, or treat a green icon as a checksum receipt. The
CLI deliberately has no delete/prune command. This first version can temporarily
use more disk because source files are retained alongside the archive.

Restores use an exclusive temporary file and an atomic no-replace hardlink
publication on the **local destination filesystem**, then remove the temporary
name. This does not hardlink files into OneDrive. A destination filesystem that
does not support hardlinks fails closed; use the local NTFS workspace.

Before any separate local-original cleanup:

1. Verify the archive and pass a restore test.
2. Confirm OneDrive upload completion; for irreplaceable data, validate a remote
   download/restore and keep an independent backup.
3. Confirm the job/dependencies are no longer needed by active studies.
4. Approve an explicit path-limited eviction plan. Never auto-delete from a sync
   folder to save space: deletion can propagate to cloud storage.

For archived OneDrive objects use **Free up space**, not Delete, only after sync
is confirmed. Do not pin the whole vault with Always keep on this device. A later
verify/restore will download online-only objects, so reserve space first. Restore
and hash-check all required inputs before a timed replay; never rely on surprise
cloud hydration inside a running simulation.

## Tests

```powershell
npm run test:research-archive
```

Uses isolated temporary workspaces/vaults. Does not access the real OneDrive,
modify production state, or delete any historical research artifacts.
