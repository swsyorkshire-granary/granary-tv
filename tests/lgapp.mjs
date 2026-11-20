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
async function open(url, vp, signedOut, ua) {
  const ctx = await b.newContext(Object.assign({ viewport: vp, hasTouch: vp.width < 800 }, ua ? { userAgent: ua } : {}));
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
const UA = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/108.0 Safari/537.36 WebAppManager';
const app = await (async () => {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: UA });
  await ctx.addInitScript(() => {
    window.__luna = []; window.__back = 0;
    window.PalmSystem = { platformBack: () => { window.__back++; } };
    window.PalmServiceBridge = function () { const self = this; this.call = (uri, p) => { window.__luna.push([uri, JSON.parse(p)]); setTimeout(() => self.onservicecallback(JSON.stringify({ returnValue: true })), 10); }; };
  });
  return ctx;
})();
// reuse open() routing by temporarily swapping newContext
const realNew = b.newContext.bind(b); b.newContext = async () => app;
const lgp = await open('tv.html?app=lg', { width: 1920, height: 1080 });
b.newContext = realNew;
await lgp.waitForTimeout(800);
check(await lgp.evaluate(() => window.GRANARY_LG_APP === true && document.documentElement.classList.contains('lgApp')), 'recognises the LG app');
check(!(await lgp.evaluate(() => document.documentElement.classList.contains('nxBarRoom'))), 'no browser-bar gap in the app');
check(await lgp.isVisible('#nxKeys'), 'colour key shown in the app');
await lgp.evaluate(() => { window.__fs = 0; document.documentElement.requestFullscreen = () => { window.__fs++; return Promise.resolve(); }; });
await lgp.keyboard.press('Enter');
check(await lgp.evaluate(() => window.__fs) === 0, 'app does not ask for browser full screen');
await lgp.evaluate(() => document.querySelectorAll('#nxGrid .tile').forEach(t => { if (/Vera/.test(t.textContent)) t.click(); }));
await lgp.waitForTimeout(400);
await lgp.click('#panel a.primaryProvider'); await lgp.waitForTimeout(200);
check(/The ITVX app will open/.test(await lgp.textContent('.appReminderCard')), 'app card wording');
await lgp.click('.arGo'); await lgp.waitForTimeout(300);
const calls = await lgp.evaluate(() => window.__luna);
check(calls.length && calls[0][0] === 'luna://com.webos.applicationManager/open' && /^https?:/.test(calls[0][1].target), 'asks webOS to open the programme link: ' + JSON.stringify(calls[0]));
const back = () => lgp.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461, bubbles: true })));
await back(); await lgp.waitForTimeout(100);
check(await lgp.evaluate(() => window.__back) === 0 && /Press Back again/.test(await lgp.textContent('#toast')), 'first Back at the top asks to press again');
await back(); await lgp.waitForTimeout(100);
check(await lgp.evaluate(() => window.__back) === 1, 'second Back leaves the app');
await lgp.click('#nxSettings'); await lgp.waitForTimeout(200);
check(/LG app/.test(await lgp.textContent('#chSync')), 'Settings shows it is the LG app: ' + await lgp.textContent('#chSync'));
check(!(await lgp.isVisible('#fullBtn')), 'no full-screen toggle in the app');
check(lgp.errs.length === 0, 'no app errors ' + lgp.errs.join('|'));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
