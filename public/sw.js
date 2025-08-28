// Service Worker for Sign Inventory App
// Increment version to force cache update
const CACHE_NAME = 'sign-inventory-v3';
const RUNTIME_CACHE = 'runtime-cache-v2';

const urlsToCache = [
  '/',
  '/login',
  '/areas',
  '/inventory',
  '/manifest.json',
  '/icon.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests (different origin)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle navigation requests (pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((response) => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(RUNTIME_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return response;
            })
            .catch(() => {
              // Return cached homepage as fallback
              return caches.match('/');
            });
        })
    );
    return;
  }

  // Handle other requests (API, assets, etc.)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            // Don't cache if not successful
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cache static assets
            if (request.destination === 'image' || 
                request.destination === 'script' || 
                request.destination === 'style' ||
                request.url.includes('/_next/static/')) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }

            return response;
          })
          .catch(() => {
            // Return cached version if available
            return caches.match(request);
          });
      })
  );
});

// Background sync for offline inventory data
self.addEventListener('sync', (event) => {
  if (event.tag === 'inventory-sync') {
    event.waitUntil(syncInventoryData());
  }
});

// Function to sync offline inventory data
async function syncInventoryData() {
  try {
    // This will be handled by the client-side code
    // Send message to all clients to trigger sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OFFLINE_DATA' });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}