const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function validDate(s){return typeof s==='string'&&datePattern.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s}
export function japanDate(timestamp){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp))}
function string(v,key,max=4000){if(typeof v!=='string'||v.length>max)throw Error(`Invalid ${key}`);return v}
function money(v,key){if(v!==null&&(!Number.isFinite(v)||v<0))throw Error(`Invalid ${key}`)}
export function validateReport(r){
 if(!r||r.schemaVersion!==1||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(r.id))throw Error('Invalid report identity');
 if(!validDate(r.researchedOn))throw Error('Invalid research date');
 if(r.researchedAt!==null&&(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.researchedAt)||isNaN(Date.parse(r.researchedAt))||japanDate(r.researchedAt)!==r.researchedOn))throw Error('Research timestamp must match the Japan date');
 for(const key of ['title','status','summary','provenance'])string(r[key],key);
 if(!r.title.trim())throw Error('Title is required');
 if(!r.conditions||Array.isArray(r.conditions)||typeof r.conditions!=='object')throw Error('Invalid conditions');
 for(const [k,v] of Object.entries(r.conditions)){string(k,'condition key',100);string(v,'condition value',1000)}
 for(const k of ['limitations','coverage']){if(!Array.isArray(r[k])||r[k].length>200)throw Error(`Invalid ${k}`);r[k].forEach(v=>string(v,k))}
 if(!Array.isArray(r.candidates)||r.candidates.length>200)throw Error('Invalid candidates');
 if(r.kind!==undefined&&!['valuation','purchase-search'].includes(r.kind))throw Error('Invalid report kind');
 if(r.kind==='valuation'){
  const v=r.valuation;
  if(!v||typeof v!=='object')throw Error('Invalid valuation');
  for(const k of ['name','venue','lot','auctionDate','vehicle','score','status','reason'])string(v[k],k);
  for(const k of ['km','priceLow','priceCenter','priceHigh'])money(v[k],k);
  if(v.priceLow>v.priceCenter||v.priceCenter>v.priceHigh)throw Error('Invalid valuation range');
  if(!Array.isArray(v.evidence)||!v.evidence.length)throw Error('Missing valuation evidence');
  for(const e of v.evidence){for(const k of ['side','date','venue','lot','vehicle','score','note'])string(e[k],k);money(e.km,'km');money(e.price,'price')}
 }
 for(const c of r.candidates){
  for(const k of ['name','venue','lot','auctionDate','vehicle','score','status','reason','nextAction'])string(c[k],k);
  if(c.sourceUrl!==undefined){const u=new URL(string(c.sourceUrl,'sourceUrl'));if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid source URL')}
  if(c.estimate!==undefined){if(c.estimate.kind!=='provisional')throw Error('Invalid estimate type');for(const k of ['buy','sell']){money(c.estimate[k],k);if(c.estimate[k]===null)throw Error('Estimate required')}string(c.estimate.note,'estimate note');if(Math.abs(c.spread-(c.estimate.sell-c.estimate.buy))>0.01||c.spread===null)throw Error('Estimate spread mismatch')}
  if(c.rank!==null&&(!Number.isInteger(c.rank)||c.rank<1))throw Error('Invalid rank');
  for(const k of ['buyLow','buyHigh','sellLow','sellHigh','km'])money(c[k],k);
  if(c.spread!==null&&!Number.isFinite(c.spread))throw Error('Invalid spread');
  for(const [low,high] of [['buyLow','buyHigh'],['sellLow','sellHigh']])if((c[low]===null)!==(c[high]===null)||(c[low]!==null&&c[low]>c[high]))throw Error('Invalid range');
  if(!Array.isArray(c.evidence)||c.evidence.length>1000)throw Error('Invalid evidence');
  for(const e of c.evidence){for(const k of ['side','date','venue','lot','vehicle','score','note'])string(e[k],k);money(e.price,'price');money(e.km,'km')}
 }
 const allowed=new Set(['schemaVersion','id','researchedOn','researchedAt','title','status','summary','conditions','limitations','coverage','candidates','provenance','kind','valuation']);
 if(Object.keys(r).some(k=>!allowed.has(k)))throw Error('Unexpected report field');
 return r;
}
export function sortRuns(runs){return [...runs].sort((a,b)=>b.researchedOn.localeCompare(a.researchedOn)||(Date.parse(b.researchedAt)||0)-(Date.parse(a.researchedAt)||0)||(Date.parse(b.archivedAt)||0)-(Date.parse(a.archivedAt)||0)||b.id.localeCompare(a.id))}
export function summarize(r){return {id:r.id,researchedOn:r.researchedOn,researchedAt:r.researchedAt,title:r.title,status:r.status,candidateCount:r.kind==='valuation'?1:r.candidates.length}}
