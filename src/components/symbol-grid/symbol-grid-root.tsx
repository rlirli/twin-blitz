"use client";

import React, { useRef, useState } from "react";

import * as LucideIcons from "lucide-react";

import { compressImage } from "@/lib/utils/image-processing";
import { useSymbolStore } from "@/store/use-symbol-store";

import { BulkErrorDialog, BulkErrorData } from "./bulk-error-dialog";
import { GridHeader } from "./grid-header";
import { SymbolSlot } from "./symbol-slot";

const LUCIDE_ICON_NAMES = Object.keys(LucideIcons)
  .filter(
    (key) =>
      key !== "createLucideIcon" &&
      (typeof (LucideIcons as any)[key] === "function" ||
        typeof (LucideIcons as any)[key] === "object") &&
      /^[A-Z]/.test(key),
  )
  .slice(0, 57);

export const SymbolGrid: React.FC = () => {
  const { symbols, setSymbol, setBulkSymbols, removeSymbol, clearAll } = useSymbolStore();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState<BulkErrorData | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const handleFileChange = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setSymbol(id, compressed);
    } catch (err: any) {
      if (err.name === "QuotaExceededError" || err.message?.includes("quota")) {
        setBulkError({ type: "quota" });
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) setSymbol(id, event.target.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const emptySlots = symbols.filter((s) => s.url === null);
    const available = emptySlots.length;

    if (files.length > available) {
      setBulkError({ type: "overflow", selected: files.length, available });
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    setIsBulkLoading(true);
    try {
      const results = await Promise.allSettled(files.map((file) => compressImage(file)));
      const updates = results
        .map((result, i) =>
          result.status === "fulfilled" ? { id: emptySlots[i].id, url: result.value } : null,
        )
        .filter((u): u is { id: number; url: string } => u !== null);

      if (updates.length > 0) {
        setBulkSymbols(updates);
      }
    } catch (err: any) {
      if (err.name === "QuotaExceededError" || err.message?.includes("quota")) {
        setBulkError({ type: "quota" });
      }
    } finally {
      setIsBulkLoading(false);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const loadDefaults = () => {
    const updates = LUCIDE_ICON_NAMES.map((name, index) => ({
      id: index,
      url: `icon:${name}`,
    }));
    setBulkSymbols(updates);
  };

  const emptyCount = symbols.filter((s) => s.url === null).length;

  return (
    <div className="bg-card border-border mb-10 rounded-2xl border px-8 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
      <BulkErrorDialog error={bulkError} onClose={() => setBulkError(null)} />

      <GridHeader
        onBulkUpload={handleBulkUpload}
        onLoadDefaults={loadDefaults}
        onClearAll={clearAll}
        isBulkLoading={isBulkLoading}
        emptyCount={emptyCount}
        bulkInputRef={bulkInputRef}
      />

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {symbols.map((symbol) => (
          <SymbolSlot
            key={symbol.id}
            symbol={symbol}
            onFileChange={handleFileChange}
            onRemove={removeSymbol}
          />
        ))}
      </div>
    </div>
  );
};
