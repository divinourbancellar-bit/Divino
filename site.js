/* Divino Urban Cellar — shared behaviour for every page:
   menu, booking (Bókun), gallery slider, Letters sign-up, cookie consent. */
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
    // The Book key event is using the Bókun calendar (see the booking window);
    // opening the window is only the step before it.
    if (a.hasAttribute('data-book') || /#book$/.test(href)) ga('book_open', label);
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

  /* ---------- Sticky "Book a tasting" bar (phones) ----------
     When the page's own first Book button is on the first screen, the bar
     waits until that button has been scrolled past, so the two never show
     stacked one above the other. */
  var firstBook = document.querySelector('main [data-book]');
  if (firstBook && 'IntersectionObserver' in window && firstBook.getBoundingClientRect().top < window.innerHeight) {
    document.body.classList.add('sb-wait');
    new IntersectionObserver(function (es) {
      document.body.classList.toggle('sb-wait', es[0].isIntersecting || es[0].boundingClientRect.top > 0);
    }).observe(firstBook);
  }

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

  /* ---------- Booking: Bókun widget ----------
     The booking window holds Bókun's calendar for the wine tasting (guests,
     price and Stripe payment all happen inside it). The loader script is only
     fetched once a visitor shows intent, then it fills the .bokunWidget div. */
  var BOKUN_LOADER = 'https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=dfe72029-8f73-462e-b8fe-37542603a627';
  var bokunReady = false;
  function initBokun() {
    if (bokunReady) return;
    bokunReady = true;
    var s = document.createElement('script');
    s.src = BOKUN_LOADER;
    s.async = true;
    s.onerror = function () { showBookingError(); };
    document.head.appendChild(s);
  }

  var bk = document.getElementById('booking');
  var bookTime = '', calCounted = false;
  var whenEl, errEl, lastTrigger;

  function openBooking(trigger) {
    if (!bk) return;
    if (trigger) lastTrigger = trigger;
    bookTime = trigger && trigger.getAttribute('data-book-time') || '';
    if (!whenEl.dataset.def) whenEl.dataset.def = whenEl.textContent;
    whenEl.textContent = !bookTime ? whenEl.dataset.def : IT
      ? 'Hai scelto la degustazione delle ' + bookTime + ': seleziona le ' + bookTime + ' nel calendario qui sotto.'
      : 'You chose the ' + bookTime + ' tasting: pick ' + bookTime + ' in the calendar below.';
    calCounted = false;
    track('book_open', bookTime || null);
    bk.classList.add('open');
    bk.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
    initBokun();
    setTimeout(function () { bk.querySelector('.x').focus(); }, 50);
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

  if (bk) {
    whenEl = bk.querySelector('.when');
    errEl = bk.querySelector('.err');
    bk.querySelectorAll('[data-close-booking]').forEach(function (el) { el.addEventListener('click', closeBooking); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-book]');
      if (!t) return;
      e.preventDefault();
      if (drawer && drawer.classList.contains('open')) setDrawer(false);
      openBooking(t);
    });
    // The Book key event: the visitor starts using the Bókun calendar. Clicks
    // inside its iframe can't be seen, but the page loses focus to the iframe.
    window.addEventListener('blur', function () {
      if (calCounted || !bk.classList.contains('open')) return;
      var f = document.activeElement;
      if (!f || f.tagName !== 'IFRAME' || !bk.contains(f)) return;
      calCounted = true;
      track('book_calendar', bookTime || null);
      ga('book_click', bookTime || '');
    });
    // Warm the widget up on intent, so the calendar is ready when the window opens.
    ['pointerover', 'focusin', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, function (e) {
        if (e.target.closest && e.target.closest('[data-book]')) initBokun();
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

  /* ---------- Upcoming events (Home strip + "Next at Divino" pop-up) ----------
     Both read the published events from the Divino database, from today on, so
     an evening drops off the day after it happens. select=* keeps this working
     whether or not the wines column exists yet. */
  var evList = null;
  var upcomingEvents = function () {
    if (!evList) {
      var d0 = new Date(), iso = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
      evList = fetch(SB_URL + '/rest/v1/events?select=*&published=eq.true&date=gte.' + iso + '&order=date.asc,time.asc&limit=3', { headers: { apikey: SB_KEY } })
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    }
    return evList;
  };
  var evEsc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var evHref = (IT ? 'events-it.html' : 'events.html') + '#whats-on';
  var evPoster = function (ev) { return /^(https:\/\/|photos\/|optimized\/|assets\/)/.test(ev.photo || '') ? ev.photo : ''; };
  var evDate = function (ev, opts) { return new Date(ev.date + 'T00:00').toLocaleDateString(IT ? 'it-IT' : 'en-GB', opts); };

  var strip = document.getElementById('up-events');
  if (strip) upcomingEvents().then(function (rows) {
    if (!rows.length) return;
    strip.querySelector('.upev-list').innerHTML = rows.map(function (ev) {
      var poster = evPoster(ev);
      return '<a class="upev-c" href="' + evHref + '">' +
        (poster ? '<img src="' + evEsc(poster) + '" alt="' + evEsc((IT ? 'Locandina: ' : 'Poster: ') + ev.name) + '" loading="lazy">' : '') +
        '<div class="b"><p class="dt">' + evEsc(evDate(ev, { weekday: 'long', day: 'numeric', month: 'long' })) + (ev.time ? ' · ' + evEsc(ev.time) : '') + '</p>' +
        '<h3>' + evEsc(ev.name) + '</h3>' + (ev.description ? '<p>' + evEsc(ev.description) + '</p>' : '') +
        (ev.wines ? '<p class="ewn"><span>' + (IT ? 'Vini' : 'Wines') + '</span> ' + evEsc(ev.wines) + '</p>' : '') +
        '</div></a>';
    }).join('');
    strip.hidden = false;
  });

  /* The pop-up: once per visit, after the age check, not on the Events page.
     "Don't show again" remembers that evening in localStorage; the next new
     evening will still be shown. */
  var showNextEvent = function () {
    if (/events(-it)?\.html$/.test(location.pathname)) return;
    try { if (sessionStorage.getItem('dv-evpop')) return; } catch (e) { return; }
    upcomingEvents().then(function (rows) {
      var ev = rows[0];
      if (!ev) return;
      var key = ev.date + '|' + ev.name;
      try { if (localStorage.getItem('dv-evpop-never') === key) return; } catch (e) {}
      var poster = evPoster(ev);
      var box = document.createElement('aside');
      box.className = 'evpop' + (poster ? ' has-p' : '');
      box.setAttribute('aria-label', IT ? 'Prossima serata da Divino' : 'Next evening at Divino');
      box.innerHTML = '<button class="x" type="button" aria-label="' + (IT ? 'Chiudi' : 'Close') + '">×</button>' +
        (poster ? '<a class="pp" href="' + evHref + '"><img src="' + evEsc(poster) + '" alt="' + evEsc((IT ? 'Locandina: ' : 'Poster: ') + ev.name) + '"></a>' : '') +
        '<div class="b"><p class="k">' + (IT ? 'Prossima serata da Divino' : 'Next at Divino') + '</p>' +
        '<p class="dt">' + evEsc(evDate(ev, { weekday: 'long', day: 'numeric', month: 'long' })) + (ev.time ? ' · ' + evEsc(ev.time) : '') + '</p>' +
        '<h3>' + evEsc(ev.name) + '</h3>' + (ev.description ? '<p class="ds">' + evEsc(ev.description) + '</p>' : '') +
        (ev.wines ? '<p class="ewn"><span>' + (IT ? 'Vini' : 'Wines') + '</span> ' + evEsc(ev.wines) + '</p>' : '') +
        '<a class="btn sm" href="' + evHref + '">' + (IT ? 'Scopri la serata' : 'See the evening') + '</a>' +
        '<button class="nv" type="button">' + (IT ? 'Non mostrare più' : 'Don’t show again') + '</button></div>';
      var done = function () { try { sessionStorage.setItem('dv-evpop', '1'); } catch (e) {} box.remove(); };
      box.querySelector('.x').addEventListener('click', done);
      box.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', done); });
      box.querySelector('.nv').addEventListener('click', function () { try { localStorage.setItem('dv-evpop-never', key); } catch (e) {} done(); });
      document.body.appendChild(box);
    });
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
