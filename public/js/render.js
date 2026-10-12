// The pixel pipeline. Docs carry no pixels; render.js turns a doc into a
// canvas: it loads assets (platform files via the same-origin proxy, demo
// art drawn procedurally), applies per-layer light/colour/filter maths on
// ImageData (no ctx.filter — Safari), then composes layers.
'use strict';

export const FONT_FAMILIES = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Trebuchet MS", "Verdana", sans-serif',
  mono: 'ui-monospace, "Courier New", monospace',
  display: '"Arial Black", Impact, sans-serif',
};

// ── Demo art ─────────────────────────────────────────────────────────────
const demoCache = new Map();
export function demoArt(key, w, h) {
  const k = key + '@' + w + 'x' + h;
  if (demoCache.has(k)) return demoCache.get(k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const sky = (a, b) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); };
  const sun = (cx, cy, r, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, col + '00'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  const hill = (yy, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, yy); for (let i = 0; i <= 8; i++) x.quadraticCurveTo(w * (i - 0.25) / 8, yy + (i % 2 ? -h * 0.06 : h * 0.05), w * i / 8, yy + (i % 2 ? 0 : h * 0.02)); x.lineTo(w, h); x.lineTo(0, h); x.fill(); };
  if (key === 'sunset') {
    sky('#ff9e6d', '#5b3a8f'); sun(w * 0.5, h * 0.55, Math.max(w, h) * 0.35, '#ffd43b');
    hill(h * 0.62, '#3a2a5e'); hill(h * 0.78, '#241a3e');
  } else if (key === 'lake') {
    sky('#8ecae6', '#d7f0fa'); sun(w * 0.72, h * 0.2, w * 0.14, '#fff3c4');
    hill(h * 0.45, '#5f8f6b'); hill(h * 0.6, '#3d6b4f');
    x.fillStyle = '#2a5d7c'; x.fillRect(0, h * 0.72, w, h * 0.28);
    x.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) x.fillRect(w * 0.05 * (i + 2), h * (0.76 + i * 0.035), w * 0.22, h * 0.008);
  } else if (key === 'cafe') {
    x.fillStyle = '#f4e3d0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c98a5e'; x.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.5);
    x.fillStyle = '#6f4a2f'; x.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.06);
    x.fillStyle = '#3e2723';
    x.beginPath(); x.arc(w * 0.5, h * 0.42, h * 0.13, 0, 7); x.fill();
    x.fillStyle = '#f4e3d0'; x.beginPath(); x.arc(w * 0.5, h * 0.42, h * 0.1, 0, 7); x.fill();
    x.fillStyle = '#a47551'; x.fillRect(w * 0.3, h * 0.72, w * 0.4, h * 0.14);
  } else if (key === 'bakery') {
    sky('#ffe8c8', '#ffd9a8');
    x.fillStyle = '#d9825f';
    x.beginPath(); x.roundRect(w * 0.18, h * 0.2, w * 0.64, h * 0.5, w * 0.05); x.fill();
    x.fillStyle = '#fff1dd';
    x.beginPath(); x.roundRect(w * 0.24, h * 0.3, w * 0.52, h * 0.3, w * 0.03); x.fill();
    x.fillStyle = '#b3552f';
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(w * (0.3 + i * 0.1), h * 0.45, w * 0.03, 0, 7); x.fill(); }
  } else if (key === 'leaf') {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#95d5b2';
    x.beginPath();
    x.moveTo(w * 0.5, h * 0.05);
    x.bezierCurveTo(w * 1.05, h * 0.3, w * 1.05, h * 0.7, w * 0.5, h * 0.95);
    x.bezierCurveTo(w * -0.05, h * 0.7, w * -0.05, h * 0.3, w * 0.5, h * 0.05);
    x.fill();
    x.strokeStyle = '#2d6a4f'; x.lineWidth = Math.max(2, w * 0.02);
    x.beginPath(); x.moveTo(w * 0.5, h * 0.08); x.lineTo(w * 0.5, h * 0.92); x.stroke();
    for (let i = 1; i <= 4; i++) {
      const yy = h * (0.15 + i * 0.17);
      x.beginPath(); x.moveTo(w * 0.5, yy); x.lineTo(w * 0.18, yy + h * 0.09); x.stroke();
      x.beginPath(); x.moveTo(w * 0.5, yy); x.lineTo(w * 0.82, yy + h * 0.09); x.stroke();
    }
  } else { // blossom
    sky('#ffe5f0', '#ffd6e8');
    x.fillStyle = '#c41670';
    for (let i = 0; i < 9; i++) {
      const cx = w * (0.12 + (i % 3) * 0.36), cy = h * (0.2 + Math.floor(i / 3) * 0.32);
      for (let p = 0; p < 5; p++) {
        const a = p * Math.PI * 2 / 5 - Math.PI / 2;
        x.beginPath(); x.arc(cx + Math.cos(a) * w * 0.055, cy + Math.sin(a) * w * 0.055, w * 0.045, 0, 7); x.fill();
      }
      x.fillStyle = '#ffd43b'; x.beginPath(); x.arc(cx, cy, w * 0.02, 0, 7); x.fill();
      x.fillStyle = '#c41670';
    }
  }
  demoCache.set(k, c);
  return c;
}

