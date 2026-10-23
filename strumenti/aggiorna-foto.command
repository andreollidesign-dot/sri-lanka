#!/bin/bash
# Doppio clic: per ogni cartella in foto/ riscrive foto.json con le immagini presenti,
# in ordine di nome. Le didascalie e i crediti già scritti a mano restano.
cd "$(dirname "$0")/.." || exit 1
python3 - <<'PY'
import json, os

ESTENSIONI = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif")

for id_tappa in sorted(os.listdir("foto")):
    cartella = os.path.join("foto", id_tappa)
    if not os.path.isdir(cartella):
        continue
    elenco = os.path.join(cartella, "foto.json")
    vecchie = {}
    if os.path.exists(elenco):
        try:
            for voce in json.load(open(elenco, encoding="utf-8")):
                if isinstance(voce, dict) and voce.get("file"):
                    vecchie[voce["file"]] = voce
        except ValueError:
            print(f"! {elenco} aveva un errore: lo riscrivo da capo")
    file = sorted(f for f in os.listdir(cartella)
                  if f.lower().endswith(ESTENSIONI) and not f.startswith("."))
    nuove = [vecchie.get(f, f) for f in file]
    with open(elenco, "w", encoding="utf-8") as out:
        json.dump(nuove, out, ensure_ascii=False, indent=2)
        out.write("\n")
    print(f"{id_tappa}: {len(nuove)} foto")
PY
echo "Fatto. Ricarica il sito."
