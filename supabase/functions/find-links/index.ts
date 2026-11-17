// Granary TV: find official programme pages on UK streaming services by title.
// Read-only lookup (no database access). POST/GET ?title=Vera[&services=BBC iPlayer,ITVX][&debug=1]
// Returns best[service] only for exact (or "The …"-equivalent) title matches.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const MATCH = 0.95;

const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const slug = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cleanTitle = (s: string) => String(s || '').replace(/^\s*(new|live)\s*:\s*/i, '').trim();
const score = (want: string, got: string) => {
  const a = norm(cleanTitle(want)), b = norm(got); if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.replace(/^the/, '') === a.replace(/^the/, '')) return 0.97;
  if (b.startsWith(a) || a.startsWith(b)) return 0.8;
  if (b.includes(a) || a.includes(b)) return 0.6;
  return 0;
};

async function get(url: string, debug: any[], label: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json, text/html;q=0.9' }, redirect: 'follow' });
    const text = await r.text();
    debug.push({ label, url, status: r.status, ms: Date.now() - t0, finalUrl: r.url, sample: text.slice(0, 300) });
    return { status: r.status, text, finalUrl: r.url };
  } catch (e) { debug.push({ label, url, error: String(e) }); return { status: 0, text: '', finalUrl: url }; }
}

async function bbc(title: string, debug: any[]) {
  const r = await get('https://ibl.api.bbci.co.uk/ibl/v1/new-search?q=' + encodeURIComponent(title) + '&rights=web&lang=en', debug, 'bbc');
  try {
    const list = JSON.parse(r.text)?.new_search?.results || [];
    return list.map((x: any) => ({ service: 'BBC iPlayer', title: x.title, kind: x.type, id: x.id, score: score(title, x.title),
      url: x.type === 'episode' ? 'https://www.bbc.co.uk/iplayer/episode/' + x.id : 'https://www.bbc.co.uk/iplayer/episodes/' + x.id }));
  } catch { return []; }
}

