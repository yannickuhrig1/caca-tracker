// ============================================================
// ☁️ Supabase Client — Caca-Tracker 3000 Deluxe
// ⚠️  Remplace SUPABASE_URL et SUPABASE_ANON_KEY par tes valeurs
//     Supabase > Settings > API > Project URL / anon public key
// ============================================================

const SUPABASE_URL      = 'https://caca-api.yannick-uhrig.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MDQ1MzEzLCJleHAiOjIwOTk0MDUzMTN9.Dkl7iz_8Yz4_hbPrv2n3qrTyy0xTaBTP89s7nEZhKX8';

// URL de production (pour les liens de reset de mot de passe)
const SITE_URL = 'https://caca-tracker.vercel.app/index.html';

// ---- Init client ----
let _sb = null;
function getSB() {
  if (!_sb) {
    if (typeof supabase === 'undefined') {
      console.warn('Supabase SDK non chargé');
      return null;
    }
    // Options explicites pour garantir la persistance sur iOS PWA / mobile
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage:           window.localStorage,
        persistSession:    true,
        autoRefreshToken:  true,
        detectSessionInUrl: true,
        storageKey:        'caca-tracker-auth'
      }
    });
  }
  return _sb;
}

// ---- State ----
let _currentUser = null;
let _currentProfile = null;

// ============================================================
//  AUTH
// ============================================================

async function signUp(email, password, username, avatar = '💩') {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username, avatar } }
  });
  if (error) throw new Error(error.message);
  _currentUser = data.user;
  // Profil créé automatiquement par le trigger SQL
  await new Promise(r => setTimeout(r, 800)); // laisser le trigger s'exécuter
  _currentProfile = await fetchProfile(_currentUser.id);
  return _currentProfile;
}

async function signIn(email, password) {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  _currentUser = data.user;
  _currentProfile = await fetchProfile(_currentUser.id);
  // Enregistrer la date de dernière connexion
  sb.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', _currentUser.id).then(() => {});
  return _currentProfile;
}

async function signOut() {
  const sb = getSB(); if (!sb) return;
  await sb.auth.signOut();
  _currentUser = null;
  _currentProfile = null;
}

async function resetPassword(email) {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  // Toujours pointer vers la prod pour que le lien fonctionne sur mobile/email
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const redirectTo = isLocal ? window.location.origin + '/index.html' : SITE_URL;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

async function updatePassword(newPassword) {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// Écoute les changements d'état Supabase.
// INITIAL_SESSION : fiable sur mobile/PWA pour restaurer la session au chargement.
// Doit être appelé AU PLUS TÔT pour ne pas rater PASSWORD_RECOVERY.
function initAuthListener() {
  const sb = getSB(); if (!sb) return;
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') {
      // SDK initialisé — session présente ou non
      if (session?.user) {
        _currentUser = session.user;
        _currentProfile = await fetchProfile(_currentUser.id);
        sb.from('profiles').update({ last_login: new Date().toISOString() })
          .eq('id', _currentUser.id).then(() => {});
      }
      // Notifier l'app (profile = null si non connecté)
      window.dispatchEvent(new CustomEvent('supabase-init', { detail: _currentProfile }));
    } else if (event === 'TOKEN_REFRESHED' && session?.user) {
      _currentUser = session.user;
    } else if (event === 'PASSWORD_RECOVERY') {
      history.replaceState(null, '', window.location.pathname);
      window.dispatchEvent(new CustomEvent('supabase-password-recovery'));
    }
  });
}

async function getSession() {
  const sb = getSB(); if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data?.session?.user) return null;
  _currentUser = data.session.user;
  _currentProfile = await fetchProfile(_currentUser.id);
  // Mettre à jour last_login à chaque restauration de session
  sb.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', _currentUser.id).then(() => {});
  return _currentProfile;
}

function isLoggedIn() { return !!_currentUser; }
function getCurrentProfile() { return _currentProfile; }

