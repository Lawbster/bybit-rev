# L11: near-high ladder blocks and stale exits — September 10, 2026

## TL;DR

- Tested **12 frozen rules / 78 executions**, with **six exact unchanged B17 controls**: rolling 24h/7d/30d highs × 1%/2% proximity × deep-add block or 4-hour-old full exit. Independently verified every high, add permission, occupied exit decision and ledger. **0/12 passes the complete screen; no live change.**
- **Weekly/monthly 2% stale exits are recent-period research leads**, not deployment candidates. Both improve recent net/DD in both TP models and survive source60 unchanged. Their older-period performance and monthly losses fail the screen; the monthly rule has only 20/19 recent affected episodes.
- The copied live ladder really did build near a known high: rung 10 paid $88.87 and rung 11 $88.62 against $89.61, already known beforehand. That selected n=1 example validates the location observation, not a top predictor or counterfactual profit claim.

## The exact question tested

“Near high” means a trailing, fully observed high, NOT the eventual high of a
calendar day/week/month. Action A blocks otherwise-permitted **rungs 8–11**,
timer and true price-drop alike. It never blocks initial or shallow entries.
Action B closes **at any depth** once the oldest surviving rung is at least 4h
old AND price is currently near the high. No loss-only/PnL floor. No combined
block-and-exit rule. No indicator, HL or new S/R condition was fitted afterward.

The stale exit is next-minute-open market execution plus the existing **4–8h
post-flatten cooldown**. Existing TP, hard/emergency and S/R-partial priorities
stay intact. It is not a same-bar-high exit, nor an isolated price-level benefit
without the subsequent cooldown/replacement costs.

[Exact method](../docs/research/near-high-ladder-l11.md) /
[frozen card](../research-inputs/near-high-ladder-2026-09-10.json).

## Baseline and evidence dates

B17 is the corrected current long stack: $800 × 1.35, max 11, current gates,
damaged latch, S/R partials/support reopen, existing 4h soft-stale target and
hard/emergency exits. $32,000 starting modeled equity, unchanged **0.055% fees
each side**, long-only. These are modeled dollars, NOT live account returns.
No maker uplift, funding settlement, shared-account or liquidation certification.

- **Recent:** May 17, 2026 20:43 → September 10, 2026 **05:08 UTC**.
- **Published:** July 1, 2025 00:00 → August 19, 2026 21:32 UTC.
- Windows overlap and have already been mined; this is not untouched validation.
- The later copied runtime is September 10 **19:05 UTC**. Its later price action
  is **not included** in these economics, deliberately preserving the previous
  accepted cutoff and exact baseline comparison. Do not read this as an
  up-to-the-minute assessment of the currently open live position.

The August 20 daily-high study used the superseded replay era. Its $82,913
baseline is not an applicable economic comparator. This new pass does not
claim all 72 legacy definitions have been rerun or that any whole indicator
family is disproven.

## Two recent leads, with their baselines

Both rows below mean full exit at age ≥4h within 2% of the reference, followed by
the normal cooldown. The two TP assumptions are distinct path models, not
independent market samples or guaranteed upper/lower profit bounds.

| Recent setup | Confirmed-close TP net$ | DD% | Resting-touch TP net$ | DD% | Affected episodes confirmed/touch |
|---|---:|---:|---:|---:|---:|
| Unchanged B17 | 15,812 | 31.11 | 20,887 | 24.69 | — |
| Weekly-high stale exit | 25,102 | 23.50 | 23,054 | 19.58 | 34/33 |
| Monthly-high stale exit | 22,135 | 30.71 | 24,259 | 19.58 | 20/19 |

The monthly rule has the larger minimum recent dollar improvement across the
two models; the weekly rule cuts confirmed-model DD much more. Neither
dominates every objective.

| Published setup | Confirmed-close TP net$ | DD% | Resting-touch TP net$ | DD% |
|---|---:|---:|---:|---:|
| Unchanged B17 | 19,490 | 45.65 | 46,832 | 28.17 |
| Weekly-high stale exit | 3,285 | 62.06 | 38,206 | 31.95 |
| Monthly-high stale exit | 13,830 | 48.15 | 46,001 | 27.55 |

That older result is not a rounding/fee issue. Weekly net deteriorates by
$16,205/$8,626; monthly by $5,660/$832. Even recent May and August become
materially worse. Monthly 2% has **no improvement in July** in either model:
the July baseline is −$7,858 confirmed /−$3,950 touch and remains so. A
monthly-high rule is not a general remedy for sustained selling far below highs.

## What the recent improvement consists of

Recent resting-touch model, where both selected variants end with the same
different unfinished inventory:

| Dollars / cycles | Baseline | Weekly2% exit | Monthly2% exit |
|---|---:|---:|---:|
| Winning episodes / losing episodes | 295/10 | 269/14 | 273/12 |
| Winning episode dollars | 57,130 | 48,916 | 50,411 |
| Losing episode dollars | −33,009 | −24,552 | −24,842 |
| Completed-episode net | 24,121 | 24,364 | 25,568 |
| Partial profit in unfinished episode | 0 | 413 | 413 |
| Open net mark | −3,234 | −1,723 | −1,723 |
| Total net | 20,887 | 23,054 | 24,259 |
| TP cycles | 295 | 241 | 257 |

