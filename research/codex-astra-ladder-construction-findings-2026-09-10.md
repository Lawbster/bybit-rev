# L10: ladder construction controls — economic findings

September10,2026. Local research. No live code/config, canonical engine, order,
signal, deployment, commit or push changes.

## TL;DR

- **0/6 frozen construction variants passes the complete screen.**38 economic
  paths including six exact baseline controls. Every recent variant earns less
  net than unchanged B17 in both TP models. Both time-based and genuine
  price-drop adds are included; no new exit was bundled into these changes.
- The closest recent defensive trade-off is underwater cap9: touch net
  **$20,887 → $20,214**, DD **24.69% → 20.08%**. But confirmed net
  **$15,812 → $5,827**, DD **31.11% → 42.27%**. It is not robust.
- Broader ATR spacing removes substantial losing dollars but also more winning
  dollars. Delaying rebuilding after S/R partials also fails. This does not
  prove the current stack globally optimal or rule out genuine level/flow
  rejection; these particular broad controls do not automate that distinction.

## Exact scope and baseline

[RR03 recovery diagnostic](codex-astra-recovery-trajectory-findings-2026-09-10.md)
ran first. Its market-relative failed-reclaim categories did not consistently
distinguish damaging continuation. No category was opportunistically attached
to construction after seeing those results.

[Method](../docs/research/recovery-construction-rr03-l10.md) /
[frozen study card](../research-inputs/recovery-construction-2026-09-10.json).

B17 baseline is the current modeled long stack: starts flat with **$32,000**,
**$800 x1.35, max11**, current gates, damaged latch, S/R partials/support actions,
ordinary1.4% TP and existing conditional4h/0.5% soft-stale, hard/emergency/funding
exits. Short entries are not included. Fees remain **0.055% each side**, as agreed.
No maker-fee uplift or eight-hour TP variant in this batch.

- Published window: **2025-07-01 00:00 → 2026-08-19 21:32 UTC**.
- Recent window: **2026-05-17 20:43 → 2026-09-10 05:08 UTC**.
- Separate flat starts, already examined and overlapping history, not independent
  holdouts. September is partial and includes a marked-open ladder.
- Resting touch and close-confirmed are different causal TP execution assumptions,
  not guaranteed best/worst bounds for live maker TP. Market decisions fill at
  the next minute open; a newly computed target cannot fill on the preceding high.

Completed W/L and winning/losing dollars include each episode's partial
realizations. **Net includes open mark and any unfinished-episode partial cash.**
Rounding may prevent visible columns adding exactly. A positive partial can
make a forced-close episode profitable, so forced count and loss count differ.

## The six rules

All six only veto otherwise-approved, baseline-affordable adds. Clip sizes,
actual add clock, remaining inventory, ordinary exits and outer gates are unchanged.

| ID | What it does |
|---|---|
| spacing_atr_half | From next rung8, require a drop from the last surviving rung's entry of max(0.3%,0.5x last completed1h ATR14) |
| spacing_atr_one | Same,1x ATR14 |
| underwater_cap8 | While gross ladder mark<=-1%, prevent next-depth>=8 adds taking entry cost above fresh eight-rung cost |
| underwater_cap9 | Same, fresh nine-rung cost |
| post_trim_wait60 | Wait60m after an actual S/R partial before the first subsequent add, at any depth |
| post_trim_pullback | First post-trim add waits for price0.3% below actual trim fill, or4h since the fill |

Budget ceilings are approximately **$22,931 / $31,757** of entry cost, not market
value, exchange margin, a stop loss or a guarantee of maximum loss. Original
permissions return when the gross mark exceeds-1%. No clipping or forced sale.

The post-trim anchor clears on an actual subsequent open/full close, not merely
a signal. Another partial replaces it. ATR rules require a healthy closed hour;
unknown ATR blocks the deep add and is counted separately. The final runs have
no unknown-ATR vetoes (see machine-readable counts).

