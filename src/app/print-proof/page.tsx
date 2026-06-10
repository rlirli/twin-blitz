"use client";

import React, { useState, useMemo } from "react";

import Link from "next/link";

import { ArrowLeft, Printer, FileDown } from "lucide-react";

import { PrintProofGrid } from "@/components/print-proof/print-proof-grid";
import { exportProofPagesToZip } from "@/components/print-proof/proof-exporter";
import { getProofGridCapacity } from "@/components/print-proof/proof-layout";
import { AppLogo } from "@/components/shared";
import { PaperSize, PAPER_SIZES, DEFAULT_PAPER_SIZE } from "@/lib/print/print-layout";
import { cn } from "@/lib/utils/cn";
import { useDeckSettingsStore } from "@/store/use-deck-settings-store";
import { useSymbolStore } from "@/store/use-symbol-store";

export default function PrintProofPage() {
  const { symbols } = useSymbolStore();
  const { totalSymbolCount } = useDeckSettingsStore();
  const [paperSize, setPaperSize] = useState<PaperSize>(DEFAULT_PAPER_SIZE);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const activeSymbols = useMemo(
    () => symbols.slice(0, totalSymbolCount),
    [symbols, totalSymbolCount],
  );

  const { symbolsPerPage } = getProofGridCapacity(paperSize);
  const totalPages = Math.ceil(activeSymbols.length / symbolsPerPage);

  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportProofPagesToZip(activeSymbols, paperSize, (count) => {
        setExportProgress(count);
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `twin-blitz-print-proof-${paperSize}cm.zip`;
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
          Print Proof Sheet
        </h1>
        <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
          Verify symbol print colors and legibility on your paper. All active symbols are listed
          upright in a clean grid.
        </p>
        <div className="bg-card border-border rounded-2xl border p-8 shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
          <div className="mb-8">
            <label className="text-muted-foreground mb-3 block text-xs font-bold tracking-widest uppercase">
              Paper Size
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {PAPER_SIZES.map((size) => (
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
              Print Proof (.pdf)
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
                  ({exportProgress}/{totalPages})
                </>
              ) : (
                "Export Pages (.zip)"
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Proof Grid Sheets ── */}
      <PrintProofGrid symbols={activeSymbols} paperSize={paperSize} />
    </div>
  );
}
