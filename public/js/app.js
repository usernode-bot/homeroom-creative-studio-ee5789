// App shell: hash router, Home / Projects / Templates views, the new
// project sheet and photo intake. #/edit/... routes are handled by editor.js.
'use strict';

import { FORMATS, STARTERS } from './formats.js';
import { HOME_TOOLS, CATEGORY_LABEL } from './tools.js';
import { thumbnail, renderDoc, loadAssets, textBBox } from './render.js';
import { openAiText } from './ai-text.js';

export const params = new URLSearchParams(location.search);
export const TOKEN = params.get('token') || '';
export const DEMO = params.get('demo') === '1';
export const IS_GUEST = !TOKEN;

export function api(path, opts = {}) {
  const q = DEMO && path.startsWith('/api/') && !path.includes('?') ? path + '?demo=1' : path;
  return fetch(q, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(TOKEN ? { 'x-usernode-token': TOKEN } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || r.status), { code: data.code || data.error, status: r.status, data });
    return data;
  });
}

export function toast(msg, ms = 2400) {
  const t = document.querySelector('[data-toast]');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.opacity = '0'; }, ms);
}

// ── Sheets ───────────────────────────────────────────────────────────────
const sheetRoot = document.querySelector('[data-sheet-root]');
export function openSheet(content, { wide } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-40 flex ' + (wide ? 'items-center justify-center' : 'items-end justify-center');
  const back = document.createElement('div');
  back.className = 'absolute inset-0 bg-fg/40';
  const panel = document.createElement('div');
  panel.className = (wide ? 'max-w-lg ' : 'w-full max-w-3xl ') +
    'relative max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 pb-8 un-safe-bottom';
  panel.append(content);
  wrap.append(back, panel);
  back.addEventListener('click', close);
  sheetRoot.append(wrap);
  function close() { wrap.remove(); }
  return { close, panel };
}

// ── Shared bits ──────────────────────────────────────────────────────────
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function timeAgo(iso) {
  if (!iso) return '';
  const s = (new Date(iso) - Date.now()) / 1000;
  const steps = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [86400 * 7, 'day'], [86400 * 30, 'week'], [86400 * 365, 'month']];
  if (Math.abs(s) < 60) return 'just now';
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(s) < steps[i][0]) return rtf.format(Math.round(s / steps[i - 1][0]), steps[i - 1][1]);
  }
  return rtf.format(Math.round(s / (86400 * 365)), 'year');
}

const view = document.querySelector('[data-view]');
const tabbar = document.querySelector('[data-tabbar]');
let capabilities = { textAi: false, staging: true, guest: IS_GUEST };
export const ctx = {
  get textAi() { return capabilities.textAi; },
  openAiText: (seed) => openAiText({ seed, api, toast, openSheet }),
  newProject: (toolId) => newProjectSheet(toolId),
};

// ── Router ───────────────────────────────────────────────────────────────
const routes = [];
const helpers = { api, toast, openSheet, timeAgo, params, TOKEN, DEMO, renderCurrent, pickPhoto, ctx };
helpers.routes = routes; // editor.js registers its #/edit/... routes here

// ── Tool icons (inline SVG, no emoji) ────────────────────────────────────
const svg = (inner) =>
  '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
