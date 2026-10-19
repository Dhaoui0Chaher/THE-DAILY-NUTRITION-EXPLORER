/* NutriAtlas — public live recipes, distinct from quantified nutrition plans. */
(()=>{
'use strict';
const SOURCE='https://www.themealdb.com/api/json/v1/1/';
const q=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validImage(value){
 try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)themealdb\.com$/i.test(u.hostname)?u.href:null}catch{return null}
}
function ingredients(item){
 let a=[];
 for(let i=1;i<=20;i++){
  const name=String(item['strIngredient'+i]||'').trim();
  const amount=String(item['strMeasure'+i]||'').trim();
  if(name)a.push({name:name.slice(0,70),amount:amount.slice(0,60)});
 }
 return a;
}
function card(meal){
 if(!meal||!/^\d+$/.test(String(meal.idMeal||'')))return '';
 const photo=validImage(meal.strMealThumb);
 const info=ingredients(meal);
 const meta=[meal.strArea,meal.strCategory].filter(Boolean).map(v=>escape(String(v).slice(0,60))).join(' · ');
 const summary=String(meal.strInstructions||'').trim().slice(0,1800);
 return '<article class="na-live-recipe">'+(photo?'<img loading="lazy" referrerpolicy="no-referrer" src="'+escape(photo)+'" alt="'+escape(meal.strMeal)+'">':'')+
 '<div class="na-live-content"><div class="na-live-meta">'+meta+'</div><strong>'+escape(String(meal.strMeal||'Recipe').slice(0,120))+'</strong><p class="na-live-ingredients"><b>Ingredients:</b> '+info.map(x=>escape((x.amount?x.amount+' ':'')+x.name)).join(' · ')+'</p>'+
 '<details><summary>Cooking instructions</summary><p>'+escape(summary||'See original recipe.')+'</p></details></div></article>';
}
let busy=false;
async function queryAPI(kind,value){
 if(busy)return;
 const btns=[q('#naLiveSearch'),q('#naLiveRandom')],out=q('#naLiveResult'),status=q('#naLiveStatus');
 busy=true;btns.forEach(b=>b.disabled=true);status.textContent='Loading new recipes…';
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const path=kind==='search'?'search.php?s='+encodeURIComponent(value.slice(0,60)):'random.php';
  const res=await fetch(SOURCE+path,{signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!res.ok)throw Error('Recipe service HTTP '+res.status);
  const json=await res.json();
  const meals=Array.isArray(json.meals)?json.meals.slice(0,8):[];
  if(!meals.length){out.innerHTML='';status.textContent='No matches. Try a simpler ingredient or dish name.';return}
  out.innerHTML=meals.map(card).join('');
  status.textContent=meals.length+' recipe'+(meals.length===1?'':'s')+' from TheMealDB · recipe inspiration only';
 }catch(e){
  status.textContent='Live recipes are unavailable at the moment. Try again later; your offline meal planner still works.';
 }finally{clearTimeout(timeout);busy=false;btns.forEach(b=>b.disabled=false)}
}
function init(){
 const target=q('#naAiResults');if(!target)return;
 const section=document.createElement('section');section.className='na-ai-panel na-live-panel';
 section.innerHTML='<h3>Explore live recipes <span class="na-live-pill">Free recipe API</span></h3>'+
 '<p>Find dishes beyond the starter library: exact ingredient descriptions and cooking instructions from <a href="https://www.themealdb.com/" target="_blank" rel="noopener noreferrer">TheMealDB</a>. Nutrient totals are <strong>not estimated</strong> from these recipes because the source measurements are not standardized in grams.</p>'+
 '<div class="na-live-tools"><input type="search" id="naLiveQuery" maxlength="60" placeholder="Search chicken, pasta, shakshuka…"/>'+
 '<button type="button" id="naLiveSearch">Search recipes</button><button type="button" id="naLiveRandom">Surprise me ↻</button></div>'+
 '<div id="naLiveStatus" role="status" style="margin:11px 0;color:#496b54;font-size:12px">Search an ingredient or discover a surprise recipe.</div>'+
 '<div id="naLiveResult" class="na-live-results"></div><p class="na-ai-disclaimer">TheMealDB test key 1 is for development/educational use. Check recipes for allergens; ingredient portions are not added to the NutriAtlas shopping list without verified gram equivalents.</p>';
 const right=target.closest('.na-ai-panel');right?.parentNode?.appendChild(section);
 q('#naLiveSearch').onclick=()=>queryAPI('search',q('#naLiveQuery').value.trim());
 q('#naLiveRandom').onclick=()=>queryAPI('random','');
 q('#naLiveQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();queryAPI('search',q('#naLiveQuery').value.trim())}});
}
document.addEventListener('DOMContentLoaded',init);
})();