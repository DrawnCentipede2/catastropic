/**
 * Image Optimization Utilities
 * Handles compression, format conversion, and Base64 optimization
 */

export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  preserveAspectRatio?: boolean;
}

export interface OptimizedImageResult {
  optimized: string;
  compressed: string;
  blobUrl: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
}

export class ImageOptimizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Optimize Base64 image with compression and format conversion
   */
  async optimizeBase64(
    base64: string, 
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    const defaultOptions: Required<ImageOptimizationOptions> = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      quality: 0.8,
      format: 'webp',
      preserveAspectRatio: true
    };

    const opts = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = this.processImage(img, base64, opts);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  private processImage(
    img: HTMLImageElement, 
    original: string, 
    options: Required<ImageOptimizationOptions>
  ): OptimizedImageResult {
    // Calculate new dimensions
    const { width, height } = this.calculateDimensions(
      img.width, 
      img.height, 
      options.maxWidthOrHeight
    );

    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;

    // Clear and draw image
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(img, 0, 0, width, height);

    // Convert to optimized format
    const mimeType = `image/${options.format}`;
    const optimized = this.canvas.toDataURL(mimeType, options.quality);
    
    // Create additional compressed version for storage
    const compressed = this.canvas.toDataURL(mimeType, Math.min(options.quality - 0.2, 0.6));
    
    // Create blob URL for memory efficiency
    const blobUrl = this.base64ToBlob(optimized);

    // Calculate sizes
    const originalSize = this.calculateBase64Size(original);
    const optimizedSize = this.calculateBase64Size(optimized);
    const compressionRatio = originalSize / optimizedSize;

    return {
      optimized,
      compressed,
      blobUrl,
      originalSize,
      optimizedSize,
      compressionRatio
    };
  }

  private calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxDimension: number
  ): { width: number; height: number } {
    if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
      return { width: originalWidth, height: originalHeight };
    }

    const ratio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: maxDimension,
        height: Math.round(maxDimension / ratio)
      };
    } else {
      return {
        width: Math.round(maxDimension * ratio),
        height: maxDimension
      };
    }
  }

  private base64ToBlob(base64: string): string {
    try {
      const byteString = atob(base64.split(',')[1]);
      const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
      
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.warn('Failed to convert Base64 to Blob URL:', error);
      return base64;
    }
  }

  private calculateBase64Size(base64: string): number {
    const header = base64.substring(0, base64.indexOf(',') + 1);
    const data = base64.substring(header.length);
    return Math.round((data.length * 3) / 4);
  }

  /**
   * Clean up blob URLs to prevent memory leaks
   */
  static cleanupBlobUrl(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Format Support Detection
 */
export class FormatSupport {
  private static cache = new Map<string, boolean>();

  static async testFormat(format: string): Promise<boolean> {
    if (this.cache.has(format)) {
      return this.cache.get(format)!;
    }

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      try {
        const dataUrl = canvas.toDataURL(`image/${format}`, 0.5);
        const supported = dataUrl.startsWith(`data:image/${format}`);
        this.cache.set(format, supported);
        resolve(supported);
      } catch {
        this.cache.set(format, false);
        resolve(false);
      }
    });
  }

  static async getBestFormat(): Promise<'avif' | 'webp' | 'jpeg'> {
    if (await this.testFormat('avif')) return 'avif';
    if (await this.testFormat('webp')) return 'webp';
    return 'jpeg';
  }

  static async webpSupported(): Promise<boolean> {
    return this.testFormat('webp');
  }

  static async avifSupported(): Promise<boolean> {
    return this.testFormat('avif');
  }
}

// Singleton instance
export const imageOptimizer = new ImageOptimizer();