# Supplied price-action library: source index

September 18, 2026. **20 PDFs, 492 physical pages; not 20 independent methods.**
The original pass covered S29. The first expansion added 18 files / 445 pages,
many of which reproduce the same lessons. STC18 adds a separate author's
18-page starter guide; the prior expanded plan retains its historical scope.

Start with the asset-neutral [trade setup master](TRADE-SETUP-LIBRARY.md)
for retrieval. Use the [expanded plan](codex-astra-rektproof-expanded-plan-2026-09-18.md)
for the earlier proposed research sequence and the [direct-lesson note](rektproof-direct-lessons-review-2026-09-18.md)
for detailed extraction. The [machine-readable catalogue](../research-inputs/rektproof-corpus-catalog-2026-09-18.json)
pins every PDF's SHA256, page count, extraction cache and review coverage.
Page references throughout are **one-based PDF pages**, not printed page numbers.

## Sources and overlap

| ID | File | Pages | Role / overlap |
|---|---|---:|---|
| S29 | [538000244-RektProof-Setups.pdf](filedump/538000244-RektProof-Setups.pdf) | 29 | Original setups/notes; preserved first-pass analysis |
| S20 | [554885982-RektProof-Setups.pdf](filedump/554885982-RektProof-Setups.pdf) | 20 | Reflowed version of the same setups, examples and self-reported hit-rate image; not a second track record |
| P4 | [554885980-Rektproof-Process.pdf](filedump/554885980-Rektproof-Process.pdf) | 4 | Short process summary; useful wick-boundary/POC-target hints, looser terminology than lessons |
| E43 | [586517116-Rektproof-Education.pdf](filedump/586517116-Rektproof-Education.pdf) | 43 | Compact English lessons 1–11; main cross-lesson reference |
| E85 | [724900163-Rektproof-Education.pdf](filedump/724900163-Rektproof-Education.pdf) | 85 | English/Chinese parallel compilation of lessons 1–11 |
| ZH64 | [679274203-Rektproof-Education-Zh-NoLimit.pdf](filedump/679274203-Rektproof-Education-Zh-NoLimit.pdf) | 64 | Chinese compilation of lessons 1–11 |
| TR51 | [696937102-Rektproof-price-Action-Notes-1-6-Turkce.pdf](filedump/696937102-Rektproof-price-Action-Notes-1-6-Turkce.pdf) | 51 | Turkish lessons 1–6, marked automated translation |
| D1a | [616779946-RektProof-PA-1-Orderblocks.pdf](filedump/616779946-RektProof-PA-1-Orderblocks.pdf) | 10 | Direct orderblock lesson |
| D1b | [761430175-RektProof-PA-Lesson-1.pdf](filedump/761430175-RektProof-PA-Lesson-1.pdf) | 8 | Alternate layout of lesson 1 |
| D3 | [616780096-RektProof-PA-3-Breaker.pdf](filedump/616780096-RektProof-PA-3-Breaker.pdf) | 11 | Failed-orderblock concept and examples |
| D5 | [616780137-RektProof-PA-5-LGs.pdf](filedump/616780137-RektProof-PA-5-LGs.pdf) | 9 | Expansion/inefficiency lesson, not a precise three-candle formula |
| D6 | [761430600-RektProof-PA-Lesson-6.pdf](filedump/761430600-RektProof-PA-Lesson-6.pdf) | 9 | Specific breaker sequence, stricter than generic failed-zone definition |
| D7 | [761430596-RektProof-PA-Lesson-7.pdf](filedump/761430596-RektProof-PA-Lesson-7.pdf) | 6 | Range / closing-basis MSB strategy |
| D9 | [761430263-RektProof-PA-Lesson-9.pdf](filedump/761430263-RektProof-PA-Lesson-9.pdf) | 7 | Completed Monday range as context |
| D10 | [761430261-RektProof-PA-Lesson-10.pdf](filedump/761430261-RektProof-PA-Lesson-10.pdf) | 9 | Daily TPO profiles, naked POC and range context |
| D11 | [761430265-RektProof-PA-Lesson-11.pdf](filedump/761430265-RektProof-PA-Lesson-11.pdf) | 7 | Power of Three as confluence, not standalone entry |
| MS21 | [607159167-Market-Structure-Basic.pdf](filedump/607159167-Market-Structure-Basic.pdf) | 21 | Structure diagrams; credits LotusXBT/RektProof, community compilation |
| PA29 | [719945563-Price-Action-Trading-in-Crypto-Markets.pdf](filedump/719945563-Price-Action-Trading-in-Crypto-Markets.pdf) | 29 | LotusXBT-linked compilation crediting ICT, RektProof and Phantom; distinct preferences, not all RektProof rules |
| SD52 | [754059208-Market-Structure-Masterclass-Supply-Demand.pdf](filedump/754059208-Market-Structure-Masterclass-Supply-Demand.pdf) | 52 | Pat x Ritesh; OB quality, failed-zone control and wick-gap examples; bonus section credits RektProof |
| STC18 | [637656759-Untitled.pdf](filedump/637656759-Untitled.pdf) | 18 | Skyline Traders Club, Trade Entries Starter Guide; liquidity and full-candle OBs. Complete-guide chapters advertised on p16 are not supplied |

