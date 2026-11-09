(() => {
  const figs = [...document.querySelectorAll('.ph')];
  const dlg = document.getElementById('viewer');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const img = document.getElementById('v-img');
  const cap = document.getElementById('v-cap');
  let cur = 0;

  function show(n) {
    cur = (n + figs.length) % figs.length;
    const want = cur, f = figs[cur], small = f.querySelector('img');
    img.src = small.currentSrc || small.src;          // already loaded: shows at once, matches the caption
    img.alt = small.alt;
    cap.innerHTML = '<span class="sr">' + small.alt.replace(/</g, '&lt;') + '</span>' + f.querySelector('figcaption').innerHTML;
    document.getElementById('v-count').textContent = (cur + 1) + ' of ' + figs.length;
    const big = new Image();
    big.onload = () => { if (cur === want) img.src = big.src; };
    big.src = small.dataset.large;
    new Image().src = figs[(cur + 1) % figs.length].querySelector('img').dataset.large;
  }
  figs.forEach((f, i) => {
    const b = f.querySelector('.open');
    b.addEventListener('click', () => { show(i); dlg.showModal(); document.documentElement.style.overflow = 'hidden'; });
  });
  document.getElementById('v-prev').addEventListener('click', () => show(cur - 1));
  document.getElementById('v-next').addEventListener('click', () => show(cur + 1));
  document.getElementById('v-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    const b = figs[cur].querySelector('.open');
    b.focus({ preventScroll: true });
    b.scrollIntoView({ block: 'center' });
  });
  dlg.addEventListener('click', e => { if (e.target.classList.contains('v-stage')) dlg.close(); });
  document.addEventListener('keydown', e => {
    if (!dlg.open) return;
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  let t0 = null;
  dlg.addEventListener('touchstart', e => {
    t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  dlg.addEventListener('touchend', e => {
    if (!t0 || e.touches.length) { t0 = null; return; }
    const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y; t0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(cur + (dx < 0 ? 1 : -1));
  });
})();
