#!/usr/bin/env node
/**
 * fetch-substack.js — pulls the CefalùNext posts and bakes them into both
 * magazine.html and magazine-it.html between the CEFALUNEXT markers, and
 * writes cefalunext-feed.json.
 *
 * Source order:
 *   1. Substack's archive API  — returns the full published archive.
 *   2. The RSS feed            — fallback only.
 *
 * The archive API is primary because Substack's /feed has been observed to lag
 * badly behind the archive (1 item in the feed vs 4 actually published). RSS is
 * kept as a fallback in case the API shape ever changes.
 *
 * Neither endpoint sends CORS headers, so the browser cannot read them directly.
 * Running this server-side keeps the section crawlable and JS-free.
 *
 * Usage:  node fetch-substack.js
 * Refresh whenever a new post goes up (or on a cron / CI schedule).
 */

const fs = require('fs');
const path = require('path');

const PUBLICATION_URL = 'https://cefalunext.substack.com';
const ARCHIVE_URL = `${PUBLICATION_URL}/api/v1/archive?sort=new&limit=50&offset=0`;
const FEED_URL = `${PUBLICATION_URL}/feed`;
const TARGET_JSON = path.join(__dirname, 'cefalunext-feed.json');

// How many posts to show in the magazine grid.
const MAX_ITEMS = 6;

const START = '<!-- CEFALUNEXT:START -->';
const END = '<!-- CEFALUNEXT:END -->';
const UA = 'DivinoCefalu-FeedBot/1.0 (+https://divino-urbancellar.com)';

const TARGETS = [
  {
    file: 'magazine.html',
    locale: 'en-GB',
    more: 'Read on Substack →',
    emptyHtml:
      'No posts have been published yet.\n        ' +
      `<a href="${PUBLICATION_URL}" target="_blank" rel="noopener">Follow CefalùNext on Substack</a>\n        ` +
      'to be notified.',
  },
  {
    file: 'magazine-it.html',
    locale: 'it-IT',
    more: 'Leggi su Substack →',
    emptyHtml:
      'Non è ancora stato pubblicato nessun articolo.\n        ' +
      `<a href="${PUBLICATION_URL}" target="_blank" rel="noopener">Segui CefalùNext su Substack</a>\n        ` +
      'per riceverli.',
  },
];

/* ------------------------------------------------------------------- shared */

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => named[n]);
}

function toPlainText(html) {
  return decodeEntities(
    String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(text, limit = 190) {
  const t = toPlainText(text);
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[,;:.–-]+$/, '') + '…';
}

function normalise(post) {
  const d = new Date(post.date);
  return {
    ...post,
    dateISO: isNaN(d) ? '' : d.toISOString().slice(0, 10),
  };
}

/* -------------------------------------------------------------- source: API */

async function fromArchive() {
  const res = await fetch(ARCHIVE_URL, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`archive HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('archive did not return an array');

  const posts = rows
    .filter((r) => r && r.canonical_url && r.title)
    .map((r) => {
      const byline =
        Array.isArray(r.publishedBylines) && r.publishedBylines.length
          ? r.publishedBylines[0].name || ''
          : '';
      return normalise({
        title: decodeEntities(r.title).trim(),
        link: r.canonical_url,
        author: byline,
        date: r.post_date,
        image: r.cover_image || '',
        excerpt: excerpt(r.description || r.subtitle || r.truncated_body_text || ''),
      });
    });

  // Newest first, defensively — the API sort param is not guaranteed.
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

/* -------------------------------------------------------------- source: RSS */

function tag(xml, name) {
  const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1];
  return v.trim();
}

function attr(xml, name, key) {
  const m = xml.match(new RegExp('<' + name + '\\b[^>]*\\b' + key + '="([^"]*)"', 'i'));
  return m ? m[1] : '';
}

async function fromRss() {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const xml = await res.text();
  const channel = xml.slice(xml.indexOf('<channel>'));
  const items = [...channel.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);

  return items.map((item) => {
    let image = attr(item, 'enclosure', 'url') || attr(item, 'media:content', 'url');
    if (!image) {
      const body = tag(item, 'content:encoded') || tag(item, 'description');
      const m = decodeEntities(body).match(/<img[^>]+src="([^"]+)"/i);
      image = m ? m[1] : '';
    }
    return normalise({
      title: decodeEntities(tag(item, 'title')).trim(),
      link: tag(item, 'link'),
      author: decodeEntities(tag(item, 'dc:creator')),
      date: tag(item, 'pubDate'),
      image,
      excerpt: excerpt(tag(item, 'description')),
    });
  });
}

/* ----------------------------------------------------------------- rendering */

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

function renderCard(post, index, target) {
  const lead = index === 0 ? ' feed-card--lead' : '';
  const label = dateLabel(post.date, target.locale);
  const media = post.image
    ? `        <a class="feed-card__media" href="${esc(post.link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
          <img src="${esc(post.image)}" alt="" width="1200" height="675" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        </a>\n`
    : '';

  return `      <article class="feed-card${lead}">
${media}        <div class="feed-card__body">
          <p class="feed-card__meta">${
            label ? `<time datetime="${esc(post.dateISO)}">${esc(label)}</time>` : ''
          }${post.author ? ` · ${esc(post.author)}` : ''}</p>
          <h3><a href="${esc(post.link)}" target="_blank" rel="noopener">${esc(post.title)}</a></h3>
          <p>${esc(post.excerpt)}</p>
          <a class="feed-card__more" href="${esc(post.link)}" target="_blank" rel="noopener">${esc(target.more)}</a>
        </div>
      </article>`;
}

function renderSection(items, target) {
  if (!items.length) {
    return `      <p class="feed-empty">\n        ${target.emptyHtml}\n      </p>`;
  }
  return `    <div class="feed-grid">
${items.map((post, i) => renderCard(post, i, target)).join('\n')}
    </div>`;
}

/* --------------------------------------------------------------------- main */

(async () => {
  let posts = [];
  let source = '';

  try {
    posts = await fromArchive();
    source = 'archive API';
  } catch (err) {
    process.stdout.write(`  archive API unavailable (${err.message}); falling back to RSS\n`);
    try {
      posts = await fromRss();
      source = 'RSS feed';
    } catch (err2) {
      console.error(`\n  Could not reach CefalùNext: ${err2.message}`);
      console.error('  The magazine pages were left untouched (last good snapshot stays live).\n');
      process.exit(1);
    }
  }

  process.stdout.write(`Fetched ${posts.length} post(s) from the ${source}.\n`);

  const shown = posts.slice(0, MAX_ITEMS);
  if (posts.length > MAX_ITEMS) {
    process.stdout.write(`  showing the newest ${MAX_ITEMS}; ${posts.length - MAX_ITEMS} older not displayed\n`);
  } else if (posts.length < MAX_ITEMS) {
    process.stdout.write(`  note: only ${posts.length} published, so the grid shows ${posts.length} of ${MAX_ITEMS} slots\n`);
  }

  fs.writeFileSync(
    TARGET_JSON,
    JSON.stringify(
      { publication: { title: 'CefalùNext', link: PUBLICATION_URL }, source, total: posts.length, shown: shown.length, fetchedAt: new Date().toISOString(), items: shown },
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
    process.stdout.write(`    ${i + 1}. ${dateLabel(p.date, 'en-GB')} — ${p.title}\n`)
  );

  if (failed) process.exit(1);
})();
