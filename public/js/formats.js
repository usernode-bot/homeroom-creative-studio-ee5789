// Canvas sizes and starter layouts. A starter is a doc with no photo: the
// person opens it and adds their own.
export const FORMATS = [
  { id: 'thumbnail', name: 'Thumbnail', w: 1280, h: 720 },
  { id: 'poster', name: 'Poster', w: 1800, h: 2400 },
  { id: 'logo', name: 'Logo', w: 1000, h: 1000 },
  { id: 'social', name: 'Social square', w: 1080, h: 1080 },
  { id: 'story', name: 'Story', w: 1080, h: 1920 },
  { id: 'banner', name: 'Banner', w: 1500, h: 500 },
];

export const STARTERS = [
  {
    id: 'yt-bold', name: 'Bold thumbnail', format: 'thumbnail',
    doc: { v: 1, width: 1280, height: 720, background: '#16171a', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'rect', color: '#008ba0', radius: 0, x: -60, y: 0, w: 700, h: 720, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'Your big title', font: 'display', size: 130, bold: true, color: '#ffffff', align: 'left', shadow: true, x: 80, y: 220, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: 'a short hook line', font: 'sans', size: 56, bold: false, color: '#ffd43b', align: 'left', shadow: false, x: 90, y: 430, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'yt-split', name: 'Split thumbnail', format: 'thumbnail',
    doc: { v: 1, width: 1280, height: 720, background: '#f2f3f5', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'rect', color: '#ffffff', radius: 24, x: 640, y: 60, w: 580, h: 600, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'Episode title here', font: 'sans', size: 92, bold: true, color: '#16171a', align: 'left', shadow: false, x: 70, y: 240, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: 'with a guest', font: 'serif', size: 52, bold: false, color: '#54575e', align: 'left', shadow: false, x: 70, y: 400, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'poster-event', name: 'Event poster', format: 'poster',
    doc: { v: 1, width: 1800, height: 2400, background: '#1b4332', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'ellipse', color: '#ffd43b', radius: 0, x: 400, y: 500, w: 1000, h: 1000, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'Summer fair', font: 'display', size: 220, bold: true, color: '#ffffff', align: 'center', shadow: false, x: 900, y: 400, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: 'Saturday 12 July, from noon', font: 'sans', size: 80, bold: false, color: '#d8f3dc', align: 'center', shadow: false, x: 900, y: 1900, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'poster-minimal', name: 'Minimal poster', format: 'poster',
    doc: { v: 1, width: 1800, height: 2400, background: '#ffffff', assets: {}, layers: [
      { id: 's1', type: 'text', text: 'A quiet word', font: 'serif', size: 200, bold: false, color: '#16171a', align: 'center', shadow: false, x: 900, y: 1000, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'shape', shape: 'rect', color: '#c41670', radius: 0, x: 810, y: 1350, w: 180, h: 12, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'logo-badge', name: 'Badge logo', format: 'logo',
    doc: { v: 1, width: 1000, height: 1000, background: null, assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'ellipse', color: '#264653', radius: 0, x: 125, y: 125, w: 750, h: 750, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'shape', shape: 'ellipse', color: '#ffffff', radius: 0, x: 165, y: 165, w: 670, h: 670, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: 'STUDIO', font: 'mono', size: 120, bold: true, color: '#264653', align: 'center', shadow: false, x: 500, y: 440, rotation: 0, opacity: 100, visible: true },
      { id: 's4', type: 'text', text: 'since today', font: 'serif', size: 56, bold: false, color: '#54575e', align: 'center', shadow: false, x: 500, y: 580, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'social-quote', name: 'Quote square', format: 'social',
    doc: { v: 1, width: 1080, height: 1080, background: '#ffafcc', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'rect', color: '#ffffff', radius: 32, x: 90, y: 290, w: 900, h: 500, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'Make it today, better tomorrow', font: 'serif', size: 84, bold: false, color: '#16171a', align: 'center', shadow: false, x: 540, y: 430, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: '— your name', font: 'sans', size: 48, bold: false, color: '#54575e', align: 'center', shadow: false, x: 540, y: 660, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'story-sale', name: 'Sale story', format: 'story',
    doc: { v: 1, width: 1080, height: 1920, background: '#264653', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'rect', color: '#ffd43b', radius: 0, x: 0, y: 660, w: 1080, h: 600, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'Big sale', font: 'display', size: 170, bold: true, color: '#16171a', align: 'center', shadow: false, x: 540, y: 820, rotation: 0, opacity: 100, visible: true },
      { id: 's3', type: 'text', text: 'This weekend only', font: 'sans', size: 72, bold: false, color: '#ffffff', align: 'center', shadow: false, x: 540, y: 300, rotation: 0, opacity: 100, visible: true },
    ] },
  },
  {
    id: 'banner-simple', name: 'Simple banner', format: 'banner',
    doc: { v: 1, width: 1500, height: 500, background: '#e9eef2', assets: {}, layers: [
      { id: 's1', type: 'shape', shape: 'rect', color: '#008ba0', radius: 0, x: 0, y: 0, w: 24, h: 500, rotation: 0, opacity: 100, visible: true },
      { id: 's2', type: 'text', text: 'New at the shop', font: 'sans', size: 120, bold: true, color: '#16171a', align: 'left', shadow: false, x: 90, y: 180, rotation: 0, opacity: 100, visible: true },
    ] },
  },
];
