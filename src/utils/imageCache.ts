/**
 * Advanced Image Caching System
 * Handles IndexedDB storage, Service Worker caching, and cache invalidation
 */

export interface CachedImageData {
  url: string;
  data: string; // Base64 or blob URL
  timestamp: number;
  size: number;
  compressed?: string;
  blurHash?: string;
  metadata?: Record<string, unknown>;
}

export class ImageCacheManager {
  private dbName = 'ImageCacheDB';
  private version = 2;
  private db: IDBDatabase | null = null;
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private maxSize = 50 * 1024 * 1024; // 50MB total cache size

  async init(): Promise<void> {
    if (this.db) return;
    
    console.log('[ImageCache] Initializing IndexedDB...');

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ImageCache] IndexedDB initialized successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('images')) {
          const store = db.createObjectStore('images', { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  async store(url: string, data: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    
    const imageData: CachedImageData = {
      url,
      data,
      timestamp: Date.now(),
      size: data.length,
      ...metadata
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(imageData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(url: string): Promise<CachedImageData | null> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const result = request.result;
        if (result && this.isValidCache(result)) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private isValidCache(cached: CachedImageData): boolean {
    return Date.now() - cached.timestamp < this.maxAge;
  }

  async cleanup(): Promise<void> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const index = store.index('timestamp');
    
    const cutoff = Date.now() - this.maxAge;
    const range = IDBKeyRange.upperBound(cutoff);
    
    return new Promise((resolve) => {
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  async getTotalSize(): Promise<number> {
    if (!this.db) await this.init();

    const transaction = this.db!.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    
    return new Promise((resolve) => {
      let totalSize = 0;
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          totalSize += cursor.value.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };
    });
  }

  async enforceMaxSize(): Promise<void> {
    const totalSize = await this.getTotalSize();
    
    if (totalSize > this.maxSize) {
      // Remove oldest entries until we're under the limit
      if (!this.db) await this.init();

      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const index = store.index('timestamp');
      
      let removedSize = 0;
      const targetSize = totalSize - this.maxSize + 10 * 1024 * 1024; // Remove extra 10MB
      
      return new Promise((resolve) => {
        const request = index.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && removedSize < targetSize) {
            removedSize += cursor.value.size;
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }
  }
}

// Singleton instance
export const imageCache = new ImageCacheManager();