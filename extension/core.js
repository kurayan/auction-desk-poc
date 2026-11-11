export const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　]+/g,' ').trim();
export const number=s=>{const n=Number(String(s??'').replace(/,/g,''));return Number.isFinite(n)&&String(s??'').trim()!==''?n:null};
export function year(s){s=norm(s);const m=s.match(/(H|R)?(\d{1,4})/);if(!m)return null;const n=+m[2];return n>1900?n:(m[1]==='R'||n<10?2018:1988)+n}
export function grade(s){return norm(s).replace(/^プリウス(?:\s*5D)?\s*\/?\s*/,'').replace(/[・･\sー-]/g,'').toUpperCase()}
export function color(s){s=norm(s).replace(/\s/g,'');return /パール/.test(s)?'パール':/シルバー/.test(s)?'シルバー':/クロ|ブラック|黒/.test(s)?'黒':/シロ|ホワイト|白/.test(s)?'白':s}
export const kanto=/関東|東京|横浜|神奈川|埼玉|群馬|栃木|茨城|千葉/;
export function validate(p){
 const q=norm(p.query);if(!q||q.length>60||/[<>\n\r]/.test(q))throw Error('車種・型式を60文字以内で指定してください');
 if(!['関東','全国'].includes(p.area))throw Error('対応エリアは関東／全国です');
 const c={query:q,area:p.area,budget:+p.budget,km:+p.km,score:+p.score,limit:+p.limit,maxPages:+p.maxPages||8,minComps:+p.minComps||3,priceBasis:p.priceBasis||'unknown',period:4};
 for(const [k,min,max] of [['budget',1,1000],['km',1,50],['score',3,5],['limit',1,20],['maxPages',1,12],['minComps',2,10]])if(!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw Error('条件値が範囲外です: '+k);
 if(!['unknown','vehicle-ex-tax','vehicle-inc-tax'].includes(c.priceBasis))throw Error('価格基準が不正です');return c;
}
export function parseTC(rows,source){
 return rows.map(({cells,head,detailRef,lot,auctionDate})=>{
  const c=cells.map(norm), t=c.join(' '), name=norm(head);const model=t.match(/\b[A-Z]{2,5}\d{1,4}[A-Z]?\b/)?.[0];
  const km=t.match(/([\d,]+)千km/);const ym=t.match(/(?:TAA\S+|CAA\S+|JU\S+|MIRIVE\S+|アライ\S+|ベイオーク|LAA\S+)\s+(\d{1,2})年/);
  const venue=c[0]?.replace(/^.*?\([月火水木金土日]\)\s*/,'').replace(/^.*?（[月火水木金土日]）\s*/,'').trim();
  const scoreCell=c.find(x=>/^(?:[1-6](?:\.5)?|R|RA|\*)\s+[A-EＣＢＤＥＡ]?\s*\//.test(x));
  const score=scoreCell?.match(/^(\S+)/)?.[1]??null;
  const status=c.find(x=>/^(落札|流れ|未セリ)/.test(x))||'';const sold=status.match(/^落札\s+([\d,]+)/)?.[1]??(source==='buy'&&status==='落札'?c.at(-1):null);
  const modelIndex=c.findIndex(x=>x.includes(model)&&model);const colourCell=c[modelIndex+2]??'';
  return {source,model,grade:grade(name),name,year:year(ym?.[1]??c[1]),km:km?number(km[1])*1000:null,venue,color:color(colourCell.replace(/^\w{3}\s+/,'')),score,interior:scoreCell?.split('/').at(-1)?.trim()??null,status:status.startsWith('落札')?'sold':status.includes('未セリ')?'upcoming':'other',price:source==='buy'&&sold?number(sold)*1000:null,lot:lot||null,auctionDate:auctionDate||c[0]?.match(/^\S+/)?.[0],detailRef,raw:{head:name,cells:c},inspectionVerified:false};
 }).filter(x=>x.model&&x.km!==null);
}
export function parseCIS(rows){return rows.filter(c=>c.length===11).map(c=>{c=c.map(norm);const v=c[1].match(/^(\d+)\s+(.+)$/);return {source:'sell',auctionDate:c[0],lot:v?.[1],venue:v?.[2],year:year(c[2]),name:c[3],grade:grade(c[3]),model:c[7].split(' ')[0],km:number(c[5].split(' ')[0])*1000,color:color(c[6]),status:c[8]==='落札'?'sold':'other',price:number(c[9].split(' ')[0])*1000,score:c[10].split(' ')[0],interior:c[10].match(/\(([A-E])\)/)?.[1]??null,raw:{cells:c}}}).filter(r=>r.model&&r.price>0)}
export function dedupe(rows){const seen=new Set();return rows.filter(r=>{const k=r.lot?`${r.source}|${r.venue}|${r.auctionDate}|${r.lot}`:JSON.stringify(r.raw);if(seen.has(k))return false;seen.add(k);return true})}
export function eligible(r,c){return !!r.model&&Number.isFinite(r.year)&&r.km<=c.km*10000&&Number.isFinite(+r.score)&&+r.score>=c.score&&(c.area!=='関東'||kanto.test(r.venue||''))}
export function comparable(a,b){return b.status==='sold'&&b.price>0&&[a.year,b.year,a.km,b.km].every(Number.isFinite)&&a.model===b.model&&a.grade&&a.grade===b.grade&&a.color&&a.color===b.color&&Math.abs(a.year-b.year)<=1&&Math.abs(a.km-b.km)<=20000&&/^[3-5](?:\.5)?$/.test(a.score)&&/^[3-5](?:\.5)?$/.test(b.score)&&Math.abs(+a.score-+b.score)<=0.5}
export function stats(rows){if(!rows.length)return null;const s=rows.map(x=>x.price).sort((a,b)=>a-b);const n=s.length;return {n,low:s[0],high:s[n-1],median:n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2}}
export function compare(lots,buy,sell,c){
 const results=dedupe(lots).filter(r=>r.status==='upcoming'&&eligible(r,c)).map(lot=>{const bc=dedupe(buy).filter(r=>comparable(lot,r)&&(c.area!=='関東'||kanto.test(r.venue||''))),sc=dedupe(sell).filter(r=>comparable(lot,r));const b=stats(bc),s=stats(sc);let reason=[];
 if(!lot.lot||!lot.auctionDate)reason.push('出品識別情報不足');if(!b||b.n<c.minComps)reason.push('仕入れ成約不足');if(!s||s.n<c.minComps)reason.push('USS成約不足');if(c.priceBasis==='unknown')reason.push('価格基準未確認');
 if(b&&b.high>c.budget*10000)reason.push('仕入れ成約上限が予算超過');
 const spread=b&&s?s.median-b.median:null,conservative=b&&s?s.low-b.high:null;
 if(conservative!==null&&conservative<=0)reason.push('価格レンジ重複');
 return {lot,buy:b,sell:s,buyEvidence:bc,sellEvidence:sc,spread:c.priceBasis==='unknown'?null:spread,conservative:c.priceBasis==='unknown'?null:conservative,status:reason.length?'保留':'条件付き候補',reason,inspection:'出品票・装備・機関状態は人の確認が必要'};
 });results.sort((a,b)=>(a.status==='条件付き候補'?0:1)-(b.status==='条件付き候補'?0:1)||(b.conservative??-Infinity)-(a.conservative??-Infinity));return {ranked:results.filter(r=>r.status==='条件付き候補').slice(0,c.limit),held:results.filter(r=>r.status==='保留'),examined:results.length};
}