const ICONS = {
  crop: svg('<path d="M6 2v12h12M2 6h12v12"/>'),
  rotate: svg('<path d="M4 10a6 6 0 1 1 2 4.5M4 10V6m0 4h4"/>'),
  adjust: svg('<circle cx="7" cy="10" r="4"/><circle cx="13" cy="10" r="4"/>'),
  filters: svg('<circle cx="10" cy="10" r="7"/><path d="M10 3v14M4.5 6.5l11 7M15.5 6.5l-11 7"/>'),
  resize: svg('<path d="M3 17l6-6m0 0v4m0-4H5M17 3l-6 6m0 0V5m0 4h4"/>'),
  text: svg('<path d="M4 5h12M10 5v11M7 16h6"/>'),
  shapes: svg('<rect x="3" y="3" width="9" height="9" rx="1.5"/><circle cx="13.5" cy="13.5" r="3.5"/>'),
  layers: svg('<path d="M10 3l7 4-7 4-7-4 7-4zM3 11l7 4 7-4M3 15l7 4 7-4"/>'),
  template: svg('<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M8 8v9"/>'),
  sparkle: svg('<path d="M10 3l1.6 4.6L16 9l-4.4 1.4L10 15l-1.6-4.6L4 9l4.4-1.4L10 3z"/>'),
};
export function onRoute(re, fn) { routes.push([re, fn]); }
async function route() {
  const h = location.hash || '#/';
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) { try { await fn(...m.slice(1)); } catch (err) { console.error(err); } return; }
  }
  if (h.startsWith('#/edit/')) return; // editor.js route
  showTab(h.startsWith('#/projects') ? 'projects' : h.startsWith('#/templates') ? 'templates' : 'home');
}
window.addEventListener('hashchange', route);

function showTab(name) {
  tabbar.hidden = false;
  view.hidden = false;
  document.querySelectorAll('[data-tab]').forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle('text-fg', on);
    b.classList.toggle('font-semibold', on);
    b.classList.toggle('text-muted', !on);
  });
  if (name === 'home') renderHome();
  else if (name === 'projects') renderProjects();
  else renderTemplates();
}

function setState(el) {
  view.replaceChildren(el);
}

function loadingEl(label) {
  const d = document.createElement('div');
  d.className = 'grid gap-3';
  d.innerHTML = `<div class="skeleton h-40"></div><div class="skeleton h-24"></div><div class="skeleton h-24"></div>`;
  return d;
}

function errorEl(msg, retry, note = 'Your tools and templates still work.') {
  const d = document.createElement('div');
  d.className = 'state-error';
  d.innerHTML = `<p class="text-body font-medium">${msg}</p>
    <p class="text-small text-muted">${note}</p>`;
  const b = document.createElement('button');
  b.className = 'btn-secondary mt-2'; b.textContent = 'Retry';
  b.addEventListener('click', retry);
  d.append(b);
  return d;
}

// ── Home ─────────────────────────────────────────────────────────────────
let homeCache = null;
async function renderHome() {
  if (homeCache) { paintHome(homeCache); homeCache = null; }
  setState(loadingEl());
  const [pr, tr] = await Promise.allSettled([api('/api/projects'), api('/api/templates')]);
  const projects = pr.status === 'fulfilled' ? pr.value.projects || [] : null;
  const templates = tr.status === 'fulfilled' ? tr.value.templates || [] : null;
  if (projects !== null && templates !== null) homeCache = { projects, templates };
  paintHome({ projects, templates });
  if (IS_GUEST && projects) api('/api/capabilities').then((c) => { capabilities = c; }).catch(() => {});
}

