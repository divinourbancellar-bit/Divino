#!/usr/bin/env node
/* Stamps the shared parts of the site into every page, so the menu, footer,
   booking window and repeated sections stay identical everywhere.

   Usage:  node tools/build.js

   Each page marks the spots to fill with comment pairs, e.g.
     <!-- dv:header --> ... <!-- /dv:header -->
   Everything between a pair is regenerated on each run — edit the templates
   below, never the stamped copies inside the pages.

   Blocks: head, header, footer, reviews, instagram, letters, close
   A page says which menu item it belongs to with
     <meta name="dv-section" content="tastings">
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WA = 'https://wa.me/393312530729';
const REVIEWS_URL = 'https://search.google.com/local/reviews?placeid=ChIJbfUTBsQ7FxMRd-LJ0zExPYU';
const IG_URL = 'https://www.instagram.com/divino_cantinaurbana/';
const MAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=Divino+Urban+Cellar%2C+Via+Gibilmanna+16%2C+90015+Cefal%C3%B9+PA';

/* ---------------------------------------------------------------- copy */
const T = {
  en: {
    skip: 'Skip to content',
    strip: 'Free same-day delivery · Minimum order €50 · Order by WhatsApp',
    tastings: 'Tastings', atDivino: 'At Divino', atVilla: 'At your villa', tastingCefalu: 'Wine tasting in Cefalù', tastingPrivate: 'Private & group tastings',
    classes: 'Classes', wineClasses: 'Wine classes', cooking: 'Farm-to-table cooking',
    events: 'Events',
    products: 'Our Products', specialty: 'Divino Specialty Products', fromCountryside: 'From our Countryside',
    delivered: 'Wines delivered', gift: 'Gift cards',
    countryside: 'The Countryside', ourLand: 'Our land', donnaMaria: 'Donna Maria products',
    magazine: 'Magazine', about: 'About Us', book: 'Book', home: 'Home',
    soon: 'Soon', menu: 'Menu', closeMenu: 'Close menu', openMenu: 'Open menu',
    langLabel: 'Language', itSoon: 'Italian version coming soon',
    tagline: 'Enoteca · Experiences · The Countryside',
    findUs: 'Find us', contact: 'Contact', explore: 'Explore',
    address: 'Via Gibilmanna 16<br>90015 Cefalù (PA), Italy',
    hours: 'Mon–Sat 10:00–14:00, 17:00–22:30<br>Sun 10:00–13:00, 17:00–22:00',
    directions: 'Get directions', phone: 'Phone &amp; WhatsApp +39 331 253 0729',
    email: '[email]', reviewsLink: 'Google reviews', delivery: 'Delivery',
    piva: '© 2026 Divino Urban Cellar · P.IVA <span class="tbc">[number]</span>',
    cookieSettings: 'Cookie settings',
    bkKick: 'Wine tasting at Divino', bkTitle: 'Book your tasting',
    bkWhen: 'Every day at 11:00 and 18:00, at the long table on Via Gibilmanna.',
    bkQ: 'How many guests?', bkLess: 'One guest fewer', bkMore: 'One guest more',
    bkNext: 'Choose your day and time', bkAlt: 'Prefer to talk? <a href="' + WA + '?text=' + encodeURIComponent('Hello Divino! I have a question about a wine tasting.') + '" target="_blank" rel="noopener">Message us on WhatsApp</a> · <a href="tel:+393312530729">+39 331 253 0729</a>',
    bkErr: 'Online booking is not available right now. Please message us on WhatsApp and we will reply quickly.',
    bkClose: 'Close', stickyBook: 'Book a tasting',
    musicOn: 'Play soft jazz', musicOff: 'Pause the music',
    cookieTitle: 'This website uses cookies',
    cookieText: 'Only if you accept, we use Google Analytics and one small Divino cookie that counts returning visitors, so we can see how our site is used. No advertising or social media tracking cookies. Without your consent we still count page visits, anonymously and without cookies. Booking and map services may set their own cookies when you use them. You can change your choice at any time from “Cookie settings” in the footer.',
    accept: 'Accept', decline: 'Decline',
    revKick: 'Google reviews', revTitle: 'What our guests say', revBadge: '4.5 on Google · 120+ reviews', revAll: 'Read all our reviews on Google', revBy: 'Google review',
    igKick: 'Instagram', igTitle: 'Our gallery, every day', igFollow: 'Follow us on Instagram',
    lKick: 'Letters from Sicily', lTitle: 'Stories, events and new wines, once a month',
    lText: 'Join our letters and be the first to hear about tastings, evenings at Divino and news from the countryside.',
    lEmail: 'Your email', lSign: 'Sign up', lSmall: 'One email a month. No spam, ever.',
    cKick: 'Visit Divino', cTitle: 'Come and taste with us', cText: 'Tastings every day at 11:00 and 18:00 at the long table on Via Gibilmanna, Cefalù.',
    cBook: 'Book a tasting', cWa: 'WhatsApp +39 331 253 0729', cOrder: 'Order wine for delivery',
  },
  it: {
    skip: 'Vai al contenuto',
    strip: 'Consegna gratuita in giornata · Ordine minimo €50 · Ordina su WhatsApp',
    tastings: 'Degustazioni', atDivino: 'Da Divino', atVilla: 'Nella tua villa', tastingCefalu: 'Degustazione a Cefalù', tastingPrivate: 'Degustazioni private e di gruppo',
    classes: 'Corsi', wineClasses: 'Corsi di vino', cooking: 'Cucina dal campo alla tavola',
    events: 'Eventi',
    products: 'I nostri prodotti', specialty: 'Prodotti Divino', fromCountryside: 'Dalla nostra campagna',
    delivered: 'Vini a domicilio', gift: 'Carte regalo',
    countryside: 'La Campagna', ourLand: 'La nostra terra', donnaMaria: 'Prodotti Donna Maria',
    magazine: 'Magazine', about: 'Chi siamo', book: 'Prenota', home: 'Home',
    soon: 'Presto', menu: 'Menu', closeMenu: 'Chiudi il menu', openMenu: 'Apri il menu',
    langLabel: 'Lingua', itSoon: 'Versione italiana in arrivo',
    tagline: 'Enoteca · Esperienze · La Campagna',
    findUs: 'Dove siamo', contact: 'Contatti', explore: 'Esplora',
    address: 'Via Gibilmanna 16<br>90015 Cefalù (PA), Italia',
    hours: 'Lun–Sab 10:00–14:00, 17:00–22:30<br>Dom 10:00–13:00, 17:00–22:00',
    directions: 'Indicazioni stradali', phone: 'Telefono e WhatsApp +39 331 253 0729',
    email: '[email]', reviewsLink: 'Recensioni Google', delivery: 'Consegna',
    piva: '© 2026 Divino Urban Cellar · P.IVA <span class="tbc">[numero]</span>',
    cookieSettings: 'Impostazioni cookie',
    bkKick: 'Degustazione da Divino', bkTitle: 'Prenota la tua degustazione',
    bkWhen: 'Ogni giorno alle 11:00 e alle 18:00, al lungo tavolo in Via Gibilmanna.',
    bkQ: 'Quanti ospiti?', bkLess: 'Un ospite in meno', bkMore: 'Un ospite in più',
    bkNext: 'Scegli giorno e orario', bkAlt: 'Preferisci parlarci? <a href="' + WA + '?text=' + encodeURIComponent('Ciao Divino! Ho una domanda su una degustazione.') + '" target="_blank" rel="noopener">Scrivici su WhatsApp</a> · <a href="tel:+393312530729">+39 331 253 0729</a>',
    bkErr: 'La prenotazione online non è disponibile in questo momento. Scrivici su WhatsApp e ti risponderemo subito.',
    bkClose: 'Chiudi', stickyBook: 'Prenota una degustazione',
    musicOn: 'Ascolta un po’ di jazz', musicOff: 'Metti in pausa la musica',
    cookieTitle: 'Questo sito usa i cookie',
    cookieText: 'Solo se acconsenti, usiamo Google Analytics e un piccolo cookie di Divino che conta i visitatori di ritorno, per capire come viene usato il sito. Nessun cookie pubblicitario o di tracciamento dei social media. Senza il tuo consenso contiamo comunque le visite alle pagine, in forma anonima e senza cookie. I servizi di prenotazione e di mappa possono impostare propri cookie quando li usi. Puoi cambiare la tua scelta in qualsiasi momento da “Impostazioni cookie” nel footer.',
    accept: 'Accetta', decline: 'Rifiuta',
    revKick: 'Recensioni Google', revTitle: 'Cosa dicono i nostri ospiti', revBadge: '4,5 su Google · oltre 120 recensioni', revAll: 'Leggi tutte le recensioni su Google', revBy: 'Recensione Google',
    igKick: 'Instagram', igTitle: 'La nostra galleria, ogni giorno', igFollow: 'Seguici su Instagram',
    lKick: 'Lettere dalla Sicilia', lTitle: 'Storie, eventi e nuovi vini, una volta al mese',
    lText: 'Iscriviti alle nostre lettere e scopri per primo degustazioni, serate da Divino e novità dalla campagna.',
    lEmail: 'La tua email', lSign: 'Iscriviti', lSmall: 'Una email al mese. Mai spam.',
    cKick: 'Vieni da Divino', cTitle: 'Vieni a degustare con noi', cText: 'Degustazioni ogni giorno alle 11:00 e alle 18:00 al lungo tavolo in Via Gibilmanna, Cefalù.',
    cBook: 'Prenota una degustazione', cWa: 'WhatsApp +39 331 253 0729', cOrder: 'Ordina vino a domicilio',
  },
};

