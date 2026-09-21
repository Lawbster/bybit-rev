# Research restart brief

Updated 2026-09-21. Navigation only; frozen cards and accepted artifacts are
authoritative. This is not live health or permission to trade.

## Current status

- **SFP stop-timing inspection (2026-09-21):** [findings](codex-astra-sfp-stop-timing-findings-2026-09-21.md).
  Saved SF08 5%-padding ledgers only: 7 stops/$4,903 out of 102 trades; other
  29 losses timeouts. All stops in2025. Weekend entries5/21 stops versus
  weekdays2/81, but weekend net-$2,739 in2025 / +$1,932 in2026. Six stops
  entered04/20 UTC, yet both hour cohorts profitable. All seven identities
  survive120s lag. Descriptive, no new filter/replay/live change; dates and
  denominators saved, no candles/maps rebuilt.
- **SF08 latest SFP candles (2026-09-21):** [findings](codex-astra-sfp-latest-candles-findings-2026-09-21.md).
  Through Sep21 00:22 UTC, append-only from Sep15 20:20; 7,442 minutes,
  one separately witnessed gap, old prefix/trades exact. Sep15 16:01 entry
  $77.23 survives at5% padding ($72.45997 stop), low$75.09, TP$79.1727
  Sep16 11:27, within24h. Net+$240.41/$480.82 at10k/20k; original stop-$134.76.
  Updated full5%66W36L +$11,709.71/DD5.29% at10k, +$23,419.41/DD9.01% at20k.
  Baseline original stop44W79L +$2,842.23/DD7.92%. Flat cutoff; no new confirmed
  entries after old cutoff.72 extended paths audited; receipt-aware confirmation
  matches modeled history. Findings link new map; no live changes or promotion.
  Job `54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e`.
- **SF07 5% sizing check (2026-09-21):** [findings](codex-astra-sfp-5pct-sizing-findings-2026-09-21.md).
  Same $32k DD account and exact 5% policy: $10k->$20k position notional changes
  net +$11,495->+$22,989, full DD5.29%->9.01%, average loss$331->$661,
  worst loss$963->$1,926. Same65W36L; recent DD3.06%->5.92%.
  36 paths audited, parent hashes/identities exact, no new strategy/candle data.
  Standalone before funding, not shared-account sizing or live approval.
- **SF07 requested wider-stop grid complete (2026-09-20):** [findings](codex-astra-sfp-wide-stop-grid-findings-2026-09-20.md) /
  [card](../research-inputs/sfp-wide-stop-grid-sf07-2026-09-20.json). Original
  SF01 range4h/2R/24h, extra stop-price padding 3-6% every 0.25%; fixed targets.
  Highest net 6% +$11,758/DD5.73%; 5% +$11,495/DD5.29%. Both 65W/36L vs
  baseline 43W/79L +$2,690/DD7.92%, prior3% +$7,497/DD8.47%.
  All5-6% recent results identical: +$3,232/DD3.06%, 15W/5L, zero SL hits;
  recent baseline +$1,397/DD2.47%. **0/13 complete screen passes** (recent DD
  and monthly regressions). 6% is extra padding: median actual risk7.93%.
  504 paths audited (72 reused controls); archived baseline and prior3% exact.
  Job `41f04d2507dfd14c5d3535b0dc5ea280040cadf41888f0ae1a558533245e10a8`.
  Top-five monthly/W-L/risk, all13 ranking and best6% chart linked in findings.
  No new filters, hold extensions, detector rebuilds or live changes.
- **SF06 wider-stop replay complete (2026-09-20):** [findings](codex-astra-sfp-wide-stop-findings-2026-09-20.md) /
  [card](../research-inputs/sfp-wide-stop-sf06-2026-09-20.json). Original best
  SF01 range4h/2R/24h, no RSI/HL filter, original absolute TP/eligibility retained.
  Extra stop-price padding0.5/1/2/3%: nets+$3,429/4,552/5,883/7,497 versus
  baseline+$2,690.3% gives63W41L/DD8.47% vs43W79L/DD7.92%; average loss
  $375 vs$196.24 old losers turn profitable;30 get worse;4 old winners skipped.
  Recent2% +$2,620/DD3.01% beats3% +$2,307/DD3.30%; baseline+$1,397/DD2.47%.
  **0/4 screen passes:** higher DD and worse months.3% remains a profitability
  lead, not validated deployment; highest tested boundary is not an optimum.
  All180 paths audited; archived baseline results/monthly/trade bytes exact.
  Job `79c0083b0e60e61864f2eaeb452c88009087ec0144b1fb0ac1f219a4468cf340`;
  best3% chart and monthly/attribution links in findings. Reusable research-only
  `exitStopPaddingPct` added; no live changes.72h extension/HL filters not tested.
