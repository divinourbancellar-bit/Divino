/* Divino Urban Cellar — shared behaviour for every page:
   menu, booking (Cal.com), gallery slider, Letters sign-up, cookie consent. */
(function () {
  'use strict';

  var IT = document.documentElement.lang === 'it';
  var WHATSAPP = '393312530729';
  var waLink = function (text) {
    return 'https://wa.me/' + WHATSAPP + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  /* ---------- Divino database (Supabase) ----------
     The publishable key is meant to be public: the database only lets
     visitors add rows (sign-ups, page stats); reading needs an admin login. */
  var SB_URL = 'https://lcsitumjazsaxqwpivie.supabase.co';
  var SB_KEY = 'sb_publishable_ywl1PdIojSf7vlrEIGC_HQ_aO3WynN_';
  function sbInsert(table, row) {
    return fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
  }

  /* ---------- Cookies ----------
     Only after "Accept": Google Analytics, and dv_vid, a random first-party id
     that lets the admin page count unique and returning visitors. */
  var CONSENT_KEY = 'divino-cookie-consent';
  var consent = null;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (e) {}
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? m[1] : '';
  }
  function visitorId() {
    if (consent !== 'accepted') return null;
    var id = readCookie('dv_vid');
    if (!/^[a-z0-9]{8,32}$/.test(id)) {
      id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      document.cookie = 'dv_vid=' + id + '; Max-Age=' + 60 * 60 * 24 * 365 + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    return id;
  }
  function dropVisitorCookie() {
    document.cookie = 'dv_vid=; Max-Age=0; Path=/; SameSite=Lax';
  }

  /* ---------- Site stats for the admin page ----------
     Local test servers are not counted unless the URL contains ?dvtest. */
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]dvtest/.test(location.search);
  var NO_TRACK = LOCAL || document.documentElement.hasAttribute('data-no-track');
  var page = location.pathname.replace(/\/index(-it)?\.html$/, '/') || '/';

  /* Which tracking link brought the visitor (utm_source / utm_campaign), so the
     admin can show Instagram, WhatsApp, QR codes and partners separately.
     Kept for the visit only; remembered across pages once cookies are accepted. */
  var channel = '';
  try {
    var qs = new URLSearchParams(location.search), src = qs.get('utm_source');
    var clean = function (v) { return (v || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 38); };
    if (src) channel = clean(src) + (qs.get('utm_campaign') ? ' / ' + clean(qs.get('utm_campaign')) : '');
    if (consent === 'accepted') {
      if (channel) sessionStorage.setItem('dv-channel', channel);
      else channel = sessionStorage.getItem('dv-channel') || '';
    }
  } catch (e) {}

  function track(kind, detail) {
    if (NO_TRACK) return;
    var ref = '';
    try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h.replace(/^www\./, ''); } } catch (e) {}
    var row = {
      kind: kind, path: page.slice(0, 200), detail: detail ? String(detail).slice(0, 120) : null,
      referrer: kind === 'view' && ref ? ref.slice(0, 120) : null,
      device: matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop',
      lang: IT ? 'it' : 'en'
    };
    var vid = visitorId();
    if (vid) row.visitor = vid;
    if (channel) row.channel = channel;
    sbInsert('hits', row).then(function (r) {
      // Database not updated yet for the channel column: store the hit without it.
      if (!r.ok && r.status === 400 && row.channel) { delete row.channel; return sbInsert('hits', row); }
    }).catch(function () {});
  }
  /* Google Analytics custom events. gtag is set up in each page's head and
     respects the cookie choice (nothing is stored until the visitor accepts). */
  function ga(name, label) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, { link_text: label || '', page_path: page, language: IT ? 'it' : 'en', transport_type: 'beacon' });
  }
  var CAL_HREF = /(^|\/\/)(app\.)?cal\.com\/divino-urban-cellar-gcpvix\//;
  track('view');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var label = (a.textContent || '').trim().slice(0, 80);
    if (/wa\.me\//.test(href)) track('whatsapp', label);
    else if (/^tel:/.test(href)) track('call');
    else if (/^mailto:/.test(href)) track('email');
    else if (/google\.com\/maps/.test(href)) track('directions');
    else if (/instagram\.com/.test(href)) track('instagram');
    // Google Analytics events (key events: whatsapp, phone, email, book).
    if (/wa\.me\/|api\.whatsapp\.com/.test(href)) ga('whatsapp_click', label);
    if (/^tel:/.test(href)) ga('phone_click', label);
    if (/^mailto:/.test(href)) ga('email_click', label);
    // The Book key event is a click through to the booking calendar (see goToCalendar);
    // opening the guest window is only the step before it. A plain link to the
    // calendar counts as a Book click too.
    if (CAL_HREF.test(href)) { track('book_calendar', label); ga('book_click', label); }
    else if (a.hasAttribute('data-book') || /#book$/.test(href)) ga('book_open', label);
    if (/instagram\.com/.test(href)) ga('instagram_click', label);
    if (/google\.com\/maps|maps\.app\.goo\.gl/.test(href)) ga('directions_click', label);
  }, true);

  /* ---------- Header: dropdowns ---------- */
  var dds = Array.prototype.slice.call(document.querySelectorAll('.dd'));
  function closeAll(except) {
    dds.forEach(function (dd) {
      if (dd === except) return;
      dd.classList.remove('open');
      var b = dd.querySelector('button');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  dds.forEach(function (dd) {
    var b = dd.querySelector('button');
    if (!b) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains('open');
      closeAll(dd);
      dd.classList.toggle('open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.dd')) closeAll();
  });

  /* ---------- Header: mobile drawer ---------- */
  var drawer = document.getElementById('drawer');
  var menuBtn = document.getElementById('menu-btn');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('locked', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    if (open) { var c = drawer.querySelector('.close'); if (c) c.focus(); }
    else if (menuBtn) menuBtn.focus();
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setDrawer(true); });
  if (drawer) {
    drawer.querySelectorAll('[data-close-drawer]').forEach(function (el) {
      el.addEventListener('click', function () { setDrawer(false); });
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        drawer.classList.remove('open');
        document.body.classList.remove('locked');
      });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drawer && drawer.classList.contains('open')) setDrawer(false);
    closeAll();
    if (bk && bk.classList.contains('open')) closeBooking();
  });

  /* Remember the language choice for the pages that have an Italian version. */
  document.querySelectorAll('[data-lang-switch]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('divino-language', a.getAttribute('data-lang-switch')); } catch (e) {}
    });
  });

  /* ---------- WhatsApp links with a prefilled message ---------- */
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    a.setAttribute('href', waLink(a.getAttribute('data-wa')));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  /* ---------- Booking: guests -> Cal.com ----------
     Cal.com has no per-guest pricing, so each party size is its own event
     type on the Divino Cal account; the stepper picks which one to open. */
  var CAL_NS = 'wine-tasting';
  var CAL_USER = 'divino-urban-cellar-gcpvix';
  var GUEST_MIN = 1, GUEST_MAX = 16, PRICE_PER_PERSON = 30;
  var calLinkFor = function (n) {
    return CAL_USER + '/' + (n === 1 ? 'wine-tasting' : 'wine-tasting-' + n + '-people');
  };

  var calReady = false;
  function initCal() {
    if (calReady) return;
    calReady = true;
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if(typeof namespace === "string"){cal.ns[namespace] = cal.ns[namespace] || api;p(cal.ns[namespace], ar);p(cal, ["initNamespace", namespace]);} else p(cal, ar); return;} p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    window.Cal.config = window.Cal.config || {};
    window.Cal.config.forwardQueryParams = true;
    window.Cal('init', CAL_NS, { origin: 'https://app.cal.com' });
    window.Cal.ns[CAL_NS]('ui', { theme: 'light', hideEventTypeDetails: false, layout: 'month_view', cssVarsPerTheme: { light: { 'cal-brand': '#6E2A34' } } });
    window.Cal.ns[CAL_NS]('on', {
      action: 'linkFailed',
      callback: function () {
        var box = document.querySelector('cal-modal-box');
        if (box) box.remove();
        openBooking();
        showBookingError();
      }
    });
  }

  var bk = document.getElementById('booking');
  var guests = 2, bookTime = '';
  var countEl, totalEl, minus, plus, whenEl, errEl, lastTrigger;

  function render() {
    countEl.textContent = String(guests);
    totalEl.textContent = IT
      ? guests + (guests === 1 ? ' ospite' : ' ospiti') + ' · €' + guests * PRICE_PER_PERSON + ' in totale'
      : guests + (guests === 1 ? ' guest' : ' guests') + ' · €' + guests * PRICE_PER_PERSON + ' in total';
    minus.disabled = guests <= GUEST_MIN;
    plus.disabled = guests >= GUEST_MAX;
  }
  function openBooking(trigger) {
    if (!bk) return;
    if (trigger) lastTrigger = trigger;
    bookTime = trigger && trigger.getAttribute('data-book-time') || '';
    if (!whenEl.dataset.def) whenEl.dataset.def = whenEl.textContent;
    whenEl.textContent = !bookTime ? whenEl.dataset.def : IT
      ? 'Hai scelto la degustazione delle ' + bookTime + ': seleziona le ' + bookTime + ' nel calendario al passo successivo.'
      : 'You chose the ' + bookTime + ' tasting: pick ' + bookTime + ' in the calendar on the next step.';
    errEl.hidden = true;
    render();
    track('book_open', bookTime || null);
    bk.classList.add('open');
    bk.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    initCal();
    setTimeout(function () { plus.focus(); }, 50);
  }
  function closeBooking() {
    bk.classList.remove('open');
    bk.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('locked');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  function showBookingError() {
    if (errEl) errEl.hidden = false;
  }
  function goToCalendar() {
    var link = calLinkFor(guests);
    var ns = window.Cal && window.Cal.ns && window.Cal.ns[CAL_NS];
    closeBooking();
    track('book_calendar', guests + (bookTime ? ' · ' + bookTime : ''));
    ga('book_click', guests + (guests === 1 ? ' guest' : ' guests') + (bookTime ? ' · ' + bookTime : ''));
    if (ns) {
      ns('modal', { calLink: link, config: { layout: 'month_view', useSlotsViewOnSmallScreen: 'true', theme: 'light' } });
    } else {
      // The embed script could not load (offline, blocked): open Cal.com directly.
      window.open('https://cal.com/' + link, '_blank', 'noopener');
    }
  }

  if (bk) {
    countEl = bk.querySelector('output');
    totalEl = bk.querySelector('.total');
    minus = bk.querySelector('[data-step="-1"]');
    plus = bk.querySelector('[data-step="1"]');
    whenEl = bk.querySelector('.when');
    errEl = bk.querySelector('.err');
    minus.addEventListener('click', function () { guests = Math.max(GUEST_MIN, guests - 1); render(); });
    plus.addEventListener('click', function () { guests = Math.min(GUEST_MAX, guests + 1); render(); });
    bk.querySelector('[data-confirm]').addEventListener('click', goToCalendar);
    bk.querySelectorAll('[data-close-booking]').forEach(function (el) { el.addEventListener('click', closeBooking); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-book]');
      if (!t) return;
      e.preventDefault();
      if (drawer && drawer.classList.contains('open')) setDrawer(false);
      openBooking(t);
    });
    // Warm the embed script up on intent, so the calendar opens quickly.
    ['pointerover', 'focusin', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        if (e.target.closest && e.target.closest('[data-book]')) initCal();
      }, { passive: true });
    });
    if (location.hash === '#book') openBooking();
  }

  /* ---------- Gallery slider: arrows, swipe, dots, thumbnails ---------- */
  document.querySelectorAll('[data-slider]').forEach(function (root) {
    var track = root.querySelector('.gtrack');
    var slides = track.querySelectorAll('.gslide');
    var N = slides.length;
    var num = root.querySelector('.gnum');
    var scope = root.parentNode;
    var dots = scope.querySelectorAll('.gdots button');
    var thumbs = scope.querySelectorAll('.gthumbs button');
    var cur = function () { return Math.round(track.scrollLeft / track.clientWidth); };
    var go = function (i) {
      i = (i + N) % N;
      track.scrollTo({ left: i * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    var update = function () {
      var i = cur();
      if (num) num.textContent = (i + 1) + ' / ' + N;
      [dots, thumbs].forEach(function (list) {
        list.forEach(function (el, k) { el.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      });
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    };
    root.querySelectorAll('.garr').forEach(function (a) {
      a.addEventListener('click', function () { go(cur() + (a.classList.contains('next') ? 1 : -1)); });
    });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });
    thumbs.forEach(function (t, k) { t.addEventListener('click', function () { go(k); }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur() - 1); }
    });
    var t;
    track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(update, 60); }, { passive: true });
    update();
  });

  /* ---------- Letters from Sicily / "Be the first to know" ----------
     Sign-ups are saved to the Divino database and listed on the admin page. */
  document.querySelectorAll('form[data-signup]').forEach(function (form) {
    var msg = form.parentNode.querySelector('.form-msg');
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = (input.value || '').trim().toLowerCase();
      if (!input.checkValidity() || !email) { input.reportValidity(); return; }
      var list = form.getAttribute('data-signup');
      btn.disabled = true;
      sbInsert('subscribers', { email: email, list: list, lang: IT ? 'it' : 'en', page: page.slice(0, 200) })
        .then(function (r) {
          // 409 = this email is already on this list: that is a success too.
          if (!r.ok && r.status !== 409) throw new Error(r.status);
          if (msg) msg.textContent = IT ? 'Grazie! Sei nella lista.' : 'Grazie! You are on the list.';
          track('signup', list);
          ga('newsletter_signup', list);
          form.reset();
        })
        .catch(function () {
          if (msg) msg.innerHTML = IT
            ? 'Non ha funzionato. Riprova, oppure <a href="' + waLink('Ciao Divino! Aggiungetemi a ' + list + ': ' + email) + '" target="_blank" rel="noopener">iscriviti su WhatsApp</a>.'
            : 'Sorry, that did not work. Please try again, or <a href="' + waLink('Hello Divino! Please add me to ' + list + ': ' + email) + '" target="_blank" rel="noopener">sign up on WhatsApp</a>.';
        })
        .then(function () { btn.disabled = false; });
    });
  });

  /* ---------- Age check ----------
     The head script covers the page (html.ag) until the visitor says they
     are 18 or older; the answer lasts for this visit (sessionStorage). */
  var ageBox = document.getElementById('age');
  var root = document.documentElement;
  var afterAge = [];
  var ageOk = function () { return !root.classList.contains('ag'); };
  if (ageBox) {
    if (!ageOk()) { var yesBtn = ageBox.querySelector('[data-age="yes"]'); if (yesBtn) yesBtn.focus(); }
    ageBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-age]');
      if (!b) return;
      if (b.getAttribute('data-age') === 'yes') {
        try { sessionStorage.setItem('dv-age', 'yes'); } catch (err) {}
        root.classList.remove('ag');
        afterAge.splice(0).forEach(function (fn) { fn(); });
      } else {
        ageBox.querySelector('.acts').hidden = true;
        ageBox.querySelector('.sorry').hidden = false;
      }
    });
  }

  /* ---------- Next evening at Divino ----------
     Once per visit, after the age check, a small card with the next published
     event from the Divino database. Not on the Events page itself. */
  var showNextEvent = function () {
    if (/events(-it)?\.html$/.test(location.pathname)) return;
    try { if (sessionStorage.getItem('dv-evpop')) return; } catch (e) { return; }
    var d0 = new Date(), iso = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
    fetch(SB_URL + '/rest/v1/events?select=date,time,name,price&published=eq.true&date=gte.' + iso + '&order=date.asc&limit=1', { headers: { apikey: SB_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
        var ev = rows && rows[0];
        if (!ev) return;
        var d = new Date(ev.date + 'T00:00');
        var when = d.toLocaleDateString(IT ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (ev.time ? ' · ' + ev.time : '');
        var price = String(ev.price || '15').replace(/^€\s*/, '');
        var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        var box = document.createElement('aside');
        box.className = 'evpop';
        box.setAttribute('aria-label', IT ? 'Prossima serata da Divino' : 'Next evening at Divino');
        box.innerHTML = '<button class="x" type="button" aria-label="' + (IT ? 'Chiudi' : 'Close') + '">×</button>' +
          '<p class="k">' + (IT ? 'Prossima serata' : 'Next at Divino') + '</p><h3>' + esc(ev.name) + '</h3>' +
          '<p>' + esc(when) + '</p><p>' + (IT ? price + ' € a persona · porta aperta' : '€' + price + ' per person · open door') + '</p>' +
          '<a class="btn sm" href="' + (IT ? 'events-it.html' : 'events.html') + '#whats-on">' + (IT ? 'Scopri la serata' : 'See the evening') + '</a>';
        var done = function () { try { sessionStorage.setItem('dv-evpop', '1'); } catch (e) {} box.remove(); };
        box.querySelector('.x').addEventListener('click', done);
        box.querySelector('a').addEventListener('click', done);
        document.body.appendChild(box);
      }).catch(function () {});
  };
  if (ageOk()) setTimeout(showNextEvent, 2500); else afterAge.push(function () { setTimeout(showNextEvent, 2500); });

  /* ---------- Live Google rating ----------
     Pages carry the last typed rating; this swaps in the live numbers from the
     google-rating function (cached there, refreshed from Google twice a day).
     If it fails or has nothing yet, the typed numbers simply stay. */
  var gRating = document.querySelectorAll('[data-g-rating]');
  if (gRating.length && window.fetch) {
    fetch(SB_URL + '/functions/v1/google-rating').then(function (r) { return r.json(); }).then(function (g) {
      if (!g || typeof g.rating !== 'number' || typeof g.count !== 'number') return;
      var it = document.documentElement.lang === 'it';
      var rating = g.rating.toFixed(1), count = g.count.toLocaleString(it ? 'it-IT' : 'en-GB');
      if (it) rating = rating.replace('.', ',');
      gRating.forEach(function (el) { el.textContent = rating; });
      document.querySelectorAll('[data-g-count]').forEach(function (el) { el.textContent = count; });
    }).catch(function () {});
  }

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Cookie consent: Google Analytics + the dv_vid visitor cookie ---------- */
  var banner = document.getElementById('cookie');
  var update = function (v) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: v === 'accepted' ? 'granted' : 'denied', ad_storage: 'denied' });
    }
  };
  if (consent === 'accepted') update('accepted');
  if (banner) {
    var set = function (v) {
      try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
      consent = v;
      if (v === 'accepted') visitorId(); else dropVisitorCookie();
      update(v);
      banner.classList.remove('show');
    };
    banner.querySelector('[data-accept]').addEventListener('click', function () { set('accepted'); });
    banner.querySelector('[data-decline]').addEventListener('click', function () { set('declined'); });
    if (!consent) setTimeout(function () { banner.classList.add('show'); }, 1500);
    document.querySelectorAll('[data-cookie-settings]').forEach(function (b) {
      b.addEventListener('click', function () { banner.classList.add('show'); });
    });
  }
})();
