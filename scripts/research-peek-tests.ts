import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { gzipSync } from "zlib";
import { inspectResearchJson } from "./research-peek";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "research-peek-"));
for (const dir of ["research-inputs", "backtests", "docs/research"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
const write = (relative: string, value: string | Buffer) => fs.writeFileSync(path.join(root, relative), value);
const throws = (fn: () => unknown, text: string) => assert.throws(fn, new RegExp(text));

try {
  const json = '{"passed":true,"stats":{"net":42},"a/b":{"~key":[1,2,3]},"many":[0,1,2],"01":"object key","__proto__":"own"}';
  write("research-inputs/sample.json", json);
  write("backtests/sample.json.gz", gzipSync(json));
  const original = fs.readFileSync(path.join(root, "research-inputs/sample.json"));

  const basic = inspectResearchJson(root, "research-inputs/sample.json");
  assert.match(basic, /inspection only; no integrity\/economic verification performed/);
  assert.match(basic, /"type": "object"/);
  assert.match(basic, /"many"/);
  assert.match(inspectResearchJson(root, "backtests/sample.json.gz", ["/passed", "/stats/net"]), /"value": true/);
  const escaped = inspectResearchJson(root, "research-inputs/sample.json", ["/a~1b/~0key", "/many"]);
  assert.match(escaped, /"length": 3/);
  assert.match(inspectResearchJson(root, "research-inputs/sample.json", ["/many/0", "/01", "/__proto__"]), /object key/);
  throws(() => inspectResearchJson(root, "research-inputs/sample.json", ["/none"]), "pointer not found");
  throws(() => inspectResearchJson(root, "research-inputs/sample.json", ["/toString"]), "pointer not found");
  for (const invalidArrayPointer of ["/many/length", "/many/01", "/many/-"]) {
    throws(() => inspectResearchJson(root, "research-inputs/sample.json", [invalidArrayPointer]), "pointer not found");
  }
  throws(() => inspectResearchJson(root, "research-inputs/sample.json", ["/a~2b"]), "pointer escape");
  throws(() => inspectResearchJson(root, "../research-inputs/sample.json"), "escapes workspace");
  throws(() => inspectResearchJson(root, "package.json"), "approved research roots");
  fs.mkdirSync(path.join(root, "private"));
  write("private/secret.json", "{\"secret\":true}");
  fs.symlinkSync(path.join(root, "private"), path.join(root, "research-inputs", "linked-private"), "junction");
  throws(() => inspectResearchJson(root, "research-inputs/linked-private/secret.json"), "approved research root");
  fs.rmSync(path.join(root, "docs", "research"), { recursive: true, force: true });
  fs.symlinkSync(path.join(root, "private"), path.join(root, "docs", "research"), "junction");
  throws(() => inspectResearchJson(root, "docs/research/secret.json"), "root is redirected");
  fs.rmSync(path.join(root, "docs"), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, "private", "research"));
  write("private/research/secret.json", "{}");
  fs.symlinkSync(path.join(root, "private"), path.join(root, "docs"), "junction");
  throws(() => inspectResearchJson(root, "docs/research/secret.json"), "root is redirected");
  write("research-inputs/bad.json", "{");
  throws(() => inspectResearchJson(root, "research-inputs/bad.json"), "invalid JSON");
  write("research-inputs/large.json", " ".repeat(4 * 1024 * 1024 + 1));
  throws(() => inspectResearchJson(root, "research-inputs/large.json"), "4 MiB");
  write("research-inputs/expanded.json.gz", gzipSync(" ".repeat(8 * 1024 * 1024 + 1)));
  throws(() => inspectResearchJson(root, "research-inputs/expanded.json.gz"), "gzip");
  write("research-inputs/output.json", JSON.stringify("x".repeat(13 * 1024)));
  throws(() => inspectResearchJson(root, "research-inputs/output.json", [""]), "12 KiB");
  assert.deepStrictEqual(fs.readFileSync(path.join(root, "research-inputs/sample.json")), original);
  console.log("research-peek tests passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
