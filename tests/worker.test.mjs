import test from 'node:test';import assert from 'node:assert/strict';
let stored={},listener,tabs=[],nextId=1,reads=[];
globalThis.chrome={storage:{local:{get:async key=>structuredClone(stored),set:async value=>{stored=structuredClone({...stored,...value})},remove:async key=>{delete stored[key]}}},tabs:{query:async()=>tabs,create:async p=>{const t={id:nextId++,url:p.url,status:'complete'};tabs.push(t);return t},get:async id=>tabs.find(t=>t.id===id),update:async(id,p)=>Object.assign(tabs.find(t=>t.id===id),p),remove:async id=>{tabs=tabs.filter(t=>t.id!==id)}},scripting:{executeScript:async()=>[{result:reads.shift()||{acted:true}}]},runtime:{onMessageExternal:{addListener:fn=>{listener=fn}}}};
await import('../extension/worker.js');
const params={query:'プリウス',area:'関東',budget:100,km:12,score:4,limit:3,maxPages:3,minComps:3,priceBasis:'unknown'};
const send=(op,extra={},url='http://localhost:4173/')=>new Promise(resolve=>listener({v:1,op,...extra},{url},resolve));
test('external origin boundary and serialized job recovery',async()=>{
 assert.equal((await send('start',{params},'https://evil.example/')).ok,false);
 assert.equal((await send('start',{params})).data.status,'running');
 assert.equal((await send('start',{params})).ok,false);
 await send('tick');assert.equal(stored.job.phase,'search');
 reads.push({auth:true});assert.equal((await send('tick')).data.status,'paused');
 await send('resume');assert.equal(stored.job.phase,'search');
 await send('tick');assert.equal(stored.job.phase,'read');
 reads.push({rows:[],url:'https://taacaa.jp/app/freeword/TextSearch.do',empty:true,next:false,query:'wrong'});
 assert.match((await send('tick')).data.message,/一致/);
 await send('resume');stored.job.working=true;const stalled=await send('tick');assert.equal(stalled.data.status,'paused');
 await send('cancel');assert.equal(stored.job.status,'cancelled');await send('clear');assert.equal(stored.job,undefined);
});
test('CIS not open pauses without inventing results, closing tab allows resume',async()=>{
 await send('start',{params});stored.job.tasks=[{source:'sell',query:'プリウス ZVW50'}];tabs=[];
 const r=await send('tick');assert.equal(r.data.status,'paused');assert.match(r.data.message,/CISにログイン/);assert.equal(r.data.result,undefined);
 await send('resume');assert.equal(stored.job.phase,'open');await send('cancel');
});
