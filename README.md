# Sri Lanka · 13 dic 2026 – 9 gen 2027

Sito statico del viaggio di Greta e Ale. Tutti i contenuti stanno in `data/itinerario.json`.

## Vederlo sul Mac
Doppio clic su `strumenti/avvia-sito.command`: si apre su http://localhost:8000.
Aprendo `index.html` direttamente come file, il browser blocca la lettura del JSON.

Per vedere il sito come sarà in un certo giorno: `http://localhost:8000/?oggi=2026-12-28`.

## Aggiungere le foto
1. Copia le foto in `foto/<id-tappa>/` (es. `foto/ella/`). Meglio esportarle a circa 2000 px sul lato lungo.
2. Doppio clic su `strumenti/aggiorna-foto.command`: aggiorna i `foto.json` di ogni cartella.
3. Facoltativo: in `foto.json` puoi sostituire un nome di file con
   `{ "file": "ponte.jpg", "didascalia": "Nine Arch Bridge", "credito": "Foto di Ale" }`.
   Lo script conserva queste righe quando lo rilanci.

L'ordine delle foto è quello alfabetico dei nomi: la prima è anche la copertina nella lista.

## Dati
- `date` è il testo mostrato; da lì il sito legge il giorno d'inizio e con `notti` calcola lo stato del biglietto (da usare, in corso, timbrato).
- `tipo`: `base` (biglietto), `transito` o `sosta` (riga leggera).
- `ambiente: "costa"` (facoltativo) colora di blu il segnaposto delle foto.

## Uso offline
Il service worker (`sw.js`) salva il sito, i dati, le foto e le tile della mappa già viste.
Se cambi CSS o JS e vuoi forzare l'aggiornamento, aumenta `VERSIONE` in `sw.js`.

## Crediti
Mappa © OpenStreetMap contributors, con Leaflet (licenza BSD, `vendor/leaflet/LICENSE`).
Font Young Serif e Atkinson Hyperlegible Next, licenza SIL OFL (`fonts/`).
