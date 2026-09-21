# L15 follow-up: sideways/down performance and current market context

September 11, 2026. Analysis only. **Zero new trading definitions, zero new economic replays, no live changes.**

## TL;DR

- **Guarded 10h genuinely improves full-period net, maximum drawdown and completed losing dollars against B17 in all four period/TP-model comparisons.** A relative monthly veto is not proof that baseline is superior overall. It remains a materially stronger aggregate candidate, with identifiable costs.
- **Calendar-month evidence favours guarded 10h for the user's sideways/down concern.** Four completed down months and four sideways months in the older window: guarded 10h improves the combined net of each category in both TP models, and beats B17 in every individual down month. Aggressive 10h improves down months but loses versus baseline on the combined sideways months in both models.
- **Do not confuse that with proof of protection during an unfolding top/pullback.** Price-only labels fixed at UTC day start show all five alternatives underperform B17 in the uptrend-pullback bucket in both windows/models. The recent bucket is only **9 days in 3 contiguous episodes**, dominated by June 6–12. Current public prices look closer to this category than to a sustained 28-day decline. This is a warning about a specific mechanism, not a forecast or a rejection of the overall improvement.

[Accepted L15 study](codex-astra-age10-gate-factorial-findings-2026-09-11.md).
[Diagnostic card](../research-inputs/age10-regime-attribution-2026-09-11.json).

## 1. What the monthly screen actually means

The frozen test is relative: **no calendar month more than $250 worse than B17**, alongside aggregate net/DD/intervention conditions. It is not a requirement that either policy have no absolute losing month.

B17 has zero difference from itself by definition, but plainly has losing months and deep drawdowns. That arithmetic does not make B17 economically optimal. Conversely, baseline having red months does not remove the real opportunity costs of an alternative in different months.

The user is right about the wider trade-off: a hard no-month-regression veto can reject a strategy with substantially better total profit and maximum DD. Report it as **aggregate improvement with monthly trade-offs**, not “no useful improvement.” The archived criterion remains unchanged; this attribution does not silently rewrite a promotion rule or authorize deployment.

“Better in every way” is still too strong. Guarded 10h has lower aggregate net in particular months, fewer captured cycles, and worse losses in some local pullback paths. Its benefits survive those costs over the complete tested periods.

## 2. Exact comparison and baseline

B17 is the canonical causal replay of the current ladder policy: $800 × 1.35, maximum 11 rungs, price-drop OR time-based additions, existing outer trend/damaged-regime gates, deep funding guard and support exception, S/R partials, emergency/hard exits, ordinary soft-stale TP and TP cooldown. It is **not** the blank ungated ladder.

- **Guarded 10h**: B17 plus the previously tested one-way soft-stale deferral up to 10h and the separate 2-day-high/1% full exit. All entry guards and S/R partials remain.
- **Aggressive 8h / 10h**: respective TP deferral plus the same high exit, removing both the deep funding timer-add guard and the hot-RSI post-TP cooldown. Outer safety gates remain.
- The other two rows remove only the named guard from guarded 10h.

The 10h change is **not a forced 10h close or a minimum holding time**. Normal TP may fill earlier. The high exit independently becomes eligible from oldest surviving rung age 4h, at any depth, within 1% of the completed rolling 2-day high, with no profit floor. It fills at the next minute open and inherits the existing 4–8h non-TP close cooldown.

Fixed, independently flat **$32,000** accounts:

- Older: **2025-07-01 00:00 through 2026-08-19 21:32 UTC**.
- Recent HL window: **2026-05-17 20:43 through 2026-09-10 05:08 UTC**.

**T = resting-touch TP; C = close-confirmed TP.** T allows an already-armed TP to fill on a later candle touch. C requires a closed-candle confirmation then next-open market fill. These produce different positions and subsequent trades; they are not upper/lower confidence bounds.

All dollars below include the same modeled **0.055% fee each side** and open-position marks. No live maker-fee uplift, funding settlement, queue execution, exact liquidation or shared-short-collateral certification. Historical DD assumes the $32k starts, not the user's current account balance. Overlapping, repeatedly studied windows are not independent holdouts.

### Recent full-period comparison

