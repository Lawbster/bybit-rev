# F02: can selective early exits reduce flatten damage?

## TL;DR

- **Yes, in the recent sample:** MFI-gated half exits increase May17–Sep8 net from **$20,914 to $24,303** under resting-touch TP, and **$15,839 to $20,893** under close-confirmed TP. Drawdown falls **24.69%→20.06%** and **31.11%→26.08%**. Only **six/four interventions**, all June/early July; the overlapping TP paths are not ten independent trades.
- **No blanket early-loss exit:** unfiltered half exits reduce recent net to **$9,287/$3,354**; full exits to **−$765/−$1,621**. MFI half is the strongest recent case, but its older touch-model net falls **$46,832→$44,570**, with DD **28.17%→31.97%**. **Zero of four new policies passes the complete frozen economic screen.**
- **Useful mechanism, not an always-on deployment candidate.** 44 runs; four old B17 digests exactly reproduced before variants. Independent checks cover **272,943 fills, 16,751,636 minute marks and 2,610 raw MFI reconstructions**. No live/config/state changes, commit or push. No threshold retuning after results.

## Exact experiment and baseline

This is the approved five-case economic follow-up to [P01](codex-astra-pressure-point-atlas-findings-2026-09-09.md), not another indicator sweep. Baseline is **L09 B17, the current modeled long configuration**, not the bare ladder, old biased baseline or standalone $10k indicator strategy.

- Flat $32,000 start; $800 base, x1.35, max11; current time/drop entries, gates, deep guard, S/R partial/support actions, damaged latch and ordinary exits retained.
- First completed minute with **depth>=9 and gross inventory PnL<=−3%** starts a timer. Exactly **+60 minutes**, the same episode must remain open/depth>=9. It need not still be below−3%. One checkpoint per episode; no repeated searching after a miss.
- Cases: unchanged baseline; unfiltered50%; unfiltered100%; **50% if completed30m MFI14<=20**; 100% under that same MFI condition. Ordinary TP/emergency/funding/hard-flatten/SR reductions have priority.
- Half exits are **pro rata**, preserve entry IDs/levels/times/lastAddTime, and prohibit new adds for the rest of that episode. Existing exits still manage the remainder. This is not the existing profitable selected-rung S/R partial.
- Full exits use the ordinary forced-close cooldown, `(floor(fillAt/4h)+2)*4h`, then existing gates. Changed occupancy, replacement trades and affordability are replayed.
- New exits fill at the **next minute's open**, not the decision close or a prior low. Additional one-minute source and execution delays are tested separately. Fees0.055% each side; funding settlements, actual maker matching and shared-account shorts excluded.

Dates, all UTC:

| Window | Start | End | Purpose |
|---|---|---|---|
| Recent HL period | 2026-05-17 20:43 | 2026-09-08 17:47 | Current research sample |
| Published long history | 2025-07-01 00:00 | 2026-08-19 21:32 | Existing cross-regime control |

Both TP models run in both windows. They are execution assumptions, not guaranteed bounds or exact maker certification. The windows overlap and start with different exposure histories; do not pool them or treat their difference as another period. The older history does not gain synthetic HL coverage: baseline missing-source behavior remains unchanged.

## Recent results: wins versus losses, not just avoided flattens

W/L means **completed episode net including all its partials**, not merely the last fill's sign. Winning and losing dollars are completed-episode totals. Net includes the final open mark. All recent baseline/MFI cases retain the same **−$3,207 final open mark**; no unfinished partial profit explains their differences. Unfiltered full-exit cases have a different ending position/path.

### Resting-touch TP: May17–Sep8

| Setup | Wins / losses | Winning dollars | Losing dollars | Net incl. open | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Current B17 baseline | 295 / 10 | $57,130 | −$33,009 | $20,914 | — | 24.69% |
| Unfiltered half exit | 274 / 31 | $51,658 | −$39,639 | $9,287 | −$11,626 | 26.98% |
| Unfiltered full exit | 350 / 38 | $62,576 | −$63,760 | −$765 | −$21,678 | 34.59% |
| MFI half exit | 292 / 13 | $56,417 | −$28,906 | $24,303 | +$3,389 | 20.06% |
| MFI full exit | 294 / 15 | $56,036 | −$30,512 | $22,316 | +$1,402 | 21.00% |

