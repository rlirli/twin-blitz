/** Max pixel dimension images are scaled down to before storage. */
export const SYMBOL_STORAGE_SIZE_PX = 300;

/** Max pixel dimension for normalized high-res source images in IndexedDB. */
export const SOURCE_IMAGE_MAX_DIMENSION = 2000;

/** Quality setting for compressed WebP images (0.0 to 1.0). */
export const SYMBOL_STORAGE_QUALITY = 0.85;

export interface Transformation {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface MaskPath {
  tool: "brush" | "lasso" | "rectangle" | "ellipse";
  points: number[]; // can be image-relative or workspace-relative
  mode: "add" | "subtract" | "replace";
  brushSize?: number;
}

/**
 * Transforms a point from Raw Image Space (A) to the Upright Cropped Workspace (B).
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
 * Transforms a point from Upright Cropped Workspace (B) to Raw Image Space (A).
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
 * Bulk transform a list of mask paths between coordinate systems.
 */
export function transformMaskData(
  mask: MaskPath[],
  t: Transformation,
  direction: "A2B" | "B2A",
): MaskPath[] {
  return mask.map((path) => {
    let points = path.points;
    let tool = path.tool;

    // Convert Geometric shapes to polygons during B2A to preserve screen-alignment
    if (direction === "B2A" && (tool === "rectangle" || tool === "ellipse")) {
      const [sx, sy, w, h] = path.points;
      if (tool === "rectangle") {
        points = [sx, sy, sx + w, sy, sx + w, sy + h, sx, sy + h];
      } else {
        points = [];
        const [cx, cy, rx, ry] = [sx + w / 2, sy + h / 2, Math.abs(w / 2), Math.abs(h / 2)];
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 2;
          points.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        }
      }
      tool = "lasso"; // Use the robust path-based renderer
    } else if (direction === "A2B" && tool === "lasso" && points.length === 8) {
      // Optional: try to recover rect tool? Nah, let's keep it robust as lasso.
    }

    const newPoints: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const [nx, ny] =
        direction === "A2B"
          ? transformPointA2B(points[i], points[i + 1], t)
          : transformPointB2A(points[i], points[i + 1], t);
      newPoints.push(nx, ny);
    }
    return { ...path, tool, points: newPoints };
  });
}

/**
 * Resizes an image to fit within maxDimension, preserving aspect ratio.
 */
