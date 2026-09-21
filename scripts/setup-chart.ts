/**
 * Setup chart: a self-contained HTML page for visual fidelity review of a setup scan or replay.
 *
 * Research-only. It reads the artifacts a scan/replay already wrote (candles-1m.jsonl, events.jsonl,
 * trades-<cell>.csv, results.json, actions.json) and never recomputes detection or economics.
 * The page draws candles at 1h/15m, every stage of a selected event with its `at` and `known-at`,
 * the immutable zone, the reference pivots from their availability forward, the bracket actually
 * replayed, and shades everything after known-at as outcome. It is for asking "is this what the
 * source drew?", not for tuning conventions by eye.
 *
 *   npx ts-node scripts/setup-chart.ts --setup PA02                # latest replay (or scan) for the setup
 *   npx ts-node scripts/setup-chart.ts --replay <key|dir>          # a specific replay run
 *   npx ts-node scripts/setup-chart.ts --scan <key|dir> --rows all # scan only, include non-confirmed attempts
 *   options: --tf 1h,15m   --out <file>   --rows confirmed|all
 */
import fs from 'fs';
import path from 'path';
import { aggregateBars, gapsOf, H, loadTape, M, ROOT, type Minute, type Row, type SetupEvent } from './setup-scan-core';

export const TF_PRESETS: Record<string, number> = { '5m': 5 * M, '15m': 15 * M, '30m': 30 * M, '1h': H, '2h': 2 * H, '4h': 4 * H };
const LIB_URL = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4/dist/lightweight-charts.standalone.production.js';

export interface StageView { name: string; at: number; knownAt: number; price: number | null; note: string | null }
export interface PivotRef { id: string; kind: 'high' | 'low'; price: number; pivotAt: number; availableAt: number }
export interface EventView {
  id: string; setup: string; version: string; side: 1 | -1; stage: string; reason: string | null;
  formationAt: number; knownAt: number; stages: StageView[]; zone: { low: number; high: number; from: number } | null;
  pivots: PivotRef[]; proxies: { entry: number | null; stop: number | null; target: number | null }; notes: string[];
}
export interface TradeView {
  id: string; signalAt: number; entryAt: number; exitAt: number; entryPrice: number; exitPrice: number; side: 1 | -1;
  stop: number; target: number; reason: string; net: number; r: number | null; fees: number; touchedBoth: boolean;
}
export interface CellView {
  id: string; side: 'long' | 'short'; target: string; holdHours: number; summary: Row | null;
  trades: TradeView[]; rejected: { id: string; reason: string; riskPct?: number }[]; discarded: { id: string }[];
}
export interface ChartModel {
  mode: 'replay' | 'scan'; title: string; symbol: string; setup: string; version: string;
  window: { from: number; to: number }; tape: string; tapeNote: string; tapeSpan: { start: number; end: number; rows: number; gaps: number };
  keys: { scan: string; replay: string | null };
  conventions: string[]; generatedAt: number; rowsIncluded: 'confirmed' | 'all';
  timeframes: { label: string; ms: number; bars: number[][] }[];
  events: EventView[]; cells: CellView[];
}

// ── small readers ──
export function parseCsv(text: string): Row[] {
  const rows: string[][] = []; let cur: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(field); field = ''; rows.push(cur); cur = []; }
    else field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const kept = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
  if (!kept.length) return [];
  const [head, ...body] = kept;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const num = (v: unknown): number | null => (v === '' || v === null || v === undefined ? null : Number(v));
const readJsonl = <T,>(file: string): T[] => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as T);
const readJson = (file: string): Row => JSON.parse(fs.readFileSync(file, 'utf8')) as Row;

/** The scan's saved minute tape (`{ts,o,h,l,c,v}` rows) as Minutes; availability modeled as end + 60s (display only). */
export function readScanMinutes(scanDir: string): Minute[] {
  const file = path.join(scanDir, 'candles-1m.jsonl');
  if (!fs.existsSync(file)) throw new Error(`scan has no candles-1m.jsonl: ${scanDir}`);
  return readJsonl<{ ts: number; o: number; h: number; l: number; c: number; v: number }>(file)
    .map(r => ({ ts: r.ts, endTs: r.ts + M, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v, turnover: 0, availableAt: r.ts + 2 * M }));
}

export type TapePreference = 'auto' | 'sealed' | 'live' | 'research' | 'scan-file';

/**
 * The tape the scan actually used (sealed cache or live file over the scan's exact span, same loader as the
 * scanner). The scan's own candles-1m.jsonl is only a slice around the charted events (96h before the earliest
 * of the last `maxChartEvents` confirmed events), so it is used only as a fallback and the page says so.
 */
export async function loadModelMinutes(root: string, scanDir: string, scanPlan: Row, prefer?: TapePreference): Promise<{ minutes: Minute[]; tape: string; note: string }> {
  const req = (scanPlan.request ?? {}) as Row; const t = (scanPlan.tape ?? {}) as Row;
  const symbol = String(req.symbol ?? ''); const start = Number(t.start ?? req.from), end = Number(t.end ?? req.to); const lag = Number(req.lagMs ?? 60_000);
  const want: TapePreference = prefer ?? ((req.tape as TapePreference | undefined) ?? 'auto');
  if (want !== 'scan-file' && symbol && Number.isFinite(start) && Number.isFinite(end) && end > start) {
    try {
      const { minutes, identity } = await loadTape(root, symbol, start, end, lag, want);
      const same = !t.sha256 || identity.sha256 === t.sha256;
      return { minutes, tape: identity.source, note: `${identity.source} ${identity.file} (${identity.rows.toLocaleString()} minutes, ${identity.gaps.length} gaps)${same ? '' : ' · WARNING: tape hash differs from the one the scan recorded; candles may not match what the detector saw'}` };
    } catch (e) {
      const minutes = readScanMinutes(scanDir);
      return { minutes, tape: 'scan_slice', note: `fallback to the scan's candles-1m.jsonl because the scan tape could not be loaded (${(e as Error).message}); that file is only a slice around the charted events (${minutes.length.toLocaleString()} minutes), so earlier events have no candles` };
    }
  }
  const minutes = readScanMinutes(scanDir);
  return { minutes, tape: 'scan_slice', note: `scan candles-1m.jsonl (${minutes.length.toLocaleString()} minutes): a slice around the charted events, not the full window` };
}

