// Tests de js/sounds.js — Synthétiseur Web Audio API 100 % hors-ligne & UI thématisée

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadInto, readGlobals, ROOT } = require('./helpers/load');

const SOUNDS_PATH = path.join(ROOT, 'js', 'sounds.js');
const soundsSource = fs.readFileSync(SOUNDS_PATH, 'utf8');

/** Fabrique un faux AudioContext traçant les nœuds et enveloppes créés. */
function createMockAudioEnv(initialState = 'running') {
  const records = {
    instances: 0,
    resumed: 0,
    oscillators: [],
    gains: [],
    filters: [],
    buffers: [],
  };

  class MockAudioContext {
    constructor() {
      records.instances += 1;
      this.state = initialState;
      this.currentTime = 0;
      this.sampleRate = 22050;
      this.destination = { kind: 'destination' };
    }
    resume() {
      records.resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: {
          value: 440,
          events: [],
          setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); },
          exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); },
          linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); },
        },
        connectedTo: null,
        startedAt: null,
        stoppedAt: null,
        connect(dest) { this.connectedTo = dest; return dest; },
        start(t) { this.startedAt = t; },
        stop(t) { this.stoppedAt = t; },
      };
      records.oscillators.push(osc);
      return osc;
    }
    createGain() {
      const g = {
        gain: {
          value: 1,
          events: [],
          setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); },
          linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); },
          exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); },
        },
        connectedTo: null,
        connect(dest) { this.connectedTo = dest; return dest; },
      };
      records.gains.push(g);
      return g;
    }
    createBiquadFilter() {
      const f = {
        type: 'lowpass',
        Q: { value: 1 },
        frequency: {
          value: 1000,
          events: [],
          setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); },
          exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); },
        },
        connectedTo: null,
        connect(dest) { this.connectedTo = dest; return dest; },
      };
      records.filters.push(f);
      return f;
    }
    createBuffer(channels, length, sampleRate) {
      const arr = new Float32Array(length);
      return {
        channels,
        length,
        sampleRate,
        getChannelData: () => arr,
      };
    }
    createBufferSource() {
      const src = {
        buffer: null,
        connectedTo: null,
        startedAt: null,
        stoppedAt: null,
        connect(dest) { this.connectedTo = dest; return dest; },
        start(t) { this.startedAt = t; },
        stop(t) { this.stoppedAt = t; },
      };
      records.buffers.push(src);
      return src;
    }
  }

  return { MockAudioContext, records };
}

