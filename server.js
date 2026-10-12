const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { DEMO_KEYS, buildProjects, buildTemplates } = require('./server-demo.js');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// The platform signs user-identity tokens with an RSA private key it never
// shares. Containers get only the PUBLIC half, so this app can verify who a
// user is but cannot mint an identity — and neither can any other app.
const JWT_PUBLIC_KEY = (process.env.USERNODE_JWT_PUBLIC_KEY || '')
  .replace(/\\n/g, '\n');

// Tokens are minted for one app: the audience is this app's numeric id, so a
// token issued for a different app is rejected below rather than accepted as
// a valid user.
const APP_AUDIENCE = process.env.USERNODE_APP_ID
  ? 'usernode:app:' + process.env.USERNODE_APP_ID
  : null;

// Visitors with no Homeroom account ("guests") may look around this app at
// its own address, read-only (every public app).
const GUEST_AUDIENCE = APP_AUDIENCE ? APP_AUDIENCE + ':guest' : null;
const GUEST_PUBLIC_KEY = (process.env.USERNODE_GUEST_JWT_PUBLIC_KEY || '')
  .replace(/\\n/g, '\n');

const PUBLIC_API_PATHS = new Set(['/health']);

// AI text goes through the platform's LLM proxy, billed to the user's own
// budget. Staging containers get neither proxy var: the route answers 503
// ai_unavailable and the page says so.
const LLM_ENABLED = !!process.env.USERNODE_LLM_PROXY_TOKEN;
const LLM_URL = process.env.USERNODE_LLM_PROXY_URL || '';

app.use(express.json({ limit: '2mb' }));

const PLATFORM_ORIGIN = (process.env.USERNODE_PLATFORM_ORIGIN || '')
  .replace(/\/+$/, '');

app.get(/^\/usernode-(?:bridge|native|tailwind)\//, async (req, res) => {
  try {
    if (!PLATFORM_ORIGIN) return res.sendStatus(503);
    const upstream = await fetch(PLATFORM_ORIGIN + req.path);
    if (!upstream.ok) return res.sendStatus(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.type(type);
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.warn('hosted asset fetch failed: ' + err.message);
    return res.sendStatus(502);
  }
});

const IS_STAGING = process.env.USERNODE_ENV === 'staging';
const PREVIEW_NOW = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
function requestNow(req) {
  const raw = IS_STAGING ? (req.headers['x-usernode-now'] || req.query['un-now']) : null;
  return typeof raw === 'string' && PREVIEW_NOW.test(raw) ? new Date(raw) : new Date();
}