Weekly sacrifices **$8,214** of winning dollars while avoiding **$8,457** of
losing dollars: only **$243** more completed-episode profit. Monthly sacrifices
$6,720 while avoiding $8,167: **$1,447** more completed-episode profit. In each,
another **$1,925** improvement comes from the open mark plus unfinished partial
profit. The latter includes $413 already realized on an unfinished episode;
it is not all unbooked, nor is it all completed-cycle profit.

Confirmed-model improvements also include **$3,220** from different end
inventory, alongside completed-episode improvements of $6,071 weekly and
$3,103 monthly. Final ladders remain censored: they can recover or deteriorate.

Full occupancy accounting matters. Match completed episodes by ORIGINAL entry
timestamp (not shifted episode IDs); removed/replacement rows are different
subsequent opportunities, not the same trade with a better exit:

| Recent model / rule | Matched episode delta$ | Removed baseline episodes / net$ | Replacement episodes / net$ | Open + unfinished delta$ | Total delta$ |
|---|---:|---:|---:|---:|---:|
| Confirmed / weekly2% | 12,477 | 94 /11,286 | 86 /4,880 | 3,220 | 9,290 |
| Touch / weekly2% | −2,635 | 106 /10,726 | 84 /13,604 | 1,925 | 2,168 |
| Confirmed / monthly2% | 7,024 | 75 /12,321 | 63 /8,401 | 3,220 | 6,323 |
| Touch / monthly2% | −1,425 | 78 /7,346 | 58 /10,219 | 1,925 | 3,372 |

Total = matched delta − removed net + replacement net + open/unfinished delta.
In touch, matched original-entry episodes actually lose value; replacement
cycling and final inventory supply the improvement. Therefore this is **not
yet evidence of a reliable direct “bad ladder → better exit” classifier**.

Both selected rules' recent results are numerically unchanged with high-source
availability delayed60s. A fixed-path extra5bps turnover-cost sensitivity leaves
their recent incremental net positive: weekly $8,544 confirmed/$2,761 touch,
monthly $5,981/$3,884. That is a cost stress, **not** a new slippage/occupancy
replay or a maker-fee estimate.

## Live-location example, separated from economic selection

Read-only copied-state diagnostic:
[scripts/near-high-entry-location.ts](../scripts/near-high-entry-location.ts).
The $89.61 high was known at **September 6 12:29 UTC**, before all these entries;
it was the same maximum in the trailing day, week and month.

| Retained rung | Recorded entry UTC on September 6 | Paid price$ | Below already-known high | Last closed-minute price$ | Closed-minute distance |
|---|---|---:|---:|---:|---:|
| 8 | 14:32:20 | 88.1300 | 1.65% | 88.46 | 1.28% |
| 9 | 15:02:27 | 88.5700 | 1.16% | 88.36 | 1.39% |
| 10 | 15:32:38 | 88.8700 | 0.83% | 88.82 | 0.88% |
| 11 | 15:35:28 | 88.6200 | 1.10% | 88.81 | 0.89% |

Paid fill price was not known before ordering. The closed-minute observation
is also not a reconstruction of the bot's exact intraminute quote/decision.
Changing an earlier add changes all later exposure and opportunities; do not
simply delete rung 11 from the live ledger and call its later loss “saved.”

Copied state SHA256:
`34ff287c91642eec4308bef29389045631a32ec0b22a53a01665442fc2f9145e`.
Runtime SHA256:
`ba2891cfed830b8e53b5f2ee6a80c9f9c9193c28a48d1eef2fc743db8aa69982`.
This is a selected, unfinished **n=1** example, not aggregate qualification.

## Interpretation and unexplored boundary

- **Blanket location blocks do not establish an upgrade here.** They also block
  strong continuations. Once price drops beyond the band, they allow deep adds
  again: they can delay exposure into a selloff rather than cap it permanently.
- **Stale exits near weekly/monthly highs retain a specific recent lead**, with
  real lost winning dollars and cooldown effects. Older/regime/month failures
  prevent promotion; “0/12 qualifies” is not “the whole idea has no value.”
- A closer translation of the user's intuition would distinguish **rejection
  or failed recovery at the high** from a healthy breakout. Another precise
  question is whether an add moves the needed TP beyond a known high. Neither
  was tested here. These require separate frozen definitions and the same
  baseline comparisons, not a hindsight filter attached to this run's winners.
- Also untested: initial/shallow-entry blocks, other widths/ages, arming on
  near-high construction and retaining that warning after price leaves the
  band, different cooldowns, calendar-session references, combined action
  rules, and indicator/HL confirmation. No claim to exhaust these families.
- No proposed live change or automatic follow-on sweep. Forward observation and
  separate authorization would still be required for an eventual candidate.

## Verification and reproduction

Accepted job:
`b0dcc6239181759af5bfc0d68eb0e00ced29ebabda91a1767d30929b7bf50e31`.
Definition identity:
`ba07dd41f828de3a37a358881d1afbba13ee56b90534a1049c88a33462bcd53d`.

