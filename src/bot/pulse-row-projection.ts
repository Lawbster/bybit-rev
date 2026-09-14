/** Retained fields consumed by computeOnChainFeatures/buildScoreFeatures.
 * No time pruning, timestamp conversion, reordering or cross-reader cache sharing.
 */
export function projectPulseRow(filename: string, row: any, ts: number): any {
  let fields: string[];
  if (filename.includes("_ob_bands_")) fields = ["timestamp", "writtenAt", "receivedAt", "exchangeTimestamp", "imbalance_0_5", "imbalance_2_0", "bestBidAskAreAggregated"];
  else if (filename.includes("_asset_ctx_")) fields = ["timestamp", "receivedAt", "openInterestValue", "openInterest", "markPrice", "fundingRate"];
  else if (filename.includes("_taker_")) fields = ["buyVol", "sellVol", "buyNotional", "sellNotional"];
  else if (filename.includes("_oi_live")) fields = ["openInterestValue"];
  else if (filename.includes("_funding_live")) fields = ["fundingRate"];
  else if (filename.endsWith("_liquidations.jsonl")) fields = ["liquidatedSide", "notionalUsd"];
  else if (filename === "BTCUSDT_1m.jsonl") fields = ["o", "c", "close"];
  else return { ...row, ts }; // unknown consumers must not silently lose fields
  const out: any = { ts };
  for (const key of fields) if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  if (filename.includes("_ob_bands_")) {
    for (const key of ["bidBands", "askBands", "bidBandsTruncated", "askBandsTruncated", "bandResolutionTooCoarse"]) {
      if (row[key] == null || typeof row[key] !== "object") { out[key] = row[key]; continue; }
      out[key] = {};
      for (const band of ["pct_0_25", "pct_0_5", "pct_2_0"]) {
        if (Object.prototype.hasOwnProperty.call(row[key], band)) out[key][band] = row[key][band];
      }
    }
  }
  return out;
}
