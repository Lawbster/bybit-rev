import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, inside, jobDirectory, verifyPins } from "./research-workflow";
import { runRelativeStudy, validateDefinition } from "./relative-reversion-study";
import { runFrozenScorecard, validateScorecard } from "./research-frozen-scorecard";
import { runProxyStudy, validateProxyCard } from "./hype-market-proxy-study";
import { runConstructionStudy, validateConstructionCard } from "./hype-recovery-construction-study";
import { runHighStudy, validateHighCard } from "./hype-near-high-study";
import { runExtendedHighStudy, validateExtendedHighCard } from "./hype-near-high-extension-study";
export const SOURCES = ["scripts/research-workflow.ts", "scripts/research-workflow-cli.ts", "scripts/research-workflow-tests.ts",
  "scripts/relative-reversion-features.ts", "scripts/relative-reversion-study.ts", "scripts/relative-reversion-tests.ts", "scripts/relative-reversion-verify.ts",
  "src/research/closed-bars.ts", "scripts/replay-candle-repair.ts", "scripts/failed-recovery-analysis.ts",
  "scripts/research-frozen-scorecard.ts", "scripts/conditional-soft-stale-policy.ts", "scripts/ladder-component-accounting.ts",
  "scripts/ladder-exposure-metrics.ts", "package-lock.json", "tsconfig.json"];
async function main() {
  const root = path.resolve(__dirname, ".."); assert.equal(process.cwd(), root, "Run from repository root");
  const [command, arg, ...extra] = process.argv.slice(2); assert.equal(extra.length, 0);
  if (command === "plan") {
    assert(arg?.startsWith("research-inputs/"));
    const card = JSON.parse(fs.readFileSync(inside(root, arg), "utf8"));
    const sources = [...SOURCES];
    if (card.kind === "relative-reversion-v1") validateDefinition(card.definition);
    else if (card.kind === "market-proxy-comparison-v1") {
      validateProxyCard(card.definition); sources.push("scripts/market-proxy-comparison.ts", "scripts/hype-market-proxy-study.ts",
        "scripts/market-proxy-tests.ts", "scripts/market-proxy-verify.ts");
    }
    else if (card.kind === "recovery-construction-v1") {
      validateConstructionCard(card.definition);
      const inherited = JSON.parse(fs.readFileSync(inside(root, `${card.definition.archive}/manifest.json`), "utf8"));
      const proxy = JSON.parse(fs.readFileSync(inside(root, `${card.definition.proxyArchive}/plan.json`), "utf8"));
      sources.push(...inherited.pins.map((x: any) => x.file),
        ...proxy.pins.filter((x: any) => x.file.startsWith("data/") || x.file.includes("/repair.json")).map((x: any) => x.file),
        arg, "scripts/hype-recovery-construction-study.ts", "scripts/recovery-trajectory.ts", "scripts/ladder-construction-policy.ts",
        "scripts/recovery-construction-tests.ts", "scripts/recovery-construction-verify.ts", "scripts/market-proxy-comparison.ts", "src/research/indicator-features.ts");
    }
    else if (card.kind === "near-high-extension-v1") {
      validateExtendedHighCard(card.definition);
      const inherited = JSON.parse(fs.readFileSync(inside(root, `${card.definition.acceptedResults}/plan.json`), "utf8"));
      sources.push(...inherited.pins.map((x: any) => x.file), arg, "scripts/hype-near-high-extension-study.ts", "scripts/near-high-extension-policy.ts",
        "scripts/near-high-extension-tests.ts", "scripts/near-high-extension-verify.ts");
    }
    else if (card.kind === "near-high-ladder-v1") {
      validateHighCard(card.definition);
      const inherited = JSON.parse(fs.readFileSync(inside(root, `${card.definition.acceptedResults}/plan.json`), "utf8"));
      sources.push(...inherited.pins.map((x: any) => x.file), arg, "scripts/hype-near-high-study.ts", "scripts/near-high-policy.ts",
        "scripts/near-high-tests.ts", "scripts/near-high-verify.ts");
    }
    else {
      assert.equal(card.kind, "frozen-soft-stale-scorecard-v1"); validateScorecard(card.definition);
      const archive = card.definition.archive, manifest = `${archive}/manifest.json`;
      for (const name of ["manifest.json", "results.json", "validation.json", "verification.json"]) assert(card.inputs.includes(`${archive}/${name}`));
      const inherited = JSON.parse(fs.readFileSync(inside(root, manifest), "utf8"));
      sources.push(...inherited.pins.map((x: any) => x.file));
    }
    const p = await createPlan(root, card, sources, ["bot-config.json", "hl-short-live-config.json", "bot-state.json",
      "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]);
    console.log(JSON.stringify({ key: p.key, definitionId: p.definitionId, directory: jobDirectory(root, p.key), next: `npm run research:workflow -- run ${p.key}` }, null, 2));
  } else if (command === "run") {
    assert(arg); await executePlan(root, arg, (p, out) => p.card.kind === "relative-reversion-v1"
      ? runRelativeStudy(root, p, out) : p.card.kind === "market-proxy-comparison-v1"
        ? runProxyStudy(root, p, out) : p.card.kind === "recovery-construction-v1"
          ? runConstructionStudy(root, p, out) : p.card.kind === "near-high-ladder-v1"
            ? runHighStudy(root, p, out) : p.card.kind === "near-high-extension-v1"
              ? runExtendedHighStudy(root, p, out) : runFrozenScorecard(root, p, out));
  } else if (command === "verify") {
    assert(arg); const dir = jobDirectory(root, arg), state = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
    assert.equal(state.status, "complete"); assert(state.artifacts.length > 0); await verifyPins(root, state.artifacts);
    console.log(JSON.stringify({ key: arg, artifactsIntact: true, economicQualification: "not_evaluated" }));
  } else if (command === "status") {
    const base = inside(root, "backtests/research-workflow");
    const keys = arg ? [arg] : fs.existsSync(base) ? fs.readdirSync(base).filter(x => /^[a-f0-9]{64}$/.test(x)) : [];
    console.log(JSON.stringify(keys.map(key => {
      const dir = jobDirectory(root, key), p = path.join(dir, "state.json");
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { key, status: "incomplete_plan" };
    }), null, 2));
  } else throw Error("Usage: research:workflow -- plan research-inputs/CARD.json | run KEY | status [KEY] | verify KEY");
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