| Setup | Touch: net / max DD | Confirmed: net / max DD |
| --- | --- | --- |
| B17 current baseline | $20,887 / 24.69% | $15,812 / 31.11% |
| Guarded 10h | $36,542 / 24.22% | $34,839 / 27.64% |
| Aggressive 8h | $42,134 / 20.40% | $40,616 / 25.84% |
| 10h, no RSI cooldown | $37,580 / 22.69% | $41,275 / 29.03% |
| 10h, no deep funding guard | $40,223 / 21.81% | $36,968 / 28.27% |
| Aggressive 10h | $40,783 / 20.39% | $46,922 / 25.68% |

### Older full-period comparison

| Setup | Touch: net / max DD | Confirmed: net / max DD |
| --- | --- | --- |
| B17 current baseline | $46,832 / 28.17% | $19,490 / 45.65% |
| Guarded 10h | $67,781 / 24.67% | $40,382 / 27.32% |
| Aggressive 8h | $56,954 / 30.87% | $57,282 / 29.68% |
| 10h, no RSI cooldown | $62,364 / 23.84% | $54,763 / 31.89% |
| 10h, no deep funding guard | $64,328 / 25.98% | $44,288 / 26.13% |
| Aggressive 10h | $61,635 / 25.09% | $64,976 / 30.17% |

Guarded 10h reduces completed losing dollars from **$33,009 to $25,546** in recent T and **$40,192 to $32,741** in recent C. Older losses fall from **$140,906 to $130,431** in T and **$171,329 to $155,527** in C. Thus its aggregate improvement is not simply “more wins while accepting more losing dollars.”

The recent T DD reduction is modest, **24.69% → 24.22%**; older C is much larger, **45.65% → 27.32%**. Do not describe all four improvements as equally large.

## 3. Completed sideways and declining months

This first view labels **entire completed UTC months after the fact** using HYPE price return:

- Down: below −5%.
- Sideways: −5% through +5%.
- Up: above +5%.

These labels are descriptive only, never supplied to a strategy. A sideways month can contain a violent rally and reversal. A down month can begin with an uptrend. Incomplete first/last months are not promoted to complete regime samples.

Older complete down months, **n=4**: November 2025 −26.86%, December −20.29%, June 2026 −9.76%, July −19.23%.
Complete sideways months, **n=4**: July 2025 +3.23%, September +2.12%, October −3.45%, February 2026 +0.62%.

Each cell is total marked net attributed to those months, **T / C**. These are portions of the existing continuous portfolio paths, not simulations restarted for each selected month.

| Setup | 4 down months: T / C | 4 sideways months: T / C |
| --- | --- | --- |
| B17 current baseline | -$4,318 / -$10,117 | $20,541 / $4,109 |
| Guarded 10h | $11,385 / $7,354 | $28,663 / $12,141 |
| Aggressive 8h | $14,324 / $14,728 | $10,622 / $6,163 |
| 10h, no RSI cooldown | $9,786 / $14,073 | $15,875 / $4,644 |
| 10h, no deep funding guard | $11,546 / $10,447 | $19,371 / $11,897 |
| Aggressive 10h | $11,382 / $19,743 | $11,846 / $3,717 |

Interpretation:

1. **Guarded 10h is the clearest combined sideways/down candidate.** Both categories improve under both TP assumptions. All four down months individually beat B17 under both assumptions.
2. **All five alternatives improve each of the four completed down months versus B17 in both models.** There really is useful bad-month improvement; do not dismiss that evidence.
3. Aggressive 10h's down-month gains do **not** imply superior sideways robustness: sideways total is **$11,846 / $3,717** versus baseline **$20,541 / $4,109**. Its older T February loss is **−$2,829 versus B17 +$4,940**.
4. Guarded 10h still has a sideways exception: September 2025 earns **$744 / −$54** versus B17 **$5,608 / $6,247**. That is the kind of real opportunity cost the monthly screen flags.
5. The recent window has two completed down months, June and July, but **no completed sideways month**. Older history supplies that category. These overlapping June/July results must not be counted again as new independent evidence.

June+July alone: baseline **−$2,366 / −$10,102**; guarded 10h **+$8,893 / +$3,937**; aggressive 8h **+$9,518 / +$8,561**; aggressive 10h **+$7,682 / +$14,106**.

## 4. A separate, knowable-at-the-time regime view