Outputs: `backtests/research-workflow/<key>/output/`.
They include all 78 results, comparisons, ranking, monthly/overview CSVs, first
intervention traces, every add/reduction decision, actual inventory ledgers,
and the three frozen rolling-high index tapes. Plan/state/artifact hashes and
independent verification sit in the job root.

Independent verifier passed **2,725,962 rolling-high checks, 433,701 add
permissions, 6,079,408 occupied exit decisions, 365,997 fills and 24,167,048
minute marks**. Six baseline digests, metrics and independent accounting match
exactly. No unknown-source actions occurred. No protected production source,
live config or runtime state mutation.

Concrete timing trace: **July 2, 2025 22:36 UTC**, rung 8 timer opportunity at
$40.246; trailing 24h high $40.272 was already known at 22:35. Distance 0.06456%.
Only bars closed by 22:36 contribute. The next-open execution phase, not the
known high, determines any eventual fill. Independent prefix/suffix maxima
verify every worker monotonic-queue result; synthetic future poisoning and
prefix truncation checks also pass.

Tests/builds: near-high unit suite, existing research workflow/relative tests,
current-stack causal replay suite, root and VPS TypeScript typechecks, focused
research TypeScript check, independent L11 verifier, artifact verification,
and diff whitespace check. No production bot/config changes, commit or push.

## Complete primary comparisons

W/L counts completed episodes, with any S/R partial profits included in the episode. Win$/Loss$ are completed winning/losing episode sums, not gross-before-fee trades. Net also includes the remaining open mark and any partial PnL in an unfinished episode. DD is marked drawdown. No account-equity percentage uplift is implied.

### published_window-close_confirmed

2025-07-01T00:00:00.000Z through 2026-08-19T21:32:00.000Z.

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 788/60 | 190,819 | -171,329 | 0 | 0 | 19,490 | 0 | 45.65 | 0 |
| exit_1d_2pct | 748/145 | 155,214 | -113,289 | 0 | 0 | 41,924 | 22,435 | 24.75 | 266 |
| exit_1d_1pct | 785/99 | 177,314 | -137,231 | 0 | 0 | 40,084 | 20,594 | 29.25 | 149 |
| block_30d_2pct | 796/58 | 191,396 | -171,347 | 0 | 0 | 20,049 | 560 | 43.41 | 45 |
| block_30d_1pct | 787/61 | 190,032 | -171,596 | 0 | 0 | 18,437 | -1,053 | 46.65 | 20 |
| exit_7d_1pct | 767/62 | 183,564 | -166,862 | 0 | 0 | 16,702 | -2,788 | 52.36 | 45 |
| exit_30d_1pct | 785/58 | 187,249 | -171,321 | 0 | 0 | 15,928 | -3,562 | 47.52 | 14 |
| block_1d_2pct | 843/58 | 177,069 | -161,206 | 0 | 0 | 15,863 | -3,627 | 52.04 | 281 |
| block_7d_1pct | 797/61 | 187,503 | -171,928 | 0 | 0 | 15,575 | -3,915 | 48.56 | 64 |
| block_1d_1pct | 804/60 | 184,845 | -169,491 | 0 | 0 | 15,354 | -4,136 | 50.83 | 131 |
| block_7d_2pct | 811/58 | 182,935 | -167,796 | 0 | 0 | 15,139 | -4,351 | 50.24 | 144 |
| exit_30d_2pct | 744/76 | 179,776 | -165,946 | 0 | 0 | 13,830 | -5,660 | 48.15 | 38 |
| exit_7d_2pct | 719/101 | 167,883 | -164,598 | 0 | 0 | 3,285 | -16,205 | 62.06 | 102 |

Monthly MTM: block. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | block_30d_2pct delta$ | block_30d_1pct delta$ | block_1d_2pct delta$ | block_7d_1pct delta$ | block_1d_1pct delta$ | block_7d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | -3,050 | 653 | -300 | 4,561 | -790 | -2,133 | -227 |
| 2025-08 | 1,420 | 186 | 0 | -2,317 | -942 | -2,185 | -1,992 |
| 2025-09 | 6,247 | 1,729 | -766 | 2,582 | -454 | 2,064 | 1,843 |
| 2025-10 | 7,167 | 0 | 0 | -679 | -807 | -627 | -309 |
| 2025-11 | -688 | 0 | 0 | -1,579 | 0 | -84 | -633 |
| 2025-12 | 673 | 0 | 0 | -595 | 0 | -204 | -396 |
| 2026-01 | -8,750 | 0 | 0 | -1,185 | 4 | -67 | -570 |
| 2026-02 | -6,255 | 0 | 0 | -1,634 | 0 | -759 | 0 |
| 2026-03 | 12,689 | -543 | -22 | -894 | -22 | -101 | -885 |
| 2026-04 | 2,401 | -107 | 33 | -3,523 | -2,547 | -2,941 | -1,337 |
| 2026-05 | 15,721 | -496 | 76 | -32 | -314 | -80 | -367 |
| 2026-06 | -2,243 | -596 | -75 | -594 | -223 | -291 | -655 |
| 2026-07 | -7,858 | 0 | 0 | 3,166 | 2,472 | 3,565 | 2,084 |
| 2026-08 | 2,017 | -267 | 0 | -905 | -291 | -291 | -905 |

