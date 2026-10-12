#!/usr/bin/env node
'use strict';

// Offline documentation build. No dependencies, credentials, network or trading calls.
// The Markdown is the only strategy prose source. HTML is a committed build artifact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const historicalReplay = require('./portfolio-replay-reference-view.cjs');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'docs/operations/live-strategy-overview-2026-09-25.md';
const OUTPUT = 'docs/operations/live-strategy-overview.html';
const REFERENCES = [
  'portfolio-live-config.json', 'src/bot/portfolio-live.ts',
  'src/discord-commander.ts', 'src/bot/portfolio-status.ts',
  'src/bot/portfolio/commander.ts', 'src/bot/portfolio/status.ts',
  'src/bot/portfolio/live-config.ts', 'src/bot/portfolio/live-port.ts',
  'src/bot/portfolio/bybit-account.ts', 'src/bot/portfolio/bybit-evidence.ts',
  'src/bot/portfolio/bybit-orders.ts', 'src/bot/portfolio/runtime.ts',
  'src/bot/portfolio/funding.ts', 'src/bot/portfolio/health.ts',
  'bot-config.json', 'sfp-live-config.json', 'hl-short-live-config.json',
  'src/bot/bot-config.ts', 'src/bot/index.ts', 'src/bot/strategy.ts', 'src/bot/state.ts',
  'src/bot/aggressive10-policy.ts', 'src/bot/damaged-regime-latch.ts',
  'src/bot/sr-shadow.ts', 'src/bot/sr-memory-zones.ts', 'src/bot/close-cooldown.ts',
  'src/bot/time-stop.ts', 'src/bot/time-stop-runtime.ts',
  'src/bot/maker-tp-coordinator.ts', 'src/bot/maker-tp-transaction.ts',
  'src/bot/sfp-live.ts', 'src/bot/sfp-config.ts', 'src/bot/sfp-coordinator.ts',
  'src/bot/sfp-exchange.ts', 'src/bot/sfp-candles.ts', 'src/bot/sfp-approach-alert.ts',
  'src/strategies/sfp-detector.ts', 'src/strategies/sfp-policy.ts', 'src/strategies/setup-actions.ts',
  'src/bot/portfolio/contract.ts', 'src/bot/portfolio/allocation.ts',
  'src/bot/portfolio/capital.ts', 'src/bot/portfolio/ledger.ts',
  'src/bot/portfolio/owner-lock.ts', 'src/bot/portfolio/order-command.ts',
  'src/bot/portfolio/execution-coordinator.ts',
  'src/bot/portfolio/protection.ts', 'src/bot/portfolio/owned-exit.ts',
  'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts',
  'src/bot/portfolio/main-bridge.ts',
  'src/bot/portfolio/main-inventory.ts', 'src/bot/portfolio/main-control-state.ts',
  'src/bot/portfolio/main-runtime.ts',
  'src/bot/portfolio/setup-runtime.ts',
  'src/bot/portfolio/main-policy.ts',
  'src/bot/portfolio/main-driver.ts',
  'src/bot/portfolio/main-feed.ts',
  'src/bot/context-manager.ts',
  'scripts/portfolio-vps-preflight.cjs',
  'scripts/portfolio-bracket-probe.cjs',
  'src/bot/portfolio/lifecycle.ts', 'src/bot/portfolio/lifecycle-state.ts',
  'src/bot/portfolio/timed-indicator-signals.ts',
  'src/bot/portfolio/macd-signals.ts', 'src/bot/portfolio/structural-signals.ts',
  'src/bot/portfolio/candle-feed.ts', 'src/bot/portfolio/source-cache.ts',
  'src/bot/portfolio/feed-loader.ts', 'src/bot/portfolio/feed-worker.ts',
  'src/bot/portfolio/feed-health.ts', 'src/bot/portfolio/feed-pump.ts',
  'src/strategies/price-action-signals.ts',
  'src/research/indicator-features.ts', 'src/research/adx-dmi-features.ts',
  'src/research/macd-features.ts',
  'docs/operations/assets/portfolio-replay-data.js',
  'docs/operations/assets/portfolio-replay-manifest.json',
  'docs/operations/assets/portfolio-replay.js', 'docs/operations/assets/portfolio-replay.css',
  'docs/operations/assets/vendor/lightweight-charts-5.0.9.js',
  'scripts/portfolio-replay-reference-view.cjs', 'scripts/build-portfolio-replay-reference.cjs',
];
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n?/g, '\n');
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function inline(s) {
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let out = '', end = 0;
  for (const m of s.matchAll(re)) {
    out += escape(s.slice(end, m.index));
    if (m[1] !== undefined) out += `<code>${escape(m[1])}</code>`;
    else if (m[2] !== undefined) out += `<strong>${inline(m[2])}</strong>`;
    else {
      const href = m[4];
      assert(!/^(?:[a-z]+:|\/\/)/i.test(href) || /^https?:\/\//i.test(href), `Unsupported link: ${href}`);
      out += `<a href="${escape(href)}">${inline(m[3])}</a>`;
    }
    end = m.index + m[0].length;
  }
  return out + escape(s.slice(end));
}

// Deliberately small renderer for this guide: headings, paragraphs, flat lists,
// fenced code, Markdown tables, links, strong emphasis and inline code. Escape raw HTML.
function renderMarkdown(markdown) {
  const rows = markdown.split('\n'), out = [], headings = [], ids = new Set();
  const list = line => /^\s*(-|\d+\.)\s+(.+)$/.exec(line);
  const block = line => /^(?:#{1,6} |```|\|)/.test(line) || !!list(line);
  const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(v => v.trim());
  for (let i = 0; i < rows.length;) {
    const line = rows[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = []; i++;
      while (i < rows.length && !rows[i].startsWith('```')) code.push(rows[i++]);
      assert(i < rows.length, 'Unclosed code fence'); i++;
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); continue;
    }
    const h = /^(#{1,6}) (.+)$/.exec(line);
    if (h) {
      const base = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let id = base, n = 2; while (ids.has(id)) id = `${base}-${n++}`; ids.add(id);
      headings.push({ level: h[1].length, text: h[2], id });
      out.push(`<h${h[1].length} id="${id}">${inline(h[2])}</h${h[1].length}>`); i++; continue;
    }
    if (line.startsWith('|')) {
      const header = cells(line), divider = cells(rows[i + 1] ?? '');
      assert(divider.length === header.length && divider.every(v => /^:?-+:?$/.test(v)), 'Invalid table divider');
      const align = divider.map(v => v.endsWith(':') ? (v.startsWith(':') ? 'center' : 'right') : 'left');
      const table = [`<div class="table-scroll" role="region" tabindex="0" aria-label="${escape(header.filter(Boolean).join(' / '))}"><table><thead><tr>${header.map((v, k) => `<th scope="col" class="align-${align[k]}">${inline(v)}</th>`).join('')}</tr></thead><tbody>`];
      i += 2;
      while (i < rows.length && rows[i].startsWith('|')) {
        const values = cells(rows[i++]); assert(values.length === header.length, 'Table column mismatch');
        table.push(`<tr>${values.map((v, k) => `<td class="align-${align[k]}">${inline(v)}</td>`).join('')}</tr>`);
      }
      table.push('</tbody></table></div>'); out.push(table.join('\n')); continue;
    }
    if (list(line)) {
      const first = list(line), ordered = first[1] !== '-', tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}${ordered && first[1] !== '1.' ? ` start="${parseInt(first[1], 10)}"` : ''}>`);
      while (i < rows.length) {
        const item = list(rows[i]); if (!item || (item[1] !== '-') !== ordered) break;
        let text = item[2]; i++;
        while (i < rows.length && rows[i].trim() && !block(rows[i])) text += ` ${rows[i++].trim()}`;
        out.push(`<li>${inline(text)}</li>`);
      }
      out.push(`</${tag}>`); continue;
    }
    let text = line.trim(); i++;
    while (i < rows.length && rows[i].trim() && !block(rows[i])) text += ` ${rows[i++].trim()}`;
    out.push(`<p>${inline(text)}</p>`);
  }
  return { html: out.join('\n'), headings };
}

// Derive navigation and tabs from the prose, never a second list of strategy rules.
function layoutSections(rendered) {
  const parts = [...rendered.html.matchAll(/<h2 id="([^"]+)">/g)];
  assert(parts.length, 'Guide needs sections');
  let tabs = [];
  const intro = rendered.html.slice(0, parts[0].index);
  const pages = parts.map((p, i) => {
    let content = rendered.html.slice(p.index, parts[i + 1]?.index ?? rendered.html.length);
    if (p[1] === 'historical-replay') content = content.replace('<p><code>PORTFOLIO_REPLAY_REFERENCE</code></p>', historicalReplay.render());
    if (p[1] === 'live-trade-setups') {
      const starts = [...content.matchAll(/<h3 id="([^"]+)">/g)];
      assert(starts.length, 'Live setups need one h3 per strategy');
      tabs = starts.map(t => rendered.headings.find(h => h.id === t[1]));
      const buttons = tabs.map((t, n) => `<button type="button" id="tab-${t.id}" role="tab" aria-controls="panel-${t.id}" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}" data-tab="${t.id}">${inline(t.text)}</button>`).join('');
      const panels = starts.map((t, n) => `<div id="panel-${t[1]}" class="setup-panel" role="tabpanel" aria-labelledby="tab-${t[1]}" data-setup="${t[1]}">${content.slice(t.index, starts[n + 1]?.index ?? content.length)}</div>`).join('\n');
      content = content.slice(0, starts[0].index) + `<div class="setup-tabs" role="tablist" aria-label="Live trade setups">${buttons}</div>` + panels;
    }
    return `<section class="chapter" data-page="${p[1]}" aria-labelledby="${p[1]}">${content}</section>`;
  });
  return { intro, pages: pages.join('\n'), tabs };
}

