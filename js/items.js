/* Pressed Pages — items: rendering + canvas interactions
   (drag, resize, rotate, inline text editing, photo upload) */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;
  const A = () => PP.Assets;
  const PAGE_W = 560, PAGE_H = 760;

  const Items = {
    _pendingRerender: {}
  };

  function S() { return PP.State.S; }
  function layerOf(pageId) {
    return U.qsa('.items').find(function (l) { return l.dataset.pageId === pageId; }) || null;
  }
  function itemElOf(pageId, itemId) {
    const l = layerOf(pageId);
    return l ? l.querySelector('.item[data-id="' + itemId + '"]') : null;
  }

  /* ================= natural sizes ================= */
  function natural(item) {
    switch (item.type) {
      case 'sticky': return { w: 170, h: 170 };
      case 'polaroid': return { w: 210, h: 254 };
      case 'tape': return { w: item.w || 180, h: item.h || 34 };
      case 'datemark':
        return item.style === 'received' ? { w: 158, h: 74 } : { w: 168, h: 118 };
      case 'art': {
        const a = A().byId(item.art);
        return a ? { w: a.w, h: a.h } : { w: 100, h: 100 };
      }
      case 'charm': {
        const c = A().Charms.find(function (x) { return x.id === item.charm; });
        return c ? { w: c.w, h: c.h } : { w: 40, h: 40 };
      }
      default: return { w: item.w || 240, h: 60 };
    }
  }
  function displaySize(item) {
    const n = natural(item);
    if (item.type === 'text') return { w: item.w, h: item._h || n.h };
    if (item.type === 'tape') return { w: item.w || n.w, h: item.h || n.h };
    const s = item.scale || 1;
    return { w: Math.round(n.w * s), h: Math.round(n.h * s) };
  }

  /* ================= render ================= */
  function fontClass(f) { return 'f-' + (f || 'caveat'); }
  function fontCss(f) {
    const one = A().FONTS.find(function (x) { return x.id === f; });
    return one ? one.css : "'Caveat', cursive";
  }

  function renderPageContent(layer, page) {
    if (S().editing && S().editing.pageId === page.id) {
      Items._pendingRerender[page.id] = true;
      return;
    }
    layer.innerHTML = '';
    (page.content || []).forEach(function (item, idx) {
      layer.appendChild(renderItem(item, idx));
    });
    /* measure text heights now that they are in the document */
    U.qsa('.item-text', layer).forEach(function (el) {
      const item = PP.State.findItem(page.id, el.dataset.id);
      if (item) refreshTextMetrics(el, item);
    });
    /* restore selection if the selected item lives on this page */
    const sel = S().selected;
    if (sel && sel.pageId === page.id) {
      const item = PP.State.findItem(page.id, sel.itemId);
      const el = item ? layer.querySelector('.item[data-id="' + item.id + '"]') : null;
      if (item && el) {
        el.classList.add('sel');
        addHandles(el, item);
        PP.EditTools.showItemToolbar(item, page.id);
      } else {
        S().selected = null;
        PP.EditTools.hideItemToolbar();
      }
    }
  }

  function renderItem(item, idx) {
    const el = U.el('div', 'item item-' + item.type);
    el.dataset.id = item.id;
    const d = displaySize(item);
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = d.w + 'px';
    el.style.height = d.h + 'px';
    if (idx != null) el.style.zIndex = idx;
    el.tabIndex = -1;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', itemLabel(item));

    const rot = U.el('div', 'item-rot');
    rot.style.setProperty('--rot', (item.rot || 0) + 'deg');
    const body = U.el('div', 'item-body');
    rot.appendChild(body);
    el.appendChild(rot);

    fillBody(body, item, d);

    /* selection state */
    if (S().selected && S().selected.pageId === pageIdOf(el) && S().selected.itemId === item.id) {
      el.classList.add('sel');
    }

    attachItemEvents(el, rot, item);
    return el;
  }

  function pageIdOf(el) {
    const layer = el.closest('.items');
    return layer ? layer.dataset.pageId : null;
  }
  function itemLabel(item) {
    const map = {
      text: 'Text', sticky: 'Sticky note', polaroid: 'Polaroid photo',
      tape: 'Tape', datemark: 'Date stamp', art: 'Sticker', charm: 'Sticker'
    };
    return map[item.type] || 'Item';
  }

  function fillBody(body, item, d) {
    const AS = A();
    switch (item.type) {
      case 'text': {
        body.style.padding = '0';
        const txt = U.el('div', 'txt ' + fontClass(item.font));
        txt.style.fontFamily = fontCss(item.font);
        txt.style.fontSize = (item.size || 22) + 'px';
        txt.style.color = item.color || '#3e382f';
        txt.innerHTML = item.html || '';
        if (!stripTags(item.html || '')) txt.classList.add('empty-hint');
        txt.dataset.hint = 'double-click to write';
        body.appendChild(txt);
        break;
      }
      case 'sticky': {
        const s = U.el('div', 'sticky-body');
        s.style.background = item.color || '#f5e6a8';
        const txt = U.el('div', 'txt');
        txt.style.fontSize = '19px';
        txt.innerHTML = item.html || '';
        if (!stripTags(item.html || '')) txt.classList.add('empty-hint');
        txt.dataset.hint = 'scribble here';
        s.appendChild(txt);
        body.appendChild(s);
        break;
      }
      case 'polaroid': {
        body.parentElement.parentElement.classList.add('f-' + (item.frame || 'classic'));
        const pl = U.el('div', 'pl-body');
        const ph = U.el('div', 'pl-photo');
        if (item.uploading) {
          const emp = U.el('div', 'empty busy');
          emp.innerHTML = U.icon('camera') + '<span class="cap">developing</span>';
          ph.appendChild(emp);
        } else if (item.src || item.photoPath) {
          const img = U.el('img');
          img.src = item.src;
          img.alt = item.alt || 'Polaroid photo';
          img.draggable = false;
          if (item.filter && item.filter !== 'none') img.className = 'fimg-' + item.filter;
          ph.appendChild(img);
          const privatePath = item.photoPath || PP.Sync.photoStoragePath(item.src);
          if (privatePath && PP.Sync.mode === 'supabase') {
            PP.Sync.photoUrl(privatePath).then(function (url) {
              if (img.isConnected) img.src = url;
            }).catch(function (err) {
              console.error(err);
              PP.Bus.emit('toast', 'The photo could not be loaded. ' + (err.message || ''));
            });
          }
        } else {
          const emp = U.el('div', 'empty');
          emp.innerHTML = U.icon('camera') + '<span class="cap">add photo</span>';
          ph.appendChild(emp);
        }
        pl.appendChild(ph);
        body.appendChild(pl);
        if ((item.frame || 'classic') === 'corners') {
          ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
            const c = U.el('div', 'pl-corner ' + pos);
            c.innerHTML = AS.cornerSVG();
            body.appendChild(c);
          });
        }
        break;
      }
      case 'art': {
        const a = AS.byId(item.art);
        if (a) {
          const img = U.el('img');
          img.src = a.src;
          img.alt = a.label;
          img.draggable = false;
          body.appendChild(img);
        }
        break;
      }
      case 'charm': {
        body.innerHTML = AS.charmSVG(item.charm, item.ink || '#3e382f');
        break;
      }
      case 'tape': {
        body.innerHTML = AS.tapeSVG({ w: item.w || 180, h: item.h || 34, color: item.color, pattern: item.pattern });
        break;
      }
      case 'datemark': {
        body.innerHTML = item.style === 'received'
          ? AS.receivedSVG({ dateText: item.dateText, place: item.place, ink: item.ink })
          : AS.postmarkSVG({ dateText: item.dateText, place: item.place, ink: item.ink });
        break;
      }
    }
  }

  function stripTags(html) {
    const d = U.el('div');
    d.innerHTML = html;
    return (d.textContent || '').trim();
  }

  /* re-render a single item in place (keeps DOM order) */
  function rerenderItem(pageId, itemId) {
    const old = itemElOf(pageId, itemId);
    if (!old) return;
    const item = PP.State.findItem(pageId, itemId);
    if (!item) return;
    const idx = Array.from(old.parentNode.children).indexOf(old);
    const fresh = renderItem(item, idx);
    old.parentNode.replaceChild(fresh, old);
    if (S().selected && S().selected.pageId === pageId && S().selected.itemId === itemId) {
      fresh.classList.add('sel');
      addHandles(fresh, item);
    }
  }

  /* ================= selection ================= */
  function deselect() {
    if (S().editing) endEdit(true);
    const sel = S().selected;
    if (!sel) return;
    S().selected = null;
    U.qsa('.item.sel').forEach(function (n) {
      n.classList.remove('sel');
      const h = n.querySelector('.handles');
      if (h) h.remove();
    });
    if (PP.EditTools) PP.EditTools.hideItemToolbar();
  }

  function select(pageId, itemId) {
    if (S().editing) endEdit(true);
    deselect();
    const item = PP.State.findItem(pageId, itemId);
    if (!item) return;
    S().selected = { pageId: pageId, itemId: itemId };
    const el = itemElOf(pageId, itemId);
    if (!el) return;
    el.classList.add('sel');
    addHandles(el, item);
    PP.EditTools.showItemToolbar(item, pageId);
  }
  Items.deselect = deselect;
  Items.select = select;
  Items.rerenderItem = rerenderItem;
  Items.renderPageContent = renderPageContent;

  Items.deselectIfNotVisible = function () {
    const sel = S().selected;
    if (!sel) return;
    const vis = PP.Book.visiblePageIds();
    if (vis.indexOf(sel.pageId) < 0) deselect();
  };

  function addHandles(el, item) {
    if (el.querySelector('.handles')) return;
    const h = U.el('div', 'handles');
    const del = U.el('button', 'h-del');
    del.title = 'Remove';
    del.setAttribute('aria-label', 'Remove item');
    del.innerHTML = U.icon('close');
    del.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      deleteItem(pageIdOf(el), item.id);
    });
    const rot = U.el('button', 'h-rot');
    rot.title = 'Rotate';
    rot.setAttribute('aria-label', 'Rotate item');
    const sc = U.el('button', 'h-scale');
    sc.title = 'Resize';
    sc.setAttribute('aria-label', 'Resize item');
    if (item.type === 'text') sc.title = 'Resize text';
    h.appendChild(del);
    h.appendChild(rot);
    h.appendChild(sc);
    el.querySelector('.item-rot').appendChild(h);
    attachHandleEvents(el, item, rot, sc);
  }

  /* ================= item events ================= */
  function attachItemEvents(el, rot, item) {
    rot.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      const pageId = pageIdOf(el);
      if (S().editing) {
        if (S().editing.pageId === pageId && S().editing.itemId === item.id) return; /* caret */
        endEdit(true);
      }
      const target = e.target;
      if (target.closest('.flip-zone')) return;
      if (target.closest('.h-del') || target.closest('.h-rot') || target.closest('.h-scale')) return;
      if (item.type === 'polaroid' && !item.src && !item.uploading && target.closest('.pl-photo')) {
        if (!S().selected || S().selected.itemId !== item.id) select(pageId, item.id);
        requestPhoto(pageId, item);
        return;
      }
      if (!S().selected || S().selected.itemId !== item.id) select(pageId, item.id);
      beginMove(e, pageId, item, el);
    });
    el.addEventListener('dblclick', function (e) {
      const pageId = pageIdOf(el);
      const target = e.target;
      if (item.type === 'text' || item.type === 'sticky') {
        beginEdit(pageId, item);
      } else if (item.type === 'polaroid') {
        if (target.closest('.pl-photo')) requestPhoto(pageId, item);
      }
    });
  }

  /* ---------- geometry helpers ---------- */
  function layerMetrics(layer) {
    const r = layer.getBoundingClientRect();
    return {
      sf: r.width / PAGE_W,
      rect: r
    };
  }
  function clientToLocal(layer, cx, cy) {
    const m = layerMetrics(layer);
    const x = (cx - m.rect.left) / m.sf;
    const y = (cy - m.rect.top) / m.sf;
    return { x: x, y: y, sf: m.sf };
  }

  /* ---------- move ---------- */
  function beginMove(e, pageId, item, el) {
    e.preventDefault();
    const layer = layerOf(pageId);
    if (!layer) return;
    const start = { point: clientToLocal(layer, e.clientX, e.clientY), ix: item.x, iy: item.y };
    let moved = false;
    const pointerTarget = el.querySelector('.item-rot'); /* .item has pointer-events:none */
    try { pointerTarget.setPointerCapture(e.pointerId); } catch (err) { /* pointer gone */ }
    document.body.classList.add('grabbing');

    function onMove(ev) {
      const point = clientToLocal(layer, ev.clientX, ev.clientY);
      const dx = point.x - start.point.x;
      const dy = point.y - start.point.y;
      if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      if (!moved) {
        moved = true;
        el.classList.add('dragging');
        PP.State.pushUndo(pageId);
      }
      item.x = Math.round(start.ix + dx);
      item.y = Math.round(start.iy + dy);
      const d = displaySize(item);
      item.x = U.clamp(item.x, -d.w + 40, PAGE_W - 40);
      item.y = U.clamp(item.y, -d.h + 40, PAGE_H - 40);
      el.style.left = item.x + 'px';
      el.style.top = item.y + 'px';
      PP.EditTools.trackItemToolbar();
      PP.Sync.livePage(pageId);
    }
    function onUp(ev) {
      pointerTarget.removeEventListener('pointermove', onMove);
      pointerTarget.removeEventListener('pointerup', onUp);
      pointerTarget.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('grabbing');
      el.classList.remove('dragging');
      if (moved) {
        commitPage(pageId);
        PP.EditTools.showItemToolbar(item, pageId);
      }
    }
    pointerTarget.addEventListener('pointermove', onMove);
    pointerTarget.addEventListener('pointerup', onUp);
    pointerTarget.addEventListener('pointercancel', onUp);
  }

  /* ---------- rotate & scale ---------- */
  function attachHandleEvents(el, item, rotBtn, scBtn) {
    rotBtn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pageId = pageIdOf(el);
      const layer = layerOf(pageId);
      const d = displaySize(item);
      const cx = item.x + d.w / 2, cy = item.y + d.h / 2;
      const p0 = clientToLocal(layer, e.clientX, e.clientY);
      const a0 = Math.atan2(p0.y - cy, p0.x - cx) * 180 / Math.PI;
      const r0 = item.rot || 0;
      let moved = false;
      try { rotBtn.setPointerCapture(e.pointerId); } catch (err) { /* pointer gone */ }

      function onMove(ev) {
        const p = clientToLocal(layer, ev.clientX, ev.clientY);
        let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
        const delta = ((a - a0 + 540) % 360) - 180;
        let rot = r0 + delta;
        const near0 = ((rot % 360) + 360) % 360;
        if (near0 < 5 || near0 > 355) rot = Math.round(rot / 360) * 360;
        else {
          const near15 = Math.round(rot / 15) * 15;
          if (Math.abs(rot - near15) < 3) rot = near15;
        }
        if (!moved) { moved = true; PP.State.pushUndo(pageId); el.classList.add('resizing'); }
        item.rot = Math.round(rot * 10) / 10;
        el.querySelector('.item-rot').style.setProperty('--rot', item.rot + 'deg');
        PP.Sync.livePage(pageId);
      }
      function onUp() {
        rotBtn.removeEventListener('pointermove', onMove);
        rotBtn.removeEventListener('pointerup', onUp);
        rotBtn.removeEventListener('pointercancel', onUp);
        el.classList.remove('resizing');
        if (moved) commitPage(pageId);
      }
      rotBtn.addEventListener('pointermove', onMove);
      rotBtn.addEventListener('pointerup', onUp);
      rotBtn.addEventListener('pointercancel', onUp);
    });

    scBtn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pageId = pageIdOf(el);
      const layer = layerOf(pageId);
      const d0 = displaySize(item);
      const cx = item.x + d0.w / 2, cy = item.y + d0.h / 2;
      const p0 = clientToLocal(layer, e.clientX, e.clientY);
      const dist0 = Math.max(12, Math.hypot(p0.x - cx, p0.y - cy));
      const initial = {
        scale: item.scale || 1,
        width: item.w || (item.type === 'tape' ? 180 : 200),
        height: item.h || 34,
        size: item.size || 22
      };
      let moved = false;
      try { scBtn.setPointerCapture(e.pointerId); } catch (err) { /* pointer gone */ }

      function apply() {
        const d = displaySize(item);
        item.x = Math.round(cx - d.w / 2);
        item.y = Math.round(cy - d.h / 2);
        el.style.left = item.x + 'px';
        el.style.top = item.y + 'px';
        el.style.width = d.w + 'px';
        el.style.height = d.h + 'px';
      }
      function onMove(ev) {
        const p = clientToLocal(layer, ev.clientX, ev.clientY);
        const dist = Math.max(12, Math.hypot(p.x - cx, p.y - cy));
        const f = dist / dist0;
        if (!moved) { moved = true; PP.State.pushUndo(pageId); el.classList.add('resizing'); }
        if (item.type === 'text') {
          item.size = U.clamp(Math.round(initial.size * f), 9, 64);
          item.w = Math.max(80, Math.round(initial.width * f));
          refreshTextMetrics(el, item);
          apply();
        } else if (item.type === 'tape') {
          item.w = U.clamp(Math.round(initial.width * f), 60, 460);
          item.h = U.clamp(Math.round(initial.height * f), 16, 100);
          apply();
          rerenderBody(el, item);
        } else {
          item.scale = U.clamp(initial.scale * f, 0.3, 2.8);
          apply();
          styleScaledBody(el.querySelector('.item-body'), item);
        }
        PP.Sync.livePage(pageId);
      }
      function onUp() {
        scBtn.removeEventListener('pointermove', onMove);
        scBtn.removeEventListener('pointerup', onUp);
        scBtn.removeEventListener('pointercancel', onUp);
        el.classList.remove('resizing');
        if (moved) {
          if (item.type === 'text') refreshTextMetrics(el, item);
          commitPage(pageId);
          PP.EditTools.showItemToolbar(item, pageId);
        }
      }
      scBtn.addEventListener('pointermove', onMove);
      scBtn.addEventListener('pointerup', onUp);
      scBtn.addEventListener('pointercancel', onUp);
    });
  }

  function rerenderBody(el, item) {
    const body = el.querySelector('.item-body');
    if (!body) return;
    body.innerHTML = '';
    const d = displaySize(item);
    /* scale inner content for transform-based types */
    const n = natural(item);
    const s = item.type === 'tape' ? 1 : (item.scale || 1);
    if (item.type !== 'text' && (n.w * s !== d.w || n.h * s !== d.h)) {
      /* body is transform-scaled */
    }
    fillBody(body, item, d);
    styleScaledBody(body, item);
  }

  /* non-text items render at natural size then transform-scale */
  function styleScaledBody(body, item) {
    if (item.type === 'text') return;
    const n = natural(item);
    body.style.width = n.w + 'px';
    body.style.height = n.h + 'px';
    body.style.transformOrigin = '0 0';
    if (item.type === 'tape') {
      body.style.transform = 'none';
      body.style.width = '100%';
      body.style.height = '100%';
    } else {
      const s = item.scale || 1;
      body.style.transform = 'scale(' + s + ')';
    }
  }

  function refreshTextMetrics(el, item) {
    const txt = el.querySelector('.txt');
    if (!txt) return;
    txt.style.fontSize = (item.size || 22) + 'px';
    el.style.width = item.w + 'px';
    const h = Math.max(24, txt.offsetHeight);
    item._h = h;
    el.style.height = h + 'px';
  }

  /* ================= text editing ================= */
  function editableTarget(item, el, part) {
    return el.querySelector('.txt');
  }
  function contentArrayOf(pageId) {
    return PP.State.contentOf(pageId);
  }

  function beginEdit(pageId, item, part) {
    const el = itemElOf(pageId, item.id);
    if (!el) return;
    if (S().editing && (S().editing.itemId !== item.id)) endEdit(true);
    S().editing = { pageId: pageId, itemId: item.id };
    const txt = editableTarget(item, el, part);
    if (!txt) return;
    txt.contentEditable = 'true';
    txt.classList.remove('empty-hint');
    txt.focus();
    try {
      const rng = document.createRange();
      rng.selectNodeContents(txt);
      rng.collapse(false); /* caret at end */
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
    } catch (e) {}
    el.classList.add('editing');
    PP.EditTools.showTextToolbar(item, pageId, txt);
    if (!txt.dataset.wired) {
      txt.dataset.wired = '1';
      /* re-measure as content changes */
      txt.addEventListener('input', function () {
        if (item.type === 'text') refreshTextMetrics(el, item);
      });
      txt.addEventListener('paste', function (e) {
        e.preventDefault();
        const t = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, t);
      });
      txt.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); endEdit(true); }
        e.stopPropagation();
      });
      txt.addEventListener('blur', function () {
        setTimeout(function () {
          if (S().editing && S().editing.itemId === item.id) endEdit(true);
        }, 60);
      });
    }
  }
  Items.beginEdit = beginEdit;

  function endEdit(commit) {
    const ed = S().editing;
    if (!ed) return;
    S().editing = null;
    const item = PP.State.findItem(ed.pageId, ed.itemId);
    const el = itemElOf(ed.pageId, ed.itemId);
    if (item && el) {
      const txt = editableTarget(item, el);
      let raw = '';
      if (txt) {
        txt.contentEditable = 'false';
        raw = txt.innerHTML;
      }
      const clean = U.sanitizeRich(raw);
      const empty = !stripTags(clean);
      item.html = clean;

      if (empty && item.__fresh) {
        /* brand-new empty text — remove quietly */
        const content = PP.State.contentOf(ed.pageId);
        const i = content.indexOf(item);
        if (i >= 0) content.splice(i, 1);
        PP.State.S.undo.pop(); /* drop the undo entry from its creation */
        PP.Book.rerenderPage(ed.pageId);
      } else {
        item.__fresh = false;
        if (item.type === 'text') refreshTextMetrics(el, item);
        if (txt && empty) txt.classList.add('empty-hint');
        rerenderItem(ed.pageId, ed.itemId);
        commitPage(ed.pageId);
      }
    }
    if (PP.EditTools) PP.EditTools.hideTextToolbar();
    if (Items._pendingRerender[ed.pageId]) {
      delete Items._pendingRerender[ed.pageId];
      PP.Book.rerenderPage(ed.pageId);
    }
  }

  /* ================= photos ================= */
  function requestPhoto(pageId, item) {
    const input = U.qs('#photoInput');
    input.value = '';
    input.onchange = async function () {
      const f = input.files && input.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { PP.Bus.emit('toast', 'That file is not an image.'); return; }
      if (f.size > 26 * 1024 * 1024) { PP.Bus.emit('toast', 'That photo is too large (over 25 MB).'); return; }
      item.uploading = true;
      rerenderItem(pageId, item.id);
      try {
        const maxDim = PP.Sync.mode === 'supabase' ? 1400 : 900;
        const blob = await U.compressImage(f, maxDim, 0.82);
        const url = await PP.Sync.uploadPhoto(blob);
        if (typeof url === 'string') item.src = url;
        else {
          item.photoPath = url.path;
          item.src = '';
        }
        item.alt = f.name.replace(/\.[^.]+$/, '');
        item.uploading = false;
        rerenderItem(pageId, item.id);
        commitPage(pageId);
      } catch (err) {
        console.error(err);
        item.uploading = false;
        rerenderItem(pageId, item.id);
        PP.Bus.emit('toast', 'The photo could not be saved. ' + (err && err.message ? err.message : ''));
      }
    };
    input.click();
  }
  Items.requestPhoto = requestPhoto;

  /* ================= mutations ================= */
  function commitPage(pageId) {
    const page = PP.State.pageById(S().journal, pageId);
    if (page) {
      page.rev = (page.rev || 0) + 1;
      PP.Sync.pageChanged(pageId);
    }
  }
  Items.commitPage = commitPage;

  function deleteItem(pageId, itemId) {
    const content = PP.State.contentOf(pageId);
    if (!content) return;
    const item = content.find(function (i) { return i.id === itemId; });
    if (!item) return;
    PP.State.pushUndo(pageId);
    content.splice(content.indexOf(item), 1);
    if (S().selected && S().selected.itemId === itemId) {
      S().selected = null;
      PP.EditTools.hideItemToolbar();
    }
    PP.Book.rerenderPage(pageId);
    commitPage(pageId);
  }
  Items.deleteItem = deleteItem;

  Items.deleteSelected = function () {
    const sel = S().selected;
    if (!sel || S().editing) return;
    deleteItem(sel.pageId, sel.itemId);
  };

  Items.duplicateSelected = function () {
    const sel = S().selected;
    if (!sel) return;
    const content = PP.State.contentOf(sel.pageId);
    const item = PP.State.findItem(sel.pageId, sel.itemId);
    if (!item || !content) return;
    PP.State.pushUndo(sel.pageId);
    const copy = U.deep(item);
    copy.id = U.uid();
    copy.x = U.clamp(item.x + 18, -20, PAGE_W - 60);
    copy.y = U.clamp(item.y + 18, -20, PAGE_H - 60);
    delete copy.__fresh;
    content.push(copy);
    PP.Book.rerenderPage(sel.pageId);
    select(sel.pageId, copy.id);
    commitPage(sel.pageId);
  };

  function reorderSelected(front) {
    const sel = S().selected;
    if (!sel) return;
    const content = PP.State.contentOf(sel.pageId);
    const item = PP.State.findItem(sel.pageId, sel.itemId);
    if (!item || !content || content.length < 2) return;
    PP.State.pushUndo(sel.pageId);
    content.splice(content.indexOf(item), 1);
    if (front) content.push(item); else content.unshift(item);
    PP.Book.rerenderPage(sel.pageId);
    /* keep selection after rerender */
    const el = itemElOf(sel.pageId, sel.itemId);
    if (el) {
      el.classList.add('sel');
      addHandles(el, item);
    }
    commitPage(sel.pageId);
  }
  Items.bringFront = function () { reorderSelected(true); };
  Items.sendBack = function () { reorderSelected(false); };

  Items.nudgeSelected = function (dx, dy) {
    const sel = S().selected;
    if (!sel || S().editing) return;
    const item = PP.State.findItem(sel.pageId, sel.itemId);
    const el = itemElOf(sel.pageId, sel.itemId);
    if (!item || !el) return;
    PP.State.pushUndo(sel.pageId);
    item.x += dx; item.y += dy;
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    commitPage(sel.pageId);
  };

  /* ================= factories ================= */
  function todayStamp() { return U.fmtStampDate(); }

  Items.factory = function (spec, x, y) {
    const AS = A();
    x = Math.round(x); y = Math.round(y);
    switch (spec.type) {
      case 'sticky':
        return { id: U.uid(), type: 'sticky', x: x - 85, y: y - 85, scale: 1, rot: Math.round(U.rand(-3, 3) * 10) / 10, color: spec.color, html: '', __fresh: true };
      case 'text':
        return Object.assign({ id: U.uid(), type: 'text', x: x - 120, y: y - 18, w: 260, size: 22, font: 'caveat', color: '#3e382f', rot: 0, html: '', __fresh: true }, spec.props || {});
      case 'art': {
        const a = AS.byId(spec.art);
        return { id: U.uid(), type: 'art', art: spec.art, x: x - a.w / 2, y: y - a.h / 2, scale: spec.scale || 1, rot: Math.round(U.rand(-5, 5) * 10) / 10 };
      }
      case 'charm': {
        const c = AS.Charms.find(function (k) { return k.id === spec.charm; });
        return { id: U.uid(), type: 'charm', charm: spec.charm, ink: spec.ink || '#7a5c3e', x: x - c.w / 2, y: y - c.h / 2, scale: 1, rot: 0 };
      }
      case 'tape':
        return { id: U.uid(), type: 'tape', x: x - 90, y: y - 17, w: 180, h: 34, rot: Math.round(U.rand(-14, 8) * 10) / 10, color: spec.color, pattern: spec.pattern || 'plain' };
      case 'polaroid':
        return { id: U.uid(), type: 'polaroid', frame: spec.frame || 'classic', filter: 'none', src: '', alt: '', x: x - 105, y: y - 127, scale: 1, rot: Math.round(U.rand(-4, 4) * 10) / 10 };
      case 'datemark':
        return {
          id: U.uid(), type: 'datemark', style: spec.style || 'postmark',
          dateText: todayStamp(), place: spec.place || 'KEEPSAKE POST',
          ink: spec.ink || '#5a5248',
          x: x - (spec.style === 'received' ? 79 : 84),
          y: y - (spec.style === 'received' ? 37 : 59),
          scale: 1, rot: Math.round(U.rand(-4, 4) * 10) / 10
        };
    }
    return null;
  };

  /* place a factory spec onto a page at client coords (drop) or page center (click) */
  Items.placeSpec = function (spec, clientX, clientY) {
    let layer = null, pt = null;
    if (clientX != null) {
      const t = document.elementFromPoint(clientX, clientY);
      layer = t ? t.closest('.items') : null;
      if (layer) pt = clientToLocal(layer, clientX, clientY);
    }
    if (!layer) {
      const pid = PP.Book.targetPageId();
      layer = pid ? layerOf(pid) : null;
      if (!layer) return false;
      pt = { x: PAGE_W / 2 + U.rand(-70, 70), y: PAGE_H / 2 + U.rand(-70, 70) };
    }
    const pageId = layer.dataset.pageId;
    const page = PP.State.pageById(S().journal, pageId);
    if (!page) return false;
    const item = Items.factory(spec, pt.x, pt.y);
    if (!item) return false;
    PP.State.pushUndo(pageId);
    page.content.push(item);
    const el = renderItem(item, page.content.length - 1);
    layer.appendChild(el);
    if (item.type === 'text') {
      refreshTextMetrics(el, item);
      select(pageId, item.id);
      beginEdit(pageId, item);
      /* commit deferred until the writer types something (endEdit) */
    } else {
      select(pageId, item.id);
      commitPage(pageId);
    }
    return true;
  };

  /* legacy hook — text heights are measured inside renderPageContent now */
  Items.postRender = function () {};

  Items.layerOf = layerOf;
  Items.itemElOf = itemElOf;
  Items.displaySize = displaySize;
  Items.styleScaledBody = styleScaledBody;
  Items.refreshTextMetrics = refreshTextMetrics;
  Items.addHandles = addHandles;

  PP.Items = Items;
})();
