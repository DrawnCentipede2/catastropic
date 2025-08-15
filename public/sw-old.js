// Service Worker for Advanced Image Caching
// Implements multiple cache strategies for optimal image loading performance

const CACHE_NAME = 'catastropic-images-v1';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

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

// Fetch event - handle image caching strategy
self.addEventListener('fetch', (event) => {
  // Only handle image requests and same-origin requests
  if (!event.request.destination === 'image' && !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle image requests with cache-first strategy
  if (event.request.destination === 'image' || isImageRequest(event.request)) {
    event.respondWith(handleImageRequest(event.request));
  }
});

// Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
  
  return imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) ||
         request.headers.get('accept')?.includes('image/') ||
         url.pathname.includes('/assets/') && imageExtensions.some(ext => url.pathname.includes(ext));
}

// Handle image requests with advanced caching
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
      headers.set('sw-cache-version', '1');
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      
      // Store in cache
      await cache.put(request, cachedResponse);
      
      // Enforce cache size limits
      await enforceCacheLimit(cache);
      
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
    
    // Return fallback image or error response
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

// Enforce cache size limits
async function enforceCacheLimit(cache) {
  const requests = await cache.keys();
  
  if (requests.length > 100) { // Limit number of cached items
    // Remove oldest 20% of items
    const toRemove = requests.slice(0, Math.floor(requests.length * 0.2));
    await Promise.all(toRemove.map(request => cache.delete(request)));
    console.log('[SW] Removed', toRemove.length, 'old cache entries');
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