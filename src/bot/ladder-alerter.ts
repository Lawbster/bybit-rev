// ladder-alerter.ts
// Discord webhook alerter for sui-ladder bots (HYPE/SUI/FART variants).
// Edge-triggered: each "approach" condition fires once per ladder lifecycle.
// Lifecycle events (rung add, close) fire every time.

import https from "https";

interface AlertField { name: string; value: string; inline?: boolean }

const COLOR_INFO = 0x5865F2;  // blurple
const COLOR_GOOD = 0x57F287;  // green
const COLOR_WARN = 0xFEE75C;  // yellow
const COLOR_BAD  = 0xED4245;  // red

export class LadderAlerter {
  private webhookUrl: string;
  private symbolLabel: string;

  // Edge state (resets when ladder closes)
  private firedTriggerApproach = false;
  private firedNextRungApproach = new Set<number>(); // by rung index about-to-add
  private firedSlApproach = false;
  private firedKillApproach = false;
  private firedFundingApproach = false;
  private lastPreKillFireTs = 0;  // pre-kill warnings re-fire every 4h
  // Cooldowns for repeating-trigger approach
  private lastTriggerApproachTs = 0;

  constructor(symbol: string) {
    this.symbolLabel = symbol;
    this.webhookUrl = process.env[`DISCORD_WEBHOOK_${symbol}`] ?? "";
  }

  get enabled(): boolean { return this.webhookUrl.length > 0 }

  /** Reset edge state — call after a ladder close */
  resetEdges() {
    this.firedTriggerApproach = false;
    this.firedNextRungApproach.clear();
    this.firedSlApproach = false;
    this.firedKillApproach = false;
    this.firedFundingApproach = false;
    this.lastPreKillFireTs = 0;
  }