function paintHome({ projects, templates }) {
  const d = document.createElement('div');
  d.className = 'flex flex-col gap-6';

  if (DEMO) {
    const note = document.createElement('p');
    note.className = 'rounded-lg bg-raised px-3 py-2 text-small text-muted';
    note.textContent = 'Demo studio: these projects and templates are made-up examples, for looking around. New work you make is saved separately.';
    d.append(note);
  }

  // Continue card + history filmstrip
  if (projects === null) {
    d.append(errorEl('Projects could not be loaded.', renderHome));
  }
  const recent = projects ? projects[0] : undefined;
  if (recent) {
    const card = document.createElement('button');
    card.className = 'card flex w-full items-center gap-3 text-left';
    const img = document.createElement('span');
    img.className = 'flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-stage';
    img.append(thumbImg(recent, 64));
    const txt = document.createElement('span');
    txt.className = 'flex-1';
    txt.innerHTML = `<span class="block text-small text-muted">Continue editing</span>
      <span class="block truncate text-body font-medium">${esc(recent.name || 'Untitled')}</span>
      <span class="block text-small text-muted">${esc(timeAgo(recent.updated_at))}</span>`;
    card.append(img, txt);
    card.addEventListener('click', () => { location.hash = '#/edit/' + recent.id; });
    d.append(card);
    const strip = document.createElement('div');
    strip.dataset.filmstrip = '';
    strip.className = 'filmstrip justify-center overflow-hidden';
    const kinds = recent.recent || [];
    kinds.forEach((k, i) => {
      const f = document.createElement('span');
      const last = i === kinds.length - 1;
      f.className = 'film-frame h-9 w-12 flex-none px-1 text-small ' + (last ? 'film-now' : 'film-past');
      f.textContent = k.label;
      strip.append(f);
    });
    if (!kinds.length) {
      const f = document.createElement('span');
      f.className = 'film-frame film-now h-9 w-12 flex-none px-1 text-small';
      f.textContent = 'Now';
      strip.append(f);
    }
    d.append(strip);
  } else if (projects !== null) {
    const empty = document.createElement('div');
    empty.className = 'state-empty rounded-xl border border-line bg-surface';
    empty.innerHTML = `<p class="text-body font-medium">No projects yet</p>
      <p class="text-small text-muted">Upload a photo or pick a template to start.</p>`;
    const b = document.createElement('button');
    b.className = 'btn-primary mt-1'; b.textContent = 'Upload a photo';
    b.addEventListener('click', () => pickPhoto());
    empty.append(b);
    d.append(empty);
  }

  // Recent projects
  if (projects && projects.length) {
    d.append(sectionLabel('Recent projects'));
    const row = document.createElement('div');
    row.className = '-mx-4 flex gap-3 overflow-x-auto px-4 pb-1';
    projects.slice(0, 8).forEach((p) => {
      const t = document.createElement('button');
      t.dataset.projectTile = '';
      t.className = 'flex w-32 flex-none flex-col gap-1.5 text-left';
      const box = document.createElement('span');
      box.className = 'flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-line bg-stage';
      box.append(thumbImg(p, 128));
      const cap = document.createElement('span');
      cap.className = 'truncate text-small';
      cap.textContent = p.name || 'Untitled';
      const when = document.createElement('span');
      when.className = 'text-small text-muted';
      when.textContent = timeAgo(p.updated_at);
      t.append(box, cap, when);
      t.addEventListener('click', () => { location.hash = '#/edit/' + p.id; });
      row.append(t);
    });
    d.append(row);
  }

  // Tools
  d.append(sectionLabel('Tools'));
  for (const cat of ['edit', 'design', 'ai']) {
    const label = document.createElement('p');
    label.className = 'mb-1 mt-1 text-small font-medium text-' +
      (cat === 'edit' ? 'cyan' : cat === 'design' ? 'magenta' : 'yellow');
    label.textContent = CATEGORY_LABEL[cat];
    d.append(label);
    const list = document.createElement('div');
    list.className = 'list';
    for (const tool of HOME_TOOLS.filter((t) => t.category === cat)) {
      const st = tool.status(ctx);
      const rowEl = document.createElement('button');
      rowEl.className = 'list-row w-full text-left';
      rowEl.innerHTML = `<span class="tool-tile tool-${cat}">${ICONS[tool.icon] || ICONS.sparkle}</span>
        <span class="flex-1"><span class="block text-body">${esc(tool.name)}</span>
        <span class="block text-small text-muted">${esc(tool.description)}</span></span>`;
      if (st !== 'ready') {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = st === 'unavailable' ? 'Unavailable' : 'Off in preview';
        rowEl.append(b);
      } else {
        const arrow = document.createElement('span');
        arrow.className = 'text-muted'; arrow.textContent = '›';
        rowEl.append(arrow);
      }
      rowEl.addEventListener('click', () => {
        if (st === 'unavailable') {
          toast('This AI image tool is not available yet, so it is switched off rather than faked.');
        } else if (st === 'preview_off') {
          toast('AI text is off in this preview. It works in the live app.');
        } else tool.run(ctx);
      });
      list.append(rowEl);
    }
    d.append(list);
  }

  // Templates shelf
  if (templates === null) {
    d.append(errorEl('Templates could not be loaded.', renderHome));
  } else if (templates.length) {
    d.append(sectionLabel('Your templates'));
    const row = document.createElement('div');
    row.className = '-mx-4 flex gap-3 overflow-x-auto px-4 pb-1';
    templates.slice(0, 6).forEach((t) => {
      const b = document.createElement('button');
      b.className = 'flex w-28 flex-none flex-col gap-1.5 text-left';
      const box = document.createElement('span');
      box.className = 'flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-line bg-stage';
      box.append(thumbImg(t, 112));
      const cap = document.createElement('span');
      cap.className = 'truncate text-small'; cap.textContent = t.name || 'Template';
      b.append(box, cap);
      b.addEventListener('click', () => { location.hash = '#/templates'; });
      row.append(b);
    });
    d.append(row);
  }

  setState(d);
}

