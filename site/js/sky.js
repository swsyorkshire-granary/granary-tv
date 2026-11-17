// Sky channels for Granary TV (Sky Atlantic, Sky Witness, …).
//
// The main listings service doesn't carry Sky's own channels, so this file adds them from the guide data
// behind Sky's website. It works by quietly answering the guide's requests for Sky channels:
//   • the channel list gets Sky channels added (ids like "sky:skyatlantic"),
//   • a listings request for a "sky:" channel is answered from Sky's schedule instead.
// Everything else goes to the normal listings service untouched.
//
// Built to be easy to fix if Sky changes things (see FIXING-SKY.md):
//   • web addresses live in /sky-config.json, not in code;
//   • channels are found by NAME each day, so Sky renumbering a channel fixes itself;
//   • if Sky fails, only Sky rows are affected and they keep the last saved listings;
//   • the result of the last attempt is shown in Settings (window.granarySkyStatus()).
// If Sky changes the *shape* of its data, the only code to change is readSchedule() below.
(function () {
  const ONTV = 'https://www.ontvnow.co.uk/api/v1';
  const AUTO_ADD = ['Sky Atlantic', 'Sky Witness'];          // added once to this device's channels
  const STATUS_KEY = 'granary-sky-status', SIDS_KEY = 'granary-sky-sids', ADDED_KEY = 'granary-sky-added';
  const keyOf = name => String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
  const cleanName = t => String(t || '').replace(/\s*HD\s*$/i, '').replace(/HistoryHD$/i, 'History').trim();
  const realFetch = window.fetch.bind(window);

  // 1. Add Sky Atlantic and Sky Witness to this device's saved channels, once.
  try {
    if (!localStorage.getItem(ADDED_KEY)) {
      const stored = JSON.parse(localStorage.getItem('agrid-channel-ids') || 'null');
      if (Array.isArray(stored) && stored.length) {
        AUTO_ADD.forEach(name => {
          const id = 'sky:' + keyOf(name);
          if (!stored.some(c => c.id === id || keyOf(c.display) === keyOf(name) && c.id != null)) stored.push({ id, display: name, sourceName: name });
        });
        localStorage.setItem('agrid-channel-ids', JSON.stringify(stored));
      }
      localStorage.setItem(ADDED_KEY, '1');
    }
  } catch (e) {}

  // 2. Settings and status.
  let configP = null;
  function config() {
    if (!configP) configP = realFetch('sky-config.json?v=' + Math.floor(Date.now() / 36e5), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error('sky-config.json ' + r.status); return r.json(); })
      .catch(() => ({ servicesUrl: 'https://awk.epgsky.com/hawk/linear/services/4101/1', scheduleUrl: 'https://awk.epgsky.com/hawk/linear/schedule/{date}/{sid}', maxChannelNumber: 199, channels: [{ name: 'Sky Atlantic', sid: '4053' }, { name: 'Sky Witness', sid: '4066' }] }));
    return configP;
  }
  function setStatus(ok, msg) { try { localStorage.setItem(STATUS_KEY, JSON.stringify({ ok, msg: msg || '', at: Date.now() })); } catch (e) {} }
  window.granarySkyStatus = () => { try { return JSON.parse(localStorage.getItem(STATUS_KEY) || 'null'); } catch (e) { return null; } };

  // 3. Sky channel names → Sky's service ids. Looked up from Sky once a day; falls back to sky-config.json.
  let sidsP = null;
  function skyChannels(force) {
    if (sidsP && !force) return sidsP;
    sidsP = (async () => {
      const cfg = await config();
      try {
        const saved = JSON.parse(localStorage.getItem(SIDS_KEY) || 'null');
        if (!force && saved && Date.now() - saved.at < 864e5 && saved.list.length) return saved.list;
      } catch (e) {}
      try {
        const r = await realFetch(cfg.servicesUrl); if (!r.ok) throw Error('Sky channel list ' + r.status);
        const j = await r.json(), seen = new Set(), list = [];
        (j.services || []).forEach(s => {
          const name = cleanName(s.t), k = keyOf(name);
          if (!/^sky/.test(k) || /sports|news|cinema|kids|bet|boxoffice|ppv/.test(k)) return;
          if (Number(s.c) > (cfg.maxChannelNumber || 199) || seen.has(k)) return;
          seen.add(k); list.push({ name, key: k, sid: String(s.sid) });
        });
        if (!list.length) throw Error('Sky channel list was empty');
        localStorage.setItem(SIDS_KEY, JSON.stringify({ at: Date.now(), list }));
        return list;
      } catch (e) {
        console.warn('Granary TV: Sky channel list unavailable, using sky-config.json –', e.message);
        return cfg.channels.map(c => ({ name: c.name, key: keyOf(c.name), sid: String(c.sid) }));
      }
    })();
    return sidsP;
  }

  // 4. One day of one channel from Sky → programmes { title, start, end, description }.
  //    If Sky changes the layout of its data, this is the function to update.
  function readSchedule(json) {
    const events = (json && json.schedule && json.schedule[0] && json.schedule[0].events) || [];
    return events.map(e => ({
      title: e.t, start: new Date(e.st * 1000).toISOString(), end: new Date((e.st + e.d) * 1000).toISOString(),
      description: e.sy || '', genre: ''
    })).filter(p => p.title);
  }
  // Saved copies in Supabase (table sky_listings_archive), so past days stay available after Sky drops them.
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const db = () => (typeof granaryClient !== 'undefined' ? granaryClient : null);
  async function readArchive(key, days) {
    const c = db(); if (!c || !days.length) return {};
    try {
      const { data, error } = await c.from('sky_listings_archive').select('day,items').eq('channel_key', key).in('day', days.map(isoDay));
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.day, r.items || []]));
    } catch (e) { console.warn('Granary TV: Sky archive read failed –', e.message || e); return {}; }
  }
  async function saveArchive(key, byDay) {
    const c = db(); if (!c || typeof currentUser === 'undefined' || !currentUser) return;   // saving needs a signed-in device
    const keep = new Date(); keep.setHours(0, 0, 0, 0); keep.setDate(keep.getDate() - 1);
    const rows = Object.entries(byDay).filter(([day, items]) => items.length && new Date(day + 'T12:00') >= keep && !savedToday(key, day))
      .map(([day, items]) => ({ channel_key: key, day, items, updated_at: new Date().toISOString() }));
    if (!rows.length) return;
    try { const { error } = await c.from('sky_listings_archive').upsert(rows, { onConflict: 'channel_key,day' }); if (error) throw error; rows.forEach(r => markSaved(key, r.day)); }
    catch (e) { console.warn('Granary TV: Sky archive save failed –', e.message || e); }
  }
  // each device saves a given channel/day at most every 6 hours
  function savedToday(key, day) { try { const m = JSON.parse(localStorage.getItem('granary-sky-saved') || '{}'); return m[key + day] && Date.now() - m[key + day] < 6 * 36e5; } catch (e) { return false; } }
  function markSaved(key, day) { try { const m = JSON.parse(localStorage.getItem('granary-sky-saved') || '{}'); m[key + day] = Date.now(); for (const k in m) if (Date.now() - m[k] > 3 * 864e5) delete m[k]; localStorage.setItem('granary-sky-saved', JSON.stringify(m)); } catch (e) {} }
  const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

  async function skyListings(key, from, to) {
    const cfg = await config();
    let ch = (await skyChannels()).find(c => c.key === key);
    if (!ch) ch = (await skyChannels(true)).find(c => c.key === key);       // maybe renamed/renumbered: look again
    if (!ch) throw Error('Sky no longer lists this channel');
    const days = []; const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 1);
    while (d <= to) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const byDay = {};
    const fetchDay = async day => {
      const r = await realFetch(cfg.scheduleUrl.replace('{date}', ymd(day)).replace('{sid}', ch.sid));
      if (!r.ok) throw Error('Sky schedule ' + r.status);
      const items = readSchedule(await r.json()); byDay[isoDay(day)] = items; return items;
    };
    let results = await Promise.allSettled(days.map(fetchDay));
    let got = results.filter(x => x.status === 'fulfilled').flatMap(x => x.value);
    if (!got.length) {                                   // nothing came back: Sky may have renumbered the channel
      const fresh = (await skyChannels(true)).find(c => c.key === key);
      if (fresh && fresh.sid !== ch.sid) { ch = fresh; results = await Promise.allSettled(days.map(fetchDay)); got = results.filter(x => x.status === 'fulfilled').flatMap(x => x.value); }
    }
    // Days Sky no longer lists (the past): fill them from the saved copies.
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const pastEmpty = days.filter(d => d < today0 && !(byDay[isoDay(d)] || []).length);
    if (pastEmpty.length) { const saved = await readArchive(key, pastEmpty); Object.values(saved).forEach(items => got.push(...items)); }
    saveArchive(key, byDay);
    const failed = results.filter(x => x.status === 'rejected');
    // Sky's guide only goes back to about yesterday evening: an empty past week is normal, not a fault.
    if (!got.length && !failed.length && to.getTime() < Date.now() + 864e5) return [];
    if (!got.length) throw Error(failed.length ? failed[0].reason.message : 'Sky returned no programmes');
    const seen = new Set();
    return got.filter(p => new Date(p.end) > from && new Date(p.start) < to && !seen.has(p.start) && seen.add(p.start)).sort((a, b) => a.start.localeCompare(b.start));
  }

  const json = (body, status, err) => new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, err ? { 'X-Granary-Error': err } : {}) });

  // 5. Answer the guide's requests.
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith(ONTV)) return realFetch(input, init);
    const u = new URL(url);
    if (u.pathname.endsWith('/channels')) {
      const res = await realFetch(input, init);
      if (!res.ok) return res;
      const body = await res.json();
      try {
        const sky = (await skyChannels()).map(c => ({ id: 'sky:' + c.key, name: c.name, source: 'sky' }));
        if (Array.isArray(body)) body.push(...sky); else (body.data || body.channels || (body.data = [])).push(...sky);
      } catch (e) {}
      return json(body);
    }
    const id = u.searchParams.get('channel_id') || '';
    if (u.pathname.endsWith('/listings') && id.startsWith('sky:')) {
      if (Number(u.searchParams.get('page') || 1) > 1) return json({ data: [], meta: { last_page: 1 } });
      try {
        const data = await skyListings(id.slice(4), new Date(u.searchParams.get('from')), new Date(u.searchParams.get('to')));
        if (data.length || new Date(u.searchParams.get('to')) > new Date()) setStatus(true);
        return json({ data, meta: { last_page: 1 } });
      } catch (e) {
        setStatus(false, e.message);
        return json({ error: e.message }, 502, 'Sky listings unavailable (' + e.message + ') – see Settings');
      }
    }
    return realFetch(input, init);
  };
})();
