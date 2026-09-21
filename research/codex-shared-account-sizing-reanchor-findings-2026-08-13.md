# Shared-account sizing re-anchor findings — 2026-08-13

## TL;DR

- On the strict 84.60-day common HYPE/HL window (`n=44` serial shorts), the
  checked-in `$800` long base plus `$25k` short remains the **maximum-profit**
  tested combination: `+$29,552`, with 20.17% maximum drawdown at a deliberately
  stressed `$21,614` starting-equity denominator.
- `$500 / $25k` is the **efficient defensive combination**: `+$22,493`
  (`-$7,058`, or -23.9% profit versus current sizing), while maximum drawdown
  falls to 15.21%, worst rolling 30-day loss improves from `-$11,718` to
  `-$7,337`, and July improves from `-$5,035` to `-$1,951`.
- Do **not** mechanically scale both sides down. Cutting the short to `$16k`
  lowers profit and worsens portfolio drawdown because the short is historically
  profitable negative-beta protection. A ±20% equity-banded long rule is also
  falsified: it scales back to `$800` before the late decline, sacrificing early
  upside without reducing the eventual tail. No live sizing change was made.

## Question

The original long and short sizing work was anchored near `$32k–$34k` equity.
After the August 11 pull showed about `$21.6k` equity, this pass asks whether the
portfolio should retain:

- current `$800` long / `$25k` short;
- smaller long only (`$500 / $25k`);
- smaller short only (`$800 / $16k`);
- both sides smaller (`$500 / $16k`);
- an automatic long base proportional to combined equity, rebalanced only after
  a ±20% equity move, floor `$300`, cap `$800`, with the short fixed at `$25k`.

This is a risk/sizing replay, not a strategy-threshold search.

## Method and causal boundaries

Script: `scripts/hype-shared-account-sizing-replay.ts`.

Outputs: `backtests/hype/shared-account-sizing-2026-08-13/`.

Window:

- decisions: `2026-05-17T20:45Z` through `2026-08-09T23:15Z`;
- portfolio marking continues through `2026-08-10T11:15Z` so a last signal can
  complete its frozen 12-hour hold;
- starting equity is fixed at `$21,614` to stress the current denominator.

Long side:

- current strategy, current trend/regime/add/exit behavior;
- live S/R resistance partial exit and support reopen included;
- only base notional changes;
- fixed `$500` results reproduce exact linear scaling: long PnL ratio to `$800`
  is `0.6250000000`.

Short side:

- exact frozen `hl_bid_pull_break` qualification;
- 8,075 completed 15-minute decisions;
- 51 cooldown-separated raw fires and 44 serial trades;
- current TP1.95 / SL4 / 12h policy;
- stop-first inside an ambiguous one-minute candle;
- exact decision-open/live fee plus one-minute-delay/0.20%-cost stress lanes;
- Bybit funding included causally at 8-hour settlements.

No future return, final trade outcome, or later candle is used in an entry or
sizing decision. The dynamic sensitivity uses only portfolio contribution
already observable at the ladder-open timestamp.

## Primary results

### Exact decision-open / configured fees

| Long / short sizing | PnL | Max DD | Worst 7d | Worst 30d | Min equity | One short stop / initial equity |
|---|---:|---:|---:|---:|---:|---:|
| **$800 / $25k current** | **+$29,552** | 20.17% | -$5,105 | -$11,718 | $20,755 | 4.76% |
| **$500 / $25k defensive** | **+$22,493** | **15.21%** | **-$3,191** | **-$7,337** | **$21,077** | 4.76% |
| $800 / $16k | +$25,689 | 21.71% | -$5,162 | -$11,705 | $20,755 | 3.04% |
| $500 / $16k | +$18,631 | 16.66% | -$3,191 | -$7,324 | $21,077 | 3.04% |
| ±20% banded long / $25k | +$25,333 | 21.62% | -$5,105 | -$11,718 | $21,068 | 4.76% |

### One-minute delay / 0.20% short cost stress

| Long / short sizing | PnL | Max DD | Worst 30d |
|---|---:|---:|---:|
| $800 / $25k current | +$27,741 | 20.95% | -$11,855 |
| **$500 / $25k defensive** | **+$20,682** | **16.14%** | **-$7,474** |
| $800 / $16k | +$24,530 | 22.26% | -$11,793 |
| $500 / $16k | +$17,472 | 17.24% | -$7,412 |
| ±20% banded long / $25k | +$23,517 | 22.49% | -$11,855 |

