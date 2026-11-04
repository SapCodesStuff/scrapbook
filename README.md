# Pressed Pages

A vintage scrapbook diary for a group. A cloth-bound journal whose pages flip
like a real book, that signed-in writers can dress up together in real time:
pressed botanicals, pastel sticky notes, postage stamps and postmarks, torn tape,
and polaroid frames with photos straight from your device.

Built with plain HTML, CSS and JavaScript — no framework, no build step.

## What is inside

- A flipping book — hard covers, endpapers, a spread at a time (one page at a
  time on narrow screens), keyboard arrows, corner click zones, up to 24 pages.
- Pages as canvases — drag stationery from the sidebar onto any page, then
  move, rotate, resize, re-layer, duplicate or remove it. Undo and redo
  included (Ctrl+Z / Ctrl+Shift+Z).
- Writing — handwritten, fine script, typewriter and serif lettering, with
  pastel text highlights (butter, blush, mint, periwinkle, peach, lilac) and
  five inks.
- Sticky notes in six pastels; each note is editable in place.
- Polaroids — classic white, aged cream, kraft paper or corner mounts; upload
  from your device and tone the photo (sepia, faded, monochrome).
- Stamps and postmarks — five engraved postage stamps plus a circular date
  postmark and a "RECEIVED" rubber stamp whose date and place you can edit.
- Tapes — kraft, cream, sage, blush, slate and frost, in plain, striped,
  gridded and dotted weaves, torn at both ends.
- Keepsakes — wax seal, memento ticket, kraft tag, ribbon band, paper clip,
  keepsake key and more.
- Shared between writers — live page updates and presence ("who is on
  which page") over realtime broadcasts, with quiet, debounced saving.

No emoji anywhere — every mark, icon and ornament is vector line art drawn for
this project (see `assets/art/`, released as CC0).

## Quick start

The app requires a configured Supabase project and a signed-in account. Before
using it, complete the setup below. Serve the folder locally or host it on a
static web server:

   ```bash
   cd pressed-pages
   python3 -m http.server 8080
   # open http://localhost:8080
   ```

## Supabase setup

The app uses one global multiplayer journal. Any account that signs up and
signs in opens that same journal automatically; there are no journal IDs,
sharing codes, invitations, or user-editable Supabase settings.

1. Create a project at [supabase.com](https://supabase.com).
2. Enable Email under **Authentication -> Providers**.
3. In its **SQL Editor**, run `supabase-setup.sql`, then disable **Allow
   public access** under **Realtime -> Settings**.
4. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/sync.js`. The app does
   not expose these settings to users.
5. Add your deployed app URL under **Authentication -> URL Configuration**.
6. Create an account and confirm its email if confirmation is enabled. Sign in
   to enter the shared journal. Other registered users sign in to the same
   journal automatically.

While you write, you each see the other's changes arrive live, and the
presence chips at the top show who is reading which page.

The SQL setup restricts journal, page, photo, and realtime access to
authenticated members. On the first sign-in after the SQL is applied, the
database adopts the oldest existing journal (by creation time, then ID) if
there is one; otherwise it creates and seeds the shared journal. Each account
is added to the shared journal automatically. Additional old journals remain
in the database but are not selectable in the app. Existing photo URLs are
converted to authenticated signed URLs when the journal is opened.

The Supabase anon key is a public client key; authorization comes from the
signed-in user and database policies. The URL and anon key are configured only
in `js/sync.js`, never in the app UI.

## Using the journal

| To do this | Do that |
| --- | --- |
| Turn pages | Click the page edges, the top arrows, or press the left and right arrow keys |
| Place an item | Drag it from the sidebar onto a page (or tap it to drop it mid-page) |
| Write | Double-click any text or sticky note |
| Highlight | While writing, select a phrase, then pick a pastel from the pen toolbar |
| Rotate | Grab the round handle above a selected item |
| Resize | Grab the square handle at the bottom-right corner |
| Restack | "Bring to front" / "Send to back" in the item toolbar |
| Photo | Select a polaroid and press "Photo", or double-click its window |
| Date stamp | Select a postmark, press the calendar button, edit date and place |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac) |
| Remove | Select, then the small x (or press Delete) |

## Performance notes (why it stays light)

- **Small, bounded load.** Opening the journal uses one RPC plus two reads,
  including a single ordered query for all pages — no per-page requests, no N+1.
- **Debounced writes.** Edits are saved only after you stop for about two
  seconds, one row per changed page. Scribbling for an hour can cost a handful
  of small upserts.
- **Broadcasts, not polls.** Live sync and presence ride on realtime
  websocket messages, which never touch the database. There is no polling
  loop anywhere.
- **Slim rows.** A page is one small JSON document (a few kilobytes) — photos
  are compressed in the browser (max 1400px, JPEG) and stored in Supabase
  Storage, so only their URLs travel with the page.

## Project layout

```
pressed-pages/
  index.html            the whole app, one page
  css/main.css          the vintage paper design system
  js/
    utils.js            icons, dom helpers, sanitizer, image compression
    assets.js           palettes + parametric svg (charms, postmarks, tapes)
    state.js            journal model, leaves, undo stack
    sync.js             local mode + supabase mode, realtime, presence
    book.js             the 3d flip engine (spread and single-page modes)
    items.js            canvas items: drag, rotate, resize, edit, photos
    edit-tools.js       the floating toolbars and highlight logic
    sidebar.js          the stationery palette and drag ghost
    app.js              boot, authentication, settings, keyboard
    vendor/supabase.js  supabase-js v2, self-hosted (no CDN needed)
  assets/art/           24 hand-drawn svg pieces (CC0)
  fonts/                self-hosted Cormorant Garamond, Caveat, Kalam,
                        Special Elite
  supabase-setup.sql    the one-time database script
```

## Browser support

Any current Chrome, Edge, Firefox or Safari. Fonts, art and the Supabase client
are served locally, but signing in and accessing the journal require an
internet connection.

## Licences

- Application code and vector art: released as CC0 — use them freely.
- Fonts: SIL Open Font License (Google Fonts, self-hosted here).
- supabase-js: MIT (bundled locally, unmodified).
