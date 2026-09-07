import { mkdir, cp } from 'node:fs/promises';
import {build} from 'esbuild-wasm';
import {loadEnvFile} from 'node:process';
try{loadEnvFile('.env.local');}catch{}
if(!process.env.NEON_AUTH_BASE_URL?.startsWith('https://'))throw new Error('Neon Auth 연결 환경 변수가 필요합니다.');
await mkdir('dist', {recursive:true});
for (const path of ['index.html', 'favicon.svg', 'manifest.webmanifest','sw.js','src']) await cp(path, `dist/${path}`, {recursive:true});
await build({absWorkingDir:process.cwd(),entryPoints:['./src/app.js'],outfile:'dist/src/app.js',tsconfigRaw:{},bundle:true,format:'esm',minify:true,define:{__AUTH_URL__:JSON.stringify(process.env.NEON_AUTH_BASE_URL)}});
console.log('Build complete: authenticated app (only public Auth URL included).');