async function fetchProfile(userId) {
  const sb = getSB(); if (!sb) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// ============================================================
//  POOPS SYNC
// ============================================================

async function savePoopCloud(poop) {
  const sb = getSB(); if (!sb || !_currentUser) return;
  const { error } = await sb.from('poops').upsert({
    local_id:   String(poop.id),
    user_id:    _currentUser.id,
    date:       poop.date,
    texture:    poop.texture,
    color:      poop.color,
    comment:    poop.comment || '',
    is_retro:   poop.isRetro || false,
    mood:       poop.mood || null,
    updated_at: poop.updated_at || Date.now()
  }, { onConflict: 'user_id,local_id' });
  if (error) throw new Error(error.message);
}

async function deletePoopCloud(localId) {
  const sb = getSB(); if (!sb || !_currentUser) return;
  await sb.from('poops').delete().eq('local_id', String(localId)).eq('user_id', _currentUser.id);
}

// Fetch all of the current user's poops from Supabase (for cloud→local sync)
async function getMyPoops() {
  const sb = getSB(); if (!sb || !_currentUser) return [];
  const { data } = await sb.from('poops')
    .select('id, local_id, date, texture, color, comment, is_retro, mood, updated_at')
    .eq('user_id', _currentUser.id)
    .order('date', { ascending: false });
  return (data || []).map(p => ({
    id:         p.local_id || p.id,   // prefer the original local UUID
    date:       p.date,
    texture:    p.texture || 'normal',
    color:      p.color   || 'marron',
    comment:    p.comment || '',
    isRetro:    p.is_retro || false,
    mood:       p.mood    || '',
    updated_at: p.updated_at || 0
  }));
}

async function syncLocalToCloud(logs) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const rows = logs.map(p => ({
    local_id:  String(p.id),
    user_id:   _currentUser.id,
    date:      p.date,
    texture:   p.texture,
    color:     p.color,
    comment:   p.comment || '',
    is_retro:  p.isRetro || false,
    mood:      p.mood || null
  }));
  // Upsert par batch de 100
  // onConflict 'user_id,local_id' correspond à la contrainte UNIQUE composite
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await sb.from('poops').upsert(batch, { onConflict: 'user_id,local_id' });
    if (error) throw new Error(error.message);
  }
}

// ============================================================
//  GROUPES
// ============================================================

async function createGroup(name) {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  // Forcer un refresh de session pour s'assurer que le JWT est valide
  const { data: sess } = await sb.auth.getSession();
  if (!sess?.session?.user) throw new Error('Non connecté — reconnecte-toi');
  _currentUser = sess.session.user;
  const uid = _currentUser.id;

  const { data, error } = await sb.from('groups')
    .insert({ name, created_by: uid })
    .select().single();
  if (error) throw new Error(error.message);
  // Rejoindre automatiquement le groupe créé
  const { error: err2 } = await sb.from('group_members')
    .insert({ group_id: data.id, user_id: uid });
  if (err2 && err2.code !== '23505') throw new Error(err2.message);
  return data;
}

async function joinGroup(inviteCode) {
  const sb = getSB(); if (!sb) throw new Error('Supabase non disponible');
  // Forcer un refresh de session pour s'assurer que le JWT est valide
  const { data: sess } = await sb.auth.getSession();
  if (!sess?.session?.user) throw new Error('Non connecté — reconnecte-toi');
  _currentUser = sess.session.user;
  const uid = _currentUser.id;

  const { data: group, error: gErr } = await sb.from('groups')
    .select('id, name').eq('invite_code', inviteCode.toUpperCase()).single();
  if (gErr || !group) throw new Error('Code invalide ou groupe introuvable');
  const { error } = await sb.from('group_members')
    .insert({ group_id: group.id, user_id: uid });
  if (error && error.code !== '23505') throw new Error(error.message);
  return group;
}

async function leaveGroup(groupId) {
  const sb = getSB(); if (!sb || !_currentUser) return;
  await sb.from('group_members').delete()
    .eq('group_id', groupId).eq('user_id', _currentUser.id);
}

