(() => {
'use strict';
// ---------- constants ----------
const MP_VER = '0.10.14';
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const RAINBOW = ['#ffb547','#ff5c8a','#a98bff','#4de1ff','#5cf2b3'];
// C major pentatonic, low to high
const NOTES = [130.81,146.83,164.81,196.0,220.0,261.63,293.66,329.63,392.0,440.0,523.25,587.33,659.25,783.99,880.0];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_PARTICLES = REDUCED ? 250 : 1600;

// ---------- state ----------
const S = {
  color: '#ffb547', brush: 'neon', snap: true, arrows: true, mirror: false, sound: true, hands: true, guess: true,
  drawMode: 'pinch',      // pinch | index | two | middle
  camLevel: 2,            // 0 off, 1 dim, 2 bright
  shots: [],              // pictures taken this session
  mode: 'idle',           // idle | camera | mouse | sim
  objects: [],            // strokes, shapes and strings
  particles: [],
  liveString: null,
  handStates: new Map(),
  lastHands: [],
  rainbowIx: 0,
  fps: 0,
};

// ---------- canvas ----------
const cv = document.getElementById('stage');
let ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- small helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function whiten(h, t) { const [r, g, b] = hexToRgb(h); return `rgb(${Math.round(lerp(r,255,t))},${Math.round(lerp(g,255,t))},${Math.round(lerp(b,255,t))})`; }
function pickColor() {
  if (S.color !== 'rainbow') return S.color;
  S.rainbowIx = (S.rainbowIx + 1) % RAINBOW.length;
  return RAINBOW[S.rainbowIx];
}
function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += dist(p[i-1], p[i]); return L; }
function resample(p, n, closed) {
  const pts = closed ? p.concat([p[0]]) : p.slice();
  const L = pathLen(pts); if (L === 0 || pts.length < 2) return Array.from({length: n}, () => ({x: pts[0].x, y: pts[0].y}));
  const step = L / (closed ? n : n - 1);
  const out = [{x: pts[0].x, y: pts[0].y}];
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let a = pts[i-1], b = pts[i], d = dist(a, b);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = {x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)};
      out.push(q); a = q; d = dist(a, b); acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push({x: pts[pts.length-1].x, y: pts[pts.length-1].y});
  return out;
}
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q.x; y += q.y; } return {x: x / p.length, y: y / p.length}; }
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i+1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; }
function bbox(p) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of p) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0}; }
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y; const L2 = dx*dx + dy*dy || 1; const t = clamp(((p.x-a.x)*dx + (p.y-a.y)*dy) / L2, 0, 1); return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy)); }
function segCross(p1, p2, p3, p4) {
  const d = (p2.x-p1.x)*(p4.y-p3.y) - (p2.y-p1.y)*(p4.x-p3.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3.x-p1.x)*(p4.y-p3.y) - (p3.y-p1.y)*(p4.x-p3.x)) / d;
  const u = ((p3.x-p1.x)*(p2.y-p1.y) - (p3.y-p1.y)*(p2.x-p1.x)) / d;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? u : null;
}
function douglasPeucker(p, eps) {
  if (p.length < 3) return p.slice();
  let idx = -1, dmax = 0;
  for (let i = 1; i < p.length - 1; i++) { const d = segDist(p[i], p[0], p[p.length-1]); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const a = douglasPeucker(p.slice(0, idx+1), eps), b = douglasPeucker(p.slice(idx), eps); return a.slice(0, -1).concat(b); }
  return [p[0], p[p.length-1]];
}

// ---------- shape recognition ----------
const N_OUT = 96;
function polygonOutline(verts, n) { return resample(verts, n, true); }
function alignOutline(src, out, closed) {
  // same winding and start point as the hand-drawn loop, so the morph does not spin
  if (closed && Math.sign(signedArea(src)) !== Math.sign(signedArea(out))) out = out.slice().reverse();
  if (closed) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < out.length; i++) { const d = dist(out[i], src[0]); if (d < bd) { bd = d; best = i; } }
    out = out.slice(best).concat(out.slice(0, best));
  }
  return out;
}
function recognize(raw) {
  if (raw.length < 8) return null;
  const L = pathLen(raw); if (L < 90) return null;
  const bb = bbox(raw), diag = Math.hypot(bb.w, bb.h);
  const gap = dist(raw[0], raw[raw.length-1]);
  if (gap / L > 0.93) {
    return {kind: 'line', closed: false, outline: resample([raw[0], raw[raw.length-1]], N_OUT, false)};
  }
  if (gap > Math.max(40, 0.25 * diag)) return null;
  const P = resample(raw, N_OUT, true);
  const c = centroid(P);
  const rs = P.map(q => dist(q, c));
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / rs.length);
  if (sd / mean < 0.11) {
    const a0 = Math.atan2(P[0].y - c.y, P[0].x - c.x);
    const circ = Array.from({length: N_OUT}, (_, i) => ({x: c.x + mean * Math.cos(a0 + i / N_OUT * 2 * Math.PI), y: c.y + mean * Math.sin(a0 + i / N_OUT * 2 * Math.PI)}));
    return {kind: 'circle', closed: true, outline: alignOutline(P, circ, true)};
  }
  // closed polygon: split at the point farthest from the start, simplify both halves
  let far = 0, fd = 0; P.forEach((q, i) => { const d = dist(q, P[0]); if (d > fd) { fd = d; far = i; } });
  const eps = 0.075 * diag;
  const h1 = douglasPeucker(P.slice(0, far + 1), eps), h2 = douglasPeucker(P.slice(far).concat([P[0]]), eps);
  let verts = h1.slice(0, -1).concat(h2.slice(0, -1));
  // merge vertices that sit almost on a straight run
  verts = verts.filter((v, i) => { const a = verts[(i - 1 + verts.length) % verts.length], b = verts[(i + 1) % verts.length]; return segDist(v, a, b) > 0.05 * diag; });
  const k = verts.length;
  if (k >= 8 && k <= 12) {
    const r = verts.map(v => dist(v, c));
    const rmax = Math.max(...r), rmin = Math.min(...r);
    if (rmin / rmax < 0.7) {
      const pts = Math.round(k / 2), a0 = Math.atan2(verts[0].y - c.y, verts[0].x - c.x);
      const outer = r.filter(x => x > (rmax + rmin) / 2).reduce((a, b, _, arr) => a + b / arr.length, 0);
      const star = [];
      for (let i = 0; i < pts * 2; i++) { const rr = i % 2 === 0 ? outer : outer * 0.42; const a = a0 + i * Math.PI / pts; star.push({x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a)}); }
      return {kind: 'star', closed: true, outline: alignOutline(P, polygonOutline(star, N_OUT), true)};
    }
  }
  if (k < 3 || k > 7) return null;
  if (k === 4) {
    // nearly axis-aligned four-sided loop becomes a clean rectangle
    let aligned = true;
    for (let i = 0; i < 4; i++) { const a = verts[i], b = verts[(i+1)%4]; const ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x)) % (Math.PI / 2); if (Math.min(ang, Math.PI / 2 - ang) > 0.24) aligned = false; }
    if (aligned) { const v = bbox(verts); verts = [{x: v.x0, y: v.y0}, {x: v.x1, y: v.y0}, {x: v.x1, y: v.y1}, {x: v.x0, y: v.y1}]; }
  }
  const names = {3: 'triangle', 4: 'box', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon'};
  return {kind: names[k], closed: true, outline: alignOutline(P, polygonOutline(verts, N_OUT), true)};
}

