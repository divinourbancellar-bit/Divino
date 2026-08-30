#!/usr/bin/env node
/**
 * fetch-facebook.js — pulls the newest posts from the Divino Urban Cellar
 * Facebook page and bakes them into both magazine.html and magazine-it.html
 * between the FACEBOOK markers, writing facebook-feed.json alongside.
 *
 * Why the Graph API and not scraping:
 *   facebook.com answers unauthenticated scripted requests with HTTP 400 and
 *   serves a login wall to everything else, so there is no public HTML or RSS
 *   to parse. A Page access token is the only route that works, and it is the
 *   one Meta actually supports.
 *
 * Why the photos are downloaded rather than hotlinked:
 *   Graph hands back signed scontent.*.fbcdn.net URLs that expire. Pointing the
 *   magazine at them means it quietly fills with broken images a few weeks after
 *   each run, so every photo is mirrored into fb-media/ and the pages reference
 *   the local copy. Files no longer used by the current posts are pruned.
 *
 * Setup (once):
 *   1. developers.facebook.com -> your app -> Graph API Explorer.
 *   2. Pick the Divino page, grant pages_read_engagement + pages_show_list.
 *   3. Generate a Page access token, then exchange it for a long-lived one.
 *   4. Put it in .env (already gitignored):  FB_PAGE_TOKEN=EAAG...
 *
 * Usage:  node fetch-facebook.js
 * Refresh whenever the page posts (or on a cron / CI schedule).
 */

const fs = require('fs');
const path = require('path');

const PAGE_URL = 'https://www.facebook.com/divinourbancellar';
const API_VERSION = process.env.FB_API_VERSION || 'v23.0';
const MEDIA_DIR = path.join(__dirname, 'fb-media');
const TARGET_JSON = path.join(__dirname, 'facebook-feed.json');

// How many posts to show. The brief is the last 10.
const MAX_ITEMS = 10;
// How many photos to render per post before the "+N more" badge.
const MAX_PHOTOS = 4;

const START = '<!-- FACEBOOK:START -->';
const END = '<!-- FACEBOOK:END -->';
const UA = 'DivinoCefalu-FeedBot/1.0 (+https://divino-urbancellar.com)';

const TARGETS = [
  {
    file: 'magazine.html',
    locale: 'en-GB',
    more: 'View on Facebook →',
    photoNote: (n) => `+${n} more photo${n === 1 ? '' : 's'}`,
    photoAlt: 'Photo from the Divino Urban Cellar Facebook page',
    emptyHtml:
      'No posts have been pulled in yet.\n        ' +
      `<a href="${PAGE_URL}" target="_blank" rel="noopener">Follow Divino on Facebook</a>\n        ` +
      'for the latest from the cellar.',
  },
  {
    file: 'magazine-it.html',
    locale: 'it-IT',
    more: 'Guarda su Facebook →',
    photoNote: (n) => `+${n} foto`,
    photoAlt: 'Foto dalla pagina Facebook di Divino Urban Cellar',
    emptyHtml:
      'Non è ancora stato caricato nessun post.\n        ' +
      `<a href="${PAGE_URL}" target="_blank" rel="noopener">Segui Divino su Facebook</a>\n        ` +
      'per le novità dalla cantina.',
  },
];

/* ------------------------------------------------------------------ token */

// .env is gitignored, so the token lives there rather than in a shell profile.
function loadEnvFile() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

/* -------------------------------------------------------------- graph api */

async function graph(edge, params = {}) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${edge}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', process.env.FB_PAGE_TOKEN);

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const body = await res.json().catch(() => null);

  if (!res.ok || (body && body.error)) {
    const e = (body && body.error) || {};
    const detail = e.message || `HTTP ${res.status}`;
    let hint = '';
    if (e.code === 190) {
      hint = ' — the token is expired or invalid; generate a fresh long-lived Page token';
    } else if (e.code === 100 && /version/i.test(detail)) {
      hint = ` — try another API version via FB_API_VERSION (currently ${API_VERSION})`;
    } else if (e.code === 200) {
      hint = ' — the token is missing pages_read_engagement';
    }
    throw new Error(detail + hint);
  }
  return body;
}

/* ---------------------------------------------------------------- shaping */

// Facebook posts have no title, so the first line doubles as one in the logs
// and in the JSON snapshot.
function headline(text, limit = 80) {
  const first = String(text).split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (first.length <= limit) return first;
  const cut = first.slice(0, limit);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[,;:.–-]+$/, '') + '…';
}

