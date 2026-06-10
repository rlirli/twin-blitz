/** Paper size options supported by the application. */
export type PaperSize = "9x13" | "10x15" | "13x18";

/** List of all supported paper sizes. */
export const PAPER_SIZES: PaperSize[] = ["9x13", "10x15", "13x18"];

/** Default paper size. */
export const DEFAULT_PAPER_SIZE: PaperSize = "10x15";

/** Paper dimensions in mm (width and height). */
export const PAPER_DIMENSIONS: Record<PaperSize, { w: number; h: number }> = {
  "9x13": { w: 90, h: 130 },
  "10x15": { w: 100, h: 150 },
  "13x18": { w: 130, h: 180 },
};

/** Diameter of game cards in mm. */
export const CARD_DIAMETER_MM = 84;

/** Pixel density for print-quality images (300 DPI). */
export const PRINT_DPI = 300;

/** Conversion factor from mm to inches. */
export const MM_TO_INCH = 25.4;
