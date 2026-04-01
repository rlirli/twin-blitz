/**
 * Coordinate mapping and transformation utilities for the image editor.
 * Handles conversions between Raw Image Space (A-Space) and Upright Cropped Workspace (B-Space).
 */

export interface Transformation {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Transforms a point from Raw Image Space (A-Space) to the Upright Cropped Workspace (B-Space).
 */
export function transformPointA2B(px: number, py: number, t: Transformation): [number, number] {
  const rad = (-t.rotation * Math.PI) / 180;
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;

  // 1. Center relative to crop center
  const dx = px - cx;
  const dy = py - cy;

  // 2. Rotate
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

  // 3. Move to workspace space (0,0 is top-left)
  return [rx + t.width / 2, ry + t.height / 2];
}

/**
 * Transforms a point from Upright Cropped Workspace (B-Space) to Raw Image Space (A-Space).
 */
export function transformPointB2A(px: number, py: number, t: Transformation): [number, number] {
  const rad = (t.rotation * Math.PI) / 180;
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;

  // 1. Center relative to workspace center
  const dx = px - t.width / 2;
  const dy = py - t.height / 2;

  // 2. Rotate back
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

  // 3. Move back to image space
  return [rx + cx, ry + cy];
}

/**
 * Creates an ImageBitmap of the current crop from a source image.
 * This encapsulates the A-Space to B-Space rendering logic used for AI input.
 */
export async function createCropBitmap(
  img: HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  transformation: Transformation,
): Promise<ImageBitmap> {
  const cropW = transformation.width || (img as any).width || 0;
  const cropH = transformation.height || (img as any).height || 0;

  if (cropW === 0 || cropH === 0) {
    throw new Error("Invalid crop dimensions");
  }

  const canvas = new OffscreenCanvas(cropW, cropH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  // Replicate the B-space upright crop
  ctx.translate(cropW / 2, cropH / 2);
  ctx.rotate((-transformation.rotation * Math.PI) / 180);
  ctx.translate(-(transformation.x + cropW / 2), -(transformation.y + cropH / 2));
  ctx.drawImage(img, 0, 0);

  return canvas.transferToImageBitmap();
}
