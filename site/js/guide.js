const API='https://www.ontvnow.co.uk/api/v1';
const DEFAULTS=['BBC One','BBC Two','ITV1','Channel 4','Channel 5'];
// Old default rows that the listings feed never supplied; removed from saved selections.
const RETIRED_DEFAULTS=['skyatlantic','skywitness','skycomedy','skydocumentaries','skycrime'];
let directory=[],channels=[],dataByChannel={},weekOffset=0,selected=0,startHour=6,endHour=24;
function todayStart(){const d=new Date();return Math.floor((d.getHours()*60+d.getMinutes())/30)/2}
function syncNow(){if(weekOffset===0&&selected===0){startHour=todayStart();$('start').value=String(startHour)}}
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const dateFor=i=>{let d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+weekOffset*7+i);return d};
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dateText=d=>d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isoLocal(d){return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${-d.getTimezoneOffset()>=0?'+':'-'}${pad(Math.floor(Math.abs(d.getTimezoneOffset())/60))}:${pad(Math.abs(d.getTimezoneOffset())%60)}`}
function getArr(j){if(Array.isArray(j))return j;for(const k of ['data','channels','listings','results','items'])if(Array.isArray(j?.[k]))return j[k];return []}
async function getJSON(url){const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status+' from listings feed');return r.json()}
function channelLabel(c){return c.name||c.title||c.channel_name||c.display_name||''}
// Score how well a directory channel fits a wanted channel. Higher is better; 0 = no match.
// The user is in South/West Yorkshire, so regional BBC One and ITV1 prefer the Yorkshire versions.
function channelScore(wanted,c){
 const n=norm(channelLabel(c)),w=norm(wanted);
 const raw=channelLabel(c).toLowerCase().replace(/\s/g,'');
 // Never pick timeshift (+1, +24) or Republic of Ireland feeds for a default channel.
 if(/\+\d|plus\d/.test(raw)||/\broi\b|ireland/i.test(channelLabel(c)))return 0;
 if(w==='bbcone'||w==='bbc1'){
  if(!(n.startsWith('bbcone')||n.startsWith('bbc1')))return 0;
  if(n.includes('lincs'))return 2;               // BBC One Yorks & Lincs is the Hull/Lincoln region
  if(n.includes('yorkshire')||n.includes('yorks'))return 5;
  if(n==='bbcone'||n==='bbconehd'||n==='bbc1'||n==='bbc1hd')return 3;
  return 1;
 }
 if(w==='itv1'){
  if(n.includes('yorkshire')&&n.startsWith('itv'))return 5;
  if(n.includes('calendar'))return 5;
  if(!n.startsWith('itv1'))return 0;
  if(n==='itv1'||n==='itv1hd')return 3;
  return 1;
 }
 if(w==='bbctwo'){if(!n.startsWith('bbctwo'))return 0;return (n==='bbctwo'||n==='bbctwohd')?3:(n.includes('england')?2:1)}
 if(w==='channel4'){if(!n.startsWith('channel4'))return 0;if(n==='channel4'||n==='channel4hd')return 3;return /yorkshire|north|england/.test(n)?2:1}
 if(w==='channel5'){if(n==='channel5'||n==='5'||n==='5hd'||n==='channel5hd')return 3;return n.startsWith('channel5')?1:0}
 if(n===w)return 3;
 return n.startsWith(w)?1:0;
}
function matchChannel(wanted,c){return channelScore(wanted,c)>0}
function pickChannel(wanted){
 let best=null,bestScore=0;
 directory.forEach(c=>{const sc=channelScore(wanted,c);if(sc>bestScore||(sc===bestScore&&sc>0&&channelLabel(c).length<channelLabel(best).length)){best=c;bestScore=sc}});
 return best;
}
function dateOf(v){if(!v)return null;let d=new Date(v);if(!Number.isNaN(+d))return d;return null}
function normalize(p){
 const s=dateOf(p.start||p.start_time||p.starts_at||p.start_datetime||p.airtime||p.date_start);
 const e=dateOf(p.end||p.end_time||p.ends_at||p.stop||p.stop_time||p.end_datetime||p.date_end);
 if(!s)return null;const end=e||new Date(+s+(Number(p.duration||p.runtime||30)*60000));
 return {title:p.title||p.name||p.programme||p.program_name||'Programme',start:s,end,description:p.description||p.summary||p.synopsis||'',genre:p.genre||p.category||p.type||'',url:p.url||p.link||''};
}
function renderDays(){const el=$('days');el.innerHTML='';for(let i=0;i<7;i++){const d=dateFor(i),b=document.createElement('button');b.className='day'+(i===selected?' active':'');b.innerHTML=`${dateText(d)}<small>${weekOffset===0&&i===0?'TODAY':d.toLocaleDateString('en-GB',{month:'short'})}</small>`;b.onclick=()=>{selected=i;if(weekOffset===0&&i===0)syncNow();else {startHour=6;$('start').value='6'}renderDays();render()};el.append(b)}}
function render(){
 const d=dateFor(selected),key=dateKey(d),g=$('guide');g.innerHTML='';
 const slots=Math.ceil(endHour-startHour);
 const head=document.createElement('div');head.className='timehead';head.innerHTML=`<div class="corner">CHANNEL</div><div class="hours" style="--hours:${slots}">${Array.from({length:slots},(_,i)=>{const m=Math.round((startHour+i)*60);return `<div>${pad(Math.floor(m/60))}:${pad(m%60)}</div>`}).join('')}</div>`;g.append(head);
 let count=0;
 channels.forEach(ch=>{
  const row=document.createElement('div');row.className='channel-row';const lab=document.createElement('div');lab.className='channel';lab.innerHTML=`<strong>${esc(ch.display)}</strong><small>${ch.id!=null?esc(ch.sourceName&&norm(ch.sourceName)!==norm(ch.display)?ch.sourceName:'Programme listings'):'Not in feed'}</small>`;
  const line=document.createElement('div');line.className='timeline';line.style.setProperty('--hours',slots);
  (dataByChannel[ch.id]||[]).filter(p=>dateKey(p.start)===key).forEach(p=>{
   const from=startHour*60,to=endHour*60,a=p.start.getHours()*60+p.start.getMinutes(),b=p.end.getHours()*60+p.end.getMinutes()+(dateKey(p.end)!==key?1440:0);
   if(b<=from||a>=to)return;const left=Math.max(0,(a-from)/(to-from)*100),right=Math.min(to,b);
   const btn=document.createElement('button');btn.className='program';btn.style.left=left+'%';btn.style.width=Math.max(.8,(right-Math.max(a,from))/(to-from)*100)+'%';
   btn.innerHTML=`<b>${esc(p.title)}</b><span>${p.start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}–${p.end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>`;btn.onclick=()=>showProgramme(p,ch);line.append(btn);count++;
  });
  if(weekOffset===0&&selected===0){
   const now=new Date(),minute=now.getHours()*60+now.getMinutes(),from=startHour*60,to=endHour*60;
   if(minute>=from&&minute<to){
    const marker=document.createElement('div');marker.className='now-line';marker.style.left=((minute-from)/(to-from)*100)+'%';
    if(channels[0]===ch){const tag=document.createElement('span');tag.textContent='NOW';marker.append(tag)}
    line.append(marker);
   }
  }
  row.append(lab,line);g.append(row);
 });
 if(!count){const e=document.createElement('div');e.className='empty';e.textContent='No programmes were returned for this date. Try another date or refresh the listings.';g.append(e)}
}
function showProgramme(p,ch){
 $('modalTitle').textContent=p.title;
 const genre=p.genre||p.category||p.type||'Genre not supplied';
 $('modalHelp').innerHTML=`<b>${esc(ch.display)}</b><br>${p.start.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}<br>${p.start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}–${p.end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}<br><b>Genre:</b> ${esc(genre)}<hr style="border:0;border-top:1px solid #40516a;margin:12px 0"><b>Programme details</b><p>${esc(p.description||'No further programme description is available from the listings provider.')}</p>`;
 $('chips').style.display='none';$('addSelect').style.display='none';$('addButton').style.display='none';
 $('modalHelp').querySelectorAll('.providerSearches').forEach(el=>el.remove());
 addProviderSearchLinks($('modalHelp'),p.title);
 selectedProgramme={p,ch};
 let saveBtn=document.getElementById('addLibraryBtn');
 if(!saveBtn){saveBtn=document.createElement('button');saveBtn.id='addLibraryBtn';saveBtn.textContent='＋ Add to My Library';$('modalHelp').after(saveBtn);const msg=document.createElement('div');msg.id='programmeMessage';saveBtn.after(msg);saveBtn.onclick=addSelectedToLibrary;}
 $('programmeMessage').textContent='';saveBtn.style.display='inline-block';
 $('modal').classList.add('open')
}
function openManage(){const saveBtn=document.getElementById('addLibraryBtn');if(saveBtn)saveBtn.style.display='none';const msg=document.getElementById('programmeMessage');if(msg)msg.textContent='';$('modalTitle').textContent='Manage channels';$('modalHelp').textContent='Tap a channel to remove it, or add another channel from the source directory.';$('chips').style.display='flex';$('addSelect').style.display='block';$('addButton').style.display='inline-block';$('chips').innerHTML='';channels.forEach(c=>{const b=document.createElement('button');b.className='chip';b.textContent='− '+c.display;b.onclick=()=>{channels=channels.filter(x=>x!==c);save();openManage();loadListings()};$('chips').append(b)});const used=channels.map(c=>String(c.id));$('addSelect').innerHTML='<option value="">Choose a channel…</option>'+directory.filter(c=>!used.includes(String(c.id))).map(c=>`<option value="${esc(c.id)}">${esc(channelLabel(c))}</option>`).join('');$('modal').classList.add('open')}
function sortChannels(){
 const preferred=['bbcone','bbctwo','itv1','channel4','channel5','skyatlantic'];
 channels.sort((a,b)=>{
  const rank=x=>{const n=norm(x.display);if(n.includes('bbcone'))return 0;if(n.includes('bbctwo'))return 1;if(n==='itv1')return 2;if(n.includes('channel4'))return 3;if(n.includes('channel5'))return 4;if(n.includes('skyatlantic'))return 5;if(n.includes('skywitness'))return 6;if(n.includes('skycomedy'))return 7;if(n.includes('skydocumentaries'))return 8;if(n.includes('skycrime'))return 9;return 10};
  return rank(a)-rank(b)||a.display.localeCompare(b.display);
 });
}
function save(){localStorage.setItem('agrid-channel-ids',JSON.stringify(channels))}
async function loadDirectory(){
 const j=await getJSON(API+'/channels');directory=getArr(j);
 if(!directory.length)throw Error('The listings service returned an empty channel directory.');
 const resolve=name=>{const c=pickChannel(name);return {id:c?.id??null,display:name,sourceName:c?channelLabel(c):name}};
 let stored=null;try{stored=JSON.parse(localStorage.getItem('agrid-channel-ids')||'null')}catch(e){stored=null}
 channels=Array.isArray(stored)&&stored.length?stored:DEFAULTS.map(resolve);
 // Drop the old Sky default rows (never present in the feed). Sky channels added by hand from the directory stay.
 channels=channels.filter(ch=>!(ch.id==null&&RETIRED_DEFAULTS.includes(norm(ch.display))));
 // Default channels are always re-resolved, so saved selections move to the Yorkshire regional versions.
 const defaultKeys=DEFAULTS.map(norm);
 channels=channels.map(ch=>defaultKeys.includes(norm(ch.display))?resolve(DEFAULTS[defaultKeys.indexOf(norm(ch.display))]):ch);
 // Add any missing default channels without removing user choices.
 DEFAULTS.forEach(name=>{if(!channels.some(ch=>norm(ch.display)===norm(name)))channels.push(resolve(name))});
 // Re-resolve any stored null channels if the directory now contains a match.
 channels=channels.map(ch=>{if(ch.id!=null)return ch;const c=pickChannel(ch.display);return c?{...ch,id:c.id,sourceName:channelLabel(c)}:ch});
 sortChannels();save();
}
async function loadListings(){
 $('status').textContent='Loading seven days…';$('notice').style.display='none';dataByChannel={};
 const from=dateFor(0),to=dateFor(7);to.setSeconds(0,0);to.setMinutes(to.getMinutes()-1);
 const active=channels.filter(c=>c.id!=null);let errors=[];
 await Promise.all(active.map(async ch=>{
  try{
   const params=new URLSearchParams({channel_id:String(ch.id),from:isoLocal(from),to:isoLocal(to),limit:'100'});
   let all=[];
   for(let page=1;page<=10;page++){params.set('page',String(page));const j=await getJSON(API+'/listings?'+params.toString());const arr=getArr(j);all.push(...arr);const meta=j.meta||j.pagination||{};const last=Number(meta.last_page||meta.total_pages||meta.pages||1);if(page>=last||arr.length<100)break}
   dataByChannel[ch.id]=all.map(normalize).filter(Boolean);
  }catch(e){errors.push(ch.display+': '+e.message)}
 }));
 render();
 if(errors.length){$('status').textContent='Some listings unavailable';$('notice').style.display='block';$('notice').textContent=errors.join(' · ')}
 else $('status').textContent='Listings refreshed';
 const missing=channels.filter(c=>c.id==null).map(c=>c.display);
 if(missing.length){$('notice').style.display='block';$('notice').textContent+=( $('notice').textContent?' · ':'')+'Not present in source directory: '+missing.join(', ')}
}
$('refresh').onclick=()=>{syncNow();loadListings()};$('manage').onclick=openManage;$('close').onclick=()=>$('modal').classList.remove('open');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.remove('open')};
$('addButton').onclick=()=>{const id=$('addSelect').value,c=directory.find(x=>String(x.id)===id);if(c){channels.push({id:c.id,display:channelLabel(c),sourceName:channelLabel(c)});sortChannels();save();openManage();loadListings()}};
$('prev').onclick=()=>{weekOffset--;selected=0;startHour=6;$('start').value='6';renderDays();loadListings()};$('next').onclick=()=>{weekOffset++;selected=0;if(weekOffset===0)syncNow();else{startHour=6;$('start').value='6'}renderDays();loadListings()};
for(let h=0;h<24;h+=0.5){const m=Math.round(h*60);$('start').add(new Option(pad(Math.floor(m/60))+':'+pad(m%60),h))};for(let h=24;h>=1;h--)$('end').add(new Option((h===24?'24':pad(h))+':00',h));$('start').value=6;$('end').value=24;syncNow();
$('start').onchange=e=>{startHour=+e.target.value;if(startHour>=endHour){endHour=Math.min(24,startHour+6);$('end').value=endHour}render()};
$('end').onchange=e=>{endHour=+e.target.value;if(endHour<=startHour){startHour=Math.max(0,endHour-6);$('start').value=String(startHour)}render()};
renderDays();
function tickLiveGuide(){
 if(weekOffset===0&&selected===0){
  const oldStart=startHour;syncNow();
  if(startHour!==oldStart)render();else render();
 }
}
setInterval(tickLiveGuide,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&weekOffset===0&&selected===0){syncNow();render()}});
(async()=>{try{await loadDirectory();await loadListings()}catch(e){$('status').textContent='Listings connection failed';$('notice').style.display='block';$('notice').textContent=e.message+' — the source may be temporarily unavailable or block browser requests.';render()}})();
