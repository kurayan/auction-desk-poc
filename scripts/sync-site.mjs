import {readFile,readdir,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {archiveReport} from './archive-report.mjs';
import {isDeepStrictEqual} from 'node:util';
const [directory]=process.argv.slice(2);if(!directory)throw Error('Usage: node scripts/sync-site.mjs SITE_CHECKOUT');
const root=resolve(directory);const manifest=JSON.parse(await readFile(join(root,'.openai/hosting.json'),'utf8'));
if(!manifest.project_id||manifest.static?.directory!=='dist')throw Error('Expected an existing static Site checkout');
const target=join(root,'dist');await mkdir(target,{recursive:true});
const source=fileURLToPath(new URL('../web/',import.meta.url));
for(const name of await readdir(source)){if(name==='history')continue;await copyFile(join(source,name),join(target,name))}
await mkdir(join(target,'history'),{recursive:true});
try{await writeFile(join(target,'history/index.json'),'{"schemaVersion":1,"runs":[]}\n',{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
const incoming=JSON.parse(await readFile(join(source,'history/index.json'),'utf8'));
const history=join(target,'history');
const existing=JSON.parse(await readFile(join(history,'index.json'),'utf8'));
for(const run of incoming.runs){
  const report=JSON.parse(await readFile(join(source,'history',run.id+'.json'),'utf8'));
  if(report.id!==run.id)throw Error('History ID mismatch: '+run.id);
  if(existing.runs.some(row=>row.id===run.id)){
    const saved=JSON.parse(await readFile(join(history,run.id+'.json'),'utf8'));
    if(!isDeepStrictEqual(report,saved))throw Error('Conflicting destination report: '+run.id);
    continue;
  }
  await archiveReport(report,history,run);
}
console.log('Web and bundled history synchronized.');
