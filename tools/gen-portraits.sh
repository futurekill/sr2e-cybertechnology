#!/bin/zsh
# Chrome Kings portraits (Cybertechnology p.87-92): the book illustration (cropped into
# _work/ref/<slug>.png, git-ignored) as the likeness reference, painted in full colour
# in a setting of the character's own. Output _work/out/<slug>.webp, then squared to
# 1024 webp in assets/portraits/ (house token spec); gen-actors.mjs picks them up.
set -u
ROOT=${0:A:h:h}; cd $ROOT || exit 1
REF=_work/ref; OUT=_work/out; WORK=${TMPDIR:-/tmp}/ct-portraits; mkdir -p $WORK $OUT assets/portraits
typeset -A D BG
D[cyber-runner]="grizzled veteran street samurai, cropped grey hair and beard, one cybereye, chrome cyberhand with long retractable hand blades, a chest-mounted display panel and cables, weathered armour jacket"
BG[cyber-runner]="a cramped mentor's workshop in a Seattle back street, a younger runner's gear on the bench, warm amber work lamps"
D[special-forces-trooper]="hard-bitten special forces soldier in a combat helmet and load-bearing vest, cybereyes with a laser designator glint, grenades on his chest, reaching forward with a cybernetic hand"
BG[special-forces-trooper]="a smoky military staging area at dawn, olive drab and steel tones, an armoured transport behind"
D[cyber-assassin]="faceless cyber assassin in a sculpted chrome face mask with a grilled mouthpiece and cybereye lenses, sleek armoured suit, holding a long heavy pistol up, wires at the neck"
BG[cyber-assassin]="a dark corporate tower interior lit by a red 'LOCKED ON' targeting display, cold steel and red"
D[six-million-nuyen-street-samurai]="arrogant young chromed street samurai, slicked-back blond hair, cybereyes, a katana hilt over his shoulder, a long scarf wrapped around his body, bare muscular augmented arms raised behind his head"
BG[six-million-nuyen-street-samurai]="a neon-soaked rooftop at night, hot pink and teal city glow"
D[cyberzombie]="towering delta-grade cyberzombie, half-machine skull with exposed cyberware and a shoulder-mounted gun arm, massive chrome torso plating marked 102, cyberlegs, an inhuman calm"
BG[cyberzombie]="a flooded industrial research bay, harsh white overhead lights and green chemical glow"
D[cyber-logician]="cold tactical commander with a half-chrome face and a large telescopic cybereye, a cyberarm cyberdeck built into his forearm with a keyboard, cables to his skull, hand at his chin"
BG[cyber-logician]="a corporate command centre with a big tactical display and the numbers 121012, steel blue light"
slugs=(cyber-runner special-forces-trooper cyber-assassin six-million-nuyen-street-samurai cyberzombie cyber-logician)
refs=(); listing=""; i=1
for s in $slugs; do refs+=(-i "$REF/$s.png"); listing+="$i. (reference image $i) $D[$s]. SETTING: $BG[$s]. Save to $OUT/$s.webp"$'\n'; i=$((i+1)); done
pf=$WORK/batch.txt
cat > $pf <<EOT
Use your imagegen skill with the built-in image_gen tool (NOT the CLI fallback).

Generate ${#slugs} character portraits for a Shadowrun (2050s cyberpunk) tabletop game, one image
per character. Each has a black-and-white reference illustration of that same character
(numbered below in attachment order): keep its likeness, face, build, cyberware, clothing and
props, rendered as a fully painted, cinematic, full-colour portrait.

STYLE for every image: square 1:1, head-and-shoulders to waist, character centred and facing
the viewer, dramatic lighting from their OWN setting with that setting soft-focus behind them,
painterly realism. Every setting and palette must differ, not mostly purple. NO text except
what the setting names, NO logos, NO watermarks, NO border.

$listing
Report every saved path.
EOT
timeout 2400 codex exec --skip-git-repo-check -s workspace-write $refs < $pf > $WORK/batch.log 2>&1
for s in $slugs; do
  if [ -f "$OUT/$s.webp" ]; then magick "$OUT/$s.webp" -gravity north -extent "%[fx:min(w,h)]x%[fx:min(w,h)]" +repage -resize 1024x1024 -strip -quality 82 -define webp:method=6 "assets/portraits/$s.webp" && echo "   OK   $s"
  else echo "   MISS $s"; fi
done
grep -q 'usage limit' $WORK/batch.log && echo "   !! usage limit — $WORK/batch.log"; true
