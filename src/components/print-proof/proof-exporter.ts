import JSZip from "jszip";

import { PaperSize, PAPER_DIMENSIONS, PRINT_DPI, MM_TO_INCH } from "@/lib/print/print-layout";
import { SymbolData } from "@/store/use-symbol-store";

import {
  PROOF_SYMBOL_WIDTH_CM,
  PROOF_SYMBOL_HEIGHT_CM,
  PROOF_GAP_X_CM,
  PROOF_GAP_Y_CM,
  getProofGridCapacity,
} from "./proof-layout";

/**
 * Draws a symbol image centered within a cell, scaled to fit the cell bounds.
 */
function drawProofImage(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(cellW / img.width, cellH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = x + (cellW - drawW) / 2;
      const drawY = y + (cellH - drawH) / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Renders a single proof page of symbols to a high-resolution <canvas> element.
 */
async function renderProofPageToCanvas(
  pageIdx: number,
  pageSymbols: SymbolData[],
  startIndex: number,
  paperSize: PaperSize,
): Promise<HTMLCanvasElement> {
  const { w, h } = PAPER_DIMENSIONS[paperSize];

  // Convert mm to pixels at 300 DPI
  const pxW = Math.round((w / MM_TO_INCH) * PRINT_DPI);
  const pxH = Math.round((h / MM_TO_INCH) * PRINT_DPI);

  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is unavailable.");

  // Fill white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pxW, pxH);

  // Conversion factor from cm to pixels at 300 DPI (1 inch = 2.54 cm)
  const CM_TO_INCH = 2.54;
  const cmToPx = (cm: number) => Math.round((cm / CM_TO_INCH) * PRINT_DPI);

  const symWidthPx = cmToPx(PROOF_SYMBOL_WIDTH_CM);
  const symHeightPx = cmToPx(PROOF_SYMBOL_HEIGHT_CM);
  const gapXPx = cmToPx(PROOF_GAP_X_CM);
  const gapYPx = cmToPx(PROOF_GAP_Y_CM);

  const { cols, rows } = getProofGridCapacity(paperSize);

  // Center the grid on the page
  const gridWidthPx = cols * symWidthPx + (cols - 1) * gapXPx;
  const gridHeightPx = rows * symHeightPx + (rows - 1) * gapYPx;
  const startXPx = Math.round((pxW - gridWidthPx) / 2);
  const startYPx = Math.round((pxH - gridHeightPx) / 2);

  // Draw grid cells
  for (let idx = 0; idx < pageSymbols.length; idx++) {
    const symbol = pageSymbols[idx];
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const cellX = startXPx + col * (symWidthPx + gapXPx);
    const cellY = startYPx + row * (symHeightPx + gapYPx);
    const globalIdx = startIndex + idx;

    // Draw the symbol number in top-left corner
    ctx.fillStyle = "#64748b"; // muted text
    const fontSize = Math.round(9 * (PRINT_DPI / 72)); // 9pt
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(String(globalIdx + 1), cellX, cellY);

    if (symbol?.url) {
      try {
        await drawProofImage(ctx, symbol.url, cellX, cellY, symWidthPx, symHeightPx);
      } catch (e) {
        console.warn(`Failed to render symbol ${globalIdx + 1} on page ${pageIdx + 1}`, e);
      }
    }
  }

  // Draw print label
  ctx.fillStyle = "#64748b";
  ctx.font = `${Math.round(8 * (PRINT_DPI / 72))}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    `TWIN BLITZ - PRINT PROOF SHEET PAGE #${pageIdx + 1}`,
    pxW / 2,
    pxH - Math.round(5 * (PRINT_DPI / 72)),
  );

  return canvas;
}

/**
 * Generates a ZIP archive containing the high-res print proof sheets.
 */
export async function exportProofPagesToZip(
  symbols: SymbolData[],
  paperSize: PaperSize,
  onProgress?: (count: number) => void,
): Promise<Blob> {
  const { symbolsPerPage } = getProofGridCapacity(paperSize);

  const zip = new JSZip();
  const folder = zip.folder(`twin-blitz-print-proof-${paperSize}cm`);

  const pagesCount = Math.ceil(symbols.length / symbolsPerPage);

  for (let i = 0; i < pagesCount; i++) {
    const startIndex = i * symbolsPerPage;
    const pageSymbols = symbols.slice(startIndex, startIndex + symbolsPerPage);

    const canvas = await renderProofPageToCanvas(i, pageSymbols, startIndex, paperSize);

    // Get as blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });

    folder?.file(`proof-page-${String(i + 1).padStart(2, "0")}.png`, blob);
    onProgress?.(i + 1);
  }

  return await zip.generateAsync({ type: "blob" });
}
