// The editor: canvas, tool panels, history filmstrip, autosave, export.
'use strict';

import { FORMATS } from './formats.js';
import { EDITOR_TOOLS } from './tools.js';
import { renderDoc, loadAssets, processImage, autoFixData, textBBox, FONT_FAMILIES } from './render.js';
import { STARTERS } from './formats.js';

let A; // app helpers { api, toast, openSheet, timeAgo, TOKEN, DEMO, renderCurrent, pickPhoto, ctx }

export function mountEditor(appHelpers) {
  A = appHelpers;
  A.editorApi = { addPhotoLayer };
  const routes = appHelpers.routes || (appHelpers.routes = []);
  routes.push([/^#\/edit\/(\d+)$/, (id) => openExisting(id)]);
  routes.push([/^#\/edit\/new\/photo\/(.+)$/, (name) => openNewPhoto(decodeURIComponent(name))]);
  routes.push([/^#\/edit\/new\/tpl\/(\d+)$/, (id) => openFromTemplate(id)]);
  routes.push([/^#\/edit\/new\/(.+)$/, (rest) => openBlank(rest)]);
}

// ── State ────────────────────────────────────────────────────────────────
let doc, projId, projName, format, history, histIndex, assets, selId, panel, saving, dirty;
let canvas, cctx, stageEl, view, filmEl, saveEl, undoBtn, redoBtn;
let workScale = 1;

const $ = (sel, el) => (el || document).querySelector(sel);

function newId() { return 'l' + Math.random().toString(36).slice(2, 9); }

function blankDoc(w, h, background) {
  return { v: 1, width: w, height: h, background: background === undefined ? null : background, assets: {}, layers: [] };
}

// ── Entry points ─────────────────────────────────────────────────────────
async function openExisting(id) {
  let p;
  try { p = await A.api('/api/projects/' + id); }
  catch { A.toast("That project could not be opened."); location.hash = '#/projects'; return; }
  start(p.id, p.name, p.format, p.doc, p.history || [], p.history_index ?? (p.history || []).length - 1);
}

async function openFromTemplate(id) {
  let list;
  try { list = await A.api('/api/templates'); } catch { list = { templates: [] }; }
  const t = (list.templates || []).find((x) => String(x.id) === id);
  if (!t || !t.doc) { A.toast('That template could not be opened.'); location.hash = '#/templates'; return; }
  start(null, t.name, t.format, clone(t.doc), [{ kind: 'start', label: 'Start', doc: clone(t.doc) }], 0);
}

async function openBlank(rest) {
  const parts = rest.split('/');
  let d, name = 'Untitled', fmt = null, toolId = null;
  const clampSize = (n) => Math.min(8192, Math.max(16, n || 0));
  if (parts[0] === 'blank') {
    if (parts[1] === 'custom') {
      d = blankDoc(clampSize(+parts[2]), clampSize(+parts[3]));
      name = 'Custom size';
      toolId = parts[4];
    } else {
      const f = FORMATS.find((x) => x.id === parts[1]) || FORMATS[0];
      d = blankDoc(f.w, f.h);
      name = f.name;
      toolId = parts[2];
    }
  } else {
    const s = STARTERS.find((x) => x.id === parts[0]);
    if (!s) { A.toast('That starter could not be opened.'); location.hash = '#/'; return; }
    d = clone(s.doc);
    name = s.name || 'Untitled';
  }
  start(null, name, fmt, d, [{ kind: 'start', label: 'Start', doc: clone(d) }], 0);
  if (toolId) setTimeout(() => showPanel(toolId), 0);
}

async function openNewPhoto(name) {
  const asset = window.__pendingAsset;
  window.__pendingAsset = null;
  if (!asset) { location.hash = '#/'; return; }
  const d = blankDoc(asset.w, asset.h);
  d.assets.photo = asset.url ? asset : { blobUrl: asset.blobUrl, w: asset.w, h: asset.h };
  d.layers = [{
    id: newId(), type: 'image', asset: 'photo', x: 0, y: 0, w: asset.w, h: asset.h,
    rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    filter: { name: 'Original', amount: 0 },
  }];
  start(null, name || 'Photo', null, d, [{ kind: 'photo', label: 'Photo', doc: clone(d) }], 0);
  // An uploaded photo is already a project: save it now rather than waiting
  // for the first edit. A blob photo is saved by pendingBlobUpload instead.
  markDirty();
  scheduleSave();
  if (asset.pendingUpload) pendingBlobUpload(asset);
}

async function pendingBlobUpload(asset) {
  try {
    const stored = await window.usernode.uploadFile(asset.pendingUpload, { visibility: 'public' });
    if (!doc || doc.assets.photo !== asset) return;
    doc.assets.photo = { url: stored.url, fileId: stored.id, w: asset.w, h: asset.h };
    assets = await loadAssets(doc.assets);
    markDirty();
    scheduleSave();
  } catch (e) {
    console.error('[studio] photo upload failed', e);
    // Same offer as the Home path; outside Homeroom there is nothing to
    // retry against, so the plain line stays.
    if (window.usernode && window.usernode.uploadFile) {
      A.toast(A.uploadErrorText(e), 10000, {
        label: 'Retry',
        onClick: () => {
          A.toast('Uploading photo…');
          pendingBlobUpload(asset);
        },
      });
    } else {
      A.toast('The photo could not be uploaded. Try again.');
    }
  }
}

const clone = (o) => JSON.parse(JSON.stringify(o));

function start(id, name, fmt, d, hist, idx) {
  projId = id; projName = name || 'Untitled'; format = fmt;
  doc = d; history = hist || []; histIndex = idx == null ? history.length - 1 : idx;
  if (!history.length) { history = [{ kind: 'start', label: 'Start', doc: clone(doc) }]; histIndex = 0; }
  selId = null; panel = null; dirty = false; saving = false;
  window.__editorOpen = true;
  buildView();
  loadAssets(doc.assets).then((a) => { assets = a; paint(); });
  paint();
}

// ── View construction ────────────────────────────────────────────────────
function buildView() {
  view = document.querySelector('[data-view]');
  document.querySelector('[data-tabbar]').hidden = true;
  document.querySelector('[data-new-project]').hidden = true;
  view.replaceChildren();
  view.className = 'flex flex-1 flex-col px-0 pb-2 pt-0';
  view.hidden = false;

  const head = document.createElement('div');
  head.className = 'flex items-center gap-2 border-b border-line px-3 py-2';
  const back = document.createElement('button');
  back.className = 'btn-secondary text-small'; back.textContent = '← Back';
  back.addEventListener('click', leave);
  const nameB = document.createElement('button');
  nameB.className = 'min-w-0 flex-1 truncate text-left text-body font-medium';
  nameB.textContent = projName;
  nameB.addEventListener('click', async () => {
    const n = prompt('Project name', projName);
    if (n != null && n.trim()) { projName = n.trim().slice(0, 120); nameB.textContent = projName; scheduleSave(); }
  });
  saveEl = document.createElement('span');
  saveEl.className = 'text-small text-muted'; saveEl.textContent = 'Saved';
  const exportB = document.createElement('button');
  exportB.className = 'btn-primary flex-none text-small'; exportB.textContent = 'Export';
  exportB.addEventListener('click', exportSheet);
  head.append(back, nameB, saveEl, exportB);

  stageEl = document.createElement('div');
  stageEl.className = 'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-stage';
  canvas = document.createElement('canvas');
  canvas.dataset.editorCanvas = '';
  canvas.className = 'max-h-full max-w-full touch-none';
  stageEl.append(canvas);

  const bar = document.createElement('div');
  bar.className = 'flex items-center gap-1 border-t border-line px-2 py-1';
  undoBtn = iconBtn('↶', 'Undo (Ctrl+Z)', () => jump(histIndex - 1));
  redoBtn = iconBtn('↷', 'Redo (Shift+Ctrl+Z)', () => jump(histIndex + 1));
  const filmWrap = document.createElement('div');
  filmWrap.className = 'min-w-0 flex-1';
  filmEl = document.createElement('div');
  filmEl.dataset.filmstrip = '';
  filmEl.className = 'filmstrip overflow-x-auto';
  filmWrap.append(filmEl);
  const stepEl = document.createElement('span');
  stepEl.className = 'flex-none text-small text-muted';
  stepEl.dataset.stepLabel = '';
  bar.append(undoBtn, filmWrap, redoBtn, stepEl);

  const toolsBar = document.createElement('div');
  toolsBar.className = 'flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5';
  EDITOR_TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'btn-secondary flex-none text-small'; b.textContent = t.label;
    b.dataset.toolBtn = t.id;
    b.addEventListener('click', () => showPanel(t.id));
    toolsBar.append(b);
  });

  const panelHost = document.createElement('div');
  panelHost.dataset.panelHost = '';
  panelHost.className = 'min-h-0 overflow-y-auto border-t border-line bg-surface px-3 py-2';

  view.append(head, stageEl, bar, toolsBar, panelHost);

  const aiIdeas = document.createElement('button');
  aiIdeas.className = 'btn-secondary fixed bottom-24 right-4 z-20 rounded-full px-4 text-small';
  aiIdeas.textContent = '✎ Text ideas';
  aiIdeas.addEventListener('click', () => A.ctx.openAiText(doc.layers.find((l) => l.type === 'text')?.text || '', ));
  stageEl.after(aiIdeas);

  bindCanvas();
  window.addEventListener('keydown', keys);
  window.addEventListener('resize', fit);
  paint();
}

function iconBtn(glyph, label, fn) {
  const b = document.createElement('button');
  b.className = 'btn-secondary flex-none px-3'; b.textContent = glyph;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', fn);
  return b;
}

function leave() {
  window.__editorOpen = false;
  window.removeEventListener('keydown', keys);
  window.removeEventListener('resize', fit);
  document.querySelector('[data-tabbar]').hidden = false;
  document.querySelector('[data-new-project]').hidden = false;
  view.className = 'flex-1 px-4 pb-24 pt-4';
  flushSave().finally(() => A.renderCurrent());
  location.hash = history.length && location.hash.startsWith('#/edit/') ? '#/' : '#/';
}

// ── Painting ─────────────────────────────────────────────────────────────
function fit() {
  if (!stageEl) return;
  const pad = 24;
  const w = stageEl.clientWidth - pad, h = stageEl.clientHeight - pad;
  if (w <= 0 || h <= 0) return;
  workScale = Math.min(w / doc.width, h / doc.height);
  paint();
}

let paintQueued = false;
function paint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; doPaint(); });
}

function doPaint() {
  if (!canvas) return;
  renderDoc(doc, canvas, { scale: workScale, assets: assets || {} });
  const px = doc.width * workScale;
  canvas.style.width = px + 'px';
  canvas.style.height = doc.height * workScale + 'px';
  paintMarks();
  paintFilm();
  updateButtons();
  const step = $('[data-step-label]');
  if (step) step.textContent = 'Step ' + (histIndex + 1) + ' of ' + history.length;
}

function paintMarks() {
  stageEl.querySelectorAll('.crop-mark').forEach((n) => n.remove());
  const corners = ['border-l border-t -top-px -left-px', 'border-r border-t -top-px -right-px', 'border-l border-b -bottom-px -left-px', 'border-r border-b -bottom-px -right-px'];
  corners.forEach((cls) => {
    const m = document.createElement('span');
    m.className = 'crop-mark ' + cls;
    stageEl.append(m);
  });
}

function paintFilm() {
  if (!filmEl) return;
  filmEl.replaceChildren();
  history.forEach((e, i) => {
    const f = document.createElement('button');
    f.className = 'film-frame h-10 w-14 flex-none px-1 text-small ' +
      (i === histIndex ? 'film-now' : i < histIndex ? 'film-past' : 'opacity-30');
    f.textContent = e.label || e.kind;
    f.title = 'Step ' + (i + 1) + ': ' + (e.label || e.kind);
    f.addEventListener('click', () => jump(i));
    filmEl.append(f);
    if (i === histIndex) setTimeout(() => f.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 0);
  });
}

function updateButtons() {
  undoBtn.disabled = histIndex <= 0;
  redoBtn.disabled = histIndex >= history.length - 1;
  document.querySelectorAll('[data-tool-btn]').forEach((b) => {
    b.classList.toggle('btn-primary', b.dataset.toolBtn === panel);
    b.classList.toggle('btn-secondary', b.dataset.toolBtn !== panel);
  });
  const host = $('[data-panel-host]');
  if (host && panel) {
    if (host.dataset.panel !== panel) { host.dataset.panel = panel; buildPanel(host, panel); }
  } else if (host) {
    host.replaceChildren();
    delete host.dataset.panel;
  }
}

// ── History ──────────────────────────────────────────────────────────────
const HIST_MAX = 50;
function commit(kind, label, d) {
  doc = d || clone(doc);
  history = history.slice(0, histIndex + 1);
  history.push({ kind, label, doc: clone(doc) });
  if (history.length > HIST_MAX) { history.shift(); }
  histIndex = history.length - 1;
  markDirty();
  scheduleSave();
  paint();
}

function jump(i) {
  if (i < 0 || i >= history.length) return;
  histIndex = i;
  doc = clone(history[i].doc);
  selId = null;
  markDirty();
  scheduleSave();
  loadAssets(doc.assets).then((a) => { assets = a; paint(); });
  paint();
}

function markDirty() { dirty = true; setSaveState('dirty'); }
function setSaveState(s) {
  if (!saveEl) return;
  saveEl.textContent = s === 'saving' ? 'Saving…' : s === 'saved' ? 'Saved' :
    s === 'dirty' ? 'Saving…' : 'Not saved';
  saveEl.className = 'text-small ' + (s === 'error' ? 'text-danger' : 'text-muted');
  if (s === 'dirty') saveEl.textContent = 'Saving…';
  if (s === 'error') {
    saveEl.textContent = 'Not saved';
    const retry = document.createElement('button');
    retry.className = 'underline'; retry.textContent = 'Retry';
    retry.addEventListener('click', scheduleSave);
    saveEl.append(' ', retry);
  }
}

// ── Autosave ─────────────────────────────────────────────────────────────
let saveTimer = null, saveSeq = 0;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, 1200);
}

async function flushSave() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!dirty || !doc) return;
  if (!A.TOKEN) { setSaveState('guest'); saveEl.textContent = 'Not saved: sign in to Homeroom to keep projects'; return; }
  if (Object.values(doc.assets).some((a) => a && a.blobUrl)) {
    // a photo is still uploading; pendingBlobUpload re-saves once it lands
    return;
  }
  const seq = ++saveSeq;
  setSaveState('saving');
  const body = { name: projName, doc, history: history.slice(-30), historyIndex: histIndex };
  try {
    if (projId == null) {
      const r = await A.api('/api/projects', { method: 'POST', body: { ...body, format: format || undefined } });
      projId = r.id;
      window.history.replaceState(null, '', '#/edit/' + projId);
    } else {
      await A.api('/api/projects/' + projId, { method: 'PUT', body });
    }
    if (seq === saveSeq) { dirty = false; setSaveState('saved'); uploadThumb(); }
  } catch (e) {
    if (seq === saveSeq) { dirty = true; setSaveState('error'); setTimeout(scheduleSave, 3000); }
  }
}

