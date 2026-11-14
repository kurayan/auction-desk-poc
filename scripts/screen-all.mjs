import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {parseListingCache,screen} from '../lib/batch-screen.js';
import {toSiteReport} from '../lib/batch-report.js';
import {validateReport} from '../web/history-model.js';
const args=process.argv.slice(2);const opts={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw Error('Use --listings FILE --cache FILE --date YYYY-MM-DD --out FILE [--as-of ISO] [--price-basis assumed-same]');opts[args[i].slice(2)]=args[i+1]}
for(const k of ['listings','cache','date','out'])if(!opts[k])throw Error(`Missing --${k}`);
const read=async p=>JSON.parse((await readFile(resolve(p),'utf8')).replace(/^\uFEFF/,''));
const raw=await read(opts.listings),cache=await read(opts.cache);
if(!Array.isArray(cache.comps))throw Error('Cache must contain comps array; do not pass unstructured excerpts');
const lots=Array.isArray(raw.lots)?raw.lots:parseListingCache(raw,opts.date);
const report=screen(lots,cache.comps,{auctionDate:opts.date,asOf:opts['as-of']||new Date().toISOString(),priceBasis:opts['price-basis']||'unknown',budget:Number(opts.budget||1000000),minComps:Number(opts['min-comps']||3)});
const out=resolve(opts.out);await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');
if(opts['site-report']){const site=validateReport(toSiteReport(report));const p=resolve(opts['site-report']);await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(site,null,2)+'\n')}
console.log(JSON.stringify({output:out,...report.counts,top5:report.top5.length,searchGroups:report.searchQueue.length,cache:report.cache.usable}));
