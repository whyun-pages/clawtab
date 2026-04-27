import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const outdir = path.join(rootDir, "dist");

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp(path.join(rootDir, "public"), outdir, { recursive: true });
await copyFile(path.join(rootDir, "src/popup/styles.css"), path.join(outdir, "styles.css"));

const ctx = await esbuild.context({
  entryPoints: {
    background: path.join(rootDir, "src/background/index.ts"),
    content: path.join(rootDir, "src/content/index.ts"),
    popup: path.join(rootDir, "src/popup/index.ts")
  },
  bundle: true,
  format: "esm",
  target: "chrome114",
  outdir,
  sourcemap: true,
  logLevel: "info"
});

if (watch) {
  await ctx.watch();
  console.log("Watching extension sources...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