let thumbBusy = false, thumbNeeded = false;
function uploadThumb() {
  if (projId == null || !A.TOKEN) return;
  if (thumbBusy) { thumbNeeded = true; return; }
  thumbBusy = true;
  const c = document.createElement('canvas');
  const s = Math.min(480 / doc.width, 480 / doc.height, 1);
  renderDoc(doc, c, { scale: s, assets: assets || {} });
  c.toBlob(async (blob) => {
    try {
      if (window.usernode && usernode.uploadFile) {
        const old = (await A.api('/api/projects/' + projId)).thumb_file_id;
        const f = await usernode.uploadFile(blob, { visibility: 'public' });
        await A.api('/api/projects/' + projId, { method: 'PUT', body: { thumbUrl: f.url, thumbFileId: f.id } });
        if (old && usernode.deleteFile) usernode.deleteFile(old).catch(() => {});
      }
    } catch {} finally {
      thumbBusy = false;
      if (thumbNeeded) { thumbNeeded = false; uploadThumb(); }
    }
  }, 'image/jpeg', 0.8);
}

// ── Selection & pointer ──────────────────────────────────────────────────
function selLayer() { return doc.layers.find((l) => l.id === selId) || null; }

function hitTest(px, py) {
  const x = px / workScale, y = py / workScale;
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i];
    if (l.visible === false) continue;
    const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
    const a = -(l.rotation || 0) * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a) + cx;
    const ly = dx * Math.sin(a) + dy * Math.cos(a) + cy;
    if (lx >= l.x && lx <= l.x + l.w && ly >= l.y && ly <= l.y + l.h) return l;
  }
  return null;
}

