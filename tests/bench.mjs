// Link Test Bench regression test: returning to the tab (Supabase re-fires SIGNED_IN / TOKEN_REFRESHED)
// must not reset the form, and Save must store exactly what is on screen.
// Usage: node tests/bench.mjs [path/to/link-test-bench.html]
import { chromium } from 'playwright';
import path from 'node:path';

const file = path.resolve(process.argv[2] || new URL('../site/link-test-bench.html', import.meta.url).pathname);
const stub = `(()=>{
window.__writes=[];let cb=null;
const user={id:'u1',email:'test@example.com'};
const tables={library_items:[{title:'Children in Need 2026'},{title:'Vera'},{title:'Strictly Come Dancing'}],programme_provider_links:[]};
function q(t){const st={op:'select'};const p={select(){return p},eq(){return p},order(){return p},
 maybeSingle(){st.one=true;return p},single(){st.one=true;return p},
 upsert(r){st.op='upsert';st.row=r;window.__writes.push(r);return p},
 then(ok,bad){let d=st.op==='upsert'?st.row:tables[t];if(st.one&&Array.isArray(d))d=null;return Promise.resolve({data:d,error:null}).then(ok,bad)}};return p}
window.supabase={createClient(){return{from:q,auth:{
 getSession:()=>Promise.resolve({data:{session:{user}},error:null}),
 onAuthStateChange(f){cb=f;setTimeout(()=>f('INITIAL_SESSION',{user}),0);return{data:{subscription:{unsubscribe(){}}}}},
 signOut:()=>Promise.resolve({error:null})}}}};
window.__returnToTab=()=>{cb('SIGNED_IN',{user:{...user}});cb('TOKEN_REFRESHED',{user:{...user}})};})();`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
await page.goto('file://' + file);
await page.waitForFunction(() => document.getElementById('programme').options.length > 0);
await page.waitForTimeout(300);

// Fill the form as the user would for Vera on ITVX
await page.selectOption('#programme', 'Vera');
await page.selectOption('#service', 'ITVX');
await page.waitForTimeout(200);
await page.fill('#url', 'https://www.itv.com/watch/vera/1a5726');
await page.selectOption('#status', 'page_verified');
// User taps "Open to test", goes to the new tab, comes back
await page.evaluate(() => window.__returnToTab());
await page.waitForTimeout(500);
const after = await page.evaluate(() => { const g=id=>document.getElementById(id).value; return { p: g('programme'), s: g('service'), u: g('url'), st: g('status') }; });
await page.click('#save');
await page.waitForTimeout(400);
const w = await page.evaluate(() => window.__writes.at(-1));
const msg = await page.textContent('#msg');
await browser.close();

let fail = 0;
const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
console.log('form after returning to tab:', JSON.stringify(after));
console.log('saved row:', JSON.stringify(w && { t: w.programme_title, s: w.service, u: w.candidate_url, st: w.verification_status }));
check(after.p === 'Vera' && after.s === 'ITVX', 'programme/service kept');
check(after.u.includes('itv.com') && after.st === 'page_verified', 'link and status kept');
check(w && w.programme_title === 'Vera' && w.service === 'ITVX' && w.verification_status === 'page_verified' && w.candidate_url?.includes('itv.com'), 'saved exactly what was on screen');
check(/Vera · ITVX/.test(msg), 'save message names programme and service: ' + msg);
check(errors.length === 0, 'no page errors ' + errors.join(' | '));
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
