// Import captured DOM rows, not arbitrary pages or live browser state.
import {readFile,writeFile} from 'node:fs/promises';
import {norm,year} from '../extension/core.js';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/import-cis-cache.mjs CAPTURE.json CACHE.json');
const data=JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,''));
const comps=[];let skipped=0;
for(const group of data.cis||[]){for(const raw of group.rows||[]){
 if(raw.length!==11||!/^\d{2}\/\d{2}\/\d{2}$/.test(raw[0])){skipped++;continue}
 const c=raw.map(norm),identity=c[1].match(/^(\d+)\s+(.+)$/),m=c[5].split(' ')[0],name=c[3].replace(/\s*5D\s*/,' ').trim(),tokens=name.split(' ');
 comps.push({side:'sell',market:'USS',period:/過去4開催|過去４開催/.test(group.query||group.header||'')?'past4events':'unknown',auctionDate:'20'+c[0].replaceAll('/','-'),lot:identity?.[1]||null,venue:identity?.[2]||null,name:tokens.shift(),grade:tokens.join(' '),model:c[7].split(' ')[0],year:year(c[2]),km:/^\d+$/.test(m)?Number(m)*1000:null,mileageFlag:/^\d+$/.test(m)?null:m,score:c[10].split(' ')[0],color:c[6],status:c[8]==='落札'?'sold':'other',price:/^[\d,]+$/.test(c[9].split(' ')[0])?Number(c[9].split(' ')[0].replaceAll(',',''))*1000:null,priceBasis:'unknown',observedAt:group.observedAt||data.observedAt||null,provenance:{input,query:group.query,raw}});
}}
await writeFile(output,JSON.stringify({schemaVersion:1,comps,importNotes:{skipped,unstructuredTCGroups:(data.tc||[]).length,note:'TC自由文は出品識別・価格列の誤認を防ぐため自動変換しない。取得時刻・検索期間がないデータは補完しない。'}},null,2)+'\n');
console.log({imported:comps.length,skipped,unstructuredTCGroups:(data.tc||[]).length});
