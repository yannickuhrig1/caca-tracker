// Chat de groupe (v2.22.0).
//
// Le rendu (DOM + realtime) se vérifie au navigateur ; ici on s'assure que le
// fichier livré s'évalue sans erreur et expose son API open/close/send.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

test('ChatModule se charge et expose open/close/send', () => {
  const ctx = loadInto('js/chat.js');
  assert.ok(ctx.ChatModule);
  assert.strictEqual(typeof ctx.ChatModule.open, 'function');
  assert.strictEqual(typeof ctx.ChatModule.close, 'function');
  assert.strictEqual(typeof ctx.ChatModule.send, 'function');
});

test('encodeReaction / decodeReaction : aller-retour et rejets', () => {
  const C = loadInto('js/chat.js').ChatModule;
  const enc = C.encodeReaction('msg-42', '🔥');
  assert.strictEqual(enc, '[react:msg-42|🔥]');
  assert.deepEqual(C.decodeReaction(enc), { msgId: 'msg-42', emoji: '🔥' });

  assert.strictEqual(C.encodeReaction('', '🔥'), null);
  assert.strictEqual(C.encodeReaction('msg-42', ''), null);
  assert.strictEqual(C.decodeReaction('salut'), null);
  assert.strictEqual(C.decodeReaction('[react:msg|]'), null);
  assert.strictEqual(C.decodeReaction('[react:a|b] suite'), null);
});

test('encodePin / decodePin : aller-retour, troncature et rejets', () => {
  const C = loadInto('js/chat.js').ChatModule;
  const enc = C.encodePin('msg-1', 'Rendez-vous aux toilettes !');
  assert.strictEqual(enc, '[pin:msg-1|Rendez-vous aux toilettes !]');
  assert.deepEqual(C.decodePin(enc), { msgId: 'msg-1', excerpt: 'Rendez-vous aux toilettes !' });

  const longEnc = C.encodePin('msg-2', 'x'.repeat(200));
  assert.strictEqual(C.decodePin(longEnc).excerpt.length, 120);

  assert.strictEqual(C.encodePin('', 'texte'), null);
  assert.strictEqual(C.encodePin('msg-1', '|||'), null);
  assert.strictEqual(C.decodePin('[pin:msg-1|]'), null);
});

test('encodeBet / decodeBet : aller-retour et rejets', () => {
  const C = loadInto('js/chat.js').ChatModule;
  const enc = C.encodeBet('Qui pose avant midi ?', ['Léa', 'Zoé']);
  assert.strictEqual(enc, '[bet:Qui pose avant midi ?|Léa/Zoé]');
  assert.deepEqual(C.decodeBet(enc), {
    question: 'Qui pose avant midi ?',
    options: ['Léa', 'Zoé'],
  });

  assert.strictEqual(C.encodeBet('Question', ['Seule']), null);
  assert.strictEqual(C.encodeBet('', ['A', 'B']), null);
  assert.strictEqual(C.decodeBet('[bet:Q|A]'), null);
});

test('encode1v1 / decode1v1 : aller-retour et rejets', () => {
  const C = loadInto('js/chat.js').ChatModule;
  const enc = C.encode1v1('Zoé', '3 cacas avant dimanche');
  assert.strictEqual(enc, '[1v1:Zoé|3 cacas avant dimanche]');
  assert.deepEqual(C.decode1v1(enc), {
    target: 'Zoé',
    criteria: '3 cacas avant dimanche',
  });

  assert.strictEqual(C.encode1v1('', 'critère'), null);
  assert.strictEqual(C.encode1v1('Zoé', ''), null);
  assert.strictEqual(C.decode1v1('pas un duel'), null);
});

test('messageHTML : surligne les @mentions et neutralise toute injection XSS', () => {
  const C = loadInto('js/chat.js').ChatModule;
  const html = C.messageHTML({
    id: 'm1',
    username: 'Léa',
    avatar: '🦊',
    body: 'Bravo @Zoé <script>alert(1)</script> et <img src=x onerror=alert(1)>',
    created_at: '2026-09-28T10:00:00Z',
    mine: false,
  });

  assert.match(html, /<span class="chat-mention"[^>]*>@Zoé<\/span>/);
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /<img\s/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
