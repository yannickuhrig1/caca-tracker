// ============================================================
// 📲 Push serveur (Web Push / VAPID) — Caca-Tracker
// Notifications même app fermée : réactions reçues + rappel 24h.
// Le worker d'envoi tourne sur le NAS (stack caca-supabase).
// ============================================================
const PushModule = (() => {

  const VAPID_PUBLIC_KEY = 'BFUlq4nvd7IqyJYoI4L-gm8ZIJBUDszIEMW48VzyZMYHMNJHLX6HQScf2x5tT8tJWyjP5TMWxW_GZvPkFHj2eKA';

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async function getSubscription() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function isEnabled() {
    return !!(await getSubscription());
  }

  async function enable() {
    if (!supported()) throw new Error('Push non supporté par ce navigateur');
    const profile = window.SupabaseClient?.getCurrentProfile();
    if (!profile) throw new Error('Connecte-toi pour activer les notifications push');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Autorisation refusée');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const j  = sub.toJSON();
    const sb = window.SupabaseClient.getClient();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: profile.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth
    }, { onConflict: 'endpoint' });
    if (error) throw new Error(error.message);
  }

  async function disable() {
    const sub = await getSubscription();
    if (!sub) return;
    const sb = window.SupabaseClient?.getClient();
    if (sb) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }

  return { supported, isEnabled, enable, disable };
})();
window.PushModule = PushModule;
