# Fable 5 — Profitability Lever Survey — 2026-08-12

```text
Verdict: The strategy surface is heavily mined; the live levers now are (1) risk
re-anchoring to shrunken equity — survival-critical by the project's own survival
tables — (2) fee-class optimization on TP exits, and (3) three genuinely unmined
research directions (HLP vault stream, second short signal shadow, defensive
base step-down). No live strategy-parameter change is proposed; recent audits
(2026-08-04 S/R, 2026-08-11 trend-lock) stand.
```

Survey only — no replay run, no code or config change. Data basis: local pull with
embedded timestamps through `2026-08-11T18:20Z`.

## Current account state (the framing fact)

| Metric | Value | Source |
|---|---:|---|
| Equity (flat, post Aug-11 flatten) | **$21,614** | `data/HYPEUSDT_upside_readiness.json` (writtenAt 2026-08-11T18:20Z) |
| Peak equity | $36,496 | `logs/equity_2026-08-11.jsonl` |
| Drawdown from peak | **40.8%** | same |
| Trailing-30d realized PnL | **-$10,643** | upside_readiness (coverage healthy) |
| 30d counts | 10 TP cycles / 6 forced closes / 9 S/R partials | upside_readiness |
| Long-side net PnL Jun 1–Aug 11 | -$9,031 (fees -$6,634, gross ≈ -$2,397) | `logs/trades_2026-0[678]*.jsonl`, 180 batch closes |
| Live short since arming (9 signals) | -$513 realized, $247 fees | `data/HYPEUSDT_hl_short_live_state.json` |

## Lever 1 — Re-anchor sizing to current equity (highest priority, survival)

All survival math in `research/fable-5-notional-scaling-futureproof-findings.md`
was anchored at **$34.0k equity**. Its own table:

| Fixed base | 1 EK as % of $34k | Study verdict |
|---|---:|---|
| 800 | 25% | baseline, acceptable |
| 1000 | 31% | "fails 2-EK bar" |
| 1200 | 37% | "DO NOT" |

Nothing in that table changed except the denominator. At **$21.6k equity** the
unchanged base-800 tail (worst close ≈ -$8.5k, 2-EK/30d ≈ -$17k) is now:

- 1 EK = **39%** of equity — beyond the ratio the study labeled "DO NOT";
- 2 EK in 30d = **79%** of equity;
- the short's stop ($25k × 4% + fees ≈ $1,030) = **4.8%** of equity per stop,
  past the notional-frontier study's own "aggressive ceiling" (~4.04%, defined
  at $32k equity; strict comfort was ≤3%);
- worst combined day (EK + short stop) ≈ **44%** of equity.

Because every gate in both strategies is percent-based, PnL and tails scale
exactly linearly with size (verified empirically in the scaling study). A
proportional re-anchor preserves all studied behavior and ratios:

| Side | Current | Equity-proportional re-anchor | Restores |
|---|---:|---:|---|
| Long base | $800 | **$500** (= 800 × 21.6/34) | 1 EK ≈ 25% of equity |
| Short notional | $25,000 | **$16,000** (≈ 25k × 21.6/32; strict comfort ≈ $13k) | stop ≈ 3% of equity |

Cost: proportionally smaller dollar upside when the regime turns. That is the
price of keeping the account able to compound; at the current ratios, one
emergency kill plus one bad short week is a half-account event.

Suggested form: not a one-off but a standing re-anchor rule (e.g. re-derive
base = 800 × equity/34k, floor $300 / cap $800, re-evaluated on ±20% equity
moves; short notional likewise, cap $25k). Caps stay at studied values until
the GF-900 gates pass. **This is an operator decision — flagged, not applied.**

## Lever 2 — Fee-class optimization on TP exits (regime-independent)

Jun 1–Aug 11: $6,634 round-trip fees on ~$5.3M entry notional at 0.11%
(0.055% taker each way). Fees were ~73% of the period's net loss. Exit-leg
share ≈ $3.3k / 10 weeks ≈ **$1.4k/month at recent activity**.

Long TP exits execute via native `setTradingStop` (`src/bot/executor.ts:1593`),
which triggers a **market** order → taker. Bybit v5 supports
`tpOrderType: "Limit"` + `tpLimitPrice`, and the bot already has a WS price
feed, TP-intent tracking, and TP re-sync machinery. Converting planned TP exits
from taker (0.055%) to maker (0.02%) saves 0.035pp per exit:

- upper bound ≈ $890/mo at recent churn; realistic (TP/stale-TP only, hard
  flattens stay market) ≈ **$500–700/mo ≈ $6–8k/yr** at recent activity levels
  (scales down proportionally if Lever 1 is applied).

Prerequisite study (must pass before any change): fill-risk of a resting limit
at TP price. The TP fill calibration pass (n=211 live TP closes) already showed
92.9% of fills are same-minute with the 1m high touch, median slippage 0, p90
"buffer to avoid early fill" = 0.016% — evidence that TP touches are mostly
trade-throughs, which favors limit fills. Open question is the graze tail: how
often does price touch TP without tradeable volume, and what does a
fallback-to-market-after-N-seconds policy cost in those cases. This changes the
transactional TP path, so it also requires the full close-stack safety review
per the transaction-safety history.

Second phase (weaker, more invasive): post-only entry for time-triggered adds
with a short market fallback. Not assessed here.