// ---------- sound ----------
let AC = null, master = null;
function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor();
      master = AC.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
const ksCache = new Map();
function ksBuffer(freq) {
  const key = Math.round(freq * 10);
  if (ksCache.has(key)) return ksCache.get(key);
  const sr = AC.sampleRate, len = Math.floor(sr * 2.2), N = Math.max(2, Math.round(sr / freq));
  const buf = AC.createBuffer(1, len, sr), y = buf.getChannelData(0);
  for (let i = 0; i < N; i++) y[i] = Math.random() * 2 - 1;
  for (let i = N; i < len; i++) y[i] = 0.4985 * (y[i - N] + y[i - N + 1 < i ? i - N + 1 : i - N]);
  ksCache.set(key, buf); return buf;
}
function pluckSound(freq, vel, pan) {
  if (!S.sound || !AC) return;
  const src = AC.createBufferSource(); src.buffer = ksBuffer(freq);
  const g = AC.createGain(); g.gain.value = clamp(vel, 0.15, 1);
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  src.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  src.start();
}
function chime(freq) {
  if (!S.sound || !AC) return;
  const t = AC.currentTime;
  [1, 2.01, 3.02].forEach((m, i) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = freq * m;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 / (i + 1));
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.3);
  });
}
function noteForLength(L) {
  const maxL = Math.hypot(W, H) * 0.75;
  const i = Math.round((1 - clamp(L / maxL, 0, 1)) * (NOTES.length - 1));
  return NOTES[clamp(i, 0, NOTES.length - 1)];
}

