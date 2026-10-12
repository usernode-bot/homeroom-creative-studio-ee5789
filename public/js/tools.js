// The tool registry. One entry per tool; the Home screen lists them all,
// the editor opens its panels by tool id. status() returns 'ready' (tap
// opens it), 'preview_off' (this build can't run it: shown but explained)
// or 'unavailable' (AI image work: never faked, badge says Unavailable).

export const EDITOR_TOOLS = [
  { id: 'crop', label: 'Crop' },
  { id: 'rotate', label: 'Rotate' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'filters', label: 'Filters' },
  { id: 'text', label: 'Text' },
  { id: 'layers', label: 'Layers' },
  { id: 'resize', label: 'Resize' },
  { id: 'ai', label: 'AI' },
];

export const HOME_TOOLS = [
  // ── Edit ──────────────────────────────────────────────────────────────
  { id: 'crop', name: 'Crop', category: 'edit', icon: 'crop',
    description: 'Trim to a frame or a ratio',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('crop') },
  { id: 'rotate', name: 'Rotate & flip', category: 'edit', icon: 'rotate',
    description: 'Turn, straighten, mirror',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('rotate') },
  { id: 'adjust', name: 'Adjust light & colour', category: 'edit', icon: 'adjust',
    description: 'Brightness, contrast, warmth',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('adjust') },
  { id: 'filters', name: 'Filters', category: 'edit', icon: 'filters',
    description: 'Eight looks with intensity',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('filters') },
  { id: 'resize', name: 'Resize', category: 'edit', icon: 'resize',
    description: 'Change the canvas size',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('resize') },

  // ── Design ────────────────────────────────────────────────────────────
  { id: 'text', name: 'Text', category: 'design', icon: 'text',
    description: 'Titles and captions, five styles',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('text') },
  { id: 'shapes', name: 'Shapes', category: 'design', icon: 'shapes',
    description: 'Rectangles and ellipses',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('layers') },
  { id: 'layers', name: 'Layers', category: 'design', icon: 'layers',
    description: 'Stack, hide, reorder, duplicate',
    status: () => 'ready',
    run: (ctx) => ctx.newProject('layers') },
  { id: 'templates', name: 'Save as template', category: 'design', icon: 'template',
    description: 'Reuse a layout you like',
    status: () => 'ready',
    run: () => { location.hash = '#/templates'; } },

  // ── AI ────────────────────────────────────────────────────────────────
  { id: 'ai-text', name: 'Text ideas', category: 'ai', icon: 'sparkle',
    description: 'Headlines, captions, taglines',
    status: (ctx) => ctx.textAi ? 'ready' : 'preview_off',
    run: (ctx) => ctx.openAiText() },
  { id: 'ai-generate', name: 'Generate image', category: 'ai', icon: 'sparkle',
    description: 'A picture from a description',
    status: () => 'unavailable', run: () => {} },
  { id: 'ai-bg', name: 'Remove background', category: 'ai', icon: 'sparkle',
    description: 'Cut the subject out cleanly',
    status: () => 'unavailable', run: () => {} },
  { id: 'ai-object', name: 'Remove object', category: 'ai', icon: 'sparkle',
    description: 'Erase something from a photo',
    status: () => 'unavailable', run: () => {} },
  { id: 'ai-restore', name: 'Restore old photo', category: 'ai', icon: 'sparkle',
    description: 'Repair scratches and fading',
    status: () => 'unavailable', run: () => {} },
  { id: 'ai-upscale', name: 'Upscale', category: 'ai', icon: 'sparkle',
    description: 'More pixels, same picture',
    status: () => 'unavailable', run: () => {} },
  { id: 'ai-enhance', name: 'Enhance quality', category: 'ai', icon: 'sparkle',
    description: 'Sharpen and clean up',
    status: () => 'unavailable', run: () => {} },
];

export const CATEGORY_LABEL = { edit: 'Edit', design: 'Design', ai: 'AI tools' };