Monthly MTM: exit. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | exit_1d_2pct delta$ | exit_1d_1pct delta$ | exit_7d_1pct delta$ | exit_30d_1pct delta$ | exit_30d_2pct delta$ | exit_7d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | -3,050 | 7,551 | 5,552 | -1,610 | -243 | -819 | 379 |
| 2025-08 | 1,420 | -3,729 | 82 | 841 | 0 | -520 | -1,563 |
| 2025-09 | 6,247 | -1,170 | -2,014 | -1,607 | -1,716 | -1,244 | -1,889 |
| 2025-10 | 7,167 | -3,362 | -2,506 | -1,630 | 0 | 0 | -3,078 |
| 2025-11 | -688 | 1,358 | 1,403 | 0 | 0 | 0 | -522 |
| 2025-12 | 673 | 1,173 | 219 | -607 | 0 | 0 | -2,378 |
| 2026-01 | -8,750 | 11,138 | 6,041 | -632 | 0 | 0 | -2,472 |
| 2026-02 | -6,255 | 7,905 | 7,221 | 0 | 0 | 0 | 0 |
| 2026-03 | 12,689 | 900 | 3,827 | -545 | -545 | -2,101 | -2,737 |
| 2026-04 | 2,401 | -600 | 140 | -1,510 | -121 | -378 | -5,319 |
| 2026-05 | 15,721 | -5,403 | -3,834 | -282 | -936 | -2,607 | -1,603 |
| 2026-06 | -2,243 | -1,021 | 731 | -395 | 0 | 2,010 | 3,105 |
| 2026-07 | -7,858 | 8,477 | 5,009 | 5,291 | 0 | 0 | 1,761 |
| 2026-08 | 2,017 | -780 | -1,277 | -102 | 0 | 0 | 112 |

Invisible upside / loss trade-off. Negative Win$ change means winning dollars sacrificed. Positive losses avoided means less losing dollars. Forced counts include the new research exits, not just hard flattens.

| Rule | Win$ change | Loss$ avoided | TP cycle delta | Forced close delta | Fees$ | Baseline fees$ | Worst month delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| exit_1d_2pct | -35,605 | 58,040 | -198 | 243 | 33,459 | 33,739 | -5,403 |
| exit_1d_1pct | -13,505 | 34,099 | -102 | 138 | 34,459 | 33,739 | -3,834 |
| block_30d_2pct | 578 | -18 | 8 | -2 | 33,677 | 33,739 | -596 |
| block_30d_1pct | -786 | -267 | 0 | 0 | 33,636 | 33,739 | -766 |
| exit_7d_1pct | -7,255 | 4,467 | -63 | 44 | 33,269 | 33,739 | -1,630 |
| exit_30d_1pct | -3,570 | 8 | -18 | 13 | 33,215 | 33,739 | -1,716 |
| block_1d_2pct | -13,750 | 10,123 | 55 | -2 | 31,245 | 33,739 | -3,523 |
| block_7d_1pct | -3,315 | -599 | 10 | 0 | 33,459 | 33,739 | -2,547 |
| block_1d_1pct | -5,974 | 1,838 | 16 | 0 | 32,882 | 33,739 | -2,941 |
| block_7d_2pct | -7,884 | 3,533 | 23 | -2 | 32,648 | 33,739 | -1,992 |
| exit_30d_2pct | -11,043 | 5,384 | -63 | 35 | 32,552 | 33,739 | -2,607 |
| exit_7d_2pct | -22,936 | 6,732 | -127 | 99 | 32,832 | 33,739 | -5,319 |
### published_window-resting_touch

2025-07-01T00:00:00.000Z through 2026-08-19T21:32:00.000Z.

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 955/57 | 187,738 | -140,906 | 0 | 0 | 46,832 | 0 | 28.17 | 0 |
| block_30d_1pct | 954/58 | 187,270 | -140,856 | 0 | 0 | 46,414 | -419 | 28.36 | 17 |
| block_30d_2pct | 957/56 | 186,879 | -140,563 | 0 | 0 | 46,315 | -517 | 26.88 | 47 |
| exit_30d_2pct | 927/72 | 179,888 | -133,888 | 0 | 0 | 46,001 | -832 | 27.55 | 38 |
| exit_30d_1pct | 950/58 | 185,650 | -140,693 | 0 | 0 | 44,957 | -1,875 | 28.64 | 12 |
| block_7d_1pct | 957/58 | 184,793 | -141,194 | 0 | 0 | 43,599 | -3,233 | 29.73 | 57 |
| block_1d_1pct | 959/57 | 181,173 | -141,709 | 0 | 0 | 39,464 | -7,369 | 30.24 | 132 |
| exit_1d_2pct | 897/135 | 149,542 | -111,166 | 0 | 0 | 38,376 | -8,456 | 25.28 | 256 |
| block_7d_2pct | 961/56 | 179,725 | -141,403 | 0 | 0 | 38,321 | -8,511 | 29.52 | 141 |
| exit_7d_2pct | 894/93 | 170,957 | -132,751 | 0 | 0 | 38,206 | -8,626 | 31.95 | 101 |
| exit_7d_1pct | 923/60 | 180,809 | -143,011 | 0 | 0 | 37,798 | -9,034 | 30.94 | 41 |
| exit_1d_1pct | 940/99 | 168,632 | -133,518 | 0 | 0 | 35,114 | -11,718 | 34.67 | 140 |
| block_1d_2pct | 977/56 | 168,157 | -137,810 | 0 | 0 | 30,347 | -16,486 | 35.08 | 268 |

