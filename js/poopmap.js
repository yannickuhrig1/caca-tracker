// ============================================================
//  🗺️ POOPMAP — lieux et carte des cacas
//
//  Deux niveaux, indépendants l'un de l'autre :
//   1. le LIEU (maison, boulot, resto…) — une simple étiquette, toujours
//      disponible, même hors ligne et sans autorisation à demander ;
//   2. la POSITION GPS — optionnelle, désactivée par défaut, à activer dans
//      les Réglages. C'est elle qui alimente la carte.
//
//  La carte est dessinée à la main (tuiles OpenStreetMap en <img> + calcul
//  slippy map), sans bibliothèque : l'app reste en vanilla JS et ne gagne
//  aucune dépendance. Hors ligne, les tuiles ne chargent pas mais les
//  pastilles restent positionnées les unes par rapport aux autres.
// ============================================================

window.PoopMapModule = (() => {

  // ===================================================
  //  LIEUX
  // ===================================================
  const PLACES = [
    { id:'maison',    emoji:'🏠', label:'Maison' },
    { id:'boulot',    emoji:'💼', label:'Boulot' },
    { id:'ecole',     emoji:'🏫', label:'École' },
    { id:'resto',     emoji:'🍽️', label:'Resto' },
    { id:'copine',    emoji:'👯', label:'Chez une copine' },
    { id:'transport', emoji:'🚆', label:'Transport' },
    { id:'nature',    emoji:'🌳', label:'Nature' },
    { id:'ailleurs',  emoji:'🚻', label:'Ailleurs' },
  ];

  const placeMeta = id => PLACES.find(p => p.id === id) || null;
  const placeEmoji = id => placeMeta(id)?.emoji || '📍';

  /** Classement des lieux, du plus fréquenté au moins fréquenté. */
  function placeStats(logs) {
    const counts = {};
    (logs || []).forEach(l => { if (l.place && placeMeta(l.place)) counts[l.place] = (counts[l.place] || 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .map(([id, count]) => ({ ...placeMeta(id), count, pct: total ? Math.round(count / total * 100) : 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  // ===================================================
  //  GÉOLOCALISATION
  // ===================================================
  const GEO_KEY = 'poopmap.geoEnabled';

  const geoEnabled = () => { try { return localStorage.getItem(GEO_KEY) === 'true'; } catch { return false; } };
  const setGeoEnabled = on => { try { localStorage.setItem(GEO_KEY, String(!!on)); } catch {} };

  // ~11 m de précision : assez pour reconnaître les toilettes d'un lieu,
  // pas assez pour dire dans quelle pièce.
  const roundCoord = n => Math.round(n * 1e4) / 1e4;

  const hasGeo = l => typeof l?.lat === 'number' && typeof l?.lon === 'number'
                   && isFinite(l.lat) && isFinite(l.lon);

  /** Position courante, ou rejet explicite (l'appelant affiche le message). */
  function capturePosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Ton navigateur ne sait pas te localiser.'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) }),
        err => reject(new Error(
          err.code === 1 ? 'Position refusée — autorise la localisation dans ton navigateur.'
          : err.code === 3 ? 'Localisation trop longue, réessaie.'
          : 'Position introuvable pour le moment.')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  // ===================================================
  //  CONQUÊTE : commune, région, pays
  // ===================================================
  // Réglage distinct de la position : retrouver le nom d'un lieu suppose
  // d'envoyer les coordonnées à un service tiers (Nominatim, l'annuaire
  // d'OpenStreetMap). Ça se décide séparément, et c'est éteint par défaut.
  const GEOCODE_KEY = 'poopmap.geocode';
  const geocodeEnabled = () => { try { return localStorage.getItem(GEOCODE_KEY) === 'true'; } catch { return false; } };
  const setGeocodeEnabled = on => { try { localStorage.setItem(GEOCODE_KEY, String(!!on)); } catch {} };

  const hasZone = l => !!(l?.city || l?.region || l?.country);

  /** Commune / région / pays pour une position. Null si rien n'est trouvé. */
  async function reverseGeocode(lat, lon) {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2'
      + `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      + '&zoom=10&addressdetails=1&accept-language=fr';
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Annuaire indisponible (' + res.status + ')');
    const a = (await res.json())?.address;
    if (!a) return null;
    return {
      city:        a.city || a.town || a.village || a.municipality || a.county || null,
      region:      a.state || a.region || a.county || null,
      country:     a.country || null,
      countryCode: (a.country_code || '').toUpperCase() || null,
    };
  }

  /** Drapeau à partir du code pays ISO (FR → 🇫🇷), sans table de 200 lignes. */
  function flagEmoji(code) {
    if (!code || code.length !== 2) return '🏳️';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }

  /** Ce qui a été « conquis » : communes, régions et pays distincts. */
  function conquestStats(logs) {
    const cities = new Set(), regions = new Set(), countries = new Map();
    (logs || []).forEach(l => {
      if (l.city)    cities.add(l.city);
      if (l.region)  regions.add(l.region);
      if (l.country) countries.set(l.country, l.countryCode || null);
    });
    return {
      cities:    [...cities].sort((a, b) => a.localeCompare(b)),
      regions:   [...regions].sort((a, b) => a.localeCompare(b)),
      countries: [...countries.entries()].map(([name, code]) => ({ name, code }))
                   .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * Complète les entrées géolocalisées dont la zone manque. Nominatim demande
   * au plus une requête par seconde : on y va une par une, et par petits lots.
   */
  async function fillMissingZones(logs, { max = 25, onProgress } = {}) {
    const aFaire = (logs || []).filter(l => hasGeo(l) && !hasZone(l)).slice(0, max);
    let ok = 0;
    for (let i = 0; i < aFaire.length; i++) {
      const l = aFaire[i];
      try {
        const zone = await reverseGeocode(l.lat, l.lon);
        if (zone) { Object.assign(l, zone); l.updated_at = Date.now(); ok++; }
      } catch (_) { /* une zone manquante n'est pas une erreur bloquante */ }
      onProgress?.(i + 1, aFaire.length);
      if (i < aFaire.length - 1) await new Promise(r => setTimeout(r, 1100));
    }
    return { traites: aFaire.length, resolus: ok, restants: (logs || []).filter(l => hasGeo(l) && !hasZone(l)).length };
  }

  // ===================================================
  //  MATHS SLIPPY MAP (OSM / Web Mercator)
  // ===================================================
  const TILE = 256;
  const lonToTileX = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
  const latToTileY = (lat, z) => {
    const r = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  };
  const tileXToLon = (x, z) => x / Math.pow(2, z) * 360 - 180;
  const tileYToLat = (y, z) => {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  /** Distance à vol d'oiseau, en km. */
  function distanceKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /**
   * Zoom et centre permettant de voir tous les points dans width×height.
   * Renvoie null si aucun point géolocalisé.
   */
  function fitView(points, width, height, opts = {}) {
    const pts = (points || []).filter(hasGeo);
    if (!pts.length) return null;
    const { minZoom = 2, maxZoom = 17, padding = 34 } = opts;
    const usableW = Math.max(32, width  - padding * 2);
    const usableH = Math.max(32, height - padding * 2);

    const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);

    let zoom = minZoom;
    for (let z = maxZoom; z >= minZoom; z--) {
      const spanX = Math.abs(lonToTileX(maxLon, z) - lonToTileX(minLon, z)) * TILE;
      const spanY = Math.abs(latToTileY(minLat, z) - latToTileY(maxLat, z)) * TILE;
      if (spanX <= usableW && spanY <= usableH) { zoom = z; break; }
    }
    // Un seul point (ou plusieurs confondus) : le zoom max est inutilement serré.
    if (minLat === maxLat && minLon === maxLon) zoom = Math.min(zoom, 16);

    const yMid = (latToTileY(minLat, zoom) + latToTileY(maxLat, zoom)) / 2;
    return { zoom, lat: tileYToLat(yMid, zoom), lon: (minLon + maxLon) / 2 };
  }

  /**
   * Regroupe les entrées tombant sur la même coordonnée arrondie —
   * sinon 30 cacas à la maison = 30 pastilles empilées au même pixel.
   */
  function clusterPoints(logs, decimals = 3) {
    const f = Math.pow(10, decimals);
    const groups = new Map();
    (logs || []).filter(hasGeo).forEach(l => {
      const key = Math.round(l.lat * f) + '/' + Math.round(l.lon * f);
      const g = groups.get(key);
      if (g) { g.count++; g.logs.push(l); if (l.date > g.last) g.last = l.date; }
      else groups.set(key, { lat: l.lat, lon: l.lon, count: 1, logs: [l], last: l.date });
    });
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  /** Le « QG » (spot le plus fréquenté) et le caca le plus lointain. */
  function geoStats(logs) {
    const clusters = clusterPoints(logs);
    if (!clusters.length) return null;
    const hq = clusters[0];
    let farthest = null;
    clusters.forEach(c => {
      const d = distanceKm(hq, c);
      if (!farthest || d > farthest.km) farthest = { km: d, cluster: c };
    });
    return {
      spots: clusters.length,
      geoloc: clusters.reduce((n, c) => n + c.count, 0),
      hq,
      hqPlace: hq.logs.map(l => l.place).filter(Boolean)[0] || null,
      farthestKm: farthest ? farthest.km : 0,
      farthestPlace: farthest?.cluster.logs.map(l => l.place).filter(Boolean)[0] || null,
    };
  }

  // ===================================================
  //  RENDU
  // ===================================================
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const fmtKm = km => km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(km < 10 ? 1 : 0) + ' km';

  // Vue courante de la carte, conservée entre deux rendus pour ne pas
  // réinitialiser le zoom/déplacement à chaque renderStats().
  let view = null;
  let viewSignature = '';

  function renderCard(logs, container) {
    if (!container) return;
    const places = placeStats(logs);
    const geo = geoStats(logs);

    container.innerHTML = `
      <div class="card rounded-[2rem] p-5 shadow">
        <h4 class="font-bold mb-1">🗺️ PoopMap</h4>
        <p class="text-xs opacity-60 mb-4">Où est-ce que ça se passe ?</p>
        <div id="poopmap-map"></div>
        <div id="poopmap-conquest"></div>
        <div id="poopmap-places" class="mt-4"></div>
      </div>`;

    renderMap(logs, geo, container.querySelector('#poopmap-map'));
    renderConquest(logs, container.querySelector('#poopmap-conquest'));
    renderPlaces(places, logs, container.querySelector('#poopmap-places'));
  }

  function renderConquest(logs, el) {
    if (!el) return;
    const c = conquestStats(logs);
    const total = c.cities.length + c.regions.length + c.countries.length;
    if (!total) { el.innerHTML = ''; return; }

    // « pays » ne prend pas de s au pluriel : le mot porte déjà sa marque.
    const pluriel = (mot, n) => n > 1 && !mot.endsWith('s') ? mot + 's' : mot;
    const ligne = (emoji, libelle, valeurs) => valeurs.length ? `
      <div class="flex items-start gap-2 text-sm">
        <span aria-hidden="true">${emoji}</span>
        <div class="min-w-0">
          <span class="font-bold">${valeurs.length} ${escHtml(pluriel(libelle, valeurs.length))}</span>
          <span class="opacity-60"> — ${escHtml(valeurs.slice(0, 4).join(', '))}${valeurs.length > 4 ? '…' : ''}</span>
        </div>
      </div>` : '';

    el.innerHTML = `
      <div class="mt-4 p-3 rounded-[1.25rem] space-y-1"
           style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
        <div class="text-sm font-bold mb-1">🏴 Territoires conquis</div>
        ${ligne('🌍', 'pays', c.countries.map(p => flagEmoji(p.code) + ' ' + p.name))}
        ${ligne('🗺️', 'région', c.regions)}
        ${ligne('🏙️', 'commune', c.cities)}
      </div>`;
  }

  function renderPlaces(places, logs, el) {
    if (!el) return;
    if (!places.length) {
      el.innerHTML = `<div class="text-xs opacity-60 text-center py-3">
        Aucun lieu enregistré pour l'instant — choisis-en un en ajoutant ton prochain caca 💩</div>`;
      return;
    }
    const top = places[0];
    const withPlace = places.reduce((n, p) => n + p.count, 0);
    el.innerHTML = `
      <div class="text-sm font-bold mb-2">📍 Tes lieux (${withPlace}/${logs.length} caca${logs.length > 1 ? 's' : ''})</div>
      <div class="space-y-2">
        ${places.map(p => `
          <div class="stat-row">
            <span class="text-sm font-bold">${p.emoji} ${escHtml(p.label)}</span>
            <div class="stat-bar"><div class="stat-fill" style="width:${p.pct}%;background:var(--accent)"></div></div>
            <span class="text-sm font-bold">${p.count}</span>
          </div>`).join('')}
      </div>
      <div class="mt-3 p-3 rounded-2xl text-xs font-bold text-center"
           style="background:color-mix(in srgb,var(--accent) 12%,transparent)">
        ${top.emoji} Ton QG, c'est ${escHtml(top.label)} — ${top.pct}% de tes cacas
      </div>`;
  }

  function renderMap(logs, geo, el) {
    if (!el) return;

    if (!geo) {
      el.innerHTML = `
        <div class="rounded-[1.5rem] p-5 text-center text-sm opacity-70"
             style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
          <div class="text-4xl mb-2">🗺️</div>
          ${geoEnabled()
            ? 'Aucun caca géolocalisé pour l\'instant. Au prochain, touche « 📍 Ma position » dans la fiche.'
            : 'La carte est éteinte. Active « Enregistrer la position » dans ⚙️ Réglages pour la remplir.'}
        </div>`;
      return;
    }

    const height = 260;
    const width = Math.max(200, el.clientWidth || 320);
    const clusters = clusterPoints(logs);

    // Nouvelle liste de points → on recadre ; sinon on garde la vue de l'utilisatrice.
    const signature = clusters.map(c => c.lat + ',' + c.lon + ':' + c.count).join('|');
    if (!view || signature !== viewSignature) {
      view = fitView(clusters, width, height);
      viewSignature = signature;
    }

    el.innerHTML = `
      <div id="poopmap-canvas" class="poopmap-canvas" style="height:${height}px">
        <div id="poopmap-layer" class="poopmap-layer"></div>
        <div class="poopmap-controls">
          <button type="button" data-map="in"     aria-label="Zoomer">＋</button>
          <button type="button" data-map="out"    aria-label="Dézoomer">−</button>
          <button type="button" data-map="reset"  aria-label="Recadrer">🎯</button>
        </div>
        <a class="poopmap-attrib" href="https://www.openstreetmap.org/copyright"
           target="_blank" rel="noopener">© OpenStreetMap</a>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-center">
        <div class="p-2 rounded-[1rem]" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
          <div class="font-bold text-lg">${geo.spots}</div><div class="text-xs opacity-60">spot${geo.spots > 1 ? 's' : ''}</div>
        </div>
        <div class="p-2 rounded-[1rem]" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
          <div class="font-bold text-lg">${geo.geoloc}</div><div class="text-xs opacity-60">géolocalisés</div>
        </div>
        <div class="p-2 rounded-[1rem]" style="background:color-mix(in srgb,var(--accent) 8%,transparent)">
          <div class="font-bold text-lg">${fmtKm(geo.farthestKm)}</div><div class="text-xs opacity-60">le + loin du QG</div>
        </div>
      </div>`;

    const canvas = el.querySelector('#poopmap-canvas');
    drawLayer(canvas, clusters, width, height);
    wireInteractions(canvas, clusters, width, height);
  }

  /** Dessine tuiles + pastilles pour la vue courante. */
  function drawLayer(canvas, clusters, width, height) {
    const layer = canvas?.querySelector('#poopmap-layer');
    if (!layer || !view) return;

    const { zoom } = view;
    const centerX = lonToTileX(view.lon, zoom) * TILE;
    const centerY = latToTileY(view.lat, zoom) * TILE;
    const originX = centerX - width / 2;   // pixel monde du coin haut-gauche
    const originY = centerY - height / 2;

    const maxTile = Math.pow(2, zoom);
    const x0 = Math.floor(originX / TILE), x1 = Math.floor((originX + width) / TILE);
    const y0 = Math.floor(originY / TILE), y1 = Math.floor((originY + height) / TILE);

    let html = '';
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= maxTile) continue;           // au-delà des pôles
        const wrapped = ((x % maxTile) + maxTile) % maxTile;  // tour du monde
        html += `<img class="poopmap-tile" alt="" aria-hidden="true" loading="lazy"
          src="https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png"
          style="left:${x * TILE - originX}px;top:${y * TILE - originY}px">`;
      }
    }

    clusters.forEach((c, i) => {
      const px = lonToTileX(c.lon, zoom) * TILE - originX;
      const py = latToTileY(c.lat, zoom) * TILE - originY;
      if (px < -40 || py < -40 || px > width + 40 || py > height + 40) return;
      const emoji = placeEmoji(c.logs.map(l => l.place).filter(Boolean)[0]);
      html += `<button type="button" class="poopmap-pin" data-cluster="${i}"
        style="left:${px}px;top:${py}px"
        aria-label="${c.count} caca${c.count > 1 ? 's' : ''} ici">
        <span aria-hidden="true">${emoji}</span>
        ${c.count > 1 ? `<span class="poopmap-pin-count">${c.count}</span>` : ''}
      </button>`;
    });

    layer.innerHTML = html;
  }

  function wireInteractions(canvas, clusters, width, height) {
    if (!canvas) return;

    canvas.querySelectorAll('[data-map]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const act = btn.dataset.map;
        if (act === 'reset') view = fitView(clusters, width, height);
        else view = { ...view, zoom: Math.max(2, Math.min(18, view.zoom + (act === 'in' ? 1 : -1))) };
        drawLayer(canvas, clusters, width, height);
        wirePins(canvas, clusters);
      });
    });

    // Déplacement à la souris comme au doigt : un seul jeu d'événements pointer.
    // Pas de setPointerCapture ici — il retargete aussi le `click` de
    // compatibilité vers le canvas, et les pastilles ne répondraient plus.
    let dragging = false, panning = false, lastX = 0, lastY = 0, moved = 0;

    const onMove = e => {
      if (!dragging || !view) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      // Seuil : un doigt tremble toujours un peu, et redessiner remplacerait la
      // pastille sous le doigt — le clic serait perdu.
      if (!panning && moved <= 4) return;
      panning = true;
      lastX = e.clientX; lastY = e.clientY;
      const scale = TILE * Math.pow(2, view.zoom);
      const cx = lonToTileX(view.lon, view.zoom) * TILE - dx;
      const cy = Math.max(0, Math.min(scale, latToTileY(view.lat, view.zoom) * TILE - dy));
      view = { ...view, lon: tileXToLon(cx / TILE, view.zoom), lat: tileYToLat(cy / TILE, view.zoom) };
      drawLayer(canvas, clusters, width, height);
      wirePins(canvas, clusters);
    };
    const onUp = () => {
      dragging = false; panning = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    canvas.addEventListener('pointerdown', e => {
      if (e.target.closest('.poopmap-controls, .poopmap-attrib')) return;
      dragging = true; panning = false; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      // Sur window : le doigt qui sort de la carte continue de la déplacer.
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    wirePins(canvas, clusters);
  }

  function wirePins(canvas, clusters) {
    canvas.querySelectorAll('.poopmap-pin').forEach(pin => {
      pin.addEventListener('click', e => {
        e.stopPropagation();
        showCluster(clusters[Number(pin.dataset.cluster)]);
      });
    });
  }

  function showCluster(cluster) {
    if (!cluster) return;
    const lignes = cluster.logs
      .slice()
      .sort((a, b) => b.date - a.date)
      .slice(0, 6)
      .map(l => {
        const dt = new Date(l.date).toLocaleString('fr-FR',
          { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        return `<div class="flex items-center gap-2 text-sm">
          <span>${placeEmoji(l.place)}</span>
          <span class="opacity-60">${escHtml(dt)}</span>
          <span class="capitalize">${escHtml(l.texture || '')}</span>
        </div>`;
      }).join('');
    const reste = cluster.logs.length > 6 ? `<div class="text-xs opacity-50 mt-2">… et ${cluster.logs.length - 6} de plus</div>` : '';
    const titre = `📍 ${cluster.count} caca${cluster.count > 1 ? 's' : ''} ici`;
    if (window.UI?.info) window.UI.info({ title: titre, bodyHTML: `<div class="space-y-1 text-left">${lignes}${reste}</div>` });
    else window.UI?.toast?.(titre);
  }

  /** Efface toutes les coordonnées enregistrées, en gardant les lieux. */
  function forgetAllPositions(logs) {
    let n = 0;
    (logs || []).forEach(l => {
      if (hasGeo(l) || hasZone(l)) {
        delete l.lat; delete l.lon;
        delete l.city; delete l.region; delete l.country; delete l.countryCode;
        l.updated_at = Date.now(); n++;
      }
    });
    view = null; viewSignature = '';
    return n;
  }

  return {
    PLACES, placeMeta, placeEmoji, placeStats,
    geoEnabled, setGeoEnabled, capturePosition, roundCoord, hasGeo,
    geocodeEnabled, setGeocodeEnabled, reverseGeocode, fillMissingZones,
    hasZone, conquestStats, flagEmoji,
    lonToTileX, latToTileY, tileXToLon, tileYToLat, distanceKm,
    fitView, clusterPoints, geoStats, forgetAllPositions,
    renderCard,
  };
})();