function documentHtml() {
  const source = read(SOURCE);
  const fingerprint = crypto.createHash('sha256');
  // Includes only public repository files, never .env, production state or account data.
  for (const p of [SOURCE, ...REFERENCES]) fingerprint.update(p + '\0' + read(p) + '\0');
  const revision = fingerprint.digest('hex');
  const rendered = renderMarkdown(source);
  assert(rendered.headings.filter(h => h.level === 1).length === 1, 'Guide needs exactly one title');
  const toc = rendered.headings.filter(h => h.level === 2);
  assert(toc.length, 'Guide needs sections');
  const title = rendered.headings.find(h => h.level === 1).text;
  const links = toc.map(h => `<a href="#${h.id}">${inline(h.text)}</a>`).join('\n');
  const layout = layoutSections(rendered);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="The live HYPE portfolio: setup tabs, position sizing, entry gates, exits and emergency controls.">
<title>${escape(title)}</title>
<link rel="stylesheet" href="assets/portfolio-replay.css">
<!-- Generated by scripts/build-live-strategy-overview.cjs. Edit ${SOURCE}, not this HTML.
Repository reference fingerprint: ${revision}
This fingerprint is a freshness aid, not a semantic audit or proof of VPS deployment. -->
<style>
:root{color-scheme:light;--paper:#f2f5f4;--panel:#fff;--ink:#233632;--muted:#596c65;--line:#dce5df;--accent:#136a52;--soft:#eaf4ee;--mono:Consolas,"SFMono-Regular",monospace}
*{box-sizing:border-box}html{scroll-padding-top:20px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6}[hidden]{display:none!important}
a{color:var(--accent);text-underline-offset:3px}a:hover{color:#083b34}a:focus-visible,button:focus-visible,.table-scroll:focus-visible{outline:3px solid #d6a739;outline-offset:3px}
.skip{position:fixed;left:12px;top:-100px;z-index:3;background:#fff;padding:10px}.skip:focus{top:12px}
.layout{max-width:1480px;margin:auto;display:grid;grid-template-columns:252px minmax(0,1fr);gap:32px;padding:30px 32px 55px}
aside{position:sticky;top:30px;align-self:start;max-height:calc(100vh - 60px);overflow-y:auto;padding-right:5px}.brand{font-size:32px;font-weight:800;letter-spacing:-1px;color:var(--accent)}
.eyebrow{font-size:11px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;color:var(--muted)}.brand-note{color:var(--muted);font-size:13px;margin:3px 0 25px}
nav{display:grid;gap:7px}nav a{display:block;padding:11px 13px;text-decoration:none;font-size:13px;line-height:1.5;border:1px solid transparent;border-radius:8px;color:var(--muted)}nav a:hover,nav a[aria-current="page"]{background:var(--soft);color:var(--accent);border-color:#bdd8c8}nav a[aria-current="page"]{font-weight:650}
.tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:25px}.tools a,.tools button{border:1px solid var(--line);border-radius:6px;background:white;color:var(--ink);padding:6px 9px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}
main{min-width:0}.masthead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}.badge{border-radius:999px;padding:3px 10px;background:var(--soft);color:var(--accent);font-size:11px;font-weight:650}
h1{font-size:36px;line-height:1.15;letter-spacing:-1px;margin:8px 0}h2{font-size:24px;line-height:1.3;margin:0 0 18px;letter-spacing:-.4px}h3{font-size:19px;margin:24px 0 10px;color:var(--accent)}h4{font-size:15px;margin:25px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)}h1,h2,h3,h4{scroll-margin-top:20px}
p{margin:12px 0}li{margin:7px 0;padding-left:2px}ul,ol{padding-left:23px;margin:12px 0}strong{font-weight:650}.intro{padding:0 0 18px}.intro p{font-size:14px;color:var(--muted);margin:8px 0}
.chapter{padding:27px 30px;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:20px}.chapter>p:first-of-type{margin-top:0}
.setup-tabs{display:none;flex-wrap:wrap;gap:7px;padding:12px 0 14px;background:var(--panel);border-bottom:1px solid var(--line);margin-bottom:18px}.js .setup-tabs{display:flex}.setup-tabs button{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:7px;border:1px solid var(--line);background:#f8faf8;color:var(--ink);cursor:pointer}.setup-tabs button[aria-selected="true"]{background:var(--accent);border-color:var(--accent);color:white}.setup-panel>h3{margin-top:0}.setup-panel>p:first-of-type{background:var(--soft);border-left:3px solid var(--accent);padding:13px 15px;border-radius:0 7px 7px 0}
.table-scroll{overflow-x:auto;margin:15px 0 18px;border:1px solid var(--line);border-radius:8px}table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.6}th,td{padding:9px 12px;vertical-align:top;border-bottom:1px solid var(--line)}th{background:var(--soft);font-size:12px;color:#285948}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#f8faf8}td:first-child{font-weight:550}th:first-child{min-width:100px}.align-left{text-align:left}.align-right{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.align-center{text-align:center}
[data-page="commands-incidents-and-manual-intervention"] td:nth-child(2) code{white-space:nowrap}
code{font-family:var(--mono);font-size:.87em;background:#edf2ee;border-radius:4px;padding:2px 4px;overflow-wrap:anywhere}pre{overflow-x:auto;background:#203b35;color:#eef7e9;border-radius:8px;padding:16px;font-size:13px;line-height:1.8}pre code{background:none;padding:0;color:inherit;overflow-wrap:normal}.code-wrap{position:relative}.code-wrap pre{padding-top:42px}.copy-button{position:absolute;right:9px;top:9px;background:#35584c;color:white;border:1px solid #668374;border-radius:4px;padding:3px 10px;cursor:pointer;font:inherit;font-size:11px}
footer{font-size:11px;color:var(--muted);padding:6px 3px}.print-button{display:none}.js .print-button{display:inline-block}
@media(max-width:1050px){.layout{gap:20px;padding:24px;grid-template-columns:215px minmax(0,1fr)}.chapter{padding:22px}}
@media(max-width:760px){.layout{display:block;padding:18px 12px}aside{position:static;max-height:none;padding:0 4px 20px}nav{grid-template-columns:1fr 1fr;gap:4px}nav a{font-size:12px;padding:8px}.brand-note{margin-bottom:13px}.tools{margin-top:12px}.chapter{padding:20px 15px}h2{font-size:21px}h1{font-size:30px}.setup-tabs button{padding:8px 10px}.masthead{margin-top:8px}th,td{padding:8px}th:first-child{min-width:85px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:white;font-size:10pt;color:black;line-height:1.5}.layout{display:block;padding:0;max-width:none}aside,.masthead,.skip,.setup-tabs,.copy-button{display:none!important}.chapter[hidden],.setup-panel[hidden]{display:block!important}.chapter{border:0;padding:12pt 0;margin:0;border-radius:0}h1{font-size:25pt}h2{font-size:17pt;break-after:avoid}h3,h4{break-after:avoid}.table-scroll{overflow:visible}table{font-size:9pt}tr{break-inside:avoid}a{color:inherit}pre{white-space:pre-wrap;background:#eee;color:black}.code-wrap pre{padding-top:16px}html{scroll-padding-top:0}}
</style>
</head>
<body>
<a class="skip" href="#guide">Skip to strategy guide</a>
<div class="layout">
<aside aria-label="Guide navigation">
<div class="brand">HYPE<span aria-hidden="true"> /</span></div>
<p class="brand-note">Live portfolio field guide</p>
<nav aria-label="Contents">${links}</nav>
<div class="tools"><a href="${path.basename(SOURCE)}">Markdown source</a><button class="print-button" type="button">Print / PDF</button></div>
</aside>
<main id="guide" tabindex="-1">
<div class="masthead"><span class="eyebrow">Live strategy documentation</span><span class="badge">Static reference · no live connection</span></div>
<header class="intro">${layout.intro}</header>
${layout.pages}
<footer>From <a href="${path.basename(SOURCE)}">the maintained source</a> · reference <code>${revision.slice(0, 12)}</code> · Static documentation, not an exchange connection.</footer>
</main>
</div>
<script>
document.documentElement.classList.add('js');
document.querySelector('.print-button').addEventListener('click', () => window.print());
const pages = Array.from(document.querySelectorAll('[data-page]'));
const tabs = Array.from(document.querySelectorAll('[data-tab]'));
const panels = Array.from(document.querySelectorAll('[data-setup]'));
let selectedTab = tabs[0]?.dataset.tab;
function route(scroll) {
  let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
  const target = id ? document.getElementById(id) : null;
  const page = target?.closest('[data-page]') || pages[0];
  const panel = target?.closest('[data-setup]');
  if (panel) selectedTab = panel.dataset.setup;
  pages.forEach(p => { p.hidden = p !== page; });
  panels.forEach(p => { p.hidden = p.dataset.setup !== selectedTab; });
  tabs.forEach(t => {
    const selected = t.dataset.tab === selectedTab;
    t.setAttribute('aria-selected', String(selected)); t.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === '#' + page.dataset.page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // Keep the tab bar in view when following a setup deep link.
  if (scroll) (panel ? page : target || page).scrollIntoView({block: 'start'});
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => { location.hash = tab.dataset.tab; });
  tab.addEventListener('keydown', e => {
    const index = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (index === null) return;
    e.preventDefault(); tabs[index].focus(); location.hash = tabs[index].dataset.tab;
  });
});
window.addEventListener('hashchange', () => route(true));
route(false);
document.querySelectorAll('pre').forEach(pre => {
  const wrapper = document.createElement('div'); wrapper.className = 'code-wrap';
  pre.before(wrapper); wrapper.append(pre);
  const button = document.createElement('button'); button.type = 'button'; button.className = 'copy-button';
  button.textContent = 'Copy commands'; button.setAttribute('aria-live', 'polite'); wrapper.append(button);
  button.addEventListener('click', async () => {
    const text = pre.querySelector('code').textContent;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; wrapper.append(area); area.select();
        try { if (!document.execCommand('copy')) throw Error('Copy unavailable'); } finally { area.remove(); }
      }
      button.textContent = 'Copied';
    } catch { button.textContent = 'Select and copy manually'; }
    setTimeout(() => { button.textContent = 'Copy commands'; }, 2200);
  });
});
</script>
<script src="assets/vendor/lightweight-charts-5.0.9.js"></script>
<script src="assets/portfolio-replay-data.js"></script>
<script src="assets/portfolio-replay.js"></script>
</body>
</html>
`;
}

function selfTest() {
  const fixture = '# Title\n\n## Rules\n\nA **strong** `x < 2` [link](guide.md).\n\n- first\n  continued\n- second\n\n1. open\n2. close\n\n| Name | Size |\n|---|---:|\n| test | $800 |\n\n```text\na < b\n```\n\n<script>unsafe</script>';
  const r = renderMarkdown(fixture);
  assert.equal(r.headings.length, 2);
  for (const wanted of ['<strong>strong</strong>', '<code>x &lt; 2</code>', 'href="guide.md"', '<li>first continued</li>', '<ol>', '<td class="align-right">$800</td>', 'a &lt; b', '&lt;script&gt;']) assert(r.html.includes(wanted), wanted);
  assert(!r.html.includes('<script>'));
  assert.throws(() => inline('[bad](javascript:alert)'));
  assert.throws(() => renderMarkdown('```\nunclosed'));
  assert.throws(() => renderMarkdown('| a | b |\n|---|---|\n| missing |'));
  const source = read(SOURCE), output = documentHtml();
  for (const m of source.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(m[1])) continue;
    assert(fs.existsSync(path.resolve(ROOT, path.dirname(SOURCE), m[1].split('#')[0])), `Broken link ${m[1]}`);
  }
  assert.equal((output.match(/<section\b/g) ?? []).length, (output.match(/<\/section>/g) ?? []).length);
  const layout = layoutSections(renderMarkdown(source));
  assert.deepEqual(layout.tabs.map(t => t.text), ['Ladder', 'SFP', 'MACD', 'ADX long', 'ADX short', 'CRSI', 'PA07']);
  const sections = renderMarkdown(source).headings.filter(h => h.level === 2);
  assert.deepEqual(sections.map(h => h.text), ['Operational live config explained', 'Live trade setups',
    'Historical replay', 'Alerts, controls and source pointers', 'Commands, incidents and manual intervention', 'Current PM2 services and cleanup']);
  for (const h of sections) assert(output.includes(`href="#${h.id}"`));
  for (const t of layout.tabs) {
    assert(output.includes(`aria-controls="panel-${t.id}"`));
    assert(output.includes(`aria-labelledby="tab-${t.id}"`));
  }
  const ids = [...output.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM IDs');
  assert.equal((output.match(/role="tabpanel"/g) ?? []).length, 10);
  assert(!/<(?:section|div)[^>]*\shidden(?:\s|>)/.test(output), 'No-JS readers must see all content');
  assert(output.includes('.setup-panel[hidden]{display:block!important}'), 'Print must include every setup');
  const browserScript = output.match(/<script>([\s\S]*?)<\/script>/)[1];
  new (require('node:vm').Script)(browserScript); // Parse without a browser or side effects.
  new (require('node:vm').Script)(read('docs/operations/assets/portfolio-replay.js'));
  assert(browserScript.includes("handlePortfolioCommand") === false, 'Documentation must not execute VPS commands');
  assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(output), 'Guide must render offline');
  historicalReplay.check();
  assert(!output.includes('<code>PORTFOLIO_REPLAY_REFERENCE</code>'), 'Historical mount not rendered');
  for (const m of output.matchAll(/<(?:script|link)[^>]+(?:src|href)="(assets\/[^"]+)"/g)) assert(fs.existsSync(path.join(ROOT, 'docs/operations', m[1])), `Missing local asset ${m[1]}`);
  console.log('Overview checks passed: six pages, seven setup tabs, three history views, IDs/ARIA, print/no-JS, script syntax, links and offline output.');
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert(args.length <= 1 && (!args.length || ['--check', '--test'].includes(args[0])), 'Usage: node scripts/build-live-strategy-overview.cjs [--check|--test]');
    if (args[0] === '--test') selfTest();
    else {
      const html = documentHtml();
      if (args[0] === '--check') {
        historicalReplay.check();
        assert(fs.existsSync(path.join(ROOT, OUTPUT)) && read(OUTPUT) === html,
          'Strategy HTML is missing or stale. Review the guide against live code/config and regenerate with node scripts/build-live-strategy-overview.cjs');
        console.log('Live strategy HTML is current with its Markdown and repository references.');
      } else {
        fs.writeFileSync(path.join(ROOT, OUTPUT), html, 'utf8');
        console.log(`Updated ${OUTPUT}`);
      }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