Monthly MTM: block. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | block_30d_1pct delta$ | block_30d_2pct delta$ | block_7d_1pct delta$ | block_1d_1pct delta$ | block_7d_2pct delta$ | block_1d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | -256 | 1,943 | -608 | -2,554 | 1,211 | -1,750 |
| 2025-08 | 561 | 0 | 56 | -990 | -1,330 | -1,021 | -1,632 |
| 2025-09 | 5,608 | -103 | 617 | -313 | -102 | -229 | -475 |
| 2025-10 | 7,325 | 0 | 0 | -415 | -394 | -621 | -969 |
| 2025-11 | -1,443 | 0 | 0 | 0 | 0 | -535 | -943 |
| 2025-12 | -509 | 0 | 0 | -154 | 599 | 181 | 35 |
| 2026-01 | -246 | 0 | 0 | 0 | -376 | -183 | -1,150 |
| 2026-02 | 4,940 | 0 | 0 | 0 | -325 | 0 | -462 |
| 2026-03 | 11,159 | 0 | -923 | 0 | 852 | -1,195 | -991 |
| 2026-04 | 2,065 | 0 | -444 | -592 | -799 | -1,888 | -2,813 |
| 2026-05 | 15,753 | -60 | -137 | -403 | -3,037 | -2,509 | -2,885 |
| 2026-06 | 1,584 | 0 | -1,629 | 0 | 6 | -2,310 | -1,944 |
| 2026-07 | -3,950 | 0 | 0 | 314 | 165 | 394 | -587 |
| 2026-08 | 1,317 | 0 | 0 | -74 | -74 | 195 | 81 |

Monthly MTM: exit. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | exit_30d_2pct delta$ | exit_30d_1pct delta$ | exit_1d_2pct delta$ | exit_7d_2pct delta$ | exit_7d_1pct delta$ | exit_1d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | 44 | 580 | -3,723 | 6,416 | -314 | -4,351 |
| 2025-08 | 561 | -633 | 0 | -2,706 | -1,262 | 248 | 1,837 |
| 2025-09 | 5,608 | 2,251 | -1,465 | 774 | 327 | -2,282 | -4,213 |
| 2025-10 | 7,325 | 0 | 0 | -2,880 | -2,566 | -906 | -906 |
| 2025-11 | -1,443 | 0 | 0 | 1,923 | -17 | 0 | 2,006 |
| 2025-12 | -509 | 0 | 0 | 132 | -1,324 | 85 | -322 |
| 2026-01 | -246 | 0 | 0 | 4,471 | -1,645 | -581 | -1,603 |
| 2026-02 | 4,940 | 0 | 0 | 7,573 | 0 | 0 | 797 |
| 2026-03 | 11,159 | -2,868 | 0 | -288 | -2,871 | -2 | 6,207 |
| 2026-04 | 2,065 | -527 | -408 | 236 | -4,151 | -2,420 | -4,054 |
| 2026-05 | 15,753 | -2,982 | -582 | -9,456 | -4,212 | -2,608 | -6,788 |
| 2026-06 | 1,584 | 3,883 | 0 | -4,759 | 2,926 | -704 | 421 |
| 2026-07 | -3,950 | 0 | 0 | 1,019 | -93 | 729 | -472 |
| 2026-08 | 1,317 | 0 | 0 | -772 | -155 | -277 | -277 |

Invisible upside / loss trade-off. Negative Win$ change means winning dollars sacrificed. Positive losses avoided means less losing dollars. Forced counts include the new research exits, not just hard flattens.

| Rule | Win$ change | Loss$ avoided | TP cycle delta | Forced close delta | Fees$ | Baseline fees$ | Worst month delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| block_30d_1pct | -468 | 50 | 0 | 0 | 36,598 | 36,783 | -256 |
| block_30d_2pct | -859 | 342 | 2 | -1 | 36,149 | 36,783 | -1,629 |
| exit_30d_2pct | -7,850 | 7,018 | -50 | 37 | 36,407 | 36,783 | -2,982 |
| exit_30d_1pct | -2,088 | 213 | -16 | 12 | 36,355 | 36,783 | -1,465 |
| block_7d_1pct | -2,945 | -288 | 3 | 0 | 36,379 | 36,783 | -990 |
| block_1d_1pct | -6,565 | -804 | 4 | 0 | 35,548 | 36,783 | -3,037 |
| exit_1d_2pct | -38,196 | 29,740 | -218 | 238 | 34,442 | 36,783 | -9,456 |
| block_7d_2pct | -8,013 | -498 | 6 | -1 | 34,767 | 36,783 | -2,509 |
| exit_7d_2pct | -16,781 | 8,155 | -124 | 99 | 36,022 | 36,783 | -4,212 |
| exit_7d_1pct | -6,929 | -2,105 | -70 | 41 | 35,889 | 36,783 | -2,608 |
| exit_1d_1pct | -19,106 | 7,388 | -106 | 133 | 36,099 | 36,783 | -6,788 |
| block_1d_2pct | -19,581 | 3,095 | 22 | -1 | 32,291 | 36,783 | -2,885 |
### hl_extended-close_confirmed

