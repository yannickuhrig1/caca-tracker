// findGroupByInvite : retrouve un groupe depuis son code d'invitation.
//
// Deux chemins volontaires — la fonction SQL `find_group_by_invite` quand elle
// existe, la lecture directe de `groups` sinon. Ce double chemin est ce qui rend
// l'ordre de déploiement indifférent : le JS peut partir avant que la migration
// RLS soit jouée sur le NAS, sans casser l'adhésion à un groupe.
//
// Ces tests vérifient précisément ça, parce que se tromper ici veut dire
// « plus personne ne peut rejoindre un groupe » en production.

const test = require('node:test');
const assert = require('node:assert');
const { loadInto } = require('./helpers/load');

const ctx = loadInto('js/supabase-client.js');
const { findGroupByInvite } = ctx;

const GROUPE = { id: 'g-1', name: 'Les copines' };

/** Faux client : on décide de ce que rendent rpc() et from().select() et on note les appels. */
function fakeSb({ rpc, select }) {
  const appels = { rpc: [], select: [] };
  return {
    appels,
    rpc: async (nom, args) => { appels.rpc.push({ nom, args }); return rpc; },
    from: () => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => { appels.select.push({ [col]: val }); return select; }
        })
      })
    })
  };
}

test('chemin nominal — la fonction SQL répond, pas de repli', async () => {
  const sb = fakeSb({ rpc: { data: [GROUPE], error: null } });
  const g = await findGroupByInvite(sb, 'ABC123');
  assert.deepStrictEqual(g, GROUPE);
  assert.strictEqual(sb.appels.rpc.length, 1);
  assert.strictEqual(sb.appels.select.length, 0, 'le repli ne doit pas être sollicité');
  // champ par champ : les objets créés dans le contexte vm ont un autre
  // Object.prototype, deepStrictEqual échouerait sur l'identité du prototype
  assert.strictEqual(sb.appels.rpc[0].nom, 'find_group_by_invite');
  assert.strictEqual(sb.appels.rpc[0].args.code, 'ABC123');
});

test('code normalisé — espaces retirés et mis en majuscules', async () => {
  const sb = fakeSb({ rpc: { data: [GROUPE], error: null } });
  await findGroupByInvite(sb, '  abc123 ');
  assert.strictEqual(sb.appels.rpc[0].args.code, 'ABC123');
});

test('la fonction SQL répond mais aucun groupe -> null, sans repli', async () => {
  const sb = fakeSb({ rpc: { data: [], error: null } });
  assert.strictEqual(await findGroupByInvite(sb, 'ZZZ999'), null);
  assert.strictEqual(sb.appels.select.length, 0);
});

test('migration pas encore jouée (PGRST202) -> repli sur la lecture directe', async () => {
  const sb = fakeSb({
    rpc:    { data: null, error: { code: 'PGRST202', message: 'function not found' } },
    select: { data: GROUPE, error: null }
  });
  const g = await findGroupByInvite(sb, 'ABC123');
  assert.deepStrictEqual(g, GROUPE, 'le repli doit ramener le groupe');
  assert.strictEqual(sb.appels.select[0].invite_code, 'ABC123');
});

test('les deux chemins échouent -> null plutôt qu\'une exception', async () => {
  const sb = fakeSb({
    rpc:    { data: null, error: { code: 'PGRST202', message: 'function not found' } },
    select: { data: null, error: { code: '42501', message: 'permission denied' } }
  });
  assert.strictEqual(await findGroupByInvite(sb, 'ABC123'), null);
});

test('code vide -> null sans toucher au réseau', async () => {
  const sb = fakeSb({ rpc: { data: [GROUPE], error: null } });
  assert.strictEqual(await findGroupByInvite(sb, '   '), null);
  assert.strictEqual(await findGroupByInvite(sb, null), null);
  assert.strictEqual(sb.appels.rpc.length, 0);
  assert.strictEqual(sb.appels.select.length, 0);
});

test('la fonction SQL peut renvoyer un objet seul plutôt qu\'un tableau', async () => {
  const sb = fakeSb({ rpc: { data: GROUPE, error: null } });
  assert.deepStrictEqual(await findGroupByInvite(sb, 'ABC123'), GROUPE);
});