MFI half reduces losing-episode dollars by **$4,103**, while giving up **$714** of winning-episode dollars. Three former winning episodes become losses. Thus the higher net comes with a lower win rate: the intended trade-off is smaller aggregate damage, not avoiding every losing close.

### Close-confirmed TP: May17–Sep8

| Setup | Wins / losses | Winning dollars | Losing dollars | Net incl. open | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Current B17 baseline | 243 / 11 | $59,238 | −$40,192 | $15,839 | — | 31.11% |
| Unfiltered half exit | 215 / 29 | $51,387 | −$45,301 | $3,354 | −$12,485 | 38.53% |
| Unfiltered full exit | 308 / 41 | $72,607 | −$74,647 | −$1,621 | −$17,460 | 47.13% |
| MFI half exit | 243 / 11 | $59,238 | −$35,138 | $20,893 | +$5,054 | 26.08% |
| MFI full exit | 252 / 13 | $61,295 | −$37,691 | $20,396 | +$4,557 | 25.34% |

MFI half leaves winning dollars unchanged and reduces losing dollars **$5,054**. It does not remove the ordinary forced closes: their remaining exposure still closes later. Both recent half-exit paths preserve **every baseline episode entry**; the improvement is quantity reduction inside existing episodes, not extra trades borrowed from another simulation.

## Why not fully close? Account for replacement trades

Full exits save more on the original selected episodes, but change when the bot can trade again. The arithmetic below includes that otherwise invisible cost/benefit.

| Recent MFI full case | Matched-entry PnL change | Removed baseline episodes / net | Replacement episodes / net | Final net gain |
|---|---:|---:|---:|---:|
| Touch TP | +$6,779 | 29 / +$7,607 | 33 / +$2,230 | +$1,402 |
| Confirmed TP | +$10,108 | 2 / +$836 | 13 / −$4,715 | +$4,557 |

Decomposition: **matched change − removed net + replacement net + open/unfinished change**. Here open/unfinished change is zero. A replacement trade can be profitable while still failing to replace the profit of the trade it displaced. These are matched-entry accounting comparisons, not an assertion that each action independently caused all later differences.

This is why the half exit earns more recent net than the full exit in both models, despite the latter initially removing more downside.

## Selected half exits: benefits and counterexamples

UTC checkpoint times; these are lifetime episode outcomes after applying the partial, including its loss. They are not estimated savings at the decision price.

| Model | Checkpoint | MFI30m | Baseline episode | Half-exit episode | Change |
|---|---|---:|---:|---:|---:|
| Touch | Jun2 10:47 | 17.84 | +$233 | −$606 | −$839 |
| Touch | Jun4 07:50 | 17.70 | −$8,432 | −$5,875 | +$2,557 |
| Touch | Jun18 17:14 | 14.99 | +$233 | −$1,027 | −$1,260 |
| Touch | Jun21 23:10 | 18.21 | −$6,111 | −$3,988 | +$2,123 |
| Touch | Jun25 14:58 | 10.92 | +$248 | −$272 | −$520 |
| Touch | Jul7 22:38 | 10.08 | −$4,108 | −$2,779 | +$1,329 |
| Confirmed | Jun9 15:10 | 15.82 | −$7,903 | −$4,821 | +$3,082 |
| Confirmed | Jun21 09:10 | 7.08 | −$6,918 | −$4,536 | +$2,381 |
| Confirmed | Jun25 14:44 | 10.92 | −$2,042 | −$2,459 | −$417 |
| Confirmed | Jul13 05:38 | 18.13 | −$2,253 | −$2,246 | +$7 |