2026-05-17T20:43:00.000Z through 2026-09-10T05:08:00Z.

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 243/11 | 59,238 | -40,192 | -3,234 | 0 | 15,812 | 0 | 31.11 | 0 |
| exit_7d_2pct | 223/23 | 55,221 | -30,105 | -15 | 0 | 25,102 | 9,290 | 23.50 | 34 |
| exit_30d_2pct | 224/18 | 55,448 | -33,299 | -15 | 0 | 22,135 | 6,323 | 30.71 | 20 |
| exit_7d_1pct | 246/12 | 61,236 | -36,466 | -3,236 | 0 | 21,534 | 5,723 | 21.94 | 10 |
| exit_1d_1pct | 242/25 | 55,218 | -34,491 | -15 | 0 | 20,712 | 4,901 | 24.65 | 43 |
| block_1d_2pct | 261/11 | 58,205 | -37,332 | -2,236 | 0 | 18,637 | 2,826 | 25.71 | 69 |
| block_1d_1pct | 248/11 | 58,960 | -37,472 | -3,230 | 0 | 18,258 | 2,447 | 24.18 | 27 |
| block_7d_2pct | 256/11 | 58,916 | -38,476 | -2,236 | 0 | 18,204 | 2,392 | 27.85 | 40 |
| block_7d_1pct | 247/11 | 59,819 | -38,999 | -3,230 | 0 | 17,590 | 1,779 | 26.14 | 17 |
| block_30d_2pct | 252/11 | 59,147 | -40,094 | -2,236 | 0 | 16,817 | 1,006 | 31.78 | 23 |
| exit_30d_1pct | 247/11 | 60,168 | -40,192 | -3,236 | 0 | 16,740 | 928 | 31.64 | 2 |
| exit_1d_2pct | 229/36 | 49,730 | -33,441 | -121 | 237 | 16,405 | 594 | 28.63 | 77 |
| block_30d_1pct | 243/11 | 59,207 | -40,159 | -3,230 | 0 | 15,818 | 6 | 31.11 | 6 |

Monthly MTM: block. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | block_1d_2pct delta$ | block_1d_1pct delta$ | block_7d_2pct delta$ | block_7d_1pct delta$ | block_30d_2pct delta$ | block_30d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | -332 | 76 | -436 | 76 | -436 | 76 |
| 2026-06 | -2,243 | -594 | -291 | -655 | -223 | -596 | -75 |
| 2026-07 | -7,858 | 3,166 | 3,565 | 2,084 | 2,472 | 0 | 0 |
| 2026-08 | 10,239 | -977 | -647 | -1,090 | -291 | -452 | 0 |
| 2026-09 | -1,456 | 1,561 | -256 | 2,490 | -256 | 2,490 | 5 |

Monthly MTM: exit. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | exit_7d_2pct delta$ | exit_30d_2pct delta$ | exit_7d_1pct delta$ | exit_1d_1pct delta$ | exit_30d_1pct delta$ | exit_1d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | -1,294 | -1,294 | -936 | -4,267 | -936 | -5,880 |
| 2026-06 | -2,243 | 3,105 | 2,010 | -395 | 731 | 0 | -1,021 |
| 2026-07 | -7,858 | 1,761 | 0 | 5,291 | 5,009 | 0 | 8,477 |
| 2026-08 | 10,239 | -813 | -924 | -102 | -481 | 0 | -4,975 |
| 2026-09 | -1,456 | 6,531 | 6,531 | 1,863 | 3,909 | 1,863 | 3,993 |

Invisible upside / loss trade-off. Negative Win$ change means winning dollars sacrificed. Positive losses avoided means less losing dollars. Forced counts include the new research exits, not just hard flattens.

| Rule | Win$ change | Loss$ avoided | TP cycle delta | Forced close delta | Fees$ | Baseline fees$ | Worst month delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| exit_7d_2pct | -4,017 | 10,088 | -40 | 32 | 10,599 | 9,779 | -1,294 |
| exit_30d_2pct | -3,790 | 6,893 | -30 | 18 | 10,155 | 9,779 | -1,294 |
| exit_7d_1pct | 1,998 | 3,726 | -6 | 10 | 10,552 | 9,779 | -936 |
| exit_1d_1pct | -4,020 | 5,701 | -28 | 41 | 10,293 | 9,779 | -4,267 |
| block_1d_2pct | -1,033 | 2,860 | 18 | 0 | 9,895 | 9,779 | -977 |
| block_1d_1pct | -278 | 2,720 | 5 | 0 | 10,010 | 9,779 | -647 |
| block_7d_2pct | -323 | 1,716 | 13 | 0 | 10,287 | 9,779 | -1,090 |
| block_7d_1pct | 580 | 1,194 | 4 | 0 | 10,177 | 9,779 | -291 |
| block_30d_2pct | -91 | 98 | 9 | 0 | 10,208 | 9,779 | -596 |
| exit_30d_1pct | 929 | 0 | 2 | 2 | 10,096 | 9,779 | -936 |
| exit_1d_2pct | -9,509 | 6,751 | -60 | 71 | 10,171 | 9,779 | -5,880 |
| block_30d_1pct | -31 | 33 | 0 | 0 | 9,764 | 9,779 | -75 |
### hl_extended-resting_touch

