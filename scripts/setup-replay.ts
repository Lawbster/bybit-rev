/**
 * Setup replay: turn a scan's confirmed events into bracketed trades and replay them with the accepted
 * structural-bracket engine (poc-indicator-bias-engine.replay) plus its independent audit. Research-only.
 *
 *   npx ts-node scripts/setup-replay.ts run --setup PA02 --from 2024-12-27 --to 2026-09-15 --split 2026-06-01
 *   npx ts-node scripts/setup-replay.ts run --scan <scan key> [--sides long,short] [--targets structural,r2,r3] [--holds 24,72]
 *       [--delays 0,60] [--notional 10000] [--equity 32000] [--fee 0.00055] [--stress-bps 5] [--risk-min 0.2] [--risk-max 5]
 *       [--stop-buffer-pct 0] [--include-controls] [--quiet]
 *   npx ts-node scripts/setup-replay.ts show <key|PA02>
 *
 * Numbers are exploratory: fixed notional per cell, separate account per cell, taker fees before funding,
 * development data with no frozen card. They rank variations; they do not qualify a setup.
 */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { replay, type Action, type Row } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
import { csv } from './poc-bounce-study';
import { DETECTORS, detectorSources, resolveSetup } from './setup-detectors';
import { loadLibrary } from './setup-library';
import { H, M, ROOT, loadTape, runScan, type Minute, type ScanRequest, type SetupEvent } from './setup-scan-core';

export interface ReplayVariant { side: 1 | -1; target: string; holdHours: number }
/** Which scan rows become trades: the confirmed setup (default) or a named non-confirmed row set used as a control, e.g. `rejected:no_sweep_before_fail`. */
export interface RowFilter { stage: SetupEvent['stage']; reason?: string }
export interface ReplayConfig {
  scanKey: string; sides: (1 | -1)[]; targets: string[]; holds: number[]; delaysMs: number[]; notional: number; equity: number;
  fee: number; stressBpsPerSide: number; riskMinPct: number; riskMaxPct: number; stopBufferPct: number; includeControls: boolean; split: number | null;
  rows?: RowFilter;
  /** Stage whose price is the bracket reference (default: retest, else reclaim, else impulse, else the last stage). Rows without that stage are rejected. */
  refStage?: string;
  /** Resting limit entry. source `sweep` (default) prices the order off the sweep stage plus offset; `proxy` uses the detector's own resting price (proxies.entry, e.g. OB01's 0.705 level). */
  entryLimit?: { offsetPct: number; expiryHours: number; model: 'touch' | 'open'; source?: 'sweep' | 'proxy' };
  /** Execution stop only: after original bracket eligibility/target calculation. Does not retarget rN. */
  exitStopPaddingPct?: number;
}
export const cellId = (v: ReplayVariant) => `${v.side === 1 ? 'long' : 'short'}__${v.target}__hold${v.holdHours}h`;
export function parseRowFilter(v: string | undefined): RowFilter {
  if (!v || v === 'confirmed') return { stage: 'confirmed' };
  const [stage, reason] = v.split(':');
  if (!['confirmed', 'rejected', 'expired', 'invalidated', 'pending_at_cutoff'].includes(stage)) throw new Error(`unknown row stage ${stage}`);
  return reason ? { stage: stage as SetupEvent['stage'], reason } : { stage: stage as SetupEvent['stage'] };
}
export const rowMatches = (e: SetupEvent, f: RowFilter = { stage: 'confirmed' }) => e.stage === f.stage && (f.reason === undefined || e.reason === f.reason);