- **SF05-HL sacrificed-winner inspection (2026-09-20):** [findings](codex-astra-sfp-rsi-ema-hl-review-findings-2026-09-20.md).
  Reuses SF05 removed trades + SF04 pre-entry HL snapshots; no replay/raw scan.
  Only3/5 blocked winners ($811) and4/14 blocked losers ($524) have HL coverage;
  older2 winners ($1,484) predate collection. Covered winners all1h buy-dominant,
  but so are2/4 blocked losers and4/6 other mapped stops.15m lead-in persistence,
  book and OI do not cleanly separate them. August winners have deeper OI drops,
  but only2 dates and month confounding. No rule/rescue earnings/live changes.
  Saved job `ff4016e1d2fb213bb8324010752c987f0f4c7b2f6d753c7864f85f7a3b908541`;
  all pre-entry HL fields, ranges, source provenance and delay sensitivity retained.
- **SF05 RSI/EMA condition complete (2026-09-20):** [findings](codex-astra-sfp-rsi-ema-findings-2026-09-20.md) /
  [card](../research-inputs/sfp-rsi-ema-sf05-2026-09-20.json). Original SF01
  4h/2R/24h, closed15m RSI14<52 AND closed4h close>EMA200 by6%.
  A43W79L +$2,690/DD7.92%; entry block38W65L +$2,441/DD6.02%;
  block+exit39W64L +$1,997/DD9.97%. Entry veto removes14 losers/$2,046
  but5 winners/$2,295. Early exit helps two recent trades (+$307 recent vs A)
  but cuts older recoveries (-$1,000 older vs A). **0/2 screen passes**.
  All108 paths audited; archived baseline results/monthly/trade bytes exact.
  Saved signals/tape reused, no map rebuild; entry+exit source clocks saved.
  Job `42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9`.
  No live changes. Wider stop subsequently tested separately in SF06;
  exit-only/other RSI/EMA thresholds remain untested.
- **SF04 pressure-point map complete (2026-09-20):** [findings](codex-astra-sfp-pressure-map-findings-2026-09-20.md) /
  [card](../research-inputs/sfp-pressure-map-sf04-2026-09-20.json).
  Original SF01 4h/2R/24h, HL-era census13 wins/10 stops, not invented15+15.
  Saved878 phase-labelled snapshots/204 columns: RSI/CRSI/VWAP/EMA15m/1h/4h,
  volatility/volume and HL flow/book/OI/funding. Selection sealed before features.
  Entry medians overlap; weekly discount deeper for wins (-5.50% vs-2.89%),
  HL15 selling stronger among wins in aggregate but flips by month. Clearer
  follow-through after entry is diagnostic, not an entry filter or exit replay.
  Stops:7 later original TP touches byentry+72h,2 non-recoveries,1 censored.
  Too few failures for a disaster classifier. No new economic rules/live changes.
  Job `0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207`;
  CSV/JSON/case-map links in findings. Reuse saved map; no rescanning required.
  Wider-stop-only experiment subsequently completed in SF06 above; no HL
  threshold chosen from two failures. Follow-through rules remain separate.
- **SF03 sweep-low limit entry complete (2026-09-20):** [findings](codex-astra-sfp-sweep-limit-findings-2026-09-20.md) /
  [method](../docs/research/range-low-sfp-limit-sf03.md). Saved original4h SF01
  signals; limit at sweep low / +0.1%, exclusive4h expiry, unchanged absolute
  TP/SL and original signal eligibility. $10k, same dates/costs/clocks.
  24h market baseline43W79L +$2,690/DD7.92%; exact2W46L -$254/DD4.23%;
  +0.1%5W48L -$62/DD4.09%. Cheaper entry reduces losses but misses41/43
  or39/43 original winners. Median stop room0.1%/0.2%, many immediate stops.
  72h and minute-open fill sensitivity do not rescue it; **0/4 screen passes**.
  Original baseline results/monthly/trade bytes unchanged; all360 paths audited.
  Job `2d61717152fd4cf0cb5ac714e99eeb7a55790474189a4cd77731ad544397a436`.
  Reuses detections/map, two interactive replay maps saved. No live changes.
  HL/indicator context now mapped in SF04 above; wider SL remains a separate test.
