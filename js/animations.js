// ✨ Animations et effets visuels

// Animation du caca qui danse
function showDancingPoop() {
    const poop = document.createElement('div');
    poop.className = 'dancing-poop';
    poop.innerHTML = '💩';
    document.body.appendChild(poop);
    
    setTimeout(() => poop.classList.add('dancing'), 100);
    setTimeout(() => {
        poop.classList.remove('dancing');
        setTimeout(() => poop.remove(), 300);
    }, 2000);
}

// Confettis arc-en-ciel
function showRainbowConfetti() {
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            container.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 3000);
        }, i * 30);
    }
    
    setTimeout(() => container.remove(), 4000);
}

// Animation de streak
function showStreakAnimation(days) {
    const streak = document.createElement('div');
    streak.className = 'streak-animation';
    streak.innerHTML = `
        <div class="streak-icon">🔥</div>
        <div class="streak-text">${days} jours d'affilée !</div>
    `;
    document.body.appendChild(streak);
    
    setTimeout(() => streak.classList.add('show'), 100);
    setTimeout(() => {
        streak.classList.remove('show');
        setTimeout(() => streak.remove(), 300);
    }, 3000);
}

// Fireworks pour les milestones
function showFireworks() {
    const container = document.createElement('div');
    container.className = 'fireworks-container';
    document.body.appendChild(container);
    
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = (20 + Math.random() * 60) + '%';
            firework.style.top = (20 + Math.random() * 40) + '%';
            container.appendChild(firework);
            
            // Créer les particules
            for (let j = 0; j < 12; j++) {
                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                const angle = (j * 30) * Math.PI / 180;
                particle.style.setProperty('--x', Math.cos(angle) * 100 + 'px');
                particle.style.setProperty('--y', Math.sin(angle) * 100 + 'px');
                firework.appendChild(particle);
            }
            
            setTimeout(() => firework.remove(), 2000);
        }, i * 600);
    }
    
    setTimeout(() => container.remove(), 4000);
}

// Animation de pulsation pour les boutons
function pulseButton(element) {
    element.classList.add('pulse');
    setTimeout(() => element.classList.remove('pulse'), 600);
}

// Animation de slide pour les transitions
function slideIn(element, direction = 'left') {
    element.classList.add(`slide-in-${direction}`);
    setTimeout(() => element.classList.remove(`slide-in-${direction}`), 500);
}

// Animation de rotation pour le caca
function spinPoop(element) {
    element.classList.add('spin');
    setTimeout(() => element.classList.remove('spin'), 1000);
}

// Animation de bounce
function bounceElement(element) {
    element.classList.add('bounce');
    setTimeout(() => element.classList.remove('bounce'), 1000);
}

// Animation de shake pour les erreurs
function shakeElement(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// Animation de fade in/out
function fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    let start = null;
    function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;
        
        element.style.opacity = Math.min(progress, 1);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function fadeOut(element, duration = 300) {
    let start = null;
    function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;
        
        element.style.opacity = 1 - Math.min(progress, 1);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.style.display = 'none';
        }
    }
    
    requestAnimationFrame(animate);
}

// Gère les animations lors de l'ajout d'un caca
function celebratePoopAdded(streak) {
    // Son
    soundManager.playPoopAdded();
    
    // Animation du caca
    showDancingPoop();
    
    // Si streak multiple de 7
    if (streak > 0 && streak % 7 === 0) {
        showStreakAnimation(streak);
        soundManager.playStreak();
        showRainbowConfetti();
    }
    
    // Si milestone (10, 50, 100, etc.)
    if ([10, 25, 50, 100, 250, 500, 1000].includes(streak)) {
        showFireworks();
        soundManager.playConfetti();
    }
}
