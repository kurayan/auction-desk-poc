import test from 'node:test';import assert from 'node:assert/strict';
import {screen,parseListingCache,classify} from '../lib/batch-screen.js';
const cfg={auctionDate:'2026-11-16',asOf:'2026-11-14T12:00:00Z',priceBasis:'assumed-same'};
const lot=(id='1')=>({id,lot:id,auctionDate:cfg.auctionDate,venue:'JU東京',name:'アクア',model:'NHP10',grade:'S',year:2018,km:50000,score:'4',category:'passenger',status:'upcoming',startPrice:0});
const comps=()=>['buy','sell'].flatMap(side=>Array.from({length:3},(_,i)=>({...lot(String(i)),side,auctionDate:'2026-11-10',observedAt:'2026-11-14T10:00:00Z',status:'sold',price:side==='buy'?900000:800000,market:side==='sell'?'USS':'TC',period:'past4events'})));
test('all rows accounted for; negative spread ranked; budget uses estimate not start',()=>{
 const rows=[lot(),{...lot('2'),category:'commercial'},{...lot('3'),model:'UNKNOWN'},{...lot('4'),category:'unknown'}];
 const r=screen(rows,comps(),cfg);assert.deepEqual(r.counts,{total:4,calculated:1,excluded:1,insufficient:2});assert.equal(r.top5[0].spread,-100000);assert.equal(r.top5[0].buy.median,900000);
});
test('zero and losses are ranked in descending order, maximum five; input unchanged',()=>{
 const lots=Array.from({length:7},(_,i)=>({...lot(String(i)),grade:String(i),name:['アクア','ノート','フィット','プリウス','セレナ','タント','シエンタ'][i]}));const evidence=lots.flatMap((l,i)=>comps().map(c=>({...c,grade:l.grade,lot:`${l.id}-${c.lot}`,price:c.side==='buy'?900000:900000-i*10000})));
 const r=screen(lots,evidence,cfg);assert.deepEqual(r.top5.map(r=>r.spread),[0,-10000,-20000,-30000,-40000]);assert.equal(lots[0].grade,'0');
});
test('duplicate, conflicting, stale, unsold and unknown identity evidence cannot qualify',()=>{
 const cs=comps();for(const bad of [[cs[0],cs[0],cs[0]],cs.map(c=>({...c,observedAt:'2026-10-01T00:00:00Z'})),cs.map(c=>({...c,lot:null})),cs.map(c=>({...c,status:'other'})),cs.map(c=>({...c,mileageFlag:'*'}))])assert.equal(screen([lot()],bad,cfg).counts.calculated,0);
 const r=screen([lot()],cs.concat({...cs[0],price:1}),cfg);assert.equal(r.cache.conflicts.length,1);assert.equal(r.counts.calculated,0);
});
test('unknown price basis, grade mismatch, foreign market, special score remain insufficient',()=>{
 assert.equal(screen([lot()],comps(),{...cfg,priceBasis:'unknown'}).counts.calculated,0);
 for(const change of [{grade:'G'},{market:'提携'},{score:'R'},{period:'unknown'},{observedAt:'2026-11-15T00:00:00Z'}])assert.equal(screen([lot()],comps().map(c=>({...c,...change})),cfg).counts.calculated,0);
});
test('same query shares a queue group; sold listings and wrong dates are excluded',()=>{
 const r=screen([lot(),lot('2')],[],cfg);assert.equal(r.searchQueue.length,2);assert.equal(r.searchQueue[0].lotIds.length,2);
 assert.equal(screen([{...lot(),status:'sold'},{...lot('2'),auctionDate:'2026-11-17'}],[],cfg).counts.excluded,2);
});
test('raw listing parse retains every row and mileage flags; ambiguous category is not passenger',()=>{
 const row=['','11月16日（月）\nJU東京','A\n00001','30年\n5月','ｱｸｱ\nS\nナビ','NHP10','1500','50千km','082\nパール','FA\nAC','4\nC/B','0','未セリ'];
 const data={observedAt:cfg.asOf,pages:[{page:1,rows:[row,[...row.slice(0,7),'50千km*',...row.slice(8)],['broken']]}]};
 const rows=parseListingCache(data,cfg.auctionDate);assert.equal(rows.length,3);assert.equal(rows[0].year,2018);assert.equal(rows[0].category,'passenger');assert.equal(rows[1].km,null);assert.ok(rows[2].parseError);assert.equal(classify('不明車種'),'unknown');
});

test('only highest spread per normalized vehicle name is ranked',()=>{const rows=[lot('1'),{...lot('2'),name:'ｱｸｱ'}, {...lot('3'),name:'ノート'}];const r=screen(rows,comps(),cfg);assert.equal(r.counts.calculated,3);assert.deepEqual(r.top5.map(x=>x.lot.id),['1','3']);});
