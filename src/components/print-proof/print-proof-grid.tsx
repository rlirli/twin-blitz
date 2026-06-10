"use client";

import React, { useMemo } from "react";

import { PaperSize, PAPER_DIMENSIONS } from "@/lib/print/print-layout";
import { SymbolData } from "@/store/use-symbol-store";

import {
  PROOF_SYMBOL_WIDTH_CM,
  PROOF_SYMBOL_HEIGHT_CM,
  PROOF_GAP_X_CM,
  PROOF_GAP_Y_CM,
  PROOF_PAGE_MARGIN_CM,
  getProofGridCapacity,
} from "./proof-layout";

interface PrintProofGridProps {
  symbols: SymbolData[];
  paperSize: PaperSize;
}

export const PrintProofGrid: React.FC<PrintProofGridProps> = ({ symbols, paperSize }) => {
  const paperDim = PAPER_DIMENSIONS[paperSize];
  const widthStr = `${paperDim.w}mm`;
  const heightStr = `${paperDim.h}mm`;
  const { cols, rows, symbolsPerPage } = getProofGridCapacity(paperSize);

  const pages = useMemo(() => {
    const chunked: SymbolData[][] = [];
    for (let i = 0; i < symbols.length; i += symbolsPerPage) {
      chunked.push(symbols.slice(i, i + symbolsPerPage));
    }
    return chunked;
  }, [symbols, symbolsPerPage]);

  return (
    <div className="flex flex-col items-center gap-12 pb-24 print:block print:gap-0 print:pb-0">
      {pages.map((pageSymbols, pageIdx) => (
        <div
          key={pageIdx}
          className="relative flex items-center justify-center bg-white shadow-2xl print:mb-0 print:break-after-page print:border-0 print:shadow-none"
          style={{
            width: widthStr,
            height: heightStr,
            padding: `${PROOF_PAGE_MARGIN_CM}cm`,
          }}
        >
          <div
            className="grid items-center justify-center"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${PROOF_SYMBOL_WIDTH_CM}cm)`,
              gridTemplateRows: `repeat(${rows}, ${PROOF_SYMBOL_HEIGHT_CM}cm)`,
              gap: `${PROOF_GAP_Y_CM}cm ${PROOF_GAP_X_CM}cm`,
            }}
          >
            {pageSymbols.map((symbol, idx) => {
              const globalIdx = pageIdx * symbolsPerPage + idx;

              return (
                <div
                  key={symbol.id}
                  className="relative flex items-center justify-center border border-dashed border-zinc-200/40 print:border-none"
                  style={{
                    width: `${PROOF_SYMBOL_WIDTH_CM}cm`,
                    height: `${PROOF_SYMBOL_HEIGHT_CM}cm`,
                  }}
                >
                  {/* Small number in top left */}
                  <span className="absolute top-0.5 left-0.5 font-mono text-[9px] leading-none text-zinc-400 select-none">
                    {globalIdx + 1}
                  </span>

                  {/* Symbol Image */}
                  {symbol.url ? (
                    <img
                      src={symbol.url}
                      alt={symbol.name}
                      className="pointer-events-none h-full w-full object-contain p-1 select-none"
                    />
                  ) : (
                    <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-[10px] text-gray-300 select-none">
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Print Footer page label */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-zinc-400 uppercase select-none">
            Twin Blitz - Print Proof Page #{pageIdx + 1}
          </div>
        </div>
      ))}

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            margin: 0;
            size: ${widthStr} ${heightStr};
          }
          .print:break-after-page {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
};