## What the costs actually mean

Recent touch cap9 avoids **$4,243** in losing dollars, but sacrifices **$4,916**
in winning dollars and captures11 fewer TP cycles. Net loses$672, with one
additional forced close. It is a real trade-off, not a clean improvement.

Recent touch half-ATR avoids$4,651 in losing dollars while sacrificing$14,947
of winning dollars. It captures41 MORE TP cycles, but they collectively earn
less. Frequency alone does not tell us whether a safer-looking ladder pays.

The published confirmed half-ATR case is genuinely attractive in isolation:
net$19,490 → $21,579, DD45.65% →24.04%, losing dollars reduced$58,912 versus
$56,823 of winning dollars sacrificed. But it fails the other primary models
and loses$11,378 versus baseline in March2026. That benefit is preserved here,
not erased by its failure to qualify.

### One causal decision trace

First recent cap9 veto, **May17 23:19 UTC**, next rung10:

- Closed-minute price$45.568; existing average$46.1512; gross mark-1.2636%.
- Existing entry cost$31,757.13, exactly the nine-rung cap. The otherwise-approved
  $11,915 clip would breach it, so the new rule vetoes.
- The unchanged baseline fills that next-minute open at$45.568 and reduces its
  average to$45.9906. The vetoed path retains the higher average and smaller size.
- Thus preventing an add has two effects: less exposure if the fall continues,
  but more rebound needed to exit the retained inventory. Later inventory and
  episode replacement can amplify either effect. No future candle enters the veto.

This illustrates the mechanism; full-period tables, not this single example,
determine the verdict.

## Full results — ranked separately inside each window/model

The following tables are rendered from accepted artifacts, with baseline first.
Monthly columns are **delta versus the adjacent baseline**, not variant totals.

### published_window-close_confirmed

2025-07-01T00:00:00.000Z → 2026-08-19T21:32:00.000Z

| Policy | W / L | Win$ | Loss$ | Open$ | Net$ | Δ net$ | DD% | Intervened episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 788 / 60 | 190,819 | -171,329 | 0 | 19,490 | 0 | 45.65 | 0 |
| spacing_atr_half | 894 / 54 | 133,996 | -112,418 | 0 | 21,579 | 2,089 | 24.04 | 566 |
| post_trim_pullback | 783 / 58 | 186,774 | -167,544 | 0 | 19,230 | -260 | 40.95 | 112 |
| spacing_atr_one | 804 / 53 | 100,490 | -84,687 | 0 | 15,804 | -3,686 | 22.49 | 500 |
| underwater_cap8 | 735 / 61 | 165,443 | -153,503 | 0 | 11,940 | -7,550 | 36.68 | 139 |
| post_trim_wait60 | 770 / 60 | 181,679 | -172,273 | 0 | 9,406 | -10,084 | 46.67 | 125 |
| underwater_cap9 | 742 / 61 | 169,416 | -161,594 | 0 | 7,823 | -11,667 | 40.02 | 111 |