// ---------- particles ----------
function emit(x, y, color, n, speed, life) {
  for (let i = 0; i < n && S.particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
    S.particles.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), age: 0, color, size: 1 + Math.random() * 2.2});
  }
}
function updateParticles(dt) {
  const ps = S.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]; p.age += dt;
    if (p.age >= p.life) { ps.splice(i, 1); continue; }
    p.vx *= 0.96; p.vy = p.vy * 0.96 + 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function drawParticles() {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of S.particles) {
    const a = 1 - p.age / p.life;
    ctx.fillStyle = rgba(p.color, 0.85 * a);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- objects ----------
function mirrorPoint(p) { return {x: W - p.x, y: p.y}; }
function newStroke(color, x, y) {
  const s = {type: 'stroke', color, brush: S.brush, pts: [{x, y, w: 1}], born: performance.now(), shape: null};
  if (S.mirror) { s.twin = {type: 'stroke', color, brush: S.brush, pts: [{x: W - x, y, w: 1}], born: s.born, shape: null, isTwin: true}; S.objects.push(s.twin); }
  S.objects.push(s); return s;
}
function addPoint(s, x, y) {
  const last = s.pts[s.pts.length - 1];
  const d = Math.hypot(x - last.x, y - last.y);
  if (d < 1.6) return;
  const w = s.brush === 'ribbon' ? clamp(1.8 - d / 22, 0.35, 1.8) : 1;
  const sw = lerp(last.w, w, 0.35);
  s.pts.push({x, y, w: sw});
  if (s.twin) s.twin.pts.push({x: W - x, y, w: sw});
  if (s.brush === 'spark' && !REDUCED) { emit(x, y, s.color, 2, 60, 0.9); if (s.twin) emit(W - x, y, s.color, 2, 60, 0.9); }
}
function finishStroke(s) {
  const all = s.twin ? [s, s.twin] : [s];
  if (s.pts.length < 3) { S.objects = S.objects.filter(o => !all.includes(o)); return; }
  if (!S.snap) return;
  for (const o of all) {
    const r = recognize(o.pts);
    if (!r) continue;
    o.shape = r.kind; o.closed = r.closed; o.arrow = r.kind === 'line' && S.arrows;
    o.morph = {from: resample(o.pts, N_OUT, r.closed), to: r.outline, t0: performance.now(), dur: 380};
    const c = centroid(r.outline);
    emit(c.x, c.y, o.color, REDUCED ? 6 : 26, 160, 0.8);
    if (!o.isTwin) { chime(NOTES[{circle: 9, triangle: 10, box: 8, star: 12, line: 6}[r.kind] ?? 11]); toast(o.arrow ? 'Arrow' : `Snapped: ${r.kind}`); }
  }
}
function makeString(a, b, color) {
  const L = dist(a, b);
  if (L < 50) return null;
  const s = {type: 'string', a: {x: a.x, y: a.y}, b: {x: b.x, y: b.y}, color, amp: 0, t0: 0, freq: noteForLength(L), born: performance.now()};
  S.objects.push(s);
  emit(a.x, a.y, color, 10, 90, 0.6); emit(b.x, b.y, color, 10, 90, 0.6);
  return s;
}
function pluck(str, vel, where) {
  str.amp = clamp(vel, 4, 26); str.t0 = performance.now(); str.where = where;
  const mx = lerp(str.a.x, str.b.x, where), my = lerp(str.a.y, str.b.y, where);
  emit(mx, my, str.color, REDUCED ? 4 : 14, 120, 0.7);
  pluckSound(str.freq, vel / 22, (mx / W) * 2 - 1);
}
function checkPluck(p0, p1) {
  if (!p0 || !p1) return;
  const v = dist(p0, p1);
  if (v < 3) return;
  for (const o of S.objects) {
    if (o.type !== 'string') continue;
    const u = segCross(o.a, o.b, p0, p1);
    if (u !== null && performance.now() - o.t0 > 90) pluck(o, v * 0.6, u);
  }
}
function eraseAt(p, r) {
  const keep = [];
  let hit = false;
  for (const o of S.objects) {
    if (o.type === 'string') {
      if (segDist(p, o.a, o.b) < r) { hit = true; emit(p.x, p.y, o.color, 12, 140, 0.6); continue; }
      keep.push(o); continue;
    }
    if (o.morph || o.shape) {
      if (o.pts.some(q => dist(q, p) < r)) { hit = true; for (let i = 0; i < o.pts.length; i += 6) emit(o.pts[i].x, o.pts[i].y, o.color, 1, 80, 0.6); continue; }
      keep.push(o); continue;
    }
    // split freehand strokes around the eraser
    let run = [], pieces = [], cut = false;
    for (const q of o.pts) { if (dist(q, p) < r) { cut = true; if (run.length > 1) pieces.push(run); run = []; } else run.push(q); }
    if (run.length > 1) pieces.push(run);
    if (!cut) { keep.push(o); continue; }
    hit = true; emit(p.x, p.y, o.color, 3, 90, 0.5);
    for (const pc of pieces) keep.push({...o, pts: pc, twin: undefined});
  }
  S.objects = keep;
  return hit;
}
function clearAll(burst) {
  if (burst) for (const o of S.objects) {
    const pts = o.type === 'string' ? [o.a, o.b] : o.pts;
    for (let i = 0; i < pts.length; i += 5) emit(pts[i].x, pts[i].y, o.color, 2, 180, 1.1);
  }
  S.objects = []; S.liveString = null;
  for (const h of S.handStates.values()) h.stroke = null;
}

// ---------- drawing ----------
function tracePath(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l.x, l.y);
}
function strokePoints(o, now) {
  if (!o.morph) return o.pts;
  const t = clamp((now - o.morph.t0) / o.morph.dur, 0, 1);
  const e = 1 - Math.pow(1 - t, 3);
  const pts = o.morph.from.map((q, i) => ({x: lerp(q.x, o.morph.to[i].x, e), y: lerp(q.y, o.morph.to[i].y, e), w: 1}));
  if (t >= 1) { o.pts = o.morph.to.map(q => ({x: q.x, y: q.y, w: 1})); o.morph = null; }
  if (o.closed) pts.push(pts[0]);
  return pts;
}
function drawStroke(o, now) {
  let pts = strokePoints(o, now);
  if (!o.morph && o.closed) pts = pts.concat([pts[0]]);
  if (pts.length < 2) return;
  const base = 3.2;
  const pulse = o.shape ? 0.85 + 0.15 * Math.sin(now / 420 + o.born) : 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  if (o.brush === 'ribbon' && !o.shape) {
    for (let i = 1; i < pts.length; i++) {
      const w = base * 2.6 * pts[i].w;
      ctx.strokeStyle = rgba(o.color, 0.16); ctx.lineWidth = w * 3.2;
      ctx.beginPath(); ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = whiten(o.color, 0.35); ctx.lineWidth = base * 1.6 * pts[i].w;
      ctx.beginPath(); ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
  } else {
    tracePath(pts);
    ctx.strokeStyle = rgba(o.color, 0.10 * pulse); ctx.lineWidth = base * 7; ctx.stroke();
    ctx.strokeStyle = rgba(o.color, 0.28 * pulse); ctx.lineWidth = base * 3; ctx.stroke();
    ctx.strokeStyle = whiten(o.color, o.brush === 'spark' ? 0.75 : 0.55); ctx.lineWidth = o.brush === 'spark' ? base * 0.55 : base * 0.95; ctx.stroke();
    if (o.arrow && pts.length > 2) {
      const e = pts[pts.length - 1], s0 = pts[Math.max(0, pts.length - 4)];
      const ang = Math.atan2(e.y - s0.y, e.x - s0.x), hl = 22;
      ctx.beginPath();
      ctx.moveTo(e.x - hl * Math.cos(ang - 0.45), e.y - hl * Math.sin(ang - 0.45));
      ctx.lineTo(e.x, e.y);
      ctx.lineTo(e.x - hl * Math.cos(ang + 0.45), e.y - hl * Math.sin(ang + 0.45));
      ctx.strokeStyle = rgba(o.color, 0.28 * pulse); ctx.lineWidth = base * 3; ctx.stroke();
      ctx.strokeStyle = whiten(o.color, 0.55); ctx.lineWidth = base * 0.95; ctx.stroke();
    }
    if (o.brush === 'spark' && !REDUCED) {
      for (let i = 0; i < pts.length; i += 4) {
        const tw = 0.5 + 0.5 * Math.sin(now / 160 + i * 1.7);
        ctx.fillStyle = rgba(o.color, 0.55 * tw);
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.2 + 2 * tw, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawString(o, now, live) {
  const dx = o.b.x - o.a.x, dy = o.b.y - o.a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const t = (now - o.t0) / 1000;
  const A = o.amp * Math.exp(-t * 2.2) * Math.sin(t * 2 * Math.PI * 11);
  const seg = 36, pts = [];
  for (let i = 0; i <= seg; i++) {
    const s = i / seg, off = A * Math.sin(Math.PI * s);
    pts.push({x: o.a.x + dx * s + nx * off, y: o.a.y + dy * s + ny * off});
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  tracePath(pts);
  ctx.strokeStyle = rgba(o.color, live ? 0.14 : 0.12); ctx.lineWidth = 16; ctx.stroke();
  ctx.strokeStyle = rgba(o.color, 0.35); ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = whiten(o.color, 0.7); ctx.lineWidth = 1.6; ctx.stroke();
  // tick marks along the string, like a measuring tape of light
  const ticks = Math.floor(L / 22);
  ctx.strokeStyle = rgba(o.color, 0.6); ctx.lineWidth = 1;
  for (let i = 1; i < ticks; i++) {
    const s = i / ticks, off = A * Math.sin(Math.PI * s);
    const x = o.a.x + dx * s + nx * off, y = o.a.y + dy * s + ny * off, len = i % 5 === 0 ? 9 : 5;
    ctx.beginPath(); ctx.moveTo(x - nx * len, y - ny * len); ctx.lineTo(x + nx * len, y + ny * len); ctx.stroke();
  }
  for (const e of [o.a, o.b]) {
    ctx.fillStyle = whiten(o.color, 0.8); ctx.beginPath(); ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(o.color, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (live) {
    ctx.fillStyle = 'rgba(236,239,248,0.85)'; ctx.font = '600 11px "Hanken Grotesk", system-ui, sans-serif';
    const name = noteName(noteForLength(L));
    ctx.fillText(`${Math.round(L)} px · ${name}`, (o.a.x + o.b.x) / 2 + nx * 18, (o.a.y + o.b.y) / 2 + ny * 18);
  }
}
function noteName(f) { const names = ['C','D','E','G','A']; const i = NOTES.indexOf(f); return i < 0 ? '' : names[i % 5] + (3 + Math.floor(i / 5)); }

// ---------- camera background ----------
const video = document.getElementById('cam');
function drawBackground() {
  ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
  if (S.mode !== 'camera' || S.camLevel === 0 || video.readyState < 2) return;
  const vw = video.videoWidth, vh = video.videoHeight, sc = Math.max(W / vw, H / vh);
  const ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
  ctx.save(); ctx.globalAlpha = S.camLevel === 1 ? 0.42 : 0.9;
  ctx.translate(ox + vw * sc, oy); ctx.scale(-sc, sc); ctx.drawImage(video, 0, 0); ctx.restore();
  ctx.globalAlpha = 1;
}
function toScreen(lm) {
  // landmarks are 0..1 in the camera frame; the picture is mirrored and cropped to cover the window
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720, sc = Math.max(W / vw, H / vh);
  const ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
  return {x: ox + (1 - lm.x) * vw * sc, y: oy + lm.y * vh * sc};
}

// ---------- hands ----------
function extended(p, tip, pip) { return dist(p[0], p[tip]) > dist(p[0], p[pip]) * 1.12; }
function processHands(list, now, dt) {
  // list: [{key, pts: [21 screen points]}]
  const seen = new Set();
  for (const h of list) {
    seen.add(h.key);
    let st = S.handStates.get(h.key);
    if (!st) { st = {key: h.key, pts: h.pts.map(q => ({...q})), pinch: false, pinchM: false, down: false, flip: 0, downT: 0, stroke: null, block: false, fistT: 0, tip: null, prevTip: null, palmC: null, prevPalmC: null, dwell: null}; S.handStates.set(h.key, st); }
    for (let i = 0; i < 21; i++) { st.pts[i].x = lerp(st.pts[i].x, h.pts[i].x, 0.6); st.pts[i].y = lerp(st.pts[i].y, h.pts[i].y, 0.6); }
    const p = st.pts, palm = Math.max(20, dist(p[0], p[9]));
    st.palm = palm;
    const ix = extended(p, 8, 6), md = extended(p, 12, 10), rg = extended(p, 16, 14), pk = extended(p, 20, 18);
    const pd = dist(p[4], p[8]) / palm, pdm = dist(p[4], p[12]) / palm, im = dist(p[8], p[12]) / palm;
    // a fist also brings the thumb to the fingers, so a pinch needs the finger reaching out
    const reach = dist(p[0], p[8]) / palm, reachM = dist(p[0], p[12]) / palm;
    if (!st.pinch && pd < 0.33 && reach > 0.95) st.pinch = true; else if (st.pinch && pd > 0.5) st.pinch = false;
    if (!st.pinchM && pdm < 0.33 && reachM > 0.95) st.pinchM = true; else if (st.pinchM && pdm > 0.5) st.pinchM = false;
    // pen down for the fingers chosen in "Draw with"; a change must hold for two frames
    let want, pen;
    if (S.drawMode === 'index') { want = ix && !md && !rg && !pk; pen = p[8]; }
    else if (S.drawMode === 'two') { want = ix && md && !rg && !pk && im < 0.3; pen = {x: (p[8].x + p[12].x) / 2, y: (p[8].y + p[12].y) / 2}; }
    else if (S.drawMode === 'middle') { want = st.pinchM && !st.pinch; pen = {x: (p[4].x + p[12].x) / 2, y: (p[4].y + p[12].y) / 2}; }
    else { want = st.pinch; pen = {x: (p[4].x + p[8].x) / 2, y: (p[4].y + p[8].y) / 2}; }
    if (want === !!st.down) st.flip = 0;
    else if ((st.flip = (st.flip || 0) + 1) >= 2) { st.down = want; st.flip = 0; if (want) st.downT = now; }
    const busy = st.down || st.pinch || st.pinchM;
    st.open = ix && md && rg && pk && !busy && pd > 0.6;
    st.fist = !ix && !md && !rg && !pk && !busy;
    st.peace = ix && md && !rg && !pk && !busy && im > 0.35;
    st.pen = st.pen ? {x: lerp(st.pen.x, pen.x, 0.55), y: lerp(st.pen.y, pen.y, 0.55)} : {x: pen.x, y: pen.y};
    st.prevTip = st.tip; st.tip = {x: p[8].x, y: p[8].y};
    st.prevPalmC = st.palmC;
    st.palmC = centroid([p[0], p[5], p[9], p[13], p[17]]);
    st.seen = now;
  }
  for (const [k, st] of S.handStates) if (!seen.has(k) && now - st.seen > 250) { if (st.stroke) finishStroke(st.stroke); S.handStates.delete(k); }
  const hands = [...S.handStates.values()].filter(h => seen.has(h.key));
  S.lastHands = hands;

  const drawing = hands.filter(h => h.down && !inDock(h.pen));
  if (drawing.length >= 2) {
    const [h1, h2] = drawing;
    if (!S.liveString) {
      for (const h of [h1, h2]) { if (h.stroke) { finishStroke(h.stroke); h.stroke = null; } }
      S.liveString = {type: 'string', a: {...h1.pen}, b: {...h2.pen}, color: pickColor(), amp: 0, t0: 0, freq: 0};
    }
    S.liveString.a = {...h1.pen}; S.liveString.b = {...h2.pen};
  } else {
    if (S.liveString) {
      const s = makeString(S.liveString.a, S.liveString.b, S.liveString.color);
      if (s) { pluck(s, 10, 0.5); toast(`String: ${noteName(s.freq)}`); }
      S.liveString = null;
      for (const h of hands) h.block = true;
    }
    for (const h of hands) {
      if (h.down && !h.block && !inDock(h.pen)) {
        if (!h.stroke) { if (now - h.downT > 90) h.stroke = newStroke(pickColor(), h.pen.x, h.pen.y); }
        else addPoint(h.stroke, h.pen.x, h.pen.y);
      } else {
        if (h.stroke) { finishStroke(h.stroke); h.stroke = null; }
        if (!h.down) h.block = false;
      }
    }
  }
  for (const h of hands) {
    // strum strings with the index fingertip (in thumb + middle mode the index is always free)
    if (!h.down || S.drawMode === 'middle') checkPluck(h.prevTip, h.tip);
    // open hand swipe wipes
    h.wiping = false;
    if (h.open && h.prevPalmC) {
      const speed = dist(h.palmC, h.prevPalmC) / Math.max(dt, 1e-3);
      if (speed > 420) { h.wiping = true; eraseAt(h.palmC, h.palm * 1.25); }
    }
    // hold a fist to clear
    if (h.fist) { if (!h.fistT) h.fistT = now; if (now - h.fistT > 1300) { clearAll(true); toast('Cleared'); h.fistT = now + 5000; } }
    else h.fistT = 0;
    // hold a peace sign to take a picture
    if (h.peace) { if (!h.peaceT) h.peaceT = now; if (now - h.peaceT > 900) { captureShot(); h.peaceT = now + 4000; } }
    else h.peaceT = 0;
    // press dock buttons by holding a fingertip on them
    updateDwell(h, now);
  }
}
function drawHands(now) {
  for (const h of S.lastHands) {
    const p = h.pts;
    if (S.hands) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(92,242,179,0.55)';
      for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke(); }
      for (let i = 0; i < 21; i++) { ctx.fillStyle = i === 4 || i === 8 ? '#ffffff' : 'rgba(255,92,138,0.85)'; ctx.beginPath(); ctx.arc(p[i].x, p[i].y, i % 4 === 0 && i ? 4.2 : 3.2, 0, Math.PI * 2); ctx.fill(); }
    }
    const col = S.color === 'rainbow' ? RAINBOW[(S.rainbowIx + 1) % RAINBOW.length] : S.color;
    if (h.down) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(col, 0.35); ctx.beginPath(); ctx.arc(h.pen.x, h.pen.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = whiten(col, 0.7); ctx.beginPath(); ctx.arc(h.pen.x, h.pen.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (h.tip) {
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.tip.x, h.tip.y, 9, 0, Math.PI * 2); ctx.stroke();
    }
    if (h.open) {
      ctx.strokeStyle = h.wiping ? 'rgba(236,239,248,0.85)' : 'rgba(236,239,248,0.25)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.palmC.x, h.palmC.y, h.palm * 1.25, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (h.fist && h.fistT && now - h.fistT < 1300) {
      const f = (now - h.fistT) / 1300;
      ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(h.palmC.x, h.palmC.y, h.palm * 0.9, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(236,239,248,0.9)'; ctx.font = '600 11px "Hanken Grotesk", system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('hold to clear', h.palmC.x, h.palmC.y + h.palm * 0.9 + 18); ctx.textAlign = 'start';
    }
    if (h.peace && h.peaceT && now - h.peaceT > 0 && now - h.peaceT < 900) {
      const f = (now - h.peaceT) / 900, c = {x: (p[8].x + p[12].x) / 2, y: (p[8].y + p[12].y) / 2 - 26};
      ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, c.y, 18, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    }
    if (h.dwell) {
      const f = clamp((now - h.dwell.t0) / DWELL_MS, 0, 1);
      ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(h.tip.x, h.tip.y, 16, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    }
  }
}

// ---------- which fingers draw ----------
const DRAW_MODES = {
  pinch: {label: 'Pinch', row: ['Pinch and move', 'Draw (thumb on index finger)']},
  index: {label: 'Index finger', row: ['Point and move', 'Draw with your index finger; open the hand to lift the pen']},
  two: {label: 'Two fingers', row: ['Two fingers together', 'Draw with index and middle side by side']},
  middle: {label: 'Thumb + middle', row: ['Thumb on middle finger', 'Draw; your index stays free to strum strings']},
};
const MODE_ORDER = ['pinch', 'index', 'two', 'middle'];
function setDrawMode(m) {
  if (!DRAW_MODES[m]) return;
  S.drawMode = m;
  for (const h of S.handStates.values()) { if (h.stroke) { finishStroke(h.stroke); h.stroke = null; } h.down = false; h.flip = 0; }
  const row = document.getElementById('modeRow');
  if (row) { row.children[0].textContent = DRAW_MODES[m].row[0]; row.children[1].textContent = DRAW_MODES[m].row[1]; }
  const tip = document.getElementById('modeTip'); if (tip) tip.textContent = 'Draw with: ' + DRAW_MODES[m].label;
  document.querySelectorAll('input[name="drawWith"]').forEach(r => { r.checked = r.value === m; });
  try { localStorage.setItem('hava.drawMode', m); } catch (e) {}
}

// ---------- sketch guessing: DoodleNet, trained on Quick, Draw! (345 things) ----------
const TFJS = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const G = {model: null, labels: [], loading: null, failed: false, lastRun: 0, sig: '', top: [], align: 'center', line: 14};
function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(el); }); }
function loadGuesser() {
  if (!G.loading) G.loading = (async () => {
    if (!window.tf) await loadScript(TFJS);
    const [model, txt] = await Promise.all([tf.loadLayersModel('model/model.json'), fetch('model/class_names.txt').then(r => r.text())]);
    G.labels = txt.split('\n').map(x => x.trim()).filter(Boolean);
    tf.tidy(() => model.predict(tf.zeros([1, 28, 28, 1])));
    G.model = model; G.sig = '';
  })().catch(e => { G.failed = true; G.loading = null; throw e; });
  return G.loading;
}
const pretty = w => w.replace(/_/g, ' ');
const article = w => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + pretty(w);
function guessStrokes() { return S.objects.filter(o => o.type === 'stroke' && !o.arrow && !o.isTwin && o.pts.length > 1); }
const g256 = document.createElement('canvas'); g256.width = g256.height = 256;
const g28 = document.createElement('canvas'); g28.width = g28.height = 28;
function sketchPixels(strokes) {
  // like the Quick, Draw! bitmaps: white lines on black, the longer side filling the square, 28 x 28
  const bb = bbox(strokes.flatMap(o => o.pts)), span = Math.max(bb.w, bb.h, 1), k = 230 / span;
  const ox = G.align === 'center' ? 13 + (230 - bb.w * k) / 2 : 13, oy = G.align === 'center' ? 13 + (230 - bb.h * k) / 2 : 13;
  const g = g256.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#fff'; g.lineWidth = G.line; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const o of strokes) {
    g.beginPath();
    o.pts.forEach((q, i) => { const x = ox + (q.x - bb.x0) * k, y = oy + (q.y - bb.y0) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    if (o.closed) g.closePath();
    g.stroke();
  }
  const c = g28.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.fillStyle = '#000'; c.fillRect(0, 0, 28, 28); c.drawImage(g256, 0, 0, 28, 28);
  const d = c.getImageData(0, 0, 28, 28).data, out = new Float32Array(784);
  for (let i = 0; i < 784; i++) out[i] = d[i * 4] / 255;
  return out;
}
function classify(strokes) {
  const px = sketchPixels(strokes);
  const probs = tf.tidy(() => G.model.predict(tf.tensor4d(px, [1, 28, 28, 1])).dataSync());
  return [...probs.keys()].sort((a, b) => probs[b] - probs[a]).slice(0, 3).map(i => ({word: G.labels[i], p: probs[i]}));
}
function runGuess(now) {
  if (!G.model || now - G.lastRun < 300 || !(S.guess || GAME.on)) return;
  const strokes = guessStrokes();
  const sig = strokes.length + ':' + strokes.reduce((a, o) => a + o.pts.length, 0);
  if (sig === G.sig) return;
  G.sig = sig; G.lastRun = now;
  const pts = strokes.reduce((a, o) => a + o.pts.length, 0);
  G.top = pts > 12 ? classify(strokes) : [];
  renderGuess();
  if (GAME.on) onGameGuess(G.top);
}
const guessEl = document.getElementById('guess');
function renderGuess() {
  const show = !GAME.on && S.guess && G.top.length > 0;
  guessEl.hidden = !show;
  if (!show) return;
  const [a, b, c] = G.top;
  guessEl.replaceChildren();
  const lead = document.createElement('span'); lead.textContent = a.p > 0.5 ? 'This looks like ' : a.p > 0.2 ? 'Maybe ' : 'Hmm, ';
  const main = document.createElement('b'); main.textContent = article(a.word);
  const pc = document.createElement('span'); pc.className = 'pc'; pc.textContent = ` ${Math.round(a.p * 100)}%`;
  const rest = document.createElement('span'); rest.className = 'alt'; rest.textContent = `  or ${pretty(b.word)}, ${pretty(c.word)}`;
  guessEl.append(lead, main, pc, rest);
}
let lastSaid = 0;
function say(text, force) {
  if (!S.sound || !('speechSynthesis' in window)) return;
  const now = performance.now();
  if (!force && now - lastSaid < 1600) return;
  lastSaid = now;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {}
}

// ---------- the guessing game ----------
const WORDS = ['cat','house','sun','fish','car','star','cloud','umbrella','apple','flower','airplane','clock','eye','key','mountain','snowman','bicycle','guitar','smiley_face','ice_cream','pizza','spider','butterfly','hat','cup','book','bird','envelope','rainbow','ladder','light_bulb','candle','crown','diamond','donut','lollipop','scissors','snake','television','wheel'];
const GAME = {on: false, round: 0, rounds: 6, word: null, t0: 0, dur: 20000, score: 0, results: [], done: false, timer: 0, lastWord: ''};
const gameEl = document.getElementById('game'), endEl = document.getElementById('gameEnd');
function startGame() {
  ensureAudio();
  if (GAME.on) return;
  GAME.on = true; GAME.round = 0; GAME.score = 0; GAME.results = [];
  GAME.keep = {snap: S.snap, arrows: S.arrows}; S.snap = false; S.arrows = false; syncDock();
  endEl.hidden = true; gameEl.hidden = false;
  document.getElementById('gameGuess').textContent = 'Loading the guesser…';
  loadGuesser().then(() => nextRound()).catch(() => { stopGame(); toast('The guesser could not load. Check the connection.'); });
}
function nextRound() {
  clearTimeout(GAME.timer);
  if (!GAME.on) return;
  clearAll(false); G.sig = ''; G.top = [];
  GAME.round++;
  if (GAME.round > GAME.rounds) { endGame(); return; }
  const pool = WORDS.filter(w => !GAME.results.some(r => r.word === w));
  GAME.word = pool[Math.floor(Math.random() * pool.length)];
  GAME.t0 = performance.now(); GAME.done = false; GAME.lastWord = '';
  document.getElementById('gameRound').textContent = `Round ${GAME.round} of ${GAME.rounds}  ·  AI guessed ${GAME.score}`;
  document.getElementById('gameWord').textContent = article(GAME.word);
  document.getElementById('gameGuess').textContent = 'Start drawing…';
  gameEl.classList.remove('won', 'lost');
  say(`Draw ${article(GAME.word)}`, true);
}
function onGameGuess(top) {
  if (!GAME.on || GAME.done || !top.length) return;
  const g = document.getElementById('gameGuess');
  const hit = top[0].word === GAME.word || top.some(t => t.word === GAME.word && t.p > 0.25);
  if (hit) {
    GAME.done = true; GAME.score++;
    GAME.results.push({word: GAME.word, ok: true, s: (performance.now() - GAME.t0) / 1000});
    g.textContent = `Oh, I know! It's ${article(GAME.word)}!`;
    gameEl.classList.add('won');
    say(`Oh, I know! It's ${article(GAME.word)}!`, true);
    chime(NOTES[10]); setTimeout(() => chime(NOTES[12]), 140);
    for (let i = 0; i < 40; i++) emit(W / 2 + (Math.random() - 0.5) * W * 0.6, H * 0.3, RAINBOW[i % 5], 1, 260, 1.4);
    captureShot(true);
    GAME.timer = setTimeout(nextRound, 2600);
    return;
  }
  const a = top[0];
  g.textContent = `I see ${pretty(a.word)}… or ${pretty(top[1].word)}?`;
  if (a.word !== GAME.lastWord && a.p > 0.15) { GAME.lastWord = a.word; say(`${pretty(a.word)}?`); }
}
function gameTick(now) {
  if (!GAME.on || GAME.done || !GAME.word) return;
  const left = Math.max(0, GAME.dur - (now - GAME.t0));
  document.getElementById('gameBar').style.setProperty('--left', String(left / GAME.dur));
  document.getElementById('gameTime').textContent = `${Math.ceil(left / 1000)} s`;
  if (left <= 0) {
    GAME.done = true;
    GAME.results.push({word: GAME.word, ok: false});
    document.getElementById('gameGuess').textContent = `Sorry, I couldn't guess it. It was ${article(GAME.word)}.`;
    gameEl.classList.add('lost');
    say(`Sorry, I couldn't guess it. It was ${article(GAME.word)}.`, true);
    GAME.timer = setTimeout(nextRound, 2800);
  }
}
function endGame() {
  GAME.on = false; gameEl.hidden = true; clearTimeout(GAME.timer);
  S.snap = GAME.keep.snap; S.arrows = GAME.keep.arrows; syncDock();
  document.getElementById('endScore').textContent = `I guessed ${GAME.score} of ${GAME.rounds}`;
  const ul = document.getElementById('endList'); ul.replaceChildren();
  for (const r of GAME.results) {
    const li = document.createElement('li');
    const w = document.createElement('span'); w.textContent = pretty(r.word);
    const v = document.createElement('span'); v.className = r.ok ? 'ok' : 'no'; v.textContent = r.ok ? `guessed in ${r.s.toFixed(1)} s` : 'missed';
    li.append(w, v); ul.appendChild(li);
  }
  endEl.hidden = false;
  say(GAME.score >= 4 ? `I guessed ${GAME.score} of ${GAME.rounds}. You draw well!` : `I guessed ${GAME.score} of ${GAME.rounds}.`, true);
}
function stopGame() { GAME.on = false; clearTimeout(GAME.timer); gameEl.hidden = true; if (GAME.keep) { S.snap = GAME.keep.snap; S.arrows = GAME.keep.arrows; } syncDock(); }
document.getElementById('gameStop').addEventListener('click', stopGame);
document.getElementById('gameSkip').addEventListener('click', () => { if (!GAME.on || GAME.done) return; GAME.done = true; GAME.results.push({word: GAME.word, ok: false}); nextRound(); });
document.getElementById('endAgain').addEventListener('click', () => { endEl.hidden = true; startGame(); });
document.getElementById('endDone').addEventListener('click', () => { endEl.hidden = true; clearAll(false); });

// ---------- dock (mouse and fingertip) ----------
const dock = document.getElementById('dock');
const DWELL_MS = 600;
let dockRects = [];
function measureDock() { dockRects = [...dock.querySelectorAll('.btn')].map(b => ({el: b, r: b.getBoundingClientRect()})); }
window.addEventListener('resize', measureDock);
function inDock(p) { if (!p) return false; const r = dock.getBoundingClientRect(); return p.x > r.left - 10 && p.x < r.right + 10 && p.y > r.top - 10 && p.y < r.bottom + 10; }
function updateDwell(h, now) {
  const target = ((!h.down || inDock(h.pen)) && h.tip) ? dockRects.find(d => h.tip.x >= d.r.left && h.tip.x <= d.r.right && h.tip.y >= d.r.top && h.tip.y <= d.r.bottom) : null;
  dockRects.forEach(d => d.el.classList.toggle('air', !!target && d === target));
  if (!target) { h.dwell = null; h.dwellDone = null; return; }
  if (h.dwellDone === target.el) return;
  if (!h.dwell || h.dwell.el !== target.el) h.dwell = {el: target.el, t0: now};
  if (now - h.dwell.t0 > DWELL_MS) { activate(target.el); h.dwellDone = target.el; h.dwell = null; }
}
function activate(b) {
  ensureAudio();
  if (b.dataset.color) { S.color = b.dataset.color; }
  else if (b.dataset.brush) { S.brush = b.dataset.brush; }
  else if (b.dataset.toggle) {
    S[b.dataset.toggle] = !S[b.dataset.toggle]; toast(`${b.getAttribute('aria-label')}: ${S[b.dataset.toggle] ? 'on' : 'off'}`);
    if (b.dataset.toggle === 'guess') { G.sig = ''; renderGuess(); if (S.guess) loadGuesser().catch(() => toast('The guesser could not load. Check the connection.')); }
  }
  else if (b.dataset.action === 'undo') { const o = S.objects.pop(); if (o && o.isTwin) S.objects.pop(); }
  else if (b.dataset.action === 'clear') { clearAll(true); toast('Cleared'); }
  else if (b.dataset.action === 'capture') captureShot();
  else if (b.dataset.action === 'drawmode') { const m = MODE_ORDER[(MODE_ORDER.indexOf(S.drawMode) + 1) % MODE_ORDER.length]; setDrawMode(m); toast('Draw with: ' + DRAW_MODES[m].label); }
  else if (b.dataset.action === 'play') { GAME.on ? stopGame() : startGame(); }
  else if (b.dataset.action === 'camera') { S.camLevel = (S.camLevel + 2) % 3; document.getElementById('camTip').textContent = 'Camera: ' + ['off', 'dim', 'bright'][S.camLevel]; toast('Camera: ' + ['off', 'dim', 'bright'][S.camLevel]); }
  syncDock();
}
function syncDock() {
  dock.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === S.color)));
  dock.querySelectorAll('[data-brush]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.brush === S.brush)));
  dock.querySelectorAll('[data-toggle]').forEach(b => b.setAttribute('aria-pressed', String(!!S[b.dataset.toggle])));
  const pb = dock.querySelector('[data-action="play"]'); if (pb) pb.setAttribute('aria-pressed', String(GAME.on));
}
dock.addEventListener('click', e => { const b = e.target.closest('.btn'); if (b) activate(b); });
syncDock(); measureDock();

let toastT = 0;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1300); }

// ---------- pictures ----------
const tray = document.getElementById('tray'), lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg'), lbSave = document.getElementById('lbSave');
let lbIndex = -1;
function captureShot() {
  // a clean frame: camera (as shown) plus the sketch, without hand lines or sparks
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const realCtx = ctx; ctx = g; const now = performance.now();
  try {
    drawBackground();
    for (const o of S.objects) o.type === 'string' ? drawString(o, now, false) : drawStroke(o, now);
  } finally { ctx = realCtx; }
  const url = c.toDataURL('image/jpeg', 0.92);
  const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  S.shots.push({url, name: `hava-${stamp}.jpg`});
  const fl = document.getElementById('flash'); fl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on')));
  if (AC && S.sound) chime(1046.5);
  renderTray(); toast('Picture taken');
}
function renderTray() {
  tray.replaceChildren(...S.shots.map((s, i) => {
    const b = document.createElement('button'); b.setAttribute('aria-label', `Open picture ${i + 1}`);
    const im = document.createElement('img'); im.src = s.url; im.alt = '';
    b.appendChild(im); b.addEventListener('click', () => openShot(i)); return b;
  }));
}
function openShot(i) { lbIndex = i; lbImg.src = S.shots[i].url; lbSave.href = S.shots[i].url; lbSave.download = S.shots[i].name; lightbox.hidden = false; }
document.getElementById('lbClose').addEventListener('click', () => { lightbox.hidden = true; });
document.getElementById('lbDelete').addEventListener('click', () => { if (lbIndex >= 0) { S.shots.splice(lbIndex, 1); renderTray(); } lightbox.hidden = true; });
lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.hidden = true; });
window.addEventListener('keydown', e => { if (e.key === 'Escape') lightbox.hidden = true; });

// ---------- mouse and touch ----------
let mouse = {down: false, stroke: null, prev: null, pos: null, shiftStart: null, erasing: false};
cv.addEventListener('pointerdown', e => {
  ensureAudio(); cv.setPointerCapture(e.pointerId);
  const p = {x: e.clientX, y: e.clientY};
  mouse.down = true; mouse.pos = p;
  if (e.shiftKey) { mouse.shiftStart = p; S.liveString = {type: 'string', a: p, b: p, color: pickColor(), amp: 0, t0: 0, freq: 0}; return; }
  if (mouse.erasing) { eraseAt(p, 30); return; }
  mouse.stroke = newStroke(pickColor(), p.x, p.y);
});
cv.addEventListener('pointermove', e => {
  const p = {x: e.clientX, y: e.clientY};
  mouse.prev = mouse.pos; mouse.pos = p;
  if (!mouse.down) { checkPluck(mouse.prev, p); return; }
  if (mouse.shiftStart && S.liveString) { S.liveString.b = p; return; }
  if (mouse.erasing) { eraseAt(p, 30); return; }
  if (mouse.stroke) addPoint(mouse.stroke, p.x, p.y);
});
function pointerEnd() {
  if (mouse.shiftStart && S.liveString) { const s = makeString(S.liveString.a, S.liveString.b, S.liveString.color); if (s) pluck(s, 10, 0.5); S.liveString = null; }
  if (mouse.stroke) finishStroke(mouse.stroke);
  mouse.down = false; mouse.stroke = null; mouse.shiftStart = null;
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('button')) { if (e.key === ' ' || e.key === 'Enter') return; }
  if (e.key === 'e' || e.key === 'E') mouse.erasing = true;
  if (e.key === 'c' || e.key === 'C') { clearAll(true); toast('Cleared'); }
  if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey || !e.shiftKey)) { const o = S.objects.pop(); if (o && o.isTwin) S.objects.pop(); }
});
window.addEventListener('keyup', e => { if (e.key === 'e' || e.key === 'E') mouse.erasing = false; });