app.use((req, res, next) => {
  req.now = requestNow(req);
  const token = req.query.token || req.headers['x-usernode-token'];
  if (token && JWT_PUBLIC_KEY && APP_AUDIENCE) {
    try {
      const claims = jwt.verify(token, JWT_PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'usernode',
        audience: APP_AUDIENCE,
      });
      if (claims && claims.pur === 'iframe') req.user = claims;
    } catch {}
  }
  if (!req.user && token && GUEST_PUBLIC_KEY && GUEST_AUDIENCE) {
    try {
      const guest = jwt.verify(token, GUEST_PUBLIC_KEY, {
        algorithms: ['ES256'],
        issuer: 'usernode',
        audience: GUEST_AUDIENCE,
      });
      if (guest && guest.pur === 'guest' && guest.guest === true) req.guest = true;
    } catch {}
  }
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    if (PUBLIC_API_PATHS.has(req.path)) return next();
    if (!req.user && req.guest) {
      if (req.method === 'GET' || req.method === 'HEAD') return next();
      return res.status(401).json({ error: 'account_required' });
    }
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ── Schema ───────────────────────────────────────────────────────────────
// Projects and saved templates. Both carry the person's own creative work
// (private by nature), so both tables are staging:private — schema copies to
// staging, rows never do; the demo seed owns any demo rows the viewer sees.
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id bigserial PRIMARY KEY,
      owner_id text NOT NULL,
      name text,
      format text,
      width int,
      height int,
      doc jsonb,
      history jsonb DEFAULT '[]'::jsonb,
      history_index int DEFAULT 0,
      thumb_url text,
      thumb_file_id text,
      is_demo boolean DEFAULT false,
      demo_key text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  await pool.query(`COMMENT ON TABLE projects IS 'staging:private'`);
  await pool.query(`CREATE INDEX IF NOT EXISTS projects_owner_updated_idx
    ON projects (owner_id, updated_at DESC)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_demo_key_idx
    ON projects (owner_id, demo_key) WHERE demo_key IS NOT NULL`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumb_file_id text`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_templates (
      id bigserial PRIMARY KEY,
      owner_id text NOT NULL,
      name text,
      format text,
      width int,
      height int,
      doc jsonb,
      thumb_url text,
      thumb_file_id text,
      is_demo boolean DEFAULT false,
      demo_key text,
      created_at timestamptz DEFAULT now()
    )`);
  await pool.query(`COMMENT ON TABLE user_templates IS 'staging:private'`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_templates_owner_demo_key_idx
    ON user_templates (owner_id, demo_key) WHERE demo_key IS NOT NULL`);
}

// ── Document validation ──────────────────────────────────────────────────
// Stored docs carry no pixels: image bytes live in platform file storage,
// the doc only names them. Anything that does not parse is a 400.
const COLOR = /^#[0-9a-f]{6}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const FONTS = new Set(['sans', 'serif', 'rounded', 'mono', 'display']);
const FILTERS = new Set(['Original', 'Vivid', 'Warm', 'Cool', 'Mono', 'Sepia', 'Fade', 'Noir']);
const range = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;

function validAsset(a) {
  if (!a || typeof a !== 'object') return false;
  if (a.demo != null) return DEMO_KEYS.includes(a.demo);
  if (typeof a.url !== 'string') return false;
  try {
    const u = new URL(a.url);
    if (PLATFORM_ORIGIN && u.origin !== PLATFORM_ORIGIN) return false;
    if (!new RegExp('^/app-files/[0-9a-f]{32}$').test(u.pathname)) return false;
  } catch { return false; }
  return true;
}

function validDoc(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  if (d.v !== 1) return false;
  if (!Number.isInteger(d.width) || !Number.isInteger(d.height)) return false;
  if (d.width < 16 || d.width > 8192 || d.height < 16 || d.height > 8192) return false;
  if (d.background !== null && d.background !== undefined && !COLOR.test(d.background)) return false;
  if (!d.assets || typeof d.assets !== 'object' || Array.isArray(d.assets)) return false;
  for (const k of Object.keys(d.assets)) {
    if (k.length > 64 || !validAsset(d.assets[k])) return false;
    const a = d.assets[k];
    if (!Number.isInteger(a.w) || !Number.isInteger(a.h) || a.w < 1 || a.h < 1 ||
        a.w > 16384 || a.h > 16384) return false;
  }
  if (!Array.isArray(d.layers) || d.layers.length > 50) return false;
  for (const l of d.layers) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !l.id || l.id.length > 64) return false;
    if (!['image', 'text', 'shape'].includes(l.type)) return false;
    if (!range(l.x, -65536, 65536) || !range(l.y, -65536, 65536) ||
        !range(l.w, 1, 16384) || !range(l.h, 1, 16384)) return false;
    if (!range(l.rotation || 0, -360, 360) || !range(l.opacity == null ? 100 : l.opacity, 0, 100)) return false;
    if (l.visible !== undefined && typeof l.visible !== 'boolean') return false;
    if (l.type === 'image') {
      if (typeof l.asset !== 'string' || !d.assets[l.asset]) return false;
      const adj = l.adjust || {};
      for (const k of ['brightness', 'contrast', 'saturation', 'warmth']) {
        if (!range(adj[k] == null ? 0 : adj[k], -100, 100)) return false;
      }
      const f = l.filter || {};
      if (!FILTERS.has(f.name == null ? 'Original' : f.name)) return false;
      if (!range(f.amount == null ? 0 : f.amount, 0, 100)) return false;
      if (typeof l.flipX === 'string' || typeof l.flipY === 'string') return false;
    } else if (l.type === 'text') {
      if (typeof l.text !== 'string' || l.text.length < 1 || l.text.length > 500) return false;
      if (!FONTS.has(l.font)) return false;
      if (!range(l.size, 4, 1000)) return false;
      if (!COLOR.test(l.color)) return false;
      if (!['left', 'center', 'right'].includes(l.align)) return false;
    } else {
      if (!['rect', 'ellipse'].includes(l.shape)) return false;
      if (!COLOR.test(l.color)) return false;
      if (!range(l.radius == null ? 0 : l.radius, 0, 8192)) return false;
    }
  }
  return true;
}

function validHistory(h) {
  if (!Array.isArray(h) || h.length > 30) return false;
  for (const e of h) {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.kind !== 'string' || e.kind.length > 32) return false;
    if (typeof e.label !== 'string' || e.label.length > 64) return false;
    if (!validDoc(e.doc)) return false;
  }
  return true;
}

function docTooBig(doc, history) {
  try {
    return JSON.stringify(doc).length + JSON.stringify(history || []).length > 600 * 1024;
  } catch { return true; }
}

// Staging demo seed: the viewer's own made-up studio. Runs only on staging,
// only with ?demo=1, only on GET; idempotent via the demo_key unique index.
async function ensureDemo(user) {
  const projects = buildProjects();
  const client = await pool.connect();
  try {
    for (const p of projects) {
      await client.query(
        `INSERT INTO projects (owner_id, name, format, width, height, doc, history,
           history_index, is_demo, demo_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$10)
         ON CONFLICT (owner_id, demo_key) WHERE demo_key IS NOT NULL DO NOTHING`,
        [user.id, p.name, p.format, p.doc.width, p.doc.height, JSON.stringify(p.doc),
         JSON.stringify(p.history), p.history.length - 1, p.demo_key, p.updated]);
    }
    for (const t of buildTemplates()) {
      await client.query(
        `INSERT INTO user_templates (owner_id, name, format, width, height, doc,
           is_demo, demo_key)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7)
         ON CONFLICT (owner_id, demo_key) WHERE demo_key IS NOT NULL DO NOTHING`,
        [user.id, t.name, t.format, t.doc.width, t.doc.height, JSON.stringify(t.doc),
         t.demo_key]);
    }
  } finally {
    client.release();
  }
}

const RECENT_HISTORY = `COALESCE((
  SELECT json_agg(x ORDER BY x.ord)::jsonb FROM (
    SELECT e->>'kind' AS kind, e->>'label' AS label, ord
    FROM jsonb_array_elements(history) WITH ORDINALITY AS t(e, ord)
    LIMIT 8
  ) x
), '[]'::jsonb) AS recent`;

// ── Capabilities ─────────────────────────────────────────────────────────
app.get('/api/capabilities', (req, res) => {
  res.json({
    textAi: LLM_ENABLED,
    imageAi: false,
    staging: IS_STAGING,
    guest: !req.user,
  });
});

// ── Projects ─────────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  if (!req.user) return res.json({ projects: [], guest: true });
  try {
    if (IS_STAGING && req.query.demo === '1') await ensureDemo(req.user);
    const onlyMine = req.query.demo !== '1';
    const r = await pool.query(
      `SELECT id, name, format, width, height, thumb_url, history_index,
              is_demo, ${RECENT_HISTORY}, updated_at
       FROM projects WHERE owner_id = $1 ${onlyMine ? 'AND NOT is_demo' : ''}
       ORDER BY updated_at DESC LIMIT 100`,
      [req.user.id]);
    res.json({ projects: r.rows });
  } catch (err) {
    console.error('projects list failed: ' + err.message);
    res.status(500).json({ error: 'list_failed' });
  }
});

app.post('/api/projects', async (req, res) => {
  const b = req.body || {};
  if (!validDoc(b.doc) || !validHistory(b.history || [])) {
    return res.status(400).json({ error: 'invalid_doc' });
  }
  if (docTooBig(b.doc, b.history)) return res.status(400).json({ error: 'invalid_doc' });
  try {
    const r = await pool.query(
      `INSERT INTO projects (owner_id, name, format, width, height, doc, history, history_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, format, width, height,
         thumb_url, history_index, is_demo, updated_at`,
      [req.user.id, String(b.name || 'Untitled').slice(0, 120), String(b.format || '').slice(0, 32),
       b.doc.width, b.doc.height, JSON.stringify(b.doc), JSON.stringify(b.history || []),
       Number.isInteger(b.historyIndex) ? b.historyIndex : (b.history || []).length - 1]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('project create failed: ' + err.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

function ownRow(table) {
  return async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM ${table} WHERE id = $1 AND owner_id = $2`,
        [req.params.id, req.user.id]);
      if (!r.rows.length) {
        res.status(404).json({ error: 'not_found' });
        return undefined; // response already sent; callers check for undefined
      }
      return r.rows[0];
    } catch (err) {
      if (err.message.includes('invalid input syntax')) {
        return res.status(404).json({ error: 'not_found' });
      }
      throw err;
    }
  };
}

