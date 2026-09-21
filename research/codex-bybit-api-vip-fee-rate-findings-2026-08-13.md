# Bybit API and VIP fee-rate findings — 2026-08-13

## TL;DR

- The hypothesis that Bybit API orders always pay a blanket VIP 0 rate is
  **falsified** by Bybit's current documentation. The fee applied to an order is
  based on the account's VIP level when the order is placed; an API key does
  not establish a separate fee tier.
- The current HYPE account is nevertheless paying the standard VIP 0 linear
  taker rate. Nine completed live short cycles from 2026-07-28 through
  2026-08-10 show approximately `0.055%` on both entry and exit execution fees.
  This supports the repo's current `0.00055` assumption today.
- If the account reaches VIP 1 or above, Bybit should charge the lower account
  rate to API fills automatically. This repo would not fully recognize that
  change because long accounting/backtests and the maker-TP observer use static
  VIP 0 constants. Verify the authenticated symbol rate first; any code/config
  change is a separate reviewed task.

## Official answer

Bybit's fee page states that:

- fees differ by VIP level;
- subaccounts adopt the main account fee structure;
- the rate applied to an order is the rate associated with the account's VIP
  level when the order is placed;
- actual rates may vary by region and should be confirmed on the account's
  **My Fee Rate** page.

Source: [Bybit Trading Fee Structure](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure).

Bybit also provides an authenticated account endpoint:

`GET /v5/account/fee-rate?category=linear&symbol=HYPEUSDT`

