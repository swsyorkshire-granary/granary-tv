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
  if(st.op==='insert'){L.push(Object.assign({id:'n'+L.length,created_at:new Date().toISOString()},st.row));d=st.row}
  if(st.op==='update'){L.forEach(r=>{if(!st.ids||st.ids.includes(r.id))Object.assign(r,st.row)});d=st.row}
  if(st.op==='delete'){db[t]=L.filter(r=>!(st.ids||[]).includes(r.id));d=null}
  if(st.op==='upsert'){d=st.row}
  if(st.one&&Array.isArray(d))d=d[0]||null;return Promise.resolve({data:d,error:null}).then(a,b)}};return p}
const u={id:'u1',email:'t@example.com',user_metadata:{}};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:null}}),getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({}),updateUser:()=>Promise.resolve({data:{user:u}})}}}};})();`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
async function open(url, vp) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 800 });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(String(e)));
  await page.clock.install({ time: new Date(+t0 + 20 * 36e5 + 40 * 6e4) });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/find-links', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"best":{}}' }));
  await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 1, name: 'BBC One Yorkshire HD' }, { id: 2, name: 'BBC Two HD' }, { id: 3, name: 'ITV1 Calendar HD' }, { id: 12, name: 'Channel 4 North HD' }, { id: 13, name: '5 HD' }] }) });
    const id = Number(u.searchParams.get('channel_id')), out = [];
    for (let d = 0; d < 7; d++) for (let h = 6; h < 24; h++) out.push({ title: id === 3 && h === 20 ? 'Vera' : id === 2 && h === 21 ? 'Coast' : 'Show ' + id + '-' + h, start: at(d, h), end: at(d, h + 1), description: 'About show ' + h });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out }) }); });
  await page.goto(base + '/' + url);
  await page.waitForFunction(() => /refreshed|saved/i.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return page;
}
// ── A new person on a new device, not signed in ──
let page = await open('index.html', { width: 1180, height: 820 });
check(await page.locator('.gr').count() === 5 && await page.locator('.tile').count() > 10, 'guide works before signing in');
await page.click('#tabLibrary'); await page.waitForTimeout(400);
check(/Sign in to see your library/.test(await page.textContent('#libGrid')), 'library asks them to sign in');
await page.locator('#libGrid button', { hasText: 'Sign in' }).click();
check(await page.locator('#authPanel.open').isVisible() && /New to Granary TV/.test(await page.textContent('#authPanel')), 'sign-in panel explains how to create an account');
await page.locator('#authPanel .close').click(); await page.click('#tabGuide'); await page.locator('.tile').nth(3).click();
await page.locator('#panel button', { hasText: 'Library' }).click(); await page.waitForTimeout(300);
check(await page.locator('#authPanel.open').count() === 1, '＋ Library asks a signed-out person to sign in');
check(page.errs.length === 0, 'no page errors ' + page.errs.join(' | '));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
