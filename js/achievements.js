// 🏆 Système d'achievements pour gamifier l'expérience

const ACHIEVEMENTS = {
    first_poop: {
        id: 'first_poop',
        name: '🎉 Premier Caca',
        description: 'Félicitations ! Tu as enregistré ton premier caca !',
        icon: '🎉',
        check: (poops) => poops.length >= 1
    },
    ten_poops: {
        id: 'ten_poops',
        name: '💪 Décade Parfaite',
        description: '10 cacas enregistrés !',
        icon: '💪',
        check: (poops) => poops.length >= 10
    },
    hundred_poops: {
        id: 'hundred_poops',
        name: '🚀 Centenaire',
        description: '100 cacas ! Tu es une machine !',
        icon: '🚀',
        check: (poops) => poops.length >= 100
    },
    perfect_week: {
        id: 'perfect_week',
        name: '⭐ Régularité Parfaite',
        description: '7 jours d\'affilée à la même heure (±30min)',
        icon: '⭐',
        check: (poops) => {
            if (poops.length < 7) return false;
            // poops est trié du plus récent au plus ancien, slice(0,7) = 7 derniers
            const last7 = poops.slice(0, 7);
            const hours = last7.map(p => new Date(p.date).getHours());
            const avgHour = hours.reduce((a,b) => a+b) / hours.length;
            return hours.every(h => Math.abs(h - avgHour) <= 0.5);
        }
    },
    morning_person: {
        id: 'morning_person',
        name: '🌅 Lève-Tôt',
        description: '10 cacas avant 8h du matin',
        icon: '🌅',
        check: (poops) => {
            const morningPoops = poops.filter(p => new Date(p.date).getHours() < 8);
            return morningPoops.length >= 10;
        }
    },
    night_owl: {
        id: 'night_owl',
        name: '🦉 Oiseau de Nuit',
        description: '10 cacas après 22h',
        icon: '🦉',
        check: (poops) => {
            const nightPoops = poops.filter(p => new Date(p.date).getHours() >= 22);
            return nightPoops.length >= 10;
        }
    },
    rainbow: {
        id: 'rainbow',
        name: '🌈 Artiste',
        description: 'Toutes les couleurs utilisées',
        icon: '🌈',
        check: (poops) => {
            const colors = ['marron', 'vert', 'jaune', 'noir', 'rouge'];
            const usedColors = [...new Set(poops.map(p => p.color))];
            return colors.every(c => usedColors.includes(c));
        }
    },
    streak_7: {
        id: 'streak_7',
        name: '🔥 Semaine Enflamée',
        description: '7 jours d\'affilée',
        icon: '🔥',
        check: (poops) => getCurrentStreak(poops) >= 7
    },
    streak_30: {
        id: 'streak_30',
        name: '🌟 Mois Magique',
        description: '30 jours d\'affilée !',
        icon: '🌟',
        check: (poops) => getCurrentStreak(poops) >= 30
    },
    record_month: {
        id: 'record_month',
        name: '🏆 Record du Mois',
        description: 'Plus de cacas ce mois-ci que le mois dernier',
        icon: '🏆',
        check: (poops) => {
            const now = new Date();
            const thisMonth = poops.filter(p => {
                const d = new Date(p.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length;
            const lastMonth = poops.filter(p => {
                const d = new Date(p.date);
                const lastM = new Date(now.getFullYear(), now.getMonth() - 1);
                return d.getMonth() === lastM.getMonth() && d.getFullYear() === lastM.getFullYear();
            }).length;
            return lastMonth > 0 && thisMonth > lastMonth;
        }
    }
};

// Fonction helper pour calculer le streak
function getCurrentStreak(poops) {
    if (poops.length === 0) return 0;
    
    const sortedPoops = [...poops].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 1;
    let currentDate = new Date(sortedPoops[0].date);
    
    for (let i = 1; i < sortedPoops.length; i++) {
        const poopDate = new Date(sortedPoops[i].date);
        const dayDiff = Math.floor((currentDate - poopDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
            streak++;
            currentDate = poopDate;
        } else if (dayDiff > 1) {
            break;
        }
    }
    
    return streak;
}

class AchievementManager {
    constructor() {
        this.unlockedAchievements = JSON.parse(localStorage.getItem('unlockedAchievements')) || [];
    }

    checkAchievements(poops) {
        const newlyUnlocked = [];
        
        for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
            if (!this.unlockedAchievements.includes(achievement.id)) {
                if (achievement.check(poops)) {
                    this.unlockedAchievements.push(achievement.id);
                    newlyUnlocked.push(achievement);
                }
            }
        }
        
        if (newlyUnlocked.length > 0) {
            localStorage.setItem('unlockedAchievements', JSON.stringify(this.unlockedAchievements));
        }
        
        return newlyUnlocked;
    }

    getUnlockedCount() {
        return this.unlockedAchievements.length;
    }

    getTotalCount() {
        return Object.keys(ACHIEVEMENTS).length;
    }

    showAchievementPopup(achievement) {
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-details">
                    <h3>Achievement Débloqué !</h3>
                    <p class="achievement-name">${achievement.name}</p>
                    <p class="achievement-desc">${achievement.description}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        soundManager.playAchievementUnlocked();
        
        setTimeout(() => popup.classList.add('show'), 100);
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 4000);
    }
}

// Instance globale
const achievementManager = new AchievementManager();

// UI pour afficher les achievements
function createAchievementsUI(poops) {
    const unlocked = achievementManager.unlockedAchievements;
    let html = '<div class="achievements-section">';
    html += `<h3>🏆 Achievements (${achievementManager.getUnlockedCount()}/${achievementManager.getTotalCount()})</h3>`;
    html += '<div class="achievements-grid">';
    
    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        const isUnlocked = unlocked.includes(achievement.id);
        html += `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${isUnlocked ? achievement.icon : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.description}</div>
                </div>
            </div>
        `;
    }
    
    html += '</div></div>';
    return html;
}