app.get('/api/projects/:id', async (req, res) => {
  try {
    const row = await ownRow('projects')(req, res);
    if (row === undefined) return;
    res.json(row);
  } catch (err) {
    console.error('project load failed: ' + err.message);
    res.status(500).json({ error: 'load_failed' });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const row = await ownRow('projects')(req, res);
    if (row === undefined) return;
    const b = req.body || {};
    const sets = [], vals = [];
    let n = 0;
    const put = (col, val) => { sets.push(`${col} = $${++n}`); vals.push(val); };
    if (b.name !== undefined) put('name', String(b.name).slice(0, 120));
    if (b.doc !== undefined) {
      if (!validDoc(b.doc)) return res.status(400).json({ error: 'invalid_doc' });
      put('doc', JSON.stringify(b.doc));
      put('width', b.doc.width); put('height', b.doc.height);
    }
    if (b.history !== undefined) {
      if (!validHistory(b.history)) return res.status(400).json({ error: 'invalid_doc' });
      put('history', JSON.stringify(b.history));
      if (b.historyIndex === undefined) put('history_index', b.history.length - 1);
    }
    if (b.historyIndex !== undefined) {
      if (!Number.isInteger(b.historyIndex)) return res.status(400).json({ error: 'invalid_doc' });
      put('history_index', b.historyIndex);
    }
    if (b.thumbUrl !== undefined) put('thumb_url', String(b.thumbUrl).slice(0, 500));
    if (b.thumbFileId !== undefined) put('thumb_file_id', String(b.thumbFileId).slice(0, 64));
    if (!sets.length) return res.json({ ok: true });
    sets.push(`updated_at = $${++n}`); vals.push(req.now);
    vals.push(req.params.id, req.user.id);
    await pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${n + 1} AND owner_id = $${n + 2}`,
      vals);
    res.json({ ok: true });
  } catch (err) {
    console.error('project save failed: ' + err.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING thumb_file_id`,
      [req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ thumbFileId: r.rows[0].thumb_file_id || null });
  } catch (err) {
    console.error('project delete failed: ' + err.message);
    res.status(500).json({ error: 'delete_failed' });
  }
});