async function deleteGroup(groupId) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('groups').delete()
    .eq('id', groupId).eq('created_by', _currentUser.id);
  if (error) throw new Error(error.message);
}

async function removeMember(groupId, userId) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('group_members').delete()
    .eq('group_id', groupId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

async function getMyGroups() {
  const sb = getSB(); if (!sb || !_currentUser) return [];
  const { data } = await sb.from('group_members')
    .select('group_id, groups(id, name, invite_code, created_by, allow_member_invite)')
    .eq('user_id', _currentUser.id);
  return (data || []).map(r => r.groups).filter(Boolean);
}

async function updateGroupSettings(groupId, settings) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('groups').update(settings)
    .eq('id', groupId).eq('created_by', _currentUser.id);
  if (error) throw new Error(error.message);
}

// ============================================================
//  STATS SOCIALES
// ============================================================

async function getGroupMembers(groupId) {
  const sb = getSB(); if (!sb) return [];
  const { data } = await sb.from('group_members')
    .select('profiles(id, username, avatar)')
    .eq('group_id', groupId);
  return (data || []).map(r => r.profiles).filter(Boolean);
}

async function getGroupStats(groupId) {
  // Retourne { userId: { username, avatar, total, month, week7, streak } }
  const sb = getSB(); if (!sb) return {};
  const members = await getGroupMembers(groupId);
  if (!members.length) return {};

  const memberIds = members.map(m => m.id);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const week7Start = now.getTime() - 7 * 24 * 3600 * 1000;
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  const { data: poops } = await sb.from('poops')
    .select('user_id, date')
    .in('user_id', memberIds);

  const result = {};
  members.forEach(m => {
    const userPoops = (poops || []).filter(p => p.user_id === m.id);
    const month = userPoops.filter(p => p.date >= monthStart).length;
    const week7 = userPoops.filter(p => p.date >= week7Start).length;
    const todayCount = userPoops.filter(p => p.date >= today0.getTime()).length;
    const lastPoop = userPoops.length ? Math.max(...userPoops.map(p => p.date)) : 0;
    // Calcul streak simplifié
    let streak = 0;
    const days = new Set(userPoops.map(p => new Date(p.date).toDateString()));
    const today = new Date();
    if (days.has(today.toDateString())) {
      streak = 1;
      for (let i = 1; i < 90; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (days.has(d.toDateString())) streak++;
        else break;
      }
    }
    result[m.id] = {
      id:       m.id,
      username: m.username,
      avatar:   m.avatar || '💩',
      total:    userPoops.length,
      month,
      week7,
      today:    todayCount,
      lastPoop,
      streak
    };
  });
  return result;
}