/** Compact bars for the page: [startSeconds, open, high, low, close, volume]. Same gap semantics as the detectors. */
export function barsFor(minutes: readonly Minute[], tf: number): number[][] {
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return aggregateBars(minutes, tf).map(b => [b.timestamp / 1000, r(b.open), r(b.high), r(b.low), r(b.close), Math.round(b.volume * 100) / 100]);
}

export function parseTimeframes(spec: string | undefined): { label: string; ms: number }[] {
  const items = (spec ?? '1h,15m').split(',').map(s => s.trim()).filter(Boolean);
  return items.map(label => {
    const ms = TF_PRESETS[label] ?? (/^\d+$/.test(label) ? Number(label) * M : NaN);
    if (!Number.isFinite(ms)) throw new Error(`unknown timeframe ${label}; use ${Object.keys(TF_PRESETS).join(', ')} or minutes`);
    return { label, ms };
  });
}

// ── event views ──
const isPivotLike = (v: unknown): v is PivotRef & Row =>
  !!v && typeof v === 'object' && ((v as Row).kind === 'high' || (v as Row).kind === 'low') && typeof (v as Row).price === 'number' && typeof (v as Row).pivotAt === 'number';

export function extractPivots(reference: Row | undefined, depth = 0, out = new Map<string, PivotRef>()): PivotRef[] {
  if (!reference || typeof reference !== 'object' || depth > 3) return [...out.values()];
  for (const v of Object.values(reference)) {
    if (isPivotLike(v)) {
      const id = String((v as Row).id ?? `${v.kind}:${v.pivotAt}:${v.price}`);
      if (!out.has(id)) out.set(id, { id, kind: v.kind, price: v.price, pivotAt: v.pivotAt, availableAt: Number((v as Row).availableAt ?? (v as Row).confirmationEnd ?? v.pivotAt) });
    } else if (v && typeof v === 'object' && !Array.isArray(v)) extractPivots(v as Row, depth + 1, out);
  }
  return [...out.values()];
}

export function extractZone(ev: SetupEvent): EventView['zone'] {
  const ref = (ev.reference ?? {}) as Row;
  for (const key of ['zone', 'box', 'originBox', 'origin']) {
    const z = ref[key] as Row | undefined;
    if (z && typeof z.low === 'number' && typeof z.high === 'number') {
      // An origin candle is not a publication timestamp. Never paint a qualified
      // zone backwards to a candle which only acquired that meaning later.
      const publications = [z.availableAt, z.knownAt, ev.stages?.zone?.knownAt, ev.stages?.origin?.knownAt]
        .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
      const from = publications.length ? Math.max(...publications) : ev.knownAt;
      return { low: z.low, high: z.high, from };
    }
  }
  for (const [name, s] of Object.entries(ev.stages ?? {})) {
    const m = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/.exec(s.note ?? '');
    if (m) { const a = Number(m[1]), b = Number(m[2]); return { low: Math.min(a, b), high: Math.max(a, b), from: s.knownAt }; void name; }
  }
  return null;
}

export function toEventView(ev: SetupEvent): EventView {
  const stages = Object.entries(ev.stages ?? {}).map(([name, s]) => ({ name, at: s.at, knownAt: s.knownAt, price: typeof s.price === 'number' ? s.price : null, note: s.note ?? null }))
    .sort((a, b) => a.at - b.at || a.knownAt - b.knownAt);
  return {
    id: ev.id, setup: ev.setup, version: ev.version, side: ev.side, stage: ev.stage, reason: ev.reason ?? null,
    formationAt: ev.formationAt, knownAt: ev.knownAt, stages, zone: extractZone(ev), pivots: extractPivots(ev.reference as Row),
    proxies: { entry: ev.proxies?.entry ?? null, stop: ev.proxies?.stop ?? null, target: ev.proxies?.target ?? null }, notes: ev.notes ?? [],
  };
}

export function parseCellId(cell: string): { side: 'long' | 'short'; target: string; holdHours: number } {
  const m = /^(long|short)__(.+)__hold(\d+)h$/.exec(cell);
  if (!m) throw new Error(`unrecognised cell id ${cell}`);
  return { side: m[1] as 'long' | 'short', target: m[2], holdHours: Number(m[3]) };
}

function toTrade(r: Row): TradeView {
  return {
    id: String(r.id), signalAt: Number(r.signalAt), entryAt: Number(r.entryAt), exitAt: Number(r.exitAt), entryPrice: Number(r.entryPrice), exitPrice: Number(r.exitPrice),
    side: Number(r.side) === -1 ? -1 : 1, stop: Number(r.stop), target: Number(r.target), reason: String(r.reason), net: Number(r.net), r: num(r.r), fees: Number(r.fees ?? 0),
    touchedBoth: String(r.touchedBoth) === 'true',
  };
}

// ── model ──
export function resolveDir(root: string, kind: 'scan' | 'replay', keyOrDir: string): string {
  const base = kind === 'scan' ? 'backtests/setup-scans' : 'backtests/setup-replays';
  const candidates = [keyOrDir, path.join(root, keyOrDir), path.join(root, base, keyOrDir)];
  for (const c of candidates) if (fs.existsSync(path.join(c, 'plan.json'))) return path.resolve(c);
  const dir = path.join(root, base);
  if (fs.existsSync(dir)) {
    const hit = fs.readdirSync(dir).filter(d => d.startsWith(keyOrDir) && fs.existsSync(path.join(dir, d, 'plan.json')));
    if (hit.length === 1) return path.join(dir, hit[0]);
    if (hit.length > 1) throw new Error(`ambiguous ${kind} key prefix ${keyOrDir}: ${hit.map(h => h.slice(0, 12)).join(', ')}`);
  }
  throw new Error(`${kind} not found: ${keyOrDir}`);
}