function sectionLabel(text) {
  const p = document.createElement('p');
  p.className = 'section-label';
  p.textContent = text;
  return p;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A thumbnail for a list row: server thumb_url if present, else a small
// render of the doc (fetched lazily).
const thumbMemo = new Map();
function thumbImg(row, px) {
  const img = document.createElement('img');
  img.alt = '';
  img.width = px; img.height = px;
  img.className = 'h-full w-full object-cover';
  if (row.thumb_url) { img.src = row.thumb_url; return img; }
  img.src = thumbMemo.get('r' + row.id) || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const key = 'r' + row.id;
  api('/api/projects/' + row.id).then(async (p) => {
    if (!p.doc) return;
    const assets = await loadAssets(p.doc.assets);
    const c = document.createElement('canvas');
    renderDoc(p.doc, c, { scale: Math.min(px * 2 / p.doc.width, px * 2 / p.doc.height), assets });
    const url = c.toDataURL('image/png');
    thumbMemo.set(key, url);
    img.src = url;
  }).catch(() => {});
  return img;
}

// ── Projects tab ─────────────────────────────────────────────────────────
async function renderProjects() {
  setState(loadingEl());
  let data;
  try { data = await api('/api/projects'); } catch {
    return setState(errorEl('Projects could not be loaded.', renderProjects));
  }
  const d = document.createElement('div');
  d.className = 'flex flex-col gap-3';
  d.append(sectionLabel('Projects'));
  if (!data.projects.length) {
    const empty = document.createElement('div');
    empty.className = 'state-empty rounded-xl border border-line bg-surface';
    empty.innerHTML = `<p class="text-body font-medium">No projects yet</p>
      <p class="text-small text-muted">Upload a photo or pick a template to start.</p>`;
    const b = document.createElement('button');
    b.className = 'btn-primary mt-1'; b.textContent = 'Upload a photo';
    b.addEventListener('click', () => pickPhoto());
    empty.append(b);
    d.append(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-3 sm:grid-cols-3';
    data.projects.forEach((p) => grid.append(projectTile(p)));
    d.append(grid);
  }
  setState(d);
}

function projectTile(p) {
  const t = document.createElement('div');
  t.dataset.projectTile = '';
  t.className = 'flex flex-col';
  const box = document.createElement('button');
  box.className = 'relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-stage';
  box.append(thumbImg(p, 160));
  box.addEventListener('click', () => { location.hash = '#/edit/' + p.id; });
  const row = document.createElement('div');
  row.className = 'mt-1.5 flex items-center gap-1';
  const name = document.createElement('span');
  name.className = 'min-w-0 flex-1 truncate text-small font-medium';
  name.textContent = p.name || 'Untitled';
  const when = document.createElement('span');
  when.className = 'text-small text-muted';
  when.textContent = timeAgo(p.updated_at).replace(' ago', '');
  const menu = document.createElement('button');
  menu.className = 'flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted';
  menu.setAttribute('aria-label', 'Project options');
  menu.textContent = '⋯';
  menu.addEventListener('click', () => projectMenu(p));
  row.append(name, when, menu);
  t.append(box, row);
  return t;
}

function projectMenu(p) {
  const c = document.createElement('div');
  c.className = 'flex flex-col';
  const add = (label, fn, cls = 'text-fg') => {
    const b = document.createElement('button');
    b.className = 'list-row justify-start text-body ' + cls;
    b.textContent = label;
    b.addEventListener('click', async () => { sheet.close(); try { await fn(); } catch (e) { toast(actionError(e)); } renderCurrent(); });
    c.append(b);
    return b;
  };
  const sheet = openSheet(c);
  add('Rename', async () => {
    const name = prompt('Project name', p.name || 'Untitled');
    if (name == null) return;
    await api('/api/projects/' + p.id, { method: 'PUT', body: { name } });
  });
  add('Duplicate', async () => { await api('/api/projects/' + p.id + '/duplicate', { method: 'POST' }); toast('Duplicated'); });
  add('Save as template', async () => {
    const full = await api('/api/projects/' + p.id);
    await api('/api/templates', { method: 'POST', body: { name: (p.name || 'Untitled'), doc: full.doc } });
    toast('Saved as a template');
  });
  add('Delete', async () => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const r = await api('/api/projects/' + p.id, { method: 'DELETE' });
    if (r.thumbFileId && window.usernode && usernode.deleteFile) usernode.deleteFile(r.thumbFileId).catch(() => {});
    toast('Deleted');
  }, 'text-danger');
}

function renderCurrent() {
  homeCache = null;
  route();
}

function actionError(e) {
  return e && e.code === 'invalid_doc' ? 'That file could not be saved.' : 'That did not work. Try again.';
}

// ── Templates tab ────────────────────────────────────────────────────────
function templateTile(t, opts) {
  const c = document.createElement('div');
  c.className = 'flex flex-col';
  const box = document.createElement('span');
  box.className = 'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-stage';
  const cv = document.createElement('canvas');
  cv.className = 'max-h-full max-w-full';
  box.append(cv);
  const assets = t.doc ? null : null;
  c.append(box);
  const cap = document.createElement('span');
  cap.className = 'mt-1.5 truncate text-small font-medium';
  cap.textContent = t.name;
  c.append(cap);
  if (opts && opts.menu) c.append(opts.menu);
  // Draw it
  (async () => {
    const doc = t.doc;
    const a = await loadAssets(doc.assets);
    renderDoc(doc, cv, { scale: Math.min(300 / doc.width, 300 / doc.height, 1), assets: a });
  })();
  return c;
}

async function renderTemplates() {
  setState(loadingEl());
  let data = null;
  try { data = await api('/api/templates'); } catch { data = null; }
  const d = document.createElement('div');
  d.className = 'flex flex-col gap-3';
  d.append(sectionLabel('Starter templates'));
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 gap-3 sm:grid-cols-3';
  STARTERS.forEach((s) => {
    const tile = templateTile(s);
    const use = document.createElement('button');
    use.className = 'btn-secondary mt-1 text-small'; use.textContent = 'Use';
    use.addEventListener('click', () => { location.hash = '#/edit/new/' + s.id; });
    tile.append(use);
    grid.append(tile);
  });
  d.append(grid);
  d.append(sectionLabel('My templates'));
  if (data === null) {
    d.append(errorEl('Your templates could not be loaded.', renderTemplates,
      'The starter templates above still work.'));
  } else if (!data.templates.length) {
    const empty = document.createElement('div');
    empty.className = 'state-empty rounded-xl border border-line bg-surface';
    empty.innerHTML = `<p class="text-small text-muted">Save a project as a template and it will be here.</p>`;
    d.append(empty);
  } else {
    const my = document.createElement('div');
    my.className = 'grid grid-cols-2 gap-3 sm:grid-cols-3';
    data.templates.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'flex flex-col';
      const box = document.createElement('button');
      box.className = 'flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-stage';
      if (t.thumb_url) {
        const img = document.createElement('img');
        img.alt = ''; img.className = 'h-full w-full object-cover'; img.src = t.thumb_url;
        box.append(img);
      }
      box.addEventListener('click', () => { location.hash = '#/edit/new/tpl/' + t.id; });
      const row = document.createElement('div');
      row.className = 'mt-1.5 flex items-center';
      const cap = document.createElement('span');
      cap.className = 'min-w-0 flex-1 truncate text-small font-medium';
      cap.textContent = t.name || 'Template';
      const del = document.createElement('button');
      del.className = 'flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted';
      del.textContent = '⋯';
      del.addEventListener('click', async () => {
        if (!confirm('Delete this template?')) return;
        try { await api('/api/templates/' + t.id, { method: 'DELETE' }); toast('Deleted'); renderCurrent(); }
        catch { toast('That did not work. Try again.'); }
      });
      row.append(cap, del);
      el.append(box, row);
      my.append(el);
    });
    d.append(my);
  }
  setState(d);
}

