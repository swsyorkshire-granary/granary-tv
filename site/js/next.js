// Granary TV – new design. Reuses the listings code (guide.js) and the library code (library.js);
// this file replaces only how things are drawn: an info panel on top, a simple grid (7pm–midnight by default)
// and a Library tab. One page works on iPad, phone and TV.
(function () {
  const params = new URLSearchParams(location.search);
  const UA = navigator.userAgent || '';
  const NX = {
    tab: 'guide', sel: null, libSel: null, libFilter: 'all', groups: [], libKeys: new Map(), tiles: new Map(), libLoaded: false,
    tv: !!window.GranaryApp || !!window.GRANARY_FORCE_TV || params.has('tv') || /AFT|Web0S|webOS|SMART-TV|SmartTV|Tizen|BRAVIA|NetCast|HbbTV/i.test(UA),
    phone: () => matchMedia('(max-width:700px)').matches,
  };
  window.NX = NX;
  if (NX.tv) document.documentElement.classList.add('tv');
  const inApp = () => !!(window.GranaryApp && window.GranaryApp.isApp);
  const fmtT = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtWhen = d => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ── Hours shown ─────────────────────────────────────────────
  const WIN_KEY = 'granary-window-start';
  const winLen = () => NX.phone() ? 2.5 : 5;
  const defaultStart = () => { const v = Number(localStorage.getItem(WIN_KEY)); return Number.isFinite(v) && v > 0 && v <= 22 ? v : 19; };
  function setWindow(start) { const len = winLen(); startHour = Math.max(0, Math.min(24 - len, start)); endHour = Math.min(24, startHour + len); }
  setWindow(defaultStart());
  syncNow = function () {};            // the new design keeps the hours you chose instead of jumping to "now"

  // ── Channel badges ──────────────────────────────────────────
  const BADGES = [['bbcone', 'BBC1', '#1f2937'], ['bbctwo', 'BBC2', '#475569'], ['bbcthree', 'BBC3', '#334155'], ['bbcfour', 'BBC4', '#3f3f46'], ['bbcnews', 'NEWS', '#991b1b'],
    ['itv1', 'ITV1', '#0f766e'], ['itv2', 'ITV2', '#0d9488'], ['itv3', 'ITV3', '#115e59'], ['itv4', 'ITV4', '#134e4a'], ['channel4', 'C4', '#7c3aed'], ['e4', 'E4', '#6d28d9'],
    ['more4', 'M4', '#5b21b6'], ['film4', 'F4', '#4c1d95'], ['channel5', '5', '#be123c'], ['5star', '5★', '#9f1239'], ['skyatlantic', 'ATL', '#0c4a6e'], ['skywitness', 'WIT', '#9d174d'], ['skycomedy', 'COM', '#b45309'], ['skycrime', 'CRM', '#7f1d1d'], ['skyarts', 'ARTS', '#6b21a8'], ['skyhistory', 'HIST', '#78350f'], ['skynature', 'NAT', '#166534'], ['skyscifi', 'SCI', '#1e1b4b'], ['skymix', 'MIX', '#0369a1'], ['skyshowcase', 'SHOW', '#1d4ed8'], ['skymax', 'MAX', '#1e40af'], ['skydocumentaries', 'DOCS', '#115e59'], ['sky', 'SKY', '#1d4ed8'], ['dave', 'DAVE', '#a16207']];
  const PALETTE = ['#334155', '#0e7490', '#7c2d12', '#365314', '#701a75', '#1e3a8a', '#713f12'];
  function badgeFor(name) {
    const n = norm(name);
    for (const [k, label, col] of BADGES) if (n.startsWith(k)) return { label, col };
    const w = String(name || '').replace(/\bHD\b/i, '').trim().split(/\s+/);
    const label = (w[0] && w[0].length <= 4 ? w[0] : w.map(x => x[0]).join('').slice(0, 3) || '?').toUpperCase();
    let hsh = 0; for (const c of n) hsh = (hsh * 31 + c.charCodeAt(0)) | 0;
    return { label, col: PALETTE[Math.abs(hsh) % PALETTE.length] };
  }
  function badgeEl(name) { const b = badgeFor(name), e = h('span', 'badge', b.label); e.style.background = b.col; e.title = name; return e; }

  // ── Days ────────────────────────────────────────────────────
  function changeWeek(delta) {
    weekOffset = Math.min(0, weekOffset + delta); selected = weekOffset < 0 ? 6 : 0; NX.sel = null;
    renderDays(); loadListings();
  }
  renderDays = function () {
    const el = $('nxDays'); el.innerHTML = '';
    const back = h('button', 'day wk', '‹'); back.title = 'Previous week'; back.setAttribute('aria-label', 'Previous week'); back.onclick = () => changeWeek(-1); el.append(back);
    for (let i = 0; i < 7; i++) {
      const d = dateFor(i), b = h('button', 'day' + (i === selected ? ' on' : ''), weekOffset === 0 && i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }));
      b.onclick = () => { selected = i; NX.sel = null; renderDays(); render(); };
      el.append(b);
    }
    if (weekOffset < 0) { const fwd = h('button', 'day wk', weekOffset === -1 ? 'This week ›' : 'Next week ›'); fwd.onclick = () => changeWeek(1); el.append(fwd); }
  };

  // ── Guide grid ──────────────────────────────────────────────
  const tileKey = (ch, p) => ch.id + '|' + p.start.getTime();
  const inLibrary = title => NX.libKeys.get(granarySeriesKey(title));
  const isLinked = title => (window.granarySeriesTitles && window.granarySeriesTitles.has(granarySeriesKey(title))) || !!(inLibrary(title) || []).some(i => i.series_link);
  function dayProgrammes(ch) { const key = dateKey(dateFor(selected)); return (dataByChannel[ch.id] || []).filter(p => dateKey(p.start) === key).sort((a, b) => a.start - b.start); }
  function mins(p, key) { const a = p.start.getHours() * 60 + p.start.getMinutes(); const b = p.end.getHours() * 60 + p.end.getMinutes() + (dateKey(p.end) !== key ? 1440 : 0); return [a, b]; }

  render = function () {
    const g = $('nxGrid'); if (!g) return;
    const wasTile = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('tile');
    const key = dateKey(dateFor(selected)), from = startHour * 60, to = endHour * 60, span = to - from, now = new Date();
    const isToday = weekOffset === 0 && selected === 0;
    g.innerHTML = ''; NX.tiles.clear();
    const hrs = h('div', 'hrs');
    for (let hr = Math.ceil(startHour); hr < endHour; hr++) { const s = h('span', '', pad(hr % 24) + ':00'); s.style.left = ((hr * 60 - from) / span * 100) + '%'; hrs.append(s); }
    g.append(hrs);
    let count = 0; const seenIds = new Set();
    channels.forEach(ch => {
      if (ch.id != null) { if (seenIds.has(ch.id)) return; seenIds.add(ch.id); }
      const row = h('div', 'gr'), cn = h('div', 'cn'), tl = h('div', 'tl');
      cn.append(badgeEl(ch.display)); row.append(cn, tl);
      dayProgrammes(ch).forEach(p => {
        const [a, b] = mins(p, key); if (b <= from || a >= to) return;
        const l = Math.max(a, from), r = Math.min(b, to);
        const t = h('button', 'tile'); const k = tileKey(ch, p);
        t.style.left = ((l - from) / span * 100) + '%'; t.style.width = `calc(${(r - l) / span * 100}% - 4px)`;
        if (isLinked(p.title)) t.classList.add('lk');
        if (isToday && p.end <= now) t.classList.add('past');
        if (NX.sel === k) t.classList.add('sel');
        t.dataset.k = k; const s = h('span', '', (isLinked(p.title) ? '🔗 ' : '') + p.title); t.append(s, h('small', '', NX.phone() ? fmtT(p.start) : fmtT(p.start) + '–' + fmtT(p.end)));
        t.title = p.title + ' · ' + fmtT(p.start) + '–' + fmtT(p.end);
        t.onclick = () => { selectTile(k, true); };
        t.onfocus = () => { if (NX.sel !== k) selectTile(k, false); };
        NX.tiles.set(k, { p, ch, el: t }); tl.append(t); count++;
      });
      if (!tl.querySelector('.tile') && String(ch.id).startsWith('sky:') && dateFor(selected) < new Date(new Date().setHours(0, 0, 0, 0)))
        tl.append(h('div', 'rowNote', 'No saved Sky listings for this day – Sky keeps no past days, so Granary TV saves them from 17 Nov'));
      if (isToday) { const m = now.getHours() * 60 + now.getMinutes(); if (m >= from && m < to) { const nl = h('i', 'nowl'); nl.style.left = ((m - from) / span * 100) + '%'; tl.append(nl); } }
      g.append(row);
    });
    if (!channels.length || (!count && Object.keys(dataByChannel).length)) g.append(h('div', 'empty', 'Nothing in these hours. Try Earlier or Later, or another day.'));
    sizeRows(g);
    $('windowLabel').textContent = pad(Math.floor(startHour)) + ':' + pad(Math.round(startHour % 1 * 60)) + ' – ' + (endHour >= 24 ? '24:00' : pad(Math.floor(endHour)) + ':' + pad(Math.round(endHour % 1 * 60)));
    $('earlier').disabled = startHour <= 0; $('later').disabled = endHour >= 24;
    $('nowBtn').hidden = !(weekOffset === 0);
    if (!NX.tiles.has(NX.sel)) NX.sel = defaultTile();
    const cur = NX.tiles.get(NX.sel);
    const usingPanel = $('panel').contains(document.activeElement) || $('morePanel').classList.contains('open');
    if (cur) { cur.el.classList.add('sel'); if (NX.tab === 'guide' && !(usingPanel && NX.shown === NX.sel)) showGuidePanel(cur); if (wasTile) cur.el.focus({ preventScroll: true }); }
    else if (NX.tab === 'guide' && count === 0) $('panel').innerHTML = '';
  };
  // Rows grow so the guide fills the screen (up to about 1.8× the normal depth).
  function sizeRows(g) {
    const rows = g.querySelectorAll('.gr').length; if (!rows) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 15;
    const base = (NX.tv ? 4 : NX.phone() ? 3.3 : 3.6) * rem;
    const top = g.getBoundingClientRect().top + window.scrollY, hrs = g.querySelector('.hrs').offsetHeight;
    const below = (NX.phone() ? 7 : 4.5) * rem;          // Earlier/Later bar and margins
    const avail = window.innerHeight - top - hrs - below;
    const rowH = Math.max(base, Math.min(base * (NX.phone() ? 2.3 : 1.8), avail / rows));
    g.style.setProperty('--rowh', rowH + 'px');
    g.classList.toggle('tall', rowH >= base * 1.25);
    // very short programmes: hide text that can't fit rather than show fragments
    g.querySelectorAll('.tile').forEach(t => { const w = t.offsetWidth; t.classList.toggle('tiny', w < 2.6 * rem); t.classList.toggle('narrow', w < 5.5 * rem); });
  }
  function defaultTile() {
    const now = new Date(), isToday = weekOffset === 0 && selected === 0;
    const all = [...NX.tiles.entries()];
    const live = isToday && all.find(([, v]) => v.p.start <= now && v.p.end > now);
    if (live) return live[0];
    const upcoming = all.filter(([, v]) => !isToday || v.p.end > now).sort((a, b) => a[1].p.start - b[1].p.start || channels.indexOf(a[1].ch) - channels.indexOf(b[1].ch));
    return (upcoming[0] || all[0] || [null])[0];
  }
  function selectTile(k, activate) {
    const prev = NX.tiles.get(NX.sel); if (prev) prev.el.classList.remove('sel');
    NX.sel = k; const cur = NX.tiles.get(k); if (!cur) return;
    cur.el.classList.add('sel'); showGuidePanel(cur);
    if (activate) {
      if (NX.phone()) $('panel').classList.add('open');
      else if (NX.tv || document.documentElement.classList.contains('remoteNav')) { const first = $('panel').querySelector('.acts .btn'); if (first) first.focus(); }
    }
  }

  // ── Panel ───────────────────────────────────────────────────
  function serviceLink(title, service) {
    const verified = getGranaryVerifiedLink(title, service);
    const known = (GRANARY_KNOWN_PROGRAMME_URLS[String(title).trim().toLowerCase()] || {})[service];
    if (verified) return { url: verified.candidate_url, label: (verified.verification_status === 'playback_confirmed' ? 'Play on ' : 'Open in ') + service, sure: true };
    if (known) return { url: known, label: 'Open in ' + service, sure: true };
    // No direct link: services with a real search page go there; the rest open the service and copy the title.
    const search = SEARCH_PAGES[service];
    if (search && !inApp()) return { url: search(title), label: 'Search ' + service, sure: false, searchPage: true };
    return { url: GRANARY_SERVICE_URLS[service] || granaryProviderSearchUrl(service, title), label: 'Open ' + shortService(service), sure: false, copy: !inApp() };
  }
  // NOW: find the programme on NOW (via the find-links helper), then use NOW's own deep links:
  //   nowtv://www.nowtv.com/deeplink?deeplinkData={"providerSeriesId":…,"type":…,"action":"PDP" | "PDP_ADD_WATCHLIST"}
  // NOW opens the programme (or adds it to My List) itself, using your own signed-in NOW app – no password here.
  const NOW_CACHE_KEY = 'granary-now-pages-v2', NOW_PKG = 'com.bskyb.nowtv.beta';
  function nowCache() { try { return JSON.parse(localStorage.getItem(NOW_CACHE_KEY) || '{}'); } catch (e) { return {}; } }
  const nowPending = new Map();
  const assetInfo = url => { const m = /nowtv\.com\/watch\/asset\/[^/]+\/([A-Za-z0-9]+)/.exec(url || ''); return m ? { url, pid: m[1], type: 'CATALOGUE/SERIES' } : null; };
  function nowInfo(title, knownUrl) {
    const fromUrl = assetInfo(knownUrl); if (fromUrl) return Promise.resolve(fromUrl);
    const k = granaryNormaliseTitle(title.replace(/^\s*(new|live)\s*:\s*/i, '')), c = nowCache()[k];
    if (c && (c.pid || !c.url) && Date.now() - c.at < (c.url ? 14 : 2) * 864e5) return Promise.resolve(c.url ? c : null);
    if (nowPending.has(k)) return nowPending.get(k);
    const p = fetch(GRANARY_FIND_LINKS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, services: 'Sky / NOW' }) })
      .then(r => r.ok ? r.json() : null).then(j => {
        const b = j && j.best && j.best['Sky / NOW'];
        const info = b ? { url: b.url, pid: b.providerSeriesId || (assetInfo(b.url) || {}).pid, type: b.nowType || 'CATALOGUE/SERIES' } : null;
        try { const m = nowCache(); m[k] = Object.assign({ at: Date.now() }, info || { url: null }); localStorage.setItem(NOW_CACHE_KEY, JSON.stringify(m)); } catch (e) {}
        return info;
      }).catch(() => null).finally(() => nowPending.delete(k));
    nowPending.set(k, p); return p;
  }
  const mobileOS = () => /iPad|iPhone|iPod|Android/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Tested on the iPad (17 Nov): type must be the short upper-case form ("SERIES", not "CATALOGUE/SERIES" or "series").
  function nowDeepLink(info, action, scheme) {
    const type = String(info.type || 'SERIES').split('/').pop().toUpperCase();
    const data = encodeURIComponent(JSON.stringify({ providerSeriesId: info.pid, type, action }));
    return (scheme ? 'nowtv://www.nowtv.com/deeplink?deeplinkData=' : 'https://www.nowtv.com/deeplink?deeplinkData=') + data;
  }
  function wireNow(a, info, action, title) {
    a.classList.remove('primaryProvider'); a.classList.add('nowDirect'); a.dataset.found = '1';
    a.href = nowDeepLink(info, action, false); a.removeAttribute('target');
    a.onclick = e => {
      if (action === 'PDP_ADD_WATCHLIST') toast('Opening NOW to add “' + title + '” to My List');
      if (!inApp()) return;                                   // browser: the link itself opens the NOW app (or nowtv.com)
      e.preventDefault();
      const r = window.GranaryApp.launch(nowDeepLink(info, action, true), NOW_PKG, '');
      if (r !== 'started') { try { window.GranaryApp.open(info.url); } catch (err) {} }
    };
  }
  function upgradeToNowPage(a, title, knownUrl) {
    nowInfo(title, knownUrl).then(info => {
      if (!info || !info.pid || !a.isConnected) return;
      wireNow(a, info, 'PDP', title);
      if (!/check anyway/.test(a.textContent)) a.textContent = 'Open in NOW';
      a.title = 'Opens “' + title + '” in NOW';
      if (a.nextElementSibling && a.nextElementSibling.classList.contains('nowList')) return;
      const add = h('a', a.className.replace(/\bp\b/, '').replace('nowDirect', '') + ' nowList', '＋ NOW list'); add.dataset.title = title;
      add.title = 'Opens NOW and adds “' + title + '” to your NOW My List';
      wireNow(add, info, 'PDP_ADD_WATCHLIST', title);
      a.after(add);
    });
  }
  const SEARCH_PAGES = { 'BBC iPlayer': t => 'https://www.bbc.co.uk/iplayer/search?q=' + encodeURIComponent(t) };
  const shortService = s => s === 'Sky / NOW' ? 'NOW' : s;
  function providerBtn(title, service, cls, onUse) {
    const s = serviceLink(title, service), a = h('a', cls + ' primaryProvider', s.label);
    a.href = s.url; a.dataset.title = title; a.rel = 'noopener noreferrer'; if (!window.GranaryApp) a.target = '_blank';
    a.title = s.sure ? 'Opens the programme page' : s.copy ? 'Opens ' + shortService(service) + ' and copies “' + title + '” so you can paste it into its search' : 'Searches ' + service + ' for “' + title + '”';
    if (service === 'Sky / NOW') upgradeToNowPage(a, title, s.sure ? s.url : null);
    if (s.copy) a.addEventListener('click', () => {
      if (a.dataset.found) return;
      try { navigator.clipboard.writeText(title).then(() => toast('“' + title + '” copied – paste it into ' + shortService(service) + '’s search', null, null, 'copy'), () => toast('Search ' + shortService(service) + ' for “' + title + '”', null, null, 'copy')); }
      catch (e) { toast('Search ' + shortService(service) + ' for “' + title + '”', null, null, 'copy'); }
    });
    if (onUse) a.addEventListener('click', onUse);
    return a;
  }
  function watchLiveBtn(ch) {
    const live = liveLinkFor(ch); if (!live) return null;
    const a = h('a', 'btn p watchLive', '▶ Watch live'); a.href = live.url; a.dataset.title = ch.display + ' live'; a.rel = 'noopener';
    if (!window.GranaryApp) a.target = '_blank';
    if (live.intent || live.pkg) a.onclick = e => { e.preventDefault(); const r = live.intent ? window.GranaryApp.launchIntentUri(live.url) : window.GranaryApp.launch(live.url, live.pkg, ''); if (r !== 'started') setMsg('Could not open the app: ' + r); };
    return a;
  }
  function setMsg(t) { const m = $('programmeMessage'); if (m) m.textContent = t; }
  function closeBtn() { const b = h('button', 'sheetClose', '✕'); b.setAttribute('aria-label', 'Close'); b.onclick = () => $('panel').classList.remove('open'); return b; }

  function showGuidePanel({ p, ch }) {
    if (NX.toastKind === 'copy' && NX.shown !== NX.sel) hideToast();
    const panel = $('panel'), now = new Date(), onNow = p.start <= now && p.end > now;
    selectedProgramme = { p, ch }; NX.shown = NX.sel;
    const lib = inLibrary(p.title), linked = isLinked(p.title);
    const text = h('div', 'infoText');
    let when = ch.display + ' · ' + (weekOffset === 0 && selected === 0 ? 'Today' : fmtDay(p.start)) + ' · ' + fmtT(p.start) + '–' + fmtT(p.end);
    if (onNow) when += ' · on now'; else if (p.start > now && p.start - now < 3 * 36e5) when += ' · starts in ' + Math.max(1, Math.round((p.start - now) / 60000)) + ' min';
    text.append(h('div', 'meta', when));
    const t = h('h1', '', p.title);
    if (linked) t.append(h('span', 'tag link', 'SERIES LINKED')); else if (lib) t.append(h('span', 'tag ok', 'IN LIBRARY'));
    text.append(t, h('p', 'desc', p.description || (p.genre ? p.genre : '')));
    if (onNow) { const bar = h('div', 'bar'), i = h('i'); i.style.width = Math.round((now - p.start) / (p.end - p.start) * 100) + '%'; bar.append(i); text.append(bar); }
    const msg = h('div', 'msg'); msg.id = 'programmeMessage'; text.append(msg);
    const acts = h('div', 'acts');
    if (onNow) { const w = watchLiveBtn(ch); if (w) acts.append(w); }
    const service = providerForChannel(ch.display);
    acts.append(providerBtn(p.title, service, 'btn' + (acts.children.length ? '' : ' p')));
    if (lib) {
      const on = lib.some(i => i.series_link), b = h('button', 'btn', on ? '🔗 Series: On' : '🔗 Series: Off');
      b.onclick = async () => { b.disabled = true; await granarySetSeriesLink(lib, !on); };
      acts.append(b);
    } else {
      const b = h('button', 'btn', '＋ Library');
      b.onclick = async () => {
        if (!currentUser) { openAuth(); return; }
        b.disabled = true; b.textContent = 'Adding…';
        await addSelectedToLibrary(); await openLibrary();
        const m = $('programmeMessage') ? $('programmeMessage').textContent : ''; showGuidePanel({ p, ch }); setMsg(m);
      };
      acts.append(b);
    }
    const more = h('button', 'btn', 'More'); more.setAttribute('aria-label', 'More options'); more.onclick = () => openMore(p.title, service, p.description, null);
    acts.append(more);
    panel.innerHTML = ''; panel.append(closeBtn(), text, acts);
  }

  function openMore(title, mainService, description, group) {
    $('moreTitle').textContent = title; const body = $('moreBody'); body.innerHTML = '';
    if (description) body.append(h('p', 'muted', description));
    const services = Array.isArray(currentUser?.user_metadata?.streaming_services) ? currentUser.user_metadata.streaming_services : GRANARY_SERVICES;
    services.filter(s => s !== mainService).forEach(s => body.append(providerBtn(title, s, 'providerLookup', group ? () => granaryMarkSeriesSeen(group.items) : null)));
    if (group) {
      const rm = h('button', 'danger', 'Remove from library'); let armed = false;
      rm.onclick = async () => {
        if (!armed) { armed = true; rm.textContent = 'Press again to remove ' + title; return; }
        await granaryClient.from('library_items').delete().in('id', group.items.map(i => i.id));
        $('morePanel').classList.remove('open'); NX.libSel = null; await openLibrary();
      };
      body.append(rm);
      const n = group.items.length; body.append(h('p', 'moreNote', 'Saved ' + (n === 1 ? 'once' : n + ' times') + ' · added ' + new Date(group.items[group.items.length - 1].created_at || Date.now()).toLocaleDateString('en-GB')));
    }
    body.append(h('p', 'moreNote', 'Search links don’t confirm the programme is available.'));
    $('morePanel').classList.add('open');
  }

  // ── Library ─────────────────────────────────────────────────
  let metaBusy = false; const metaTried = new Set();
  openLibrary = async function () {
    if (!currentUser) { NX.groups = []; NX.libKeys = new Map(); renderLibrary(); return; }
    const { data, error } = await granaryClient.from('library_items').select('*').order('created_at', { ascending: false });
    if (error) { $('libGrid').textContent = 'Could not load your library: ' + error.message; return; }
    await loadGranaryMetadata(); await loadGranaryVerifiedLinks();
    const map = new Map(); (data || []).forEach(r => { const k = granarySeriesKey(r.title); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    const now = new Date();
    NX.libKeys = map;
    NX.groups = [...map.entries()].map(([key, items]) => {
      const i = items.find(x => x.next_airing_at) || items[0];
      const next = i.next_airing_at ? new Date(i.next_airing_at) : null, nextEnd = i.next_airing_end ? new Date(i.next_airing_end) : null;
      const lastAired = items.reduce((m, x) => x.last_aired_at && new Date(x.last_aired_at) > m ? new Date(x.last_aired_at) : m, new Date(0));
      const seen = items.reduce((m, x) => { const t = new Date(x.series_seen_at || x.created_at || 0); return t > m ? t : m; }, new Date(0));
      const title = items[0].title.replace(/^\s*(new|live)\s*:\s*/i, '');
      const aired = lastAired.getTime() > 0 || items.some(x => x.end_at && new Date(x.end_at) <= now);
      return { key, title, items, aired, next: next && (nextEnd || next) > now ? next : null, nextEnd, onNow: !!(next && next <= now && nextEnd && nextEnd > now),
        channel: i.next_airing_channel || items[0].channel || '', linked: items.some(x => x.series_link), isNew: lastAired > seen,
        meta: [granaryNormaliseTitle(title), granaryNormaliseTitle(items[0].title)].map(k => granaryMetadataByTitle[k]).find(r => r && r.match_status === 'matched') || granaryMetadataByTitle[granaryNormaliseTitle(title)] };
    });
    NX.libLoaded = true;
    renderLibrary(); if (NX.tab === 'guide') render();
    setTimeout(() => granaryAutoFillLibrary(data || []), 0);
    // Artwork/summary lookups: each title is tried once per visit, so a failed lookup can't repeat forever.
    const needs = g => !(g.meta && g.meta.match_status === 'matched') && granaryMetaNeedsLookup(granaryNormaliseTitle(g.title)) && !metaTried.has(g.key);
    const todo = NX.groups.filter(needs).slice(0, 4);
    if (granaryMetadataSetupReady && !metaBusy && todo.length) {
      todo.forEach(g => metaTried.add(g.key)); metaBusy = true;
      startGranaryMetadataLookups(todo.map(g => ({ title: g.title }))).finally(() => { metaBusy = false; if (NX.groups.some(needs)) setTimeout(openLibrary, 500); });
    }
  };
  // Tell you when the series check finds a new showing of something you follow.
  function seriesNews(before) {
    if (!before.size) return;
    const found = NX.groups.filter(g => g.linked && g.next && before.has(g.key) && before.get(g.key) !== +g.next && +g.next > Date.now());
    if (!found.length) return;
    const f = found[0], more = found.length > 1 ? ' and ' + (found.length - 1) + ' more' : '';
    toast('🔗 New showing: ' + f.title + ' – ' + fmtWhen(f.next) + more);
  }
  function sortedGroups() {
    const g = [...NX.groups];
    g.sort((a, b) => (b.onNow - a.onNow) || ((a.next ? 0 : 1) - (b.next ? 0 : 1)) || ((a.next || 0) - (b.next || 0)) || a.title.localeCompare(b.title));
    const f = { all: () => true, ready: x => x.aired || x.onNow, soon: x => !x.aired && !x.onNow, linked: x => x.linked, new: x => x.isNew }[NX.libFilter] || (() => true);
    return g.filter(f);
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.round(v * 0.55)); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
  const TINTS = ['#e7f4f1', '#f1ecfd', '#eef1f5', '#fdeef0', '#f2f5ea', '#fdf3e3', '#e8f0fb', '#f5ecf4'];
  function renderLibrary() {
    const chips = $('libChips'), grid = $('libGrid'); chips.innerHTML = ''; grid.innerHTML = '';
    if (!currentUser) {
      chips.hidden = true; const e = h('div', 'libEmpty'); e.append(h('div', '', 'Sign in to see your library on this device.'));
      const b = h('button', 'btn p', 'Sign in'); b.onclick = openAuth; e.append(b); grid.append(e);
      if (NX.tab === 'library') $('panel').innerHTML = '';
      return;
    }
    chips.hidden = false;
    const counts = { all: NX.groups.length, ready: NX.groups.filter(x => x.aired || x.onNow).length, soon: NX.groups.filter(x => !x.aired && !x.onNow).length, linked: NX.groups.filter(x => x.linked).length, new: NX.groups.filter(x => x.isNew).length };
    [['all', 'All'], ['ready', '✓ Ready to watch'], ['soon', '⏰ Coming up'], ['linked', 'Series linked'], ['new', 'New episodes']].forEach(([k, l]) => {
      if ((k === 'new' || k === 'soon') && !counts[k] && NX.libFilter !== k) return;
      const c = h('button', 'chip' + (NX.libFilter === k ? ' on' : ''), l + ' ' + counts[k]); c.onclick = () => { NX.libFilter = k; renderLibrary(); }; chips.append(c);
    });
    const list = sortedGroups();
    if (!NX.groups.length) { grid.append(h('div', 'libEmpty', 'Your library is empty. Pick a programme in the Guide and choose ＋ Library.')); if (NX.tab === 'library') $('panel').innerHTML = ''; return; }
    if (!list.length) grid.append(h('div', 'libEmpty', 'Nothing here yet.'));
    if (!list.some(x => x.key === NX.libSel)) NX.libSel = list[0] ? list[0].key : null;
    const wasTile = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('st');
    list.forEach((g, i) => {
      const t = h('button', 'st' + (g.key === NX.libSel ? ' sel' : '')); t.dataset.k = g.key;
      const art = h('div', 'art'); art.append(h('span', '', g.channel.replace(/\s+HD$/i, '') || 'Granary TV'));
      if (g.meta && g.meta.match_status === 'matched' && g.meta.image_url) { art.style.backgroundImage = 'url("' + g.meta.image_url + '")'; art.classList.add('img'); }
      else { const bd = badgeFor(g.channel); art.classList.add('ph'); art.style.background = 'linear-gradient(135deg,' + bd.col + ',' + shade(bd.col) + ')'; art.append(h('i', 'phBadge', bd.label)); }
      const state = g.onNow ? ['live', '● ON NOW'] : g.aired ? ['ready', '✓ READY'] : ['soon', '⏰ COMING UP'];
      art.append(h('em', 'state ' + state[0], g.isNew && g.aired && !g.onNow ? '✓ NEW EPISODE' : state[1]));
      t.classList.add('is-' + state[0]);
      const sm = h('small');
      if (g.onNow) { sm.append(h('span', 'live', '● On now'), document.createTextNode(' · ' + (g.channel || ''))); }
      else if (!g.aired) sm.textContent = g.next ? 'First shown ' + fmtWhen(g.next) : 'Not shown yet';
      else sm.textContent = 'Ready to watch' + (g.next ? ' · next ' + fmtWhen(g.next) : '');
      const ready = g.aired || g.onNow;
      t.append(art, h('b', '', (g.linked ? '🔗 ' : '') + g.title), sm, h('span', 'hint', NX.tv ? 'Press OK for options' : ready ? 'Tap again to watch · hold or ⋯ for options' : 'Tap again for options'));
      if (!NX.tv) {
        const more = h('span', 'tileMore', '⋯'); more.setAttribute('role', 'button'); more.setAttribute('aria-label', 'Options for ' + g.title);
        more.addEventListener('click', e => { e.stopPropagation(); if (NX.libSel !== g.key) selectShow(g.key, false); openTileMenu(g, t); });
        t.append(more);
        // press and hold = options box
        let holdTimer = null;
        t.addEventListener('pointerdown', e => { holdTimer = null; if (e.target === more) return; holdTimer = setTimeout(() => { holdTimer = 'fired'; if (NX.libSel !== g.key) selectShow(g.key, false); openTileMenu(g, t); }, 550); });
        const cancel = () => { if (holdTimer && holdTimer !== 'fired') clearTimeout(holdTimer); };
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => t.addEventListener(ev, cancel));
        t.addEventListener('click', e => { if (holdTimer === 'fired') { e.stopImmediatePropagation(); e.preventDefault(); } holdTimer = null; }, true);
        t.addEventListener('contextmenu', e => e.preventDefault());
      }
      // First press selects; pressing the highlighted show again opens its options box (on a TV, OK opens it straight away).
      // TV: OK opens the options box. iPad/computer: tapping the highlighted show starts it (or shows options if it hasn't been on yet).
      t.onclick = e => {
        if (NX.libSel !== g.key || NX.phone()) { selectShow(g.key, true); return; }
        if (NX.tv || e.detail === 0 || !ready) { openTileMenu(g, t); return; }   // remote/keyboard OK (detail 0) → options
        const main = $('panel').querySelector('.acts a');
        if (main) main.click(); else openTileMenu(g, t);
      };
      t.onfocus = () => { if (NX.libSel !== g.key) selectShow(g.key, false); };
      grid.append(t);
    });
    if (NX.tab === 'library') { if (!$('panel').contains(document.activeElement)) showLibraryPanel(); if (wasTile) { const el = grid.querySelector('.st.sel'); if (el) el.focus({ preventScroll: true }); } }
  }
  function selectShow(k, activate) {
    NX.libSel = k; $('libGrid').querySelectorAll('.st').forEach(e => e.classList.toggle('sel', e.dataset.k === k));
    showLibraryPanel();
    if (activate && NX.phone()) $('panel').classList.add('open');
  }
  function openTileMenu(g, tile) {
    const menu = $('tileMenu'), card = menu.querySelector('.menuCard'), body = $('tileMenuBody');
    $('tileMenuTitle').textContent = g.title; body.innerHTML = '';
    const ready = g.aired || g.onNow, service = providerForChannel(g.items[0].channel || g.channel), seen = () => granaryMarkSeriesSeen(g.items);
    if (g.onNow) { const w = watchLiveBtn(channelObj(g.channel)); if (w) { w.className = 'mi watchLive'; w.addEventListener('click', seen); body.append(w); } }
    const pb = providerBtn(g.title, service, 'mi', seen); if (!ready) pb.textContent = 'Not on ' + service + ' yet – check anyway'; body.append(pb);
    const sb = h('button', 'mi', g.linked ? '🔗 Turn series link off' : '🔗 Turn series link on');
    sb.onclick = async () => { closeTileMenu(); await granarySetSeriesLink(g.items, !g.linked); };
    const rm = h('button', 'mi danger', '🗑 Remove from library'); rm.onclick = () => { closeTileMenu(); removeShow(g); };
    const cancel = h('button', 'mi close', 'Close'); cancel.onclick = closeTileMenu;
    body.append(sb, rm, cancel);
    // place the box over the tile (centred on phones / small screens)
    const r = tile.getBoundingClientRect(), w = Math.min(card.offsetWidth || 320, innerWidth - 24);
    card.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    card.style.top = Math.max(12, Math.min(innerHeight - 340, r.top + 24)) + 'px';
    NX.menuReturn = tile; menu.classList.add('open');
    setTimeout(() => { const f = body.querySelector('.mi'); if (f) f.focus(); }, 30);
  }
  function closeTileMenu() { $('tileMenu').classList.remove('open'); const t = NX.menuReturn; if (t && t.isConnected) t.focus({ preventScroll: true }); }
  NX.closeTileMenu = closeTileMenu;
  let undoTimer = null;
  async function removeShow(g) {
    $('panel').classList.remove('open');
    const rows = g.items.map(r => ({ ...r }));
    const { error } = await granaryClient.from('library_items').delete().in('id', rows.map(r => r.id));
    if (error) { toast('Could not remove: ' + error.message); return; }
    NX.libSel = null; await openLibrary();
    toast('Removed ' + g.title, 'Undo', async () => {
      const { error: e2 } = await granaryClient.from('library_items').insert(rows);
      if (e2) toast('Could not undo: ' + e2.message); else { NX.libSel = g.key; await openLibrary(); toast('Put back ' + g.title); }
    });
  }
  function toast(text, action, fn, kind) {
    const el = $('toast'); NX.toastKind = kind || ''; el.innerHTML = ''; el.append(h('span', '', text));
    if (action) { const b = h('button', '', action); b.onclick = () => { hideToast(); fn(); }; el.append(b); }
    el.classList.add('show'); clearTimeout(undoTimer); undoTimer = setTimeout(hideToast, action ? 8000 : 3000);
    if (action && (NX.tv || document.documentElement.classList.contains('remoteNav'))) el.querySelector('button').focus();
  }
  function hideToast() {
    const el = $('toast'), had = el.contains(document.activeElement); el.classList.remove('show');
    if (had) { const t = document.querySelector('#libGrid .st.sel') || document.querySelector('#libGrid .st'); if (t) t.focus(); }
  }
  function channelObj(name) {
    const n = norm(name); return channels.find(c => norm(c.display) === n || norm(c.sourceName) === n) || { display: name, sourceName: name };
  }
  function showLibraryPanel() {
    if (NX.toastKind === 'copy') hideToast();
    const panel = $('panel'), g = NX.groups.find(x => x.key === NX.libSel);
    if (!g) { panel.innerHTML = ''; return; }
    const text = h('div', 'infoText');
    let when = g.onNow ? (g.channel + ' · on now')
      : !g.aired ? (g.next ? 'Not shown yet – first showing ' + fmtWhen(g.next) + ' on ' + g.channel : 'Not shown yet')
      : g.next ? ('Ready to watch · next showing ' + fmtWhen(g.next) + ' · ' + g.channel) : ('Ready to watch · ' + (g.channel || '') + ' · no showings in the next 7 days');
    text.append(h('div', 'meta', when));
    const t = h('h1', '', g.title); if (!g.aired && !g.onNow) t.append(h('span', 'tag soon', 'COMING UP')); else if (!g.onNow) t.append(h('span', 'tag ok', 'READY TO WATCH')); if (g.linked) t.append(h('span', 'tag link', 'SERIES LINKED')); if (g.isNew && g.aired) t.append(h('span', 'tag', 'NEW EPISODE'));
    const desc = (g.meta && g.meta.match_status === 'matched' && g.meta.summary) || g.items.find(i => i.description)?.description || '';
    text.append(t, h('p', 'desc', desc));
    const msg = h('div', 'msg'); msg.id = 'programmeMessage'; text.append(msg);
    const acts = h('div', 'acts'), seen = () => granaryMarkSeriesSeen(g.items);
    if (g.onNow) { const w = watchLiveBtn(channelObj(g.channel)); if (w) { w.addEventListener('click', seen); acts.append(w); } }
    const service = providerForChannel(g.items[0].channel || g.channel);
    const ready = g.aired || g.onNow;
    const pb = providerBtn(g.title, service, 'btn' + (acts.children.length || !ready ? '' : ' p'), seen);
    if (!ready) { pb.textContent = 'Not on ' + service + ' yet – check anyway'; pb.title = 'It hasn\u2019t been shown yet, so it probably isn\u2019t on ' + service + ' until after ' + (g.next ? fmtWhen(g.next) : 'it airs'); }
    acts.append(pb);
    const sb = h('button', 'btn', g.linked ? '🔗 Series: On' : '🔗 Series: Off');
    sb.onclick = async () => { sb.disabled = true; await granarySetSeriesLink(g.items, !g.linked); };
    acts.append(sb);
    if (NX.phone()) { const rm = h('button', 'btn', '🗑 Remove'); rm.onclick = () => removeShow(g); acts.append(rm); }
    const more = h('button', 'btn', 'More'); more.setAttribute('aria-label', 'More options'); more.onclick = () => openMore(g.title, service, desc, g); acts.append(more);
    panel.innerHTML = ''; panel.append(closeBtn(), text, acts);
  }

  // ── Tabs ────────────────────────────────────────────────────
  function showTab(tab) {
    NX.tab = tab; $('panel').classList.remove('open');
    $('tabGuide').classList.toggle('on', tab === 'guide'); $('tabLibrary').classList.toggle('on', tab === 'library');
    $('guideView').hidden = tab !== 'guide'; $('libraryView').hidden = tab !== 'library'; $('nxDays').hidden = tab !== 'guide';
    if (tab === 'guide') render(); else { renderLibrary(); if (!NX.libLoaded) openLibrary(); }
    try { history.replaceState(null, '', tab === 'library' ? '#library' : location.pathname + location.search); } catch (e) {}
  }
  NX.showTab = showTab;

  // ── Signed in / out ─────────────────────────────────────────
  const baseUpdate = updateCloudUI;
  let lastUser = undefined;
  updateCloudUI = function () {
    baseUpdate();
    $('signInBtn').textContent = currentUser ? 'Account and password' : 'Sign in';
    const id = currentUser ? currentUser.id : null;
    if (id === lastUser) return; lastUser = id;
    NX.libLoaded = false;
    openLibrary();
  };
  // Series links: refresh the library after each background check.
  const baseSeries = granarySeriesBackground;
  granarySeriesBackground = async function () { if (weekOffset !== 0) return;   // only this week's listings say what's coming up
    const before = new Map(NX.groups.map(g => [g.key, g.next ? +g.next : 0]));
    await baseSeries();
    if (currentUser && NX.libLoaded) { await openLibrary(); seriesNews(before); return; } if (currentUser && NX.libLoaded) openLibrary(); };

  // ── Clock and weather dials ─────────────────────────────────
  function dial(el, frac, colour, text, title) {
    el.style.setProperty('--p', Math.max(0, Math.min(1, frac))); el.style.setProperty('--c', colour);
    el.firstElementChild.textContent = text; if (title) el.title = title;
  }
  function timeColour(h) { return h >= 5 && h < 9 ? '#f59e0b' : h >= 9 && h < 17 ? '#0ea5e9' : h >= 17 && h < 21 ? '#f97316' : '#6366f1'; }
  function tickClock() {
    const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60;
    dial($('nxClock'), m / 60, timeColour(d.getHours()), String(d.getHours()), fmtT(d) + ' – ' + d.getMinutes() + ' minutes past');
  }
  const TEMP_STOPS = [[-5, [109, 40, 217]], [0, [37, 99, 235]], [5, [14, 165, 233]], [10, [16, 185, 129]], [15, [234, 179, 8]], [20, [249, 115, 22]], [25, [220, 38, 38]]];
  function tempColour(t) {
    if (t <= TEMP_STOPS[0][0]) return 'rgb(' + TEMP_STOPS[0][1] + ')';
    for (let i = 1; i < TEMP_STOPS.length; i++) { const [b, cb] = TEMP_STOPS[i], [a, ca] = TEMP_STOPS[i - 1]; if (t <= b) { const k = (t - a) / (b - a); return 'rgb(' + ca.map((v, j) => Math.round(v + (cb[j] - v) * k)) + ')'; } }
    return 'rgb(' + TEMP_STOPS[TEMP_STOPS.length - 1][1] + ')';
  }
  const WX = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };
  async function loadWeather() {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=53.96&longitude=-1.08&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FLondon&forecast_days=1');
      if (!r.ok) throw Error(r.status);
      const j = await r.json(), t = j.current.temperature_2m, hi = j.daily.temperature_2m_max[0], lo = j.daily.temperature_2m_min[0];
      // the whole ring takes the temperature's colour: purple/blue when cold, green when mild, orange/red when warm
      dial($('nxTemp'), 1, tempColour(t), Math.round(t) + '°', 'York: ' + Math.round(t) + '°C, ' + (WX[j.current.weather_code] || '') + ' · today ' + Math.round(lo) + '° to ' + Math.round(hi) + '°');
      try { localStorage.setItem('granary-weather', JSON.stringify({ t, code: j.current.weather_code, hi, lo, at: Date.now() })); } catch (e) {}
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem('granary-weather') || 'null'); if (c) dial($('nxTemp'), 1, tempColour(c.t), Math.round(c.t) + '°', 'York (saved): ' + Math.round(c.t) + '°C'); } catch (e2) {}
    }
  }
  NX.tempColour = tempColour;
  function showSkyStatus() {
    const el = $('skyStatus'); if (!el) return;
    const s = window.granarySkyStatus && window.granarySkyStatus();
    const hasSky = channels.some(c => String(c.id).startsWith('sky:'));
    if (!hasSky) { el.textContent = 'Sky channels: none added (add them in Add or remove channels)'; return; }
    if (!s) { el.textContent = 'Sky channels: not checked yet'; return; }
    const when = new Date(s.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    el.textContent = s.ok ? '✓ Sky channels working · updated ' + when : '⚠ Sky listings not loading (' + s.msg + ') · last tried ' + when + '. Showing saved listings – ask Claude to “fix Sky listings”.';
    el.classList.toggle('warn', !s.ok);
  }

  // ── Wiring ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('tabGuide').onclick = () => showTab('guide');
    $('tabLibrary').onclick = () => showTab('library');
    if (NX.tv) $('classicLink').href = 'classic-tv.html';
    $('nxSettings').onclick = () => { showSkyStatus(); $('settingsPanel').classList.add('open'); };
    document.querySelectorAll('.cloudPanel .close').forEach(b => { if (!b.onclick) b.onclick = () => b.closest('.cloudPanel').classList.remove('open'); });
    $('settingsPanel').addEventListener('click', e => { if (e.target.id === 'manage' || e.target.id === 'servicesBtn' || e.target.id === 'signInBtn') $('settingsPanel').classList.remove('open'); if (e.target.id === 'refresh') { $('settingsPanel').classList.remove('open'); } }, true);
    document.querySelectorAll('.cloudPanel').forEach(p => p.addEventListener('click', e => { if (e.target === p) { p.classList.remove('open'); if (p.id === 'tileMenu') closeTileMenu(); } }));
    $('earlier').onclick = () => { setWindow(startHour - 1); render(); };
    $('later').onclick = () => { setWindow(startHour + 1); render(); };
    document.querySelectorAll('.jump').forEach(b => b.onclick = () => { const hr = b.dataset.h === 'eve' ? defaultStart() : +b.dataset.h; setWindow(hr); NX.sel = null; render(); });
    $('nowBtn').onclick = () => { const d = new Date(); selected = 0; setWindow(Math.floor((d.getHours() * 60 + d.getMinutes()) / 30) / 2); NX.sel = null; renderDays(); render(); };
    const hs = $('nxHours'); for (let hr = 6; hr <= 21; hr++) hs.add(new Option(pad(hr) + ':00', hr)); hs.value = String(defaultStart());
    hs.onchange = () => { localStorage.setItem(WIN_KEY, hs.value); setWindow(+hs.value); render(); };
    renderDays();
    tickClock(); setInterval(tickClock, 15000); loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);
    if (location.hash === '#library') showTab('library');
    document.addEventListener('visibilitychange', () => { if (!document.hidden && NX.toastKind === 'copy') setTimeout(hideToast, 1500); });
    const setHdr = () => document.documentElement.style.setProperty('--hdr', document.querySelector('.top').offsetHeight + 'px');
    setHdr(); addEventListener('resize', setHdr);
    addEventListener('scroll', () => { const y = scrollY, on = document.body.classList.contains('scrolled'); if (!on && y > 60) document.body.classList.add('scrolled'); else if (on && y < 8) document.body.classList.remove('scrolled'); }, { passive: true });
    let lastPhone = NX.phone();
    addEventListener('resize', () => { const p = NX.phone(); if (p !== lastPhone) { lastPhone = p; setWindow(startHour); render(); } else sizeRows($('nxGrid')); });
    // On a TV, start with the selected programme focused.
    if (NX.tv) { const t = setInterval(() => { const cur = NX.tiles.get(NX.sel); if (cur) { clearInterval(t); cur.el.focus(); document.documentElement.classList.add('remoteNav'); } }, 300); setTimeout(() => clearInterval(t), 20000); }
  });

  // Remote: moving past the edge of the hours shown scrolls the guide earlier/later.
  addEventListener('keydown', e => {
    if (NX.tab !== 'guide' || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const a = document.activeElement; if (!a || !a.classList || !a.classList.contains('tile')) return;
    const cur = NX.tiles.get(a.dataset.k); if (!cur) return;
    const list = dayProgrammes(cur.ch), i = list.findIndex(p => p.start.getTime() === cur.p.start.getTime());
    const key = dateKey(dateFor(selected));
    const target = list[i + (e.key === 'ArrowRight' ? 1 : -1)]; if (!target) return;
    const [ta, tb] = mins(target, key);
    if (e.key === 'ArrowRight' && ta < endHour * 60) return;    // already on screen – normal movement
    if (e.key === 'ArrowLeft' && tb > startHour * 60) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'ArrowRight') { if (endHour >= 24) return; setWindow(Math.min(Math.floor(ta / 60), startHour + winLen() - 1)); }
    else { if (startHour <= 0) return; setWindow(Math.max(Math.ceil(tb / 60) - winLen(), startHour - winLen() + 1)); }
    NX.sel = tileKey(cur.ch, target); render();
    const n = NX.tiles.get(NX.sel); if (n) n.el.focus({ preventScroll: true });
  }, true);
})();
