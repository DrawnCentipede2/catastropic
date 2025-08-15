/**
 * Simplified OptimizedImage for debugging
 * Minimal implementation to isolate issues
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SimpleOptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  priority?: boolean;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

const SimpleOptimizedImage: React.FC<SimpleOptimizedImageProps> = ({
  src,
  alt,
  className,
  aspectRatio = 'aspect-[16/10]',
  priority = false,
  onError,
  onLoad
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [actualSrc, setActualSrc] = useState<string | null>(null);

  useEffect(() => {
    console.log('[SimpleOptimizedImage] Loading:', src);
    
    const img = new Image();
    
    img.onload = () => {
      console.log('[SimpleOptimizedImage] Loaded successfully:', src);
      setActualSrc(src);
      setIsLoading(false);
      onLoad?.();
    };
    
    img.onerror = (error) => {
      console.error('[SimpleOptimizedImage] Failed to load:', src, error);
      setIsError(true);
      setIsLoading(false);
      onError?.(new Error(`Failed to load image: ${src}`));
    };
    
    img.src = src;
    
    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onError, onLoad]);

  return (
    <div className={cn('relative overflow-hidden', aspectRatio, className)}>
      {/* Loading placeholder */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-500 p-4">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Failed to load</p>
          </div>
        </div>
      )}

      {/* Actual image */}
      {actualSrc && !isError && (
        <img
          src={actualSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={() => {
            console.log('[SimpleOptimizedImage] DOM img loaded:', actualSrc);
          }}
          onError={(e) => {
            console.error('[SimpleOptimizedImage] DOM img error:', actualSrc, e);
          }}
        />
      )}
    </div>
  );
};

export default SimpleOptimizedImage;