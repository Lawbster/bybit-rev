// discord-commander.ts — Discord bot command listener
//
// Polls a Discord channel for override commands and writes override.json.
// The main bot reads override.json each tick and applies it one-shot.
//
// Commands:
//   -override HYPE 15      → raise maxPositions to 15 for current ladder, resets after TP
//   -override HYPE reset   → immediately reset override
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
const STATE_FILE     = path.resolve(process.cwd(), "bot-state.json");
const SIGNAL_FLATTEN = path.resolve(process.cwd(), "bot-flatten");
const SIGNAL_PAUSE   = path.resolve(process.cwd(), "bot-pause");
const SIGNAL_RESUME  = path.resolve(process.cwd(), "bot-resume");

// SUI ladder signal files
const SUI_STATE_FILE    = path.resolve(process.cwd(), "sui-ladder-state.json");
const SUI_SIGNAL_FLATTEN = path.resolve(process.cwd(), "sui-flatten");
const SUI_SIGNAL_PAUSE   = path.resolve(process.cwd(), "sui-pause");
const SUI_SIGNAL_RESUME  = path.resolve(process.cwd(), "sui-resume");
const POLL_MS        = 3000; // check for new messages every 3s

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
      await sendMessage(COMMAND_CH_ID, `❌ Unknown symbol \`${symKey}\`. Known: ${Object.keys(SYMBOL_MAP).join(", ")}`);
      return;
    }

    if (val === "reset") {
      clearOverride();
      await sendMessage(COMMAND_CH_ID, `✅ **Override cleared** for \`${symbol}\`. maxPositions back to config default.`);
      return;
    }

    const maxPos = parseInt(val);
    if (maxPos < 1 || maxPos > 25) {
      await sendMessage(COMMAND_CH_ID, `❌ maxPositions must be between 1 and 25.`);
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
      `⚡ **Override set** by ${author}`,
      `Symbol: \`${symbol}\``,
      `maxPositions: \`${maxPos}\``,
      `Mode: one-shot (resets automatically after next TP)`,
      `Send \`-override ${symKey} reset\` to cancel early.`,
    ].join("\n"));
    return;
  }

  // -status
  if (text === "-status") {
    const override = readOverride();
    let reply = `**Bot Status** — ${new Date().toISOString().replace("T"," ").slice(0,19)} UTC\n`;

    if (fs.existsSync(STATE_FILE)) {
      try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
        const positions = state.positions ?? [];
        const posCount = positions.length;
        const avgPnl = posCount > 0
          ? (positions.reduce((s: number, p: any) => s + (p.pnlPct ?? 0), 0) / posCount).toFixed(2)
          : "—";
        reply += `Ladder: ${posCount} positions | avg PnL: ${avgPnl}%\n`;
      } catch {
        reply += `State file unreadable.\n`;
      }
    } else {
      reply += `No state file found.\n`;
    }

    if (fs.existsSync(SIGNAL_PAUSE)) {
      reply += `⏸️ **PAUSED** — send \`-resume\` to unpause\n`;
    }

    if (override) {
      reply += `Override active: \`${override.symbol}\` maxPositions=${override.maxPositions} (set by ${override.setBy} at ${override.setAt.slice(0,16)})`;
    } else {
      reply += `No override active.`;
    }

    await sendMessage(COMMAND_CH_ID, reply);
    return;
  }

  // -closeladder
  if (text === "-closeladder") {
    fs.writeFileSync(SIGNAL_FLATTEN, `closeladder by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, [
      `🔴 **Close Ladder** triggered by ${author}`,
      `Bot will market-close all positions + hedge on next tick, then pause.`,
      `Send \`-resume\` to restart trading.`,
    ].join("\n"));
    return;
  }

  // -pause
  if (text === "-pause") {
    if (!fs.existsSync(SIGNAL_PAUSE)) {
      fs.writeFileSync(SIGNAL_PAUSE, `paused by ${author} at ${new Date().toISOString()}\n`);
    }
    await sendMessage(COMMAND_CH_ID, [
      `⏸️ **Bot Paused** by ${author}`,
      `No new adds. Existing positions stay open and will TP/exit normally.`,
      `Send \`-resume\` to unpause.`,
    ].join("\n"));
    return;
  }

  // -resume
  if (text === "-resume") {
    fs.writeFileSync(SIGNAL_RESUME, `resumed by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, `▶️ **Bot Resumed** by ${author} — trading active.`);
    return;
  }

  // ── SUI ladder commands ──

  // -sui-closeladder
  if (text === "-sui-closeladder" || text === "-sui-flatten") {
    fs.writeFileSync(SUI_SIGNAL_FLATTEN, `closeladder by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, [
      `🔴 **SUI Close Ladder** triggered by ${author}`,
      `SUI bot will market-close all rungs on next tick, then pause.`,
      `Send \`-sui-resume\` to restart.`,
    ].join("\n"));
    return;
  }

  // -sui-pause
  if (text === "-sui-pause") {
    if (!fs.existsSync(SUI_SIGNAL_PAUSE)) {
      fs.writeFileSync(SUI_SIGNAL_PAUSE, `paused by ${author} at ${new Date().toISOString()}\n`);
    }
    await sendMessage(COMMAND_CH_ID, [
      `⏸️ **SUI Bot Paused** by ${author}`,
      `No new rungs. Open ladder stays and will TP/SL/expire normally.`,
      `Send \`-sui-resume\` to unpause.`,
    ].join("\n"));
    return;
  }

  // -sui-resume
  if (text === "-sui-resume") {
    fs.writeFileSync(SUI_SIGNAL_RESUME, `resumed by ${author} at ${new Date().toISOString()}\n`);
    await sendMessage(COMMAND_CH_ID, `▶️ **SUI Bot Resumed** by ${author} — trading active.`);
    return;
  }

  // -sui-status
  if (text === "-sui-status") {
    let reply = `**SUI Ladder Status** — ${new Date().toISOString().replace("T"," ").slice(0,19)} UTC\n`;

    if (fs.existsSync(SUI_STATE_FILE)) {
      try {
        const st = JSON.parse(fs.readFileSync(SUI_STATE_FILE, "utf-8"));
        const rungs = st.rungs ?? [];
        if (rungs.length > 0) {
          const holdH = ((Date.now() - st.openedAt) / 3600000).toFixed(1);
          reply += `Rungs: ${rungs.length}/7 | avg $${st.avgEntry?.toFixed(4) ?? "?"} | notional $${st.totalNotional?.toFixed(0) ?? "?"} | ${holdH}h\n`;
        } else {
          const coolRemain = st.lastCloseTime > 0
            ? Math.max(0, 12 - (Date.now() - st.lastCloseTime) / 3600000).toFixed(1)
            : "0";
          reply += `FLAT | cooldown ${coolRemain}h remaining\n`;
        }
        reply += `Trades: ${st.tradeCount ?? 0} | Realized: $${st.realizedPnl?.toFixed(2) ?? "0"}`;
      } catch {
        reply += `State file unreadable.`;
      }
    } else {
      reply += `No SUI state file — bot may not have started yet.`;
    }

    if (fs.existsSync(SUI_SIGNAL_PAUSE)) {
      reply += `\n⏸️ **PAUSED** — send \`-sui-resume\` to unpause`;
    }

    await sendMessage(COMMAND_CH_ID, reply);
    return;
  }

  // -help
  if (text === "-help") {
    await sendMessage(COMMAND_CH_ID, [
      "**RiverBot Commander — Commands**",
      "```",
      "── HYPE Ladder ──",
      "-override <sym> <n>   Raise maxPositions (one-shot, resets after TP)",
      "-override <sym> reset Cancel active override",
      "-closeladder          Market-close all positions + hedge, then pause",
      "-pause                Pause bot (no new adds)",
      "-resume               Resume bot from pause",
      "-status               Show HYPE ladder state",
      "",
      "── SUI Ladder ──",
      "-sui-closeladder      Market-close all SUI rungs, then pause",
      "-sui-pause            Pause SUI bot (no new rungs)",
      "-sui-resume           Resume SUI bot",
      "-sui-status           Show SUI ladder state",
      "",
      "-help                 This message",
      "```",
      "Symbols: " + Object.keys(SYMBOL_MAP).join(", "),
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
