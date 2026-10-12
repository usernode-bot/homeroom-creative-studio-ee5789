# Homeroom Creative Studio

One creative studio for AI images, edits and marketing assets, built on
Homeroom. Projects are documents, not pixels: each project stores layer
geometry, light/colour settings and asset references, and the browser
renders the pixels on a canvas. That keeps saves tiny and every edit
reversible.

## What it does

- **Home** — a Continue card with a history filmstrip, recent projects,
  the tools list (Edit / Design / AI tools) and a templates shelf.
- **Canvas editor** — crop, rotate & flip, straighten, light & colour
  adjustments with Auto fix, eight filters with intensity, text in five
  styles, layers (photo / shape, reorder, opacity, duplicate), resize,
  a history filmstrip with undo/redo and jump-to-step, autosave and an
  export sheet (PNG / JPEG / WebP, 1x / 2x / custom size, no watermark).
- **AI text ideas** — headlines, captions and taglines from the
  platform's LLM proxy, billed to the person's own AI budget. AI image
  tools are listed but honestly marked Unavailable; they are never faked.

## Running

```sh
npm install
npm run build   # compiles Tailwind CSS into public/tailwind.css
npm start
```

In staging, open the app with `?demo=1` to seed six demo projects and
two saved templates (idempotent, obviously fake, procedural artwork).

## How it fits together

- `server.js` — Express + Postgres. Projects and templates are private
  per account. `/api/image` is a same-origin proxy for platform files,
  `/api/ai/text` proxies the platform LLM, `/api/capabilities` reports
  what is switched on. Docs are validated server-side (size, layer and
  asset limits) before they are stored.
- `public/js/` — the app: `app.js` (home/projects/templates, routing,
  photo intake), `editor.js` (canvas editor), `render.js` (pixel
  pipeline), `formats.js` (sizes and starter layouts), `tools.js`
  (tool registry), `ai-text.js` (AI text sheet).
- `styles/tailwind-input.css` + `tailwind.config.js` — the design kit.
  Colour only ever comes from tokens; both light and dark looks are
  required.

See `CLAUDE.md` for the app's design language and conventions.
