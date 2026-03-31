/**
 * Redundant image processing utils for AI segmentation.
 */

/**
 * Resizes an ImageBitmap to target dimensions.
 */
export async function scaleImage(
  image: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.transferToImageBitmap();
}

/**
 * Converts an ImageBitmap into a Tensor-ready Float32Array.
 * Expected format: [1, 3, H, W], RGB, normalized to (0, 1).
 */
export async function imageToTensor(image: ImageBitmap): Promise<Float32Array> {
  const { width, height } = image;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context for OffscreenCanvas");

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height).data;

  const redChannels = new Float32Array(width * height);
  const greenChannels = new Float32Array(width * height);
  const blueChannels = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    redChannels[i] = imageData[i * 4] / 255.0;
    greenChannels[i] = imageData[i * 4 + 1] / 255.0;
    blueChannels[i] = imageData[i * 4 + 2] / 255.0;
  }

  const tensorData = new Float32Array(width * height * 3);
  tensorData.set(redChannels, 0);
  tensorData.set(greenChannels, width * height);
  tensorData.set(blueChannels, width * height * 2);

  return tensorData;
}