function bindCanvas() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (panel === 'crop') return;
    const r = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
    selId = hit ? hit.id : null;
    if (hit) drag = { id: hit.id, sx: e.clientX, sy: e.clientY, ox: hit.x, oy: hit.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
    paint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const l = selLayer();
    if (!l) return;
    const dx = (e.clientX - drag.sx) / workScale, dy = (e.clientY - drag.sy) / workScale;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    drag.moved = true;
    l.x = Math.round(drag.ox + dx); l.y = Math.round(drag.oy + dy);
    paint();
  });
  const endDrag = () => {
    if (drag && drag.moved) {
      const before = history[histIndex];
      commit('move', 'Move');
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

function keys(e) {
  if (e.target.matches('input, textarea, select')) return;
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    jump(histIndex + (e.shiftKey ? 1 : -1));
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
    e.preventDefault();
    deleteLayer(selId);
  } else if (selId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const l = selLayer(); if (!l) return;
    const d = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') l.x -= d;
    if (e.key === 'ArrowRight') l.x += d;
    if (e.key === 'ArrowUp') l.y -= d;
    if (e.key === 'ArrowDown') l.y += d;
    paint(); scheduleSave();
  }
}

// ── Tool panels ──────────────────────────────────────────────────────────
function showPanel(id) { panel = panel === id ? null : id; updateButtons(); }

function buildPanel(host, id) {
  host.replaceChildren();
  const mk = () => document.createElement('div');
  if (id === 'crop') buildCrop(host);
  else if (id === 'rotate') buildRotate(host);
  else if (id === 'adjust') buildAdjust(host);
  else if (id === 'filters') buildFilters(host);
  else if (id === 'text') buildText(host);
  else if (id === 'layers') buildLayers(host);
  else if (id === 'resize') buildResize(host);
  else if (id === 'ai') buildAiPanel(host);
}

function row(labelText, input) {
  const d = document.createElement('div');
  d.className = 'slider-row';
  const head = document.createElement('div');
  head.className = 'slider-head';
  const lab = document.createElement('span'); lab.textContent = labelText;
  const val = document.createElement('span'); val.className = 'slider-val';
  head.append(lab, val);
  d.append(head, input);
  const update = () => { val.textContent = input.value; };
  input.addEventListener('input', update); update();
  return d;
}

function slider(min, max, value, step) {
  const s = document.createElement('input');
  s.type = 'range'; s.min = min; s.max = max; s.step = step || 1; s.value = value;
  return s;
}

function buildCrop(host) {
  const head = document.createElement('p');
  head.className = 'text-small text-muted mb-2';
  head.textContent = 'Drag the handles, or pick a ratio. Cropping resizes the canvas around the photo.';
  host.append(head);
  const ratios = [['Free', null], ['Original', null], ['1:1', 1], ['4:5', 0.8], ['16:9', 16 / 9], ['9:16', 9 / 16]];
  const seg = document.createElement('div');
  seg.className = 'segmented mb-3';
  ratios.forEach(([label], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (!i) b.classList.add('seg-on');
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.remove('seg-on'));
      b.classList.add('seg-on');
      applyRatio(label === 'Original' ? doc.layers[0] && doc.width / doc.height : ratios[i][1]);
    });
    seg.append(b);
  });
  host.append(seg);
  const apply = document.createElement('button');
  apply.className = 'btn-primary w-full'; apply.textContent = 'Apply crop';
  apply.addEventListener('click', applyCrop);
  host.append(apply);
  crop = crop || { x: 0, y: 0, w: doc.width, h: doc.height };
  drawCropOverlay();
}

