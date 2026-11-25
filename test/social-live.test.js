// ============================================================
//  Tests : Statut Live « 🚽 Sur le trône », Duels 1v1,
//  Sondages express, Toilettes Advisor & cartes Chat (v3.0)
// ============================================================

const test = require('node:test');
const assert = require('node:assert');
const { loadInto, readGlobals } = require('./helpers/load');

// Normalise le prototype d'un objet issu d'un contexte node:vm tout en gardant
// la vérification stricte des types primitifs (nombres, booléens, chaînes).
const plain = v => JSON.parse(JSON.stringify(v));

// ---------- 1. Chargement & exposition ----------

test('js/social-live.js se charge en VM et expose SocialLiveModule + fonctions pures', () => {
  const ctx = loadInto('js/social-live.js');
  assert.ok(ctx.SocialLiveModule);
  const fns = readGlobals(ctx, [
    'isLiveThroneEnabled',
    'setLiveThroneEnabled',
    'extractLiveSitters',
    'formatDuelMessage',
    'parseDuelMessage',
    'formatPollMessage',
    'parsePollMessage',
    'votePoll',
    'getPollVote',
    'formatSpotMessage',
    'parseSpotMessage',
    'saveLocalSpot',
    'getLocalSpots',
    'aggregateSpots',
    'openAddSpotModal',
    'renderSpotsPane',
  ]);
  for (const [name, fn] of Object.entries(fns)) {
    assert.strictEqual(typeof fn, 'function', `${name} doit être une fonction globale`);
    assert.strictEqual(typeof ctx.SocialLiveModule[name], 'function', `SocialLiveModule.${name} doit être exposé`);
  }
});

// ---------- 2. Statut Live « 🚽 Sur le trône » (opt-in, Presence, Broadcast) ----------

