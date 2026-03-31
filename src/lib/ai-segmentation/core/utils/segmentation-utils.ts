/**
 * Shared mathematical and image processing utilities for AI segmentation models (SAM, EfficientViT-SAM).
 * Standardizes coordinate mapping, normalization, and letterboxing.
 */

import { Point } from "../workers/protocol";
import { Mask, cropAndRescaleMask } from "./mask-utils";

export interface LetterboxInfo {
  scale: number;
  padX: number;
  padY: number;
  newW: number;
  newH: number;
  targetRes: number;
}

/**
 * Calculates letterbox transformation parameters to fit source dimensions into a square target resolution.
 */
export function getLetterboxInfo(srcW: number, srcH: number, targetRes: number): LetterboxInfo {
  const scale = Math.min(targetRes / srcW, targetRes / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  const padX = (targetRes - newW) / 2;
  const padY = (targetRes - newH) / 2;

  return { scale, padX, padY, newW, newH, targetRes };
}

/**
 * Applies letterboxing to an ImageBitmap using OffscreenCanvas.
 * Returns the padded, square ImageBitmap and the transformation info.
 */
export async function applyLetterbox(
  image: ImageBitmap,
  targetRes: number,
): Promise<{ bitmap: ImageBitmap; info: LetterboxInfo }> {
  const info = getLetterboxInfo(image.width, image.height, targetRes);
  const canvas = new OffscreenCanvas(targetRes, targetRes);
  const ctx = canvas.getContext("2d")!;

  // Clear to black (standard for padding in SAM)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, targetRes, targetRes);
  ctx.drawImage(image, info.padX, info.padY, info.newW, info.newH);

  return {
    bitmap: await canvas.transferToImageBitmap(),
    info,
  };
}

/**
 * Maps absolute pixel clicks to coordinates in the padded model input space (targetRes x targetRes),
 * and optionally applies an additional scaling factor (e.g., to 1024x1024 for standard SAM decoders).
 */
export function mapPointToLetterbox(
  p: Point,
  info: LetterboxInfo,
  coordScale: number = 1,
): { x: number; y: number } {
  // x_model = (x_pixel * scale + padding) * coordinate_normalization_factor
  const x = (p.x * info.scale + info.padX) * coordScale;
  const y = (p.y * info.scale + info.padY) * coordScale;
  return { x, y };
}

/**
 * Un-letterboxes a mask by cropping the active region and resizing it back to the original image dimensions.
 */
export async function undoLetterbox(
  mask: Mask,
  info: LetterboxInfo,
  originalW: number,
  originalH: number,
): Promise<Mask> {
  const outScaleX = mask.width / info.targetRes;
  const outScaleY = mask.height / info.targetRes;

  const cropX = info.padX * outScaleX;
  const cropY = info.padY * outScaleY;
  const cropW = info.newW * outScaleX;
  const cropH = info.newH * outScaleY;

  return await cropAndRescaleMask(mask, cropX, cropY, cropW, cropH, originalW, originalH);
}

/**
 * Converts ImageBitmap pixels to a Float32Array tensor.
 * Applies optional ImageNet normalization.
 */
export async function imageBitmapToNormalizedTensor(
  image: ImageBitmap,
  normalize: boolean = false,
): Promise<Float32Array> {
  const { width, height } = image;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const idata = ctx.getImageData(0, 0, width, height).data;

  const chSize = width * height;
  const tensor = new Float32Array(3 * chSize);

  for (let i = 0; i < chSize; i++) {
    const srcIdx = i * 4;
    const r = idata[srcIdx] / 255.0;
    const g = idata[srcIdx + 1] / 255.0;
    const b = idata[srcIdx + 2] / 255.0;

    if (normalize) {
      // ImageNet Mean/Std
      tensor[i] = (r - 0.485) / 0.229;
      tensor[i + chSize] = (g - 0.456) / 0.224;
      tensor[i + chSize * 2] = (b - 0.406) / 0.225;
    } else {
      tensor[i] = r;
      tensor[i + chSize] = g;
      tensor[i + chSize * 2] = b;
    }
  }

  return tensor;
}
