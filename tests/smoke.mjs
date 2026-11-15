// Headless smoke test for Granary TV. Serves ./site locally, mocks the listings feed and Supabase.
// Usage: node tests/smoke.mjs  (needs playwright + Chrome)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

// Mock channel directory: London first so a naive "first match" would pick the wrong region.
const directory = [
  { id: 1, name: 'BBC One London' }, { id: 2, name: 'BBC One Yorks & Lincs' }, { id: 3, name: 'BBC One Yorkshire' },
  { id: 4, name: 'BBC One HD' }, { id: 5, name: 'BBC Two' }, { id: 6, name: 'BBC Two Wales' },
  { id: 7, name: 'ITV1 London' }, { id: 8, name: 'ITV1 +1' }, { id: 9, name: 'ITV1 Yorkshire' }, { id: 10, name: 'ITV2' },
  { id: 11, name: 'Channel 4+1 ROI' }, { id: 15, name: 'Channel 4 ROI' }, { id: 12, name: 'Channel 4 London HD' }, { id: 13, name: 'Channel 5' }, { id: 14, name: 'ITV3 HD' },
];
function listingsFor(id) {
  const out = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let day = 0; day < 7; day++) for (let h = 6; h < 24; h += 2) {
    const s = new Date(+d + day * 864e5 + h * 36e5), e = new Date(+s + 2 * 36e5);
    out.push({ title: id === 9 ? 'Calendar News Test' : `Show ${id}-${h}`, start: s.toISOString(), end: e.toISOString(), description: 'desc' });
  }
  return out;
}

const supabaseStub = `
window.__db={library_items:[{id:'a',title:'Vera',channel:'ITV3 HD',status:'wanted',created_at:'2026-11-01'}],programme_metadata:[],programme_provider_links:[{normalized_title:'vera',service:'ITVX',candidate_url:'https://www.itv.com/watch/vera/1a5726',verification_status:'page_verified',checked_at:'2026-11-15T12:00:00Z'}]};
function q(table){const st={table,op:'select'};const p={
 select(){return p},eq(){return p},order(){return p},limit(){return p},maybeSingle(){st.single=true;return p},single(){st.single=true;return p},
 insert(r){st.op='insert';st.row=r;return p},upsert(r){st.op='upsert';st.row=r;return p},update(r){st.op='update';st.row=r;return p},delete(){st.op='delete';return p},in(){return p},ilike(){return p},
 then(ok,bad){let data=window.__db[table]||[];if(st.op!=='select'){window.__writes=(window.__writes||[]);window.__writes.push({table,op:st.op,row:st.row});data=st.row}
  return Promise.resolve({data:st.single?(Array.isArray(data)?data[0]||null:data):data,error:null}).then(ok,bad)}};return p}
window.supabase={createClient(){return {from:q,auth:{
 getSession:()=>Promise.resolve({data:{session:{user:{id:'u1',email:'test@example.com',user_metadata:{}}}},error:null}),
 getUser:()=>Promise.resolve({data:{user:{id:'u1',email:'test@example.com',user_metadata:{}}},error:null}),
 onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({error:null}),updateUser:()=>Promise.resolve({data:{},error:null})}}}};`;

let failures = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
async function openPage(url, { storage } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: supabaseStub }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/find-links', r => { const b = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ title: b.title, best: { 'BBC iPlayer': { url: 'https://www.bbc.co.uk/iplayer/episodes/test', title: b.title, kind: 'programme' } } }) }); });
  await page.route('https://www.ontvnow.co.uk/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: directory }) });
    const id = Number(u.searchParams.get('channel_id'));
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: listingsFor(id), meta: { last_page: 1 } }) });
  });
  if (storage) await page.addInitScript(s => localStorage.setItem('agrid-channel-ids', s), JSON.stringify(storage));
  await page.goto(base + url);
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('refreshed') || document.getElementById('status')?.textContent.includes('unavailable'), null, { timeout: 10000 });
  return { page, errors, ctx };
}
const rows = page => page.$$eval('.channel-row .channel', els => els.map(e => [e.querySelector('strong').textContent, e.querySelector('small').textContent]));