export async function buildChartModel(args: { root: string; scanDir: string; replayDir?: string | null; timeframes: { label: string; ms: number }[]; rows: 'confirmed' | 'all'; tape?: TapePreference }): Promise<ChartModel> {
  const { root, scanDir, replayDir, timeframes, rows } = args;
  const scanPlan = readJson(path.join(scanDir, 'plan.json'));
  const scanSummary = fs.existsSync(path.join(scanDir, 'summary.json')) ? readJson(path.join(scanDir, 'summary.json')) : {};
  const rawEvents = readJsonl<SetupEvent>(path.join(scanDir, 'events.jsonl'));
  const det = (scanPlan.detector ?? {}) as Row;
  const conventions = ((det.conventions ?? scanPlan.conventions ?? []) as string[]).map(String);
  const req = (scanPlan.request ?? scanPlan.req ?? {}) as Row;
  const symbol = String(scanSummary.symbol ?? req.symbol ?? 'UNKNOWN');
  const setup = String(scanSummary.setup ?? det.id ?? rawEvents[0]?.setup ?? '?');
  const version = String(scanSummary.version ?? det.version ?? rawEvents[0]?.version ?? '?');
  const window = { from: Number(scanSummary.from ?? req.from ?? 0), to: Number(scanSummary.to ?? req.to ?? 0) };

  const cells: CellView[] = [];
  const traded = new Set<string>();
  let replayKey: string | null = null;
  if (replayDir) {
    const rp = readJson(path.join(replayDir, 'plan.json'));
    replayKey = String(rp.key ?? path.basename(replayDir));
    const results = fs.existsSync(path.join(replayDir, 'results.json')) ? (JSON.parse(fs.readFileSync(path.join(replayDir, 'results.json'), 'utf8')) as Row[]) : [];
    const actions = fs.existsSync(path.join(replayDir, 'actions.json')) ? readJson(path.join(replayDir, 'actions.json')) : {};
    const files = fs.readdirSync(replayDir).filter(f => /^trades-.+\.csv$/.test(f)).sort();
    for (const f of files) {
      const cell = f.slice('trades-'.length, -'.csv'.length);
      const meta = parseCellId(cell);
      const trades = parseCsv(fs.readFileSync(path.join(replayDir, f), 'utf8')).map(toTrade).sort((a, b) => a.entryAt - b.entryAt);
      for (const t of trades) traded.add(t.id);
      const summary = results.find(r => r.cell === cell && r.window === 'full' && Number(r.delay) === 0 && String(r.targetFirst) === 'false' && String(r.stress) === 'false') ?? null;
      const a = (actions[cell] ?? {}) as Row;
      const rejected = ((a.rejected ?? []) as Row[]).map(r => ({ id: String(r.id), reason: String(r.reason), ...(typeof r.riskPct === 'number' ? { riskPct: r.riskPct } : {}) }));
      const discarded = ((a.discarded ?? []) as Row[]).map(r => ({ id: String(r.id) }));
      cells.push({ id: cell, ...meta, summary, trades, rejected, discarded });
    }
  }
  const events = rawEvents.filter(e => rows === 'all' || e.stage === 'confirmed' || traded.has(e.id)).map(toEventView).sort((a, b) => a.knownAt - b.knownAt);

  const loaded = await loadModelMinutes(root, scanDir, scanPlan, args.tape);
  const minutes = loaded.minutes;
  const tfs = timeframes.map(t => ({ label: t.label, ms: t.ms, bars: barsFor(minutes, t.ms) }));
  return {
    mode: replayDir ? 'replay' : 'scan', title: `${setup} ${version} on ${symbol}`, symbol, setup, version, window, tape: loaded.tape, tapeNote: loaded.note,
    tapeSpan: { start: minutes[0]?.ts ?? 0, end: minutes.length ? minutes[minutes.length - 1].endTs : 0, rows: minutes.length, gaps: gapsOf(minutes).length },
    keys: { scan: String(scanPlan.key ?? scanSummary.key ?? path.basename(scanDir)), replay: replayKey },
    conventions, generatedAt: Date.now(), rowsIncluded: rows, timeframes: tfs, events, cells,
  };
}

// ── page ──
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderChartHtml(model: ChartModel): string {
  const data = JSON.stringify(model).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  const sub = `${model.mode} · window ${iso(model.window.from)} to ${iso(model.window.to)} UTC · scan ${model.keys.scan.slice(0, 12)}${model.keys.replay ? ' · replay ' + model.keys.replay.slice(0, 12) : ''}`;
  const tapeLine = `candles ${iso(model.tapeSpan.start)} to ${iso(model.tapeSpan.end)} UTC from ${model.tapeNote}`;
  const tapeClass = /WARNING|slice/.test(model.tapeNote) ? 'sub warn' : 'sub';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(model.setup)} chart · ${esc(model.symbol)}</title>
<style>
${CSS}
</style>
</head>
<body>
<header>
  <div class="hgroup"><h1>${esc(model.title)}</h1><div class="sub">${esc(sub)}</div><div class="${tapeClass}">${esc(tapeLine)}</div></div>
  <div class="controls">
    <label>Cell <select id="cell"></select></label>
    <label>Timeframe <select id="tf"></select></label>
    <label>Outcome <select id="freason"><option value="all">all</option><option value="target">target</option><option value="stop">stop</option><option value="timeout">timeout</option></select></label>
    <label>Side <select id="fside"><option value="all">all</option><option value="1">long</option><option value="-1">short</option></select></label>
    <label><input type="checkbox" id="allmarks" checked> all entries as markers</label>
    <button id="conv" type="button">conventions</button>
  </div>
</header>
<div id="status" class="status"></div>
<main>
  <aside>
    <div id="cellsummary" class="cellsummary"></div>
    <div id="list" class="list" tabindex="0"></div>
    <div id="untraded" class="untraded"></div>
  </aside>
  <section class="chartwrap">
    <div id="chart"></div>
    <canvas id="overlay"></canvas>
    <div id="hover" class="hover"></div>
    <div class="legend">
      <span class="k"><i style="background:rgba(80,160,255,.35)"></i>zone (from publication)</span>
      <span class="k"><i style="background:#9aa5b1"></i>reference pivot (from availability)</span>
      <span class="k"><i style="background:#f5c542"></i>stage known-at</span>
      <span class="k"><i style="background:#ef5350"></i>stop</span>
      <span class="k"><i style="background:#26a69a"></i>target</span>
      <span class="k"><i style="background:rgba(255,255,255,.12)"></i>outcome (after known-at)</span>
    </div>
  </section>