// Podiums des mois passés (v2.10.0) : top 3 par mois terminé.
async function getGroupMonthlyRanking(groupId, monthsBack = 3) {
  const sb = getSB(); if (!sb) return [];
  const members = await getGroupMembers(groupId);
  if (!members.length) return [];

  const memberIds = members.map(m => m.id);
  const now = new Date();
  const oldest = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1).getTime();
  const { data: poops } = await sb.from('poops')
    .select('user_id, date')
    .in('user_id', memberIds)
    .gte('date', oldest);

  const months = [];
  for (let i = 1; i <= monthsBack; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const counts = {};
    (poops || []).forEach(p => {
      if (p.date >= start.getTime() && p.date < end.getTime()) {
        counts[p.user_id] = (counts[p.user_id] || 0) + 1;
      }
    });
    const ranking = members
      .map(m => ({ username: m.username, avatar: m.avatar || '💩', count: counts[m.id] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    months.push({
      label: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      ranking
    });
  }
  return months;
}

async function getGroupFeed(groupId, limit = 30) {
  const sb = getSB(); if (!sb) return [];
  const members = await getGroupMembers(groupId);
  if (!members.length) return [];

  const memberIds = members.map(m => m.id);
  const profileMap = Object.fromEntries(members.map(m => [m.id, m]));

  const { data } = await sb.from('poops')
    .select('id, user_id, date, texture, color')
    .in('user_id', memberIds)
    .order('date', { ascending: false })
    .limit(limit);

  const poops = data || [];
  const poopIds = poops.map(p => p.id);

  // Charger les réactions pour ces poops
  const reactionMap = {};
  const myReactions = {};
  const commentCounts = {};
  if (poopIds.length) {
    const { data: reactions } = await sb.from('reactions')
      .select('poop_id, user_id, emoji')
      .in('poop_id', poopIds);
    (reactions || []).forEach(r => {
      if (!reactionMap[r.poop_id]) reactionMap[r.poop_id] = {};
      reactionMap[r.poop_id][r.emoji] = (reactionMap[r.poop_id][r.emoji] || 0) + 1;
      if (r.user_id === _currentUser?.id) myReactions[r.poop_id] = r.emoji;
    });
    // Compteurs de commentaires
    const { data: cRows } = await sb.from('comments')
      .select('poop_id').in('poop_id', poopIds);
    (cRows || []).forEach(c => { commentCounts[c.poop_id] = (commentCounts[c.poop_id] || 0) + 1; });
  }

  const poopItems = poops.map(p => ({
    kind:        'poop',
    ...p,
    username:     profileMap[p.user_id]?.username || '???',
    avatar:       profileMap[p.user_id]?.avatar   || '💩',
    reactions:    reactionMap[p.id]  || {},
    myReaction:   myReactions[p.id]  || null,
    commentCount: commentCounts[p.id] || 0
  }));

  // Événements « badge débloqué » (feature #3)
  const { data: evData } = await sb.from('feed_events')
    .select('id, user_id, type, ref, title, emoji, created_at')
    .in('user_id', memberIds)
    .order('created_at', { ascending: false })
    .limit(limit);
  const events = (evData || []).map(e => ({
    kind:     'badge',
    id:       e.id,
    user_id:  e.user_id,
    username: profileMap[e.user_id]?.username || '???',
    avatar:   profileMap[e.user_id]?.avatar   || '💩',
    date:     new Date(e.created_at).getTime(),
    title:    e.title,
    emoji:    e.emoji
  }));

  // Timeline fusionnée, triée du plus récent au plus ancien
  return [...poopItems, ...events].sort((a, b) => b.date - a.date);
}

// ---- Commentaires (feature #1) ----
async function getPoopComments(poopId) {
  const sb = getSB(); if (!sb) return [];
  const { data } = await sb.from('comments')
    .select('id, user_id, body, created_at')
    .eq('poop_id', poopId)
    .order('created_at', { ascending: true });
  const rows = data || [];
  const ids = [...new Set(rows.map(r => r.user_id))];
  let pmap = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, username, avatar').in('id', ids);
    (profs || []).forEach(p => { pmap[p.id] = p; });
  }
  return rows.map(r => ({
    id:         r.id,
    user_id:    r.user_id,
    body:       r.body,
    created_at: new Date(r.created_at).getTime(),
    username:   pmap[r.user_id]?.username || '???',
    avatar:     pmap[r.user_id]?.avatar   || '💩'
  }));
}

async function addComment(poopId, body) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const clean = String(body || '').trim().slice(0, 280);
  if (!clean) throw new Error('Commentaire vide');
  const { data, error } = await sb.from('comments')
    .insert({ poop_id: poopId, user_id: _currentUser.id, body: clean })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteComment(commentId) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}

// ---- Nudge / poke (feature #2) ----
async function sendNudge(toUserId, groupId, emoji = '💩') {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('nudges')
    .insert({ from_user: _currentUser.id, to_user: toUserId, group_id: groupId, emoji });
  if (error) throw new Error(error.message);
}

// ---- Badge dans le feed (feature #3) ----
async function publishBadgeEvent(badge) {
  const sb = getSB(); if (!sb || !_currentUser) return;
  try {
    // Les badges rares utilisent le type 'badge_rare' : le worker ne pousse
    // de notif push au groupe QUE pour ceux-là (les autres restent au feed).
    const type = badge.rare ? 'badge_rare' : 'badge';
    await sb.from('feed_events').upsert(
      { user_id: _currentUser.id, type, ref: badge.id, title: badge.name, emoji: badge.icon },
      { onConflict: 'user_id,type,ref', ignoreDuplicates: true }
    );
  } catch (e) { console.warn('publishBadgeEvent', e.message); }
}

