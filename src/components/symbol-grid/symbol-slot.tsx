import React, { useState } from "react";

import { Upload, X, Scissors } from "lucide-react";

import { SymbolData } from "@/store/use-symbol-store";

interface SymbolSlotProps {
  symbol: SymbolData;
  onFileChange: (id: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
  onEdit: (id: number) => void;
}

export const SymbolSlot: React.FC<SymbolSlotProps> = ({
  symbol,
  onFileChange,
  onRemove,
  onEdit,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleContainerClick = () => {
    // If we click the container (not a button), toggle focus
    if (symbol.url) {
      setIsFocused(!isFocused);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`group bg-primary/10 hover:border-primary relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all ${
        isFocused ? "border-primary ring-primary/20 ring-2" : "border-gray-200"
      }`}
    >
      {symbol.url ? (
        <div className="relative flex h-full w-full items-center justify-center p-2">
          <img
            src={symbol.url}
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
          <Upload size={20} className="mb-1 text-gray-400 group-hover:text-indigo-500" />
          <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase group-hover:text-indigo-500">
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
