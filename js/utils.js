/* Pressed Pages — utils: icons, dom helpers, sanitize, images */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});

  /* ---------- tiny dom helpers ---------- */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function uid() {
    return 'pp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function deep(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function debounce(fn, ms) {
    let t = null;
    const d = function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
    d.flush = function () { clearTimeout(t); fn(); };
    d.cancel = function () { clearTimeout(t); };
    return d;
  }
  function throttle(fn, ms) {
    let last = 0, t = null;
    return function () {
      const now = Date.now(), args = arguments, self = this;
      if (now - last >= ms) { last = now; fn.apply(self, args); }
      else if (!t) { t = setTimeout(function () { t = null; last = Date.now(); fn.apply(self, args); }, ms - (now - last)); }
    };
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- icons (inline svg, stroke-based, no emoji) ---------- */
  const I = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2.8 12h3M18.2 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    front: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="3" width="11" height="11" rx="1.5"/><path d="M9 20h11a2 2 0 0 0 2-2V7" opacity="0"/></svg>',
    tofront: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13.5l9 5 9-5" opacity="0.55"/></svg>',
    toback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 14.5l9 5 9-5"/><path d="M3 9.5l9 5 9-5"/><path d="M12 3.5l9 5-9 5-9-5 9-5z" opacity="0.55"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="14" rx="2.5"/><path d="M8 6.5L9.5 3.5h5L16 6.5"/><circle cx="12" cy="13" r="4"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/></svg>',
    type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5V4.5h14v2M12 4.5V19.5M9 19.5h6"/></svg>',
    nohl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M4 4l16 16"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 2.8V6M16 2.8V6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.5"/><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6.4M17.5 15.4c1.9.7 3 2.3 3 4.6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.2 1.2"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6l1.2-1.2"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    stamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 10.5h5l1.5 5h-8z"/><path d="M10 10.5c0-2 .5-3.5-1-5.5 3-1.5 6 .5 5 5.5"/><path d="M5 20h14v-3.5H5z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20C6 15 3 11.5 3 8.5 3 6 5 4.5 7.2 4.5c1.7 0 3.6 1 4.8 3.3 1.2-2.3 3.1-3.3 4.8-3.3C19 4.5 21 6 21 8.5c0 3-3 6.5-9 11.5z"/></svg>'
  };
  function icon(name) { return I[name] || ''; }

  /* ---------- rich text sanitizer ---------- */
  const ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1 };
  function sanitizeRich(html) {
    const box = el('div');
    box.innerHTML = String(html == null ? '' : html);
    (function walk(node) {
      const kids = Array.from(node.childNodes);
      kids.forEach(function (k) {
        if (k.nodeType === 3) return;
        if (k.nodeType !== 1) { k.remove(); return; }
        walk(k);
        const tag = k.tagName;
        if (tag === 'DIV' || tag === 'P') {
          const frag = document.createDocumentFragment();
          while (k.firstChild) frag.appendChild(k.firstChild);
          node.replaceChild(frag, k);
          const br = el('br');
          node.insertBefore(br, frag.nextSibling || null);
          return;
        }
        if (!ALLOWED[tag]) {
          const frag = document.createDocumentFragment();
          while (k.firstChild) frag.appendChild(k.firstChild);
          node.replaceChild(frag, k);
          return;
        }
        if (tag === 'SPAN') {
          const bg = k.style && k.style.backgroundColor ? k.style.backgroundColor : '';
          const col = k.style && k.style.color ? k.style.color : '';
          const cls = k.className === 'hl' ? 'hl' : '';
          const span = el('span');
          if (cls) span.className = cls;
          if (bg) span.style.backgroundColor = bg;
          if (col) span.style.color = col;
          while (k.firstChild) span.appendChild(k.firstChild);
          node.replaceChild(span, k);
        } else {
          while (k.attributes.length) k.removeAttribute(k.attributes[0].name);
        }
      });
    })(box);
    return box.innerHTML;
  }

  /* ---------- image compression ---------- */
  function compressImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        try {
          const w0 = img.naturalWidth, h0 = img.naturalHeight;
          const s = Math.min(1, maxDim / Math.max(w0, h0));
          const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#faf6ec';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          cv.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error('encode failed'));
          }, 'image/jpeg', quality || 0.82);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /* ---------- dates ---------- */
  const MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function fmtStampDate(d) {
    d = d || new Date();
    return d.getDate() + ' ' + MONS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtLongDate(d) {
    d = d || new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mons = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return days[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function parseStampDate(str) {
    // "12 NOV 2026" or ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const p = str.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    const m = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/.exec(str || '');
    if (m) {
      const mi = MONS.indexOf(m[2].toUpperCase());
      if (mi >= 0) return new Date(+m[3], mi, +m[1]);
    }
    return null;
  }

  PP.Util = {
    el, qs, qsa, clamp, uid, uuid, deep, debounce, throttle, rand,
    icon, sanitizeRich, compressImage, blobToDataURL,
    fmtStampDate, fmtLongDate, parseStampDate, MONS
  };
})();