// ---------- guide ----------
const guide = document.getElementById('guide'), gBtn = document.getElementById('guideToggle');
gBtn.addEventListener('click', () => { const min = guide.classList.toggle('min'); gBtn.textContent = min ? 'show' : 'hide'; gBtn.setAttribute('aria-expanded', String(!min)); });

// ---------- start ----------
const intro = document.getElementById('intro'), introMsg = document.getElementById('introMsg');
let landmarker = null, lastVideoTime = -1;
let landmarkerLoad = null;
function loadLandmarker() {
  if (!landmarkerLoad) landmarkerLoad = (async () => {
    const {FilesetResolver, HandLandmarker} = await import(MP_BUNDLE);
    const vision = await FilesetResolver.forVisionTasks(MP_WASM);
    const opts = d => ({baseOptions: {modelAssetPath: MP_MODEL, delegate: d}, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5});
    try { return await HandLandmarker.createFromOptions(vision, opts('GPU')); }
    catch (e) { return await HandLandmarker.createFromOptions(vision, opts('CPU')); }
  })();
  return landmarkerLoad;
}
async function startCamera() {
  ensureAudio();
  introMsg.textContent = 'Asking for the camera…';
  const loading = loadLandmarker();          // download the model while the camera prompt is open
  loading.catch(() => {});
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 1280}, height: {ideal: 720}, facingMode: 'user'}, audio: false});
    video.srcObject = stream; await video.play();
  } catch (e) {
    introMsg.textContent = 'The camera is blocked or missing. Allow the camera for this page in the address bar, or use the mouse.';
    return;
  }
  introMsg.textContent = 'Loading hand tracking (about 8 MB, first time only)…';
  try { landmarker = await loading; }
  catch (e) {
    landmarkerLoad = null;
    introMsg.textContent = 'Hand tracking could not load. Check the internet connection and reload, or use the mouse.';
    return;
  }
  S.mode = 'camera'; intro.hidden = true; measureDock();
  setStatus(); afterStart();
}
// ?check loads hand tracking without the camera and reports whether it works on this site
if (new URLSearchParams(location.search).has('check')) {
  introMsg.textContent = 'Checking hand tracking…';
  const t0 = performance.now();
  loadLandmarker().then(async () => {
    const t1 = performance.now();
    await loadGuesser();
    const ring = Array.from({length: 41}, (_, i) => ({x: 300 + 100 * Math.cos(i / 20 * Math.PI), y: 300 + 100 * Math.sin(i / 20 * Math.PI)}));
    const top = classify([{type: 'stroke', pts: ring}]);
    const msg = `Hand tracking loaded in ${Math.round(t1 - t0)} ms; guesser in ${Math.round(performance.now() - t1)} ms (a ring looks like: ${pretty(top[0].word)})`;
    introMsg.textContent = msg; console.log('HAVA_CHECK ok: ' + msg);
  }).catch(e => { introMsg.textContent = 'Check failed: ' + (e && e.message || e); console.log('HAVA_CHECK failed: ' + (e && e.message || e)); });
}
document.getElementById('startCam').addEventListener('click', startCamera);
document.getElementById('startMouse').addEventListener('click', () => { ensureAudio(); S.mode = 'mouse'; intro.hidden = true; measureDock(); setStatus(); afterStart(); });
function afterStart() {
  if (S.guess) loadGuesser().catch(() => {});
  if (startWithGame) { startWithGame = false; startGame(); }
}
let startWithGame = false;
document.getElementById('startGame').addEventListener('click', () => { startWithGame = true; startCamera(); });
document.querySelectorAll('input[name="drawWith"]').forEach(r => r.addEventListener('change', () => { if (r.checked) setDrawMode(r.value); }));
try { const m = localStorage.getItem('hava.drawMode'); if (m) setDrawMode(m); } catch (e) {}

