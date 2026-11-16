// Series links: auto-detect another showing, store next airing, badge the grid, show "Next" in the library, no duplicates.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const server = http.createServer((q, r) => { const f = path.join(root, new URL(q.url, 'http://x').pathname); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const t0 = new Date(); t0.setHours(0, 0, 0, 0);
const at = (day, h) => new Date(+t0 + day * 864e5 + h * 36e5).toISOString();
const stub = `(()=>{
const db=window.__db={library_items:[{id:'v1',title:'Vera',channel:'ITV3 HD',status:'wanted',created_at:'${at(-1, 9)}',start_at:'${at(0, 1)}',end_at:'${at(0, 2)}',series_link:false,series_auto:true}],programme_metadata:[],programme_provider_links:[]};
window.__inserts=[];
function q(t){const st={op:'select',ids:null};const p={select(){return p},eq(){return p},order(){return p},limit(){return p},ilike(){return p},maybeSingle(){st.one=1;return p},single(){st.one=1;return p},
 in(col,ids){st.ids=ids;return p},insert(r){st.op='insert';st.row=r;return p},upsert(r){st.op='upsert';st.row=r;return p},update(r){st.op='update';st.row=r;return p},delete(){st.op='delete';return p},
 then(a,b){const L=db[t]=db[t]||[];let d=L;
  if(st.op==='insert'){window.__inserts.push({t,row:st.row});L.push(Object.assign({id:'n'+L.length,created_at:new Date().toISOString()},st.row));d=st.row}
  if(st.op==='update'){L.forEach(r=>{if(!st.ids||st.ids.includes(r.id))Object.assign(r,st.row)});d=st.row}
  if(st.op==='upsert'){d=st.row}
  if(st.one&&Array.isArray(d))d=d[0]||null;return Promise.resolve({data:d,error:null}).then(a,b)}};return p}
const u={id:'u1',email:'t@example.com',user_metadata:{}};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:{user:u}}}),getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({})}}}};})();`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
await page.route('**/functions/v1/find-links', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"best":{}}' }));
await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 3, name: 'BBC One Yorkshire HD' }, { id: 14, name: 'ITV3 HD' }] }) });
  const id = Number(u.searchParams.get('channel_id')); const out = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h += 2) out.push({ title: id === 14 && (d === 0 && h === 0 || d === 2 && h === 20 || d === 3 && h === 20) ? (d === 3 ? 'New: Vera' : 'Vera') : 'Other ' + id + '-' + d + '-' + h, start: at(d, h), end: at(d, h + 2) });
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out }) }); });
await page.addInitScript(s => localStorage.setItem('agrid-channel-ids', s), JSON.stringify([{ id: 3, display: 'BBC One', sourceName: 'BBC One Yorkshire HD' }, { id: 14, display: 'ITV3 HD', sourceName: 'ITV3 HD' }]));
await page.goto(base + '/index.html'); await page.waitForSelector('.program'); await page.waitForTimeout(1500);
const row = await page.evaluate(() => window.__db.library_items[0]);
check(row.series_link === true, 'another showing found → series link switched on automatically');
check(row.next_airing_at === new Date(+new Date(new Date().setHours(0,0,0,0)) + 2 * 864e5 + 20 * 36e5).toISOString() && row.next_airing_channel === 'ITV3 HD', 'next airing stored: ' + row.next_airing_at + ' ' + row.next_airing_channel);
check(!!row.last_aired_at, 'last aired stored (today\'s earlier showing)');
await page.evaluate(() => document.querySelectorAll('#days button.day')[3].click()); await page.waitForTimeout(300);
const badges = await page.$$eval('.program.seriesLinked b', bs => bs.map(x => x.textContent));
console.log('   badged:', JSON.stringify(badges));
check(badges.length >= 1 && badges.every(t => t.startsWith('🔗')), 'grid shows 🔗 on series-linked showings (incl. "New: Vera")');
await page.evaluate(() => document.getElementById('libraryBtn').click()); await page.waitForTimeout(900);
const line = await page.evaluate(() => (document.querySelector('.seriesLine') || {}).textContent || '');
console.log('   library line:', line);
check(/🔗 Series link · Next: .* · ITV3 HD/.test(line), 'library shows the next showing');
check(/New episode/.test(line), 'library flags a new episode (aired since you last opened it)');
check(/Series link: On/.test(await page.textContent('#libraryContent')), 'series link toggle shows On');
// re-add Vera from the grid → no duplicate
await page.evaluate(() => window.granaryBack ? window.granaryBack() : document.getElementById('libraryPanel').classList.remove('open')); await page.waitForTimeout(200);
await page.evaluate(() => [...document.querySelectorAll('.program')].find(e => /Vera/.test(e.textContent)).click()); await page.waitForTimeout(200);
console.log('   modal:', await page.evaluate(() => [document.getElementById('modal').className, (document.getElementById('addLibraryBtn')||{}).style?.display, document.getElementById('modalTitle').textContent]));
await page.evaluate(() => document.getElementById('addLibraryBtn').click()); await page.waitForTimeout(600);
check((await page.evaluate(() => window.__inserts.filter(i => i.t === 'library_items').length)) === 0, 'adding Vera again does not create a duplicate');
check(/series link switched on/.test(await page.textContent('#programmeMessage')), 'message: ' + await page.textContent('#programmeMessage'));
check(errs.length === 0, 'no errors ' + errs.join(' | '));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
