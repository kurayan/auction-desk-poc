import {validateReport,sortRuns} from './history-model.js';
const $=s=>document.querySelector(s);
const archive=document.body.dataset.page==='archive';
if(!archive&&location.hash.startsWith('#run='))location.replace('./archive.html'+location.hash);
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value??'';if(cls)e.className=cls;return e};
const yen=n=>n==null?'未算定':(n/10000).toLocaleString('ja-JP',{maximumFractionDigits:1})+'万円';
let runs=[],selected=null,request=0;
const bySpread=items=>[...items].sort((a,b)=>(Number.isFinite(b.spread)?b.spread:-Infinity)-(Number.isFinite(a.spread)?a.spread:-Infinity));
const range=(a,b)=>a==null?'未算定':a===b||b==null?yen(a):`${yen(a)} ～ ${yen(b)}`;
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`記録を読み込めません (${r.status})`);return r.json()}
function drawList(){
 if(!archive)return;
 const filtered=runs.filter(r=>!$('#dateFilter').value||r.researchedOn===$('#dateFilter').value);
 $('#historyCount').textContent=`${runs.length}件`;
 $('#historyList').replaceChildren();let day='';
 for(const r of filtered){
  if(day!==r.researchedOn){day=r.researchedOn;$('#historyList').append(text('h3',day.replaceAll('-',' / '),'day'))}
  const button=document.createElement('button');button.className='historyItem'+(selected?.id===r.id?' selected':'');button.setAttribute('aria-pressed',String(selected?.id===r.id));
  button.append(text('strong',r.title),text('span',`${r.status} · ${r.candidateCount}案件`),text('small',r.researchedAt?new Date(r.researchedAt).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'}):'実行時刻の記録なし'));
  button.onclick=()=>openReport(r.id);$('#historyList').append(button);
 }
 if(!filtered.length)$('#historyList').append(text('p','この日付の調査記録はありません。','empty'));
}
function table(rows){
 const wrap=document.createElement('div');wrap.className='tablewrap';const t=document.createElement('table');const head=document.createElement('tr');
 for(const h of ['区分','開催日','会場・番号','車両条件','走行 / 評価','価格（区分参照）','条件差・注意点'])head.append(text('th',h));t.append(head);
 for(const r of rows){
  const tr=document.createElement('tr');
  for(const v of [r.side,r.date||'日付未記録',`${r.venue||''} / ${r.lot||'番号未記録'}`,r.vehicle||'',`${r.km==null?'不明':(r.km/10000)+'万km'} / ${r.score||'不明'}`,yen(r.price),r.note||''])tr.append(text('td',v));
  if(r.side==='今回の出品（開始価格）'&&r.venue?.includes('TAA')){
   const link=text('a','TAAの出品情報を開く ↗');link.href='https://taacaa.jp/app/preinspection/CarMakerSelect.do';link.target='_blank';link.rel='noopener noreferrer';
   tr.firstElementChild.append(document.createElement('br'),link,document.createElement('br'),text('small','TC-Webで会場・出品番号を指定'));
  }
  t.append(tr);
 }
 wrap.append(t);return wrap;
}
function renderReport(r){
 $('#report').hidden=false;$('#reportTitle').textContent=r.title;$('#reportDate').textContent=`調査実行日 ${r.researchedOn}（日本時間） · ${r.status}`;$('#reportSummary').textContent=r.summary;
 $('#conditions').replaceChildren();for(const [k,v] of Object.entries(r.conditions))$('#conditions').append(text('span',`${k}：${v}`));
 $('#limitations').replaceChildren(text('strong','記録上の未確認事項'));for(const l of r.limitations)$('#limitations').append(text('p',l));$('#limitations').hidden=!r.limitations.length;
 $('#candidateCount').textContent=`${r.candidates.length}件`;$('#candidates').replaceChildren();
 if(!r.candidates.length)$('#candidates').append(text('p','案件が確定していない調査記録です。','empty'));
 for(const c of bySpread(r.candidates)){
  const card=document.createElement('article');card.className='card';card.append(text('h3',`${c.rank?c.rank+'. ':''}${c.name}`),text('p',`${c.venue} / 出品番号 ${c.lot||'未記録'} / 開催日 ${c.auctionDate||'未記録'}`),text('p',`${c.vehicle||''} · ${c.km==null?'走行不明':(c.km/10000)+'万km'} · 評価 ${c.score||'未確認'}`),text('span',c.status,'badge'));
  if(c.sourceUrl){const a=text('a',`${c.name}の出品票を開く ↗`);a.href=c.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';const p=text('p','');p.append(a,text('small','　TC-Webへのログインが必要です'));card.append(p)}
  if(c.estimate)card.append(text('p',c.estimate.note,'notice'));
  const metrics=document.createElement('div');metrics.className='metrics';
  const values=c.estimate?[['暫定仕入れ（中央値）',yen(c.estimate.buy)],['暫定売却（中央値）',yen(c.estimate.sell)],['暫定差額（諸経費・修理費前）',yen(c.spread)]]:[['仕入れ参考成約',range(c.buyLow,c.buyHigh)],['売却参考成約',range(c.sellLow,c.sellHigh)],['価格差（諸経費前）',yen(c.spread)]];
  for(const [label,value] of values){const m=document.createElement('div');m.append(text('span',label),text('strong',value));metrics.append(m)}
  if(c.estimate)card.append(text('p',`採用事例の幅：仕入れ ${range(c.buyLow,c.buyHigh)} ／ 売却 ${range(c.sellLow,c.sellHigh)}。予測の保証範囲ではありません。`));
  card.append(metrics,text('p',c.reason),text('p',c.nextAction));
  const detail=document.createElement('details');detail.append(text('summary',`出品情報・比較根拠 ${c.evidence.length}件`));detail.append(c.evidence.length?table(c.evidence):text('p','この案件に紐づく比較根拠は保存されていません。'));card.append(detail);$('#candidates').append(card);
 }
 $('#coverage').replaceChildren();for(const s of r.coverage)$('#coverage').append(text('p',s));
 $('#provenance').textContent=r.provenance||'';
}
async function openReport(id){
 const n=++request;$('#loadStatus').textContent='記録を読み込んでいます…';$('#report').hidden=true;
 try{if(!runs.some(r=>r.id===id))throw Error('指定された調査記録が見つかりません');const r=validateReport(await json(`./history/${encodeURIComponent(id)}.json`));if(n!==request)return;if(r.id!==id)throw Error('記録IDが一致しません');selected=r;renderReport(r);drawList();if(archive)history.replaceState(null,'','#run='+encodeURIComponent(id));$('#loadStatus').textContent='保存済みの調査結果です。新しい調査はチャットで依頼してください。'}catch(e){if(n===request){selected=null;$('#report').hidden=true;$('#loadStatus').textContent=e.message;drawList()}}
}
async function load(){
 $('#refresh').disabled=true;
 try{const index=await json('./history/index.json');if(!Array.isArray(index.runs))throw Error('履歴一覧の形式を確認できません');runs=sortRuns(index.runs);drawList();const id=(archive?new URLSearchParams(location.hash.slice(1)).get('run'):null)||runs[0]?.id;if(id)await openReport(id);else{$('#loadStatus').textContent='まだ調査記録はありません。チャットで調査を依頼してください。';$('#report').hidden=true}}catch(e){$('#loadStatus').textContent=e.message}finally{$('#refresh').disabled=false}
}
function filterHistory(){const visible=runs.filter(r=>!$('#dateFilter').value||r.researchedOn===$('#dateFilter').value);drawList();if(!selected||!visible.some(r=>r.id===selected.id)){request++;selected=null;$('#report').hidden=true;if(visible[0])openReport(visible[0].id);else $('#loadStatus').textContent='この日付の調査記録はありません。'}}
if(archive){$('#dateFilter').onchange=filterHistory;$('#allDates').onclick=()=>{$('#dateFilter').value='';filterHistory()}}$('#refresh').onclick=load;
function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#json').onclick=()=>{if(selected)download(JSON.stringify(selected,null,2),'application/json',`${selected.id}.json`)};
$('#csv').onclick=()=>{if(!selected)return;const rows=[['調査日','調査ID','会場','開催日','番号','車名','判定','仕入下限円','仕入上限円','売却下限円','売却上限円','差額円','暫定仕入円','暫定売却円','暫定条件','出品票URL','理由'],...bySpread(selected.candidates).map(c=>[selected.researchedOn,selected.id,c.venue,c.auctionDate,c.lot,c.name,c.status,c.buyLow,c.buyHigh,c.sellLow,c.sellHigh,c.spread,c.estimate?.buy,c.estimate?.sell,c.estimate?.note,c.sourceUrl,c.reason])];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`${selected.id}.csv`)};
load();
