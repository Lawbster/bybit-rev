/** Descriptive tables and hindsight charts; no new economic claims. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const H=3600000,read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const pc=(n:any)=>typeof n==='number'?n.toFixed(1)+'%':'—',num=(n:any)=>typeof n==='number'?n.toFixed(2):'—';
const usd=(n:number)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`;
function csv(file:string,rows:R[]){if(!rows.length)return;const keys=[...new Set(rows.flatMap(Object.keys))];
  const cell=(x:any)=>`"${(x==null?'':typeof x==='object'?JSON.stringify(x):String(x)).replace(/"/g,'""')}"`;
  fs.writeFileSync(file,[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')+'\n');}
function plot(e:R,grid:R[],label:R){const bars=grid.filter(x=>x.at>e.at-72*H&&x.at<=e.at+72*H);assert(bars.length);
  const min=Math.min(...bars.map(b=>b.low))*.99,max=Math.max(...bars.map(b=>b.high))*1.01;
  const x=(t:number)=>50+(t-(e.at-72*H))/(144*H)*820,y=(p:number)=>240-(p-min)/(max-min)*210;
  const marks=bars.map(b=>{const xx=x(b.sourceStart+2*H),up=b.price>=b.open,col=up?'#258559':'#c3474a';return `<line x1="${xx}" x2="${xx}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${col}"/><rect x="${xx-7}" y="${Math.min(y(b.open),y(b.price))}" width="14" height="${Math.max(1,Math.abs(y(b.price)-y(b.open)))}" fill="${col}"/>`;}).join('');
  const ticks=[0,1,2,3,4].map(i=>{const p=min+(max-min)*i/4;return `<line x1="50" x2="870" y1="${y(p)}" y2="${y(p)}" stroke="#ddd"/><text x="2" y="${y(p)+4}" font-size="12">${p.toFixed(2)}</text>`;}).join('');
  return `<section><h3>${e.family} — ${new Date(e.at).toISOString()}</h3><p>Next72h: below decision ${pc(label.lowPct)}; high ${pc(label.highPct)}; peak-to-later-low ${pc(label.pullbackPct)}. Outcome-selected illustration, not an advance top prediction.</p><svg viewBox="0 0 920 275" role="img" aria-label="Closed four-hour candles, signal and later outcomes"><rect x="460" y="20" width="410" height="225" fill="#eef2f8"/>${ticks}${marks}<line x1="460" x2="460" y1="20" y2="245" stroke="#354a89" stroke-dasharray="5 4"/><text x="55" y="265">-72h (known context)</text><text x="430" y="265">signal</text><text x="700" y="265">+72h (future labels only)</text></svg></section>`;
}
export async function report(key:string){assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,p=read(`${dir}/plan.json`),
  state=read(`${dir}/state.json`),v=read(`${dir}/verification.json`),d=p.card.definition;assert(v.passed);
  await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...state.artifacts]);
  const a=read(`${out}/analysis.json`),signals:R[]=read(`${out}/signals.json`),grid:R[]=read(`${out}/contexts.json`),labels:R[]=read(`${out}/outcomes.json`),
    baselines:R[]=read(`${out}/baselines.json`),intersections:R[]=read(`${out}/add-intersections.json`),byAt=new Map(labels.map(y=>[y.at,y]));
  const dest='backtests/hype/rally-pullback-atlas-rp01-2026-09-15';fs.mkdirSync(dest,{recursive:true});
  for(const name of ['summaries','monthly','flags','descriptors','delays','confirmations'])csv(path.join(dest,`${name}.csv`),a[name]);
  csv(path.join(dest,'add-intersections.csv'),intersections);
  const catalogue=signals.map(e=>({id:e.id,family:e.family,at:e.at,iso:new Date(e.at).toISOString(),context:grid.find(x=>x.at===e.at),outcome:byAt.get(e.at)}));
  csv(path.join(dest,'event-catalogue.csv'),catalogue);
  const families=[...new Set(signals.map(e=>e.family))];
  const screen=families.map(family=>{const xs=a.summaries.filter((x:R)=>x.family===family&&x.h===24&&['pre_hl','hl_recent'].includes(x.view));
    const failures=xs.flatMap((x:R)=>[...(x.complete<20?[`${x.view}/${x.lag}:n<20`]:[]),...(x.drop5Rate===null||x.matchedDrop5===null||x.drop5Rate<=x.matchedDrop5?[`${x.view}/${x.lag}:no_positive_matched_risk_lift`]:[])]);
    return {family,descriptiveConsistency:!failures.length,failures,economicQualification:'not_tested',liveEligible:false};});
  atomicJson(path.join(dest,'risk-screen.json'),screen);
  const chosen:R[]=[];
  function choose(candidates:R[],count:number){let n=0;for(const e of candidates){if(chosen.some(x=>Math.abs(e.at-x.at)<72*H))continue;chosen.push(e);if(++n>=count)break;}}
  const complete=signals.filter(e=>byAt.get(e.at)?.horizons[72]);
  choose(complete.filter(e=>byAt.get(e.at)!.horizons[72].lowPct<=-5).sort((a,b)=>byAt.get(a.at)!.horizons[72].lowPct-byAt.get(b.at)!.horizons[72].lowPct),12);
  choose(complete.filter(e=>byAt.get(e.at)!.horizons[72].lowPct> -2&&byAt.get(e.at)!.horizons[72].highPct>=5).sort((a,b)=>byAt.get(b.at)!.horizons[72].highPct-byAt.get(a.at)!.horizons[72].highPct),6);
  const html=`<!doctype html><meta charset="utf-8"><title>HYPE rally / pullback atlas RP01</title><style>body{font:15px system-ui;margin:30px auto;max-width:1000px;color:#222}section{border-top:1px solid #bbb;margin-top:30px}svg{width:100%;height:auto}h3{margin-bottom:6px}</style><h1>HYPE rally / pullback atlas</h1><p>UTC, closed4h candles. Dark divider is the causal signal; shaded right side is future price used only to label the result. The catalogue contains every qualifying signal, not just these hindsight-selected extremes. Later cooldown or trading profit is not simulated.</p>${chosen.map(e=>plot(e,grid,byAt.get(e.at)!.horizons[72])).join('')}`;
  assert(!html.includes('NaN'));fs.writeFileSync(path.join(dest,'charts.html'),html);csv(path.join(dest,'chart-events.csv'),chosen);
  const lines=['# RP01: major HYPE rallies and subsequent pullbacks','','## TL;DR','',
    `- ${grid.length} ordinary4h reference times; ${signals.length} rule-events across ten impulse definitions, at ${new Set(signals.map(e=>e.at)).size} distinct timestamps. Within each rule, signals are separated by at least72h; families and reference outcomes overlap.`,
    `- ${screen.filter(x=>x.descriptiveConsistency).length}/10 definitions have positive volatility/calendar-matched severe-drop enrichment in both pre-HL and recent samples at0/60s lag with n>=20 in each. This is a descriptive screen, not proof of prediction or profits.`,
    '- No new cooldown strategy replay or live changes. Net/DD improvements are untested; archived Aggressive10 baselines remain unchanged.','',
    '## Scope','',
    'July1,2025 to September14,2026 15:27 UTC. Pre-HL ends May17,2026 20:43; recent starts there. Previous published window ends August19,2026 21:32. Full/published/recent views overlap; only pre-HL/recent partition the full atlas. These are previously examined samples, not untouched holdouts.',
    'A major move is a FIRST cross above6% or10% rolling close-to-close return over4/12/24/48/72h, observed at a completed UTC4h boundary. These thresholds cover different speed/size combinations; no uniquely optimal timeframe is assumed.4h is the observation cadence, not a universal entry rule.',
    'Every outcome starts at the next minute open after the completed signal bar. A60s delay uses the same source bar and a later opening price. Repaired archives model bar-end availability, not original receipt or executable ask liquidity. Future minima/maxima are labels only, never trigger inputs.',
    'We distinguish downside BELOW the decision price from a peak-to-later-trough decline AFTER more upside. Same-minute high/low ordering is not invented. Fewer pullbacks after waiting is not enough: waiting may also miss profitable rallies.',
    'Prior relevant studies: AG10-C1 shortening high-exit cooldowns lost net in every historical/TP comparison. P01 found slow/overbought structure at many selected tops but no universal pre-top HL-selling signature. This atlas tests rally-triggered risk, not a shorter wait after an actual close.','',
    '## Unchanged ladder baselines','',
    '$32k flat start, $800 x1.35, max11, Aggressive10, 0.055% each-side fees. No maker savings, complete funding settlement or liquidation certification. These are reference replay paths; the atlas does not calculate an alternative PnL.','',
    '| Window / TP | Wins / losses | Winning $ | Losing $ | Avg loss | Net incl. open | DD |','|---|---|---|---|---|---|---|'];
  for(const b of baselines){const m=b.metrics;lines.push(`| ${b.window} / ${b.tp} | ${m.profitableEpisodes}/${m.losingEpisodes} | ${usd(m.grossWin)} | ${usd(-m.grossLoss)} | ${usd(-m.grossLoss/m.losingEpisodes)} | ${usd(m.totalPnl)} | ${pc(m.maxDrawdownPct)} |`);}
  for(const view of ['full','pre_hl','hl_recent']){lines.push('',`## Next24h risk — ${view}`,'',
    '| Rise definition | Complete n | Below decision -2% | Below decision -5% | Matched baseline -5% | Peak-to-later-low -5% | Median close | +2% first / -2% first |',
    '|---|---|---|---|---|---|---|---|');
    for(const x of a.summaries.filter((x:R)=>x.view===view&&x.lag===0&&x.h===24))lines.push(`| ${x.family} | ${x.complete} | ${x.drop2}/${x.complete} (${pc(x.drop2Rate)}) | ${x.drop5}/${x.complete} (${pc(x.drop5Rate)}) | ${pc(x.matchedDrop5)} | ${x.pullback5}/${x.complete} (${pc(x.pullback5Rate)}) | ${pc(x.medianClose)} | ${x.upFirst}/${x.downFirst} |`);
  }
  lines.push('','Matched baseline standardizes the ordinary4h reference by the triggered sample\'s month and prior4h ATR/price bucket (<1%,1-2%,>=2%). It is not proof of a causal effect. Broad reference windows overlap heavily; event counts across families cannot be added as independent opportunities. Wilson intervals are retained in CSV and are not corrected for dependence or multiple testing.','',
    '## Timing after the frozen +6%/24h anchor','',
    '| View | Hours after signal | Complete n | Drop2% | Drop5% | Median hours to2%, among hits | Median hours to5%, among hits | Median high | Median close |',
    '|---|---|---|---|---|---|---|---|---|');
  for(const x of a.summaries.filter((x:R)=>['pre_hl','hl_recent'].includes(x.view)&&x.lag===0&&x.family===d.referenceTrigger))lines.push(`| ${x.view} | ${x.h} | ${x.complete} | ${pc(x.drop2Rate)} | ${pc(x.drop5Rate)} | ${num(x.medianHoursTo2)} | ${num(x.medianHoursTo5)} | ${pc(x.medianHigh)} | ${pc(x.medianClose)} |`);
  lines.push('','Conditional time-to-drop excludes non-hits; it is not the time at which all rallies should be paused.','',
    '## Fixed waiting-price diagnostic (+6%/24h anchor)','',
    '| View | Wait | Pairs | Cheaper later | Dearer later | Mean later entry change | Median later entry change | Saw +2% while waiting | Next24h drop5%: immediate / delayed |',
    '|---|---|---|---|---|---|---|---|---|');
  for(const x of a.delays.filter((x:R)=>['pre_hl','hl_recent'].includes(x.view)&&x.lag===0&&x.family===d.referenceTrigger))lines.push(`| ${x.view} | ${x.waitHours}h | ${x.n} | ${x.cheaper} | ${x.dearer} | ${pc(x.meanEntryChange)} | ${pc(x.medianEntryChange)} | ${x.earlyUpside2} | ${pc(x.baseline.drop5Rate)} / ${pc(x.delayed.drop5Rate)} |`);
  lines.push('','These are opening-price observations on identical pairs, not a strategy to buy automatically later. The later risk window starts later; shifting risk out of one window is not eliminating the original loss. All other impulse families and60s sensitivity are in delays.csv.','',
    '## What the signal candles look like (+6%/24h)','',
    '| View | Next24h outcome | n | RSI4h | CRSI4h | ADX4h | Relative volume | Prior ATR% | Upper wick fraction | Distance48h high | Uptrend n |',
    '|---|---|---|---|---|---|---|---|---|---|---|');
  for(const x of a.descriptors.filter((x:R)=>['pre_hl','hl_recent'].includes(x.view)&&x.lag===0&&x.family===d.referenceTrigger))lines.push(`| ${x.view} | ${x.group} | ${x.n} | ${num(x.rsi)} | ${num(x.crsi)} | ${num(x.adx)} | ${num(x.rvol)} | ${pc(x.priorAtrPct)} | ${num(x.upperWick)} | ${pc(x.distance48hPct)} | ${x.uptrend} |`);
  lines.push('','Median differences above are outcome-conditioned descriptions, not trading rules. The prespecified flags below are evaluated against all known anchor events, including rallies that continued.','',
    '| View | Known flag at signal | Selected n | Drop2% | Drop5% | All-known anchor drop5% |', '|---|---|---|---|---|---|');
  for(const x of a.flags.filter((x:R)=>['pre_hl','hl_recent'].includes(x.view)&&x.lag===0&&x.family===d.referenceTrigger))lines.push(`| ${x.view} | ${x.flag} | ${x.complete} | ${pc(x.drop2Rate)} | ${pc(x.drop5Rate)} | ${pc(x.baseline.drop5Rate)} |`);
  lines.push('','## Does later confirmation help?','',
    'First subsequent red4h or first2% closed-bar giveback from a running post-signal high, within12h. Outcomes start AFTER that confirmation; damage before it is not predicted. Baseline uses all anchor episodes observed at the same offsets, weighted by the selected confirmation times.','',
    '| View | Confirmation | Complete n / anchors | Median delay | Already moved from signal | Future24h drop2% / matched baseline | Future24h drop5% / matched baseline |',
    '|---|---|---|---|---|---|---|');
  for(const x of a.confirmations.filter((x:R)=>['pre_hl','hl_recent'].includes(x.view)&&x.lag===0))lines.push(`| ${x.view} | ${x.kind} | ${x.complete}/${x.anchors} | ${num(x.medianDelay)}h | ${pc(x.medianAlreadyMoved)} | ${pc(x.drop2Rate)} / ${pc(x.matchedDrop2)} | ${pc(x.drop5Rate)} / ${pc(x.matchedDrop5)} |`);
  lines.push('','## Existing ladder opportunities intersected by an anchor cooldown','',
    'Counts below intersect the unchanged path; they are not a modified replay. A losing episode touched by a cooldown is not necessarily prevented, and a winning episode can contain several touched adds. No whole-episode loss is counted as savings. Cooldown intervals with no existing approved add may already be covered by other gates or simply lack an opportunity.','',
    '| Window | Wait | Signals | Existing opens | First rungs | Depth8+ adds | Winning / losing / unfinished episodes touched | Intervals with no add |',
    '|---|---|---|---|---|---|---|---|');
  for(const x of intersections.filter(x=>x.family===d.referenceTrigger&&x.tp==='resting_touch'))lines.push(`| ${x.window} | ${x.waitHours}h | ${x.signals} | ${x.adds} | ${x.firstRungs} | ${x.deepAdds} | ${x.winsTouched}/${x.lossesTouched}/${x.unfinishedTouched} | ${x.emptyIntervals} |`);
  lines.push('','## Consistency screen and limits','',
    'Descriptive screen: n>=20 and severe-drop rate above the month/ATR-matched reference in both pre-HL/recent views, at both0/60s publication assumptions. No claim of statistical significance; conditions were inspected on already-used history. No profit screen can pass without new portfolio economics.');
  for(const x of screen)lines.push('',`- ${x.family}: ${x.descriptiveConsistency?'consistent positive risk enrichment':'not consistent / insufficient sample'}. ${x.failures.join('; ')}`);
  lines.push('','Full per-month counts, risk rates and reference rates for every family: monthly.csv. Largest pullbacks and continued rallies: charts.html plus event-catalogue.csv. Charts are selected using future outcomes solely for illustration.','',
    'An exact optimal cooldown is not established. Association alone cannot show that cooldowns improve an inventory-dependent ladder: stops may remove recoveries, signal arrivals may occur after exposure is already built, and trade paths change after the first block. Nothing here licenses an immediate short or blanket flatten.','',
    '## Verification and artifacts','',
    `${v.contexts} point-in-time contexts, ${v.signals} trigger records, ${v.outcomeChecks} independent horizon labels, ${v.minuteChecks.toLocaleString()} brute-force minute checks, ${v.confirmations} confirmation records and ${v.summaryChecks} summaries verified. Four archived Agg10 ledger totals re-audited without changing their execution paths.`,
    `Immutable job: backtests/research-workflow/${key}. Derived tables, chart book and event catalogue: ${dest}.`,
    'Run: node -r ts-node/register scripts/rally-pullback-tests.ts; scripts/rally-pullback-study.ts plan/run KEY; scripts/rally-pullback-verify.ts KEY; scripts/rally-pullback-report.ts KEY. Completed jobs are immutable. Source-prefix, crossing/spacing, same-minute ambiguity, censoring and confirmation-clock fixtures pass.',
    'No live config, state, strategy code, canonical engine, raw dataset, PM2, exchange, commit or deployment changes. No new trading definitions; this is a foundation for deciding whether a separate frozen cooldown replay is warranted.');
  const markdown=lines.join('\n')+'\n';atomicJson(path.join(dest,'receipt.json'),{key,sourceSha256:sha(fs.readFileSync(__filename)),reportSha256:sha(markdown),chartSha256:sha(html),newTradingDefinitions:0});
  return {markdown,dest,screen};
}
if(require.main===module)report(process.argv[2]).then(r=>process.stdout.write('*** Begin Patch\n*** Add File: research/codex-astra-rally-pullback-atlas-findings-2026-09-15.md\n'+r.markdown.trimEnd().split('\n').map(x=>'+'+x).join('\n')+'\n*** End Patch\n')).catch(e=>{console.error(e);process.exitCode=1;});
