// Executed in the isolated extension world. Only rendered form controls and rows
// are used; no cookies, passwords, hidden fields or internal site functions.
export function pageAction(op, arg={}) {
 const visible=e=>!!e && !!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);
 const text=e=>(e?.innerText||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const all=s=>Array.from(document.querySelectorAll(s)).filter(visible);
 const body=document.body.innerText;
 if(all('input[type=password]').length || /セッションタイムアウト|USBキー情報を確認中|再度ログインしてください/.test(body))return {auth:true};
 const set=(selector,value)=>{const e=all(selector)[0];if(!e)throw Error('検索欄が見つかりません');e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e};
 const click=e=>{if(!e)throw Error('操作対象が見つかりません');e.click();return {acted:true}};
 const next=()=>all('a,button,input[type=button]').find(e=>/^(次へ|次のページ|次へ >|次へ≫)$/.test(text(e)||e.value));
 if(op==='discoverCIS')return {url:all('a[href]').find(e=>/\/market\/model\/modelSch\.aspx/i.test(e.href))?.href};
 if(op==='tcSearch'){
  const radio=document.querySelector(arg.source==='buy'?'#fwRaidoSoba':'#fwRaidoAA');
  if(!radio)return {unsupported:true,message:'TC-Webのマイページで開始してください'};
  radio.click();for(const [id,value] of [['aaChkbox',true],['onepChkbox',false],['s1pChkbox',false]]){const e=document.getElementById(id);if(e&&e.checked!==value)e.click()}
  set('[name=searchWord]',arg.query);
  return click(all('a').find(e=>(e.getAttribute('href')||'').includes('fwSubmit')));
 }
 if(op==='cisSearch'){set('#FreeWord',arg.query);return click(all('input,button,a').find(e=>(e.value||text(e))==='検索'))}
 if(op==='next')return next()?click(next()):{end:true};
 if(op==='detail'){
  const links=all('a').filter(e=>(e.getAttribute('href')||'').includes('popDetail('));
  const e=links.find(e=>e.getAttribute('href')===arg.ref);return click(e);
 }
 if(op==='readTC'){
  const rows=all('tr').filter(tr=>/千km/.test(text(tr))&&Array.from(tr.children).filter(e=>e.tagName==='TD').length>=8);
  const leaf=rows.filter(tr=>!Array.from(tr.querySelectorAll('tr')).some(t=>/千km/.test(text(t))));
  return {rows:leaf.map(tr=>({cells:Array.from(tr.children).filter(e=>e.tagName==='TD').map(text),head:text(tr.previousElementSibling),detailRef:tr.querySelector('a[href*="popDetail("]')?.getAttribute('href')||tr.previousElementSibling?.querySelector('a[href*="popDetail("]')?.getAttribute('href')})),next:!!next(),url:location.origin+location.pathname,query:document.querySelector('#searchWord')?.value,empty:/該当.*ありません|検索結果.*0件/.test(body)};
 }
 if(op==='readDetail'){
  const tr=all('tr[id^=result1]').find(e=>/千km/.test(text(e)));
  if(!tr)return {pending:true};
  const cells=Array.from(tr.children).filter(e=>e.tagName==='TD').map(text);
  return {cells,head:text(tr.previousElementSibling),lot:cells[1]?.match(/\d+/)?.[0],auctionDate:cells[0]?.match(/\d+月\d+日/)?.[0]};
 }
 if(op==='readCIS')return {rows:all('tr').map(tr=>Array.from(tr.children).filter(e=>e.tagName==='TD').map(text)).filter(c=>c.length===11&&/^\d{2}\/\d{2}\/\d{2}$/.test(c[0])),next:!!next(),url:location.origin+location.pathname,periodVerified:/過去\s*4\s*開催/.test(body),empty:/該当.*ありません|検索結果.*0件/.test(body)};
 throw Error('未対応の操作');
}
