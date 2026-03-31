"use client";

import React, { useState, useMemo } from "react";

import Link from "next/link";

import { ArrowLeft, Printer, Settings2 } from "lucide-react";

import { AppLogo } from "@/components/shared";
import { PROJECTIVE_PLANE_ORDER, TOTAL_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import { generateProjectivePlane } from "@/lib/utils/game-core";
import { exportCardsToZip } from "@/lib/utils/image-zip-exporter";
import { getCardPlacements } from "@/lib/utils/layout-engine";
import { useSymbolStore } from "@/store/use-symbol-store";

type PaperSize = "9x13" | "10x15" | "13x18";

export default function PrintPage() {
  const { symbols } = useSymbolStore();
  const [paperSize, setPaperSize] = useState<PaperSize>("9x13");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const rawCards = useMemo(
    () => generateProjectivePlane(PROJECTIVE_PLANE_ORDER).slice(0, TOTAL_CARDS),
    [PROJECTIVE_PLANE_ORDER],
  );

  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportCardsToZip(rawCards, symbols, paperSize, (count) => {
        setExportProgress(count);
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `twin-blitz-cards-${paperSize}cm.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to create ZIP. Is your browser memory full?");
    } finally {
      setIsExporting(false);
    }
  };

  const dimensions = {
    "9x13": { width: "90mm", height: "130mm" },
    "10x15": { width: "100mm", height: "150mm" },
    "13x18": { width: "130mm", height: "180mm" },
  };

  return (
    <div className="bg-background text-foreground min-h-screen print:bg-white">
      {/* Controls Overlay (Hidden on Print) */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-4 print:hidden">
        <div className="w-64 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-widest text-gray-800 uppercase">
            <Settings2 size={16} className="text-indigo-600" />
            Print Settings
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Paper Size</label>
            <div className="flex gap-2">
              {(["9x13", "10x15", "13x18"] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  className={cn(
                    "flex-1 rounded-lg border-2 py-2 text-sm transition-all",
                    paperSize === size
                      ? "border-indigo-600 bg-indigo-50 font-bold text-indigo-700"
                      : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200",
                  )}
                >
                  {size} cm
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Printer size={18} />
            Print Collection
          </button>

          <button
            onClick={handleExportZip}
            disabled={isExporting}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition-all active:scale-95",
              isExporting
                ? "cursor-not-allowed border-indigo-100 bg-indigo-50 text-indigo-400"
                : "border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
            )}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                Generating ({exportProgress}/{TOTAL_CARDS})
              </span>
            ) : (
              "Export as Images (.zip)"
            )}
          </button>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-600 transition-all hover:bg-gray-200"
          >
            <ArrowLeft size={16} />
            Back to Editor
          </Link>
        </div>
      </div>

      {/* Print Instructions (Hidden on Print) */}
      <div className="mx-auto max-w-2xl p-12 pt-12 text-center print:hidden">
        <div className="mb-6 flex justify-center">
          <AppLogo size="sm" />
        </div>
        <h1 className="text-primary mb-4 text-3xl font-extrabold tracking-tight">
          Print Preparation
        </h1>
        <p className="text-muted-foreground mb-8">
          We have generated {TOTAL_CARDS} cards. Each will be centered on a separate page. When you
          click "Print", make sure to set:
        </p>
        <ul className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-left font-medium text-indigo-900">
          <li className="flex gap-3">
            ✅ <span className="font-bold">Layout:</span> Portrait
          </li>
          <li className="flex gap-3">
            ✅ <span className="font-bold">Paper Size:</span> {paperSize} cm
          </li>
          <li className="flex gap-3">
            ✅ <span className="font-bold">Margins:</span> None
          </li>
          <li className="flex gap-3">
            ✅ <span className="font-bold">Scale:</span> 100%
          </li>
        </ul>
      </div>

      {/* Pages for Printing */}
      <div className="flex flex-col items-center print:block">
        {rawCards.map((cardIndices, cardIdx) => {
          const placements = getCardPlacements(cardIdx);

          return (
            <div
              key={cardIdx}
              className="relative mb-12 flex items-center justify-center overflow-hidden bg-white shadow-2xl print:mb-0 print:break-after-page print:shadow-none"
              style={{
                width: dimensions[paperSize].width,
                height: dimensions[paperSize].height,
              }}
            >
              {/* 84mm Round Card */}
              <div
                className="relative overflow-hidden rounded-full border-2 border-slate-300 bg-white"
                style={{ width: "84mm", height: "84mm" }}
              >
                {cardIndices.map((symbolIdx, i) => {
                  const symbol = symbols[symbolIdx];
                  const placement = placements[i];

                  return (
                    <div
                      key={symbolIdx}
                      className="absolute"
                      style={{
                        left: `${placement.x}%`,
                        top: `${placement.y}%`,
                        transform: `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${placement.scale})`,
                      }}
                    >
                      {symbol.url ? (
                        <img
                          src={symbol.url}
                          alt="symbol"
                          className="pointer-events-none h-16 w-16 object-contain select-none"
                        />
                      ) : (
                        <div className="pointer-events-none flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-[10px] text-gray-300 select-none">
                          {symbolIdx}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tiny label outside the circle for cutting context (optional) */}
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-xs font-bold text-indigo-500 uppercase select-none">
                Twin Blitz - Card #{cardIdx + 1}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            margin: 0;
            size: ${dimensions[paperSize].width} ${dimensions[paperSize].height};
          }
          .print:break-after-page {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}
