// Generate the Chrome Kings (Cybertechnology p.86–92) as npc actors from
// data/chrome-kings.json (values exactly as printed, read twice). NPCs don't derive
// stats from embedded items (except equipped armor), so the printed values go on the
// authored fields; embedded ware and gear are copies for reference, and anything with
// no compendium entry is listed in the biography. Copies keep _stats.compendiumSource.
// Run after gen-items.mjs (it embeds this module's generated items).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

const DATA = JSON.parse(readFileSync("data/chrome-kings.json", "utf8"));
const IDS = JSON.parse(readFileSync("data/ids.json", "utf8"));
const idFor = (key) => (IDS[key] ??= randomBytes(8).toString("hex"));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// This module's items by capture key.
const OWN = new Map();
for (const pack of readdirSync("packs-src").filter(p => p.startsWith("ct-") && p !== "ct-chrome-kings")) {
  for (const f of readdirSync(`packs-src/${pack}`).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(`packs-src/${pack}/${f}`, "utf8"));
    OWN.set(d._id, { doc: d, uuid: `Compendium.sr2e-cybertechnology.${pack}.Item.${d._id}` });
  }
}
const own = (key) => OWN.get(IDS[key]);

// Gear and bioware from the system and sibling modules, by name (copied in, no dependency).
const SOURCES = [["../sr2e-foundryvtt/packs-src", "sr2e", "Compendium.sr2e"], ["../sr2e-street-samurai-catalog/packs-src", "sr2e-street-samurai-catalog", "Compendium.sr2e-street-samurai-catalog"],
  ["../sr2e-fields-of-fire/packs-src", "sr2e-fields-of-fire", "Compendium.sr2e-fields-of-fire"], ["../sr2e-shadowtech/packs-src", "sr2e-shadowtech", "Compendium.sr2e-shadowtech"],
  ["../sr2e-neo-anarchists/packs-src", "sr2e-neo-anarchists", "Compendium.sr2e-neo-anarchists"]];
const BY_NAME = new Map();
for (const [dir, , prefix] of SOURCES) {
  if (!existsSync(dir)) continue;
  for (const pack of readdirSync(dir)) {
    if (!existsSync(`${dir}/${pack}`) || pack.startsWith(".")) continue;
    let files = [];
    try { files = readdirSync(`${dir}/${pack}`).filter(f => f.endsWith(".json")); } catch { continue; }
    for (const f of files) {
      let d; try { d = JSON.parse(readFileSync(`${dir}/${pack}/${f}`, "utf8")); } catch { continue; }
      if (!d.type || !d.system || !["weapon", "armor", "gear", "bioware"].includes(d.type)) continue;
      const k = d.name.toLowerCase();
      if (!BY_NAME.has(k)) BY_NAME.set(k, { doc: d, uuid: `${prefix}.${pack}.Item.${d._id}` });
    }
  }
}
// Printed bioware names → the Shadowtech item and its level.
const bioLookup = (printed) => {
  const m = printed.replace(/\s*\(cultured\)\s*$/i, "").match(/^(.*?)(?:\s*\(?(?:Level\s*)?([IVX\d]+)\)?)?$/i);
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const base = m[1].trim(), lvl = m[2] ? (roman[m[2].toUpperCase()] ?? Number(m[2])) : null;
  return { hit: BY_NAME.get(base.toLowerCase()), level: lvl, cultured: /\(cultured\)/i.test(printed) };
};

// Printed gear names → the compendium entry's name (spelling and generic names differ).
const GEAR_ALIAS = { "Fineblade Knife": "Cougar Fine Blade (Long)", "Barret Model 121": "Barret Model 121 Heavy Sniper Rifle",
  "Morrissey Elan": "Morrissey Élan", "Wallacher Combat Axe": "Combat Axe" };
const ACTIVE = new Set(["armed combat", "athletics", "bike", "biotech", "car", "computer", "demolitions", "electronics", "etiquette",
  "firearms", "gunnery", "interrogation", "leadership", "negotiation", "rotorcraft", "stealth", "throwing", "unarmed combat", "winged planes"]);
