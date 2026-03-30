import React from "react";

import { FolderOpen, Zap, X } from "lucide-react";

interface GridHeaderProps {
  onBulkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadDefaults: () => void;
  onClearAll: () => void;
  isBulkLoading: boolean;
  emptyCount: number;
  bulkInputRef: React.RefObject<HTMLInputElement | null>;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  onBulkUpload,
  onLoadDefaults,
  onClearAll,
  isBulkLoading,
  emptyCount,
  bulkInputRef,
}) => {
  return (
    <div className="mb-8 flex flex-col gap-6">
      <div>
        <span className="bg-primary-soft text-primary mb-2 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
          Step 1
        </span>
        <h2 className="text-card-foreground mb-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          Upload Symbols
        </h2>
        <p className="text-sm text-gray-500 md:text-base">
          Upload multiple unique symbols for your game. Click on uploaded symbol to clip or remove.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <div className="contents sm:flex sm:items-center sm:gap-3">
          <label
            className={`col-span-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto sm:py-2 md:text-base ${
              isBulkLoading || emptyCount === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary/90 text-primary-foreground cursor-pointer hover:brightness-110 active:scale-[0.98]"
            }`}
          >
            <FolderOpen size={18} className="shrink-0" />
            <span className="truncate">
              {isBulkLoading ? "Uploading…" : `Bulk Upload (${emptyCount} free)`}
            </span>
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={isBulkLoading || emptyCount === 0}
              onChange={onBulkUpload}
            />
          </label>

          <button
            onClick={onLoadDefaults}
            className="bg-primary/90 text-primary-foreground hover:bg-primary col-span-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] sm:w-auto sm:py-2 md:text-base"
          >
            <Zap size={18} className="shrink-0" />
            <span className="truncate">Defaults</span>
          </button>
        </div>

        <button
          onClick={onClearAll}
          className="bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground col-span-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.98] sm:w-auto sm:py-2 md:text-base"
        >
          <X size={18} className="shrink-0" />
          <span className="truncate">Clear All</span>
        </button>
      </div>
    </div>
  );
};
