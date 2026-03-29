/** Max pixel dimension images are scaled down to before storage. */
export const SYMBOL_STORAGE_SIZE_PX = 300;

/** Quality setting for compressed WebP images (0.0 to 1.0). */
export const SYMBOL_STORAGE_QUALITY = 0.85;

/**
 * Compress an image File to a WebP data URL at 300x300.
 * Runs entirely in the browser via the Canvas API.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = SYMBOL_STORAGE_SIZE_PX;
      canvas.height = SYMBOL_STORAGE_SIZE_PX;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      // Scale image to fit the square, preserving aspect ratio (object-fit: contain)
      const scale = Math.min(
        SYMBOL_STORAGE_SIZE_PX / img.width,
        SYMBOL_STORAGE_SIZE_PX / img.height,
      );
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (SYMBOL_STORAGE_SIZE_PX - drawW) / 2;
      const offsetY = (SYMBOL_STORAGE_SIZE_PX - drawH) / 2;

      ctx.clearRect(0, 0, SYMBOL_STORAGE_SIZE_PX, SYMBOL_STORAGE_SIZE_PX);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

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
