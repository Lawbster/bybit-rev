# LC01: NPOC / previous-day-high with indicator context

Frozen September 18, 2026, before new outcomes. Research-only $10k positions.
Authoritative parameters: `research-inputs/level-indicator-lc01-2026-09-18.json`.

## Why this pass

Reuse the level events rather than search new geometry. PB02's daily NPOC
long makes $15,962 full but only $602 recent and is not qualified. PI01's
CRSI<=10 and hourly ROC5<=-2 cuts were descriptive, not filtered earnings.
RSI alone did not separate heavy tails. R01's CMF short refinement was a
small-sample lead. HT03's extra rejection confirmations generally sacrificed
profit; none is silently added here. Existing failed strategies remain counted.

Four saved parents: daily NPOC touch long, daily NPOC rejection short,
previous-day-high rejection short, previous-day-high breakout/retest long.
The calendar high is **not** HT03's rolling 48h high. Test each with unchanged
12h exit and fixed TP2%/SL3.5% capped at 12h; both exits already exist in LV02.
They are independent $10k accounts, not a portfolio or ladder improvement.

## Frozen conditions

| Condition | Long | Short |
|---|---|---|
| CRSI15m extreme | <=10 | >=90 |
| Hourly ROC5 stretch | <=-2% | >=+2% |
| Hourly CMF20 alignment | >=+0.05 | <=-0.05 |
| CMF + NPOC room | CMF above and no other daily NPOC within 2% overhead | CMF below and no other daily NPOC within 2% underneath |

Four conditions x four entries x two exits = **32 primary definitions**.
Room-only and common-readiness controls add16 diagnostics. The8 unfiltered
parents are archived controls, not new discoveries. All available original
opportunities are filtered before replay; changed occupancy is recomputed.
Common readiness is finite CRSI15m/ROC5-1h/CMF20-1h. No fresh threshold search.

## Timing and reuse

Same Dec5,2024 12:55 to Sep15,2026 20:20 UTC window, split June1,2026;
source lag60/120s and extra action delay0/60s. Use the saved candle atlas,
saved LV02/LV01/PB02 signals, immutable POC map and PI01 feature functions.
Build feature snapshots once, not per strategy. Profile status is projected
as-of signal minus lag. Exclude a bounce/rejection's own source POC from the
obstacle set. Absence of a known obstacle is not evidence of safe price travel.

Reproduce exact selected LV02 baselines before variants; reuse independent
long/short minute auditors. Preserve fees0.055% per side, +5bps cost stress,
actual-fill TP/SL, adverse DD on32k, marked cutoff inventory, monthly screens,
source hashes, and unchanged live files. Evidence remains before funding and
does not establish historical collector receipt or exchange queue certainty.

Run: `npx ts-node scripts/level-indicator-study.ts`.
Verify: `npx ts-node scripts/level-indicator-verify.ts <job-directory>`.
Saved context, ledgers, CSVs and checks are authoritative; no repeated map run.
