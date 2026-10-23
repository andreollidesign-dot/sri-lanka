/* Sri Lanka · costruisce il sito da data/itinerario.json e da foto/<id>/foto.json.
   Nessun contenuto vive qui: questo file sa solo come mostrarlo. */
(function () {
  "use strict";

  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
    "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const GIORNO = 86400000;
  const DESKTOP = window.matchMedia("(min-width: 960px)");
  const MENO_MOTO = window.matchMedia("(prefers-reduced-motion: reduce)");

  const $ = (id) => document.getElementById(id);
  const el = {
    testata: $("testata"), linea: $("linea"), tappa: $("tappa"), avviso: $("avviso"), piede: $("piede"),
    wrap: $("mappa-wrap"), mappa: $("mappa"), apri: $("mappa-apri"), chiudi: $("mappa-chiudi")
  };

  const V = {
    dati: null, tappe: [], perId: {}, oggi: null, anteprima: false,
    fase: "prima", focus: null, prossima: null, foto: {},
    mappa: null, marker: {}, evidenza: null, scrollLista: 0, ultima: null
  };

  /* ---------- Utilità ---------- */

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dueCifre = (n) => (n < 10 ? "0" : "") + n;
  const piu = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diff = (a, b) => Math.round((b - a) / GIORNO);
  const breve = (d) => d.getDate() + " " + MESI[d.getMonth()];
  const conAnno = (d) => breve(d) + " " + d.getFullYear();
  const colore = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const comportamento = () => (MENO_MOTO.matches ? "auto" : "smooth");

  function dataIso(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function leggi(chiave, base) {
    try { const v = localStorage.getItem(chiave); return v ? JSON.parse(v) : base; } catch (e) { return base; }
  }
  function scrivi(chiave, valore) {
    try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { /* senza memoria si va avanti */ }
  }

  /* Il giorno d'inizio si legge dal campo "date" (es. "31 dic – 3 gen");
     se non si riesce, si contano le notti dall'arrivo. */
  function leggiInizio(testo, arrivo, partenza) {
    const g = /(\d{1,2})/.exec(testo || "");
    const m = /(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/i.exec(testo || "");
    if (!g || !m) return null;
    const mese = MESI.indexOf(m[1].toLowerCase());
    for (let y = arrivo.getFullYear(); y <= partenza.getFullYear(); y++) {
      const d = new Date(y, mese, +g[1]);
      if (d >= arrivo && d <= partenza) return d;
    }
    return null;
  }

  // "Dalhousie (Adam's Peak)" → "Dalhousie"; "Treno Nanu Oya → Ella" → "Treno Nanu Oya"
  const nomeBreve = (nome) => String(nome).split("→")[0].replace(/\s*\(.*?\)\s*/g, " ").trim();

  /* ---------- Dati ---------- */

  function prepara(dati) {
    const arrivo = dataIso(dati.arrivo);
    const partenza = dataIso(dati.partenza);
    if (!arrivo || !partenza) throw new Error("\"arrivo\" e \"partenza\" devono essere date nel formato AAAA-MM-GG.");
    if (!Array.isArray(dati.tappe) || !dati.tappe.length) throw new Error("La lista \"tappe\" è vuota.");

    let cursore = arrivo;
    V.tappe = dati.tappe.map((t, i) => {
      const notti = Math.max(0, Number(t.notti) || 0);
      let inizio = leggiInizio(t.date, arrivo, partenza);
      if (!inizio) inizio = cursore;
      else if (+inizio !== +cursore) {
        console.warn("Tappa \"" + t.id + "\": il campo date dice " + breve(inizio) +
          ", ma contando le notti dall'arrivo verrebbe " + breve(cursore) + ".");
      }
      cursore = piu(inizio, notti);
      return Object.assign({}, t, {
        n: i + 1,
        num: dueCifre(i + 1),
        notti: notti,
        cosa_fare: Array.isArray(t.cosa_fare) ? t.cosa_fare : [],
        passaggio: t.tipo !== "base",
        inizio: inizio,
        fine: piu(inizio, notti),
        giorno1: diff(arrivo, inizio) + 1
      });
    });
    V.tappe.forEach((t, i) => { t.prec = V.tappe[i - 1] || null; t.succ = V.tappe[i + 1] || null; V.perId[t.id] = t; });

    V.arrivo = arrivo;
    V.partenza = partenza;
    V.giorniTotali = diff(arrivo, partenza) + 1;
    V.notti = V.tappe.reduce((s, t) => s + t.notti, 0);
    if (dati.notti_totali && dati.notti_totali !== V.notti) {
      console.warn("notti_totali è " + dati.notti_totali + ", ma la somma delle notti delle tappe è " + V.notti + ".");
    }
  }

  function calcolaStati() {
    const oggi = V.oggi;
    V.fase = oggi < V.arrivo ? "prima" : oggi > V.partenza ? "dopo" : "durante";
    V.tappe.forEach((t) => {
      const fine = t.notti > 0 ? t.fine : piu(t.inizio, 1);
      t.stato = oggi < t.inizio ? "futuro" : oggi < fine ? "oggi" : "fatto";
    });
    const inCorso = V.tappe.filter((t) => t.stato === "oggi");
    V.focus = inCorso.filter((t) => !t.passaggio).pop() || inCorso.pop() || null;
    V.prossima = V.fase === "durante" ? V.tappe.find((t) => t.stato === "futuro") || null : null;
  }

  function leggiOggi() {
    const forzato = dataIso(new URLSearchParams(location.search).get("oggi"));
    V.anteprima = !!forzato;
    const d = forzato || new Date();
    V.oggi = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  async function caricaFoto() {
    const liste = await Promise.all(V.tappe.map((t) =>
      fetch("foto/" + encodeURIComponent(t.id) + "/foto.json", { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])));
    V.tappe.forEach((t, i) => {
      const lista = Array.isArray(liste[i]) ? liste[i] : [];
      V.foto[t.id] = lista
        .map((f) => (typeof f === "string" ? { file: f } : f))
        .filter((f) => f && f.file)
        .map((f) => ({
          src: "foto/" + encodeURIComponent(t.id) + "/" + encodeURIComponent(f.file),
          didascalia: f.didascalia || "",
          credito: f.credito || ""
        }));
    });
  }

  /* ---------- Pezzi di HTML ---------- */

  function giorniDi(t) {
    return t.notti > 1 ? t.giorno1 + "–" + (t.giorno1 + t.notti - 1) : String(t.giorno1);
  }

  function rigaStato(t) {
    if (t.stato === "oggi") {
      if (t.notti > 0) return "Oggi · notte " + (diff(t.inizio, V.oggi) + 1) + " di " + t.notti;
      return "Oggi";
    }
    if (t === V.prossima) {
      const g = diff(V.oggi, t.inizio);
      return g === 1 ? "Domani" : "Tra " + g + " giorni";
    }
    return "";
  }

  const STATO_SR = { futuro: "da fare", oggi: "in corso oggi", fatto: "già fatta" };

  function biglietto(t, opz) {
    const tag = opz.link ? "a" : "div";
    const attr = opz.link ? ' href="#' + esc(t.id) + '"' : "";
    const titolo = opz.titolo || "h3";
    const idTitolo = opz.idTitolo ? ' id="' + opz.idTitolo + '" tabindex="-1"' : "";
    const stato = rigaStato(t);
    const timbro = t.stato === "fatto" ? (t.notti > 0 ? t.fine : t.inizio) : null;
    const viaggiatori = (V.dati.viaggiatori || []).join(" · ");
    return "<" + tag + ' class="ticket' + (t.passaggio ? " ticket--passaggio" : "") + " is-" + t.stato + '"' + attr + ">" +
      (timbro ? '<span class="foro" aria-hidden="true"></span>' : "") +
      '<div class="t-top"><span aria-hidden="true">' + esc(viaggiatori) + '</span><span class="t-da">' +
        esc(t.prec ? "da " + nomeBreve(t.prec.nome) : "Arrivo") + "</span></div>" +
      '<div class="t-head"><span class="t-no" aria-hidden="true">' + t.num + "</span>" +
        "<" + titolo + ' class="t-nome"' + idTitolo + '><span class="sr">Tappa ' + t.n + ': </span>' + esc(t.nome) + "</" + titolo + "></div>" +
      '<div class="t-perf" aria-hidden="true"></div>' +
      '<dl class="t-dati">' +
        "<div><dt>Date</dt><dd>" + esc(t.date) + "</dd></div>" +
        "<div><dt>Notti</dt><dd>" + t.notti + "</dd></div>" +
        "<div><dt>" + (t.notti > 1 ? "Giorni" : "Giorno") + "</dt><dd>" + giorniDi(t) + "</dd></div>" +
      "</dl>" +
      (stato ? '<p class="t-stato">' + esc(stato) + "</p>" : "") +
      (timbro ? '<span class="timbro" aria-hidden="true">' + breve(timbro) + "</span>" : "") +
      '<span class="sr">Stato: ' + STATO_SR[t.stato] + ".</span>" +
      "</" + tag + ">";
  }

  function voceLinea(t) {
    const cls = "stop " + (t.passaggio ? "stop--passaggio" : "stop--base") + " is-" + t.stato;
    const corrente = t === V.focus ? ' aria-current="step"' : "";
    let corpo;
    if (t.passaggio) {
      const quando = t.stato === "oggi" ? "oggi" : t.date + " · " + (t.tipo || "transito");
      corpo = '<a class="passaggio" href="#' + esc(t.id) + '"><strong><span class="num">' + t.num + "</span> · " +
        esc(t.nome) + "</strong><span>" + esc(quando) + '</span><span class="sr">Stato: ' + STATO_SR[t.stato] + ".</span></a>";
    } else {
      corpo = biglietto(t, { link: true });
      const foto = V.foto[t.id] || [];
      if (foto.length) {
        corpo += '<a href="#' + esc(t.id) + '" tabindex="-1" aria-hidden="true"><img class="copertina" src="' +
          foto[0].src + '" alt="" loading="lazy"></a>';
      }
    }
    return '<li class="' + cls + '" data-id="' + esc(t.id) + '"' + corrente + '><span class="dot" aria-hidden="true"></span>' + corpo + "</li>";
  }

  function galleria(t) {
    const foto = V.foto[t.id] || [];
    if (!foto.length) {
      const quando = V.oggi < t.fine || (t.notti === 0 && V.oggi <= t.inizio)
        ? "Le foto arrivano a " + MESI_LUNGHI[t.inizio.getMonth()]
        : "Foto in arrivo";
      const tipo = t.passaggio ? " ph--passaggio" : t.ambiente === "costa" ? " ph--costa" : "";
      return '<div class="ph' + tipo + '"><span class="num" aria-hidden="true">' + t.num + "</span>" +
        "<p><b>" + esc(t.nome) + "</b><span>" + quando + "</span></p></div>";
    }
    const voci = foto.map((f, k) => {
      const alt = f.didascalia || t.nome + ", foto " + (k + 1) + " di " + foto.length;
      const dida = [f.didascalia, f.credito].filter(Boolean).map(esc).join(" · ");
      return '<li><figure><a href="' + f.src + '"><img src="' + f.src + '" alt="' + esc(alt) + '"' +
        (k > 0 ? ' loading="lazy"' : "") + "></a>" + (dida ? "<figcaption>" + dida + "</figcaption>" : "") + "</figure></li>";
    }).join("");
    const ctrl = foto.length > 1
      ? '<div class="galleria-ctrl"><button type="button" data-dir="-1" aria-label="Foto precedente">‹</button>' +
        '<span aria-live="polite"><span class="pos">1</span> / ' + foto.length + "</span>" +
        '<button type="button" data-dir="1" aria-label="Foto successiva">›</button></div>'
      : "";
    return '<div class="galleria"><ul class="galleria-track" tabindex="0" aria-label="Foto di ' + esc(t.nome) + '">' +
      voci + "</ul>" + ctrl + "</div>";
  }

  function cosaFare(t) {
    if (!t.cosa_fare.length) return "";
    const fatti = leggi("sl-fatto-" + t.id, []);
    const voci = t.cosa_fare.map((c, k) => {
      const id = "cf-" + t.id + "-" + k;
      return '<li><label for="' + esc(id) + '"><input type="checkbox" id="' + esc(id) + '" data-voce="' + esc(c) + '"' +
        (fatti.indexOf(c) >= 0 ? " checked" : "") + "><span>" + esc(c) + "</span></label></li>";
    }).join("");
    return '<section aria-labelledby="h-cf"><h2 class="label" id="h-cf">Cosa fare</h2><ul class="checklist">' + voci + "</ul></section>";
  }

  function comeArrivare(t) {
    if (!t.come_arrivare) return "";
    const p = t.prec;
    const capoPrec = p
      ? '<span class="capo' + (p.passaggio ? " capo--passaggio" : "") + '">' + p.num + "</span>"
      : '<span class="capo capo--inizio"></span>';
    return '<section aria-labelledby="h-ca"><h2 class="label" id="h-ca">Come arrivare</h2>' +
      '<div class="tratta" aria-hidden="true">' + capoPrec + '<span class="binario"></span>' +
        '<span class="capo' + (t.passaggio ? " capo--passaggio" : "") + '">' + t.num + "</span></div>" +
      '<div class="tratta-nomi"><span>' + esc(p ? p.nome : "Arrivo") + "</span><span>" + esc(t.nome) + "</span></div>" +
      "<p>" + esc(t.come_arrivare) + "</p></section>";
  }

  function precSucc(t) {
    const link = (x, cls, etichetta) => x
      ? '<a class="' + cls + '" href="#' + esc(x.id) + '"><span class="label">' + etichetta + "</span><b>" + esc(x.nome) + "</b></a>"
      : "";
    return '<nav class="prevnext" aria-label="Altre tappe">' +
      link(t.prec, "prec", "‹ Prima · " + (t.prec && t.prec.num)) +
      link(t.succ, "succ", "Dopo · " + (t.succ && t.succ.num) + " ›") + "</nav>";
  }

  function scheda(t) {
    return '<article class="tappa">' +
      '<div class="tappa-top"><a class="indietro" href="#percorso">← Percorso</a><span class="label">' +
        t.num + " / " + dueCifre(V.tappe.length) + "</span></div>" +
      galleria(t) +
      biglietto(t, { titolo: "h2", idTitolo: "tappa-titolo" }) +
      (t.descrizione ? '<p class="descrizione">' + esc(t.descrizione) + "</p>" : "") +
      '<button class="btn btn-mappa" type="button" data-azione="mappa">Mostra sulla mappa</button>' +
      cosaFare(t) + comeArrivare(t) + precSucc(t) +
      "</article>";
  }

  function anteprimaMappa(t) {
    return '<div class="ant"><div class="ant-head"><span class="t-no">' + t.num + "</span><b>" + esc(t.nome) + "</b></div>" +
      '<div class="ant-dati">' + esc(t.date) + " · " + (t.notti ? t.notti + (t.notti === 1 ? " notte" : " notti") : esc(t.tipo || "transito")) + "</div>" +
      (t.descrizione ? "<p>" + esc(t.descrizione) + "</p>" : "") +
      '<a class="ant-apri" href="#' + esc(t.id) + '">Apri la tappa →</a></div>';
  }

  /* ---------- Disegno ---------- */

  function disegnaTestata() {
    const d = V.dati;
    let stato;
    if (V.fase === "prima") {
      const g = diff(V.oggi, V.arrivo);
      stato = '<span class="stato">' + (g === 1 ? "Si parte domani" : "Mancano " + g + " giorni") + "</span>";
    } else if (V.fase === "durante" && V.focus) {
      stato = '<a class="stato" href="#' + esc(V.focus.id) + '">Giorno ' + (diff(V.arrivo, V.oggi) + 1) + " di " +
        V.giorniTotali + " · oggi a " + esc(nomeBreve(V.focus.nome)) + "</a>";
    } else {
      stato = '<span class="stato">Viaggio concluso · ' + V.notti + " notti</span>";
    }
    el.testata.innerHTML =
      (V.anteprima ? '<span class="label">Anteprima del ' + conAnno(V.oggi) + "</span>" : "") +
      "<h1>" + esc(d.viaggio) + "</h1>" +
      '<p class="meta"><span>' + conAnno(V.arrivo) + " → " + conAnno(V.partenza) + "</span><span>" +
        esc((d.viaggiatori || []).join(" e ")) + " · " + V.notti + " notti · " + V.tappe.length + " tappe</span></p>" + stato;
    el.piede.innerHTML = "<p>Si apre anche senza rete, dopo la prima visita.</p>" +
      '<p>Mappa © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Leaflet</p>';
  }

  function disegnaLinea() {
    el.linea.innerHTML = V.tappe.map(voceLinea).join("");
    osservaLinea();
    requestAnimationFrame(aggiornaLinea);
  }

  // La parte piena della linea arriva fino a oggi, il resto è tratteggiato
  function aggiornaLinea() {
    let quota = 0;
    if (V.fase === "dopo") quota = 100;
    else if (V.fase === "durante" && V.focus) {
      const dot = el.linea.querySelector('[data-id="' + CSS.escape(V.focus.id) + '"] .dot');
      const linea = el.linea.getBoundingClientRect();
      if (dot && linea.height) {
        const d = dot.getBoundingClientRect();
        quota = Math.min(100, ((d.top + d.height / 2 - linea.top) / linea.height) * 100);
      }
    }
    el.linea.style.setProperty("--fatto", quota.toFixed(1) + "%");
  }

  /* ---------- Mappa ---------- */

  function creaMappa() {
    if (!window.L) { el.wrap.hidden = true; return; }
    const m = L.map(el.mappa, { zoomControl: false, zoomSnap: 1, minZoom: 6, maxZoom: 17 });
    L.control.zoom({ position: "topright", zoomInTitle: "Ingrandisci", zoomOutTitle: "Rimpicciolisci" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: "anonymous", // così il service worker può salvarle per l'uso offline
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(m);
    m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

    const coord = V.tappe.map((t) => t.coord);
    V.limiti = L.latLngBounds(coord);
    V.mappa = m;
    inquadraTutto(); // serve una vista prima di aggiungere i marker

    const blu = colore("--blue");
    const k = V.fase === "prima" ? 0 : V.fase === "dopo" ? coord.length - 1 : V.focus ? V.focus.n - 1 : 0;
    if (k > 0) L.polyline(coord.slice(0, k + 1), { color: blu, weight: 4, opacity: 0.95, lineJoin: "round", interactive: false }).addTo(m);
    if (k < coord.length - 1) L.polyline(coord.slice(k), { color: blu, weight: 4, opacity: 0.9, dashArray: "1 9", lineCap: "round", lineJoin: "round", interactive: false }).addTo(m);

    V.tappe.forEach((t) => {
      const tipo = t === V.focus ? "mk--oggi" : t.passaggio ? "mk--passaggio" : "mk--base";
      const icona = L.divIcon({
        className: "mk-icona",
        html: '<span class="mk ' + tipo + '">' + t.n + "</span>",
        iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -14]
      });
      const mk = L.marker(t.coord, {
        icon: icona, keyboard: true, riseOnHover: true,
        zIndexOffset: t === V.focus ? 1000 : t.passaggio ? 0 : 100
      }).addTo(m);
      mk.getElement().setAttribute("aria-label", t.num + " " + t.nome + ", " + t.date);
      const classe = "anteprima" + (t === V.focus ? " is-oggi" : t.passaggio ? " is-passaggio" : "");
      mk.bindPopup(anteprimaMappa(t), { className: classe, maxWidth: 270, autoPanPadding: [24, 24] });
      mk.on("popupopen", () => {
        evidenzia(t.id);
        const li = voceDi(t.id);
        if (li && DESKTOP.matches && !el.linea.hidden) {
          V.pausaScroll = Date.now() + 1500; // lo scorrimento automatico non deve spostare l'evidenza
          li.scrollIntoView({ block: "center", behavior: comportamento() });
        }
      });
      V.marker[t.id] = mk;
    });

    impostaInterazione();
  }

  function inquadraTutto() {
    if (!V.mappa) return;
    V.mappa.invalidateSize();
    V.mappa.fitBounds(V.limiti, { padding: [28, 28], animate: false });
  }

  function vola(t, zoom) {
    if (!V.mappa) return;
    V.mappa.invalidateSize();
    V.mappa.setView(t.coord, Math.max(zoom || 10, V.mappa.getZoom()), { animate: !MENO_MOTO.matches });
  }

  // Sul telefono la mappa piccola non cattura lo scroll: si esplora a tutto schermo
  function impostaInterazione() {
    const m = V.mappa;
    if (!m) return;
    const attiva = DESKTOP.matches || document.body.classList.contains("mappa-aperta");
    ["dragging", "touchZoom", "doubleClickZoom", "scrollWheelZoom", "boxZoom"].forEach((h) => {
      if (m[h]) attiva ? m[h].enable() : m[h].disable();
    });
    const zoom = el.mappa.querySelector(".leaflet-control-zoom");
    if (zoom) zoom.hidden = !attiva;
  }

  function apriMappa(t) {
    document.body.classList.add("mappa-aperta");
    impostaInterazione();
    if (t) {
      vola(t, 11);
      V.marker[t.id] && V.marker[t.id].openPopup();
    } else {
      V.mappa.invalidateSize();
    }
    el.chiudi.focus();
  }

  function chiudiMappa(rimettiFuoco) {
    if (!document.body.classList.contains("mappa-aperta")) return;
    document.body.classList.remove("mappa-aperta");
    V.mappa.closePopup();
    impostaInterazione();
    if (el.tappa.hidden) inquadraTutto();
    if (rimettiFuoco) (el.tappa.hidden ? el.apri : el.tappa.querySelector("[data-azione=mappa]") || el.apri).focus();
  }

  function voceDi(id) { return el.linea.querySelector('[data-id="' + CSS.escape(id) + '"]'); }

  function evidenzia(id) {
    if (V.evidenza === id) return;
    if (V.evidenza) {
      const vecchio = V.marker[V.evidenza];
      vecchio && vecchio.getElement() && vecchio.getElement().classList.remove("is-evidenza");
      const li = voceDi(V.evidenza);
      li && li.classList.remove("is-evidenza");
    }
    V.evidenza = id;
    if (!id) return;
    const mk = V.marker[id];
    mk && mk.getElement() && mk.getElement().classList.add("is-evidenza");
    const li = voceDi(id);
    li && li.classList.add("is-evidenza");
  }

  // Su desktop, mentre scorri la linea, il marker della tappa al centro si illumina
  let osservatore = null;
  function osservaLinea() {
    if (osservatore) osservatore.disconnect();
    if (!("IntersectionObserver" in window)) return;
    osservatore = new IntersectionObserver((voci) => {
      if (!DESKTOP.matches || el.linea.hidden || Date.now() < (V.pausaScroll || 0)) return;
      voci.forEach((v) => { if (v.isIntersecting) evidenzia(v.target.dataset.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    el.linea.querySelectorAll(".stop").forEach((li) => osservatore.observe(li));
  }

  /* ---------- Navigazione ---------- */

  function instrada(primaVolta) {
    const id = decodeURIComponent(location.hash.slice(1));
    const t = V.perId[id];
    if (t) mostraTappa(t);
    else mostraPercorso(primaVolta);
  }

  function mostraTappa(t) {
    if (el.tappa.hidden) V.scrollLista = window.scrollY;
    chiudiMappa(false);
    el.tappa.innerHTML = scheda(t);
    el.tappa.hidden = false;
    el.linea.hidden = true;
    document.body.classList.add("vista-tappa");
    document.title = t.nome + " · " + V.dati.viaggio;
    window.scrollTo(0, 0);
    $("tappa-titolo").focus({ preventScroll: true });
    collegaScheda(t);
    V.ultima = t.id;
    evidenzia(t.id);
    if (DESKTOP.matches) vola(t, 10);
  }

  function mostraPercorso(primaVolta) {
    const eraTappa = !el.tappa.hidden;
    el.tappa.hidden = true;
    el.tappa.innerHTML = "";
    el.linea.hidden = false;
    document.body.classList.remove("vista-tappa");
    document.title = V.dati.viaggio;
    aggiornaLinea();
    if (eraTappa) {
      inquadraTutto();
      window.scrollTo(0, V.scrollLista);
      const li = V.ultima && voceDi(V.ultima);
      const link = li && li.querySelector("a");
      link && link.focus({ preventScroll: true });
    } else if (primaVolta && V.fase === "durante" && V.focus) {
      // durante il viaggio il sito si apre sulla tappa di oggi
      const li = voceDi(V.focus.id);
      li && li.scrollIntoView({ block: "center" });
      evidenzia(V.focus.id);
    }
  }

  function collegaScheda(t) {
    const radice = el.tappa;
    radice.querySelector("[data-azione=mappa]").addEventListener("click", () => apriMappa(t));

    radice.querySelectorAll(".checklist input").forEach((c) => c.addEventListener("change", () => {
      const fatti = Array.from(radice.querySelectorAll(".checklist input:checked")).map((x) => x.dataset.voce);
      scrivi("sl-fatto-" + t.id, fatti);
    }));

    collegaGalleria(radice);
  }

  function collegaGalleria(radice) {
    const track = radice.querySelector(".galleria-track");
    const ctrl = radice.querySelector(".galleria-ctrl");
    if (track && ctrl) {
      const pos = ctrl.querySelector(".pos");
      const [prec, succ] = ctrl.querySelectorAll("button");
      const tot = track.children.length;
      const aggiorna = () => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        pos.textContent = String(i + 1);
        prec.disabled = i <= 0;
        succ.disabled = i >= tot - 1;
      };
      ctrl.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) track.scrollBy({ left: Number(b.dataset.dir) * track.clientWidth, behavior: comportamento() });
      });
      track.addEventListener("scroll", () => requestAnimationFrame(aggiorna), { passive: true });
      aggiorna();
    }
  }

  /* ---------- Avvio ---------- */

  function mostraAvviso(titolo, corpo) {
    el.avviso.innerHTML = "<h2>" + titolo + "</h2>" + corpo;
    el.avviso.hidden = false;
    el.linea.hidden = true;
    el.wrap.hidden = true;
  }

  async function avvia() {
    let dati;
    try {
      const r = await fetch("data/itinerario.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("Il file data/itinerario.json non è stato trovato (" + r.status + ").");
      const testo = await r.text();
      try { dati = JSON.parse(testo); } catch (e) {
        throw new Error("data/itinerario.json contiene un errore di scrittura: " + e.message +
          ". Di solito è una virgola in più o in meno, o una virgoletta non chiusa.");
      }
      V.dati = dati;
      leggiOggi();
      prepara(dati);
    } catch (e) {
      if (location.protocol === "file:") {
        mostraAvviso("Apri il sito con il server locale",
          "<p>Aprendo index.html come file, il browser non permette di leggere <code>data/itinerario.json</code>.</p>" +
          "<p>Fai doppio clic su <code>strumenti/avvia-sito.command</code>: si apre il sito all'indirizzo " +
          "<code>http://localhost:8000</code>. Su GitHub Pages funziona senza fare niente.</p>");
      } else {
        mostraAvviso("Il sito non riesce a leggere i dati", "<p>" + esc(e.message) + "</p>");
      }
      console.error(e);
      return;
    }

    calcolaStati();
    disegnaTestata();
    disegnaLinea();
    creaMappa();
    instrada(true);

    window.addEventListener("hashchange", () => instrada(false));
    el.apri.addEventListener("click", () => apriMappa(null));
    el.chiudi.addEventListener("click", () => chiudiMappa(true));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiMappa(true); });
    el.linea.addEventListener("mouseover", (e) => {
      const li = e.target.closest(".stop");
      if (li && DESKTOP.matches) evidenzia(li.dataset.id);
    });
    el.linea.addEventListener("focusin", (e) => {
      const li = e.target.closest(".stop");
      if (li) evidenzia(li.dataset.id);
    });
    DESKTOP.addEventListener("change", () => {
      chiudiMappa(false);
      impostaInterazione();
      if (el.tappa.hidden) inquadraTutto();
      else if (V.ultima) vola(V.perId[V.ultima], 10);
    });
    window.addEventListener("resize", aggiornaLinea);

    // Le foto arrivano dopo: la pagina è già leggibile senza
    await caricaFoto();
    disegnaLinea();
    if (!el.tappa.hidden && V.ultima && (V.foto[V.ultima] || []).length) {
      const t = V.perId[V.ultima];
      const ph = el.tappa.querySelector(".ph");
      if (ph) { ph.outerHTML = galleria(t); collegaGalleria(el.tappa); }
    }
    if (V.evidenza) { const id = V.evidenza; V.evidenza = null; evidenzia(id); }
  }

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  avvia();
})();
