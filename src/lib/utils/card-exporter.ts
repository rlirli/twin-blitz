import JSZip from "jszip";
import * as LucideIcons from "lucide-react";

import { SymbolSlot } from "@/store/use-symbol-store";

import { getCardPlacements } from "./layout-engine";

/** Pixel density for print-quality images. */
const DPI = 300;
/** mm to inch conversion. */
const MM_TO_INCH = 25.4;

/** Paper dimensions in mm based on selection. */
const PAPER_DIMENSIONS = {
  "9x13": { w: 90, h: 130 },
  "10x15": { w: 100, h: 150 },
  "13x18": { w: 130, h: 180 },
};

/** Diameter of the card in mm. */
const CARD_DIAMETER_MM = 84;

/**
 * Renders a single game card to a high-resolution <canvas> element.
 * Everything is scaled based on the chosen paper size at 300 DPI.
 */
async function renderCardToCanvas(
  cardIdx: number,
  symbolIndices: number[],
  symbols: SymbolSlot[],
  paperSize: "9x13" | "10x15" | "13x18",
): Promise<HTMLCanvasElement> {
  const { w, h } = PAPER_DIMENSIONS[paperSize];
  const pxW = Math.round((w / MM_TO_INCH) * DPI);
  const pxH = Math.round((h / MM_TO_INCH) * DPI);
  const cardPx = Math.round((CARD_DIAMETER_MM / MM_TO_INCH) * DPI);

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
  const placements = getCardPlacements(cardIdx);

  for (let i = 0; i < symbolIndices.length; i++) {
    const symbolIdx = symbolIndices[i];
    const symbol = symbols[symbolIdx];
    if (!symbol.url) continue;

    const placement = placements[i];
    const rotationRad = placement.rotation * (Math.PI / 180);

    // Calculate absolute symbol center relative to the 84mm card area
    const symX = centerX - cardRadius + (placement.x / 100) * cardPx;
    const symY = centerY - cardRadius + (placement.y / 100) * cardPx;

    // Load and draw image
    try {
      let imageSource: string = "";
      if (symbol.url.startsWith("icon:")) {
        const iconName = symbol.url.split(":")[1];
        imageSource = createLucideSvgDataUrl(iconName);
      } else {
        imageSource = symbol.url;
      }

      await drawRotatedImage(ctx, imageSource, symX, symY, rotationRad, placement.scale);
    } catch (e) {
      console.warn(`Failed to export symbol ${symbolIdx} on card ${cardIdx}`, e);
    }
  }

  // 4. Tiny print label
  ctx.fillStyle = "#d1d5db";
  ctx.font = `${Math.round(8 * (DPI / 72))}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`Twin Blitz - Card #${cardIdx + 1}`, centerX, pxH - 20);

  return canvas;
}

/**
 * Creates an SVG data URL for a Lucide icon by name.
 * This is the easiest way to draw Lucide icons onto a canvas.
 */
function createLucideSvgDataUrl(name: string): string {
  const IconComp = (LucideIcons as any)[name];
  if (!IconComp) return "";

  // This is a bit of a hack: Lucide exports icons as path definitions.
  // We'll create a simple SVG string for it.
  // The structure of IconComp is typically [element, props, children]
  const [, _props, children] = IconComp;
  const paths = children
    .map(([tag, attrs]: [string, any]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${attrStr} />`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${paths}
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Helper to draw an image/SVG source at a specific point with rotation and scale.
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

      // Base size for symbols is roughly 15mm in print (around 180px at 300dpi)
      const baseSize = Math.round((16 / MM_TO_INCH) * DPI);
      const drawSize = baseSize * scale;

      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Main function to generate the ZIP archive of 57 cards.
 */
export async function exportCardsToZip(
  rawCards: number[][],
  symbols: SymbolSlot[],
  paperSize: "9x13" | "10x15" | "13x18",
  onProgress?: (count: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`twin-blitz-cards-${paperSize}cm`);

  for (let i = 0; i < rawCards.length; i++) {
    const canvas = await renderCardToCanvas(i, rawCards[i], symbols, paperSize);

    // Get as blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    folder?.file(`card-${String(i + 1).padStart(2, "0")}.png`, blob);
    onProgress?.(i + 1);
  }

  return await zip.generateAsync({ type: "blob" });
}