// ── New project sheet ────────────────────────────────────────────────────
function newProjectSheet(toolId) {
  const c = document.createElement('div');
  c.className = 'flex flex-col gap-3';
  const title = document.createElement('p');
  title.className = 'text-heading'; title.textContent = 'New project';
  c.append(title);
  const up = document.createElement('button');
  up.className = 'btn-primary w-full'; up.textContent = 'Upload a photo';
  up.addEventListener('click', () => { sheet.close(); pickPhoto(toolId); });
  c.append(up);
  const tpl = document.createElement('button');
  tpl.className = 'btn-secondary w-full'; tpl.textContent = 'Start from a template';
  tpl.addEventListener('click', () => { sheet.close(); location.hash = '#/templates'; });
  c.append(tpl);
  c.append(sectionLabel('Or start blank'));
  const sizes = document.createElement('div');
  sizes.className = 'grid grid-cols-2 gap-2';
  FORMATS.forEach((f) => {
    const b = document.createElement('button');
    b.className = 'btn-secondary flex-col items-start text-left text-small';
    b.innerHTML = `<span class="text-body">${f.name}</span><span class="text-small text-muted">${f.w} × ${f.h}</span>`;
    b.addEventListener('click', () => {
      sheet.close();
      location.hash = '#/edit/new/blank/' + f.id + (toolId ? '/' + toolId : '');
    });
    sizes.append(b);
  });
  c.append(sizes);
  const custom = document.createElement('button');
  custom.className = 'btn-secondary w-full text-small'; custom.textContent = 'Custom size…';
  custom.addEventListener('click', () => {
    const w = parseInt(prompt('Width in pixels (16 to 8192)', '1080'), 10);
    if (!w) return;
    const h = parseInt(prompt('Height in pixels', '1080'), 10);
    if (!h) return;
    sheet.close();
    location.hash = '#/edit/new/blank/custom/' + w + '/' + h + (toolId ? '/' + toolId : '');
  });
  c.append(custom);
  const sheet = openSheet(c);
}

