// ============================================================
//  🗺️ CARTE DU GROUPE — les cacas géolocalisés des copines (v2.22.0)
//
//  Affiche sur une carte les positions des membres du groupe ayant
//  activé « Partager ma position » (opt-in `profiles.geo_shared`,
//  migration 19). Les données viennent de la fonction SQL
//  `get_group_geo_poops()` qui applique l'opt-in EN BASE : ce module
//  ne lit jamais directement les coordonnées d'autrui.
//
//  Le rendu réutilise le moteur slippy-map de poopmap.js (tuiles
//  OpenStreetMap, sans bibliothèque) avec des pastilles colorées par
//  membre. Sans données (personne n'a activé le partage), on l'explique.
// ============================================================

window.GroupMapModule = (() => {

  const PM = () => window.PoopMapModule;

  // Couleurs stables attribuées aux membres, dans l'ordre d'apparition.
  const MEMBER_COLORS = ['#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6',
                         '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#e11d48','#0ea5e9'];

  const TEST_USER_ID = 'test-user-poopmap';
  const DEFAULT_HISTORY_DAYS = 3650;

  // ---- fonctions pures (testées) ----

  /** Données fictives d'un membre test pour vérifier visuellement la carte multi-couleurs. */
  function getTestRows(now = Date.now()) {
    const h = 3600 * 1000;
    return [
      { id: 'test-1', user_id: TEST_USER_ID, username: 'Testeur', avatar: '🦊', date: now - 2 * h,   texture: 'normal', color: 'marron', place: 'boulot', lat: 48.8566, lon: 2.3522 },
      { id: 'test-2', user_id: TEST_USER_ID, username: 'Testeur', avatar: '🦊', date: now - 14 * h,  texture: 'moule',  color: 'marron', place: 'resto',  lat: 48.8566, lon: 2.3522 },
      { id: 'test-3', user_id: TEST_USER_ID, username: 'Testeur', avatar: '🦊', date: now - 28 * h,  texture: 'dur',    color: 'fonce',  place: 'train',  lat: 45.7640, lon: 4.8357 },
      { id: 'test-4', user_id: TEST_USER_ID, username: 'Testeur', avatar: '🦊', date: now - 54 * h,  texture: 'normal', color: 'marron', place: 'parc',   lat: 43.2965, lon: 5.3698 },
      { id: 'test-5', user_id: TEST_USER_ID, username: 'Testeur', avatar: '🦊', date: now - 96 * h,  texture: 'mou',    color: 'clair',  place: 'maison', lat: 44.8378, lon: -0.5792 },
    ];
  }

  /** Fusionne les cacas réels du groupe avec ceux du membre fictif. */
  function mergeTestRows(rows, now = Date.now()) {
    return [...(Array.isArray(rows) ? rows : []), ...getTestRows(now)];
  }

  /** user_id -> couleur stable, dans l'ordre des membres. */
  function memberColorMap(rows) {
    const ids = [...new Set((rows || []).map(r => r.user_id))];
    const map = {};
    ids.forEach((id, i) => { map[id] = MEMBER_COLORS[i % MEMBER_COLORS.length]; });
    return map;
  }

  /** Résumé : combien de membres, de spots, de cacas géolocalisés. */
  function groupGeoSummary(rows) {
    const members = new Set((rows || []).map(r => r.user_id));
    const spots   = new Set((rows || []).map(r => `${r.lat}/${r.lon}`));
    return {
      total:   (rows || []).length,
      members: members.size,
      spots:   spots.size,
      withPlace: (rows || []).filter(r => r.place).length,
    };
  }

  /** Clusters par membre : chaque pastille garde sa couleur et sa propriétaire. */
  function clusterByMember(rows) {
    const byUser = {};
    (rows || []).forEach(r => { (byUser[r.user_id] ||= []).push(r); });
    return Object.entries(byUser).map(([userId, logs]) => ({
      userId,
      username: logs[0]?.username || '???',
      avatar:   logs[0]?.avatar   || '💩',
      clusters: PM().clusterPoints(logs),
    }));
  }

  /** Filtre les lignes en excluant les user_id présents dans hiddenUserIds (Set ou Array). */
  function filterRowsByMembers(rows, hiddenUserIds) {
    if (!Array.isArray(rows)) return [];
    if (!hiddenUserIds) return rows.slice();
    const hidden = typeof hiddenUserIds.has === 'function'
      ? hiddenUserIds
      : new Set(Array.isArray(hiddenUserIds) ? hiddenUserIds : []);
    if (hidden.size === 0) return rows.slice();
    return rows.filter(r => r && !hidden.has(r.user_id));
  }

  /** Tous les points, pour recadrer la vue sur l'ensemble du groupe. */
  function allPoints(clusters) {
    return (clusters || []).flatMap(g => g.clusters);
  }

  // ---- rendu ----

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  let view = null;
  let _testMode = false;
  let _currentGroupId = null;
  const _hiddenUsers = new Set();

  const isTestMode = () => _testMode;
  const setTestMode = enabled => { _testMode = !!enabled; return _testMode; };

  function ensureToolbar() {
    let bar = document.getElementById('group-map-toolbar');
    if (bar) return bar;
    const legendEl = document.getElementById('group-map-legend');
    const parent = legendEl?.parentElement;
    if (!parent) return null;
    bar = document.createElement('div');
    bar.id = 'group-map-toolbar';
    bar.className = 'flex flex-wrap items-center justify-between gap-2';
    parent.insertBefore(bar, legendEl);
    return bar;
  }

  function renderToolbar() {
    const bar = ensureToolbar();
    if (!bar) return;
    const geoOn = !!window.SupabaseClient?.geoSharingEnabled?.();
    const shareStyle = geoOn
      ? 'background:var(--accent);color:#fff;border:1px solid var(--accent)'
      : 'background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border)';
    const testStyle = _testMode
      ? 'background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);border:1px solid var(--accent)'
      : 'background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border);opacity:0.8';

    bar.innerHTML = `
      <button type="button" id="group-map-share-btn"
        class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
        style="${shareStyle}" aria-pressed="${geoOn}">
        ${geoOn ? '📍 Position partagée ✓' : '📍 Partager ma position avec le groupe'}
      </button>
      <button type="button" id="group-map-test-btn"
        class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
        style="${testStyle}" aria-pressed="${_testMode}">
        ${_testMode ? '🧪 Membre fictif actif ✓' : '🧪 Tester avec un membre fictif'}
      </button>`;

    const shareBtn = bar.querySelector('#group-map-share-btn');
    shareBtn?.addEventListener('click', async () => {
      if (!window.SupabaseClient?.setGeoSharing) return;
      shareBtn.disabled = true;
      try {
        const next = !window.SupabaseClient.geoSharingEnabled?.();
        await window.SupabaseClient.setGeoSharing(next);
        window.SocialModule?.applySharingToggles?.();
        window.UI?.toast?.(next
          ? 'Ta position est maintenant visible sur la carte du groupe 📍'
          : 'Ta position n\'est plus partagée', 'success');
        if (_currentGroupId) await open(_currentGroupId);
        else renderToolbar();
      } catch (e) {
        window.UI?.toast?.(e.message || 'Impossible de modifier le partage', 'error');
        shareBtn.disabled = false;
      }
    });

    bar.querySelector('#group-map-test-btn')?.addEventListener('click', () => {
      _testMode = !_testMode;
      if (_currentGroupId) open(_currentGroupId);
      else renderToolbar();
    });
  }

  function renderLegend(groups, colors, onToggle) {
    const el = document.getElementById('group-map-legend');
    if (!el) return;
    el.innerHTML = groups.map(g => {
      const hidden = _hiddenUsers.has(g.userId);
      const count = g.clusters.reduce((n, c) => n + c.count, 0);
      const style = hidden
        ? 'border:1px solid var(--card-border);background:var(--card-bg);opacity:0.45;text-decoration:line-through;'
        : 'border:1px solid var(--card-border);background:var(--card-bg);';
      return `
        <button type="button" data-filter-user="${esc(g.userId)}" aria-pressed="${!hidden}"
          class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-opacity cursor-pointer"
          style="${style}">
          <span style="width:10px;height:10px;border-radius:99px;background:${colors[g.userId]}"></span>
          <span>${esc(g.avatar)} ${esc(g.username)} · ${count}</span>
        </button>`;
    }).join('');

    if (typeof onToggle === 'function') {
      el.querySelectorAll('[data-filter-user]').forEach(btn => {
        btn.addEventListener('click', () => onToggle(btn.dataset.filterUser));
      });
    }
  }

  // Message d'état vide adapté à la situation réelle (v2.22.2).
  // « Partager ma position » (profil) et « Enregistrer la position » (Réglages)
  // sont deux choses différentes : le premier message prêtait à confusion en
  // demandant de partager alors que c'était déjà fait.
  function emptyStateHTML(rowsNull, sharingEnabled) {
    if (rowsNull) return 'La carte du groupe n\'est pas encore disponible sur ce serveur.';
    if (!sharingEnabled) {
      return 'Personne n\'a encore partagé sa position, toi y compris. '
           + 'Active « 📍 Partager ma position » dans ton profil pour apparaître ici.';
    }
    return 'Tu partages bien ta position 👍, mais aucun caca géolocalisé pour le moment. '
         + 'Active « 🗺️ Enregistrer la position » dans ⚙️ Réglages, puis touche 📍 en ajoutant un caca. '
         + 'Tes copines doivent faire pareil de leur côté.';
  }

  /** Sélecteur de style (Classique / iPhone), via le module PoopMap. */
  function styleSwitcherHTML() {
    const styles = PM().MAP_STYLES || { classique: { label: 'Classique' }, iphone: { label: 'iPhone' } };
    const current = PM().getMapStyle ? PM().getMapStyle() : 'classique';
    return `
      <div class="poopmap-style" role="group" aria-label="Style de carte">
        ${Object.entries(styles).map(([id, s]) =>
          `<button type="button" data-style="${id}" class="${current === id ? 'is-on' : ''}">${s.label}</button>`).join('')}
      </div>`;
  }

  /** Change le style au clic : onglet actif, attribution et tuiles. */
  function wireStyleSwitcher(canvas, groups, colors, width, height) {
    canvas?.querySelectorAll('.poopmap-style button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        PM().setMapStyle?.(btn.dataset.style);
        canvas.querySelectorAll('.poopmap-style button').forEach(b =>
          b.classList.toggle('is-on', b.dataset.style === PM().getMapStyle?.()));
        const attrib = canvas.querySelector('.poopmap-attrib');
        if (attrib) attrib.textContent = PM().mapStyle?.().attrib || '© OpenStreetMap';
        drawLayer(canvas, groups, colors, width, height);
        wirePins(canvas, groups);
      });
    });
  }

  function renderMap(groups, colors, el, opts = {}) {
    const points = allPoints(groups);
    if (!points.length) {
      const msg = opts.allHidden
        ? 'Tous les membres sont masqués. Clique sur un membre dans la légende pour l\'afficher.'
        : emptyStateHTML(false, window.SupabaseClient?.geoSharingEnabled?.());
      el.innerHTML = `
        <div class="text-center text-sm opacity-60 py-8">
          ${msg}
        </div>`;
      return;
    }

    const height = 380;
    const width = Math.max(240, el.clientWidth || 320);
    view = PM().fitView(points, width, height) || view;

    el.innerHTML = `
      <div class="poopmap-canvas" style="height:${height}px">
        <div class="poopmap-layer"></div>
        ${styleSwitcherHTML()}
        <div class="poopmap-controls">
          <button type="button" data-gmap="in"    aria-label="Zoomer">＋</button>
          <button type="button" data-gmap="out"   aria-label="Dézoomer">−</button>
          <button type="button" data-gmap="reset" aria-label="Recadrer">🎯</button>
        </div>
        <a class="poopmap-attrib" href="${PM().mapStyle?.().attribUrl || 'https://www.openstreetmap.org/copyright'}"
           target="_blank" rel="noopener">${PM().mapStyle?.().attrib || '© OpenStreetMap'}</a>
      </div>`;

    const canvas = el.querySelector('.poopmap-canvas');
    drawLayer(canvas, groups, colors, width, height);
    wire(canvas, groups, colors, width, height);
  }

  function ensurePinsLayer(layer) {
    let pinsLayer = layer.querySelector('.poopmap-pins');
    if (!pinsLayer) {
      pinsLayer = document.createElement('div');
      pinsLayer.className = 'poopmap-pins';
      pinsLayer.style.cssText = 'position:absolute;inset:0';
      layer.appendChild(pinsLayer);
    }
    return pinsLayer;
  }

  function upsertTile(layer, existingTiles, pinsLayer, key, src, left, top) {
    let img = existingTiles.get(key);
    if (img) {
      existingTiles.delete(key);
      img.style.left = `${left}px`;
      img.style.top = `${top}px`;
      return;
    }
    img = document.createElement('img');
    img.className = 'poopmap-tile';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy';
    img.dataset.tileKey = key;
    img.src = src;
    img.style.left = `${left}px`;
    img.style.top = `${top}px`;
    layer.insertBefore(img, pinsLayer);
  }

  function drawLayer(canvas, groups, colors, width, height) {
    const layer = canvas?.querySelector('.poopmap-layer');
    if (!layer || !view) return;

    const PMm = PM();
    const { zoom } = view;
    const centerX = PMm.lonToTileX(view.lon, zoom) * 256;
    const centerY = PMm.latToTileY(view.lat, zoom) * 256;
    const originX = centerX - width / 2;
    const originY = centerY - height / 2;

    const maxTile = Math.pow(2, zoom);
    const x0 = Math.floor(originX / 256), x1 = Math.floor((originX + width) / 256);
    const y0 = Math.floor(originY / 256), y1 = Math.floor((originY + height) / 256);

    const pinsLayer = ensurePinsLayer(layer);
    const existingTiles = new Map();
    layer.querySelectorAll('img.poopmap-tile[data-tile-key]').forEach(img => {
      existingTiles.set(img.dataset.tileKey, img);
    });

    const style = PMm.mapStyle();
    const styleId = PMm.getMapStyle ? PMm.getMapStyle() : 'default';

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= maxTile) continue;
        const wrapped = ((x % maxTile) + maxTile) % maxTile;
        const left = x * 256 - originX;
        const top = y * 256 - originY;
        upsertTile(layer, existingTiles, pinsLayer, `${styleId}:base:${zoom}/${x}/${y}`, style.tile(zoom, wrapped, y), left, top);
        // Surcouche (noms de lieux, transparente) pour les styles qui en ont une.
        if (style.overlay) {
          upsertTile(layer, existingTiles, pinsLayer, `${styleId}:overlay:${zoom}/${x}/${y}`, style.overlay(zoom, wrapped, y), left, top);
        }
      }
    }

    existingTiles.forEach(img => img.remove());

    let pinsHtml = '';
    groups.forEach((g, gi) => {
      g.clusters.forEach((c, ci) => {
        const px = PMm.lonToTileX(c.lon, zoom) * 256 - originX;
        const py = PMm.latToTileY(c.lat, zoom) * 256 - originY;
        if (px < -40 || py < -40 || px > width + 40 || py > height + 40) return;
        const emoji = PMm.placeEmoji(c.logs.map(l => l.place).filter(Boolean)[0]);
        pinsHtml += `<button type="button" class="poopmap-pin" data-group="${gi}" data-cluster="${ci}"
          style="left:${px}px;top:${py}px;background:${colors[g.userId]}"
          aria-label="${c.count} caca${c.count > 1 ? 's' : ''} de ${esc(g.username)} ici">
          <span aria-hidden="true">${emoji}</span>
          ${c.count > 1 ? `<span class="poopmap-pin-count">${c.count}</span>` : ''}
        </button>`;
      });
    });

    pinsLayer.innerHTML = pinsHtml;
  }

  function wire(canvas, groups, colors, width, height) {
    if (!canvas) return;
    const PMm = PM();
    const layer = canvas.querySelector('.poopmap-layer');

    canvas.querySelectorAll('[data-gmap]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const act = btn.dataset.gmap;
        if (act === 'reset') view = PMm.fitView(allPoints(groups), width, height);
        else view = { ...view, zoom: Math.max(2, Math.min(18, view.zoom + (act === 'in' ? 1 : -1))) };
        drawLayer(canvas, groups, colors, width, height);
        wirePins(canvas, groups);
      });
    });

    // Gestes : 1 doigt = déplacement (GPU translate3d + rAF), 2 doigts = pincement cadencé par rAF.
    const pointers = new Map();
    let pinchDist = 0, pinchMX = 0, pinchMY = 0, moved = 0;
    let totalDx = 0, totalDy = 0, dragRaf = 0, pinchRaf = 0;

    const rel = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const panBy = (dx, dy) => {
      if (!view) return;
      const cx = PMm.lonToTileX(view.lon, view.zoom) * 256 - dx;
      const cy = PMm.latToTileY(view.lat, view.zoom) * 256 - dy;
      view = { ...view, lon: PMm.tileXToLon(cx / 256, view.zoom), lat: PMm.tileYToLat(cy / 256, view.zoom) };
    };
    const redraw = () => { drawLayer(canvas, groups, colors, width, height); wirePins(canvas, groups); };
    const flushDrag = () => {
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      if (layer) layer.style.transform = '';
      if (totalDx !== 0 || totalDy !== 0) {
        panBy(totalDx, totalDy);
        totalDx = 0;
        totalDy = 0;
        redraw();
      }
    };

    const onMove = e => {
      if (!pointers.has(e.pointerId) || !view) return;
      const prev = pointers.get(e.pointerId);
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) {
          totalDx += dx;
          totalDy += dy;
          if (!dragRaf) {
            dragRaf = requestAnimationFrame(() => {
              dragRaf = 0;
              if (layer) layer.style.transform = `translate3d(${totalDx}px, ${totalDy}px, 0)`;
            });
          }
        }
      } else if (pointers.size === 2) {
        if (!pinchRaf) {
          pinchRaf = requestAnimationFrame(() => {
            pinchRaf = 0;
            if (pointers.size !== 2 || !view) return;
            const [a, b] = [...pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            if (pinchDist > 0 && dist > 0) {
              const r = rel(mx, my);
              const factor = dist / pinchDist;
              const nv = PMm.zoomAroundView(view, r.x, r.y, view.zoom + Math.log2(factor), width, height);
              if (nv !== view) view = nv;
              panBy(mx - pinchMX, my - pinchMY);
              pinchDist = dist; pinchMX = mx; pinchMY = my;
              redraw();
            }
          });
        }
      }
    };
    const onUp = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        if (pinchRaf) { cancelAnimationFrame(pinchRaf); pinchRaf = 0; }
        pinchDist = 0;
      }
      if (pointers.size === 0) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        flushDrag();
      }
    };

    canvas.addEventListener('pointerdown', e => {
      if (e.target.closest('.poopmap-controls, .poopmap-attrib, .poopmap-style')) return;
      if (pointers.size === 0) {
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        moved = 0;
        totalDx = 0;
        totalDy = 0;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        flushDrag();
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchMX = (a.x + b.x) / 2; pinchMY = (a.y + b.y) / 2;
      }
    });

    wirePins(canvas, groups);
    wireStyleSwitcher(canvas, groups, colors, width, height);
  }

  function wirePins(canvas, groups) {
    canvas.querySelectorAll('.poopmap-pin').forEach(pin => {
      pin.addEventListener('click', e => {
        e.stopPropagation();
        const g = groups[Number(pin.dataset.group)];
        showCluster(g, g?.clusters[Number(pin.dataset.cluster)]);
      });
    });
  }

  function showCluster(group, cluster) {
    if (!group || !cluster) return;
    const lignes = cluster.logs.slice().sort((a, b) => b.date - a.date).slice(0, 6).map(l => {
      const dt = new Date(l.date).toLocaleString('fr-FR',
        { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="flex items-center gap-2 text-sm">
        <span>${PM().placeEmoji(l.place)}</span>
        <span class="opacity-60">${esc(dt)}</span>
        <span class="capitalize">${esc(l.texture || '')}</span>
      </div>`;
    }).join('');
    const titre = `${esc(group.avatar)} ${esc(group.username)} — ${cluster.count} caca${cluster.count > 1 ? 's' : ''} ici`;
    const bodyHTML = `<div class="space-y-1 text-left">${lignes}</div>
      <div class="mt-3 pt-2 border-t text-center" style="border-color:var(--card-border)">
        <button type="button" id="group-map-rate-spot" class="px-3 py-1.5 rounded-full text-xs font-bold"
          style="background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)">
          ⭐ Noter ce spot
        </button>
      </div>`;
    if (window.UI?.info) {
      const overlay = window.UI.info({ title: titre, bodyHTML });
      const rateBtn = overlay?.querySelector?.('#group-map-rate-spot') || document.getElementById('group-map-rate-spot');
      rateBtn?.addEventListener('click', () => {
        overlay?.querySelector?.('[data-act="ok"]')?.click?.();
        if (window.SocialLive?.openSpotModal) {
          window.SocialLive.openSpotModal();
        } else if (window.SocialLiveModule?.openAddSpotModal) {
          window.SocialLiveModule.openAddSpotModal();
        }
      });
    } else {
      window.UI?.toast?.(titre);
    }
  }

  // ---- ouverture / fermeture ----

  async function open(groupId) {
    const modal = document.getElementById('group-map-modal');
    if (!modal) return;
    if (_currentGroupId !== groupId) _hiddenUsers.clear();
    _currentGroupId = groupId;

    document.getElementById('group-map-members').textContent = '';
    const legendEl = document.getElementById('group-map-legend');
    if (legendEl) legendEl.innerHTML = '';
    renderToolbar();
    const mapEl = document.getElementById('group-map-map');
    if (mapEl) mapEl.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Chargement de la carte…</div>';

    modal.classList.remove('hidden');

    const rows = await window.SupabaseClient.getGroupGeoPoops(groupId, DEFAULT_HISTORY_DAYS).catch(() => null);
    const effectiveRows = _testMode ? mergeTestRows(rows) : rows;
    const summary = groupGeoSummary(effectiveRows);
    document.getElementById('group-map-members').textContent =
      `${summary.members} membre${summary.members > 1 ? 's' : ''} · ${summary.total} caca${summary.total > 1 ? 's' : ''} · ${summary.spots} spot${summary.spots > 1 ? 's' : ''}`;

    if (!effectiveRows || !summary.total) {
      if (mapEl) mapEl.innerHTML = `
        <div class="text-center text-sm opacity-60 py-8">
          ${emptyStateHTML(rows === null && !_testMode, window.SupabaseClient?.geoSharingEnabled?.())}
        </div>`;
      return;
    }

    const colors = memberColorMap(effectiveRows);
    const allGroups = clusterByMember(effectiveRows);

    const refreshFiltered = () => {
      const visibleRows = filterRowsByMembers(effectiveRows, _hiddenUsers);
      const visibleGroups = clusterByMember(visibleRows);
      renderLegend(allGroups, colors, uid => {
        if (_hiddenUsers.has(uid)) _hiddenUsers.delete(uid);
        else _hiddenUsers.add(uid);
        refreshFiltered();
      });
      renderMap(visibleGroups, colors, mapEl, { allHidden: allGroups.length > 0 && visibleGroups.length === 0 });
    };

    refreshFiltered();
  }

  function close() {
    document.getElementById('group-map-modal')?.classList.add('hidden');
    view = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('group-map-close')?.addEventListener('click', close);
    document.getElementById('group-map-modal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  });

  return {
    memberColorMap, groupGeoSummary, clusterByMember, filterRowsByMembers, allPoints, emptyStateHTML,
    TEST_USER_ID, DEFAULT_HISTORY_DAYS, getTestRows, mergeTestRows, isTestMode, setTestMode,
    open, close,
  };
})();
