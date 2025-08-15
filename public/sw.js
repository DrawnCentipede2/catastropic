// Service Worker for Advanced Image Caching
// Conservative approach - only cache specific image types to avoid blocking

const CACHE_NAME = 'catastropic-images-v1';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// Install event - pre-cache essential resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - handle image caching strategy (conservative approach)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle specific image requests to avoid blocking external APIs/avatars
  const shouldHandle = (
    // Handle local assets from our domain
    event.request.url.startsWith(self.location.origin) && 
    (event.request.destination === 'image' || isLocalImageRequest(event.request))
  );
  
  if (shouldHandle) {
    console.log('[SW] Handling image request:', event.request.url);
    event.respondWith(handleImageRequest(event.request));
  }
  
  // Let everything else (including Google avatars, external APIs) pass through normally
});

// Check if request is for a local image
function isLocalImageRequest(request) {
  const url = new URL(request.url);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
  
  // Only handle our local assets
  return (
    url.origin === self.location.origin &&
    (imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) ||
     url.pathname.includes('/assets/') ||
     request.headers.get('accept')?.includes('image/'))
  );
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Check if cached response is still valid
    if (cachedResponse && isCacheValid(cachedResponse)) {
      console.log('[SW] Serving from cache:', request.url);
      
      // Update cache in background for next time (stale-while-revalidate)
      updateCacheInBackground(request, cache);
      
      return cachedResponse;
    }

    // Fetch fresh image
    console.log('[SW] Fetching fresh image:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response before caching
      const responseToCache = networkResponse.clone();
      
      // Add timestamp header for cache validation
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      
      // Store in cache
      await cache.put(request, cachedResponse);
      
      return networkResponse;
    }
    
    // If network fails and we have an old cached version, use it
    if (cachedResponse) {
      console.log('[SW] Network failed, serving stale cache:', request.url);
      return cachedResponse;
    }
    
    throw new Error('Network failed and no cache available');
    
  } catch (error) {
    console.error('[SW] Image request failed:', error);
    
    // Return a proper response instead of throwing
    return new Response('Image not available', {
      status: 404,
      statusText: 'Image Not Found'
    });
  }
}

// Check if cached response is still valid
function isCacheValid(response) {
  const cacheDate = response.headers.get('sw-cache-date');
  if (!cacheDate) return false;
  
  const cached = new Date(cacheDate).getTime();
  const now = Date.now();
  
  return (now - cached) < CACHE_EXPIRY;
}

// Update cache in background
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cache-date', new Date().toISOString());
      
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      
      await cache.put(request, responseToCache);
    }
  } catch (error) {
    console.log('[SW] Background cache update failed:', error);
  }
}

// Handle message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[SW] Service Worker loaded');