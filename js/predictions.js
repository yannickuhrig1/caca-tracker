// 🔮 Prédictions basées sur l'historique

class PredictionEngine {
    constructor(poops) {
        // state.logs est trié du plus récent au plus ancien ; on remet en ordre croissant
        this.poops = [...poops].sort((a, b) => a.date - b.date);
    }

    // Calcule l'heure moyenne des cacas
    getAveragePoopTime() {
        if (this.poops.length === 0) return null;
        
        const hours = this.poops.map(p => {
            const date = new Date(p.date);
            return date.getHours() + date.getMinutes() / 60;
        });
        
        const avgHours = hours.reduce((a, b) => a + b, 0) / hours.length;
        const hour = Math.floor(avgHours);
        const minutes = Math.round((avgHours - hour) * 60);
        
        return { hour, minutes, avgHours };
    }

    // Prédit le prochain caca
    predictNextPoop() {
        if (this.poops.length < 2) {
            return {
                message: '🤔 Pas encore assez de données pour prédire',
                confidence: 0
            };
        }

        const lastPoop = new Date(this.poops[this.poops.length - 1].date);
        const intervals = [];
        
        // Calcule les intervalles entre les cacas
        for (let i = 1; i < this.poops.length; i++) {
            const prev = new Date(this.poops[i - 1].date);
            const curr = new Date(this.poops[i].date);
            const hoursDiff = (curr - prev) / (1000 * 60 * 60);
            intervals.push(hoursDiff);
        }
        
        // Intervalle moyen
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const nextPoopTime = new Date(lastPoop.getTime() + avgInterval * 60 * 60 * 1000);
        
        const now = new Date();
        const hoursUntil = Math.max(0, (nextPoopTime - now) / (1000 * 60 * 60));
        
        let message;
        let icon;
        
        if (hoursUntil < 1) {
            message = `🚨 Prochain caca IMMINENT ! Dans ${Math.round(hoursUntil * 60)} minutes`;
            icon = '🚨';
        } else if (hoursUntil < 24) {
            message = `🕒 Prochain caca estimé dans ${Math.round(hoursUntil)} heures`;
            icon = '🕒';
        } else {
            message = `📅 Prochain caca estimé dans ${Math.round(hoursUntil / 24)} jours`;
            icon = '📅';
        }
        
        // Calcul de la confiance basée sur la régularité
        const stdDev = Math.sqrt(
            intervals.map(x => Math.pow(x - avgInterval, 2))
                     .reduce((a, b) => a + b, 0) / intervals.length
        );
        const confidence = Math.max(0, Math.min(100, 100 - (stdDev / avgInterval) * 100));
        
        return {
            message,
            icon,
            nextTime: nextPoopTime,
            hoursUntil,
            confidence: Math.round(confidence)
        };
    }

    // Identifie l'heure préférée de la journée
    getFavoriteTimeOfDay() {
        if (this.poops.length === 0) return null;
        
        const periods = {
            morning: 0,    // 5h-12h
            afternoon: 0,  // 12h-18h
            evening: 0,    // 18h-22h
            night: 0       // 22h-5h
        };
        
        this.poops.forEach(p => {
            const hour = new Date(p.date).getHours();
            if (hour >= 5 && hour < 12) periods.morning++;
            else if (hour >= 12 && hour < 18) periods.afternoon++;
            else if (hour >= 18 && hour < 22) periods.evening++;
            else periods.night++;
        });
        
        const maxPeriod = Object.entries(periods)
            .reduce((a, b) => a[1] > b[1] ? a : b);
        
        const periodNames = {
            morning: '🌅 Matin (5h-12h)',
            afternoon: '☀️ Après-midi (12h-18h)',
            evening: '🌆 Soirée (18h-22h)',
            night: '🌙 Nuit (22h-5h)'
        };
        
        return {
            period: maxPeriod[0],
            name: periodNames[maxPeriod[0]],
            count: maxPeriod[1],
            percentage: Math.round((maxPeriod[1] / this.poops.length) * 100)
        };
    }

    // Analyse les tendances hebdomadaires
    getWeeklyPattern() {
        if (this.poops.length === 0) return null;
        
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const dayCount = [0, 0, 0, 0, 0, 0, 0];
        
        this.poops.forEach(p => {
            const day = new Date(p.date).getDay();
            dayCount[day]++;
        });
        
        const maxDay = dayCount.indexOf(Math.max(...dayCount));
        const minDay = dayCount.indexOf(Math.min(...dayCount));
        
        return {
            bestDay: days[maxDay],
            worstDay: days[minDay],
            counts: dayCount.map((count, i) => ({ day: days[i], count }))
        };
    }
}

// UI pour afficher les prédictions
function createPredictionsUI(poops) {
    const predictor = new PredictionEngine(poops);
    const prediction = predictor.predictNextPoop();
    const avgTime = predictor.getAveragePoopTime();
    const favoriteTime = predictor.getFavoriteTimeOfDay();
    const weeklyPattern = predictor.getWeeklyPattern();
    
    let html = '<div class="predictions-section">';
    html += '<h3>🔮 Prédictions & Analyses</h3>';
    
    // Prédiction du prochain caca
    html += '<div class="prediction-card main-prediction">';
    html += `<div class="prediction-icon">${prediction.icon || '🔮'}</div>`;
    html += `<div class="prediction-text">${prediction.message}</div>`;
    if (prediction.confidence) {
        html += `<div class="confidence-bar">`;
        html += `<div class="confidence-fill" style="width: ${prediction.confidence}%"></div>`;
        html += `</div>`;
        html += `<div class="confidence-label">Confiance: ${prediction.confidence}%</div>`;
    }
    html += '</div>';
    
    // Heure moyenne
    if (avgTime) {
        html += '<div class="prediction-card">';
        html += '<h4>⏰ Heure Moyenne</h4>';
        html += `<p class="stat-value">${String(avgTime.hour).padStart(2, '0')}:${String(avgTime.minutes).padStart(2, '0')}</p>`;
        html += '</div>';
    }
    
    // Période préférée
    if (favoriteTime) {
        html += '<div class="prediction-card">';
        html += '<h4>🎯 Période Préférée</h4>';
        html += `<p class="stat-value">${favoriteTime.name}</p>`;
        html += `<p class="stat-detail">${favoriteTime.count} cacas (${favoriteTime.percentage}%)</p>`;
        html += '</div>';
    }
    
    // Pattern hebdomadaire
    if (weeklyPattern) {
        html += '<div class="prediction-card">';
        html += '<h4>📅 Tendances Hebdomadaires</h4>';
        html += `<p>🏆 Meilleur jour: <strong>${weeklyPattern.bestDay}</strong></p>`;
        html += `<p>😴 Jour le plus calme: <strong>${weeklyPattern.worstDay}</strong></p>`;
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}
