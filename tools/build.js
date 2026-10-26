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
const EMAIL = 'divino.urbancellar@gmail.com';
/* Bókun runs the tasting bookings and takes payment (Stripe); this is the
   wine tasting experience on Divino's booking channel. */
const BOKUN_CHANNEL = 'dfe72029-8f73-462e-b8fe-37542603a627';
const BOKUN_WIDGET = `https://widgets.bokun.io/online-sales/${BOKUN_CHANNEL}/experience/1330801`;
const MAPS_URL = 'https://www.google.com/maps/dir/?api=1&destination=Divino+Urban+Cellar%2C+Via+Gibilmanna+16%2C+90015+Cefal%C3%B9+PA';

/* ---------------------------------------------------------------- copy */
const T = {
  en: {
    skip: 'Skip to content',
    strip: 'Free same-day delivery · Minimum order €50 · Order by WhatsApp',
    tastings: 'Tastings', atDivino: 'At Divino', atVilla: 'At your villa', tastingCefalu: 'Wine tasting in Cefalù', tastingPrivate: 'Private & group tastings',
    classes: 'Classes', wineClasses: 'Wine classes', cooking: 'Farm-to-table cooking',
    events: 'Events',
    products: 'Our Products', oil: 'Olivum Mariae olive oil', manna: 'Manna from the Madonie',
    delivered: 'Wines delivered', gift: 'Gift cards',
    countryside: 'The Countryside', ourLand: 'Our land', donnaMaria: 'Donna Maria products',
    magazine: 'Magazine', about: 'About Us', book: 'Book', home: 'Home',
    soon: 'Soon', menu: 'Menu', closeMenu: 'Close menu', openMenu: 'Open menu',
    langLabel: 'Language', itSoon: 'Italian version coming soon',
    tagline: 'Enoteca · Experiences · The Countryside',
    findUs: 'Find us', contact: 'Contact', explore: 'Explore',
    address: 'Via Gibilmanna 16<br>90015 Cefalù (PA), Italy',
    hours: 'Mon–Sat 10:00–14:00, 17:00–22:30<br>Sun 17:00–22:00',
    directions: 'Get directions', phone: 'WhatsApp +39 331 253 0729',
    reviewsLink: 'Google reviews', delivery: 'Delivery',
    piva: '© 2026 Divino Urban Cellar · P.IVA IT06950220829',
    cookieSettings: 'Cookie settings', privacy: 'Privacy',
    bkKick: 'Wine tasting at Divino', bkTitle: 'Book your tasting',
    bkWhen: 'Every day at 18:00. For 11:00, message us on WhatsApp.',
    bkAlt: 'Prefer to talk? <a href="' + WA + '?text=' + encodeURIComponent('Hello Divino! I have a question about a wine tasting.') + '" target="_blank" rel="noopener">Message us on WhatsApp</a> · <a href="tel:+393312530729">+39 331 253 0729</a>',
    bkErr: 'Online booking is not available right now. Please message us on WhatsApp and we will reply quickly.',
    bkClose: 'Close', stickyBook: 'Book a tasting',
    cookieTitle: 'This website uses cookies',
    cookieText: 'Only if you accept, we use Google Analytics and one small Divino cookie that counts returning visitors, so we can see how our site is used. No advertising or social media tracking cookies. Without your consent we still count page visits, anonymously and without cookies. Booking and map services may set their own cookies when you use them. You can change your choice at any time from “Cookie settings” in the footer.',
    accept: 'Accept', decline: 'Decline',
    ageQ: 'Are you 18 or older?', ageSub: 'You must be of legal drinking age to enter the Divino website.', ageYes: 'Yes', ageNo: 'No', ageSorry: 'Sorry, you need to be 18 or older to visit our website. We hope to welcome you at Divino one day.',
    revKick: 'Google reviews', revTitle: 'What our guests say', revBadge: '<span data-g-rating>4.7</span> on Google · <span data-g-count>130+</span> reviews · 4.9 on GetYourGuide', revAll: 'Read all our reviews on Google', revBy: 'Google review',
    igKick: 'Instagram', igTitle: 'Follow us on Instagram', igFollow: 'Open Instagram',
    lKick: 'Letters from Sicily', lTitle: 'Stories, events and new wines, once a month',
    lText: 'Join our letters and be the first to hear about tastings, evenings at Divino and news from the countryside.',
    lEmail: 'Your email', lSign: 'Sign up', lSmall: 'One email a month. No spam, ever.',
    cKick: 'Visit Divino', cTitle: 'Come and taste with us', cText: 'Tastings daily at 18:00 · 11:00 on request only',
    cBook: 'Book a tasting', cWa: 'WhatsApp +39 331 253 0729', cOrder: 'Order wine for delivery',
  },
  it: {
    skip: 'Vai al contenuto',
    strip: 'Consegna gratuita in giornata · Ordine minimo €50 · Ordina su WhatsApp',
    tastings: 'Degustazioni', atDivino: 'Da Divino', atVilla: 'Nella tua villa', tastingCefalu: 'Degustazione a Cefalù', tastingPrivate: 'Degustazioni private e di gruppo',
    classes: 'Corsi', wineClasses: 'Corsi di vino', cooking: 'Cucina dal campo alla tavola',
    events: 'Eventi',
    products: 'I nostri prodotti', oil: 'Olio Olivum Mariae', manna: 'Manna delle Madonie',
    delivered: 'Vini a domicilio', gift: 'Carte regalo',
    countryside: 'La Campagna', ourLand: 'La nostra terra', donnaMaria: 'Prodotti Donna Maria',
    magazine: 'Magazine', about: 'Chi siamo', book: 'Prenota', home: 'Home',
    soon: 'In arrivo', menu: 'Menu', closeMenu: 'Chiudi il menu', openMenu: 'Apri il menu',
    langLabel: 'Lingua', itSoon: 'Versione italiana in arrivo',
    tagline: 'Enoteca · Esperienze · La Campagna',
    findUs: 'Dove siamo', contact: 'Contatti', explore: 'Esplora',
    address: 'Via Gibilmanna 16<br>90015 Cefalù (PA), Italia',
    hours: 'Lun–Sab 10:00–14:00, 17:00–22:30<br>Dom 17:00–22:00',
    directions: 'Indicazioni stradali', phone: 'WhatsApp +39 331 253 0729',
    reviewsLink: 'Recensioni Google', delivery: 'Consegna',
    piva: '© 2026 Divino Urban Cellar · P.IVA IT06950220829',
    cookieSettings: 'Impostazioni cookie', privacy: 'Privacy',
    bkKick: 'Degustazione da Divino', bkTitle: 'Prenota la tua degustazione',
    bkWhen: 'Ogni giorno alle 18:00. Per le 11:00, scrivici su WhatsApp.',
    bkAlt: 'Preferisci parlarci? <a href="' + WA + '?text=' + encodeURIComponent('Ciao Divino! Ho una domanda su una degustazione.') + '" target="_blank" rel="noopener">Scrivici su WhatsApp</a> · <a href="tel:+393312530729">+39 331 253 0729</a>',
    bkErr: 'La prenotazione online non è disponibile in questo momento. Scrivici su WhatsApp e ti risponderemo subito.',
    bkClose: 'Chiudi', stickyBook: 'Prenota una degustazione',
    cookieTitle: 'Questo sito usa i cookie',
    cookieText: 'Solo se acconsenti, usiamo Google Analytics e un piccolo cookie di Divino che conta i visitatori di ritorno, per capire come viene usato il sito. Nessun cookie pubblicitario o di tracciamento dei social media. Senza il tuo consenso contiamo comunque le visite alle pagine, in forma anonima e senza cookie. I servizi di prenotazione e di mappa possono impostare propri cookie quando li usi. Puoi cambiare la tua scelta in qualsiasi momento da “Impostazioni cookie” nel footer.',
    accept: 'Accetta', decline: 'Rifiuta',
    ageQ: 'Hai almeno 18 anni?', ageSub: 'Per entrare nel sito di Divino devi avere l’età legale per bere alcolici.', ageYes: 'Sì', ageNo: 'No', ageSorry: 'Ci dispiace, devi avere almeno 18 anni per visitare il nostro sito. Speriamo di accoglierti da Divino un giorno.',
    revKick: 'Recensioni Google', revTitle: 'Cosa dicono i nostri ospiti', revBadge: '<span data-g-rating>4,7</span> su Google · <span data-g-count>oltre 130</span> recensioni · 4,9 su GetYourGuide', revAll: 'Leggi tutte le recensioni su Google', revBy: 'Recensione Google',
    igKick: 'Instagram', igTitle: 'Seguici su Instagram', igFollow: 'Apri Instagram',
    lKick: 'Lettere dalla Sicilia', lTitle: 'Storie, eventi e nuovi vini, una volta al mese',
    lText: 'Iscriviti alle nostre lettere e scopri per primo degustazioni, serate da Divino e novità dalla campagna.',
    lEmail: 'La tua email', lSign: 'Iscriviti', lSmall: 'Una email al mese. Mai spam.',
    cKick: 'Vieni da Divino', cTitle: 'Vieni a degustare con noi', cText: 'Degustazioni ogni giorno alle 18:00 · alle 11:00 solo su richiesta',
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
const logo = (size) => `<span class="wm" style="--s:${size}px" translate="no"><span class="sr-only">Divino Urban Cellar</span><span class="w" aria-hidden="true"><span>DIV</span>${GLASS}<span>NO</span></span><span class="u" aria-hidden="true">URBAN CELLAR</span></span>`;
const IG_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#fff"/></svg>';

function menu(t, lang) {
  const L = (h) => localise(h, lang);
  return {
    tastings: [[L('tastings.html'), t.atDivino], [L('wine-tasting-cefalu.html'), t.tastingCefalu], [L('private-group-wine-tasting.html'), t.tastingPrivate], [L('tasting-villa.html'), t.atVilla]],
    classes: [[L('wine-classes.html'), t.wineClasses, true], [L('cooking-classes.html'), t.cooking, true]],
    products: [[L('products.html#countryside'), t.oil], [L('products.html#manna'), t.manna], [L('delivery.html'), t.delivered], [L('products.html#gift-cards'), t.gift]],
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
  <nav class="nav r" aria-label="Main, right">${dd('products', t.products)}${dd('countryside', t.countryside)}${link('magazine', 'magazine.html', t.magazine)}${link('about', 'about.html', t.about)}</nav>
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
   <div id="contact"><h4>${t.contact}</h4><a href="${WA}" target="_blank" rel="noopener">${t.phone}</a><a href="${IG_URL}" target="_blank" rel="noopener">Instagram @divino_cantinaurbana</a><a href="https://www.facebook.com/divinourbancellar" target="_blank" rel="noopener">Facebook Divino Cantina Urbana</a><a href="https://www.youtube.com/@DivinoUrbanCellar" target="_blank" rel="noopener">YouTube @DivinoUrbanCellar</a><a href="mailto:${EMAIL}">${EMAIL}</a><a href="${REVIEWS_URL}" target="_blank" rel="noopener">${t.reviewsLink}</a></div>
   <div><h4>${t.explore}</h4><a href="${L('tastings.html')}">${t.tastings}</a><a href="${L('wine-classes.html')}">${t.classes}</a><a href="${L('events.html')}">${t.events}</a><a href="${L('products.html')}">${t.products}</a><a href="${L('countryside.html')}">${t.countryside}</a><a href="${L('magazine.html')}">${t.magazine}</a><a href="${L('delivery.html')}">${t.delivery}</a><a href="${L('products.html#gift-cards')}">${t.gift}</a></div>
  </div>
  <div class="legal"><span>${t.piva}</span><span><a href="${L('privacy.html')}">${t.privacy}</a> · <button type="button" data-cookie-settings>${t.cookieSettings}</button> · ${langSwitch(page, 'll').replace(/^<div class="ll"[^>]*>|<\/div>$/g, '')}</span></div>
 </div>
</footer>

<div class="bk" id="booking" role="dialog" aria-modal="true" aria-labelledby="bk-title" aria-hidden="true">
 <div class="scrim" data-close-booking></div>
 <div class="box">
  <button class="x" type="button" data-close-booking aria-label="${t.bkClose}">×</button>
  <span class="kick">${t.bkKick}</span>
  <h2 id="bk-title">${t.bkTitle}</h2>
  <p class="when">${t.bkWhen}</p>
  <div class="bkw"><div class="bokunWidget" data-src="${BOKUN_WIDGET}"></div></div>
  <p class="err" role="alert" hidden>${t.bkErr}</p>
  <p class="alt">${t.bkAlt}</p>
 </div>
</div>

<div class="cookie" id="cookie" role="dialog" aria-label="${t.cookieTitle}">
 <p><b>${t.cookieTitle}</b>${t.cookieText}</p>
 <div class="acts"><button class="btn sm" type="button" data-accept>${t.accept}</button><button class="btn sm o" type="button" data-decline>${t.decline}</button></div>
</div>
<a class="sbook btn" href="${L('tastings.html')}#book" data-book>${t.stickyBook}</a>
<div class="age" id="age" role="dialog" aria-modal="true" aria-labelledby="age-q" aria-describedby="age-s">
 <div class="box">${logo(40)}<p class="q" id="age-q">${t.ageQ}</p><p class="s" id="age-s">${t.ageSub}</p><div class="acts"><button class="btn" type="button" data-age="yes">${t.ageYes}</button><button class="btn o" type="button" data-age="no">${t.ageNo}</button></div><p class="sorry" role="alert" hidden>${t.ageSorry}</p></div>
</div>
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

const IG_PHOTOS = [['ig-1', 'Sicilian bottles on the shelf at Divino'], ['ig-2', 'A toast at a Divino evening'], ['ig-3', 'Guests at the long table during a tasting'], ['ig-4', 'The Marino Abate evening at Divino'], ['ig-5', 'The long table set for a tasting'], ['ig-6', 'Guests outside Divino on Via Gibilmanna']];
function instagram(page) {
  const t = T[page.lang];
  return `
<section class="cream bt"><div class="wrap blk">
 <p class="caps kick">${t.igKick}</p><h2>${t.igTitle}</h2>
 <p class="handle"><a href="${IG_URL}" target="_blank" rel="noopener">@divino_cantinaurbana</a></p>
 <div class="igs">${IG_PHOTOS.map(([f, alt]) => `<a class="ig" href="${IG_URL}" target="_blank" rel="noopener"><img src="photos/${f}.webp" alt="${alt}" width="300" height="240" loading="lazy" decoding="async"><span>${IG_ICON}</span></a>`).join('')}</div>
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
<link rel="preconnect" href="https://widgets.bokun.io" crossorigin>
<link rel="stylesheet" href="chrome.css">
<script>/* Age check: cover the page until the visitor confirms they are 18+ (once per visit). */try{if(sessionStorage.getItem('dv-age')!=='yes')document.documentElement.classList.add('ag')}catch(e){document.documentElement.classList.add('ag')}</script>
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

/* Browser auto-translation turns "Divino" into "Divine" and "La Campagna"
   into "The Campaign". Every name below is wrapped in translate="no" wherever
   it appears as visible text in the body (never inside tags, scripts or
   styles); already-wrapped names are left alone, so reruns change nothing. */
const NO_TRANSLATE = /Divino Urban Cellar|Divino|La Campagna|Olivum Mariae/g;
function protectNames(html) {
  const b = html.search(/<body[\s>]/);
  if (b < 0) return html;
  const parts = html.slice(b).split(/(<[^>]*>)/);
  let skip = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      if (/^<(script|style|textarea|title)[\s>]/i.test(p)) skip++;
      else if (/^<\/(script|style|textarea|title)>/i.test(p)) skip = Math.max(0, skip - 1);
      continue;
    }
    if (skip || !p) continue;
    const prev = parts[i - 1] || '';
    parts[i] = p.replace(NO_TRANSLATE, (m, at) => (at === 0 && /translate="no"/.test(prev) && /^<span/.test(prev) && p.slice(m.length).trim() === '' ? m : `<span translate="no">${m}</span>`));
  }
  return html.slice(0, b) + parts.join('');
}

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
  }).replace(/^[\s\S]*$/, protectNames);
  if (out !== src) { fs.writeFileSync(full, out); changed++; }
}
console.log(`Stamped shared blocks into ${changed} page(s).`);
