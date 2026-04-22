// discord-commander.ts — Discord bot command listener
//
// Polls a Discord channel for override commands and writes override.json.
// The main bot reads override.json each tick and applies it one-shot.
//
// Commands:
//   -override HYPE 15      → raise maxPositions to 15 for current ladder, resets after TP
//   -override HYPE reset   → immediately reset override
//   -regime-arm <bot>      → clear regime-breaker flat state (manual re-arm)
//   -closeladder           → market-close entire ladder + hedge, then pause bot
//   -pause                 → pause bot (no new adds, existing positions stay open)
//   -resume                → resume bot from pause
//   -status                → print current bot state to Discord
//
// Usage: npx ts-node src/discord-commander.ts
// ─────────────────────────────────────────────

import https from "https";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN ?? "";
const COMMAND_CH_ID  = process.env.DISCORD_COMMAND_CHANNEL_ID ?? "";
const OVERRIDE_FILE  = path.resolve(process.cwd(), "override.json");
const POLL_MS        = 3000; // check for new messages every 3s

// ── Bot registry — maps short name → signal prefix + state file ──
interface BotEntry {
  prefix: string;      // signal file prefix (e.g. "bot" → bot-pause, bot-flatten)
  stateFile: string;   // state JSON file
  label: string;       // display name
  isHypeLadder?: boolean; // main HYPE bot uses different state format
}

const BOT_REGISTRY: Record<string, BotEntry> = {
  hype: { prefix: "bot", stateFile: "bot-state.json", label: "HYPE Ladder", isHypeLadder: true },
  sui:  { prefix: "sui", stateFile: "sui-ladder-state.json", label: "SUI Ladder" },
  fart: { prefix: "fart", stateFile: "fart-ladder-state.json", label: "FART Ladder" },
};

if (!BOT_TOKEN || !COMMAND_CH_ID) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_COMMAND_CHANNEL_ID in .env");
  process.exit(1);
}

