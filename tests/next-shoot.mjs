// Renders the real guide + library with optional theme CSS, for design mockups. Usage: node mock-shoot.mjs <themes.json> <outdir>
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../site');
const out = process.argv[2];
const server = http.createServer((q, r) => { const f = path.join(root, new URL(q.url, 'http://x').pathname); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const t0 = new Date(); t0.setHours(0, 0, 0, 0); const at = (d, h) => new Date(+t0 + d * 864e5 + h * 36e5).toISOString();
const lib = [['Vera','ITV3 HD',2,20],['The Great British Bake Off','Channel 4 North HD',1,20],['Strictly Come Dancing','BBC One Yorkshire HD',4,18.5],['Saturday Kitchen Best Bites','BBC Two HD',5,10],['Countryfile','BBC One Yorkshire HD',6,18]].map((x,i)=>({id:'l'+i,title:x[0],channel:x[1],status:'wanted',created_at:at(-2,9),start_at:at(x[2],x[3]),end_at:at(x[2],x[3]+1),series_link:i<2,series_auto:true,next_airing_at:i<2?at(x[2]+7,x[3]):null,next_airing_channel:x[1]}));
const stub = `(()=>{const db={library_items:${JSON.stringify(lib)},programme_metadata:[],programme_provider_links:[]};
function q(t){const st={};const p={select(){return p},eq(){return p},order(){return p},limit(){return p},ilike(){return p},maybeSingle(){st.one=1;return p},single(){st.one=1;return p},in(){return p},insert(){return p},upsert(){return p},update(){return p},delete(){return p},then(a,b){let d=db[t]||[];if(st.one)d=d[0]||null;return Promise.resolve({data:d,error:null}).then(a,b)}};return p}
const u={id:'u1',email:'me@example.com',user_metadata:{}};window.supabase={createClient(){return{from:q,auth:{getSession:()=>Promise.resolve({data:{session:{user:u}}}),getUser:()=>Promise.resolve({data:{user:u}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:()=>Promise.resolve({})}}}};})();`;
const chans = [[1,'BBC One Yorkshire HD'],[2,'BBC Two HD'],[3,'ITV1 Calendar HD'],[12,'Channel 4 North HD'],[13,'5 HD']];
const shows = {1:['BBC Breakfast','Morning Live','Bargain Hunt','BBC News at One','Doctors','Escape to the Country','Pointless','BBC News at Six','The One Show','EastEnders','Strictly Come Dancing','BBC News at Ten'],2:['Saturday Kitchen Best Bites','Animal Park','Politics Live','Coast','Flog It!','Eggheads','Only Connect','University Challenge','Gardeners’ World','Newsnight'],3:['Good Morning Britain','Lorraine','This Morning','Loose Women','ITV News','Tipping Point','The Chase','ITV News Calendar','Emmerdale','Coronation Street','Vera','ITV News at Ten'],12:['Countdown','A Place in the Sun','Steph’s Packed Lunch','Come Dine with Me','Four in a Bed','The Simpsons','Hollyoaks','Channel 4 News','The Great British Bake Off','Gogglebox','The Last Leg'],13:['Milkshake!','Jeremy Vine','Storage Hunters','5 News','Bargain Loving Brits','Neighbours','Police Interceptors','Cats Make You Laugh Out Loud','The Yorkshire Vet','Inside the Tower']};
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [];
for (const [name, url, w, h, s, tab] of [['ipad-guide', 'next.html', 1180, 820, 1, ''], ['ipad-library', 'next.html#library', 1180, 820, 1, 'lib'], ['tv-guide', 'next.html?tv=1', 1920, 1080, 1, ''], ['tv-library', 'next.html?tv=1#library', 1920, 1080, 1, 'lib'], ['phone-guide', 'next.html', 390, 844, 2, ''], ['phone-sheet', 'next.html', 390, 844, 2, 'sheet'], ['phone-library', 'next.html#library', 390, 844, 2, 'lib'], ['ipad-settings', 'next.html', 1180, 820, 1, 'settings'], ['ipad-channels', 'next.html', 1180, 820, 1, 'channels']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: s, hasTouch: w < 800 });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(name + ': ' + e)); page.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
  await page.clock.install({ time: new Date(+t0 + 20 * 36e5 + 40 * 6e4) });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ current: { temperature_2m: 7.4, weather_code: 3 }, daily: { temperature_2m_max: [9], temperature_2m_min: [3] } }) }));
  await page.route('https://api.tvmaze.com/**', r => r.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/**', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"best":{}}' }));
  await page.route('https://www.ontvnow.co.uk/**', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('/channels')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: chans.map(([id, name]) => ({ id, name })) }) });
    const id = Number(u.searchParams.get('channel_id')), L = shows[id], o = []; let k = id;
    for (let d = 0; d < 7; d++) { let hh = 6; while (hh < 24) { const len = [0.5, 1, 1, 1.5, 0.5, 1][(k++) % 6]; const t = L[(k * 7 + d) % L.length]; o.push({ title: (hh >= 20 && hh < 21 && id === 3) ? 'Vera' : (hh >= 20 && hh < 21 && id === 12) ? 'The Great British Bake Off' : t, start: at(d, hh), end: at(d, hh + len), description: 'A description of ' + t + ' supplied by the listings feed for this showing.' }); hh += len; } }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: o }) }); });
  await page.goto(base + '/' + url);
  await page.waitForFunction(() => /refreshed|saved/i.test(document.getElementById('status').textContent), null, { timeout: 30000 }).catch(e => errs.push(name + ' no status'));
  await page.waitForTimeout(1200);
  if (tab === 'sheet') { await page.locator('.tile').nth(8).click(); await page.waitForTimeout(500); }
  if (tab === 'settings') { await page.click('#nxSettings'); await page.waitForTimeout(300); }
  if (tab === 'channels') { await page.click('#nxSettings'); await page.click('#manage'); await page.waitForTimeout(300); }
  await page.screenshot({ path: `${out}/next-${name}.png` });
  await ctx.close();
}
console.log(errs.join('\n') || 'no errors');
await b.close(); server.close();
