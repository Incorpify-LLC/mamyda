// Nitro bundles PGlite JS but does not emit the WASM/data files it loads beside it.
// Include these in the server artifact so built-output QA works without a remote DB.
import { copyFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const source = dirname(fileURLToPath(import.meta.resolve("@electric-sql/pglite")));
const destination = ".vercel/output/functions/__server.func/_libs";
await access(join(destination, "electric-sql__pglite.mjs"));
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  await copyFile(join(source, name), join(destination, name));
}
console.log("[build] Included PGlite runtime assets");
