import {validate,parseTC,parseCIS,compare,dedupe,eligible} from './core.js';
import {pageAction} from './adapter.js';
const SITE='https://auction-desk-prototype-261111.leafycycle4.chatgpt.site';
const TOP='https://taacaa.jp/app/mypage/MypageTop.do?ncheckflg=1';
let queue=Promise.resolve();
const save=j=>chrome.storage.local.set({job:j});
const get=async()=> (await chrome.storage.local.get('job')).job;
const call=async(id,op,arg)=>{
 const tab=await chrome.tabs.get(id);if(tab.status!=='complete')return {pending:true};
 if(!/^https:\/\/(taacaa\.jp|ssl\.cis6200\.jp)\//.test(tab.url||''))throw Error('検索タブが参照元以外へ移動しました');
 const out=await chrome.scripting.executeScript({target:{tabId:id},func:pageAction,args:[op,arg||{}]});return out[0].result;
};
function pause(j,message){j.status='paused';j.message=message;return save(j)}
async function finishTask(j){j.task++;j.phase='open';j.page=0;j.fingerprint=null;delete j.tabId;await save(j)}
async function tick(j){
 if(!j||j.status!=='running')return j;
 if(j.working){await pause(j,'前回の画面操作が中断されました。参照元タブを確認して再開してください');return j}
 const t=j.tasks[j.task];
 if(!t){
  if(!j.cisAdded){const models=[...new Set(j.lots.filter(r=>eligible(r,j.params)).map(r=>r.model))].slice(0,4);j.tasks.push(...models.map(model=>({source:'sell',query:j.params.query+' '+model})));j.cisAdded=true;await save(j);if(models.length)return j}
  j.result=compare(j.lots,j.buy,j.sell,j.params);j.status='done';j.message='収集終了。取得範囲内の条件付き候補です';j.finishedAt=new Date().toISOString();await save(j);return j;
 }
 try{
  j.message=`${t.source==='sell'?'CIS':t.source==='buy'?'TC成約':'TC出品'}：${t.query} / ${j.page+1}ページ`;
  if(j.phase==='open'){
   let url=TOP;
   if(t.source==='sell'){
    const tabs=await chrome.tabs.query({url:'https://ssl.cis6200.jp/*'});url=null;
    for(const tab of tabs){if(/\/market\/model\/modelSch\.aspx/i.test(tab.url)){url=tab.url;break}const d=await call(tab.id,'discoverCIS');if(d.url){url=d.url;break}}
    if(!url){await pause(j,'ChromeでCISにログインし、相場検索を開いてから再開してください');return j}
   }
   j.searchUrl=url;const tab=await chrome.tabs.create({url,active:false});j.tabId=tab.id;j.owned.push(tab.id);j.phase='search';j.attempts=0;
  } else if(j.phase==='search'){
   const r=await call(j.tabId,t.source==='sell'?'cisSearch':'tcSearch',t);
   if(r.auth){await pause(j,'検索タブでログインを完了して再開してください');return j}
   if(r.unsupported)throw Error(r.message);
   if(!r.pending){j.phase='read';j.attempts=0}
  } else if(j.phase==='detailWait'){
   const tabs=await chrome.tabs.query({});const tab=tabs.find(x=>x.openerTabId===j.tabId&&!j.beforePopup.includes(x.id));
   if(!tab){if(++j.attempts>8)throw Error('詳細画面が開きません。ポップアップ設定と検索タブを確認してください')}
   else {
    if(!j.owned.includes(tab.id))j.owned.push(tab.id);
    const d=await call(tab.id,'readDetail');
    if(d.auth){await pause(j,'詳細タブのログインが切れました');return j}
    if(!d.pending){const row=j.pendingRows[j.detailIndex];row.lot=d.lot;row.auctionDate=d.auctionDate||row.auctionDate;row.detailVerified=!!d.lot;await chrome.tabs.remove(tab.id);j.detailIndex++;j.phase='details';j.attempts=0}
   }
  } else if(j.phase==='details'){
   if(j.detailIndex>=j.pendingRows.length){j.lots=dedupe([...j.lots,...j.pendingRows]);j.phase='advance'}
   else {const row=j.pendingRows[j.detailIndex];if(!row.detailRef){j.detailIndex++}else{j.beforePopup=(await chrome.tabs.query({})).map(x=>x.id);j.working=true;await save(j);await call(j.tabId,'detail',{ref:row.detailRef});j.working=false;j.phase='detailWait';j.attempts=0}}
  } else if(j.phase==='read'){
   const r=await call(j.tabId,t.source==='sell'?'readCIS':'readTC');
   if(r.auth){await pause(j,'検索タブで再ログインしてください。再開時は同じ検索をやり直し、重複を除外します');return j}
   if(!r.pending){
    if(t.source!=='sell' && r.query && r.query.normalize('NFKC').trim()!==t.query.normalize('NFKC').trim())throw Error('結果画面の検索語が依頼と一致しません');
    if(t.source==='buy'&&!/SobaSearch/i.test(r.url||''))throw Error('仕入れ成約の検索画面を確認できません');
    if(t.source==='listing'&&!/TextSearch/i.test(r.url||''))throw Error('出品検索画面を確認できません');
    if(t.source==='sell'&&!r.periodVerified)throw Error('CISの「過去4開催」を確認できません。検索条件を確認してください');
    if(!r.rows.length&&!r.empty){if(++j.attempts>8)throw Error('結果の表を読み取れません。画面変更または検索条件を確認してください')}
    else {
     const fp=JSON.stringify(r.rows);if(fp===j.fingerprint)throw Error('同じ結果ページが続いたため停止しました');
     j.fingerprint=fp;j.hasNext=r.next;j.attempts=0;j.page++;j.coverage.push({source:t.source,query:t.query,page:j.page,count:r.rows.length,at:new Date().toISOString(),url:r.url});
     const rows=(t.source==='sell'?parseCIS(r.rows):parseTC(r.rows,t.source)).map(x=>({...x,sourceUrl:r.url,collectedAt:new Date().toISOString()}));
     if(t.source==='listing'){j.pendingRows=rows.filter(x=>eligible(x,j.params)).slice(0,20);j.detailIndex=0;j.phase='details'}
     else {j[t.source]=dedupe([...j[t.source],...rows]);j.phase='advance'}
    }
   }
  } else if(j.phase==='advance'){
   if(!j.hasNext||j.page>=j.params.maxPages){await finishTask(j);return j}
   j.working=true;await save(j);const r=await call(j.tabId,'next');j.working=false;if(r.end){await finishTask(j);return j}j.phase='read';j.attempts=0;
  }
  await save(j);
 }catch(e){j.working=false;await pause(j,e.message)}return j;
}
async function handle(m,sender){
 const origin=sender.url?new URL(sender.url).origin:'';
 if(![SITE,'http://localhost:4173'].includes(origin))throw Error('この画面からの接続は許可されていません');
 if(m?.v!==1)throw Error('接続バージョンが違います');
 let j=await get();
 if(m.op==='ping')return {version:'0.2.0',job:j||null};
 if(m.op==='start'){
  if(j?.status==='running')throw Error('実行中です。中止してから開始してください');
  const params=validate(m.params);if(params.area!=='関東'||!/^プリウス(?:\s+[A-Z0-9-]+)?$/.test(params.query))throw Error('このPoCは関東／プリウス（型式追加可）に対応しています');
  const tasks=['listing','buy'].flatMap(source=>['TAA関東','JU神奈川'].map(v=>({source,query:v+' '+params.query})));
  j={id:crypto.randomUUID(),status:'running',params,tasks,task:0,phase:'open',page:0,lots:[],buy:[],sell:[],coverage:[],owned:[],createdAt:new Date().toISOString(),message:'開始待ち'};await save(j);return j;
 }
 if(m.op==='tick')return tick(j);
 if(m.op==='status')return j||null;
 if(m.op==='resume'&&j?.status==='paused'){j.status='running';j.working=false;j.phase='search';j.attempts=0;j.fingerprint=null;j.page=0;if(!j.tabId)j.phase='open';else {try{await chrome.tabs.update(j.tabId,{url:j.searchUrl||TOP})}catch{j.phase='open'}}await save(j);return j}
 if(m.op==='cancel'&&j){j.status='cancelled';j.message='中止しました';await save(j);return j}
 if(m.op==='clear'){if(j?.status==='running')throw Error('中止後に消去してください');await chrome.storage.local.remove('job');return null}
 throw Error('未対応の依頼');
}
chrome.runtime.onMessageExternal.addListener((m,sender,reply)=>{queue=queue.then(()=>handle(m,sender)).then(data=>reply({ok:true,data}),e=>reply({ok:false,error:e.message}));return true});