The defensive `$500 / $25k` result is not a fragile exact-fill artifact. Its
drawdown advantage survives the delayed/stress lane.

## Monthly stability

Configured-fee monthly PnL:

| Month | $800 / $25k | $500 / $25k | $800 / $16k | $500 / $16k | Banded / $25k |
|---|---:|---:|---:|---:|---:|
| 2026-05 partial | +$21,186 | +$14,119 | +$20,343 | +$13,276 | +$16,995 |
| 2026-06 | +$15,562 | +$11,952 | +$13,425 | +$9,815 | +$15,534 |
| 2026-07 | -$5,035 | **-$1,951** | -$6,183 | -$3,099 | -$5,035 |
| 2026-08 partial | -$2,169 | **-$1,633** | -$1,902 | **-$1,367** | -$2,169 |

Reducing the long side improves the two weak months while predictably reducing
the two profitable months. Reducing the short side does not provide the same
portfolio protection.

## Why the `$16k` short is dominated

The prior survey correctly noted that a standalone `$25k` SL4 loss is about
4.76% of a `$21.6k` account, versus about 3.04% at `$16k`. But one-stop budget is
not the complete portfolio objective.

Over the tested path the frozen short contributes:

- approximately `+$10,729` at `$25k`;
- approximately `+$6,867` at `$16k`.

More importantly, that contribution is negatively aligned with important long
drawdown periods. With the long fixed at `$800`, reducing the short:

- gives up `$3,862` of PnL;
- worsens maximum drawdown by 1.54 percentage points;
- slightly worsens worst-seven-day loss.

With the long fixed at `$500`, `$500 / $16k` is similarly dominated by
`$500 / $25k`: it earns `$3,862` less and has 1.45 percentage points more
drawdown. The short should not be reduced solely by applying the long-side
equity ratio.

This does not authorize increasing the short. Its live sample remains small and
has not independently demonstrated the historical expectancy. The correct
conclusion is **retain the current cap while collecting evidence**, not size up.

## Why the automatic ±20% rule fails

The banded policy starts near `$509` (`$800 × equity / $34k`), changes its base
only when combined equity moves at least 20% from the last anchor, and caps at
`$800`.

It earns less than current sizing because it is smaller during the strong early
window. Once the account grows, it steps back to `$800`; the July/August loss
then matches current sizing almost exactly. Consequently:

- PnL falls by about `$4,219`;
- maximum drawdown worsens from 20.17% to 21.62%;
- worst 7/30-day losses do not improve.

An equity-only step-up is path-lagged: it recognizes past profits, not the next
regime. This is the same structural reason a mechanical size rule can become
largest immediately before a reversal. Do not implement it live.

## Capacity and margin

Every scenario retains positive simulated free-margin and liquidation-headroom
under the local Bybit risk-tier model. Exchange margin is not the binding
constraint. Account absorption of repeated long losses remains the real risk.

The `$500 / $25k` scenario reduces maximum combined gross notional from about
`$91.3k` to `$66.5k` while preserving the historical short hedge. That is the
cleanest tested way to reduce portfolio tail without redesigning either
strategy.

## Verdict

### Profit-maximizing answer

Keep `$800 / $25k`. It makes the most money in both exact and stressed lanes.

### Survival/recovery answer at current equity

`$500 / $25k` is the only tested defensive combination that materially reduces
drawdown without discarding the short hedge. It gives up about 24% of historical
profit for approximately 25% lower maximum-drawdown percentage and 37% smaller
worst rolling 30-day loss.

### Live recommendation

**No automatic or immediate config change from this research pass.** This common
window is the correct portfolio window for the short, but it is only 84.6 days,
and the current short's forward-live sample remains limited. The result narrows
the operator choice rather than choosing it silently:

- retain `$800 / $25k` if maximizing expected dollars takes precedence;
- choose a deliberate fixed `$500 / $25k` defensive step-down if preserving
  the now-smaller account through another comparable bleed takes precedence;
- do not deploy `$16k` short sizing or the tested automatic band rule.

Any live sizing change requires explicit operator authorization. No strategy,
execution, or configuration change was made here.
