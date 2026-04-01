/**
 * Utilities for visual debugging in the browser console.
 */

import { Mask } from "./mask-utils";

const DEBUG_HEIGHT = 60;

/**
 * Logs a proportional thumbnail of an ImageBitmap to the console with a red border.
 */
export function logDebugImage(image: ImageBitmap, label: string, hash?: string) {
  if (process.env.NODE_ENV !== "development") return;

  const canvas = document.createElement("canvas");
  const ratio = image.width / image.height;
  canvas.height = DEBUG_HEIGHT;
  canvas.width = DEBUG_HEIGHT * ratio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const hashStr = hash ? ` ${hash.slice(0, 8)}...` : "";
  const info = `${label}${hashStr} (${image.width}x${image.height})`;

  console.log(
    `%c %c ${info}`,
    getThumbnailStyle(canvas),
    "color: inherit; font-weight: bold; vertical-align: middle; margin-left: 8px;",
  );
}

/**
 * Logs a proportional thumbnail of a Mask to the console with a red border and indigo tint.
 */
export function logDebugMask(mask: Mask, label: string) {
  if (process.env.NODE_ENV !== "development") return;

  const canvas = document.createElement("canvas");
  const ratio = mask.width / mask.height;
  canvas.height = DEBUG_HEIGHT;
  canvas.width = DEBUG_HEIGHT * ratio;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Create tinted mask image data
  const imageData = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.alpha.length; i++) {
    const alphaVal = mask.alpha[i];
    const idx = i * 4;
    imageData.data[idx] = 99; // R (Indigo)
    imageData.data[idx + 1] = 102; // G
    imageData.data[idx + 2] = 241; // B
    imageData.data[idx + 3] = alphaVal;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = mask.width;
  tempCanvas.height = mask.height;
  tempCanvas.getContext("2d")?.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

  const info = `${label} (${mask.width}x${mask.height})`;

  console.log(
    `%c %c ${info}`,
    getThumbnailStyle(canvas),
    "color: inherit; font-weight: bold; vertical-align: middle; margin-left: 8px;",
  );
}

/**
 * Returns the CSS style string for a console thumbnail.
 */
function getThumbnailStyle(canvas: HTMLCanvasElement): string {
  return [
    "font-size: 0",
    `padding: ${canvas.height / 2}px ${canvas.width / 2}px`,
    "line-height: 0",
    `background-image: url(${canvas.toDataURL()})`,
    `background-size: ${canvas.width}px ${canvas.height}px`,
    "background-repeat: no-repeat",
    "border: 1px solid red",
  ].join("; ");
}
