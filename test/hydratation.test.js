// Hydratation quotidienne, check-in « Jour sans passage » et observations
// différées 6–36 h / 24–48 h (v3.0 — Étape 1).

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

function makeEnv(extra = {}) {
  const elements = {};
  const registerEl = (id, init = {}) => {
    elements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      dataset: {},
      classList: {
        _set: new Set(),
        add(...c) { c.forEach(x => this._set.add(x)); },
        remove(...c) { c.forEach(x => this._set.delete(x)); },
        toggle(c, force) {
          const on = force === undefined ? !this._set.has(c) : Boolean(force);
          if (on) this._set.add(c); else this._set.delete(c);
          return on;
        },
        contains(c) { return this._set.has(c); },
      },
      setAttribute(k, v) { this[k] = String(v); },
      getAttribute(k) { return this[k] ?? null; },
      remove() { delete elements[id]; },
      ...init,
    };
    return elements[id];
  };

  const ctx = loadInto(['js/app/app-sante.js', 'js/app/app-hydratation.js'], {
    $id: id => elements[id] || null,
    state: { logs: [] },
    ...extra,
  });

  const api = readGlobals(ctx, [
    'WATER_GOAL_DEFAULT',
    'todayDateKey',
    'getWaterToday',
    'addWaterGlass',
    'suggestedWaterTag',
    'saveZeroPoopCheckin',
    'getZeroPoopCheckins',
    'getTodayZeroCheckin',
    'renderHydrationTile',
    'openZeroPoopModal',
    'delayedTriggerInsights',
    'renderHealthInsights',
    'renderInsightsCard',
    'HEALTH_TAGS',
  ]);

  return { ctx, elements, registerEl, ...api };
}

const H = 3600000;
const makeLog = (date, overrides = {}) => ({
  id: Math.random(),
  date,
  texture: 'normal',
  color: 'marron',
  ...overrides,
});

// ---------- Hydratation quotidienne ----------

test('WATER_GOAL_DEFAULT vaut 8 et todayDateKey formate en heure locale YYYY-MM-DD', () => {
  const { WATER_GOAL_DEFAULT, todayDateKey } = makeEnv();
  assert.strictEqual(WATER_GOAL_DEFAULT, 8);

  const morning = new Date(2026, 2, 5, 0, 15, 0).getTime();  // 5 mars 2026 00:15 local
  const lateNight = new Date(2026, 2, 5, 23, 50, 0).getTime(); // 5 mars 2026 23:50 local
  assert.strictEqual(todayDateKey(morning), '2026-03-05');
  assert.strictEqual(todayDateKey(lateNight), '2026-03-05');
});

test('getWaterToday et addWaterGlass : persistance hydratation.v1, bornes 0..20 et isolation par jour', () => {
  const { ctx, getWaterToday, addWaterGlass } = makeEnv();
  const day1 = new Date(2026, 5, 10, 10, 0, 0).getTime();
  const day2 = new Date(2026, 5, 11, 10, 0, 0).getTime();

  assert.strictEqual(getWaterToday(day1), 0);

  assert.strictEqual(addWaterGlass(1, day1), 1);
  assert.strictEqual(addWaterGlass(3, day1), 4);
  assert.strictEqual(getWaterToday(day1), 4);
  assert.strictEqual(getWaterToday(day2), 0, 'un autre jour repart à 0');

  // Borne basse à 0
  assert.strictEqual(addWaterGlass(-10, day1), 0);
  assert.strictEqual(getWaterToday(day1), 0);

  // Borne haute à 20
  assert.strictEqual(addWaterGlass(25, day1), 20);
  assert.strictEqual(addWaterGlass(1, day1), 20);
  assert.strictEqual(getWaterToday(day1), 20);

  // Vérifie la clé localStorage exacte 'hydratation.v1'
  const raw = JSON.parse(ctx.localStorage.getItem('hydratation.v1'));
  assert.strictEqual(raw['2026-06-10'], 20);
});

test('getWaterToday résiste à un JSON corrompu dans localStorage', () => {
  const { ctx, getWaterToday } = makeEnv();
  ctx.localStorage.setItem('hydratation.v1', '{not-json');
  assert.strictEqual(getWaterToday(), 0);
});

