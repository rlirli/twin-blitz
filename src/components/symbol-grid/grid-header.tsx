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
    <div className="mb-8 flex items-center justify-between">
      <div>
        <span className="bg-primary-soft text-primary mb-2 block inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
          Step 1
        </span>
        <h2 className="text-card-foreground mb-1 text-xl font-extrabold tracking-tight">
          Manage Symbols
        </h2>
        <p className="text-gray-500">Upload multiple unique symbols for your game.</p>
      </div>
      <div className="flex gap-3">
        <label
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            isBulkLoading || emptyCount === 0
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/90 hover:bg-primary text-primary-foreground cursor-pointer hover:brightness-110 active:scale-[0.98]"
          }`}
        >
          <FolderOpen size={18} />
          {isBulkLoading ? "Uploading…" : `Bulk Upload (${emptyCount} free)`}
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
          className="bg-primary/90 hover:bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
        >
          <Zap size={18} />
          Load Defaults
        </button>
        <button
          onClick={onClearAll}
          className="bg-muted text-muted-foreground hover:bg-muted-foreground/50 hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
        >
          <X size={18} />
          Clear All
        </button>
      </div>
    </div>
  );
};
