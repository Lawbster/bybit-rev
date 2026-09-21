# Bybit HYPE POC / NPOC overlay

Paste the **entire contents** of [HYPE-Bybit-POC-map.pine](HYPE-Bybit-POC-map.pine)
into a new TradingView Pine indicator, save, then choose **Add to chart**.
Use **BYBIT:HYPEUSDT.P**. No publishing or API key is needed.

This is a saved-map viewer, not a new indicator calculation or strategy. It uses
the exact accepted Bybit executed-base-volume profiles from our research map.
It does not substitute TradingView candle volume, combine exchanges, or alter the bot.

## What is included

- 646 daily, 90 weekly and 18 monthly eligible profiles across the canonical history.
- History begins December 5, 2024; partial/unverified periods are excluded.
- **Data ends September 15, 2026 at 20:20 UTC. Nothing after that is verified.**
- Each line is the center of a $0.10 POC bin; optional bands show the full bin.
- UTC day/week/month boundaries; weeks start Monday. Profiles become visible at
  period end plus the research map's modeled 60-second publication delay.
- Weekly/monthly POCs come from their full volume distributions, not averaged daily POCs.

## Reading and controlling it

| Appearance | Meaning |
|---|---|
| Aqua / orange / purple | Daily / weekly / monthly profile |
| Solid, `NPOC` | No observed retest or coverage uncertainty **as of the displayed time** |
| Faded dotted, `tested` | Retest evidence known by that time |
| Gray dashed, `uncertain` | Coverage gaps prevent certifying the level as naked |

Labels give the profile's **start date**, price and state. Hover for publication time,
bin boundaries and known retest/coverage timestamps. Retests mean trades inside the
bin `[lower, upper)`, not necessarily an exact touch of the center line. A known retest
after a coverage gap proves the level was tested, but cannot establish its first touch.

Defaults show all three periods, recent retested profiles (published within 60 days),
and all still-untested/uncertain profiles. Turn off **Include retested POCs** for a cleaner
NPOC view. Toggle periods independently. Coincident levels remain separate profiles;
their labels can overlap, so hide labels or inspect one period at a time if needed.

The complete data is embedded, but at most 400 levels are drawn at once (default 150).
The table shows drawn versus matching counts. Newest publications win the display limit;
monthly precedes weekly precedes daily for equal publication timestamps. Set the age
limit to 0 and adjust the historical as-of time to inspect older sections. This limit
is deliberate: Pine permits at most 500 line objects per script, so the full map cannot
be drawn simultaneously. [Pine drawing limits](https://www.tradingview.com/pine-script-docs/visuals/lines-and-boxes/)

## Historical timing and snapshot limits

The top-right table's **Status @** is authoritative. The overlay projects retest and
uncertainty states at the earlier of the chart/replay clock, optional custom as-of
time, and dataset cutoff. A level cannot appear before its publication time, and a
future retest cannot mark it tested in an earlier view. On an unconfirmed chart bar,
the clock uses that bar's opening timestamp; use minute charts for minute-level inspection.
For custom as-of input, set the chart timezone to UTC to enter the intended time.

Retested segments end when the retest became known (closed-minute evidence), not at
the underlying trade's intraminute timestamp. Some profiles were already tested when
published: they have a label but no visible-length untouched segment. Line color shows
status at the chosen as-of time, not a continuous record of every state transition.

Untested/uncertain right extensions are **visual references only**, including beyond
the cutoff. They do not claim a level remains naked now. Disable the extension option
to stop them at the as-of time. The indicator does not inspect new chart candles for
retests or calculate new daily/weekly/monthly POCs. Refreshing TradingView cannot refresh
the embedded dataset; a newer independently accepted local map must be exported again.

This is a visual research aid, not a TradingView strategy/backtest or live signal feed.
The export and timestamp projection are locally tested. TradingView compilation and
visual rendering still need confirmation in Pine Editor; there is no Pine compiler in
this workspace or the connected MCP.

The initial export hit Pine's `CE10205` (oversized `if` block). The exporter now
puts each data chunk in a separate first-bar block; all chunks still load in the
same order and retain the same levels and timestamps. If you copied the first
version, replace the **whole script** with the regenerated `.pine` file.
This follows TradingView's recommendation to split oversized conditional blocks.
[Compiler error guidance](https://www.tradingview.com/pine-script-docs/v5/error-messages/#the-if-statement-is-too-long)

## Reproduce without rebuilding the map

From the repository root:

```powershell
npx ts-node scripts/poc-pine-export.ts
npx ts-node scripts/poc-pine-tests.ts
```

The exporter follows `backtests/poc-viewers/latest.json`, checks the accepted map hash
and independent verification receipt, and overwrites only its two generated export
files in this directory. It does **not** fetch data or reconstruct profiles. The adjacent
manifest records source identity, cutoff, counts and hashes. Source template:
`scripts/templates/poc-map-overlay.pine`; modify that, then regenerate.