test('suggestedWaterTag : hydratee >= 6, peu-eau <= 1 dès 18h, null sinon', () => {
  const { suggestedWaterTag } = makeEnv();

  assert.strictEqual(suggestedWaterTag(6, 9), 'hydratee');
  assert.strictEqual(suggestedWaterTag(10, 21), 'hydratee');

  assert.strictEqual(suggestedWaterTag(0, 18), 'peu-eau');
  assert.strictEqual(suggestedWaterTag(1, 22), 'peu-eau');

  assert.strictEqual(suggestedWaterTag(0, 10), null, 'le matin, 0 verre est normal');
  assert.strictEqual(suggestedWaterTag(1, 17), null, 'avant 18h, pas d\'alerte peu-eau');
  assert.strictEqual(suggestedWaterTag(2, 20), null);
  assert.strictEqual(suggestedWaterTag(5, 23), null);
  assert.strictEqual(suggestedWaterTag(null, 20), null);
});

// ---------- Check-in « Jour sans passage » ----------

test('saveZeroPoopCheckin : persiste sous checkin0.v1 et remplace le même dateKey', () => {
  const { ctx, saveZeroPoopCheckin, getZeroPoopCheckins, getTodayZeroCheckin } = makeEnv();
  const morning = new Date(2026, 7, 14, 9, 0, 0).getTime();
  const evening = new Date(2026, 7, 14, 21, 30, 0).getTime();

  assert.strictEqual(getTodayZeroCheckin(morning), null);

  const first = saveZeroPoopCheckin(['peu-eau', 'stress', 'peu-eau'], '  Journée chargée  ', morning);
  assert.strictEqual(first.dateKey, '2026-08-14');
  assert.deepStrictEqual([...first.tags], ['peu-eau', 'stress'], 'déduplique les étiquettes');
  assert.strictEqual(first.note, 'Journée chargée');

  // Mise à jour le soir du même jour : remplace au lieu de dupliquer
  const updated = saveZeroPoopCheckin(['voyage', 'ballonnements'], 'Train retardé', evening);
  assert.strictEqual(updated.dateKey, '2026-08-14');
  assert.strictEqual(updated.ts, evening);
  assert.strictEqual(getZeroPoopCheckins().length, 1);

  const today = getTodayZeroCheckin(morning);
  assert.deepStrictEqual([...today.tags], ['voyage', 'ballonnements']);
  assert.strictEqual(today.note, 'Train retardé');

  const stored = JSON.parse(ctx.localStorage.getItem('checkin0.v1'));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].dateKey, '2026-08-14');
});

test('saveZeroPoopCheckin : plafonne l\'historique à 90 entrées maximum', () => {
  const { saveZeroPoopCheckin, getZeroPoopCheckins } = makeEnv();
  const base = new Date(2026, 0, 1, 12, 0, 0).getTime();

  for (let i = 0; i < 105; i++) {
    saveZeroPoopCheckin(['stress'], `Jour ${i}`, base + i * 86400000);
  }

  const all = getZeroPoopCheckins();
  assert.strictEqual(all.length, 90);
  // Conserve les 90 jours les plus récents
  assert.strictEqual(all[0].note, 'Jour 104');
  assert.strictEqual(all[89].note, 'Jour 15');
});

test('renderHydrationTile met à jour #water-count, #water-bar et #zero-checkin-status', () => {
  const { registerEl, addWaterGlass, saveZeroPoopCheckin, renderHydrationTile } = makeEnv();
  const countEl = registerEl('water-count');
  const barEl = registerEl('water-bar');
  const statusEl = registerEl('zero-checkin-status');
  const now = new Date(2026, 8, 20, 14, 0, 0).getTime();

  renderHydrationTile(now);
  assert.strictEqual(countEl.textContent, '0 / 8');
  assert.strictEqual(barEl.style.width, '0%');
  assert.ok(statusEl.textContent.length > 0);

  addWaterGlass(4, now);
  assert.strictEqual(countEl.textContent, '4 / 8');
  assert.strictEqual(barEl.style.width, '50%');
  assert.strictEqual(barEl.style.background, 'var(--accent)');

  addWaterGlass(5, now);
  assert.strictEqual(countEl.textContent, '9 / 8');
  assert.strictEqual(barEl.style.width, '100%');
  assert.strictEqual(barEl.style.background, '#10b981');

  saveZeroPoopCheckin(['stress'], '', now);
  assert.ok(statusEl.textContent.includes('Stress'), 'affiche le libellé de l\'étiquette cochée');
});

// ---------- Insights différés 6–36 h (24–48 h) ----------