To avoid declaring a month “bearish” only after seeing its outcome, each UTC day receives a frozen price-only label based on **closes already available at 00:00 UTC**:

- **Down**: trailing 28-day return below −5%.
- **Sideways**: trailing 28-day return within ±5%.
- **Uptrend pullback**: 28-day return above +5%, but trailing 7-day return at or below −5%.
- **Other uptrend**: 28-day return above +5% and 7-day return above −5%.

The definitions were fixed before this attribution output. They are coarse analytical buckets, not optimized or validated trading filters. No intraday regime relabeling using that day's later prices; no filter is inserted into any replay.

All minute-by-minute equity changes are assigned to the bucket known at the start of that day. Exposure carried from a previous regime remains included. Therefore this measures **how existing continuous portfolios behaved while in a market state**, not the profit from selectively opening only in that state. Separately stored entry-labelled completed W/L cohorts are not conflated with these mark-to-market totals.

### Recent causal buckets

Sample: down **38 days / 4 stints**; sideways **8.14 equivalent days / 7 stints**; uptrend pullback **9 days / 3 stints**; other uptrend **60.21 equivalent days / 4 stints**. Fractional days are the actual partial-window boundaries.

| Setup | Down: T / C | Sideways: T / C | Uptrend pullback: T / C | Other uptrend: T / C |
| --- | --- | --- | --- | --- |
| B17 current baseline | $1,119 / -$4,962 | $2,422 / $4,124 | -$2,582 / -$4,663 | $19,927 / $21,312 |
| Guarded 10h | $102 / -$4,243 | $2,717 / $3,092 | -$7,781 / -$8,097 | $41,504 / $44,086 |
| Aggressive 8h | -$3,532 / $1,853 | $2,224 / $3,380 | -$5,020 / -$8,958 | $48,462 / $44,341 |
| 10h, no RSI cooldown | -$3,433 / $494 | $2,986 / $3,723 | -$7,768 / -$8,596 | $45,794 / $45,654 |
| 10h, no deep funding guard | $114 / -$4,130 | $1,975 / $3,527 | -$5,197 / -$9,587 | $43,331 / $47,158 |
| Aggressive 10h | -$3,478 / $1,679 | $2,231 / $3,437 | -$5,020 / -$8,958 | $47,051 / $50,764 |

### Older causal buckets

Sample: down **145 days / 20 stints**; sideways **65.90 equivalent days / 37 stints**; uptrend pullback **41 days / 20 stints**; other uptrend **163 days / 34 stints**.

| Setup | Down: T / C | Sideways: T / C | Uptrend pullback: T / C | Other uptrend: T / C |
| --- | --- | --- | --- | --- |
| B17 current baseline | $9,444 / $9,489 | $24,063 / $24,060 | $2,102 / $2,114 | $11,224 / -$16,174 |
| Guarded 10h | $10,573 / $9,227 | $22,358 / $26,363 | -$8,503 / -$8,754 | $43,353 / $13,546 |
| Aggressive 8h | $8,853 / $18,009 | $22,106 / $27,288 | -$2,734 / -$5,171 | $28,730 / $17,155 |
| 10h, no RSI cooldown | $8,104 / $16,344 | $27,158 / $33,805 | -$7,063 / -$6,843 | $34,165 / $11,457 |
| 10h, no deep funding guard | $10,754 / $7,120 | $17,267 / $22,388 | -$5,719 / -$10,005 | $42,026 / $24,785 |
| Aggressive 10h | $8,680 / $16,722 | $25,783 / $29,126 | -$1,910 / -$5,162 | $29,082 / $24,290 |

Key distinction:

- **No alternative beats B17 in the established-down bucket across all four window/TP-model cases.**
- **No alternative beats B17 in the sideways bucket across all four cases.**
- **All five alternatives underperform B17 in the uptrend-pullback bucket across all four cases.**
- The alternatives' largest positive causal-bucket contribution is in **other-uptrend** conditions. For guarded 10h recent T, that bucket improves by about **$21,577**, while the full-period improvement is only **$15,655**: adverse contributions elsewhere offset part of it.

This does not contradict improved full down months. A month subsequently ending red can contain profitable rebound days and days whose trailing 28-day trend was still positive. Calendar and trailing-state labels answer different questions.

