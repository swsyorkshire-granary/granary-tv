// Granary TV personal library (Supabase)
const GRANARY_SUPABASE_URL = 'https://tbnjyytzoyvdymdpimko.supabase.co';
const GRANARY_SUPABASE_KEY = 'sb_publishable_OfPXxDIZPgew-S5XD51l9A__uChIZLC';
let granaryClient = null, currentUser = null, selectedProgramme = null;
const GRANARY_SERVICES = ["BBC iPlayer", "ITVX", "Channel 4", "Channel 5", "Amazon Prime Video", "Disney+", "Sky / NOW", "Apple TV+"];
const GRANARY_SERVICE_URLS = {
  "BBC iPlayer":"https://www.bbc.co.uk/iplayer",
  "ITVX":"https://www.itv.com/",
  "Channel 4":"https://www.channel4.com/",
  "Channel 5":"https://www.channel5.com/",
  "Amazon Prime Video":"https://www.primevideo.com/",
  "Disney+":"https://www.disneyplus.com/",
  "Sky / NOW":"https://www.nowtv.com/",
  "Apple TV+":"https://tv.apple.com/"
};
// Provider-specific title searches. These are search results, not claims of confirmed availability.
const GRANARY_PROVIDER_SEARCH_DOMAINS = {
  "BBC iPlayer":"bbc.co.uk/iplayer", "ITVX":"itv.com/watch",
  "Channel 4":"channel4.com/programmes", "Channel 5":"channel5.com",
  "Amazon Prime Video":"primevideo.com", "Disney+":"disneyplus.com",
  "Sky / NOW":"nowtv.com", "Apple TV+":"tv.apple.com"
};
function granaryProviderSearchUrl(service,title){
  const domain=GRANARY_PROVIDER_SEARCH_DOMAINS[service];
  if(!domain)return 'https://www.google.com/search?q='+encodeURIComponent('watch '+title+' '+service);
  return 'https://www.google.com/search?q='+encodeURIComponent('site:'+domain+' "'+title+'"');
}
const GRANARY_KNOWN_PROGRAMME_URLS = {
  "the bidding room": {"BBC iPlayer":"https://www.bbc.co.uk/iplayer/episodes/m000jygn"},
  "children in need 2026": {"BBC iPlayer":"https://www.bbc.co.uk/programmes/b008dk4b"},
  "the great british bake off": {"Channel 4":"https://www.channel4.com/programmes/the-great-british-bake-off"},
  "strictly come dancing": {"BBC iPlayer":"https://www.bbc.co.uk/iplayer/episodes/b006m8dq"}
};
const GRANARY_POSTER_IMAGES = {
  "the bidding room": "https://ichef.bbci.co.uk/images/ic/1200x675/p0jwc8bx.jpg",
  "children in need 2026": "https://ichef.bbci.co.uk/images/ic/1200x675/p01l664h.jpg"
};
// Automatic programme metadata: TVmaze public API (no API key; CC BY-SA attribution required).
const GRANARY_TVMAZE_API='https://api.tvmaze.com';
let granaryMetadataByTitle={}, granaryMetadataSetupReady=false, granaryMetadataBusy=new Set();
function granaryNormaliseTitle(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]/g,'');}
async function loadGranaryMetadata(){
  const {data,error}=await granaryClient.from('programme_metadata').select('*');
  if(error){granaryMetadataSetupReady=false;return error;}
  granaryMetadataSetupReady=true;granaryMetadataByTitle={};(data||[]).forEach(row=>granaryMetadataByTitle[row.normalized_title]=row);return null;
}
async function resolveGranaryMetadata(title){
  const key=granaryNormaliseTitle(title);if(!key||granaryMetadataBusy.has(key)||granaryMetadataByTitle[key])return;
  granaryMetadataBusy.add(key);
  try{
    const response=await fetch(GRANARY_TVMAZE_API+'/search/shows?q='+encodeURIComponent(title),{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('TVmaze lookup '+response.status);
    const results=await response.json();
    const exact=(results||[]).filter(x=>granaryNormaliseTitle(x.show?.name)===key);
    let row={user_id:currentUser.id,normalized_title:key,search_title:title,source:'TVmaze',match_status:'needs_review',source_id:null,matched_title:null,image_url:null,summary:null,source_url:null,genres:[]};
    if(exact.length===1){const s=exact[0].show;row={...row,match_status:'matched',source_id:s.id,matched_title:s.name,image_url:s.image?.original||s.image?.medium||null,summary:String(s.summary||'').replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()||null,source_url:s.url||null,genres:s.genres||[],premiered:s.premiered||null};}
    const {data,error}=await granaryClient.from('programme_metadata').upsert(row,{onConflict:'user_id,normalized_title'}).select().single();
    if(!error&&data)granaryMetadataByTitle[key]=data;
  }catch(e){console.warn('Granary TV metadata lookup failed for',title,e);}
  finally{granaryMetadataBusy.delete(key);}
}
async function startGranaryMetadataLookups(items){
  if(!granaryMetadataSetupReady||!currentUser)return;
  const titles=[...new Set((items||[]).map(x=>String(x.title||'').trim()).filter(Boolean))];
  const missing=titles.filter(t=>!granaryMetadataByTitle[granaryNormaliseTitle(t)]);
  if(!missing.length)return;
  const before=Object.keys(granaryMetadataByTitle).length;
  await Promise.all(missing.slice(0,4).map(resolveGranaryMetadata));
  if(Object.keys(granaryMetadataByTitle).length>before)openLibrary();
}

function addProviderSearchLinks(host,title){
  const services=Array.isArray(currentUser?.user_metadata?.streaming_services)?currentUser.user_metadata.streaming_services:GRANARY_SERVICES;
  const wrap=document.createElement('div');wrap.className='providerSearches';
  const heading=document.createElement('div');heading.className='providerHeading';heading.textContent='Open your streaming services';wrap.append(heading);
  const known=GRANARY_KNOWN_PROGRAMME_URLS[String(title||'').trim().toLowerCase()]||{};
  services.forEach(name=>{
    const url=known[name]||GRANARY_SERVICE_URLS[name];if(!url)return;
    const a=document.createElement('a');
    a.className='watchLookup providerLookup';a.textContent=known[name]?'Open '+name+' – '+title:'Open '+name;
    a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    a.title=known[name]?'Open the known programme page. For other titles, search within the provider.':'Open '+name+'; search for “'+title+'” there. Availability is not confirmed.';
    wrap.append(a);
  });
  const note=document.createElement('div');note.className='providerNote';note.textContent='For services without a direct programme link, search for the title after opening the service. These links do not confirm availability or subscription inclusion.';wrap.append(note);
  host.append(wrap);
}

let selectedServices = [...GRANARY_SERVICES];
function initGranaryCloud(){
  if (!window.supabase || !window.supabase.createClient) {
    $('cloudStatus').textContent = 'Connection library did not load. Check internet and refresh.';
    return;
  }
  granaryClient = window.supabase.createClient(GRANARY_SUPABASE_URL, GRANARY_SUPABASE_KEY, {
    auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
  });
  granaryClient.auth.getSession().then(({data})=>{
    currentUser=data.session?.user||null; updateCloudUI();
  });
  granaryClient.auth.onAuthStateChange((_event,session)=>{
    currentUser=session?.user||null; updateCloudUI();
  });
}
function updateCloudUI(){
  $('cloudStatus').textContent=currentUser ? 'Signed in: '+currentUser.email : 'Not signed in';
  $('signInBtn').textContent=currentUser?'Account / Set password':'Sign in';$('signOutBtn').style.display=currentUser?'inline-block':'none';
  $('libraryBtn').disabled=!currentUser;
  $('libraryBtn').style.opacity=currentUser?'1':'.55';
  $('servicesBtn').disabled=!currentUser;$('servicesBtn').style.opacity=currentUser?'1':'.55';
  if(currentUser){selectedServices=Array.isArray(currentUser.user_metadata?.streaming_services)?currentUser.user_metadata.streaming_services:[...GRANARY_SERVICES];}
}
function openServices(){
  if(!currentUser){$('servicesMessage').textContent='Please sign in first.';return;}
  selectedServices=Array.isArray(currentUser.user_metadata?.streaming_services)?[...currentUser.user_metadata.streaming_services]:[...GRANARY_SERVICES];
  const host=$('servicesChoices');host.innerHTML='';
  GRANARY_SERVICES.forEach(name=>{const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:8px;padding:8px;background:var(--panel2);border-radius:8px;font-size:13px';const cb=document.createElement('input');cb.type='checkbox';cb.checked=selectedServices.includes(name);cb.onchange=()=>{selectedServices=cb.checked?[...selectedServices,name]:selectedServices.filter(x=>x!==name)};label.append(cb,document.createTextNode(name));host.append(label)});
  $('servicesMessage').textContent='';$('servicesPanel').classList.add('open');
}
async function saveServices(){
  if(!currentUser)return;
  $('saveServicesBtn').disabled=true;$('servicesMessage').textContent='Saving…';
  const {data,error}=await granaryClient.auth.updateUser({data:{streaming_services:selectedServices}});
  $('saveServicesBtn').disabled=false;
  if(error){$('servicesMessage').textContent='Could not save: '+error.message;return;}
  currentUser=data.user||currentUser;$('servicesMessage').textContent='Saved. Your services will be available on your other signed-in devices too.';updateCloudUI();
}
function openAuth(){
  if(currentUser){
    // Signed-in users can open the panel to set/change their password; sign-out is separate.
    $('authPanel').classList.add('open');
    $('authEmail').value=currentUser.email||'';
    $('authEmail').disabled=true;
    $('setPasswordBtn').style.display='inline-block';
    $('passwordSignInBtn').style.display='none';
    $('sendLinkBtn').style.display='none';
    $('authMessage').textContent='You are signed in. Choose a password to use this same account on the TV.';
    $('authPassword').focus();
    return;
  }
  $('authPanel').classList.add('open');$('authMessage').textContent='';
  $('authEmail').disabled=false;
  $('setPasswordBtn').style.display='none';
  $('passwordSignInBtn').style.display='inline-block';
  $('sendLinkBtn').style.display='inline-block';
  $('authEmail').focus();
}
async function signInWithPassword(){
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  if(!email || !email.includes('@')){$('authMessage').textContent='Please enter a valid email address.';return;}
  if(!password){$('authMessage').textContent='Enter your password.';return;}
  $('passwordSignInBtn').disabled=true;$('authMessage').textContent='Signing in…';
  const {error}=await granaryClient.auth.signInWithPassword({email,password});
  $('passwordSignInBtn').disabled=false;
  $('authMessage').textContent=error?'Sign-in failed: '+error.message:'Signed in successfully.';
  if(!error)setTimeout(()=>$('authPanel').classList.remove('open'),700);
}
async function setAccountPassword(){
  const password=$('authPassword').value;
  if(password.length<8){$('authMessage').textContent='Please choose a password with at least 8 characters.';return;}
  $('setPasswordBtn').disabled=true;$('authMessage').textContent='Saving password…';
  const {error}=await granaryClient.auth.updateUser({password});
  $('setPasswordBtn').disabled=false;
  $('authMessage').textContent=error?'Could not set password: '+error.message:'Password saved. Use your email and this password to sign in on the TV.';
  if(!error)$('authPassword').value='';
}
async function sendMagicLink(){
  const email=$('authEmail').value.trim();
  if(!email || !email.includes('@')){$('authMessage').textContent='Please enter a valid email address.';return;}
  $('sendLinkBtn').disabled=true;$('authMessage').textContent='Sending your sign-in link…';
  const {error}=await granaryClient.auth.signInWithOtp({
    email,
    options:{emailRedirectTo:location.origin+location.pathname}
  });
  $('sendLinkBtn').disabled=false;
  $('authMessage').textContent=error ? error.message : 'Email sent. Open the link in this email on this device to sign in to Granary TV.';
}
async function addSelectedToLibrary(){
  if(!currentUser){$('programmeMessage').textContent='Please sign in first.';return;}
  if(!selectedProgramme)return;
  const p=selectedProgramme.p, ch=selectedProgramme.ch;
  const {error}=await granaryClient.from('library_items').insert({
    user_id:currentUser.id,title:p.title,item_type:'programme',channel:ch.display,
    description:p.description||null,start_at:p.start.toISOString(),end_at:p.end.toISOString(),
    status:'wanted',notes:p.genre?'Genre: '+p.genre:null
  });
  if(error){$('programmeMessage').textContent='Could not save: '+error.message;return;}
  $('programmeMessage').textContent='Added to your library. Finding where to watch…';
  try{
    const found=await granaryAutoFindLinks(p.title);
    $('programmeMessage').textContent=found.length?'Added to your library. Found it on '+found.join(', ')+'.':'Added to your library. No exact match found on iPlayer, ITVX, Channel 4 or 5 yet.';
  }catch(e){$('programmeMessage').textContent='Added to your library.';}
}

// ── Automatic programme links ───────────────────────────────────────────────
// Asks the find-links helper (Supabase Edge Function) for the official programme page on each service.
// Only exact title matches come back; they are saved as page_verified (never overwriting links you saved yourself).
const GRANARY_FIND_LINKS_URL=GRANARY_SUPABASE_URL+'/functions/v1/find-links';
function granaryCheckedRecently(nt){try{const m=JSON.parse(localStorage.getItem('granary-link-checks')||'{}');return m[nt]&&Date.now()-m[nt]<3*864e5}catch(e){return false}}
function granaryMarkChecked(nt){try{const m=JSON.parse(localStorage.getItem('granary-link-checks')||'{}');m[nt]=Date.now();localStorage.setItem('granary-link-checks',JSON.stringify(m))}catch(e){}}
async function granaryLookup(title){
  const r=await fetch(GRANARY_FIND_LINKS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});
  if(!r.ok)throw Error('lookup '+r.status);
  return (await r.json()).best||{};
}
async function granaryAutoFindLinks(title){
  if(!currentUser||!title)return [];
  const nt=granaryNormaliseTitle(title);
  let best=await granaryLookup(title);
  // "Children in Need 2026", "Strictly Come Dancing: Series 24" → try the plain programme name too
  const plain=title.replace(/\s*[:\-–]\s*(series|season)\s*\d+.*$/i,'').replace(/\s+\(?\d{4}\)?$/,'').trim();
  if(!Object.keys(best).length&&plain&&plain!==title)best=await granaryLookup(plain);
  // Keep anything you decided yourself; only fill gaps or upgrade unchecked "candidate" entries.
  const {data:existing}=await granaryClient.from('programme_provider_links').select('service,verification_status').eq('normalized_title',nt);
  const have=new Set((existing||[]).filter(r=>r.verification_status!=='candidate').map(r=>r.service));
  const rows=Object.entries(best).filter(([svc])=>!have.has(svc)).map(([svc,m])=>({
    user_id:currentUser.id,normalized_title:nt,programme_title:title,service:svc,candidate_url:m.url,
    verification_status:'page_verified',checked_at:new Date().toISOString(),
    notes:'Found automatically: official '+svc+' page for “'+m.title+'”.',updated_at:new Date().toISOString()
  }));
  if(rows.length){const {error}=await granaryClient.from('programme_provider_links').upsert(rows,{onConflict:'user_id,normalized_title,service'});if(error)console.warn('Saving found links failed:',error.message);}
  granaryMarkChecked(nt);
  return Object.keys(best);
}
// Fill in links for library programmes that have none yet (runs quietly in the background).
let granaryAutoFillRunning=false;
async function granaryAutoFillLibrary(items){
  if(granaryAutoFillRunning||!currentUser)return;
  const haveLinks=new Set(Object.values(granaryVerifiedLinksByTitle).filter(r=>['page_verified','playback_confirmed'].includes(r.verification_status)).map(r=>r.normalized_title));
  const todo=[...new Set(items.map(i=>i.title))].filter(t=>{const nt=granaryNormaliseTitle(t);return !haveLinks.has(nt)&&!granaryCheckedRecently(nt)}).slice(0,10);
  if(!todo.length)return;
  granaryAutoFillRunning=true;let added=0;
  try{for(const t of todo){try{added+=(await granaryAutoFindLinks(t)).length}catch(e){console.warn('Link lookup failed for',t,e)}}}
  finally{granaryAutoFillRunning=false}
  if(added&&$('libraryPanel').classList.contains('open'))openLibrary();
}
let librarySearch='',libraryStatus='all',librarySort='newest';
let granaryVerifiedLinksByTitle={};
// Links saved in the Link Test Bench. Only page_verified / playback_confirmed are treated as trusted.
async function loadGranaryVerifiedLinks(){
  granaryVerifiedLinksByTitle={};
  const {data,error}=await granaryClient.from('programme_provider_links').select('*');
  if(error){console.warn('Verified programme links unavailable:',error.message);return error;}
  (data||[]).forEach(r=>{granaryVerifiedLinksByTitle[r.normalized_title+'|'+r.service]=r;});
  return null;
}
function getGranaryVerifiedLink(title,service){
  const r=granaryVerifiedLinksByTitle[granaryNormaliseTitle(title)+'|'+service];
  if(!r||!r.candidate_url||!['page_verified','playback_confirmed'].includes(r.verification_status))return null;
  return r;
}
async function openLibrary(){
  if(!currentUser){openAuth();return;}
  $('libraryPanel').classList.add('open');$('libraryContent').textContent='Loading your programmes…';
  const {data,error}=await granaryClient.from('library_items').select('*').order('created_at',{ascending:false});
  if(error){$('libraryContent').textContent='Could not load library: '+error.message;return;}
  const metadataError=await loadGranaryMetadata();
  await loadGranaryVerifiedLinks();
  setTimeout(()=>granaryAutoFillLibrary(data||[]),0);
  if(!data.length){$('libraryContent').textContent='Your library is empty. Open a programme in the guide and choose Add to My Library.';return;}
  $('libraryContent').innerHTML='';
  if(metadataError){const setup=document.createElement('div');setup.className='providerNote';setup.textContent='Automatic programme artwork and matching will activate after the Granary TV metadata table is installed in Supabase.';$('libraryContent').append(setup);}
  const tools=document.createElement('div');tools.className='libraryTools';
  const search=document.createElement('input');search.type='search';search.placeholder='Find a programme…';search.value=librarySearch;search.setAttribute('aria-label','Find a programme');
  const status=document.createElement('select');status.setAttribute('aria-label','Filter by status');[['all','All statuses'],['wanted','Wanted'],['scheduled','Scheduled'],['available','Available'],['watching','Watching'],['finished','Finished']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;status.append(o)});status.value=libraryStatus;
  const sort=document.createElement('select');sort.setAttribute('aria-label','Sort library');[['newest','Recently added'],['oldest','Oldest added'],['title','Title A–Z']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;sort.append(o)});sort.value=librarySort;
  const apply=()=>{librarySearch=search.value.trim();libraryStatus=status.value;librarySort=sort.value;openLibrary()};
  search.addEventListener('keydown',e=>{if(e.key==='Enter')apply()});status.onchange=apply;sort.onchange=apply;
  const clearBtn=document.createElement('button');clearBtn.className='clearSearch';clearBtn.type='button';clearBtn.textContent='×';clearBtn.title='Clear search and show the full library';clearBtn.setAttribute('aria-label','Clear search');clearBtn.onclick=()=>{search.value='';librarySearch='';libraryStatus=status.value;librarySort=sort.value;openLibrary()};
  const searchBtn=document.createElement('button');searchBtn.textContent='Find';searchBtn.onclick=apply;
  tools.append(search,clearBtn,status,sort,searchBtn);$('libraryContent').append(tools);
  let visibleData=data.filter(item=>(libraryStatus==='all'||(item.status||'wanted')===libraryStatus)&&(!librarySearch||String(item.title||'').toLowerCase().includes(librarySearch.toLowerCase())));
  if(librarySort==='title')visibleData.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
  else visibleData.sort((a,b)=>{const av=new Date(a.created_at||a.start_at||0).getTime(),bv=new Date(b.created_at||b.start_at||0).getTime();return librarySort==='oldest'?av-bv:bv-av});
  const groups=new Map();visibleData.forEach(item=>{const key=String(item.title||'Programme').trim().toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)});
  const count=document.createElement('div');count.className='libraryCount';count.textContent=groups.size+' programme'+(groups.size===1?'':'s')+' · '+visibleData.length+' saved entr'+(visibleData.length===1?'y':'ies');$('libraryContent').append(count);
  if(!visibleData.length){const empty=document.createElement('p');empty.textContent='No programmes match this search or status filter.';$('libraryContent').append(empty);return;}
  const grid=document.createElement('div');grid.className='libraryGrid';$('libraryContent').append(grid);
  // Repeated saved broadcasts with the same title remain grouped in one tile.
  [...groups.values()].forEach(items=>{
    const item=items[0], titleText=item.title||'Programme';
    const row=document.createElement('section');row.className='libraryRow';
    const poster=document.createElement('div');poster.className='libraryPoster';
    const posterUrl=GRANARY_POSTER_IMAGES[String(titleText).trim().toLowerCase()];if(posterUrl){poster.style.backgroundImage='linear-gradient(180deg,#07111a22 15%,#07111acc 100%),url(\"'+posterUrl+'\")';poster.setAttribute('role','img');poster.setAttribute('aria-label',titleText+' programme artwork');}
    const ch=document.createElement('span');ch.className='posterChannel';ch.textContent=item.channel||'Granary TV';
    const pt=document.createElement('span');pt.className='posterTitle';pt.textContent=titleText;
    poster.append(ch,pt);
    const title=document.createElement('div');title.className='libraryTitle';title.textContent=titleText;
    const summary=document.createElement('div');summary.className='librarySummary';summary.textContent=items.length>1?items.length+' saved broadcasts / entries':(item.channel||'Saved programme');
    const service=providerForChannel(item.channel);
    const actions=document.createElement('div');actions.className='libraryCardActions';
    const primary=document.createElement('a');primary.className='primaryProvider';primary.target='_blank';primary.rel='noopener noreferrer';
    const known=GRANARY_KNOWN_PROGRAMME_URLS[String(titleText).trim().toLowerCase()]||{};
    const verifiedPrimary=getGranaryVerifiedLink(titleText,service);
    primary.href=verifiedPrimary?.candidate_url||known[service]||granaryProviderSearchUrl(service,titleText);
    primary.textContent=verifiedPrimary?(verifiedPrimary.verification_status==='playback_confirmed'?'Play on ':'Open ')+service:(known[service]?'Open '+service:'Search '+service+' for '+titleText);
    primary.title=verifiedPrimary?'Saved '+verifiedPrimary.verification_status.replaceAll('_',' ')+' link'+(verifiedPrimary.checked_at?' · checked '+new Date(verifiedPrimary.checked_at).toLocaleDateString('en-GB'):''):(known[service]?'Programme-specific link configured':'Searches for this exact programme; availability is not confirmed');
    const more=document.createElement('button');more.className='moreProviders';more.textContent='Other services ▾';
    const extra=document.createElement('div');extra.className='providerExtra';
    const services=Array.isArray(currentUser?.user_metadata?.streaming_services)?currentUser.user_metadata.streaming_services:GRANARY_SERVICES;
    services.filter(n=>n!==service).forEach(name=>{const a=document.createElement('a');a.className='watchLookup providerLookup';const verified=getGranaryVerifiedLink(titleText,name);a.textContent=verified?'Open verified '+name:'Search '+name+' for '+titleText;a.href=verified?.candidate_url||known[name]||granaryProviderSearchUrl(name,titleText);a.title=verified?'Saved '+verified.verification_status.replaceAll('_',' '):'Search result; availability not confirmed';a.target='_blank';a.rel='noopener noreferrer';extra.append(a)});
    more.onclick=()=>{extra.classList.toggle('open');more.textContent=extra.classList.contains('open')?'Other services ▴':'Other services ▾'};
    actions.append(primary,more);
    const episodeToggle=document.createElement('button');episodeToggle.className='moreProviders';episodeToggle.textContent=items.length>1?'Show '+items.length+' saved entries ▾':'Show saved details ▾';
    const episodes=document.createElement('div');episodes.className='libraryEpisodes';
    items.forEach(entry=>{
      const ep=document.createElement('div');ep.className='libraryEpisode';
      const epTitle=document.createElement('strong');epTitle.textContent=entry.item_type==='episode'?'Episode':(entry.channel||'Broadcast');
      const epMeta=document.createElement('small');epMeta.textContent=[entry.start_at?new Date(entry.start_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'',entry.status||'wanted'].filter(Boolean).join(' · ');
      const status=document.createElement('select');['wanted','scheduled','available','watching','finished'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v[0].toUpperCase()+v.slice(1);status.append(o)});status.value=entry.status||'wanted';
      status.onchange=async()=>{const {error}=await granaryClient.from('library_items').update({status:status.value,updated_at:new Date().toISOString()}).eq('id',entry.id);if(error)alert(error.message);else epMeta.textContent=[entry.start_at?new Date(entry.start_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'',status.value].filter(Boolean).join(' · ')};
      const del=document.createElement('button');del.textContent='Remove';del.onclick=async()=>{if(!confirm('Remove '+titleText+' from your library?'))return;const {error}=await granaryClient.from('library_items').delete().eq('id',entry.id);if(error){alert(error.message);return}ep.remove();const remaining=episodes.querySelectorAll('.libraryEpisode').length;summary.textContent=remaining?remaining+' saved broadcasts / entries':'No saved entries';if(!remaining)row.remove();};
      ep.append(epTitle,status,epMeta,del);episodes.append(ep);
    });
    episodeToggle.onclick=()=>{episodes.classList.toggle('open');episodeToggle.textContent=episodes.classList.contains('open')?'Hide saved entries ▴':'Show '+items.length+' saved entries ▾'};
    const meta=granaryMetadataByTitle[granaryNormaliseTitle(titleText)];
    if(meta?.match_status==='matched'){if(meta.image_url&&!posterUrl){poster.style.backgroundImage='linear-gradient(180deg,#07111a22 15%,#07111acc 100%),url("'+meta.image_url+'")';poster.setAttribute('role','img');poster.setAttribute('aria-label',titleText+' programme artwork');}if(meta.summary){const synopsis=document.createElement('div');synopsis.className='librarySummary';synopsis.textContent=meta.summary;row.append(synopsis);}const credit=document.createElement('div');credit.className='providerNote';credit.textContent='Programme information: TVmaze';row.append(credit);}
    else if(meta?.match_status==='needs_review'){const pending=document.createElement('div');pending.className='providerNote';pending.textContent='Programme match needs checking — no automatic link has been assigned.';row.append(pending);}
    row.append(poster,title,summary,actions,extra,episodeToggle,episodes);grid.append(row);
  });
  if(granaryMetadataSetupReady)startGranaryMetadataLookups(data);
}

function providerForChannel(channel){
 const c=String(channel||'').toLowerCase();
 if(c.includes('bbc'))return 'BBC iPlayer';
 if(c.includes('itv'))return 'ITVX';
 if(c.includes('channel 4')||c.includes('e4')||c.includes('more4')||c.includes('film4'))return 'Channel 4';
 if(c.includes('channel 5')||c.includes('5star')||c.includes('5action')||c.includes('5usa'))return 'Channel 5';
 if(c.includes('sky')||c.includes('now'))return 'Sky / NOW';
 return 'BBC iPlayer';
}

document.addEventListener('DOMContentLoaded',()=>{
  $('signInBtn').onclick=openAuth;$('servicesBtn').onclick=openServices;$('saveServicesBtn').onclick=saveServices;$('signOutBtn').onclick=async()=>{await granaryClient.auth.signOut();currentUser=null;updateCloudUI()};$('libraryBtn').onclick=openLibrary;$('sendLinkBtn').onclick=sendMagicLink;$('passwordSignInBtn').onclick=signInWithPassword;$('setPasswordBtn').onclick=setAccountPassword;
  $('authEmail').addEventListener('keydown',e=>{if(e.key==='Enter')signInWithPassword()});$('authPassword').addEventListener('keydown',e=>{if(e.key==='Enter'){if(currentUser)setAccountPassword();else signInWithPassword()}});
  initGranaryCloud();
});
