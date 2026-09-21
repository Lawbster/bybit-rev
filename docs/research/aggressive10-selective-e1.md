# AG10-E1: selective deep timer-add guards

Frozen September 11, 2026. Local research only; no live changes.

## Question and boundaries

Does conditional restoration of the original deep funding guard improve the
aggressive 10h parent after real inventory and replacement-trade effects?
Exactly two definitions, derived from AG10-D1, not a threshold sweep:

1. Last completed hourly close below its UTC-session VWAP AND hourly ROC <0.
2. Last completed hourly high below the prior high AND close below prior low.

Both apply only where the original deep negative-funding timer guard would
block **after** the existing support-reopen exception. Preserve genuine drop
adds, shallow adds, qualified support exceptions, initial entries, existing
exit priority, partial clocks and sizing. Unknown required hourly context
restores that original guard only. Reconsider each later eligible opportunity;
there is no first-decision-only or episode-persistent lock.

## Frozen controls and timing

[Card](../../research-inputs/aggressive10-selective-2026-09-11.json).
Three controls: B17 unchanged, guarded 10h, aggressive 10h. All 12 archived
control cases must match full digest and metrics before any variant runs.
Then 8 variant cases and 6 recent source60 repeats: **26 runs, 2 definitions**.

- Older: July 1, 2025 00:00 through August 19, 2026 21:32 UTC.
- Recent: May 17, 2026 20:43 through September 10, 2026 05:08 UTC.
- Each starts independently flat with $32,000; $800 x1.35 maximum 11.
- Fixed 0.055% per-side fee, no funding-cashflow or maker-queue certification.
- Resting-touch and close-confirmed TP paths, not independent samples or bounds.
- Hourly VWAP includes only turnover/volume through the latest completed hour,
  belonging to that hour's UTC session; no eventual full-day VWAP.
- Extra 60s shifts the new hour/VWAP context and rolling-high reference, not
  current price, original funding/pulse/outer gates or execution prices.
- Repeated aggressive-parent source60 cases separate high-rule sensitivity
  from the added filter. No holdout claim on these overlapping mined windows.

The current synchronized files have longer tails than the L15 archive.
Original prefixes must hash-match, and every additional row must be strictly
outside the economic cutoff before the unchanged canonical loader is used.
Full current files and unchanged inherited code are pinned as well. A tail
that revises the window is a hard failure, not permission to refresh baseline.
Current bot-state is separately protected by the new plan, not compared to an
old VPS snapshot or used as a historical seed. The first preflight attempt
incorrectly compared that old protection hash; it failed before any economic
case. Its failed record is retained; correcting this classification does not
change inputs, thresholds or economic definitions.
The second setup attempt exposed an eager context import capturing the
canonical loader's default horizon. It was interrupted during series building,
before any economic case; its run claim remains preserved, not reusable.
Context imports are now deferred until the runner sets the frozen horizon,
and an import-isolation check covers this boundary. An exact cutoff assertion
also remains mandatory before any economic case.

## Accounting and acceptance

Show all five setups with net, maximum DD, W/L winning and losing dollars,
marked versus completed results, every monthly MTM delta, TP/forced counts,
blocked checks versus affected episodes, and matched/removed/replacement/end
inventory reconciliation. Never subtract an attributed loser as block savings.

Original B17 screen: recent net delta >=$1,000 each TP model; older >=0;
DD no worse; every month delta >=-$250; no modeled zero equity. For this
checkpoint, the >=20 recent intervention requirement counts **newly blocked
episodes**, not the parent's already-established TP/high-rule interventions.

Separate marginal screen versus aggressive parent: positive recent net delta,
nonnegative older delta, no DD increase, every monthly delta >=-$250 and >=20
recent newly blocked episodes per model. Both screens are declared before
outcomes; neither changes the existing parent's research-only status.

Independent checker verifies raw hourly/VWAP, inventory and scope at attempts,
original funding and shared S/R support permission, accepted/rejected order
correspondence, all target/high opportunities, fee/equity/monthly accounting,
exact controls and comparison partitions. Production/engine files are protected.

```powershell
npx ts-node scripts/aggressive10-selective-tests.ts
npx ts-node scripts/hype-aggressive10-selective-study.ts plan research-inputs/aggressive10-selective-2026-09-11.json
npx ts-node scripts/hype-aggressive10-selective-study.ts run KEY
npx ts-node scripts/aggressive10-selective-verify.ts KEY
npm run research:workflow -- verify KEY
```

Use the explicit runner; generic workflow run is not this study's dispatcher.
Do not overwrite an accepted run or verification receipt. No third combination,
cooldown experiment, added HL rule or deployment belongs in this checkpoint.

## Completed checkpoint

[Findings](../../research/codex-astra-aggressive10-selective-findings-2026-09-11.md).
Accepted key:
`4dfaeac55380c408f26c15845fa710fee4725c62355ec7c35d422df6cf6d96ca`.
All26 runs complete;12 controls exact; independent verification and artifact
integrity pass. Neither of the two filters passes the marginal aggressive
screen or full B17 screen. Parent lead remains unchanged, research-only.

Pre-economic attempts preserved: failed state-protection classification
`9efe5cb0a38b8a67e304217515e9e322d4a1dd63b6ad6fadf9d8509680bd8b6e`;
interrupted eager-import/horizon setup
`be803f51a62129bb9885dd428a1cb6073f24ccc4a0ecbe3e0c815688348b6acb`.
Neither ran an economic case. The latter's claim remains in place rather
than being rewritten into a completed or reusable result.
