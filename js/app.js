/* Pressed Pages — app: boot, chrome, modals, keyboard, presence */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;

  function S() { return PP.State.S; }
  let modalOpen = false;
  let authRequired = false;

  /* ================= toasts ================= */
  function toast(msg) {
    const box = U.qs('#toasts');
    const t = U.el('div', 'toast', msg);
    box.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s ease';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 260);
    }, 3000);
  }

  /* ================= chrome ================= */
  function paintChrome() {
    U.qs('#navPrev').innerHTML = U.icon('left');
    U.qs('#navNext').innerHTML = U.icon('right');
    U.qs('#settingsBtn').innerHTML = U.icon('gear');
    U.qs('#addLeafBtn').innerHTML = U.icon('plus') + '<span>Add pages</span>';
    U.qs('#sidebarToggle').innerHTML = U.icon('menu');
  }

  function updateStatus(st) {
    const el = U.qs('#saveStatus');
    el.className = 'save-status ' + (st === 'local' ? 'local' : st);
    el.lastChild.textContent = '';
    el.innerHTML = '<span class="dot"></span>' +
      ({ local: 'Local', saving: 'Saving', saved: 'Synced', offline: 'Offline' }[st] || st);
  }

  function updatePresence() {
    const box = U.qs('#presence');
    box.innerHTML = '';
    const me = U.el('span', 'pv you');
    me.innerHTML = '<i style="background:' + S().me.color + '"></i><span class="who">' +
      esc(S().me.name) + '</span>';
    box.appendChild(me);
    Object.keys(PP.Sync.peers).forEach(function (k) {
      const p = PP.Sync.peers[k];
      const chip = U.el('span', 'pv');
      chip.title = 'Reading: ' + (p.label || 'the journal');
      chip.innerHTML = '<i style="background:' + (p.color || '#8a9678') + '"></i><span class="who">' +
        esc(p.name || 'Reader') + '</span><span style="opacity:.75">' + esc(shortLabel(p.label)) + '</span>';
      box.appendChild(chip);
    });
  }
  function shortLabel(l) {
    if (!l) return '';
    const m = /Page (\d+)/.exec(l);
    if (m) return 'p.' + m[1];
    if (l === 'Front cover') return 'cover';
    if (l === 'Back cover') return 'end';
    return '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ================= modals ================= */
  function openModal(node) {
    const root = U.qs('#modalRoot');
    root.innerHTML = '';
    root.classList.toggle('auth-screen', authRequired);
    setAuthGate(authRequired);
    root.appendChild(node);
    modalOpen = true;
  }
  function setAuthGate(active) {
    U.qs('#topbar').inert = active;
    U.qs('#stage').inert = active;
  }
  function closeModal() {
    if (authRequired) return;
    U.qs('#modalRoot').innerHTML = '';
    modalOpen = false;
    setAuthGate(false);
  }
  PP.closeModal = closeModal;

  function showAuth(message) {
    authRequired = true;
    const { m, body } = mkModal('Sign in or create an account', 'Your account opens the shared journal automatically.');
    m.querySelector('.m-close').hidden = true;
    const email = mkInput('email', '', 'email address');
    email.autocomplete = 'email';
    email.required = true;
    body.appendChild(field('Email', email));
    const password = mkInput('password', '', 'password');
    password.autocomplete = 'current-password';
    password.required = true;
    password.minLength = 6;
    body.appendChild(field('Password', password));
    const status = U.el('div', 'auth-message', message || '');
    status.setAttribute('role', 'status');
    body.appendChild(status);

    const actions = U.el('div', 'm-actions');
    const signIn = U.el('button', 'chip-btn primary', 'Sign in');
    const signUp = U.el('button', 'chip-btn', 'Create account');
    async function authenticate(createAccount) {
      if (!email.value.trim() || !password.value) {
        status.textContent = 'Enter your email and password.';
        return;
      }
      signIn.disabled = signUp.disabled = true;
      status.textContent = createAccount ? 'Creating account…' : 'Signing in…';
      try {
        const result = createAccount
          ? await PP.Sync.signUp(email.value.trim(), password.value)
          : await PP.Sync.signIn(email.value.trim(), password.value);
        if (result.session) {
          await afterAuthentication();
          onStructure(true);
          authRequired = false;
          modalOpen = false;
          const modalRoot = U.qs('#modalRoot');
          modalRoot.innerHTML = '';
          modalRoot.classList.remove('auth-screen');
          setAuthGate(false);
        } else {
          status.textContent = 'Check your email to confirm the account, then sign in here.';
        }
      } catch (e) {
        status.textContent = e.message || 'Authentication failed.';
      } finally {
        signIn.disabled = signUp.disabled = false;
      }
    }
    signIn.addEventListener('click', function () { authenticate(false); });
    signUp.addEventListener('click', function () { authenticate(true); });
    email.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); password.focus(); }
    });
    password.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); authenticate(false); }
    });
    actions.appendChild(signIn);
    actions.appendChild(signUp);
    body.appendChild(actions);
    openModal(m);
    setTimeout(function () { email.focus(); }, 30);
  }

  async function afterAuthentication() {
    const cfg = PP.Sync.loadConfig();
    const emailName = (PP.Sync.user.email || '').split('@')[0];
    S().me.name = cfg.name || emailName || 'You';
    S().me.color = cfg.color || '#7d8a68';
    updatePresence();
    await PP.Sync.openGlobalJournal();
  }

  function mkModal(title, sub) {
    const m = U.el('div', 'modal');
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', title);
    const x = U.el('button', 'm-close');
    x.innerHTML = U.icon('close');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeModal);
    m.appendChild(x);
    m.appendChild(U.el('h2', null, title));
    if (sub) m.appendChild(U.el('p', 'm-sub', sub));
    const body = U.el('div', 'm-body');
    m.appendChild(body);
    return { m: m, body: body };
  }
  function field(labelText, input, hint) {
    const f = U.el('div', 'field');
    f.appendChild(U.el('label', null, labelText));
    f.appendChild(input);
    if (hint) f.appendChild(U.el('div', 'hint', hint));
    return f;
  }
  function mkInput(type, val, ph) {
    const i = U.el('input');
    i.type = type;
    if (val != null) i.value = val;
    if (ph) i.placeholder = ph;
    return i;
  }

  function saveName(v) {
    if (!v || !v.trim()) return;
    const cfg = PP.Sync.loadConfig();
    cfg.name = v.trim();
    const colors = ['#7d8a68', '#7d4a4a', '#7a5c3e', '#5d6b80', '#8a7ca0'];
    let h = 0;
    for (let i = 0; i < cfg.name.length; i++) h = (h * 31 + cfg.name.charCodeAt(i)) >>> 0;
    cfg.color = colors[h % colors.length];
    PP.Sync.saveConfig(cfg);
    S().me.name = cfg.name;
    S().me.color = cfg.color;
    updatePresence();
    PP.Sync.trackPresence();
  }

  /* ---------- settings ---------- */
  function showSettings() {
    const cfg = PP.Sync.loadConfig();
    const { m, body } = mkModal('Your name', 'This name appears beside you for other people in the journal.');

    const name = mkInput('text', cfg.name || '', 'your name');
    name.maxLength = 24;
    body.appendChild(field('Your name', name));

    const actions = U.el('div', 'm-actions');
    const save = U.el('button', 'chip-btn primary', 'Save name');
    save.addEventListener('click', function () {
      saveName(name.value);
      closeModal();
    });
    actions.appendChild(save);
    if (PP.Sync.isAuthenticated()) {
      const signOut = U.el('button', 'chip-btn', 'Sign out');
      signOut.addEventListener('click', async function () {
        signOut.disabled = true;
        try {
          await PP.Sync.signOut();
          PP.Sync.useLocal();
          authRequired = true;
          showAuth(null);
        } catch (e) {
          signOut.disabled = false;
          toast('Could not sign out. ' + e.message);
        }
      });
      actions.appendChild(signOut);
    }
    body.appendChild(actions);
    openModal(m);
    setTimeout(function () { name.focus(); }, 30);
  }

  /* ================= structure change ================= */
  function onStructure(resetPos) {
    if (resetPos) { S().flip = 0; S().seq = 0; }
    PP.Book.build();
    PP.Book.fitBook();
  }

  /* ================= keyboard ================= */
  function onKey(e) {
    if (modalOpen) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    const st = S();
    if (st.editing) return; /* the editable handles its own keys */
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) PP.State.redo(); else PP.State.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); PP.State.redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') {
      if (st.selected) { e.preventDefault(); PP.Items.duplicateSelected(); }
      return;
    }
    if (e.key === 'Escape') { PP.Items.deselect(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.selected) {
      e.preventDefault();
      PP.Items.deleteSelected();
      return;
    }
    if (e.key === 'Enter' && st.selected) {
      const item = PP.State.findItem(st.selected.pageId, st.selected.itemId);
      if (item && (item.type === 'text' || item.type === 'sticky')) {
        e.preventDefault();
        PP.Items.beginEdit(st.selected.pageId, item);
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (st.selected) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        PP.Items.nudgeSelected(e.key === 'ArrowLeft' ? -d : d, 0);
      } else {
        e.preventDefault();
        if (e.key === 'ArrowLeft') PP.Book.prev(); else PP.Book.next();
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (st.selected) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        PP.Items.nudgeSelected(0, e.key === 'ArrowUp' ? -d : d);
      }
    }
  }

  /* ================= boot ================= */
  async function boot() {
    paintChrome();
    PP.Bus.on('toast', toast);
    PP.Bus.on('status', updateStatus);
    PP.Bus.on('presence', updatePresence);
    PP.Bus.on('remotePage', function (d) {
      PP.Book.rerenderPage(d.pageId);
      if (d.by && S().editing && S().editing.pageId === d.pageId) {
        /* handled by pending rerender guard */
      }
    });
    PP.Bus.on('structure', function () { onStructure(false); });
    PP.Bus.on('flip', function () { updatePresence(); });

    const cfg = PP.Sync.loadConfig();
    S().me.name = cfg.name || 'You';
    S().me.color = cfg.color || '#7d8a68';

    let opened = false;
    let needsAuth = false;
    let authMessage = '';
    const sbCfg = PP.Sync.getSupabaseConfig();
    if (sbCfg.url && sbCfg.key) {
      try {
        await PP.Sync.connectSupabase(sbCfg.url, sbCfg.key);
        const session = await PP.Sync.getSession();
        if (session) {
          PP.Sync.user = session.user;
          await afterAuthentication();
          opened = true;
        } else {
          needsAuth = true;
        }
      } catch (e) {
        console.error(e);
        authMessage = 'Could not open the shared journal. ' + e.message;
        needsAuth = true;
      }
    } else {
      needsAuth = true;
      authMessage = 'Sign-in is currently unavailable. Please contact the journal administrator.';
      console.error('Authentication cannot start until Supabase credentials are configured in js/sync.js.');
    }
    if (!opened) PP.Sync.useLocal();

    PP.Book.build();
    PP.Sidebar.build();
    updateStatus(PP.Sync.status);
    updatePresence();

    /* mode + sizing */
    const mq = window.matchMedia('(max-width: 900px)');
    PP.Book.setMode(mq.matches, true);
    mq.addEventListener ? mq.addEventListener('change', function (ev) {
      PP.Book.setMode(ev.matches);
      PP.Items.deselect();
    }) : null;
    window.addEventListener('resize', function () {
      PP.Book.fitBook();
      PP.EditTools.trackItemToolbar();
    });

    /* chrome wiring */
    U.qs('#navPrev').addEventListener('click', function () { PP.Book.prev(); });
    U.qs('#navNext').addEventListener('click', function () { PP.Book.next(); });
    U.qs('#settingsBtn').addEventListener('click', showSettings);
    U.qs('#sidebarToggle').addEventListener('click', function () {
      const sb = U.qs('#sidebar');
      const open = sb.classList.toggle('open');
      U.qs('#sbScrim').classList.toggle('show', open);
    });
    U.qs('#sbScrim').addEventListener('click', function () {
      U.qs('#sidebar').classList.remove('open');
      U.qs('#sbScrim').classList.remove('show');
    });

    U.qs('#addLeafBtn').addEventListener('click', function () {
      const pages = PP.State.addLeaf(S().journal);
      if (!pages) { toast('The journal is already full — 24 pages is plenty to press.'); return; }
      PP.Sync.persistNewPages(pages);
      /* jump so the first fresh page is on the right */
      const map = PP.State.leafMap(S().journal);
      if (PP.Book.isSingle()) {
        const idx = PP.Book.faceSeq.findIndex(function (f) { return f.pageId === pages[0].id; });
        if (idx >= 0) S().seq = idx;
      } else {
        for (let i = 0; i < map.length; i++) {
          if (map[i].front === pages[0].id) { S().flip = i; break; }
        }
      }
      PP.Sync.structureChanged();
      onStructure(false);
      toast('Two fresh pages pressed in.');
    });

    /* click empty page -> deselect */
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.item')) return;
      if (e.target.closest('.floating-toolbar')) return;
      if (e.target.closest('#sidebar') || e.target.closest('#topbar') || e.target.closest('.modal')) return;
      if (S().selected) PP.Items.deselect();
    });

    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', function () { PP.Sync.flush(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') PP.Sync.flush();
    });

    if (needsAuth) showAuth(authMessage);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