- **SF02 earlier confirmation complete (2026-09-20):** [findings](codex-astra-sfp-earlier-confirmation-findings-2026-09-20.md) /
  [method](../docs/research/range-low-sfp-early-sf02.md). Same4h range anchors,
  completed15m sweep/reclaim, causal15m stop/2R.192->239 signals; 24h baseline
  43W79L +$2,690/DD7.92% vs70W120L -$2,259/DD14.35%;72h +$1,223 vs-$2,614.
  **0/2 screen passes.** Earlier signal references are cheaper, but narrower
  brackets and additional trades worsen net; both older/recent windows lose.
  Archived4h events/actions/totals preserved and verified, candidate accounting/
  clocks checked. Job `4e8a026f7d3db11e8b5e0d090e8b22713bc93742a555e90215062e9976a80661`.
  Recent HL/indicator context on original4h baseline stops now covered in SF04,
  comparing72h recovery/non-recovery with pre-entry availability and censoring.
  No HL filter, wider SL, retest variant or live change tested in SF02.
- **SF01 human HYPE stop review (2026-09-20):** [audit](codex-astra-sf01-human-stop-review-findings-2026-09-20.md).
  Preserved72 annotations, matched72/73 range2R24h stops. Later original-target
  touches:21 within24h,43 within72h,55 within7d (censoring detailed in report).
  Not a profitable counterfactual: recoveries can require much deeper excursions;
  only16/43 baseline winners retest the range low before exit. Proposed separate
  finer-confirmation, retest-and-hold, and confirmed-invalidation tests;
  finer-confirmation run in SF02, simple sweep-limit entry in SF03 above.
- **SF01 BTC/SOL transfer (2026-09-20):** [comparison](codex-astra-range-low-sfp-cross-asset-findings-2026-09-20.md).
  Same frozen HYPE rules/windows/$10k sizing, saved research tapes, own controls.
  BTC range2R24/72h nets -$1,044/-$374 vs -$3,888/-$3,339 control;
  SOL -$6,818/-$7,448 vs -$1,914/-$3,314. **0/4 primary screen passes.**
  BTC lower DD but still loses; SOL filter harms net in both split windows.
  Reports include monthly tables, verification and saved interactive maps.
  HYPE evidence preserved, no live changes, no new thresholds.
- **Original SFP checkpoint: SF01 range-low SFP (2026-09-20).**
  [Findings](codex-astra-range-low-sfp-findings-2026-09-20.md) /
  [method](../docs/research/range-low-sfp-sf01.md) /
  [card](../research-inputs/range-low-sfp-sf01-2026-09-20.json).
  Reuses Fable's scanner/replay/chart pipeline; 4h long-only, $10k notional,
  Dec27 2024-Sep15 2026. Six definitions (two controls, two range-filter
  primaries, two range-high target diagnostics); 60/120s source clocks.
  24h/2R control 72W135L +$2,530/DD12.10%; range 43W79L +$2,690/DD7.92%.
  **0/2 primary screen passes:** monthly opportunity costs and concentration.
  Range-high targets worse. Charts now start zones at availability, not origin.
  Final study key `e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b`.
  Replay/scan HTML links are in findings; saved outputs reused and hash-verified.
  H&S fakeout remains parked; POC/VWAP, short mirror and ladder integration not run.
- **Fable September19-20 tooling/evidence:** [setup ledger](setup-ledger.md)
  and [scanner/replay/chart guide](../docs/research/setup-scan.md). RS01, PA05,
  MR01, cross-asset tapes and exploratory runs postdate the PA07 snapshot below.
  Use their ledger to avoid repeating runs; its results are not frozen-card approvals.

- **Storage tooling (2026-09-20):** [local SSD/OneDrive archive workflow](../docs/research/research-archive.md).
  Explicit completed-study queue in `research-archive-config.json`; use
  `npm run research:archive -- plan` / `run` / `status`. Content-addressed
  compressed copies preserve original paths and hashes. No automatic source
  deletion or cloud-upload confirmation; restore required artifacts before
  replay. This is infrastructure, not a new economic research checkpoint.

