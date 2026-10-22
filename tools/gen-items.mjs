// Generate the Cybertechnology item packs from the captured data:
//   data/master-table.tsv  verified values (two independent reads)
//   data/descriptions.tsv  notes, extras, discrepancies (description pages)
//   data/rulings.tsv       the user's rulings on printed conflicts
//   data/items.mjs         the authored item list (what ships, mechanics)
//   data/ids.json          capture key → document id (never changes once assigned)
// Existing art (img) is kept by document id, so re-running never un-wires it.
//   node tools/gen-items.mjs && npm run build-packs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { ITEMS } from "../data/items.mjs";

const tsv = (p) => {
  const [head, ...rows] = readFileSync(p, "utf8").trimEnd().split("\n").map(l => l.split("\t"));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
};
const MASTER = new Map(tsv("data/master-table.tsv").map(r => [r.key, r]));
const INVENTORY = new Map(tsv("data/inventory.tsv").map(r => [r.key, r]));
const DESC = new Map();
for (const r of tsv("data/descriptions.tsv")) {
  const cur = DESC.get(r.key) ?? { pages: [], notes: [], extra: {} };
  cur.pages.push(r.page); cur.notes.push(r.notes); Object.assign(cur.extra, JSON.parse(r.extra || "{}"));
  DESC.set(r.key, cur);
}
const RULINGS = new Map(tsv("data/rulings.tsv").map(r => [r.key, r]));
const IDS = JSON.parse(readFileSync("data/ids.json", "utf8"));
const idFor = (key) => (IDS[key] ??= randomBytes(8).toString("hex"));