function makeRealtimeMock(myProfile = { id: 'u-me', username: 'Clémence', avatar: '👑' }) {
  const tracked = [];
  let untracked = 0;
  let unsubscribed = 0;
  const sentBroadcasts = [];
  const handlers = {};
  let presenceData = {};
  const toasts = [];

  const bannerEl = {
    innerHTML: '',
    hidden: true,
    _btns: [],
    classList: {
      add(c) { if (c === 'hidden') bannerEl.hidden = true; },
      remove(c) { if (c === 'hidden') bannerEl.hidden = false; },
    },
    querySelectorAll() { return bannerEl._btns; },
  };

  const channel = {
    name: null,
    opts: null,
    on(type, filter, cb) {
      handlers[`${type}:${filter.event}`] = cb;
      return channel;
    },
    subscribe(cb) {
      if (cb) cb('SUBSCRIBED');
      return channel;
    },
    track(payload) {
      tracked.push(payload);
      presenceData[payload.userId] = [payload];
      return Promise.resolve('ok');
    },
    untrack() {
      untracked++;
      delete presenceData[myProfile.id];
      return Promise.resolve('ok');
    },
    presenceState() {
      return presenceData;
    },
    send(msg) {
      sentBroadcasts.push(msg);
      return Promise.resolve('ok');
    },
    unsubscribe() {
      unsubscribed++;
    },
  };

  const ctx = loadInto('js/social-live.js', {
    UI: {
      toast: (msg, type) => toasts.push({ msg, type }),
    },
    SupabaseClient: {
      getCurrentProfile: () => myProfile,
      getClient: () => ({
        channel(name, opts) {
          channel.name = name;
          channel.opts = opts;
          return channel;
        },
        removeChannel() {},
      }),
    },
    document: {
      getElementById: id => (id === 'social-live-throne' ? bannerEl : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      documentElement: { setAttribute() {}, getAttribute: () => null },
      body: { style: {} },
    },
  });

  return {
    ctx,
    L: ctx.SocialLiveModule,
    tracked,
    getUntracked: () => untracked,
    getUnsubscribed: () => unsubscribed,
    sentBroadcasts,
    handlers,
    setPresence: data => { presenceData = data; },
    bannerEl,
    toasts,
  };
}

test('Live Throne : désactivé par défaut (opt-in strict) — aucun track sans consentement', () => {
  const m = makeRealtimeMock();
  assert.strictEqual(m.L.isLiveThroneEnabled(), false);
  assert.strictEqual(m.ctx.localStorage.getItem('social.liveThrone'), null);

  m.L.connectGroup('grp-1');
  assert.strictEqual(m.bannerEl.hidden, true);

  // Départ du chrono sans opt-in -> aucun appel à track()
  m.L.onTimerStart(1700000000000);
  assert.strictEqual(m.tracked.length, 0);
  assert.strictEqual(m.bannerEl.hidden, true);
});

test('Live Throne : opt-in actif -> Presence sur throne-live-${groupId}, bannière et arrêt propre', () => {
  const m = makeRealtimeMock();
  const now = Date.now();
  m.L.setLiveThroneEnabled(true);
  assert.strictEqual(m.L.isLiveThroneEnabled(), true);
  assert.strictEqual(m.ctx.localStorage.getItem('social.liveThrone'), 'true');

  const ch = m.L.connectGroup('grp-42');
  assert.strictEqual(ch.name, 'throne-live-grp-42');

  m.L.onTimerStart(now - 30000);
  assert.strictEqual(m.tracked.length, 1);
  assert.strictEqual(m.tracked[0].userId, 'u-me');
  assert.strictEqual(m.tracked[0].username, 'Clémence');
  assert.strictEqual(m.bannerEl.hidden, false);
  assert.ok(m.bannerEl.innerHTML.includes('Tu es en direct sur le trône'));

  // Une copine rejoint aussi le trône
  m.setPresence({
    'u-me': [{ userId: 'u-me', username: 'Clémence', avatar: '👑', startedAt: now - 30000 }],
    'u-lea': [{ userId: 'u-lea', username: 'Léa <script>', avatar: '💩', startedAt: now - 120000 }],
  });
  m.handlers['presence:sync']();
  assert.strictEqual(m.bannerEl.hidden, false);
  assert.ok(m.bannerEl.innerHTML.includes('Léa &lt;script&gt; est sur le trône'));
  assert.ok(!m.bannerEl.innerHTML.includes('<script>'));
  assert.ok(m.bannerEl.innerHTML.includes('data-cheer-uid="u-lea"'));

  // Arrêt du chrono : untrack, mais Léa est toujours en direct donc bannière encore visible
  m.L.onTimerStop();
  assert.ok(m.getUntracked() >= 1);
  assert.strictEqual(m.bannerEl.hidden, false);

  // Léa quitte le trône : bannière masquée (.hidden)
  m.setPresence({});
  m.handlers['presence:leave']();
  assert.strictEqual(m.bannerEl.hidden, true);
  assert.strictEqual(m.bannerEl.innerHTML, '');

  m.L.disconnect();
  assert.ok(m.getUnsubscribed() >= 1);
});

test('Live Throne : sendCheer envoie un broadcast et déclenche un toast chez la destinataire', async () => {
  const m = makeRealtimeMock({ id: 'u-dest', username: 'Chloé', avatar: '🌸' });
  m.L.connectGroup('grp-99');

  const ok = await m.L.sendCheer('u-lea', 'Léa');
  assert.strictEqual(ok, true);
  assert.strictEqual(m.sentBroadcasts.length, 1);
  assert.strictEqual(m.sentBroadcasts[0].type, 'broadcast');
  assert.strictEqual(m.sentBroadcasts[0].event, 'cheer');
  assert.strictEqual(m.sentBroadcasts[0].payload.targetUserId, 'u-lea');

  // Réception d'un encouragement adressé à quelqu'un d'autre -> ignoré
  const countBefore = m.toasts.length;
  m.handlers['broadcast:cheer']({
    payload: { targetUserId: 'u-autre', fromUserId: 'u-lea', fromName: 'Léa', emoji: '💪' },
  });
  assert.strictEqual(m.toasts.length, countBefore);

  // Réception d'un encouragement adressé à nous ('u-dest') -> toast fête !
  m.handlers['broadcast:cheer']({
    payload: { targetUserId: 'u-dest', fromUserId: 'u-lea', fromName: 'Léa', emoji: '🧻' },
  });
  assert.strictEqual(m.toasts.length, countBefore + 1);
  assert.ok(m.toasts[m.toasts.length - 1].msg.includes('Léa'));
  assert.strictEqual(m.toasts[m.toasts.length - 1].type, 'party');
});

test('extractLiveSitters : dédoublonne par userId et ignore les séances > 2h', () => {
  const { extractLiveSitters } = loadInto('js/social-live.js').SocialLiveModule;
  const now = 1_800_000_000_000;
  const sitters = extractLiveSitters({
    a: [
      { userId: 'a', username: 'Alice', avatar: '💩', startedAt: now - 60_000 },
      { userId: 'a', username: 'Alice', avatar: '👑', startedAt: now - 10_000 },
    ],
    old: [{ userId: 'old', username: 'Oubliée', avatar: '😴', startedAt: now - 3 * 3600 * 1000 }],
    b: [{ userId: 'b', username: 'Bérénice', avatar: '🌸', startedAt: now - 120_000 }],
  }, now);

  assert.strictEqual(sitters.length, 2);
  assert.strictEqual(sitters[0].userId, 'b'); // plus ancienne en premier
  assert.strictEqual(sitters[1].userId, 'a');
  assert.strictEqual(sitters[1].avatar, '👑'); // garde l'état le plus récent
});

// ---------- 3. Cartes encodées : Duel 1v1, Sondage express, Toilettes Advisor ----------

test('Duel 1v1 : aller-retour, nettoyage des séparateurs et limite <= 500 car.', () => {
  const L = loadInto('js/social-live.js').SocialLiveModule;

  const body = L.formatDuelMessage('plop', 'seed42', 128, 'Clémence');
  assert.strictEqual(body, '[duel:plop:seed42:128:Clémence]');
  assert.deepStrictEqual(plain(L.parseDuelMessage(body)), {
    game: 'plop',
    seed: 'seed42',
    score: 128,
    pseudo: 'Clémence',
  });

  // Caractères spéciaux et pseudo géant (> 600 car. avec emojis)
  const longPseudo = 'Reine:Du:[Trône]💩'.repeat(50);
  const capped = L.formatDuelMessage('pq', 999, -12, longPseudo);
  assert.ok(capped.length <= 500, `attendu <= 500, reçu ${capped.length}`);
  const parsed = L.parseDuelMessage(capped);
  assert.ok(parsed);
  assert.strictEqual(parsed.game, 'pq');
  assert.strictEqual(parsed.score, 0);
  assert.ok(!/[\uD800-\uDBFF]$/.test(parsed.pseudo), 'pas de surrogate coupé');

  // Entrées invalides
  assert.strictEqual(L.formatDuelMessage('', 1, 10, 'A'), null);
  assert.strictEqual(L.parseDuelMessage('Salut [duel:plop:1:10:Moi]'), null);
  assert.strictEqual(L.parseDuelMessage('[duel:plop:1:abc:Moi]'), null);
  assert.strictEqual(L.parseDuelMessage('[duel:plop:1:-5:Moi]'), null);
  assert.strictEqual(L.parseDuelMessage(null), null);
});

test('Sondage express : aller-retour, limite <= 500 car. et persistance des votes chat.polls.v1', () => {
  const ctx = loadInto('js/social-live.js');
  const L = ctx.SocialLiveModule;

  const msg = L.formatPollMessage('PQ plié ou froissé ?', 'Plié 📐', 'Froissé 🌪️');
  assert.strictEqual(msg, '[poll:PQ plié ou froissé ?|Plié 📐|Froissé 🌪️]');
  assert.deepStrictEqual(plain(L.parsePollMessage(msg)), {
    question: 'PQ plié ou froissé ?',
    options: ['Plié 📐', 'Froissé 🌪️'],
  });

  // Nettoyage des pipes/crochets et troncature <= 500 car.
  const hugeQ = 'Question | piège [test]\n'.repeat(35) + '💩'.repeat(40);
  const hugeA = 'Option A | 1 '.repeat(15);
  const hugeB = 'Option B ] 2 '.repeat(15);
  const capped = L.formatPollMessage(hugeQ, hugeA, hugeB);
  assert.ok(capped.length <= 500, `attendu <= 500, reçu ${capped.length}`);
  const parsed = L.parsePollMessage(capped);
  assert.ok(parsed);
  assert.strictEqual(parsed.options.length, 2);

  // Cas invalides
  assert.strictEqual(L.formatPollMessage('Question seule', '', 'Oui'), null);
  assert.strictEqual(L.parsePollMessage('[poll:Question|UneSeuleOption]'), null);
  assert.strictEqual(L.parsePollMessage('[poll:Q|A|B|C]'), null);
  assert.strictEqual(L.parsePollMessage(undefined), null);

  // Votes locaux
  assert.strictEqual(L.getPollVote('msg-101'), null);
  assert.strictEqual(L.votePoll('msg-101', 1), 1);
  assert.strictEqual(L.getPollVote('msg-101'), 1);
  assert.strictEqual(L.votePoll('msg-101', 0), 0);
  assert.strictEqual(L.getPollVote('msg-101'), 0);
  assert.strictEqual(L.votePoll('msg-101', 5), null);
  assert.ok(ctx.localStorage.getItem('chat.polls.v1').includes('"msg-101":0'));
});

test('Toilettes Advisor : formatSpotMessage / parseSpotMessage (bornes, note vide, <= 500 car.)', () => {
  const L = loadInto('js/social-live.js').SocialLiveModule;

  const spotMsg = L.formatSpotMessage({
    name: 'Café de Flore',
    stars: 5,
    pq: true,
    clean: true,
    lock: false,
    note: 'Papier triple épaisseur !',
  });
  assert.strictEqual(spotMsg, '[spot:Café de Flore|5|1|1|0|Papier triple épaisseur !]');
  assert.deepStrictEqual(plain(L.parseSpotMessage(spotMsg)), {
    name: 'Café de Flore',
    stars: 5,
    pq: true,
    clean: true,
    lock: false,
    note: 'Papier triple épaisseur !',
  });

  // Note vide & bornage des étoiles 1..5
  const emptyNote = L.formatSpotMessage({ name: 'BU Droit', stars: 99, pq: false, clean: false, lock: true, note: '' });
  assert.strictEqual(emptyNote, '[spot:BU Droit|5|0|0|1|]');
  assert.deepStrictEqual(plain(L.parseSpotMessage(emptyNote)), {
    name: 'BU Droit',
    stars: 5,
    pq: false,
    clean: false,
    lock: true,
    note: '',
  });

  const minStar = L.formatSpotMessage({ name: 'Aire A6', stars: -3, pq: false, clean: false, lock: false });
  assert.strictEqual(L.parseSpotMessage(minStar).stars, 1);

  // Troncature <= 500 car. avec emojis surrogate pairs
  const longSpot = L.formatSpotMessage({
    name: 'Gare TGV | Hall [Nord] 🚽'.repeat(10),
    stars: 4,
    pq: true,
    clean: true,
    lock: true,
    note: 'Super propre mais code sur le ticket 🧻💩'.repeat(25),
  });
  assert.ok(longSpot.length <= 500, `attendu <= 500, reçu ${longSpot.length}`);
  const parsedLong = L.parseSpotMessage(longSpot);
  assert.ok(parsedLong, 'un spot tronqué doit rester intégralement décodable');
  assert.strictEqual(parsedLong.stars, 4);

  // Entrées invalides
  assert.strictEqual(L.formatSpotMessage({ name: '   ', stars: 3 }), null);
  assert.strictEqual(L.parseSpotMessage('[spot:Café|6|1|1|1|ok]'), null);
  assert.strictEqual(L.parseSpotMessage('[spot:Café|0|1|1|1|ok]'), null);
  assert.strictEqual(L.parseSpotMessage('[spot:Café|4|2|1|1|ok]'), null);
  assert.strictEqual(L.parseSpotMessage('x'.repeat(501)), null);
});

test('Carnet local advisor.spots.v1 & aggregateSpots : fusion, dédoublonnage et tri par ⭐', () => {
  const ctx = loadInto('js/social-live.js', {
    SupabaseClient: { getCurrentProfile: () => ({ id: 'u1', username: 'Clémence', avatar: '👑' }) },
  });
  const L = ctx.SocialLiveModule;

  // Sauvegarde locale
  const saved = L.saveLocalSpot({
    name: 'Café Central',
    stars: 5,
    pq: true,
    clean: true,
    lock: true,
    note: 'Parfait',
    createdAt: 1000,
  });
  assert.ok(saved.id);
  assert.strictEqual(L.getLocalSpots().length, 1);

  // Le même avis exactement envoyé au chat par Clémence + d'autres avis de membres
  const messages = [
    {
      id: 'm1',
      user_id: 'u1',
      username: 'Clémence',
      created_at: new Date(1000).toISOString(),
      body: L.formatSpotMessage({ name: 'Café Central', stars: 5, pq: true, clean: true, lock: true, note: 'Parfait' }),
    },
    {
      id: 'm2',
      user_id: 'u2',
      username: 'Léa',
      created_at: new Date(2000).toISOString(),
      body: L.formatSpotMessage({ name: 'café central', stars: 3, pq: false, clean: true, lock: true, note: 'Plus de PQ à 18h' }),
    },
    {
      id: 'm3',
      user_id: 'u3',
      username: 'Sarah',
      created_at: new Date(3000).toISOString(),
      body: L.formatSpotMessage({ name: 'Palais Royal', stars: 5, pq: true, clean: true, lock: true, note: 'Royal !' }),
    },
    {
      id: 'm4',
      user_id: 'u2',
      username: 'Léa',
      created_at: new Date(4000).toISOString(),
      body: 'Message normal ignoré',
    },
  ];

  const agg = L.aggregateSpots(messages, L.getLocalSpots());
  assert.strictEqual(agg.length, 2);

  // Palais Royal (5.0 ⭐) doit arriver avant Café Central (moyenne de 5 et 3 = 4.0 ⭐, pas 4.3 !)
  assert.strictEqual(agg[0].name, 'Palais Royal');
  assert.strictEqual(agg[0].avgStars, 5);
  assert.strictEqual(agg[0].count, 1);

  assert.strictEqual(agg[1].avgStars, 4);
  assert.strictEqual(agg[1].count, 2, 'l\'avis local identique posté au chat ne doit pas compter double');
  assert.strictEqual(agg[1].clean, true);
  assert.strictEqual(agg[1].lastNote, 'Plus de PQ à 18h');
});

test('renderSpotsPane : affiche les toilettes triées, le bouton + Noter et échappe le XSS', async () => {
  const paneEl = { innerHTML: '', querySelector: () => null };
  const ctx = loadInto('js/social-live.js', {
    SupabaseClient: {
      groupChatAvailable: () => true,
      getGroupMessages: async () => [
        {
          id: '1',
          user_id: 'u1',
          username: 'Malice',
          created_at: new Date().toISOString(),
          body: '[spot:<img src=x onerror=alert(1)>|5|1|1|1|<script>boom()</script>]',
        },
      ],
    },
    SocialModule: { currentGroupId: () => 'g1' },
    document: {
      getElementById: id => (id === 'social-pane-spots' ? paneEl : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      documentElement: { setAttribute() {}, getAttribute: () => null },
      body: { style: {} },
    },
  });

  const spots = await ctx.SocialLiveModule.renderSpotsPane('social-pane-spots');
  assert.strictEqual(spots.length, 1);
  assert.ok(paneEl.innerHTML.includes('+ Noter des toilettes ⭐'));
  assert.ok(paneEl.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(paneEl.innerHTML.includes('&lt;script&gt;boom()&lt;/script&gt;'));
  assert.ok(!paneEl.innerHTML.includes('<script>'));
  assert.ok(!paneEl.innerHTML.includes('<img src=x'));
});

// ---------- 4. Rendu enrichi Chat (js/chat.js) & Anti-XSS ----------

test('ChatModule.messageHTML : rend les cartes Duel, Sondage, Spot, Citations > et bouton ↩️ sans faille XSS', () => {
  let launchedGame = null;
  const inputEl = { value: '', focused: false, focus() { this.focused = true; }, setSelectionRange() {} };
  const messagesEl = {
    innerHTML: '',
    scrollHeight: 100,
    scrollTop: 0,
    clientHeight: 100,
    _listeners: {},
    addEventListener(ev, fn) { this._listeners[ev] = fn; },
  };

  const ctx = loadInto(['js/social-live.js', 'js/chat.js'], {
    openJeux: gameId => { launchedGame = gameId; },
    document: {
      getElementById: id => {
        if (id === 'chat-input') return inputEl;
        if (id === 'chat-messages') return messagesEl;
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      documentElement: { setAttribute() {}, getAttribute: () => null },
      body: { style: {} },
    },
  });

  const { ChatModule, SocialLiveModule } = ctx;

  // 1) Carte Duel + anti-XSS
  const duelHTML = ChatModule.messageHTML({
    id: 'm-duel',
    username: 'Léa',
    avatar: '👑',
    mine: false,
    created_at: '2026-09-28T12:00:00Z',
    body: '[duel:plop:seed99:42:<img src=x onerror=alert(1)>]',
  });
  assert.ok(duelHTML.includes('chat-card-duel'));
  assert.ok(duelHTML.includes('data-duel-game="plop"'));
  assert.ok(duelHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!duelHTML.includes('<img src=x'));
  assert.ok(duelHTML.includes('↩️'));

  // 2) Carte Sondage + vote local réfléchi
  SocialLiveModule.votePoll('m-poll', 1);
  const pollHTML = ChatModule.messageHTML({
    id: 'm-poll',
    username: 'Clémence',
    avatar: '💩',
    mine: true,
    created_at: '2026-09-28T12:01:00Z',
    body: '[poll:<script>q</script>|Opt "A"|Opt <B>]',
  });
  assert.ok(pollHTML.includes('chat-card-poll'));
  assert.ok(pollHTML.includes('is-voted'));
  assert.ok(pollHTML.includes('&lt;script&gt;q&lt;/script&gt;'));
  assert.ok(pollHTML.includes('Opt &quot;A&quot;'));
  assert.ok(pollHTML.includes('Opt &lt;B&gt;'));
  assert.ok(!pollHTML.includes('<script>'));

  // 3) Carte Spot Toilettes Advisor
  const spotHTML = ChatModule.messageHTML({
    id: 'm-spot',
    username: 'Sarah',
    avatar: '🌸',
    mine: false,
    created_at: '2026-09-28T12:02:00Z',
    body: '[spot:Bistrot <chic>|4|1|1|1|Super propre & calme]',
  });
  assert.ok(spotHTML.includes('chat-card-spot'));
  assert.ok(spotHTML.includes('⭐⭐⭐⭐☆'));
  assert.ok(spotHTML.includes('🧻 PQ'));
  assert.ok(spotHTML.includes('✨ Propre'));
  assert.ok(spotHTML.includes('🔒 Verrou'));
  assert.ok(spotHTML.includes('Bistrot &lt;chic&gt;'));
  assert.ok(!spotHTML.includes('<chic>'));

  // 4) Citation commençant par `> ` (ligne unique et multi-lignes) + anti-XSS
  const quoteHTML = ChatModule.messageHTML({
    id: 'm-quote',
    username: 'Léa',
    avatar: '💩',
    mine: false,
    created_at: '2026-09-28T12:03:00Z',
    body: '> @Clémence : <b>Bien joué !</b>',
  });
  assert.ok(quoteHTML.includes('<blockquote class="chat-quote"'));
  assert.ok(quoteHTML.includes('@Clémence :'));
  assert.ok(quoteHTML.includes('&lt;b&gt;Bien joué !&lt;/b&gt;'));
  assert.ok(!quoteHTML.includes('<b>Bien joué !</b>'));

  // 5) Pré-remplissage du champ de réponse `> @pseudo : `
  ChatModule.replyToUser('Clémence');
  assert.strictEqual(inputEl.value, '> @Clémence : ');
  assert.strictEqual(inputEl.focused, true);

  // 6) Lancement du jeu via délégation sur clic du bouton Duel
  ctx.SupabaseClient = {
    groupChatAvailable: () => true,
    getGroupMembers: async () => [],
    getGroupMessages: async () => [],
    getClient: () => null,
  };
  return ChatModule.open('g-test').then(() => {
    messagesEl._listeners.click({
      target: {
        closest: sel => (sel === '[data-duel-game]' ? { dataset: { duelGame: 'pq' } } : null),
      },
    });
    assert.strictEqual(launchedGame, 'pq');
  });
});

test('ChatModule : les boutons rapides #chat-duel-btn, #chat-poll-btn et #chat-spot-btn envoient les cartes encodées', async () => {
  const sentBodies = [];
  const makeBtn = () => {
    const b = { _fn: null, addEventListener(ev, fn) { if (ev === 'click') b._fn = fn; } };
    return b;
  };
  const duelBtn = makeBtn();
  const pollBtn = makeBtn();
  const spotBtn = makeBtn();

  const ctx = loadInto(['js/social-live.js', 'js/chat.js'], {
    UI: {
      choose: async () => 'colon',
      toast: () => {},
    },
    SupabaseClient: {
      getCurrentProfile: () => ({ id: 'u1', username: 'Clémence', avatar: '👑' }),
      groupChatAvailable: () => true,
      getGroupMembers: async () => [],
      getGroupMessages: async () => [],
      sendGroupMessage: async (_gid, body) => { sentBodies.push(body); },
      getClient: () => null,
    },
    document: {
      getElementById: id => {
        if (id === 'chat-duel-btn') return duelBtn;
        if (id === 'chat-poll-btn') return pollBtn;
        if (id === 'chat-spot-btn') return spotBtn;
        return null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      documentElement: { setAttribute() {}, getAttribute: () => null },
      body: { style: {} },
    },
  });

  ctx.localStorage.setItem('jeux.stats.v1', JSON.stringify({ best: { colon: 77 } }));
  await ctx.ChatModule.open('grp-quick');

  // 1) Clic sur #chat-duel-btn -> envoie [duel:colon:<seed>:77:Clémence]
  assert.strictEqual(typeof duelBtn._fn, 'function');
  await duelBtn._fn();
  assert.strictEqual(sentBodies.length, 1);
  const duelParsed = ctx.SocialLiveModule.parseDuelMessage(sentBodies[0]);
  assert.ok(duelParsed);
  assert.strictEqual(duelParsed.game, 'colon');
  assert.strictEqual(duelParsed.score, 77);
  assert.strictEqual(duelParsed.pseudo, 'Clémence');

  // 2) Clic sur #chat-poll-btn & #chat-spot-btn -> délèguent aux modales de SocialLiveModule
  ctx.SocialLiveModule.openCreatePollModal = cb => cb('[poll:Café ou thé ?|Café ☕|Thé 🍵]');
  ctx.SocialLiveModule.openAddSpotModal = cb => cb({ name: 'Gare' }, '[spot:Gare|3|1|0|1|Payant]');

  pollBtn._fn();
  spotBtn._fn();
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(sentBodies.length, 3);
  assert.strictEqual(sentBodies[1], '[poll:Café ou thé ?|Café ☕|Thé 🍵]');
  assert.strictEqual(sentBodies[2], '[spot:Gare|3|1|0|1|Payant]');
  ctx.ChatModule.close();
});

