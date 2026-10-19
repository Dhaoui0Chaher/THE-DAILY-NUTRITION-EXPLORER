/* NutriAtlas v5 — account journeys and AI-assisted dynamic weekly kitchen. */
(()=>{
'use strict';
const el=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS=['breakfast','lunch','dinner','snack'];
const SLABEL={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner',snack:'Snack'};
const AI_KEY='nutriatlas_ai_week_v1',PREF_KEY='nutriatlas_ai_pref_v1';
const BANS={
 nuts:['almonds','walnuts','peanuts','pumpkin','sunflower','chia','flax','brazil'],
 dairy:['milk','yogurt','cheese'],egg:['egg'],
 fish:['salmon','sardines','tuna'],shellfish:['shrimp'],
 gluten:['wholebread','whitebread','couscous','oatsdry','oats'],
 sesame:['sesame'],soy:[]
};
let client=null,account=null,plan=null,source='none',busy=false,checked={},prefs=null;
try{const stored=JSON.parse(localStorage.getItem(AI_KEY)||'null');if(stored?.days?.length===7){plan=stored.days;source=stored.source||'local';checked=stored.checked||{}}}catch{}
try{prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'null')}catch{}
if(!prefs||typeof prefs!=='object')prefs={cuisine:'tunisian',goal:'balanced',minutes:30,allergies:[],pantry:'',dislike:''};
let recovering=false;
function go(view){location.hash='#/'+view;}
function cloud(){return window.naCloudClient||null;}
function noteAuth(message,error=false){const p=el('#naAuthMessage');if(p){p.textContent=message;p.classList.toggle('error',error)}}
function isAuthRoute(){return ['signin','signup','forgot','reset','verify','account'].includes((location.hash.replace(/^#\/?/,'').split('?')[0]||''));}
function authMode(){
 const p=location.hash.replace(/^#\/?/,'').split('?')[0]||'';
 if(p==='account'&&!account)return 'signin';
 return ['signin','signup','forgot','reset','verify','account'].includes(p)?p:'';
}
function route(){
 const mode=authMode();
 document.body.classList.toggle('na-auth-mode',!!mode);
 if(mode)renderAuth(mode);
 document.body.classList.remove('na-menu-open');
 if(mode){window.scrollTo(0,0);return}
 const tab=location.hash.replace(/^#\/?/,'').split('?')[0];
 const real=tab==='ai-kitchen'?'ai-kitchen':el('#'+tab)?.classList.contains('section')?tab:'overview';
 if(typeof setTab==='function')setTab(real);
}
function renderAuth(view){
 const titles={signin:['Welcome back','Sign in to recover your saved nutrition profile and meal plans.'],signup:['Create your account','Your personal meals, shopping lists and nutrition profile — on any device.'],forgot:['Reset your password','Enter your email and we’ll send a secure recovery link.'],reset:['Choose a new password','Set a new password to finish the recovery process.'],verify:['Check your inbox','Follow the verification email to activate your account.'],account:['Your account','Your saved nutrition workspace lives under your own account.']};
 const a=titles[view]||titles.signin;
 const useEmail=['signin','signup','forgot'].includes(view),usePass=['signin','signup','reset'].includes(view);
 const emailLabel=useEmail?'<label for="naAuthEmail">Email address</label><input id="naAuthEmail" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"/>':'';
 const passLabel=usePass?'<label for="naAuthPass">'+(view==='reset'?'New password':'Password')+'</label><input id="naAuthPass" type="password" minlength="8" autocomplete="'+(view==='signin'?'current-password':'new-password')+'" required placeholder="At least 8 characters"/>':'';
 const confirm= ['signup','reset'].includes(view)?'<label for="naAuthConfirm">Confirm password</label><input id="naAuthConfirm" type="password" minlength="8" autocomplete="new-password" required placeholder="Repeat your password"/>':'';
 const btn={signin:'Sign in',signup:'Create account',forgot:'Send recovery link',reset:'Update password',verify:'Back to sign in',account:'Return to dashboard'}[view];
 el('#naAuthCard').innerHTML='<div class="na-brand" style="margin-bottom:38px;color:#1b543a">✳ Nutri<em style="color:#73a87b">Atlas</em></div><h2>'+a[0]+'</h2><p class="na-muted">'+a[1]+'</p>'
 +'<form id="naAuthForm">'+emailLabel+passLabel+confirm+'<button class="na-primary" id="naAuthSubmit" type="submit">'+btn+'</button></form>'
 +'<div class="na-auth-actions">'+(view==='signin'?'<button class="na-link" data-auth="forgot">Forgot password?</button><button class="na-link" data-auth="signup">Create an account</button>':view==='signup'?'<button class="na-link" data-auth="signin">Already have an account?</button>':view==='account'?'<button class="na-link" id="naSignOut">Sign out securely</button>':'<button class="na-link" data-auth="signin">Back to sign in</button>')+'</div>'
 +'<div id="naAuthMessage" aria-live="polite" role="status"></div>'
 +'<p class="na-terms">Cloud saving requires Supabase Auth. Your nutrition data stays private to your account when database Row Level Security is enabled. Local demo mode is available without creating an account.</p>'
 +'<button class="na-link" id="naExploreDemo" style="margin-top:14px">Explore NutriAtlas '+(view==='account'?'':'without signing in')+' →</button>';
 el('#naAuthCard').querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.auth)));
 el('#naExploreDemo').onclick=()=>{localStorage.setItem('na_demo','yes');go('overview')};
 const out=el('#naAuthForm');if(out)out.addEventListener('submit',e=>{e.preventDefault();handleAuth(view)});
 const signout=el('#naSignOut');if(signout)signout.onclick=signOut;
 if(view==='account')noteAuth(account?'Signed in as '+account.email:'No active session');
 if(view==='reset'&&!recovering&&!account)noteAuth('Open the password recovery link from your email first.',true);
}
async function handleAuth(view){
 if(view==='verify'||view==='account'){go(view==='verify'?'signin':'overview');return}
 const api=cloud();
 if(!api){noteAuth('Connection unavailable. Check network and Supabase settings.',true);return}
 const email=el('#naAuthEmail')?.value.trim()||'';
 const password=el('#naAuthPass')?.value||'';
 const confirmation=el('#naAuthConfirm')?.value||'';
 if(view!=='reset'&&(!email||!/^\S+@\S+\.\S+$/.test(email))){noteAuth('Enter a valid email address.',true);return}
 if(['signin','signup','reset'].includes(view)&&password.length<8){noteAuth('Use a password of at least 8 characters.',true);return}
 if(['signup','reset'].includes(view)&&password!==confirmation){noteAuth('Passwords do not match.',true);return}
 const button=el('#naAuthSubmit');button.disabled=true;noteAuth('Processing…');
 try{
  const redirectTo=location.origin+location.pathname;
  if(view==='signup'){
   const {data,error}=await api.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});if(error)throw error;
   if(data?.session){go('overview')}else{go('verify');noteAuth('Check your email for a verification link.')}
  }else if(view==='signin'){
   const {error}=await api.auth.signInWithPassword({email,password});if(error)throw error;go('overview');
  }else if(view==='forgot'){
   const {error}=await api.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;
   noteAuth('If an account exists, a recovery email will arrive shortly.');
  }else if(view==='reset'){
   if(!recovering&&!account)throw Error('Open the password reset link first.');
   const {error}=await api.auth.updateUser({password});if(error)throw error;
   recovering=false;go('overview');
  }
 }catch(e){noteAuth(e?.message||'Account operation failed.',true)}
 finally{const b=el('#naAuthSubmit');if(b)b.disabled=false}
}
async function signOut(){
 const api=cloud();if(!api)return;
 if(!confirm('Sign out? This clears saved meal data from this browser. Save your changes to cloud first.'))return;
 const {error}=await api.auth.signOut();
 if(error){noteAuth(error.message,true);return}
 ['nutriatlas_plate_v1','nutriatlas_v2_meal','nutriatlas_week_v3',AI_KEY,PREF_KEY].forEach(k=>localStorage.removeItem(k));
 localStorage.removeItem('na_demo');location.replace(location.pathname+'#/signin');location.reload();
}
function updateAccount(u){
 account=u;
 const nav=el('#naNavAccount');if(nav)nav.textContent=u?'👤 '+(u.email||'My account').split('@')[0]:'Sign in / Create account';
 if(u&&['signin','signup','verify'].includes(authMode())){go('overview')}
 if(!u&&!localStorage.getItem('na_demo')&&!isAuthRoute())go('signin');
 route();
}
function syncAuth(){
 const c=cloud();if(!c)return;
 client=c;
 c.auth.onAuthStateChange((event,session)=>{
   if(event==='PASSWORD_RECOVERY'){recovering=true;setTimeout(()=>go('reset'),0)}
   if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','USER_UPDATED','PASSWORD_RECOVERY'].includes(event)){
    account=session?.user||null;
    setTimeout(()=>updateAccount(session?.user||null),0);
   }
 });
 c.auth.getUser().then(({data,error})=>{if(!error)updateAccount(data?.user||null)}).catch(()=>{});
}
function initAuth(){
 const shell=document.createElement('div');shell.id='naAuthShell';
 shell.innerHTML='<div class="na-auth-scene"><div class="na-brand">✳ Nutri<em>Atlas</em></div><div><div style="font-size:13px;letter-spacing:2px;color:#b8ddbf">PERSONAL NUTRITION, MADE PRACTICAL</div><h1>Eat better.<br>Plan smarter.<br>Shop once.</h1><p>Understand your nutritional needs, build real meals and organize the whole week. Your choices, your portions, your kitchen.</p><div class="na-dots"><span>55 nutrient references</span><span>7-day plans</span><span>Shopping by weight</span></div></div><small style="color:#abd5bc">Nutrition estimates are educational, not clinical advice.</small></div><div class="na-auth-pane"><div id="naAuthCard" class="na-auth-card"></div></div>';
 document.body.insertBefore(shell,document.body.firstChild);
 const top=el('.topline'),btn=document.createElement('button');btn.id='naNavAccount';btn.type='button';btn.textContent='Sign in / Create account';
 btn.onclick=()=>go(account?'account':'signin');
 const menu=document.createElement('button');menu.id='naMenuToggle';menu.type='button';menu.textContent='☰ Menu';
 menu.onclick=()=>document.body.classList.toggle('na-menu-open');
 top.insertBefore(menu,top.firstChild);top.appendChild(btn);
 const accountButton=document.createElement('button');accountButton.id='naAccountEntry';accountButton.textContent='Manage account & cloud sync';
 accountButton.onclick=()=>go(account?'account':'signin');el('.na-account').appendChild(accountButton);
 el('.navtabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)location.hash='#/'+b.dataset.tab});
 window.addEventListener('hashchange',route);
 window.addEventListener('nutriatlas:client',syncAuth);
 if(cloud())syncAuth();
 if(!location.hash)go('signin');else route();
}
function allergyIds(){return new Set((prefs.allergies||[]).flatMap(k=>BANS[k]||[]))}
function excludedRecipe(r){
 const banned=allergyIds();
 return r.parts.some(x=>banned.has(x.id))||!recipeAllowed(r,profile());
}
function cleanRecipe(r){
 if(!r||typeof r.title!=='string'||typeof r.method!=='string'||!Array.isArray(r.parts))return null;
 if(r.title.length>100||r.method.length>400||r.parts.length<1||r.parts.length>10)return null;
 const parts=r.parts.map(x=>({id:x.id,g:Number(x.g)}));
 if(parts.some(x=>!F_BY_ID[x.id]||!Number.isFinite(x.g)||x.g<1||x.g>700||allergyIds().has(x.id)||!eligible(F_BY_ID[x.id],profile())))return null;
 return {title:r.title,method:r.method,parts,day:r.day,slot:r.slot};
}
function recipeTotals(r,key){
 let total=0,missing=0;
 for(const p of r.parts){const f=F_BY_ID[p.id],v=f?getFoodQty(f,key,p.g):null;if(v==null)missing++;else total+=v}
 return {total,missing};
}
function dayTotals(d,key){let total=0,missing=0;for(const slot of SLOTS){const r=d[slot];if(!r)continue;const q=recipeTotals(r,key);total+=q.total;missing+=q.missing;}return {total,missing}}
function choose(slot,used,protein){
 let pool=RECIPES.filter(r=>r.slot===slot&&!excludedRecipe(r));
 if(slot==='main'&&protein)pool=pool.filter(r=>weekGroupMain(r)===protein);
 if(!pool.length)throw Error('No compatible recipes for '+(protein||slot)+'. Reduce protein frequency or exclusions.');
 const goal=prefs.goal,pantry=prefs.pantry.toLowerCase(),style=prefs.cuisine;
 pool.sort((a,b)=>{
  function score(r){
    const e=recipeQty(r,'energy').known,p=recipeQty(r,'protein').known,f=recipeQty(r,'fiber').known,iron=recipeQty(r,'iron').known;
    const goalScore=goal==='protein'?p*1.4:goal==='fiber'?f*2.4:goal==='iron'?iron*2:goal==='budget'?-e*.002:0;
    const matches=r.parts.filter(x=>pantry.includes(x.id)||pantry.includes(F_BY_ID[x.id]?.name.toLowerCase()||'__absent__')).length;
    return (r.styles?.includes(style)?18:0)+goalScore+matches*15-(used[r.id]||0)*26+Math.random()*22;
  }
  return score(b)-score(a)
 });
 const out=pool[0];used[out.id]=(used[out.id]||0)+1;return out;
}
function compose(main,side,day,slot){
 const parts=[...main.parts,...side.parts],tot=new Map();
 for(const p of parts)tot.set(p.id,(tot.get(p.id)||0)+p.g);
 return {day,slot,title:main.title+' with '+side.title.toLowerCase(),method:(main.desc||main.title)+'. Serve with '+side.title.toLowerCase()+'.',parts:[...tot].map(([id,g])=>({id,g}))};
}
function mixMeal(slot,day,used,protein){
 if(slot==='breakfast'||slot==='snack'){
  const r=choose(slot,used);return{day,slot,title:r.title,method:r.desc||'Prepare and serve.',parts:r.parts.map(p=>({...p}))};
 }
 const m=choose('main',used,protein),side=choose(slot==='lunch'?'salad':'side',used);
 return compose(m,side,day,slot);
}
function buildSmart(){
 if(profile().age<19||profile().life!=='general')throw Error('Meal templates are currently developed for non-pregnant adults age 19+.');
 const counts=weekRequestedCounts(),categories=[];
 for(const [k,v] of Object.entries(counts)){
  if(!Number.isInteger(v)||v<0||v>14)throw Error('Protein frequencies must be whole numbers from 0 to 14.');
  for(let i=0;i<v;i++)categories.push(k);
 }
 if(categories.length>14)throw Error('Your protein frequencies exceed 14 lunch/dinner meals.');
 while(categories.length<14)categories.push('meat-free');
 for(let i=categories.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[categories[i],categories[j]]=[categories[j],categories[i]]}
 const used={},newDays=[];
 for(let d=0;d<7;d++){
  newDays.push({
   breakfast:mixMeal('breakfast',d,used),
   lunch:mixMeal('lunch',d,used,categories[d*2]),
   dinner:mixMeal('dinner',d,used,categories[d*2+1]),
   snack:mixMeal('snack',d,used)
  })
 }
 return newDays;
}
function save(){
 localStorage.setItem(AI_KEY,JSON.stringify({days:plan,source,checked}));
 localStorage.setItem(PREF_KEY,JSON.stringify(prefs));
 window.dispatchEvent(new Event('nutriatlas:changed'));
}
function readPrefs(){
 const read=id=>el('#'+id)?.value.trim()||'';
 prefs={cuisine:read('naAiCuisine'),goal:read('naAiGoal'),minutes:Number(read('naAiTime'))||30,pantry:read('naAiPantry').slice(0,200),dislike:read('naAiDislike').slice(0,160),
  allergies:[...document.querySelectorAll('#naAiAllergy input:checked')].map(x=>x.value)};
 localStorage.setItem(PREF_KEY,JSON.stringify(prefs));
}
function banner(msg,err=false){const x=el('#naAiMessage');x.textContent=msg;x.style.color=err?'#ad392c':'#2a664b'}
function setBusy(on){busy=on;el('#naAiCreate').disabled=on;el('#naAiSmart').disabled=on;document.querySelectorAll('[data-ai-swap]').forEach(b=>b.disabled=on)}
async function requestAI(action,day=0,slot='lunch'){
 if(!account||!cloud())throw Error('Sign in to use AI. Smart Mix works offline.');
 const body={action,day,slot,cuisine:prefs.cuisine,diet:profile().diet,goal:prefs.goal,minutes:prefs.minutes,allergies:prefs.allergies,
  pantry:prefs.pantry,dislike:prefs.dislike,foods:FOODS.map(f=>({id:f.id,name:f.name,diet:f.diet}))};
 if(action==='swap')body.replace_title=plan?.[day]?.[slot]?.title||'';
 const {data,error}=await cloud().functions.invoke('nutriatlas-ai',{body});
 if(error){let detail=error.message||'AI Edge Function unavailable';try{const v=await error.context?.json();if(v?.error)detail=v.error}catch{}throw Error(detail)}
 if(!data||!Array.isArray(data.recipes))throw Error('AI returned an empty plan');
 return data.recipes;
}
function checkAI(recipes,action,day,slot){
 if(action==='week'&&recipes.length!==28)throw Error('AI did not return 28 complete meals.');
 if(action==='swap'&&recipes.length!==1)throw Error('Invalid replacement.');
 const all=Array.from({length:7},()=>({}));
 for(const r of recipes){
  if(!Number.isInteger(r.day)||r.day<0||r.day>6||!SLOTS.includes(r.slot))throw Error('AI returned invalid schedule');
  if(all[r.day][r.slot])throw Error('Duplicate AI recipe');
  const safe=cleanRecipe(r);if(!safe)throw Error('Recipe contained unsupported ingredient, dietary conflict or weight.');
  all[r.day][r.slot]=safe;
 }
 if(action==='week'&&all.some(d=>SLOTS.some(k=>!d[k])))throw Error('AI schedule is incomplete.');
 if(action==='swap'&&(recipes[0].day!==day||recipes[0].slot!==slot))throw Error('AI replaced the wrong dish.');
 return action==='week'?all:all[day][slot];
}
async function generate(mode){
 readPrefs();setBusy(true);banner(mode==='week'?'Generating personalized meals with Groq (free tier)…':'Designing a varied menu from your recipe library…');
 try{
  const days=mode==='week'?checkAI(await requestAI('week'),'week',0,''):buildSmart();
  plan=days;source=mode==='week'?'groq-free':'smart-mix';checked={};save();render();banner(mode==='week'?'AI plan generated. Nutrition estimated locally from known food ingredients.':'Smart Mix generated a varied, frequency-aware week. No external AI was used.');
 }catch(e){banner(e.message||'Generation failed.',true)}
 finally{setBusy(false)}
}
async function swap(day,slot,ai=false){
 if(!plan)return;
 if(busy)return;
 readPrefs();setBusy(true);
 try{
  let next;
  if(ai)next=checkAI(await requestAI('swap',day,slot),'swap',day,slot);
  else{
   const used={};
   for(const d of plan)for(const x of SLOTS){const r=d[x];if(r?.title)used[r.title]=(used[r.title]||0)+1}
   const protein=['lunch','dinner'].includes(slot)?proteinOf(plan[day][slot]):undefined;
   const alternatives=Array.from({length:6},()=>mixMeal(slot,day,used,protein)).filter(r=>r.title!==plan[day][slot]?.title);
   next=alternatives[0]||mixMeal(slot,day,used,protein);
  }
  plan[day][slot]=next;checked={};save();render();
  banner((ai?'AI':'Smart Mix')+' changed only '+DAYS[day]+' '+slot+'. Shopping quantities recalculated.');
 }catch(e){banner(e.message||'Replacement unavailable',true)}
 finally{setBusy(false)}
}
function proteinOf(r){
 const ids=r.parts.map(x=>x.id);
 for(const k of ['chicken','beef','lamb'])if(ids.includes(k))return k;
 if(ids.some(i=>['tuna','salmon','sardines','shrimp'].includes(i)))return 'fish';
 return 'meat-free';
}
function shopping(){
 const grouped=new Map();
 for(const d of plan)for(const k of SLOTS)for(const p of d[k].parts){grouped.set(p.id,(grouped.get(p.id)||0)+p.g)}
 return [...grouped].filter(([id])=>id!=='waterdrink').map(([id,used])=>{
  const item=WEEK_BUY[id]||[F_BY_ID[id]?.category||'other',F_BY_ID[id]?.name||id,1,'edible weight'];
  const factor=Number(weekFactors[id]||item[2]||1);
  return {id,used,grams:Math.ceil(used*factor/5)*5,category:item[0],label:item[1],note:item[3]};
 }).sort((a,b)=>a.category.localeCompare(b.category)||a.label.localeCompare(b.label));
}
function number(n){return Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}
function weight(n){return n>=1000?(n/1000).toFixed(2)+' kg':number(n)+' g'}
function render(){
 const where=el('#naAiResults'),list=el('#naAiGroceries'),summary=el('#naAiSummary');
 if(!plan||plan.length!==7){where.innerHTML='<div class="na-ai-status">Generate a week to see 28 meals, nutritional estimates and an automatically calculated shopping list.</div>';list.innerHTML='';summary.innerHTML='';return}
 let totalE=0,totalP=0,missingE=0;
 where.innerHTML=plan.map((d,i)=>{
  const energy=dayTotals(d,'energy'),protein=dayTotals(d,'protein'),iron=dayTotals(d,'iron'),c=dayTotals(d,'c');
  totalE+=energy.total;totalP+=protein.total;missingE+=energy.missing;
  const info='Approx. '+number(energy.total)+' kcal · '+number(protein.total)+' g protein · '+number(iron.total)+' mg iron · '+number(c.total)+' mg vitamin C'+(energy.missing||protein.missing?' · incomplete composition':'');
  return '<div class="na-weekday"><h4>'+DAYS[i]+' <span style="font-weight:500;color:#64816b;font-size:11px">'+esc(info)+'</span></h4>'
  +SLOTS.map(slot=>{
    const meal=d[slot],parts=meal.parts.map(p=>{const f=F_BY_ID[p.id];return esc(f?.name||p.id)+' '+number(p.g)+'g'}).join(' · ');
    return '<div class="na-recipe"><div class="na-recipe-label">'+SLABEL[slot]+'</div><div><strong>'+esc(meal.title)+'</strong><p>'+esc(meal.method)+'</p><p>'+parts+'</p></div><div class="na-swaps"><button data-ai-swap="'+i+':'+slot+'">↻ Replace</button><button data-ai-swapai="'+i+':'+slot+'">✦ AI swap</button></div></div>';
  }).join('')+'</div>';
 }).join('');
 const groceries=shopping();
 summary.innerHTML='<div class="na-kpi"><b>'+plan.length+' days</b>28 eating occasions</div><div class="na-kpi"><b>'+number(totalE/7)+' kcal/day</b>estimated mean'+(missingE?' · partial':'')+'</div><div class="na-kpi"><b>'+number(totalP/7)+' g/day</b>protein mean (known data)</div><div class="na-kpi"><b>'+groceries.length+' ingredients</b>single-person grocery list</div>';
 list.innerHTML=groceries.map(x=>'<div class="na-food-row"><label><input type="checkbox" data-ai-check="'+esc(x.id)+'" '+(checked[x.id]?'checked':'')+'/><span>'+esc(x.label)+' <small style="color:#8a948a">('+number(x.used)+' g used)</small></span></label><b>'+weight(x.grams)+'</b></div>').join('');
 where.querySelectorAll('[data-ai-swap]').forEach(b=>b.onclick=()=>{const [i,k]=b.dataset.aiSwap.split(':');swap(+i,k,false)});
 where.querySelectorAll('[data-ai-swapai]').forEach(b=>b.onclick=()=>{const [i,k]=b.dataset.aiSwapai.split(':');swap(+i,k,true)});
 list.querySelectorAll('[data-ai-check]').forEach(x=>x.onchange=()=>{checked[x.dataset.aiCheck]=x.checked;save()});
}
function exportCSV(){
 if(!plan){banner('Generate a plan first.',true);return}
 const rows=[['Aisle','Food','Used edible g','Estimated purchase g','Purchase kg','Checked']];
 for(const p of shopping())rows.push([p.category,p.label,p.used,p.grams,(p.grams/1000).toFixed(3),checked[p.id]?'Yes':'No']);
 const csv='\ufeff'+rows.map(row=>row.map(cell=>'"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='nutriatlas_ai_week_shopping.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function resetFromCloud(){
 try{const stored=JSON.parse(localStorage.getItem(AI_KEY)||'null');plan=stored?.days?.length===7?stored.days:null;checked=stored?.checked||{};source=stored?.source||'none';
 const pr=JSON.parse(localStorage.getItem(PREF_KEY)||'null');if(pr?.cuisine)prefs=pr;}catch{plan=null;checked={}}
 updatePrefInputs();render();
}
function updatePrefInputs(){
 for(const [id,v] of [['naAiCuisine',prefs.cuisine],['naAiGoal',prefs.goal],['naAiTime',prefs.minutes],['naAiPantry',prefs.pantry],['naAiDislike',prefs.dislike]]){const e=el('#'+id);if(e)e.value=v??''}
 document.querySelectorAll('#naAiAllergy input').forEach(x=>x.checked=(prefs.allergies||[]).includes(x.value));
}
function initPlanner(){
 const tabs=el('.navtabs'),button=document.createElement('button');button.className='tab';button.dataset.tab='ai-kitchen';button.textContent='✦ AI Kitchen';
 tabs.insertBefore(button,tabs.children[3]||null);
 const section=document.createElement('section');section.id='ai-kitchen';section.className='section';
 section.innerHTML='<div class="na-ai-hero"><div><div style="font-size:12px;letter-spacing:1.6px;color:#bce3c5">NUTRIATLAS STUDIO · PERSONALIZED FOOD PLANNING</div><h1>A different week, built for you.</h1><p>Tell us how you like to eat. Generate 28 meals, swap any one dish, and see exact ingredient grams for your shopping list. AI recipe ideas and local nutrition calculations stay separate.</p></div><div style="font-size:50px;align-self:center">✳</div></div>'
 +'<div class="na-ai-wrap"><div class="na-ai-panel"><h3>Your kitchen preferences</h3><p>Used for this week and saved on this device. Cloud sync follows your NutriAtlas account.</p><label for="naAiCuisine">Cuisine</label><select id="naAiCuisine"><option value="tunisian">Tunisian favorites</option><option value="mediterranean">Mediterranean</option><option value="mixed">A variety of both</option></select><label for="naAiGoal">Prioritize</label><select id="naAiGoal"><option value="balanced">Balanced variety</option><option value="protein">Protein</option><option value="fiber">Fiber</option><option value="iron">Iron</option><option value="budget">Economical ingredients</option></select><label for="naAiTime">Max cooking time</label><select id="naAiTime"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select><label for="naAiPantry">Ingredients already at home</label><textarea id="naAiPantry" rows="2" maxlength="200" placeholder="Tomatoes, couscous, lentils…"></textarea><label for="naAiDislike">Foods or dishes to avoid</label><textarea id="naAiDislike" rows="2" maxlength="160" placeholder="For example: no mushrooms"></textarea><label>Exclude allergens / ingredient groups</label><div id="naAiAllergy" style="display:grid;grid-template-columns:1fr 1fr;gap:7px 12px">'+Object.keys(BANS).map(k=>'<label style="display:flex;align-items:center;gap:6px;margin:2px 0;font-weight:500"><input type="checkbox" value="'+k+'" style="width:auto"/>'+k+'</label>').join('')+'</div><div class="na-ai-buttons"><button id="naAiCreate" class="primary">✦ Generate with free-tier AI</button><button id="naAiSmart">↻ Smart Mix · no API needed</button><button id="naAiExport">↓ Download shopping CSV</button></div><div id="naAiMessage" aria-live="polite"></div><p class="na-ai-disclaimer">AI generation requires sign-in and a free GroqCloud API key stored privately in Supabase. Free-tier usage is rate-limited; a paid upgrade is not required. Smart Mix is an offline recipe algorithm, not generative AI. Meal composition is illustrative and must be checked for allergies and safety.</p></div><div><div id="naAiSummary" class="na-ai-summary"></div><div class="na-ai-panel" style="margin-bottom:16px"><h3>Your seven-day menu</h3><p>Replace one recipe without regenerating other days. Customize chicken/beef/lamb/fish counts in Weekly plan & shopping before using Smart Mix.</p><div id="naAiResults"></div></div><div class="na-ai-panel"><h3>Buy once for the week</h3><p>One person · grams / kilograms · adjustable cooked-to-purchase assumptions from Weekly Kitchen. Figures are estimates, not pack sizes.</p><div id="naAiGroceries" class="na-food-list"></div></div></div></div>';
 el('main.main').appendChild(section);
 updatePrefInputs();render();
 el('#naAiCreate').onclick=()=>generate('week');
 el('#naAiSmart').onclick=()=>generate('smart');
 el('#naAiExport').onclick=exportCSV;
 window.addEventListener('nutriatlas:cloudloaded',resetFromCloud);
 window.addEventListener('nutriatlas:cleared',resetFromCloud);
}
document.addEventListener('DOMContentLoaded',()=>{initAuth();initPlanner();route()});
})();
