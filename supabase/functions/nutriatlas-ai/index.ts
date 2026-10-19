// NutriAtlas meal planner — authenticated, server-side OpenAI integration.
// Never place OPENAI_API_KEY or SUPABASE_SERVICE_ROLE_KEY in public HTML.
import { createClient } from 'jsr:@supabase/supabase-js@2.58.0';
const URL = Deno.env.get('SUPABASE_URL') || '';
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const ORIGIN = 'https://dhaoui0chaher.github.io';
const ALLOWED = new Set(['https://dhaoui0chaher.github.io','http://localhost:8000','http://127.0.0.1:8000']);
const SLOTS = ['breakfast','lunch','dinner','snack'] as const;
const DIETS = ['all','vegetarian','vegan'] as const;
const GOALS = ['balanced','protein','fiber','iron','budget'] as const;
const CUISINES = ['tunisian','mediterranean','mixed'] as const;
const ALLERGIES = ['nuts','dairy','egg','fish','shellfish','gluten','sesame','soy'] as const;
type Part={id:string,g:number};
type Recipe={day:number,slot:string,title:string,method:string,parts:Part[]};
const cors=(origin:string)=>({
 'Access-Control-Allow-Origin':ALLOWED.has(origin)?origin:ORIGIN,
 'Vary':'Origin',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store'
});
function response(status:number,value:unknown,origin:string){return new Response(JSON.stringify(value),{status,headers:cors(origin)});}
function text(v:unknown,max=180){return typeof v==='string'?v.trim().slice(0,max):'';}
function oneOf<T extends string>(v:unknown,allowed:readonly T[],fallback:T):T{return allowed.includes(v as T)?v as T:fallback;}
const partSchema={type:'object',additionalProperties:false,required:['id','g'],properties:{id:{type:'string'},g:{type:'integer'}}};
const recipeSchema={type:'object',additionalProperties:false,required:['day','slot','title','method','parts'],properties:{
 day:{type:'integer'},slot:{type:'string',enum:[...SLOTS]},title:{type:'string'},method:{type:'string'},parts:{type:'array',items:partSchema}
}};
const schema={type:'object',additionalProperties:false,required:['recipes'],properties:{recipes:{type:'array',items:recipeSchema}}};
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors(origin)});
 if(req.method!=='POST')return response(405,{error:'POST only'},origin);
 if(!ALLOWED.has(origin))return response(403,{error:'Origin not authorized'},origin);
 if(Number(req.headers.get('content-length')||0)>15000)return response(413,{error:'Request too large'},origin);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token||token.length>5000)return response(401,{error:'Please sign in first'},origin);
 if(!URL||!SECRET)return response(503,{error:'Server credentials are not configured'},origin);
 const admin=createClient(URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userResult,error:authError}=await admin.auth.getUser(token);
 const user=userResult?.user;
 if(authError||!user||user.is_anonymous)return response(401,{error:'Session invalid. Sign in again.'},origin);
 if(!OPENAI_KEY)return response(503,{error:'AI provider not configured; use Smart Mix while offline.'},origin);
 let body:any;
 try{body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return response(400,{error:'Invalid JSON body'},origin);}
 const action=oneOf(body.action,['week','swap'] as const,'week');
 const day=Number.isInteger(body.day)&&body.day>=0&&body.day<=6?body.day:0;
 const slot=oneOf(body.slot,SLOTS,'lunch');
 const cuisine=oneOf(body.cuisine,CUISINES,'tunisian');
 const diet=oneOf(body.diet,DIETS,'all');
 const goal=oneOf(body.goal,GOALS,'balanced');
 const minutes=[15,30,45,60].includes(+body.minutes)?+body.minutes:30;
 const excluded=Array.isArray(body.allergies)?body.allergies.filter((x:unknown)=>ALLERGIES.includes(x as typeof ALLERGIES[number])).slice(0,8):[];
 const dislike=text(body.dislike,160).replace(/[\r\n\t]/g,' ');
 const pantry=text(body.pantry,200).replace(/[\r\n\t]/g,' ');
 const allowedFoods=Array.isArray(body.foods)?body.foods.filter((f:any)=>f&&typeof f.id==='string'&&/^[a-z][a-z0-9_-]{0,24}$/.test(f.id)&&typeof f.name==='string'&&f.name.length<70&&DIETS.includes(f.diet)&&!((diet==='vegan'&&f.diet!=='vegan')||(diet==='vegetarian'&&f.diet==='all'))).slice(0,90):[];
 if(allowedFoods.length<10)return response(422,{error:'Ingredient catalogue missing'},origin);
 const ids=new Set(allowedFoods.map((x:any)=>x.id));
 const foodsString=allowedFoods.map((f:any)=>f.id+':'+f.name+':'+f.diet).join(' | ');
 const {data:quota,error:quotaError}=await admin.rpc('nutriatlas_claim_ai_request',{p_user_id:user.id,p_daily_limit:8});
 if(quotaError)return response(503,{error:'AI quota database setup is missing; apply the AI quota migration.'},origin);
 if(!quota)return response(429,{error:'Daily AI request allowance reached (8 per user). Try again tomorrow.'},origin);
 const instructions=[
   'You are an imaginative but careful Tunisian/Mediterranean meal planner for one adult.',
   'Only choose ingredient IDs from the provided catalogue; give food portions in EDIBLE/COOKED grams as identified by the catalogue.',
   'Generate varied realistic single-person meals. Respect diet, allergies, disliked foods, and cooking time.',
   'Return exactly '+(action==='week'?'28 recipes: days 0–6, four slots breakfast lunch dinner snack per day, each exactly once.':'1 recipe: day '+day+', slot '+slot+'.'),
   'Nutrient calculations will happen outside the model. Never invent nutrient numbers, medical claims, or guarantee completeness.',
   'Use common Tunisian groceries and varied local recipes where practical. Each recipe 2–8 ingredients, 5–500g per ingredient; method one short sentence.',
   'Prevent allergen ingredients using the explicit exclusion list even when compatible with the diet. Do not include hidden seasonings as nutrition ingredients.',
   'Food IDs and diets: '+foodsString
 ].join('\n');
 const prompt=JSON.stringify({action,day,slot,cuisine,diet,goal,max_cook_minutes:minutes,avoid_allergies:excluded,dislike,pantry,replace_title:text(body.replace_title,100)});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const resp=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',signal:controller.signal,
   headers:{'Authorization':'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:MODEL,instructions,input:prompt,max_output_tokens:action==='week'?10000:1100,store:false,
    text:{format:{type:'json_schema',name:'nutriatlas_recipes',strict:true,schema}}})
  });
  const raw=await resp.json();
  if(!resp.ok)return response(resp.status===429?429:502,{error:resp.status===429?'AI provider rate limit':'AI provider request failed. Check server model/credits.'},origin);
  const output=(raw.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
  let parsed:any;try{parsed=JSON.parse(output);}catch{return response(502,{error:'AI returned unparseable structured output'},origin);}
  const recipes:Recipe[]=parsed.recipes;
  if(!Array.isArray(recipes)||recipes.length!==(action==='week'?28:1))return response(502,{error:'AI returned incomplete meal schedule'},origin);
  const keySet=new Set<string>();
  for(const r of recipes){
   if(!r||!Number.isInteger(r.day)||r.day<0||r.day>6||!SLOTS.includes(r.slot as typeof SLOTS[number])||typeof r.title!=='string'||r.title.length>100||typeof r.method!=='string'||r.method.length>380||!Array.isArray(r.parts)||r.parts.length<1||r.parts.length>10)return response(502,{error:'Invalid recipe returned'},origin);
   if(action==='swap'&&(r.day!==day||r.slot!==slot))return response(502,{error:'Invalid replacement returned'},origin);
   const key=r.day+'-'+r.slot;if(keySet.has(key))return response(502,{error:'Duplicate meal returned'},origin);keySet.add(key);
   for(const p of r.parts){if(!ids.has(p.id)||!Number.isInteger(p.g)||p.g<1||p.g>700)return response(502,{error:'AI returned unknown ingredient or weight'},origin);}
  }
  return response(200,{recipes,source:'openai',model:MODEL,disclaimer:'Estimated nutrition from the illustrative NutriAtlas food table. Review allergens and recipes independently.'},origin);
 }catch(e){return response(502,{error:'AI service unavailable. Use Smart Mix or try again.'},origin)}
 finally{clearTimeout(timeout)}
});
