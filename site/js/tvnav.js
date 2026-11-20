// Granary TV remote-control navigation (Fire TV / smart-TV browsers).
// Arrow keys move focus to the nearest control in that direction, inside whichever panel is open on top.
// Opening a panel moves focus into it; closing it puts focus back where you were.
// window.granaryBack() closes the top panel (called by the Fire TV app's Back button).
(function () {
  const FOCUSABLE = 'a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const LAYERS = '.cloudPanel.open,.modal.open';
  const returnTo = new Map();
  let lastKey = null; // identifies the focused control so it can be found again after the page redraws it

  function keyOf(el) {
    const layer = el.closest(LAYERS) || document.body;
    const label = (el.textContent || el.getAttribute('aria-label') || el.placeholder || el.id || '').trim().slice(0, 60);
    const same = focusables(layer).filter(x => x.tagName === el.tagName && (x.textContent || x.getAttribute('aria-label') || x.placeholder || x.id || '').trim().slice(0, 60) === label);
    return { layer, tag: el.tagName, id: el.id, label, n: same.indexOf(el) };
  }
  function findKey(k, layer) {
    if (!k || k.layer !== layer) return null;
    if (k.id) { const byId = document.getElementById(k.id); if (byId && layer.contains(byId) && visible(byId)) return byId; }
    const same = focusables(layer).filter(x => x.tagName === k.tag && (x.textContent || x.getAttribute('aria-label') || x.placeholder || x.id || '').trim().slice(0, 60) === k.label);
    return same[Math.max(0, Math.min(k.n, same.length - 1))] || null;
  }
  // Magic Remote / mouse pointer: whatever the pointer rests on becomes the focused control,
  // so the arrow buttons carry on from there instead of from somewhere else (or nowhere).
  const isTvLike = () => document.documentElement.classList.contains('tv') || /web0s|webos|netcast|smart-?tv|tizen/i.test(navigator.userAgent);
  document.addEventListener('mouseover', e => {
    if (!isTvLike()) return;
    const el = e.target && e.target.closest && e.target.closest(FOCUSABLE);
    if (el && el !== document.activeElement && !el.matches('input,textarea,select')) el.focus({ preventScroll: true });
  }, true);
  // Coming back to the page (e.g. after the browser bar had the remote): put focus back where it was
  window.addEventListener('focus', () => { if (!isTvLike()) return; setTimeout(() => {
    const a = document.activeElement; if (a && a !== document.body) return;
    const layer = topLayer(), el = findKey(lastKey, layer) || focusables(layer)[0]; if (el) el.focus({ preventScroll: true });
  }, 50); });
  document.addEventListener('focusin', e => { if (e.target && e.target !== document.body && e.target.matches && e.target.matches(FOCUSABLE)) lastKey = keyOf(e.target); }, true);

  function topLayer() {
    const r = document.querySelector('.appReminder'); if (r) return r;
    const open = [...document.querySelectorAll(LAYERS)];
    if (!open.length) return document.body;
    // highest z-index wins; later in the page wins ties
    return open.reduce((a, b) => (+getComputedStyle(b).zIndex || 0) >= (+getComputedStyle(a).zIndex || 0) ? b : a);
  }
  function visible(el) {
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function focusables(layer) {
    return [...layer.querySelectorAll(FOCUSABLE)].filter(el => visible(el) && !el.closest('[aria-hidden="true"]') &&
      (layer !== document.body || !el.closest(LAYERS.replace(/\.open/g, ''))));
  }
  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    document.documentElement.classList.add('remoteNav');
  }
  function centre(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function best(from, dir, list) {
    const a = from.getBoundingClientRect(), ac = centre(a);
    let pick = null, score = Infinity;
    for (const el of list) {
      if (el === from) continue;
      const b = el.getBoundingClientRect(), bc = centre(b);
      let main, side;
      if (dir === 'ArrowRight') { if (b.left < a.right - 4 && bc.x <= ac.x + 4) continue; main = Math.max(0, b.left - a.right); side = Math.abs(bc.y - ac.y); }
      if (dir === 'ArrowLeft')  { if (b.right > a.left + 4 && bc.x >= ac.x - 4) continue; main = Math.max(0, a.left - b.right); side = Math.abs(bc.y - ac.y); }
      if (dir === 'ArrowDown')  { if (b.top < a.bottom - 4 && bc.y <= ac.y + 4) continue; main = Math.max(0, b.top - a.bottom); side = Math.abs(bc.x - ac.x); }
      if (dir === 'ArrowUp')    { if (b.bottom > a.top + 4 && bc.y >= ac.y - 4) continue; main = Math.max(0, a.top - b.bottom); side = Math.abs(bc.x - ac.x); }
      // Rows (up/down) care a lot about staying in the same column; left/right about the same row.
      const overlap = (dir === 'ArrowLeft' || dir === 'ArrowRight')
        ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        : Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const s = main + side * (overlap > 0 ? 0.3 : 2);
      if (s < score) { score = s; pick = el; }
    }
    return pick;
  }

  document.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const active = document.activeElement;
    // Let text boxes use left/right for the cursor.
    if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(active.type))) &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const v = active.value || '', p = active.selectionStart;
      if (!(e.key === 'ArrowLeft' && p === 0) && !(e.key === 'ArrowRight' && p === v.length)) return;
    }
    const layer = topLayer(), list = focusables(layer);
    if (!list.length) return;
    e.preventDefault();
    if (!active || active === document.body || !layer.contains(active)) { focusEl(findKey(lastKey, layer) || list[0]); return; }
    const next = best(active, e.key, list);
    if (next) focusEl(next);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Nothing further that way: scroll the panel so long lists can still be read.
      const scroller = active.closest('.cloudPanel > *, .modal > *, .libraryContent, #libraryContent') || document.scrollingElement;
      scroller.scrollBy({ top: e.key === 'ArrowDown' ? 200 : -200 });
    }
  }, true);

  // Move focus into panels as they open; restore it when they close.
  const watch = new MutationObserver(muts => {
    for (const m of muts) {
      const el = m.target;
      if (!el.matches || !el.matches('.cloudPanel,.modal')) continue;
      const open = el.classList.contains('open');
      if (open && !returnTo.has(el)) {
        returnTo.set(el, document.activeElement);
        setTimeout(() => { const l = focusables(el); if (l.length && !el.contains(document.activeElement)) focusEl(l.find(x => !x.classList.contains('close')) || l[0]); }, 60);
      } else if (!open && returnTo.has(el)) {
        const back = returnTo.get(el); returnTo.delete(el);
        if (back && document.contains(back) && visible(back)) focusEl(back);
      }
    }
  });
  // If a redraw removes the focused control, put focus back on its replacement.
  let redrawTimer = null;
  const redraw = new MutationObserver(() => {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(() => {
      const a = document.activeElement;
      if (a && a !== document.body && document.contains(a)) return;
      const layer = topLayer(); const el = findKey(lastKey, layer);
      if (el) focusEl(el);
    }, 50);
  });
  function start() {
    document.querySelectorAll('.cloudPanel,.modal').forEach(el => {
      watch.observe(el, { attributes: true, attributeFilter: ['class'] });
      redraw.observe(el, { childList: true, subtree: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // Inside the Fire TV app: hand service links to the app with the programme title.
  // Services whose Fire TV app can't open a programme directly (iPlayer, ITVX, 5, …) get a reminder card first,
  // showing exactly what to search for. Channel 4 opens the programme itself, so it goes straight through.
  const DIRECT = /(^|\.)channel4\.com$/i;
  const SERVICE_NAMES = [[/bbc\.co\.uk/i, 'BBC iPlayer'], [/itv\.com/i, 'ITVX'], [/channel5\.com/i, '5'], [/nowtv\.com|sky\.com/i, 'NOW'],
    [/channel4\.com/i, 'Channel 4'], [/amazon\.|primevideo\./i, 'Prime Video'], [/disneyplus\./i, 'Disney+'], [/netflix\./i, 'Netflix'], [/u\.co\.uk|uktv/i, 'U']];
  let reminder = null;
  function closeReminder() { if (!reminder) return false; clearInterval(reminder.timer); reminder.el.remove(); const back = reminder.back; reminder = null; if (back && document.contains(back)) focusEl(back); return true; }
  function showReminder(service, title, go) {
    closeReminder();
    const el = document.createElement('div');
    el.className = 'appReminder';
    el.innerHTML = '<div class="appReminderCard" role="dialog" aria-live="assertive"><div class="arSmall"></div><div class="arTitle"></div>' +
      '<div class="arSteps"></div><div class="arButtons"><button class="arGo"></button><button class="arCancel">Cancel</button></div></div>';
    el.querySelector('.arSmall').textContent = 'Opening ' + service + '…';
    el.querySelector('.arTitle').textContent = title ? 'Search for: ' + title : 'Search for the programme there';
    el.querySelector('.arSteps').textContent = LG
      ? (LGAPP ? 'The ' + service + ' app will open' : 'If the TV asks to open the ' + service + ' app, choose Yes') + '. Then go to Search in the app and type the name above. (The LG apps can\'t be sent straight to a programme.)'
      : service === 'BBC iPlayer' || service === 'ITVX'
      ? 'Choose your profile if asked, then go to Search. ' + service + ' on Fire TV won\'t open a programme directly.'
      : 'Go to Search in ' + service + ' and type the name above.';
    document.body.appendChild(el);
    let n = 4; const btn = el.querySelector('.arGo');
    const tick = () => { btn.textContent = 'Open ' + service + ' now (' + n + ')'; if (n-- <= 0) { closeReminder(); go(); } };
    reminder = { el, back: document.activeElement, timer: setInterval(tick, 1000) }; tick();
    btn.onclick = () => { closeReminder(); go(); };
    el.querySelector('.arCancel').onclick = () => closeReminder();
    setTimeout(() => focusEl(btn), 30);
  }
  window.granaryShowReminder = showReminder; // for tests
  // LG's own browser: the services' websites won't play there, and LG's apps can't be sent to a programme,
  // so show what to search for, then let the TV offer its app.
  const LG = !window.GranaryApp && /web0s|webos|netcast/i.test(navigator.userAgent);
  let lgPass = false;
  // Running inside the Granary LG app (opened from lg/index.html with ?app=lg)?
  let LGAPP = /[?&]app=lg\b/.test(location.search);
  try { if (LGAPP) localStorage.setItem('granary-lg-app', '1'); else LGAPP = /web0s|webos/i.test(navigator.userAgent) && localStorage.getItem('granary-lg-app') === '1' && !!window.PalmSystem; } catch (err) {}
  window.GRANARY_LG_APP = LGAPP;
  if (LGAPP) document.documentElement.classList.add('lgApp');
  // Ask webOS to open something (another app, or a link the TV knows an app for)
  function luna(uri, params) {
    return new Promise(res => {
      if (!window.PalmServiceBridge) return res({ returnValue: false, errorText: 'no system access' });
      try { const b = new PalmServiceBridge(); b.onservicecallback = m => { let r = {}; try { r = JSON.parse(m); } catch (err) {} res(r); }; b.call(uri, JSON.stringify(params)); window.__lunaKeep = b; }
      catch (err) { res({ returnValue: false, errorText: String(err) }); }
      setTimeout(() => res({ returnValue: false, errorText: 'no reply' }), 4000);
    });
  }
  window.granaryLuna = luna;
  async function lgOpen(url) {
    let r = await luna('luna://com.webos.applicationManager/open', { target: url });
    if (!r.returnValue) r = await luna('luna://com.webos.applicationManager/launch', { id: 'com.webos.app.browser', params: { target: url } });
    if (!r.returnValue) { const t = document.getElementById('toast'); if (t) { t.textContent = 'Couldn’t open that from the app (' + (r.errorText || 'unknown') + ')'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 4000); } }
  }
  document.addEventListener('click', e => {
    if (!LG || lgPass) return;
    const a = e.target.closest && e.target.closest('a.primaryProvider, a.providerLookup, a.watchLookup, a.providerExtra, a.watchLive');
    if (!a) return;
    const card = a.closest('.libraryRow, .modal, [data-title]');
    const t = (a.dataset.title || (card && (card.querySelector('.libraryTitle, #modalTitle') || {}).textContent) || (document.querySelector('#panel h1, #panel h2') || {}).textContent || '').trim();
    let host = ''; try { host = new URL(a.href).hostname; } catch (err) {}
    const label = a.textContent || '';
    const svc = (SERVICE_NAMES.find(([re]) => re.test(host)) || [null, ''])[1] || (/\bChannel 4\b/.test(label) ? 'Channel 4' : '');
    if (!svc) return;                                       // not a streaming service link: open normally
    e.preventDefault(); e.stopPropagation();
    showReminder(svc, t, LGAPP ? () => lgOpen(a.href) : () => { lgPass = true; try { a.click(); } finally { lgPass = false; } });
  }, true);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a.primaryProvider, a.providerLookup, a.watchLookup, a.providerExtra');
    if (!a || !window.GranaryApp || typeof window.GranaryApp.openWithTitle !== 'function') return;
    const card = a.closest('.libraryRow, .modal, [data-title]');
    const t = (a.dataset.title || (card && (card.querySelector('.libraryTitle, #modalTitle') || {}).textContent) || '').trim();
    e.preventDefault();
    let host = ''; try { host = new URL(a.href).hostname; } catch (err) {}
    const go = () => window.GranaryApp.openWithTitle(a.href, t);
    if (DIRECT.test(host)) return go();
    const label = a.textContent || '';
    const named = ['BBC iPlayer', 'ITVX', 'Channel 5', 'My5', 'NOW', 'Prime Video', 'Disney+', 'Netflix', 'U'].find(n => new RegExp('\\b' + n.replace('+', '\\+') + '(\\b|$)').test(label));
    if (/\bChannel 4\b/.test(label) && !named) return go();
    const svc = named || (SERVICE_NAMES.find(([re]) => re.test(host)) || [null, 'the app'])[1];
    showReminder(svc, t, go);
  }, true);

  // Back button: close the top panel. Returns true if something was closed.
  window.granaryBack = function () {
    if (closeReminder()) return true;
    const layer = topLayer();
    if (layer === document.body) return false;
    const closeBtn = [...layer.querySelectorAll('button')].find(b => /close|✕|cancel/i.test(b.textContent) || b.id === 'close');
    if (closeBtn) closeBtn.click(); else layer.classList.remove('open');
    return true;
  };
  let backAt = 0;
  document.addEventListener('keydown', e => {
    if (!(e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 461)) return;
    if (window.granaryBack()) { e.preventDefault(); return; }
    if (!LGAPP) return;
    e.preventDefault();
    if (Date.now() - backAt < 2500) { try { window.PalmSystem && PalmSystem.platformBack ? PalmSystem.platformBack() : window.close(); } catch (err) { window.close(); } return; }
    backAt = Date.now(); const t = document.getElementById('toast'); if (t) { t.textContent = 'Press Back again to leave Granary TV'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
  });
})();
