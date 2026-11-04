/* Pressed Pages — sidebar: stationery sections, drag-to-page placement */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;
  const A = () => PP.Assets;

  const SB = {};

  /* ---------- section model ---------- */
  function sections() {
    const AS = A();
    const bot = AS.Stickers.filter(function (s) { return s.cat === 'botanical'; });
    const friends = AS.Stickers.filter(function (s) { return s.cat === 'friends'; });
    const stamps = AS.Stickers.filter(function (s) { return s.cat === 'stamps'; });
    const keeps = AS.Stickers.filter(function (s) { return s.cat === 'keepsakes'; });

    return [
      {
        id: 'notes', title: 'Sticky notes', open: true, kind: 'swatches',
        items: AS.NOTE_COLORS.map(function (c) {
          return { label: c.label, bg: c.hex, spec: { type: 'sticky', color: c.hex } };
        })
      },
      {
        id: 'writing', title: 'Writing', open: true, kind: 'presets',
        items: [
          { label: 'Handwritten', spec: { type: 'text', props: { font: 'caveat', size: 23 } }, sample: { font: 'caveat', size: 20, text: 'write by hand' } },
          { label: 'Fine script', spec: { type: 'text', props: { font: 'kalam', size: 16 } }, sample: { font: 'kalam', size: 14, text: 'a finer note' } },
          { label: 'Typewriter', spec: { type: 'text', props: { font: 'type', size: 14 } }, sample: { font: 'type', size: 12, text: 'typed note' } },
          { label: 'Serif title', spec: { type: 'text', props: { font: 'serif', size: 27, color: '#7a5c3e' } }, sample: { font: 'serif', size: 17, text: 'A Title' } },
          { label: "Today's entry", spec: { type: 'text', props: { font: 'type', size: 14, html: U.fmtLongDate() + '<br><br>' } }, sample: { font: 'type', size: 11, text: 'dated entry' } }
        ]
      },
      {
        id: 'botanical', title: 'Pressed botanicals', open: true, kind: 'tiles',
        items: bot.map(function (s) { return { label: s.label, art: s, spec: { type: 'art', art: s.id } }; })
      },
      {
        id: 'friends', title: 'Garden friends', open: true, kind: 'tiles',
        items: friends.map(function (s) { return { label: s.label, art: s, spec: { type: 'art', art: s.id } }; })
      },
      {
        id: 'charms', title: 'Charms & marks', open: true, kind: 'tiles',
        items: AS.Charms.map(function (c) {
          return { label: c.label, charm: c, spec: { type: 'charm', charm: c.id, ink: c.fixedInk ? null : '#7a5c3e' } };
        })
      },
      {
        id: 'stamps', title: 'Stamps & postmarks', open: true, kind: 'tiles',
        items: stamps.map(function (s) { return { label: s.label, art: s, spec: { type: 'art', art: s.id } }; }).concat([
          { label: 'Date postmark', mark: 'postmark', spec: { type: 'datemark', style: 'postmark' } },
          { label: 'Received stamp', mark: 'received', spec: { type: 'datemark', style: 'received' } }
        ])
      },
      {
        id: 'tapes', title: 'Tapes', open: true, kind: 'tiles',
        items: [
          { tape: { color: '#cdb289', pattern: 'plain' }, label: 'Kraft, plain', spec: { type: 'tape', color: '#cdb289', pattern: 'plain' } },
          { tape: { color: '#ece2c8', pattern: 'stripes' }, label: 'Cream, striped', spec: { type: 'tape', color: '#ece2c8', pattern: 'stripes' } },
          { tape: { color: '#c3cbb0', pattern: 'grid' }, label: 'Sage, grid', spec: { type: 'tape', color: '#c3cbb0', pattern: 'grid' } },
          { tape: { color: '#e5c8bf', pattern: 'dots' }, label: 'Blush, dotted', spec: { type: 'tape', color: '#e5c8bf', pattern: 'dots' } },
          { tape: { color: '#c2c8d2', pattern: 'plain' }, label: 'Slate, plain', spec: { type: 'tape', color: '#c2c8d2', pattern: 'plain' } },
          { tape: { color: '#e8e8e0', pattern: 'stripes' }, label: 'Frost, striped', spec: { type: 'tape', color: '#e8e8e0', pattern: 'stripes' } }
        ]
      },
      {
        id: 'photos', title: 'Photos & keepsakes', open: true, kind: 'tiles',
        items: A().FRAMES.map(function (f) {
          return { label: 'Polaroid — ' + f.label.toLowerCase(), frame: f.id, spec: { type: 'polaroid', frame: f.id } };
        }).concat(keeps.map(function (s) { return { label: s.label, art: s, spec: { type: 'art', art: s.id } }; }))
      }
    ];
  }

  /* ---------- build ---------- */
  SB.build = function () {
    const root = U.qs('#sbSections');
    root.innerHTML = '';
    sections().forEach(function (sec) {
      const s = U.el('div', 'sb-section' + (sec.open ? '' : ' closed'));
      s.dataset.id = sec.id;
      const head = U.el('div', 'sb-section-head');
      head.innerHTML = '<span class="cap">' + sec.title + '</span>' +
        '<svg class="tw" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg>';
      head.addEventListener('click', function () { s.classList.toggle('closed'); });
      s.appendChild(head);

      if (sec.kind === 'swatches') {
        const grid = U.el('div', 'swatch-stack');
        sec.items.forEach(function (it) {
          const t = U.el('div', 'note-sw');
          t.style.background = it.bg;
          t.title = it.label + ' sticky note';
          t.setAttribute('role', 'button');
          t.setAttribute('aria-label', it.label + ' sticky note');
          t.appendChild(U.el('span', 'lbl', it.label));
          wireTile(t, it.spec);
          grid.appendChild(t);
        });
        s.appendChild(grid);
      } else if (sec.kind === 'presets') {
        const grid = U.el('div', 'sb-grid');
        grid.style.gridTemplateColumns = '1fr';
        sec.items.forEach(function (it) {
          const t = U.el('div', 'preset-tile');
          t.setAttribute('role', 'button');
          const sample = U.el('div', 'sample', it.sample.text);
          const css = A().FONTS.find(function (f) { return f.id === it.sample.font; });
          sample.style.fontFamily = css ? css.css : 'inherit';
          sample.style.fontSize = it.sample.size + 'px';
          sample.style.color = '#4a4237';
          t.appendChild(sample);
          t.appendChild(U.el('div', 'lbl', it.label));
          t.title = it.label;
          wireTile(t, it.spec);
          grid.appendChild(t);
        });
        s.appendChild(grid);
      } else {
        const grid = U.el('div', 'sb-grid');
        sec.items.forEach(function (it) {
          const t = U.el('div', 'sb-tile');
          t.setAttribute('role', 'button');
          t.title = it.label;
          t.setAttribute('aria-label', it.label);
          const thumb = U.el('div', 'thumb');
          fillThumb(thumb, it);
          t.appendChild(thumb);
          t.appendChild(U.el('span', 'lbl', it.label));
          wireTile(t, it.spec, it);
          grid.appendChild(t);
        });
        s.appendChild(grid);
      }
      root.appendChild(s);
    });
  };

  function fillThumb(thumb, it) {
    const AS = A();
    if (it.art) {
      const img = U.el('img');
      img.src = it.art.src;
      img.alt = '';
      img.draggable = false;
      thumb.appendChild(img);
    } else if (it.charm) {
      thumb.innerHTML = AS.charmSVG(it.charm.kind, it.charm.fixedInk ? '#8a8577' : '#6b6353');
    } else if (it.mark) {
      thumb.innerHTML = it.mark === 'postmark'
        ? AS.postmarkSVG({ dateText: U.fmtStampDate(), place: 'KEEPSAKE POST' })
        : AS.receivedSVG({ dateText: U.fmtStampDate() });
    } else if (it.tape) {
      thumb.innerHTML = AS.tapeSVG({ w: 96, h: 34, color: it.tape.color, pattern: it.tape.pattern });
    } else if (it.frame) {
      const f = U.el('div', 'mini-polaroid');
      const tone = { classic: '#f7f4ec', aged: '#efe6cf', kraft: '#cdb289', corners: '#f4eddc' }[it.frame] || '#f7f4ec';
      f.style.cssText = 'width:58px;height:70px;background:' + tone +
        ';border:1px solid rgba(74,60,35,.2);box-shadow:0 1px 3px rgba(74,60,35,.25);padding:5px 5px 0;display:flex;flex-direction:column;gap:3px;';
      const ph = U.el('div');
      ph.style.cssText = 'flex:1;background:repeating-linear-gradient(45deg,#e8e0cc 0 5px,#efe8d6 5px 10px);';
      const cap = U.el('div');
      cap.style.cssText = 'height:9px;background:rgba(74,60,35,.14);border-radius:1px;';
      f.appendChild(ph);
      f.appendChild(cap);
      if (it.frame === 'corners') { f.style.background = 'transparent'; f.style.border = 'none'; f.style.boxShadow = 'none'; }
      thumb.appendChild(f);
    }
  }

  /* ---------- drag ghost & placement ---------- */
  function ghostVisual(spec, tile) {
    const g = U.qs('#dragGhost');
    g.innerHTML = '';
    g.hidden = false;
    const AS = A();
    let node;
    if (spec.type === 'sticky') {
      node = U.el('div');
      node.style.cssText = 'width:74px;height:74px;background:' + spec.color +
        ';box-shadow:0 3px 8px rgba(74,60,35,.3), inset 0 2px 0 rgba(0,0,0,.05);';
    } else if (spec.type === 'text') {
      node = U.el('div');
      node.style.cssText = 'width:120px;height:38px;background:#fbf7ee;border:1px dashed #c3b698;' +
        'display:flex;align-items:center;justify-content:center;font-family:Caveat,cursive;font-size:16px;color:#6b6353;';
      node.textContent = 'text';
    } else if (spec.type === 'polaroid') {
      node = U.el('div');
      const tone = { classic: '#f7f4ec', aged: '#efe6cf', kraft: '#cdb289', corners: '#f4eddc' }[spec.frame] || '#f7f4ec';
      node.style.cssText = 'width:84px;height:100px;background:' + tone +
        ';box-shadow:0 3px 8px rgba(74,60,35,.3);padding:6px 6px 0;display:flex;flex-direction:column;gap:4px;';
      const ph = U.el('div');
      ph.style.cssText = 'flex:1;background:repeating-linear-gradient(45deg,#e8e0cc 0 6px,#efe8d6 6px 12px);';
      node.appendChild(ph);
    } else if (spec.type === 'datemark') {
      node = U.el('div');
      node.style.cssText = 'width:150px;';
      node.innerHTML = spec.style === 'received'
        ? AS.receivedSVG({ dateText: U.fmtStampDate() })
        : AS.postmarkSVG({ dateText: U.fmtStampDate() });
    } else {
      node = tile.querySelector('.thumb').cloneNode(true);
      node.style.pointerEvents = 'none';
    }
    g.appendChild(node);
    return g;
  }

  function wireTile(tile, spec, it) {
    tile.style.touchAction = 'none';
    tile.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      let ghost = null, moved = false;
      try { tile.setPointerCapture(e.pointerId); } catch (err) { /* pointer gone */ }

      function moveGhost(x, y) {
        ghost.style.left = x + 'px';
        ghost.style.top = y + 'px';
      }
      function hintAt(x, y) {
        U.qsa('.page.drop-hint').forEach(function (p) { p.classList.remove('drop-hint'); });
        const t = document.elementFromPoint(x, y);
        const page = t ? t.closest('.page') : null;
        if (page && page.querySelector('.items')) page.classList.add('drop-hint');
      }
      function onMove(ev) {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        if (!moved) {
          moved = true;
          ghost = ghostVisual(spec, tile);
        }
        moveGhost(ev.clientX, ev.clientY);
        hintAt(ev.clientX, ev.clientY);
      }
      function onUp(ev) {
        tile.removeEventListener('pointermove', onMove);
        tile.removeEventListener('pointerup', onUp);
        tile.removeEventListener('pointercancel', onUp);
        U.qsa('.page.drop-hint').forEach(function (p) { p.classList.remove('drop-hint'); });
        if (ghost) { ghost.hidden = true; ghost.innerHTML = ''; ghost = null; }
        if (moved) {
          PP.Items.placeSpec(spec, ev.clientX, ev.clientY);
        } else {
          /* tap/click: place onto the current page centre */
          PP.Items.placeSpec(spec);
        }
        /* close drawer on compact screens so the page is visible */
        const sb = U.qs('#sidebar');
        if (sb.classList.contains('open')) {
          sb.classList.remove('open');
          U.qs('#sbScrim').classList.remove('show');
        }
      }
      tile.addEventListener('pointermove', onMove);
      tile.addEventListener('pointerup', onUp);
      tile.addEventListener('pointercancel', onUp);
    });
  }

  PP.Sidebar = SB;
})();
