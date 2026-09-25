import fs from "fs";
import path from "path";
import type { Candle } from "../fetch-candles";
import type { BotState } from "./state";
import { AGGRESSIVE10_ID } from "./aggressive10-policy";
import { isPostFlattenReason, validateForcedCloseObservationIntent } from "./forced-close-observation";

const MINUTE = 60_000, HOUR = 60 * MINUTE;
interface Wait {
  id: string; at: number; price: number; notionals: number[]; lastDecisionAt: number;
}
interface Row { id: string; type: string; observedAt: number; [key: string]: unknown }
interface Disk { version: 1; symbol: string; startedAt: number; seen: string[]; waits: Wait[]; outbox: Row[] }

/** Same sfp20@60 geometry as PF60: preceding 20 CLOSED hours, strict sweep and reclaim. */
export function postFlattenSfpSignal(minutes: readonly Candle[], decisionAt: number): { signal: boolean; referenceLow: number | null } {
  if (decisionAt % HOUR !== 0) return { signal: false, referenceLow: null };
  const start = decisionAt - 21 * HOUR;
  const rows = minutes.filter(c => c.timestamp >= start && c.timestamp < decisionAt);
  if (rows.length !== 1260 || rows.some((c, i) => c.timestamp !== start + i * MINUTE
    || ![c.open, c.high, c.low, c.close].every(n => Number.isFinite(n) && n > 0)
    || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close))) {
    throw new Error("post-flatten SFP requires 21 continuous completed hours");
  }
  const referenceLow = Math.min(...rows.slice(0, 1200).map(c => c.low));
  return { signal: Math.min(...rows.slice(1200).map(c => c.low)) < referenceLow
    && rows[1259].close > referenceLow, referenceLow };
}

