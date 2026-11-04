/* Pressed Pages — book: leaves, 3D flip engine, spread + single modes */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;
  const PAGE_W = 560, PAGE_H = 760;

  const B = {
    leafEls: [],
    faceSeq: [],          /* single mode: [{leaf, face}] */
    single: false,
    media: null
  };

  function S() { return PP.State.S; }

  /* ---------- build ---------- */
  function buildLeaves() {
    const book = U.qs('#book');
    U.qsa('.leaf', book).forEach(function (n) { n.remove(); });
    const j = S().journal;
    const map = PP.State.leafMap(j);
    B.leafEls = [];
    map.forEach(function (pair, i) {
      const leaf = U.el('div', 'leaf');
      leaf.dataset.i = i;
      if (i === 0) leaf.classList.add('is-cover');
      if (i === map.length - 1) leaf.classList.add('is-cover');
      const front = U.el('div', 'face front');
      const back = U.el('div', 'face back');
      fillFace(front, pair.front, 'front', i);
      fillFace(back, pair.back, 'back', i);
      leaf.appendChild(front);
      leaf.appendChild(back);
      book.appendChild(leaf);
      B.leafEls.push(leaf);
    });
    buildFaceSeq(map);
    /* keep position valid after structure changes */
    S().flip = U.clamp(S().flip, 0, map.length);
    S().seq = U.clamp(S().seq, 0, Math.max(0, B.faceSeq.length - 1));
    updateFlipState(false);
  }

  function fillFace(face, pageId, which, leafIndex) {
    const j = S().journal;
    if (!pageId) {
      /* cover decor */
      const cover = U.el('div', 'cover' + (which === 'back' ? ' back' : ''));
      cover.appendChild(U.el('div', 'rule-frame'));
      if (which === 'front') {
        const wreath = U.el('img', 'cv-wreath');
        wreath.src = 'assets/art/cover-wreath.svg';
        wreath.alt = '';
        const title = U.el('div', 'cv-title');
        title.textContent = j.title || 'Pressed Pages';
        const sub = U.el('div', 'cv-sub');
        sub.textContent = 'a shared scrapbook journal';
        cover.appendChild(wreath);
        cover.appendChild(title);
        cover.appendChild(sub);
        cover.addEventListener('click', function () { next(); });
        cover.style.cursor = 'pointer';
      } else {
        const wreath = U.el('img', 'cv-wreath small');
        wreath.src = 'assets/art/cover-wreath.svg';
        wreath.alt = '';
        const sub = U.el('div', 'cv-sub');
        sub.textContent = 'pressed with care';
        cover.appendChild(wreath);
        cover.appendChild(sub);
        cover.addEventListener('click', function () { prev(); });
        cover.style.cursor = 'pointer';
      }
      face.appendChild(cover);
      return;
    }
    const page = PP.State.pageById(j, pageId);
    if (!page) return;
    const pg = U.el('div', 'page' + (page.kind === 'endpaper' ? ' endpaper' : ''));
    const items = U.el('div', 'items');
    items.dataset.pageId = pageId;
    pg.appendChild(items);
    face.appendChild(pg);
    /* flip zones */
    const zl = U.el('button', 'flip-zone left');
    zl.setAttribute('aria-label', 'Previous page');
    zl.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
    const zr = U.el('button', 'flip-zone right');
    zr.setAttribute('aria-label', 'Next page');
    zr.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    pg.appendChild(zl);
    pg.appendChild(zr);
    if (PP.Items) PP.Items.renderPageContent(items, page);
  }

  function buildFaceSeq(map) {
    B.faceSeq = [];
    map.forEach(function (pair, i) {
      if (pair.front !== null || i === 0) B.faceSeq.push({ leaf: i, face: 'front', pageId: pair.front });
      if (pair.back !== null || i === map.length - 1) B.faceSeq.push({ leaf: i, face: 'back', pageId: pair.back });
    });
  }

  /* ---------- flip state ---------- */
  function updateFlipState(animate) {
    const n = B.leafEls.length;
    B.leafEls.forEach(function (leafEl, i) {
      let flipped;
      if (B.single) {
        const cur = B.faceSeq[Math.min(S().seq, B.faceSeq.length - 1)] || B.faceSeq[0];
        /* everything strictly before the current leaf is flipped away */
        flipped = i < (cur ? cur.leaf : 0);
        if (cur && cur.face === 'back' && i === cur.leaf) flipped = true;
      } else {
        flipped = i < S().flip;
      }
      leafEl.classList.toggle('flipped', flipped);
      if (!animate) leafEl.style.transition = 'none';
      /* resting z */
      let z;
      if (B.single) {
        const cur = B.faceSeq[S().seq] || B.faceSeq[0];
        const curLeaf = cur ? cur.leaf : 0;
        z = i === curLeaf ? 500 : (i < curLeaf ? 50 + (i - curLeaf) : 50 - (i - curLeaf));
      } else {
        z = flipped ? i + 1 : n - i;
      }
      leafEl.style.zIndex = z;
      if (!animate) {
        void leafEl.offsetHeight;
        leafEl.style.transition = '';
      }
    });
    const book = U.qs('#book');
    book.classList.toggle('single', B.single);
    const open = B.single ? S().seq > 0 : S().flip > 0;
    const stacked = !B.single && S().flip >= n;
    book.classList.toggle('open', open && !stacked);
    book.classList.toggle('stacked', stacked);
    updateLabel();
    fitBook();
    PP.Sync.trackPresence();
  }

  /* ---------- navigation ---------- */
  function lockBriefly() {
    S().flipping = true;
    setTimeout(function () { S().flipping = false; }, 560);
  }

  function next() {
    if (S().flipping) return;
    if (B.single) {
      if (S().seq >= B.faceSeq.length - 1) return;
      const cur = B.faceSeq[S().seq];
      const to = B.faceSeq[S().seq + 1];
      S().seq++;
      if (cur.leaf !== to.leaf) {
        /* moving from leaf k front to leaf k+1 front: unflip k as k+1 rises */
        turnLeaf(cur.leaf, false);
        bumpZ(to.leaf);
      } else {
        turnLeaf(cur.leaf, true);
      }
    } else {
      if (S().flip >= B.leafEls.length) return;
      turnLeaf(S().flip, true);
      S().flip++;
    }
    finishTurn();
  }

  function prev() {
    if (S().flipping) return;
    if (B.single) {
      if (S().seq <= 0) return;
      const cur = B.faceSeq[S().seq];
      const to = B.faceSeq[S().seq - 1];
      S().seq--;
      if (cur.leaf !== to.leaf) {
        /* from leaf k front back to leaf k-1 back: flip k-1 back on top */
        turnLeaf(to.leaf, true);
        bumpZ(to.leaf);
      } else {
        turnLeaf(cur.leaf, false);
      }
    } else {
      if (S().flip <= 0) return;
      S().flip--;
      turnLeaf(S().flip, false);
    }
    finishTurn();
  }

  function turnLeaf(i, toFlipped) {
    const leaf = B.leafEls[i];
    if (!leaf) return;
    leaf.classList.add('turning');
    const done = function () {
      leaf.classList.remove('turning');
      leaf.removeEventListener('transitionend', done);
      applyRestingZ();
    };
    leaf.addEventListener('transitionend', done);
    setTimeout(done, 780);
    /* apply state change after a frame so transition fires */
    requestAnimationFrame(function () {
      leaf.classList.toggle('flipped', toFlipped);
      updateLabelsOnly();
    });
  }

  function bumpZ(i) {
    const leaf = B.leafEls[i];
    if (leaf) leaf.style.zIndex = 600;
  }

  function applyRestingZ() {
    const n = B.leafEls.length;
    B.leafEls.forEach(function (leafEl, i) {
      let z;
      if (B.single) {
        const cur = B.faceSeq[S().seq] || B.faceSeq[0];
        const curLeaf = cur ? cur.leaf : 0;
        z = i === curLeaf ? 500 : (i < curLeaf ? 50 + (i - curLeaf) : 50 - (i - curLeaf));
      } else {
        z = leafEl.classList.contains('flipped') ? i + 1 : n - i;
      }
      leafEl.style.zIndex = z;
    });
    updateLabel();
  }

  function finishTurn() {
    lockBriefly();
    PP.Items.deselect();
    PP.Sync.trackPresence();
    PP.Bus.emit('flip');
    /* update open/stacked classes after animation starts */
    setTimeout(function () {
      const n = B.leafEls.length;
      const book = U.qs('#book');
      const open = B.single ? S().seq > 0 : S().flip > 0;
      const stacked = !B.single && S().flip >= n;
      book.classList.toggle('open', open && !stacked);
      book.classList.toggle('stacked', stacked);
    }, 40);
  }

  function updateLabelsOnly() { updateLabel(); }

  /* ---------- labels & visible pages ---------- */
  function pageNumbers() {
    const j = S().journal;
    const canvas = j.pages.filter(function (p) { return p.kind === 'canvas'; })
      .sort(function (a, b) { return a.index - b.index; });
    const map = {};
    canvas.forEach(function (p, i) { map[p.id] = i + 1; });
    return { map: map, total: canvas.length };
  }

  function pageLabel(pos) {
    const j = S().journal;
    const nums = pageNumbers();
    const m = PP.State.leafMap(j);
    const labelOf = function (pageId) {
      if (!pageId) return '';
      if (nums.map[pageId]) return 'Page ' + nums.map[pageId];
      const p = PP.State.pageById(j, pageId);
      if (p && p.kind === 'endpaper') return 'Endpaper';
      return '';
    };
    let pair;
    if (B.single) {
      const cur = B.faceSeq[pos == null ? S().seq : pos] || B.faceSeq[0];
      pair = [cur];
      if (cur && cur.leaf === 0 && cur.face === 'front') return 'Front cover';
      if (cur && cur.leaf === m.length - 1 && cur.face === 'back') return 'Back cover';
      const l = labelOf(cur ? cur.pageId : null);
      return l || 'Cover';
    }
    const flip = pos == null ? S().flip : pos;
    if (flip <= 0) return 'Front cover';
    if (flip >= m.length) return 'Back cover';
    const left = m[flip - 1].back, right = m[flip].front;
    const ls = labelOf(left), rs = labelOf(right);
    const parts = [ls, rs].filter(Boolean);
    if (!parts.length) return 'Pages';
    let base = parts.join(' · ');
    if (nums.total) base += '  |  ' + nums.total + ' pages';
    return base;
  }

  function visiblePageIds() {
    const m = PP.State.leafMap(S().journal);
    const ids = [];
    if (B.single) {
      const cur = B.faceSeq[S().seq];
      if (cur && cur.pageId) ids.push(cur.pageId);
    } else {
      if (S().flip > 0 && m[S().flip - 1].back) ids.push(m[S().flip - 1].back);
      if (S().flip < m.length && m[S().flip].front) ids.push(m[S().flip].front);
    }
    return ids;
  }

  /* primary page for click-to-place */
  function targetPageId() {
    const vis = visiblePageIds();
    if (!vis.length) return null;
    const j = S().journal;
    /* prefer a plain canvas page; else endpaper */
    for (let i = vis.length - 1; i >= 0; i--) {
      const p = PP.State.pageById(j, vis[i]);
      if (p && p.kind === 'canvas') return vis[i];
    }
    const first = PP.State.pageById(j, vis[0]);
    return first ? first.id : null;
  }

  /* ---------- scaling ---------- */
  function fitBook() {
    const area = U.qs('#bookArea');
    const scaleWrap = U.qs('#bookScale');
    if (!area || !scaleWrap) return;
    const r = area.getBoundingClientRect();
    const w = B.single ? PAGE_W + 40 : PAGE_W * 2 + 46;
    const h = PAGE_H + 40;
    const s = Math.min(1.15, (r.width - 20) / w, (r.height - 20) / h);
    S().viewScale = s;
    scaleWrap.style.transform = 'scale(' + s + ')';
  }

  function setMode(single, keepPos) {
    if (B.single === single) return;
    /* translate position between modes */
    if (!keepPos) {
      if (single) {
        S().seq = Math.min(S().flip * 2, B.faceSeq.length - 1);
      } else {
        S().flip = Math.floor((S().seq || 0) / 2);
      }
    }
    B.single = single;
    updateFlipState(false);
  }

  /* ---------- api ---------- */
  B.build = buildLeaves;
  B.next = next;
  B.prev = prev;
  B.updateFlipState = updateFlipState;
  B.pageLabel = pageLabel;
  B.visiblePageIds = visiblePageIds;
  B.targetPageId = targetPageId;
  B.fitBook = fitBook;
  B.setMode = setMode;
  B.isSingle = function () { return B.single; };

  B.rerenderPage = function (pageId) {
    const j = S().journal;
    const page = PP.State.pageById(j, pageId);
    if (!page) return;
    U.qsa('.items').forEach(function (layer) {
      if (layer.dataset.pageId === pageId) PP.Items.renderPageContent(layer, page);
    });
    PP.Items.deselectIfNotVisible();
  };

  B.refreshCovers = function () {
    const j = S().journal;
    U.qsa('.cover .cv-title').forEach(function (t) { t.textContent = j.title || 'Pressed Pages'; });
  };

  function updateLabel() {
    const el = U.qs('#pageLabel');
    if (el) el.textContent = pageLabel();
  }
  B.updateLabel = updateLabel;

  PP.Book = B;
})();
