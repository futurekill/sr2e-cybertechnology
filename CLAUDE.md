# sr2e-cybertechnology — Dev Notes

Content module for **Cybertechnology** (FASA 7119), riding the sr2e system. Compendium
content only, **no esmodules**. Requires sr2e ≥ 0.109.0.

The approved plans live in the system repo: `sr2e-foundryvtt/docs/PLAN-cybertechnology.md`
(roadmap) and `docs/PLAN-cybertechnology-phase1.md` (this module). Follow them.

## Source and capture
- The PDF (`../Shadowrun 2e - Cybertechnology {FASA7119}.pdf`) is a SCAN, no text layer.
  The PDF page is the book page + 1. Read renders only; never OCR, never memory.
- `data/inventory.tsv`: every source entry (independent pass, never generated from
  values).
- `data/ct-items.tsv`: the ONE place values are typed. Master table (p.93–99) values
  win; description-page disagreements go to `docs/COVERAGE.md` for the user.
- `data/ids.json`: capture key → document id. Never change an existing id.

## User rules
- Never edit or "correct" items from other books; this module ships its OWN version
  of every table row.
- Generators keep an existing `img`/token art by id (re-running must not un-wire art).

## Workflow
`npm run build-packs`, `npm run validate`, `npm run lint`. packs/ is gitignored; always
rebuild after editing packs-src.
