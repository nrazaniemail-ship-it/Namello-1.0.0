#!/usr/bin/env node
/*
 * Namello – deterministic web build (npm run build).
 *
 * The app is a single-file runtime (all code is inline in index.html, libraries come from CDNs), so
 * there is no module graph for a bundler to process. Copying the files verbatim is faster, cannot
 * rewrite the 1.5 MB inline script or the manifest links, and produces exactly what the GitHub-Pages
 * root deployment serves. (`npm run build:vite` keeps the Vite pipeline available for the TypeScript
 * migration.)  Output: dist/  (Capacitor webDir)
 */
import { cp, mkdir, rm, readFile, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const { version, versionCode } = JSON.parse(await readFile("version.json", "utf8"));
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

// everything in public/ (icons, manifests, sw.js, widget.html, native-bridge.js …) except dev-only extracts
for (const entry of await readdir("public")) {
  if (entry === "index_scripts") continue;
  await cp(`public/${entry}`, `dist/${entry}`, { recursive: true });
}
await cp("index.html", "dist/index.html");
await cp("version.json", "dist/version.json");

const required = ["index.html", "sw.js", "native-bridge.js", "manifest.json", "widget.html", "icon-192.png", "icon-512.png",
  "icon-dashboard-logo.png", "icon-sessions.png", "icon-journal.png", "icon-mt5.jpg", "icon-tradingview.png",
  ...["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map((d) => `icon-day-${d}.jpg`)];
for (const f of required) {
  if (!existsSync(`dist/${f}`) || (await stat(`dist/${f}`)).size === 0) throw new Error(`dist/${f} is missing or empty`);
}
const html = await readFile("dist/index.html", "utf8");
if (!html.includes(`<title>Namello ${version}</title>`)) throw new Error("dist/index.html title does not match version.json");
if (!html.includes("./native-bridge.js")) throw new Error("dist/index.html does not load native-bridge.js");
console.log(`Web build OK: Namello ${version} (versionCode ${versionCode}) -> dist/`);