let crop = null;
function applyRatio(ratio) {
  const w = doc.width, h = doc.height;
  if (!ratio) { crop = { x: 0, y: 0, w, h }; }
  else {
    let cw = w, ch = Math.round(w / ratio);
    if (ch > h) { ch = h; cw = Math.round(h * ratio); }
    crop = { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: cw, h: ch };
  }
  drawCropOverlay();
}

function drawCropOverlay() {
  if (!crop) return;
  const c = document.createElement('div');
  c.dataset.cropBox = '';
  c.style.cssText = 'position:absolute;border:2px solid rgb(var(--focus));pointer-events:none;';
  const r = canvas.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
  c.style.left = (r.left - sr.left + crop.x * workScale) + 'px';
  c.style.top = (r.top - sr.top + crop.y * workScale) + 'px';
  c.style.width = crop.w * workScale + 'px';
  c.style.height = crop.h * workScale + 'px';
  stageEl.append(c);
}

function applyCrop() {
  if (!crop) { panel = null; updateButtons(); return; }
  const d = clone(doc);
  d.width = Math.max(16, crop.w); d.height = Math.max(16, crop.h);
  d.layers.forEach((l) => { l.x -= crop.x; l.y -= crop.y; });
  crop = null;
  stageEl.querySelectorAll('[data-crop-box]').forEach((n) => n.remove());
  commit('crop', 'Crop', d);
  fit();
  panel = null; updateButtons();
}

function buildRotate(host) {
  const g = document.createElement('div');
  g.className = 'flex flex-wrap gap-2';
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'btn-secondary text-small'; b.textContent = label;
    b.addEventListener('click', fn); g.append(b);
  };
  btn('Turn left', () => quarter(-1));
  btn('Turn right', () => quarter(1));
  btn('Flip horizontal', () => flip('flipX'));
  btn('Flip vertical', () => flip('flipY'));
  host.append(g);
  const l = selLayer() || doc.layers.find((x) => x.type === 'image');
  if (l) {
    const s = slider(-45, 45, l.rotation || 0, 0.5);
    host.append(row('Straighten ' + (selLayer() ? '' : '(applies to the photo)'), s));
    s.addEventListener('change', () => {
      l.rotation = parseFloat(s.value);
      commit(selLayer() ? 'rotate' : 'rotate', 'Straighten');
    });
    s.addEventListener('input', () => { l.rotation = parseFloat(s.value); paint(); });
  }
}