Do not concatenate separated days into a pretend tradable equity curve or quote its “portfolio DD.” Full-period DD remains the verified original DD. The diagnostic also stores the worst **actual uninterrupted stint** for each regime; that is a local drawdown at the existing account equity, not a replacement full-period risk statistic.

## 5. Trace the pullback weakness rather than generalize from a label

Recent pullback-mark contribution by actual contiguous period, **T / C**:

| UTC period (end exclusive) | B17 current baseline T / C | Guarded 10h T / C | Aggressive 8h T / C | Aggressive 10h T / C |
| --- | --- | --- | --- | --- |
| 2026-06-06 → 2026-06-13 | -$2,421 / -$1,253 | -$7,548 / -$9,695 | -$6,337 / -$8,901 | -$6,337 / -$8,901 |
| 2026-06-25 → 2026-06-26 | $973 / -$1,840 | $1,118 / $1,425 | $1,143 / $1,240 | $1,143 / $1,240 |
| 2026-07-13 → 2026-07-14 | -$1,133 / -$1,571 | -$1,350 / $173 | $173 / -$1,297 | $173 / -$1,297 |

Worst actual uninterrupted pullback-stint DD:

| Setup | Recent pullback worst continuous-stint DD: T / C |
| --- | --- |
| B17 current baseline | 17.64% / 15.80% |
| Guarded 10h | 17.37% / 20.59% |
| Aggressive 8h | 15.88% / 20.07% |
| Aggressive 10h | 15.88% / 19.94% |

**June 6–12 dominates the negative relative result.** The two single-day episodes are mixed and sometimes favour the alternatives. Nine days from three episodes is not enough to estimate the probability of the next pullback being bad.

Verified episode evidence:

- In T, B17 has **32 completed closes in June 6–12**, completed net about **−$1,360**. Guarded 10h has **14**, completed net about **−$9,779**. The high/TP changes alter occupancy; these are not identical trades with a fee adjustment.
- Guarded 10h carries a ladder entered **June 5 01:35** to a high-rule close on **June 8 00:19**, losing **$3,245**. A following ladder entered **June 8 20:00** reaches the **June 10 18:41** emergency close, losing **$8,905**.
- B17's T June 8 21:47 entry also suffers an emergency loss, **$8,374**, but its intervening TP cycling and preceding ladder path differ.
- In C, guarded 10h carries an earlier **June 4 20:34** entry into the **June 6 19:59** emergency loss of **$8,224**, then the June 10 **$8,905** loss. B17 has one major overlapping loss, the **June 10 20:00** hard close of **$7,903**, and more completed cycles.
- The episode PnL numbers are full completed trade outcomes. They are **not** the bucket MTM dollars in the table: ladders span regime boundaries and already contain unrealized gains/losses at the start of a bucket.

Causality check, one example: the label for **2026-06-06 00:00 UTC** uses HYPE close **$59.702**, trailing 28-day return **+38.11595%** and 7-day return **−7.33101%**, all closed at or before that timestamp. Only the subsequent day's equity changes are assigned to that label. No June 6–12 future high/low selected the label.

## 6. Current market context: separate from the historical economic cutoff

Fresh public Bybit snapshots on **2026-09-11 around 09:25 UTC**:

| Measurement | HYPE | BTC |
| --- | ---: | ---: |
| Latest traded price | $79.82 | $77,178.90 |
| Last completed 4h close, 08:00 UTC | $79.81 | $77,180.80 |
| 7-day close return through 08:00 | −7.47% | −4.27% |
| 28-day close return through 08:00 | +41.41% | +22.76% |
| 4h EMA50 analytical estimate | $83.54, falling | $78,454, falling |
| 4h EMA200 analytical estimate | $76.33, rising | $74,690, rising |