async function resizeImage(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");

      const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL("image/webp", SYMBOL_STORAGE_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

/**
 * Draws a set of mask paths onto a canvas context.
 */
function drawMaskPaths(ctx: CanvasRenderingContext2D, maskPaths: MaskPath[]) {
  maskPaths.forEach((path) => {
    ctx.beginPath();
    ctx.globalCompositeOperation = path.mode === "subtract" ? "destination-out" : "source-over";

    if (path.tool === "brush" || path.tool === "lasso") {
      if (path.points.length < 2) return;
      ctx.moveTo(path.points[0], path.points[1]);
      for (let i = 2; i < path.points.length; i += 2) {
        ctx.lineTo(path.points[i], path.points[i + 1]);
      }
      if (path.tool === "lasso") ctx.closePath();

      if (path.tool === "brush") {
        ctx.lineWidth = path.brushSize || 20;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      } else {
        ctx.fill();
      }
    } else if (path.tool === "rectangle") {
      const [x, y, w, h] = path.points;
      ctx.rect(x, y, w, h);
      ctx.fill();
    } else if (path.tool === "ellipse") {
      const [x, y, w, h] = path.points;
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * Generates the final 300px sticker from a high-res source, transform, and mask.
 */
export async function generateSticker(
  sourceUrl: string,
  transformation: Transformation,
  maskPaths: MaskPath[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const { width: sw, height: sh } = img;

      // 1. Create source-sized canvas for masking
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = sw;
      sourceCanvas.height = sh;
      const sCtx = sourceCanvas.getContext("2d");
      if (!sCtx) return reject(new Error("Source context unavailable"));

      // 2. Draw mask
      if (maskPaths.length > 0) {
        // Fill white where we want to keep
        sCtx.fillStyle = "white";
        // If the first path is 'add' or 'replace', we start from empty.
        // If we want a "Default keep all" starting point, we'd fill the whole thing first.
        // The user's Q3 logic says "grey overlay... reveal background", so we start from empty/black.
        drawMaskPaths(sCtx, maskPaths);

        // Composite image with mask
        sCtx.globalCompositeOperation = "source-in";
        sCtx.drawImage(img, 0, 0);
      } else {
        // No mask, just draw image
        sCtx.drawImage(img, 0, 0);
      }

      // 3. Apply Transformation (Rotation + Crop)
      // The goal: the final sticker is the UPRIGHT version of the rotated crop window.
      // We use a Center-Pivot strategy: Any rotation in the UI happens about the crop's center.
      const transformCanvas = document.createElement("canvas");
      const cropW = transformation.width || sw;
      const cropH = transformation.height || sh;
      transformCanvas.width = cropW;
      transformCanvas.height = cropH;
      const tCtx = transformCanvas.getContext("2d");
      if (!tCtx) return reject(new Error("Transform context unavailable"));

      // Pivot math (Matches CropTab UI):
      // 1. Position context at the center of our output "window"
      tCtx.translate(cropW / 2, cropH / 2);
      // 2. Counter-rotate the world to level the crop frame
      tCtx.rotate((-transformation.rotation * Math.PI) / 180);
      // 3. Draw the image such that its selection center aligns with our window center
      // Stored X,Y is top-left, so centerX is X + W/2
      tCtx.translate(-(transformation.x + cropW / 2), -(transformation.y + cropH / 2));
      tCtx.drawImage(sourceCanvas, 0, 0);

      // 4. Tight Bounding Box
      const [bx, by, bw, bh] = getTightBoundingBox(transformCanvas);

      // 5. Final 300px scale down
      const finalCanvas = document.createElement("canvas");
      const scale = Math.min(SYMBOL_STORAGE_SIZE_PX / bw, SYMBOL_STORAGE_SIZE_PX / bh, 1);
      finalCanvas.width = bw * scale;
      finalCanvas.height = bh * scale;
      const fCtx = finalCanvas.getContext("2d");
      if (!fCtx) return reject(new Error("Final context unavailable"));

      fCtx.imageSmoothingEnabled = true;
      fCtx.imageSmoothingQuality = "high";
      fCtx.drawImage(transformCanvas, bx, by, bw, bh, 0, 0, finalCanvas.width, finalCanvas.height);

      resolve(finalCanvas.toDataURL("image/webp", SYMBOL_STORAGE_QUALITY));
    };
    img.onerror = () => reject(new Error("Failed to load source image for sticker generation"));
    img.src = sourceUrl;
  });
}

/**
 * Compresses an image to the UI preview size (max 300px).
 */
export async function compressImage(file: File | string): Promise<string> {
  if (typeof file === "string") {
    const blob = await (await fetch(file)).blob();
    return resizeImage(blob as File, SYMBOL_STORAGE_SIZE_PX);
  }
  return resizeImage(file, SYMBOL_STORAGE_SIZE_PX);
}

/**
 * Analyzes the alpha channel of a canvas to find the tight bounding box
 * of non-transparent pixels. Returns [x, y, width, height].
 */
export function getTightBoundingBox(canvas: HTMLCanvasElement): [number, number, number, number] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [0, 0, canvas.width, canvas.height];

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;

  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = imageData[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  if (!hasPixels) return [0, 0, width, height];
  return [minX, minY, maxX - minX + 1, maxY - minY + 1];
}

/**
 * Normalizes an uploaded image to a high-res source (max 2000px).
 */
export async function normalizeSourceImage(file: File | string): Promise<string> {
  if (typeof file === "string") {
    const blob = await (await fetch(file)).blob();
    return resizeImage(blob as File, SOURCE_IMAGE_MAX_DIMENSION);
  }
  return resizeImage(file, SOURCE_IMAGE_MAX_DIMENSION);
}

/**
 * Extracts path data [tag, attrs] from a Lucide icon component.
 * Handles both the modern forwardRef structure and the simpler tuple structure.
 */
function getLucideIconPaths(IconComponent: any): Array<[string, any]> | null {
  if (!IconComponent) return null;

  // 1. Try tuple structure (favored by user for simplicity)
  if (Array.isArray(IconComponent)) {
    return IconComponent[2] || null;
  }

  // 2. Try modern forwardRef structure (render returns an element with iconNode)
  try {
    const renderFn = IconComponent.render || IconComponent;
    if (typeof renderFn === "function") {
      const element = renderFn({ size: 24 }, null);
      if (element?.props?.iconNode) return element.props.iconNode;
    }
  } catch {
    /* ignore */
  }

  // 3. Try direct property
  return IconComponent.iconNode || null;
}

/**
 * Renders an SVG data URL to a compressed WebP URL via Canvas.
 * Standardizes all symbols to our 300x300 storage format.
 */
async function renderSvgToWebp(svgDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SYMBOL_STORAGE_SIZE_PX;
      canvas.height = SYMBOL_STORAGE_SIZE_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.clearRect(0, 0, SYMBOL_STORAGE_SIZE_PX, SYMBOL_STORAGE_SIZE_PX);
      ctx.drawImage(img, 0, 0, SYMBOL_STORAGE_SIZE_PX, SYMBOL_STORAGE_SIZE_PX);
      resolve(canvas.toDataURL("image/webp", SYMBOL_STORAGE_QUALITY));
    };
    img.onerror = () => reject(new Error("Failed to render SVG to canvas"));
    img.src = svgDataUrl;
  });
}

/**
 * Converts a Lucide icon into a display-ready WebP data URL.
 * Orchestrates path extraction, SVG creation, and WebP rendering.
 */
export async function lucideIconToImageUrl(
  LucideIcons: Record<string, any>,
  name: string,
): Promise<string> {
  const IconComp = LucideIcons[name];
  const paths = getLucideIconPaths(IconComp);

  if (!paths) {
    throw new Error(`Could not extract paths for Lucide icon: ${name}`);
  }

  // Build SVG string (concise style)
  const pathMarkup = paths
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${attrStr} />`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${pathMarkup}
    </svg>
  `;

  const svgDataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  return renderSvgToWebp(svgDataUrl);
}
