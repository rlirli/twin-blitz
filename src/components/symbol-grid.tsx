"use client";

import React, { useRef, useState } from "react";

import { FolderOpen, Upload, X, Image as ImageIcon, Zap } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { useSymbolStore } from "@/store/use-symbol-store";

/** Max pixel dimension images are scaled down to before storage (width & height). */
const SYMBOL_STORAGE_SIZE_PX = 300;

/**
 * Compress an image File to a JPEG data URL at SYMBOL_STORAGE_SIZE_PX × SYMBOL_STORAGE_SIZE_PX.
 * Runs entirely in the browser via the Canvas API — no server needed.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = SYMBOL_STORAGE_SIZE_PX;
      canvas.height = SYMBOL_STORAGE_SIZE_PX;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      // Scale image to fill the square, preserving aspect ratio (object-fit: contain)
      const scale = Math.min(
        SYMBOL_STORAGE_SIZE_PX / img.width,
        SYMBOL_STORAGE_SIZE_PX / img.height,
      );
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (SYMBOL_STORAGE_SIZE_PX - drawW) / 2;
      const offsetY = (SYMBOL_STORAGE_SIZE_PX - drawH) / 2;

      ctx.clearRect(0, 0, SYMBOL_STORAGE_SIZE_PX, SYMBOL_STORAGE_SIZE_PX);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      resolve(canvas.toDataURL("image/webp", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

const LUCIDE_ICON_NAMES = Object.keys(LucideIcons)
  .filter(
    (key) =>
      key !== "createLucideIcon" &&
      (typeof (LucideIcons as any)[key] === "function" ||
        typeof (LucideIcons as any)[key] === "object") &&
      /^[A-Z]/.test(key), // Lucide icons start with capital letters
  )
  .slice(0, 57);

interface BulkOverflowError {
  selected: number;
  available: number;
}

export const SymbolGrid: React.FC = () => {
  const { symbols, setSymbol, removeSymbol, clearAll } = useSymbolStore();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState<BulkOverflowError | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const handleFileChange = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setSymbol(id, compressed);
    } catch {
      // Fallback: store raw data URL if canvas compression fails
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setSymbol(id, event.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Find empty slots in order
    const emptySlots = symbols.filter((s) => s.url === null);
    const available = emptySlots.length;

    if (files.length > available) {
      setBulkError({ selected: files.length, available });
      // Reset the input so the same files can trigger onChange again if needed
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    setIsBulkLoading(true);
    // Compress and fill slots in parallel
    const results = await Promise.allSettled(files.map((file) => compressImage(file)));
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        setSymbol(emptySlots[i].id, result.value);
      }
    });
    setIsBulkLoading(false);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
  };

  const loadDefaults = () => {
    LUCIDE_ICON_NAMES.forEach((name, index) => {
      // We can't easily turn a Lucide icon into a data URL on the fly without a canvas,
      // so for now we'll just store the name and handle rendering accordingly.
      // But for simplicity in this prototype, let's use placeholder colors/initials
      // or just assume we'll render the icon if the URL starts with 'icon:'.
      setSymbol(index, `icon:${name}`);
    });
  };

  const emptyCount = symbols.filter((s) => s.url === null).length;

  return (
    <div
      className="bg-card border-border mb-10 rounded-2xl border px-8 py-6"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}
    >
      {/* Error dialog */}
      {bulkError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-gray-200 p-6 shadow-2xl dark:bg-black">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-card-foreground text-lg font-bold">Too many images</h3>
              <button
                onClick={() => setBulkError(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-muted-foreground mb-1 text-sm">
              You selected{" "}
              <span className="font-semibold text-red-600">{bulkError.selected} images</span>, but
              only{" "}
              <span className="font-semibold text-indigo-600">
                {bulkError.available} empty slot{bulkError.available !== 1 ? "s" : ""}
              </span>{" "}
              remain.
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Please select at most {bulkError.available} images, or clear some slots first.
            </p>
            <button
              onClick={() => setBulkError(null)}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="bg-primary-soft text-primary mb-2 block inline-flex w-fit items-center rounded-full py-1 pr-3 pl-0.5 text-[0.65rem] font-bold tracking-widest uppercase">
            Step 1
          </span>
          <h2 className="text-card-foreground mb-1 text-xl font-extrabold tracking-tight">
            Manage Symbols
          </h2>
          <p className="text-gray-500">Upload 57 unique symbols for your game.</p>
        </div>
        <div className="flex gap-3">
          {/* Bulk upload */}
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
              onChange={handleBulkUpload}
            />
          </label>

          <button
            onClick={loadDefaults}
            className="bg-primary/90 hover:bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
          >
            <Zap size={18} />
            Load Defaults
          </button>
          <button
            onClick={clearAll}
            className="bg-muted text-muted-foreground hover:bg-muted-foreground/50 hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
          >
            <X size={18} />
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {symbols.map((symbol) => (
          <div
            key={symbol.id}
            className="group bg-primary/10 hover:border-primary hover:bg-primary/80 relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 p-2 transition-all"
          >
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
                  onClick={() => removeSymbol(symbol.id)}
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
                  onChange={(e) => handleFileChange(symbol.id, e)}
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
