// 🔊 Bruitages 100 % hors-ligne (synthétiseur Web Audio API) + sons personnalisés

class SoundManager {
    constructor() {
        let savedVol = null;
        try { savedVol = localStorage.getItem('soundVolume'); } catch (_) {}
        const parsedVol = savedVol !== null && savedVol !== '' ? parseFloat(savedVol) : NaN;
        this.volume = Number.isFinite(parsedVol) ? Math.max(0, Math.min(1, parsedVol)) : 0.5;

        this.sounds = {
            plop:        'synth:plop',
            splash:      'synth:splash',
            wow:         'synth:wow',
            tada:        'synth:tada',
            achievement: 'synth:achievement',
            confetti:    'synth:confetti'
        };

        // Sons par défaut selon la texture
        this._defaults = {
            normal:   'plop',
            dur:      'tada',
            mou:      'splash',
            spray:    'wow',
            liquide:  'splash',
            explosif: 'confetti'
        };

        this._audioCtx = null;

        // Chargement des préférences sauvegardées
        try {
            const saved = localStorage.getItem('soundTextureMap');
            const parsed = saved ? JSON.parse(saved) : null;
            this.textureMap = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
                ? { ...this._defaults, ...parsed }
                : { ...this._defaults };
        } catch (_) {
            this.textureMap = { ...this._defaults };
        }
    }

    setVolume(level) {
        const num = Number(level);
        this.volume = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0;
        try { localStorage.setItem('soundVolume', String(this.volume)); } catch (_) {}
    }

    getVolume() {
        return this.volume;
    }

    getTextureSound(texture) {
        return this.textureMap[texture] || this._defaults[texture] || 'plop';
    }

    setTextureSound(texture, soundName) {
        this.textureMap[texture] = soundName;
        try { localStorage.setItem('soundTextureMap', JSON.stringify(this.textureMap)); } catch (_) {}
    }

