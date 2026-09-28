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

  // ---- fonctions pures (testées) ----

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

  /** Tous les points, pour recadrer la vue sur l'ensemble du groupe. */
  function allPoints(clusters) {
    return (clusters || []).flatMap(g => g.clusters);
  }

  // ---- rendu ----

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  let view = null;

  function renderLegend(groups, colors) {
    const el = document.getElementById('group-map-legend');
    if (!el) return;
    el.innerHTML = groups.map(g => `
      <span class="flex items-center gap-1.5 text-xs">
        <span style="width:10px;height:10px;border-radius:99px;background:${colors[g.userId]}"></span>
        ${esc(g.avatar)} ${esc(g.username)} · ${g.clusters.reduce((n, c) => n + c.count, 0)}
      </span>`).join('');
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
    return 'Tu partages bien ta position 👍, mais aucun caca géolocalisé sur les 30 derniers jours. '
         + 'Active « 🗺️ Enregistrer la position » dans ⚙️ Réglages, puis touche 📍 en ajoutant un caca. '
         + 'Tes copines doivent faire pareil de leur côté.';
  }

  function renderMap(groups, colors, el) {
    const points = allPoints(groups);
    if (!points.length) {
      el.innerHTML = `
        <div class="text-center text-sm opacity-60 py-8">
          ${emptyStateHTML(false, window.SupabaseClient?.geoSharingEnabled?.())}
        </div>`;
      return;
    }

    const height = 380;
    const width = Math.max(240, el.clientWidth || 320);
    view = PM().fitView(points, width, height) || view;

    el.innerHTML = `
      <div class="poopmap-canvas" style="height:${height}px">
        <div class="poopmap-layer"></div>
        <div class="poopmap-controls">
          <button type="button" data-gmap="in"    aria-label="Zoomer">＋</button>
          <button type="button" data-gmap="out"   aria-label="Dézoomer">−</button>
          <button type="button" data-gmap="reset" aria-label="Recadrer">🎯</button>
        </div>
        <a class="poopmap-attrib" href="https://www.openstreetmap.org/copyright"
           target="_blank" rel="noopener">© OpenStreetMap</a>
      </div>`;

    const canvas = el.querySelector('.poopmap-canvas');
    drawLayer(canvas, groups, colors, width, height);
    wire(canvas, groups, colors, width, height);
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

    let html = '';
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= maxTile) continue;
        const wrapped = ((x % maxTile) + maxTile) % maxTile;
        html += `<img class="poopmap-tile" alt="" aria-hidden="true" loading="lazy"
          src="https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png"
          style="left:${x * 256 - originX}px;top:${y * 256 - originY}px">`;
      }
    }

    let gi = 0, ci = 0;
    groups.forEach(g => {
      g.clusters.forEach(c => {
        const px = PMm.lonToTileX(c.lon, zoom) * 256 - originX;
        const py = PMm.latToTileY(c.lat, zoom) * 256 - originY;
        if (px < -40 || py < -40 || px > width + 40 || py > height + 40) return;
        const emoji = PMm.placeEmoji(c.logs.map(l => l.place).filter(Boolean)[0]);
        html += `<button type="button" class="poopmap-pin" data-group="${gi}" data-cluster="${ci}"
          style="left:${px}px;top:${py}px;background:${colors[g.userId]}"
          aria-label="${c.count} caca${c.count > 1 ? 's' : ''} de ${esc(g.username)} ici">
          <span aria-hidden="true">${emoji}</span>
          ${c.count > 1 ? `<span class="poopmap-pin-count">${c.count}</span>` : ''}
        </button>`;
        ci++;
      });
      gi++; ci = 0;
    });

    layer.innerHTML = html;
  }

  function wire(canvas, groups, colors, width, height) {
    if (!canvas) return;
    const PMm = PM();

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

    let dragging = false, panning = false, lastX = 0, lastY = 0, moved = 0;
    const onMove = e => {
      if (!dragging || !view) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (!panning && moved <= 4) return;
      panning = true;
      lastX = e.clientX; lastY = e.clientY;
      const cx = PMm.lonToTileX(view.lon, view.zoom) * 256 - dx;
      const cy = PMm.latToTileY(view.lat, view.zoom) * 256 - dy;
      view = { ...view, lon: PMm.tileXToLon(cx / 256, view.zoom), lat: PMm.tileYToLat(cy / 256, view.zoom) };
      drawLayer(canvas, groups, colors, width, height);
      wirePins(canvas, groups);
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
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    wirePins(canvas, groups);
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
    if (window.UI?.info) window.UI.info({ title: titre, bodyHTML: `<div class="space-y-1 text-left">${lignes}</div>` });
    else window.UI?.toast?.(titre);
  }

  // ---- ouverture / fermeture ----

  async function open(groupId) {
    const modal = document.getElementById('group-map-modal');
    if (!modal) return;

    document.getElementById('group-map-members').textContent = '';
    const mapEl = document.getElementById('group-map-map');
    if (mapEl) mapEl.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Chargement de la carte…</div>';

    modal.classList.remove('hidden');

    const rows = await window.SupabaseClient.getGroupGeoPoops(groupId, 30).catch(() => null);
    const summary = groupGeoSummary(rows);
    document.getElementById('group-map-members').textContent =
      `${summary.members} membre${summary.members > 1 ? 's' : ''} · ${summary.total} caca${summary.total > 1 ? 's' : ''} · ${summary.spots} spot${summary.spots > 1 ? 's' : ''}`;

    if (!rows || !summary.total) {
      if (mapEl) mapEl.innerHTML = `
        <div class="text-center text-sm opacity-60 py-8">
          ${emptyStateHTML(rows === null, window.SupabaseClient?.geoSharingEnabled?.())}
        </div>`;
      return;
    }

    const colors = memberColorMap(rows);
    const groups = clusterByMember(rows);
    renderLegend(groups, colors);
    renderMap(groups, colors, mapEl);
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

  return { memberColorMap, groupGeoSummary, clusterByMember, allPoints, emptyStateHTML, open, close };
})();