for (const url of ['/index.html', '/tv.html']) {
  console.log(`\n== ${url} (fresh device)`);
  const { page, errors, ctx } = await openPage(url);
  const r = await rows(page);
  console.log('   rows:', JSON.stringify(r));
  check(JSON.stringify(r.map(x => x[0])) === JSON.stringify(['BBC One', 'BBC Two', 'ITV1', 'Channel 4', 'Channel 5']), 'default rows, no Sky');
  check(r[0][1] === 'BBC One Yorkshire', 'BBC One uses Yorkshire');
  check(r[2][1] === 'ITV1 Yorkshire', 'ITV1 uses Yorkshire');
  check(r[3][1] === 'Channel 4 London HD', 'Channel 4 not +1 or ROI');
  check(!(await page.textContent('#notice')).includes('Not present'), 'no "not present" warning');
  check((await page.$$('.program')).length > 0, 'programmes drawn');
  check(await page.textContent('#cloudStatus') === 'Signed in: test@example.com', 'signed-in bar shows');
  // open a programme, check library button and provider searches
  await page.click('.program');
  check(await page.isVisible('#addLibraryBtn'), 'programme sheet has Add to My Library');
  check((await page.$$('#modalHelp .providerSearches a, #modalHelp a')).length > 0, 'programme sheet has service links');
  await page.click('#addLibraryBtn'); await page.waitForTimeout(300);
  check((await page.evaluate(() => (window.__writes || []).some(w => w.table === 'library_items'))), 'add to library writes library_items');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => (window.__writes || []).some(w => w.table === 'programme_provider_links' && JSON.stringify(w.row).includes('iplayer/episodes/test') && JSON.stringify(w.row).includes('page_verified'))), 'adding finds and saves the iPlayer link automatically');
  check(/Found it on BBC iPlayer/.test(await page.textContent('#programmeMessage')), 'sheet says where it was found: ' + await page.textContent('#programmeMessage'));
  await page.click('#close');
  // library opens
  await page.click('#libraryBtn'); await page.waitForTimeout(500);
  check((await page.textContent('#libraryContent')).includes('Vera'), 'library lists saved programme');
  const links = await page.$$eval('#libraryContent a', as => as.map(a => [a.textContent, a.href]));
  check(links.some(([t, h]) => /ITVX/.test(t) && h === 'https://www.itv.com/watch/vera/1a5726'), 'library uses verified ITVX link for Vera');
  check(await page.$('#libraryPanel a[href="link-test-bench.html"]') !== null, 'library has Link Test Bench button');
  if (url === '/tv.html') check(await page.evaluate(() => document.body.classList.contains('tv') && [...document.styleSheets].some(s => (s.href || '').includes('tv.css'))), 'TV stylesheet applied');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

console.log('\n== existing iPad selection (London ITV + old Sky rows + hand-added ITV3)');
{
  const old = [{ id: 1, display: 'BBC One', sourceName: 'BBC One London' }, { id: 5, display: 'BBC Two', sourceName: 'BBC Two' }, { id: 7, display: 'ITV1', sourceName: 'ITV1 London' },
    { id: 11, display: 'Channel 4', sourceName: 'Channel 4+1 ROI' }, { id: 13, display: 'Channel 5', sourceName: 'Channel 5' }, { id: null, display: 'Sky Atlantic', sourceName: 'Sky Atlantic' },
    { id: null, display: 'Sky Crime', sourceName: 'Sky Crime' }, { id: 14, display: 'ITV3 HD', sourceName: 'ITV3 HD' }];
  const { page, errors, ctx } = await openPage('/index.html', { storage: old });
  const r = await rows(page);
  console.log('   rows:', JSON.stringify(r));
  check(r.some(x => x[0] === 'ITV1' && x[1] === 'ITV1 Yorkshire'), 'saved ITV1 London moved to Yorkshire');
  check(r.some(x => x[0] === 'BBC One' && x[1] === 'BBC One Yorkshire'), 'saved BBC One London moved to Yorkshire');
  check(!r.some(x => x[0].startsWith('Sky')), 'old Sky rows removed');
  check(r.some(x => x[0] === 'ITV3 HD'), 'hand-added channel kept');
  check(r.some(x => x[0] === 'Channel 4' && x[1] === 'Channel 4 London HD'), 'saved Channel 4+1 ROI moved to proper Channel 4');
  check((await page.$$eval('.program b', b => b.map(x => x.textContent))).includes('Calendar News Test'), 'ITV1 row shows Yorkshire listings');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

console.log('\n== old bookmarks redirect');
for (const [from, to] of [['/library-test.html#access_token=x', '/index.html'], ['/library-tv-test.html', '/tv.html']]) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.route('https://**', r => r.abort());
  await page.goto(base + from); await page.waitForURL(u => u.pathname === to, { timeout: 5000 }).catch(() => {});
  const u = new URL(page.url());
  check(u.pathname === to && (!from.includes('#') || u.hash === '#access_token=x'), `${from.split('#')[0]} -> ${to}` + (from.includes('#') ? ' (keeps sign-in link token)' : ''));
  await ctx.close();
}

await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
