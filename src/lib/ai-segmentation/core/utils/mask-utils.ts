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

interface BasicTransformation {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Specifically for AI masks: Takes a mask generated from a B-space crop (workspace resolution)
 * and "un-crops" it back into a full-resolution A-space mask (original image resolution).
 *
 * This ensures all stored masks are in the same coordinate system.
 */
export async function uncropMask(
  mask: Mask,
  t: BasicTransformation,
  origW: number,
  origH: number,
): Promise<Mask> {
  // 1. Render mask to a B-space bitmap
  const bCanvas = new OffscreenCanvas(mask.width, mask.height);
  const bCtx = bCanvas.getContext("2d")!;
  bCtx.putImageData(maskToImageData(mask), 0, 0);
  const bBitmap = bCanvas.transferToImageBitmap();

  // 2. Project onto A-space canvas
  const aCanvas = new OffscreenCanvas(origW, origH);
  const aCtx = aCanvas.getContext("2d")!;

  // Pivot math (Reverse of Crop UI logic):
  // We want to draw the B-space crop such that its origin matches where it should be in A-space.
  aCtx.save();
  // Move to the intended center of the crop in A-space
  aCtx.translate(t.x + t.width / 2, t.y + t.height / 2);
  // Rotate by the same angle (positive because we are moving B -> A)
  aCtx.rotate((t.rotation * Math.PI) / 180);
  // Move back to top-left of the B-space content
  aCtx.translate(-t.width / 2, -t.height / 2);
  aCtx.drawImage(bBitmap, 0, 0);
  aCtx.restore();

  const outImageData = aCtx.getImageData(0, 0, origW, origH).data;
  const alpha = new Uint8Array(origW * origH);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = outImageData[i * 4 + 3];
  }

  return { width: origW, height: origH, alpha };
}

/**
 * Extracts contours from a bitmask as a list of polygons (number arrays).
 * Simple boundary-following algorithm.
 */
export function maskToPolygons(mask: Mask, threshold: number = 128): number[][] {
  const { width, height, alpha } = mask;
  const visited = new Uint8Array(width * height);
  const polygons: number[][] = [];

  // Helper to get alpha at (x, y)
  const getAlpha = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return alpha[y * width + x] >= threshold ? 1 : 0;
  };

  // Find unvisited starting point
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (getAlpha(x, y) === 1 && !visited[y * width + x]) {
        // Found a new island, trace it
        const polygon = traceBoundary(x, y, width, height, getAlpha, visited);
        if (polygon.length >= 6) {
          // At least 3 points
          polygons.push(polygon);
        }
      }
    }
  }

  return polygons;
}

/**
 * Traces the boundary of a connected component using Moore Neighborhood.
 */
function traceBoundary(
  startX: number,
  startY: number,
  width: number,
  height: number,
  getAlpha: (x: number, y: number) => number,
  visited: Uint8Array,
): number[] {
  const points: number[] = [];
  let currX = startX;
  let currY = startY;

  // Directions: [dx, dy] for Moore neighborhood (8-connectivity)
  // Ordered clockwise starting from Up-Left
  const DIRS = [
    [-1, -1], [0, -1], [1, -1],
    [1, 0], [1, 1], [0, 1],
    [-1, 1], [-1, 0]
  ];

  let prevDir = 7; // Last was Left

  do {
    points.push(currX, currY);
    visited[currY * width + currX] = 1;

    let found = false;
    // Search for next neighbor clockwise
    for (let i = 0; i < 8; i++) {
      const dirIdx = (prevDir + i) % 8;
      const [dx, dy] = DIRS[dirIdx];
      const nx = currX + dx;
      const ny = currY + dy;

      if (getAlpha(nx, ny) === 1) {
        currX = nx;
        currY = ny;
        // Optimization: enter from the previous direction + 4 (opposite) then next
        prevDir = (dirIdx + 5) % 8;
        found = true;
        break;
      }
    }

    if (!found) break;

    // Boundary condition: wrap or max iterations to avoid infinite loops on weird shapes
    if (points.length > 50000) break; 

  } while (currX !== startX || currY !== startY);

  return points;
}

/**
 * Simplifies a polygon using the Ramer-Douglas-Peucker algorithm.
 * Reduces the number of points while maintaining the shape.
 */
export function simplifyPolygon(points: number[], tolerance: number = 1.0): number[] {
  if (points.length <= 4) return points;

  const getSqSegDist = (p: [number, number], p1: [number, number], p2: [number, number]) => {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2[0]; y = p2[1];
      } else if (t > 0) {
        x += dx * t; y += dy * t;
      }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };

  const simplifyDPStep = (pts: [number, number][], first: number, last: number, sqTolerance: number, simplified: [number, number][]) => {
    let maxSqDist = sqTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (index !== -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, sqTolerance, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, sqTolerance, simplified);
    }
  };

  // Convert to [x, y] pairs
  const pts: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) {
    pts.push([points[i], points[i + 1]]);
  }

  const sqTolerance = tolerance * tolerance;
  const simplified: [number, number][] = [pts[0]];
  simplifyDPStep(pts, 0, pts.length - 1, sqTolerance, simplified);
  simplified.push(pts[pts.length - 1]);

  // Flatten back
  const result: number[] = [];
  for (const [x, y] of simplified) {
    result.push(x, y);
  }
  return result;
}
