import JSZip from "jszip";

import { SymbolData } from "@/store/use-symbol-store";

import { getCardPlacements } from "../utils/layout-engine";
import {
  PaperSize,
  PAPER_DIMENSIONS,
  CARD_DIAMETER_STANDARD_MM,
  PRINT_DPI,
  MM_TO_INCH,
} from "./print-layout";

/**
 * Renders a single game card to a high-resolution <canvas> element.
 * Everything is scaled based on the chosen paper size at 300 DPI.
 */
async function renderCardToCanvas(
  cardIdx: number,
  symbolIndices: number[],
  symbols: SymbolData[],
  symbolsPerCard: number,
  paperSize: PaperSize,
  cardDiameter: number,
): Promise<HTMLCanvasElement> {
  const { w, h } = PAPER_DIMENSIONS[paperSize];
  const pxW = Math.round((w / MM_TO_INCH) * PRINT_DPI);
  const pxH = Math.round((h / MM_TO_INCH) * PRINT_DPI);
  const cardPx = Math.round((cardDiameter / MM_TO_INCH) * PRINT_DPI);

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is unavailable.");

  // 1. Fill background (white page)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pxW, pxH);

  // 2. Draw card circle (centered)
  const centerX = pxW / 2;
  const centerY = pxH / 2;
  const cardRadius = cardPx / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, cardRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "#94a3b8"; // More prominent cutting guide
  ctx.lineWidth = 5;
  ctx.stroke();

  // 3. Draw symbols at their relative positions using the centralized layout engine
  const placements = getCardPlacements(cardIdx, symbolsPerCard);

  for (let i = 0; i < symbolIndices.length; i++) {
    const symbolIdx = symbolIndices[i];
    const symbol = symbols[symbolIdx];
    if (!symbol?.url) continue;

    const placement = placements[i];
    if (!placement) continue;

    const rotationRad = placement.rotation * (Math.PI / 180);

    // Calculate absolute symbol center relative to the 84mm card area
    const symX = centerX - cardRadius + (placement.x / 100) * cardPx;
    const symY = centerY - cardRadius + (placement.y / 100) * cardPx;

    // Draw the symbol image (scaled by cardDiameter factor to prevent overlap)
    const scaleFactor = cardDiameter / CARD_DIAMETER_STANDARD_MM;
    try {
      await drawRotatedImage(
        ctx,
        symbol.url,
        symX,
        symY,
        rotationRad,
        placement.scale * scaleFactor,
      );
    } catch (e) {
      console.warn(`Failed to export symbol ${symbolIdx} on card ${cardIdx}`, e);
    }
  }

  // 4. Tiny print label
  ctx.fillStyle = "oklch(58.5% 0.233 277.117)"; // indigo-500
  ctx.font = `${Math.round(9 * (PRINT_DPI / 72))}px monospace`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillText(`TWIN BLITZ - CARD #${cardIdx + 1}`, centerX, pxH - 20);

  return canvas;
}

/**
 * Helper to draw an image source at a specific point with rotation and scale.
 */
function drawRotatedImage(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  angleRad: number,
  scale: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angleRad);

      // Base size for symbols is roughly 16mm in print (around 190px at 300dpi)
      const baseSize = Math.round((16 / MM_TO_INCH) * PRINT_DPI);
      const maxSize = baseSize * scale;

      const imgWidth = img.width;
      const imgHeight = img.height;
      const aspectRatio = imgWidth / imgHeight;

      let drawWidth, drawHeight;
      if (aspectRatio > 1) {
        drawWidth = maxSize;
        drawHeight = maxSize / aspectRatio;
      } else {
        drawWidth = maxSize * aspectRatio;
        drawHeight = maxSize;
      }

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Main function to generate the ZIP archive of cards.
 */
export async function exportCardsToZip(
  rawCards: number[][],
  symbols: SymbolData[],
  symbolsPerCard: number,
  paperSize: PaperSize,
  cardDiameter: number,
  onProgress?: (count: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`twin-blitz-cards-${paperSize}cm`);

  for (let i = 0; i < rawCards.length; i++) {
    const canvas = await renderCardToCanvas(
      i,
      rawCards[i],
      symbols,
      symbolsPerCard,
      paperSize,
      cardDiameter,
    );

    // Get as blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    folder?.file(`card-${String(i + 1).padStart(2, "0")}.png`, blob);
    onProgress?.(i + 1);
  }

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Generates a ZIP archive containing all uploaded/edited symbols.
 */
export async function exportSymbolsToZip(symbols: SymbolData[]): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder("twin-blitz-symbols");

  for (const symbol of symbols) {
    if (!symbol.url) continue;

    // Extract format and base64 data from the data URL
    const match = symbol.url.match(/^data:(image\/[a-z0-9-+.]+);base64,(.+)$/i);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      let extension = "webp"; // default to webp since our generator outputs webp
      if (mimeType === "image/png") extension = "png";
      else if (mimeType === "image/svg+xml") extension = "svg";
      else if (mimeType === "image/jpeg") extension = "jpg";

      const cleanName = symbol.name.replace(/\s+/g, "_");
      folder?.file(`${cleanName}.${extension}`, base64Data, { base64: true });
    } else {
      // Fallback for absolute/relative URLs
      try {
        const response = await fetch(symbol.url);
        const blob = await response.blob();
        const mimeType = blob.type;
        let extension = "webp";
        if (mimeType === "image/png") extension = "png";
        else if (mimeType === "image/svg+xml") extension = "svg";
        else if (mimeType === "image/jpeg") extension = "jpg";

        const cleanName = symbol.name.replace(/\s+/g, "_");
        folder?.file(`${cleanName}.${extension}`, blob);
      } catch (err) {
        console.warn(`Failed to fetch and add symbol ${symbol.id} to zip`, err);
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}