/* Pages that exist in Italian get their own -it.html file; links from an
   Italian page go to the Italian version where there is one. */
const pageExists = (f) => fs.existsSync(path.join(ROOT, f));
const localise = (href, lang) => {
  if (lang !== 'it') return href;
  const [file, hash] = href.split('#');
  const it = file.replace(/\.html$/, '-it.html');
  return pageExists(it) ? it + (hash ? '#' + hash : '') : href;
};

/* -------------------------------------------------------------- pieces */
const GLASS = '<svg viewBox="0 0 20 40" aria-hidden="true" focusable="false"><path d="M3 2 H17 C17 12 14 17 10 18 C6 17 3 12 3 2 Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.2 8 H15.8 C15.3 13 13 16.2 10 16.8 C7 16.2 4.7 13 4.2 8 Z" fill="#6E2A34"/><line x1="10" y1="18" x2="10" y2="35" stroke="currentColor" stroke-width="1.3"/><path d="M4 38 C6 35.5 14 35.5 16 38" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const logo = (size) => `<span class="wm" style="--s:${size}px"><span class="w"><span>DIV</span>${GLASS}<span>NO</span></span><span class="u">URBAN CELLAR</span></span>`;
const IG_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#fff"/></svg>';

function menu(t, lang) {
  const L = (h) => localise(h, lang);
  return {
    tastings: [[L('tastings.html'), t.atDivino], [L('wine-tasting-cefalu.html'), t.tastingCefalu], [L('private-group-wine-tasting.html'), t.tastingPrivate], [L('tasting-villa.html'), t.atVilla]],
    classes: [[L('wine-classes.html'), t.wineClasses], [L('cooking-classes.html'), t.cooking, true]],
    products: [[L('products.html#specialty'), t.specialty], [L('products.html#countryside'), t.fromCountryside], [L('delivery.html'), t.delivered], [L('products.html#gift-cards'), t.gift]],
    countryside: [[L('countryside.html'), t.ourLand], [L('countryside.html#donna-maria'), t.donnaMaria]],
  };
}