| Month | Baseline$ | spacing_atr_half Δ$ | post_trim_pullback Δ$ | spacing_atr_one Δ$ | underwater_cap8 Δ$ | post_trim_wait60 Δ$ | underwater_cap9 Δ$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | -3,050 | 4,596 | 4,661 | 5,157 | 5,689 | -99 | -89 |
| 2025-08 | 1,420 | -3,087 | 296 | -195 | -1,737 | -999 | -232 |
| 2025-09 | 6,247 | -2,446 | 31 | -3,066 | -1,291 | -660 | -1,436 |
| 2025-10 | 7,167 | 952 | -266 | -2,820 | 854 | -821 | -87 |
| 2025-11 | -688 | 20 | 583 | -139 | 1,107 | 653 | 1,004 |
| 2025-12 | 673 | -2,044 | -150 | -989 | -305 | 80 | 179 |
| 2026-01 | -8,750 | 10,263 | 21 | 11,740 | 2,565 | 346 | 2,694 |
| 2026-02 | -6,255 | 13,777 | -872 | 8,932 | 3,314 | -1,160 | -1,511 |
| 2026-03 | 12,689 | -11,378 | -1,470 | -10,845 | -7,014 | -3,670 | -8,502 |
| 2026-04 | 2,401 | -3,401 | -681 | -6,465 | 3,746 | -815 | 3,923 |
| 2026-05 | 15,721 | -4,656 | -1,772 | -5,630 | -6,476 | -2,350 | -2,061 |
| 2026-06 | -2,243 | -2,769 | -1,666 | -3,723 | -8,122 | -1,319 | -5,670 |
| 2026-07 | -7,858 | 3,033 | -200 | 5,373 | 0 | -273 | 0 |
| 2026-08 | 2,017 | -772 | 1,225 | -1,017 | 121 | 1,004 | 121 |

| Policy | Win$ change | Loss$ avoided | TP cycle Δ | Forced close Δ | Worst monthly Δ$ |
|---|---:|---:|---:|---:|---:|
| spacing_atr_half | -56,823 | 58,912 | 107 | -7 | -11,378 |
| post_trim_pullback | -4,045 | 3,785 | -6 | -1 | -1,772 |
| spacing_atr_one | -90,329 | 86,643 | 18 | -9 | -10,845 |
| underwater_cap8 | -25,376 | 17,826 | -53 | 1 | -8,122 |
| post_trim_wait60 | -9,140 | -944 | -18 | 0 | -3,670 |
| underwater_cap9 | -21,403 | 9,736 | -45 | 0 | -8,502 |

### published_window-resting_touch

2025-07-01T00:00:00.000Z → 2026-08-19T21:32:00.000Z

| Policy | W / L | Win$ | Loss$ | Open$ | Net$ | Δ net$ | DD% | Intervened episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 955 / 57 | 187,738 | -140,906 | 0 | 46,832 | 0 | 28.17 | 0 |
| post_trim_pullback | 957 / 56 | 183,653 | -138,806 | 0 | 44,847 | -1,986 | 29.59 | 116 |
| underwater_cap9 | 906 / 59 | 168,317 | -126,662 | 0 | 41,654 | -5,178 | 31.89 | 136 |
| post_trim_wait60 | 947 / 56 | 178,391 | -142,475 | 0 | 35,917 | -10,916 | 34.68 | 135 |
| spacing_atr_half | 1042 / 50 | 127,307 | -104,991 | 0 | 22,316 | -24,517 | 25.09 | 596 |
| underwater_cap8 | 860 / 59 | 155,072 | -133,085 | 0 | 21,987 | -24,845 | 39.64 | 153 |
| spacing_atr_one | 915 / 54 | 95,894 | -82,974 | 0 | 12,920 | -33,912 | 18.52 | 514 |

| Month | Baseline$ | post_trim_pullback Δ$ | underwater_cap9 Δ$ | post_trim_wait60 Δ$ | spacing_atr_half Δ$ | underwater_cap8 Δ$ | spacing_atr_one Δ$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | -288 | -1,145 | -4,272 | -753 | -2,697 | -2,262 |
| 2025-08 | 561 | -2,409 | -1,345 | -1,423 | 1,465 | -1,451 | -342 |
| 2025-09 | 5,608 | 604 | -927 | -278 | 457 | -1,311 | -2,440 |
| 2025-10 | 7,325 | -700 | -898 | -2,864 | -6,256 | 3,267 | -3,846 |
| 2025-11 | -1,443 | 491 | 911 | 567 | 940 | 1,096 | 1,173 |
| 2025-12 | -509 | -25 | 691 | -236 | -832 | 267 | 120 |
| 2026-01 | -246 | 2,491 | -837 | 1,284 | 2,951 | -9,152 | 2,117 |
| 2026-02 | 4,940 | 1,451 | -3,498 | 465 | 1,054 | -3,319 | 211 |
| 2026-03 | 11,159 | -351 | -2,586 | 1,273 | -8,706 | -6,150 | -11,207 |
| 2026-04 | 2,065 | 321 | 1,794 | -1,723 | -3,719 | -1,398 | -4,727 |
| 2026-05 | 15,753 | -1,299 | 208 | -2,293 | -5,650 | -87 | -8,021 |
| 2026-06 | 1,584 | -1,517 | 1,291 | -1,695 | -5,136 | -5,465 | -5,260 |
| 2026-07 | -3,950 | -446 | 1,163 | -577 | -209 | 1,554 | 1,379 |
| 2026-08 | 1,317 | -309 | -0 | 856 | -123 | -0 | -807 |