    _getAudioContext() {
        try {
            if (this._audioCtx && this._audioCtx.state !== 'closed') {
                if (this._audioCtx.state === 'suspended' && typeof this._audioCtx.resume === 'function') {
                    const p = this._audioCtx.resume();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                }
                return this._audioCtx;
            }
            const Ctor = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
                || (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext))
                || null;
            if (typeof Ctor !== 'function') return null;
            this._audioCtx = new Ctor();
            if (this._audioCtx && this._audioCtx.state === 'suspended' && typeof this._audioCtx.resume === 'function') {
                const p = this._audioCtx.resume();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            }
            return this._audioCtx;
        } catch (_) {
            return null;
        }
    }

    _tone(ctx, opts) {
        if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return;
        const now = Number(ctx.currentTime) || 0;
        const t0 = now + (opts.start || 0);
        const dur = Math.max(0.02, opts.duration || 0.15);
        const t1 = t0 + dur;
        const peak = Math.max(0.0001, Math.min(1, (opts.gain ?? 0.25) * this.volume));

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = opts.type || 'sine';

        const fStart = Math.max(20, opts.freq || 440);
        if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
            osc.frequency.setValueAtTime(fStart, t0);
            if (opts.freqMid && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqMid), t0 + dur * (opts.midAt || 0.45));
            }
            if (opts.freqEnd && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t1);
            }
        } else if (osc.frequency) {
            osc.frequency.value = fStart;
        }

        const attack = Math.min(0.015, dur * 0.2);
        if (gainNode.gain && typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(0.0001, t0);
            if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
                gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
            } else {
                gainNode.gain.setValueAtTime(peak, t0 + attack);
            }
            if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
                gainNode.gain.exponentialRampToValueAtTime(0.0001, t1);
            } else if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
                gainNode.gain.linearRampToValueAtTime(0.0001, t1);
            }
        } else if (gainNode.gain) {
            gainNode.gain.value = peak;
        }

        if (opts.filterFreq && typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = opts.filterType || 'lowpass';
            if (filter.frequency && typeof filter.frequency.setValueAtTime === 'function') {
                filter.frequency.setValueAtTime(opts.filterFreq, t0);
                if (opts.filterEnd && typeof filter.frequency.exponentialRampToValueAtTime === 'function') {
                    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.filterEnd), t1);
                }
            }
            osc.connect(filter);
            filter.connect(gainNode);
        } else {
            osc.connect(gainNode);
        }

        gainNode.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t1 + 0.01);
    }

    _noise(ctx, opts) {
        if (!ctx || typeof ctx.createBuffer !== 'function' || typeof ctx.createBufferSource !== 'function' || typeof ctx.createGain !== 'function') {
            return;
        }
        const now = Number(ctx.currentTime) || 0;
        const t0 = now + (opts.start || 0);
        const dur = Math.max(0.02, opts.duration || 0.15);
        const t1 = t0 + dur;
        const sr = ctx.sampleRate || 44100;
        const frames = Math.max(1, Math.floor(sr * dur));
        const buffer = ctx.createBuffer(1, frames, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gainNode = ctx.createGain();
        const peak = Math.max(0.0001, Math.min(1, (opts.gain ?? 0.2) * this.volume));
        if (gainNode.gain && typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(peak, t0);
            if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
                gainNode.gain.exponentialRampToValueAtTime(0.0001, t1);
            }
        } else if (gainNode.gain) {
            gainNode.gain.value = peak;
        }

        if (opts.filterFreq && typeof ctx.createBiquadFilter === 'function') {
            const filter = ctx.createBiquadFilter();
            filter.type = opts.filterType || 'bandpass';
            if (filter.Q) filter.Q.value = opts.q || 1.2;
            if (filter.frequency && typeof filter.frequency.setValueAtTime === 'function') {
                filter.frequency.setValueAtTime(opts.filterFreq, t0);
                if (opts.filterEnd && typeof filter.frequency.exponentialRampToValueAtTime === 'function') {
                    filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.filterEnd), t1);
                }
            }
            src.connect(filter);
            filter.connect(gainNode);
        } else {
            src.connect(gainNode);
        }

        gainNode.connect(ctx.destination);
        src.start(t0);
        src.stop(t1 + 0.01);
    }

    _playSynth(soundName) {
        if (this.volume <= 0 || !soundName || soundName === 'aucun') return false;
        const ctx = this._getAudioContext();
        if (!ctx) return false;

        try {
            switch (soundName) {
                case 'plop':
                    // Goutte d'eau résonnante : léger impact grave puis montée de bulle
                    this._tone(ctx, { type: 'sine', freq: 130, freqEnd: 65, start: 0, duration: 0.045, gain: 0.22 });
                    this._tone(ctx, { type: 'sine', freq: 150, freqEnd: 620, start: 0.02, duration: 0.13, gain: 0.42 });
                    return true;

                case 'splash':
                    // Éclaboussure filtrée + petites bulles montantes
                    this._noise(ctx, { start: 0, duration: 0.24, gain: 0.32, filterType: 'bandpass', filterFreq: 1400, filterEnd: 380, q: 1.0 });
                    this._tone(ctx, { type: 'sine', freq: 240, freqEnd: 540, start: 0.03, duration: 0.08, gain: 0.24 });
                    this._tone(ctx, { type: 'sine', freq: 330, freqEnd: 720, start: 0.09, duration: 0.08, gain: 0.22 });
                    this._tone(ctx, { type: 'sine', freq: 420, freqEnd: 880, start: 0.15, duration: 0.09, gain: 0.18 });
                    return true;

                case 'wow':
                    // Glissando expressif montant puis redescendant
                    this._tone(ctx, {
                        type: 'triangle', freq: 185, freqMid: 540, midAt: 0.45, freqEnd: 250,
                        start: 0, duration: 0.42, gain: 0.36,
                        filterType: 'lowpass', filterFreq: 500, filterEnd: 1800
                    });
                    this._tone(ctx, {
                        type: 'sine', freq: 370, freqMid: 1080, midAt: 0.45, freqEnd: 500,
                        start: 0, duration: 0.42, gain: 0.16
                    });
                    return true;

                case 'tada':
                    // Fanfare cuivrée : anacrouse Sol4 puis accord majeur Do5-Mi5-Sol5
                    this._tone(ctx, { type: 'sawtooth', freq: 392.0, start: 0, duration: 0.10, gain: 0.22, filterType: 'lowpass', filterFreq: 2200 });
                    this._tone(ctx, { type: 'sawtooth', freq: 523.25, start: 0.11, duration: 0.38, gain: 0.22, filterType: 'lowpass', filterFreq: 2600 });
                    this._tone(ctx, { type: 'triangle', freq: 659.25, start: 0.11, duration: 0.38, gain: 0.22 });
                    this._tone(ctx, { type: 'triangle', freq: 783.99, start: 0.11, duration: 0.40, gain: 0.20 });
                    return true;

                case 'achievement':
                    // Carillon de trophée ascendant Do5 -> Mi5 -> Sol5 -> Do6
                    this._tone(ctx, { type: 'sine', freq: 523.25, start: 0.00, duration: 0.14, gain: 0.28 });
                    this._tone(ctx, { type: 'sine', freq: 659.25, start: 0.07, duration: 0.14, gain: 0.28 });
                    this._tone(ctx, { type: 'sine', freq: 783.99, start: 0.14, duration: 0.16, gain: 0.30 });
                    this._tone(ctx, { type: 'sine', freq: 1046.50, start: 0.21, duration: 0.38, gain: 0.36 });
                    this._tone(ctx, { type: 'triangle', freq: 2093.00, start: 0.22, duration: 0.32, gain: 0.12 });
                    return true;

                case 'confetti':
                    // Pétard festif : impact suivi d'étincelles aiguës
                    this._tone(ctx, { type: 'triangle', freq: 210, freqEnd: 48, start: 0, duration: 0.07, gain: 0.40 });
                    this._noise(ctx, { start: 0, duration: 0.07, gain: 0.35, filterType: 'bandpass', filterFreq: 1800, filterEnd: 700, q: 0.9 });
                    this._tone(ctx, { type: 'sine', freq: 980, freqEnd: 1420, start: 0.07, duration: 0.07, gain: 0.20 });
                    this._tone(ctx, { type: 'sine', freq: 1240, freqEnd: 1760, start: 0.13, duration: 0.07, gain: 0.18 });
                    this._tone(ctx, { type: 'sine', freq: 1080, freqEnd: 1620, start: 0.19, duration: 0.08, gain: 0.16 });
                    this._noise(ctx, { start: 0.10, duration: 0.16, gain: 0.18, filterType: 'highpass', filterFreq: 2400 });
                    return true;

                default:
                    return false;
            }
        } catch (_) {
            return false;
        }
    }

    play(soundName) {
        if (this.volume <= 0 || !soundName || soundName === 'aucun') return;
        if (!this.sounds[soundName]) return;
        this._playSynth(soundName);
    }

    playDataUrl(dataUrl) {
        if (this.volume <= 0 || !dataUrl) return;
        const AudioCtor = (typeof window !== 'undefined' && window.Audio)
            || (typeof Audio !== 'undefined' ? Audio : null);
        if (typeof AudioCtor !== 'function') return;
        try {
            const audio = new AudioCtor(dataUrl);
            audio.volume = this.volume;
            const p = audio.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
    }

    getCustomSound(texture) {
        try { return localStorage.getItem('customSound_' + texture) || null; }
        catch (_) { return null; }
    }

    setCustomSound(texture, dataUrl) {
        try { localStorage.setItem('customSound_' + texture, dataUrl); }
        catch (_) { window.UI?.toast('Son trop volumineux (max ~2 Mo).', 'error'); }
    }

    clearCustomSound(texture) {
        try { localStorage.removeItem('customSound_' + texture); }
        catch (_) {}
    }

    // Joue le son correspondant à la texture du caca
    playPoopAdded(texture) {
        const tex = texture || 'normal';
        const custom = this.getCustomSound(tex);
        if (custom) {
            this.playDataUrl(custom);
            return;
        }
        this.play(this.getTextureSound(tex));
    }

    playAchievementUnlocked() { this.play('achievement'); }
    playStreak()              { this.play('tada'); }
    playConfetti()            { this.play('confetti'); }
}