/** Build strictly time-ordered bracket actions for one cell. Rejections and ties are returned for the ledger. */
export function buildActions(events: readonly SetupEvent[], v: ReplayVariant, c: Pick<ReplayConfig, 'riskMinPct' | 'riskMaxPct' | 'stopBufferPct' | 'includeControls' | 'rows' | 'entryLimit' | 'exitStopPaddingPct' | 'refStage'>) {
  const exitPadding = c.exitStopPaddingPct ?? 0;
  assert(Number.isFinite(exitPadding) && exitPadding >= 0 && exitPadding < 100, 'exit stop padding must be in [0,100)');
  const rejected: Row[] = [], discarded: Row[] = [], actions: Action[] = [];
  const rMatch = v.target.match(/^r(\d+(?:\.\d+)?)$/);
  /** tpN[slM]: target N% from the reference, stop M% from the reference (the scan stop when sl is absent); stop buffer does not apply to a percent stop. */
  const pMatch = v.target.match(/^tp(\d+(?:\.\d+)?)(?:sl(\d+(?:\.\d+)?))?$/);
  if (!rMatch && !pMatch && v.target !== 'structural') throw new Error(`unknown target mode ${v.target}`);
  for (const e of events) {
    if (!rowMatches(e, c.rows) || e.side !== v.side) continue;
    if (!c.includeControls && c.rows?.stage !== 'rejected' && e.notes.some(n => n.endsWith('_control') || n === 'pa07_control_row')) continue;
    const stageList = Object.values(e.stages);
    const ref = c.refStage ? (e.stages[c.refStage]?.price ?? null) : (e.stages.retest?.price ?? e.stages.reclaim?.price ?? e.stages.impulse?.price ?? stageList[stageList.length - 1]?.price ?? null);
    const slPct = pMatch?.[2] !== undefined ? Number(pMatch[2]) : null;
    const rawStop = slPct !== null && ref !== null ? ref * (1 - v.side * slPct / 100) : e.proxies.stop;
    if (ref === null || rawStop === null || rawStop === undefined) { rejected.push({ id: e.id, at: e.knownAt, reason: 'no_reference_or_stop' }); continue; }
    const stop = slPct !== null ? rawStop : v.side === 1 ? rawStop * (1 - c.stopBufferPct / 100) : rawStop * (1 + c.stopBufferPct / 100);
    const riskPct = Math.abs(ref - stop) / ref * 100;
    let target: number | null;
    if (rMatch) target = ref + v.side * Number(rMatch[1]) * Math.abs(ref - stop);
    else if (pMatch) target = ref * (1 + v.side * Number(pMatch[1]) / 100);
    else target = e.proxies.target;
    if (target === null) { rejected.push({ id: e.id, at: e.knownAt, reason: 'no_structural_target' }); continue; }
    if (!(v.side * (ref - stop) > 0 && v.side * (target - ref) > 0)) { rejected.push({ id: e.id, at: e.knownAt, reason: 'invalid_bracket', ref, stop, target }); continue; }
    if (riskPct < c.riskMinPct || riskPct > c.riskMaxPct) { rejected.push({ id: e.id, at: e.knownAt, reason: 'risk_out_of_range', riskPct }); continue; }
    if (e.knownAt % M !== 0) { rejected.push({ id: e.id, at: e.knownAt, reason: 'known_at_not_minute_aligned' }); continue; }
    let entry: { price: number; expiresAt: number; model: 'touch' | 'open' } | undefined;
    if (c.entryLimit) {
      const source = c.entryLimit.source ?? 'sweep';
      const basePrice = source === 'proxy' ? e.proxies.entry : (e.stages.sweep?.price ?? null);
      if (basePrice === null || basePrice === undefined) { rejected.push({ id: e.id, at: e.knownAt, reason: source === 'proxy' ? 'no_entry_proxy' : 'no_sweep_stage' }); continue; }
      entry = { price: basePrice * (1 + c.entryLimit.offsetPct / 100), expiresAt: e.knownAt + c.entryLimit.expiryHours * H, model: c.entryLimit.model };
      if (v.side !== 1) { rejected.push({ id: e.id, at: e.knownAt, reason: 'limit_entry_long_only' }); continue; }
      if (!(entry.price > stop && entry.price < ref)) { rejected.push({ id: e.id, at: e.knownAt, reason: 'limit_outside_bracket', limit: entry.price, stop, ref }); continue; }
      assert(entry.expiresAt > e.knownAt, 'invalid limit expiry');
    }
    actions.push({ id: e.id, at: e.knownAt, side: v.side, stop, target, expiresAt: e.knownAt + v.holdHours * H, ...(entry ? { entry } : {}),
      evidence: { setup: e.setup, version: e.version, refPrice: ref, riskPct, targetMode: v.target, stages: Object.fromEntries(Object.entries(e.stages).map(([k, s]) => [k, s.at])), formationAt: e.formationAt } });
  }
  actions.sort((a, b) => a.at - b.at || (a.evidence!.formationAt as number) - (b.evidence!.formationAt as number) || a.id.localeCompare(b.id));
  const kept: Action[] = [];
  for (const a of actions) { const prior = kept[kept.length - 1]; if (prior && prior.at === a.at) discarded.push({ id: a.id, at: a.at, keptId: prior.id, reason: 'same_minute_tie_oldest_formation_then_id' }); else kept.push(a); }
  return { actions: exitPadding ? kept.map(a => ({ ...a, stop: a.stop! * (1 - a.side * exitPadding / 100) })) : kept, rejected, discarded };
}

