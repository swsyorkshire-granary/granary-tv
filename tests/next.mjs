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
async function open(url, vp) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 800 });
  const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(String(e)));
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
// ── iPad ──
let page = await open('index.html', { width: 1180, height: 820 });
check(await page.locator('.gr').count() === 5, 'five channel rows');
check((await page.textContent('#windowLabel')).includes('19:00') && (await page.textContent('#windowLabel')).includes('24:00'), 'opens at 19:00–24:00: ' + await page.textContent('#windowLabel'));
check(/on now/.test(await page.textContent('#panel .meta')), 'panel starts on a programme on now: ' + await page.textContent('#panel .meta'));
check(await page.locator('#panel .watchLive').count() === 1, 'Watch live offered for a programme on now');
check(await page.locator('.tile.lk', { hasText: 'Vera' }).count() >= 1, 'series-linked Vera highlighted in grid');
await page.locator('.tile', { hasText: 'Coast' }).click();
check((await page.textContent('#panel h1')).startsWith('Coast'), 'tapping a tile shows it in the panel');
check(await page.locator('#panel .watchLive').count() === 0, 'no Watch live for a later programme');
await page.locator('#panel button', { hasText: 'Library' }).click(); await page.waitForTimeout(800);
const ins = await page.evaluate(() => window.__ops.filter(o => o.t === 'library_items' && o.op === 'insert'));
check(ins.length === 1 && ins[0].row.title === 'Coast' && ins[0].row.channel === 'BBC Two', 'adds Coast to library: ' + JSON.stringify(ins.map(i => i.row.title)));
check(/IN LIBRARY|SERIES/.test(await page.textContent('#panel h1')) && await page.locator('#panel button', { hasText: 'Series' }).count() === 1, 'panel now shows it is in the library with a Series button');
await page.click('#earlier'); check((await page.textContent('#windowLabel')).startsWith('18:00'), 'Earlier moves the hours back');
await page.click('#later'); check((await page.textContent('#windowLabel')).startsWith('19:00') && await page.isDisabled('#later'), 'Later stops at midnight');
check(/^7°$/.test(await page.textContent('#nxTemp span')) && /York: 7°C, Cloudy/.test(await page.getAttribute('#nxTemp', 'title')), 'weather dial shows York temperature');
check((await page.textContent('#nxClock span')) === '20' && Math.abs(await page.evaluate(() => +getComputedStyle(document.getElementById('nxClock')).getPropertyValue('--p')) - 40 / 60) < 0.02, 'clock dial shows the hour with the minutes ring at 40/60');
await page.locator('#nxDays .wk').first().click(); await page.waitForFunction(() => /refreshed|saved/i.test(document.getElementById('status').textContent));
const daysTxt = await page.textContent('#nxDays');
check(!/Today/.test(daysTxt) && /This week/.test(daysTxt) && await page.locator('.tile').count() > 10, 'previous week shows past dates with listings: ' + daysTxt.replace(/\s+/g, ' ').slice(0, 80));
await page.locator('#nxDays .wk', { hasText: 'This week' }).click(); await page.waitForTimeout(800);
check(/Today/.test(await page.textContent('#nxDays')), 'back to this week');
await page.click('#tabLibrary'); await page.waitForTimeout(600);
check(await page.locator('.st').count() === 2, 'library tab shows 2 shows: ' + await page.locator('.st').count());
check((await page.locator('.st').first().textContent()).includes('Vera'), 'show on now/next sorted first');
check(/READY|ON NOW/.test(await page.locator('.st', { hasText: 'Vera' }).textContent()), 'Vera (already shown) marked ready / on now');
check(/COMING UP/.test(await page.locator('.st', { hasText: 'Coast' }).textContent()), 'Coast (not shown yet) marked COMING UP');
await page.locator('.st', { hasText: 'Coast' }).click(); if (await page.locator('#tileMenu.open').count()) await page.locator('#tileMenu .close').click();
check((await page.textContent('#panel h1')).startsWith('Coast'), 'library tile selects into panel');
check(/Not shown yet/.test(await page.textContent('#panel .meta')) && /yet/.test(await page.textContent('#panel .primaryProvider')), 'panel says not shown yet and the watch button is toned down');
const before = await page.evaluate(() => window.__ops.length);
await page.locator('#panel button', { hasText: 'Series' }).click(); await page.waitForTimeout(800);
const up = await page.evaluate(n => window.__ops.slice(n).find(o => o.op === 'update' && 'series_auto' in (o.row || {})), before);
check(up && typeof up.row.series_link === 'boolean', 'Series button updates the series link');
await page.locator('#panel button[aria-label="More options"]').click();
check(await page.locator('#morePanel.open .providerLookup').count() >= 3, 'More shows other services');
await page.locator('#morePanel .close').click();
// Vera has been shown: tap to highlight, tap again starts it (opens the panel's main link)
await page.locator('.st', { hasText: 'Vera' }).click(); if (await page.locator('#tileMenu.open').count()) await page.locator('#tileMenu .close').click();
const [popup] = await Promise.all([page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), page.locator('.st', { hasText: 'Vera' }).click()]);
check(!!popup && !(await page.locator('#tileMenu.open').count()), 'second tap on a ready show starts it: ' + (popup ? popup.url().slice(0, 60) : 'nothing opened'));
if (popup) await popup.close();
// press and hold, and the ⋯ button, open the options box
const box = await page.locator('.st', { hasText: 'Vera' }).boundingBox();
await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up(); await page.waitForTimeout(150);
check(await page.locator('#tileMenu.open').count() === 1, 'press and hold opens the options box');
await page.locator('#tileMenu .close').click();
await page.locator('.st', { hasText: 'Vera' }).locator('.tileMore').click();
check(await page.locator('#tileMenu.open').count() === 1, '⋯ on the tile opens the options box');
await page.locator('#tileMenu .close').click();
await page.locator('.st', { hasText: 'Coast' }).click(); if (await page.locator('#tileMenu.open').count()) await page.locator('#tileMenu .close').click();
await page.locator('.st', { hasText: 'Coast' }).click();   // highlighted + not shown yet → options box
check(await page.locator('#tileMenu.open').isVisible(), 'pressing the highlighted show opens the options box');
check(/Remove from library/.test(await page.textContent('#tileMenu')) && /series link/.test(await page.textContent('#tileMenu')), 'box offers watch/series/remove');
await page.locator('#tileMenu .danger').click(); await page.waitForTimeout(600);
check(await page.locator('.st').count() === 1 && !(await page.locator('#tileMenu.open').count()), 'one press removes the show');
check(/Removed Coast/.test(await page.textContent('#toast')), 'shows "Removed" with Undo');
await page.locator('#toast button').click(); await page.waitForTimeout(700);
check(await page.locator('.st', { hasText: 'Coast' }).count() === 1, 'Undo puts it back');
await page.locator('.st', { hasText: 'Coast' }).click();
await page.locator('#tileMenu .danger').click(); await page.waitForTimeout(600);
check(await page.locator('.st').count() === 1, 'removed again for the rest of the test');
await page.click('#nxSettings'); check(await page.locator('#settingsPanel.open #manage').isVisible(), 'settings panel opens with channel options');
check(page.errs.length === 0, 'no page errors ' + page.errs.join(' | '));
await page.context().close();
// ── TV remote (tv.html is now the new design, TV mode) ──
page = await open('tv.html', { width: 1920, height: 1080 });
await page.waitForTimeout(800);
let k = await page.evaluate(() => document.activeElement.className);
check(/tile/.test(k), 'TV starts with a programme focused: ' + k);
const t1 = await page.textContent('#panel h1');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
const t2 = await page.textContent('#panel h1');
check(t1 !== t2 && /tile/.test(await page.evaluate(() => document.activeElement.className)), 'Right moves to the next programme and updates the panel: ' + t1 + ' → ' + t2);
await page.keyboard.press('Home');
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(150);
check(parseFloat(await page.textContent('#windowLabel')) < 19, 'moving Left past 19:00 scrolls the guide earlier: ' + await page.textContent('#windowLabel'));
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
check(await page.evaluate(() => !!document.activeElement.closest('#panel, .top')), 'Up from the grid reaches the panel buttons / header');
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => /Coast/.test(x.textContent)) || document.querySelector('.tile'); t.focus(); });
await page.keyboard.press('Enter'); await page.waitForTimeout(100);
check(await page.evaluate(() => !!document.activeElement.closest('#panel .acts')), 'OK on a programme jumps to its buttons');
await page.keyboard.press('Escape');
await page.evaluate(() => NX.showTab('library')); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('#libGrid .st').focus());
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
check(await page.locator('#tileMenu.open').count() === 1 && await page.evaluate(() => !!document.activeElement.closest('#tileMenu')), 'TV: OK on a library show opens the box with focus inside');
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check(!(await page.locator('#tileMenu.open').count()) && await page.evaluate(() => document.activeElement.classList.contains('st')), 'TV: Back closes the box and returns to the show');
check(page.errs.length === 0, 'no TV page errors ' + page.errs.join(' | '));
await page.context().close();
// ── Phone ──
page = await open('next.html', { width: 390, height: 844 });
check((await page.textContent('#windowLabel')).includes('21:30'), 'phone shows 2½ hours: ' + await page.textContent('#windowLabel'));
check(!(await page.evaluate(() => document.getElementById('panel').classList.contains('open'))), 'phone panel hidden until a tap');
await page.locator('.tile').nth(6).tap(); await page.waitForTimeout(400);
check(await page.evaluate(() => document.getElementById('panel').classList.contains('open')), 'tapping opens the bottom sheet');
await page.locator('#panel .sheetClose').tap(); await page.waitForTimeout(300);
check(!(await page.evaluate(() => document.getElementById('panel').classList.contains('open'))), 'sheet closes');
check(page.errs.length === 0, 'no phone page errors ' + page.errs.join(' | '));
await b.close(); server.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
