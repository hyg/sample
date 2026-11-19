import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dist = join(root, "dist");
const staticFiles = ["index.html", "app.js", "styles.css", "favicon.svg"];

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "edge-functions", "api"), { recursive: true });

for (const file of staticFiles) {
  await cp(join(root, "public", file), join(dist, file));
}
await cp(join(root, "edgeone.json"), join(dist, "edgeone.json"));

await build({
  entryPoints: [join(root, "src", "edgeone.js")],
  outfile: join(dist, "edge-functions", "api", "[[default]].js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  sourcemap: false,
  minify: false,
  logLevel: "info"
});

JSON.parse(await readFile(join(dist, "edgeone.json"), "utf8"));
console.log("EdgeOne build ready: dist/");
