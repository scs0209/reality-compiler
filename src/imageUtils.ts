import { useEffect, useState } from 'react';

const MAX_DIMENSION_PX = 1280;

// Used until the photo has loaded (and for images the browser reports no size for).
const DEFAULT_PHOTO_ASPECT = 16 / 10;

/**
 * Width / height of a photo, so the evidence overlay and the object crops can be laid out in the
 * photo's own frame. Box coordinates are fractions of the whole photo; drawing them on a frame
 * with another aspect ratio (or on a cropped image) puts them in the wrong place.
 */
export function useImageAspect(src: string): number {
  const [aspect, setAspect] = useState(DEFAULT_PHOTO_ASPECT);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return aspect;
}

/**
 * Shrinks a photo before upload: phone photos can exceed the API body limit, and the vision model
 * resizes them anyway. Returns the input unchanged if the browser cannot decode it (e.g. HEIC) or
 * it is already small, so the server can report the real problem.
 */
export function downscaleImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