const cash = (n: number | null | undefined) => n === null || n === undefined ? 'NA' : Math.round(n).toLocaleString('en-US');
const fix = (n: number | null | undefined, d = 2) => n === null || n === undefined ? 'NA' : n.toFixed(d);

export function renderReport(args: { cfg: ReplayConfig; scan: Row; windows: Row[]; results: Row[]; months: Row[]; key: string; eventCounts: Row }): string {
  const { cfg, scan, windows, results, months, key } = args;
  const primary = (r: Row) => r.delay === 0 && !r.targetFirst && r.stress === false;
  const lines: string[] = [];
  if (cfg.exitStopPaddingPct) lines.push('> Stop-only override: ' +
    `execution stop padded ${cfg.exitStopPaddingPct}% beyond the original stop price (lower for longs, higher for shorts). ` +
    'Original signal eligibility, entry, absolute target and holding deadline are unchanged. ' +
    'The rN cell label describes the original target, not the widened reward/risk. ' +
    'The signal-risk filter below applies before widening; actual risk can exceed that filter maximum.', '');
  if (cfg.entryLimit) lines.push(`> Execution override: post-confirmation resting limit (${cfg.entryLimit.source === 'proxy' ? "detector's resting price, proxies.entry" : 'sweep-low'}), ` +
    `offset ${cfg.entryLimit.offsetPct}%, expiry ${cfg.entryLimit.expiryHours}h, fill model ${cfg.entryLimit.model}. ` +
    'One pending/open owner; holding time from actual fill; original absolute stop/target and risk eligibility retained. ' +
    'See the enclosing study card/report for qualification; generic market-entry and unfrozen-screen text below is superseded.', '');
  if (cfg.refStage || cfg.targets.some(t => /^tp/.test(t))) lines.push(`> Bracket override: ${cfg.refStage ? `reference = the \`${cfg.refStage}\` stage price` : 'default reference'}; ` +
    `\`tpN\` cells target N% from the reference and \`tpNslM\` cells also stop M% from the reference (the scan stop proxy and stop buffer are not used in those cells). ` +
    'The signal-risk filter applies to the percent stop as written.', '');
  lines.push(`# Setup replay: ${scan.setup} on ${scan.symbol}`, '',
    `Replay key \`${key}\`, scan key \`${scan.key}\` (detector \`${scan.version}\`). Window ${new Date(scan.from).toISOString().slice(0, 10)} to ${new Date(scan.to).toISOString().slice(0, 10)} UTC${cfg.split ? `; split ${new Date(cfg.split).toISOString().slice(0, 10)}` : ''}.`,
    `Fixed $${cfg.notional.toLocaleString()} notional per trade, one position per cell, separate $${cfg.equity.toLocaleString()} account per cell for DD, taker ${(cfg.fee * 100).toFixed(3)}% each side, before funding, +${cfg.stressBpsPerSide}bps/side cost stress. Entry at the open of the first minute at/after the event's known-at (+ action delay). Stop = scan stop proxy${cfg.stopBufferPct ? ` widened ${cfg.stopBufferPct}%` : ''}; targets: structural = nearest known untouched opposite pivot, rN = reference close ± N × stop distance. Risk filter ${cfg.riskMinPct}–${cfg.riskMaxPct}% of reference close. Time exit after the hold.`, '',
    `**Exploratory numbers on development data. No frozen card, no untouched holdout, no occupancy across cells, no funding, no maker fills.** They rank variations of one operationalisation; they do not qualify a setup. Input rows: \`${args.eventCounts.rows}\`, ${args.eventCounts.confirmed} events (${args.eventCounts.long} long / ${args.eventCounts.short} short)${cfg.includeControls ? ', control rows included' : ''}.`, '');
  for (const w of windows) {
    lines.push(`## ${w.id}: ${new Date(w.start).toISOString().slice(0, 10)} to ${new Date(w.end).toISOString().slice(0, 10)}`, '', `Primary clock (delay 0, stop-first on same-minute ambiguity). Cash reference = $0.`, '',
      `| Cell | Trades | W/L | Winning $ | Losing $ | Avg loss $ | Net $ | Stress net $ | DD % | Avg R | PF | Target/Stop/Time | Top-5 win $ | Worst month $ |`, `|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|`);
    const rows = results.filter(r => r.window === w.id && primary(r)).sort((a, b) => b.net - a.net);
    for (const r of rows) {
      const ms = months.filter(m => m.cell === r.cell && m.window === w.id && m.delay === 0 && !m.targetFirst && m.stress === false);
      const worst = ms.length ? Math.min(...ms.map(m => m.markedNet)) : null;
      lines.push(`| ${r.cell} | ${r.trades} | ${r.wins}/${r.losses} | ${cash(r.winningDollars)} | ${cash(r.losingDollars)} | ${cash(r.avgLoss)} | ${cash(r.net)} | ${cash(r.stressNet)} | ${fix(r.maxAdverseDrawdownPct)} | ${fix(r.avgR)} | ${fix(r.profitFactor)} | ${r.targets}/${r.stops}/${r.timeouts} | ${cash(r.top5WinDollars)} | ${cash(worst)} |`);
    }
    lines.push('');
    const sens = results.filter(r => r.window === w.id && !primary(r));
    if (sens.length) {
      lines.push(`Sensitivities (net $ / DD %): action delay 60s and target-first same-minute resolution.`, '', `| Cell | delay 60 | target-first | stress+delay 60 |`, `|---|---:|---:|---:|`);
      for (const r of rows) {
        const d = sens.find(x => x.cell === r.cell && x.delay === 60_000 && !x.targetFirst && x.stress === false), t = sens.find(x => x.cell === r.cell && x.delay === 0 && x.targetFirst && x.stress === false), sd = sens.find(x => x.cell === r.cell && x.delay === 60_000 && !x.targetFirst && x.stress === true);
        lines.push(`| ${r.cell} | ${cash(d?.net)} / ${fix(d?.maxAdverseDrawdownPct)} | ${cash(t?.net)} / ${fix(t?.maxAdverseDrawdownPct)} | ${cash(sd?.stressNet)} |`);
      }
      lines.push('');
    }
  }
  const full = windows[0];
  const top = results.filter(r => r.window === full.id && primary(r)).sort((a, b) => b.net - a.net).slice(0, 4);
  if (top.length) {
    lines.push(`## Monthly marked net, top ${top.length} cells over ${full.id} (primary clock)`, '', `| Month | ${top.map(r => r.cell).join(' | ')} |`, `|---|${top.map(() => '---:').join('|')}|`);
    const monthsOf = (r: Row) => months.filter(m => m.cell === r.cell && m.window === full.id && m.delay === 0 && !m.targetFirst && m.stress === false);
    const keys = [...new Set(monthsOf(top[0]).map(m => m.month))];
    for (const k of keys) lines.push(`| ${k} | ${top.map(r => cash(monthsOf(r).find(m => m.month === k)?.markedNet)).join(' | ')} |`);
    lines.push('');
  }
  lines.push(`## PA07 standalone screen, applied descriptively (no frozen card)`, '', `Positive net in every window and under cost stress at the primary clock and with 60s delay; at least 30 trades in the full window and 10 in each split; no month below −$250 versus cash; no equity exhaustion.`, '');
  for (const cell of [...new Set(results.map(r => r.cell))]) {
    const rs = results.filter(r => r.cell === cell && !r.targetFirst);
    const fails: string[] = [];
    if (rs.some(r => r.net <= 0)) fails.push('nonpositive_window');
    if (rs.some(r => r.stressNet <= 0)) fails.push('cost_stress');
    if (rs.some(r => r.trades < (r.window === full.id ? 30 : 10))) fails.push('sample');
    if (rs.some(r => r.bankrupt)) fails.push('equity');
    if (months.some(m => m.cell === cell && !m.targetFirst && m.stress === false && m.markedNet < -250)) fails.push('monthly_vs_cash');
    lines.push(`- ${cell}: ${fails.length ? fails.join(', ') : 'passes the descriptive screen (still not a qualified setup)'}`);
  }
  lines.push('', `## What the numbers do not say`, '', `- Every cell replays the same event stream with a different bracket; cells are not independent evidence and the best cell is selected after the fact.`, `- One position per cell: overlapping events are skipped (\`skippedOccupied\`), so counts depend on the hold.`, `- Structural targets come from the scan's nearest untouched pivot at known-at; rN targets are geometry, not liquidity.`, `- Fixed notional is not fixed risk; average R and losing dollars are reported separately for that reason.`, `- Turning any of this into a candidate means a frozen card with controls (sweep-less generic failed-zone rows are available as a control), both windows, both clocks, monthly screen and forward observation.`, '',
    `## Files`, '', `- \`results.csv\` / \`results.json\`: every cell × window × clock.`, `- \`monthly.csv\`: marked monthly net per cell.`, `- \`trades-<cell>.csv\`: closed trades at the primary clock, full window.`, `- \`actions.json\`: bracket actions, rejections and discarded ties per cell.`, `- \`audit.json\`: independent replay audit receipts (structural-replay-audit).`);
  return lines.join('\n') + '\n';
}