function langSwitch(page, cls) {
  const { lang, file } = page;
  const enFile = lang === 'it' ? file.replace(/-it\.html$/, '.html') : file;
  const itFile = lang === 'it' ? file : file.replace(/\.html$/, '-it.html');
  const hasIt = lang === 'it' || pageExists(itFile);
  const enHref = enFile === 'index.html' ? './' : enFile;
  const en = lang === 'en'
    ? '<span class="on" aria-current="true">EN</span>'
    : `<a href="${enHref}" hreflang="en" lang="en" data-lang-switch="en">EN</a>`;
  const it = lang === 'it'
    ? '<span class="on" aria-current="true">IT</span>'
    : hasIt
      ? `<a href="${itFile}" hreflang="it" lang="it" data-lang-switch="it">IT</a>`
      : `<span class="off" title="${T.en.itSoon}">IT</span>`;
  return `<div class="${cls}" aria-label="${T[lang].langLabel}">${en} · ${it}</div>`;
}

function header(page) {
  const t = T[page.lang], m = menu(t, page.lang), sec = page.section;
  const cur = (href) => {
    const f = href.split('#')[0];
    return f === page.file && !href.includes('#') ? ' aria-current="page"' : '';
  };
  const dd = (key, label) => `<div class="dd${sec === key ? ' cur' : ''}"><button type="button" aria-expanded="false" aria-haspopup="true">${label}</button><div class="sub">${m[key].map(([h, l, soon]) => `<a href="${h}"${cur(h)}>${l}${soon ? `<span class="soon-dot">${t.soon}</span>` : ''}</a>`).join('')}</div></div>`;
  const link = (key, href, label) => `<a href="${localise(href, page.lang)}"${sec === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const home = page.lang === 'it' ? localise('index.html', 'it') : './';
  const homeHref = home === 'index.html' ? './' : home;
  const grp = (key, label) => `<div class="grp"><p>${label}</p>${m[key].map(([h, l, soon]) => `<a class="s" href="${h}"${cur(h)}>${l}${soon ? `<span class="soon-dot">${t.soon}</span>` : ''}</a>`).join('')}</div>`;
  return `
<a class="skip" href="#main">${t.skip}</a>
<a class="strip" href="${localise('delivery.html', page.lang)}">${t.strip}</a>
<header class="dvh">
 <div class="hdr">
  ${langSwitch(page, 'lang')}
  <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="drawer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" d="M3 6h18M3 12h18M3 18h18"/></svg><span>${t.menu}</span><b class="sr-only">${t.openMenu}</b></button>
  <nav class="nav l" aria-label="Main, left">${dd('tastings', t.tastings)}${dd('classes', t.classes)}${link('events', 'events.html', t.events)}</nav>
  <a class="logo" href="${homeHref}" aria-label="Divino Urban Cellar, ${t.home}">${logo(46)}</a>
  <nav class="nav r" aria-label="Main, right">${dd('products', t.products)}${dd('countryside', t.countryside)}${link('magazine', 'magazine.html', t.magazine)}${link('about', 'about.html', t.about)}<a class="btn sm" href="${localise('tastings.html', page.lang)}#book" data-book>${t.book}</a></nav>
  <a class="btn sm mbook" href="${localise('tastings.html', page.lang)}#book" data-book>${t.book}</a>
 </div>
</header>
<div class="drawer" id="drawer" aria-hidden="true">
 <div class="scrim" data-close-drawer></div>
 <nav class="panel" aria-label="${t.menu}">
  <div class="top"><a href="${homeHref}" aria-label="Divino Urban Cellar, ${t.home}">${logo(30)}</a><button class="close" type="button" data-close-drawer aria-label="${t.closeMenu}">×</button></div>
  ${grp('tastings', t.tastings)}${grp('classes', t.classes)}
  <div class="grp">${link('events', 'events.html', t.events)}</div>
  ${grp('products', t.products)}${grp('countryside', t.countryside)}
  <div class="grp">${link('magazine', 'magazine.html', t.magazine)}${link('about', 'about.html', t.about)}</div>
  <a class="btn" href="${localise('tastings.html', page.lang)}#book" data-book>${t.book}</a>
  ${langSwitch(page, 'dl')}
 </nav>
</div>
`;
}

function footer(page) {
  const t = T[page.lang], L = (h) => localise(h, page.lang);
  return `
<footer class="dvf">
 <div class="fw">
  <div class="fgrid">
   <div>${logo(34)}<p>${t.tagline}</p></div>
   <div><h4>${t.findUs}</h4><p>${t.address}</p><p>${t.hours}</p><a class="ul" href="${MAPS_URL}" target="_blank" rel="noopener">${t.directions}</a></div>
   <div id="contact"><h4>${t.contact}</h4><a href="${WA}" target="_blank" rel="noopener">${t.phone}</a><a href="${IG_URL}" target="_blank" rel="noopener">Instagram @divino_cantinaurbana</a><a href="https://www.facebook.com/divinourbancellar" target="_blank" rel="noopener">Facebook Divino Cantina Urbana</a><a href="https://www.youtube.com/@DivinoUrbanCellar" target="_blank" rel="noopener">YouTube @DivinoUrbanCellar</a><p><span class="tbc">${t.email}</span></p><a href="${REVIEWS_URL}" target="_blank" rel="noopener">${t.reviewsLink}</a></div>
   <div><h4>${t.explore}</h4><a href="${L('tastings.html')}">${t.tastings}</a><a href="${L('wine-classes.html')}">${t.classes}</a><a href="${L('events.html')}">${t.events}</a><a href="${L('products.html')}">${t.products}</a><a href="${L('countryside.html')}">${t.countryside}</a><a href="${L('magazine.html')}">${t.magazine}</a><a href="${L('delivery.html')}">${t.delivery}</a><a href="${L('products.html#gift-cards')}">${t.gift}</a></div>
  </div>
  <div class="legal"><span>${t.piva}</span><span><button type="button" data-cookie-settings>${t.cookieSettings}</button> · ${langSwitch(page, 'll').replace(/^<div class="ll"[^>]*>|<\/div>$/g, '')}</span></div>
 </div>
</footer>

<div class="bk" id="booking" role="dialog" aria-modal="true" aria-labelledby="bk-title" aria-hidden="true">
 <div class="scrim" data-close-booking></div>
 <div class="box">
  <button class="x" type="button" data-close-booking aria-label="${t.bkClose}">×</button>
  <span class="kick">${t.bkKick}</span>
  <h2 id="bk-title">${t.bkTitle}</h2>
  <p class="when">${t.bkWhen}</p>
  <p class="q">${t.bkQ}</p>
  <div class="stepper"><button type="button" data-step="-1" aria-label="${t.bkLess}">−</button><output aria-live="polite">2</output><button type="button" data-step="1" aria-label="${t.bkMore}">+</button></div>
  <p class="total" aria-live="polite"></p>
  <button class="btn" type="button" data-confirm>${t.bkNext}</button>
  <p class="err" role="alert" hidden>${t.bkErr}</p>
  <p class="alt">${t.bkAlt}</p>
 </div>
</div>

<div class="cookie" id="cookie" role="dialog" aria-label="${t.cookieTitle}">
 <p><b>${t.cookieTitle}</b>${t.cookieText}</p>
 <div class="acts"><button class="btn sm" type="button" data-accept>${t.accept}</button><button class="btn sm o" type="button" data-decline>${t.decline}</button></div>
</div>
<a class="sbook btn" href="${L('tastings.html')}#book" data-book>${t.stickyBook}</a>
<button class="music" id="music" type="button" aria-pressed="false" aria-label="${t.musicOn}" title="${t.musicOn}" data-on="${t.musicOn}" data-off="${t.musicOff}" data-src="audio/cafe-jazz.mp3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="w" d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4"/><path class="x" d="M4 20 20 4"/></svg><i aria-hidden="true">♪</i><i aria-hidden="true">♫</i><i aria-hidden="true">♪</i></button>
<script src="site.js" defer></script>
`;
}

const REVIEWS = [
  ['This place is incredible! The owner Massimo is so knowledgeable and personable. The wines offered are incredibly delicious and priced very well.', 'Alex Dalla Zanna'],
  ['We already loved Sicily. We didn’t think it was possible to love it more. Then we walked into Divino Urban Cellar and found a place as warm and memorable as the territory itself.', 'Mike Page'],
  ['What a transformation! The service is friendly and the wine selection is exceptional.', 'Allan Baynton'],
  ['Absolutely adore this wine shop. They have an incredible curation of wines (with a focus on Sicilian) plus they’ve kept the very affordable tap wine.', 'Sarah Moore'],
];
function reviews(page) {
  const t = T[page.lang];
  return `
<section class="white bt"><div class="wrap blk">
 <p class="caps kick">${t.revKick}</p><h2>${t.revTitle}</h2>
 <p class="rbadge"><b aria-hidden="true">★★★★★</b>${t.revBadge}</p>
 <div class="revs">${REVIEWS.map(([q, n]) => `<figure class="rev rv"><span class="stars" aria-label="5 stars">★★★★★</span><blockquote lang="en">“${q}”</blockquote><figcaption><b>${n}</b> · ${t.revBy}</figcaption></figure>`).join('')}</div>
 <div class="c"><a class="btn o" href="${REVIEWS_URL}" target="_blank" rel="noopener">${t.revAll}</a></div>
</div></section>
`;
}

const IG_PHOTOS = [['long-table', 'The long table at Divino'], ['wine-shelves', 'The wine shelves'], ['products-plants', 'Sicilian products among the plants'], ['shop-counter', 'The shop and counter'], ['countryside-lavender', 'Massimo in the lavender field'], ['cefalu', 'Cefalù from the sea']];
function instagram(page) {
  const t = T[page.lang];
  return `
<section class="cream bt"><div class="wrap blk">
 <p class="caps kick">${t.igKick}</p><h2>${t.igTitle}</h2>
 <p class="handle"><a href="${IG_URL}" target="_blank" rel="noopener">@divino_cantinaurbana</a></p>
 <div class="igs">${IG_PHOTOS.map(([f, alt]) => `<a class="ig" href="${IG_URL}" target="_blank" rel="noopener"><img src="photos/${f}-thumb.webp" alt="${alt}" width="300" height="240" loading="lazy" decoding="async"><span>${IG_ICON}</span></a>`).join('')}</div>
 <div class="c"><a class="btn" href="${IG_URL}" target="_blank" rel="noopener">${t.igFollow}</a></div>
</div></section>
`;
}

function letters(page) {
  const t = T[page.lang];
  return `
<section class="letters">
 <p class="caps kick">${t.lKick}</p><h2>${t.lTitle}</h2>
 <p class="d">${t.lText}</p>
 <form class="signup" data-signup="Letters from Sicily"><label class="sr-only" for="letters-email">${t.lEmail}</label><input id="letters-email" type="email" name="email" placeholder="${t.lEmail}" autocomplete="email" required><button class="btn" type="submit">${t.lSign}</button></form>
 <p class="form-msg" aria-live="polite"></p>
 <small>${t.lSmall}</small>
</section>
`;
}

function close(page) {
  const t = T[page.lang], L = (h) => localise(h, page.lang);
  return `
<section class="ctab"><p class="caps kick">${t.cKick}</p><h2>${t.cTitle}</h2><p class="d">${t.cText}</p>
 <div class="actions"><a class="btn" href="${L('tastings.html')}#book" data-book>${t.cBook}</a><a class="btn o" href="${WA}" data-wa="${page.lang === 'it' ? 'Ciao Divino!' : 'Hello Divino!'}">${t.cWa}</a><a class="btn o" href="${L('delivery.html')}">${t.cOrder}</a></div></section>
`;
}

function head(page) {
  return `
<link rel="preload" href="fonts/cormorant-garamond-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/eb-garamond-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://app.cal.com" crossorigin>
<link rel="stylesheet" href="chrome.css">
`;
}

function ga() {
  return `
<!-- Google Analytics, consent-gated: nothing is stored until the visitor accepts. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });
  gtag('js', new Date());
  gtag('config', 'G-31NB1K438E');
  (function () {
    var loaded = false;
    function load() { if (loaded) return; loaded = true; var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=G-31NB1K438E'; document.head.appendChild(s); }
    ['pointerdown', 'keydown', 'scroll'].forEach(function (e) { window.addEventListener(e, load, { once: true, passive: true }); });
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 6000 }); else setTimeout(load, 5000);
  })();
</script>
`;
}

const BLOCKS = { ga, head, header, footer, reviews, instagram, letters, close };

/* ---------------------------------------------------------------- run */
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !f.startsWith('_'));
let changed = 0;
for (const file of files) {
  const full = path.join(ROOT, file);
  const src = fs.readFileSync(full, 'utf8');
  if (!src.includes('<!-- dv:')) continue;
  const lang = (src.match(/<html[^>]*\slang="([a-z]{2})"/) || [])[1] === 'it' ? 'it' : 'en';
  const section = (src.match(/<meta name="dv-section" content="([^"]+)"/) || [])[1] || '';
  const page = { file, lang, section };
  const out = src.replace(/<!-- dv:(\w+) -->[\s\S]*?<!-- \/dv:\1 -->/g, (m, name) => {
    if (!BLOCKS[name]) throw new Error(`${file}: unknown block dv:${name}`);
    return `<!-- dv:${name} -->${BLOCKS[name](page)}<!-- /dv:${name} -->`;
  });
  if (out !== src) { fs.writeFileSync(full, out); changed++; }
}
console.log(`Stamped shared blocks into ${changed} page(s).`);
