/* Pressed Pages — asset registry & parametric vector builders.
   Static art lives in assets/art/*.svg (original CC0-style vector art).
   Parametric pieces (charms, postmarks, tapes) are built here as inline SVG. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;

  /* ---------- palettes ---------- */
  const INKS = [
    { id: 'charcoal', label: 'Charcoal', hex: '#3e382f' },
    { id: 'sepia', label: 'Sepia', hex: '#7a5c3e' },
    { id: 'wine', label: 'Wine', hex: '#7d4a4a' },
    { id: 'forest', label: 'Forest', hex: '#4d5c45' },
    { id: 'slate', label: 'Slate', hex: '#4f5d6e' }
  ];
  const NOTE_COLORS = [
    { id: 'butter', label: 'Butter', hex: '#f5e6a8' },
    { id: 'blush', label: 'Blush', hex: '#f2cfc6' },
    { id: 'mint', label: 'Mint', hex: '#d6e6cd' },
    { id: 'peri', label: 'Periwinkle', hex: '#d8def0' },
    { id: 'peach', label: 'Peach', hex: '#f6dbc0' },
    { id: 'lilac', label: 'Lilac', hex: '#e4d9ea' }
  ];
  const HIGHLIGHTS = [
    { id: 'butter', label: 'Butter', hex: '#f9edb0' },
    { id: 'blush', label: 'Blush', hex: '#f7d9d1' },
    { id: 'mint', label: 'Mint', hex: '#ddefd5' },
    { id: 'peri', label: 'Periwinkle', hex: '#dde2f2' },
    { id: 'peach', label: 'Peach', hex: '#fadfc4' },
    { id: 'lilac', label: 'Lilac', hex: '#e9def0' }
  ];
  const TAPES = [
    { id: 'kraft', label: 'Kraft', hex: '#cdb289' },
    { id: 'cream', label: 'Cream', hex: '#ece2c8' },
    { id: 'sage', label: 'Sage', hex: '#c3cbb0' },
    { id: 'blush', label: 'Blush', hex: '#e5c8bf' },
    { id: 'slate', label: 'Slate', hex: '#c2c8d2' },
    { id: 'frost', label: 'Frost', hex: '#e8e8e0' }
  ];
  const FRAMES = [
    { id: 'classic', label: 'Classic white' },
    { id: 'aged', label: 'Aged cream' },
    { id: 'kraft', label: 'Kraft paper' },
    { id: 'corners', label: 'Corner mounts' }
  ];
  const FILTERS = [
    { id: 'none', label: 'True colour' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'fade', label: 'Faded' },
    { id: 'mono', label: 'Monochrome' }
  ];
  const FONTS = [
    { id: 'caveat', label: 'Hand', css: "'Caveat', cursive" },
    { id: 'kalam', label: 'Script', css: "'Kalam', cursive" },
    { id: 'type', label: 'Type', css: "'Special Elite', monospace" },
    { id: 'serif', label: 'Serif', css: "'Cormorant Garamond', Georgia, serif" }
  ];

  /* ---------- static art ---------- */
  const A = 'assets/art/';
  const Stickers = [
    { id: 'daisy', label: 'Pressed daisy', src: A + 'daisy.svg', w: 108, h: 153, cat: 'botanical', tintable: false },
    { id: 'lavender', label: 'Lavender', src: A + 'lavender.svg', w: 82, h: 155, cat: 'botanical', tintable: false },
    { id: 'fern', label: 'Fern frond', src: A + 'fern.svg', w: 148, h: 158, cat: 'botanical', tintable: false },
    { id: 'eucalyptus', label: 'Eucalyptus', src: A + 'eucalyptus.svg', w: 138, h: 156, cat: 'botanical', tintable: false },
    { id: 'babys-breath', label: "Baby's breath", src: A + 'babys-breath.svg', w: 128, h: 155, cat: 'botanical', tintable: false },
    { id: 'rose', label: 'Pressed rose', src: A + 'rose.svg', w: 100, h: 155, cat: 'botanical', tintable: false },
    { id: 'wheat', label: 'Wheat', src: A + 'wheat.svg', w: 110, h: 155, cat: 'botanical', tintable: false },
    { id: 'oak-leaf', label: 'Oak and acorn', src: A + 'oak-leaf.svg', w: 120, h: 138, cat: 'botanical', tintable: false },
    { id: 'olive-branch', label: 'Olive branch', src: A + 'olive-branch.svg', w: 160, h: 66, cat: 'botanical', tintable: false },
    { id: 'meadow', label: 'Meadow bundle', src: A + 'meadow-bundle.svg', w: 138, h: 147, cat: 'botanical', tintable: false },
    { id: 'pressed-bundle', label: 'Pressed bundle', src: A + 'pressed-bundle.svg', w: 160, h: 94, cat: 'botanical', tintable: false },
    { id: 'butterfly', label: 'Butterfly', src: A + 'butterfly.svg', w: 140, h: 121, cat: 'friends', tintable: false },
    { id: 'moth', label: 'Moth study', src: A + 'moth.svg', w: 140, h: 112, cat: 'friends', tintable: false },
    { id: 'bee', label: 'Garden bee', src: A + 'bee.svg', w: 120, h: 92, cat: 'friends', tintable: false },
    { id: 'wax-seal', label: 'Wax seal', src: A + 'wax-seal.svg', w: 92, h: 92, cat: 'keepsakes', tintable: false },
    { id: 'ticket', label: 'Keepsake ticket', src: A + 'ticket.svg', w: 158, h: 69, cat: 'keepsakes', tintable: false },
    { id: 'kraft-tag', label: 'Kraft tag', src: A + 'kraft-tag.svg', w: 106, h: 142, cat: 'keepsakes', tintable: false },
    { id: 'ribbon', label: 'Ribbon band', src: A + 'ribbon.svg', w: 158, h: 78, cat: 'keepsakes', tintable: false },
    { id: 'stamp-rose', label: 'Rose stamp', src: A + 'stamp-rose.svg', w: 102, h: 121, cat: 'stamps', tintable: false },
    { id: 'stamp-fern', label: 'Fern stamp', src: A + 'stamp-fern.svg', w: 102, h: 121, cat: 'stamps', tintable: false },
    { id: 'stamp-butterfly', label: 'Field stamp', src: A + 'stamp-butterfly.svg', w: 102, h: 121, cat: 'stamps', tintable: false },
    { id: 'stamp-moon', label: 'Night stamp', src: A + 'stamp-moon.svg', w: 102, h: 121, cat: 'stamps', tintable: false },
    { id: 'stamp-air', label: 'Air mail', src: A + 'stamp-air.svg', w: 102, h: 121, cat: 'stamps', tintable: false }
  ];

  /* ---------- parametric charms (recolorable line art) ---------- */
  let _seq = 0;
  function charmSVG(kind, ink) {
    ink = ink || '#3e382f';
    const id = 'ppc' + (++_seq);
    const S = 'fill="none" stroke="' + ink + '" stroke-linecap="round" stroke-linejoin="round"';
    switch (kind) {
      case 'star':
        return '<svg viewBox="0 0 40 40"><path d="M20,2 C22.2,13 27,17.8 38,20 C27,22.2 22.2,27 20,38 C17.8,27 13,22.2 2,20 C13,17.8 17.8,13 20,2 Z" ' + S + ' stroke-width="1.7"/></svg>';
      case 'moon':
        return '<svg viewBox="0 0 46 46"><path d="M28,5 A17.5,17.5 0 1 0 28,44 A22,22 0 1 1 28,5 Z" ' + S + ' stroke-width="1.7"/><path d="M36,15 C37.2,20 40,22 45,23 C40,24 37.2,26 36,31 C34.8,26 32,24 27,23 C32,22 34.8,20 36,15 Z" fill="' + ink + '"/></svg>';
      case 'sun':
        return '<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="9.5" ' + S + ' stroke-width="1.7"/><g ' + S + ' stroke-width="1.6">' +
          '<path d="M23,3.5v6M23,36.5v6M3.5,23h6M36.5,23h6M9.2,9.2l4.2,4.2M32.6,32.6l4.2,4.2M9.2,36.8l4.2-4.2M32.6,13.4l4.2-4.2"/></g></svg>';
      case 'heart':
        return '<svg viewBox="0 0 44 40"><path d="M22,35 C7,25 3,16 8.5,9.5 C13,4.5 19.5,6.5 22,11.5 C24.5,6.5 31,4.5 35.5,9.5 C41,16 37,25 22,35 Z" ' + S + ' stroke-width="1.7"/></svg>';
      case 'arrow':
        return '<svg viewBox="0 0 52 40"><path d="M4,34 C14,14 30,8 48,11" ' + S + ' stroke-width="1.8"/><path d="M48,11 L39.5,7 M48,11 L43.5,18.5" ' + S + ' stroke-width="1.8"/><path d="M4,34 L8,27.5 M4,34 L11.5,33.5" ' + S + ' stroke-width="1.6"/></svg>';
      case 'amp':
        return '<svg viewBox="0 0 44 48"><text x="22" y="37" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-weight="600" font-size="42" fill="' + ink + '">&amp;</text></svg>';
      case 'flourish':
        return '<svg viewBox="0 0 140 26"><path d="M4,15 C28,3 46,27 70,15 C88,6 102,20 118,12" ' + S + ' stroke-width="1.5"/><path d="M70,15 l0,0" ' + S + '/><path d="M64,15 L70,9 L76,15 L70,21 Z" fill="' + ink + '"/></svg>';
      case 'corners':
        return '<svg viewBox="0 0 130 130"><g ' + S + ' stroke-width="1.8">' +
          '<path d="M6,32 C6,16 16,6 32,6"/><path d="M98,6 C114,6 124,16 124,32"/><path d="M124,98 C124,114 114,124 98,124"/><path d="M32,124 C16,124 6,114 6,98"/></g>' +
          '<g fill="' + ink + '"><circle cx="6" cy="42" r="2.2"/><circle cx="42" cy="6" r="2.2"/><circle cx="124" cy="42" r="2.2"/><circle cx="88" cy="6" r="2.2"/><circle cx="124" cy="88" r="2.2"/><circle cx="88" cy="124" r="2.2"/><circle cx="6" cy="88" r="2.2"/><circle cx="42" cy="124" r="2.2"/></g></svg>';
      case 'paperclip':
        return '<svg viewBox="0 0 40 96"><path d="M28,10 V78 a10,10 0 0 1 -20,0 V22 a6,6 0 0 1 12,0 V72 a2.6,2.6 0 0 1 -5.2,0 V28" fill="none" stroke="#8a8577" stroke-width="2.6" stroke-linecap="round"/></svg>';
      case 'key':
        return '<svg viewBox="0 0 44 92"><circle cx="22" cy="16" r="11" ' + S + ' stroke-width="2"/><circle cx="22" cy="16" r="4.5" ' + S + ' stroke-width="1.6"/><path d="M22,27 V82" ' + S + ' stroke-width="2.2"/><path d="M22,82 h11 v-7 h-7 M22,68 h8 v-6 h-8" ' + S + ' stroke-width="2"/></svg>';
    }
    return '';
  }
  const Charms = [
    { id: 'star', label: 'Star', kind: 'star', w: 42, h: 42 },
    { id: 'moon', label: 'Crescent', kind: 'moon', w: 46, h: 46 },
    { id: 'sun', label: 'Sun', kind: 'sun', w: 46, h: 46 },
    { id: 'heart', label: 'Heart', kind: 'heart', w: 44, h: 40 },
    { id: 'arrow', label: 'Arrow', kind: 'arrow', w: 52, h: 40 },
    { id: 'amp', label: 'Ampersand', kind: 'amp', w: 44, h: 48 },
    { id: 'flourish', label: 'Flourish', kind: 'flourish', w: 140, h: 26 },
    { id: 'corners', label: 'Corner set', kind: 'corners', w: 130, h: 130 },
    { id: 'paperclip', label: 'Paper clip', kind: 'paperclip', w: 40, h: 96, fixedInk: true },
    { id: 'key', label: 'Keepsake key', kind: 'key', w: 44, h: 92 }
  ];

  /* ---------- date marks ---------- */
  function postmarkSVG(o) {
    const ink = o.ink || '#5a5248';
    const id = 'ppm' + (++_seq);
    const place = (o.place || 'KEEPSAKE POST').toUpperCase().slice(0, 26);
    const d = o.dateText || U.fmtStampDate();
    const parts = d.split(' ');
    const line1 = (parts[0] + ' ' + (parts[1] || '')).trim();
    const line2 = parts[2] || '';
    return '<svg viewBox="0 0 168 118">' +
      '<defs><path id="' + id + '" d="M 60,60 m -31,0 a 31,31 0 1,1 62,0 a 31,31 0 1,1 -62,0"/></defs>' +
      '<g opacity="0.82" fill="none" stroke="' + ink + '">' +
      '<circle cx="60" cy="60" r="42" stroke-width="2.2"/>' +
      '<circle cx="60" cy="60" r="25" stroke-width="1.3"/>' +
      '</g>' +
      '<text opacity="0.82" fill="' + ink + '" font-family="Cormorant Garamond, Georgia, serif" font-size="9.5" letter-spacing="1.6">' +
      '<textPath href="#' + id + '" startOffset="25%" text-anchor="middle">' + place + '</textPath></text>' +
      '<text opacity="0.85" fill="' + ink + '" font-family="Cormorant Garamond, Georgia, serif" font-size="15" font-weight="600" text-anchor="middle">' +
      '<tspan x="60" y="56">' + line1 + '</tspan><tspan x="60" y="72">' + line2 + '</tspan></text>' +
      '<g opacity="0.82" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M106,42 c9,7 18,-7 27,0 c9,7 18,-7 27,0 c2,1.6 4,2.4 6,2.6"/>' +
      '<path d="M104,56 c9,7 18,-7 27,0 c9,7 18,-7 27,0 c5,3.8 10,4.6 14,2.8"/>' +
      '<path d="M106,70 c9,7 18,-7 27,0 c9,7 18,-7 27,0 c2,1.6 4,2.4 6,2.6"/>' +
      '</g></svg>';
  }

  function receivedSVG(o) {
    const ink = o.ink || '#7d4a4a';
    const d = o.dateText || U.fmtStampDate();
    const place = (o.place || 'KEEPSAKE DESK').toUpperCase().slice(0, 30);
    return '<svg viewBox="0 0 158 74">' +
      '<g transform="rotate(-1.5 79 37)">' +
      '<rect x="5" y="5" width="148" height="64" rx="4" fill="none" stroke="' + ink + '" stroke-width="2.4" opacity="0.85"/>' +
      '<rect x="10" y="10" width="138" height="54" rx="2" fill="none" stroke="' + ink + '" stroke-width="1" opacity="0.85"/>' +
      '<text x="79" y="27" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="15" font-weight="700" letter-spacing="4" fill="' + ink + '" opacity="0.88">RECEIVED</text>' +
      '<text x="79" y="45" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="13" letter-spacing="2" fill="' + ink + '" opacity="0.88">' + d + '</text>' +
      '<text x="79" y="59" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="8.5" letter-spacing="2.5" fill="' + ink + '" opacity="0.88">' + place + '</text>' +
      '</g></svg>';
  }

  /* ---------- tape ---------- */
  function tapeSVG(o) {
    const w = Math.max(60, o.w || 120);
    const h = o.h || 26;
    const color = o.color || '#cdb289';
    const pattern = o.pattern || 'plain';
    const id = 'ppt' + (++_seq);
    const teeth = 5;
    const step = h / teeth;
    let left = 'M7,0';
    for (let i = 0; i < teeth; i++) {
      const y1 = step * (i + 0.5), y2 = step * (i + 1);
      left += ' L' + (i % 2 ? 2 : 0.5) + ',' + y1.toFixed(1) + ' L7,' + y2.toFixed(1);
    }
    /* right edge: from (w-7,h) upward, mirroring the left teeth */
    let rightPts = '';
    for (let i = teeth - 1; i >= 0; i--) {
      const y1 = step * (i + 0.5), y2 = step * i;
      rightPts += ' L' + (w - (i % 2 ? 2 : 0.5)) + ',' + y1.toFixed(1) + ' L' + (w - 7) + ',' + y2.toFixed(1);
    }
    const d = 'M7,0 L' + (w - 7) + ',0' + ' L' + (w - 7) + ',' + h + rightPts + ' Z';
    let deco = '';
    if (pattern === 'stripes') {
      for (let x = 16; x < w - 10; x += 12) deco += '<line x1="' + x + '" y1="3" x2="' + (x + 7) + '" y2="' + (h - 3) + '" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>';
    } else if (pattern === 'grid') {
      for (let x = 14; x < w - 8; x += 11) deco += '<line x1="' + x + '" y1="2" x2="' + x + '" y2="' + (h - 2) + '" stroke="rgba(74,66,51,0.14)" stroke-width="1"/>';
      deco += '<line x1="8" y1="' + (h / 2) + '" x2="' + (w - 8) + '" y2="' + (h / 2) + '" stroke="rgba(74,66,51,0.14)" stroke-width="1"/>';
    } else if (pattern === 'dots') {
      for (let x = 16; x < w - 10; x += 12) deco += '<circle cx="' + x + '" cy="' + (h / 2) + '" r="1.8" fill="rgba(255,255,255,0.55)"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><clipPath id="' + id + '"><path d="' + d + '"/></clipPath></defs>' +
      '<path d="' + d + '" fill="' + color + '" opacity="0.88"/>' +
      '<g clip-path="url(#' + id + ')">' + deco +
      '<line x1="8" y1="2.5" x2="' + (w - 8) + '" y2="2.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>' +
      '<line x1="8" y1="' + (h - 2.5) + '" x2="' + (w - 8) + '" y2="' + (h - 2.5) + '" stroke="rgba(74,66,51,0.12)" stroke-width="1.5"/>' +
      '</g></svg>';
  }

  /* ---------- photo corner mount (for polaroid corners frame) ---------- */
  function cornerSVG() {
    return '<svg viewBox="0 0 34 34"><path d="M2,34 L2,10 C2,5 5,2 10,2 L34,2 Z" fill="#cdb289" stroke="#a1855c" stroke-width="1.2"/><path d="M2,34 L2,10 C2,5 5,2 10,2" fill="none" stroke="#e5d5ae" stroke-width="1" opacity="0.7"/></svg>';
  }

  PP.Assets = {
    INKS, NOTE_COLORS, HIGHLIGHTS, TAPES, FRAMES, FILTERS, FONTS,
    Stickers, Charms,
    charmSVG, postmarkSVG, receivedSVG, tapeSVG, cornerSVG,
    byId: function (id) {
      return Stickers.find(function (s) { return s.id === id; }) ||
        Charms.find(function (c) { return c.id === id; }) || null;
    }
  };
})();