It returns `takerFeeRate` and `makerFeeRate` for the authenticated account and
symbol. If API orders were all forced to a universal rate, a private,
account-specific, symbol-aware fee endpoint would not be the relevant API
contract. Source: [Bybit V5 Get Fee Rate](https://bybit-exchange.github.io/docs/v5/account/fee-rate).

I found no current official documentation saying ordinary API-created orders
revert to VIP 0. API placement and UI placement are execution interfaces to the
same trading account; maker/taker classification, account tier, product/zone,
region, and any account-specific schedule determine the fee.

## Current standard perpetual schedule

The official base table currently shows:

| Tier | Taker per leg | Maker per leg | Taker round trip |
|---|---:|---:|---:|
| VIP 0 | 0.0550% | 0.0200% | 0.1100% |
| VIP 1 | 0.0400% | 0.0180% | 0.0800% |
| VIP 2 | 0.0375% | 0.0160% | 0.0750% |
| VIP 3 | 0.0350% | 0.0140% | 0.0700% |
| VIP 4 | 0.0320% | 0.0120% | 0.0640% |
| VIP 5 | 0.0320% | 0.0100% | 0.0640% |
| Supreme VIP | 0.0300% | 0.0000% | 0.0600% |

These are base rates for ordinary perpetual/futures contracts. Bybit warns that
regional/account rates may differ. Pre-Market and Innovation Zone contracts
have separate, higher schedules, so the authenticated symbol response remains
the source of truth.

## Likely source of the API-tier confusion

The VIP qualification table adds an `API Trading Volume <= 20%` condition to
the volume route for VIP 4, VIP 5, and Supreme VIP. That is a **qualification
criterion**, not a statement that API fills are charged VIP 0. It can affect
whether an API-heavy user qualifies for those higher retail tiers by volume.
It does not override Bybit's statement that the current account VIP rate is
applied when an order is placed.

Institutional/Pro API users also receive higher API request-rate capacity.
Those figures are API throughput limits, not trading-fee percentages. Source:
[Bybit V5 Rate Limit Rules](https://bybit-exchange.github.io/docs/v5/rate-limit).

## Evidence from this live account

The transactional short owner stores actual Bybit execution fees when the
execution endpoint supplies them:

- `src/bot/executor.ts` aggregates `execFee` into `cumExecFee`;
- `src/bot/hl-short-transaction-coordinator.ts` prefers that actual fee and
  only falls back to the configured `feeRate` when execution fee evidence is
  unavailable.

I paired the open and close receipts in
`data/HYPEUSDT_hl_short_live_state.json` for nine completed cycles:

| Observation | Result |
|---|---:|
| Completed cycles | 9 |
| Period | 2026-07-28 to 2026-08-10 |
| Mean entry fee rate | 0.054996% |
| Mean derived exit fee rate | 0.054783% |
| Normal observed rate | approximately 0.0550% per leg |

Eight of nine derived exit legs are effectively `0.055%`; one is about
`0.05305%`. The dominant and current evidence is therefore VIP 0 standard
perpetual pricing. The small outlier does not support a different stable fee
tier.

This evidence answers **what the account has paid recently**. It does not imply
the rate remains fixed after a future VIP-level change.

## Project implications

Current static assumptions:

- `bot-config.json`: `feeRate = 0.00055`;
- `hl-short-live-config.json`: `feeRate = 0.00055`;
- `src/bot/maker-tp-fill-shadow.ts`: taker `0.00055`, maker `0.0002`;
- canonical HYPE replays default to `0.00055`.

At VIP 0 those assumptions are correct and conservative for standard
HYPEUSDT taker fills.

After a VIP upgrade:

1. **Exchange charging changes automatically.** API-created fills should use
   the new account/symbol rate.
2. **The live short is partly robust already.** Its durable receipts use actual
   execution fees when Bybit returns them; the static value remains a fallback.
3. **Long local accounting remains static.** Long opens/closes and partial-close
   realized PnL are generally computed with `config.feeRate`, so the bot would
   conservatively understate realized PnL if the actual rate fell.
4. **Some S/R economics become conservative.** The live partial-exit plan's
   `estimatedNetPnl > 0` check uses the configured fee. A lower actual fee could
   make a marginally profitable partial look unprofitable locally. Core TP,
   hard-flatten, and emergency thresholds use price percentages rather than the
   fee constant.
5. **Historical simulations remain conservative** until explicitly rerun at
   the verified tier.
6. **Maker-TP savings would be overstated after VIP 0.** Both taker and maker
   rates fall, and the taker-minus-maker spread changes. At VIP 1 the exit-leg
   spread is `0.022%`, not the VIP 0 `0.035%` used by the observer.

## Dollar sensitivity

Using the current `$25,000` short and the configured 11-rung long ladder
(`$800`, `1.35x`, total nominal entries about `$59,757`):

| Case | VIP 0 taker RT | VIP 1 taker RT | VIP 1 saving |
|---|---:|---:|---:|
| One `$25k` short cycle | $27.50 | $20.00 | $7.50 |
| One full 11-rung long cycle | $65.73 | $47.81 | $17.93 |

For a maker exit, the estimated exit-leg saving versus taker changes from:

- `$8.75` to `$5.50` on a `$25k` exit at VIP 1;
- `$20.92` to `$13.15` on a `$59,757` exit at VIP 1.

The account still benefits from the lower overall rate. The narrower
maker-versus-taker spread simply reduces the incremental value attributed to
the maker-TP project.

## Exact account verification

The local read-only key is IP-whitelisted and correctly rejected a request from
this workstation. Run the private fee lookup from the whitelisted VPS:

```bash
cd /opt/bybit-rev

node -e 'require("dotenv").config({quiet:true}); const {RestClientV5}=require("bybit-api"); const c=new RestClientV5({key:process.env.BYBIT_API_KEY,secret:process.env.BYBIT_API_SECRET}); c.getFeeRate({category:"linear",symbol:"HYPEUSDT"}).then(r=>{if(r.retCode!==0)throw new Error(String(r.retMsg)); const x=r.result.list[0]; console.log(JSON.stringify({symbol:x.symbol,takerFeeRate:x.takerFeeRate,makerFeeRate:x.makerFeeRate,serverTime:r.time},null,2));}).catch(e=>{console.error(typeof e?.message==="string"?e.message:"fee lookup failed");process.exit(1);})'
```

This is a read-only account call. Expected VIP 0 output is approximately:

```json
{
  "symbol": "HYPEUSDT",
  "takerFeeRate": "0.00055",
  "makerFeeRate": "0.0002"
}
```

Repeat the lookup after any VIP-level refresh (Bybit says tiers refresh daily
at 07:00 UTC) before changing research or accounting assumptions.

## Verdict

**The belief is false in general, but the repo's present rate is correct for
the account today.** API access does not lock trading fees to VIP 0. A future
VIP promotion should lower the actual API-fill fees; the project then needs a
small, separately reviewed fee-source/accounting update so live reporting,
S/R estimates, replays, and maker-TP counterfactuals use the verified rate.

No live config or code was changed in this research pass.
