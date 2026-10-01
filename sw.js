/* Plantilla de worker. La compilación inserta SOLO recursos estáticos verificados. */
const CONFIG = {"build":"1a820f986e9212a302f6","version":"0.3.0","environment":"production","namespace":"SONNE_APP_production_ff633cba0449_","base":"/sonne-finance/","resources":[{"path":"assets/Backups-CG8L3F8S.js","sha256":"e27e13b95ae628efcdf34f45961333e1f7b12f0c3b40e888055b1cdb3678008a"},{"path":"assets/Historial-D4RnFdAA.js","sha256":"9ce3a092ce52844a7c9c9870d6de056e17080ff6bddfda99856a1a4db4565cf2"},{"path":"assets/Plan-BM_jvVLu.js","sha256":"c5356ce879bff24749292af1a60f7b31ad747768b530423c5832d2b6c211dd46"},{"path":"assets/Simulador-CzM6mLRf.js","sha256":"64a8005f69795147ee917f822c497a33600dbc434090abc295e3df48fe85777d"},{"path":"assets/index-BmSa3AD6.js","sha256":"89e009fe213b73e09b8bc57565ce63b1d1d08dce3a6521606f892764452918fb"},{"path":"assets/index-CFHFY8J9.css","sha256":"eb459bd79070d30858e842922818e166011c592c9a2c704004923757e60e5fc6"},{"path":"assets/shared-BSvBsTId.js","sha256":"0810a8e06a7cfb1339f6ec3de6986b9dc9c603e8e40c1e6d14dc39c53957425b"},{"path":"icons/apple-180.png","sha256":"fd62a8cf2ee367a9852eebff3ac7defbf3e937c45b51e4be351e27af8ec7f857"},{"path":"icons/icon-192.png","sha256":"bcb99822e81a8079f7cf3c04c4eefab76c8f5fc9ef30148d77b367b090b3b17a"},{"path":"icons/icon-512.png","sha256":"c83371e1e685bacb76403a142550948541260daa1f4d5948a2d1945659f31307"},{"path":"icons/maskable-512.png","sha256":"1bfa28dd912ffd5c2d143b481080b7ff03ef7400f2f89c85dcda64da087b2717"},{"path":"icons/sun.svg","sha256":"178c1023c2e2be0011328cdbc65e7583613623451b3464cb6c9d4f5c01c56068"},{"path":"index.html","sha256":"2f70e0891d74020ddd61261df806d630ccfa2f04796fe0c60edd68234fb55a1a"},{"path":"manifest.webmanifest","sha256":"3bb8f69fc5305921683fd48d6ea20a3f37cd6321a8f829c04a72cac67f12cd1e"}]};
const scope = new URL(self.registration.scope);
const namespace = CONFIG.namespace;
const cacheName = namespace + CONFIG.build;
const resources = CONFIG.resources.map(r => ({ ...r, url: new URL(r.path, scope).href }));
const own = url => url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
const send = (event, value) => event.ports[0]?.postMessage(value);
async function digest(response) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))].map(b => b.toString(16).padStart(2,'0')).join(''); }
async function verified(cache) {
  for (const resource of resources) { const response = await cache.match(resource.url); if (!response || await digest(response) !== resource.sha256) return false; }
  return true;
}
async function install() {
  // Descarga y comprueba TODO antes de escribir. Una instalación fallida nunca
  // modifica la caché de una versión activa ni IndexedDB.
  const responses = [];
  for (const resource of resources) {
    const response = await fetch(resource.url, { cache:'no-store', credentials:'omit', redirect:'error' });
    if (!response.ok || response.type === 'opaque' || await digest(response.clone()) !== resource.sha256) throw new Error('Recurso incompleto o incompatible: ' + resource.path);
    responses.push(response);
  }
  const cache = await caches.open(cacheName);
  try { for (let i=0; i<resources.length; i++) await cache.put(resources[i].url, responses[i]); }
  catch(error) { await caches.delete(cacheName); throw error; }
}
self.addEventListener('install', event => event.waitUntil(install()));
// No skipWaiting en instalación, ni borrado de cachés antiguas al activar.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin) return;
  const navigation = request.mode === 'navigate' && own(url);
  const resource = resources.find(r => r.url === url.href);
  const oldAsset = url.pathname.startsWith(scope.pathname+'assets/') && !url.search;
  if (!navigation && !resource && !oldAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(navigation ? new URL('index.html',scope).href : request);
    if (hit) return hit;
    // Pestaña antigua: conservar y consultar SOLO las cachés de este entorno/ruta.
    if (oldAsset) for (const name of (await caches.keys()).filter(n=>n.startsWith(namespace) && n!==cacheName)) { const previous = await (await caches.open(name)).match(request); if(previous) return previous; }
    return fetch(request);
  })());
});
self.addEventListener('message', event => {
  const source = event.source;
  if (!source || !own(new URL(source.url))) return;
  const data = event.data;
  if (data?.type === 'STATUS') event.waitUntil((async()=>send(event,{type:'STATUS',build:CONFIG.build,version:CONFIG.version,environment:CONFIG.environment,ready:await verified(await caches.open(cacheName)),count:resources.length}))());
  if (data?.type === 'ACTIVATE') event.waitUntil((async()=>{
    if (data.build !== CONFIG.build) return send(event,{ok:false,error:'La actualización ha cambiado. Comprueba de nuevo.'});
    if (!await verified(await caches.open(cacheName))) return send(event,{ok:false,error:'La actualización no está completa. Se conserva la versión actual.'});
    const tabs = (await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>own(new URL(c.url)));
    if (tabs.length !== 1 || tabs[0].id !== source.id) return send(event,{ok:false,error:'Cierra las otras pestañas o ventanas de SONNE en esta ruta y vuelve a intentarlo.'});
    send(event,{ok:true}); await self.skipWaiting();
  })());
});

