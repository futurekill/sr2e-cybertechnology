# QA plan — sr2e-cybertechnology

Run in a world with sr2e ≥ 0.109.0 and this module enabled.

## Automated
- [ ] `npm run validate`: every inventory line shipped (docs/COVERAGE.md), ids stable,
      rating rows sorted, implant-weapon pairs resolve, Chrome Kings match the print.
- [ ] `npm run lint`.

## Items
- [ ] Drop **Dermal Sheath (Level 2)** on an in-play character: the Buy dialog offers
      grades and cybersurgery; Body +3, Impact +1 after purchase.
- [ ] Drop **Strength Enhancement +4**: price 625,000¥ list, Essence .4.
- [ ] Drop **Crypto Circuit HD**: the rating select prices Rating 7 at 140,000¥.
- [ ] **Eye Dataport**: Levels 1–4 at .25/.30/.35/.40 Essence and 2,200 → 17,600¥.
- [ ] Buy **Eye Gun** ware and drag the **Eye Gun** weapon: only the ware charges.
- [ ] **Cybergun (Heavy Pistol)**: Essence 0 (cyberlimb); the weapon fires 9M(SA).
- [ ] Buy a spare: copy an item to the world, untick installed, then drop it: no surgery.

## Chrome Kings
- [ ] Drop each onto a scene: attributes, Reaction, Initiative dice and Body Index as
      printed (p.87–92); the biography lists ware, gear and printed Initiative.
- [ ] With every other content module disabled the actors still open (embedded copies).
- [ ] Cyber Logician, Cyberzombie and the Six Million Nuyen Street Samurai show their printed
      negative Essence (−4, −2.25, −7.6) in the NPC sheet's E box.
