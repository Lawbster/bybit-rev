# Fable 5 — HLP Vault Stream Mining: Findings

```text
Verdict: NO standalone tradeable edge. One WATCHLIST context feature:
HLP free-capital drain over 24h coincides with materially better outcomes for
the frozen live short signal (n=22/22 split, +1.70%/trade vs +0.25%). Log it as
observability on the short shadows; do NOT gate anything on it. APR-level and
APR-z features are time-confounded or half-unstable: dead.
```

Date: 2026-08-12. Script: `scripts/hype-hlp-vault-mining-pass.ts`.
Outputs: `backtests/hype/hlp-vault-mining-2026-08-12/` (`quintiles.csv`,
`double-sort-taker.csv`, `break-trades.csv`, `break-trades-vault-split.csv`).

## Scope and data

- First substantive pass over `data/HYPE_hlp_vault.jsonl` (prior coverage: one
  APR sign-flip long definition, n=0 fires on a ~6-day sample, 5.15/5.15c).
- Stream quality: 31,316 rows, 2026-04-25 → 2026-08-12, 5-minute cadence,
  a single 60-minute gap. Fields used: `apr`, `maxDistributable` (vault free
  capital, "md").
- Grid: the 8,075 strict 15m decisions from the 2026-08-10 short study
  (2026-05-17 20:45 → 2026-08-09 23:15 UTC), vault join 8,073/8,075.
- Causal discipline: vault lookups use collector timestamps strictly before
  each decision `T` with a 30m staleness bound; z-scores use trailing 7d of
  prior decisions only; forward returns from Bybit 1m closes strictly after `T`.
- Caveats stated up front: 15m-grid forward returns overlap (4h horizon ≈ 16x
  overlap → reported standard errors understate ~4x); quintile edges are
  full-window (descriptive, not a trading rule); 8 features × 3 horizons is a
  multiple-testing surface.

## Feature results on the forward-return grid (n≈1,614/quintile)

| Feature | Result | Verdict |
|---|---|---|
| `apr` level | Q4 fwd4h +0.44 looks strong, but low-APR quintiles exist only in the second half and high-APR only in the first — the feature is a bull/bear calendar proxy | **Time-confounded, dead** |
| `aprChg4h` | Non-monotone, best cell flips sign between halves | Dead |
| `aprChg24h` | Downward tilt (falling APR → better fwd), but Q1 flips +0.46 → -0.23 between halves | Dead |
| `aprZ7d` | Q1/Q3 positive cells flip sign between halves | Dead |
| `mdChgPct24h` (level grid) | U-shape across quintiles and within every taker tercile | Noise shape, dead |
| `mdChgPct4h` | Q5 (strong free-capital inflow, +2.4%) → fwd4h **+0.32** (nominal se 0.05), positive in BOTH halves (+0.46/+0.12); high-flow tercile beats mid-flow within every taker tercile | Real-looking but ~1.7σ after overlap correction; partially orthogonal to taker; **context feature at most** |
| `mdChg4hZ7d` | Same family as above, Q4/Q5 positive both halves | Same read |

Unconditional grid fwd4h: +0.049% (n=8,074). No vault feature produces a
spread that survives overlap-corrected errors as a standalone signal.

## The interesting find: vault drain conditions the live short signal

Reconstructed frozen `hl_bid_pull_break` trades from the grid (60m cooldown,
serial ownership, TP 1.95 / SL 4 / 12h, stop-first, 0.11% costs): **n=44,
mean +0.97%/trade** — consistent with the study ledger (44 trades, +0.87% at
TP 2.0; the nearby-TP study measured TP 1.95 adding ~+0.1%/trade). This anchors
the reconstruction before conditioning.

Median split on vault free-capital change over the prior 24h (`mdChgPct24h`,
median -0.41%):

| Side | n | Mean PnL/trade | TP | Stop | Timeout |
|---|---:|---:|---:|---:|---:|
| Vault draining (below median) | 22 | **+1.70%** | 21 | 0 | 1 |
| Vault stable/growing (above) | 22 | **+0.25%** | 11 | 2 | 9 |

Not a calendar artifact: the draining side wins in May (+9.20% total over 5
trades vs +0.15% over 2), June (+22.08/12 vs +3.02/10, i.e. +1.84 vs
+0.30%/trade head-to-head in the same month), and July (+7.36/4 vs +3.96/7).
August is negative on both sides (1 vs 3 trades). The 4h-flow split points the
same way (+1.28 vs +0.66). Mechanism is plausible: the venue market-maker's
equity draining alongside a confirmed breakdown is consistent with real
continuation flow rather than a fade-able flush.

**Why this is still only WATCHLIST:** n=44 total, 4 features × median splits
tested (multiple-testing), and every previously tested *entry filter* on this
short (S/R blocks, support distance, regime restrictions) was falsified on
stability. By house rules (n<15-30 per forward bucket) this is anecdotal until
forward data accumulates.

## Recommended action (observability only, no behavior change)

Log `mdChgPct4h` / `mdChgPct24h` (and `apr` for context) alongside each
journaled signal in both short shadow observers (`hl_bid_pull_break` production
shadow and the new `hl_bid_pull_volume` observer). That accrues the forward
cohort for the drain split at zero strategy risk. Revisit when ≥15-20 forward
trades exist per side of the (frozen, pre-registered) -0.41% median. Do not
gate entries, sizing, or exits on vault state from this pass.

## Falsified / dead (add to ledger)

- HLP APR level, APR 4h/24h change, APR 7d-z as forward-return signals for
  HYPE at 1h/4h/12h horizons: time-confounded or half-unstable (this pass,
  n≈1,614/quintile).
- HLP free-capital features as *standalone* trade signals: nothing clears
  overlap-corrected significance.
- (Prior, still standing: APR sign-flip long, n=0 fires, 5.15c.)

## Reproduce

```bash
npx ts-node scripts/hype-hlp-vault-mining-pass.ts
```

Data cutoffs: vault through 2026-08-12T17:10Z, grid through 2026-08-09T23:15Z
(bounded by the study CSV; extend the grid before the next pass).