test('delayedTriggerInsights : repère un contexte dans les logs 6–36 h avant des selles molles', () => {
  const { delayedTriggerInsights } = makeEnv();
  const t0 = new Date(2026, 4, 1, 20, 0, 0).getTime();

  const logs = [];
  // 4 épisodes : repas épicé le soir, selle liquide 14 h plus tard le lendemain matin
  for (let i = 0; i < 4; i++) {
    const base = t0 + i * 5 * 86400000;
    logs.push(makeLog(base, { texture: 'normal', health: ['epice'] }));
    logs.push(makeLog(base + 14 * H, { texture: 'liquide' }));
  }
  // 8 selles normales éloignées dans le temps (référence sans déclencheur)
  for (let j = 0; j < 8; j++) {
    logs.push(makeLog(t0 + (40 + j * 3) * 86400000, { texture: 'normal' }));
  }

  const res = delayedTriggerInsights(logs);
  const epice = res.find(r => r.tag === 'epice');
  assert.ok(epice, 'epice doit ressortir comme déclencheur différé');
  assert.strictEqual(epice.metric, 'molles');
  assert.strictEqual(epice.count, 4);
  assert.strictEqual(epice.avecPct, 100);
  assert.strictEqual(epice.avgDelayHours, 14);
});

test('delayedTriggerInsights : exploite les check-ins « jour sans passage » précédant des selles dures', () => {
  const { delayedTriggerInsights } = makeEnv();
  const t0 = new Date(2026, 6, 1, 20, 0, 0).getTime();

  const checkins = [];
  const logs = [];
  // 3 jours sans passage avec « peu-eau » noté à 20 h, suivis d'une selle dure 22 h plus tard
  for (let i = 0; i < 3; i++) {
    const dayTs = t0 + i * 4 * 86400000;
    checkins.push({ dateKey: `2026-07-0${1 + i * 4}`, ts: dayTs, tags: ['peu-eau'], note: '' });
    logs.push(makeLog(dayTs + 22 * H, { texture: 'dur' }));
  }
  for (let j = 0; j < 6; j++) {
    logs.push(makeLog(t0 + (25 + j * 2) * 86400000, { texture: 'normal' }));
  }

  const res = delayedTriggerInsights(logs, checkins);
  const peuEau = res.find(r => r.tag === 'peu-eau');
  assert.ok(peuEau, 'peu-eau issu des check-ins zéro caca doit être détecté');
  assert.strictEqual(peuEau.metric, 'dures');
  assert.strictEqual(peuEau.count, 3);
  assert.strictEqual(peuEau.avgDelayHours, 22);
});

test('delayedTriggerInsights : repère aussi les symptômes digestifs à 6–36 h et respecte les bornes et le seuil de 3', () => {
  const { delayedTriggerInsights } = makeEnv();
  const t0 = new Date(2026, 8, 1, 12, 0, 0).getTime();

  // 3 fois « laitages » suivi 18 h plus tard de ballonnements/crampes sur selle normale
  const logs = [];
  const checkins = [];
  for (let i = 0; i < 3; i++) {
    const d = t0 + i * 4 * 86400000;
    checkins.push({ dateKey: `2026-09-0${1 + i * 4}`, ts: d, tags: ['laitages'], note: '' });
    logs.push(makeLog(d + 18 * H, { texture: 'normal', health: ['ballonnements', 'crampes'] }));
  }
  // Seulement 2 fois « gras » -> sous le seuil minimal de 3
  for (let i = 0; i < 2; i++) {
    const d = t0 + (20 + i * 4) * 86400000;
    checkins.push({ dateKey: `2026-09-2${1 + i * 4}`, ts: d, tags: ['gras'], note: '' });
    logs.push(makeLog(d + 16 * H, { texture: 'explosif' }));
  }
  // 4 fois « cafe » mais seulement 2 h avant (< 6 h) ou 48 h avant (> 36 h) -> hors fenêtre
  for (let i = 0; i < 4; i++) {
    const d = t0 + (40 + i * 5) * 86400000;
    logs.push(makeLog(d, { texture: 'normal', health: ['cafe'] }));
    logs.push(makeLog(d + 2 * H, { texture: 'liquide' }));
    logs.push(makeLog(d + 48 * H, { texture: 'liquide' }));
  }

  const res = delayedTriggerInsights(logs, checkins);
  assert.ok(res.find(r => r.tag === 'laitages' && r.metric === 'symptomes'), 'laitages -> symptômes détecté');
  assert.strictEqual(res.find(r => r.tag === 'gras'), undefined, 'moins de 3 occurrences : ignoré');
  assert.strictEqual(res.find(r => r.tag === 'cafe'), undefined, 'hors fenêtre 6–36 h : ignoré');
});

