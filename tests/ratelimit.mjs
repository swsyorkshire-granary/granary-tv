// Listings feed rate limiting (HTTP 429): retry, cache, and saved-copy fallback.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const server = http.createServer((q, r) => { const f = path.join(root, new URL(q.url, 'http://x').pathname); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const stub = `window.supabase={createClient(){return{from(){const p={select(){return p},eq(){return p},order(){return p},in(){return p},update(){return p},then(a){return Promise.resolve({data:[],error:null}).then(a)}};return p},auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}}}}};`;
let fail = 0; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
let mode = 'flaky', calls = 0, busyLeft = { 12: 2, 13: 2 };
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url());
  if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 3, name: 'BBC One Yorkshire HD' }, { id: 12, name: 'Channel 4 North HD' }, { id: 13, name: '5 HD' }] }) });
  calls++; const id = Number(u.searchParams.get('channel_id'));
  if (mode === 'down' || (mode === 'flaky' && busyLeft[id] > 0)) { if (busyLeft[id] > 0) busyLeft[id]--; return r.fulfill({ status: 429, body: 'Too Many Requests' }); }
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const out = [];
  for (let h = 6; h < 24; h += 2) out.push({ title: 'Show ' + id + ' ' + h, start: new Date(+t0 + h * 36e5).toISOString(), end: new Date(+t0 + (h + 2) * 36e5).toISOString() });
  return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: out }) }); });
const rowsFilled = () => page.$$eval('.channel-row', rs => rs.filter(r => !/Not in feed/.test(r.querySelector('.channel').textContent)).map(r => r.querySelectorAll('.program').length));
// 1. busy twice for Channel 4 and 5, then OK → retries fill every row, no error notice
await page.goto(base + '/classic.html'); await page.waitForFunction(() => /refreshed|unavailable|saved/i.test(document.getElementById('status').textContent), null, { timeout: 30000 });
let filled = await rowsFilled();
check(filled.length === 3 && filled.every(n => n > 0), 'busy service retried; all rows filled: ' + JSON.stringify(filled));
check((await page.textContent('#status')) === 'Listings refreshed', 'status: ' + await page.textContent('#status'));
// 2. reopen → served from the device, no new listing downloads
mode = 'ok'; calls = 0; await page.reload(); await page.waitForFunction(() => /refreshed/i.test(document.getElementById('status').textContent), null, { timeout: 20000 });
check(calls === 0, 'reopening uses saved listings (downloads: ' + calls + ')');
// 3. Refresh while the service is down → saved copy shown, gentle note, no blank rows
mode = 'down'; await page.click('#refresh'); await page.waitForFunction(() => /saved copy|unavailable/i.test(document.getElementById('status').textContent), null, { timeout: 60000 });
filled = await rowsFilled();
check(filled.every(n => n > 0), 'service down: rows still filled from saved copy ' + JSON.stringify(filled));
check(/Showing saved listings/.test(await page.textContent('#notice')), 'note: ' + (await page.textContent('#notice')).slice(0, 90));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
