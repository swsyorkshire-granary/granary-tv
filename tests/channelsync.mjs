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
const u={id:'u1',email:'t@example.com',user_metadata:(window.__md||{})};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:{user:u}}}),getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({}),updateUser:(x)=>{window.__updates=(window.__updates||[]).concat([x]);Object.assign(u.user_metadata,x.data||{});return Promise.resolve({data:{user:u},error:null})}}}}};})();`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
async function open(url, vp, init) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 800 });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(String(e)));
  if (init) await page.addInitScript(init.fn, init.arg);
  await page.clock.install({ time: new Date(+t0 + 20 * 36e5 + 40 * 6e4) });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ current: { temperature_2m: 7.4, weather_code: 3 }, daily: { temperature_2m_max: [9], temperature_2m_min: [3] } }) }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/find-links', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"best":{}}' }));
  await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return new Promise(res => setTimeout(res, 900)).then(() => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 1, name: 'BBC One Yorkshire HD' }, { id: 2, name: 'BBC Two HD' }, { id: 3, name: 'ITV1 Calendar HD' }, { id: 12, name: 'Channel 4 North HD' }, { id: 13, name: '5 HD' }] }) }));
    const id = Number(u.searchParams.get('channel_id')), out = [];
    for (let d = -7; d < 7; d++) for (let h = 6; h < 24; h++) out.push({ title: id === 3 && h === 20 ? 'Vera' : id === 2 && h === 21 ? 'Coast' : 'Show ' + id + '-' + h, start: at(d, h), end: at(d, h + 1), description: 'About show ' + h });
    const f0 = new Date(u.searchParams.get('from')), f1 = new Date(u.searchParams.get('to'));
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out.filter(x => new Date(x.start) >= f0 && new Date(x.start) <= f1) }) }); });
  await page.goto(base + '/' + url);
  await page.waitForFunction(() => /refreshed|saved|unavailable/i.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return page;
}
const remote = [{ id: 1, display: 'BBC One', sourceName: 'BBC One Yorkshire HD' }, { id: 'sky:skyatlantic', display: 'Sky Atlantic', sourceName: 'Sky Atlantic' }, { id: 'sky:skywitness', display: 'Sky Witness', sourceName: 'Sky Witness' }];
// 1. A device with nothing saved picks up the account's channels
let page = await open('index.html', { width: 390, height: 844 }, { fn: r => { window.__md = { granary_channels: r, granary_channels_at: Date.now() - 1000 }; }, arg: remote });
await page.waitForTimeout(800);
let badges = await page.$$eval('.gr .badge', b => b.map(x => x.textContent));
check(badges.includes('ATL') && badges.includes('WIT'), 'phone picks up Sky Atlantic and Sky Witness from the account: ' + badges.join(','));
await page.context().close();
// 2. First sync on a device with its own list: both lists are combined and saved back
page = await open('index.html', { width: 1180, height: 820 }, { fn: r => { window.__md = { granary_channels: r, granary_channels_at: Date.now() - 1000 }; localStorage.setItem('agrid-channel-ids', JSON.stringify([{ id: 3, display: 'ITV1', sourceName: 'ITV1 Calendar HD' }])); localStorage.setItem('granary-sky-added', '1'); }, arg: remote });
await page.waitForTimeout(1800);
badges = await page.$$eval('.gr .badge', b => b.map(x => x.textContent));
const pushed = await page.evaluate(() => (window.__updates || []).map(u => (u.data.granary_channels || []).map(c => c.display).join('+')));
check(badges.includes('ITV1') && badges.includes('ATL'), 'lists combined on first sync: ' + badges.join(','));
check(pushed.length > 0 && pushed.every(p => p.length) && pushed.some(p => /ITV1/.test(p) && /Sky Atlantic/.test(p)), 'combined list saved, never an empty one: ' + pushed.join(' | '));
// 3. Removing a channel saves the change to the account
await page.click('#nxSettings'); await page.click('#manage');
await page.locator('#chips button', { hasText: 'Sky Witness' }).first().click().catch(() => {});
await page.waitForTimeout(1800);
const last = await page.evaluate(() => { const u = window.__updates || []; return u.length ? (u[u.length - 1].data.granary_channels || []).map(c => c.display).join('+') : ''; });
check(last && !/Sky Witness/.test(last), 'removing a channel updates the account: ' + last);
check(page.errs.length === 0, 'no page errors ' + page.errs.join(' | '));
// 4. The Settings button loads the account's list even when this device thinks it's newer
page = await open('index.html', { width: 390, height: 844 }, { fn: r => { window.__md = { granary_channels: r, granary_channels_at: Date.now() - 60000 }; localStorage.setItem('agrid-channel-ids', JSON.stringify([{ id: 3, display: 'ITV1', sourceName: 'ITV1 Calendar HD' }])); localStorage.setItem('granary-channels-at', String(Date.now())); localStorage.setItem('granary-sky-added', '1'); }, arg: remote });
await page.waitForTimeout(1500);
await page.click('#nxSettings');
check(/Version 2\.0\.\d+ · Channels: up to date/.test(await page.textContent('#chSync')), 'Settings shows version and sync status: ' + await page.textContent('#chSync'));
await page.click('#loadMyChannels'); await page.waitForTimeout(1500);
check(/loaded \d+ from your account/.test(await page.textContent('#chSync')), 'button reports loading: ' + await page.textContent('#chSync'));
await page.locator('#settingsPanel .close').click();
await page.waitForFunction(() => /refreshed|saved|unavailable/i.test(document.getElementById('status').textContent), null, { timeout: 20000 }); await page.waitForTimeout(300);
const b4 = await page.$$eval('.gr .badge', b => b.map(x => x.textContent));
check(b4.includes('ATL') && b4.includes('WIT'), 'Load channels from my account brings in Sky: ' + b4.join(','));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
