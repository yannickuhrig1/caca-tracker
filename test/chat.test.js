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
