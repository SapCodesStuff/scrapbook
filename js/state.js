/* Pressed Pages — state: journal model, leaves, undo */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const U = PP.Util;

  const MAX_CANVAS_LEAVES = 12;
  const START_CANVAS_LEAVES = 4;

  function newPage(kind, index, content) {
    return { id: U.uuid(), kind: kind || 'canvas', index: index, content: content || [], rev: 0 };
  }

  /* Creates a fresh journal: cover + endpapers + N canvas leaves + back cover */
  function createJournal(title) {
    const pages = [];
    const endLeft = newPage('endpaper', 1, [
      { id: U.uid(), type: 'text', x: 96, y: 128, w: 368, rot: 0, font: 'serif', size: 23, color: '#3e382f', html: 'This journal belongs to' },
      { id: U.uid(), type: 'text', x: 150, y: 214, w: 260, rot: -1.5, font: 'caveat', size: 34, color: '#7a5c3e', html: 'write your names here' },
      { id: U.uid(), type: 'text', x: 96, y: 330, w: 368, rot: 0, font: 'serif', size: 16, color: '#6b6353', html: 'pressed between these pages, kept for all of us' },
      { id: U.uid(), type: 'art', art: 'olive-branch', x: 196, y: 460, w: 168, h: 70, rot: 0, z: 0 }
    ]);
    const endRight = newPage('endpaper', 2, [
      { id: U.uid(), type: 'text', x: 120, y: 300, w: 320, rot: 0, font: 'serif', size: 19, color: '#3e382f', html: 'little things, kept well' },
      { id: U.uid(), type: 'art', art: 'wax-seal', x: 234, y: 380, w: 92, h: 92, rot: 3 }
    ]);
    pages.push(endLeft, endRight);
    for (let i = 0; i < START_CANVAS_LEAVES; i++) {
      pages.push(newPage('canvas', 10 + i * 2), newPage('canvas', 10 + i * 2 + 1));
    }
    return {
      id: U.uuid(),
      title: title || 'Pressed Pages',
      createdAt: new Date().toISOString(),
      pages: pages
    };
  }

  /* Leaf structure: array of {front, back} page ids; covers are null pages.
     leaf 0: front = cover, back = endpaper-left
     ...canvas leaves...
     last leaf: front = endpaper-right, back = back cover */
  function leafMap(journal) {
    const pages = journal.pages.filter(function (p) { return p.kind !== 'deleted'; });
    const endL = pages.find(function (p) { return p.kind === 'endpaper' && p.index === 1; }) || pages[0];
    const endR = pages.find(function (p) { return p.kind === 'endpaper' && p.index === 2; }) || pages[1];
    const canvas = pages.filter(function (p) { return p.kind === 'canvas'; })
      .sort(function (a, b) { return a.index - b.index; });
    const leaves = [{ front: null, back: endL ? endL.id : null }];
    for (let i = 0; i < canvas.length; i += 2) {
      leaves.push({ front: canvas[i] ? canvas[i].id : null, back: canvas[i + 1] ? canvas[i + 1].id : null });
    }
    leaves.push({ front: endR ? endR.id : null, back: null });
    return leaves;
  }

  function pageById(journal, id) {
    return journal.pages.find(function (p) { return p.id === id; }) || null;
  }

  function addLeaf(journal) {
    const canvas = journal.pages.filter(function (p) { return p.kind === 'canvas'; });
    if (canvas.length >= MAX_CANVAS_LEAVES * 2) return null;
    let maxIdx = 0;
    journal.pages.forEach(function (p) { if (p.index > maxIdx) maxIdx = p.index; });
    const a = newPage('canvas', maxIdx + 1);
    const b = newPage('canvas', maxIdx + 2);
    journal.pages.push(a, b);
    return [a, b];
  }

  /* ---------- runtime state ---------- */
  const S = {
    journal: null,
    flip: 0,               /* number of flipped leaves (0 = closed on front cover) */
    seq: 0,                /* face sequence index, single-page mode */
    selected: null,        /* { pageId, itemId } */
    editing: null,         /* item currently in text edit mode */
    single: false,         /* single-page (narrow) view */
    me: { name: 'You', color: '#7d8a68' },
    undo: [],
    redo: [],
    viewScale: 1,
    flipping: false
  };

  function snapshot(pageId) {
    const p = pageById(S.journal, pageId);
    return { pageId: pageId, content: U.deep(p ? p.content : []) };
  }
  function pushUndo(pageId) {
    S.undo.push(snapshot(pageId));
    if (S.undo.length > 50) S.undo.shift();
    S.redo.length = 0;
  }
  function applySnapshot(snap) {
    const p = pageById(S.journal, snap.pageId);
    if (!p) return;
    p.content = snap.content;
    p.rev++;
    PP.Book.rerenderPage(snap.pageId);
    PP.Sync.pageChanged(snap.pageId, 'undo');
  }
  function undo() {
    if (S.editing) return;
    const snap = S.undo.pop();
    if (!snap) return;
    S.redo.push(snapshot(snap.pageId));
    applySnapshot(snap);
  }
  function redo() {
    if (S.editing) return;
    const snap = S.redo.pop();
    if (!snap) return;
    S.undo.push(snapshot(snap.pageId));
    applySnapshot(snap);
  }

  /* ---------- item helpers ---------- */
  function contentOf(pageId) {
    const p = pageById(S.journal, pageId);
    return p ? p.content : null;
  }
  function findItem(pageId, itemId) {
    const c = contentOf(pageId);
    return c ? c.find(function (it) { return it.id === itemId; }) : null;
  }
  function topZ(content) {
    return content ? content.length : 0;
  }

  PP.State = {
    S, createJournal, leafMap, pageById, addLeaf,
    snapshot, pushUndo, undo, redo,
    contentOf, findItem, topZ,
    MAX_CANVAS_LEAVES
  };
})();