/** No executor, credentials, state mutator, entry veto or order capability. */
export class PostFlattenSfpShadow {
  private disk!: Disk;
  private lastError: string | null = null;
  private lastProcessedAt: number | null = null;
  private disabledByCorruption = false;
  private missingContextSince: number | null = null;
  constructor(private readonly file: string, private readonly journalDir: string, private readonly symbol: string, now: number) {
    try {
      if (fs.existsSync(file)) {
        const d = JSON.parse(fs.readFileSync(file, "utf8")) as Disk;
        if (d.version !== 1 || d.symbol !== symbol || !Number.isFinite(d.startedAt) || !Array.isArray(d.seen) || !Array.isArray(d.waits) || !Array.isArray(d.outbox)
          || d.waits.some(w => !w.id || !(w.price > 0) || !Number.isSafeInteger(w.at) || !Number.isSafeInteger(w.lastDecisionAt)
            || !Array.isArray(w.notionals) || !w.notionals.length || w.notionals.some(n => !Number.isFinite(n) || n <= 0))) throw new Error("invalid observer state");
        this.disk = d;
      } else { this.disk = { version: 1, symbol, startedAt: now, seen: [], waits: [], outbox: [] }; this.save(); }
    } catch (e) { this.disabledByCorruption = true; this.lastError = String(e); }
  }
  health() { return { enabled: true, status: this.lastError ? "degraded" : "healthy", lastError: this.lastError,
    lastProcessedAt: this.lastProcessedAt, waiting: this.disk?.waits.length ?? 0 }; }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.disk)); fs.renameSync(this.file + ".tmp", this.file);
  }
  private emit(type: string, id: string, now: number, fields: Record<string, unknown>) {
    this.disk.outbox.push({ id, type, observedAt: now, ...fields });
  }
  private flush() {
    if (!this.disk.outbox.length) return;
    this.save(); // durable outbox before append; readers dedup stable ids after crash/retry
    fs.mkdirSync(this.journalDir, { recursive: true });
    for (const row of this.disk.outbox) fs.appendFileSync(path.join(this.journalDir,
      `${this.symbol}_post_flatten_sfp_${new Date(row.observedAt).toISOString().slice(0, 10)}.jsonl`), JSON.stringify(row) + "\n");
    this.disk.outbox = []; this.save();
  }
  tick(state: Pick<BotState, "completedLongTransactions" | "completedMakerTpOrders" | "positions">,
    minutes: readonly Candle[], now: number): void {
    if (this.disabledByCorruption) return;
    try {
      this.flush();
      let changed = false;
      const receipts = [
        ...state.completedLongTransactions.filter(r => r.kind === "full_close").map(r => ({ ...r, requestedReason: r.reason ?? "" })),
        ...state.completedMakerTpOrders.map(r => ({ ...r, requestedReason: r.closeReason })),
      ].sort((a, b) => a.completedAt - b.completedAt);
      for (const r of receipts) {
        if (r.completedAt < this.disk.startedAt || this.disk.seen.includes(r.orderLinkId)) continue;
        this.disk.seen.push(r.orderLinkId); changed = true;
        const e = r.observation;
        if (e) validateForcedCloseObservationIntent(e.intent);
        if (!isPostFlattenReason(e?.intent.reason ?? r.requestedReason)) continue;
        // Partial maker prefixes are NOT separate forced exits. The full market receipt carries combined evidence.
        if (e?.cause === "maker_tp" || r.outcome === "partial_committed" || r.outcome === "cancelled_zero_fill") continue;
        let invalid = !e ? "legacy_receipt_missing_evidence" : e.unscorable;
        if (e && (!e.fullFlat || e.cause !== "owned_market" || r.requestedReason !== e.intent.reason)) invalid = "not_owned_forced_flat";
        if (e && (e.intent.symbol !== this.symbol || e.intent.profileId !== AGGRESSIVE10_ID)) invalid = "not_aggressive10_profile";
        if (e && (!Number.isSafeInteger(e.finalExecTime) || e.finalExecTime! < e.intent.requestedAt || e.finalExecTime! > now
          || !(e.exitNotional > 0) || !(e.filledQty > 0) || !r.executionIds.length
          || Math.abs(e.filledQty - e.intent.allocation.preTotalQty) > 1e-8
          || !e.intent.allocation.targets.length || e.intent.allocation.targets.some(p => !(p.preQty > 0) || !(p.preNotional > 0)))) invalid = "incomplete_exact_fill_evidence";
        if (invalid || !e) { this.emit("unscorable_close", r.orderLinkId + ":unscorable", now, { reason: invalid }); continue; }
        const wait: Wait = { id: r.orderLinkId, at: e.finalExecTime!, price: e.exitNotional / e.filledQty,
          notionals: e.intent.allocation.targets.map(p => p.preNotional), lastDecisionAt: Math.floor(e.finalExecTime! / MINUTE) * MINUTE };
        this.disk.waits.push(wait);
        this.emit("armed", wait.id + ":armed", now, { ...wait, actualPositionOpen: state.positions.length > 0 });
      }
      this.disk.seen = this.disk.seen.slice(-512);
      // Context may still be hydrating: do not turn temporary lack of a window into a false verdict.
      const end = Math.floor(now / MINUTE) * MINUTE;
      if (minutes.length) for (const w of [...this.disk.waits]) {
        const byTime = new Map(minutes.map(c => [c.timestamp, c]));
        let terminal = "", at = w.lastDecisionAt;
        for (at += MINUTE; at <= end; at += MINUTE) {
          if (at - w.at > 24 * HOUR) { terminal = "expired"; break; }
          const bar = byTime.get(at - MINUTE);
          if (!bar || !Number.isFinite(bar.close) || bar.close <= 0) { terminal = "unscorable_gap"; break; }
          w.lastDecisionAt = at; changed = true;
          if (bar.close >= w.price * 1.03) { terminal = "abandoned_above_3pct"; break; }
          if (at % HOUR === 0 && bar.close <= w.price) {
            let signal: ReturnType<typeof postFlattenSfpSignal>;
            try { signal = postFlattenSfpSignal(minutes, at); }
            catch { terminal = "unscorable_hour_context"; break; }
            if (signal.signal) {
              terminal = "signal";
              this.emit("signal", w.id + ":signal", now, { forcedCloseId: w.id, decisionAt: at, signalClose: bar.close,
                referenceLow: signal.referenceLow, notionals: w.notionals, totalNotional: w.notionals.reduce((a, b) => a + b, 0),
                delayMs: now - at, timely: now - at <= 30_000, actualPositionOpen: state.positions.length > 0,
                scope: "signal_only_not_portfolio_or_fill", testedGateBypass: true });
              break;
            }
          }
        }
        if (terminal) {
          changed = true; this.disk.waits = this.disk.waits.filter(x => x.id !== w.id);
          if (terminal !== "signal") this.emit(terminal, w.id + ":terminal", now, { forcedCloseId: w.id, decisionAt: at });
        }
      }
      if (changed) this.save();
      if (this.disk.waits.length && !minutes.length) this.missingContextSince ??= now;
      else this.missingContextSince = null;
      this.flush(); this.lastProcessedAt = now;
      this.lastError = this.missingContextSince !== null && now - this.missingContextSince > 180_000
        ? "closed-minute context unavailable for waiting observer" : null;
    } catch (e) { this.lastError = String(e); }
  }
}