- **Earlier frozen checkpoint: PA07 source-library setups.**
  [Findings](codex-astra-price-action-setups-findings-2026-09-18.md) /
  [method](../docs/research/price-action-pa07.md) /
  [card](../research-inputs/price-action-pa07-2026-09-18.json).
  PA06 sweep/impulse and PA03 origin-zone confirmed return; eight candidates,
  eight same-family controls, both directions, structural/reference2R targets,
  structural stops/24h cap. **0/8 upgrade qualifiers.** Break-short2R control
  +$5,312/DD13.19%/226 trades; retest+$2,322/DD5.17%/50. Structural long
  control−$7,784→retest+$1,537; only7 recent retest trades per side. Sweep
  impulse leaves5long/7short. No live changes. **9,338 standalone/205 overlays.**
  Next distinct coverage: PA04 outside-close reclaim and PA05 third visit;
  then strict PA02 lineage/PA01 anchored-range fidelity. Not another threshold
  rescue or a claim that the whole library was exhausted.
- **Latest knowledge checkpoint:** [trade setup master](TRADE-SETUP-LIBRARY.md).
  Asset-neutral and separate from active POC research:28 searchable records
  (17 source-derived entries/components,11 existing-research routes), with
  shared primitives, source pages, invalidation and unresolved-definition fields.
  Library now includes STC18:20 PDFs /492 pages catalogued. Read-only retrieval
  and reference validation: `npx ts-node scripts/setup-library.ts`, with commands
  `list`, `search <terms>`, `show <ID>` or `validate`.
  PA03/PA06 now link scoped PA07 evidence; other concepts remain untested or
  adjacent-only. This does not select a new trading policy.
- **Latest planning checkpoint:** [expanded price-action replication plan](codex-astra-rektproof-expanded-plan-2026-09-18.md).
  Prior19-PDF /474-page plan; duplicates, reading coverage and
  source conflicts recorded in the [source index](rektproof-source-index-2026-09-18.md).
  Original planning checkpoint; PA07 subsequently implemented the narrower
  HYPE sweep/origin batch. Strict range reversal/breaker/protected-structure
  implementations and BTC coverage remain outstanding.
  TPO is not our volume POC; source-specific entries/targets stay distinct.
  Expanded plan supersedes provisional definitions in the single-PDF plan.
- **LC01 complete:** NPOC and previous-day-high entries with CRSI, ROC, CMF,
  and CMF plus directional NPOC clearance. Four entries, two existing exits;
  **0/32 primary qualifiers**,16 diagnostics. No live changes.
- Useful defensive lead: NPOC+CMF12h long, full$15,962 ->$9,365 /DD14.09 ->4.99%;
  recent$602 ->$1,685,17 trades. Lower risk, less full-period profit. CMF daily-high
  short13 trades and publication-delay-sensitive; not a qualified short.
- SF01 is the latest frozen extension; do not expand its thresholds after
  reading outcomes. LC01/PA07 cumulative counts below predate later scanner runs.
- Work single-agent by default; spawn subagents only when the user explicitly
  requests them. Astra handles design, implementation, causality and review.
  Reuse existing scripts/artifacts; keep implementation scoped and verification
  proportional to risk. The optional worker brief is not permission to delegate.

## Open only relevant files

| Need | File |
|---|---|
| Latest actual setup tests / exact rules | [PA07 findings](codex-astra-price-action-setups-findings-2026-09-18.md) / [method](../docs/research/price-action-pa07.md) |
| Broad setup discovery, entry/risk/exit concepts, prior-test routes | [Trade setup master](TRADE-SETUP-LIBRARY.md) / [searchable index](setup-library/index.json) |
| Shared terminology / from concept to exact test | [Primitives](setup-library/PRIMITIVES.md) / [implementation contract](setup-library/CARD-TEMPLATE.md) |
| Current library-derived direction and next task | [Expanded replication plan](codex-astra-rektproof-expanded-plan-2026-09-18.md) |
| PDF identity, page refs, overlap, source conflicts | [Source index](rektproof-source-index-2026-09-18.md) / [catalogue](../research-inputs/rektproof-corpus-catalog-2026-09-18.json) |
| Latest baselines, W/L dollars, monthlies, limitations | [LC01 findings](codex-astra-level-indicator-findings-2026-09-18.md) |
| Exact frozen logic | [LC01 method](../docs/research/level-indicator-lc01.md) / [card](../research-inputs/level-indicator-lc01-2026-09-18.json) |
| Indicator lineage and formulas | [Indicator findings](INDICATOR-FINDINGS.md), then only the relevant family |
| Previous48h-high rejection study, distinct from calendar-high LC01 | [HT03 findings](codex-astra-high-touch-rejection-findings-2026-09-18.md) |
| Existing POC/NPOC high-short vetoes | [HT02 findings](codex-astra-high-touch-poc-findings-2026-09-17.md) |
| Has a different idea been tested? | Search `research/TESTED-SETUPS.md` by mechanism |
| Production, only if requested | `CLAUDE.md`, relevant operations runbook |