// Blank lines separate paragraphs; single newlines stay as line breaks.
function paragraphs(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function photosOf(post) {
  const out = [];
  const push = (media) => {
    const img = media && media.image;
    if (!img || !img.src) return;
    if (out.some((p) => p.src === img.src)) return;
    out.push({ src: img.src, width: img.width || 0, height: img.height || 0 });
  };

  for (const att of (post.attachments && post.attachments.data) || []) {
    const subs = (att.subattachments && att.subattachments.data) || [];
    if (subs.length) subs.forEach((s) => push(s.media));
    else push(att.media);
  }
  // Some photo posts only expose the image through full_picture.
  if (!out.length && post.full_picture) out.push({ src: post.full_picture, width: 0, height: 0 });
  return out;
}

function mediaTypeOf(post) {
  const att = (post.attachments && post.attachments.data && post.attachments.data[0]) || {};
  return att.media_type || att.type || 'status';
}

async function fetchPosts() {
  // A Page access token resolves /me to the page itself.
  const page = await graph('me', { fields: 'id,name,link' });

  const fields = [
    'id',
    'message',
    'story',
    'created_time',
    'permalink_url',
    'full_picture',
    'attachments{media_type,type,url,media{image{src,width,height}},' +
      'subattachments{media{image{src,width,height}}}}',
  ].join(',');

  const res = await graph(`${page.id}/posts`, { fields, limit: String(MAX_ITEMS) });
  const rows = (res && res.data) || [];

  const posts = rows.map((r) => {
    const text = (r.message || '').trim();
    const d = new Date(r.created_time);
    return {
      id: r.id,
      text,
      story: (r.story || '').trim(),
      headline: headline(text || r.story || ''),
      permalink: r.permalink_url || PAGE_URL,
      date: r.created_time,
      dateISO: isNaN(d) ? '' : d.toISOString().slice(0, 10),
      mediaType: mediaTypeOf(r),
      photos: photosOf(r),
    };
  });

  // Newest first, defensively — the edge order is not contractual.
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { page, posts };
}

/* ----------------------------------------------------------------- mirror */

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

async function mirror(post, index) {
  const slug = String(post.id).replace(/[^a-z0-9]+/gi, '-').slice(-24);

  for (let i = 0; i < post.photos.length; i++) {
    const photo = post.photos[i];
    try {
      const res = await fetch(photo.src, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      const name = `${String(index + 1).padStart(2, '0')}-${slug}-${i + 1}${EXT_BY_TYPE[type] || '.jpg'}`;
      fs.writeFileSync(path.join(MEDIA_DIR, name), Buffer.from(await res.arrayBuffer()));
      photo.local = `fb-media/${name}`;
    } catch (err) {
      process.stdout.write(`    photo ${i + 1} of post ${index + 1} failed (${err.message}) — skipped\n`);
    }
  }
  // A signed CDN URL that could not be mirrored would 404 within weeks; drop it.
  post.photos = post.photos.filter((p) => p.local);
}

function prune(keep) {
  for (const name of fs.readdirSync(MEDIA_DIR)) {
    if (name === '.gitkeep') continue;
    if (!keep.has(`fb-media/${name}`)) {
      fs.unlinkSync(path.join(MEDIA_DIR, name));
      process.stdout.write(`  pruned stale ${name}\n`);
    }
  }
}

/* -------------------------------------------------------------- rendering */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function dateLabel(date, locale) {
  const d = new Date(date);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderPhotos(post, target) {
  if (!post.photos.length) return '';

  const shown = post.photos.slice(0, MAX_PHOTOS);
  const extra = post.photos.length - shown.length;
  // When the post has text the photo is decorative beside it; when it does not,
  // the photo *is* the post and needs a real alt.
  const alt = post.text ? '' : esc(post.story || target.photoAlt);
  const grid = shown.length > 1 ? ` fb-card__media--grid fb-card__media--n${shown.length}` : '';

  let badge = '';
  if (post.mediaType === 'video') {
    badge = '\n          <span class="fb-card__play" aria-hidden="true"></span>';
  } else if (extra > 0) {
    badge = `\n          <span class="fb-card__count">${esc(target.photoNote(extra))}</span>`;
  }

  const imgs = shown
    .map((p, i) => {
      const dim = p.width && p.height ? ` width="${p.width}" height="${p.height}"` : '';
      // One description for the set — repeating it per tile just makes a screen
      // reader say the same sentence four times.
      return `            <img src="${esc(p.local)}" alt="${i === 0 ? alt : ''}"${dim} loading="lazy" decoding="async">`;
    })
    .join('\n');

  const hide = alt ? '' : ' tabindex="-1" aria-hidden="true"';

  return `        <a class="fb-card__media${grid}" href="${esc(post.permalink)}" target="_blank" rel="noopener"${hide}>
${imgs}${badge}
        </a>\n`;
}

function renderCard(post, target) {
  const label = dateLabel(post.date, target.locale);
  let body = '';
  if (post.text) {
    body = paragraphs(post.text)
      .map((p) => `            <p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  } else if (post.story) {
    body = `            <p>${esc(post.story)}</p>`;
  }

  const time = label ? `<time datetime="${esc(post.dateISO)}">${esc(label)}</time>` : '';

  return `      <article class="fb-card">
${renderPhotos(post, target)}        <div class="fb-card__body">
          <p class="fb-card__meta">${time}</p>
          <div class="fb-card__text">
${body}
          </div>
          <a class="fb-card__more" href="${esc(post.permalink)}" target="_blank" rel="noopener">${esc(target.more)}</a>
        </div>
      </article>`;
}

function renderSection(items, target) {
  if (!items.length) {
    return `      <p class="feed-empty">\n        ${target.emptyHtml}\n      </p>`;
  }
  return `    <div class="fb-grid">
${items.map((post) => renderCard(post, target)).join('\n')}
    </div>`;
}

/* ------------------------------------------------------------------- main */

(async () => {
  loadEnvFile();

  if (!process.env.FB_PAGE_TOKEN) {
    console.error('\n  FB_PAGE_TOKEN is not set.');
    console.error('  Facebook publishes no readable feed, so a Page access token is required.');
    console.error('  Add it to .env (gitignored):   FB_PAGE_TOKEN=EAAG...');
    console.error('  See the header of this file for how to generate one.');
    console.error('  The magazine pages were left untouched.\n');
    process.exit(1);
  }

  let page;
  let posts;
  try {
    ({ page, posts } = await fetchPosts());
  } catch (err) {
    console.error(`\n  Could not read the Facebook page: ${err.message}`);
    console.error('  The magazine pages were left untouched (last good snapshot stays live).\n');
    process.exit(1);
  }

  process.stdout.write(`Fetched ${posts.length} post(s) from ${page.name}.\n`);
  if (posts.length < MAX_ITEMS) {
    process.stdout.write(
      `  note: only ${posts.length} available, so the grid shows ${posts.length} of ${MAX_ITEMS} slots\n`
    );
  }

  const shown = posts.slice(0, MAX_ITEMS);

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  for (let i = 0; i < shown.length; i++) await mirror(shown[i], i);
  const mirrored = shown.reduce((n, p) => n + p.photos.length, 0);
  process.stdout.write(`  mirrored ${mirrored} photo(s) into fb-media/\n`);
  prune(new Set(shown.flatMap((p) => p.photos.map((x) => x.local))));

  fs.writeFileSync(
    TARGET_JSON,
    JSON.stringify(
      {
        page: { name: page.name, link: page.link || PAGE_URL },
        total: posts.length,
        shown: shown.length,
        fetchedAt: new Date().toISOString(),
        items: shown,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  let failed = false;
  for (const target of TARGETS) {
    const file = path.join(__dirname, target.file);
    if (!fs.existsSync(file)) {
      console.error(`  ${target.file} not found — skipped.`);
      failed = true;
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const a = html.indexOf(START);
    const b = html.indexOf(END);
    if (a === -1 || b === -1) {
      console.error(`  Markers not found in ${target.file} — nothing injected.`);
      failed = true;
      continue;
    }
    fs.writeFileSync(
      file,
      html.slice(0, a + START.length) + '\n' + renderSection(shown, target) + '\n' + html.slice(b),
      'utf8'
    );
    process.stdout.write(`  injected ${shown.length} into ${target.file} (${target.locale})\n`);
  }

  shown.forEach((p, i) =>
    process.stdout.write(
      `    ${i + 1}. ${dateLabel(p.date, 'en-GB')} — ${p.headline || '(no text)'} [${p.photos.length} photo(s)]\n`
    )
  );

  if (failed) process.exit(1);
})();
