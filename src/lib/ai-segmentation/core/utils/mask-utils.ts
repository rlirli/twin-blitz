/**
 * Mask-related helpers for AI segmentation.
 */

export type Mask = {
  width: number;
  height: number;
  alpha: Uint8Array; // 0–255
};

/**
 * Threholds an alpha mask (0-255) into binary (0 or 255).
 */
export function alphaToBinary(mask: Mask, threshold: number = 128): Mask {
  const binary = new Uint8Array(mask.alpha.length);
  for (let i = 0; i < mask.alpha.length; i++) {
    binary[i] = mask.alpha[i] >= threshold ? 255 : 0;
  }
  return { ...mask, alpha: binary };
}

/**
 * Converts a Mask object to an ImageData object for rendering.
 */
export function maskToImageData(mask: Mask): ImageData {
  const data = new Uint8ClampedArray(mask.width * mask.height * 4);
  for (let i = 0; i < mask.alpha.length; i++) {
    const offset = i * 4;
    const alpha = mask.alpha[i];
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = alpha;
  }
  return new ImageData(data, mask.width, mask.height);
}

/**
 * Serializes a Mask to a PNG data URL.
 */
export async function maskToPNG(mask: Mask): Promise<string> {
  const canvas = new OffscreenCanvas(mask.width, mask.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  const imageData = maskToImageData(mask);
  ctx.putImageData(imageData, 0, 0);

  const decodedBlob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(decodedBlob);
  });
}
/**
 * Rescales a mask to a new width and height using an OffscreenCanvas.
 */
export async function rescaleMask(
  mask: Mask,
  targetWidth: number,
  targetHeight: number,
): Promise<Mask> {
  if (mask.width === targetWidth && mask.height === targetHeight) return mask;

  const canvas = new OffscreenCanvas(mask.width, mask.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  const imageData = maskToImageData(mask);
  ctx.putImageData(imageData, 0, 0);

  const outCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Could not get 2d context for OffscreenCanvas");

  outCtx.imageSmoothingEnabled = false; // Keep it crisp or true for smooth? Usually false for masks but true might be better for SAM outputs.
  outCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  const outImageData = outCtx.getImageData(0, 0, targetWidth, targetHeight).data;
  const alpha = new Uint8Array(targetWidth * targetHeight);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = outImageData[i * 4 + 3];
  }

  return {
    width: targetWidth,
    height: targetHeight,
    alpha,
  };
}

/**
 * Crops a mask to a specific region and then resizes it.
 * Useful for undoing letterboxed/padded preprocessing.
 */
export async function cropAndRescaleMask(
  mask: Mask,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
  targetWidth: number,
  targetHeight: number,
): Promise<Mask> {
  const canvas = new OffscreenCanvas(mask.width, mask.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  const imageData = maskToImageData(mask);
  ctx.putImageData(imageData, 0, 0);

  const outCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Could not get 2d context for OffscreenCanvas");

  // We draw a sub-section of the source canvas (the unpadded region)
  // into the destination canvas (the full original image resolution).
  outCtx.imageSmoothingEnabled = true;
  outCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

  const outImageData = outCtx.getImageData(0, 0, targetWidth, targetHeight).data;
  const alpha = new Uint8Array(targetWidth * targetHeight);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = outImageData[i * 4 + 3];
  }

  return {
    width: targetWidth,
    height: targetHeight,
    alpha,
  };
}
