'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { check } = require('./build-portfolio-replay-reference.cjs');
const ROOT = path.resolve(__dirname, '..');
const money = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
function load() {
  const text = fs.readFileSync(path.join(ROOT, 'docs/operations/assets/portfolio-replay-data.js'), 'utf8');
  return JSON.parse(text.slice(text.indexOf(' = ') + 3).trim().replace(/;$/, ''));
}
function render() {
  const d = load(), p = d.paths[0];
  const rows = p.monthly.map(m => `<tr><td>${m.month}${m.month === '2026-10' ? ' *' : ''}</td><td>${money(m.net)}</td><td>${m.wins} / ${m.losses}</td><td>${money(m.ending)}</td><td>${money(m.ddUsd)}</td><td>${m.ddPct.toFixed(2)}%</td></tr>`).join('');
  return `<div id="historical-replay-app">
<div class="replay-toolbar"><label>Fill model <select id="replay-model"><option value="resting_touch">Resting touch</option><option value="close_confirmed">Close confirmed</option></select></label><span class="replay-muted">Alternative paths, not combined allocations · UTC</span></div>
<div id="replay-summary" class="replay-cards" aria-live="polite"></div>
<div class="replay-tabs" role="tablist" aria-label="Historical replay views">
<button id="history-tab-monthly" role="tab" aria-controls="replay-monthly" aria-selected="true" data-history-tab="monthly">Monthly</button>
<button id="history-tab-chart" role="tab" aria-controls="replay-chart" aria-selected="false" tabindex="-1" data-history-tab="chart">Chart</button>
<button id="history-tab-trades" role="tab" aria-controls="replay-trades" aria-selected="false" tabindex="-1" data-history-tab="trades">Trades</button></div>
<div id="replay-monthly" role="tabpanel" aria-labelledby="history-tab-monthly" data-history-panel="monthly">
<div class="table-scroll" tabindex="0"><table class="replay-numbers"><thead><tr><th>Month</th><th>Net PnL</th><th>Wins / losses</th><th>Ending equity</th><th>Monthly DD $</th><th>Monthly DD %</th></tr></thead><tbody id="replay-month-rows">${rows}</tbody></table></div>
<div id="replay-equity" class="replay-equity" aria-label="Historical marked equity curve"></div>
<details><summary>Monthly contribution by setup</summary><div id="replay-attribution" class="table-scroll" tabindex="0"></div></details>
<div id="replay-stress" class="replay-notice"></div>
</div>
<div id="replay-filters" class="replay-toolbar">
<label>Setup <select id="replay-setup"><option value="all">All setups</option><option>Ladder</option><option value="SF08">SFP</option><option value="R3">MACD</option><option value="L2">ADX long</option><option value="R5">ADX short</option><option>CRSI</option><option>PA07</option></select></label>
<label>Direction <select id="replay-side"><option value="all">Both</option><option value="1">Long</option><option value="-1">Short</option></select></label>
<label>Exit month <select id="replay-month"><option value="all">All months</option>${p.monthly.map(m => `<option>${m.month}</option>`).join('')}<option value="open">Open at cutoff</option></select></label>
<label>Result <select id="replay-result"><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="open">Open</option></select></label>
<button id="replay-clear" type="button">Clear filters</button><span id="replay-count" class="replay-muted" aria-live="polite"></span></div>
<div id="replay-chart" role="tabpanel" aria-labelledby="history-tab-chart" data-history-panel="chart">
<div class="replay-toolbar"><label>Candles <select id="replay-timeframe"><option value="15">15 minutes</option><option value="60" selected>1 hour</option><option value="240">4 hours</option></select></label><button id="replay-fit" type="button">Whole period</button><button id="replay-zoom-out" type="button">Zoom out</button><label><input type="checkbox" id="replay-adds"> Show ladder adds</label></div>
<p class="replay-muted">Green ▲ long entry · purple ▼ short entry · amber ● partial · blue ■ final exit. Select a marker or a trade row for exact UTC fills. Display candles are aggregated; fills are not rounded to those candles.</p>
<div id="replay-price-chart" class="replay-price-chart" aria-label="HYPE price and simulated trade markers"></div>
<div id="replay-selection" class="replay-selection" aria-live="polite">Choose a trade in the list or click a chart marker.</div>
<p class="replay-muted">Charting by <a href="https://www.tradingview.com/">TradingView Lightweight Charts</a> · local saved candles, no login or subscription.</p></div>
<div id="replay-trades" role="tabpanel" aria-labelledby="history-tab-trades" data-history-panel="trades">
<div class="replay-toolbar"><label><input type="checkbox" id="replay-partials" checked> Show partial detail rows</label><button id="replay-export" type="button">Export filtered CSV</button><label>Find <input id="replay-search" type="search" placeholder="ID or exit reason" maxlength="150"></label></div>
<div class="table-scroll replay-trade-scroll" tabindex="0"><table class="replay-trade-table"><thead><tr>
${[['setup', 'Setup / side'], ['entryAt', 'Entry UTC'], ['exitAt', 'Exit UTC'], ['peakNotional', 'Peak size'], ['net', 'Net $'], ['reason', 'Exit reason']].map(([k, name]) => `<th scope="col"><button type="button" data-replay-sort="${k}">${name}</button></th>`).join('')}
<th scope="col">Chart</th></tr></thead><tbody id="replay-trade-rows"></tbody></table></div>
<div class="replay-toolbar"><button id="replay-prev" type="button">Previous</button><span id="replay-page" aria-live="polite"></span><button id="replay-next" type="button">Next</button></div></div>
<noscript><p>The default monthly table is available above. Enable JavaScript for model selection, charts and the full trade list.</p></noscript>
</div>`;
}
module.exports = { render, load, check };
