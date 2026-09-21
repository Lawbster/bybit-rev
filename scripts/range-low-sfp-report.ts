/** SF01 saved-evidence report + historical clock checks; never executes new trades. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { buildContext, loadTape, ROOT, type SetupEvent } from './setup-scan-core';
import { detectRangeLowSfp } from './setup-detectors/sf01-range-low';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const primary = (r: any) => r.delay === 0 && !r.targetFirst && !r.stress;
const cash = (x: number) => `${x < 0 ? '-$' : '$'}${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
const pct = (x: number) => `${x.toFixed(2)}%`;
async function main() {
  const studyAt = process.argv.indexOf('--study');
  const dir = studyAt < 0 ? read(path.join(ROOT, 'backtests/range-low-sfp/latest.json')).dir : path.resolve(process.argv[studyAt + 1]);
  const j = read(path.join(dir, 'comparison.json')), c = j.resolvedCard ?? read(path.join(ROOT, j.card));
  const early = j.kind === 'sf02';
  const label = (name: string) => early ? (name === 'swing_control' ? '4h baseline' : '15m confirmation') : name;
  const outAt = process.argv.indexOf('--out');
  assert((c.symbol === 'HYPEUSDT' && !early) || outAt >= 0, 'new study report requires --out; preserve accepted HYPE findings');
  const out = outAt < 0 ? path.join(ROOT, 'research/codex-astra-range-low-sfp-findings-2026-09-20.md') : path.resolve(process.argv[outAt + 1]);
  const get = (name: string, lag = 60000) => j.runs.find((r: any) => r.name === (early ? name === 'swing_control' ? 'baseline_4h' : 'early_15m' : name) && r.lag === lag);
  const row = (run: any, cell: string, window = 'full') => run.results.find((r: any) => primary(r) && r.cell === cell && r.window === window);
  const checks: any = { artifactHashes: 0, sourcePins: 0, prefixCuts: [], stageClockChecks: 0, subsetChecks: j.subsetChecks, screens: [] };
  for (const d of [dir, ...j.runs.flatMap((r: any) => [path.join(ROOT, 'backtests/setup-scans', r.scan), path.join(ROOT, 'backtests/setup-replays', r.replay)])]) {
    for (const a of read(path.join(d, 'complete.json')).artifacts) { assert.equal(await fileHash(path.join(d, a.file)), a.sha256); checks.artifactHashes++; }
  }
  for (const pin of j.hashes) { assert.equal(await fileHash(path.join(ROOT, pin.file)), pin.sha256, `code changed ${pin.file}`); checks.sourcePins++; }
  for (const pin of j.input ?? []) assert.equal(await fileHash(path.join(ROOT, pin.file)), pin.sha256, `input changed ${pin.file}`);
  const scanDir = path.join(ROOT, 'backtests/setup-scans', get('range_sfp').scan), plan = read(path.join(scanDir, 'plan.json'));
  const events: SetupEvent[] = fs.readFileSync(path.join(scanDir, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  const { minutes, identity } = await loadTape(ROOT, c.symbol, plan.tape.start, Date.parse(c.to), 60000, plan.tape.source === 'research_tape' ? 'research' : 'sealed');
  assert.equal(identity.sha256, plan.tape.sha256, 'prefix check input differs from saved scan');
  for (const e of events.filter(e => e.stage === 'confirmed')) {
    assert(e.stages.level.knownAt <= e.stages.sweep.at); assert(e.stages.range.knownAt <= e.stages.sweep.at);
    assert.equal(e.knownAt, e.stages.reclaim.knownAt); checks.stageClockChecks++;
  }
  const confirmed = events.filter(e => e.stage === 'confirmed');
  // Evenly spaced historical cuts, selected without trade outcomes.
  for (const f of confirmed.length ? [0.1, 0.3, 0.5, 0.7, 0.9] : []) {
    const cut = confirmed[Math.floor((confirmed.length - 1) * f)].knownAt;
    const prefix = minutes.filter(m => m.endTs <= cut);
    const got = detectRangeLowSfp(buildContext({ symbol: c.symbol, minutes: prefix, lagMs: 60000,
      window: { start: Date.parse(c.from), end: cut }, params: plan.request.params }))
      .filter(e => e.stage === 'confirmed' && e.knownAt >= Date.parse(c.from) && e.knownAt <= cut);
    assert.deepEqual(JSON.parse(JSON.stringify(got)), confirmed.filter(e => e.knownAt <= cut), `historical prefix mismatch ${cut}`);
    checks.prefixCuts.push({ cut, confirmed: got.length, passed: true });
  }
  for (const hold of [24, 72]) {
    const cell = `long__r2__hold${hold}h`, failures: string[] = [];
    for (const lag of c.sourceLagsMs) {
      const a = get('swing_control', lag), b = get('range_sfp', lag), full = row(b, cell);
      for (const window of ['full', 'older', 'recent']) {
        const x = row(a, cell, window), y = row(b, cell, window);
        if (y.net - x.net < c.screen.netDeltaEachWindowMin - 1e-8) failures.push(`lag${lag}/${window}: net below control`);
        if (y.maxAdverseDrawdownPct - x.maxAdverseDrawdownPct > c.screen.ddDeltaEachWindowMax + 1e-8) failures.push(`lag${lag}/${window}: DD above control`);
        if (window !== 'full' && y.n < c.screen.tradesPerSplitMin) failures.push(`lag${lag}/${window}: insufficient trades`);
      }
      for (const m of b.monthly.filter((m: any) => primary(m) && m.window === 'full' && m.cell === cell)) {
        const base = a.monthly.find((x: any) => primary(x) && x.window === 'full' && x.cell === cell && x.month === m.month);
        if (m.markedNet - base.markedNet < c.screen.monthlyDeltaMin - 1e-8) failures.push(`lag${lag}/${m.month}: monthly delta ${cash(m.markedNet - base.markedNet)}`);
      }
      if (full.n < c.screen.tradesMin) failures.push(`lag${lag}: insufficient trades`);
      if (full.profitFactor < c.screen.profitFactorMin) failures.push(`lag${lag}: PF below ${c.screen.profitFactorMin}`);
      if (full.net - full.top5WinDollars <= c.screen.netExTop5Min) failures.push(`lag${lag}: top five winners exceed net`);
      if (b.results.some((r: any) => r.cell === cell && !r.targetFirst && r.net <= 0)) failures.push(`lag${lag}: nonpositive window/cost/delay case`);
    }
    checks.screens.push({ hold, passed: failures.length === 0, failures });
  }
  const reviewKey = sha(JSON.stringify({ job: j.key, reporter: await fileHash(__filename) }));
  const reviewDir = path.join(ROOT, 'backtests/range-low-sfp-reviews', reviewKey); fs.mkdirSync(reviewDir, { recursive: true });
  atomicJson(path.join(reviewDir, 'verification.json'), { job: j.key, reviewKey, ...checks });
  const a24 = row(get('swing_control'), 'long__r2__hold24h'), b24 = row(get('range_sfp'), 'long__r2__hold24h');
  const relative = (p: string) => path.relative(path.join(ROOT, 'research'), p).replace(/\\/g, '/');
  const count = (name: string) => get(name).eventReasons['confirmed:confirmed'] ?? 0;
  const attempts = Object.values<number>(get('swing_control').eventReasons).reduce((sum, n) => sum + n, 0);
  const lines = [`# ${early ? 'SF02 earlier confirmation' : 'SF01 range-low SFP'}: ${c.symbol}`, '', '2026-09-20. Research only; no live changes. One frozen implementation of the operator screenshot, not a verdict on every SFP definition.', '',
    '## TL;DR', '',
    `- ${attempts} baseline low-pivot attempts; ${count('swing_control')} control confirmations and ${count('range_sfp')} candidate confirmations. After risk, ties and occupancy: 24h/2R control ${a24.n} closes versus candidate ${b24.n}.`,
    `- 24h/2R ${early ? 'earlier confirmation' : 'range filter'}: ${cash(a24.net)} -> ${cash(b24.net)} (${cash(b24.net - a24.net)}), DD ${pct(a24.maxAdverseDrawdownPct)} -> ${pct(b24.maxAdverseDrawdownPct)}. Candidate win rate ${(b24.winRate * 100).toFixed(1)}%.`,
    `- ${checks.screens.filter((s: any) => s.passed).length}/2 comparisons pass the complete frozen screen. ${early ? '24h primary, 72h secondary; no structural targets in this checkpoint.' : 'Far-range targets are diagnostics, not qualified alternatives.'} No threshold changes after results.`, '',
    '## Scope and artifacts', '',
    `Window **${c.from} to ${c.to}**, split ${c.split}. Fixed $10k notional, $32k starting equity, taker 0.055% each side, before funding; stress adds 5bps/side. Long only. ${early ? '4h anchors; 4h baseline versus closed15m confirmation.' : 'Closed4h confirmation.'} 60s modeled publication lag and next eligible minute open; 120s source-lag and 60s action-delay sensitivities. Existing engine and independent accounting audit unchanged. This is not a ladder replay or live-equity forecast.`, '',
    `[Frozen method](../docs/research/${early ? 'range-low-sfp-early-sf02' : 'range-low-sfp-sf01'}.md) / [card](../${j.card}) / [saved comparison](${relative(path.join(dir, 'comparison.json'))}) / [verification](${relative(path.join(reviewDir, 'verification.json'))}).`, '',
    `[Range replay chart](${relative(path.join(dir, 'range_sfp-replay.html'))}) / [control replay chart](${relative(path.join(dir, 'swing_control-replay.html'))}) / [all range attempts](${relative(path.join(dir, 'range_sfp-scan.html'))}). Charts reuse Fable's renderer, need its CDN chart library, and place zones from availability rather than origin candles. Inspect event timestamps and rejected attempts, not just winners.`, '',
    '## Full-window results (primary clock)', '',
    'Wins/losses and their dollars are closed trades. Open inventory is marked separately, not counted as a win/loss. Fixed notional is not fixed risk; compare each asset to its own control, not dollars across assets as if risk matched.', '',
    '| Setup | Target / cap | Wins / losses | Winning $ | Losing $ | Avg loss | Open MTM | Net incl. open | DD |', '|---|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const hold of [24, 72]) for (const [name, target] of [['swing_control', 'r2'], ['range_sfp', 'r2'], ['range_sfp', 'structural']]) {
    const r = row(get(name), `long__${target}__hold${hold}h`);
    if (!r) continue;
    lines.push(`| ${label(name)} | ${target === 'structural' ? 'range high (diagnostic)' : '2R'} / ${hold}h | ${r.wins} / ${r.losses} | ${cash(r.winningDollars)} | ${cash(r.losingDollars)} | ${cash(r.avgLoss)} | ${cash(r.openNet)} | ${cash(r.net)} | ${pct(r.maxAdverseDrawdownPct)} |`);
  }
  lines.push('', '## Older / recent comparisons', '', '| Window | Cap | Control net / DD | Candidate net / DD | Net delta |', '|---|---|---:|---:|---:|');
  for (const w of ['older', 'recent']) for (const h of [24, 72]) {
    const a = row(get('swing_control'), `long__r2__hold${h}h`, w), b = row(get('range_sfp'), `long__r2__hold${h}h`, w);
    lines.push(`| ${w} | ${h}h | ${cash(a.net)} / ${pct(a.maxAdverseDrawdownPct)} | ${cash(b.net)} / ${pct(b.maxAdverseDrawdownPct)} | ${cash(b.net - a.net)} |`);
  }
  lines.push('', '## Monthly marked net (full continuous paths)', '', 'Boundary months are partial. Exact monthly W/L dollars remain in each replay\'s `monthly.csv` linked by comparison.json. These are not independent monthly restarts.', '',
    `| Month | Control 24h | Candidate 24h | Delta | Control 72h | Candidate 72h | Delta |${early ? '' : ' Range-high 24h | Range-high 72h |'}`, `|---|---:|---:|---:|---:|---:|---:|${early ? '' : '---:|---:|'}`);
  const month = (name: string, target: string, h: number, m: string) => get(name).monthly.find((r: any) => primary(r) && r.window === 'full' && r.cell === `long__${target}__hold${h}h` && r.month === m).markedNet;
  for (const m of [...new Set<string>(get('swing_control').monthly.filter((r: any) => primary(r) && r.window === 'full').map((r: any) => r.month))].sort()) {
    const a = month('swing_control', 'r2', 24, m), b = month('range_sfp', 'r2', 24, m), x = month('swing_control', 'r2', 72, m), y = month('range_sfp', 'r2', 72, m);
    lines.push(`| ${m} | ${[a, b, b - a, x, y, y - x, ...(early ? [] : [month('range_sfp', 'structural', 24, m), month('range_sfp', 'structural', 72, m)])].map(cash).join(' | ')} |`);
  }
  lines.push('', '## Execution / cost sensitivity (full window, 24h/2R)', '', '| Source lag | Action delay | Stress | Control net | Candidate net |', '|---|---|---|---:|---:|');
  for (const lag of c.sourceLagsMs) for (const r of get('range_sfp', lag).results.filter((r: any) => r.cell === 'long__r2__hold24h' && r.window === 'full' && !r.targetFirst)) {
    const b = get('swing_control', lag).results.find((x: any) => x.cell === r.cell && x.window === r.window && x.delay === r.delay && x.stress === r.stress && !x.targetFirst);
    lines.push(`| ${lag / 1000}s | ${r.delay / 1000}s | ${r.stress ? '+5bps/side' : 'none'} | ${cash(b.net)} | ${cash(r.net)} |`);
  }
  lines.push('', 'Source lag and action delay can generate the same fill clock: these are sensitivities, not independent evidence.', '', '## Frozen screen', '');
  for (const s of checks.screens) lines.push(`### ${early ? 'Earlier confirmation' : 'Range'} 2R / ${s.hold}h: ${s.passed ? 'PASS (in-sample only)' : 'FAIL'}`, '', ...s.failures.map((f: string) => `- ${f}`), '');
  if (early) {
    const signal = j.attribution.find((a: any) => a.lag === 60000 && a.type === 'signals');
    lines.push('## Earlier entry and full-path attribution', '',
      `${signal.matched} shared confirmed pivot IDs, ${signal.earlier} confirm earlier, ${signal.newSignals} additional signals and ${signal.lostSignals} lost signals. All ${signal.sameHigh} shared IDs retain the same high anchor. Median confirmation advance ${signal.medianAdvanceHours.toFixed(2)}h; median reclaim-reference price difference ${signal.medianReferencePriceDeltaPct.toFixed(3)}%. These are signal references, not identical filled-trade cohorts.`, '',
      '| Hold | Shared closed IDs / PnL delta | Added closed / net | Removed closed / net | Open MTM delta | Total delta |', '|---|---:|---:|---:|---:|---:|');
    for (const a of j.attribution.filter((a: any) => a.lag === 60000 && a.type === 'closed_trade_paths')) {
      lines.push(`| ${a.cell} | ${a.common} / ${cash(a.commonDelta)} | ${a.added} / ${cash(a.addedNet)} | ${a.removed} / ${cash(a.removedNet)} | ${cash(a.openDelta)} | ${cash(a.totalDelta)} |`);
    }
    const attr = j.attribution.find((a: any) => a.lag === 60000 && a.cell === 'long__r2__hold24h');
    lines.push('', `At24h, ${attr.oldLoserToWin} shared baseline losers become wins, but ${attr.oldWinnerToLoss} baseline winners become losses. ${attr.removedWinners} baseline winner (${cash(attr.removedWinningDollars)}) is absent from the candidate closed-trade list. Added trades include changed risk eligibility and occupancy, not just newly detected confirmations. Attribution reconciles common delta + added net - removed net + open delta to total net delta.`, '',
      `Average initial dollar stop risk per closed trade: ${cash(a24.initialRiskAvg)} baseline versus ${cash(b24.initialRiskAvg)} candidate. Stop exits ${a24.stops} -> ${b24.stops}; TP exits ${a24.targets} -> ${b24.targets}. So a cheaper entry and higher win count are not necessarily better dollars: the causal stop/2R bracket also changes.`, '');
  }
  lines.push('## What changed, what did not', '',
    early ? '- The trigger clock changes first-sweep eligibility, reclaim timing and causally known stop/2R brackets. This is not a pure fill-price improvement with a future4h stop/target. New15m signals include false starts that4h would reject.' : '- The range filter changes eligible signals and subsequent occupancy. Skipped signals are not necessarily identical to trades removed from the control. Primary comparisons keep the 2R target and hold fixed.',
    early ? '- 4h baseline events/actions match archived artifacts exactly and replay/accounting engine pins remain unchanged. Results are reused, not silently replaced; paired trade attribution is saved in comparison.json.' : '- Range-high targets are diagnostics, not independently screened upgrades. POC or midpoint targets were not tested; do not treat their outcomes as known.',
    '- Both anchors must be published before sweep start; reclaim trades occur after source lag. Five historical prefix cuts and all confirmed stage clocks pass. Synthetic future-poison/gap/late-bar tests also pass.',
    '- Chart zone publication was repaired; origin timestamps remain formation metadata. Existing saved HTML pages are not silently overwritten and need regeneration to adopt the fix.',
    '- H&S fakeout, short mirrors, POC/VWAP/HL confluence, maker fills/funding, and live ladder integration remain untested in this pass. No live deployment claim.', '', '## Source-to-fill trace', '');
  const trace = get('range_sfp').firstTradeTrace;
  lines.push('```json', JSON.stringify(trace, null, 2), '```', '');
  fs.writeFileSync(out, lines.join('\n'));
  console.log(JSON.stringify({ findings: out, verification: path.join(reviewDir, 'verification.json'), primaryPasses: checks.screens.filter((s: any) => s.passed).length,
    hashes: checks.artifactHashes, stageClocks: checks.stageClockChecks, historicalPrefixes: checks.prefixCuts.length,
    screens: checks.screens.map((s: any) => ({ hold: s.hold, passed: s.passed, failureCount: s.failures.length })) }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