function quarter(dir) {
  const d = clone(doc);
  const W = d.width, H = d.height;
  d.width = H; d.height = W;
  d.layers.forEach((l) => {
    const nx = dir > 0 ? H - (l.y + l.h) : l.y;
    const ny = dir > 0 ? l.x : W - (l.x + l.w);
    l.x = nx; l.y = ny;
    const tw = l.w; l.w = l.h; l.h = tw;
    l.rotation = ((l.rotation || 0) + dir * 90 + 360) % 360;
  });
  commit('rotate', dir > 0 ? 'Rotate' : 'Rotate', d);
  fit();
}

function flip(key) {
  const l = selLayer() || doc.layers.find((x) => x.type === 'image');
  if (!l) return;
  l[key] = !l[key];
  commit('rotate', 'Flip');
}

function buildAdjust(host) {
  const l = selLayer() || doc.layers.find((x) => x.type === 'image');
  if (!l || l.type !== 'image') {
    host.append(msg('Select the photo layer to adjust it.'));
    return;
  }
  if (!l.adjust) l.adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  const sliders = [
    ['Brightness', 'brightness', -100, 100],
    ['Contrast', 'contrast', -100, 100],
    ['Saturation', 'saturation', -100, 100],
    ['Warmth', 'warmth', -100, 100],
  ];
  let lastCommit = null;
  sliders.forEach(([label, key, min, max]) => {
    const s = slider(min, max, l.adjust[key] || 0);
    host.append(row(label, s));
    s.addEventListener('input', () => { l.adjust[key] = +s.value; paint(); });
    s.addEventListener('change', () => {
      const now = Date.now();
      const same = lastCommit && now - lastCommit < 4000 && key === lastCommit.key &&
        (label === 'Warmth' ? 'colour' : 'light') === lastCommit.kind2;
      lastCommit = { key, kind2: label === 'Warmth' ? 'colour' : 'light', at: now };
      commit(label === 'Warmth' ? 'colour' : 'light', label);
    });
  });
  const auto = document.createElement('button');
  auto.className = 'btn-secondary mt-2 w-full text-small'; auto.textContent = 'Auto fix';
  auto.addEventListener('click', () => {
    l.autoFix = true;
    if (assets && assets[l.asset]) {
      const a = assets[l.asset];
      const c = document.createElement('canvas');
      c.width = a.w; c.height = a.h;
      c.getContext('2d').drawImage(a.canvas, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, a.w, a.h);
      autoFixData(d);
      c.getContext('2d').putImageData(d, 0, 0);
      assets[l.asset] = { canvas: c, w: a.w, h: a.h };
      l.autoFix = false;
    }
    commit('auto', 'Auto fix');
  });
  host.append(auto);
}

function msg(text) {
  const d = document.createElement('p');
  d.className = 'text-small text-muted';
  d.textContent = text;
  return d;
}

const FILTER_NAMES = ['Original', 'Vivid', 'Warm', 'Cool', 'Mono', 'Sepia', 'Fade', 'Noir'];
function buildFilters(host) {
  const l = selLayer() || doc.layers.find((x) => x.type === 'image');
  if (!l || l.type !== 'image') { host.append(msg('Select the photo layer to filter it.')); return; }
  if (!l.filter) l.filter = { name: 'Original', amount: 0 };
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-4 gap-2';
  FILTER_NAMES.forEach((name) => {
    const cell = document.createElement('button');
    cell.className = 'flex flex-col items-center gap-1';
    const prev = document.createElement('canvas');
    prev.width = 96; prev.height = 96;
    prev.className = 'rounded-lg border border-line' + (l.filter.name === name ? ' ring-2 ring-focus' : '');
    cell.append(prev);
    const cap = document.createElement('span');
    cap.className = 'text-small'; cap.textContent = name;
    cell.append(cap);
    if (assets && assets[l.asset]) {
      const a = assets[l.asset];
      const fake = { id: l.id + '|' + name, adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }, filter: { name, amount: 100 } };
      const pc = processImage(a.canvas, 96, 96, fake);
      prev.getContext('2d').drawImage(pc, 0, 0);
    }
    cell.addEventListener('click', () => {
      l.filter = { name, amount: name === 'Original' ? 0 : (l.filter.amount || 60) };
      commit('filter', name);
      buildPanel($('[data-panel-host]'), 'filters');
    });
    grid.append(cell);
  });
  host.append(grid);
  if (l.filter.name !== 'Original') {
    const s = slider(0, 100, l.filter.amount || 60);
    host.append(row('Intensity', s));
    s.addEventListener('input', () => { l.filter.amount = +s.value; paint(); });
    s.addEventListener('change', () => commit('filter', l.filter.name));
  }
}

