import React from "react";

import { Upload, X, Image as ImageIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { SymbolSlot as ISymbolSlot } from "@/store/use-symbol-store";

interface SymbolSlotProps {
  symbol: ISymbolSlot;
  onFileChange: (id: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
}

export const SymbolSlot: React.FC<SymbolSlotProps> = ({ symbol, onFileChange, onRemove }) => {
  return (
    <div className="group bg-primary/10 hover:border-primary hover:bg-primary/80 relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 p-2 transition-all">
      {symbol.url ? (
        <div className="relative flex h-full w-full items-center justify-center">
          {symbol.url.startsWith("icon:") ? (
            <div className="text-indigo-600">
              {(() => {
                const IconComp = (LucideIcons as any)[symbol.url.split(":")[1]];
                return IconComp ? (
                  React.createElement(IconComp, { size: 32 })
                ) : (
                  <ImageIcon size={32} />
                );
              })()}
            </div>
          ) : (
            <img
              src={symbol.url}
              alt={symbol.name}
              className="max-h-full max-w-full object-contain"
            />
          )}
          <button
            onClick={() => onRemove(symbol.id)}
            className="absolute -top-1 -right-1 rounded-full bg-red-500 p-1 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center">
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
