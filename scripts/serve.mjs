import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL('../web/',import.meta.url));
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173'));