const num = (s) => {
  const t = String(s ?? "").trim();
  if (t === "—" || t === "0") return 0;
  return /^\.?\d[\d.]*$/.test(t) ? Number(t.startsWith(".") ? "0" + t : t) : null;
};
const money = (s) => {
  const t = String(s ?? "").replace(/[+¥,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
const si = (s) => { const n = num(s); return n === null ? String(s ?? "") : n; };

/** Values for one row, with an optional override; throws if a value it needs is missing. */
function values(spec, from, over = {}) {
  const row = MASTER.get(from);
  if (!row && !spec.inline) throw new Error(`${spec.key}: no master row ${from}`);
  const essence = over.essence ?? num(row?.essence) ?? (spec.cost0 ? 0 : null);
  const cost = over.cost ?? (spec.cost0 ? 0 : money(row?.cost));
  if (spec.type !== "gear" && essence === null) throw new Error(`${spec.key}: unresolved Essence "${row?.essence}"`);
  if (cost === null) throw new Error(`${spec.key}: unresolved cost "${row?.cost}"`);
  return { essence: Math.round((essence ?? 0) * 1000) / 1000, cost,
    availability: over.availability ?? row?.availability ?? "", streetIndex: over.streetIndex ?? si(row?.street_index),
    legality: over.legality ?? row?.legality ?? "" };
}

function ratingRows(spec) {
  if (spec.rows) return spec.rows.map(r => {
    let v = values(spec, r.from, { essence: r.essence, cost: r.cost });
    if (r.derivedFrom) {
      const base = values(spec, r.derivedFrom);
      v = { ...v, essence: Math.round((base.essence + r.essenceAdd) * 1000) / 1000, cost: base.cost * r.costMult };
    }
    return { rating: r.rating, essenceCost: v.essence, cost: v.cost, availability: v.availability, streetIndex: v.streetIndex };
  });
  if (spec.expand) {
    const e = spec.expand, out = [];
    for (let l = e.levels[0]; l <= e.levels[1]; l += e.step ?? 1) {
      const v = values(spec, e.from, { essence: e.essence(l), cost: e.cost(l) });
      out.push({ rating: l, essenceCost: Math.round(v.essence * 1000) / 1000, cost: v.cost, availability: v.availability, streetIndex: v.streetIndex });
    }
    return out;
  }
  return [];
}

const sourceKeys = (spec) => [...new Set([spec.from, spec.expand?.from, ...(spec.rows ?? []).map(r => r.from)].filter(Boolean))];

function notesFor(spec) {
  const parts = [], pages = new Set();
  for (const k of [...sourceKeys(spec), spec.key]) {
    const d = DESC.get(k); if (!d) continue;
    d.pages.forEach(p => pages.add(p));
    for (const n of d.notes) if (n && !parts.includes(n)) parts.push(n);
  }
  for (const k of new Set([...sourceKeys(spec), spec.key])) {   // a source key can be the item's own key
    const r = RULINGS.get(k); if (r && r.decided?.startsWith("user")) parts.push(`Ruling: ${r.ruling}`);
  }
  const tablePage = INVENTORY.get(sourceKeys(spec)[0])?.page;
  const cite = [tablePage ? `table p.${tablePage}` : null, ...[...pages].map(p => String(p).endsWith("SSC") ? `SSC p.${p.split("-")[0]}` : `p.${p}`)]
    .filter(Boolean).join(", ");
  if (spec.cost0 && !spec.inline) parts.push("Price as printed: see text (the GM sets it).");
  if (spec.plusPrice) parts.push("Priced as an addition to the BrightLight system.");
  if (spec.ratingIsMp) parts.push("Rating = memory in Mp.");
  return `${parts.join(" ")} (Cybertechnology, ${cite || "FASA 7119"}.)`.trim();
}

function baseDoc(spec, type, system, extraFlags = {}) {
  const _id = idFor(spec.key);
  const flags = { sr2e: { source: { book: "Cybertechnology", code: "FASA7119",
    page: spec.inline?.page ?? (Number.parseInt(INVENTORY.get(sourceKeys(spec)[0])?.page) || null) },
    ...(spec.rule ? { rule: spec.rule } : {}), ...(spec.provisional ? { provisional: spec.provisional } : {}), ...extraFlags } };
  return { _id, name: spec.name, type, img: "", system, effects: [], flags, folder: null, sort: 0,
    _stats: { coreVersion: "13.351", systemId: "sr2e", systemVersion: "0.109.0", createdTime: 1792500000000, modifiedTime: 1792500000000,
      lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null },
    ownership: { default: 0 }, _key: `!items!${_id}` };
}

function cyberware(spec) {
  const rows = ratingRows(spec);
  const v = rows.length ? { essence: rows[0].essenceCost, cost: rows[0].cost, availability: rows[0].availability, streetIndex: rows[0].streetIndex,
    legality: spec.override?.legality ?? MASTER.get(sourceKeys(spec)[0])?.legality ?? "" } : values(spec, spec.from, spec.override ?? {});
  const am = { body: 0, quickness: 0, strength: 0, charisma: 0, intelligence: 0, willpower: 0, reaction: 0, initiativeDice: 0, ...(spec.mods ?? {}) };
  const system = { location: spec.location ?? "bodyware", grade: "standard", essenceCost: v.essence, rating: rows[0]?.rating ?? spec.fields?.rating ?? 1,
    cost: v.cost, availability: v.availability, streetIndex: String(v.streetIndex), legality: v.legality, installed: true,
    attributeMods: am, ratingStats: rows, capacity: 0, modules: [], notes: notesFor(spec), ...(spec.fields ?? {}) };
  if (spec.fields?.rating != null) system.rating = spec.fields.rating;
  return baseDoc(spec, "cyberware", system, spec.weapon ? { pairedWeapon: spec.weapon } : {});
}

function gear(spec) {
  const v = spec.inline ? { cost: spec.inline.cost, availability: "", streetIndex: 1, legality: "Legal" } : values(spec, spec.from, spec.skillsoft ? { cost: 0 } : (spec.override ?? {}));
  const system = { category: spec.skillsoft ? "skillsoft" : "misc", rating: 1, quantity: 1, weight: 0, cost: spec.skillsoft ? 0 : v.cost,
    availability: v.availability, legality: v.legality, equipped: false, concealability: spec.fields?.concealability ?? 0,
    streetIndex: Number(v.streetIndex) || 1, notes: notesFor(spec) };
  if (spec.skillsoft) Object.assign(system, { grantedSkillCategory: { activesoft: "active", datasoft: "data", knowsoft: "knowledge", linguasoft: "language" }[spec.skillsoft], slotted: false,
    notes: `${system.notes} Cost ${MASTER.get(spec.from).cost} (by the chip's Memory, Mp); Concealability 24.`, concealability: 24 });
  return baseDoc(spec, "gear", system);
}

// ── Weapon companions: 0¥ (the ware carries the price), each from its own source ──
const HOLDOUT = { pinned: "sr2e weapons: Streetline Special ca17afcb8c61ee53 (hold-out pistol), system 0.109.0", ranges: [5, 15, 30, 50], damage: "4L" };
const half = (rs) => rs.map(r => Math.floor(r / 2));
const R = (a) => ({ short: a[0], medium: a[1], long: a[2], extreme: a[3] });
const WEAPONS = [
  { key: "ct:w-eye-dart", name: "Eye Dart", ware: "ct:eye-dart", page: 22, damageCode: "", damageType: "physical", ranges: half(HOLDOUT.ranges),
    ammo: { max: 1, type: "dart" }, modes: { ss: true }, notes: `Half-strength (round up) Narcoject/toxin rounds; damage from the dose. Ranges: the hold-out pistol's, halved (round down) (${HOLDOUT.pinned}). One shot; reload 10 Combat Turns. Special Skill or Quickness Test; no aim enhancers. After firing: +2 to visual tests for (4 − unaugmented Body) Combat Turns, min 1.` },
  { key: "ct:w-eye-gun", name: "Eye Gun", ware: "ct:eye-gun", page: 22, damageCode: "3L", damageType: "physical", ranges: half(HOLDOUT.ranges),
    ammo: { max: 1, type: "pistol" }, modes: { ss: true }, notes: `A hold-out pistol at one-half range (round down), −1 Damage (4L → 3L) and +1 recoil (${HOLDOUT.pinned}). The +1 recoil is MANUAL (the system has no positive recoil field). One shot; reload 10 Combat Turns (a Biotech Test cuts it by half the character's Quickness). Rounds cost ×5. Special Skill or Quickness Test; no aim enhancers. Firing damages the cybereye (Cyberware Rules p.46). After firing: +2 to visual tests for (6 − unaugmented Body) Combat Turns, min 2.` },
  { key: "ct:w-oral-dart", name: "Oral Dart", ware: "ct:oral-dart", page: 25, damageCode: "", damageType: "physical", ranges: HOLDOUT.ranges,
    ammo: { max: 3, type: "dart" }, modes: { ss: true }, notes: `Narcoject/toxin rounds at hold-out pistol ranges (${HOLDOUT.pinned}); damage from the dose. Three darts; reload 1 minute per dart. Ammo ×2. Special Skill or Quickness; no aim enhancers. Fires only with the mouth open.` },
  { key: "ct:w-oral-gun", name: "Oral Gun", ware: "ct:oral-gun", page: 25, damageCode: HOLDOUT.damage, damageType: "physical", ranges: HOLDOUT.ranges,
    ammo: { max: 4, type: "pistol" }, modes: { ss: true }, notes: `A hold-out pistol with four shots (${HOLDOUT.pinned}). Reload 1 minute per shot. Ammo ×3. Special Skill or Quickness; no aim enhancers.` },
  { key: "ct:w-tool-laser", name: "Eye Tool Laser", ware: "ct:tool-laser", page: 23, damageCode: "4L", damageType: "physical", ranges: [1, 2, 3, 4],
    ammo: { max: 0, type: "" }, modes: { ss: true }, notes: "Damage 4L. Quickness or a Special Skill; base TN 4, +1 per meter (or part) beyond 1; Power −1 to 2 m, −2 to 4 m (applied by hand). Won't penetrate reflective metals or silvered glass." },
  { key: "ct:w-cyberarm-taser", name: "Cyberarm Taser", ware: "ct:cyberarm-taser", page: 36, damageCode: "10S", damageType: "stun", ranges: [5, 10, 12, 15],
    ammo: { max: 2, type: "taser" }, modes: { sa: true }, notes: "Works like a taser pistol: 10S Stun, the standard taser's ranges (SRII p.103; the system's Defiance Super Shock), two shots before recharging." },
  { key: "ct:w-cybersquirt", name: "CyberSquirt", ware: "ct:cybersquirt", page: 36, damageCode: "", damageType: "physical", ranges: [5, 10, 15, 20],
    ammo: { max: 10, type: "" }, modes: { ss: true }, notes: "An Ares Squirt as a cyberweapon: chemical/biological agents in DMSO gel; 10 rounds, gel for 20 shots. Porous armor no protection; rigid armor (over 5, or plated) half (round up). DMSO: Shadowtech p.92. RANGES: the Ares Squirt's (SSC); confirm against SSC before relying on them." },
  ...[["holdout", "Hold-Out Pistol", [5, 15, 30, 50]], ["light-pistol", "Light Pistol", [5, 15, 30, 50]], ["machine-pistol", "Machine Pistol", [5, 15, 30, 50]],
      ["smg", "Submachine Gun", [10, 40, 80, 150]], ["heavy-pistol", "Heavy Pistol", [5, 20, 40, 60]], ["shotgun", "Shotgun", [10, 20, 50, 100]]].map(([k, n, rs]) => {
    const x = DESC.get(`ct:cybergun-${k}`)?.extra ?? {};
    const mode = (x.mode ?? "SA").toLowerCase();
    return { key: `ct:w-cybergun-${k}`, name: `Cybergun (${n})`, ware: `ct:cybergun-${k}`, page: 86, damageCode: x.damageCode ?? "",
      damageType: "physical", ranges: rs, ammo: { max: x.ammoInternal ?? 0, type: k === "shotgun" ? "shotgun" : "pistol" },
      modes: { [mode]: true }, conceal: Number.parseInt(x.concealability) || 0, weight: x.weight ?? 0,
      notes: `Fichetti cybergun (SSC p.86): ${x.damageCode}(${x.mode}), ${x.ammoInternal} internal rounds, reloadable; ranges by class (core p.88; machine pistols as light pistols, as SSC's are). Concealability ${x.concealability} = noticing the firing port after a shot; observed firing, heavy or full-auto fire is obvious.` };
  })
];
function weapon(w) {
  const system = { weaponType: "firearm", skill: "firearms", damageCode: w.damageCode, damageType: w.damageType, concealability: w.conceal ?? 0, reach: 0,
    firingModes: { ss: false, sa: false, bf: false, fa: false, ...w.modes }, ammo: { current: w.ammo.max, max: w.ammo.max, type: w.ammo.type },
    recoilComp: 0, ranges: R(w.ranges), strengthMin: 0, weight: w.weight ?? 0, cost: 0, availability: "", legality: "", equipped: false,
    accessories: [], streetIndex: 1,
    notes: `${w.notes} Implant weapon: pair with the ${w.ware.replace("ct:", "")} cyberware, which carries the Essence and price; this item costs 0¥. "Special Skill or Quickness Test" (the book): the system rolls its skill field, so set it by hand if your character uses a Special Skill. (Cybertechnology p.${w.page}.)` };
  return baseDoc({ key: w.key, name: w.name, inline: { page: w.page } }, "weapon", system, { pairedWare: w.ware });
}

// ── Write ─────────────────────────────────────────────────────────────────
const out = new Map();
const add = (pack, doc) => { if (!out.has(pack)) out.set(pack, []); out.get(pack).push(doc); };
for (const spec of ITEMS) add(spec.pack, (spec.type === "gear") ? gear(spec) : cyberware(spec));
for (const w of WEAPONS) add("ct-weapons", weapon(w));

const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
for (const [pack, docs] of out) {
  const dir = `packs-src/${pack}`;
  mkdirSync(dir, { recursive: true });
  // Keep art by id.
  const art = new Map();
  for (const f of existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")) : []) {
    try { const d = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")); if (d.img) art.set(d._id, d.img); } catch { /* not a doc */ }
  }
  for (const d of docs) {
    d.img = art.get(d._id) || d.img || (d.type === "weapon" ? "icons/svg/sword.svg" : d.type === "gear" ? "icons/svg/item-bag.svg" : "icons/svg/upgrade.svg");
    writeFileSync(`${dir}/${slug(d.name)}_${d._id}.json`, JSON.stringify(d, null, 2) + "\n");
  }
  console.log(`${pack}: ${docs.length}`);
}
writeFileSync("data/ids.json", JSON.stringify(IDS, null, 2) + "\n");