async function toggleReaction(poopId, emoji) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { data: existing } = await sb.from('reactions')
    .select('id, emoji').eq('poop_id', poopId).eq('user_id', _currentUser.id).maybeSingle();

  if (existing && existing.emoji === emoji) {
    await sb.from('reactions').delete().eq('id', existing.id);
    return null;
  } else if (existing) {
    await sb.from('reactions').update({ emoji }).eq('id', existing.id);
    return emoji;
  } else {
    await sb.from('reactions').insert({ poop_id: poopId, user_id: _currentUser.id, emoji });
    return emoji;
  }
}

// Défis thématiques tournants (feature #4)
const CHALLENGE_META = {
  count:   { emoji: '💩', title: 'Qui fera le plus de cacas cette semaine ?',          unit: '💩', desc: 'Le plus de cacas' },
  early:   { emoji: '🌅', title: 'Team lève-tôt : le plus de cacas avant 8h !',        unit: '🌅', desc: 'Cacas avant 8h' },
  night:   { emoji: '🦉', title: 'Hibou de nuit : le plus de cacas entre minuit et 6h !', unit: '🦉', desc: 'Cacas de nuit (0-6h)' },
  regular: { emoji: '📅', title: 'La plus régulière : le plus de jours différents !',  unit: 'j',  desc: 'Jours actifs' },
  rainbow: { emoji: '🌈', title: 'Arc-en-ciel : le plus de textures différentes !',    unit: '🎨', desc: 'Textures variées' },
  streak:  { emoji: '🔥', title: "La plus longue série de jours d'affilée !",           unit: '🔥', desc: 'Série de jours' }
};
const CHALLENGE_ROTATION = ['count', 'early', 'night', 'regular', 'rainbow', 'streak'];
function weeklyChallengeType(monday) {
  const idx = Math.floor(monday.getTime() / (7 * 86400000));
  const n = CHALLENGE_ROTATION.length;
  return CHALLENGE_ROTATION[((idx % n) + n) % n];
}
function getChallengeMeta(type) { return CHALLENGE_META[type] || CHALLENGE_META.count; }

function scoreChallenge(type, poops) {
  switch (type) {
    case 'early':   return poops.filter(p => new Date(p.date).getHours() < 8).length;
    case 'night':   return poops.filter(p => { const h = new Date(p.date).getHours(); return h >= 0 && h < 6; }).length;
    case 'regular': return new Set(poops.map(p => new Date(p.date).toDateString())).size;
    case 'rainbow': return new Set(poops.map(p => p.texture || 'normal')).size;
    case 'streak': {
      const days = [...new Set(poops.map(p => { const d = new Date(p.date); d.setHours(0,0,0,0); return d.getTime(); }))].sort((a,b)=>a-b);
      let best = 0, cur = 0, prev = null;
      for (const d of days) {
        if (prev !== null && d - prev === 86400000) cur++; else cur = 1;
        best = Math.max(best, cur); prev = d;
      }
      return best;
    }
    default:        return poops.length; // 'count'
  }
}

async function getOrCreateWeeklyChallenge(groupId) {
  const sb = getSB(); if (!sb) return null;
  const now = new Date();
  // Lundi de la semaine courante
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = d => d.toISOString().slice(0, 10);
  const { data: existing } = await sb.from('challenges')
    .select('*').eq('group_id', groupId).eq('start_date', fmt(monday)).single();

  if (existing) return existing;
  const type = weeklyChallengeType(monday);
  const { data } = await sb.from('challenges')
    .insert({ group_id: groupId, start_date: fmt(monday), end_date: fmt(sunday), type, title: CHALLENGE_META[type].title })
    .select().single();
  return data;
}