Even a future loser can be a **bad early exit**: the confirmed June25 ladder subsequently recovered some value before its flatten. Conversely, cutting an episode that would later TP can turn a small win into a loss. Looking only at flatten membership hides both effects.

The latest modeled deep episode does **not** pass this MFI rule: at its +60m checkpoint MFI is **28.41**, so no experimental exit occurs. The rule has **zero interventions after July15** in these recent paths. It cannot be presented as demonstrated protection for the latest September exposure, or as broadly proven across the entire recent decline. Do not widen the threshold after seeing that example.

## Older history prevents blanket promotion

### Published Jul2025–Aug19,2026 totals

| Model | Setup | Wins / losses | Winning dollars | Losing dollars | Net | Δ baseline | Max DD |
|---|---|---:|---:|---:|---:|---:|---:|
| Touch | Current B17 | 955 / 57 | $187,738 | −$140,906 | $46,832 | — | 28.17% |
| Touch | Unfiltered half | 905 / 107 | $174,826 | −$149,459 | $25,366 | −$21,466 | 25.53% |
| Touch | Unfiltered full | 1,202 / 134 | $223,067 | −$217,516 | $5,551 | −$41,281 | 39.27% |
| Touch | MFI half | 942 / 70 | $184,460 | −$139,890 | $44,570 | −$2,262 | 31.97% |
| Touch | MFI full | 1,038 / 73 | $200,397 | −$154,475 | $45,922 | −$911 | 31.04% |
| Confirmed | Current B17 | 788 / 60 | $190,819 | −$171,329 | $19,490 | — | 45.65% |
| Confirmed | Unfiltered half | 734 / 104 | $174,877 | −$163,899 | $10,977 | −$8,512 | 37.85% |
| Confirmed | Unfiltered full | 1,042 / 147 | $248,078 | −$243,338 | $4,740 | −$14,749 | 45.05% |
| Confirmed | MFI half | 781 / 67 | $188,739 | −$164,907 | $23,832 | +$4,342 | 45.23% |
| Confirmed | MFI full | 845 / 70 | $206,744 | −$172,149 | $34,594 | +$15,105 | 39.45% |

This is not a marginal fee issue. Under older touch fills, MFI half sacrifices **$3,278 winning dollars** while reducing losing dollars only **$1,016**. Its extra recent profit does not offset all the older recovery cost. Full exits additionally depend heavily on changed trade occupancy and the TP model.

## Every month, all variants

All values USD, rounded. Baseline column is absolute monthly **mark-to-market PnL**; every other column is **delta versus that same baseline**. Positive means better. First/last months are partial according to the stated windows. Per-month W/L and winning/losing dollars for every setup are retained in [the detailed tables](../backtests/hype/hype-mfi-distress-exit-2026-09-09/tables.md) and [monthly CSV](../backtests/hype/hype-mfi-distress-exit-2026-09-09/monthly.csv). Episode dollars use closing month; MTM includes open exposure and cash partials when they occur.

### Recent touch

| Month | Baseline MTM | Blind half Δ | Blind full Δ | MFI half Δ | MFI full Δ |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | −5,862 | −10,103 | 0 | 0 |
| 2026-06 | 1,584 | −2,776 | −6,429 | 2,061 | −1,235 |
| 2026-07 | −3,950 | −1,117 | −972 | 1,329 | 2,637 |
| 2026-08 | 9,684 | −2,347 | −5,578 | 0 | 0 |
| 2026-09 | 112 | 476 | 1,403 | 0 | 0 |

### Recent confirmed

| Month | Baseline MTM | Blind half Δ | Blind full Δ | MFI half Δ | MFI full Δ |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | −5,628 | −7,102 | 0 | 0 |
| 2026-06 | −2,243 | −4,436 | −5,534 | 5,047 | 4,542 |
| 2026-07 | −7,858 | 516 | −1,894 | 7 | 15 |
| 2026-08 | 10,239 | −1,923 | −4,802 | 0 | 0 |
| 2026-09 | −1,429 | −1,013 | 1,873 | 0 | 0 |

### Published touch

