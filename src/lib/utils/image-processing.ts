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
