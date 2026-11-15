// "Watch live" appears only for programmes on now, with the right link for browser vs Fire TV app.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const server = http.createServer((q, r) => { const f = path.join(root, new URL(q.url, 'http://x').pathname); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const stub = `window.supabase={createClient(){return{from(){const p={select(){return p},eq(){return p},order(){return p},then(a){return Promise.resolve({data:[],error:null}).then(a)}};return p},auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}}}}};`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const inApp of [false, true]) {
  const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  if (inApp) await page.addInitScript(() => { window.GranaryApp = { isApp: () => true, openWithTitle() {}, launch(u, p) { window.__launched = u + '|' + p; return 'started' }, launchIntentUri(u) { window.__launched = u; return 'started'; } }; });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 3, name: 'BBC One Yorkshire HD' }, { id: 12, name: 'Channel 4 North HD' }, { id: 9, name: 'ITV1 Yorkshire HD' }] }) });
    const now = Date.now(); const out = [{ title: 'OnNow-' + u.searchParams.get('channel_id'), start: new Date(now - 18e5).toISOString(), end: new Date(now + 18e5).toISOString() }, { title: 'Later-' + u.searchParams.get('channel_id'), start: new Date(now + 36e5).toISOString(), end: new Date(now + 72e5).toISOString() }];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out }) }); });
  await page.goto(base + '/tv.html'); await page.waitForSelector('.program');
  const open = async t => { await page.evaluate(t => [...document.querySelectorAll('.program')].find(e => e.textContent.includes(t)).click(), t); await page.waitForTimeout(200); const h = await page.evaluate(() => { const a = document.querySelector('#modalHelp .watchLive'); return a ? a.getAttribute('href') : null; }); await page.evaluate(() => document.getElementById('close').click()); return h; };
  if (inApp) { await page.evaluate(() => [...document.querySelectorAll('.program')].find(e => e.textContent.includes('OnNow-12')).click()); await page.waitForTimeout(150); await page.click('#modalHelp .watchLive'); check(await page.evaluate(() => window.__launched || '') === 'channel4://www.channel4.com/now/C4|com.channel4.ondemand', '[app] Channel 4 Watch live goes straight to the Channel 4 app'); await page.evaluate(() => document.getElementById('close').click()); }
  const c4 = await open('OnNow-12'), c4later = await open('Later-12'), bbc = await open('OnNow-3');
  const tag = inApp ? '[app]' : '[browser]';
  const itvNow = await open('OnNow-9');
  check(itvNow === (inApp ? 'intent:#Intent;component=air.ITVMobilePlayer/.ITVActivity;S.channelName=itv;end' : 'https://www.itv.com/watch?channel=itv'), `${tag} ITV1 on now → ${itvNow}`);
  if (inApp) { await page.evaluate(() => [...document.querySelectorAll('.program')].find(e => e.textContent.includes('OnNow-9')).click()); await page.waitForTimeout(150); await page.click('#modalHelp .watchLive'); check(await page.evaluate(() => window.__launched || '') === itvNow, '[app] pressing Watch live sends the ITVX intent'); await page.evaluate(() => document.getElementById('close').click()); }
  check(c4 === (inApp ? 'channel4://www.channel4.com/now/C4' : 'https://www.channel4.com/now/C4'), `${tag} Channel 4 on now → ${c4}`);
  check(c4later === null, `${tag} no Watch live for a later programme`);
  check(inApp ? bbc === null : bbc === 'https://www.bbc.co.uk/iplayer/live/bbcone', `${tag} BBC One on now → ${bbc}`);
}
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
