import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import {loadEnvFile} from 'node:process';
try{loadEnvFile('.env.local');}catch{}
const root = resolve('dist');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if(['/api/workspace','/api/admin'].includes(url.pathname)){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4_000_000){res.writeHead(413).end();return;}}
      if(body){try{req.body=JSON.parse(body);}catch{res.writeHead(400).end();return;}}
      const {default:handler}=await import('..'+url.pathname+'.js');await handler(req,res);return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep) || !mime[extname(file)]) {res.writeHead(403).end(); return;}
    const body=await readFile(file);
    res.writeHead(200, {'Content-Type':mime[extname(file)], 'Cache-Control':'no-store'}).end(body);
  } catch {res.writeHead(404).end('Not found');}
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
