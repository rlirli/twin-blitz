import React from "react";

import { FolderOpen, Zap, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { DeckSizeSelector } from "./deck-size-selector";

interface GridHeaderProps {
  onBulkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDefaults: () => void;
  onClearAll: () => void;
  isBulkUploading: boolean;
  isDefaultLoading: boolean;
  emptyCount: number;
  bulkInputRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  onBulkUpload,
  onLoadDefaults,
  onClearAll,
  isBulkUploading,
  isDefaultLoading,
  emptyCount,
  bulkInputRef,
  className,
}) => {
  const isAnyLoading = isBulkUploading || isDefaultLoading;

  return (
    <div className={cn("mb-8 flex flex-col gap-8", className)}>
      {/* ── Title Section ── */}
      <div className="flex flex-col gap-2">
        <span className="bg-primary-soft text-primary mb-1 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
          Step 1
        </span>
        <h2 className="text-card-foreground text-2xl font-extrabold tracking-tight md:text-3xl">
          Configure Deck & Symbols
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
          Upload unique symbols for your game. Every pair of cards will always have exactly one
          match.
        </p>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 lg:flex-row lg:flex-nowrap lg:gap-8">
        {/* Left: Configuration (Context) */}
        <div className="w-full min-w-0 flex-shrink-0 lg:w-auto">
          <DeckSizeSelector />
        </div>

        {/* Right: Icon Actions (Filling) */}
        <div className="grid min-w-0 flex-1 grid-cols-2 flex-wrap gap-2 sm:flex sm:items-center sm:justify-start sm:gap-3 lg:justify-end">
          <label
            className={cn(
              "col-span-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:w-auto sm:py-2 md:text-base lg:px-6",
              isAnyLoading || emptyCount === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground cursor-pointer hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]",
            )}
            style={
              !isAnyLoading && emptyCount > 0 ? { boxShadow: "0 4px 12px var(--primary-glow)" } : {}
            }
          >
            <FolderOpen size={18} className="shrink-0" />
            <span className="truncate">
              {isBulkUploading ? "Uploading…" : `Bulk Upload (${emptyCount})`}
            </span>
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={isAnyLoading || emptyCount === 0}
              onChange={onBulkUpload}
            />
          </label>

          <button
            onClick={onLoadDefaults}
            disabled={isAnyLoading || emptyCount === 0}
            className={cn(
              "bg-primary-soft text-primary col-span-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:w-auto sm:py-2 md:text-base lg:px-6",
              isAnyLoading || emptyCount === 0
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-primary/10 active:scale-[0.98]",
            )}
          >
            <Zap size={18} className="shrink-0" />
            <span className="truncate">{isDefaultLoading ? "Icon Pack" : "Default Icons"}</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={isAnyLoading}
            className={cn(
              "bg-muted text-muted-foreground col-span-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] sm:w-auto sm:py-2 md:text-base lg:px-6",
              isAnyLoading
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            <X size={18} className="shrink-0" />
            <span className="truncate">Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
};