// ── Discord REST helpers ──────────────────────────────────────────
function discordRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "discord.com",
      path: `/api/v10${path}`,
      method,
      headers: {
        "Authorization": `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sendMessage(channelId: string, content: string) {
  await discordRequest("POST", `/channels/${channelId}/messages`, { content });
}

async function getMessages(channelId: string, after?: string): Promise<any[]> {
  const query = after ? `?after=${after}&limit=10` : `?limit=5`;
  const res = await discordRequest("GET", `/channels/${channelId}/messages${query}`);
  return Array.isArray(res) ? res : [];
}

// ── Override file ─────────────────────────────────────────────────
interface Override {
  symbol: string;
  maxPositions: number;
  oneShot: boolean;      // reset after next TP
  setAt: string;
  setBy: string;
}

function writeOverride(o: Override) {
  fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(o, null, 2));
}

function clearOverride() {
  if (fs.existsSync(OVERRIDE_FILE)) fs.unlinkSync(OVERRIDE_FILE);
}

function readOverride(): Override | null {
  if (!fs.existsSync(OVERRIDE_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(OVERRIDE_FILE, "utf-8")); }
  catch { return null; }
}

// ── Command parser ────────────────────────────────────────────────
const SYMBOL_MAP: Record<string, string> = {
  hype:  "HYPEUSDT",
  river: "RIVERUSDT",
  siren: "SIRENUSDT",
  vvv:   "VVVUSDT",
  tao:   "TAOUSDT",
  stg:   "STGUSDT",
  bluai: "BLUAIUSDT",
  dusk:  "DUSKUSDT",
};

// Helper: resolve bot entry from a short name, with fallback for legacy commands
function resolveBot(name?: string): BotEntry | null {
  if (!name) return null;
  return BOT_REGISTRY[name.toLowerCase()] ?? null;
}

function signalPath(prefix: string, signal: string): string {
  return path.resolve(process.cwd(), `${prefix}-${signal}`);
}

function statePath(stateFile: string): string {
  return path.resolve(process.cwd(), stateFile);
}

async function handleCommand(msg: { content: string; author: { username: string }; id: string }) {
  const text = msg.content.trim().toLowerCase();
  const author = msg.author.username;

  // -override HYPE 15
  const overrideMatch = text.match(/^-override\s+(\w+)\s+(\d+|reset)$/);
  if (overrideMatch) {
    const symKey = overrideMatch[1].toLowerCase();
    const val    = overrideMatch[2];
    const symbol = SYMBOL_MAP[symKey];

    if (!symbol) {
      await sendMessage(COMMAND_CH_ID, `Unknown symbol \`${symKey}\`. Known: ${Object.keys(SYMBOL_MAP).join(", ")}`);
      return;
    }

    if (val === "reset") {
      clearOverride();
      await sendMessage(COMMAND_CH_ID, `Override cleared for \`${symbol}\`. maxPositions back to config default.`);
      return;
    }

    const maxPos = parseInt(val);
    if (maxPos < 1 || maxPos > 25) {
      await sendMessage(COMMAND_CH_ID, `maxPositions must be between 1 and 25.`);
      return;
    }

    const override: Override = {
      symbol,
      maxPositions: maxPos,
      oneShot: true,
      setAt: new Date().toISOString(),
      setBy: author,
    };
    writeOverride(override);
    await sendMessage(COMMAND_CH_ID, [
      `Override set by ${author}`,
      `Symbol: \`${symbol}\``,
      `maxPositions: \`${maxPos}\``,
      `Mode: one-shot (resets automatically after next TP)`,
      `Send \`-override ${symKey} reset\` to cancel early.`,
    ].join("\n"));
    return;
  }

  // -close <bot>  — market-close all positions, then pause
  const closeMatch = text.match(/^-close\s+(\w+)$/);
  // Also support legacy -closeladder (HYPE) and -sui-closeladder / -sui-flatten
  const isLegacyClose = text === "-closeladder";
  const isLegacySuiClose = text === "-sui-closeladder" || text === "-sui-flatten";

  if (closeMatch || isLegacyClose || isLegacySuiClose) {
    const botName = isLegacyClose ? "hype" : isLegacySuiClose ? "sui" : closeMatch![1];
    const bot = resolveBot(botName);
    if (!bot) {
      await sendMessage(COMMAND_CH_ID, `Unknown bot \`${botName}\`. Known: ${Object.keys(BOT_REGISTRY).join(", ")}`);
      return;
    }
    fs.writeFileSync(signalPath(bot.prefix, "flatten"), `close by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, [
      `**${bot.label} Close** triggered by ${author}`,
      `Bot will market-close all positions on next tick, then pause.`,
      `Send \`-resume ${botName}\` to restart.`,
    ].join("\n"));
    return;
  }

  // -pause <bot>
  const pauseMatch = text.match(/^-pause\s+(\w+)$/);
  const isLegacyPause = text === "-pause";
  const isLegacySuiPause = text === "-sui-pause";

  if (pauseMatch || isLegacyPause || isLegacySuiPause) {
    const botName = isLegacyPause ? "hype" : isLegacySuiPause ? "sui" : pauseMatch![1];
    const bot = resolveBot(botName);
    if (!bot) {
      await sendMessage(COMMAND_CH_ID, `Unknown bot \`${botName}\`. Known: ${Object.keys(BOT_REGISTRY).join(", ")}`);
      return;
    }
    const pauseFile = signalPath(bot.prefix, "pause");
    if (!fs.existsSync(pauseFile)) {
      fs.writeFileSync(pauseFile, `paused by ${author} at ${new Date().toISOString()}\n`);
    }
    await sendMessage(COMMAND_CH_ID, [
      `**${bot.label} Paused** by ${author}`,
      `No new adds. Open positions stay and will TP/exit normally.`,
      `Send \`-resume ${botName}\` to unpause.`,
    ].join("\n"));
    return;
  }

  // -regime-arm <bot>  — manually clear regime-breaker flat state
  const regimeMatch = text.match(/^-regime-arm\s+(\w+)$/);
  if (regimeMatch) {
    const botName = regimeMatch[1];
    const bot = resolveBot(botName);
    if (!bot) {
      await sendMessage(COMMAND_CH_ID, `Unknown bot \`${botName}\`. Known: ${Object.keys(BOT_REGISTRY).join(", ")}`);
      return;
    }
    fs.writeFileSync(signalPath(bot.prefix, "regime-arm"), `armed by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, [
      `**${bot.label} Regime Re-armed** by ${author}`,
      `Regime breaker flat state cleared on next tick. Existing red days will not be re-walked.`,
      `Breaker will re-trigger only if a new N-red streak forms from now.`,
    ].join("\n"));
    return;
  }

  // -resume <bot>
  const resumeMatch = text.match(/^-resume\s+(\w+)$/);
  const isLegacyResume = text === "-resume";
  const isLegacySuiResume = text === "-sui-resume";

  if (resumeMatch || isLegacyResume || isLegacySuiResume) {
    const botName = isLegacyResume ? "hype" : isLegacySuiResume ? "sui" : resumeMatch![1];
    const bot = resolveBot(botName);
    if (!bot) {
      await sendMessage(COMMAND_CH_ID, `Unknown bot \`${botName}\`. Known: ${Object.keys(BOT_REGISTRY).join(", ")}`);
      return;
    }
    fs.writeFileSync(signalPath(bot.prefix, "resume"), `resumed by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, `**${bot.label} Resumed** by ${author} — trading active.`);
    return;
  }

  // -status [bot]  — show one bot or all
  const statusMatch = text.match(/^-status\s+(\w+)$/);
  const isLegacyStatus = text === "-status";
  const isLegacySuiStatus = text === "-sui-status";

  if (statusMatch || isLegacyStatus || isLegacySuiStatus) {
    const botName = isLegacyStatus ? null : isLegacySuiStatus ? "sui" : statusMatch![1];
    const botsToShow = botName ? [{ name: botName, ...BOT_REGISTRY[botName] }] : Object.entries(BOT_REGISTRY).map(([name, b]) => ({ name, ...b }));

    if (botName && !BOT_REGISTRY[botName]) {
      await sendMessage(COMMAND_CH_ID, `Unknown bot \`${botName}\`. Known: ${Object.keys(BOT_REGISTRY).join(", ")}`);
      return;
    }

    let reply = `**Bot Status** — ${new Date().toISOString().replace("T"," ").slice(0,19)} UTC\n`;

    for (const bot of botsToShow) {
      const sf = statePath(bot.stateFile);
      reply += `\n**${bot.label}**\n`;

      if (fs.existsSync(sf)) {
        try {
          const st = JSON.parse(fs.readFileSync(sf, "utf-8"));

          if (bot.isHypeLadder) {
            // HYPE bot state format
            const positions = st.positions ?? [];
            const posCount = positions.length;
            if (posCount > 0) {
              const totalQty = positions.reduce((s: number, p: any) => s + p.qty, 0);
              const avgEntry = positions.reduce((s: number, p: any) => s + p.entryPrice * p.qty, 0) / totalQty;
              const totalNotional = positions.reduce((s: number, p: any) => s + p.notional, 0);
              reply += `Rungs: ${posCount} | avg $${avgEntry.toFixed(4)} | notional $${totalNotional.toFixed(0)}\n`;
            } else {
              reply += `FLAT\n`;
            }
            reply += `Batch closes: ${st.totalBatchCloses ?? 0} | Realized: $${(st.realizedPnl ?? 0).toFixed(2)}\n`;
          } else {
            // sui-ladder state format
            const rungs = st.rungs ?? [];
            if (rungs.length > 0) {
              const holdH = ((Date.now() - st.openedAt) / 3600000).toFixed(1);
              reply += `Rungs: ${rungs.length} | avg $${st.avgEntry?.toFixed(4) ?? "?"} | notional $${st.totalNotional?.toFixed(0) ?? "?"} | ${holdH}h\n`;
            } else {
              const coolRemain = st.lastCloseTime > 0
                ? Math.max(0, (st.cooldownHours || 12) - (Date.now() - st.lastCloseTime) / 3600000).toFixed(1)
                : "0";
              reply += `FLAT | cooldown ${coolRemain}h remaining\n`;
            }
            reply += `Trades: ${st.tradeCount ?? 0} | Realized: $${(st.realizedPnl ?? 0).toFixed(2)}\n`;
          }
        } catch {
          reply += `State file unreadable.\n`;
        }
      } else {
        reply += `No state file — bot may not have started yet.\n`;
      }

      if (fs.existsSync(signalPath(bot.prefix, "pause"))) {
        reply += `PAUSED — send \`-resume ${bot.name}\` to unpause\n`;
      }
    }

    const override = readOverride();
    if (override) {
      reply += `\nOverride active: \`${override.symbol}\` maxPositions=${override.maxPositions} (set by ${override.setBy} at ${override.setAt.slice(0,16)})`;
    }

    await sendMessage(COMMAND_CH_ID, reply);
    return;
  }

  // -help
  if (text === "-help") {
    const botNames = Object.keys(BOT_REGISTRY).join(", ");
    await sendMessage(COMMAND_CH_ID, [
      "**RiverBot Commander — Commands**",
      "```",
      "-close <bot>          Market-close all positions, then pause",
      "-pause <bot>          Pause bot (no new adds)",
      "-resume <bot>         Resume bot from pause",
      "-status [bot]         Show bot state (omit bot for all)",
      "-override <sym> <n>   Raise maxPositions (one-shot, resets after TP)",
      "-override <sym> reset Cancel active override",
      "-regime-arm <bot>     Clear regime-breaker flat state (force re-arm)",
      "-help                 This message",
      "```",
      `Bots: ${botNames}`,
      `Override symbols: ${Object.keys(SYMBOL_MAP).join(", ")}`,
    ].join("\n"));
  }
}

// ── Main poll loop ────────────────────────────────────────────────
async function main() {
  console.log(`discord-commander starting — channel=${COMMAND_CH_ID} poll=${POLL_MS}ms`);

  // Get current latest message ID to avoid replaying old commands
  const initial = await getMessages(COMMAND_CH_ID);
  let lastId = initial.length > 0 ? initial[0].id : "0";
  console.log(`Starting from message ID ${lastId}`);

  await sendMessage(COMMAND_CH_ID, "🤖 **RiverBot Commander online.** Type `-help` for commands.");

  setInterval(async () => {
    try {
      const msgs = await getMessages(COMMAND_CH_ID, lastId);
      // Discord returns newest first, process oldest first
      const ordered = msgs.reverse().filter(m => !m.author?.bot);
      for (const msg of ordered) {
        lastId = msg.id;
        if (msg.content?.startsWith("-")) {
          console.log(`[${new Date().toISOString().slice(0,19)}] Command from ${msg.author.username}: ${msg.content}`);
          await handleCommand(msg);
        }
      }
    } catch (e: any) {
      console.error("poll error:", e.message);
    }
  }, POLL_MS);
}

main().catch(e => { console.error(e); process.exit(1); });