| Policy | Win$ change | Loss$ avoided | TP cycle Δ | Forced close Δ | Worst monthly Δ$ |
|---|---:|---:|---:|---:|---:|
| post_trim_pullback | -4,085 | 2,099 | 1 | 0 | -2,409 |
| underwater_cap9 | -19,422 | 14,243 | -50 | 3 | -3,498 |
| post_trim_wait60 | -9,347 | -1,569 | -9 | 0 | -4,272 |
| spacing_atr_half | -60,431 | 35,915 | 86 | -6 | -8,706 |
| underwater_cap8 | -32,666 | 7,821 | -97 | 4 | -9,152 |
| spacing_atr_one | -91,844 | 57,932 | -38 | -5 | -11,207 |

### hl_extended-close_confirmed

2026-05-17T20:43:00.000Z → 2026-09-10T05:08:00Z

| Policy | W / L | Win$ | Loss$ | Open$ | Net$ | Δ net$ | DD% | Intervened episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 243 / 11 | 59,238 | -40,192 | -3,234 | 15,812 | 0 | 31.11 | 0 |
| post_trim_pullback | 233 / 11 | 58,137 | -40,157 | -3,234 | 14,746 | -1,066 | 33.56 | 48 |
| post_trim_wait60 | 236 / 11 | 57,890 | -40,069 | -3,234 | 14,586 | -1,225 | 33.20 | 48 |
| spacing_atr_half | 280 / 10 | 45,167 | -31,567 | -2,309 | 11,291 | -4,520 | 31.29 | 169 |
| spacing_atr_one | 242 / 9 | 33,694 | -23,319 | -416 | 9,959 | -5,852 | 29.73 | 145 |
| underwater_cap9 | 215 / 12 | 50,042 | -40,981 | -3,234 | 5,827 | -9,985 | 42.27 | 39 |
| underwater_cap8 | 199 / 11 | 45,149 | -39,420 | -3,234 | 2,494 | -13,318 | 46.60 | 44 |

| Month | Baseline$ | post_trim_pullback Δ$ | post_trim_wait60 Δ$ | spacing_atr_half Δ$ | spacing_atr_one Δ$ | underwater_cap9 Δ$ | underwater_cap8 Δ$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | -319 | -533 | -6,424 | -8,272 | -2,932 | -2,835 |
| 2026-06 | -2,243 | -1,666 | -1,319 | -2,769 | -3,723 | -5,670 | -8,122 |
| 2026-07 | -7,858 | -200 | -273 | 3,033 | 5,373 | 0 | 0 |
| 2026-08 | 10,239 | 1,133 | 913 | -509 | -2,855 | -1,383 | -2,360 |
| 2026-09 | -1,456 | -14 | -14 | 2,148 | 3,625 | 0 | 0 |

