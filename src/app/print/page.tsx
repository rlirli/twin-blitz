"use client";

import React, { useState, useMemo } from "react";

import Link from "next/link";

import { ArrowLeft, Printer, FileDown } from "lucide-react";

import { AppLogo } from "@/components/shared";
import { cn } from "@/lib/utils/cn";
import { generateProjectivePlane } from "@/lib/utils/game-core";
import { exportCardsToZip } from "@/lib/utils/image-zip-exporter";
import { getCardPlacements } from "@/lib/utils/layout-engine";
import { useDeckSettingsStore } from "@/store/use-settings-store";
import { useSymbolStore } from "@/store/use-symbol-store";

type PaperSize = "9x13" | "10x15" | "13x18";

export default function PrintPage() {
  const { symbols } = useSymbolStore();
  const { order, totalCardCount, symbolsPerCard } = useDeckSettingsStore();
  const [paperSize, setPaperSize] = useState<PaperSize>("10x15");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const rawCards = useMemo(
    () => generateProjectivePlane(order).slice(0, totalCardCount),
    [order, totalCardCount],
  );

  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportCardsToZip(rawCards, symbols, symbolsPerCard, paperSize, (count) => {
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
      {/* ── Navigation ── */}
      <nav className="absolute top-8 left-8 z-50 print:hidden">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Editor
        </Link>
      </nav>

      {/* ── Print Settings & Header ── */}
      <header className="mx-auto max-w-2xl px-6 pt-16 pb-12 text-center print:hidden">
        <div className="mb-6 flex justify-center">
          <AppLogo size="sm" />
        </div>
        <h1 className="text-foreground mb-4 text-4xl font-black tracking-tighter">
          Print Preparation
        </h1>
        <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
          Your card deck is ready. Choose your photo paper size below to generate the correctly
          scaled cutting sheets.
        </p>
        <div className="bg-card border-border rounded-2xl border p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
          <div className="mb-8">
            <label className="text-muted-foreground mb-3 block text-xs font-bold tracking-widest uppercase">
              Paper Size
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {(["9x13", "10x15", "13x18"] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  className={cn(
                    "rounded-xl border-2 px-6 py-3 text-sm font-bold transition-all active:scale-[0.98]",
                    paperSize === size
                      ? "bg-primary-soft border-primary text-primary"
                      : "bg-muted border-transparent border-zinc-200/20 text-zinc-500 hover:border-zinc-200",
                  )}
                >
                  {size} cm
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => window.print()}
              className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-4 font-bold transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ boxShadow: "0 8px 24px var(--primary-glow)" }}
            >
              <Printer size={20} />
              Print My Deck (.pdf)
            </button>

            <button
              onClick={handleExportZip}
              disabled={isExporting}
              className={cn(
                "flex flex-1 items-center justify-center gap-2.5 rounded-xl border-2 px-4 py-4 font-bold transition-all active:scale-[0.98]",
                "hover:border-primary",
                isExporting
                  ? "bg-muted text-muted-foreground cursor-not-allowed border-transparent"
                  : "bg-primary-soft border-primary/20 text-primary hover:bg-primary-soft/80",
              )}
            >
              <FileDown size={20} className={cn(isExporting && "hidden")} />
              {isExporting ? (
                <>
                  <span className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  ({exportProgress}/{totalCardCount})
                </>
              ) : (
                "Export as Images (.zip)"
              )}
            </button>
          </div>

          <p className="text-muted-foreground/80 mt-4 text-sm font-medium">
            For <b>Cewe Sofortfotos</b> use 10x15 cm format and image export.
          </p>
        </div>
      </header>

      {/* ── Pages for Printing ── */}
      <div className="flex flex-col items-center gap-12 pb-24 print:block print:gap-0 print:pb-0">
        {rawCards.map((cardIndices, cardIdx) => {
          const placements = getCardPlacements(cardIdx, symbolsPerCard);

          return (
            <div
              key={cardIdx}
              className="relative flex items-center justify-center bg-white shadow-2xl print:mb-0 print:break-after-page print:border-0 print:shadow-none"
              style={{
                width: dimensions[paperSize].width,
                height: dimensions[paperSize].height,
              }}
            >
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

              <div className="text-primary pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-sm font-bold tracking-tighter uppercase select-none">
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
