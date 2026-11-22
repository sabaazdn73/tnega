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
  world: 'draw',          // draw | theremin | drums | piano | harp | bridge
  history: [],            // for undo: added, moved and cleared objects
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
let AC = null, master = null, revIn = null, noiseBuf = null;
function ensureAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor();
      master = AC.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(AC.destination);
      // a small hall for the instruments, and white noise for drums and cracks
      const conv = AC.createConvolver(); conv.buffer = makeImpulse(2.4);
      revIn = AC.createGain(); revIn.gain.value = 0.8; revIn.connect(conv); conv.connect(master);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
function makeImpulse(sec) {
  const sr = AC.sampleRate, len = Math.floor(sr * sec), b = AC.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * 0.45; }
  return b;
}
// connect a sound to the output, with some of it sent to the hall
function out(node, wet) {
  node.connect(master);
  if (wet && revIn) { const s = AC.createGain(); s.gain.value = wet; node.connect(s); s.connect(revIn); }
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
function pluckSound(freq, vel, pan, wet) {
  if (!S.sound || !AC) return;
  const src = AC.createBufferSource(); src.buffer = ksBuffer(freq);
  const g = AC.createGain(); g.gain.value = clamp(vel, 0.15, 1);
  const p = AC.createStereoPanner ? AC.createStereoPanner() : null;
  src.connect(g); if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p); out(p, wet); } else out(g, wet);
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
  if (S.world === 'bridge') { s.bridge = true; s.color = '#eceff8'; s.brush = 'neon'; S.objects.push(s); return s; }
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
  if (s.bridge) { S.objects = S.objects.filter(o => o !== s); if (S.world === 'bridge') bridgeAddStroke(s.pts); return; }
  const all = s.twin ? [s, s.twin] : [s];
  if (s.pts.length < 3) { S.objects = S.objects.filter(o => !all.includes(o)); return; }
  remember({type: 'add', objs: all});
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
  S.objects.push(s); remember({type: 'add', objs: [s]});
  emit(a.x, a.y, color, 10, 90, 0.6); emit(b.x, b.y, color, 10, 90, 0.6);
  return s;
}
function pluck(str, vel, where) {
  str.amp = clamp(vel, 4, 26); str.t0 = performance.now(); str.where = where;
  const mx = lerp(str.a.x, str.b.x, where), my = lerp(str.a.y, str.b.y, where);
  emit(mx, my, str.color, REDUCED ? 4 : 14, 120, 0.7);
  pluckSound(str.freq, vel / 22, (mx / W) * 2 - 1, str.harp ? 0.4 : 0);
}
function pluckAcross(list, p0, p1) {
  if (!p0 || !p1) return;
  const v = dist(p0, p1);
  if (v < 3) return;
  for (const o of list) {
    if (o.type !== 'string') continue;
    const u = segCross(o.a, o.b, p0, p1);
    if (u !== null && performance.now() - o.t0 > 90) pluck(o, v * 0.6, u);
  }
}
function checkPluck(p0, p1) { pluckAcross(S.objects, p0, p1); }
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
function clearAll(burst, record = true) {
  if (record && S.objects.length) remember({type: 'clear', objs: S.objects.slice()});
  GR.clear(); for (const h of S.handStates.values()) h.grab = null;
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
  const ticks = o.harp ? 0 : Math.floor(L / 22);
  ctx.strokeStyle = rgba(o.color, 0.6); ctx.lineWidth = 1;
  for (let i = 1; i < ticks; i++) {
    const s = i / ticks, off = A * Math.sin(Math.PI * s);
    const x = o.a.x + dx * s + nx * off, y = o.a.y + dy * s + ny * off, len = i % 5 === 0 ? 9 : 5;
    ctx.beginPath(); ctx.moveTo(x - nx * len, y - ny * len); ctx.lineTo(x + nx * len, y + ny * len); ctx.stroke();
  }
  for (const e of [o.a, o.b]) {
    ctx.fillStyle = whiten(o.color, 0.8); ctx.beginPath(); ctx.arc(e.x, e.y, o.harp ? 2.5 : 3.5, 0, Math.PI * 2); ctx.fill();
    if (!o.harp) { ctx.strokeStyle = rgba(o.color, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, Math.PI * 2); ctx.stroke(); }
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
    if (!st) { st = {key: h.key, pts: h.pts.map(q => ({...q})), pinch: false, pinchM: false, down: false, flip: 0, downT: 0, stroke: null, block: false, fistT: 0, tip: null, prevTip: null, mid: null, prevMid: null, palmC: null, prevPalmC: null, dwell: null, grab: null, rockT: 0}; S.handStates.set(h.key, st); }
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
    st.rock = ix && !md && !rg && pk && !st.pinch;      // the rock sign opens the instrument ring
    st.pen = st.pen ? {x: lerp(st.pen.x, pen.x, 0.55), y: lerp(st.pen.y, pen.y, 0.55)} : {x: pen.x, y: pen.y};
    if (st.down && st.downT === now) st.downPen = {...st.pen};   // where the pen went down
    st.prevTip = st.tip; st.tip = {x: p[8].x, y: p[8].y};
    st.prevMid = st.mid; st.mid = {x: p[12].x, y: p[12].y};
    st.prevPalmC = st.palmC;
    st.palmC = centroid([p[0], p[5], p[9], p[13], p[17]]);
    st.hdt = clamp((now - (st.seen || now - 16)) / 1000, 0.008, 0.1);   // time since this hand's last update
    st.seen = now;
  }
  for (const [k, st] of S.handStates) if (!seen.has(k) && now - st.seen > 250) {
    if (st.stroke) finishStroke(st.stroke);
    if (st.grab) releaseGrab(st);
    S.handStates.delete(k);
  }
  const hands = [...S.handStates.values()].filter(h => seen.has(h.key));
  S.lastHands = hands;
  const world = S.world, canDraw = world === 'draw' || (world === 'bridge' && BR.phase === 'build');

  if (canDraw) {
    const drawing = hands.filter(h => h.down && !h.grab && !inUI(h.pen));
    if (world === 'draw' && drawing.length >= 2) {
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
        if (h.down && !h.block && !h.grab && !inUI(h.pen)) {
          if (!h.stroke) {
            if (now - h.downT > 90) {
              // a beam starts where the pinch closed, so it lands on the ring it started on
              const st0 = world === 'bridge' && h.downPen ? h.downPen : h.pen;
              h.stroke = newStroke(pickColor(), st0.x, st0.y);
              if (st0 !== h.pen) addPoint(h.stroke, h.pen.x, h.pen.y);
            }
          }
          else addPoint(h.stroke, h.pen.x, h.pen.y);
        } else {
          if (h.stroke) { finishStroke(h.stroke); h.stroke = null; }
          if (!h.down) h.block = false;
        }
      }
    }
  } else {
    for (const h of hands) { if (h.stroke) { finishStroke(h.stroke); h.stroke = null; } if (!h.down) h.block = false; }
  }
  if (world === 'draw') updateGrabs(hands);
  for (const h of hands) {
    // strum strings with the index fingertip (in thumb + middle mode the index is always free)
    if (world === 'draw' && (!h.down || S.drawMode === 'middle')) checkPluck(h.prevTip, h.tip);
    // open hand swipe wipes
    h.wiping = false;
    if (canDraw && h.open && h.prevPalmC && !RING.open) {
      const speed = dist(h.palmC, h.prevPalmC) / Math.max(dt, 1e-3);
      if (speed > 420) { h.wiping = true; world === 'bridge' ? bridgeEraseAt(h.palmC, h.palm * 1.25) : eraseAt(h.palmC, h.palm * 1.25); }
    }
    // hold a fist on empty space to clear (a fist on a shape grabs it instead)
    if (world === 'draw' && h.fist && !h.grab) { if (!h.fistT) h.fistT = now; if (now - h.fistT > 1300) { clearAll(true); toast('Cleared. Undo brings it back'); h.fistT = now + 5000; } }
    else h.fistT = 0;
    // hold a peace sign to take a picture
    if (canDraw && h.peace) { if (!h.peaceT) h.peaceT = now; if (now - h.peaceT > 900) { captureShot(); h.peaceT = now + 4000; } }
    else h.peaceT = 0;
    // hold the rock sign to open the ring of instruments
    if (h.rock && !RING.open) { if (!h.rockT) h.rockT = now; if (now - h.rockT > ROCK_MS) { openRing(h.tip.x, h.tip.y); h.rockT = now + 2500; } }
    else if (!h.rock) h.rockT = 0;
    // press buttons by holding a fingertip on them
    updateDwell(h, now);
  }
  worldHands(hands, now);
}
function arcProgress(x, y, r, f, color, lw) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + clamp(f, 0, 1) * Math.PI * 2); ctx.stroke();
}
function drawHands(now) {
  const world = S.world, canDraw = world === 'draw' || (world === 'bridge' && BR.phase === 'build');
  ctx.font = '600 11px "Hanken Grotesk", system-ui, sans-serif';
  for (const h of S.lastHands) {
    const p = h.pts;
    if (S.hands) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(92,242,179,0.55)';
      for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke(); }
      for (let i = 0; i < 21; i++) { ctx.fillStyle = i === 4 || i === 8 ? '#ffffff' : 'rgba(255,92,138,0.85)'; ctx.beginPath(); ctx.arc(p[i].x, p[i].y, i % 4 === 0 && i ? 4.2 : 3.2, 0, Math.PI * 2); ctx.fill(); }
    }
    const col = world === 'bridge' ? '#eceff8' : S.color === 'rainbow' ? RAINBOW[(S.rainbowIx + 1) % RAINBOW.length] : S.color;
    if (canDraw && h.down && !h.grab) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(col, 0.35); ctx.beginPath(); ctx.arc(h.pen.x, h.pen.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = whiten(col, 0.7); ctx.beginPath(); ctx.arc(h.pen.x, h.pen.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (world === 'piano') {
      for (const ti of TIPS) {
        const st = PIANO.tips.get(h.key + ':' + ti), on = st && st.key;
        ctx.fillStyle = on ? '#ffffff' : 'rgba(236,239,248,0.6)';
        ctx.beginPath(); ctx.arc(p[ti].x, p[ti].y, on ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (world === 'drums' && h.tip) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,181,71,0.35)'; ctx.beginPath(); ctx.arc(h.tip.x, h.tip.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(h.tip.x, h.tip.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (h.tip && !h.grab) {
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h.tip.x, h.tip.y, 9, 0, Math.PI * 2); ctx.stroke();
    }
    if (canDraw && h.open && !RING.open) {
      ctx.strokeStyle = h.wiping ? 'rgba(236,239,248,0.85)' : 'rgba(236,239,248,0.25)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.palmC.x, h.palmC.y, h.palm * 1.25, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (h.grab) {
      ctx.strokeStyle = 'rgba(236,239,248,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(h.palmC.x, h.palmC.y, h.palm * 0.85, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center';
    if (world === 'draw' && h.fist && !h.grab && h.fistT && now - h.fistT > 0 && now - h.fistT < 1300) {
      arcProgress(h.palmC.x, h.palmC.y, h.palm * 0.9, (now - h.fistT) / 1300, '#ff5c8a', 4);
      ctx.fillStyle = 'rgba(236,239,248,0.9)'; ctx.fillText('hold to clear', h.palmC.x, h.palmC.y + h.palm * 0.9 + 18);
    }
    if (h.peace && h.peaceT && now - h.peaceT > 0 && now - h.peaceT < 900) {
      arcProgress((p[8].x + p[12].x) / 2, (p[8].y + p[12].y) / 2 - 26, 18, (now - h.peaceT) / 900, '#ffb547', 4);
    }
    if (h.rock && h.rockT && now - h.rockT > 120 && now - h.rockT < ROCK_MS && !RING.open) {
      arcProgress(h.tip.x, h.tip.y, 22, (now - h.rockT) / ROCK_MS, '#a98bff', 4);
      ctx.fillStyle = 'rgba(236,239,248,0.9)'; ctx.fillText('instruments', h.tip.x, h.tip.y - 32);
    }
    ctx.textAlign = 'start';
    if (h.dwell) arcProgress(h.tip.x, h.tip.y, 16, (now - h.dwell.t0) / h.dwell.ms, '#ffb547', 3);
  }
}

// ---------- undo history ----------
function remember(a) { S.history.push(a); if (S.history.length > 200) S.history.shift(); }
function snapshot(o) { return o.type === 'string' ? {a: {...o.a}, b: {...o.b}} : {pts: o.pts.map(q => ({...q}))}; }
function applyTransform(o, sn, T) {
  if (o.type === 'string') {
    o.a = T(sn.a); o.b = T(sn.b);
    // a string keeps its note by length, so stretching it retunes it
    const f = noteForLength(dist(o.a, o.b));
    if (f !== o.freq) { o.freq = f; if (performance.now() - o.t0 > 140) pluck(o, 5, 0.5); }
  } else o.pts = sn.pts.map(q => { const r = T(q); return {x: r.x, y: r.y, w: q.w}; });
}
const SAME = q => ({x: q.x, y: q.y});
function undo() {
  if (S.world === 'bridge') { bridgeUndo(); return; }
  while (S.history.length) {
    const a = S.history.pop();
    if (a.type === 'add') { if (!a.objs.some(o => S.objects.includes(o))) continue; S.objects = S.objects.filter(o => !a.objs.includes(o)); return; }
    if (a.type === 'move') { if (!S.objects.includes(a.obj)) continue; applyTransform(a.obj, a.before, SAME); return; }
    if (a.type === 'clear') { if (!a.objs.length) continue; S.objects = a.objs.concat(S.objects); toast('Brought back'); return; }
  }
  const o = S.objects.pop(); if (o && o.isTwin) S.objects.pop();
}

// ---------- grab, move, resize (fist on a shape) ----------
const GR = new Map();   // object -> {hands, orig, start, before}
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function hitObject(p, r) {
  let best = null, bd = r;
  for (let i = S.objects.length - 1; i >= 0; i--) {
    const o = S.objects[i];
    if (o.bridge) continue;
    let d = Infinity;
    if (o.type === 'string') d = segDist(p, o.a, o.b);
    else {
      const pts = o.morph ? o.morph.to : o.pts;
      for (let k = 1; k < pts.length; k++) d = Math.min(d, segDist(p, pts[k - 1], pts[k]));
      if (o.closed && pts.length > 2 && pointInPoly(p, pts)) d = Math.min(d, r * 0.5);   // inside a shape counts
    }
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function settle(o) { if (o.morph) { o.pts = o.morph.to.map(q => ({x: q.x, y: q.y, w: 1})); o.morph = null; } }
function regrip(o) { const g = GR.get(o); g.orig = snapshot(o); g.start = g.hands.map(h => ({...h.palmC})); }
function startGrab(h, o) {
  settle(o);
  let g = GR.get(o);
  if (!g) { g = {hands: [], before: snapshot(o)}; GR.set(o, g); }
  if (g.hands.length >= 2) return false;
  g.hands.push(h); h.grab = o; h.relN = 0; h.fistT = 0;
  regrip(o);
  chime(g.hands.length === 2 ? NOTES[9] : NOTES[7]);
  toast(g.hands.length === 2 ? 'Both hands: pull apart to resize, turn to rotate' : 'Holding it. Open your hand to let go');
  return true;
}
function releaseGrab(h) {
  const o = h.grab; h.grab = null; h.relN = 0;
  const g = o && GR.get(o); if (!g) return;
  g.hands = g.hands.filter(x => x !== h);
  if (g.hands.length) { regrip(o); return; }
  GR.delete(o);
  remember({type: 'move', obj: o, before: g.before});
}
function updateGrabs(hands) {
  for (const h of hands) {
    if (h.grab) { h.relN = h.fist ? 0 : (h.relN || 0) + 1; if (h.relN >= 3) releaseGrab(h); }
    else if (h.fist && !h.grabTried) { h.grabTried = true; const o = hitObject(h.palmC, h.palm * 1.15); if (o) startGrab(h, o); }
    if (!h.fist && !h.grab) h.grabTried = false;
  }
  for (const [o, g] of GR) {
    if (!S.objects.includes(o)) { GR.delete(o); g.hands.forEach(h => { h.grab = null; }); continue; }
    const P = g.hands.map(h => h.palmC);
    let T;
    if (P.length === 1) { const dx = P[0].x - g.start[0].x, dy = P[0].y - g.start[0].y; T = q => ({x: q.x + dx, y: q.y + dy}); }
    else {
      // two hands: the midpoint moves it, the distance scales it, the angle turns it
      const [a0, b0] = g.start, [a, b] = P;
      const m0 = {x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2}, m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
      const s = clamp(dist(a, b) / Math.max(dist(a0, b0), 1), 0.15, 8);
      const th = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
      const c = Math.cos(th) * s, sn = Math.sin(th) * s;
      T = q => { const x = q.x - m0.x, y = q.y - m0.y; return {x: m.x + c * x - sn * y, y: m.y + sn * x + c * y}; };
    }
    applyTransform(o, g.orig, T);
  }
}
function drawGrabs(now) {
  for (const [o] of GR) {
    const bb = bbox(o.type === 'string' ? [o.a, o.b] : o.pts), pad = 14;
    ctx.save(); ctx.setLineDash([5, 6]); ctx.lineDashOffset = -now / 40; ctx.strokeStyle = 'rgba(236,239,248,0.7)'; ctx.lineWidth = 1.3;
    ctx.strokeRect(bb.x0 - pad, bb.y0 - pad, bb.w + pad * 2, bb.h + pad * 2); ctx.restore();
    ctx.fillStyle = 'rgba(236,239,248,0.9)';
    for (const [x, y] of [[bb.x0 - pad, bb.y0 - pad], [bb.x1 + pad, bb.y0 - pad], [bb.x0 - pad, bb.y1 + pad], [bb.x1 + pad, bb.y1 + pad]]) ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}

// ---------- the ring of instruments (hold the rock sign) ----------
const ROCK_MS = 650;
const RING = {open: false, t0: 0, r: 118, x: 0, y: 0};
const ringEl = document.getElementById('ring');
function openRing(x, y) {
  const r = W < 440 ? 100 : 118, m = r + 52;
  RING.r = r;
  x = W < 2 * m + 16 ? W / 2 : clamp(x, m + 8, W - m - 8);
  y = H < 2 * m + 80 ? H / 2 : clamp(y, m + 64, H - m - 8);
  ringEl.style.left = x + 'px'; ringEl.style.top = y + 'px';
  ringEl.style.setProperty('--r', r + 'px');
  ringEl.querySelectorAll('[data-world]').forEach(b => b.setAttribute('aria-current', String(b.dataset.world === S.world)));
  ringEl.hidden = false; RING.open = true; RING.t0 = performance.now(); RING.x = x; RING.y = y;
  ensureAudio(); chime(NOTES[7]);
  measureAir();
}
function closeRing() { if (!RING.open) return; ringEl.hidden = true; RING.open = false; measureAir(); }
ringEl.addEventListener('click', e => { const b = e.target.closest('[data-world]'); if (!b) return; closeRing(); setWorld(b.dataset.world); });
function updateRing(now) {
  if (!RING.open) return;
  if (S.lastHands.some(h => h.dwell && ringEl.contains(h.dwell.el))) RING.t0 = now;
  if (now - RING.t0 > 7000) closeRing();
}

// ---------- worlds: drawing, four instruments, the bridge ----------
const WORLDS = {
  draw: {label: 'Draw'},
  theremin: {label: 'Theremin', hint: 'your right hand sets the pitch, the left hand the volume; a fist goes quiet'},
  drums: {label: 'Drums', hint: 'strike down into a ring; faster is louder'},
  piano: {label: 'Piano', hint: 'push fingertips down through the dashed line'},
  harp: {label: 'Harp', hint: 'sweep a fingertip through the strings'},
  bridge: {label: 'Bridge'},
};
const ROCK_ROW = ['Hold the rock sign 🤘', 'Switch instrument, or go back to drawing'];
const GUIDES = {
  draw: () => [
    DRAW_MODES[S.drawMode].row,
    ['Close a loop', 'Snaps to a circle, triangle, box or star'],
    ['Draw a straight line', 'Becomes an arrow, pointing where you ended'],
    ['Make a fist on a shape', 'Grab and move it; two fists resize and turn it'],
    ['Hold a peace sign', 'Take a picture of the sketch'],
    ['Wave an open hand', 'Wipe light away'],
    ['Hold a fist on empty space', 'Clear everything (Undo brings it back)'],
    ['Pinch both hands', 'Stretch a string, then flick it to play'],
    ['Light bulb button', 'The AI guesses what you are drawing'],
    ['Hold the rock sign 🤘', 'Air instruments and the bridge game'],
    ['Hold a fingertip', 'Press a button in the bar above'],
  ],
  theremin: [['Right hand up and down', 'Pitch: the higher the hand, the higher the note'], ['Left hand up and down', 'Volume: higher is louder'], ['Make a fist', 'Go quiet'], ['Mouse', 'Hold the button and move up and down'], ROCK_ROW],
  drums: [['Strike down into a ring', 'Plays that drum; a faster strike is louder'], ['Both hands', 'Play two drums at once'], ['Keys 1 to 6, or click', 'Play without the camera'], ROCK_ROW],
  piano: [['Push fingertips down', 'Each fingertip that crosses the dashed line plays its key'], ['Keep it below the line', 'The note rings on; lift the finger to stop it'], ['Slide sideways', 'Glide from key to key'], ['Keys A to ; and W to P', 'Play with the keyboard, or click the keys'], ROCK_ROW],
  harp: [['Sweep a fingertip', 'Through the strings to play them'], ['Sweep faster', 'Louder notes'], ['Mouse', 'Move across the strings'], ROCK_ROW],
  bridge: [
    ['Pinch and draw', 'A beam; a zigzag makes a row of triangles'],
    ['Start or end on a ring', 'Fixes the beam to the cliff'],
    ['End on a joint or beam', 'Joins it there'],
    ['Flat beams', 'Are road the truck can drive on'],
    ['Wave an open hand', 'Erase beams'],
    ['Drive the truck', 'Test it: blue beams are pulled, rose beams pushed'],
    ['Hold the rock sign 🤘', 'Back to drawing or music'],
  ],
};
const guideList = document.querySelector('#guide ul'), guideTitle = document.getElementById('guideTitle');
function renderGuide() {
  const rows = typeof GUIDES[S.world] === 'function' ? GUIDES[S.world]() : GUIDES[S.world];
  guideList.replaceChildren(...rows.map(([a, b]) => {
    const li = document.createElement('li'), x = document.createElement('span'), y = document.createElement('span');
    x.textContent = a; y.textContent = b; li.append(x, y); return li;
  }));
  guideTitle.textContent = S.world === 'draw' ? 'Gestures' : WORLDS[S.world].label;
}
const wchip = document.getElementById('wchip');
function renderWorldUI() {
  renderGuide();
  const w = WORLDS[S.world];
  wchip.hidden = !w.hint;
  if (w.hint) {
    const b = document.createElement('b'), s = document.createElement('span');
    b.textContent = w.label; s.textContent = `: ${w.hint}. Hold 🤘 to switch.`;
    wchip.replaceChildren(b, s);
  }
  document.body.dataset.world = S.world;
  renderGuess(); renderBridgeCard(); syncDock(); setStatus(); measureAir();
}
function setWorld(w) {
  if (!WORLDS[w]) return;
  ensureAudio();
  if (w === S.world) { renderWorldUI(); return; }
  for (const h of S.handStates.values()) {
    if (h.stroke) { const s = h.stroke; S.objects = S.objects.filter(o => o !== s && o !== s.twin); h.stroke = null; }
    if (h.grab) releaseGrab(h);
    h.down = false; h.flip = 0; h.block = true;
  }
  if (mouse.stroke) { const s = mouse.stroke; S.objects = S.objects.filter(o => o !== s && o !== s.twin); mouse.stroke = null; }
  S.liveString = null;
  const old = S.world;
  if (old === 'theremin') thereminStop();
  if (old === 'piano') pianoAllOff();
  if (old === 'bridge') bridgeLeave();
  if (GAME.on) stopGame();
  S.world = w;
  // the gestures card folds away so it does not cover the keys or the cliff; the line under the bar says enough
  if (old === 'draw') { guideWasMin = guide.classList.contains('min'); setGuideMin(true); }
  if (w === 'draw') setGuideMin(guideWasMin);
  if (w === 'harp') buildHarp();
  if (w === 'bridge') bridgeEnter();
  renderWorldUI();
  toast(w === 'draw' ? 'Back to drawing' : WORLDS[w].label);
}
function worldHands(hands, now) {
  if (S.world === 'theremin') theremHands(hands);
  else if (S.world === 'drums') drumHands(hands, now);
  else if (S.world === 'piano') pianoHands(hands);
  else if (S.world === 'harp') for (const h of hands) { pluckAcross(HARP.strings, h.prevTip, h.tip); pluckAcross(HARP.strings, h.prevMid, h.mid); }
}
function worldFrame(now, dt) {
  if (S.world === 'theremin') thereminFrame(dt);
  else if (S.world === 'piano') pianoFrame(dt);
  else if (S.world === 'harp' && HARP.key !== W + 'x' + H) buildHarp();
  else if (S.world === 'bridge') updateBridge(now, dt);
  updateRing(now);
}
function drawWorld(now) {
  if (S.world === 'theremin') drawTheremin(now);
  else if (S.world === 'drums') drawDrums(now);
  else if (S.world === 'piano') drawPiano(now);
  else if (S.world === 'harp') drawHarp(now);
}

// ---------- instrument helpers ----------
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteOf(f) { const m = Math.round(69 + 12 * Math.log2(f / 440)); return PC[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')).join(''); }
function bandColor(t) { const k = clamp(t, 0, 0.9999) * (RAINBOW.length - 1), i = Math.floor(k); return mixHex(RAINBOW[i], RAINBOW[i + 1], k - i); }
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function line(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
const FONT = s => `600 ${s}px "Hanken Grotesk", system-ui, sans-serif`;
function envGain(t, peak, attack, decay) { const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); return g; }
function noiseSrc(t, dur) { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }
function filt(type, f, q) { const n = AC.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; }

// ---------- theremin: one hand's height is the pitch, the other's the volume ----------
const TH_LO = 130.81, TH_OCT = 2.5;
const THER = {nodes: null, freq: 261.63, vol: 0, active: false, px: 0, py: 0, phase: 0, mouse: null, handPitch: null, handVol: null};
const thTop = () => H * 0.14, thBot = () => H * 0.9;
function thY(y) { return clamp((y - thTop()) / (thBot() - thTop()), 0, 1); }
function thPos(f) { return 1 - Math.log2(f / TH_LO) / TH_OCT; }
function thereminStart() {
  if (!AC || THER.nodes) return;
  const t = AC.currentTime;
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), lfo = AC.createOscillator(), d1 = AC.createGain(), d2 = AC.createGain();
  o1.type = 'sine'; o2.type = 'triangle'; lfo.frequency.value = 5.6;
  const g2 = AC.createGain(); g2.gain.value = 0.2;
  const lp = filt('lowpass', 2600, 0.4), vca = AC.createGain(); vca.gain.value = 0;
  lfo.connect(d1); d1.connect(o1.frequency); lfo.connect(d2); d2.connect(o2.frequency);
  o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(vca); out(vca, 0.35);
  o1.frequency.value = THER.freq; o2.frequency.value = THER.freq * 1.002;
  o1.start(t); o2.start(t); lfo.start(t);
  THER.nodes = {o1, o2, lfo, d1, d2, vca};
}
function thereminStop() {
  const n = THER.nodes; if (!n || !AC) return;
  const t = AC.currentTime; n.vca.gain.setTargetAtTime(0, t, 0.05);
  [n.o1, n.o2, n.lfo].forEach(o => { try { o.stop(t + 0.4); } catch (e) {} });
  THER.nodes = null; THER.vol = 0; THER.active = false;
}
function theremHands(hands) {
  THER.handPitch = null; THER.handVol = null;
  if (!hands.length) return;
  const s = hands.slice().sort((a, b) => b.palmC.x - a.palmC.x);   // the hand further right on screen plays the pitch
  THER.handPitch = s[0]; THER.handVol = s[1] || null;
}
function thereminFrame(dt) {
  const hp = THER.handPitch && S.lastHands.includes(THER.handPitch) ? THER.handPitch : null;
  const hv = THER.handVol && S.lastHands.includes(THER.handVol) ? THER.handVol : null;
  let pp = null, vol = 0;
  if (hp) { pp = hp.palmC; vol = hv ? 1 - thY(hv.palmC.y) : 0.65; if (hp.fist) vol = 0; }
  else if (THER.mouse) { pp = THER.mouse; vol = 0.65; }
  if (pp) { THER.freq = TH_LO * Math.pow(2, TH_OCT * (1 - thY(pp.y))); THER.px = pp.x; THER.py = pp.y; }
  THER.active = !!pp;
  THER.vol = lerp(THER.vol, pp ? vol : 0, 0.2);
  THER.phase += dt * 7;
  if (AC && pp && !THER.nodes && S.sound) thereminStart();
  const n = THER.nodes;
  if (n) {
    const t = AC.currentTime;
    n.o1.frequency.setTargetAtTime(THER.freq, t, 0.025); n.o2.frequency.setTargetAtTime(THER.freq * 1.002, t, 0.025);
    n.d1.gain.setTargetAtTime(THER.freq * 0.007, t, 0.1); n.d2.gain.setTargetAtTime(THER.freq * 0.007, t, 0.1);
    n.vca.gain.setTargetAtTime(S.sound && pp ? vol * 0.5 : 0, t, 0.06);
  }
}
function drawTheremin() {
  const top = thTop(), bot = thBot(), ax = W - 62;
  ctx.font = FONT(11); ctx.textAlign = 'right';
  for (const f of NOTES) {
    if (f < TH_LO * 0.99 || f > TH_LO * Math.pow(2, TH_OCT) * 1.01) continue;
    const y = top + thPos(f) * (bot - top), isC = noteOf(f)[0] === 'C';
    ctx.strokeStyle = isC ? 'rgba(236,239,248,0.16)' : 'rgba(236,239,248,0.07)'; ctx.lineWidth = 1; line(48, y, ax - 14, y);
    ctx.fillStyle = isC ? 'rgba(236,239,248,0.65)' : 'rgba(236,239,248,0.35)'; ctx.fillText(noteOf(f), W - 20, y + 4);
  }
  ctx.textAlign = 'start';
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  // the pitch antenna on the right, the volume meter on the left
  ctx.strokeStyle = 'rgba(255,181,71,0.22)'; ctx.lineWidth = 7; line(ax, top - 10, ax, bot + 10);
  ctx.strokeStyle = 'rgba(255,224,180,0.85)'; ctx.lineWidth = 1.6; line(ax, top - 10, ax, bot + 10);
  ctx.strokeStyle = 'rgba(77,225,255,0.18)'; ctx.lineWidth = 7; line(26, top, 26, bot);
  if (THER.vol > 0.01) { ctx.strokeStyle = '#4de1ff'; ctx.lineWidth = 3; line(26, bot, 26, bot - (bot - top) * clamp(THER.vol, 0, 1)); }
  if (THER.active || THER.vol > 0.02) {
    const y0 = THER.py, A = 3 + 46 * THER.vol, lam = clamp(52000 / THER.freq, 26, 360), col = bandColor(thPos(THER.freq));
    ctx.beginPath();
    for (let x = 40; x <= ax; x += 4) { const y = y0 + A * Math.sin(2 * Math.PI * x / lam - THER.phase) * Math.min(1, (x - 40) / 90); x === 40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = rgba(col, 0.12); ctx.lineWidth = 18; ctx.stroke();
    ctx.strokeStyle = rgba(col, 0.4); ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = whiten(col, 0.6); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = FONT(20); ctx.fillStyle = 'rgba(236,239,248,0.95)'; ctx.textAlign = 'right';
    ctx.fillText(`${noteOf(THER.freq)}  ${Math.round(THER.freq)} Hz`, Math.max(170, THER.px - 34), y0 - A - 16);
    ctx.textAlign = 'start';
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = FONT(11); ctx.textAlign = 'center';
  for (const [h, c, name] of [[THER.handPitch, '#ffb547', 'pitch'], [THER.handVol, '#4de1ff', 'volume']]) {
    if (!h || !S.lastHands.includes(h)) continue;
    ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.palmC.x, h.palmC.y, h.palm * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c; ctx.fillText(name, h.palmC.x, h.palmC.y + h.palm * 0.75 + 16);
  }
  ctx.textAlign = 'start';
}

// ---------- drums: six pads, struck from above ----------
const PADS = [
  {k: 'hat', label: 'Hi-hat', fx: 0.15, fy: 0.42, color: '#5cf2b3'},
  {k: 'snare', label: 'Snare', fx: 0.31, fy: 0.68, color: '#ff5c8a'},
  {k: 'kick', label: 'Kick', fx: 0.5, fy: 0.8, color: '#ffb547', big: true},
  {k: 'tom', label: 'Tom', fx: 0.69, fy: 0.68, color: '#a98bff'},
  {k: 'crash', label: 'Crash', fx: 0.85, fy: 0.42, color: '#4de1ff'},
  {k: 'clap', label: 'Clap', fx: 0.5, fy: 0.5, color: '#ffd36e'},
];
const DRUM = {hit: PADS.map(() => ({t: -1e9, v: 0})), ripples: [], count: 0};
function padGeom(i) { const p = PADS[i], R = clamp(Math.min(W, H) * 0.085, 38, 88) * (p.big ? 1.2 : 1); return {x: p.fx * W, y: p.fy * H, R}; }
function padAt(q) { for (let i = 0; i < PADS.length; i++) { const g = padGeom(i); if (dist(q, g) < g.R) return i; } return -1; }
function hitPad(i, v) {
  const now = performance.now();
  DRUM.hit[i] = {t: now, v}; DRUM.ripples.push({i, t: now, v}); DRUM.count++;
  drumSound(PADS[i].k, v);
  const g = padGeom(i); emit(g.x, g.y, PADS[i].color, REDUCED ? 4 : Math.round(8 + 22 * v), 80 + 220 * v, 0.7);
}
function drumHands(hands, now) {
  for (const h of hands) {
    if (!h.tip || !h.prevTip) continue;
    if (!h.padIn) { h.padIn = new Set(); h.padT = {}; }
    const vy = (h.tip.y - h.prevTip.y) / h.hdt, speed = dist(h.tip, h.prevTip) / h.hdt;
    const k = padAt(h.tip);
    for (let i = 0; i < PADS.length; i++) {
      const ready = now - (h.padT[i] || 0) > 110;
      if (i === k) {
        const entering = !h.padIn.has(i);
        h.padIn.add(i);
        // a strike: coming into the pad fast, or a fast downward stroke stopping inside it
        if (ready && entering && speed > 160) { hitPad(i, clamp(speed / 1500, 0.25, 1)); h.padT[i] = now; }
        else if (ready && !entering && (h.vy || 0) > 450 && vy < 0.35 * h.vy) { hitPad(i, clamp(h.vy / 1500, 0.25, 1)); h.padT[i] = now; }
      } else h.padIn.delete(i);
    }
    h.vy = vy;
  }
}
function drumSound(kind, vel) {
  if (!S.sound || !AC) return;
  const t = AC.currentTime, v = clamp(vel, 0.2, 1), bus = AC.createGain();
  bus.gain.value = v; out(bus, kind === 'kick' || kind === 'hat' ? 0.06 : 0.25);
  if (kind === 'kick') {
    const o = AC.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    const e = envGain(t, 1.1, 0.004, 0.5); o.connect(e); e.connect(bus); o.start(t); o.stop(t + 0.6);
    const n = noiseSrc(t, 0.03), c = envGain(t, 0.25, 0.001, 0.02), f = filt('highpass', 2500); n.connect(f); f.connect(c); c.connect(bus);
  } else if (kind === 'snare') {
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const e = envGain(t, 0.45, 0.002, 0.12); o.connect(e); e.connect(bus); o.start(t); o.stop(t + 0.2);
    const n = noiseSrc(t, 0.3), f = filt('highpass', 1300), c = envGain(t, 0.55, 0.002, 0.22); n.connect(f); f.connect(c); c.connect(bus);
  } else if (kind === 'hat') {
    const n = noiseSrc(t, 0.12), f = filt('highpass', 7500), c = envGain(t, 0.35, 0.001, 0.07); n.connect(f); f.connect(c); c.connect(bus);
  } else if (kind === 'crash') {
    const n = noiseSrc(t, 1.8), f = filt('highpass', 4200), f2 = filt('peaking', 8000, 0.8), c = envGain(t, 0.4, 0.003, 1.6);
    f2.gain.value = 6; n.connect(f); f.connect(f2); f2.connect(c); c.connect(bus);
  } else if (kind === 'tom') {
    const o = AC.createOscillator(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    const e = envGain(t, 0.8, 0.003, 0.45); o.connect(e); e.connect(bus); o.start(t); o.stop(t + 0.55);
  } else if (kind === 'clap') {
    for (const d of [0, 0.011, 0.023, 0.034]) {
      const n = noiseSrc(t + d, d === 0.034 ? 0.25 : 0.02), f = filt('bandpass', 1400, 0.9), c = envGain(t + d, 0.5, 0.001, d === 0.034 ? 0.18 : 0.012);
      n.connect(f); f.connect(c); c.connect(bus);
    }
  }
}
function drawDrums(now) {
  ctx.textAlign = 'center';
  for (let i = 0; i < PADS.length; i++) {
    const g = padGeom(i), pd = PADS[i], ht = DRUM.hit[i], fl = ht.v * Math.exp(-(now - ht.t) / 180);
    const grd = ctx.createRadialGradient(g.x, g.y, g.R * 0.1, g.x, g.y, g.R);
    grd.addColorStop(0, rgba(pd.color, 0.08 + 0.55 * fl)); grd.addColorStop(1, rgba(pd.color, 0.03 + 0.2 * fl));
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(g.x, g.y, g.R, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(pd.color, 0.22 + 0.5 * fl); ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = whiten(pd.color, 0.35 + 0.45 * fl); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = rgba(pd.color, 0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(g.x, g.y, g.R * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = FONT(13); ctx.fillStyle = 'rgba(236,239,248,0.92)'; ctx.fillText(pd.label, g.x, g.y + 4);
    ctx.font = FONT(10); ctx.fillStyle = 'rgba(236,239,248,0.45)'; ctx.fillText(String(i + 1), g.x, g.y + 20);
  }
  ctx.textAlign = 'start';
  ctx.globalCompositeOperation = 'lighter';
  DRUM.ripples = DRUM.ripples.filter(r => now - r.t < 450);
  for (const r of DRUM.ripples) {
    const g = padGeom(r.i), a = 1 - (now - r.t) / 450;
    ctx.strokeStyle = rgba(PADS[r.i].color, 0.7 * a * r.v + 0.1 * a); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(g.x, g.y, g.R * (1 + 0.8 * (1 - a)), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- piano: two octaves, played by pushing fingertips down through a line ----------
const TIPS = [4, 8, 12, 16, 20];
const WHITE_OFF = [0, 2, 4, 5, 7, 9, 11];
const PIANO = {tips: new Map(), down: new Map(), trails: [], lay: null, layKey: '', presses: 0};
function pianoKeys() {
  const key = W + 'x' + H;
  if (PIANO.layKey === key) return PIANO.lay;
  const n = 15, x0 = W * 0.05, x1 = W * 0.95, kw = (x1 - x0) / n;
  const top = H * 0.6, bot = Math.min(H * 0.9, top + kw * 4.4), bh = (bot - top) * 0.58;
  const whites = [], blacks = [];
  for (let i = 0; i < n; i++) {
    const d = i % 7, midi = 60 + Math.floor(i / 7) * 12 + WHITE_OFF[d];
    whites.push({id: 'w' + i, midi, x0: x0 + i * kw, x1: x0 + (i + 1) * kw, y0: top, y1: bot, black: false});
    if (i < n - 1 && [0, 1, 3, 4, 5].includes(d)) { const cx = x0 + (i + 1) * kw; blacks.push({id: 'b' + i, midi: midi + 1, x0: cx - kw * 0.3, x1: cx + kw * 0.3, y0: top, y1: top + bh, black: true}); }
  }
  PIANO.lay = {whites, blacks, top, bot, wtop: top + bh, kw, x0, x1}; PIANO.layKey = key;
  return PIANO.lay;
}
function keyAt(lay, x, black) { return (black ? lay.blacks : lay.whites).find(k => x >= k.x0 && x < k.x1) || null; }
const keyColor = k => bandColor((k.midi - 60) / 25);
function epNote(freq, vel) {
  // an electric piano: a sine tine with a decaying FM bark and a short bell partial
  if (!S.sound || !AC) return null;
  const t = AC.currentTime, v = clamp(vel, 0.15, 1);
  const car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), bell = AC.createOscillator(), env = AC.createGain();
  car.frequency.value = freq; mod.frequency.value = freq; bell.frequency.value = freq * 4;
  mg.gain.setValueAtTime(freq * (0.8 + 2.4 * v), t); mg.gain.exponentialRampToValueAtTime(freq * 0.12, t + 0.9);
  mod.connect(mg); mg.connect(car.frequency);
  const bg = envGain(t, 0.1 * v, 0.003, 0.3);
  const decay = clamp(3.4 - Math.log2(freq / 130) * 0.7, 1.2, 3.4);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.006); env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  car.connect(env); bell.connect(bg); bg.connect(env);
  const pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (pan) { pan.pan.value = clamp(Math.log2(freq / 392) * 0.45, -0.7, 0.7); env.connect(pan); out(pan, 0.3); } else out(env, 0.3);
  [car, mod, bell].forEach(o => { o.start(t); o.stop(t + decay + 0.05); });
  return {env, oscs: [car, mod, bell]};
}
function epRelease(n) {
  if (!n || !AC) return;
  const t = AC.currentTime, g = n.env.gain;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); }
  g.setTargetAtTime(0.0001, t, 0.09);
  n.oscs.forEach(o => { try { o.stop(t + 0.6); } catch (e) {} });
}
function pianoPress(key, vel, owner) {
  const old = PIANO.down.get(key.id); if (old) { epRelease(old.n); PIANO.trails.forEach(t => { if (t.key === key) t.held = null; }); }
  PIANO.down.set(key.id, {n: epNote(midiHz(key.midi), vel), owner, key});
  PIANO.presses++;
  const lay = pianoKeys();
  if (PIANO.trails.length > 80) PIANO.trails.shift();
  PIANO.trails.push({key, held: owner, x: (key.x0 + key.x1) / 2, w: (key.x1 - key.x0) * (key.black ? 0.85 : 0.7), yTop: lay.top, yBot: lay.top, color: keyColor(key), a: vel});
  emit((key.x0 + key.x1) / 2, lay.top, keyColor(key), REDUCED ? 2 : 6, 90, 0.5);
}
function pianoRelease(key, owner) {
  const d = PIANO.down.get(key.id); if (!d || d.owner !== owner) return;
  epRelease(d.n); PIANO.down.delete(key.id);
  for (const t of PIANO.trails) if (t.held === owner && t.key === key) t.held = null;
}
function pianoAllOff() { for (const d of PIANO.down.values()) epRelease(d.n); PIANO.down.clear(); PIANO.trails.forEach(t => { t.held = null; }); PIANO.tips.clear(); }
function pianoHands(hands) {
  const lay = pianoKeys(), alive = new Set();
  for (const h of hands) for (const ti of TIPS) {
    const id = h.key + ':' + ti, p = h.pts[ti]; alive.add(id);
    let st = PIANO.tips.get(id);
    if (!st) { st = {py: p.y, key: null, line: 0}; PIANO.tips.set(id, st); }
    const vy = (p.y - st.py) / h.hdt;
    if (!st.key) {
      // the black keys sit at the back: a fingertip that comes down on one plays it, otherwise the white key below
      let k = null, ln = 0;
      if (st.py < lay.top && p.y >= lay.top && vy > 40) { k = keyAt(lay, p.x, true) || keyAt(lay, p.x, false); ln = lay.top; }
      else if (st.py < lay.wtop && p.y >= lay.wtop && p.y < lay.bot && vy > 40) { k = keyAt(lay, p.x, false); ln = lay.wtop; }
      if (k) { st.key = k; st.line = ln; pianoPress(k, clamp(vy / 1400, 0.25, 1), id); }
    } else {
      const k = st.key;
      if (p.y < st.line - 12 || p.y > lay.bot + 60) { pianoRelease(k, id); st.key = null; }
      else if (p.x < k.x0 - 6 || p.x > k.x1 + 6) {
        pianoRelease(k, id); st.key = null;
        const nk = (p.y < lay.wtop && keyAt(lay, p.x, true)) || keyAt(lay, p.x, false);
        if (nk && p.y >= lay.top) { st.key = nk; st.line = lay.top; pianoPress(nk, 0.45, id); }
      }
    }
    st.py = p.y;
  }
  for (const [id, st] of PIANO.tips) if (!id.startsWith('kb:') && !id.startsWith('mouse') && !alive.has(id)) { if (st.key) pianoRelease(st.key, id); PIANO.tips.delete(id); }
}
function pianoPointer(p, phase) {
  const lay = pianoKeys();
  const at = p && p.y >= lay.top && p.y <= lay.bot ? ((p.y < lay.wtop && keyAt(lay, p.x, true)) || keyAt(lay, p.x, false)) : null;
  const cur = PIANO.mouseKey;
  if (phase === 'up') { if (cur) pianoRelease(cur, 'mouse'); PIANO.mouseKey = null; return; }
  if (at === cur) return;
  if (cur) pianoRelease(cur, 'mouse');
  PIANO.mouseKey = at;
  if (at) pianoPress(at, phase === 'down' ? 0.75 : 0.5, 'mouse');
}
const PIANO_WHITE = 'asdfghjkl;', PIANO_BLACK = {w: 0, e: 1, t: 3, y: 4, u: 5, o: 7, p: 8};
function pianoKey(k, down) {
  const lay = pianoKeys();
  let key = null; const wi = PIANO_WHITE.indexOf(k);
  if (wi >= 0) key = lay.whites[wi];
  else if (k in PIANO_BLACK) key = lay.blacks.find(b => b.id === 'b' + PIANO_BLACK[k]);
  if (!key) return;
  ensureAudio();
  if (down) pianoPress(key, 0.75, 'kb:' + k); else pianoRelease(key, 'kb:' + k);
}
function pianoFrame(dt) {
  const v = 150 * dt;
  for (const t of PIANO.trails) { t.yTop -= v; if (!t.held) t.yBot -= v; }
  PIANO.trails = PIANO.trails.filter(t => t.yBot > -20);
}
function drawPiano() {
  const lay = pianoKeys(), {whites, blacks, top, bot, x0, x1} = lay;
  ctx.globalCompositeOperation = 'lighter';
  for (const t of PIANO.trails) {
    const y0 = Math.max(t.yTop, -10), y1 = t.yBot; if (y1 - y0 < 1) continue;
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(t.color, 0.04)); g.addColorStop(1, rgba(t.color, 0.2 + 0.45 * t.a));
    ctx.fillStyle = g; rr(t.x - t.w / 2, y0, t.w, y1 - y0, 6); ctx.fill();
    ctx.fillStyle = whiten(t.color, 0.6); ctx.fillRect(t.x - t.w / 2 + 3, y0, t.w - 6, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(5,7,13,0.55)'; rr(x0 - 10, top - 10, x1 - x0 + 20, bot - top + 20, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(190,205,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = FONT(11); ctx.textAlign = 'center';
  for (const k of whites) {
    const on = PIANO.down.has(k.id), col = keyColor(k);
    if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(col, 0.5); rr(k.x0 + 2, k.y0, k.x1 - k.x0 - 4, k.y1 - k.y0, 5); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.strokeStyle = on ? whiten(col, 0.5) : 'rgba(236,239,248,0.32)'; ctx.lineWidth = on ? 2 : 1.2;
    rr(k.x0 + 2, k.y0, k.x1 - k.x0 - 4, k.y1 - k.y0, 5); ctx.stroke();
    if (k.midi % 12 === 0) { ctx.fillStyle = 'rgba(236,239,248,0.55)'; ctx.fillText('C' + (k.midi / 12 - 1), (k.x0 + k.x1) / 2, k.y1 - 10); }
  }
  for (const k of blacks) {
    const on = PIANO.down.has(k.id), col = keyColor(k);
    ctx.fillStyle = on ? rgba(col, 0.85) : 'rgba(9,11,20,0.96)'; rr(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, 4); ctx.fill();
    ctx.strokeStyle = on ? whiten(col, 0.6) : 'rgba(236,239,248,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,181,71,0.6)'; ctx.lineWidth = 1.4; line(x0 - 10, top, x1 + 10, top); ctx.setLineDash([]);
  ctx.textAlign = 'start'; ctx.fillStyle = 'rgba(236,239,248,0.55)'; ctx.fillText('push fingertips down through this line', x0, top - 16);
}

// ---------- harp: ten tuned strings ----------
const HARP = {strings: [], key: ''};
function buildHarp() {
  HARP.strings = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = W * (0.2 + 0.6 * t), top = H * (0.18 + 0.26 * t), bot = H * 0.86;
    HARP.strings.push({type: 'string', harp: true, a: {x, y: top}, b: {x, y: bot}, color: RAINBOW[i % 5], amp: 0, t0: 0, freq: NOTES[5 + i]});
  }
  HARP.key = W + 'x' + H;
}
function drawHarp(now) {
  const s = HARP.strings; if (!s.length) return;
  const x0 = s[0].a.x - 44, x1 = s[s.length - 1].a.x + 34, base = s[0].b.y + 12;
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x0, s[0].a.y - 30);
  for (const o of s) ctx.lineTo(o.a.x, o.a.y - 10);
  ctx.lineTo(x1, s[s.length - 1].a.y - 4); ctx.lineTo(x1, base); ctx.closePath();
  ctx.strokeStyle = 'rgba(255,181,71,0.18)'; ctx.lineWidth = 12; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,180,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = FONT(11); ctx.textAlign = 'center';
  for (const o of s) { drawString(o, now, false); ctx.fillStyle = 'rgba(236,239,248,0.5)'; ctx.fillText(noteName(o.freq), o.b.x, base + 18); }
  ctx.textAlign = 'start';
}

// ---------- the bridge game: a pin-jointed truss, solved with XPBD ----------
// Units are metres, tonnes, seconds and kilonewtons. The gap is always 16 m.
const SPAN = 16;
const STEEL = {tCap: 120, kBuckle: 1000, EA: 8000, massPerM: 0.03, maxRoad: 4, maxLen: 10, roadSlope: 0.36};
const TRUCK = {mass: [1.8, 1.8, 2.4], r: 0.45, base: 3.2, h: 1.25, speed: 3, start: -6.2};
const ANCHORS = [[-3, 0], [0, 0], [0, 2.5], [0, 5], [SPAN, 0], [SPAN, 2.5], [SPAN, 5], [SPAN + 3, 0]];
const BR = {phase: 'build', joints: [], members: [], groups: [], L: null, sim: null, result: null, best: null, speedUp: 1, msgT: 0, eng: null};
let bid = 0;
const buckleCap = L => Math.min(STEEL.tCap, STEEL.kBuckle / (L * L));
function bridgeLevel() {
  const tall = W < H * 0.9, gapL = W * (tall ? 0.1 : 0.23), gapR = W * (tall ? 0.9 : 0.77), deckY = H * (tall ? 0.5 : 0.56), pxm = (gapR - gapL) / SPAN;
  BR.L = {gapL, gapR, deckY, pxm, waterY: H * 0.92, waterM: (H * 0.92 - deckY) / pxm, key: W + 'x' + H};
}
const bpx = q => ({x: BR.L.gapL + q.x * BR.L.pxm, y: BR.L.deckY + q.y * BR.L.pxm});
const bmt = p => ({x: (p.x - BR.L.gapL) / BR.L.pxm, y: (p.y - BR.L.deckY) / BR.L.pxm});
function bridgeReset() {
  BR.joints = ANCHORS.map(([x, y]) => ({x, y, fixed: true, id: 'A' + (++bid)}));
  BR.members = []; BR.groups = []; BR.sim = null; BR.result = null; BR.phase = 'build';
}
function addJoint(x, y) { const j = {x, y, fixed: false, id: 'J' + (++bid)}; BR.joints.push(j); return j; }
function addMember(a, b) { const m = {a, b, L0: dist(a, b), road: Math.abs(b.y - a.y) <= STEEL.roadSlope * Math.abs(b.x - a.x), id: 'M' + (++bid)}; BR.members.push(m); return m; }
function memberBetween(a, b) { return BR.members.find(m => (m.a === a && m.b === b) || (m.a === b && m.b === a)); }
function pruneJoints() { const used = new Set(); for (const m of BR.members) { used.add(m.a); used.add(m.b); } BR.joints = BR.joints.filter(j => j.fixed || used.has(j)); }
const snapRadius = () => Math.max(0.55, 22 / BR.L.pxm);
function projT(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y; return clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); }
function nearJoint(v, R) { let best = null, bd = R; for (const j of BR.joints) { const d = dist(j, v); if (d < bd) { bd = d; best = j; } } return best; }
function nearMember(v, R) {
  let best = null, bt = 0, bd = R;
  for (const m of BR.members) { const d = segDist(v, m.a, m.b); if (d < bd) { const t = projT(v, m.a, m.b); if (t > 0.1 && t < 0.9) { bd = d; best = m; bt = t; } } }
  return best ? {m: best, t: bt} : null;
}
function snapJoint(v, rec, R = snapRadius()) {
  const j0 = nearJoint(v, R); if (j0) return j0;
  const hit = nearMember(v, R * 0.8);
  if (hit) {
    // landing on a beam splits it there, so the new beam is pinned to it
    const m = hit.m, j = addJoint(lerp(m.a.x, m.b.x, hit.t), lerp(m.a.y, m.b.y, hit.t));
    BR.members = BR.members.filter(x => x !== m);
    const h1 = addMember(m.a, j), h2 = addMember(j, m.b); h1.road = h2.road = m.road;
    rec.splits.push({orig: m, h1, h2, j});
    return j;
  }
  return addJoint(v.x, v.y);
}
function undoRec(rec) {
  BR.members = BR.members.filter(m => !rec.members.includes(m));
  for (const s of rec.splits.slice().reverse()) {
    const at = BR.members.filter(m => m.a === s.j || m.b === s.j);
    if (at.length === 2 && at.includes(s.h1) && at.includes(s.h2)) { BR.members = BR.members.filter(m => m !== s.h1 && m !== s.h2); BR.members.push(s.orig); }
  }
  pruneJoints();
}
function bridgeAddStroke(ptsPx) {
  if (BR.phase !== 'build' || !BR.L || ptsPx.length < 2) return 0;
  const pts = ptsPx.map(bmt);
  if (pathLen(pts) < 0.5) return 0;
  const verts = douglasPeucker(pts, Math.max(0.3, 10 / BR.L.pxm));
  const rec = {members: [], splits: []};
  let prev = null;
  verts.forEach((v, vi) => {
    const ends = vi === 0 || vi === verts.length - 1;
    const j = snapJoint(v, rec, snapRadius() * (ends ? 1.3 : 1));
    if (prev && j !== prev) {
      // a run that passes over existing joints is pinned to each of them
      const R = snapRadius() * 0.7;
      const via = BR.joints.filter(q => q !== prev && q !== j && segDist(q, prev, j) < R)
        .map(q => ({q, t: projT(q, prev, j)})).filter(o => o.t > 0.02 && o.t < 0.98).sort((a, b) => a.t - b.t).map(o => o.q);
      let a = prev;
      for (const b of via.concat([j])) { addRun(a, b, rec); a = b; }
    }
    prev = j;
  });
  if (rec.members.length) { BR.groups.push(rec); pruneJoints(); chime(NOTES[8]); }
  else undoRec(rec);
  renderBridgeCard();
  return rec.members.length;
}
function addRun(a0, b0, rec) {
  // the road needs a joint every 4 m; other beams stay whole up to 10 m (long ones are weak when pushed)
  const road = Math.abs(b0.y - a0.y) <= STEEL.roadSlope * Math.abs(b0.x - a0.x);
  const n = Math.max(1, Math.ceil(dist(a0, b0) / (road ? STEEL.maxRoad : STEEL.maxLen) - 1e-6));
  let a = a0;
  for (let k = 1; k <= n; k++) {
    const b = k === n ? b0 : addJoint(lerp(a0.x, b0.x, k / n), lerp(a0.y, b0.y, k / n));
    if (dist(a, b) > 0.25 && !memberBetween(a, b)) rec.members.push(addMember(a, b));
    a = b;
  }
}
function bridgeUndo() { if (BR.phase !== 'build') return; const rec = BR.groups.pop(); if (rec) undoRec(rec); renderBridgeCard(); }
function bridgeClear() { if (BR.phase !== 'build') return; bridgeReset(); renderBridgeCard(); }
function bridgeEraseAt(pPx, rPx) {
  if (BR.phase !== 'build') return;
  const p = bmt(pPx), r = rPx / BR.L.pxm, before = BR.members.length;
  BR.members = BR.members.filter(m => segDist(p, m.a, m.b) >= r);
  if (BR.members.length !== before) { pruneJoints(); emit(pPx.x, pPx.y, '#a98bff', 8, 120, 0.6); renderBridgeCard(); }
}
function bridgeExample() {
  if (BR.phase !== 'build') return;
  // a Warren truss under the road: 2 m panels, 2.5 m deep
  bridgeReset();
  const rec = {members: [], splits: []};
  const J = (x, y) => nearJoint({x, y}, 0.01) || addJoint(x, y);
  const M = (a, b) => rec.members.push(addMember(a, b));
  const top = [], bot = [];
  for (let i = 0; i <= 8; i++) top.push(J(i * 2, 0));
  for (let i = 0; i < 8; i++) bot.push(J(i * 2 + 1, 2.5));
  for (let i = 0; i < 8; i++) { M(top[i], top[i + 1]); M(top[i], bot[i]); M(bot[i], top[i + 1]); }
  for (let i = 0; i < 7; i++) M(bot[i], bot[i + 1]);
  M(J(0, 2.5), bot[0]); M(bot[7], J(SPAN, 2.5));
  BR.groups.push(rec); renderBridgeCard();
  toast('A Warren truss: triangles under the road');
}
const GROUND = [[{x: -60, y: 0}, {x: 0, y: 0}], [{x: 0, y: 0}, {x: 0, y: 80}], [{x: SPAN, y: 0}, {x: SPAN + 60, y: 0}], [{x: SPAN, y: 0}, {x: SPAN, y: 80}]];
function simBuild() {
  const P = [], idx = new Map();
  for (const j of BR.joints) { idx.set(j, P.length); P.push({x: j.x, y: j.y, px: j.x, py: j.y, m: 0.02, w: 0, fixed: j.fixed}); }
  const C = [];
  for (const m of BR.members) {
    const i = idx.get(m.a), k = idx.get(m.b), mass = STEEL.massPerM * m.L0;
    P[i].m += mass / 2; P[k].m += mass / 2;
    C.push({i, k, L0: m.L0, alpha: m.L0 / STEEL.EA, kind: 'member', road: m.road, mem: m, acc: 0, f: 0, fs: 0, u: 0});
  }
  for (const p of P) p.w = p.fixed ? 0 : 1 / p.m;
  const r = TRUCK.r, x0 = TRUCK.start;
  const T = [[x0, -r, TRUCK.mass[0]], [x0 + TRUCK.base, -r, TRUCK.mass[1]], [x0 + TRUCK.base * 0.45, -r - TRUCK.h, TRUCK.mass[2]]].map(([x, y, m]) => { P.push({x, y, px: x, py: y, m, w: 1 / m, truck: true}); return P.length - 1; });
  const rig = (i, k) => C.push({i, k, L0: dist(P[i], P[k]), alpha: 0, kind: 'truck'});
  rig(T[0], T[1]); rig(T[0], T[2]); rig(T[1], T[2]);
  BR.sim = {P, C, T, t: 0, acc: 0, roll: 0, lastX: x0, first: null, breaks: 0, peak: 0, peakKind: '', live: 0, liveKind: '', state: 'run', doneT: 0, slowT: 0, splashed: false};
}
function collide(q, a, b, r, dynamic) {
  // push a wheel out of a segment; a beam shares the push with its two joints by where the wheel sits
  const t = projT(q, a, b), cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
  let dx = q.x - cx, dy = q.y - cy; const d = Math.hypot(dx, dy);
  if (d >= r || d < 1e-9) return null;
  dx /= d; dy /= d;
  const pen = r - d;
  if (!dynamic) { q.x += dx * pen; q.y += dy * pen; return {x: dx, y: dy}; }
  const wa = a.w * (1 - t) * (1 - t), wb = b.w * t * t, sum = q.w + wa + wb;
  if (sum === 0) return null;
  const lam = pen / sum;
  q.x += dx * q.w * lam; q.y += dy * q.w * lam;
  a.x -= dx * a.w * (1 - t) * lam; a.y -= dy * a.w * (1 - t) * lam;
  b.x -= dx * b.w * t * lam; b.y -= dy * b.w * t * lam;
  return {x: dx, y: dy};
}
function simStep(dt) {
  const s = BR.sim, P = s.P, C = s.C, n = 20, h = dt / n, g = 9.81, wm = BR.L.waterM;
  for (const c of C) if (c.kind === 'member') c.acc = 0;
  for (let sub = 0; sub < n; sub++) {
    for (const p of P) {
      if (p.w === 0) continue;
      const damp = p.y > wm ? 0.97 : 0.9999;     // water slows anything that falls in
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g * h * h;
    }
    for (const c of C) {
      if (c.broken) continue;
      const a = P[c.i], b = P[c.k], ws = a.w + b.w; if (ws === 0) continue;
      const dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy) || 1e-9;
      const dl = -(L - c.L0) / (ws + c.alpha / (h * h));
      const nx = dx / L, ny = dy / L;
      a.x += a.w * dl * nx; a.y += a.w * dl * ny; b.x -= b.w * dl * nx; b.y -= b.w * dl * ny;
      if (c.kind === 'member') c.acc += -dl / (h * h);     // tension in kN, compression negative
    }
    for (let wi = 0; wi < 2; wi++) {
      const q = P[s.T[wi]]; let cn = null;
      for (const [A, B] of GROUND) cn = collide(q, A, B, TRUCK.r, false) || cn;
      for (const c of C) if (c.kind === 'member' && c.road && !c.broken) cn = collide(q, P[c.i], P[c.k], TRUCK.r + 0.08, true) || cn;
      if (cn && s.state === 'run') {
        // the engine: push the wheel along the surface toward the target speed
        let tx = -cn.y, ty = cn.x; if (tx < 0) { tx = -tx; ty = -ty; }
        const vt = ((q.x - q.px) * tx + (q.y - q.py) * ty) / h, dv = clamp(TRUCK.speed - vt, -6 * h, 6 * h);
        q.x += tx * dv * h; q.y += ty * dv * h;
      }
    }
  }
  for (const c of C) if (c.kind === 'member') c.f = c.acc / n;
  s.t += dt;
}
function breakMember(c, how, px) {
  const s = BR.sim, a = s.P[c.i], b = s.P[c.k];
  c.broken = how; s.breaks++;
  if (!s.first) { s.first = how; s.firstAt = {a: {x: a.x, y: a.y}, b: {x: b.x, y: b.y}, L: c.L0, f: c.fs, t: s.t, truck: s.P[s.T[0]].x}; }
  // the beam falls apart in two halves, each still hanging from its joint
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vx = (a.x - a.px + b.x - b.px) / 2, vy = (a.y - a.py + b.y - b.py) / 2;
  const nx = -(b.y - a.y) / c.L0, ny = (b.x - a.x) / c.L0, kink = how === 'buckle' ? 0.3 : 0;
  for (const end of [c.i, c.k]) {
    const e = s.P[end], q = {x: mx + nx * kink + (e.x - mx) * 0.08, y: my + ny * kink + (e.y - my) * 0.08, m: STEEL.massPerM * c.L0 / 4 + 0.01};
    q.px = q.x - vx; q.py = q.y - vy; q.w = 1 / q.m; s.P.push(q);
    s.C.push({i: end, k: s.P.length - 1, L0: dist(e, q), alpha: c.alpha, kind: 'debris'});
  }
  const p = bpx({x: mx, y: my});
  emit(p.x, p.y, how === 'buckle' ? '#ff5c8a' : '#4de1ff', REDUCED ? 6 : 30, 220, 0.9);
  crackSound(how);
  toast(how === 'buckle' ? 'A beam buckled' : 'A beam snapped');
}
function crackSound(how) {
  if (!S.sound || !AC) return;
  const t = AC.currentTime, n = noiseSrc(t, 0.4), f = how === 'buckle' ? filt('lowpass', 900) : filt('bandpass', 2600, 0.9), g = envGain(t, 0.7, 0.004, 0.3);
  n.connect(f); f.connect(g); out(g, 0.25);
  const o = AC.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  const og = envGain(t, 0.5, 0.004, 0.3); o.connect(og); out(og, 0); o.start(t); o.stop(t + 0.4);
}
function splashSound() {
  if (!S.sound || !AC) return;
  const t = AC.currentTime, n = noiseSrc(t, 1.2), f = filt('lowpass', 1100), g = envGain(t, 0.6, 0.02, 1.0);
  n.connect(f); f.connect(g); out(g, 0.3);
}
function engine(on) {
  if (!AC) return;
  if (on && !BR.eng && S.sound) {
    const o = AC.createOscillator(), f = filt('lowpass', 240), g = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = 46; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(master); o.start();
    g.gain.setTargetAtTime(0.06, AC.currentTime, 0.25); BR.eng = {o, g};
  } else if (!on && BR.eng) { const t = AC.currentTime; BR.eng.g.gain.setTargetAtTime(0, t, 0.15); BR.eng.o.stop(t + 0.8); BR.eng = null; }
}
function bridgeDrive() {
  if (!BR.members.length) { toast('Draw some beams first'); return; }
  ensureAudio();
  simBuild(); BR.phase = 'test'; BR.result = null; engine(true);
  renderBridgeCard();
}
function bridgeEdit() { engine(false); BR.phase = 'build'; BR.sim = null; BR.result = null; renderBridgeCard(); }
function bridgeEnter() { if (!BR.L || BR.L.key !== W + 'x' + H) bridgeLevel(); if (!BR.joints.length) bridgeReset(); }
function bridgeLeave() { if (BR.phase !== 'build') bridgeEdit(); }
function finishBridge(ok, reason) {
  const s = BR.sim; s.state = 'done'; s.doneT = s.t; BR.phase = 'done'; engine(false);
  const len = BR.members.reduce((a, m) => a + m.L0, 0);
  BR.result = {ok, reason, len, peak: s.peak, kind: s.peakKind, breaks: s.breaks, first: s.first, road: BR.members.some(m => m.road), onlyRoad: BR.members.every(m => m.road)};
  if (ok) {
    BR.best = BR.best == null ? len : Math.min(BR.best, len);
    chime(NOTES[10]); setTimeout(() => chime(NOTES[12]), 140); setTimeout(() => chime(NOTES[14]), 280);
    for (let i = 0; i < 50; i++) emit(W / 2 + (Math.random() - 0.5) * W * 0.6, H * 0.3, RAINBOW[i % 5], 1, 260, 1.4);
    say('It held!', true);
    setTimeout(() => captureShot(), 120);
  } else say(reason === 'stuck' ? 'The truck got stuck.' : 'The bridge failed.', true);
  renderBridgeCard();
}
function updateBridge(now, dt) {
  if (!BR.L || BR.L.key !== W + 'x' + H) bridgeLevel();
  const s = BR.sim; if (!s) return;
  if (s.state === 'done' && s.t - s.doneT > 6) return;
  s.acc += dt * BR.speedUp;
  let steps = 0;
  while (s.acc >= 1 / 60 && steps < 8) {
    simStep(1 / 60); s.acc -= 1 / 60; steps++;
    let live = 0, liveKind = '';
    for (const c of s.C) {
      if (c.kind !== 'member' || c.broken) continue;
      c.fs = s.t < 0.05 ? c.f : lerp(c.fs, c.f, 0.3);
      c.u = Math.abs(c.fs) / (c.fs >= 0 ? STEEL.tCap : buckleCap(c.L0));
      if (c.u > live) { live = c.u; liveKind = c.fs >= 0 ? 'pulled' : 'pushed'; }
      if (c.u > 1 && s.t > 0.25 && s.state === 'run') breakMember(c, c.fs >= 0 ? 'snap' : 'buckle');
    }
    s.live = Math.min(live, 1); s.liveKind = liveKind;
    if (s.state === 'run' && s.live > s.peak) { s.peak = s.live; s.peakKind = liveKind; }
    if (s.state !== 'run') continue;
    const R = s.P[s.T[0]], F = s.P[s.T[1]];
    s.roll += (R.x - s.lastX) / TRUCK.r; s.lastX = R.x;
    const speed = Math.hypot(R.x - R.px, R.y - R.py) * 60 * 20;
    s.slowT = speed < 0.2 && s.t > 2 ? s.slowT + 1 / 60 : 0;
    if (R.x > SPAN + 2.2 && Math.abs(R.y + TRUCK.r) < 0.6) finishBridge(true);
    else if (Math.max(R.y, F.y) > Math.min(BR.L.waterM, 10) - TRUCK.r) {
      if (!s.splashed) { s.splashed = true; const p = bpx(R); emit(p.x, BR.L.waterY, '#4de1ff', REDUCED ? 8 : 50, 260, 1.1); splashSound(); }
      finishBridge(false, 'fell');
    }
    else if (s.slowT > 3 || s.t > 30) finishBridge(false, 'stuck');
  }
  if (BR.phase === 'test' && now - BR.msgT > 200) {
    BR.msgT = now;
    bMsg.textContent = s.live > 0.02 ? `The hardest-working beam is at ${Math.round(s.live * 100)}% of its strength (${s.liveKind}).` : 'Driving onto the bridge…';
  }
}
const bcard = document.getElementById('bcard'), bMsg = document.getElementById('bMsg');
function renderBridgeCard() {
  const show = S.world === 'bridge';
  if (bcard.hidden === show) { bcard.hidden = !show; }
  if (!show) return;
  bcard.dataset.phase = BR.phase;
  bcard.querySelectorAll('[data-show]').forEach(b => { b.hidden = !b.dataset.show.split(' ').includes(BR.phase); });
  const n = BR.members.length, len = BR.members.reduce((a, m) => a + m.L0, 0);
  document.getElementById('bStats').textContent = `${n} beam${n === 1 ? '' : 's'} · ${len.toFixed(1)} m of steel`;
  document.getElementById('bBest').textContent = BR.best != null ? `Lightest that held: ${BR.best.toFixed(1)} m` : '';
  const title = document.getElementById('bTitle'), r = BR.result;
  bcard.classList.toggle('won', !!(r && r.ok)); bcard.classList.toggle('lost', !!(r && !r.ok));
  if (BR.phase === 'build') {
    title.textContent = 'Build a bridge the truck can cross';
    bMsg.textContent = n ? 'Flat beams are road. When it looks ready, drive the truck.' : 'Draw beams between the cliffs. Start and end on the rings to fix them to the rock.';
  } else if (BR.phase === 'test') {
    title.textContent = 'Testing…';
  } else if (r) {
    if (r.ok) {
      title.textContent = 'It held! The truck made it across.';
      bMsg.textContent = `${len.toFixed(1)} m of steel. The hardest-working beam reached ${Math.round(r.peak * 100)}% of its strength (${r.kind}).` + (r.breaks ? ` ${r.breaks} beam${r.breaks > 1 ? 's' : ''} broke on the way.` : ' Try it with less steel.');
    } else {
      title.textContent = r.reason === 'stuck' ? 'The truck got stuck' : 'The bridge failed';
      bMsg.textContent = r.reason === 'stuck' ? 'Something blocks the road. Keep steep beams off the driving line.'
        : !r.road ? 'There is no road. Draw flat beams from cliff to cliff first.'
        : r.onlyRoad ? 'A flat road on its own hangs like a chain: it sagged under the truck until a beam gave way. Hold it up with triangles underneath.'
        : r.first === 'buckle' ? 'A pushed beam buckled. Long beams in compression buckle first: make them shorter with more joints and triangles.'
        : r.first === 'snap' ? 'A pulled beam snapped. A deeper truss, with taller triangles, carries the same truck with smaller forces.'
        : 'The road folded under the truck. Beams joined in a line hinge at every joint: brace them with triangles.';
    }
  }
  measureAir();
}
bcard.addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  ensureAudio();
  const a = b.dataset.b;
  if (a === 'drive') bridgeDrive();
  else if (a === 'edit') bridgeEdit();
  else if (a === 'example') bridgeExample();
  else if (a === 'undo') bridgeUndo();
  else if (a === 'clear') bridgeClear();
  else if (a === 'leave') setWorld('draw');
});
function mix(a, b, t) { return mixHex(a, b, clamp(t, 0, 1)); }
function drawBeam(a, b, road, u, f, broken) {
  let col = '#eceff8', glow = 'rgba(169,139,255,0.22)';
  if (broken) { col = '#5a6178'; glow = null; }
  else if (BR.phase !== 'build' && u > 0.02) { const base = f >= 0 ? '#4de1ff' : '#ff5c8a'; col = mix('#eceff8', base, u * 1.5); glow = rgba(base, 0.12 + 0.4 * clamp(u, 0, 1)); }
  const w = (road ? 4.2 : 2.4) + (BR.phase !== 'build' ? 2 * clamp(u, 0, 1) : 0);
  ctx.lineCap = 'round';
  if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = glow; ctx.lineWidth = w * 3.2; line(a.x, a.y, b.x, b.y); ctx.globalCompositeOperation = 'source-over'; }
  ctx.strokeStyle = col; ctx.lineWidth = w; line(a.x, a.y, b.x, b.y);
  if (road && !broken) { ctx.strokeStyle = 'rgba(5,7,13,0.55)'; ctx.lineWidth = 1; line(a.x, a.y, b.x, b.y); }
}
function drawTruck(R, F, roll) {
  const px = BR.L.pxm, ang = Math.atan2(F.y - R.y, F.x - R.x);
  ctx.save(); ctx.translate(R.x, R.y); ctx.rotate(ang); ctx.scale(px, px);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const body = () => {
    ctx.beginPath();
    ctx.rect(-0.75, -1.4, 2.8, 0.9);                       // the load bed
    ctx.moveTo(2.15, -0.5); ctx.lineTo(2.15, -2.05); ctx.lineTo(3.15, -2.05); ctx.lineTo(3.85, -1.25); ctx.lineTo(3.85, -0.5); ctx.closePath();
    ctx.moveTo(2.35, -1.25); ctx.lineTo(2.35, -1.85); ctx.lineTo(3.05, -1.85); ctx.lineTo(3.5, -1.25); ctx.closePath();
    ctx.moveTo(-0.85, -0.5); ctx.lineTo(3.95, -0.5);
  };
  ctx.globalCompositeOperation = 'lighter';
  body(); ctx.strokeStyle = 'rgba(255,181,71,0.22)'; ctx.lineWidth = 0.32; ctx.stroke();
  ctx.strokeStyle = '#ffd59a'; ctx.lineWidth = 0.07; ctx.stroke();
  for (const x of [0, TRUCK.base]) {
    ctx.beginPath(); ctx.arc(x, 0, TRUCK.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,181,71,0.25)'; ctx.lineWidth = 0.28; ctx.stroke(); ctx.strokeStyle = '#ffd59a'; ctx.lineWidth = 0.07; ctx.stroke();
    for (let k = 0; k < 3; k++) { const a = roll + k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * TRUCK.r * 0.8, -Math.sin(a) * TRUCK.r * 0.8); ctx.lineTo(x + Math.cos(a) * TRUCK.r * 0.8, Math.sin(a) * TRUCK.r * 0.8); ctx.lineWidth = 0.05; ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,240,200,0.5)'; ctx.beginPath(); ctx.arc(3.85, -0.95, 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,213,154,0.85)'; ctx.font = '600 0.5px "Hanken Grotesk", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('6 t', 0.65, -0.78); ctx.textAlign = 'start';
  ctx.restore();
}
function drawBridge(now) {
  const L = BR.L; if (!L) return;
  const s = BR.sim;
  ctx.fillStyle = 'rgba(5,7,13,0.5)'; ctx.fillRect(0, 0, W, H);
  // water
  const grd = ctx.createLinearGradient(0, L.waterY, 0, H); grd.addColorStop(0, 'rgba(77,225,255,0.16)'); grd.addColorStop(1, 'rgba(77,225,255,0.02)');
  ctx.fillStyle = grd; ctx.fillRect(L.gapL, L.waterY, L.gapR - L.gapL, H - L.waterY);
  ctx.strokeStyle = 'rgba(77,225,255,0.5)'; ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 1 - k * 0.3; ctx.beginPath();
    for (let x = L.gapL; x <= L.gapR; x += 8) { const y = L.waterY + k * 9 + Math.sin(x / 34 + now / 600 + k) * 2.2; x === L.gapL ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the cliffs, hatched like ground on a structural drawing
  for (const side of [0, 1]) {
    const x0 = side ? L.gapR : 0, x1 = side ? W : L.gapL;
    ctx.fillStyle = 'rgba(14,19,34,0.94)'; ctx.fillRect(x0, L.deckY, x1 - x0, H - L.deckY);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, L.deckY, x1 - x0, H - L.deckY); ctx.clip();
    ctx.strokeStyle = 'rgba(236,239,248,0.07)'; ctx.lineWidth = 1;
    for (let k = x0 - (H - L.deckY); k < x1; k += 14) line(k, L.deckY, k + (H - L.deckY), H);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,181,71,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
    if (side) { ctx.moveTo(L.gapR, H); ctx.lineTo(L.gapR, L.deckY); ctx.lineTo(W, L.deckY); } else { ctx.moveTo(0, L.deckY); ctx.lineTo(L.gapL, L.deckY); ctx.lineTo(L.gapL, H); }
    ctx.stroke();
  }
  // the span, dimensioned
  const dy = L.deckY - 3.4 * L.pxm;
  ctx.strokeStyle = 'rgba(236,239,248,0.3)'; ctx.lineWidth = 1;
  line(L.gapL, dy, L.gapR, dy); line(L.gapL, dy - 6, L.gapL, dy + 6); line(L.gapR, dy - 6, L.gapR, dy + 6);
  ctx.fillStyle = 'rgba(236,239,248,0.55)'; ctx.font = FONT(11); ctx.textAlign = 'center';
  ctx.fillRect(W / 2 - 22, dy - 8, 44, 16); ctx.fillStyle = '#05070d'; ctx.fillText('16 m', W / 2, dy + 4); ctx.textAlign = 'start';
  // beams and joints
  if (s) {
    for (const c of s.C) {
      if (c.kind === 'truck') continue;
      if (c.kind === 'debris') { drawBeam(bpx(s.P[c.i]), bpx(s.P[c.k]), false, 0, 0, true); continue; }
      if (!c.broken) drawBeam(bpx(s.P[c.i]), bpx(s.P[c.k]), c.road, c.u, c.fs, false);
    }
  } else for (const m of BR.members) drawBeam(bpx(m.a), bpx(m.b), m.road, 0, 0, false);
  const jpos = s ? s.P.slice(0, BR.joints.length) : BR.joints;
  BR.joints.forEach((j, i) => {
    const p = bpx(jpos[i]);
    if (j.fixed) {
      // a pin support: a ring with a small wedge into the rock
      const onFace = j.y > 0.01, dir = j.x <= 0 ? -1 : 1;
      ctx.fillStyle = 'rgba(255,181,71,0.25)'; ctx.beginPath();
      if (onFace) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dir * 12, p.y - 8); ctx.lineTo(p.x + dir * 12, p.y + 8); } else { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 8, p.y + 12); ctx.lineTo(p.x + 8, p.y + 12); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = '#eceff8'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(5,7,13,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    }
  });
  // the truck
  if (s) drawTruck(bpx(s.P[s.T[0]]), bpx(s.P[s.T[1]]), s.roll);
  else drawTruck(bpx({x: TRUCK.start, y: -TRUCK.r}), bpx({x: TRUCK.start + TRUCK.base, y: -TRUCK.r}), 0);
}
function drawSnapHints() {
  if (S.world !== 'bridge' || BR.phase !== 'build' || !BR.L) return;
  const pens = S.lastHands.map(h => h.pen).filter(Boolean);
  if (S.mode === 'mouse' && mouse.pos) pens.push(mouse.pos);
  for (const p of pens) {
    const v = bmt(p), j = nearJoint(v, snapRadius());
    ctx.strokeStyle = 'rgba(236,239,248,0.9)'; ctx.lineWidth = 2;
    if (j) { const q = bpx(j); ctx.beginPath(); ctx.arc(q.x, q.y, 13, 0, Math.PI * 2); ctx.stroke(); continue; }
    const hit = nearMember(v, snapRadius() * 0.8);
    if (hit) { const q = bpx({x: lerp(hit.m.a.x, hit.m.b.x, hit.t), y: lerp(hit.m.a.y, hit.m.b.y, hit.t)}); ctx.beginPath(); ctx.moveTo(q.x, q.y - 8); ctx.lineTo(q.x + 8, q.y); ctx.lineTo(q.x, q.y + 8); ctx.lineTo(q.x - 8, q.y); ctx.closePath(); ctx.stroke(); }
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
  renderGuide();
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
// straight lines count too (they snap to arrows, but a sun's rays or a cat's whiskers are part of the drawing)
function guessStrokes() { return S.objects.filter(o => o.type === 'stroke' && !o.isTwin && !o.bridge && o.pts.length > 1); }
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
  if (!G.model || now - G.lastRun < 300 || !(S.guess || GAME.on) || S.world !== 'draw') return;
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
  const show = !GAME.on && S.guess && S.world === 'draw' && G.top.length > 0;
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
  if (S.world !== 'draw') setWorld('draw');
  GAME.on = true; GAME.round = 0; GAME.score = 0; GAME.results = [];
  GAME.keep = {snap: S.snap, arrows: S.arrows}; S.snap = false; S.arrows = false; syncDock();
  endEl.hidden = true; gameEl.hidden = false;
  document.getElementById('gameGuess').textContent = 'Loading the guesser…';
  loadGuesser().then(() => nextRound()).catch(() => { stopGame(); toast('The guesser could not load. Check the connection.'); });
}
function nextRound() {
  clearTimeout(GAME.timer);
  if (!GAME.on) return;
  clearAll(false, false); G.sig = ''; G.top = [];
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
document.getElementById('endDone').addEventListener('click', () => { endEl.hidden = true; clearAll(false, false); });

// ---------- dock (mouse and fingertip) ----------
const dock = document.getElementById('dock');
const DWELL_MS = 600;
// anything marked data-air can be pressed by holding a fingertip on it: the bar, the ring, the bridge buttons
dock.querySelectorAll('.btn').forEach(b => { b.dataset.air = ''; });
let airRects = [], panelRects = [], airT = 0;
function measureAir() {
  airRects = [...document.querySelectorAll('[data-air]')].map(el => ({el, r: el.getBoundingClientRect(), ms: Number(el.dataset.dwell) || DWELL_MS})).filter(d => d.r.width > 0 && d.r.height > 0);
  panelRects = [...document.querySelectorAll('.dock, .bcard, .game')].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
}
const measureDock = measureAir;
window.addEventListener('resize', measureAir);
dock.addEventListener('scroll', measureAir, {passive: true});
function inUI(p) {
  if (!p) return false;
  if (RING.open && Math.hypot(p.x - RING.x, p.y - RING.y) < RING.r + 56) return true;
  return panelRects.some(r => p.x > r.left - 10 && p.x < r.right + 10 && p.y > r.top - 10 && p.y < r.bottom + 10);
}
function updateDwell(h, now) {
  const target = ((!h.down || inUI(h.pen)) && h.tip) ? airRects.find(d => h.tip.x >= d.r.left && h.tip.x <= d.r.right && h.tip.y >= d.r.top && h.tip.y <= d.r.bottom) : null;
  h.airEl = target ? target.el : null;
  if (!target) { h.dwell = null; h.dwellDone = null; return; }
  if (h.dwellDone === target.el) return;
  if (!h.dwell || h.dwell.el !== target.el) h.dwell = {el: target.el, t0: now, ms: target.ms};
  if (now - h.dwell.t0 > h.dwell.ms) {
    h.dwellDone = target.el; h.dwell = null;
    if (target.el.getClientRects().length) target.el.click();
  }
}
function markAir() {
  const on = new Set(S.lastHands.map(h => h.airEl).filter(Boolean));
  airRects.forEach(d => d.el.classList.toggle('air', on.has(d.el)));
}
function activate(b) {
  ensureAudio();
  if (b.dataset.color) { S.color = b.dataset.color; }
  else if (b.dataset.brush) { S.brush = b.dataset.brush; }
  else if (b.dataset.toggle) {
    S[b.dataset.toggle] = !S[b.dataset.toggle]; toast(`${b.getAttribute('aria-label')}: ${S[b.dataset.toggle] ? 'on' : 'off'}`);
    if (b.dataset.toggle === 'guess') { G.sig = ''; renderGuess(); if (S.guess) loadGuesser().catch(() => toast('The guesser could not load. Check the connection.')); }
  }
  else if (b.dataset.action === 'undo') undo();
  else if (b.dataset.action === 'clear') { if (S.world === 'bridge') bridgeClear(); else { clearAll(true); toast('Cleared. Undo brings it back'); } }
  else if (b.dataset.action === 'menu') { RING.open ? closeRing() : openRing(W / 2, H / 2); }
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
  const mb = dock.querySelector('[data-action="menu"]'); if (mb) mb.setAttribute('aria-pressed', String(S.world !== 'draw'));
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
  try { drawScene(now, true); } finally { ctx = realCtx; }
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
window.addEventListener('keydown', e => { if (e.key === 'Escape') { lightbox.hidden = true; closeRing(); } });

// ---------- mouse and touch ----------
let mouse = {down: false, stroke: null, prev: null, pos: null, shiftStart: null, erasing: false, grab: null};
cv.addEventListener('pointerdown', e => {
  ensureAudio(); cv.setPointerCapture(e.pointerId);
  const p = {x: e.clientX, y: e.clientY};
  mouse.down = true; mouse.pos = p; mouse.prev = p;
  if (RING.open) { closeRing(); mouse.down = false; return; }
  const w = S.world;
  if (w === 'piano') { pianoPointer(p, 'down'); return; }
  if (w === 'drums') { const i = padAt(p); if (i >= 0) hitPad(i, 0.8); return; }
  if (w === 'theremin') { THER.mouse = p; return; }
  if (w === 'harp') return;
  if (w === 'bridge' && BR.phase !== 'build') return;
  if (w === 'draw' && e.altKey) { const o = hitObject(p, 26); if (o) { settle(o); mouse.grab = {o, start: p, orig: snapshot(o)}; return; } }
  if (w === 'draw' && e.shiftKey) { mouse.shiftStart = p; S.liveString = {type: 'string', a: p, b: p, color: pickColor(), amp: 0, t0: 0, freq: 0}; return; }
  if (w === 'draw' && mouse.erasing) { eraseAt(p, 30); return; }
  mouse.stroke = newStroke(pickColor(), p.x, p.y);
});
cv.addEventListener('pointermove', e => {
  const p = {x: e.clientX, y: e.clientY};
  mouse.prev = mouse.pos; mouse.pos = p;
  const w = S.world;
  if (w === 'harp') { pluckAcross(HARP.strings, mouse.prev, p); return; }
  if (w === 'piano') { if (mouse.down) pianoPointer(p, 'move'); return; }
  if (w === 'theremin') { if (mouse.down) THER.mouse = p; return; }
  if (w === 'drums') return;
  if (mouse.grab) { const dx = p.x - mouse.grab.start.x, dy = p.y - mouse.grab.start.y; applyTransform(mouse.grab.o, mouse.grab.orig, q => ({x: q.x + dx, y: q.y + dy})); return; }
  if (!mouse.down) { if (w === 'draw') checkPluck(mouse.prev, p); return; }
  if (mouse.shiftStart && S.liveString) { S.liveString.b = p; return; }
  if (mouse.erasing && w === 'draw') { eraseAt(p, 30); return; }
  if (mouse.stroke) addPoint(mouse.stroke, p.x, p.y);
});
function pointerEnd() {
  if (S.world === 'piano') pianoPointer(mouse.pos, 'up');
  THER.mouse = null;
  if (mouse.grab) { remember({type: 'move', obj: mouse.grab.o, before: mouse.grab.orig}); mouse.grab = null; }
  if (mouse.shiftStart && S.liveString) { const s = makeString(S.liveString.a, S.liveString.b, S.liveString.color); if (s) pluck(s, 10, 0.5); S.liveString = null; }
  if (mouse.stroke) finishStroke(mouse.stroke);
  mouse.down = false; mouse.stroke = null; mouse.shiftStart = null;
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
// Alt + wheel over a shape resizes it
cv.addEventListener('wheel', e => {
  if (S.world !== 'draw' || !e.altKey) return;
  const p = {x: e.clientX, y: e.clientY}, o = hitObject(p, 26); if (!o) return;
  e.preventDefault(); settle(o);
  const before = snapshot(o), k = Math.exp(-e.deltaY * 0.0015);
  applyTransform(o, before, q => ({x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k}));
  remember({type: 'move', obj: o, before});
}, {passive: false});
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('button, input, a')) { if (e.key === ' ' || e.key === 'Enter') return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((e.metaKey || e.ctrlKey) && k === 'z') { undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (S.world === 'piano') { if (!e.repeat) pianoKey(k, true); return; }
  if (S.world === 'drums') { if (!e.repeat && k >= '1' && k <= '6') { ensureAudio(); hitPad(Number(k) - 1, 0.85); } return; }
  if (S.world !== 'draw' && S.world !== 'bridge') return;
  if (k === 'e' && S.world === 'draw') mouse.erasing = true;
  if (k === 'c') { if (S.world === 'bridge') bridgeClear(); else { clearAll(true); toast('Cleared. Undo brings it back'); } }
  if (k === 'z' && !e.shiftKey) undo();
});
window.addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'e') mouse.erasing = false;
  if (S.world === 'piano') pianoKey(k, false);
});

// ---------- guide ----------
const guide = document.getElementById('guide'), gBtn = document.getElementById('guideToggle');
let guideWasMin = false;
function setGuideMin(min) { guide.classList.toggle('min', min); gBtn.textContent = min ? 'show' : 'hide'; gBtn.setAttribute('aria-expanded', String(!min)); }
gBtn.addEventListener('click', () => setGuideMin(!guide.classList.contains('min')));

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
  if (startWorld === 'bridge') setWorld('bridge');
  else if (startWorld === 'ring') openRing(W / 2, H / 2);
  startWorld = null;
}
let startWithGame = false, startWorld = null;
document.getElementById('startMusic').addEventListener('click', () => { startWorld = 'ring'; startCamera(); });
document.getElementById('startBridge').addEventListener('click', () => { startWorld = 'bridge'; startCamera(); });
document.getElementById('startGame').addEventListener('click', () => { startWithGame = true; startCamera(); });
document.querySelectorAll('input[name="drawWith"]').forEach(r => r.addEventListener('change', () => { if (r.checked) setDrawMode(r.value); }));
try { const m = localStorage.getItem('hava.drawMode'); if (m) setDrawMode(m); } catch (e) {}

const MOUSE_HINT = {
  draw: 'drag to draw, Shift-drag for a string, Alt-drag to move, hold E to erase',
  theremin: 'hold the button and move up and down', drums: 'click a drum or press 1 to 6',
  piano: 'click the keys or type A to ;', harp: 'move across the strings', bridge: 'drag to draw beams',
};
function setStatus() {
  const dot = document.getElementById('dot'), txt = document.getElementById('statusText');
  const lead = S.world === 'draw' ? '' : `<b>${WORLDS[S.world].label}</b> · `;
  if (S.mode === 'camera' || S.mode === 'sim') {
    const n = S.lastHands.length;
    dot.classList.toggle('on', n > 0);
    txt.innerHTML = lead + (n ? `${n} hand${n > 1 ? 's' : ''}` + (S.world === 'draw' ? ` · ${S.objects.length} lights` : '') : 'show your hands to the camera');
  } else {
    dot.classList.remove('on');
    txt.innerHTML = (lead || '<b>Mouse</b> · ') + MOUSE_HINT[S.world];
  }
}

// ---------- test hook: feed hands without a camera (?sim) ----------
const SIM = new URLSearchParams(location.search).has('sim');
window.HAVA = {S, simHands: [], recognize};
if (SIM) { S.mode = 'sim'; intro.hidden = true; }
Object.assign(window.HAVA, {G, GAME, loadGuesser, classify, setDrawMode, startGame, stopGame, sketchPixels,
  setWorld, openRing, closeRing, RING, undo, hitObject, GR, THER, DRUM, PADS, padGeom, PIANO, pianoKeys, HARP, BR, STEEL, bridgeAddStroke, bridgeExample, bridgeDrive, bridgeEdit, bridgeLevel, bpx, ensureAudio});

// ---------- one picture of the scene, for the screen and for pictures ----------
function drawScene(now, clean) {
  drawBackground();
  const w = S.world;
  if (w === 'bridge') drawBridge(now);
  // drawings stay in place but step back while an instrument plays
  if (w !== 'draw' && w !== 'bridge') ctx.globalAlpha = 0.25;
  for (const o of S.objects) {
    if (w === 'bridge' ? !o.bridge : o.bridge) continue;
    o.type === 'string' ? drawString(o, now, false) : drawStroke(o, now);
  }
  ctx.globalAlpha = 1;
  drawWorld(now);
  if (S.liveString) drawString(S.liveString, now, true);
  if (clean) return;
  if (w === 'draw') drawGrabs(now);
  drawParticles();
  drawHands(now);
  drawSnapHints();
  if (mouse.erasing && mouse.pos && w === 'draw') { ctx.strokeStyle = 'rgba(236,239,248,0.6)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(mouse.pos.x, mouse.pos.y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
}

// ---------- main loop ----------
renderWorldUI();
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
  runGuess(now); gameTick(now);
  worldFrame(now, dt);
  updateParticles(dt);
  drawScene(now, false);
  markAir();
  if (now - airT > 250) { measureAir(); airT = now; }
  if (now - statusT > 300) { setStatus(); statusT = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