| Month | Baseline MTM | Blind half Δ | Blind full Δ | MFI half Δ | MFI full Δ |
|---|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | 1,254 | 606 | −1,009 | −804 |
| 2025-08 | 561 | −1,312 | −7,516 | −452 | 1,156 |
| 2025-09 | 5,608 | −1,802 | −899 | −337 | −441 |
| 2025-10 | 7,325 | 2,148 | 4,813 | 0 | 0 |
| 2025-11 | −1,443 | −735 | −1,090 | −869 | −1,357 |
| 2025-12 | −509 | 718 | 1,436 | 0 | 0 |
| 2026-01 | −246 | −3,467 | −8,922 | −622 | −173 |
| 2026-02 | 4,940 | −6,273 | −5,553 | 473 | 2,544 |
| 2026-03 | 11,159 | −2,334 | −2,759 | −932 | 1,389 |
| 2026-04 | 2,065 | 275 | −927 | −764 | −305 |
| 2026-05 | 15,753 | −6,044 | −13,071 | −1,140 | −4,321 |
| 2026-06 | 1,584 | −2,776 | −6,429 | 2,061 | −1,235 |
| 2026-07 | −3,950 | −1,117 | −972 | 1,329 | 2,637 |
| 2026-08 | 1,317 | 0 | 0 | 0 | 0 |

### Published confirmed

| Month | Baseline MTM | Blind half Δ | Blind full Δ | MFI half Δ | MFI full Δ |
|---|---:|---:|---:|---:|---:|
| 2025-07 | −3,050 | 2,557 | 3,132 | 524 | 4,045 |
| 2025-08 | 1,420 | −1,608 | −9,252 | −88 | 2,323 |
| 2025-09 | 6,247 | −2,885 | −2,968 | −481 | −641 |
| 2025-10 | 7,167 | 125 | 2,445 | 0 | 0 |
| 2025-11 | −688 | −1,374 | −612 | −1,791 | −1,986 |
| 2025-12 | 673 | 642 | 1,285 | 0 | 0 |
| 2026-01 | −8,750 | 1,658 | 2,842 | 330 | 660 |
| 2026-02 | −6,255 | 1,769 | 519 | 1,689 | 5,459 |
| 2026-03 | 12,689 | −2,510 | 108 | 0 | 0 |
| 2026-04 | 2,401 | 2,058 | 496 | 253 | 505 |
| 2026-05 | 15,721 | −5,025 | −5,317 | −1,147 | 182 |
| 2026-06 | −2,243 | −4,436 | −5,534 | 5,047 | 4,542 |
| 2026-07 | −7,858 | 516 | −1,894 | 7 | 15 |
| 2026-08 | 2,017 | 0 | 0 | 0 | 0 |

## Delay, costs and concentration

Additional60s source delay leaves all eight MFI case economics unchanged. This is a useful boundary check, not evidence from another regime. Additional60s exit execution changes recent MFI-half net to **$24,356/$20,863**, still above their unchanged **$20,914/$15,839** controls; DD remains20.10%/26.10%. The older touch failure remains: half net$44,506, DD31.98%, versus baseline$46,832/28.17%.

Fixed-path extra5bps per entry/exit side preserves recent MFI-half improvement at **+$3,388/+$5,051**. This is a cost sensitivity on resulting paths, not a full affordability rerun or proof of actual maker fees/funding. Full recent MFI improvement after that stress is+$1,121/+$4,111. All cases/delays are retained in the detailed tables, not just the winner.

MFI half's recent touch outcome has three positive and three negative changes; confirmed has three positive and one negative. Its largest two savings are$2,557/$2,123 touch and$3,082/$2,381 confirmed. There is no post-July13 intervention in the recent paths, and no untouched holdout. The MFI bin was selected after **109 P01 descriptive bins** on already-inspected history. This is exploratory evidence, not a stable causal forecast or statistical certification.

## Verdict and scope of the finding

Frozen screen: recent net gain>=$1,000 in both TP models; nonnegative published net change; no DD increase; no month worse than baseline by more than$250; no modeled insolvency. **0/4 passes.**

