# Trade setup library — start here

Asset-neutral knowledge base, September 18, 2026. **Separate from the active
POC project and from live configuration.** Its purpose is to turn source
lessons and accumulated research into retrievable, falsifiable trade ideas.
It is not a list of strategies approved to trade, nor evidence that markets
must follow the narratives in the PDFs.

## Find the right information without rereading everything

```powershell
npx ts-node scripts/setup-library.ts list
npx ts-node scripts/setup-library.ts search breaker
npx ts-node scripts/setup-library.ts search invalidation
npx ts-node scripts/setup-library.ts search btc
npx ts-node scripts/setup-library.ts show PA02
npx ts-node scripts/setup-library.ts validate
```

Search returns short metadata matches, not the whole library. `show` returns
one definition and its source/evidence links. `validate` checks library
structure and references, **not strategy profitability or replay correctness**.
Everything is plain Markdown/JSON; `rg` or any other agent can use it without
this command. No database, embedding service or model dependency is needed.

| Layer | Canonical home | Purpose |
|---|---|---|
| This master | `TRADE-SETUP-LIBRARY.md` | Navigation, interpretation and workflow |
| Searchable index | [index.json](setup-library/index.json) | Stable IDs, types, tags, dependencies, source pages and research relations |
| Definitions | [price action](setup-library/price-action.md), [context](setup-library/context.md), [management](setup-library/management.md) | Ordered setup logic, entry, validation, invalidation, targets, open choices |
| Shared meanings | [PRIMITIVES.md](setup-library/PRIMITIVES.md) | Prevent sweep/MSB, TPO/volume, origin/availability and risk concepts drifting between agents |
| Earlier lessons | [research-families.md](setup-library/research-families.md) | Routes into existing indicators, flow, cross-asset, ladder and exit research |
| Original sources | [source index](rektproof-source-index-2026-09-18.md) / [hash catalogue](../research-inputs/rektproof-corpus-catalog-2026-09-18.json) | Attribution, duplicate groups, page references, interpretation limits |
| Exact tests | [TESTED-SETUPS.md](TESTED-SETUPS.md), linked cards/findings/artifact seals | Which precise configuration was tested on which asset/window, and what happened |

The index stores navigation and provenance; the linked section stores the
definition. Exact study cards/results remain where they are. Do not copy
changing PnL tables into this master or build a second competing tested register.

## Scan a tape for occurrences

For setups that have a detector, an agent can ask where the sequence occurred without
writing code:

```powershell
npx ts-node scripts/setup-scan.ts resolve "RF breaker"        # -> PA02
npx ts-node scripts/setup-scan.ts run --setup PA02 --symbol HYPEUSDT --from 2026-03-15 --to 2026-09-15
npx ts-node scripts/setup-scan.ts show PA02
```

The result is a causal occurrence ledger with known-at timestamps, every rejected or
expired attempt, descriptive forward labels and chart inputs. It is not a backtest and
attaches no evidence to a record; see [docs/research/setup-scan.md](../docs/research/setup-scan.md).
Detectors exist for PA02, PA03, PA04 and PA06; `list` names the rest.
The September19-20 additions include RS01, PA05, MR01 and the adjacent
[SF01 range-low SFP study](codex-astra-range-low-sfp-findings-2026-09-20.md).
SF01 does not validate PA01's full MSB/retest sequence; its frozen method and
interactive charts are linked in the findings. H&S fakeout remains unimplemented.
[SF02 earlier confirmation](codex-astra-sfp-earlier-confirmation-findings-2026-09-20.md)
keeps4h anchors and uses15m sweep/reclaim.0/2 passes; archived4h controls unchanged.
This does not test wider stops or HL-based recovery discrimination.
[Unchanged SF01 BTC/SOL transfer](codex-astra-range-low-sfp-cross-asset-findings-2026-09-20.md)
adds independent asset paths and maps, not new parameters: 0/4 primary comparisons
pass; both assets' range variants remain net negative. HYPE artifacts preserved.
`npx ts-node scripts/setup-chart.ts --setup PA02` writes a self-contained `chart.html` beside the latest
replay (or scan) for visual fidelity review of each event's stages, zone, references and bracket.
[setup-ledger.md](setup-ledger.md) is the generated lookup of every scanner replay and scan on file
(HYPE, BTC, SOL), with each run's top cells, screens and a hand-kept status; check it before re-running
a variant. It feeds [TESTED-SETUPS.md](TESTED-SETUPS.md), which remains the curated register for frozen cards.

## Seed inventory

This is a **family-level master**, not a migration of every historical
parameter combination. Exact prior variants remain discoverable through the
research-family routes and tested register. New source concepts are not
backtested merely because a similar-sounding earlier study exists.