app.post('/api/projects/:id/duplicate', async (req, res) => {
  try {
    const row = await ownRow('projects')(req, res);
    if (row === undefined) return;
    const r = await pool.query(
      `INSERT INTO projects (owner_id, name, format, width, height, doc, history,
         history_index, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING id, name, updated_at`,
      [req.user.id, ('Copy of ' + (row.name || 'Untitled')).slice(0, 120), row.format,
       row.width, row.height, row.doc, row.history, row.history_index]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('project duplicate failed: ' + err.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

// ── Templates ────────────────────────────────────────────────────────────
app.get('/api/templates', async (req, res) => {
  if (!req.user) return res.json({ templates: [], guest: true });
  try {
    if (IS_STAGING && req.query.demo === '1') await ensureDemo(req.user);
    const onlyMine = req.query.demo !== '1';
    const r = await pool.query(
      `SELECT id, name, format, width, height, thumb_url, is_demo, doc
       FROM user_templates WHERE owner_id = $1 ${onlyMine ? 'AND NOT is_demo' : ''}
       ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]);
    res.json({ templates: r.rows });
  } catch (err) {
    console.error('templates list failed: ' + err.message);
    res.status(500).json({ error: 'list_failed' });
  }
});

app.post('/api/templates', async (req, res) => {
  const b = req.body || {};
  if (!validDoc(b.doc)) return res.status(400).json({ error: 'invalid_doc' });
  try {
    const r = await pool.query(
      `INSERT INTO user_templates (owner_id, name, format, width, height, doc)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, format, width, height`,
      [req.user.id, String(b.name || 'My template').slice(0, 120),
       String(b.format || '').slice(0, 32), b.doc.width, b.doc.height,
       JSON.stringify(b.doc)]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('template create failed: ' + err.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM user_templates WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('template delete failed: ' + err.message);
    res.status(500).json({ error: 'delete_failed' });
  }
});

// ── Image proxy ──────────────────────────────────────────────────────────
// Stored photos are fetched same-origin so the canvas is never tainted and
// exports always work. Only this platform's /app-files/<32 hex> URLs pass.
app.get('/api/image', async (req, res) => {
  const src = req.query.src || '';
  let u;
  try { u = new URL(src); } catch { return res.status(400).json({ error: 'bad_src' }); }
  if (!PLATFORM_ORIGIN || u.origin !== PLATFORM_ORIGIN ||
      !new RegExp('^/app-files/[0-9a-f]{32}$').test(u.pathname)) {
    return res.status(400).json({ error: 'bad_src' });
  }
  try {
    const up = await fetch(u, { redirect: 'reject' });
    if (up.status === 404) return res.status(404).json({ error: 'not_found' });
    if (!up.ok) return res.status(502).json({ error: 'upstream' });
    const buf = Buffer.from(await up.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });
    const ct = up.headers.get('content-type');
    if (ct) res.type(ct);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    return res.send(buf);
  } catch (err) {
    console.warn('image proxy failed: ' + err.message);
    return res.status(502).json({ error: 'upstream' });
  }
});

// ── AI text ideas ────────────────────────────────────────────────────────
const IDEAS_SYSTEM = 'You write short marketing text for graphics. Return only a JSON array of 5 distinct options for the requested kind, in the language of the brief. Headlines up to 8 words, taglines up to 10, captions up to 30. Decline anything sexual or suggestive, romantic or dating themed, violent or about weapons, about gambling or betting, about alcohol or drugs, or presenting real tragedy, self-harm or crime as entertainment: for those return {"declined":true} and nothing else.';

app.post('/api/ai/text', async (req, res) => {
  const b = req.body || {};
  const brief = typeof b.brief === 'string' ? b.brief.trim() : '';
  if (!brief || brief.length > 300 || !['headline', 'caption', 'tagline'].includes(b.kind)) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!LLM_ENABLED) return res.status(503).json({ code: 'ai_unavailable', staging: IS_STAGING });
  try {
    const r = await fetch(`${LLM_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-usernode-app-token': process.env.USERNODE_LLM_PROXY_TOKEN,
        'x-usernode-user-token': req.headers['x-usernode-token'] || '',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 400,
        system: IDEAS_SYSTEM,
        messages: [{
          role: 'user',
          content: `Brief (between the markers): <<<${brief}>>>\nKind wanted: ${b.kind}`,
        }],
      }),
    });
    const usage = {
      spentCents: parseFloat(r.headers.get('x-usernode-llm-spent-cents')) || 0,
      capCents: parseInt(r.headers.get('x-usernode-llm-cap-cents'), 10) || 0,
    };
    if (r.status === 403) return res.status(403).json({ code: 'grant_required', usage });
    if (r.status === 429) {
      let code = 'ai_failed';
      try { code = (await r.json()).code || code; } catch {}
      if (code === 'app_cap_exceeded' || code === 'budget_exceeded') {
        return res.status(429).json({ code, usage });
      }
      return res.status(502).json({ code: 'ai_failed', usage });
    }
    if (!r.ok) return res.status(502).json({ code: 'ai_failed', usage });
    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || '').join('');
    let out;
    try { out = JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, '').trim()); }
    catch { out = null; }
    if (out && out.declined === true) return res.json({ declined: true, usage });
    if (Array.isArray(out)) {
      const ideas = out
        .filter((s) => typeof s === 'string' && s.trim())
        .slice(0, 5)
        .map((s) => s.trim().slice(0, 120));
      if (!ideas.length) return res.status(502).json({ code: 'ai_failed', usage });
      return res.json({ ideas, usage });
    }
    return res.status(502).json({ code: 'ai_failed', usage });
  } catch (err) {
    console.warn('ai text failed: ' + err.message);
    return res.status(502).json({ code: 'ai_failed', usage: null });
  }
});