## Coverage, not just extraction

- All files hashed and all embedded page text extracted once. Saved under
  `backtests/document-review/<PDF-sha256>/pages.json`.
- The preserved `corpus-e52862db84636e0521d65a138877fd3b84e30691b05bb52585987f1680a95d7b/manifest.json`
  covers the original 19 files only. STC18's separate per-file cache is pinned
  in the catalogue; it is not an entry in that historical extraction manifest.
- STC18: full cached text read; main agent inspected pp1,6–9,11–15 visually
  using contact sheets. [Source review](skyline-starter-source-review-2026-09-18.md)
  separates optional OB quality factors, staged liquidity targets, discretionary
  slow-response management and author risk suggestions from executable rules.
- S29: all text/pages/diagrams reviewed in the first pass.
- Nine direct lessons: all text across 76 pages; 32 selected rendered pages
  inspected. Exact pages and source rules are in the direct-lesson note.
- E43: all lesson text, pages 3–43. Corresponding direct-file diagrams support
  interpretation; this is not a claim that all E43 diagrams were viewed.
- P4, S20, MS21, PA29 and SD52: full extracted/decoded text read; respectively
  4, 4, 4, 7 and 8 selected page renders inspected. Exact pages in the catalogue.
- E85, ZH64 and TR51: targeted chapter/definition/translation comparisons;
  six selected page renders. **Not full independent visual reviews.**
- P4/S20's raw extraction is font-encoded. A +29 character-code decoding of
  the affected text was checked against rendered pages; raw caches preserved.
- PA29 p29 points to an external Notion trading plan. It was not retrieved;
  no rules from that unavailable linked plan are claimed here.

## Conflicts and transcription cautions

1. **Different authors, different rules.** PA29 p6 suggests longs in discount /
   shorts in premium. E43 pp16–17 also uses location above/below EQ to describe
   directional travel. These are different uses of EQ, not a universal signal.
2. **Generic breaker versus named strategy.** SD52 p24 calls a further structure
   change strengthening confluence; D6 pp4–5 requires a new structural high
   before its bullish entry. Keep both definitions labelled; don't merge them.
3. **Sweeps are not all MSBs.** P4 pp2,4 uses shorthand conflating them. D7 p4
   separately requires the internal swing break on a closing basis. Use the
   precise lesson sequence for the primary range model.
4. **Bullish stop/target copy errors** occur in direct lesson 1: prose says
   stop above demand / target untapped low while charts show the opposite.
   SD52 p11 also says an upward impulse for its bearish recap. Preserve the
   coherent directional setup, record the correction, reject invalid brackets.
5. PA29 p10 says range supply breaks upward; its diagram shows a downward
   break. Again, a transcription problem, not a bullish supply rule.
6. Monday materials reverse some buy/sell-stop labels. Several translations
   distort the LTF-sweep instruction, week limit or time-versus-volume POC
   definition. Prefer direct English plus diagrams; see the lesson addendum.
7. No reviewed section establishes a universal immediate-next-candle
   engagement condition for every orderblock. Do not invent that attribution.

Claims about institutional intent, compulsory gap fills, higher-timeframe
reliability or the author's win rates are hypotheses/anecdotes, not verified
performance evidence. The corpus supplies candidate mechanisms, not an edge
estimate. Repeated translations do not increase the sample size.
