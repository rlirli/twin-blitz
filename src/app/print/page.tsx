"use client";

import React, { useState, useMemo } from "react";

import Link from "next/link";

import * as LucideIcons from "lucide-react";
import { ArrowLeft, Printer, Settings2 } from "lucide-react";

import { generateProjectivePlane } from "@/lib/utils/game-core";
import { useSymbolStore } from "@/store/use-symbol-store";

type PaperSize = "9x13" | "13x18";

export default function PrintPage() {
  const { symbols } = useSymbolStore();
  const [paperSize, setPaperSize] = useState<PaperSize>("9x13");
  const rawCards = useMemo(() => generateProjectivePlane(7), []);

  const dimensions = {
    "9x13": { width: "90mm", height: "130mm" },
    "13x18": { width: "130mm", height: "180mm" },
  };

  // Positions for 8 symbols (same logic as preview for consistency)
  const getSymbolPlacement = (seed: number, index: number) => {
    const layout = [
      { x: 50, y: 50, scale: 1.2 },
      { x: 30, y: 30, scale: 0.9 },
      { x: 70, y: 30, scale: 1.1 },
      { x: 30, y: 70, scale: 0.8 },
      { x: 70, y: 70, scale: 1.0 },
      { x: 50, y: 22, scale: 0.95 },
      { x: 50, y: 78, scale: 1.05 },
      { x: 22, y: 50, scale: 0.85 },
      { x: 78, y: 50, scale: 1.15 },
    ];
    const pos = layout[index];
    // In print, we might want to stabilize rotation for clarity or keep it random
    // Let's keep it random for the game's challenge
    const rotation = (seed + index * 45) % 360;

    return {
      left: `${pos.x}%`,
      top: `${pos.y}%`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${pos.scale})`,
    };
  };

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
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
              {(["9x13", "13x18"] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm transition-all ${
                    paperSize === size
                      ? "border-indigo-600 bg-indigo-50 font-bold text-indigo-700"
                      : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
                  }`}
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
      <div className="mx-auto max-w-2xl p-12 text-center print:hidden">
        <h1 className="mb-4 text-3xl font-bold text-gray-800">Print Preparation</h1>
        <p className="mb-8 text-gray-600">
          We have generated 57 cards. Each will be centered on a separate page. When you click
          "Print", make sure to set:
        </p>
        <ul className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-left font-medium text-indigo-900">
          <li className="flex gap-3">
            ✅ <span className="font-bold">Layout:</span> Portrait
          </li>
          <li className="flex gap-3">
            ✅ <span className="font-bold">Paper Size:</span>{" "}
            {paperSize === "9x13" ? "4x6 in (roughly)" : "5x7 in (roughly)"}
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
        {rawCards.map((cardIndices, cardIdx) => (
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
              className="relative overflow-hidden rounded-full border border-gray-100 bg-white shadow-[0_0_20px_rgba(0,0,0,0.02)]"
              style={{ width: "84mm", height: "84mm" }}
            >
              {cardIndices.map((symbolIdx, i) => {
                const symbol = symbols[symbolIdx];
                const placement = getSymbolPlacement(cardIdx * 100, i);

                return (
                  <div key={symbolIdx} className="absolute" style={placement}>
                    {symbol.url ? (
                      symbol.url.startsWith("icon:") ? (
                        <div className="text-gray-900">
                          {(() => {
                            const IconComp = (LucideIcons as any)[symbol.url.split(":")[1]];
                            return IconComp ? (
                              React.createElement(IconComp, { size: 48 })
                            ) : (
                              <LucideIcons.Image size={48} />
                            );
                          })()}
                        </div>
                      ) : (
                        <img src={symbol.url} alt="symbol" className="h-16 w-16 object-contain" />
                      )
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-[10px] text-gray-300">
                        {symbolIdx}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tiny label outside the circle for cutting context (optional) */}
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[8px] text-gray-200">
              Twin Blitz - Card #{cardIdx + 1}
            </div>
          </div>
        ))}
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
