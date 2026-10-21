// Build the item-icon generation list, one icon per FAMILY (level variants share art),
// and copy family icons onto every member: node tools/art-families.mjs list|copy
import { readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";

const slugify = (n) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Name → family name (the variant's level/rating stripped).
const family = (n) => n
  .replace(/\s*\+\d+$/, "").replace(/\s*\((Level|Rating) [IVX\d]+\)$/, "").replace(/, Level \d+\)$/, ")")
  .replace(/^(Boosted Reflexes) \d$/, "$1").replace(/^Commlink (II|IV|VIII|X)$/, "Commlink")
  .replace(/^(Vision Magnification) \((Optical|Electronic) \d\)$/, "$1 ($2)").replace(/^(Semi-natural Covering) \(.*\)$/, "$1")
  .replace(/^(BrightLight One-Shot Batter(y|ies) and Bulbs?).*$/, "BrightLight One-Shot Battery and Bulb");

const docs = [];
for (const pack of readdirSync("packs-src")) {
  if (pack === "ct-chrome-kings") continue;
  for (const f of readdirSync(`packs-src/${pack}`).filter(f => f.endsWith(".json"))) docs.push(JSON.parse(readFileSync(`packs-src/${pack}/${f}`, "utf8")));
}
const fams = new Map();
for (const d of docs) {
  const fam = family(d.name), key = `${d.type}|${fam}`;
  if (!fams.has(key)) fams.set(key, { type: d.type, fam, members: [], notes: d.system.notes ?? "" });
  fams.get(key).members.push(d);
}
const famPath = (f) => `assets/item_icons/${f.type}/${slugify(f.fam)}.webp`;
const looks = (f) => {
  const what = f.type === "weapon" ? "a cyberware implant weapon" : f.type === "gear" ? "a piece of gear or consumable" : "a cyberware implant (shown as the device itself, clinical chrome and circuitry)";
  const hint = f.notes.replace(/\(Cybertechnology[^)]*\)\.?/g, "").replace(/Ruling:.*$/, "").split(/(?<=\.)\s/)[0].slice(0, 160);
  return `${f.fam}: ${what}${hint ? ` — ${hint}` : ""}`;
};
const mode = process.argv[2];
if (mode === "list") {
  const rows = [...fams.values()].filter(f => !existsSync(famPath(f))).map(f => `${famPath(f)}\t${looks(f)}`);
  writeFileSync("_work/icons.tsv", rows.join("\n") + "\n");
  console.log(`${fams.size} families (${docs.length} items); ${rows.length} still to generate → _work/icons.tsv`);
} else if (mode === "copy") {
  let n = 0;
  for (const f of fams.values()) {
    if (!existsSync(famPath(f))) continue;
    for (const d of f.members) {
      const p = `assets/item_icons/${d.type}/${slugify(d.name)}.webp`;
      if (p !== famPath(f) && !existsSync(p)) { mkdirSync(p.replace(/\/[^/]+$/, ""), { recursive: true }); copyFileSync(famPath(f), p); n++; }
    }
  }
  console.log(`copied the family icon to ${n} variant(s)`);
}