| IDs | What is available |
|---|---|
| PA01–PA06 | Range sweep/MSB/retest; named breaker; origin-zone retest; closed-break reclaim; three-tap; sweep/impulse reaction |
| CTX01–CTX03 | Protected external structure; completed Monday range; Power-of-Three context |
| MOD01–MOD04 | HTF-zone/LTF entry; 0.705 OTE; zone/return quality; imbalance confluence |
| TGT01–TGT02 | Directional old-range POC target; target before opposing origin zone |
| EXIT01–EXIT02 | Failed expected reaction; staged liquidity-target exits |
| KN01–KN11 | Existing oscillator, momentum, volume, combination, level, profile, orderflow, cross-asset, construction, exit and regime evidence |

`PA` records are candidate entries. `CTX`/`MOD` need a parent entry.
`TGT`/`EXIT` need an existing setup/position. `KN` records are research routes,
**not executable strategies**. A component cannot silently become a complete
trade by inventing the missing stop or entry.

### Evidence is scoped, not a badge

The source-derived records remain `definitionStatus: concept`. PA03/PA06 now
link scoped PA07 implementations; the others have source-only or adjacent
evidence. `KN` records are `family_index` and
link prior research. Neither status authorizes execution.

Later evidence attaches to a **versioned implementation/study**, including
asset, venue, timeframe, data cutoff, source clocks, execution model, fees,
funding, ownership, baseline, verification and qualification. Keep statuses
separate: described → specified → implemented/causally verified → replayed →
screened → forward observed. A verified replay can fail its profit screen.
Negative results apply to tested definitions, not to every conceivable breaker,
RSI rule or future market. A profitable HYPE result is not an ETH/BTC result.

When a direct child study is added, its index reference must carry `scope`:
definition version, asset/venue/timeframe, UTC-ms window, frozen card,
verification receipt, execution model, own baseline and screen verdict.
The validator rejects unscoped direct evidence. `scoped_studies` means such
references exist, **not** that they passed. The concept remains a concept;
the runnable implementation and its exact version live in the linked card.

## Agent workflow

1. Search this index. Load only the selected card, its dependency definitions
   and relevant existing findings. The saved PDF notes are the next stop;
   reopen/render original pages only for unresolved interpretation.
2. Check exact prior coverage and distinguish **same mechanism**, **adjacent
   control**, and **different mechanism**. Preserve negative results and known
   causality repairs. Do not rerun an unchanged accepted job to read it.
3. Fill the [implementation contract](setup-library/CARD-TEMPLATE.md). Every
   unresolved choice must be frozen or explicitly out of scope. Literature
   phrases such as “impulsive”, “clear”, “strong” and “quickly” are not code.
4. Create the reusable causal feature/event tape, save it by hash, and inspect
   chronological accepted **and rejected** examples without future outcomes.
5. Run standalone trades and simpler controls first. Report baseline-adjacent
   W/L dollars, average loss, net including open inventory, DD, expectancy/R,
   months, costs, concentration and missed opportunities. Win rate alone is
   insufficient: frequent small wins can be dominated by rare large losses.
6. Only afterward evaluate combinations, BTC→other-asset context, or ladder
   integration. Those change occupancy/capital and need their own controls.
7. Attach exact study references/results to the record, retaining the old
   definition/version. Never overwrite the source description with a tuned rule.

For a multi-asset study, venue/contract, tick/lot size, sessions, complete
warm-up, fees/funding, liquidity and data arrival are explicit inputs. Use
price-relative/volatility-normalized *proposed* features where appropriate,
not HYPE-specific dollar thresholds disguised as universal rules. No asset
availability is assumed; audit each tape before declaring its test window.

## Add new knowledge without creating another pile of notes

- Assign a stable ID and decide whether it is an entry, context, modifier,
  target, exit, or research route. Reuse an existing ID for another source
  describing the same concept; record disagreements rather than averaging them.
- Add a concise card section and index metadata/source pages. Add new PDF
  identity to the source catalogue; raw PDFs/renders remain local.
- Describe the **observable sequence**, not presumed bank intent. Preserve
  source rules, proposed conventions and unknowns separately.
- Link exact implementations and child studies instead of broad “proven” or
  “dead” labels. Per-study evidence must identify whether it is direct or adjacent.
- Run `validate`; review the diff; preserve curated text/indices in Git.
  Do not commit raw feeds, credentials, state, bulk PDFs or generated atlases.

Latest implementation: [PA07 source-library setups](codex-astra-price-action-setups-findings-2026-09-18.md).
Only the specified sweep/impulse and confirmed-origin-return adaptations were
tested;0/8 upgrades. Saved event tape is reusable across future tests. Full
library coverage is not claimed; PA01/02/04/05 remain separate checkpoints.

Newest source: [Skyline starter-guide review](skyline-starter-source-review-2026-09-18.md).
Its suggestions strengthen the catalogue's risk/exit questions; they do not
establish an edge. No economic trials or live behavior changed while building
this library; subsequent PA07 advances the tested register to9,338 standalone
definitions /205 overlays, without changing live behavior.