// ── Asset loading ────────────────────────────────────────────────────────
// assets: { key: {url} | {demo} } resolved into canvases by loadAssets.
export async function loadAssets(assets) {
  const out = {};
  for (const key of Object.keys(assets || {})) {
    const a = assets[key];
    try {
      if (a.demo) {
        out[key] = { canvas: demoArt(a.demo, a.w, a.h), w: a.w, h: a.h };
      } else if (a.url) {
        const img = new Image();
        img.src = '/api/image?src=' + encodeURIComponent(a.url);
        await img.decode();
        out[key] = { canvas: img, w: a.w, h: a.h };
      } else if (a.blobUrl) {
        const img = new Image();
        img.src = a.blobUrl;
        await img.decode();
        out[key] = { canvas: img, w: a.w, h: a.h };
      }
    } catch { /* missing asset: layer draws nothing */ }
  }
  return out;
}

// ── Per-layer pixel maths ────────────────────────────────────────────────
function applyAdjust(d, adj) {
  if (!adj) return;
  const b = adj.brightness || 0, c = adj.contrast || 0,
    s = adj.saturation || 0, w = adj.warmth || 0;
  if (!b && !c && !s && !w) return;
  const cf = (259 * (c * 2.55 + 255)) / (255 * (259 - c * 2.55));
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], bl = px[i + 2];
    if (b) { r += b * 2.55; g += b * 2.55; bl += b * 2.55; }
    if (c) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; bl = cf * (bl - 128) + 128; }
    if (w) { r += w * 0.6; bl -= w * 0.6; }
    if (s) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      const k = 1 + s / 100;
      r = l + (r - l) * k; g = l + (g - l) * k; bl = l + (bl - l) * k;
    }
    px[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    px[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    px[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
  }
}

const FILTER_FNS = {
  Vivid: (px) => { const l = 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
    for (let i = 0; i < 3; i++) px[i] = clamp(l + (px[i] - l) * 1.5); },
  Warm: (px) => { px[0] = clamp(px[0] + 30); px[2] = clamp(px[2] - 24); },
  Cool: (px) => { px[0] = clamp(px[0] - 24); px[2] = clamp(px[2] + 30); },
  Mono: (px) => { const l = 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
    px[0] = px[1] = px[2] = l; },
  Sepia: (px) => { const r = px[0], g = px[1], b = px[2];
    px[0] = clamp(0.393 * r + 0.769 * g + 0.189 * b);
    px[1] = clamp(0.349 * r + 0.686 * g + 0.168 * b);
    px[2] = clamp(0.272 * r + 0.534 * g + 0.131 * b); },
  Fade: (px) => { for (let i = 0; i < 3; i++) px[i] = clamp(px[i] * 0.8 + 40); },
  Noir: (px) => { const l = clamp((0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2] - 128) * 1.35 + 118);
    px[0] = px[1] = px[2] = l; },
};
const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

export function applyFilter(d, name, amount) {
  const fn = FILTER_FNS[name];
  if (!fn || !amount) return;
  const t = amount / 100;
  const px = d.data;
  const orig = new Uint8ClampedArray(px);
  for (let i = 0; i < px.length; i += 4) {
    fn(px.subarray(i, i + 3));
    for (let c = 0; c < 3; c++) px[i + c] = orig[i + c] * (1 - t) + px[i + c] * t;
  }
}

export function autoFixData(d) {
  const px = d.data;
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const total = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    hist[0][px[i]]++; hist[1][px[i + 1]]++; hist[2][px[i + 2]]++;
  }
  const lo = [], hi = [];
  for (let c = 0; c < 3; c++) {
    let acc = 0, l = 0, h = 255;
    for (let v = 0; v < 256; v++) { acc += hist[c][v]; if (acc >= total * 0.005) { l = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[c][v]; if (acc >= total * 0.005) { h = v; break; } }
    lo[c] = l; hi[c] = Math.max(h, l + 8);
  }
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) px[i + c] = clamp((px[i + c] - lo[c]) * 255 / (hi[c] - lo[c]));
  }
}

