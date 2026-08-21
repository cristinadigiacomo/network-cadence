const CACHE_NAME = 'network-cadence-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(SHELL_FILES);
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var url = event.request.url;

  // Never cache Google API / OAuth calls — always go to network.
  if(url.indexOf('googleapis.com') !== -1 || url.indexOf('accounts.google.com') !== -1){
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for the app shell (and fonts), falling back to network then updating cache.
  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached) return cached;
      return fetch(event.request).then(function(response){
        if(event.request.method === 'GET' && response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        if(event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