const skillCategory = (name) => ACTIVE.has(name.replace(/\s*\(.*$/, "").trim().toLowerCase()) ? "active" : "knowledge";
const STATS = { coreVersion: "13.351", systemId: "sr2e", systemVersion: "0.109.0", createdTime: 1792500000000, modifiedTime: 1792500000000,
  lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null };

function copyOf(entry, key, over = {}) {
  const d = structuredClone(entry.doc);
  delete d._key; d.folder = null; d.sort = 0;
  d._id = idFor(key);
  d._stats = { ...STATS, compendiumSource: entry.uuid };
  for (const [k, v] of Object.entries(over)) foundry_set(d, k, v);
  return d;
}
function foundry_set(obj, path, v) {
  const parts = path.split("."); let o = obj;
  for (const p of parts.slice(0, -1)) o = (o[p] ??= {});
  o[parts.at(-1)] = v;
}
// A container's module rows from this module's accessory items (display on an NPC).
const rowsFrom = (keys = []) => keys.map(k => own(k)).filter(Boolean).map(({ doc }) => ({
  name: doc.name, essenceCost: doc.system.essenceCost, cost: doc.system.cost, rating: 0, combatTnMod: 0, active: true, notes: "" }));

function actor(c) {
  const a = c.attrs, boost = c.boosted ?? {}, owner = `ct:ck/${slug(c.name)}`;
  const val = (k) => boost[k] ?? a[k];
  const attr = (k) => ({ base: a[k], mod: val(k) - a[k], value: val(k), racial: 0 });
  const missing = [];
  const items = [];
  for (const [n, r] of Object.entries(c.skills)) items.push({ _id: idFor(`${owner}/skill/${n}`), name: n, type: "skill", img: "icons/svg/book.svg",
    system: { category: skillCategory(n), rating: r, linkedAttribute: "intelligence", allocated: null, ratingsFinalized: true,
      concentration: { name: "", rating: 0 }, specialization: { name: "", rating: 0 }, description: "" },
    effects: [], flags: {}, _stats: STATS, folder: null, sort: 0, ownership: { default: 0 } });
  for (const [text, key, grade, rating] of c.ware) {
    const e = key && own(key);
    if (!e) { missing.push(text); continue; }
    const over = { "system.grade": grade, "system.installed": true, "system.notes": `${e.doc.system.notes} As printed: ${text}.` };
    if (rating != null) over["system.rating"] = rating;
    if (key === "ct:eye-cyber-replacement") over["system.modules"] = rowsFrom(c.eyes);
    if (key === "ct:ear-cyber-replacement") over["system.modules"] = rowsFrom(c.ears);
    // A printed pair ("Cyberarms (left/right: …)") is two limbs, one per side, so the
    // system's side rules (pairs, mismatch) can see them. The left keeps the line's id.
    if (/^\S+s \((left\/right|right\/left)\b/i.test(text)) {
      items.push(copyOf(e, `${owner}/ware/${text}`, { ...over, "system.side": "left" }));
      items.push(copyOf(e, `${owner}/ware/${text}/right`, { ...over, "system.side": "right" }));
      continue;
    }
    items.push(copyOf(e, `${owner}/ware/${text}`, over));
  }
  for (const b of c.bioware) {
    const { hit, level, cultured } = bioLookup(b);
    if (!hit) { missing.push(b); continue; }
    const over = { "system.installed": true };
    if (level != null) over["system.rating"] = level;
    if (cultured && hit.doc.system.bodySystem !== "neural") over["system.grade"] = "cultured";
    items.push(copyOf(hit, `${owner}/bio/${b}`, over));
  }
  const gearFound = [];
  for (const g of c.gearItems) {
    const hit = BY_NAME.get((GEAR_ALIAS[g] ?? g).toLowerCase());
    if (!hit) { missing.push(g); continue; }
    items.push(copyOf(hit, `${owner}/gear/${g}`, hit.doc.type === "armor" ? { "system.equipped": true } : {}));
    gearFound.push(g);
  }
  // Intrinsic armor from the embedded ware (dermal sheath/plating, Orthoskin, bone
  // lacing…): NPC preparation adds only equipped worn armor, so it's authored here.
  const intrinsic = { ballistic: 0, impact: 0 };
  for (const it of items) {
    if (!["cyberware", "bioware"].includes(it.type)) continue;
    const row = (it.system.ratingStats ?? []).find(r => r.rating === it.system.rating);
    intrinsic.ballistic += row?.armorBallistic ?? it.system.armorBallistic ?? 0;
    intrinsic.impact += row?.armorImpact ?? it.system.armorImpact ?? 0;
  }
  if (c.armor) { intrinsic.ballistic = c.armor.ballistic; intrinsic.impact = c.armor.impact; }
  const negative = a.essence < 0;
  const list = (label, arr) => arr?.length ? `<p><strong>${label}:</strong> ${esc(arr.join("; "))}</p>` : "";
  const bio = [
    `<p>${esc(c.blurb)}</p>`,
    Object.keys(boost).length ? `<p><strong>Augmented (applied):</strong> ${esc(Object.entries(boost).map(([k, v]) => `${k} ${a[k]} (${v})`).join(", "))}.</p>` : "",
    `<p><strong>Initiative (printed):</strong> ${esc(c.initiative.printed)}</p>`,
    negative ? `<p><strong>Essence ${a.essence} (printed).</strong> Cybermantic: the sheet can't hold negative Essence yet and shows 0 (Cybermancy rules, p.78–84).</p>` : "",
    c.allGrade ? `<p><strong>Cyberware:</strong> all ${c.allGrade} grade.</p>` : "",
    list("Bioware", c.bioware), list("Cyberware", c.ware.map(w => w[0])), list("Gear", c.gear),
    c.armor ? `<p><strong>Armor:</strong> ${esc(c.armor.note)}</p>` : "",
    c.note ? `<p><strong>Note:</strong> ${esc(c.note)}</p>` : "",
    missing.length ? `<p><strong>Not in any compendium</strong> (listed here only): ${esc(missing.join("; "))}.</p>` : "",
    `<p><strong>Threat/Professional Rating:</strong> ${c.tpr}</p>`,
    `<p><em>Cybertechnology (FASA 7119), Chrome Kings p.${c.page}.</em></p>`
  ].filter(Boolean).join("\n");
  const _id = idFor(owner);
  const img = existsSync(`assets/portraits/${slug(c.name)}.webp`) ? `modules/sr2e-cybertechnology/assets/portraits/${slug(c.name)}.webp` : "icons/svg/mystery-man.svg";
  return {
    doc: { _id, name: c.name, type: "npc", img,
      system: { biography: bio, race: "human", professionalRating: Number(c.tpr.split("/")[1]),
        body: attr("body"), quickness: attr("quickness"), strength: attr("strength"), charisma: attr("charisma"),
        intelligence: attr("intelligence"), willpower: attr("willpower"),
        essence: { value: Math.max(0, a.essence), max: 6 },
        reaction: { mod: val("reaction") - Math.floor((val("quickness") + val("intelligence")) / 2) },
        initiative: { base: 0, dice: c.initiative.dice, mod: 0 },
        bodyIndex: { value: c.bodyIndex },
        armor: { ballistic: intrinsic.ballistic, impact: intrinsic.impact } },
      items, effects: [], folder: null, sort: 0, _stats: STATS, ownership: { default: 0 },
      flags: { sr2e: { source: { book: "Cybertechnology", code: "FASA7119", page: c.page }, printed: { essence: a.essence, initiative: c.initiative.printed, tpr: c.tpr } } },
      prototypeToken: { name: c.name, actorLink: false, disposition: -1, texture: { src: img }, lockRotation: true }, _key: `!actors!${_id}` },
    missing, gearFound };
}

const dir = "packs-src/ct-chrome-kings";
mkdirSync(dir, { recursive: true });
const report = [];
for (const c of DATA.npcs) {
  const { doc, missing } = actor(c);
  const prev = existsSync(dir) ? readdirSync(dir).find(f => f.endsWith(`_${doc._id}.json`)) : null;
  if (prev) {
    const old = JSON.parse(readFileSync(`${dir}/${prev}`, "utf8"));
    if (old.img && !old.img.startsWith("icons/")) { doc.img = old.img; doc.prototypeToken.texture.src = old.prototypeToken?.texture?.src ?? old.img; }
  }
  writeFileSync(`${dir}/${doc.name.replace(/[^A-Za-z0-9]+/g, "_")}_${doc._id}.json`, JSON.stringify(doc, null, 2) + "\n");
  report.push(`${c.name}: ${doc.items.length} embedded; listed only: ${missing.join("; ") || "none"}`);
}
writeFileSync("data/ids.json", JSON.stringify(IDS, null, 2) + "\n");
console.log(report.join("\n"));
