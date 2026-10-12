// AI text ideas sheet: headlines, captions and taglines from the platform's
// LLM proxy, billed to the person's own AI budget. Every failure state says
// exactly what happened and what to do; nothing is faked.
'use strict';

export function openAiText({ seed, api, toast, openSheet, onUse }) {
  const c = document.createElement('div');
  c.className = 'flex flex-col gap-3';
  const title = document.createElement('p');
  title.className = 'text-heading'; title.textContent = 'Text ideas';
  c.append(title);

  const brief = document.createElement('textarea');
  brief.className = 'field min-h-20';
  brief.placeholder = 'e.g. Bake sale this Saturday at the community hall';
  brief.maxLength = 300;
  if (seed) brief.value = seed;
  const briefLabel = document.createElement('label');
  briefLabel.className = 'text-small font-medium';
  briefLabel.textContent = 'What is it about?';
  briefLabel.append(brief);
  c.append(briefLabel);

  const kindRow = document.createElement('div');
  kindRow.className = 'segmented';
  const kinds = [['headline', 'Headline'], ['caption', 'Caption'], ['tagline', 'Tagline']];
  let kind = 'headline';
  kinds.forEach(([id, label], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (!i) b.className = 'seg-on';
    b.addEventListener('click', () => {
      kind = id;
      kindRow.querySelectorAll('button').forEach((x) => x.classList.remove('seg-on'));
      b.classList.add('seg-on');
    });
    kindRow.append(b);
  });
  const kindLabel = document.createElement('label');
  kindLabel.className = 'text-small font-medium';
  kindLabel.textContent = 'What kind?';
  kindLabel.append(kindRow);
  c.append(kindLabel);

  const go = document.createElement('button');
  go.className = 'btn-primary w-full'; go.textContent = 'Write ideas';
  c.append(go);

  const out = document.createElement('div');
  out.className = 'flex flex-col gap-2';
  c.append(out);

  const sheet = openSheet(c, { wide: window.innerWidth >= 640 });
  let retried = false;

  go.addEventListener('click', async () => {
    const text = brief.value.trim();
    if (!text) { brief.focus(); return; }
    out.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton h-11';
      out.append(sk);
    }
    go.disabled = true;
    try {
      const r = await api('/api/ai/text', { method: 'POST', body: { brief: text, kind } });
      go.disabled = false;
      if (r.declined) {
        out.replaceChildren(msg('That topic cannot be used here. Try a different one.'));
        return;
      }
      paintIdeas(r.ideas || [], r.usage);
    } catch (e) {
      go.disabled = false;
      out.replaceChildren(handleError(e, { retry: () => go.click() }));
    }
  });

  function msg(text, action, fn, cls = 'text-small text-muted') {
    const d = document.createElement('div');
    d.className = 'rounded-lg bg-raised px-3 py-2 ' + cls;
    d.textContent = text;
    if (action) {
      const b = document.createElement('button');
      b.className = 'btn-secondary mt-2 text-small';
      b.textContent = action;
      b.addEventListener('click', fn);
      d.append(b);
    }
    return d;
  }

  async function handleError(e, { retry }) {
    const code = e && (e.code || (e.data && e.data.code));
    if (code === 'grant_required') {
      if (!retried && window.usernode && usernode.requestLlmAccess) {
        retried = true;
        try { await usernode.requestLlmAccess(); retry(); return document.createElement('div'); } catch {}
      }
      return msg('AI text needs your permission. Nothing was sent.', 'Allow AI', () => {
        if (window.usernode && usernode.requestLlmAccess) usernode.requestLlmAccess();
      });
    }
    if (code === 'app_cap_exceeded') return msg("Today's AI limit for this app is used up. It resets at midnight UTC.");
    if (code === 'budget_exceeded') return msg('Your Homeroom AI budget for today is used up.');
    if (code === 'ai_unavailable') {
      const staging = e.data && e.data.staging;
      return msg(staging ? 'AI text is off in this preview. It works in the live app.' : "AI text isn't available right now.");
    }
    return msg("Couldn't get ideas: the AI service didn't answer. Your project is unchanged.", 'Retry', retry);
  }

  function paintIdeas(ideas, usage) {
    out.replaceChildren();
    if (usage && usage.capCents) {
      const u = document.createElement('p');
      u.className = 'text-small text-muted';
      u.textContent = 'Used ' + usage.spentCents.toFixed(0) + '¢ of $' + (usage.capCents / 100).toFixed(2) + ' today';
      out.append(u);
    }
    ideas.forEach((idea) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2';
      const t = document.createElement('span');
      t.className = 'min-w-0 flex-1 text-body';
      t.textContent = idea;
      row.append(t);
      if (onUse) {
        const use = document.createElement('button');
        use.className = 'btn-secondary flex-none text-small'; use.textContent = 'Use';
        use.addEventListener('click', () => { sheet.close(); onUse(idea); });
        row.append(use);
      } else {
        const copy = document.createElement('button');
        copy.className = 'btn-secondary flex-none text-small'; copy.textContent = 'Copy';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(idea); toast('Copied'); }
          catch { toast('Copy failed — select the text instead.'); }
        });
        row.append(copy);
      }
      out.append(row);
    });
  }

  return sheet;
}
