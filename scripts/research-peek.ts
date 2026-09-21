import * as fs from "fs";
import * as path from "path";
import { gunzipSync } from "zlib";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_DECODED_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 12 * 1024;
const ALLOWED_ROOTS = new Set(["research-inputs", "backtests", "docs/research"]);
const NOTE = "inspection only; no integrity/economic verification performed";

export type PeekResult = { input: string; result: unknown | Array<{ pointer: string; value: unknown }> };

function fail(message: string): never { throw new Error(message); }
function inside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!path.isAbsolute(relative) && !relative.startsWith(".." + path.sep) && relative !== "..");
}

function safeFile(root: string, supplied: string): { file: string; display: string } {
  if (!supplied || path.isAbsolute(supplied)) fail("input path must be a repo-relative path");
  const normalized = path.normalize(supplied);
  if (normalized === ".." || normalized.startsWith(".." + path.sep)) fail("input path escapes workspace");
  const segments = normalized.split(path.sep);
  const allowed = segments[0] === "docs" && segments[1] === "research" ? "docs/research" : segments[0];
  if (!ALLOWED_ROOTS.has(allowed)) fail("input path is outside approved research roots");
  if (!/\.json(?:\.gz)?$/i.test(normalized)) fail("input must end in .json or .json.gz");
  const rootReal = fs.realpathSync(root);
  const file = path.resolve(rootReal, normalized);
  if (!inside(file, rootReal)) fail("input path escapes workspace");
  const allowedPath = path.join(rootReal, allowed);
  // Approved roots themselves must be real directories, never redirected links.
  let current = rootReal;
  for (const segment of allowed.split(/[\\/]/)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) fail("approved research root is redirected");
  }
  const allowedReal = fs.realpathSync(allowedPath);
  if (!inside(allowedReal, rootReal)) fail("approved research root escapes workspace");
  const fileReal = fs.realpathSync(file);
  if (!inside(fileReal, rootReal) || !inside(fileReal, allowedReal)) fail("input path escapes approved research root");
  const stat = fs.statSync(fileReal);
  if (!stat.isFile()) fail("input must be a file");
  if (stat.size > MAX_INPUT_BYTES) fail("input exceeds 4 MiB limit");
  return { file: fileReal, display: normalized.replace(/\\/g, "/") };
}

function decode(file: string): string {
  const raw = fs.readFileSync(file);
  if (raw.length > MAX_INPUT_BYTES) fail("input exceeds 4 MiB limit");
  let decoded = raw;
  if (file.toLowerCase().endsWith(".gz")) {
    try { decoded = gunzipSync(raw, { maxOutputLength: MAX_DECODED_BYTES }); }
    catch { fail("invalid gzip or decoded content exceeds 8 MiB limit"); }
  }
  if (decoded.length > MAX_DECODED_BYTES) fail("decoded content exceeds 8 MiB limit");
  return decoded.toString("utf8");
}

function describe(value: unknown): unknown {
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return { type: "object", keys: keys.slice(0, 20), keyCount: keys.length, keysTruncated: keys.length > 20 };
  }
  return value;
}

function pointerValue(root: unknown, pointer: string): unknown {
  if (pointer === "") return root;
  if (!pointer.startsWith("/")) fail(`invalid JSON pointer: ${pointer}`);
  const tokens = pointer.slice(1).split("/").map(token => {
    if (/~(?:[^01]|$)/.test(token)) fail(`invalid JSON pointer escape: ${pointer}`);
    return token.replace(/~1/g, "/").replace(/~0/g, "~");
  });
  let current: unknown = root;
  for (const token of tokens) {
    if (current === null || (typeof current !== "object" && !Array.isArray(current))) fail(`pointer not found: ${pointer}`);
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/.test(token)) fail(`pointer not found: ${pointer}`);
      const index = Number(token);
      if (!Number.isSafeInteger(index) || index >= current.length) fail(`pointer not found: ${pointer}`);
      current = current[index];
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(current, token)) fail(`pointer not found: ${pointer}`);
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

/** Read-only inspection of a JSON research artifact rooted at `workspaceRoot`. */
export function inspectResearchJson(workspaceRoot: string, input: string, pointers: string[] = []): string {
  const { file, display } = safeFile(workspaceRoot, input);
  let parsed: unknown;
  try { parsed = JSON.parse(decode(file)); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("invalid gzip")) throw error;
    fail("invalid JSON");
  }
  const result: PeekResult = {
    input: display,
    result: pointers.length === 0 ? describe(parsed) : pointers.map(pointer => ({ pointer, value: describe(pointerValue(parsed, pointer)) })),
  };
  const output = `${NOTE}\n${JSON.stringify(result, null, 2)}\n`;
  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) fail("inspection output exceeds 12 KiB limit");
  return output;
}

if (require.main === module) {
  try {
    const [, , input, ...pointers] = process.argv;
    if (!input) fail("usage: ts-node scripts/research-peek.ts <path.json|path.json.gz> [JSON-pointer ...]");
    process.stdout.write(inspectResearchJson(process.cwd(), input, pointers));
  } catch (error) {
    process.stderr.write(`research-peek: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