async function itv(title: string, debug: any[]) {
  const u = 'https://textsearch.prd.oasvc.itv.com/search?broadcaster=itv&featureSet=clearkey,outband-webvtt,hls,aes,playready,widevine,fairplay,bbts,progressive,hd,rtmpe&onlyFree=false&platform=dotcom&query=' + encodeURIComponent(title);
  const r = await get(u, debug, 'itv');
  if (r.status !== 200) return [];
  try {
    const list = JSON.parse(r.text)?.results || [];
    return list.map((x: any) => {
      const d = x.data || {}; const t = d.programmeTitle || d.title || d.filmTitle || '';
      const raw = String(d.legacyId?.apiEncoded || d.programmeCCId || ''); // e.g. "1_7314" -> URL id "1a7314"
      const id = raw.replace(/[_/]/g, 'a').replace(/#.*$/, '');
      return { service: 'ITVX', title: t, kind: x.entityType, id: raw, score: score(title, t), url: id && t ? 'https://www.itv.com/watch/' + slug(t) + '/' + id : null };
    }).filter((x: any) => x.url);
  } catch { return []; }
}

async function c4(title: string, debug: any[]) {
  const tried = new Set<string>();
  for (const s of [slug(title), slug(title.replace(/^the\s+/i, '')), 'the-' + slug(title)]) {
    if (!s || tried.has(s)) continue; tried.add(s);
    const r = await get('https://www.channel4.com/programmes/' + s, debug, 'c4:' + s);
    if (r.status === 200 && /\/programmes\//.test(r.finalUrl)) {
      const m = r.text.match(/<title[^>]*>\s*(?:Watch\s+)?([^<|]+?)\s*(?:\||<)/i);
      const t = m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").trim() : title;
      return [{ service: 'Channel 4', title: t, kind: 'brand', score: Math.max(score(title, t), 0.95), url: r.finalUrl.split('?')[0] }];
    }
  }
  return [];
}

async function my5(title: string, debug: any[]) {
  const r = await get('https://corona.channel5.com/shows/search.json?platform=my5desktop&friendly=1&query=' + encodeURIComponent(title), debug, 'my5');
  try {
    const list = JSON.parse(r.text)?.shows || [];
    return list.map((x: any) => ({ service: 'Channel 5', title: x.title, kind: 'show', id: x.id, score: score(title, x.title), url: 'https://www.channel5.com/show/' + (x.f_name || slug(x.title)) }));
  } catch { return []; }
}

// NOW (Sky): NOW's own catalogue search. Needs NOW's standard request labels but no sign-in.
// If NOW changes this, see FIXING-SKY.md. Pages look like https://www.nowtv.com/watch/asset/billions/iYEQZ2rcf32XMWvNCcHXvs
const NOW_HEADERS = { 'X-SkyOTT-Proposition': 'NOWOTT', 'X-SkyOTT-Territory': 'GB', 'X-SkyOTT-ActiveTerritory': 'GB', 'X-SkyOTT-Provider': 'NOWTV', 'X-SkyOTT-Platform': 'PC', 'X-SkyOTT-Device': 'COMPUTER', 'X-SkyOTT-Language': 'en-GB', 'User-Agent': UA, 'Accept': 'application/json' };
async function now(title: string, debug: any[]) {
  const u = new URL('https://web.clients.nowtv.com/bff/search/v2');
  u.searchParams.set('term', cleanTitle(title)); u.searchParams.set('limit', '10');
  u.searchParams.set('contentSegments', 'ENTERTAINMENT,HAYU,KIDS,MOVIES,HBOMAX');
  const t0 = Date.now();
  try {
    const r = await fetch(u, { headers: NOW_HEADERS }); const text = await r.text();
    debug.push({ label: 'now', url: u.toString(), status: r.status, ms: Date.now() - t0, sample: text.slice(0, 300) });
    const list = JSON.parse(text)?.data?.search?.results || [];
    return list.filter((x: any) => x.slug && x.title).map((x: any) => ({ service: 'Sky / NOW', title: x.title, kind: String(x.type || '').toLowerCase().includes('series') ? 'brand' : 'show',
      id: x.id, channel: x.channel?.name || '', score: score(title, x.title), url: 'https://www.nowtv.com/watch/asset' + x.slug,
      // for NOW's own deep links: nowtv://www.nowtv.com/deeplink?deeplinkData={providerSeriesId,type,action}
      providerSeriesId: x.providerSeriesId || String(x.slug).split('/').pop(), nowType: x.type || 'CATALOGUE/SERIES' }));
  } catch (e) { debug.push({ label: 'now', error: String(e) }); return []; }
}

const PROVIDERS: Record<string, (t: string, d: any[]) => Promise<any[]>> = { 'BBC iPlayer': bbc, 'ITVX': itv, 'Channel 4': c4, 'Channel 5': my5, 'Sky / NOW': now };
const rank = (k: string) => (k === 'episode' || k === 'special' ? 0 : 1); // prefer programme/brand pages

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url); let body: any = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }
  const title = String(body.title || url.searchParams.get('title') || '').trim().slice(0, 120);
  const wanted = String(body.services || url.searchParams.get('services') || Object.keys(PROVIDERS).join(',')).split(',').map(s => s.trim()).filter(s => PROVIDERS[s]);
  const debugOn = !!(body.debug || url.searchParams.get('debug'));
  if (!title) return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  const debug: any[] = [];
  const results = (await Promise.all(wanted.map(s => PROVIDERS[s](title, debug).catch(() => [])))).flat();
  const best: Record<string, any> = {};
  for (const r of results) {
    if (r.score < MATCH) continue;
    const b = best[r.service];
    if (!b || r.score > b.score || (r.score === b.score && rank(r.kind) > rank(b.kind))) best[r.service] = r;
  }
  const payload: any = { title, best, checked: wanted };
  if (debugOn) { payload.results = results.slice(0, 40); payload.debug = debug; }
  return new Response(JSON.stringify(payload), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