test('delayedTriggerInsights : ne déclenche pas sur un seul repas suivi de 3 selles rapprochées', () => {
  const { delayedTriggerInsights } = makeEnv();
  const t0 = new Date(2026, 9, 1, 20, 0, 0).getTime();
  const logs = [
    makeLog(t0, { texture: 'normal', health: ['epice'] }),
    makeLog(t0 + 10 * H, { texture: 'liquide' }),
    makeLog(t0 + 11 * H, { texture: 'liquide' }),
    makeLog(t0 + 12 * H, { texture: 'liquide' }),
    makeLog(t0 + 5 * 86400000, { texture: 'normal' }),
    makeLog(t0 + 6 * 86400000, { texture: 'normal' }),
    makeLog(t0 + 7 * 86400000, { texture: 'normal' }),
  ];
  assert.strictEqual(delayedTriggerInsights(logs).length, 0);
});

test('renderHealthInsights affiche les observations différées 24–48 h dans #insights-container', () => {
  const { ctx, registerEl, saveZeroPoopCheckin, renderHealthInsights } = makeEnv();
  const box = registerEl('insights-container');
  const t0 = new Date(2026, 10, 1, 20, 0, 0).getTime();

  for (let i = 0; i < 3; i++) {
    const d = t0 + i * 4 * 86400000;
    saveZeroPoopCheckin(['epice'], '', d);
    ctx.state.logs.push(makeLog(d + 20 * H, { texture: 'explosif' }));
  }
  for (let j = 0; j < 5; j++) {
    ctx.state.logs.push(makeLog(t0 + (20 + j * 2) * 86400000, { texture: 'normal' }));
  }

  renderHealthInsights();
  assert.ok(box.innerHTML.includes('24–48 h'), 'affiche la section différée 24–48 h');
  assert.ok(box.innerHTML.includes('Épicé'), 'affiche le déclencheur détecté');
});

test('openZeroPoopModal construit la modale avec HEALTH_TAGS, sauvegarde et affiche un toast', () => {
  let toasted = null;
  let appended = null;
  const listeners = {};
  const tagBtn = {
    dataset: { zeroTag: 'stress' },
    classList: { toggle() {} },
    getAttribute: k => (k === 'data-zero-tag' ? 'stress' : null),
    setAttribute() {},
    addEventListener(ev, fn) { listeners.tagClick = fn; },
  };
  const okBtn = { addEventListener(ev, fn) { listeners.okClick = fn; } };
  const cancelBtn = { addEventListener(ev, fn) { listeners.cancelClick = fn; } };
  const noteInput = { value: 'Journée au bureau' };

  const customDoc = {
    getElementById: () => null,
    body: { style: {}, appendChild(el) { appended = el; } },
    createElement() {
      return {
        id: '',
        className: '',
        innerHTML: '',
        classList: { add() {}, remove() {} },
        querySelectorAll: sel => (sel === '[data-zero-tag]' ? [tagBtn] : []),
        querySelector: sel => {
          if (sel === '[data-act="ok"]') return okBtn;
          if (sel === '[data-act="cancel"]') return cancelBtn;
          if (sel === '#zero-poop-note') return noteInput;
          return null;
        },
        addEventListener() {},
        remove() {},
      };
    },
  };

  const { openZeroPoopModal, getTodayZeroCheckin } = makeEnv({
    document: customDoc,
    UI: { toast: (msg, type) => { toasted = { msg, type }; } },
  });

  const now = new Date(2026, 10, 10, 19, 0, 0).getTime(); // 19 h, 0 verre -> peu-eau pré-suggéré
  const overlay = openZeroPoopModal(now);
  assert.ok(overlay);
  assert.strictEqual(appended, overlay);
  assert.ok(overlay.innerHTML.includes('Jour sans passage'));
  assert.ok(overlay.innerHTML.includes('Stress'));

  // Coche « stress » puis valide
  listeners.tagClick();
  listeners.okClick();

  const saved = getTodayZeroCheckin(now);
  assert.ok(saved);
  assert.ok(saved.tags.includes('stress'));
  assert.ok(saved.tags.includes('peu-eau'), 'pré-suggère peu-eau à 19 h avec 0 verre');
  assert.strictEqual(saved.note, 'Journée au bureau');
  assert.strictEqual(toasted.type, 'success');
});

