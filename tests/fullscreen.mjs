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
const u={id:'u1',email:'t@example.com',user_metadata:{}};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:window.__signedOut?null:{user:u,access_token:'phone-token'}}}),verifyOtp:(o)=>{window.__verified=o;window.__signedOut=false;return Promise.resolve({data:{session:{user:u}},error:null})},getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({}),updateUser:()=>Promise.resolve({data:{user:u}})}}}};})();`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const pairs = {}; let pairN = 0;
async function open(url, vp, signedOut) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 800 });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(String(e)));
  if (signedOut) await page.addInitScript(() => { window.__signedOut = true; });
  await page.route('**/functions/v1/tv-pair', async r => { const b = JSON.parse(r.request().postData() || '{}'); const H = { 'Access-Control-Allow-Origin': '*' };
    const send = o => r.fulfill({ contentType: 'application/json', headers: H, body: JSON.stringify(o) });
    if (b.action === 'nearby') return send({ codes: Object.keys(pairs).filter(c => !pairs[c].token) });
    if (b.action === 'start') { const code = 'K7P4Q' + (++pairN); pairs[code] = {}; return send({ code }); }
    const p = pairs[b.code]; if (!p) return send({ expired: true });
    if (b.action === 'cancel') { if (!p.token) delete pairs[b.code]; return send({ ok: true }); }
    if (b.action === 'poll') { if (!p.token) return send({ waiting: true }); delete pairs[b.code]; return send({ email: 't@example.com', token_hash: p.token }); }
    if (b.action === 'approve') { if (r.request().headers()['authorization'] !== 'Bearer phone-token') return send({ error: 'Please sign in on this phone first' }); p.token = 'hash-' + b.code; return send({ ok: true }); }
  });
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
// LG webOS browser: first OK press goes full screen; Settings toggle shown
const lg = await open('tv.html', { width: 1920, height: 1080 });
await lg.evaluate(() => { window.__fs = 0; document.documentElement.requestFullscreen = () => { window.__fs++; return Promise.resolve(); }; });
await lg.keyboard.press('Enter'); await lg.waitForTimeout(200);
check(await lg.evaluate(() => window.__fs) === 0, 'non-LG browser: no automatic full screen');
await lg.click('#nxSettings');
check(await lg.isVisible('#fullBtn') && /off/.test(await lg.textContent('#fullBtn')), 'TV Settings shows Full screen toggle: ' + await lg.textContent('#fullBtn'));
await lg.click('#fullBtn');
check(await lg.evaluate(() => window.__fs) === 1 && /on/.test(await lg.textContent('#fullBtn')), 'turning it on goes full screen');
const ph = await open('index.html', { width: 390, height: 844 }); await ph.click('#nxSettings');
check(!(await ph.isVisible('#fullBtn')), 'phone has no full-screen button');
await lg.keyboard.press('Escape'); await lg.evaluate(() => document.querySelectorAll('.cloudPanel.open').forEach(p => p.classList.remove('open')));
const key = (k) => lg.evaluate(k => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: k, bubbles: true })), k);
await key(405); await lg.waitForTimeout(300);
check(await lg.isVisible('#libraryView'), 'Yellow opens the Library');
await key(406); await lg.waitForTimeout(300);
check(await lg.isVisible('#guideView'), 'Blue goes back to the Guide');
await key(403); await lg.waitForTimeout(300);
check(await lg.evaluate(() => $('settingsPanel').classList.contains('open')), 'Red opens Settings');
check(await lg.isVisible('.nxTvOnly'), 'Settings lists the colour buttons');
await key(403); await lg.waitForTimeout(200);
check(!(await lg.evaluate(() => $('settingsPanel').classList.contains('open'))), 'Red again closes Settings');
check(lg.errs.length === 0, 'no errors ' + lg.errs.join('|'));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