// A processed copy of one source canvas at one size, cached by signature.
const procCache = new Map();
export function processImage(src, w, h, layer) {
  const adj = layer.adjust || {}, f = layer.filter || {};
  const sig = [layer.id, w, h, adj.brightness, adj.contrast, adj.saturation,
    adj.warmth, f.name, f.amount, layer.autoFix ? 1 : 0].join('|');
  let c = procCache.get(sig);
  if (c) return c;
  if (procCache.size > 24) procCache.clear();
  c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0, w, h);
  if (layer.autoFix) {
    const d = x.getImageData(0, 0, w, h);
    autoFixData(d); x.putImageData(d, 0, 0);
  }
  const d = x.getImageData(0, 0, w, h);
  applyAdjust(d, adj); applyFilter(d, f.name, f.amount);
  x.putImageData(d, 0, 0);
  procCache.set(sig, c);
  return c;
}

// ── Composition ──────────────────────────────────────────────────────────
export function renderDoc(doc, canvas, opts) {
  const scale = (opts && opts.scale) || 1;
  const assets = (opts && opts.assets) || {};
  canvas.width = Math.max(1, Math.round(doc.width * scale));
  canvas.height = Math.max(1, Math.round(doc.height * scale));
  const x = canvas.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, canvas.width, canvas.height);
  if (doc.background) {
    x.fillStyle = doc.background;
    x.fillRect(0, 0, canvas.width, canvas.height);
  }
  x.scale(scale, scale);
  for (const l of doc.layers) {
    if (l.visible === false) continue;
    x.save();
    x.globalAlpha = (l.opacity == null ? 100 : l.opacity) / 100;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    x.translate(cx, cy);
    if (l.rotation) x.rotate(l.rotation * Math.PI / 180);
    if (l.flipX || l.flipY) x.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    if (l.type === 'image') {
      const a = assets[l.asset];
      if (a && a.canvas) {
        x.drawImage(processImage(a.canvas, a.w, a.h, l), -l.w / 2, -l.h / 2, l.w, l.h);
      }
    } else if (l.type === 'text') {
      x.translate(-l.w / 2, -l.h / 2);
      drawText(x, l);
    } else {
      x.fillStyle = l.color;
      if (l.shape === 'rect') {
        x.beginPath();
        const r = Math.min(l.radius || 0, l.w / 2, l.h / 2);
        x.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, r);
        x.fill();
      } else {
        x.beginPath(); x.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, 7); x.fill();
      }
    }
    x.restore();
  }
}

export function drawText(x, l) {
  x.translate(l.w / 2, l.h / 2);
  if (l.shadow) {
    x.shadowColor = 'rgba(0,0,0,0.45)';
    x.shadowBlur = l.size * 0.12;
    x.shadowOffsetY = l.size * 0.04;
  }
  x.fillStyle = l.color;
  x.font = (l.bold ? '700 ' : '400 ') + l.size + 'px ' + FONT_FAMILIES[l.font];
  x.textAlign = l.align;
  x.textBaseline = 'middle';
  const lines = String(l.text).split('\n');
  const lh = l.size * 1.15;
  const y0 = -((lines.length - 1) * lh) / 2;
  lines.forEach((t, i) => x.fillText(t, 0, y0 + i * lh));
}

// Measure the box a text layer needs, given a 2d context for fonts.
export function measureText(ctx, l) {
  ctx.font = (l.bold ? '700 ' : '400 ') + l.size + 'px ' + FONT_FAMILIES[l.font];
  const lines = String(l.text).split('\n');
  let w = 0;
  for (const t of lines) w = Math.max(w, ctx.measureText(t).width);
  const h = lines.length * l.size * 1.15;
  return { w: Math.ceil(w) + 8, h: Math.ceil(h) };
}

export function textBBox(l) {
  const c = textBBox._ctx || (textBBox._ctx = document.createElement('canvas').getContext('2d'));
  return measureText(c, l);
}

// Small raster of a whole doc, for tiles and filmstrip frames.
export function thumbnail(doc, maxPx) {
  const s = Math.min(maxPx / doc.width, maxPx / doc.height);
  const c = document.createElement('canvas');
  renderDoc(doc, c, { scale: s });
  return c.toDataURL('image/png');
}
