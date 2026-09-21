import path from "path";
import { generateEventAtlas, loadEventAtlasManifest, resolveAtlasEvents } from "../src/research/event-atlas";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.slice(2).find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const manifestPath = argValue("manifest");
  if (!manifestPath) {
    throw new Error("Usage: npm run event-atlas -- --manifest research-inputs/event-atlas/<manifest>.json [--output <dir>] [--validate-only]");
  }
  const root = process.cwd();
  const manifest = loadEventAtlasManifest(manifestPath, root);
  const events = resolveAtlasEvents(manifest);
  if (process.argv.includes("--validate-only")) {
    console.log(JSON.stringify({
      valid: true,
      manifest: path.resolve(root, manifestPath),
      id: manifest.id,
      symbol: manifest.symbol,
      events: events.map(event => ({ id: event.id, inputAt: event.inputAt, utc: new Date(event.timestamp).toISOString() })),
    }, null, 2));
    return;
  }

  const generated = await generateEventAtlas(manifestPath, root, argValue("output"));
  console.log(JSON.stringify({
    generated: true,
    outputDir: generated.outputDir,
    index: path.join(generated.outputDir, "index.html"),
    events: generated.events.length,
    neighbours: generated.neighbours.length,
    integrity: generated.integrity,
  }, null, 2));
}

main().catch(error => {
  console.error(`[event-atlas] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