// ── Photo intake ─────────────────────────────────────────────────────────
const fileInput = document.querySelector('[data-file-input]');
let pickTool = null;
export function pickPhoto(toolId) {
  pickTool = toolId || null;
  fileInput.value = '';
  fileInput.click();
}
fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) await usePhotoFile(file);
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) usePhotoFile(f); });

async function usePhotoFile(file) {
  // Some gallery providers report no type at all; let the decoder decide then.
  if (file.type && !/^image\//.test(file.type)) {
    toast("This file can't be opened. Try a JPEG, PNG or WebP.");
    return;
  }
  toast('Preparing photo…');
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { toast("This file can't be opened. Try a JPEG, PNG or WebP."); return; }
  const MAX = 4096;
  let w = bmp.width, h = bmp.height;
  const k = Math.min(1, MAX / Math.max(w, h));
  w = Math.max(16, Math.round(w * k)); h = Math.max(16, Math.round(h * k));
  // On a low-memory phone a big canvas can fail to draw or encode (toBlob
  // then hands back null); say so instead of leaving "Preparing photo…" up.
  const encode = (cv, type, q) => new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error('encode_failed'))), type, q));
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
  let blob;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    blob = await encode(c, keepAlpha ? 'image/png' : 'image/jpeg', 0.9);
    if (blob.size > 5 * 1024 * 1024) {
      let q = 0.85, sw = w;
      while (blob.size > 5 * 1024 * 1024 && q >= 0.5) {
        blob = await encode(c, 'image/jpeg', q);
        if (blob.size > 5 * 1024 * 1024 && sw > 2048) {
          sw = Math.round(sw * 0.7);
          const c2 = document.createElement('canvas');
          c2.width = sw; c2.height = Math.round(h * sw / w);
          c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height);
          blob = await encode(c2, 'image/jpeg', q);
          c.width = c2.width; c.height = c2.height;
          c.getContext('2d').drawImage(c2, 0, 0);
          w = c2.width; h = c2.height;
        }
        q -= 0.1;
      }
    }
  } catch {
    toast('This photo is too big for this phone to prepare. Try a smaller one.');
    return;
  } finally {
    if (bmp.close) bmp.close();
  }
  if (blob.size > 5 * 1024 * 1024) {
    toast('That photo is too large even after shrinking. Try a smaller one.');
    return;
  }
  const name = file.name.replace(/\.[^.]+$/, '') || 'Photo';
  // Try to store it in the platform first; a blob: URL is only a stopgap and
  // is never saved to a project.
  let stored = null;
  if (window.usernode && usernode.uploadFile && TOKEN) {
    try {
      // A named File, so the platform sees an extension that matches the bytes.
      const ext = blob.type === 'image/png' ? '.png' : '.jpg';
      const upload = new File([blob], name.slice(0, 80) + ext, { type: blob.type });
      stored = await usernode.uploadFile(upload, { visibility: 'public' });
    } catch (e) {
      const code = e && (e.code || e.error);
      const msg = {
        file_too_large: 'That photo is too large. Try one under 5 MB.',
        user_quota_exceeded: 'Your file storage is full. Delete something first.',
        app_quota_exceeded: 'The app is out of file storage for now. Try again later.',
        staging_quota_exceeded: 'This preview is out of file storage. Try again later.',
        storage_unavailable: 'File storage is not available right now. Try again later.',
        invalid_image: "This file can't be opened. Try a JPEG, PNG or WebP.",
      }[code];
      toast(msg || 'The photo could not be uploaded. Try again.');
      return;
    }
  }
  const asset = stored
    ? { url: stored.url, fileId: stored.id, w, h }
    : { blobUrl: URL.createObjectURL(blob), w, h, pendingUpload: blob };
  if (window.__editorOpen && helpers.editorApi) {
    helpers.editorApi.addPhotoLayer(asset);
  } else {
    window.__pendingAsset = asset;
    window.__pendingName = name;
    location.hash = '#/edit/new/photo/' + encodeURIComponent(name);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────
import { mountEditor } from './editor.js';
mountEditor(helpers);
document.querySelector('[data-new-project]').addEventListener('click', () => newProjectSheet());
document.querySelectorAll('[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    if (b.dataset.tab === 'home') location.hash = '#/';
    else if (b.dataset.tab === 'projects') location.hash = '#/projects';
    else location.hash = '#/templates';
  });
});
route();
