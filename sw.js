const CACHE="cc-shell-v5";
const SHELL=["/","/manifest.webmanifest","/favicon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;e.respondWith(fetch(r).then(res=>{if(new URL(r.url).origin===self.location.origin){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{})}return res}).catch(()=>caches.match(r).then(x=>x||caches.match("/"))))});
