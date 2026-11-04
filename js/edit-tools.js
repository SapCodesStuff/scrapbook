/* Pressed Pages — floating toolbars: item actions & text formatting */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;
  const A = () => PP.Assets;

  const ET = {
    currentItem: null,
    currentPageId: null,
    editingTxt: null
  };

  function S() { return PP.State.S; }
  function tb() { return U.qs('#itemToolbar'); }

  /* ---------- small builders ---------- */
  function mkBtn(iconName, title, onClick, label) {
    const b = U.el('button', 'act');
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = U.icon(iconName) + (label ? '<span>' + label + '</span>' : '');
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }
  function mkSw(hex, title, active, onClick) {
    const b = U.el('button', 'sw' + (active ? ' on' : ''));
    b.title = title;
    b.setAttribute('aria-label', title);
    b.style.background = hex;
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }
  function mkChip(text, active, title, onClick) {
    const b = U.el('button', 'act' + (active ? ' on' : ''));
    if (title) b.title = title;
    b.textContent = text;
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }
  function sep() { return U.el('span', 'tb-sep'); }

  /* ---------- item toolbar ---------- */
  function showItemToolbar(item, pageId) {
    ET.currentItem = item;
    ET.currentPageId = pageId;
    const bar = tb();
    bar.hidden = false;
    buildItemToolbar();
    positionItemToolbar();
  }
  function buildItemToolbar() {
    const item = ET.currentItem, pageId = ET.currentPageId;
    const bar = tb();
    bar.innerHTML = '';
    if (!item) return;
    const AS = A();

    function refresh() {
      PP.Items.rerenderItem(pageId, item.id);
      PP.Items.commitPage(pageId);
      buildItemToolbar();
      positionItemToolbar();
    }
    function mutate(fn) {
      PP.State.pushUndo(pageId);
      fn();
      refresh();
    }

    /* type-specific controls */
    if (item.type === 'sticky') {
      AS.NOTE_COLORS.forEach(function (c) {
        bar.appendChild(mkSw(c.hex, c.label + ' note', item.color === c.hex, function () {
          mutate(function () { item.color = c.hex; });
        }));
      });
      bar.appendChild(sep());
    } else if (item.type === 'tape') {
      AS.TAPES.forEach(function (c) {
        bar.appendChild(mkSw(c.hex, c.label + ' tape', item.color === c.hex, function () {
          mutate(function () { item.color = c.hex; });
        }));
      });
      bar.appendChild(sep());
      const pats = [['plain', 'Plain'], ['stripes', 'Striped'], ['grid', 'Grid'], ['dots', 'Dotted']];
      pats.forEach(function (p) {
        bar.appendChild(mkChip(p[1], (item.pattern || 'plain') === p[0], p[1] + ' tape', function () {
          mutate(function () { item.pattern = p[0]; });
        }));
      });
      bar.appendChild(sep());
    } else if (item.type === 'charm') {
      const c = AS.Charms.find(function (x) { return x.id === item.charm; });
      if (!c || !c.fixedInk) {
        AS.INKS.forEach(function (ink) {
          bar.appendChild(mkSw(ink.hex, ink.label + ' ink', item.ink === ink.hex, function () {
            mutate(function () { item.ink = ink.hex; });
          }));
        });
        bar.appendChild(sep());
      }
    } else if (item.type === 'datemark') {
      AS.INKS.forEach(function (ink) {
        bar.appendChild(mkSw(ink.hex, ink.label + ' ink', item.ink === ink.hex, function () {
          mutate(function () { item.ink = ink.hex; });
        }));
      });
      bar.appendChild(sep());
      bar.appendChild(mkChip(item.style === 'received' ? 'Postmark' : 'Received', false, 'Switch mark style', function () {
        mutate(function () {
          item.style = item.style === 'received' ? 'postmark' : 'received';
          const n = PP.Items.displaySize(item);
          item.x = U.clamp(item.x, 0, 560 - n.w);
          item.y = U.clamp(item.y, 0, 760 - n.h);
        });
      }));
      bar.appendChild(mkBtn('cal', 'Change date and place', function () {
        toggleDateForm();
      }));
      bar.appendChild(sep());
    } else if (item.type === 'polaroid') {
      bar.appendChild(mkBtn('camera', 'Add or replace photo', function () {
        PP.Items.requestPhoto(pageId, item);
      }, 'Photo'));
      bar.appendChild(sep());
      AS.FRAMES.forEach(function (f) {
        bar.appendChild(mkChip(f.label.replace(' white', '').replace(' paper', '').replace(' mounts', 's'),
          (item.frame || 'classic') === f.id, f.label, function () {
            mutate(function () { item.frame = f.id; });
          }));
      });
      bar.appendChild(sep());
      AS.FILTERS.forEach(function (f) {
        bar.appendChild(mkChip(f.label, (item.filter || 'none') === f.id, f.label + ' photo tone', function () {
          mutate(function () { item.filter = f.id; });
        }));
      });
      bar.appendChild(sep());
    } else if (item.type === 'text') {
      bar.appendChild(mkBtn('pen', 'Double-click the text to write', function () {
        PP.Items.beginEdit(pageId, item);
      }, 'Write'));
      bar.appendChild(sep());
    }

    /* common controls */
    bar.appendChild(mkBtn('tofront', 'Bring to front', function () { PP.Items.bringFront(); }));
    bar.appendChild(mkBtn('toback', 'Send to back', function () { PP.Items.sendBack(); }));
    bar.appendChild(mkBtn('copy', 'Duplicate', function () { PP.Items.duplicateSelected(); }));
    bar.appendChild(mkBtn('trash', 'Remove', function () { PP.Items.deleteSelected(); }));

    /* date form (datemark) */
    if (item.type === 'datemark' && ET._dateFormOpen) {
      const row = U.el('div', 'tb-form');
      row.style.flexBasis = '100%';
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.padding = '4px 2px 0';
      const di = U.el('input');
      di.type = 'text';
      di.value = item.dateText || '';
      di.placeholder = '12 NOV 2026';
      di.setAttribute('aria-label', 'Date');
      di.style.cssText = 'height:28px;flex:1.2;min-width:110px;padding:0 8px;border:1px solid var(--line-2);border-radius:3px;background:#fbf7ee;font:inherit;font-size:13px;color:var(--ink)';
      const pi = U.el('input');
      pi.type = 'text';
      pi.value = item.place || '';
      pi.placeholder = 'place name';
      pi.setAttribute('aria-label', 'Place');
      pi.style.cssText = 'height:28px;flex:1.4;min-width:110px;padding:0 8px;border:1px solid var(--line-2);border-radius:3px;background:#fbf7ee;font:inherit;font-size:13px;color:var(--ink)';
      const ok = mkBtn('check', 'Apply', function () {
        mutate(function () {
          item.dateText = (di.value || U.fmtStampDate()).toUpperCase();
          item.place = (pi.value || 'KEEPSAKE POST').toUpperCase();
        });
        ET._dateFormOpen = false;
      });
      row.appendChild(di);
      row.appendChild(pi);
      row.appendChild(ok);
      bar.appendChild(row);
    }
  }

  function toggleDateForm() {
    ET._dateFormOpen = !ET._dateFormOpen;
    buildItemToolbar();
    positionItemToolbar();
  }

  function positionItemToolbar() {
    const item = ET.currentItem;
    const bar = tb();
    if (!item || bar.hidden) return;
    const el = PP.Items.itemElOf(ET.currentPageId, item.id);
    if (!el) { hideItemToolbar(); return; }
    const area = U.qs('#bookArea').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let left = r.left - area.left + r.width / 2;
    let top = r.top - area.top - 12;
    bar.style.visibility = 'hidden';
    bar.style.left = '0px'; bar.style.top = '0px';
    const bw = bar.offsetWidth || 200, bh = bar.offsetHeight || 40;
    let x = U.clamp(left, bw / 2 + 6, area.width - bw / 2 - 6);
    let y = top - bh;
    if (y < 6) y = r.bottom - area.top + 12;
    bar.style.left = Math.round(x) + 'px';
    bar.style.top = Math.round(y) + 'px';
    bar.style.transform = 'translate(-50%, 0)';
    bar.style.visibility = '';
  }

  function trackItemToolbar() {
    if (!tb().hidden) positionItemToolbar();
  }

  function hideItemToolbar() {
    tb().hidden = true;
    ET.currentItem = null;
    ET.currentPageId = null;
    ET._dateFormOpen = false;
  }

  /* ---------- text toolbar ---------- */
  function showTextToolbar(item, pageId, txtEl) {
    hideItemToolbar();
    ET.editingTxt = txtEl;
    ET._editItem = item;
    ET._editPageId = pageId;
    const bar = U.qs('#textToolbar');
    bar.hidden = false;
    buildTextToolbar();
  }
  function buildTextToolbar() {
    const item = ET._editItem, txt = ET.editingTxt;
    if (!item || !txt) return;
    const bar = U.qs('#textToolbar');
    bar.innerHTML = '';
    const AS = A();

    function commit() {
      /* font/size/colour are item props; html is saved on endEdit */
      PP.Items.refreshTextMetrics(txt.closest('.item'), item);
      PP.Items.commitPage(ET._editPageId);
    }
    function keep() { return false; }

    AS.FONTS.forEach(function (f) {
      const b = mkChip(f.label, item.font === f.id, f.label + ' lettering', function () {
        item.font = f.id;
        txt.style.fontFamily = f.css;
        commit();
        buildTextToolbar();
      });
      b.querySelector('span') && (b.querySelector('span').style.fontFamily = f.css);
      b.addEventListener('mousedown', keep);
      bar.appendChild(b);
    });
    bar.appendChild(sep());
    const minus = mkBtn('minus', 'Smaller text', function () {
      item.size = U.clamp((item.size || 22) - 2, 9, 64);
      txt.style.fontSize = item.size + 'px';
      commit();
    });
    const plus = mkBtn('plus', 'Larger text', function () {
      item.size = U.clamp((item.size || 22) + 2, 9, 64);
      txt.style.fontSize = item.size + 'px';
      commit();
    });
    minus.addEventListener('mousedown', keep);
    plus.addEventListener('mousedown', keep);
    bar.appendChild(minus);
    bar.appendChild(plus);
    bar.appendChild(sep());

    AS.INKS.forEach(function (ink) {
      const b = mkSw(ink.hex, ink.label + ' ink', false, function () {
        if (!wrapSelection(function (span) { span.style.color = ink.hex; })) {
          item.color = ink.hex;
          txt.style.color = ink.hex;
          commit();
        }
      });
      b.addEventListener('mousedown', keep);
      bar.appendChild(b);
    });
    bar.appendChild(sep());
    AS.HIGHLIGHTS.forEach(function (h) {
      const b = mkSw(h.hex, h.label + ' highlight', false, function () {
        wrapSelection(function (span) { span.className = 'hl'; span.style.backgroundColor = h.hex; });
      });
      b.addEventListener('mousedown', keep);
      bar.appendChild(b);
    });
    const clear = mkBtn('nohl', 'Remove highlight', function () {
      clearHighlights(txt);
    });
    clear.addEventListener('mousedown', keep);
    bar.appendChild(clear);
    bar.appendChild(sep());
    const done = mkBtn('check', 'Done writing', function () {
      PP.Items.deselect();
    }, 'Done');
    done.classList.add('done-btn');
    bar.appendChild(done);
  }
  function hideTextToolbar() {
    U.qs('#textToolbar').hidden = true;
    ET.editingTxt = null;
  }

  /* ---------- selection styling (highlight / ink) ---------- */
  function wrapSelection(apply) {
    const txt = ET.editingTxt;
    const sel = window.getSelection();
    if (!txt || !sel || !sel.rangeCount || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!txt.contains(range.commonAncestorContainer)) return false;
    const span = document.createElement('span');
    apply(span);
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      const r2 = document.createRange();
      r2.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(r2);
    } catch (e) { return false; }
    cleanupEmptyHighlights(txt);
    return true;
  }

  function clearHighlights(txt) {
    const sel = window.getSelection();
    let scope = txt;
    if (sel && sel.rangeCount && !sel.isCollapsed && txt.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      /* unwrap only highlighted spans that intersect the selection */
      const hits = [];
      txt.querySelectorAll('.hl').forEach(function (s) {
        try {
          const r = sel.getRangeAt(0);
          if (r.intersectsNode(s)) hits.push(s);
        } catch (e) { hits.push(s); }
      });
      if (!hits.length) hits.push.apply(hits, txt.querySelectorAll('.hl'));
      unwrap(hits);
    } else {
      unwrap(Array.from(txt.querySelectorAll('.hl')));
    }
  }
  function unwrap(spans) {
    spans.forEach(function (s) {
      const parent = s.parentNode;
      if (!parent) return;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
      parent.normalize && parent.normalize();
    });
  }
  function cleanupEmptyHighlights(txt) {
    if (!txt) return;
    txt.querySelectorAll('.hl').forEach(function (s) {
      if (!s.textContent.trim() && !s.querySelector('img')) {
        const p = s.parentNode;
        if (p) p.removeChild(s);
      }
    });
  }

  ET.showItemToolbar = showItemToolbar;
  ET.hideItemToolbar = hideItemToolbar;
  ET.positionItemToolbar = positionItemToolbar;
  ET.trackItemToolbar = trackItemToolbar;
  ET.showTextToolbar = showTextToolbar;
  ET.hideTextToolbar = hideTextToolbar;

  PP.EditTools = ET;
})();