</main>
<footer id="details" class="details"></footer>
<dialog id="convdlg"><h2>Detector conventions (${esc(model.version)})</h2><ol>${model.conventions.map(c => `<li>${esc(c)}</li>`).join('')}</ol><p class="muted">Every numerical choice the sources do not specify. Changing one is a new detector version; do not tune them after looking at outcomes here.</p><form method="dialog"><button>close</button></form></dialog>
<script id="chart-data" type="application/json">${data}</script>
<script src="${LIB_URL}"></script>
<script>
${CLIENT_JS}
</script>
</body>
</html>
`;
}

const CSS = `
:root { --bg:#0f1419; --panel:#151c23; --line:#243039; --text:#d7dee5; --muted:#8a96a3; --up:#26a69a; --down:#ef5350; --accent:#f5c542; }
* { box-sizing: border-box; }
html, body { margin:0; height:100%; background:var(--bg); color:var(--text); font: 13px/1.4 Inter, "Segoe UI", Arial, sans-serif; }
body { display:flex; flex-direction:column; }
header { display:flex; flex-wrap:wrap; gap:12px 24px; align-items:center; padding:10px 16px; border-bottom:1px solid var(--line); background:var(--panel); }
h1 { font-size:16px; margin:0; } .sub { color:var(--muted); font-size:12px; }
.controls { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin-left:auto; }
.controls label { color:var(--muted); } select, button { background:#0f1419; color:var(--text); border:1px solid var(--line); border-radius:4px; padding:3px 6px; font:inherit; }
button { cursor:pointer; } .status { padding:0 16px; color:var(--down); }
main { flex:1; display:flex; min-height:0; }
aside { width:340px; min-width:260px; border-right:1px solid var(--line); display:flex; flex-direction:column; min-height:0; background:var(--panel); }
.cellsummary { padding:8px 12px; border-bottom:1px solid var(--line); font-size:12px; color:var(--muted); }
.cellsummary b { color:var(--text); }
.list { flex:1; overflow:auto; outline:none; }
.row { display:grid; grid-template-columns: 34px 1fr 42px 64px 44px 58px; gap:6px; padding:5px 10px; border-bottom:1px solid #1b242c; cursor:pointer; font-variant-numeric: tabular-nums; }
.row:hover { background:#1a2530; } .row.sel { background:#22313f; }
.row .pos { color:var(--up); } .row .neg { color:var(--down); } .row .muted { color:var(--muted); }
.untraded { max-height:30%; overflow:auto; border-top:1px solid var(--line); font-size:12px; }
.untraded h3 { margin:6px 10px; font-size:12px; color:var(--muted); font-weight:600; }
.untraded .row { grid-template-columns: 1fr 120px; }
.chartwrap { flex:1; position:relative; min-width:0; }
#chart { position:absolute; inset:0; }
/* lightweight-charts gives its own canvases z-index 1 and 2 inside #chart; the overlay and labels must sit above them */
#chart { z-index: 0; }
#overlay { position:absolute; left:0; top:0; pointer-events:none; z-index: 5; }
.hover { position:absolute; left:10px; top:8px; font-size:12px; color:var(--muted); pointer-events:none; background:rgba(15,20,25,.7); padding:2px 6px; border-radius:4px; z-index: 6; }
.legend { position:absolute; right:70px; top:8px; display:flex; gap:12px; font-size:11px; color:var(--muted); pointer-events:none; flex-wrap:wrap; justify-content:flex-end; z-index: 6; }
.legend i { display:inline-block; width:10px; height:10px; margin-right:4px; vertical-align:-1px; border-radius:2px; }
.details { border-top:1px solid var(--line); background:var(--panel); padding:8px 16px; max-height:34vh; overflow:auto; font-size:12px; }
.details table { border-collapse:collapse; margin:4px 0 8px; } .details td, .details th { padding:2px 10px 2px 0; text-align:left; white-space:nowrap; font-variant-numeric: tabular-nums; }
.details th { color:var(--muted); font-weight:600; } .details .cols { display:flex; gap:32px; flex-wrap:wrap; }
.muted { color:var(--muted); } .warn { color:var(--accent); }
dialog { background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:6px; max-width:800px; font-size:13px; }
dialog::backdrop { background:rgba(0,0,0,.6); } dialog li { margin:4px 0; }
@media (max-width: 900px) { main { flex-direction:column; } aside { width:auto; max-height:40vh; border-right:none; border-bottom:1px solid var(--line); } .legend { display:none; } }
`;

const CLIENT_JS = `
(function () {
  var DATA = JSON.parse(document.getElementById('chart-data').textContent);
  var LC = window.LightweightCharts;
  var $ = function (id) { return document.getElementById(id); };
  var el = { chart: $('chart'), overlay: $('overlay'), hover: $('hover'), list: $('list'), untraded: $('untraded'), details: $('details'), cell: $('cell'), tf: $('tf'), freason: $('freason'), fside: $('fside'), allmarks: $('allmarks'), cellsummary: $('cellsummary'), status: $('status') };
  if (!LC) { el.status.textContent = 'lightweight-charts did not load from the CDN (' + '${LIB_URL}' + '). The page needs network access once; the data is embedded.'; return; }
  var HOUR = 3600000;
  var STAGE_COLORS = ['#f5c542', '#ff9f43', '#50a0ff', '#c084fc', '#34d399', '#f472b6', '#facc15', '#a3e635'];
  var state = { tf: 0, cell: 0, sel: null, reason: 'all', side: 'all', allmarks: true };
  var eventsById = {}; DATA.events.forEach(function (e) { eventsById[e.id] = e; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function hm(ms) { var d = new Date(ms); return pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function money(x) { return (x < 0 ? '-' : '+') + '$' + Math.abs(x).toFixed(0); }
  function fix(x, n) { return x === null || x === undefined || isNaN(x) ? '-' : Number(x).toFixed(n); }
  function dur(ms) { var h = ms / HOUR; return h < 1 ? Math.round(ms / 60000) + 'm' : h < 48 ? h.toFixed(1) + 'h' : (h / 24).toFixed(1) + 'd'; }

  var chart = LC.createChart(el.chart, {
    autoSize: true,
    layout: { background: { color: '#0f1419' }, textColor: '#c7d0d9' },
    grid: { vertLines: { color: '#1c242c' }, horzLines: { color: '#1c242c' } },
    rightPriceScale: { borderColor: '#2a343e' },
    timeScale: { borderColor: '#2a343e', timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: { mode: 0 },
    localization: { timeFormatter: function (t) { return iso(t * 1000) + ' UTC'; } }
  });
  var series = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
  var bars = [], times = [], tfMs = 0;

  function setTf(i) {
    var range = visibleTimeRange();
    state.tf = i; var tf = DATA.timeframes[i]; bars = tf.bars; tfMs = tf.ms;
    times = bars.map(function (b) { return b[0]; });
    series.setData(bars.map(function (b) { return { time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }; }));
    if (range) chart.timeScale().setVisibleRange(range);
    applyMarkers(); draw();
  }
  function visibleTimeRange() { try { var r = chart.timeScale().getVisibleRange(); return r ? { from: r.from, to: r.to } : null; } catch (e) { return null; } }
  function barIndexAt(ms) { var s = ms / 1000, lo = 0, hi = times.length - 1; if (!times.length || s < times[0]) return 0; if (s >= times[hi]) return hi; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (times[mid] <= s) lo = mid; else hi = mid; } return lo; }
  function logicalOf(ms) {
    var s = ms / 1000; if (times.length < 2) return 0;
    var step = tfMs / 1000;
    if (s < times[0]) return (s - times[0]) / step;
    var i = barIndexAt(ms); if (i >= times.length - 1) return i + (s - times[i]) / step;
    return i + (s - times[i]) / (times[i + 1] - times[i]);
  }
  function xOf(ms) {
    var vr = chart.timeScale().getVisibleLogicalRange(); if (!vr) return null;
    var x0 = chart.timeScale().logicalToCoordinate(vr.from), x1 = chart.timeScale().logicalToCoordinate(vr.to);
    if (x0 === null || x1 === null || vr.to === vr.from) return null;
    return x0 + (logicalOf(ms) - vr.from) * (x1 - x0) / (vr.to - vr.from);
  }
  function yOf(p) { return series.priceToCoordinate(p); }

  // ── overlay ──
  function paneSize() { var w = el.chart.clientWidth - chart.priceScale('right').width(); var h = el.chart.clientHeight - chart.timeScale().height(); return { w: w, h: h }; }
  function fitOverlay() { var dpr = window.devicePixelRatio || 1; var p = paneSize(); el.overlay.width = Math.max(1, Math.floor(p.w * dpr)); el.overlay.height = Math.max(1, Math.floor(p.h * dpr)); el.overlay.style.width = p.w + 'px'; el.overlay.style.height = p.h + 'px'; }
  function hline(ctx, x1, x2, y, color, dash, label, w) {
    if (y === null || y === undefined) return; var p = paneSize(); var a = Math.max(0, Math.min(p.w, Math.min(x1, x2))), b = Math.max(0, Math.min(p.w, Math.max(x1, x2)));
    if (b - a < 1) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w || 1.2; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
    if (label) { ctx.fillStyle = color; ctx.font = '11px Inter, Segoe UI, Arial'; ctx.textAlign = 'left'; ctx.fillText(label, a + 4, y - 3); } ctx.restore();
  }
  function vline(ctx, x, color, dash, label, row) {
    var p = paneSize(); if (x === null || x < 0 || x > p.w) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, p.h); ctx.stroke();
    if (label) { ctx.fillStyle = color; ctx.font = '10px Inter, Segoe UI, Arial'; ctx.textAlign = 'left'; ctx.fillText(label, x + 3, 12 + (row || 0) * 12); } ctx.restore();
  }
  function draw() {
    fitOverlay(); var ctx = el.overlay.getContext('2d'); var dpr = window.devicePixelRatio || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); var p = paneSize(); ctx.clearRect(0, 0, p.w, p.h);
    var sel = state.sel; if (!sel) return; var ev = sel.event, tr = sel.trade; if (!ev) return;
    var cell = DATA.cells[state.cell]; var hold = (cell ? cell.holdHours : 24) * HOUR;
    var endMs = tr ? tr.exitAt : ev.knownAt + hold;
    var xKnown = xOf(ev.knownAt), xEnd = xOf(endMs);
    // outcome shade: everything after the event's known-at is outcome, never input
    if (xKnown !== null && xEnd !== null) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.045)'; var a = Math.max(0, xKnown), b = Math.min(p.w, xEnd); if (b > a) { ctx.fillRect(a, 0, b - a, p.h); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px Inter, Segoe UI, Arial'; ctx.textAlign = 'right'; ctx.fillText('outcome (after known-at)', b - 4, p.h - 6); } ctx.restore(); }
    // zone from its publication to the end
    if (ev.zone) { var zx0 = xOf(ev.zone.from), zy0 = yOf(ev.zone.high), zy1 = yOf(ev.zone.low); if (zx0 !== null && xEnd !== null && zy0 !== null && zy1 !== null) { ctx.save(); var zx = Math.max(0, zx0), zw = Math.min(p.w, xEnd) - zx; if (zw > 0) { ctx.fillStyle = ev.side === 1 ? 'rgba(80,160,255,0.16)' : 'rgba(255,140,80,0.16)'; ctx.fillRect(zx, zy0, zw, zy1 - zy0); ctx.strokeStyle = ev.side === 1 ? 'rgba(80,160,255,0.7)' : 'rgba(255,140,80,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(zx, zy0, zw, zy1 - zy0); ctx.fillStyle = ctx.strokeStyle; ctx.font = '10px Inter, Segoe UI, Arial'; ctx.textAlign = 'left'; ctx.fillText('zone [' + ev.zone.low + ', ' + ev.zone.high + '] published ' + hm(ev.zone.from), zx + 4, zy0 - 3); } ctx.restore(); } }
    // reference pivots from availability forward
    ev.pivots.forEach(function (pv) { var x0 = xOf(pv.availableAt); if (x0 === null || xEnd === null) return; hline(ctx, x0, xEnd, yOf(pv.price), '#9aa5b1', [2, 4], pv.kind + ' ' + pv.price + ' (pivot ' + hm(pv.pivotAt) + ', avail ' + hm(pv.availableAt) + ')', 1); });
    // stage known-at lines
    ev.stages.forEach(function (s, i) { vline(ctx, xOf(s.knownAt), STAGE_COLORS[i % STAGE_COLORS.length], [3, 3], s.name + ' known ' + hm(s.knownAt), i); });
    // bracket
    if (tr) {
      var xe = xOf(tr.entryAt), xx = xOf(tr.exitAt);
      if (xe !== null && xx !== null) { hline(ctx, xe, xx, yOf(tr.entryPrice), '#c7d0d9', [], 'entry ' + tr.entryPrice, 1.2); hline(ctx, xe, xx, yOf(tr.stop), '#ef5350', [], 'stop ' + fix(tr.stop, 4), 1.4); hline(ctx, xe, xx, yOf(tr.target), '#26a69a', [], 'target ' + fix(tr.target, 4), 1.4); }
    } else if (xKnown !== null && xEnd !== null) {
      if (ev.proxies.stop !== null) hline(ctx, xKnown, xEnd, yOf(ev.proxies.stop), '#ef5350', [6, 4], 'stop proxy ' + fix(ev.proxies.stop, 4), 1.2);
      if (ev.proxies.target !== null) hline(ctx, xKnown, xEnd, yOf(ev.proxies.target), '#26a69a', [6, 4], 'target proxy ' + fix(ev.proxies.target, 4), 1.2);
    }
  }

  // ── markers ──
  function snap(ms) { var i = barIndexAt(ms); return times[i]; }
  function applyMarkers() {
    var marks = []; var cell = DATA.cells[state.cell]; var sel = state.sel;
    if (state.allmarks) {
      if (cell) cell.trades.forEach(function (t) { if (sel && sel.trade && sel.trade.id === t.id && sel.trade.entryAt === t.entryAt) return; marks.push({ time: snap(t.entryAt), position: t.side === 1 ? 'belowBar' : 'aboveBar', shape: t.side === 1 ? 'arrowUp' : 'arrowDown', color: t.net >= 0 ? 'rgba(38,166,154,0.75)' : 'rgba(239,83,80,0.75)', size: 0.8 }); });
      else DATA.events.forEach(function (e) { if (e.stage !== 'confirmed') return; marks.push({ time: snap(e.knownAt), position: e.side === 1 ? 'belowBar' : 'aboveBar', shape: 'circle', color: e.side === 1 ? 'rgba(80,160,255,0.7)' : 'rgba(255,140,80,0.7)', size: 0.6 }); });
    }
    if (sel && sel.event) {
      sel.event.stages.forEach(function (s, i) { var bi = barIndexAt(s.at); var above = s.price !== null && bars[bi] ? s.price >= (bars[bi][2] + bars[bi][3]) / 2 : sel.event.side === -1; marks.push({ time: times[bi], position: above ? 'aboveBar' : 'belowBar', shape: 'circle', color: STAGE_COLORS[i % STAGE_COLORS.length], text: s.name + (s.price !== null ? ' ' + s.price : ''), size: 1 }); });
      if (sel.trade) {
        marks.push({ time: snap(sel.trade.entryAt), position: sel.trade.side === 1 ? 'belowBar' : 'aboveBar', shape: sel.trade.side === 1 ? 'arrowUp' : 'arrowDown', color: '#ffffff', text: 'entry ' + sel.trade.entryPrice, size: 1.4 });
        marks.push({ time: snap(sel.trade.exitAt), position: sel.trade.side === 1 ? 'aboveBar' : 'belowBar', shape: 'square', color: sel.trade.reason === 'target' ? '#26a69a' : sel.trade.reason === 'stop' ? '#ef5350' : '#9aa5b1', text: sel.trade.reason + ' ' + money(sel.trade.net), size: 1.2 });
      }
    }
    marks.sort(function (a, b) { return a.time - b.time; });
    series.setMarkers(marks);
  }

  // ── selection ──
  function select(eventId, trade, focus) {
    var ev = eventsById[eventId] || null; state.sel = { event: ev, trade: trade || null };
    if (focus && ev) {
      var first = ev.stages.length ? ev.stages[0].at : ev.formationAt; var cell = DATA.cells[state.cell];
      var end = trade ? trade.exitAt : ev.knownAt + (cell ? cell.holdHours : 24) * HOUR;
      var span = Math.max(end - first, 12 * tfMs); var padMs = Math.max(span * 0.15, 6 * tfMs);
      chart.timeScale().setVisibleRange({ from: (first - padMs) / 1000, to: (end + padMs) / 1000 });
    }
    applyMarkers(); draw(); renderDetails(); highlightRow();
  }
  function highlightRow() { var rows = el.list.querySelectorAll('.row'); rows.forEach(function (r) { r.classList.toggle('sel', !!state.sel && r.dataset.id === (state.sel.trade ? state.sel.trade.id + '@' + state.sel.trade.entryAt : state.sel.event.id + '@')); }); var s = el.list.querySelector('.row.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' }); }

  // ── lists ──
  function visibleTrades() { var cell = DATA.cells[state.cell]; if (!cell) return []; return cell.trades.filter(function (t) { return (state.reason === 'all' || t.reason === state.reason) && (state.side === 'all' || String(t.side) === state.side); }); }
  function visibleEvents() { return DATA.events.filter(function (e) { return (state.side === 'all' || String(e.side) === state.side) && (state.reason === 'all' || e.stage === 'confirmed'); }); }
  function renderList() {
    var cell = DATA.cells[state.cell]; var html = '';
    if (cell) {
      var ts = visibleTrades();
      html += '<div class="row muted"><span>#</span><span>entry (UTC)</span><span>side</span><span>net</span><span>R</span><span>exit</span></div>';
      ts.forEach(function (t, i) { html += '<div class="row" data-id="' + t.id + '@' + t.entryAt + '" data-i="' + i + '"><span class="muted">' + (i + 1) + '</span><span>' + iso(t.entryAt) + '</span><span>' + (t.side === 1 ? 'long' : 'short') + '</span><span class="' + (t.net >= 0 ? 'pos' : 'neg') + '">' + money(t.net) + '</span><span>' + fix(t.r, 2) + '</span><span class="muted">' + t.reason + '</span></div>'; });
      el.list.innerHTML = html;
      el.list.querySelectorAll('.row[data-i]').forEach(function (r) { r.addEventListener('click', function () { var t = ts[Number(r.dataset.i)]; select(t.id, t, true); }); });
      var s = cell.summary; el.cellsummary.innerHTML = s ? '<b>' + cell.id + '</b> · full window, delay 0, stop-first · <b>' + s.n + '</b> trades, W/L <b>' + s.wins + '/' + s.losses + '</b> · net <b>' + money(s.net) + '</b> (stress ' + money(s.stressNet) + ') · DD <b>' + fix(s.maxCloseDrawdownPct, 1) + '%</b> · PF ' + fix(s.profitFactor, 2) + ' · avg R ' + fix(s.avgR, 2) + ' · exits target/stop/time ' + s.targets + '/' + s.stops + '/' + s.timeouts + ' · skipped occupied ' + s.skippedOccupied + '<br><span class="warn">Exploratory replay on development data; no frozen card.</span>' : '<b>' + cell.id + '</b>';
      var un = ''; if (cell.rejected.length) { un += '<h3>not traded: rejected at action build (' + cell.rejected.length + ')</h3>'; cell.rejected.forEach(function (r) { un += '<div class="row" data-ev="' + r.id + '"><span>' + (eventsById[r.id] ? iso(eventsById[r.id].knownAt) : r.id) + '</span><span class="muted">' + r.reason + (r.riskPct !== undefined ? ' ' + r.riskPct.toFixed(1) + '%' : '') + '</span></div>'; }); }
      if (cell.discarded.length) { un += '<h3>discarded same-minute ties (' + cell.discarded.length + ')</h3>'; cell.discarded.forEach(function (r) { un += '<div class="row" data-ev="' + r.id + '"><span>' + (eventsById[r.id] ? iso(eventsById[r.id].knownAt) : r.id) + '</span><span class="muted">tie</span></div>'; }); }
      el.untraded.innerHTML = un;
      el.untraded.querySelectorAll('.row[data-ev]').forEach(function (r) { r.addEventListener('click', function () { if (eventsById[r.dataset.ev]) select(r.dataset.ev, null, true); }); });
    } else {
      var evs = visibleEvents();
      html += '<div class="row muted"><span>#</span><span>known-at (UTC)</span><span>side</span><span>stage</span><span></span><span>reason</span></div>';
      evs.forEach(function (e, i) { html += '<div class="row" data-id="' + e.id + '@" data-i="' + i + '"><span class="muted">' + (i + 1) + '</span><span>' + iso(e.knownAt) + '</span><span>' + (e.side === 1 ? 'long' : 'short') + '</span><span>' + e.stage + '</span><span></span><span class="muted">' + (e.reason || '') + '</span></div>'; });
      el.list.innerHTML = html;
      el.list.querySelectorAll('.row[data-i]').forEach(function (r) { r.addEventListener('click', function () { var e = evs[Number(r.dataset.i)]; select(e.id, null, true); }); });
      var conf = DATA.events.filter(function (e) { return e.stage === 'confirmed'; }).length;
      el.cellsummary.innerHTML = '<b>scan only</b> · ' + DATA.events.length + ' rows embedded (' + conf + ' confirmed' + (DATA.rowsIncluded === 'all' ? ', all attempts' : '') + ') · stop/target shown are scan proxies, no trades were replayed<br><span class="warn">Descriptive occurrence ledger, not a backtest.</span>';
      el.untraded.innerHTML = '';
    }
    highlightRow();
  }
  function renderDetails() {
    var sel = state.sel; if (!sel || !sel.event) { el.details.innerHTML = '<span class="muted">Select a trade or event. Keys: j / k next and previous, f to refit.</span>'; return; }
    var ev = sel.event, tr = sel.trade; var h = '<div class="cols">';
    h += '<div><b>' + ev.id + '</b> · ' + (ev.side === 1 ? 'long' : 'short') + ' · ' + ev.stage + (ev.reason ? ' (' + ev.reason + ')' : '') + (ev.notes.length ? ' · notes: ' + ev.notes.join(', ') : '') + '<table><tr><th>stage</th><th>at (bar start)</th><th>known-at</th><th>latency</th><th>price</th><th>note</th></tr>';
    ev.stages.forEach(function (s, i) { h += '<tr><td style="color:' + STAGE_COLORS[i % STAGE_COLORS.length] + '">' + s.name + '</td><td>' + iso(s.at) + '</td><td>' + iso(s.knownAt) + '</td><td>' + dur(s.knownAt - s.at) + '</td><td>' + (s.price === null ? '-' : s.price) + '</td><td class="muted">' + (s.note || '') + '</td></tr>'; });
    h += '</table>event known-at <b>' + iso(ev.knownAt) + '</b> UTC' + (ev.zone ? ' · zone [' + ev.zone.low + ', ' + ev.zone.high + '] from ' + iso(ev.zone.from) : ' · no zone recorded') + '</div>';
    h += '<div><b>references</b><table><tr><th>pivot</th><th>price</th><th>occurred</th><th>available</th></tr>'; ev.pivots.forEach(function (p) { h += '<tr><td>' + p.kind + '</td><td>' + p.price + '</td><td>' + iso(p.pivotAt) + '</td><td>' + iso(p.availableAt) + '</td></tr>'; }); h += '</table>';
    h += 'proxies: entry ' + (ev.proxies.entry === null ? '-' : ev.proxies.entry) + ' · stop ' + fix(ev.proxies.stop, 4) + ' · target ' + (ev.proxies.target === null ? 'none' : fix(ev.proxies.target, 4)) + '</div>';
    if (tr) {
      var risk = Math.abs(tr.entryPrice - tr.stop) / tr.entryPrice * 100, rew = Math.abs(tr.target - tr.entryPrice) / tr.entryPrice * 100;
      h += '<div><b>replayed trade</b><table><tr><th>signal</th><td>' + iso(tr.signalAt) + '</td></tr><tr><th>entry</th><td>' + iso(tr.entryAt) + ' @ ' + tr.entryPrice + '</td></tr><tr><th>exit</th><td>' + iso(tr.exitAt) + ' @ ' + fix(tr.exitPrice, 4) + ' (' + tr.reason + ', held ' + dur(tr.exitAt - tr.entryAt) + ')</td></tr><tr><th>stop / target</th><td>' + fix(tr.stop, 4) + ' (' + risk.toFixed(2) + '%) / ' + fix(tr.target, 4) + ' (' + rew.toFixed(2) + '%)</td></tr><tr><th>net</th><td class="' + (tr.net >= 0 ? 'pos' : 'neg') + '">' + money(tr.net) + ' after $' + tr.fees.toFixed(2) + ' fees · R ' + fix(tr.r, 2) + (tr.touchedBoth ? ' · <span class="warn">stop and target touched in the same minute (stop-first assumed)</span>' : '') + '</td></tr></table></div>';
    }
    h += '</div>'; el.details.innerHTML = h;
  }

  // ── wiring ──
  DATA.timeframes.forEach(function (t, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = t.label + ' (' + t.bars.length + ' bars)'; el.tf.appendChild(o); });
  if (DATA.cells.length) DATA.cells.forEach(function (c, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = c.id + (c.summary ? '  ' + money(c.summary.net) + ' / ' + c.summary.n : ''); el.cell.appendChild(o); });
  else { var o0 = document.createElement('option'); o0.textContent = 'scan only (no replay)'; el.cell.appendChild(o0); el.cell.disabled = true; }
  el.cell.addEventListener('change', function () { state.cell = Number(el.cell.value); state.sel = null; renderList(); applyMarkers(); draw(); renderDetails(); });
  el.tf.addEventListener('change', function () { setTf(Number(el.tf.value)); });
  el.freason.addEventListener('change', function () { state.reason = el.freason.value; renderList(); });
  el.fside.addEventListener('change', function () { state.side = el.fside.value; renderList(); });
  el.allmarks.addEventListener('change', function () { state.allmarks = el.allmarks.checked; applyMarkers(); });
  $('conv').addEventListener('click', function () { $('convdlg').showModal(); });
  chart.timeScale().subscribeVisibleLogicalRangeChange(function () { draw(); });
  chart.subscribeCrosshairMove(function (param) { if (!param || !param.time || !param.seriesData) { el.hover.textContent = ''; return; } var d = param.seriesData.get(series); if (!d) { el.hover.textContent = ''; return; } el.hover.textContent = iso(param.time * 1000) + ' UTC  O ' + d.open + '  H ' + d.high + '  L ' + d.low + '  C ' + d.close; });
  new ResizeObserver(function () { draw(); }).observe(el.chart);
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
    var cell = DATA.cells[state.cell]; var items = cell ? visibleTrades() : visibleEvents(); if (!items.length) return;
    var idx = -1; items.forEach(function (it, i) { if (state.sel && ((cell && state.sel.trade && state.sel.trade.id === it.id && state.sel.trade.entryAt === it.entryAt) || (!cell && state.sel.event && state.sel.event.id === it.id))) idx = i; });
    if (e.key === 'j' || e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); } else if (e.key === 'k' || e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); } else if (e.key === 'f') { if (state.sel) select(state.sel.event.id, state.sel.trade, true); return; } else return;
    e.preventDefault(); var it = items[idx]; if (cell) select(it.id, it, true); else select(it.id, null, true);
  });
  setTf(0); renderList(); renderDetails();
  if (DATA.cells.length && DATA.cells[0].trades.length) { var t0 = DATA.cells[0].trades[0]; select(t0.id, t0, true); }
  else if (DATA.events.length) select(DATA.events[0].id, null, true);
  else chart.timeScale().fitContent();
})();
`;

export async function writeChart(args: { root: string; scanDir: string; replayDir?: string | null; timeframes?: { label: string; ms: number }[]; rows?: 'confirmed' | 'all'; tape?: TapePreference; out?: string }): Promise<{ out: string; bytes: number; model: ChartModel }> {
  const model = await buildChartModel({ root: args.root, scanDir: args.scanDir, replayDir: args.replayDir ?? null, timeframes: args.timeframes ?? parseTimeframes(undefined), rows: args.rows ?? 'confirmed', tape: args.tape });
  const html = renderChartHtml(model);
  const out = args.out ?? path.join(args.replayDir ?? args.scanDir, 'chart.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return { out, bytes: Buffer.byteLength(html), model };
}

// ── CLI ──
if (require.main === module) (async () => {
  const argv = process.argv.slice(2);
  const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (k: string) => argv.includes(`--${k}`);
  if (has('help') || !argv.length) {
    console.log(`usage: setup-chart --setup <ID> | --replay <key|dir> | --scan <key|dir>   [--tf 1h,15m] [--rows confirmed|all] [--tape auto|sealed|live|scan-file] [--out <file>]`);
    process.exit(0);
  }
  let replayDir: string | null = null; let scanDir: string | null = null;
  if (arg('replay')) replayDir = resolveDir(ROOT, 'replay', arg('replay')!);
  else if (arg('scan')) scanDir = resolveDir(ROOT, 'scan', arg('scan')!);
  else if (arg('setup')) {
    const id = arg('setup')!.toUpperCase();
    const latestR = path.join(ROOT, 'backtests/setup-replays/latest.json'); const latestS = path.join(ROOT, 'backtests/setup-scans/latest.json');
    const lr = fs.existsSync(latestR) ? (readJson(latestR)[id] as Row | undefined) : undefined;
    const ls = fs.existsSync(latestS) ? (readJson(latestS)[id] as Row | undefined) : undefined;
    if (lr) replayDir = path.join(ROOT, String(lr.dir));
    else if (ls) scanDir = path.join(ROOT, String(ls.dir));
    else { console.error(`no replay or scan recorded for ${id}; run setup-scan or setup-replay first`); process.exit(1); }
  } else { console.error('give --setup, --replay or --scan'); process.exit(1); }
  if (replayDir && !scanDir) {
    const rp = readJson(path.join(replayDir, 'plan.json'));
    const cfg = (rp.cfg ?? {}) as Row;
    scanDir = resolveDir(ROOT, 'scan', String(cfg.scanKey));
  }
  const rows = (arg('rows') ?? 'confirmed') as 'confirmed' | 'all';
  if (rows !== 'confirmed' && rows !== 'all') { console.error('--rows must be confirmed or all'); process.exit(1); }
  const tape = arg('tape') as TapePreference | undefined;
  if (tape && !['auto', 'sealed', 'live', 'research', 'scan-file'].includes(tape)) { console.error('--tape must be auto, sealed, live, research or scan-file'); process.exit(1); }
  const t0 = Date.now();
  const res = await writeChart({ root: ROOT, scanDir: scanDir!, replayDir, timeframes: parseTimeframes(arg('tf')), rows, tape, out: arg('out') });
  console.log(JSON.stringify({ out: path.relative(ROOT, res.out), bytes: res.bytes, mode: res.model.mode, tape: res.model.tape, candles: `${new Date(res.model.tapeSpan.start).toISOString().slice(0, 16)} to ${new Date(res.model.tapeSpan.end).toISOString().slice(0, 16)}`, gaps: res.model.tapeSpan.gaps, events: res.model.events.length, cells: res.model.cells.length, trades: res.model.cells.reduce((n, c) => n + c.trades.length, 0), timeframes: res.model.timeframes.map(t => `${t.label}:${t.bars.length}`), ms: Date.now() - t0 }, null, 2));
})().catch(e => { console.error((e as Error).message); process.exit(1); });
