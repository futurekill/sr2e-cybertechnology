#!/usr/bin/env node
/**
 * Wire compendium art for this content module.
 *
 *   npm run art            # report what would change
 *   npm run art -- --fix   # write it into packs-src
 *
 * TWO conventions, picked by document type — they are not interchangeable:
 *
 *   vehicles        1024x1024 WebP, TRANSPARENT background, strict top-down with
 *                   the nose pointing up. Used as both portrait and token texture,
 *                   with lockRotation FALSE so the token swings to face travel.
 *                   Lives in assets/vehicle_portraits/.
 *
 *   everything else 256x256 WebP, OPAQUE dark background — an item icon for a
 *                   list row, not a map token. Portrait only; no token fields are
 *                   touched. Lives in assets/item_icons/<type>/.
 *
 * Name → kebab slug, so there is no per-item table to maintain. Items whose art
 * has not been generated yet are reported and skipped, so this is safe to re-run
 * while batches are still rendering, and it never overwrites art already chosen.
 *
 * The module id is read from module.json, so this file can be copied to a sibling
 * content module unchanged.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const FIX = process.argv.includes("--fix");
const SRC = "packs-src";
const MODULE_ID = JSON.parse(readFileSync("module.json", "utf8")).id;

const slugify = (name) => name
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const wired = [], missing = [], already = [];

for (const pack of readdirSync(SRC)) {
  let files;
  try { files = readdirSync(join(SRC, pack)); } catch { continue; }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const path = join(SRC, pack, file);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    if (!doc.system) continue;                         // folder entry

    if ((doc.img ?? "").includes("/assets/")) { already.push(doc.name); continue; }

    const isVehicle = doc.type === "vehicle";
    const rel = isVehicle
      ? `assets/vehicle_portraits/${slugify(doc.name)}.webp`
      : `assets/item_icons/${doc.type}/${slugify(doc.name)}.webp`;

    if (!existsSync(rel)) { missing.push({ name: doc.name, rel, type: doc.type }); continue; }

    const img = `modules/${MODULE_ID}/${rel}`;
    doc.img = img;
    if (isVehicle) {
      const pt = doc.prototypeToken ??= {};
      pt.texture ??= {};
      pt.texture.src = img;
      pt.lockRotation = false;      // a vehicle faces where it drives
    }
    wired.push({ name: doc.name, type: doc.type });
    if (FIX) writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  }
}

const pad = (s, n) => String(s).padEnd(n);
if (wired.length) {
  console.log(`${FIX ? "WIRED" : "WOULD WIRE"} ${wired.length} document(s):\n`);
  for (const w of wired) console.log(`  ${pad(w.type, 14)}${w.name}`);
} else {
  console.log("Nothing to wire — every document either has art or is missing its file.");
}
if (missing.length) {
  const byType = {};
  for (const m of missing) (byType[m.type] ??= []).push(m.name);
  console.log(`\nArt not generated yet (${missing.length}):`);
  for (const [t, names] of Object.entries(byType)) {
    console.log(`  ${pad(t, 14)}${names.length}  ${names.slice(0, 5).join(", ")}${names.length > 5 ? " …" : ""}`);
  }
}
if (already.length) console.log(`\nAlready had art, left alone (${already.length}).`);
if (!FIX && wired.length) console.log("\nRe-run with --fix to write.");
