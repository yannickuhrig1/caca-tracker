// ============================================================
//  app-avatars.js (v2.21.0)
//  Photos de profil : 50 emojis au choix, et 12 avatars animés qui se
//  débloquent en gagnant un badge.
//
//  En base, l'avatar reste un simple emoji (profiles.avatar) : aucune
//  migration, et une copine qui n'a pas encore la mise à jour voit l'emoji
//  sans animation. Un emoji animé n'apparaît dans aucune autre liste, donc
//  le reconnaître suffit pour l'animer partout où un avatar s'affiche.
// ============================================================

const AVATARS_FIXES = [
  // Les 30 historiques
  '💩','🐻','🦊','🐼','🐱','🐶','🐸','🐷','🐮','🦁','🐯','🐻‍❄️','🦄','🐙','🦋',
  '🌸','🌙','⭐','🌈','🎀','👑','🍦','🎸','🧁','🌺','🦩','🐢','🦀','🧸','🎭',
  // 20 nouveaux (v2.21.0)
  '🤡','👽','🤖','👻','🥸','🦖','🦥','🦦','🐧','🐨','🦔','🐌','🦆','🍑','🥑',
  '🌮','🍩','🧻','🚽','🪠',
];

// Avatars animés : `anim` correspond à une classe CSS `av-anim-<anim>`.
const AVATARS_ANIMES = [
  { av:'🕺', anim:'danse',     badge:'fridayFun' },
  { av:'🔥', anim:'flamme',    badge:'streak7' },
  { av:'🏆', anim:'brille',    badge:'streak30' },
  { av:'💎', anim:'scintille', badge:'poops200' },
  { av:'🚀', anim:'decolle',   badge:'poops500' },
  { av:'🌪️', anim:'tourne',    badge:'ultraSpeed' },
  { av:'🦉', anim:'hoche',     badge:'nightOwl5' },
  { av:'🌋', anim:'tremble',   badge:'volcano' },
  { av:'🎨', anim:'arcenciel', badge:'allColors' },
  { av:'🧭', anim:'aiguille',  badge:'cartographe' },
  { av:'🎮', anim:'saute',     badge:'gameuse' },
  { av:'🌽', anim:'danse',     badge:'grandTransit' },
];

/** La définition animée d'un emoji, ou null. */
function avatarAnime(av) {
  return AVATARS_ANIMES.find(a => a.av === av) || null;
}

function avatarEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/** HTML d'un avatar, animé s'il fait partie des avatars à débloquer. */
function avatarHTML(av, fallback = '💩') {
  const v = av || fallback;
  const a = avatarAnime(v);
  return a ? `<span class="av-anim av-anim-${a.anim}">${avatarEsc(v)}</span>` : avatarEsc(v);
}

/** Pose un avatar dans un élément existant (en-tête, profil). */
function setAvatarEl(el, av) {
  if (!el) return;
  const a = avatarAnime(av);
  el.textContent = av;
  el.classList.remove(...[...el.classList].filter(c => c.startsWith('av-anim')));
  if (a) el.classList.add('av-anim', `av-anim-${a.anim}`);
}

/**
 * Fonction pure : chaque avatar animé avec son badge et son état.
 * `etats` : résultat de computeBadges ; `defs` : BADGE_DEFS.
 */
function avatarsAnimesEtat(etats, defs) {
  return AVATARS_ANIMES.map(a => {
    const b = defs.find(d => d.id === a.badge);
    return {
      ...a,
      badgeLabel: b ? b.label : a.badge,
      badgeDesc: b ? b.desc : '',
      debloque: !!etats?.[a.badge]?.done,
      pct: Math.round(etats?.[a.badge]?.pct || 0),
    };
  });
}

/** États des badges de la joueuse, pour savoir ce qui est débloqué. */
function mesBadgesEtats() {
  try {
    return computeBadges(state.logs, calculateStreak(), typeof loadGameStats === 'function' ? loadGameStats() : null);
  } catch { return {}; }
}

// ── Sélecteur de la modale profil ────────────────────────────
function avatarActuel() {
  return window.SupabaseClient?.getCurrentProfile?.()?.avatar || localStorage.getItem('profile.avatar') || '💩';
}

function renderAvatarPicker() {
  const grid = $id('avatar-picker-grid');
  const animes = $id('avatar-anim-grid');
  if (!grid || !animes) return;
  const actuel = avatarActuel();
  const bouton = (av, extra = '') =>
    `<button type="button" class="av-opt${av === actuel ? ' is-on' : ''}" data-av="${avatarEsc(av)}" aria-label="Choisir l'avatar ${avatarEsc(av)}" aria-pressed="${av === actuel}"${extra}>${avatarHTML(av)}</button>`;
  grid.innerHTML = AVATARS_FIXES.map(av => bouton(av)).join('');

  const etats = avatarsAnimesEtat(mesBadgesEtats(), BADGE_DEFS);
  const n = etats.filter(e => e.debloque).length;
  const compteur = $id('avatar-anim-count');
  if (compteur) compteur.textContent = `${n}/${etats.length}`;
  animes.innerHTML = etats.map(e => e.debloque
    ? bouton(e.av, ` title="Débloqué avec « ${avatarEsc(e.badgeLabel)} »"`)
    : `<button type="button" class="av-opt av-locked" data-lock="${e.badge}" aria-label="Avatar verrouillé : badge ${avatarEsc(e.badgeLabel)}">
         <span class="av-locked-emoji">${avatarEsc(e.av)}</span><span class="av-lock" aria-hidden="true">🔒</span>
       </button>`).join('');
}

async function choisirAvatar(av) {
  localStorage.setItem('profile.avatar', av);
  setAvatarEl($id('profile-avatar-display'), av);
  if (window.SupabaseClient?.isLoggedIn()) {
    setAvatarEl($id('user-avatar'), av);
    try { await window.SupabaseClient.updateProfile({ avatar: av }); }
    catch { window.UI?.toast("L'avatar n'a pas pu être enregistré, réessaie plus tard.", 'error'); }
  }
  renderAvatarPicker();
}

function setupAvatars() {
  const zone = $id('profile-pane-avatar');
  if (!zone) return;
  zone.addEventListener('click', e => {
    const lock = e.target.closest('[data-lock]');
    if (lock) {
      const e2 = avatarsAnimesEtat(mesBadgesEtats(), BADGE_DEFS).find(x => x.badge === lock.dataset.lock);
      if (e2) window.UI?.toast(`🔒 Gagne le badge « ${e2.badgeLabel} » (${e2.badgeDesc}) : ${e2.pct} %`, 'info', 4000);
      return;
    }
    const btn = e.target.closest('[data-av]');
    if (btn) choisirAvatar(btn.dataset.av);
  });
}
