// Staging demo documents for ?demo=1. Six projects and two templates with
// fixed demo_key values, inserted only on staging, only on ?demo=1, for the
// viewing account. Docs carry no pixels: assets are `{ demo: key }`, drawn
// procedurally by public/js/render.js.
'use strict';

const KEYS = {
  projects: ['vlog12', 'sunset', 'bakesale', 'maplemoss', 'springstory', 'cafemenu'],
  templates: ['myvlog', 'mybakesale'],
};
const DEMO_KEYS = ['sunset', 'lake', 'cafe', 'bakery', 'leaf', 'blossom'];

let n = 0;
const id = () => 'demo' + (++n);

// A thumbnail doc: sky band, sun, hills, water, a display title and a shape.
function vlogDoc() {
  return {
    v: 1, width: 1280, height: 720, background: null,
    assets: { photo: { demo: 'lake', w: 1280, h: 720 } },
    layers: [
      { id: id(), type: 'image', asset: 'photo', x: 0, y: 0, w: 1280, h: 720,
        rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
        adjust: { brightness: 8, contrast: 12, saturation: 15, warmth: 20 },
        filter: { name: 'Vivid', amount: 60 } },
      { id: id(), type: 'text', text: 'WEEK 12', font: 'display', size: 200, bold: true,
        color: '#ffd43b', align: 'left', shadow: true, x: 70, y: 120, rotation: 0,
        opacity: 100, visible: true },
      { id: id(), type: 'text', text: 'Lake trip vlog', font: 'sans', size: 72, bold: true,
        color: '#ffffff', align: 'left', shadow: false, x: 90, y: 480, rotation: 0,
        opacity: 100, visible: true },
      { id: id(), type: 'shape', shape: 'rect', color: '#c41670', radius: 12,
        x: 70, y: 470, w: 560, h: 110, rotation: 0, opacity: 100, visible: true },
    ],
  };
}

function sunsetDoc() {
  return {
    v: 1, width: 1080, height: 1080, background: null,
    assets: { photo: { demo: 'sunset', w: 1080, h: 1080 } },
    layers: [
      { id: id(), type: 'image', asset: 'photo', x: 0, y: 0, w: 1080, h: 1080,
        rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
        adjust: { brightness: 0, contrast: 5, saturation: 0, warmth: 10 },
        filter: { name: 'Original', amount: 0 } },
    ],
  };
}

function bakeDoc() {
  return {
    v: 1, width: 1800, height: 2400, background: '#fff4e6',
    assets: { art: { demo: 'bakery', w: 900, h: 900 } },
    layers: [
      { id: id(), type: 'image', asset: 'art', x: 450, y: 700, w: 900, h: 900,
        rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
        adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
        filter: { name: 'Original', amount: 0 } },
      { id: id(), type: 'text', text: 'Bake sale', font: 'display', size: 260, bold: true,
        color: '#264653', align: 'center', shadow: false, x: 900, y: 500, rotation: 0,
        opacity: 100, visible: true },
      { id: id(), type: 'text', text: 'Saturday at the community hall', font: 'sans',
        size: 90, bold: false, color: '#2a9d8f', align: 'center', shadow: false,
        x: 900, y: 1720, rotation: 0, opacity: 100, visible: true },
    ],
  };
}

function logoDoc() {
  return {
    v: 1, width: 1000, height: 1000, background: '#ffffff',
    assets: { leaf: { demo: 'leaf', w: 560, h: 560 } },
    layers: [
      { id: id(), type: 'shape', shape: 'ellipse', color: '#2d6a4f', radius: 0,
        x: 220, y: 220, w: 560, h: 560, rotation: 0, opacity: 100, visible: true },
      { id: id(), type: 'image', asset: 'leaf', x: 300, y: 300, w: 400, h: 400,
        rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
        adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
        filter: { name: 'Original', amount: 0 } },
      { id: id(), type: 'text', text: 'Maple and Moss', font: 'serif', size: 96, bold: false,
        color: '#1b4332', align: 'center', shadow: false, x: 500, y: 830, rotation: 0,
        opacity: 100, visible: true },
    ],
  };
}