test('js/sounds.js ne contient aucune URL http/https ni syntaxe ES module', () => {
  assert.doesNotMatch(soundsSource, /https?:\/\//i, 'aucune URL externe ne doit subsister');
  assert.doesNotMatch(soundsSource, /\bhttps?\b/i, 'aucune mention http/https ne doit subsister');
  assert.doesNotMatch(soundsSource, /^\s*(import|export)\s/m, 'doit rester un script classique compatible node:vm');
});

test('expose SoundManager, soundManager, SOUND_LABELS, TEXTURE_LABELS et createSoundControl', () => {
  const ctx = loadInto('js/sounds.js');
  const { SoundManager, soundManager, SOUND_LABELS, TEXTURE_LABELS } = readGlobals(ctx, [
    'SoundManager', 'soundManager', 'SOUND_LABELS', 'TEXTURE_LABELS',
  ]);

  assert.strictEqual(typeof SoundManager, 'function');
  assert.ok(soundManager instanceof SoundManager);
  assert.strictEqual(typeof ctx.createSoundControl, 'function');

  const expectedSounds = ['plop', 'splash', 'wow', 'tada', 'achievement', 'confetti'];
  for (const s of expectedSounds) {
    assert.ok(soundManager.sounds[s], `son ${s} présent dans soundManager.sounds`);
    assert.ok(SOUND_LABELS[s], `label présent pour ${s}`);
  }
  assert.ok(SOUND_LABELS.aucun, 'label présent pour aucun');

  const expectedTextures = ['normal', 'dur', 'mou', 'spray', 'liquide', 'explosif'];
  for (const t of expectedTextures) {
    assert.ok(TEXTURE_LABELS[t], `label présent pour la texture ${t}`);
  }

  const methods = [
    'setVolume', 'getVolume', 'getTextureSound', 'setTextureSound',
    'play', 'playDataUrl', 'getCustomSound', 'setCustomSound', 'clearCustomSound',
    'playPoopAdded', 'playAchievementUnlocked', 'playStreak', 'playConfetti', '_playSynth',
  ];
  for (const m of methods) {
    assert.strictEqual(typeof soundManager[m], 'function', `méthode ${m} conservée`);
  }
});

test('ne plante jamais sans AudioContext ni Audio (environnement node:vm)', () => {
  const ctx = loadInto('js/sounds.js');
  const { soundManager } = readGlobals(ctx, ['soundManager']);

  assert.doesNotThrow(() => {
    for (const s of ['plop', 'splash', 'wow', 'tada', 'achievement', 'confetti', 'aucun', 'inconnu', '']) {
      soundManager.play(s);
    }
    soundManager.playPoopAdded('normal');
    soundManager.playPoopAdded('explosif');
    soundManager.playPoopAdded();
    soundManager.playAchievementUnlocked();
    soundManager.playStreak();
    soundManager.playConfetti();
    soundManager.playDataUrl('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA');
  });

  // Même si AudioContext lève une exception à l'instanciation
  const ctxBroken = loadInto('js/sounds.js', {
    AudioContext: function BrokenAudioContext() { throw new Error('Audio blocked'); },
  });
  const { soundManager: smBroken } = readGlobals(ctxBroken, ['soundManager']);
  assert.doesNotThrow(() => smBroken.play('plop'));
});

test('synthétise les 6 sons via Web Audio API et module le gain selon le volume', () => {
  const { MockAudioContext, records } = createMockAudioEnv('suspended');
  const ctx = loadInto('js/sounds.js', { webkitAudioContext: MockAudioContext });
  const { soundManager } = readGlobals(ctx, ['soundManager']);

  for (const name of ['plop', 'splash', 'wow', 'tada', 'achievement', 'confetti']) {
    const oscBefore = records.oscillators.length;
    soundManager.play(name);
    assert.ok(records.oscillators.length > oscBefore, `${name} doit générer au moins un oscillateur`);
  }
  assert.ok(records.resumed >= 1, 'un AudioContext suspendu doit être relancé via resume()');
  assert.strictEqual(records.instances, 1, 'réutilise la même instance AudioContext');

  // Vérifie la modulation par this.volume
  const envFull = createMockAudioEnv();
  const ctxFull = loadInto('js/sounds.js', { AudioContext: envFull.MockAudioContext });
  const { soundManager: smFull } = readGlobals(ctxFull, ['soundManager']);
  smFull.setVolume(1);
  smFull.play('plop');

  const envQuarter = createMockAudioEnv();
  const ctxQuarter = loadInto('js/sounds.js', { AudioContext: envQuarter.MockAudioContext });
  const { soundManager: smQuarter } = readGlobals(ctxQuarter, ['soundManager']);
  smQuarter.setVolume(0.25);
  smQuarter.play('plop');

  const peakFull = envFull.records.gains[1].gain.events.find(e => e[0] === 'lin')[1];
  const peakQuarter = envQuarter.records.gains[1].gain.events.find(e => e[0] === 'lin')[1];
  assert.ok(Math.abs(peakQuarter - peakFull * 0.25) < 1e-6, 'le pic de gain doit être proportionnel au volume');

  // Volume à 0 ou son "aucun" : aucun nœud créé
  const countBeforeMute = envQuarter.records.oscillators.length;
  smQuarter.play('aucun');
  smQuarter.setVolume(0);
  smQuarter.play('tada');
  assert.strictEqual(envQuarter.records.oscillators.length, countBeforeMute, 'aucun son joué quand muet ou aucun');
});

test('persiste le volume (y compris 0) et le mapping des textures dans localStorage', () => {
  const ctx = loadInto('js/sounds.js');
  const { SoundManager, soundManager } = readGlobals(ctx, ['SoundManager', 'soundManager']);

  assert.strictEqual(soundManager.getVolume(), 0.5, 'volume par défaut à 0.5');

  soundManager.setVolume(1.8);
  assert.strictEqual(soundManager.getVolume(), 1, 'borne supérieure à 1');

  soundManager.setVolume(-0.4);
  assert.strictEqual(soundManager.getVolume(), 0, 'borne inférieure à 0');

  // Vérifie qu'un volume sauvegardé à 0 reste bien à 0 à la réinstanciation (pas de repli fautif sur 0.5)
  const reloadedZero = new SoundManager();
  assert.strictEqual(reloadedZero.getVolume(), 0, 'volume 0 persisté fidèlement');

  soundManager.setVolume(0.75);
  soundManager.setTextureSound('normal', 'achievement');
  soundManager.setTextureSound('dur', 'aucun');

  const reloaded = new SoundManager();
  assert.strictEqual(reloaded.getVolume(), 0.75);
  assert.strictEqual(reloaded.getTextureSound('normal'), 'achievement');
  assert.strictEqual(reloaded.getTextureSound('dur'), 'aucun');
  assert.strictEqual(reloaded.getTextureSound('explosif'), 'confetti');
  assert.strictEqual(reloaded.getTextureSound('texture_inconnue'), 'plop');

  // JSON corrompu dans localStorage : repli propre sur les valeurs par défaut
  ctx.localStorage.setItem('soundTextureMap', '{invalide');
  const safeReloaded = new SoundManager();
  assert.strictEqual(safeReloaded.getTextureSound('normal'), 'plop');
});

test('gère les sons personnalisés en DataURL et le repli vers le synthétiseur', () => {
  const playedAudio = [];
  class MockAudio {
    constructor(src) {
      this.src = src;
      this.volume = 1;
    }
    play() {
      playedAudio.push({ src: this.src, volume: this.volume });
      return Promise.resolve();
    }
  }

  const { MockAudioContext, records } = createMockAudioEnv();
  const toasts = [];
  const ctx = loadInto('js/sounds.js', {
    Audio: MockAudio,
    AudioContext: MockAudioContext,
    UI: { toast: (msg, type) => toasts.push({ msg, type }) },
  });
  const { soundManager } = readGlobals(ctx, ['soundManager']);

  soundManager.setVolume(0.6);
  const dataUrl = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA';
  assert.strictEqual(soundManager.getCustomSound('mou'), null);

  soundManager.setCustomSound('mou', dataUrl);
  assert.strictEqual(soundManager.getCustomSound('mou'), dataUrl);

  soundManager.playPoopAdded('mou');
  assert.strictEqual(playedAudio.length, 1, 'joue le DataURL personnalisé');
  assert.strictEqual(playedAudio[0].src, dataUrl);
  assert.strictEqual(playedAudio[0].volume, 0.6);
  assert.strictEqual(records.oscillators.length, 0, 'ne déclenche pas le synthé quand un son custom existe');

  soundManager.clearCustomSound('mou');
  assert.strictEqual(soundManager.getCustomSound('mou'), null);

  soundManager.playPoopAdded('mou');
  assert.ok(records.oscillators.length > 0, 'revient au synthé après suppression du son custom');

  // Dépassement de quota localStorage géré proprement avec toast d'erreur
  ctx.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.doesNotThrow(() => soundManager.setCustomSound('normal', dataUrl));
  assert.strictEqual(toasts.length, 1);
  assert.strictEqual(toasts[0].type, 'error');
});

test('createSoundControl() utilise les variables CSS des thèmes et reflète l’état courant', () => {
  const ctx = loadInto('js/sounds.js');
  const { soundManager } = readGlobals(ctx, ['soundManager']);

  soundManager.setVolume(0.65);
  soundManager.setTextureSound('spray', 'tada');
  soundManager.setCustomSound('explosif', 'data:audio/wav;base64,AAAA');

  const html = ctx.createSoundControl();

  // Variables CSS requises pour la lisibilité sur les 16 thèmes (dont dark, galaxy, neon)
  for (const cssVar of [
    'var(--card-bg)',
    'var(--card-border)',
    'var(--text-primary)',
    'var(--text-secondary)',
    'var(--accent)',
  ]) {
    assert.ok(html.includes(cssVar), `createSoundControl() doit utiliser ${cssVar}`);
  }

  // Aucune classe claire codée en dur susceptible de casser les thèmes sombres
  assert.doesNotMatch(html, /border-gray-(100|200)|bg-white|text-slate-|text-gray-/);

  // Contrôle du volume et sélecteurs par texture
  assert.ok(html.includes('id="volumeSlider"'));
  assert.ok(html.includes('id="volumeLabel"'));
  assert.ok(html.includes('65%'));
  for (const tex of ['normal', 'dur', 'mou', 'spray', 'liquide', 'explosif']) {
    assert.ok(html.includes(`data-tex="${tex}"`), `select présent pour ${tex}`);
  }
  assert.match(html, /data-tex="spray"[\s\S]*?<option value="tada"[^>]*selected>🎺 Trompette<\/option>/);
  assert.ok(html.includes('Supprimer son custom'), 'affiche le bouton de suppression pour la texture ayant un son custom');
});