// Instance globale
const soundManager = new SoundManager();

// Labels lisibles pour les sons
const SOUND_LABELS = {
    plop:        '💧 Plop classique',
    splash:      '🫧 Splash',
    wow:         '😮 Wow !',
    tada:        '🎺 Trompette',
    achievement: '🏆 Achievement',
    confetti:    '🎉 Pétards',
    aucun:       '🔇 Aucun son'
};

// Labels et emojis pour les textures
const TEXTURE_LABELS = {
    normal:   '💩 Normal',
    dur:      '🗿 Dur',
    mou:      '🍮 Mou',
    spray:    '💦 Spray',
    liquide:  '🌊 Liquide',
    explosif: '💥 Explosif'
};

// UI contrôle volume + sons par texture (thématisée clair/sombre)
function createSoundControl() {
    const rows = Object.keys(TEXTURE_LABELS).map(tex => {
        const cur = soundManager.getTextureSound(tex);
        const hasCustom = Boolean(soundManager.getCustomSound(tex));
        return `
        <div class="flex items-center gap-2 py-1">
          <span class="text-sm w-28 font-bold" style="color:var(--text-primary)">${TEXTURE_LABELS[tex]}</span>
          <select class="flex-1 text-xs p-1.5 rounded-lg border focus:outline-none"
                  style="background:var(--card-bg);color:var(--text-primary);border-color:var(--card-border)"
                  onchange="soundManager.setTextureSound('${tex}', this.value)"
                  data-tex="${tex}"
                  aria-label="Son pour ${TEXTURE_LABELS[tex]}">
            ${Object.keys(SOUND_LABELS).map(s =>
                `<option value="${s}" style="background:var(--card-bg);color:var(--text-primary)"${s === cur ? ' selected' : ''}>${SOUND_LABELS[s]}</option>`
            ).join('')}
          </select>
          <button type="button"
                  onclick="soundManager.playPoopAdded('${tex}')"
                  class="text-sm px-2 py-1 rounded-lg border"
                  style="background:color-mix(in srgb,var(--accent) 15%,var(--card-bg));color:var(--accent);border-color:var(--card-border)"
                  title="Écouter"
                  aria-label="Écouter ${TEXTURE_LABELS[tex]}">▶️</button>
          <label class="text-sm px-2 py-1 rounded-lg border cursor-pointer"
                 title="Son personnalisé"
                 style="position:relative;background:var(--card-bg);color:var(--text-secondary);border-color:var(--card-border)">
            📁
            <input type="file" accept="audio/*" class="hidden"
              onchange="(function(f,t){if(!f)return;const r=new FileReader();r.onload=e=>{soundManager.setCustomSound(t,e.target.result);const el=document.getElementById('sound-settings');if(el)el.innerHTML=createSoundControl();window.UI?.toast('Son personnalisé enregistré','success')};r.readAsDataURL(f)})(this.files[0],'${tex}')">
          </label>
          ${hasCustom ? `<button type="button" onclick="soundManager.clearCustomSound('${tex}');const el=document.getElementById('sound-settings');if(el)el.innerHTML=createSoundControl();window.UI?.toast('Son personnalisé supprimé','info')" class="text-xs px-2 py-1 rounded-lg border font-bold" style="background:var(--card-bg);color:var(--text-secondary);border-color:var(--card-border)" title="Supprimer son custom" aria-label="Supprimer son personnalisé">✕</button>` : ''}
        </div>`;
    }).join('');

    const volPct = Math.round(soundManager.getVolume() * 100);

    return `
        <div class="space-y-3" style="color:var(--text-primary)">
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold" style="color:var(--text-primary)">🔊 Volume</span>
            <input type="range" id="volumeSlider" min="0" max="100"
                   value="${volPct}"
                   class="flex-1 cursor-pointer"
                   style="accent-color:var(--accent)"
                   oninput="soundManager.setVolume(this.value / 100); const lbl = document.getElementById('volumeLabel'); if (lbl) lbl.textContent = this.value + '%';"
                   onchange="soundManager.play('plop');">
            <span id="volumeLabel" class="text-sm font-bold w-10 text-right" style="color:var(--accent)">${volPct}%</span>
          </div>
          <div class="pt-3 space-y-1.5" style="border-top:1px solid var(--card-border)">
            <div class="text-xs font-bold mb-2" style="color:var(--text-secondary)">Son par texture</div>
            ${rows}
          </div>
        </div>`;
}