function setStatus() {
  const dot = document.getElementById('dot'), txt = document.getElementById('statusText');
  if (S.mode === 'camera' || S.mode === 'sim') {
    const n = S.lastHands.length;
    dot.classList.toggle('on', n > 0);
    txt.innerHTML = n ? `<b>${n} hand${n > 1 ? 's' : ''}</b> · ${S.objects.length} lights` : '<b>Show your hands</b> to the camera';
  } else {
    dot.classList.remove('on');
    txt.innerHTML = '<b>Mouse</b> · drag to draw, Shift-drag for a string, hold E to erase';
  }
}

// ---------- test hook: feed hands without a camera (?sim) ----------
const SIM = new URLSearchParams(location.search).has('sim');
window.HAVA = {S, simHands: [], recognize};
if (SIM) { S.mode = 'sim'; intro.hidden = true; }
Object.assign(window.HAVA, {G, GAME, loadGuesser, classify, setDrawMode, startGame, stopGame, sketchPixels});

// ---------- main loop ----------
let last = performance.now(), statusT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === 'camera' && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let res = null;
    try { res = landmarker.detectForVideo(video, now); } catch (e) { res = null; }
    const list = [];
    if (res && res.landmarks) res.landmarks.forEach((lm, i) => {
      const label = (res.handedness && res.handedness[i] && res.handedness[i][0] && res.handedness[i][0].categoryName) || 'H';
      let key = label; if (list.some(h => h.key === key)) key = label + i;
      list.push({key, pts: lm.map(toScreen)});
    });
    processHands(list, now, dt);
  } else if (S.mode === 'sim') {
    processHands(window.HAVA.simHands.map((h, i) => ({key: h.key || 'S' + i, pts: h.pts})), now, dt);
  } else if (S.mode === 'camera') {
    // no new video frame: keep string plucks and dwell timers alive
  }
  if (mouse.erasing && mouse.pos && mouse.down === false) { /* hold E and move */ }
  runGuess(now); gameTick(now);
  updateParticles(dt);
  drawBackground();
  for (const o of S.objects) o.type === 'string' ? drawString(o, now, false) : drawStroke(o, now);
  if (S.liveString) drawString(S.liveString, now, true);
  drawParticles();
  drawHands(now);
  if (mouse.erasing && mouse.pos) { ctx.strokeStyle = 'rgba(236,239,248,0.6)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(mouse.pos.x, mouse.pos.y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  if (now - statusT > 300) { setStatus(); statusT = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
