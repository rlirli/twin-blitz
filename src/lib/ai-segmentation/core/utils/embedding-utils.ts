/**
 * Embedding key and hashing helpers for AI segmentation.
 */

import { ModelId } from "../../models/model-constants";

/**
 * Generates a simple hash string for an ImageBitmap to use as a key.
 * This is meant to be fast, not cryptographically secure.
 */
export async function hashImage(image: ImageBitmap): Promise<string> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height).data;

  const dataToHash = new Uint8Array(256); // Sample pixels for performance
  const step = Math.max(1, Math.floor(imageData.length / 256));
  for (let i = 0; i < 256; i++) {
    dataToHash[i] = imageData[i * step];
  }

  // Use crypto for a consistent hash
  const hashBuffer = await crypto.subtle.digest("SHA-1", dataToHash);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes the embedding key for IndexedDB storage.
 */
export function getEmbeddingKey(modelId: ModelId, modelVersion: string, imageHash: string): string {
  return `${modelId}:${modelVersion}:${imageHash}`;
}