// Last-resort error handler: a handler that throws (or answers twice) must
// never take the whole process down with it.
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  console.error('unhandled route error: ' + (err && err.message));
  res.status(500).json({ error: 'server_error' });
});

// ── Static shell ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  if (!req.user && !req.guest) {
    const deepPath = /^\/[A-Za-z0-9\-._~!$&()*+,;=:@\/%?]*$/.test(req.originalUrl)
      ? '?path=' + encodeURIComponent(req.originalUrl) : '';
    if (PLATFORM_ORIGIN && req.get('sec-fetch-dest') === 'document') {
      return res.redirect(302, PLATFORM_ORIGIN + '/app/homeroom-creative-studio-ee5789/full' + deepPath);
    }
    return res.status(401).send(`<!doctype html><meta charset=utf-8><title>Open in Homeroom</title>
<body style="font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:24rem;padding:2rem;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 0.5rem">Open this app inside Homeroom</h1>
    <p style="color:#a1a1aa;font-size:0.9rem;margin:0 0 1.25rem">This page is served via the platform; direct visits aren't authenticated.</p>
    <a href="${PLATFORM_ORIGIN}/app/homeroom-creative-studio-ee5789/full${deepPath}" style="display:inline-block;padding:0.5rem 1rem;background:#7c3aed;color:white;border-radius:0.5rem;text-decoration:none;font-size:0.9rem">Open in Homeroom</a>
  </div>
</body>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Boot and shutdown ────────────────────────────────────────────────────
async function start() {
  await ensureSchema();
  const server = app.listen(port, () => console.log(`Listening on :${port}`));
  server.keepAliveTimeout = 75_000;
  const shutdown = (sig) => {
    console.log(`${sig}: draining`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => pool.end().then(() => process.exit(0)), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => { console.error(err); process.exit(1); });
