// ============================================================
//  💬 CHAT DE GROUPE — fil temps réel par groupe (v2.22.0)
//
//  Depuis v2.23.0 le chat est un ONGLET du Social (plus une modale) :
//  il se rend dans #social-pane-chat, ouvert par l'onglet « 💬 Chat ».
//  La réception en direct reste sur `group_messages` (migration 18).
//  Le COMPTAGE des non-lus, lui, est fait par social.js qui garde un
//  abonnement permanent même quand l'onglet chat est fermé.
// ============================================================

window.ChatModule = (() => {

  let _groupId = null;
  let _channel = null;
  let _profileMap = {};
  let _renderTimer = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const timeOf = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  function decorate(row) {
    return {
      ...row,
      username: _profileMap[row.user_id]?.username || '???',
      avatar:   _profileMap[row.user_id]?.avatar   || '💩',
      mine:     row.user_id === window.SupabaseClient?.getCurrentProfile()?.id,
    };
  }

  function messageHTML(m) {
    const mine = m.mine;
    const bubbleStyle = mine
      ? 'background:var(--accent);color:#fff'
      : 'background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--text-primary)';
    return `
      <div class="chat-row ${mine ? 'chat-row-mine' : ''}">
        ${mine ? '' : `<span class="chat-avatar">${esc(m.avatar || '💩')}</span>`}
        <div class="chat-bubble-wrap">
          ${mine ? '' : `<div class="chat-author">${esc(m.username)}</div>`}
          <div class="chat-bubble" style="${bubbleStyle}">${esc(m.body)}</div>
          <div class="chat-time ${mine ? 'text-right' : ''}">${timeOf(new Date(m.created_at).getTime())}</div>
        </div>
      </div>`;
  }

  function isNearBottom() {
    const el = document.getElementById('chat-messages');
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  function scrollBottom() {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function render() {
    const el = document.getElementById('chat-messages');
    if (!el || !_groupId) return;
    if (!window.SupabaseClient.groupChatAvailable()) {
      el.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Le chat n\'est pas encore disponible sur ce serveur.</div>';
      return;
    }
    const stick = isNearBottom();
    try {
      const msgs = await window.SupabaseClient.getGroupMessages(_groupId, 50);
      if (!msgs.length) {
        el.innerHTML = '<div class="text-center text-sm opacity-50 py-6">Aucun message — lance la discussion ! 💬</div>';
        return;
      }
      el.innerHTML = msgs.map(messageHTML).join('');
      if (stick) scrollBottom();
    } catch (e) {
      el.innerHTML = `<div class="text-center text-sm opacity-60 py-6">${esc(e.message)}</div>`;
    }
  }

  function scheduleRender() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, 200);
  }

  function subscribe() {
    const sb = window.SupabaseClient?.getClient?.();
    if (!sb || !_groupId) return;
    _channel = sb.channel('group-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, payload => {
        if (payload?.new?.group_id === _groupId) scheduleRender();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, payload => {
        if (payload?.old?.group_id === _groupId) scheduleRender();
      })
      .subscribe();
  }

  async function open(groupId) {
    if (!groupId || groupId === _groupId) return;
    // Nettoyer l'abonnement de l'ancien groupe avant d'en ouvrir un autre.
    try { _channel?.unsubscribe?.(); } catch {}
    _channel = null;
    _groupId = groupId;

    const members = await window.SupabaseClient.getGroupMembers(groupId).catch(() => []);
    _profileMap = Object.fromEntries(members.map(m => [m.id, m]));

    const list = document.getElementById('chat-messages');
    if (list) list.innerHTML = '<div class="text-center text-sm opacity-50 py-4">Chargement…</div>';

    subscribe();
    await render();
    document.getElementById('chat-input')?.focus();
  }

  function close() {
    _groupId = null;
    clearTimeout(_renderTimer);
    try { _channel?.unsubscribe?.(); } catch {}
    _channel = null;
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const body = input?.value?.trim();
    if (!body || !_groupId) return;
    input.value = '';
    input.focus();
    try {
      await window.SupabaseClient.sendGroupMessage(_groupId, body);
      scheduleRender();
    } catch (e) {
      window.UI?.toast?.('Envoi impossible : ' + e.message, 'error');
    }
  }

  // ---- Event listeners ----
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chat-send')?.addEventListener('click', send);
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  });

  return { open, close, send, groupId: () => _groupId };
})();