function buildText(host) {
  const addB = document.createElement('button');
  addB.className = 'btn-primary mb-2 w-full text-small'; addB.textContent = 'Add text';
  addB.addEventListener('click', () => addText());
  host.append(addB);
  const sel = selLayer() && selLayer().type === 'text' ? selLayer() : null;
  if (!sel) { host.append(msg('Tap a text layer on the canvas to edit it.')); return; }
  const ta = document.createElement('textarea');
  ta.className = 'field min-h-20 mb-2'; ta.maxLength = 500;
  ta.value = sel.text;
  host.append(ta);
  let commitTimer = null;
  const commitText = () => { clearTimeout(commitTimer); commit('text', 'Text'); };
  ta.addEventListener('input', () => {
    sel.text = ta.value;
    resizeTextBox(sel);
    paint();
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commitText, 800);
  });
  ta.addEventListener('blur', commitText);
  const fonts = document.createElement('div');
  fonts.className = 'segmented mb-2';
  [['sans', 'Sans'], ['serif', 'Serif'], ['rounded', 'Rounded'], ['mono', 'Mono'], ['display', 'Display']].forEach(([id, label], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (sel.font === id) b.classList.add('seg-on');
    b.addEventListener('click', () => {
      sel.font = id;
      fonts.querySelectorAll('button').forEach((x) => x.classList.remove('seg-on'));
      b.classList.add('seg-on');
      resizeTextBox(sel); commit('text', 'Text');
    });
    fonts.append(b);
  });
  host.append(fonts);
  const s = slider(8, 600, sel.size);
  host.append(row('Size', s));
  s.addEventListener('input', () => { sel.size = +s.value; resizeTextBox(sel); paint(); });
  s.addEventListener('change', () => commit('text', 'Text'));
  const color = document.createElement('input');
  color.type = 'color'; color.value = sel.color;
  color.className = 'h-11 w-16 rounded-lg border border-line bg-surface';
  host.append(row('Colour', color));
  color.addEventListener('change', () => { sel.color = color.value; commit('text', 'Text'); });
}

function resizeTextBox(l) {
  const b = textBBox(l);
  l.w = b.w; l.h = b.h;
}

function addText() {
  const l = {
    id: newId(), type: 'text', text: 'Your text', font: 'sans', size: Math.round(doc.width / 12),
    bold: true, color: '#16171a', align: 'center', shadow: false,
    x: Math.round(doc.width * 0.1), y: Math.round(doc.height * 0.4), w: 100, h: 50,
    rotation: 0, opacity: 100, visible: true,
  };
  resizeTextBox(l);
  l.x = Math.round((doc.width - l.w) / 2); l.y = Math.round((doc.height - l.h) / 2);
  doc.layers.push(l);
  selId = l.id;
  commit('text', 'Text');
  buildPanel($('[data-panel-host]'), 'text');
}

function buildLayers(host) {
  const addPhoto = document.createElement('button');
  addPhoto.className = 'btn-secondary mb-2 w-full text-small'; addPhoto.textContent = 'Add photo layer';
  addPhoto.addEventListener('click', () => {
    addPhotoLayerNext = true;
    A.pickPhoto(null);
  });
  host.append(addPhoto);
  const shapes = document.createElement('div');
  shapes.className = 'mb-2 flex gap-2';
  const rect = document.createElement('button');
  rect.className = 'btn-secondary flex-1 text-small'; rect.textContent = '+ Rectangle';
  rect.addEventListener('click', () => addShape('rect'));
  const ell = document.createElement('button');
  ell.className = 'btn-secondary flex-1 text-small'; ell.textContent = '+ Ellipse';
  ell.addEventListener('click', () => addShape('ellipse'));
  shapes.append(rect, ell);
  host.append(shapes);
  const list = document.createElement('div');
  list.className = 'flex flex-col gap-1';
  [...doc.layers].reverse().forEach((l) => {
    const r = document.createElement('div');
    r.className = 'flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1' +
      (l.id === selId ? ' ring-2 ring-focus' : '');
    const eye = document.createElement('button');
    eye.className = 'flex h-9 w-9 items-center justify-center text-muted';
    eye.textContent = l.visible === false ? '—' : '●';
    eye.setAttribute('aria-label', 'Show or hide layer');
    eye.addEventListener('click', () => { l.visible = l.visible === false; commit('layer', 'Layer'); });
    const name = document.createElement('button');
    name.className = 'min-w-0 flex-1 truncate text-left text-small';
    name.textContent = layerName(l);
    name.addEventListener('click', () => { selId = l.id; paint(); buildPanel($('[data-panel-host]'), 'layers'); });
    const up = document.createElement('button');
    up.className = 'flex h-9 w-9 items-center justify-center text-muted';
    up.textContent = '↑';
    up.setAttribute('aria-label', 'Move layer up');
    up.addEventListener('click', () => moveLayer(l, 1));
    const menu = document.createElement('button');
    menu.className = 'flex h-9 w-9 items-center justify-center text-muted';
    menu.textContent = '⋯';
    menu.setAttribute('aria-label', 'Layer options');
    menu.addEventListener('click', () => layerMenu(l));
    r.append(eye, name, up, menu);
    list.append(r);
  });
  host.append(list);
  const sel = selLayer();
  if (sel) {
    const s = slider(0, 100, sel.opacity == null ? 100 : sel.opacity);
    host.append(row('Opacity', s));
    s.addEventListener('input', () => { sel.opacity = +s.value; paint(); });
    s.addEventListener('change', () => commit('layer', 'Layer'));
  }
}

function layerName(l) {
  if (l.type === 'text') return 'Text: ' + (l.text.split('\n')[0] || ' ');
  if (l.type === 'shape') return l.shape === 'rect' ? 'Rectangle' : 'Ellipse';
  return 'Photo';
}

function layerMenu(l) {
  const c = document.createElement('div');
  c.className = 'flex flex-col';
  const mk = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'list-row justify-start text-body';
    b.textContent = label;
    b.addEventListener('click', () => { sheet.close(); fn(); });
    c.append(b);
  };
  const sheet = A.openSheet(c);
  mk('Duplicate', () => {
    const copy = clone(l); copy.id = newId();
    copy.x += 20; copy.y += 20;
    doc.layers.splice(doc.layers.indexOf(l) + 1, 0, copy);
    commit('layer', 'Layer');
  });
  mk('Delete', () => deleteLayer(l.id));
}

