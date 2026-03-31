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
