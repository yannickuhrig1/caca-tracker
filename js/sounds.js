// 🔊 Sons marrants pour rendre l'ajout de caca fun

class SoundManager {
    constructor() {
        this.volume = parseFloat(localStorage.getItem('soundVolume')) || 0.5;
        this.sounds = {
            plop:        'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
            splash:      'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3',
            wow:         'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
            tada:        'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
            achievement: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
            confetti:    'https://assets.mixkit.co/active_storage/sfx/1434/1434-preview.mp3'
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

        // Chargement des préférences sauvegardées
        try {
            const saved = localStorage.getItem('soundTextureMap');
            this.textureMap = saved ? JSON.parse(saved) : { ...this._defaults };
        } catch(e) {
            this.textureMap = { ...this._defaults };
        }
    }

    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
        localStorage.setItem('soundVolume', this.volume);
    }

    getVolume() {
        return this.volume;
    }

    getTextureSound(texture) {
        return this.textureMap[texture] || this._defaults[texture] || 'plop';
    }

    setTextureSound(texture, soundName) {
        this.textureMap[texture] = soundName;
        localStorage.setItem('soundTextureMap', JSON.stringify(this.textureMap));
    }

    play(soundName) {
        if (this.volume === 0 || soundName === 'aucun') return;
        const soundUrl = this.sounds[soundName];
        if (!soundUrl) return;
        const audio = new Audio(soundUrl);
        audio.volume = this.volume;
        audio.play().catch(e => console.log('Sound play failed:', e));
    }

    // Joue le son correspondant à la texture du caca
    playPoopAdded(texture) {
        this.play(this.getTextureSound(texture || 'normal'));
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

// UI contrôle volume + sons par texture
function createSoundControl() {
    const soundOptions = ['plop','splash','wow','tada','achievement','confetti','aucun']
        .map(s => `<option value="${s}">${SOUND_LABELS[s]}</option>`).join('');

    const rows = Object.keys(TEXTURE_LABELS).map(tex => {
        const cur = soundManager.getTextureSound(tex);
        return `
        <div class="flex items-center gap-2 py-1">
          <span class="text-sm w-28 font-bold">${TEXTURE_LABELS[tex]}</span>
          <select class="flex-1 text-xs p-1 rounded-lg border border-gray-200 focus:outline-none"
                  onchange="soundManager.setTextureSound('${tex}', this.value)"
                  data-tex="${tex}">
            ${Object.keys(SOUND_LABELS).map(s =>
                `<option value="${s}"${s === cur ? ' selected' : ''}>${SOUND_LABELS[s]}</option>`
            ).join('')}
          </select>
          <button onclick="soundManager.play(soundManager.getTextureSound('${tex}'))"
                  class="text-lg" title="Écouter">▶️</button>
        </div>`;
    }).join('');

    return `
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold">🔊 Volume</span>
            <input type="range" id="volumeSlider" min="0" max="100"
                   value="${soundManager.getVolume() * 100}"
                   class="flex-1"
                   oninput="soundManager.setVolume(this.value / 100); document.getElementById('volumeLabel').textContent = this.value + '%';"
                   onchange="soundManager.play('plop');">
            <span id="volumeLabel" class="text-sm font-bold w-10 text-right">${Math.round(soundManager.getVolume() * 100)}%</span>
          </div>
          <div class="border-t border-gray-100 pt-3 space-y-1">
            <div class="text-xs font-bold opacity-60 mb-2">Son par texture</div>
            ${rows}
          </div>
        </div>`;
}