## Lever 3 — Wire `hl_bid_pull_volume` as a second journaled shadow

The 2026-07-16 short-system study passed exactly two of 22 candidates through
its conservative gate: `hl_bid_pull_break` (now live) and **`hl_bid_pull_volume`**
(train n=25 +0.748%, test n=27 +0.348%, fee-stress +0.258%, delay +0.190%).
Only bid_pull_break is journaled today. Adding the volume variant to the shadow
observer (read-only journal, separate signal id namespace, no live path) starts
its 30–60-day forward clock. If it survives forward, it is the only identified
path to increasing short-side event frequency — every architecture alternative
(ladders, parallel slots, adverse adds) is falsified. Cheap; follows the
existing promotion pipeline; no ownership questions (observation only).

## Lever 4 — Mine the HLP vault stream (genuinely unmined data)

> Executed 2026-08-12: see `research/fable-5-hlp-vault-mining-findings-2026-08-12.md`.
> Result: no standalone edge; one WATCHLIST context feature (24h vault drain
> conditions live-short outcomes, n=22/22) recommended for shadow logging only.
> Lever 3 was also executed the same day: `docs/operations/hl-short-bidpullvolume-shadow.md`.

`data/HYPE_hlp_vault.jsonl`: 5-minute HLP vault state (APR, distributable,
flows), collected continuously since ~May, 12MB, fresh through Aug 11. Its
entire research history is one narrow long-side APR-sign-flip definition tested
on a ~6-day sample with **n=0 fires** (5.15/5.15c, "ANECDOTAL"). Three months
of data now exist, and the venue's microstructure demonstrably leads HYPE price
(the live short's edge is HL-book-based). Candidate questions: HLP
equity/APR drawdown as market-maker-stress regime gate for short sizing;
vault-flow extremes as crowding features orthogonal to taker/OB pulse. Standard
discipline applies: chronological split, ablation against existing pulse
features (must add beyond taker/OB or it is redundant), n≥15–30 per cell.
Note: HYPE perp-spot basis is *not* collected (BTC/ETH/SOL/SUI only) — a
collector gap worth closing if basis features are ever wanted.

## Lever 5 — Defensive base step-down in sustained-negative regimes (research)

GF-900 steps size UP on regime-positive gates; nothing steps DOWN below 800
during sustained bleed except the 7-day post-forced-exit clamp (which clamps to
800, not below). Trailing-30d realized PnL is already computed live in the
upside-readiness observer. Hypothesis: base = 800 × k (k ≈ 0.6–0.75) while
trailing-30d realized < -$3k, restore at ≥ $0. Applied to the last 30 days it
would have cut the -$10.6k bleed by ~(1-k). Cheap single-pass test via the
existing `sizingPolicy` hook in the canonical engine. Real falsification risk:
stepping down immediately before V-recovery harvest weeks (June pattern) may
fail the monthly-stability gate — that is exactly what the replay must decide.
If Lever 1 is adopted as a standing equity re-anchor, this becomes partially
redundant (equity drawdown and trailing PnL are correlated); test whichever
form the operator prefers, not both as separate live mechanisms.

## Watchlist harvest (already queued; named triggers, no action today)

| Candidate | Status / trigger | Source |
|---|---|---|
| GF-900 sizing step-up | Blocked: needs trailing-30d ≥ +$3k AND equity ≥ $36.5k (live blockers currently: both, plus grind-mid inactive, forced-exit <7d) | upside_readiness |
| Euphoria stop promotion | Shadow live since Jul-4, zero triggers (regime below EMA200 — structurally can't fire); re-decide after 2–3 live fires | promotion review 2026-07-04 |
| EMA50 slope +0.01% trend-gate margin | Recommended as exact-input alert-only shadow; not yet wired | trendlock audit 2026-08-11 |
| Short MFE +1.5% / lock +0.25% counterfactual | Recommended as alert-only logger; not yet wired | profit-protection 2026-08-10 |
| 5x5 S/R pivot geometry | Shadow/forward candidate only | S/R audit 2026-08-04 |
| hf defer30 softener | Live shadow n=3, net -$63.74 — keep observing, no action | trendlock audit 2026-08-11 |
| Second short slot | Shadow-only until n≥15 overlap trades | architecture study 2026-07-16 |
| Short notional $30k ceiling | Requires positive real execution evidence (live is -$513 — nowhere near) | notional frontier 2026-07-16 |

## Explicitly not levers (falsified or rejected; do not re-open without new mechanism)

SOL/portfolio expansion (5.11 DONT_SHIP: MaxDD + stress fail — and equity is
lower now); aux SUI/FARTCOIN ladders (legacy runout, no transactional owner);
funding harvest on flips (≈$15/yr, falsified); trend-gate strictness and TP
cooldowns (2026-08-11 audit); short exit tuning beyond TP 1.95 (three 2026-08-10
studies); partials/runners/trailing on the short; deep-tail backstops (three
independent falsifications); proportional trims (four falsifications); fixed
base step-ups ≥1000 at any tested equity, and especially at current equity.

## Operational hygiene

`scripts/hype-sr-latest-regime-review.ts`, `scripts/hype-trend-blocker-regime-review.ts`,
`scripts/pull-vps-data.sh`, and the `docs/operations/vps-data-sync.md` rewrite
are untracked/uncommitted — the two review scripts are the reproduction path
for the Aug-4 and Aug-11 audits. Commit them.
