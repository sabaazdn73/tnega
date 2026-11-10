// Albums as books: the shelf and the type list open a book of photographs that turns page by page.
// The series list in .archive stays as the page without JavaScript; this script reads its figures.
(() => {
  const book = document.getElementById('book');
  const root = document.documentElement;
  if (!book || !root.classList.contains('js-book')) return;   // flag.js decides, before the page is drawn

  const $ = id => document.getElementById(id);
  const bookEl = $('b-book'), L = $('b-left'), R = $('b-right'), leaf = $('b-leaf'), F = $('b-front'), B = $('b-back');
  const prevBtn = $('b-prev'), nextBtn = $('b-next'), countEl = $('b-count');
  const zoomDlg = $('viewer'), zoomImg = $('v-img'), zoomCap = $('v-cap');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 820px), (max-aspect-ratio: 1/1), (max-height: 560px)');

  // books: one per series, one per type
  const albums = [...document.querySelectorAll('.archive .series')].map(s => ({
    key: s.id, kind: 'album', digital: s.dataset.kind === 'digital',
    title: s.querySelector('h2').textContent,
    meta: s.querySelector('.series-head p').textContent,
    figs: [...s.querySelectorAll('.ph')]
  }));
  const all = albums.filter(a => !a.digital).flatMap(a => a.figs);   // the Digital art album is not photography
  const types = [...document.querySelectorAll('.typelist a[data-type]')].map(a => {
    const t = a.dataset.type;
    const figs = t === 'all' ? all : all.filter(f => (f.dataset.types || '').split(' ').includes(t));
    return { key: 'type-' + t, kind: 'type', title: a.dataset.title, meta: figs.length + ' photographs', figs };
  });
  const books = new Map([...albums, ...types].map(b => [b.key, b]));
  const order = list => b => { const i = list.indexOf(b); return i >= 0 && i < list.length - 1 ? list[i + 1] : null; };
  const nextAlbum = order(albums), nextType = order(types.filter(t => t.key !== 'type-all'));

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  let cur = null, pages = [], pos = 0, single = false, anim = null, faceAnims = [], pending = null, opener = null, pushed = false;

  const pageWidth = () => {
    const w = bookEl.getBoundingClientRect().width;
    return Math.max(320, Math.round(single ? w : w / 2));
  };

  function titlePage(b) {
    const pc = el('div', 'pc title');
    pc.append(el('p', 't-by', 'Saba Azadegan'), el('p', 't-name', b.title), el('p', 't-meta', b.meta));
    return pc;
  }
  function photoPage(f) {
    const src = f.querySelector('img'), cap = f.querySelector('figcaption');
    const pc = el('div', 'pc photo');
    const btn = el('button', 'zoom');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'View larger: ' + src.alt);
    const img = el('img');
    img.alt = src.alt;
    img.decoding = 'sync';   // a new page must be drawn at once, also on the hidden back of a turning leaf
    img.width = +src.getAttribute('width');
    img.height = +src.getAttribute('height');
    img.sizes = pageWidth() + 'px';
    img.srcset = src.getAttribute('srcset');
    img.src = src.getAttribute('src');
    btn.append(img);
    btn.addEventListener('click', e => { e.stopPropagation(); zoom(f); });
    const texts = sel => [...cap.querySelectorAll(sel)].map(x => x.textContent);
    const p = el('p', 'cap');
    const where = [...texts('.place'), ...texts('.when')].join(', ');
    if (where) p.append(el('span', 'first', where));
    p.append(el('span', where ? null : 'first', texts('.gear').join(', ')));
    const links = cap.querySelector('.links');
    if (links) {
      const l = links.cloneNode(true);
      l.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
      p.append(l);
    }
    pc.append(btn, p);
    return pc;
  }
  function endPage(b) {
    const pc = el('div', 'pc end');
    pc.append(el('p', 'e-line', b.kind === 'album' ? 'End of album' : 'End of this selection'));
    const nx = b.kind === 'album' ? nextAlbum(b) : nextType(b);
    if (nx) {
      const go = el('button', 'linkbtn', (b.kind === 'album' ? 'Next album: ' : 'Next: ') + nx.title);
      go.type = 'button';
      go.addEventListener('click', e => {
        e.stopPropagation();
        opener = document.querySelector('a[data-open="' + nx.key + '"]') || opener;
        openBook(nx.key, 'replace');
      });
      pc.append(go);
    }
    const back = el('button', 'linkbtn', 'Back to all albums');
    back.type = 'button';
    back.addEventListener('click', e => { e.stopPropagation(); closeBook(); });
    pc.append(back);
    return pc;
  }
  function node(i) {
    if (i < 0) return el('div', 'pc cover-in');
    if (i >= pages.length) return el('div', 'pc blank');
    return pages[i]();
  }
  function move(from, to, side) {
    to.replaceChildren(...from.childNodes);
    to.dataset.side = side;
  }
  function fill(box, i, side) {
    box.replaceChildren(node(i));
    box.dataset.side = side;
  }

  // page positions: 0 title, 1..N photographs, N+1 end. In two-page mode spread s shows pages 2s-1 and 2s.
  const spread = p => Math.floor((p + 1) / 2);
  const lastSpread = () => spread(pages.length - 1);

  function show() {
    if (single) fill(R, pos, 'r');
    else { const s = spread(pos); fill(L, 2 * s - 1, 'l'); fill(R, 2 * s, 'r'); }
    status();
    preload();
  }
  function status() {
    const N = cur.figs.length;
    const vis = single ? [pos] : [2 * spread(pos) - 1, 2 * spread(pos)];
    const n = vis.filter(i => i >= 1 && i <= N);
    const touch = matchMedia('(hover: none)').matches;
    $('b-hint').textContent = (single ? pos === 0 : spread(pos) === 0)
      ? (touch ? 'Swipe or tap the arrows to turn the pages' : 'Turn the pages with the arrows, your arrow keys or a click on the page') : '';
    countEl.textContent = n.length === 2 ? `${n[0]} and ${n[1]} of ${N}` : n.length ? `${n[0]} of ${N}`
      : vis.includes(0) ? `Title page, ${N} ${cur.digital ? 'works' : 'photographs'}` : 'End';
    const atStart = single ? pos <= 0 : spread(pos) <= 0;
    const atEnd = single ? pos >= pages.length - 1 : spread(pos) >= lastSpread();
    // never disable the button that has focus without moving focus first
    if (atEnd && document.activeElement === nextBtn) (atStart ? $('b-close') : prevBtn).focus();
    if (atStart && document.activeElement === prevBtn) (atEnd ? $('b-close') : nextBtn).focus();
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  }
  function preload() {
    const ahead = single ? [pos + 1, pos + 2] : [2 * spread(pos) + 1, 2 * spread(pos) + 2];
    for (const i of ahead) {
      const f = cur.figs[i - 1];
      if (!f) continue;
      const s = f.querySelector('img'), im = new Image();
      im.sizes = pageWidth() + 'px';
      im.srcset = s.getAttribute('srcset');
      if (im.decode) im.decode().catch(() => {});
    }
  }

  function settle() {
    if (anim) { const a = anim; anim = null; a.cancel(); faceAnims.forEach(x => x.cancel()); faceAnims = []; }
    if (pending) { const p = pending; pending = null; p(); }
  }
  function swing(from, to, cls, done) {
    leaf.className = 'leaf ' + cls;
    leaf.hidden = false;
    pending = () => { leaf.hidden = true; done(); };
    const opts = { duration: single ? 640 : 820, easing: 'cubic-bezier(.45, .05, .25, 1)', fill: 'forwards' };
    anim = leaf.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }], opts);
    const dim = 'brightness(.84)', lit = 'brightness(1)';
    const goingAway = Math.abs(to) > Math.abs(from);
    faceAnims = [
      F.animate(goingAway ? [{ filter: lit }, { filter: dim, offset: .5 }, { filter: dim }] : [{ filter: dim }, { filter: dim, offset: .5 }, { filter: lit }], opts),
      B.animate(goingAway ? [{ filter: dim }, { filter: dim, offset: .5 }, { filter: lit }] : [{ filter: lit }, { filter: dim, offset: .5 }, { filter: dim }], opts)
    ];
    const mine = anim;
    anim.onfinish = () => {
      if (anim !== mine) return;
      anim = null;
      const p = pending; pending = null;
      if (p) p();
      mine.cancel(); faceAnims.forEach(x => x.cancel()); faceAnims = [];
    };
  }

  function turn(dir) {
    settle();
    const op = pos;
    if (single) {
      const np = pos + dir;
      if (np < 0 || np >= pages.length) return;
      pos = np;
      if (reduce.matches) return show();
      if (dir > 0) { move(R, F, 'r'); fill(B, pages.length, 'l'); fill(R, np, 'r'); swing(0, -180, 'fwd', () => {}); }
      else { fill(F, np, 'r'); fill(B, pages.length, 'l'); swing(-180, 0, 'fwd', () => move(F, R, 'r')); }
    } else {
      const s = spread(op), ns = s + dir;
      if (ns < 0 || ns > lastSpread()) return;
      pos = ns === 0 ? 0 : 2 * ns - 1;
      if (reduce.matches) return show();
      if (dir > 0) {
        move(R, F, 'r'); fill(B, 2 * ns - 1, 'l'); fill(R, 2 * ns, 'r');
        swing(0, -180, 'fwd', () => move(B, L, 'l'));
      } else {
        move(L, F, 'l'); fill(B, 2 * ns, 'r'); fill(L, 2 * ns - 1, 'l');
        swing(0, 180, 'bwd', () => move(B, R, 'r'));
      }
    }
    status();
    preload();
  }

  function setMode() {
    single = narrow.matches;
    book.classList.toggle('single', single);
  }

  function openBook(key, how) {
    const b = books.get(key);
    if (!b) return false;
    settle();
    cur = b;
    pos = 0;
    pages = [() => titlePage(b), ...b.figs.map(f => () => photoPage(f)), () => endPage(b)];
    $('b-title').textContent = b.title;
    if (!book.open) { book.showModal(); root.classList.add('book-open'); }
    setMode();
    show();
    nextBtn.focus();
    // opened from a link while the page loads: the browser may take focus back, so set it again once loaded
    const refocus = () => { if (book.open && !book.contains(document.activeElement)) nextBtn.focus(); };
    if (document.readyState === 'complete') setTimeout(refocus, 0);
    else addEventListener('load', () => setTimeout(refocus, 0), { once: true });
    const hash = '#' + key;
    if (how === 'push') { history.pushState({ book: key }, '', hash); pushed = true; }
    else if (how === 'replace') history.replaceState(history.state, '', hash);
    return true;
  }
  function closeBook() { if (book.open) book.close(); }

  book.addEventListener('close', () => {
    settle();
    root.classList.remove('book-open');
    if (location.hash) {
      if (pushed) { pushed = false; history.back(); }
      else history.replaceState(null, '', location.pathname + location.search);
    }
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  });
  $('b-close').addEventListener('click', closeBook);
  prevBtn.addEventListener('click', () => turn(-1));
  nextBtn.addEventListener('click', () => turn(1));

  // a click on the page itself turns it: right side forwards, left side back
  bookEl.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const r = bookEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    turn(x >= (single ? 1 / 3 : .5) ? 1 : -1);
  });
  document.addEventListener('keydown', e => {
    if (!book.open || zoomDlg.open) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
  });
  let t0 = null;
  const stage = $('b-stage');
  stage.addEventListener('touchstart', e => {
    t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!t0 || e.touches.length) { t0 = null; return; }
    const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
    t0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  narrow.addEventListener('change', () => { if (!book.open) return; settle(); setMode(); show(); });
  let rz = 0;
  addEventListener('resize', () => {   // keep image sizes right for the new page width
    clearTimeout(rz);
    rz = setTimeout(() => { if (!book.open) return; const w = pageWidth() + 'px'; bookEl.querySelectorAll('.pc img').forEach(i => { i.sizes = w; }); }, 200);
  });

  // larger view of one photograph
  function zoom(f) {
    const s = f.querySelector('img');
    zoomImg.alt = s.alt;
    zoomImg.src = s.dataset.large;
    const sr = el('span', 'sr', s.alt);
    zoomCap.replaceChildren(sr, ...[...f.querySelector('figcaption').children].map(c => c.cloneNode(true)));
    zoomDlg.setAttribute('aria-label', f.closest('[data-kind="digital"]') ? 'Image' : 'Photograph');
    zoomDlg.showModal();
  }
  $('v-close').addEventListener('click', () => zoomDlg.close());
  zoomDlg.addEventListener('click', e => { if (e.target.classList.contains('v-stage')) zoomDlg.close(); });

  // shelf and type list
  document.querySelectorAll('a[data-open]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    opener = a;
    openBook(a.dataset.open, 'push');
  }));

  // links straight to a book (#saadabad, #type-food), and the back button
  function route() {
    const key = decodeURIComponent(location.hash.slice(1));
    if (books.has(key)) { if (!cur || cur.key !== key || !book.open) openBook(key); }
    else if (book.open) { pushed = false; if (zoomDlg.open) zoomDlg.close(); book.close(); }
  }
  addEventListener('popstate', () => { pushed = !!(history.state && history.state.book); route(); });
  route();
})();