function deleteLayer(id) {
  const i = doc.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  doc.layers.splice(i, 1);
  if (selId === id) selId = null;
  commit('layer', 'Layer');
  buildPanel($('[data-panel-host]'), 'layers');
}

function moveLayer(l, dir) {
  const i = doc.layers.indexOf(l);
  const j = i + dir;
  if (j < 0 || j >= doc.layers.length) return;
  doc.layers.splice(j, 0, doc.layers.splice(i, 1)[0]);
  commit('layer', 'Layer');
}

function addShape(shape) {
  const w = Math.round(doc.width * 0.4), h = Math.round(doc.height * 0.25);
  const l = {
    id: newId(), type: 'shape', shape, color: '#c41670', radius: shape === 'rect' ? 0 : 0,
    x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2), w, h,
    rotation: 0, opacity: 100, visible: true,
  };
  doc.layers.push(l);
  selId = l.id;
  commit('shape', 'Shape');
}

let addPhotoLayerNext = false;
// photo intake hook: when app adds a photo while the editor is open it
// lands here instead of starting a new project.
export function addPhotoLayer(asset) {
  const d = doc;
  const key = 'photo' + Object.keys(d.assets).length;
  d.assets[key] = asset.url
    ? { url: asset.url, fileId: asset.fileId, w: asset.w, h: asset.h }
    : { blobUrl: asset.blobUrl, w: asset.w, h: asset.h };
  const l = {
    id: newId(), type: 'image', asset: key,
    x: Math.round((d.width - asset.w) / 2), y: Math.round((d.height - asset.h) / 2),
    w: asset.w, h: asset.h, rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    filter: { name: 'Original', amount: 0 },
  };
  d.layers.push(l);
  selId = l.id;
  loadAssets(d.assets).then((a) => { assets = a; paint(); });
  commit('photo', 'Photo');
  buildPanel($('[data-panel-host]'), 'layers');
}

function buildResize(host) {
  const wIn = document.createElement('input');
  wIn.type = 'number'; wIn.className = 'field'; wIn.value = doc.width; wIn.min = 16; wIn.max = 8192;
  const hIn = document.createElement('input');
  hIn.type = 'number'; hIn.className = 'field'; hIn.value = doc.height; hIn.min = 16; hIn.max = 8192;
  const keep = document.createElement('input');
  keep.type = 'checkbox'; keep.checked = true; keep.id = 'keep-ratio';
  const lab = document.createElement('label');
  lab.htmlFor = 'keep-ratio'; lab.className = 'text-small text-muted';
  lab.textContent = 'Keep proportions';
  host.append(
    Object.assign(document.createElement('label'), { className: 'text-small font-medium', textContent: 'Width (px)' }), wIn,
    Object.assign(document.createElement('label'), { className: 'text-small font-medium', textContent: 'Height (px)' }), hIn,
    lab, keep);
  wIn.addEventListener('input', () => { if (keep.checked) hIn.value = Math.round(+wIn.value * doc.height / doc.width); });
  hIn.addEventListener('input', () => { if (keep.checked) wIn.value = Math.round(+hIn.value * doc.width / doc.height); });
  const apply = document.createElement('button');
  apply.className = 'btn-primary mt-2 w-full text-small'; apply.textContent = 'Resize canvas';
  apply.addEventListener('click', () => {
    const w = Math.min(8192, Math.max(16, parseInt(wIn.value, 10) || doc.width));
    const h = Math.min(8192, Math.max(16, parseInt(hIn.value, 10) || doc.height));
    if (w === doc.width && h === doc.height) return;
    const d = clone(doc);
    const sx = w / doc.width, sy = h / doc.height;
    d.width = w; d.height = h;
    d.layers.forEach((l) => { l.x = Math.round(l.x * sx); l.y = Math.round(l.y * sy); l.w = Math.round(l.w * sx); l.h = Math.round(l.h * sy); });
    commit('resize', 'Resize', d);
    fit();
  });
  host.append(apply);
}

function buildAiPanel(host) {
  const p = document.createElement('p');
  p.className = 'text-body mb-2';
  p.textContent = 'AI image tools';
  host.append(p);
  ['Generate image', 'Remove background', 'Remove object', 'Restore old photo', 'Upscale', 'Enhance quality'].forEach((name) => {
    const r = document.createElement('div');
    r.className = 'list-row';
    r.innerHTML = `<span class="flex-1"><span class="block text-body">${name}</span>
      <span class="block text-small text-muted">Not available in this version — switched off rather than faked.</span></span>
      <span class="badge">Unavailable</span>`;
    host.append(r);
  });
  const ideas = document.createElement('button');
  ideas.className = 'btn-secondary mt-2 w-full text-small';
  ideas.textContent = 'Text ideas (available)';
  ideas.addEventListener('click', () => A.ctx.openAiText());
  host.append(ideas);
}

// Crop overlay refresh on paint
const _doPaint = doPaint;
doPaint = function () {
  stageEl.querySelectorAll('[data-crop-box]').forEach((n) => n.remove());
  _doPaint();
  if (panel === 'crop' && crop) drawCropOverlay();
};