| Policy | Win$ change | Loss$ avoided | TP cycle Δ | Forced close Δ | Worst monthly Δ$ |
|---|---:|---:|---:|---:|---:|
| post_trim_pullback | -1,101 | 35 | -9 | -1 | -1,666 |
| post_trim_wait60 | -1,348 | 123 | -6 | -1 | -1,319 |
| spacing_atr_half | -14,072 | 8,626 | 37 | -1 | -6,424 |
| spacing_atr_one | -25,544 | 16,873 | 0 | -3 | -8,272 |
| underwater_cap9 | -9,196 | -788 | -27 | 0 | -5,670 |
| underwater_cap8 | -14,090 | 772 | -43 | -1 | -8,122 |

### hl_extended-resting_touch

2026-05-17T20:43:00.000Z → 2026-09-10T05:08:00Z

| Policy | W / L | Win$ | Loss$ | Open$ | Net$ | Δ net$ | DD% | Intervened episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 295 / 10 | 57,130 | -33,009 | -3,234 | 20,887 | 0 | 24.69 | 0 |
| underwater_cap9 | 285 / 10 | 52,215 | -28,766 | -3,234 | 20,214 | -672 | 20.08 | 51 |
| post_trim_wait60 | 286 / 10 | 54,006 | -32,472 | -3,375 | 18,159 | -2,728 | 25.16 | 63 |
| post_trim_pullback | 290 / 10 | 54,026 | -33,106 | -3,375 | 17,545 | -3,341 | 25.65 | 53 |
| underwater_cap8 | 260 / 10 | 45,895 | -29,527 | -3,234 | 13,134 | -7,753 | 28.37 | 52 |
| spacing_atr_half | 337 / 9 | 42,183 | -28,358 | -2,166 | 11,659 | -9,227 | 24.71 | 174 |
| spacing_atr_one | 291 / 9 | 30,911 | -20,720 | -409 | 9,782 | -11,105 | 23.05 | 143 |

| Month | Baseline$ | underwater_cap9 Δ$ | post_trim_wait60 Δ$ | post_trim_pullback Δ$ | underwater_cap8 Δ$ | spacing_atr_half Δ$ | spacing_atr_one Δ$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | -1,050 | -747 | -333 | -1,653 | -2,611 | -5,440 |
| 2026-06 | 1,584 | 1,291 | -1,695 | -1,517 | -5,465 | -5,136 | -5,260 |
| 2026-07 | -3,950 | 1,163 | -577 | -446 | 1,554 | -209 | 1,379 |
| 2026-08 | 9,684 | -1,630 | 636 | -596 | -1,743 | -1,587 | -3,380 |
| 2026-09 | 85 | -446 | -345 | -449 | -446 | 314 | 1,595 |

| Policy | Win$ change | Loss$ avoided | TP cycle Δ | Forced close Δ | Worst monthly Δ$ |
|---|---:|---:|---:|---:|---:|
| underwater_cap9 | -4,916 | 4,243 | -11 | 1 | -1,630 |
| post_trim_wait60 | -3,125 | 537 | -9 | 0 | -1,695 |
| post_trim_pullback | -3,104 | -97 | -5 | 0 | -1,517 |
| underwater_cap8 | -11,235 | 3,483 | -36 | 1 | -5,465 |
| spacing_atr_half | -14,947 | 4,651 | 41 | 0 | -5,136 |
| spacing_atr_one | -26,220 | 12,289 | -4 | -1 | -5,440 |

### Sensitivity: 60s source availability

| Model | Policy | Primary net$ | Source60 net$ | Primary DD% | Source60 DD% |
|---|---|---:|---:|---:|---:|
| published_window-close_confirmed | spacing_atr_half | 21,579 | 21,570 | 24.04 | 24.04 |
| published_window-resting_touch | spacing_atr_half | 22,316 | 22,313 | 25.09 | 25.09 |
| hl_extended-close_confirmed | spacing_atr_half | 11,291 | 11,289 | 31.29 | 31.29 |
| hl_extended-resting_touch | spacing_atr_half | 11,659 | 11,657 | 24.71 | 24.71 |
| published_window-close_confirmed | spacing_atr_one | 15,804 | 15,809 | 22.49 | 22.49 |
| published_window-resting_touch | spacing_atr_one | 12,920 | 12,697 | 18.52 | 18.59 |
| hl_extended-close_confirmed | spacing_atr_one | 9,959 | 9,959 | 29.73 | 29.73 |
| hl_extended-resting_touch | spacing_atr_one | 9,782 | 9,782 | 23.05 | 23.05 |

