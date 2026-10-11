/** Cached policy work, for the isolated feed worker (never the mutation guard).
 * Indicators recompute only after their closed source bucket advances. Structural
 * detectors are reused unchanged at most once per hourly entry window/generation.
 */
import { PortfolioCandleFeed } from './candle-feed';
import { MINUTE as M, epoch } from './contract';
import { TimedIndicatorMap, TIMED_RULES, type TimedSource } from './timed-indicator-signals';
import { MacdSignalMap } from './macd-signals';
import { StructuralSignalMap, type StructuralDecision, type StructuralSource } from './structural-signals';
import { dueEntrySources, readEntryPoll, type SourcePolicies } from './lifecycle';

export class PortfolioSourceCache {
  private readonly timed = new Map<TimedSource, { generation: number; map: TimedIndicatorMap }>();
  private macd: { generation: number; map: MacdSignalMap } | null = null;
  private structural: { key: string; results: Partial<Record<StructuralSource, StructuralDecision>> } | null = null;
  private main: { end: number; value: ReturnType<PortfolioCandleFeed['mainContext']> } | null = null;
  readonly builds = { L2: 0, R5: 0, CRSI: 0, R3: 0, structural: 0 };
  constructor(readonly feed: PortfolioCandleFeed) {}
  read(now: number) {
    epoch(now); const windowAt = Math.floor(now / M) * M;
    const policies: SourcePolicies = { timed: {} };
    let error: string | null = this.feed.error;
    const boot = this.feed.bootstrapAt;
    if (boot !== null && windowAt >= boot && now >= this.feed.lastObservedAt && !error) {
      try {
        const due = dueEntrySources(now);
        for (const source of ['L2', 'R5', 'CRSI'] as const) if (due.includes(source)) {
          const generation = this.feed.generation(TIMED_RULES[source].timeframe);
          let saved = this.timed.get(source);
          if (!saved || saved.generation !== generation) {
            saved = { generation, map: new TimedIndicatorMap(source, this.feed.series(TIMED_RULES[source].timeframe)) };
            this.timed.set(source, saved); this.builds[source]++;
          }
          policies.timed![source] = saved.map;
        }
        // Exit publications must refresh even when there is no new entry window.
        const generation = this.feed.generation(240 * M);
        if (!this.macd || this.macd.generation !== generation) {
          this.macd = { generation, map: new MacdSignalMap(this.feed.series(240 * M)) }; this.builds.R3++;
        }
        policies.macd = this.macd.map;
        const structuralDue = due.filter((s): s is StructuralSource => s === 'SF08' || s === 'PA07');
        if (structuralDue.length) {
          const key = windowAt + ':' + this.feed.generation(60 * M);
          if (this.structural?.key !== key) {
            const map = new StructuralSignalMap(this.feed.structuralMinutes(), now);
            this.structural = { key, results: Object.fromEntries(structuralDue.map(s => [s, map.decision(s, now)])) };
            this.builds.structural++;
          }
          policies.structural = { decision: source => this.structural!.results[source] ?? { status: 'inputs_unavailable' } };
        }
      } catch (e) { error = e instanceof Error ? e.message : String(e); }
    }
    const poll = readEntryPoll(now, error ? {} : policies);
    for (const p of poll.sources) if (p.signal) p.signal = { ...p.signal, knownAt: Math.max(p.signal.knownAt, boot!) };
    // Bootstrap bars are warmup, not a claim they were received live in the past.
    const exits = !this.feed.error && boot !== null ? (this.macd?.map.rows ?? [])
      .filter(p => p.sourceEnd >= now - 26 * 60 * M && p.exit)
      .map(p => ({ ...p, knownAt: Math.max(p.knownAt, boot) })) : [];
    if (!this.main || this.main.end !== this.feed.nextTs || !this.main.value)
      this.main = { end: this.feed.nextTs, value: this.feed.mainContext(now) };
    return { at: now, mainContext: this.main.value, health: { ...this.feed.health(now), policyError: error, builds: { ...this.builds } }, poll,
      price: this.feed.decisionPrice(now), macdExits: exits };
  }
}
