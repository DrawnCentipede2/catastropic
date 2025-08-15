/**
 * Service Worker Registration and Management
 * Handles registration, updates, and cache management
 */

export interface ServiceWorkerManager {
  register: () => Promise<ServiceWorkerRegistration | null>;
  unregister: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  checkForUpdates: () => Promise<boolean>;
}

class ServiceWorkerManagerImpl implements ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = 'serviceWorker' in navigator;

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration.scope);

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const installingWorker = this.registration!.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New service worker available');
                // Notify user about update
                this.notifyUpdate();
              } else {
                console.log('Service worker installed for the first time');
              }
            }
          });
        }
      });

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.isSupported || !this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('Service Worker unregistered:', result);
      return result;
    } catch (error) {
      console.error('Service Worker unregister failed:', error);
      return false;
    }
  }

  async clearCache(): Promise<boolean> {
    if (!this.isSupported || !navigator.serviceWorker.controller) {
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success || false);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  }

  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return true;
    } catch (error) {
      console.error('Service Worker update check failed:', error);
      return false;
    }
  }

  private notifyUpdate(): void {
    // Create a custom event for the app to handle
    const event = new CustomEvent('sw-update-available', {
      detail: {
        registration: this.registration
      }
    });
    window.dispatchEvent(event);
  }
}

// Singleton instance
export const serviceWorkerManager = new ServiceWorkerManagerImpl();

// React hook for service worker management
import { useState, useEffect } from 'react';

export const useServiceWorker = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initServiceWorker = async () => {
      setIsLoading(true);
      try {
        const registration = await serviceWorkerManager.register();
        setIsRegistered(!!registration);
      } catch (error) {
        console.error('Service Worker initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Handle update notifications
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);
    initServiceWorker();

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const clearCache = async (): Promise<boolean> => {
    const result = await serviceWorkerManager.clearCache();
    if (result) {
      // Reload page to show fresh content
      window.location.reload();
    }
    return result;
  };

  const checkForUpdates = (): Promise<boolean> => {
    return serviceWorkerManager.checkForUpdates();
  };

  const skipWaiting = (): void => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SKIP_WAITING'
      });
      window.location.reload();
    }
  };

  return {
    isRegistered,
    updateAvailable,
    isLoading,
    clearCache,
    checkForUpdates,
    skipWaiting
  };
};

export default serviceWorkerManager;