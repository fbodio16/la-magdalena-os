const CACHE='lmos-web-v721-login-estable';
const ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './css/styles.css?v=9.0.0','./css/modules/lots.css?v=9.0.0',
  './js/app.js?v=9.0.0',
  './js/modules/lots.js','./js/modules/gis/index.js','./js/modules/production/index.js',
  './js/modules/transport/index.js','./js/modules/operations/index.js','./js/modules/sales/index.js',
  './js/modules/purchases/index.js','./js/modules/finance/index.js','./js/modules/data-safety/index.js'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(event.request,{cache:'no-store'});
      if(fresh.ok){const cache=await caches.open(CACHE);cache.put(event.request,fresh.clone());}
      return fresh;
    }catch(_){
      return (await caches.match(event.request)) || (event.request.mode==='navigate' ? caches.match('./index.html') : Response.error());
    }
  })());
});
