/**
 * React Hook for Optimized Image Loading
 * Combines lazy loading, caching, compression, and progressive loading
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { imageCache, type CachedImageData } from '@/utils/imageCache';
import { imageOptimizer, FormatSupport, type ImageOptimizationOptions } from '@/utils/imageOptimization';

export interface UseOptimizedImageOptions {
  enableLazyLoading?: boolean;
  enableCaching?: boolean;
  enableCompression?: boolean;
  compressionOptions?: ImageOptimizationOptions;
  placeholder?: string;
  blurHash?: string;
  rootMargin?: string;
  threshold?: number;
}

export interface OptimizedImageState {
  src: string | null;
  isLoading: boolean;
  isError: boolean;
  isInView: boolean;
  compressionRatio?: number;
  error?: Error;
}

export const useOptimizedImage = (
  originalSrc: string,
  options: UseOptimizedImageOptions = {}
): OptimizedImageState => {
  const {
    enableLazyLoading = true,
    enableCaching = true,
    enableCompression = true,
    compressionOptions = {},
    rootMargin = '50px',
    threshold = 0.1
  } = options;

  const [state, setState] = useState<OptimizedImageState>({
    src: null,
    isLoading: false,
    isError: false,
    isInView: false
  });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadedRef = useRef(false);

  // Intersection Observer for lazy loading
  const initializeObserver = useCallback(() => {
    if (!enableLazyLoading || observerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState(prev => ({ ...prev, isInView: true }));
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );
  }, [enableLazyLoading, rootMargin, threshold]);

  // Load and optimize image
  const loadImage = useCallback(async () => {
    if (loadedRef.current || !originalSrc) return;
    
    console.log('[OptimizedImage] Loading image:', originalSrc);
    setState(prev => ({ ...prev, isLoading: true, isError: false }));
    loadedRef.current = true;

    try {
      let finalSrc = originalSrc;
      let compressionRatio: number | undefined;

      // Check cache first
      if (enableCaching) {
        const cached = await imageCache.get(originalSrc);
        if (cached) {
          finalSrc = cached.data;
          // Type assertion to fix TypeScript error - compressionRatio should be a number
          compressionRatio = cached.metadata?.compressionRatio as number;
          setState(prev => ({ 
            ...prev, 
            src: finalSrc, 
            isLoading: false,
            compressionRatio 
          }));
          return;
        }
      }

      // Handle Base64 images with optimization
      if (originalSrc.startsWith('data:image/') && enableCompression) {
        const bestFormat = await FormatSupport.getBestFormat();
        // Fix type error: getBestFormat() returns 'avif' but ImageOptimizationOptions expects 'webp' | 'jpeg' | 'png'
        // Filter out 'avif' format if returned, fallback to 'webp'
        const compatibleFormat = bestFormat === 'avif' ? 'webp' : bestFormat;
        const optimizationOpts: ImageOptimizationOptions = {
          format: compatibleFormat,
          quality: 0.85,
          maxWidthOrHeight: 1920,
          ...compressionOptions
        };

        const optimizedResult = await imageOptimizer.optimizeBase64(
          originalSrc, 
          optimizationOpts
        );

        finalSrc = optimizedResult.blobUrl;
        compressionRatio = optimizedResult.compressionRatio;

        // Cache the optimized result
        if (enableCaching) {
          await imageCache.store(originalSrc, optimizedResult.compressed, {
            compressionRatio,
            format: bestFormat,
            originalSize: optimizedResult.originalSize,
            optimizedSize: optimizedResult.optimizedSize
          });
        }
      } 
      // Handle regular URLs
      else if (!originalSrc.startsWith('data:')) {
        // For regular URLs, we can cache the URL itself
        if (enableCaching) {
          await imageCache.store(originalSrc, originalSrc, {
            type: 'url',
            timestamp: Date.now()
          });
        }
      }

      setState(prev => ({ 
        ...prev, 
        src: finalSrc, 
        isLoading: false,
        compressionRatio 
      }));

    } catch (error) {
      console.error('[OptimizedImage] Image loading failed:', originalSrc, error);
      setState(prev => ({ 
        ...prev, 
        isError: true, 
        isLoading: false,
        error: error as Error
      }));
    }
  }, [originalSrc, enableCaching, enableCompression, compressionOptions]);

  // Effect to handle lazy loading
  useEffect(() => {
    if (!enableLazyLoading) {
      setState(prev => ({ ...prev, isInView: true }));
      return;
    }

    initializeObserver();
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enableLazyLoading, initializeObserver]);

  // Effect to load image when in view
  useEffect(() => {
    if (state.isInView && !loadedRef.current) {
      loadImage();
    }
  }, [state.isInView, loadImage]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (state.src?.startsWith('blob:')) {
        URL.revokeObjectURL(state.src);
      }
    };
  }, [state.src]);

  return state;
};

export default useOptimizedImage;