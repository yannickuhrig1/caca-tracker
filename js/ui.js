// ============================================================
// 🎨 UI helpers — toasts & modales (remplace prompt/alert/confirm)
// Feature #10 : cohérence visuelle avec le design de l'app.
// ============================================================
window.UI = (() => {

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ---- Toasts ----
  function ensureToastHost() {
    let host = document.getElementById('ui-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ui-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type = 'info', duration = 3200) {
    const host = ensureToastHost();
    const el = document.createElement('div');
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : type === 'party' ? '🎉' : '💬';
    el.className = `ui-toast ui-toast-${type}`;
    el.innerHTML = `<span class="ui-toast-icon">${icon}</span><span>${esc(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 280);
    }, duration);
  }

  // ---- Modale générique ----
  function buildModal({ title, bodyHTML, buttonsHTML }) {
    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay';
    overlay.innerHTML = `
      <div class="ui-modal" role="dialog" aria-modal="true">
        ${title ? `<h3 class="ui-modal-title">${esc(title)}</h3>` : ''}
        <div class="ui-modal-body">${bodyHTML}</div>
        <div class="ui-modal-actions">${buttonsHTML}</div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    return overlay;
  }

  function closeModal(overlay) {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
  }

  // ---- Confirm (Promise<boolean>) ----
  function confirm(message, opts = {}) {
    const { title = 'Confirmer', okLabel = 'OK', cancelLabel = 'Annuler', danger = false } = opts;
    return new Promise(resolve => {
      const overlay = buildModal({
        title,
        bodyHTML: `<p class="ui-modal-text">${esc(message)}</p>`,
        buttonsHTML: `
          <button class="ui-btn ui-btn-ghost" data-act="cancel">${esc(cancelLabel)}</button>
          <button class="ui-btn ${danger ? 'ui-btn-danger' : 'ui-btn-primary'}" data-act="ok">${esc(okLabel)}</button>`
      });
      const done = v => { closeModal(overlay); resolve(v); };
      overlay.querySelector('[data-act="ok"]').addEventListener('click', () => done(true));
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => done(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
    });
  }

  // ---- Prompt (Promise<string|null>) ----
  function prompt(message, opts = {}) {
    const { title = '', value = '', placeholder = '', okLabel = 'Valider', cancelLabel = 'Annuler', maxlength = 280 } = opts;
    return new Promise(resolve => {
      const overlay = buildModal({
        title,
        bodyHTML: `
          ${message ? `<p class="ui-modal-text">${esc(message)}</p>` : ''}
          <input type="text" class="ui-modal-input" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${maxlength}" />`,
        buttonsHTML: `
          <button class="ui-btn ui-btn-ghost" data-act="cancel">${esc(cancelLabel)}</button>
          <button class="ui-btn ui-btn-primary" data-act="ok">${esc(okLabel)}</button>`
      });
      const input = overlay.querySelector('.ui-modal-input');
      setTimeout(() => { input.focus(); input.select(); }, 60);
      const done = v => { closeModal(overlay); resolve(v); };
      overlay.querySelector('[data-act="ok"]').addEventListener('click', () => done(input.value.trim() || null));
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => done(null));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') done(input.value.trim() || null); });
      overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
    });
  }

  return { toast, confirm, prompt };
})();
