#!/usr/bin/env node
'use strict';

// Offline documentation build. No dependencies, credentials, network or trading calls.
// The Markdown is the only strategy prose source. HTML is a committed build artifact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
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
  'scripts/portfolio-vps-preflight.cjs',
  'scripts/portfolio-bracket-probe.cjs',
  'src/bot/portfolio/lifecycle.ts', 'src/bot/portfolio/lifecycle-state.ts',
  'src/bot/portfolio/timed-indicator-signals.ts',
  'src/bot/portfolio/macd-signals.ts', 'src/bot/portfolio/structural-signals.ts',
  'src/bot/portfolio/candle-feed.ts', 'src/bot/portfolio/source-cache.ts',
  'src/bot/portfolio/feed-loader.ts', 'src/bot/portfolio/feed-worker.ts',
  'src/bot/portfolio/feed-health.ts', 'src/bot/portfolio/feed-pump.ts',
  'src/strategies/price-action-signals.ts',
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
  const body = rendered.html.replace(/<h2 id="([^"]+)">/g, '</section>\n<section class="chapter" aria-labelledby="$1"><h2 id="$1">');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="HYPE ladder and LAWBSTER SFP: sizing, entries, blocks, exits and operational safeguards.">
<title>${escape(title)}</title>
<!-- Generated by scripts/build-live-strategy-overview.cjs. Edit ${SOURCE}, not this HTML.
Repository reference fingerprint: ${revision}
This fingerprint is a freshness aid, not a semantic audit or proof of VPS deployment. -->
<style>
:root{color-scheme:light;--paper:#f5f4ee;--panel:#fff;--ink:#202f34;--muted:#5e6b70;--line:#dce3dc;--accent:#14685c;--soft:#e9f3ec;--mono:Consolas,"SFMono-Regular",monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:34px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.75}
a{color:var(--accent);text-underline-offset:3px}a:hover{color:#083b34}a:focus-visible,button:focus-visible,.table-scroll:focus-visible{outline:3px solid #dfaa3c;outline-offset:4px}
.skip{position:fixed;left:12px;top:-100px;z-index:3;background:#fff;padding:10px}.skip:focus{top:12px}
.layout{max-width:1460px;margin:auto;display:grid;grid-template-columns:264px minmax(0,1fr);gap:48px;padding:40px 42px 70px}
aside{position:sticky;top:32px;align-self:start;max-height:calc(100vh - 64px);overflow-y:auto;padding-right:8px}
.brand{font-size:28px;font-weight:800;letter-spacing:-1px;color:var(--accent)}.eyebrow{font-size:11px;letter-spacing:1.7px;font-weight:700;text-transform:uppercase;color:var(--muted)}
.brand-note{color:var(--muted);font-size:13px;line-height:1.6;margin:8px 0 27px}nav{display:grid;gap:6px;margin-top:12px}nav a{display:block;padding:10px 12px;text-decoration:none;font-size:13px;line-height:1.5;border:1px solid transparent;border-radius:9px;color:var(--muted)}nav a:hover,nav a[aria-current="location"]{background:var(--soft);color:var(--accent);border-color:#c6dacb}
.tools{display:flex;flex-wrap:wrap;gap:9px;margin-top:25px}.tools a,.tools button{border:1px solid var(--line);border-radius:7px;background:white;color:var(--ink);padding:7px 10px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}
.legend{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:17px;margin-top:24px}.legend strong{display:block;color:var(--ink);margin-bottom:5px}
main{min-width:0}.masthead{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-bottom:15px}.badge{border-radius:999px;padding:4px 11px;background:var(--soft);color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
h1{font-size:clamp(30px,3.3vw,47px);line-height:1.16;letter-spacing:-1.5px;margin:14px 0 25px;max-width:820px}h2{font-size:25px;line-height:1.3;letter-spacing:-.55px;margin:0 0 25px;border-bottom:2px solid var(--soft);padding-bottom:20px}h3{font-size:18px;line-height:1.5;margin:30px 0 13px;color:var(--accent)}h1,h2,h3{scroll-margin-top:32px}
p{margin:14px 0}li{margin:8px 0;padding-left:3px}ul,ol{padding-left:24px;margin:15px 0}strong{font-weight:650}.intro{padding:0 2px 20px}.intro p{font-size:14px;color:var(--muted);max-width:900px}.intro p:last-child{background:#fff4de;color:#674711;border-left:3px solid #d7a14e;border-radius:0 8px 8px 0;padding:15px 18px}
.chapter{padding:32px 34px;background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:25px;box-shadow:0 3px 12px #20302b04}.chapter:target{border-color:#83ac97}
.table-scroll{overflow-x:auto;margin:20px 0 23px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.6}th,td{padding:13px 15px;vertical-align:top;border-bottom:1px solid var(--line)}th{background:var(--soft);font-size:12px;color:#285948;font-weight:700}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#f8faf7}td:first-child{font-weight:550}th:first-child{min-width:110px}.align-left{text-align:left}.align-right{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.align-center{text-align:center}
code{font-family:var(--mono);font-size:.86em;background:#f0f3ef;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}pre{overflow-x:auto;background:#203b35;color:#eef7e9;border-radius:9px;padding:20px;font-size:14px;line-height:1.8}pre code{background:none;padding:0;color:inherit;overflow-wrap:normal}
footer{font-size:12px;color:var(--muted);padding:8px 3px}footer code{font-size:11px}.print-button{display:none}.js .print-button{display:inline-block}
@media(max-width:1050px){.layout{gap:26px;padding:25px;grid-template-columns:220px minmax(0,1fr)}.chapter{padding:25px}body{font-size:15px}}
@media(max-width:760px){.layout{display:block;padding:20px 14px}aside{position:static;max-height:none;padding:0 5px 25px}nav{grid-template-columns:1fr 1fr;gap:4px}nav a{font-size:12px;padding:8px}.brand-note{margin-bottom:14px}.legend{display:none}.tools{margin-top:14px}.chapter{padding:22px 17px;border-radius:10px}h2{font-size:21px}h1{font-size:32px}.masthead{margin-top:12px}th,td{padding:10px;min-width:150px}.align-right{min-width:90px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:white;font-size:10pt;color:black;line-height:1.5}.layout{display:block;padding:0;max-width:none}aside,.masthead,.skip{display:none}.chapter{border:0;box-shadow:none;padding:12pt 0;margin:0;border-radius:0}h1{font-size:25pt}h2{font-size:17pt;break-after:avoid}h3{break-after:avoid}.table-scroll{overflow:visible}table{font-size:9pt}tr{break-inside:avoid}a{color:inherit}pre{white-space:pre-wrap;background:#eee;color:black}.intro p:last-child{background:#eee}html{scroll-padding-top:0}}
</style>
</head>
<body>
<a class="skip" href="#guide">Skip to strategy guide</a>
<div class="layout">
<aside aria-label="Guide navigation">
<div class="brand">HYPE<span aria-hidden="true"> /</span></div>
<div class="eyebrow">Operator field guide</div>
<p class="brand-note">Rules, safeguards &amp; execution.<br>A reference, not a trading dashboard.</p>
<div class="eyebrow">On this page</div>
<nav aria-label="Contents">${links}</nav>
<div class="tools"><a href="${path.basename(SOURCE)}">Markdown source</a><button class="print-button" type="button">Print / PDF</button></div>
<div class="legend"><strong>Read the conditions together.</strong>AND means every condition is required. OR means either route can qualify. Entry blocks and position exits are different actions.</div>
</aside>
<main id="guide" tabindex="-1">
<div class="masthead"><span class="eyebrow">Live strategy documentation</span><span class="badge">Static reference · no live connection</span></div>
<section class="intro">${body}</section>
<footer>Generated from <a href="${path.basename(SOURCE)}">the maintained strategy overview</a>. Reference fingerprint <code>${revision.slice(0, 12)}</code>.<br>Freshness does not verify VPS deployment, account balances or exchange protection. <a href="#guide">Back to top ↑</a></footer>
</main>
</div>
<script>
document.documentElement.classList.add('js');
document.querySelector('.print-button').addEventListener('click', () => window.print());
if ('IntersectionObserver' in window) {
  const links = Array.from(document.querySelectorAll('nav a'));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      for (const link of links) {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, {rootMargin: '0px 0px -65% 0px'});
  document.querySelectorAll('h2').forEach(h => observer.observe(h));
}
</script>
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
  for (const h of renderMarkdown(source).headings.filter(h => h.level === 2)) assert(output.includes(`href="#${h.id}"`));
  assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(output), 'Guide must render offline');
  console.log('Overview checks passed: rendering, escaping, links, navigation and offline output.');
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    assert(args.length <= 1 && (!args.length || ['--check', '--test'].includes(args[0])), 'Usage: node scripts/build-live-strategy-overview.cjs [--check|--test]');
    if (args[0] === '--test') selfTest();
    else {
      const html = documentHtml();
      if (args[0] === '--check') {
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