async function getChallengeProgress(groupId, challenge) {
  const sb = getSB(); if (!sb || !challenge) return {};
  const members = await getGroupMembers(groupId);
  const memberIds = members.map(m => m.id);
  const profileMap = Object.fromEntries(members.map(m => [m.id, m]));

  const start = new Date(challenge.start_date).getTime();
  const end   = new Date(challenge.end_date).getTime() + 86399999;

  const { data } = await sb.from('poops')
    .select('user_id, date, texture')
    .in('user_id', memberIds)
    .gte('date', start)
    .lte('date', end);

  const type = challenge.type || 'count';
  const byUser = {};
  memberIds.forEach(id => { byUser[id] = []; });
  (data || []).forEach(p => { (byUser[p.user_id] = byUser[p.user_id] || []).push(p); });

  return Object.fromEntries(
    memberIds.map(id => [id, {
      count:    scoreChallenge(type, byUser[id] || []),
      username: profileMap[id]?.username || '???',
      avatar:   profileMap[id]?.avatar   || '💩'
    }])
  );
}

// ============================================================
//  DÉFI PERSONNALISÉ (feature 12)
// ============================================================
async function updateWeeklyChallengeTitle(groupId, title) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  const fmt = d => d.toISOString().slice(0, 10);

  // Update if exists, or upsert
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const { error } = await sb.from('challenges').upsert({
    group_id:   groupId,
    title:      title,
    start_date: fmt(monday),
    end_date:   fmt(sunday)
  }, { onConflict: 'group_id,start_date' });
  if (error) throw new Error(error.message);
}

// ============================================================
//  HALL OF FAME / PALMARÈS (feature #5)
// ============================================================
async function getHallOfFame(groupId, limit = 12) {
  const sb = getSB(); if (!sb) return [];
  const { data } = await sb.from('challenge_wins')
    .select('week_start, challenge_type, title, score, user_id')
    .eq('group_id', groupId)
    .order('week_start', { ascending: false })
    .limit(limit);
  const rows = data || [];
  const ids = [...new Set(rows.map(r => r.user_id))];
  let pmap = {};
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, username, avatar').in('id', ids);
    (profs || []).forEach(p => { pmap[p.id] = p; });
  }
  return rows.map(r => ({
    ...r,
    username: pmap[r.user_id]?.username || '???',
    avatar:   pmap[r.user_id]?.avatar   || '💩'
  }));
}

