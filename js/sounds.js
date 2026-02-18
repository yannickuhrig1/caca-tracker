// 🔊 Sons marrants pour rendre l'ajout de caca fun

class SoundManager {
    constructor() {
        this.volume = parseFloat(localStorage.getItem('soundVolume')) || 0.5;
        this.sounds = {
            plop: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
            splash: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3', 
            wow: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
            tada: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
            achievement: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
            confetti: 'https://assets.mixkit.co/active_storage/sfx/1434/1434-preview.mp3'
        };
    }

    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
        localStorage.setItem('soundVolume', this.volume);
    }

    getVolume() {
        return this.volume;
    }

    play(soundName) {
        if (this.volume === 0) return;
        
        const soundUrl = this.sounds[soundName];
        if (!soundUrl) return;

        const audio = new Audio(soundUrl);
        audio.volume = this.volume;
        audio.play().catch(e => console.log('Sound play failed:', e));
    }

    // Sons spécifiques pour différentes actions
    playPoopAdded() {
        this.play('plop');
    }

    playAchievementUnlocked() {
        this.play('achievement');
    }

    playStreak() {
        this.play('tada');
    }

    playConfetti() {
        this.play('confetti');
    }
}

// Instance globale
const soundManager = new SoundManager();

// UI pour le contrôle du volume
function createSoundControl() {
    return `
        <div class="sound-control">
            <span>🔊 Volume:</span>
            <input type="range" 
                   id="volumeSlider" 
                   min="0" 
                   max="100" 
                   value="${soundManager.getVolume() * 100}"
                   oninput="soundManager.setVolume(this.value / 100); document.getElementById('volumeLabel').textContent = this.value + '%';"
                   onchange="soundManager.play('plop');">
            <span id="volumeLabel">${Math.round(soundManager.getVolume() * 100)}%</span>
        </div>
    `;
}