function storyDoc() {
  return {
    v: 1, width: 1080, height: 1920, background: '#ffafcc',
    assets: {},
    layers: [
      { id: id(), type: 'shape', shape: 'rect', color: '#ffffff', radius: 32,
        x: 140, y: 720, w: 800, h: 480, rotation: 0, opacity: 100, visible: true },
      { id: id(), type: 'text', text: 'Spring sale', font: 'display', size: 150, bold: true,
        color: '#c41670', align: 'center', shadow: false, x: 540, y: 900, rotation: 0,
        opacity: 100, visible: true },
      { id: id(), type: 'text', text: 'This week only', font: 'sans', size: 70, bold: false,
        color: '#6c757d', align: 'center', shadow: false, x: 540, y: 1060, rotation: 0,
        opacity: 100, visible: true },
    ],
  };
}

function menuDoc() {
  return {
    v: 1, width: 1080, height: 1080, background: '#fffaf0',
    assets: { art: { demo: 'cafe', w: 1080, h: 720 } },
    layers: [
      { id: id(), type: 'image', asset: 'art', x: 0, y: 0, w: 1080, h: 720,
        rotation: 0, flipX: false, flipY: false, opacity: 100, visible: true,
        adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
        filter: { name: 'Warm', amount: 40 } },
      { id: id(), type: 'text', text: 'Corner café', font: 'serif', size: 140, bold: false,
        color: '#3e2723', align: 'center', shadow: false, x: 540, y: 840, rotation: 0,
        opacity: 100, visible: true },
      { id: id(), type: 'text', text: 'Open 7 to 3', font: 'mono', size: 64, bold: false,
        color: '#795548', align: 'center', shadow: false, x: 540, y: 970, rotation: 0,
        opacity: 100, visible: true },
    ],
  };
}

// A project's history: the final doc plus 2-7 earlier steps whose docs
// differ, so undo, redo and the filmstrip all work.
function history(finalDoc, steps) {
  // steps: [{ kind, label, doc }] oldest first; the last one's doc is
  // finalDoc (steps supply their own docs otherwise).
  const h = steps.map((s) => ({ kind: s.kind, label: s.label, doc: s.doc }));
  h[h.length - 1].doc = finalDoc;
  return h;
}

