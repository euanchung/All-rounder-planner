import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', {recursive:true});
for (const path of ['index.html', 'favicon.svg', 'src']) await cp(path, `dist/${path}`, {recursive:true});
console.log('Build complete: dist (static, no paid API or runtime dependencies)');
