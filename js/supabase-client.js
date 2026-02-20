// ============================================================
// ☁️ Supabase Client — Caca-Tracker 3000 Deluxe
// ⚠️  Remplace SUPABASE_URL et SUPABASE_ANON_KEY par tes valeurs
//     Supabase > Settings > API > Project URL / anon public key
// ============================================================

const SUPABASE_URL      = 'https://fnljhknjmmteawwomehb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubGpoa25qbW10ZWF3d29tZWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQ2MDYsImV4cCI6MjA4NzAxMDYwNn0.aWlwsLdpH9u4BZjbpx5BNxWF5tiZ0c6sI0U1J7gjBfo';

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
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

// Écoute les changements d'état Supabase (recovery, sign-in, sign-out…)
// Doit être appelé AU PLUS TÔT après le chargement pour ne pas rater
// l'événement PASSWORD_RECOVERY déclenché par le token dans l'URL
function initAuthListener() {
  const sb = getSB(); if (!sb) return;
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      // La session est active — on peut appeler updateUser()
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
    local_id:  String(poop.id),
    user_id:   _currentUser.id,
    date:      poop.date,
    texture:   poop.texture,
    color:     poop.color,
    comment:   poop.comment || '',
    is_retro:  poop.isRetro || false,
    mood:      poop.mood || null
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
    .select('id, local_id, date, texture, color, comment, is_retro, mood')
    .eq('user_id', _currentUser.id)
    .order('date', { ascending: false });
  return (data || []).map(p => ({
    id:      p.local_id || p.id,   // prefer the original local UUID
    date:    p.date,
    texture: p.texture || 'normal',
    color:   p.color   || 'marron',
    comment: p.comment || '',
    isRetro: p.is_retro || false,
    mood:    p.mood    || ''
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

  const { data: poops } = await sb.from('poops')
    .select('user_id, date')
    .in('user_id', memberIds);

  const result = {};
  members.forEach(m => {
    const userPoops = (poops || []).filter(p => p.user_id === m.id);
    const month = userPoops.filter(p => p.date >= monthStart).length;
    const week7 = userPoops.filter(p => p.date >= week7Start).length;
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
      username: m.username,
      avatar:   m.avatar || '💩',
      total:    userPoops.length,
      month,
      week7,
      streak
    };
  });
  return result;
}

async function getGroupFeed(groupId, limit = 20) {
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
  if (!poops.length) return [];

  // Charger les réactions pour ces poops
  const poopIds = poops.map(p => p.id);
  const { data: reactions } = await sb.from('reactions')
    .select('poop_id, user_id, emoji')
    .in('poop_id', poopIds);

  // Grouper réactions par poop_id : { emoji: count }
  const reactionMap = {};
  (reactions || []).forEach(r => {
    if (!reactionMap[r.poop_id]) reactionMap[r.poop_id] = {};
    reactionMap[r.poop_id][r.emoji] = (reactionMap[r.poop_id][r.emoji] || 0) + 1;
  });
  // Réaction de l'user courant par poop
  const myReactions = {};
  (reactions || []).filter(r => r.user_id === _currentUser?.id).forEach(r => {
    myReactions[r.poop_id] = r.emoji;
  });

  return poops.map(p => ({
    ...p,
    username:   profileMap[p.user_id]?.username || '???',
    avatar:     profileMap[p.user_id]?.avatar   || '💩',
    reactions:  reactionMap[p.id]  || {},
    myReaction: myReactions[p.id]  || null
  }));
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
  const { data } = await sb.from('challenges')
    .insert({ group_id: groupId, start_date: fmt(monday), end_date: fmt(sunday) })
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
    .select('user_id, date')
    .in('user_id', memberIds)
    .gte('date', start)
    .lte('date', end);

  const counts = {};
  memberIds.forEach(id => { counts[id] = 0; });
  (data || []).forEach(p => { counts[p.user_id] = (counts[p.user_id] || 0) + 1; });

  return Object.fromEntries(
    Object.entries(counts).map(([id, count]) => [id, {
      count,
      username: profileMap[id]?.username || '???',
      avatar:   profileMap[id]?.avatar   || '💩'
    }])
  );
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
  getOrCreateWeeklyChallenge,
  getChallengeProgress,
  toggleReaction,
  deleteGroup,
  removeMember,
  initAuthListener,
  getAllProfiles,
  setUserAdmin,
  updateProfile
};