## Qualification and sensitivity

All six fail the frozen primary screen: recent delta at least+$1,000 in both
models, published delta>=0, no DD increase, each monthly delta>=-$250, at least
20 intervened recent episodes per model, and no modeled nonpositive equity.
All have sufficient intervention counts; this is not a zero-trigger result.

The60s indicator-availability test applies to ATR rules only. Other policies use
actual fill anchors/current closed-minute inventory, not an external indicator
publication. Source delay leaves the negative conclusions intact; the largest
shown PnL change is about-$223 on published touch one-ATR. This is modeled
availability sensitivity, not measured historical receipt latency.

Per-path fees, forced exits, minimum equity, all monthly rows, additional5bps
fixed-path costs and matched/removed/replacement episode attribution are stored
in the output JSON/CSV. Extra5bps is a cost sensitivity on those existing paths,
not a resimulated slippage fill path or maker-fee certification.

No funding settlement, exact lot/tick rounding, exchange liquidation, maker
queue/fragmentation, outages or shared-account short collateral is certified.
Do not add prospective maker savings as a constant to every strategy and call
that an execution proof.

## Verification and artifacts

Accepted local job:
`4b043f8cff65bd6aa3a68c681d4098ccd3960e609e6d695af3085c49a4f9e4a4`.

Definition:
`4d0c8086b95c48ceeca52e7db2cfd7825a09c0a259333ee3175dbe3091cabf17`.

One earlier job stopped BEFORE diagnostics/economic runs because three minute
files had appended. The accepted retry verifies their old byte prefixes exactly
and every appended row strictly after the frozen cutoff. No historical rows,
cutoffs or parameters were changed to obtain the accepted result.

Passed:

- Six B17 digests, full metrics and independent accounting exactly match their
  original/current-cutoff accepted controls, even with observer/veto hooks attached.
-38 economic paths; **194,635 fills,14,072,032 minute marks and1,322,463 add
  decisions** independently audited.
-15,448 raw hourly aggregates/ATR values checked; own-day VWAP and ROC checked.
-4,359 trajectory equations/path classifications,48 pressure-summary groups,
  110 unchanged pressure joins and1,384 unchanged grid labels checked.
- Tests for future poisoning/prefix identity, source gaps/delays, policy
  boundaries, post-trim permission versus fill, reset behavior and registry
  lifecycle. Existing indicator and current-stack replay regressions pass.
- Root/VPS/explicit-script TypeScript checks and artifact/protected-file hashes.

Run outputs:
`backtests/research-workflow/<key>/output/`.
Verification is in the job root. The report generator only prints to stdout:

```powershell
npx ts-node scripts/recovery-construction-report.ts KEY
npx ts-node scripts/recovery-construction-verify.ts KEY
npm run research:workflow -- verify KEY
```

## Conclusion and remaining boundary

**Retain the current live configuration.** None of these six definitions is a
qualified profit/risk upgrade. No combinations were run because the individual
mechanisms did not survive the agreed comparison.

The user is trying to distinguish "a dip worth adding" from "a recovery
stalling at an unattractive level." ATR distance, an underwater dollar cap,
post-trim waiting and a fixed four-hour reclaim are imperfect proxies for
that judgment. Their failure does not establish that judgment is impossible
to measure; nor does it establish that discretionary intervention beats the bot.

A later known-level/price-response experiment would need its own causal
definition and counterexamples. Today's88-90/$460 illustration was not used to
fit these rules. This pass does not claim to have tested a confirmed S/R
rejection plus flow-response policy or a new discretionary-close algorithm.

