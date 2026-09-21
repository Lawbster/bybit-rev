# L15: 10h TP deferral crossed with the two aggressive entry changes

September 11, 2026. Local research only. No production/config changes.

Completed and independently verified. [Findings](../../research/codex-astra-age10-gate-factorial-findings-2026-09-11.md).
Accepted key: `0b999800c49f7cf869e370252e1f95caaa879e396febb8eb06a65506c11781a9`.
46 cases,24 exact controls,208,935 fills and15,405,122 minute marks checked;
48 entry-attribution comparisons. All3 aggregate net/DD improvements across
four cases,0/3 complete monthly passes. All10 source60 cases unchanged.

## Frozen question

Does extending the L14 two-day-high pair's soft-stale deferral to 10h retain
the benefit of removing either/both aggressive entry constraints?
Three new trading definitions, not a new broad parameter search:

1. 10h + remove hot-RSI post-TP cooldown.
2. 10h + remove deep negative-funding timer-add guard.
3. 10h + remove both.

The [card](../../research-inputs/age10-gate-factorial-2026-09-11.json) was frozen
before outcomes. Six existing policies provide exact controls: B17; original
8h/high pair; safeguarded 10h; 8h with each removal; aggressive 8h with both.
Together this is an eight-cell 8h/10h x deep guard on/off x RSI cooldown on/off
factorial plus the current B17 baseline. Only three cells are new definitions.

All high-rule cells keep the same full exit: oldest surviving rung age >=4h
and current completed-minute price within 1% of the rolling two-day high,
based on 2,880 contiguous completed minutes. Execution is next minute open,
not the high itself. There is no PnL floor or new entry veto. Ordinary exits
and S/R partials retain priority. High exits keep the original 4-8h boundary
forced cooldown. The TP deferral cap is NOT a minimum holding period.

The deep guard only restricts timer adds at existing depth >=5 under known
negative funding; genuine price-drop adds and the existing qualified S/R
support-reopen exception remain relevant. The RSI cooldown is 30 minutes
following a TP with known 1h RSI >60. All other current guards, sizing, S/R
actions, hard flatten and emergency exits remain unchanged.

## Dates, capital, fills and count

- Older: July 1, 2025 00:00 through August 19, 2026 21:32 UTC.
- Recent: May 17, 2026 20:43 through September 10, 2026 05:08 UTC.
- Each starts independently flat with $32,000, $800 x1.35, max11 rungs.
- Both resting-touch and close-confirmed TP models; these are different
  inventory paths, not certified best/worst bounds.
- Original 0.055% per-side fees. No modeled maker savings or actual funding
  settlement; no exchange liquidation/shared-short-account certification.
- 24 exact L14 controls precede 12 new cases. Then 10 recent source60 repeats
  of safeguarded10h, aggressive8h and all three new policies: **46 runs**.
- Source60 delays only the high reference, not market fills or maker queues.
- Overlapping, repeatedly examined windows; no fresh holdout is claimed.

## Entry and profit attribution

The observer never controls execution. It advances the same S/R context
implementation over every engine minute, not just sparse entry timestamps;
uses identical pulse timing and Bybit historical-funding fallback; checks
the original deep guard AND the support-reopen exception. Approved adds in
guard-enabled controls must also pass the observer's gate reconstruction.

For a resting TP, cooldown RSI comes from the closed minute before the fill
bar, not from the target-arm time or the fill bar's eventual close. For a
close-confirmed TP it comes from the original close decision. Record whether
an accepted add lies within the latest hot-TP cooldown and whether restoring
the original deep guard would block it on that path.

Those flags are **same-path hypothetical permissions, not marginal PnL per
add**. Once a gate changes the ladder, subsequent entries, inventory, partials
and flat times can diverge. Classify matched-entry versus replacement episodes,
compare added/removed rung fills, and separately reconcile removed baseline
profits/losses and final unfinished inventory. Do not credit an episode's entire
P&L to a single extra rung. Outcome labels are attribution only, never inputs.

The factorial net contrast is both - deep-only - cooldown-only + safeguarded,
computed separately for 8h and 10h, each model and window. It measures the
historical non-additive interaction, not statistical significance.

## Acceptance and follow-up boundary

Unchanged screen: recent net delta >=$1,000 in both models, older delta >=0,
no DD increase, every monthly MTM delta >=-$250, >=20 recent intervention
episodes and no modeled nonpositive equity. Report B17 and both shortlisted
controls beside every new result, including W/L counts and dollars, marked
versus completed net and every month. Economic accounting is independently
checked from raw candles and inventory records, including TP arm chronology,
high references, entry quantities, fees, monthly marks and source availability.

After the results, use the entry cohorts to decide whether selective guard
relaxation has a supported hypothesis. A separate high-exit-only cooldown
experiment must be frozen independently; no emergency/hard-flatten cooldown
removal, new regime filter, fourth combination or live change belongs here.

```powershell
npx ts-node scripts/age10-gate-tests.ts
npx ts-node scripts/hype-age10-gate-study.ts plan research-inputs/age10-gate-factorial-2026-09-11.json
npx ts-node scripts/hype-age10-gate-study.ts run KEY
npx ts-node scripts/age10-gate-verify.ts KEY
npm run research:workflow -- verify KEY
```

The immutable workflow kind is reused with this study's explicit runner;
generic workflow `run` is not its dispatcher. Original L14 source, definitions,
results and verification are preserved unchanged.