export async function runReplay(root: string, cfg: ReplayConfig): Promise<{ key: string; dir: string; reused: boolean; report: string }> {
  const scanDir = path.join(root, 'backtests/setup-scans', cfg.scanKey);
  assert(fs.existsSync(path.join(scanDir, 'complete.json')), `scan ${cfg.scanKey} not found or incomplete`);
  const scan = JSON.parse(fs.readFileSync(path.join(scanDir, 'summary.json'), 'utf8')) as Row;
  const plan = JSON.parse(fs.readFileSync(path.join(scanDir, 'plan.json'), 'utf8')) as Row;
  const events = fs.readFileSync(path.join(scanDir, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as SetupEvent);
  const pins: Row[] = [];
  for (const f of ['scripts/setup-replay.ts', 'scripts/poc-indicator-bias-engine.ts', 'scripts/structural-replay-audit.ts', `backtests/setup-scans/${cfg.scanKey}/events.jsonl`, `backtests/setup-scans/${cfg.scanKey}/complete.json`]) pins.push({ file: f, sha256: await fileHash(path.join(root, f)) });
  if (cfg.entryLimit) pins.push({ file: 'scripts/structural-limit-entry.ts', sha256: await fileHash(path.join(root, 'scripts/structural-limit-entry.ts')) });
  const key = sha(JSON.stringify({ cfg, pins }));
  const dir = path.join(root, 'backtests/setup-replays', key);
  if (fs.existsSync(path.join(dir, 'complete.json'))) return { key, dir, reused: true, report: fs.readFileSync(path.join(dir, 'report.md'), 'utf8') };
  // The engine indexes minutes directly, so it needs the contiguous sealed tape over the scan window.
  const { minutes, identity } = await loadTape(root, scan.symbol, scan.from, scan.to, plan.request.lagMs, (plan.tape as Row).source === 'sealed_cache' ? 'sealed' : (plan.tape as Row).source === 'research_tape' ? 'research' : 'live'); // replay on the tape the scan recorded
  assert.equal(identity.gaps.length, 0, 'replay requires a contiguous tape');
  const cs = minutes as unknown as readonly Minute[];
  const windows: Row[] = [{ id: 'full', start: scan.from, end: scan.to }];
  if (cfg.split && cfg.split > scan.from && cfg.split < scan.to) windows.push({ id: 'older', start: scan.from, end: cfg.split }, { id: 'recent', start: cfg.split, end: scan.to });
  const results: Row[] = [], months: Row[] = [], audits: Row[] = [], actionLedger: Row = {};
  fs.mkdirSync(dir, { recursive: true });
  for (const side of cfg.sides) for (const target of cfg.targets) for (const holdHours of cfg.holds) {
    const v = { side, target, holdHours }, cell = cellId(v);
    const built = buildActions(events, v, cfg);
    actionLedger[cell] = { actions: built.actions.length, rejected: built.rejected, discarded: built.discarded };
    for (const w of windows) for (const delay of cfg.delaysMs) for (const targetFirst of [false, true]) for (const stress of [false, true]) {
      if (stress && targetFirst) continue;
      const fee = cfg.fee + (stress ? cfg.stressBpsPerSide / 10000 : 0);
      const o = { start: w.start, end: w.end, delay, hold: holdHours * H, notional: cfg.notional, equity: cfg.equity, fee, targetFirst };
      const run = replay(cs as any, built.actions, o);
      const audit = auditStructuralReplay(cs as any, built.actions, o, run);
      audits.push({ cell, window: w.id, delay, targetFirst, stress, ...audit });
      const ts = run.trades as Row[];
      const top5 = [...ts].sort((a, b) => b.net - a.net).slice(0, 5).reduce((a, b) => a + Math.max(0, b.net), 0);
      results.push({ cell, side: side === 1 ? 'long' : 'short', target, holdHours, window: w.id, delay, targetFirst, stress, ...run.stats,
        ...(cfg.entryLimit ? { entrySubmitted: run.entryIntents.length, entryFilled: run.entryIntents.filter(i => i.phase === 'filled').length,
          entryExpired: run.entryIntents.filter(i => i.phase === 'expired').length, entryInvalidated: run.entryIntents.filter(i => i.phase === 'invalidated').length,
          entryCutoff: run.entryIntents.filter(i => i.phase === 'cutoff').length, entryAmbiguous: run.entryAmbiguous,
          waitingMinutes: run.entryIntents.reduce((sum, i) => sum + Math.max(0, i.endedAt - i.activeAt) / M, 0) } : {}),
        stressNet: stress ? run.stats.net : run.stats.net - run.stats.turnoverIncludingMarkedExit * cfg.stressBpsPerSide / 10000,
        targets: ts.filter(t => t.reason === 'target').length, stops: ts.filter(t => t.reason === 'stop').length, timeouts: ts.filter(t => t.reason === 'timeout').length,
        top5WinDollars: top5, initialRiskAvg: ts.length ? ts.reduce((a, t) => a + t.qty * Math.abs(t.entryPrice - t.stop), 0) / ts.length : null });
      for (const m of run.monthly as Row[]) months.push({ cell, window: w.id, delay, targetFirst, stress, ...m });
      if (w.id === 'full' && delay === 0 && !targetFirst && !stress) {
        if (cfg.entryLimit) atomicJson(path.join(dir, `intents-${cell}.json`), run.entryIntents);
        fs.writeFileSync(path.join(dir, `trades-${cell}.csv`), csv(ts.map(t => ({ ...t, evidence: JSON.stringify(t.evidence?.stages ?? {}), signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
      }
    }
  }
  const confirmed = events.filter(e => rowMatches(e, cfg.rows) && (cfg.includeControls || cfg.rows?.stage === 'rejected' || !e.notes.some(n => n.endsWith('_control') || n === 'pa07_control_row')));
  const eventCounts = { confirmed: confirmed.length, long: confirmed.filter(e => e.side === 1).length, short: confirmed.filter(e => e.side === -1).length, rows: cfg.rows ? `${cfg.rows.stage}${cfg.rows.reason ? ':' + cfg.rows.reason : ''}` : 'confirmed' };
  const report = renderReport({ cfg, scan, windows, results, months, key, eventCounts });
  const write = (f: string, x: unknown) => atomicJson(path.join(dir, f), x);
  write('plan.json', { key, cfg, scan: { key: scan.key, setup: scan.setup, version: scan.version, symbol: scan.symbol, from: scan.from, to: scan.to }, tape: identity, pins, node: process.version, createdAt: Date.now(), kind: 'exploratory_setup_replay', economicsQualification: 'not_frozen' });
  write('results.json', results); write('monthly.json', months); write('actions.json', actionLedger); write('audit.json', { passed: true, receipts: audits.length });
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(results)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(months));
  fs.writeFileSync(path.join(dir, 'report.md'), report);
  const artifacts: Row[] = [];
  for (const f of fs.readdirSync(dir).sort()) { const p = path.join(dir, f); if (fs.statSync(p).isFile()) artifacts.push({ file: f, sha256: await fileHash(p) }); }
  write('complete.json', { key, artifacts, kind: 'exploratory_setup_replay' });
  const latestFile = path.join(root, 'backtests/setup-replays/latest.json');
  const latest = fs.existsSync(latestFile) ? JSON.parse(fs.readFileSync(latestFile, 'utf8')) : {};
  latest[scan.setup] = { key, dir: `backtests/setup-replays/${key}`, scanKey: cfg.scanKey, at: Date.now() };
  atomicJson(latestFile, latest);
  return { key, dir, reused: false, report };
}

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find(a => a.startsWith(`--${name}=`)); if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`); return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
}
const flag = (name: string) => process.argv.slice(2).includes(`--${name}`);
/** --entry-limit sweep|proxy turns on the resting-limit execution model; the other flags refine it. */
function parseEntryLimit(): ReplayConfig['entryLimit'] | undefined {
  const source = arg('entry-limit'); if (!source) return undefined;
  if (source !== 'sweep' && source !== 'proxy') throw new Error(`--entry-limit must be sweep or proxy, got ${source}`);
  const model = arg('entry-model') ?? 'touch'; if (model !== 'touch' && model !== 'open') throw new Error(`--entry-model must be touch or open, got ${model}`);
  const offsetPct = Number(arg('entry-offset-pct') ?? 0), expiryHours = Number(arg('entry-expiry-hours') ?? 72);
  if (!Number.isFinite(offsetPct) || !(expiryHours > 0)) throw new Error('invalid --entry-offset-pct or --entry-expiry-hours');
  return { offsetPct, expiryHours, model, ...(source === 'proxy' ? { source } : {}) };
}
const parseWhen = (v: string | undefined): number | null => { if (!v) return null; const t = Date.parse(/T|Z|\+/.test(v) ? v : `${v}T00:00:00Z`); if (!Number.isFinite(t)) throw new Error(`invalid date: ${v}`); return t; };

async function main() {
  const [command = 'run', ...rest] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (command === 'show') {
    const what = rest[0] ?? '';
    const latest = fs.existsSync(path.join(ROOT, 'backtests/setup-replays/latest.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'backtests/setup-replays/latest.json'), 'utf8')) : {};
    const dir = latest[what.toUpperCase()]?.dir ?? `backtests/setup-replays/${what}`;
    const file = path.join(ROOT, dir, 'report.md'); if (!fs.existsSync(file)) throw new Error(`no replay report at ${dir}; known: ${Object.keys(latest).join(', ') || 'none'}`);
    process.stdout.write(fs.readFileSync(file, 'utf8')); return;
  }
  if (command !== 'run') throw new Error('usage: setup-replay.ts run (--scan <key> | --setup <id|alias> --from <date> [--to <date>]) [--split <date>] [--sides long,short] [--targets structural,r1.5,r2,r3,tp2.5,tp3sl4.25] [--holds 24,72] [--delays 0,60] [--notional N] [--equity N] [--fee F] [--stress-bps N] [--risk-min P] [--risk-max P] [--stop-buffer-pct P] [--rows confirmed|rejected:<reason>] [--include-controls] [--ref <stage>] [--entry-limit sweep|proxy --entry-offset-pct P --entry-expiry-hours N --entry-model touch|open] [--quiet] | show <key|id>');
  let scanKey = arg('scan');
  if (!scanKey) {
    const query = arg('setup'); if (!query) throw new Error('--scan <key> or --setup <id> is required');
    const res = resolveSetup(query, loadLibrary(ROOT));
    if (res.status !== 'detector') throw new Error(`cannot scan "${query}": ${JSON.stringify(res)}`);
    const to = parseWhen(arg('to')) ?? (() => { const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'backtests/level-atlas/9b0da93e74fd42af858d38c1f859bfd8ae21e9963eda0b1a0d05135e8fe6cc8a/schema.json'), 'utf8')); return s.end; })();
    const from = parseWhen(arg('from')) ?? to - 182 * 24 * H;
    const req: ScanRequest = { setup: res.detector.id, symbol: (arg('symbol') ?? 'HYPEUSDT').toUpperCase(), from, to, lagMs: Number(arg('lag') ?? 60) * 1000, tape: 'auto', params: { ...res.detector.defaults }, charts: false, maxChartEvents: 0 };
    const sources = detectorSources(res.detector);
    const scan = await runScan(ROOT, res.detector, req, sources);
    scanKey = scan.key;
    console.error(`[setup-replay] scan ${scan.reused ? 'reused' : 'ran'}: ${scan.confirmed} confirmed of ${scan.events} events (${scanKey.slice(0, 12)})`);
  }
  const sides = (arg('sides') ?? 'long,short').split(',').map(s => s.trim() === 'short' ? -1 : 1) as (1 | -1)[];
  const cfg: ReplayConfig = { scanKey, sides: [...new Set(sides)], targets: (arg('targets') ?? 'structural,r1.5,r2,r3').split(',').map(s => s.trim()), holds: (arg('holds') ?? '24,72').split(',').map(Number),
    delaysMs: (arg('delays') ?? '0,60').split(',').map(s => Number(s) * 1000), notional: Number(arg('notional') ?? 10000), equity: Number(arg('equity') ?? 32000), fee: Number(arg('fee') ?? 0.00055), stressBpsPerSide: Number(arg('stress-bps') ?? 5),
    riskMinPct: Number(arg('risk-min') ?? 0.2), riskMaxPct: Number(arg('risk-max') ?? 5), stopBufferPct: Number(arg('stop-buffer-pct') ?? 0), includeControls: flag('include-controls'), split: parseWhen(arg('split')), rows: parseRowFilter(arg('rows')), ...(arg('ref') ? { refStage: arg('ref') } : {}), ...(parseEntryLimit() ? { entryLimit: parseEntryLimit()! } : {}) };
  const t0 = Date.now();
  const out = await runReplay(ROOT, cfg);
  console.log(JSON.stringify({ key: out.key, dir: path.relative(ROOT, out.dir).replace(/\\/g, '/'), reused: out.reused, seconds: +((Date.now() - t0) / 1000).toFixed(1), report: path.relative(ROOT, path.join(out.dir, 'report.md')).replace(/\\/g, '/') }, null, 2));
  if (!flag('quiet')) process.stdout.write('\n' + out.report);
}

if (require.main === module) main().catch(e => { console.error(`[setup-replay] ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