Sources: [Bybit HYPE ticker](https://api.bybit.com/v5/market/tickers?category=linear&symbol=HYPEUSDT), [BTC ticker](https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT), [HYPE 4h candles](https://api.bybit.com/v5/market/kline?category=linear&symbol=HYPEUSDT&interval=240&limit=1000), [BTC 4h candles](https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=240&limit=1000).

Public endpoints update; the table records this observation, not a permanent current quote. Returns use closed-bar endpoints. EMAs were independently calculated from the retrieved closed 4h history with an SMA seed; **these are not the bot's exact rolling cached live-gate inputs** and must not be substituted into gate telemetry.

HYPE reference levels from that price snapshot:

- **$78.04**: observed 24h/7d low.
- Around **$76.3**: analytical 4h EMA200 reference, not guaranteed support.
- **$82–84**: recent trading/close area and falling EMA50, a nearby overhead region.
- **$87–89.61**: preceding high region; Bybit's 7/28-day high is **$89.61**.
- $79.82 is about **10.9% below that high**. Reaching $90 again requires roughly **12.8%**, not an unprecedented multiple.

This is currently a **sharp shorter-term correction within a large 28-day rise**, rather than evidence that the sustained 28-day decline bucket already applies. It resembles the coarse uptrend-pullback category. That resemblance does not establish that June's next path will repeat.

CoinMarketCap's retrieved page lists approximately **$20.2bn market cap and rank #9**. Rankings/supply estimates differ by provider; “top ten” is a useful scale description, not a price ceiling. [CoinMarketCap HYPE](https://coinmarketcap.com/currencies/hyperliquid/).

The assertion that HYPE cannot sustain $90+ without exceptional BTC strength is **not established by our research**. Common market strength is relevant, but contemporaneous HYPE/BTC 4h correlation was **0.521**, versus HYPE/SOL **0.593**, in the previously tested recent window. The tested lagged/past-fitted next-hour models did not beat the mean-return baseline. Correlation is neither a necessary price condition nor a profitable forward trigger. [Prior BTC/SOL comparison](codex-astra-sol-btc-comparison-findings-2026-09-10.md).

The fresh quotes are context only. **No September 10–11 new market observations were appended to the September 10 05:08 economic results.**

## 7. Practical answer to “which is better in sideways/down?”

**By completed weak calendar months:** guarded 10h is the balanced leader of these specific choices. Its down-month and sideways-month totals improve under both TP assumptions while retaining the existing entry protections. Aggressive 10h has greater total profit potential in these replays, but its sideways losses and more aggressive entries are meaningful costs.

**By a market state we can actually know at the time:** no universal sideways/down winner is established. Guarded 10h is mixed in established weakness, and the uptrend-pullback bucket favours B17. It would be incorrect to sell guarded 10h as a proven top/pullback protection system.

**Aggregate conclusion:** stronger historical candidate, yes; safe/better in every local situation, no. The monthly screen alone is not a sufficient argument to reject it, but neither does lower overall DD remove the traced adverse path. No promotion, threshold changes, live edits or automatic regime switching follows from this report.

## 8. Completed W/L dollars: recent window

These are complete flat-to-flat ladders, with partial proceeds attributed to their eventual episode. End marks/unfinished partial proceeds explain the difference between completed net and total.

### Resting-touch

| Setup | Completed wins / losses | Winning dollars | Losing dollars | Total incl. end mark |
| --- | --- | --- | --- | --- |
| B17 current baseline | 295 / 10 | $57,130 | -$33,009 | $20,887 |
| Guarded 10h | 229 / 13 | $61,971 | -$25,546 | $36,542 |
| Aggressive 8h | 252 / 16 | $69,851 | -$27,717 | $42,134 |
| 10h, no RSI cooldown | 242 / 15 | $66,170 | -$28,707 | $37,580 |
| 10h, no deep funding guard | 222 / 14 | $65,537 | -$25,313 | $40,223 |
| Aggressive 10h | 242 / 16 | $68,731 | -$27,948 | $40,783 |

### Close-confirmed

| Setup | Completed wins / losses | Winning dollars | Losing dollars | Total incl. end mark |
| --- | --- | --- | --- | --- |
| B17 current baseline | 243 / 11 | $59,238 | -$40,192 | $15,812 |
| Guarded 10h | 196 / 14 | $67,463 | -$32,741 | $34,839 |
| Aggressive 8h | 209 / 16 | $72,341 | -$31,724 | $40,616 |
| 10h, no RSI cooldown | 211 / 14 | $71,753 | -$30,594 | $41,275 |
| 10h, no deep funding guard | 188 / 13 | $70,340 | -$33,372 | $36,968 |
| Aggressive 10h | 215 / 13 | $77,533 | -$30,610 | $46,922 |

## 9. Full older monthly stability: baseline beside every alternative

Each candidate cell is **month MTM dollars (difference from B17)**. This includes open marks, not only closes. Partial August is shown but not included in complete-month regime totals. June/July rows are also the exact completed down-month rows in the recent run; do not double-count them.

### Resting-touch

| UTC month / HYPE return | B17 current baseline | Guarded 10h | Aggressive 8h | 10h, no RSI cooldown | 10h, no deep funding guard | Aggressive 10h |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 / 3.23% | $2,668 | $8,099 (+$5,431) | $4,310 (+$1,642) | $8,971 (+$6,303) | $5,377 (+$2,709) | $6,281 (+$3,613) |
| 2025-08 / 8.43% | $561 | -$97 (−$658) | -$1,491 (−$2,052) | $498 (−$62) | $150 (−$411) | $676 (+$115) |
| 2025-09 / 2.12% | $5,608 | $744 (−$4,864) | $1,387 (−$4,222) | $1,387 (−$4,222) | $744 (−$4,864) | $1,387 (−$4,222) |
| 2025-10 / -3.45% | $7,325 | $10,662 (+$3,337) | $4,884 (−$2,441) | $5,041 (−$2,284) | $8,766 (+$1,441) | $7,008 (−$317) |
| 2025-11 / -26.86% | -$1,443 | $2,199 (+$3,642) | $1,502 (+$2,944) | $3,832 (+$5,275) | $711 (+$2,154) | $2,560 (+$4,003) |
| 2025-12 / -20.29% | -$509 | $294 (+$803) | $3,305 (+$3,814) | $737 (+$1,247) | $506 (+$1,015) | $1,140 (+$1,649) |
| 2026-01 / 21.83% | -$246 | $1,653 (+$1,899) | $4,478 (+$4,723) | $2,514 (+$2,760) | $3,708 (+$3,954) | $3,347 (+$3,593) |
| 2026-02 / 0.62% | $4,940 | $9,158 (+$4,218) | $42 (−$4,898) | $475 (−$4,465) | $4,483 (−$457) | -$2,829 (−$7,769) |
| 2026-03 / 17.30% | $11,159 | $13,188 (+$2,028) | $12,076 (+$917) | $17,105 (+$5,945) | $11,041 (−$119) | $12,962 (+$1,803) |
| 2026-04 / 8.46% | $2,065 | $216 (−$1,849) | $363 (−$1,702) | $1,442 (−$622) | $2,845 (+$780) | $3,920 (+$1,855) |
| 2026-05 / 81.64% | $15,753 | $11,733 (−$4,020) | $15,297 (−$456) | $13,590 (−$2,164) | $14,881 (−$872) | $16,216 (+$463) |
| 2026-06 / -9.76% | $1,584 | $7,827 (+$6,243) | $10,830 (+$9,246) | $8,281 (+$6,697) | $9,974 (+$8,390) | $8,994 (+$7,410) |
| 2026-07 / -19.23% | -$3,950 | $1,066 (+$5,016) | -$1,312 (+$2,638) | -$3,064 (+$886) | $355 (+$4,305) | -$1,312 (+$2,638) |
| 2026-08 / partial | $1,317 | $1,041 (−$277) | $1,286 (−$32) | $1,554 (+$237) | $786 (−$532) | $1,286 (−$32) |

### Close-confirmed

| UTC month / HYPE return | B17 current baseline | Guarded 10h | Aggressive 8h | 10h, no RSI cooldown | 10h, no deep funding guard | Aggressive 10h |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 / 3.23% | -$3,050 | $8,989 (+$12,039) | $2,284 (+$5,334) | $9,161 (+$12,211) | $6,257 (+$9,306) | $6,405 (+$9,454) |
| 2025-08 / 8.43% | $1,420 | $1,131 (−$289) | $1,144 (−$276) | $2,618 (+$1,198) | $598 (−$822) | $3,420 (+$1,999) |
| 2025-09 / 2.12% | $6,247 | -$54 (−$6,301) | $2,218 (−$4,029) | -$470 (−$6,717) | -$54 (−$6,301) | -$470 (−$6,717) |
| 2025-10 / -3.45% | $7,167 | $9,406 (+$2,239) | $8,409 (+$1,242) | $7,446 (+$279) | $9,630 (+$2,463) | $7,559 (+$392) |
| 2025-11 / -26.86% | -$688 | $2,646 (+$3,334) | $1,651 (+$2,339) | $3,346 (+$4,034) | $822 (+$1,510) | $2,516 (+$3,204) |
| 2025-12 / -20.29% | $673 | $772 (+$99) | $4,517 (+$3,844) | $2,398 (+$1,725) | $1,799 (+$1,125) | $3,121 (+$2,448) |
| 2026-01 / 21.83% | -$8,750 | -$6,035 (+$2,715) | $4,488 (+$13,238) | $3,968 (+$12,718) | -$5,211 (+$3,538) | $4,385 (+$13,135) |
| 2026-02 / 0.62% | -$6,255 | -$6,200 (+$55) | -$6,749 (−$494) | -$11,493 (−$5,238) | -$3,935 (+$2,320) | -$9,776 (−$3,521) |
| 2026-03 / 17.30% | $12,689 | $14,143 (+$1,454) | $13,052 (+$364) | $16,531 (+$3,843) | $11,097 (−$1,592) | $13,598 (+$909) |
| 2026-04 / 8.46% | $2,401 | -$3,140 (−$5,541) | $325 (−$2,077) | -$1,561 (−$3,962) | $931 (−$1,471) | $2,939 (+$538) |
| 2026-05 / 81.64% | $15,721 | $12,873 (−$2,848) | $14,895 (−$826) | $11,926 (−$3,795) | $12,538 (−$3,183) | $14,686 (−$1,035) |
| 2026-06 / -9.76% | -$2,243 | $4,069 (+$6,313) | $7,823 (+$10,066) | $8,060 (+$10,304) | $6,083 (+$8,326) | $10,732 (+$12,975) |
| 2026-07 / -19.23% | -$7,858 | -$133 (+$7,726) | $738 (+$8,596) | $270 (+$8,128) | $1,744 (+$9,602) | $3,374 (+$11,233) |
| 2026-08 / partial | $2,017 | $1,915 (−$102) | $2,488 (+$471) | $2,562 (+$545) | $1,990 (−$27) | $2,488 (+$471) |

## 10. Reproducibility and scope

- Accepted economic job: `0b999800c49f7cf869e370252e1f95caaa879e396febb8eb06a65506c11781a9`.
- This attribution: `backtests/hype/age10-regime-attribution-2026-09-11/`.
- Saved files: `results.json` (daily/stint/cohort/month summaries), `regimes.json`, `manifest.json`, `verification.json`, `independent-check.json`.
- Generator: [age10-regime-attribution.ts](../scripts/age10-regime-attribution.ts).
- Boundary tests: [age10-regime-attribution-tests.ts](../scripts/age10-regime-attribution-tests.ts).
- Independent partition/label checker: [age10-regime-attribution-check.ts](../scripts/age10-regime-attribution-check.ts).

All **24** selected saved paths reproduce original net, DD and every monthly mark. The original event-ledger accounting is independently rerun; no economic strategy engine is executed. The second checker verifies **6,396 daily labels/partitions and 228 monthly rows** against accepted candles and results. Regime and stint dollars sum back to the complete original net.

Latest sync appended collector records. Every accepted JSONL **byte prefix** was hash-verified; only accepted HYPE candle bytes were consumed. The full HYPE archive, repair evidence, source files and saved L15 artifacts remain exact. Current `bot-state.json` differs from its older snapshot but is **not an attribution input**; it was protected at its current hash throughout. No old acceptance receipt was edited to conceal new input hashes.

Daily attribution uses the minute start's UTC day and includes the close at the next midnight. Separately preserved canonical monthly accounting uses the original candle `endTs` convention. Therefore the two reports intentionally retain their own exact one-minute boundary conventions rather than silently replacing original monthly values.

To check retained output without rewriting it:

```powershell
npx ts-node scripts/age10-regime-attribution-tests.ts
npx ts-node scripts/age10-regime-attribution-check.ts
```

The generator refuses an existing output directory. No new thresholds were optimized after results. Counts remain **5,261 standalone / 156 ladder overlays**, with L09 component profiles separate. This is interpretation of existing policies, not L16 or a newly validated regime filter.