  /** Pre-kill warning — score>=4.5 caught 8/8 historical kills with 8.2% control fire rate.
   *  Re-fires every 4h while elevated. Warning-only — no position action. */
  async notifyPreKillWarning(score: number, reasons: string[], ladderPnlPct: number, depth: number) {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastPreKillFireTs < 4 * 3600 * 1000) return;
    this.lastPreKillFireTs = now;
    await this.send(
      `${this.symbolLabel}: ⚠️ pre-kill score elevated`,
      `Score ${score.toFixed(1)} (warn at >=4.5). Historical kill recall 8/8 at this level.`,
      COLOR_WARN,
      [
        { name: "Score",    value: `${score.toFixed(1)}/8`, inline: true },
        { name: "Depth",    value: `${depth}`,              inline: true },
        { name: "Ladder PnL", value: `${ladderPnlPct.toFixed(2)}%`, inline: true },
        { name: "Reasons",  value: reasons.join(" • ") || "(none captured)" },
      ],
    );
  }

  /** Approach to entry trigger (flat state). Re-fireable every 4h. */
  async checkTriggerApproach(price: number, ema: number, triggerPct: number) {
    if (!this.enabled) return;
    // distance below EMA where trigger fires (negative)
    const triggerLine = ema * (1 - triggerPct / 100);
    const distToTriggerPct = ((price - triggerLine) / triggerLine) * 100;
    // Within 1% above the trigger line means we're "close"
    if (distToTriggerPct >= 0 && distToTriggerPct <= 1.0) {
      const now = Date.now();
      if (now - this.lastTriggerApproachTs < 4 * 3600 * 1000) return;
      this.lastTriggerApproachTs = now;
      await this.send(
        `${this.symbolLabel}: entry trigger close`,
        `Price within ${distToTriggerPct.toFixed(2)}% of EMA-dip trigger`,
        COLOR_INFO,
        [
          { name: "Price",       value: `$${price.toFixed(4)}`, inline: true },
          { name: "EMA",         value: `$${ema.toFixed(4)}`,    inline: true },
          { name: "Trigger line",value: `$${triggerLine.toFixed(4)}`, inline: true },
        ],
      );
    }
  }

  /** Rung opened — confirmation */
  async notifyRungOpened(rungIdx: number, maxRungs: number, fillPrice: number, avgEntry: number, totalNotional: number) {
    if (!this.enabled) return;
    await this.send(
      `${this.symbolLabel}: rung ${rungIdx + 1}/${maxRungs} opened`,
      rungIdx === 0 ? "Ladder started." : "Scaled in deeper.",
      rungIdx === 0 ? COLOR_INFO : COLOR_WARN,
      [
        { name: "Fill",     value: `$${fillPrice.toFixed(4)}`, inline: true },
        { name: "Avg",      value: `$${avgEntry.toFixed(4)}`,  inline: true },
        { name: "Notional", value: `$${totalNotional.toFixed(0)}`, inline: true },
      ],
    );
  }

  /** Approach to next rung add. Edge-triggered per rung index. */
  async checkNextRungApproach(price: number, lastRungPrice: number, rungSpacingPct: number, currentRungs: number, maxRungs: number) {
    if (!this.enabled || currentRungs >= maxRungs) return;
    const dropFromLast = ((price - lastRungPrice) / lastRungPrice) * 100;
    // Trigger fires at -rungSpacingPct (e.g. -5%). Warn within 1% of that.
    if (dropFromLast <= -(rungSpacingPct - 1) && dropFromLast > -rungSpacingPct) {
      if (this.firedNextRungApproach.has(currentRungs)) return;
      this.firedNextRungApproach.add(currentRungs);
      const nextRungPrice = lastRungPrice * (1 - rungSpacingPct / 100);
      await this.send(
        `${this.symbolLabel}: next rung close`,
        `Price ${dropFromLast.toFixed(2)}% from last rung — next add at -${rungSpacingPct}%`,
        COLOR_WARN,
        [
          { name: "Price",     value: `$${price.toFixed(4)}`, inline: true },
          { name: "Last rung", value: `$${lastRungPrice.toFixed(4)}`, inline: true },
          { name: "Next rung", value: `$${nextRungPrice.toFixed(4)}`, inline: true },
          { name: "Rungs",     value: `${currentRungs}/${maxRungs}`, inline: true },
        ],
      );
    }
  }

  /** Approach to SL. Fires once per ladder. */
  async checkSlApproach(price: number, slPrice: number, avgEntry: number, currentRungs: number) {
    if (!this.enabled || this.firedSlApproach) return;
    const distToSlPct = ((price - slPrice) / slPrice) * 100;
    // Within 3% above SL = danger zone
    if (distToSlPct >= 0 && distToSlPct <= 3.0) {
      this.firedSlApproach = true;
      const unrealPct = ((price - avgEntry) / avgEntry) * 100;
      await this.send(
        `${this.symbolLabel}: ⚠️ SL approaching`,
        `Price within ${distToSlPct.toFixed(2)}% of stop-loss`,
        COLOR_BAD,
        [
          { name: "Price",     value: `$${price.toFixed(4)}`, inline: true },
          { name: "SL",        value: `$${slPrice.toFixed(4)}`, inline: true },
          { name: "Avg entry", value: `$${avgEntry.toFixed(4)}`, inline: true },
          { name: "PnL",       value: `${unrealPct.toFixed(2)}%`, inline: true },
          { name: "Rungs",     value: `${currentRungs}`, inline: true },
        ],
      );
    }
  }

  /**
   * HYPE-style: emergency kill approach. Within 1% of avgEntry × (1 + killPct/100).
   * killPct is the negative threshold (e.g. -10).
   */
  async checkKillApproach(price: number, avgEntry: number, killPct: number, currentRungs: number) {
    if (!this.enabled || this.firedKillApproach) return;
    const killPrice = avgEntry * (1 + killPct / 100);
    const distPct = ((price - killPrice) / killPrice) * 100;
    if (distPct >= 0 && distPct <= 1.0) {
      this.firedKillApproach = true;
      const unrealPct = ((price - avgEntry) / avgEntry) * 100;
      await this.send(
        `${this.symbolLabel}: 🔥 EMERGENCY KILL approaching`,
        `Price within ${distPct.toFixed(2)}% of emergency-kill price`,
        COLOR_BAD,
        [
          { name: "Price",     value: `$${price.toFixed(4)}`, inline: true },
          { name: "Kill",      value: `$${killPrice.toFixed(4)}`, inline: true },
          { name: "Avg entry", value: `$${avgEntry.toFixed(4)}`, inline: true },
          { name: "PnL",       value: `${unrealPct.toFixed(2)}%`, inline: true },
          { name: "Rungs",     value: `${currentRungs}`, inline: true },
        ],
      );
    }
  }

  /**
   * HYPE-style: funding-spike guard approach. Fires once when ladder is at
   * minRungs depth AND funding has climbed to >= 80% of the close-out threshold.
   */
  async checkFundingApproach(currentRungs: number, minRungs: number, fundingRate: number, threshold: number) {
    if (!this.enabled || this.firedFundingApproach) return;
    if (currentRungs < minRungs) return;
    if (fundingRate < threshold * 0.8) return;
    this.firedFundingApproach = true;
    await this.send(
      `${this.symbolLabel}: ⚠️ funding spike approaching`,
      `Deep ladder + funding climbing — close-out guard fires at ${(threshold * 100).toFixed(4)}%`,
      COLOR_WARN,
      [
        { name: "Rungs",     value: `${currentRungs}/${minRungs}+`, inline: true },
        { name: "Funding",   value: `${(fundingRate * 100).toFixed(4)}%`, inline: true },
        { name: "Threshold", value: `${(threshold * 100).toFixed(4)}%`, inline: true },
      ],
    );
  }

  /** Ladder closed — confirmation. Resets edge state. */
  async notifyClosed(reason: string, rungs: number, avgEntry: number, exitPrice: number, pnlUsd: number, holdHours: number) {
    if (!this.enabled) { this.resetEdges(); return; }
    const win = pnlUsd >= 0;
    const pnlPct = ((exitPrice - avgEntry) / avgEntry) * 100;
    await this.send(
      `${this.symbolLabel}: closed ${win ? "✅" : "❌"} ${reason}`,
      `${rungs} rungs closed`,
      win ? COLOR_GOOD : COLOR_BAD,
      [
        { name: "Avg entry", value: `$${avgEntry.toFixed(4)}`,  inline: true },
        { name: "Exit",      value: `$${exitPrice.toFixed(4)}`, inline: true },
        { name: "Move",      value: `${pnlPct.toFixed(2)}%`,    inline: true },
        { name: "PnL",       value: `$${pnlUsd.toFixed(2)}`,    inline: true },
        { name: "Hold",      value: `${holdHours.toFixed(1)}h`, inline: true },
      ],
    );
    this.resetEdges();
  }

  private async send(title: string, description: string, color: number, fields: AlertField[]) {
    const body = JSON.stringify({
      embeds: [{
        title,
        description,
        color,
        fields,
        footer: { text: `${this.symbolLabel} • ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC` },
      }],
    });

    try {
      const url = new URL(this.webhookUrl);
      await new Promise<void>((resolve, reject) => {
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        }, res => {
          res.resume();
          if (res.statusCode && res.statusCode >= 400) reject(new Error(`Discord HTTP ${res.statusCode}`));
          else resolve();
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    } catch (err) {
      // Swallow — Discord failures shouldn't crash the bot
      console.error(`[alerter] ${this.symbolLabel} send failed:`, (err as Error).message);
    }
  }
}