2026-05-17T20:43:00.000Z through 2026-09-10T05:08:00Z.

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 295/10 | 57,130 | -33,009 | -3,234 | 0 | 20,887 | 0 | 24.69 | 0 |
| exit_30d_2pct | 273/12 | 50,411 | -24,842 | -1,723 | 413 | 24,259 | 3,372 | 19.58 | 19 |
| exit_7d_2pct | 269/14 | 48,916 | -24,552 | -1,723 | 413 | 23,054 | 2,168 | 19.58 | 33 |
| exit_30d_1pct | 293/10 | 56,880 | -33,009 | -1,320 | 180 | 22,730 | 1,843 | 24.97 | 2 |
| exit_7d_1pct | 288/11 | 56,562 | -32,944 | -1,320 | 180 | 22,477 | 1,590 | 24.97 | 9 |
| block_7d_1pct | 296/10 | 57,536 | -33,348 | -3,230 | 0 | 20,958 | 71 | 24.72 | 9 |
| block_30d_1pct | 295/10 | 57,071 | -33,009 | -3,230 | 0 | 20,832 | -55 | 24.72 | 2 |
| block_30d_2pct | 292/10 | 54,755 | -33,009 | -1,320 | 180 | 20,605 | -282 | 26.59 | 21 |
| block_7d_2pct | 295/10 | 54,832 | -33,178 | -1,320 | 180 | 20,512 | -374 | 26.59 | 36 |
| block_1d_1pct | 298/10 | 57,070 | -33,388 | -3,229 | 0 | 20,453 | -434 | 24.80 | 23 |
| block_1d_2pct | 298/10 | 52,286 | -33,370 | -1,177 | 180 | 17,918 | -2,968 | 25.05 | 68 |
| exit_1d_1pct | 269/23 | 49,552 | -35,155 | -35 | 0 | 14,362 | -6,525 | 25.54 | 36 |
| exit_1d_2pct | 256/35 | 41,052 | -34,729 | -121 | 237 | 6,440 | -14,447 | 31.29 | 78 |

Monthly MTM: block. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | block_7d_1pct delta$ | block_30d_1pct delta$ | block_30d_2pct delta$ | block_7d_2pct delta$ | block_1d_1pct delta$ | block_1d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | -60 | -60 | -137 | -137 | -243 | -633 |
| 2026-06 | 1,584 | 0 | 0 | -1,629 | -2,310 | 6 | -1,944 |
| 2026-07 | -3,950 | 314 | 0 | 0 | 394 | 165 | -587 |
| 2026-08 | 9,684 | -74 | 0 | -681 | -487 | -273 | -843 |
| 2026-09 | 85 | -109 | 5 | 2,166 | 2,166 | -88 | 1,039 |

Monthly MTM: exit. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.

| Month | Baseline$ | exit_30d_2pct delta$ | exit_7d_2pct delta$ | exit_30d_1pct delta$ | exit_7d_1pct delta$ | exit_1d_1pct delta$ | exit_1d_2pct delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | -1,642 | -1,642 | -582 | -582 | -4,315 | -7,071 |
| 2026-06 | 1,584 | 3,883 | 2,926 | 0 | -704 | 421 | -4,759 |
| 2026-07 | -3,950 | 0 | -93 | 0 | 729 | -472 | 1,019 |
| 2026-08 | 9,684 | -1,601 | -1,756 | 0 | -277 | -1,617 | -5,643 |
| 2026-09 | 85 | 2,732 | 2,732 | 2,425 | 2,425 | -542 | 2,007 |

Invisible upside / loss trade-off. Negative Win$ change means winning dollars sacrificed. Positive losses avoided means less losing dollars. Forced counts include the new research exits, not just hard flattens.

| Rule | Win$ change | Loss$ avoided | TP cycle delta | Forced close delta | Fees$ | Baseline fees$ | Worst month delta$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| exit_30d_2pct | -6,720 | 8,167 | -38 | 18 | 10,394 | 10,957 | -1,642 |
| exit_7d_2pct | -8,214 | 8,457 | -54 | 32 | 10,304 | 10,957 | -1,756 |
| exit_30d_1pct | -251 | 0 | -4 | 2 | 11,056 | 10,957 | -582 |
| exit_7d_1pct | -568 | 65 | -15 | 9 | 11,190 | 10,957 | -704 |
| block_7d_1pct | 406 | -339 | 1 | 0 | 11,229 | 10,957 | -109 |
| block_30d_1pct | -60 | 0 | 0 | 0 | 10,947 | 10,957 | -60 |
| block_30d_2pct | -2,376 | 0 | -3 | 0 | 10,781 | 10,957 | -1,629 |
| block_7d_2pct | -2,299 | -169 | 0 | 0 | 10,946 | 10,957 | -2,310 |
| block_1d_1pct | -60 | -379 | 3 | 0 | 11,078 | 10,957 | -273 |
| block_1d_2pct | -4,845 | -361 | 3 | 0 | 10,177 | 10,957 | -1,944 |
| exit_1d_1pct | -7,579 | -2,145 | -47 | 34 | 10,357 | 10,957 | -4,315 |
| exit_1d_2pct | -16,079 | -1,719 | -88 | 74 | 9,602 | 10,957 | -7,071 |

