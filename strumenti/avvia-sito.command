#!/bin/bash
# Doppio clic: apre il sito su http://localhost:8000 (chiudi la finestra del Terminale per fermarlo).
cd "$(dirname "$0")/.." || exit 1
PORTA=8000
( sleep 1; open "http://localhost:$PORTA" ) &
echo "Sito su http://localhost:$PORTA — chiudi questa finestra per fermarlo."
python3 -m http.server "$PORTA"