// { userId: nbVictoires } — pour afficher 🏆×N à côté des noms
async function getGroupTrophies(groupId) {
  const sb = getSB(); if (!sb) return {};
  const { data } = await sb.from('challenge_wins').select('user_id').eq('group_id', groupId);
  const counts = {};
  (data || []).forEach(r => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
  return counts;
}

// ============================================================
//  COURONNE REINE DU MOIS (feature #6)
//  Retourne { group, count } si l'utilisateur courant est #1 ce mois-ci
//  dans un de ses groupes (≥2 membres actifs), sinon null.
// ============================================================
async function myMonthlyCrown() {
  if (!_currentProfile) return null;
  const groups = await getMyGroups();
  for (const g of groups) {
    const stats = await getGroupStats(g.id);
    const active = Object.values(stats).filter(s => s.month > 0).sort((a, b) => b.month - a.month);
    if (active.length >= 2 && active[0].id === _currentProfile.id) {
      return { group: g.name, count: active[0].month };
    }
  }
  return null;
}

// ============================================================
//  RÉCAP HEBDO « WRAPPED » (feature #7)
//  Bilan de la dernière semaine complète (lundi→dimanche précédents).
// ============================================================
async function getWeeklyRecap(groupId) {
  const sb = getSB(); if (!sb) return null;
  const members = await getGroupMembers(groupId);
  if (!members.length) return null;
  const memberIds = members.map(m => m.id);
  const pmap = Object.fromEntries(members.map(m => [m.id, m]));

  const now = new Date(); const day = now.getDay();
  const thisMon = new Date(now); thisMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); thisMon.setHours(0,0,0,0);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const start = lastMon.getTime(); const end = thisMon.getTime() - 1;
  const label = `${lastMon.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${new Date(end).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`;

  const { data: poops } = await sb.from('poops')
    .select('id, user_id, date, texture')
    .in('user_id', memberIds).gte('date', start).lte('date', end);
  const list = poops || [];
  if (!list.length) return { label, total: 0 };

  const counts = {};
  list.forEach(p => { counts[p.user_id] = (counts[p.user_id] || 0) + 1; });
  const champEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const champ = { ...(pmap[champEntry[0]] || {}), count: champEntry[1] };

  // Jour le plus actif
  const byDay = {};
  list.forEach(p => { const k = new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'long' }); byDay[k] = (byDay[k] || 0) + 1; });
  const topDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

  // Réactions de la semaine
  const ids = list.map(p => p.id);
  let topEmoji = null, funniest = null;
  if (ids.length) {
    const { data: reacts } = await sb.from('reactions').select('poop_id, emoji').in('poop_id', ids);
    const emojiCounts = {}; const poopReacts = {};
    (reacts || []).forEach(r => {
      emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + 1;
      poopReacts[r.poop_id] = (poopReacts[r.poop_id] || 0) + 1;
    });
    const te = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0];
    if (te) topEmoji = { emoji: te[0], count: te[1] };
    const fp = Object.entries(poopReacts).sort((a, b) => b[1] - a[1])[0];
    if (fp) { const poop = list.find(p => p.id === fp[0]); if (poop) funniest = { ...(pmap[poop.user_id] || {}), reactions: fp[1] }; }
  }

  return {
    label,
    total: list.length,
    kg: (list.length * 0.15).toFixed(1),
    activeMembers: Object.keys(counts).length,
    champ,
    topDay: topDayEntry ? { day: topDayEntry[0], count: topDayEntry[1] } : null,
    topEmoji,
    funniest
  };
}

// ============================================================
//  ADMIN
// ============================================================

async function getAllProfiles() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb.from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Retourne { userId: [groupName, ...] } — nécessite la service role key pour bypasser RLS
async function getAllUsersGroups(adminClient) {
  const sb = adminClient || getSB(); if (!sb) return {};
  const { data } = await sb.from('group_members')
    .select('user_id, groups(id, name)');
  const result = {};
  (data || []).forEach(row => {
    if (!result[row.user_id]) result[row.user_id] = [];
    if (row.groups?.name) result[row.user_id].push(row.groups.name);
  });
  return result;
}

async function updateProfile(updates) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('profiles').update(updates).eq('id', _currentUser.id);
  if (error) throw new Error(error.message);
  _currentProfile = { ..._currentProfile, ...updates };
  return _currentProfile;
}

async function setUserAdmin(userId, isAdmin) {
  const sb = getSB(); if (!sb || !_currentUser) throw new Error('Non connecté');
  const { error } = await sb.from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

// ============================================================
//  EXPORT GLOBAL
// ============================================================
window.SupabaseClient = {
  isLoggedIn,
  getCurrentProfile,
  getSession,
  signUp,
  signIn,
  signOut,
  resetPassword,
  updatePassword,
  savePoopCloud,
  deletePoopCloud,
  getMyPoops,
  syncLocalToCloud,
  createGroup,
  joinGroup,
  leaveGroup,
  getMyGroups,
  updateGroupSettings,
  getGroupMembers,
  getGroupStats,
  getGroupFeed,
  getGroupMonthlyRanking,
  getOrCreateWeeklyChallenge,
  updateWeeklyChallengeTitle,
  getChallengeProgress,
  getChallengeMeta,
  toggleReaction,
  getPoopComments,
  addComment,
  deleteComment,
  sendNudge,
  publishBadgeEvent,
  getHallOfFame,
  getGroupTrophies,
  myMonthlyCrown,
  getWeeklyRecap,
  deleteGroup,
  removeMember,
  initAuthListener,
  getClient: getSB,
  getAllProfiles,
  getAllUsersGroups,
  setUserAdmin,
  updateProfile
};
