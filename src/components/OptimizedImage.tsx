/**
 * OptimizedImage Component
 * Advanced image component with lazy loading, caching, compression, and progressive loading
 */

import React, { forwardRef, HTMLAttributes } from 'react';
import { useInView } from 'react-intersection-observer';
import useOptimizedImage, { type UseOptimizedImageOptions } from '@/hooks/useOptimizedImage';
import { cn } from '@/lib/utils';

export interface OptimizedImageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'onLoad'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  blurHash?: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  loading?: 'eager' | 'lazy';
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'auto';
  enableCompression?: boolean;
  enableCaching?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallbackSrc?: string;
}

const OptimizedImage = forwardRef<HTMLDivElement, OptimizedImageProps>(
  ({
    src,
    alt,
    width,
    height,
    placeholder,
    blurHash,
    aspectRatio = 'aspect-[16/10]',
    objectFit = 'cover',
    loading = 'lazy',
    priority = false,
    quality = 0.85,
    format = 'auto',
    enableCompression = true,
    enableCaching = true,
    className,
    onLoad,
    onError,
    fallbackSrc,
    ...props
  }, ref) => {
    
    const { ref: inViewRef, inView } = useInView({
      threshold: 0.1,
      rootMargin: loading === 'lazy' ? '50px 0px' : '0px',
      triggerOnce: true,
      skip: priority || loading === 'eager'
    });

    const optimizationOptions: UseOptimizedImageOptions = {
      enableLazyLoading: loading === 'lazy' && !priority,
      enableCaching,
      enableCompression: enableCompression && src.startsWith('data:image/'),
      compressionOptions: {
        quality,
        maxWidthOrHeight: Math.max(width || 1920, height || 1920),
        format: format === 'auto' ? undefined : format as 'webp' | 'jpeg' | 'png'
      },
      placeholder,
      blurHash,
      rootMargin: '50px',
      threshold: 0.1
    };

    const imageState = useOptimizedImage(src, optimizationOptions);

    // Handle callbacks
    React.useEffect(() => {
      if (imageState.src && !imageState.isLoading && !imageState.isError) {
        onLoad?.();
      }
    }, [imageState.src, imageState.isLoading, imageState.isError, onLoad]);

    React.useEffect(() => {
      if (imageState.isError && imageState.error) {
        onError?.(imageState.error);
      }
    }, [imageState.isError, imageState.error, onError]);

    const shouldShowImage = priority || loading === 'eager' || inView || imageState.isInView;
    const imageSrc = shouldShowImage ? (imageState.src || fallbackSrc) : null;

    return (
      <div
        ref={(node) => {
          if (ref) {
            if (typeof ref === 'function') ref(node);
            else ref.current = node;
          }
          inViewRef(node);
        }}
        className={cn('relative overflow-hidden', aspectRatio, className)}
        style={{ width, height }}
        {...props}
      >
        {/* Placeholder/Skeleton */}
        {!imageSrc && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse">
            {placeholder && (
              <img
                src={placeholder}
                alt=""
                className="w-full h-full object-cover opacity-20"
                aria-hidden="true"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {imageState.isLoading && shouldShowImage && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Error state */}
        {imageState.isError && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500 p-4">
              <svg
                className="w-12 h-12 mx-auto mb-2 text-gray-400"
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
              <p className="text-sm">Failed to load image</p>
              {fallbackSrc && (
                <img
                  src={fallbackSrc}
                  alt={alt}
                  className={cn('w-full h-full absolute inset-0', `object-${objectFit}`)}
                />
              )}
            </div>
          </div>
        )}

        {/* Main image */}
        {imageSrc && !imageState.isError && (
          <img
            src={imageSrc}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            className={cn(
              'w-full h-full transition-opacity duration-300',
              `object-${objectFit}`,
              imageState.isLoading ? 'opacity-0' : 'opacity-100'
            )}
            onLoad={() => {
              // Additional load handling if needed
            }}
            onError={() => {
              // Additional error handling if needed
            }}
          />
        )}

        {/* Compression indicator (development mode) */}
        {process.env.NODE_ENV === 'development' && 
         imageState.compressionRatio && 
         imageState.compressionRatio > 1.1 && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
            {Math.round((1 - 1/imageState.compressionRatio) * 100)}% smaller
          </div>
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;