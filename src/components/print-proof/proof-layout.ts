import { PaperSize, PAPER_DIMENSIONS } from "@/lib/print/print-layout";

/** Print proof symbol and layout constants in centimeters. */
export const PROOF_SYMBOL_WIDTH_CM = 1.8;
export const PROOF_SYMBOL_HEIGHT_CM = 2.2;
export const PROOF_GAP_X_CM = 0.5;
export const PROOF_GAP_Y_CM = 1.0;
export const PROOF_PAGE_MARGIN_CM = 0.05;

/**
 * Calculates grid capacity and bounds for proof pages.
 */
export function getProofGridCapacity(paperSize: PaperSize) {
  const { w, h } = PAPER_DIMENSIONS[paperSize];
  const paperW = w / 10;
  const paperH = h / 10;

  const wAvail = paperW - 2 * PROOF_PAGE_MARGIN_CM;
  const hAvail = paperH - 2 * PROOF_PAGE_MARGIN_CM;

  const cols = Math.floor((wAvail + PROOF_GAP_X_CM) / (PROOF_SYMBOL_WIDTH_CM + PROOF_GAP_X_CM));
  const rows = Math.floor((hAvail + PROOF_GAP_Y_CM) / (PROOF_SYMBOL_HEIGHT_CM + PROOF_GAP_Y_CM));

  return {
    cols,
    rows,
    symbolsPerPage: Math.max(1, cols * rows),
    paperW,
    paperH,
  };
}