function clone(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function buildProjects() {
  n = 0;
  const vlog = vlogDoc();
  const vlogHist = (() => {
    const s = [];
    const start = clone(vlog);
    const base = start.layers;
    s.push({ kind: 'photo', label: 'Photo', doc: (() => {
      const d = clone(start); d.layers = [clone(base[0])]; return d; })() });
    s.push({ kind: 'crop', label: 'Crop', doc: (() => {
      const d = clone(s[0].doc); d.layers[0].x = -100; d.layers[0].y = -60;
      d.layers[0].w = 1480; d.layers[0].h = 840; return d; })() });
    s.push({ kind: 'filter', label: 'Vivid', doc: (() => {
      const d = clone(s[1].doc); d.layers[0].filter = { name: 'Vivid', amount: 60 }; return d; })() });
    s.push({ kind: 'light', label: 'Light', doc: (() => {
      const d = clone(s[2].doc);
      d.layers[0].adjust = { brightness: 8, contrast: 12, saturation: 15, warmth: 0 };
      return d; })() });
    s.push({ kind: 'text', label: 'Title', doc: (() => {
      const d = clone(s[3].doc); d.layers.push(clone(base[1])); return d; })() });
    s.push({ kind: 'shape', label: 'Shape', doc: vlog });
    return history(vlog, s);
  })();

  const sunset = sunsetDoc();
  const sunsetHist = (() => {
    const s = [
      { kind: 'photo', label: 'Photo', doc: (() => {
        const d = clone(sunset); d.layers[0].adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
        d.layers[0].filter = { name: 'Original', amount: 0 }; return d; })() },
      { kind: 'light', label: 'Light', doc: (() => {
        const d = clone(sunset); d.layers[0].adjust = { brightness: 0, contrast: 5, saturation: 0, warmth: 0 };
        return d; })() },
      { kind: 'colour', label: 'Warm', doc: sunset },
    ];
    return history(sunset, s);
  })();

  const bake = bakeDoc();
  const bakeHist = (() => {
    const s = [
      { kind: 'shape', label: 'Shape', doc: (() => {
        const d = clone(bake); d.layers = [clone(bake.layers[0])]; return d; })() },
      { kind: 'text', label: 'Title', doc: (() => {
        const d = clone(bake); d.layers = bake.layers.slice(0, 2); return d; })() },
      { kind: 'photo', label: 'Layer', doc: bake },
    ];
    return history(bake, s);
  })();

  const logo = logoDoc();
  const logoHist = (() => {
    const s = [
      { kind: 'shape', label: 'Shape', doc: (() => {
        const d = clone(logo); d.layers = [clone(logo.layers[0])]; return d; })() },
      { kind: 'photo', label: 'Layer', doc: (() => {
        const d = clone(logo); d.layers = logo.layers.slice(0, 2); return d; })() },
      { kind: 'text', label: 'Text', doc: logo },
    ];
    return history(logo, s);
  })();

  const story = storyDoc();
  const storyHist = history(story, [
    { kind: 'shape', label: 'Shape', doc: (() => {
      const d = clone(story); d.layers = [clone(story.layers[0])]; return d; })() },
    { kind: 'text', label: 'Text', doc: story },
  ]);

  const menu = menuDoc();
  const menuHist = history(menu, [
    { kind: 'photo', label: 'Photo', doc: (() => {
      const d = clone(menu); d.layers = [clone(menu.layers[0])];
      d.layers[0].filter = { name: 'Original', amount: 0 }; return d; })() },
    { kind: 'filter', label: 'Warm', doc: (() => {
      const d = clone(menu); d.layers = menu.layers.slice(0, 1);
      d.layers[0].filter = { name: 'Warm', amount: 40 }; return d; })() },
    { kind: 'text', label: 'Text', doc: menu },
  ]);

  const now = Date.now();
  const ago = (ms) => new Date(now - ms).toISOString();
  return [
    { demo_key: 'vlog12', name: 'Week 12 vlog thumbnail', format: 'thumbnail', doc: vlog, history: vlogHist, updated: ago(2 * 3600e3) },
    { demo_key: 'sunset', name: 'Lakeside sunset', format: 'social', doc: sunset, history: sunsetHist, updated: ago(26 * 3600e3) },
    { demo_key: 'bakesale', name: 'Bake sale poster', format: 'poster', doc: bake, history: bakeHist, updated: ago(2 * 86400e3) },
    { demo_key: 'maplemoss', name: 'Maple and Moss logo', format: 'logo', doc: logo, history: logoHist, updated: ago(6 * 86400e3) },
    { demo_key: 'springstory', name: 'Spring sale story', format: 'story', doc: story, history: storyHist, updated: ago(8 * 86400e3) },
    { demo_key: 'cafemenu', name: 'Café menu square', format: 'social', doc: menu, history: menuHist, updated: ago(14 * 86400e3) },
  ];
}

function buildTemplates() {
  const vlog = vlogDoc();
  const vlogT = {
    demo_key: 'myvlog', name: 'My vlog layout', format: 'thumbnail',
    doc: { v: 1, width: vlog.width, height: vlog.height, background: null,
      assets: { photo: { demo: 'lake', w: 1280, h: 720 } },
      layers: [clone(vlog.layers[3]), clone(vlog.layers[1]), clone(vlog.layers[2])] },
  };
  const bake = bakeDoc();
  const bakeT = {
    demo_key: 'mybakesale', name: 'My bake sale layout', format: 'poster',
    doc: { v: 1, width: bake.width, height: bake.height, background: '#fff4e6',
      assets: {},
      layers: [clone(bake.layers[1]), clone(bake.layers[2])] },
  };
  return [vlogT, bakeT];
}

module.exports = { KEYS, DEMO_KEYS, buildProjects, buildTemplates };
