/** Public read-only REST, independently bounded across headers AND body reads. */
export async function fetchCollectorRepair(symbol: string, interval: "1" | "5", start: number, end: number,
  fetcher: typeof fetch = fetch, timeoutMs = 10_000): Promise<unknown> {
  if (!/^[A-Z0-9]{2,30}$/.test(symbol) || !["1", "5"].includes(interval)
    || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new Error("invalid candle repair request");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const params = new URLSearchParams({ category: "linear", symbol, interval,
      start: String(start), end: String(end), limit: "1000" });
    const response = await fetcher(`https://api.bybit.com/v5/market/kline?${params}`, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`repair HTTP ${response.status}`);
    reader = response.body.getReader();
    const chunks: Buffer[] = []; let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 2 * 1024 * 1024) throw new Error("repair response exceeds 2 MiB");
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
    controller.abort(); // also release rejected/oversized response connections
    if (reader) { try { await reader.cancel(); } catch { /* already aborted */ } }
  }
}
