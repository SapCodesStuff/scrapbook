/* Pressed Pages — sync layer.
   Two modes:
   - local   : localStorage persistence + BroadcastChannel sync across tabs
   - supabase: one load query, debounced single-row upserts, realtime
               broadcast + presence (no polling, minimal disk IO)

   Everything the rest of the app needs goes through PP.Sync + PP.Bus. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;

  /* ---------- tiny event bus ---------- */
  function EventBus() {
    const map = {};
    return {
      on: function (ev, fn) { (map[ev] = map[ev] || []).push(fn); },
      emit: function (ev, data) { (map[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
    };
  }
  PP.Bus = EventBus();

  const LS_CFG = 'pp.config';
  const LS_LOCAL_JOURNAL = 'pp.localJournal';
  const SUPABASE_URL = 'https://pqxcjayifyiikklsgahz.supabase.co  ';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxeGNqYXlpZnlpaWtrbHNnYWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTg2NzQsImV4cCI6MjEwOTM5NDY3NH0.lavGDbJITFf70A8ehMWF3BL-onM99OwKocip6y1Pb04';

  const clientId = U.uid();
  const Sync = {
    mode: 'local',          /* 'local' | 'supabase' */
    status: 'local',        /* local | saving | saved | offline */
    sb: null,
    channel: null,
    bc: null,
    dirty: {},
    peers: {},              /* id -> {name, color, label, seen} */
    _bcastThrottles: {},
    _flushTimer: null,
    _warnedQuota: false,
    _signedPhotoUrls: {},
    user: null
  };

  /* ================= config ================= */
  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CFG) || '{}');
      return { name: saved.name || '', color: saved.color || '' };
    } catch (e) { return {}; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(LS_CFG, JSON.stringify({
      name: cfg && cfg.name || '',
      color: cfg && cfg.color || ''
    }));
  }
  Sync.loadConfig = loadConfig;
  Sync.saveConfig = saveConfig;
  Sync.getSupabaseConfig = function () {
    return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  };
  Sync.isAuthenticated = function () { return !!Sync.user; };
  Sync.getSession = async function () {
    const { data, error } = await Sync.sb.auth.getSession();
    if (error) throw new Error(error.message);
    Sync.user = data.session ? data.session.user : null;
    return data.session;
  };
  Sync.signIn = async function (email, password) {
    if (!Sync.sb) throw new Error('Sign-in is currently unavailable. Please contact the journal administrator.');
    const { data, error } = await Sync.sb.auth.signInWithPassword({ email: email, password: password });
    if (error) throw new Error(error.message);
    Sync.user = data.user;
    return data;
  };
  Sync.signUp = async function (email, password) {
    if (!Sync.sb) throw new Error('Sign-in is currently unavailable. Please contact the journal administrator.');
    const { data, error } = await Sync.sb.auth.signUp({ email: email, password: password });
    if (error) throw new Error(error.message);
    Sync.user = data.session ? data.user : null;
    return data;
  };
  Sync.signOut = async function () {
    if (!Sync.sb) return;
    const { error } = await Sync.sb.auth.signOut();
    if (error) throw new Error(error.message);
    Sync.user = null;
    Sync.peers = {};
  };
  Sync.photoUrl = async function (path) {
    const cached = Sync._signedPhotoUrls[path];
    if (cached && cached.expiresAt > Date.now() + 30000) return cached.url;
    const { data, error } = await Sync.sb.storage.from('pp-photos').createSignedUrl(path, 3600);
    if (error) throw new Error(error.message);
    Sync._signedPhotoUrls[path] = { url: data.signedUrl, expiresAt: Date.now() + 3500000 };
    return data.signedUrl;
  };
  Sync.photoStoragePath = function (url) {
    const marker = '/storage/v1/object/public/pp-photos/';
    const start = String(url || '').indexOf(marker);
    if (start < 0) return null;
    try { return decodeURIComponent(url.slice(start + marker.length).split('?')[0]); }
    catch (e) { return null; }
  };

  /* ================= status ================= */
  function setStatus(s) {
    Sync.status = s;
    PP.Bus.emit('status', s);
  }
  Sync.setStatus = setStatus;

  /* ================= page mutation entry points ================= */
  /* Called by UI after any local change to a page's content */
  Sync.pageChanged = function (pageId, reason) {
    const page = PP.State.pageById(PP.State.S.journal, pageId);
    if (!page) return;
    Sync.dirty[pageId] = true;
    if (Sync.mode === 'local') setStatus('saving'); else setStatus('saving');
    scheduleFlush();
    bcastPage(pageId, reason !== 'undo-silent');
  };

  /* structure changed (add leaf / title) — save journal meta + new rows */
  Sync.structureChanged = function () {
    if (Sync.mode === 'local') {
      scheduleFlush();
      bcSend({ t: 'journal', journal: PP.State.S.journal });
    } else {
      scheduleFlush();
      send({ t: 'structure' });
    }
  };

  /* ================= broadcast ================= */
  function bcastPage(pageId, notify) {
    const page = PP.State.pageById(PP.State.S.journal, pageId);
    if (!page) return;
    const payload = {
      t: 'page', pageId: page.id, kind: page.kind, index: page.index,
      content: page.content, rev: page.rev, by: clientId
    };
    if (Sync.mode === 'local') {
      /* BroadcastChannel never echoes to sender; throttle lightly */
      const th = Sync._bcastThrottles[pageId] ||
        (Sync._bcastThrottles[pageId] = U.throttle(function (p) { bcSend(p); }, 140));
      th(payload);
    } else {
      const th = Sync._bcastThrottles[pageId] ||
        (Sync._bcastThrottles[pageId] = U.throttle(function (p) { send(p); }, 140));
      th(payload);
    }
  }
  Sync.livePage = function (pageId) {
    bcastPage(pageId, true);
  };

  function bcSend(payload) {
    try { if (Sync.bc) Sync.bc.postMessage(payload); } catch (e) { /* channel closed */ }
  }
  function send(payload) {
    try { if (Sync.channel) Sync.channel.send({ type: 'broadcast', event: 'msg', payload: payload }); } catch (e) { /* not connected */ }
  }

  /* ================= persistence (debounced) ================= */
  function scheduleFlush() {
    clearTimeout(Sync._flushTimer);
    Sync._flushTimer = setTimeout(flush, Sync.mode === 'local' ? 1400 : 2200);
  }
  Sync.flush = flush;
  function flush() {
    clearTimeout(Sync._flushTimer);
    const ids = Object.keys(Sync.dirty);
    if (!ids.length) { if (Sync.mode === 'local') setStatus('local'); else setStatus('saved'); return; }
    if (Sync.mode === 'local') flushLocal(); else flushSupabase(ids);
  }

  function flushLocal() {
    const j = PP.State.S.journal;
    try {
      localStorage.setItem(LS_LOCAL_JOURNAL, JSON.stringify(j));
      Object.keys(Sync.dirty).forEach(function (k) { delete Sync.dirty[k]; });
      setStatus('local');
    } catch (e) {
      /* quota — drop embedded photo data and retry once */
      try {
        const slim = JSON.parse(JSON.stringify(j));
        slim.pages.forEach(function (p) {
          (p.content || []).forEach(function (it) {
            if (it.type === 'polaroid' && typeof it.src === 'string' && it.src.slice(0, 5) === 'data:') it.src = '';
          });
        });
        localStorage.setItem(LS_LOCAL_JOURNAL, JSON.stringify(slim));
        Object.keys(Sync.dirty).forEach(function (k) { delete Sync.dirty[k]; });
        setStatus('local');
        if (!Sync._warnedQuota) {
          Sync._warnedQuota = true;
          PP.Bus.emit('toast', 'Local storage is full — photos are kept for this session only.');
        }
      } catch (e2) {
        setStatus('offline');
      }
    }
  }

  async function flushSupabase(ids) {
    if (!Sync.sb) { setStatus('offline'); return; }
    const j = PP.State.S.journal;
    setStatus('saving');
    try {
      const rows = [];
      ids.forEach(function (pid) {
        const p = PP.State.pageById(j, pid);
        if (p) {
          rows.push({
            id: p.id, journal_id: j.id, page_index: p.index, kind: p.kind,
            content: p.content, rev: p.rev, updated_at: new Date().toISOString()
          });
          delete Sync.dirty[pid];
        }
      });
      if (rows.length) {
        const { error } = await Sync.sb.from('pp_pages').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      setStatus('saved');
    } catch (e) {
      console.error('flush failed', e);
      ids.forEach(function (pid) { Sync.dirty[pid] = true; });
      setStatus('offline');
    }
  }

  /* ================= remote messages ================= */
  function onMsg(payload) {
    if (!payload || payload.by === clientId) return;
    const j = PP.State.S.journal;
    if (!j) return;
    if (payload.t === 'page') {
      const local = PP.State.pageById(j, payload.pageId);
      if (!local) { refetch(); return; }
      local.content = payload.content || [];
      local.rev = payload.rev || 0;
      PP.Bus.emit('remotePage', { pageId: payload.pageId, by: payload.by });
    } else if (payload.t === 'structure') {
      refetch();
    } else if (payload.t === 'journal') {
      applyLocalJournal(payload.journal);
    } else if (payload.t === 'hello') {
      Sync.peers[payload.id] = { name: payload.name, color: payload.color, label: payload.label, seen: Date.now() };
      PP.Bus.emit('presence');
    } else if (payload.t === 'bye') {
      delete Sync.peers[payload.id];
      PP.Bus.emit('presence');
    }
  }

  async function refetch() {
    if (Sync.mode !== 'supabase') return;
    const j = await loadSupabaseJournal(PP.State.S.journal.id);
    if (j) {
      PP.State.S.journal.title = j.title;
      PP.State.S.journal.pages = j.pages;
      PP.Bus.emit('structure');
    }
  }

  function applyLocalJournal(incoming) {
    if (!incoming || PP.State.S.editing) return;
    PP.State.S.journal.title = incoming.title;
    PP.State.S.journal.pages = incoming.pages;
    PP.Bus.emit('structure');
  }

  /* ================= local mode ================= */
  Sync.useLocal = function () {
    Sync.mode = 'local';
    if (Sync.bc) { try { Sync.bc.close(); } catch (e) {} }
    Sync.bc = new BroadcastChannel('pressed-pages');
    Sync.bc.onmessage = function (e) { onMsg(e.data); };
    if (Sync.channel) { try { Sync.sb.removeChannel(Sync.channel); } catch (e) {} Sync.channel = null; }

    let j = null;
    try { j = JSON.parse(localStorage.getItem(LS_LOCAL_JOURNAL) || 'null'); } catch (e) {}
    if (!j) {
      j = PP.State.createJournal();
      try { localStorage.setItem(LS_LOCAL_JOURNAL, JSON.stringify(j)); } catch (e) {}
    }
    PP.State.S.journal = j;
    setStatus('local');
    startLocalHeartbeat();
    return j;
  };

  let _hbTimer = null;
  function stopLocalHeartbeat() {
    clearInterval(_hbTimer);
    _hbTimer = null;
  }
  function startLocalHeartbeat() {
    stopLocalHeartbeat();
    const say = function (t) {
      bcSend({ t: t, id: clientId, name: PP.State.S.me.name, color: PP.State.S.me.color, label: PP.Book ? PP.Book.pageLabel(PP.State.S.flip) : '' });
    };
    say('hello');
    _hbTimer = setInterval(function () {
      say('hello');
      const now = Date.now();
      let changed = false;
      Object.keys(Sync.peers).forEach(function (k) {
        if (now - Sync.peers[k].seen > 7000) { delete Sync.peers[k]; changed = true; }
      });
      if (changed) PP.Bus.emit('presence');
    }, 2600);
    window.addEventListener('beforeunload', function () { say('bye'); });
  }

  /* ================= supabase mode ================= */
  Sync.connectSupabase = async function (url, key) {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      throw new Error('supabase-js failed to load');
    }
    Sync.sb = window.supabase.createClient(url, key, {
      realtime: { params: { eventsPerSecond: 8 } }
    });
    Sync.mode = 'supabase';
    if (Sync.bc) { try { Sync.bc.close(); Sync.bc = null; } catch (e) {} }
    return true;
  };

  Sync.disconnectSupabase = function () {
    if (Sync.channel) { try { Sync.sb.removeChannel(Sync.channel); } catch (e) {} Sync.channel = null; }
    Sync.sb = null;
    Sync.mode = 'local';
  };

  async function loadSupabaseJournal(journalId) {
    const { data: jrow, error: e1 } = await Sync.sb.from('pp_journals')
      .select('id, title, created_at').eq('id', journalId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!jrow) return null;
    const { data: prows, error: e2 } = await Sync.sb.from('pp_pages')
      .select('id, page_index, kind, content, rev')
      .eq('journal_id', journalId).order('page_index');
    if (e2) throw new Error(e2.message);
    return {
      id: jrow.id,
      title: jrow.title || 'Pressed Pages',
      createdAt: jrow.created_at,
      pages: (prows || []).map(function (r) {
        return { id: r.id, index: r.page_index, kind: r.kind || 'canvas', content: r.content || [], rev: r.rev || 0 };
      })
    };
  }

  Sync.openGlobalJournal = async function () {
    if (!Sync.sb || !Sync.user) throw new Error('Sign in before opening the shared journal.');
    Sync.mode = 'supabase';
    stopLocalHeartbeat();
    if (Sync.bc) { try { Sync.bc.close(); Sync.bc = null; } catch (e) {} }
    const seed = PP.State.createJournal('Pressed Pages');
    const { data: journalId, error } = await Sync.sb.rpc('pp_open_global_journal', {
      p_journal_id: seed.id,
      p_title: seed.title,
      p_created_at: seed.createdAt,
      p_pages: seed.pages.map(function (p) {
        return { id: p.id, page_index: p.index, kind: p.kind, content: p.content, rev: p.rev };
      })
    });
    if (error) throw new Error(error.message);
    if (!journalId) throw new Error('The shared journal could not be resolved.');
    const j = await loadSupabaseJournal(journalId);
    if (!j) throw new Error('The shared journal is missing after opening.');
    PP.State.S.journal = j;
    const connected = await joinRealtime(j.id);
    setStatus(connected ? 'saved' : 'offline');
    return j;
  };

  /* persist pages added later (add leaf) */
  Sync.persistNewPages = async function (pages) {
    if (Sync.mode !== 'supabase' || !Sync.sb || !pages || !pages.length) return;
    const j = PP.State.S.journal;
    try {
      const rows = pages.map(function (p) {
        return { id: p.id, journal_id: j.id, page_index: p.index, kind: p.kind, content: p.content, rev: p.rev };
      });
      const { error } = await Sync.sb.from('pp_pages').insert(rows);
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error(e);
      PP.Bus.emit('toast', 'Could not save the new pages. ' + e.message);
    }
  };

  Sync.saveTitle = async function (title) {
    const j = PP.State.S.journal;
    j.title = title;
    if (Sync.mode === 'supabase' && Sync.sb) {
      const { error } = await Sync.sb.from('pp_journals').update({ title: title }).eq('id', j.id);
      if (error) throw new Error(error.message);
    }
    Sync.structureChanged();
  };

  async function joinRealtime(journalId) {
    if (Sync.channel) { try { Sync.sb.removeChannel(Sync.channel); } catch (e) {} }
    const ch = Sync.sb.channel('pp-' + journalId, {
      config: { private: true, broadcast: { self: false }, presence: { key: clientId } }
    });
    ch.on('broadcast', { event: 'msg' }, function (res) { onMsg(res.payload); });
    ch.on('presence', { event: 'sync' }, function () {
      const state = ch.presenceState();
      Sync.peers = {};
      Object.keys(state).forEach(function (key) {
        if (key === clientId) return;
        const metas = state[key] || [];
        if (metas[0]) Sync.peers[key] = { name: metas[0].name, color: metas[0].color, label: metas[0].label, seen: Date.now() };
      });
      PP.Bus.emit('presence');
    });
    return new Promise(function (resolve) {
      ch.subscribe(function (st) {
        if (st === 'SUBSCRIBED') {
          Sync.channel = ch;
          trackPresence();
          resolve(true);
        } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
          if (!Sync.channel) { setStatus('offline'); resolve(false); }
          else setStatus('offline');
        } else if (Sync.channel) setStatus('saved');
      });
    });
  }

  function trackPresence() {
    if (!Sync.channel) return;
    Sync.channel.track({
      name: PP.State.S.me.name,
      color: PP.State.S.me.color,
      label: PP.Book ? PP.Book.pageLabel(PP.State.S.flip) : ''
    });
  }
  Sync.trackPresence = function () {
    if (Sync.mode === 'supabase') trackPresence();
    else if (Sync.mode === 'local') {
      bcSend({ t: 'hello', id: clientId, name: PP.State.S.me.name, color: PP.State.S.me.color, label: PP.Book ? PP.Book.pageLabel(PP.State.S.flip) : '' });
    }
  };

  /* ================= photos ================= */
  Sync.uploadPhoto = async function (blob) {
    if (Sync.mode === 'supabase' && Sync.sb) {
      const path = PP.State.S.journal.id + '/' + U.uid() + '.jpg';
      const { error } = await Sync.sb.storage.from('pp-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(error.message);
      return { path: path };
    }
    return await U.blobToDataURL(blob);
  };

  PP.Sync = Sync;
})();
