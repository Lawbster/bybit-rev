/* Offline historical reference UI. No account connection or strategy execution. */
(() => {
  'use strict';
  const data = window.PORTFOLIO_REPLAY, LC = window.LightweightCharts;
  const $ = id => document.getElementById(id), root = $('historical-replay-app');
  if (!root || !data) return;
  const labels = { Ladder: 'Ladder', SF08: 'SFP', R3: 'MACD', L2: 'ADX long', R5: 'ADX short', CRSI: 'CRSI', PA07: 'PA07' };
  const reasons = { tp: 'Take profit', stale_tp: 'Stale TP', sr_partial: 'S/R partial', hard_flatten: 'Hard flatten',
    'research_exit:exit_2d_1pct': '48h high exit', 'research_exit:cut_HF21_TS40_r0': 'Weak-week stop',
    funding_spike: 'Funding spike', timeout: 'Timeout', target: 'Target', stop: 'Stop', open_at_cutoff: 'Open at cutoff', indicator: 'Indicator reversal' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, decimals = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(v);
  const utc = at => at == null ? 'Open at cutoff' : new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  const signed = v => `<span class="${v < 0 ? 'replay-bad' : 'replay-good'}">${v > 0 ? '+' : ''}${money(v, 2)}</span>`;
  let current = data.paths[0], view = 'monthly', page = 0, sort = 'entryAt', direction = -1, selected = null;
  let chart, candleSeries, markerApi, equityChart, equitySeries, timeframe = 60, selectedLines = [];
  const size = 50;
  function filtered() {
    return current.trades.filter(t => ($('replay-setup').value === 'all' || t.setup === $('replay-setup').value)
      && ($('replay-side').value === 'all' || String(t.side) === $('replay-side').value)
      && ($('replay-month').value === 'all' || (t.exitAt == null ? 'open' : new Date(t.exitAt).toISOString().slice(0, 7)) === $('replay-month').value)
      && ($('replay-result').value === 'all' || ($('replay-result').value === 'open' ? t.exitAt == null : t.exitAt != null && ($('replay-result').value === 'win' ? t.net > 0 : t.net < 0)))
      && (! $('replay-search').value || (t.id + ' ' + (reasons[t.reason] || t.reason)).toLowerCase().includes($('replay-search').value.toLowerCase())))
      .sort((a, b) => { const av = a[sort] ?? Infinity, bv = b[sort] ?? Infinity; return direction * (typeof av === 'string' ? av.localeCompare(bv) : av - bv) || a.entryAt - b.entryAt; });
  }
  function summary() {
    const s = current.summary;
    $('replay-summary').innerHTML = [
      ['Net after costs', money(s.net), `${money(data.seed, 2)} starting equity`],
      ['Full-period max DD', s.ddPct.toFixed(2) + '%', `${money(s.ddUsd)} largest dollar drawdown`],
      ['Closed trades', s.closed.toLocaleString('en-US'), `${s.wins} wins · ${s.losses} losses · ${s.open} still open`],
      ['Ending equity', money(s.ending), `Includes open inventory at the cutoff`],
    ].map(([title, value, note]) => `<div class="replay-card"><span>${title}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
    $('replay-month-rows').innerHTML = current.monthly.map(m => `<tr><td><button type="button" data-month-pick="${m.month}">${m.month}${m.month === '2026-10' ? ' *' : ''}</button></td><td>${signed(m.net)}</td><td>${m.wins} / ${m.losses}</td><td>${money(m.ending)}</td><td>${money(m.ddUsd)}</td><td title="Worst drawdown this month measured from any earlier account peak: ${m.carriedDdPct.toFixed(2)}%">${m.ddPct.toFixed(2)}%</td></tr>`).join('');
    $('replay-attribution').innerHTML = `<table class="replay-numbers"><thead><tr><th>Month</th>${Object.values(labels).map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${current.monthly.map(m => `<tr><td>${m.month}</td>${Object.keys(labels).map(s => `<td>${signed(m.bySetup[s] ?? 0)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const stress = data.stress.find(s => s.tp === current.key);
    $('replay-stress').innerHTML = `<strong>Execution sensitivity matters.</strong> The saved +5 bps adverse market-fill test made ${money(stress.net)} with ${stress.ddPct.toFixed(2)}% DD at its original $19,000 seed. That is a separate stress path, not the trades plotted here. Native results are not a forecast.`;
    $('replay-month-rows').querySelectorAll('[data-month-pick]').forEach(b => b.onclick = () => { $('replay-month').value = b.dataset.monthPick; page = 0; refreshTrades(); location.hash = 'replay-trades'; });
    if (equitySeries) equitySeries.setData(current.equity.map(([time, value]) => ({ time, value })));
  }
  function refreshTrades() {
    const rows = filtered(); page = Math.max(0, Math.min(page, Math.ceil(rows.length / size) - 1));
    if (selected && !rows.some(t => t.id === selected)) {
      selected = null;
      if (candleSeries) selectedLines.forEach(l => candleSeries.removePriceLine(l)); selectedLines = [];
      $('replay-selection').textContent = 'Selected trade is outside the filters. Choose another trade or clear filters.';
    }
    $('replay-count').textContent = `${rows.length} episodes · partial rows are detail, not additional trades`;
    $('replay-trade-rows').innerHTML = rows.slice(page * size, (page + 1) * size).map(t => {
      const index = current.trades.indexOf(t);
      let html = `<tr data-selected="${selected === t.id}"><td>${esc(labels[t.setup])} · ${t.side === 1 ? 'long' : 'short'}<small>${t.setup === 'Ladder' ? esc(t.id) + ' · max ' + t.maxRungs + ' rungs · ' + t.adds + ' buys' : 'slot ' + esc(t.owner)}</small></td><td>${utc(t.entryAt)}</td><td>${utc(t.exitAt)}</td><td title="Cumulative buys: ${money(t.notional, 2)}">${money(t.peakNotional)}</td><td>${signed(t.net)}${t.exitAt == null ? '<small>marked, not realized</small>' : ''}</td><td>${esc(reasons[t.reason] || t.reason)}${t.partials.length ? '<small>includes ' + t.partials.length + ' partials</small>' : ''}</td><td><button type="button" data-trade-pick="${index}">View</button></td></tr>`;
      if ($('replay-partials').checked) html += t.partials.map(p => `<tr class="replay-partial"><td>↳ Partial detail</td><td>Within parent ladder</td><td>${utc(p.at)}</td><td>${money(p.notional)} closed</td><td>${money(p.netBeforeFunding, 2)}<small>before funding; included above</small></td><td>${esc(reasons[p.reason] || p.reason)}</td><td><button type="button" data-trade-pick="${index}" data-partial-at="${p.at}">View</button></td></tr>`).join('');
      return html;
    }).join('') || '<tr><td colspan="7">No trades match these filters.</td></tr>';
    $('replay-page').textContent = rows.length ? `${page * size + 1}–${Math.min((page + 1) * size, rows.length)} of ${rows.length} episodes` : '0 trades';
    $('replay-prev').disabled = page === 0; $('replay-next').disabled = (page + 1) * size >= rows.length;
    root.querySelectorAll('[data-replay-sort]').forEach(b => b.parentElement.setAttribute('aria-sort', b.dataset.replaySort === sort ? (direction < 0 ? 'descending' : 'ascending') : 'none'));
    $('replay-trade-rows').querySelectorAll('[data-trade-pick]').forEach(b => b.onclick = () => selectTrade(current.trades[+b.dataset.tradePick], true, +b.dataset.partialAt || undefined));
    refreshMarkers();
  }
  function chartOptions(height) {
    return { height, autoSize: true, layout: { background: { color: '#ffffff' }, textColor: '#596c65', attributionLogo: true },
      grid: { vertLines: { color: '#edf2ee' }, horzLines: { color: '#edf2ee' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#dce5df' }, rightPriceScale: { borderColor: '#dce5df' },
      localization: { timeFormatter: t => utc(Number(t) * 1000) + ' UTC' } };
  }
  function makeCharts() {
    if (!LC) { $('replay-price-chart').textContent = 'Local chart library missing. Tables and CSV still work.'; return; }
    if (view === 'monthly' && !equityChart) {
      equityChart = LC.createChart($('replay-equity'), chartOptions(200));
      equitySeries = equityChart.addSeries(LC.AreaSeries, { lineColor: '#136a52', topColor: '#d5eadb', bottomColor: '#ffffff', priceLineVisible: false });
      equitySeries.setData(current.equity.map(([time, value]) => ({ time, value }))); equityChart.timeScale().fitContent();
    }
    if (view !== 'chart' || chart) return;
    chart = LC.createChart($('replay-price-chart'), chartOptions(innerWidth < 760 ? 370 : 470));
    candleSeries = chart.addSeries(LC.CandlestickSeries, { upColor: '#168565', downColor: '#b64a57', borderVisible: false, wickUpColor: '#168565', wickDownColor: '#b64a57', priceLineVisible: false });
    markerApi = LC.createSeriesMarkers(candleSeries, [], { autoScale: true });
    setCandles(); chart.timeScale().fitContent();
    chart.subscribeClick(p => {
      const id = p.hoveredObjectId;
      if (typeof id === 'string' && id.startsWith('trade-')) selectTrade(current.trades[Number(id.slice(6))], false);
    });
  }
  function setCandles() {
    if (!candleSeries) return;
    const bars = []; let b;
    for (const [at, open, high, low, close] of data.candles) {
      const time = Math.floor(at / (timeframe * 60)) * timeframe * 60;
      if (!b || b.time !== time) { b = { time, open, high, low, close }; bars.push(b); }
      else { b.high = Math.max(b.high, high); b.low = Math.min(b.low, low); b.close = close; }
    }
    candleSeries.setData(bars); refreshMarkers();
  }
  function refreshMarkers() {
    if (!markerApi) return;
    const allowed = new Set(filtered().map(t => t.id)), indices = new Map(current.trades.map((t, i) => [t.id, i]));
    const showAdds = $('replay-adds').checked;
    const markers = current.markers.filter(m => allowed.has(m.id) && (m.kind !== 'open' || m.entry || showAdds)).map(m => ({
      time: Math.floor(Math.min(m.at, data.end - 1) / (timeframe * 60000)) * timeframe * 60,
      position: m.kind === 'open' ? (m.side === 1 ? 'belowBar' : 'aboveBar') : 'aboveBar',
      color: m.kind === 'open' ? (m.side === 1 ? '#14795b' : '#7043ad') : m.partial ? '#b87816' : '#2d71ae',
      shape: m.kind === 'open' ? (m.side === 1 ? 'arrowUp' : 'arrowDown') : m.partial ? 'circle' : 'square',
      size: selected === m.id ? 1.5 : .6, id: 'trade-' + indices.get(m.id),
      text: selected === m.id && (m.entry || m.kind === 'close' && !m.partial)
        ? (m.entry ? 'Entry ' : 'Exit ') + m.price.toFixed(3) : '',
    })).sort((a, b) => a.time - b.time);
    markerApi.setMarkers(markers);
  }
  function selectTrade(t, zoom, at) {
    if (!t) return;
    selected = t.id;
    if (view !== 'chart') { view = 'chart'; location.hash = 'replay-chart'; showView(); }
    makeCharts();
    $('replay-selection').innerHTML = `<strong>${esc(labels[t.setup])} ${t.side === 1 ? 'long' : 'short'} · ${signed(t.net)}</strong> · ${esc(reasons[t.reason] || t.reason)}<br>${utc(t.entryAt)} → ${utc(t.exitAt)} UTC · first entry ${t.entryPrice.toFixed(4)}${t.exitPrice == null ? '' : ' · final exit ' + t.exitPrice.toFixed(4)} · peak size ${money(t.peakNotional)}<br><span class="replay-muted">${esc(t.id)} · fees ${money(t.fees, 2)} · funding paid ${money(t.funding, 2)}${t.exitAt == null ? ' · still open; PnL includes cutoff mark' : ''}</span><details><summary>${t.events.length} fills / rung actions</summary><ul>${t.events.map(e => `<li>${utc(e.at)} UTC · ${esc(e.kind)} ${e.qty.toFixed(4)} @ ${e.price.toFixed(4)} · ${esc(reasons[e.reason] || e.reason)}</li>`).join('')}</ul></details>`;
    if (candleSeries) {
      selectedLines.forEach(l => candleSeries.removePriceLine(l)); selectedLines = [];
      selectedLines.push(candleSeries.createPriceLine({ price: t.entryPrice, color: '#697783', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'First entry' }));
      if (t.exitPrice != null) selectedLines.push(candleSeries.createPriceLine({ price: t.exitPrice, color: '#2d71ae', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Final exit' }));
    }
    if (zoom && chart) {
      const start = at ?? t.entryAt, end = at ?? t.exitAt ?? data.end;
      chart.timeScale().setVisibleRange({ from: Math.max(data.start / 1000, start / 1000 - 86400), to: Math.min(data.end / 1000, end / 1000 + 86400) });
    }
    refreshTrades();
  }
  function showView() {
    root.querySelectorAll('[data-history-panel]').forEach(p => { p.hidden = p.dataset.historyPanel !== view; });
    root.querySelectorAll('[data-history-tab]').forEach(b => { const on = b.dataset.historyTab === view; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('replay-filters').hidden = view === 'monthly';
    if (!$('historical-replay').closest('[data-page]').hidden) requestAnimationFrame(makeCharts);
  }
  function route() { const hash = location.hash.slice(1); if (['replay-monthly', 'replay-chart', 'replay-trades'].includes(hash)) view = hash.slice(7); showView(); }
  root.querySelectorAll('[data-history-tab]').forEach((b, i, list) => {
    b.onclick = () => { view = b.dataset.historyTab; location.hash = 'replay-' + view; showView(); };
    b.onkeydown = e => { const n = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : null; if (n != null) { e.preventDefault(); list[n].focus(); list[n].click(); } };
  });
  $('replay-model').onchange = () => { current = data.paths.find(p => p.key === $('replay-model').value); selected = null; page = 0;
    if (candleSeries) selectedLines.forEach(l => candleSeries.removePriceLine(l)); selectedLines = [];
    $('replay-selection').textContent = 'Choose a trade in the list or click a chart marker.'; summary(); refreshTrades(); };
  for (const id of ['replay-setup', 'replay-side', 'replay-month', 'replay-result', 'replay-partials']) $(id).onchange = () => { page = 0; refreshTrades(); };
  $('replay-search').oninput = () => { page = 0; refreshTrades(); };
  $('replay-clear').onclick = () => { for (const id of ['replay-setup', 'replay-side', 'replay-month', 'replay-result']) $(id).value = 'all'; $('replay-search').value = ''; page = 0; refreshTrades(); };
  root.querySelectorAll('[data-replay-sort]').forEach(b => b.onclick = () => { direction = sort === b.dataset.replaySort ? -direction : -1; sort = b.dataset.replaySort; page = 0; refreshTrades(); });
  $('replay-prev').onclick = () => { page--; refreshTrades(); }; $('replay-next').onclick = () => { page++; refreshTrades(); };
  $('replay-timeframe').onchange = () => { const range = chart?.timeScale().getVisibleRange(); timeframe = +$('replay-timeframe').value; setCandles(); if (range) chart.timeScale().setVisibleRange(range); };
  $('replay-fit').onclick = () => chart?.timeScale().fitContent();
  $('replay-zoom-out').onclick = () => { const r = chart?.timeScale().getVisibleLogicalRange(); if (r) { const pad = (r.to - r.from) / 2; chart.timeScale().setVisibleLogicalRange({ from: r.from - pad, to: r.to + pad }); } };
  $('replay-adds').onchange = refreshMarkers;
  $('replay-export').onclick = () => {
    const rows = [['row_type', 'parent_id', 'setup', 'side', 'entry_utc', 'exit_utc', 'entry_price', 'exit_price', 'peak_notional', 'episode_net_including_funding', 'partial_net_before_funding_detail_only', 'reason']];
    for (const t of filtered()) {
      rows.push(['episode', t.id, labels[t.setup], t.side === 1 ? 'long' : 'short', utc(t.entryAt), utc(t.exitAt), t.entryPrice, t.exitPrice ?? '', t.peakNotional, t.net, '', t.reason]);
      if ($('replay-partials').checked) for (const p of t.partials) rows.push(['partial_detail', t.id, labels[t.setup], 'long', '', utc(p.at), '', p.price, '', '', p.netBeforeFunding, p.reason]);
    }
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = `HYPE-historical-replay-${current.key}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  summary(); refreshTrades(); route(); window.addEventListener('hashchange', route);
})();
