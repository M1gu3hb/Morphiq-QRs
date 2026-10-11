import { readFile, writeFile, readdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname;
await cp(new URL('../licenses/', import.meta.url), join(root, 'licenses'), { recursive: true });
async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(file)));
    else if (!file.endsWith('.map') && !file.endsWith('sw.js')) files.push(file);
  }
  return files;
}
const files = await collect(root),
  hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 12),
  assets = [
    '/',
    ...files.filter((f) => !f.endsWith('index.html')).map((f) => '/' + relative(root, f)),
  ];
const script = `const CACHE='morphiq-qr-${version}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('morphiq-qr-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/')));return;}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(url.pathname);if(hit)return hit;const response=await fetch(event.request);if(response.ok)await cache.put(url.pathname,response.clone());return response;}));
});
`;
await writeFile(join(root, 'sw.js'), script);
console.log('PWA: ' + assets.length + ' recursos · ' + version);