## Source-delay sensitivity (recent window)

Rolling-high availability delayed 60 seconds; current closed price still observed. Same economic window, starting capital, fees and TP model.

| Model | Rule | Baseline net$ | Primary net$ | Source60 net$ | Baseline DD% | Primary DD% | Source60 DD% |
|---|---|---:|---:|---:|---:|---:|---:|
| hl_extended-close_confirmed | block_1d_1pct | 15,812 | 18,258 | 18,258 | 31.11 | 24.18 | 24.18 |
| hl_extended-resting_touch | block_1d_1pct | 20,887 | 20,453 | 20,447 | 24.69 | 24.80 | 24.80 |
| hl_extended-close_confirmed | block_1d_2pct | 15,812 | 18,637 | 18,637 | 31.11 | 25.71 | 25.71 |
| hl_extended-resting_touch | block_1d_2pct | 20,887 | 17,918 | 17,918 | 24.69 | 25.05 | 25.05 |
| hl_extended-close_confirmed | block_7d_1pct | 15,812 | 17,590 | 17,590 | 31.11 | 26.14 | 26.14 |
| hl_extended-resting_touch | block_7d_1pct | 20,887 | 20,958 | 20,958 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_7d_2pct | 15,812 | 18,204 | 18,204 | 31.11 | 27.85 | 27.85 |
| hl_extended-resting_touch | block_7d_2pct | 20,887 | 20,512 | 20,512 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | block_30d_1pct | 15,812 | 15,818 | 15,818 | 31.11 | 31.11 | 31.11 |
| hl_extended-resting_touch | block_30d_1pct | 20,887 | 20,832 | 20,832 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_30d_2pct | 15,812 | 16,817 | 16,817 | 31.11 | 31.78 | 31.78 |
| hl_extended-resting_touch | block_30d_2pct | 20,887 | 20,605 | 20,605 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | exit_1d_1pct | 15,812 | 20,712 | 20,710 | 31.11 | 24.65 | 24.65 |
| hl_extended-resting_touch | exit_1d_1pct | 20,887 | 14,362 | 14,360 | 24.69 | 25.54 | 25.54 |
| hl_extended-close_confirmed | exit_1d_2pct | 15,812 | 16,405 | 16,458 | 31.11 | 28.63 | 28.63 |
| hl_extended-resting_touch | exit_1d_2pct | 20,887 | 6,440 | 6,493 | 24.69 | 31.29 | 31.29 |
| hl_extended-close_confirmed | exit_7d_1pct | 15,812 | 21,534 | 21,534 | 31.11 | 21.94 | 21.94 |
| hl_extended-resting_touch | exit_7d_1pct | 20,887 | 22,477 | 22,477 | 24.69 | 24.97 | 24.97 |
| hl_extended-close_confirmed | exit_7d_2pct | 15,812 | 25,102 | 25,102 | 31.11 | 23.50 | 23.50 |
| hl_extended-resting_touch | exit_7d_2pct | 20,887 | 23,054 | 23,054 | 24.69 | 19.58 | 19.58 |
| hl_extended-close_confirmed | exit_30d_1pct | 15,812 | 16,740 | 16,740 | 31.11 | 31.64 | 31.64 |
| hl_extended-resting_touch | exit_30d_1pct | 20,887 | 22,730 | 22,730 | 24.69 | 24.97 | 24.97 |
| hl_extended-close_confirmed | exit_30d_2pct | 15,812 | 22,135 | 22,135 | 31.11 | 30.71 | 30.71 |
| hl_extended-resting_touch | exit_30d_2pct | 20,887 | 24,259 | 24,259 | 24.69 | 19.58 | 19.58 |

## Primary qualification

| Rule | Pass | Failed dimensions |
|---|---|---|
| block_1d_1pct | false | net, drawdown, monthly |
| block_1d_2pct | false | net, drawdown, monthly |
| block_7d_1pct | false | net, drawdown, monthly, thin |
| block_7d_2pct | false | net, drawdown, monthly |
| block_30d_1pct | false | net, drawdown, monthly, thin |
| block_30d_2pct | false | monthly, net, drawdown |
| exit_1d_1pct | false | monthly, net, drawdown |
| exit_1d_2pct | false | monthly, net, drawdown |
| exit_7d_1pct | false | net, drawdown, monthly, thin |
| exit_7d_2pct | false | net, drawdown, monthly |
| exit_30d_1pct | false | net, drawdown, monthly, thin |
| exit_30d_2pct | false | net, drawdown, monthly, thin |
