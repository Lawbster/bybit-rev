/** Reproducible study-only source deltas; archived replay/audit are never edited. */
import fs from "fs";
import assert from "assert/strict";
import { sha } from "./research-workflow";
const engineEdits: Array<[string, string]> = [
  [
    "/** Current long policy, causal minute execution. Not an exchange/maker simulator. */",
    "/** AG10-C1 study-local derivative. Exact source delta is enforced by aggressive10-cooldown-source.ts. */"
  ],
  [
    "export interface CausalRunOptions {",
    "export interface CausalRunOptions {\n  /** Only the exact two-day-high FULL exit; clock begins at its actual fill. */\n  researchHighExitCooldownHours?: 1 | 2;\n  researchCooldownObserver?: (row: Readonly<{ at: number; index: number; episode: number; reason: string; rsi: number | null; priorUntil: number; inheritedUntil: number; until: number }>) => void;"
  ],
  [
    "  const config: BotConfig = structuredClone(liveConfig);",
    "  if (opts.researchHighExitCooldownHours !== undefined && ![1, 2].includes(opts.researchHighExitCooldownHours)) throw new Error(\"Invalid AG10-C1 high-exit cooldown\");\n  const config: BotConfig = structuredClone(liveConfig);"
  ],
  [
    "    if ([\"tp\", \"stale_tp\"].includes(intent.reason)) {",
    "    const priorUntil = cooldownUntil;\n    if ([\"tp\", \"stale_tp\"].includes(intent.reason)) {"
  ],
  [
    "    endedFlatAtIdx = index;",
    "    const inheritedUntil = cooldownUntil;\n    if (intent.reason === \"research_exit:exit_2d_1pct\" && opts.researchHighExitCooldownHours !== undefined)\n      cooldownUntil = at + opts.researchHighExitCooldownHours * 3600000;\n    opts.researchCooldownObserver?.(Object.freeze({ at, index, episode, reason: intent.reason, rsi: intent.rsi, priorUntil, inheritedUntil, until: cooldownUntil }));\n    endedFlatAtIdx = index;"
  ]
];
const auditEdits: Array<[string, string]> = [
  [
    "// L14 independent extension: configured age cap; reset arms on every inventory mutation.",
    "// AG10-C1 study-local audit derivative; only the exact high-exit cooldown assertion differs."
  ],
  [
    "    if (v.kind === \"close\" && ![\"tp\", \"stale_tp\"].includes(v.reason)) cooldown = (Math.floor(v.fillAt / 14400000) + 2) * 14400000;",
    "    if (v.kind === \"close\" && ![\"tp\", \"stale_tp\"].includes(v.reason)) cooldown = v.reason === \"research_exit:exit_2d_1pct\" && x.spec.highExitCooldownHours !== undefined\n      ? v.fillAt + x.spec.highExitCooldownHours * 3600000 : (Math.floor(v.fillAt / 14400000) + 2) * 14400000;"
  ]
];
function patched(source: string, edits: Array<[string, string]>) {
  return edits.reduce((s, [from, to]) => { assert.equal(s.split(from).length, 2, "Nonunique source boundary"); return s.replace(from, to); }, source.replace(/\r\n/g, "\n"));
}
export function verifyStudyDerivatives() {
  const rows = [
    ["scripts/replay-causal-engine.ts", "scripts/aggressive10-cooldown-engine.ts", engineEdits],
    ["scripts/age-high-refinement-audit.ts", "scripts/aggressive10-cooldown-audit.ts", auditEdits]
  ] as const;
  return rows.map(([base, derived, edits]) => {
    const original = fs.readFileSync(base, "utf8"), expected = patched(original, edits), actual = fs.readFileSync(derived, "utf8").replace(/\r\n/g, "\n");
    assert.equal(actual, expected, "Unapproved study source delta");
    return { base, derived, baseSha256: sha(original), derivedNormalizedSha256: sha(actual), exactDelta: true };
  });
}
