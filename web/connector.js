const $=s=>document.querySelector(s);let job=null,busy=false,connected=false;
$('#extensionId').value=localStorage.getItem('auction-extension-id')||'';
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
const yen=n=>n==null?'—':(n/10000).toLocaleString('ja-JP',{maximumFractionDigits:1})+'万円';
async function send(op,extra={}){const id=$('#extensionId').value.trim();if(!/^[a-p]{32}$/.test(id))throw Error('拡張アイコンに表示される32文字のIDを入力してください');if(!globalThis.chrome?.runtime?.sendMessage)throw Error('拡張を読み込んだChromeでこの画面を開いてください');const r=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('拡張との接続がタイムアウトしました')),20000);chrome.runtime.sendMessage(id,{v:1,op,...extra},r=>{clearTimeout(timer);const err=chrome.runtime.lastError;if(err)reject(Error('拡張に接続できません。ID・拡張の有効状態・許可されたSiteを確認してください'));else resolve(r)})});if(!r?.ok)throw Error(r?.error||'応答を確認できません');return r.data}
function evidence(rows){const table=document.createElement('table'),head=document.createElement('tr');for(const h of ['会場／出品番号','開催日','年式・距離','評価','成約価格'])head.append(text('th',h));table.append(head);for(const r of rows){const tr=document.createElement('tr');for(const v of [`${r.venue} / ${r.lot||'番号未取得'}`,r.auctionDate,`${r.year}年 / ${r.km/10000}万km`,r.score,yen(r.price)])tr.append(text('td',v));table.append(tr)}return table}
function render(){
 $('#connection').textContent=connected?'拡張接続済み':'拡張未接続';$('#connection').classList.toggle('connected',connected);
 $('#start').disabled=!connected||job?.status==='running';$('#resume').disabled=!connected||job?.status!=='paused';$('#cancel').disabled=!connected||!['running','paused'].includes(job?.status);$('#export').disabled=$('#csv').disabled=!job?.result;
 $('#status').textContent=job?.message||'接続後、検索を開始できます。';$('#counts').textContent=job?`出品 ${job.lots.length} / 仕入れ成約 ${job.buy.length} / USS成約 ${job.sell.length}`:'まだ検索していません';
 $('#results').replaceChildren();$('#held').replaceChildren();$('#coverage').replaceChildren();$('#resultCount').textContent=job?.result?`${job.result.ranked.length} 件`:'—';
 if(!job?.result)$('#results').append(text('p','検索完了後、根拠を確認できる候補を表示します。'));
 else if(!job.result.ranked.length)$('#results').append(text('p','根拠の揃った候補は0件です。保留理由と取得範囲をご確認ください。'));
 for(const [i,r] of (job?.result?.ranked||[]).entries()){
  const card=text('article','');card.className='card';card.append(text('h3',`${i+1}. ${r.lot.name} / ${r.lot.model}`),text('p',`${r.lot.venue}　${r.lot.auctionDate}　出品番号 ${r.lot.lot}　${r.lot.year}年 / ${r.lot.km/10000}万km / 評価 ${r.lot.score}`));
  const metrics=document.createElement('div');metrics.className='metrics';for(const [label,value] of [['仕入れ中央値',r.buy.median],['USS中央値',r.sell.median],['価格差（諸経費前）',r.spread]]){const m=document.createElement('div');m.append(text('span',label),text('strong',yen(value)));metrics.append(m)}card.append(metrics,text('p',`仕入れ上側と売却下側の差：${yen(r.conservative)}。${r.inspection}`));const d=document.createElement('details');d.append(text('summary',`比較根拠：仕入れ ${r.buy.n}件 / USS ${r.sell.n}件`),evidence(r.buyEvidence),evidence(r.sellEvidence));card.append(d);$('#results').append(card);
 }
 for(const r of job?.result?.held||[])$('#held').append(text('p',`${r.lot.venue} / ${r.lot.lot||'番号未取得'} / ${r.lot.name}：${r.reason.join('、')}`));
 for(const c of job?.coverage||[])$('#coverage').append(text('div',`${c.source}　${c.query}　${c.page}ページ　${c.count}件　${new Date(c.at).toLocaleString('ja-JP')}`));
}
async function action(fn){if(busy)return;busy=true;try{await fn();render()}catch(e){$('#status').textContent=e.message}finally{busy=false}}
$('#connect').onclick=()=>action(async()=>{const r=await send('ping');connected=true;localStorage.setItem('auction-extension-id',$('#extensionId').value.trim());job=r.job});
$('#search').onsubmit=e=>{e.preventDefault();action(async()=>{job=await send('start',{params:Object.fromEntries(new FormData(e.target))})})};
for(const op of ['resume','cancel','clear'])$('#'+op).onclick=()=>action(async()=>{job=await send(op)});
setInterval(()=>{if(connected&&job?.status==='running')action(async()=>{job=await send('tick')})},2200);
function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#export').onclick=()=>download(JSON.stringify(job,null,2),'application/json',`auction-${job.id}.json`);
$('#csv').onclick=()=>{const rows=[['判定','会場','開催日','出品番号','車名','型式','仕入れ中央値円','USS中央値円','差額円','理由'],...[...job.result.ranked,...job.result.held].map(r=>[r.status,r.lot.venue,r.lot.auctionDate,r.lot.lot,r.lot.name,r.lot.model,r.buy?.median,r.sell?.median,r.spread,r.reason.join(' / ')])];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`auction-${job.id}.csv`)};
render();if($('#extensionId').value)$('#connect').click();
