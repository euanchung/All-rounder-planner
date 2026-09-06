import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.SERVE_DIST ? 'dist' : '.');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep) || !mime[extname(file)]) {res.writeHead(403).end(); return;}
    const body=await readFile(file);
    res.writeHead(200, {'Content-Type':mime[extname(file)], 'Cache-Control':'no-store'}).end(body);
  } catch {res.writeHead(404).end('Not found');}
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
