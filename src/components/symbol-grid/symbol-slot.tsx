import React from "react";

import { Upload, X, Scissors } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { SymbolData } from "@/store/use-symbol-store";

interface SymbolSlotProps {
  symbol: SymbolData;
  isFocused: boolean;
  onFocus: () => void;
  onFileChange: (id: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
  onEdit: (id: number) => void;
}

export const SymbolSlot: React.FC<SymbolSlotProps> = ({
  symbol,
  isFocused,
  onFocus,
  onFileChange,
  onRemove,
  onEdit,
}) => {
  const hasSymbolFilled = symbol.url;

  const handleContainerClick = () => {
    // If we click the container (not a button), toggle focus
    if (hasSymbolFilled) {
      onFocus();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        "group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl transition-all",
        "hover:border-primary border border-dashed sm:border-2",

        hasSymbolFilled ? "dark:bg-primary bg-primary/20 dark:border-transparent" : "bg-primary/10",
        isFocused ? "border-primary border-solid" : "border-muted-foreground/20",
      )}
    >
      {hasSymbolFilled ? (
        <div className="relative flex h-full w-full items-center justify-center p-2">
          <img
            src={symbol.url!}
            alt={symbol.name}
            className="max-h-full max-w-full object-contain"
          />

          {/* Action Overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center gap-2 bg-black/40 transition-opacity ${
              isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(symbol.id);
              }}
              className="rounded-full bg-white p-2 text-indigo-600 shadow-lg transition-transform hover:scale-110 active:scale-95"
              title="Edit Mask"
            >
              <Scissors size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(symbol.id);
              }}
              className="rounded-full bg-white p-2 text-red-600 shadow-lg transition-transform hover:scale-110 active:scale-95"
              title="Clear Slot"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center p-2">
          <Upload size={20} className="text-muted-foreground group-hover:text-primary mb-1" />
          <span className="text-muted-foreground group-hover:text-primary text-[10px] font-medium tracking-wider uppercase">
            Slot {symbol.id + 1}
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => onFileChange(symbol.id, e)}
          />
        </label>
      )}
    </div>
  );
};