## Exact accepted PA07 snapshot

`backtests/price-action/1ff4e6f0e2438c0b42c4989d433930d092c44135da30ca6be44c57def06f6907`

Saved reusable event map:
`backtests/price-action-events/88e2b6c3d2134782638ff5ea2cd7bb53eff1029613c683d4a34bbdc34a0e480d`

- Event tapes for60/120s source publication: bars/pivots,2,618 lifecycle rows,
  968 signals each. `predecision-atlas/index.html` has16 chronological examples.
- Six exact archived control fixtures;384 independently audited execution
  paths,22,536 receipts; complete pivot inventory and signal source/prefix audits.
- `report.md`, `ranking.json`, `comparison-results.json`,
  `comparison-monthly.json`, trade CSVs and gzipped journals. Read, don't rerun.
- [Portable acceptance pointer](../research-inputs/price-action-pa07-accepted-2026-09-18.json)
  records exact hashes; reading it is not re-verification of bulk local evidence.
- Reuse `price-action-signals.ts`, `structural-replay-audit.ts`, existing
  structural executor and immutable candle cache. PA07 is fixed1h/4h v1,
  asset-neutral geometry; another asset still requires its own data/fee audit.

## Prior LC01 accepted snapshot (POC branch)

`backtests/level-indicator/115a3a56ddead6e333ee025377aac687a0e9b39a4d48aa8daf6eaf199f4d5247`

- `baseline-parity.json`:72 exact LV02 control paths.
- `independent-verification.json`:1,008 audited paths,57,108 receipts,
  1,252 source contexts; recorded pass. Reading it does not reverify files.
- `results.csv`, `monthly.csv`, `ranking.json`: all outcomes, screens and own
  controls. Gzipped case journals include full trades and ownership attribution.
- `contexts.json.gz`: shared original-signal indicator/NPOC snapshots; saved once.
- `plan.json`, `complete.json`: source/input hashes and sealed output identity.
  `latest.json` is a locator, not an identity substitute. Immutable `review.md`
  predates verification; use the later verification receipt for acceptance.

Period Dec5,2024 12:55–Sep15,2026 20:20 UTC; recent split June1,2026.
$10k fixed notional, $32k DD equity,0.055% fee per side, before funding.
Timed12h and TP2%/SL3.5% capped12h. Source lags60/120s, action delays0/60s,
+5bps/side stress. Independent strategy accounts, not a shared portfolio.
No untouched holdout, collector-arrival, queue, margin or liquidation claim.

## Reuse, don't reconstruct

Card pins saved LV02/LV01/PB02 signals, candle atlas and accepted POC map.
Do not rebuild these per strategy. Historical naked status must be projected
as-of decision time, never copied from the cutoff map.

| Component | Reuse boundary |
|---|---|
| `level-indicator-study.ts` | Thin frozen LC01 runner/context selection |
| `poc-indicator-bias-engine.ts` | Existing closed-bar indicator tape |
| `poc-exit-cap-engine.ts` | Existing standalone execution/TP/SL/timeout |
| `poc-exit-cap-audit.ts`, `high-touch-short-audit.ts` | Independent long/short minute audits |
| `high-touch-poc-context.ts` | Nearest level and full ownership attribution |
| `level-indicator-verify.ts` | LC01 context/clocks, selection, controls and screen verification |

Do not edit pinned code for convenience. Changed definitions require a new
card and thin driver. See [reuse-first workflow](../docs/research/efficient-research-workflow.md).
