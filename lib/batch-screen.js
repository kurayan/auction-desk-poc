// Deterministic, offline screening. Unknown facts never become negative evidence.
import {norm,year,kanto,stats} from '../extension/core.js';
export const key=s=>norm(s).toUpperCase().replace(/[\s・ー－-]/g,'');
const passenger=new Set(['86','BRZ','CX-3','CX-5','CX-8','アクア','アルトラパン','アルト','プリウス','プリウスα','ノート','セレナ','フリード','フィット','ヴィッツ','ヤリス','デミオ','マーチ','スイフト','ソリオ','トール','ルーミー','タンク','シエンタ','ヴォクシー','ノア','エスクァイア','ステップワゴン','オデッセイ','クラウン','マークX','カムリ','ティアナ','エクストレイル','ヴェゼル','ハリアー','ジューク','N-BOX','N-WGN','N-ONE','タント','ムーヴ','ワゴンR','ハスラー','スペーシア','ミラココア','ミライース','ウェイク','キャスト'].map(key));
const commercial=/トラック|ダンプ|冷凍|冷蔵|積載車|ハイエースバン|キャラバン|プロボックス|サクシード|エブリイバン|エブリィバン|ハイゼット|キャリイ|キャリー|アトラス|エルフ|キャンター|デュトロ|ダイナ|トヨエース|クリッパーバン/;
export function classify(name){const n=norm(name);return commercial.test(n)?'commercial':passenger.has(key(n))?'passenger':'unknown'}
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const positive=n=>Number.isFinite(n)&&n>0;
const normalScore=s=>/^(3|3.5|4|4.5|5|6)$/.test(String(s));
export function parseListingCache(data,auctionDate){
 if(!validDate(auctionDate))throw Error('auctionDate must be YYYY-MM-DD');
 if(!Array.isArray(data.pages))throw Error('Expected captured pages');
 const [y,m,d]=auctionDate.split('-').map(Number);
 return data.pages.flatMap(p=>p.rows.map((r,i)=>{
  if(!Array.isArray(r)||r.length!==13)return {id:`invalid-${p.page}-${i}`,parseError:'一覧の列構成が不明',raw:r};
  const lines=r[4].split('\n').map(norm),name=lines[0],km=norm(r[7]).match(/^(\d+)千km(?:\s|$)/);
  const parts=r[1].split('\n'),dateOK=norm(parts[0]).startsWith(`${m}月${d}日`);
  const lot=norm(r[2]).split(' ').at(-1),venue=norm(parts.slice(1).join(' '));
  return {id:`${auctionDate}|${venue}|${lot}`,auctionDate,venue,lot,name,model:norm(r[5]),grade:lines[1]||'',year:year(r[3]),km:km?+km[1]*1000:null,score:norm(r[10]).split(' ')[0],color:norm(r[8]),shift:norm(r[9]).split(' ')[0],category:classify(name),status:norm(r[12])==='未セリ'?'upcoming':'other',observedAt:data.observedAt,startPrice:/^\d+$/.test(r[11])?+r[11]*1000:null,parseError:dateOK?null:'開催日の一致を確認できない',raw:r};
 }));
}
export function screen(lots,comps,options){
 const cfg={budget:1000000,minComps:3,maxAgeDays:7,maxSaleAgeDays:35,kmTolerance:20000,yearTolerance:0,scoreTolerance:0.5,priceBasis:'unknown',...options};
 if(!validDate(cfg.auctionDate)||!Number.isFinite(Date.parse(cfg.asOf)))throw Error('Explicit auctionDate and asOf required');
 for(const k of ['budget','minComps','maxAgeDays','maxSaleAgeDays','kmTolerance'])if(!positive(cfg[k]))throw Error(`Invalid ${k}`);
 if(!Number.isInteger(cfg.minComps)||!['unknown','vehicle-ex-tax','vehicle-inc-tax','assumed-same'].includes(cfg.priceBasis))throw Error('Invalid comparison policy');
 for(const k of ['yearTolerance','scoreTolerance'])if(!Number.isFinite(cfg[k])||cfg[k]<0)throw Error(`Invalid ${k}`);
 const now=Date.parse(cfg.asOf),day=86400000,seen=new Map(),conflicts=new Set(),rejected=[];
 const fresh=(t,days)=>Number.isFinite(Date.parse(t))&&now-Date.parse(t)>=0&&now-Date.parse(t)<=days*day;
 for(const c of comps){
  const reasons=[];
  if(!['buy','sell'].includes(c.side)||c.status!=='sold'||!positive(c.price)||!c.lot||!c.venue||!validDate(c.auctionDate))reasons.push('成約価格・出品識別情報不足');
  if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(c.observedAt||'')||!fresh(c.observedAt,cfg.maxAgeDays)||!fresh(c.auctionDate+'T00:00:00+09:00',cfg.maxSaleAgeDays))reasons.push('取得日時・成約日の鮮度不足');
  if(c.side==='sell'&&(c.market!=='USS'||c.period!=='past4events'))reasons.push('USS過去4開催の根拠不足');
  if(!normalScore(c.score)||!Number.isFinite(c.km)||c.km<0||!Number.isInteger(c.year)||!c.model||!c.grade||c.mileageFlag)reasons.push('比較項目不足・距離注記・特殊評価');
  if(reasons.length){rejected.push({id:c.id??null,reasons});continue}
  // A repeated sale imported from several reports counts once. Conflicts count zero.
  const id=[c.side,c.venue,c.auctionDate,c.lot].join('|');
  if(seen.has(id)){
   const old=seen.get(id);if(['price','year','km','score','model','grade','priceBasis'].some(k=>old[k]!==c[k]))conflicts.add(id);
  }else seen.set(id,{...c,id});
 }
 const index=new Map();for(const [id,c] of seen){if(conflicts.has(id))continue;const k=key(c.model)+'|'+key(c.grade);if(!index.has(k))index.set(k,[]);index.get(k).push(c)}
 const results=[],queue=new Map(),lotSeen=new Map(),listingConflicts=new Set(),listingSignatures=new Map();
 for(const l of lots){const signature=JSON.stringify([l.model,l.grade,l.year,l.km,l.score,l.status,l.category]);if(listingSignatures.has(l.id)&&listingSignatures.get(l.id)!==signature)listingConflicts.add(l.id);else listingSignatures.set(l.id,signature)}
 function demand(lot,reason,side='both'){
  const query={side,model:lot.model||null,grade:lot.grade||null,year:lot.year??null,kmFrom:Number.isFinite(lot.km)?Math.max(0,Math.floor((lot.km-cfg.kmTolerance)/10000)*10000):null,kmTo:Number.isFinite(lot.km)?Math.ceil((lot.km+cfg.kmTolerance)/10000)*10000:null,score:lot.score||null};
  const id=JSON.stringify(query);if(!queue.has(id))queue.set(id,{query,lotIds:[],reasons:[]});const q=queue.get(id);if(!q.lotIds.includes(lot.id))q.lotIds.push(lot.id);if(!q.reasons.includes(reason))q.reasons.push(reason);
 }
 for(const lot of lots){
  const r={lot,status:'insufficient',reasons:[],buy:null,sell:null,spread:null,evidence:{buy:[],sell:[]}};results.push(r);
  if(listingConflicts.has(lot.id)){r.reasons.push('同じ出品IDに矛盾する情報');demand(lot,r.reasons[0],'metadata');continue}
  if(lotSeen.has(lot.id)){r.status='excluded';r.reasons.push('同じ出品IDの重複入力');continue}lotSeen.set(lot.id,lot);
  if(lot.parseError){r.reasons.push(lot.parseError);demand(lot,lot.parseError,'metadata');continue}
  if(lot.status!=='upcoming'||lot.auctionDate!==cfg.auctionDate||!kanto.test(lot.venue||'')||lot.category==='commercial'){
   r.status='excluded';r.reasons.push(lot.category==='commercial'?'商用車':'対象日・関東・未セリ条件外');continue;
  }
  const missing=[];
  if(lot.observedAt&&!fresh(lot.observedAt,cfg.maxAgeDays))missing.push('出品一覧の取得情報が古い');
  if(lot.category!=='passenger')missing.push('乗用車区分未確認');
  if(!lot.lot||!lot.venue||!lot.model||!lot.grade||!Number.isInteger(lot.year)||!Number.isFinite(lot.km)||lot.km<0)missing.push('車両条件不足');
  if(!normalScore(lot.score))missing.push('特殊評価は個別確認');
  if(missing.length){r.reasons.push(...missing);demand(lot,missing.join('・'),'metadata');continue}
  const pool=(index.get(key(lot.model)+'|'+key(lot.grade))||[]).filter(c=>Math.abs(c.year-lot.year)<=cfg.yearTolerance&&Math.abs(c.km-lot.km)<=cfg.kmTolerance&&Math.abs(+c.score-+lot.score)<=cfg.scoreTolerance&&(!lot.drive||!c.drive||lot.drive===c.drive));
  for(const side of ['buy','sell']){
   r.evidence[side]=pool.filter(c=>c.side===side&&(cfg.priceBasis==='assumed-same'||cfg.priceBasis!=='unknown'&&c.priceBasis===cfg.priceBasis));r[side]=stats(r.evidence[side]);
   if(!r[side]||r[side].n<cfg.minComps){r.reasons.push(`${side==='buy'?'仕入れ':'USS'}成約不足`);demand(lot,r.reasons.at(-1),side)}
  }
  if(cfg.priceBasis==='unknown')r.reasons.push('価格基準未確認');
  if(r.reasons.length)continue;
  if(r.buy.median>cfg.budget){r.status='excluded';r.reasons.push('仕入れ予想中央値が予算超過');continue}
  r.status='calculated';r.spread=r.sell.median-r.buy.median;
  r.reasons.push('諸経費・修理費控除前。出品票・故障・装備・色・駆動の確認が必要');
  if(cfg.priceBasis==='assumed-same')r.reasons.push('両社価格基準が同じと仮定した暫定試算');
  if(r.buy.high>cfg.budget)r.reasons.push('仕入れ参考上限は予算超過');
 }
 const counts={total:results.length,calculated:0,excluded:0,insufficient:0};for(const r of results)counts[r.status]++;
 const top5=results.filter(r=>r.status==='calculated').sort((a,b)=>b.spread-a.spread||a.lot.id.localeCompare(b.lot.id)).slice(0,5);
 return {schemaVersion:1,generatedAt:cfg.asOf,policy:cfg,counts,results,top5:top5.map((r,i)=>({rank:i+1,...r})),searchQueue:[...queue.values()].sort((a,b)=>b.lotIds.length-a.lotIds.length),cache:{input:comps.length,usable:seen.size-conflicts.size,rejected:rejected.length,conflicts:[...conflicts],rejections:rejected}};
}