| Candidate | What passes | What fails | Disposition |
|---|---|---|---|
| Unfiltered half | Some older DD reduction | Net in every window/model; recent DD/months | Rejected as an upgrade under this exact rule |
| Unfiltered full | More TP cycles in some paths | Much larger losing dollars/net damage, monthly failures | Rejected as an upgrade under this exact rule |
| MFI half | Both recent net/DD/monthly screens and delay/cost checks | Published touch net/DD; older monthly costs in both models; thin early sample | Retain as a **regime-specific research lead**, not deployable |
| MFI full | Both recent net/DD; strong published confirmed net | Published touch net/DD; multiple months, including recent touch June | No promotion; half is cleaner recent evidence |

The result is **not “nothing can reduce losses.”** Selective reduction demonstrably reduces damage in these June/July episodes after charging fees and lost recoveries. It is also not “MFI<=20 is a safe exit everywhere.” Oversold volume conditions can precede either continuation down or the recovery the ladder needs.

The useful next question, if authorized, is what existing as-of context distinguishes the older MFI false positives from the recent beneficial reductions. Compare those counterexamples before defining a new regime gate; do not infer a profitable live condition from calendar dates or widen MFI to fit today's ladder. No additional rules were searched in this pass, and forward observation would still be required before a deployment proposal.

## Verification, implementation boundary and files

- Added an optional **research-only** reduction hook to `scripts/replay-causal-engine.ts` and narrow independent-auditor support for labeled pro-rata/delayed experimental reductions. No `src/bot/` policy, live config or state edits.
- All four B17 baseline digests and independent accounting exactly reproduce accepted L09 controls; the recent baseline checkpoint/MFI values also match P01.
- All44 cases are independently re-accounted from raw minute prices and saved inventory: **272,943 fills /16,751,636 minute marks /2,610 independent MFI reconstructions /1,331 experimental fills across overlapping model/sensitivity cases**.
- Tested no-op identity, source boundaries, future mutation/prefix, missing bars, first checkpoint/episode identity, cutoff, next-open/delayed fills, partial qty/cost/fees/clock, no rebuilding after a later S/R trim, existing exit priority and forced-close cooldown.
- Normal and VPS typechecks, explicit research typecheck, F02 unit/integration, current-stack replay, replay causality, volume-flow, component, sizing and P01 suites passed. `git diff --check` passed; no protected input/state/config/source mutation during the run.
- No exact live execution/liquidation/funding-settlement certification. Market fees are modeled at the accepted0.055% rate, not the live maker-fill mix. No live changes, commit, push or VPS action.

Preserved study: [frozen card](../research-inputs/mfi-distress-exit-2026-09-09.json), [method and commands](../docs/research/mfi-distress-exit.md), [runner](../scripts/hype-mfi-distress-exit-study.ts), [independent checker](../scripts/mfi-distress-exit-check.ts).

Generated local artifacts: `backtests/hype/hype-mfi-distress-exit-2026-09-09/`.

- [All W/L/month/delay tables](../backtests/hype/hype-mfi-distress-exit-2026-09-09/tables.md).
- [Full monthly CSV](../backtests/hype/hype-mfi-distress-exit-2026-09-09/monthly.csv) and `overview.csv`.
- `results.json`, `comparisons.json`, `ranking.json`: every result, entry-matched attribution and screen failure.
- Per-case `*-inventory.jsonl`, `*-observations.json`, close/partial CSVs and summaries.
- `execution-traces.json`: source evidence and decision/actual next-open inventory transitions. Example: Jun4 07:50UTC uses MFI17.6969 from the bar ending07:30, trims411.8893 of823.7785qty at the **07:50 next-open $68.59**, and preserves the last-add clock. The eventual bar low/close do not decide that fill.
- `manifest.json`, `baseline-parity.json`, `validation.json`, `verification.json`: hash lineage, admitted research-only source extensions, exact controls and independently checked output hashes.
