// New design (next.html): guide panel, add to library, library tab, series toggle, remote navigation, phone sheet.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const server = http.createServer((q, r) => { const f = path.join(root, new URL(q.url, 'http://x').pathname); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const t0 = new Date(); t0.setHours(0, 0, 0, 0); const at = (d, h) => new Date(+t0 + d * 864e5 + h * 36e5).toISOString();
const stub = `(()=>{
const db=window.__db={library_items:[{id:'v1',title:'Vera',channel:'ITV1',status:'wanted',created_at:'${at(-1, 9)}',start_at:'${at(-1, 20)}',end_at:'${at(-1, 22)}',series_link:true,series_auto:true}],programme_metadata:[],programme_provider_links:[]};
window.__ops=[];
function q(t){const st={op:'select',ids:null};const p={select(){return p},eq(){return p},order(){return p},limit(){return p},ilike(){return p},maybeSingle(){st.one=1;return p},single(){st.one=1;return p},
 in(col,ids){st.ids=ids;return p},insert(r){st.op='insert';st.row=r;return p},upsert(r){st.op='upsert';st.row=r;return p},update(r){st.op='update';st.row=r;return p},delete(){st.op='delete';return p},
 then(a,b){const L=db[t]=db[t]||[];let d=L;if(st.op!=='select')window.__ops.push({t,op:st.op,row:st.row,ids:st.ids});
  if(st.op==='insert'){[].concat(st.row).forEach(r=>L.push(Object.assign({id:'n'+L.length,created_at:new Date().toISOString()},r)));d=st.row}
  if(st.op==='update'){L.forEach(r=>{if(!st.ids||st.ids.includes(r.id))Object.assign(r,st.row)});d=st.row}
  if(st.op==='delete'){db[t]=L.filter(r=>!(st.ids||[]).includes(r.id));d=null}
  if(st.op==='upsert'){d=st.row}
  if(st.one&&Array.isArray(d))d=d[0]||null;return Promise.resolve({data:d,error:null}).then(a,b)}};return p}
const u={id:'u1',email:'t@example.com',user_metadata:{}};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:{user:u}}}),getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({}),updateUser:()=>Promise.resolve({data:{user:u}})}}}};})();`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
let skyMode = 'ok', skyCalls = 0;
async function open(url, vp, presetChannels) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 800 });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(String(e)));
  if (presetChannels) await page.addInitScript(v => { if (!localStorage.getItem('agrid-channel-ids')) localStorage.setItem('agrid-channel-ids', v); }, presetChannels);
  await page.route('https://awk.epgsky.com/**', r => { skyCalls++; const u = new URL(r.request().url());
    if (skyMode === 'down') return r.fulfill({ status: 500, body: 'error' });
    if (u.pathname.includes('/services/')) return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ services: [{ sid: skyMode === 'renumbered' ? '9999' : '4053', c: '108', t: 'Sky Atlantic HD' }, { sid: '4066', c: '107', t: 'Sky Witness HD' }, { sid: '2201', c: '807', t: 'Sky Witness' }, { sid: '4002', c: '401', t: 'Sky Sports Main Event' }] }) });
    const [, , , , date, sid] = u.pathname.split('/');
    if (skyMode === 'renumbered' && sid === '4053') return r.fulfill({ status: 404, body: '' });
    const y = +date.slice(0, 4), m = +date.slice(4, 6) - 1, d = +date.slice(6, 8), base = new Date(y, m, d).getTime() / 1000, ev = [];
    for (let h = 0; h < 24; h++) ev.push({ t: (sid === '4066' ? 'Witness Show ' : sid === '9999' ? 'Renumbered Show ' : 'Atlantic Drama ') + h, st: base + h * 3600, d: 3600, sy: 'Sky synopsis ' + h });
    r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ date, schedule: [{ sid, events: ev }] }) }); });
  await page.clock.install({ time: new Date(+t0 + 20 * 36e5 + 40 * 6e4) });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ current: { temperature_2m: 7.4, weather_code: 3 }, daily: { temperature_2m_max: [9], temperature_2m_min: [3] } }) }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/find-links', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"best":{}}' }));
  await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 1, name: 'BBC One Yorkshire HD' }, { id: 2, name: 'BBC Two HD' }, { id: 3, name: 'ITV1 Calendar HD' }, { id: 12, name: 'Channel 4 North HD' }, { id: 13, name: '5 HD' }] }) });
    const id = Number(u.searchParams.get('channel_id')), out = [];
    for (let d = -7; d < 7; d++) for (let h = 6; h < 24; h++) out.push({ title: id === 3 && h === 20 ? 'Vera' : id === 2 && h === 21 ? 'Coast' : 'Show ' + id + '-' + h, start: at(d, h), end: at(d, h + 1), description: 'About show ' + h });
    const f0 = new Date(u.searchParams.get('from')), f1 = new Date(u.searchParams.get('to'));
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out.filter(x => new Date(x.start) >= f0 && new Date(x.start) <= f1) }) }); });
  await page.goto(base + '/' + url);
  await page.waitForFunction(() => /refreshed|saved/i.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return page;
}
const preset = JSON.stringify([{ id: 1, display: 'BBC One', sourceName: 'BBC One Yorkshire HD' }, { id: 3, display: 'ITV1', sourceName: 'ITV1 Calendar HD' }]);
let page = await open('index.html', { width: 1180, height: 820 }, preset);
const rows = await page.$$eval('.gr .badge', b => b.map(x => x.textContent));
check(rows.includes('ATL') && rows.includes('WIT'), 'Sky Atlantic and Sky Witness added to the grid: ' + rows.join(','));
check(await page.locator('.tile', { hasText: 'Atlantic Drama 20' }).count() === 1 && await page.locator('.tile', { hasText: 'Witness Show 21' }).count() === 1, 'Sky programmes in the grid');
await page.locator('.tile', { hasText: 'Atlantic Drama 21' }).click();
check(/Sky synopsis 21/.test(await page.textContent('#panel')) && /Open NOW/.test(await page.textContent('#panel .acts')) && /nowtv\.com/.test(await page.getAttribute('#panel .primaryProvider', 'href')), 'panel shows Sky synopsis and an Open NOW button to nowtv.com: ' + await page.textContent('#panel .acts'));
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
await page.evaluate(() => { const a = document.querySelector('#panel .primaryProvider'); a.removeAttribute('target'); a.href = 'javascript:void 0'; a.click(); }); await page.waitForTimeout(300);
check(/copied – paste it into NOW/.test(await page.textContent('#toast')), 'tapping it copies the title: ' + await page.textContent('#toast'));
await page.locator('.tile', { hasText: 'Show 1-21' }).first().click();
check(/iplayer\/search\?q=/.test(await page.getAttribute('#panel .primaryProvider', 'href')), 'BBC programmes go to iPlayer search');
await page.click('#nxSettings');
check(/Sky channels working/.test(await page.textContent('#skyStatus')), 'Settings: ' + await page.textContent('#skyStatus'));
await page.locator('#settingsPanel .close').click();
await page.click('#nxSettings'); await page.click('#manage');
const opts = await page.$$eval('#addSelect option', o => o.map(x => x.textContent));
check(!opts.some(o => /Sports/.test(o)), 'Sky Sports not offered (not part of NOW Entertainment)');
await page.locator('#modal #close').click();
// Sky breaks: Sky rows keep the saved listings, the rest of the guide is fine, Settings explains
skyMode = 'down';
await page.evaluate(() => loadListings(true)); await page.waitForFunction(() => /saved|unavailable|refreshed/i.test(document.getElementById('status').textContent)); await page.waitForTimeout(300);
check(await page.locator('.tile', { hasText: 'Atlantic Drama 20' }).count() === 1 && await page.locator('.tile', { hasText: 'Show 1-20' }).count() >= 1, 'Sky down: Sky rows keep saved listings, other channels still load');
check(/Showing saved listings for Sky Atlantic/.test(await page.textContent('#notice')), 'gentle notice: ' + (await page.textContent('#notice')).slice(0, 100));
await page.click('#nxSettings');
check(/Sky listings not loading/.test(await page.textContent('#skyStatus')), 'Settings warns: ' + (await page.textContent('#skyStatus')).slice(0, 90));
check(page.errs.length === 0, 'no page errors ' + page.errs.join(' | '));
await page.context().close();
// Sky renumbers Sky Atlantic: found again by name automatically
skyMode = 'renumbered';
page = await open('index.html', { width: 1180, height: 820 }, preset);
check(await page.locator('.tile', { hasText: 'Renumbered Show 20' }).count() === 1, 'Sky renumbers a channel: fixed automatically');
check(page.errs.length === 0, 'no page errors ' + page.errs.join(' | '));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