// ── Export ───────────────────────────────────────────────────────────────
function exportSheet() {
  flushSave();
  const isPhoto = doc.layers.some((l) => l.type === 'image');
  const c = document.createElement('div');
  c.className = 'flex flex-col gap-3';
  c.append(Object.assign(document.createElement('p'), { className: 'text-heading', textContent: 'Export' }));

  const fmtSeg = document.createElement('div');
  fmtSeg.className = 'segmented';
  let fmt = isPhoto ? 'JPEG' : 'PNG';
  [['PNG', true], ['JPEG', isPhoto], ['WebP', null]].forEach(([label, allowed]) => {
    if (allowed === false) return;
    const b = document.createElement('button');
    b.textContent = label;
    if (label === fmt) b.classList.add('seg-on');
    b.addEventListener('click', () => {
      fmt = label;
      fmtSeg.querySelectorAll('button').forEach((x) => x.classList.remove('seg-on'));
      b.classList.add('seg-on');
      updateLine();
    });
    fmtSeg.append(b);
  });
  if (!('toDataURL' in canvas) || !canvasSupported('image/webp')) {
    [...fmtSeg.querySelectorAll('button')].find((b) => b.textContent === 'WebP')?.remove();
  }
  c.append(fmtSeg);

  const sizeSeg = document.createElement('div');
  sizeSeg.className = 'segmented';
  let mult = 1;
  [['1×', 1], ['2×', 2], ['Custom', 0]].forEach(([label, m]) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (m === 1) b.classList.add('seg-on');
    b.addEventListener('click', () => {
      mult = m;
      sizeSeg.querySelectorAll('button').forEach((x) => x.classList.remove('seg-on'));
      b.classList.add('seg-on');
      customRow.hidden = m !== 0;
      updateLine();
    });
    sizeSeg.append(b);
  });
  c.append(sizeSeg);

  const customRow = document.createElement('div');
  customRow.hidden = true;
  customRow.className = 'flex items-center gap-2';
  const wIn = document.createElement('input');
  wIn.type = 'number'; wIn.className = 'field'; wIn.value = doc.width;
  const x = document.createElement('span'); x.textContent = '×';
  const hIn = document.createElement('input');
  hIn.type = 'number'; hIn.className = 'field'; hIn.value = doc.height;
  customRow.append(wIn, x, hIn);
  c.append(customRow);

  let quality = 92;
  const qRow = document.createElement('div');
  const qs = slider(50, 100, quality);
  qRow.append(row('Quality', qs));
  qs.addEventListener('input', () => { quality = +qs.value; });
  c.append(qRow);

  const line = document.createElement('p');
  line.className = 'text-small text-muted';
  c.append(line);
  const capNote = document.createElement('p');
  capNote.className = 'text-small text-muted';
  capNote.textContent = 'Largest export is 8192 px per side and about 16.7 million pixels. Bigger is scaled down to fit.';
  c.append(capNote);

  const note = document.createElement('p');
  note.className = 'text-small text-muted';
  note.textContent = 'Exports have no watermark.';
  c.append(note);

  function dims() {
    let w = Math.round(doc.width * (mult || 1)), h = Math.round(doc.height * (mult || 1));
    if (mult === 0) {
      w = Math.min(8192, Math.max(16, parseInt(wIn.value, 10) || doc.width));
      h = Math.min(8192, Math.max(16, parseInt(hIn.value, 10) || doc.height));
    }
    if (w * h > 16777216 || Math.max(w, h) > 8192) {
      const k = Math.min(8192 / Math.max(w, h), Math.sqrt(16777216 / (w * h)));
      w = Math.round(w * k); h = Math.round(h * k);
    }
    return [w, h];
  }
  function updateLine() {
    const [w, h] = dims();
    line.textContent = 'Final size: ' + w + ' × ' + h + ' px';
  }
  updateLine();

  const dl = document.createElement('button');
  dl.className = 'btn-primary w-full'; dl.textContent = 'Download';
  dl.addEventListener('click', async () => {
    const [w, h] = dims();
    const c2 = document.createElement('canvas');
    c2.width = w; c2.height = h;
    renderDoc(doc, c2, { scale: w / doc.width, assets: assets || {} });
    const mime = fmt === 'JPEG' ? 'image/jpeg' : fmt === 'WebP' ? 'image/webp' : 'image/png';
    const url = c2.toDataURL(mime, quality / 100);
    const ext = fmt === 'JPEG' ? 'jpg' : fmt === 'WebP' ? 'webp' : 'png';
    const a = document.createElement('a');
    a.href = url;
    a.download = (projName || 'studio').replace(/[^\w-]+/g, '-') + '-' + w + 'x' + h + '.' + ext;
    a.click();
    A.toast('Exported');
    await shareIfPossible(blobFromDataUrl(url), a.download);
    sheet.close();
  });
  c.append(dl);

  const shareB = document.createElement('button');
  shareB.className = 'btn-secondary w-full'; shareB.textContent = 'Share…';
  shareB.addEventListener('click', async () => {
    const [w, h] = dims();
    const c2 = document.createElement('canvas');
    c2.width = w; c2.height = h;
    renderDoc(doc, c2, { scale: w / doc.width, assets: assets || {} });
    c2.toBlob(async (blob) => {
      const ok = await shareIfPossible(blob, (projName || 'studio') + '.' + (fmt === 'JPEG' ? 'jpg' : fmt.toLowerCase()));
      if (!ok) A.toast('Sharing is not available here. Use Download instead.');
    }, fmt === 'JPEG' ? 'image/jpeg' : 'image/png', quality / 100);
  });
  c.append(shareB);

  const sheet = A.openSheet(c);
}

function blobFromDataUrl(url) {
  const [head, b64] = url.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function shareIfPossible(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file] });
      return true;
    }
  } catch {}
  return false;
}

function canvasSupported(mime) {
  try { return document.createElement('canvas').toDataURL(mime).startsWith('data:' + mime); }
  catch { return false; }
}

// Photo added while editor is open: app.js routes pickPhoto results here.
window.addEventListener('usernode-editor-photo', () => {});
