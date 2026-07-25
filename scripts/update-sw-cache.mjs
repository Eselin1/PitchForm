import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const swPath = resolve("public/sw.js");
const source = readFileSync(swPath, "utf8");
const version = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const nextSource = source.replace(/const CACHE_NAME = "pitchform-v\d+";/, `const CACHE_NAME = "pitchform-v${version}";`);

if (nextSource === source) {
  throw new Error("Could not update the service worker cache name.");
}

writeFileSync(swPath, nextSource);
