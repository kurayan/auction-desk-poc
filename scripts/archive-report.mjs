import {readFile,writeFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateReport,sortRuns,summarize} from '../web/history-model.js';
export async function archiveReport(report,directory){
 validateReport(report);
 const serialized=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(serialized)>5_000_000)throw Error('Report exceeds 5 MB');
 const root=resolve(directory);await mkdir(root,{recursive:true});
 const lockPath=join(root,'.archive.lock');const lock=await open(lockPath,'wx');
 const indexPath=join(root,'index.json'),target=join(root,report.id+'.json'),temp=indexPath+'.tmp';
 try{
  let index;try{index=JSON.parse(await readFile(indexPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;index={schemaVersion:1,runs:[]}}
  if(index.schemaVersion!==1||!Array.isArray(index.runs))throw Error('Invalid archive index');
  let previous=null;try{previous=await readFile(target,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
  if(previous!==null&&previous!==serialized)throw Error('Existing report is immutable. Use a new run ID for a correction.');
  if(previous===null)await writeFile(target,serialized,{flag:'wx'});
  // Retrying an identical record also repairs a missing index entry after an interrupted write.
  const runs=sortRuns([...index.runs.filter(r=>r.id!==report.id),summarize(report)]);
  await writeFile(temp,JSON.stringify({schemaVersion:1,runs},null,2)+'\n');await rename(temp,indexPath);
  return {id:report.id,count:runs.length,file:target};
 }finally{await lock.close();await unlink(lockPath);await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [input,directory]=process.argv.slice(2);if(!input||!directory)throw Error('Usage: node scripts/archive-report.mjs REPORT.json SITE/dist/history');
 console.log(await archiveReport(JSON.parse(await readFile(input,'utf8')),directory));
}
