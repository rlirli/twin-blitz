"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";

import * as LucideIcons from "lucide-react";
import { useQueryState, parseAsInteger, parseAsStringLiteral } from "nuqs";

import { cn } from "@/lib/utils/cn";
import {
  lucideIconToImageUrl,
  compressImage,
  normalizeSourceImage,
} from "@/lib/utils/image-processing";
import { useDeckSettingsStore } from "@/store/use-settings-store";
import { useSymbolStore } from "@/store/use-symbol-store";

import { ImageEditor } from "../image-editor/image-editor";
import { BulkErrorDialog, BulkErrorData } from "./bulk-error-dialog";
import { GridHeader } from "./grid-header";
import { SymbolSlot } from "./symbol-slot";

export const SymbolGrid: React.FC = () => {
  const { totalSymbolCount } = useDeckSettingsStore();
  const { symbols, setSymbolWithSource, removeSymbol, clearAll } = useSymbolStore();

  const activeSymbols = useMemo(
    () => symbols.slice(0, totalSymbolCount),
    [symbols, totalSymbolCount],
  );

  const lucideIconNames = useMemo(
    () =>
      Object.keys(LucideIcons)
        .filter(
          (key) =>
            key !== "createLucideIcon" &&
            !key.endsWith("Icon") &&
            (typeof (LucideIcons as any)[key] === "function" ||
              typeof (LucideIcons as any)[key] === "object") &&
            /^[A-Z]/.test(key),
        )
        .slice(0, totalSymbolCount),
    [totalSymbolCount],
  );

  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState<BulkErrorData | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isDefaultLoading, setIsDefaultLoading] = useState(false);
  const [editingSlotId, setEditingSlotId] = useQueryState(
    "symbol",
    parseAsInteger.withOptions({ shallow: true, history: "push" }),
  );
  const [_, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["mask", "crop"] as const).withOptions({ shallow: true }),
  );
  const [focusedSlotId, setFocusedSlotId] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { hasHydrated } = useSymbolStore();

  // Validate editingSlotId from URL
  useEffect(() => {
    if (editingSlotId !== null && hasHydrated) {
      const symbol = symbols.find((s) => s.id === editingSlotId);
      // Symbols up to totalSymbolCount are available
      if (editingSlotId >= totalSymbolCount || !symbol || symbol.url === null) {
        setEditingSlotId(null);
        setTab(null);
      }
    }
  }, [editingSlotId, symbols, totalSymbolCount, hasHydrated, setEditingSlotId, setTab]);

  const handleFileChange = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const sourceUrl = await normalizeSourceImage(file);
      const previewUrl = await compressImage(file);
      await setSymbolWithSource(id, previewUrl, sourceUrl);
      setFocusedSlotId(id);
    } catch (err: any) {
      if (err.name === "QuotaExceededError" || err.message?.includes("quota")) {
        setBulkError({ type: "quota" });
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            const dataUrl = event.target.result as string;
            await setSymbolWithSource(id, dataUrl, dataUrl);
            setFocusedSlotId(id);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const emptySlots = activeSymbols.filter((s) => s.url === null);
    const available = emptySlots.length;

    if (files.length > available) {
      setBulkError({ type: "overflow", selected: files.length, available });
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    setIsBulkUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sourceUrl = await normalizeSourceImage(file);
        const previewUrl = await compressImage(file);
        await setSymbolWithSource(emptySlots[i].id, previewUrl, sourceUrl);
      }
    } catch (err: any) {
      if (err.name === "QuotaExceededError" || err.message?.includes("quota")) {
        setBulkError({ type: "quota" });
      }
    } finally {
      setIsBulkUploading(false);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const loadDefaults = async () => {
    setIsDefaultLoading(true);
    try {
      const emptySlots = activeSymbols.filter((s) => s.url === null);
      for (const slot of emptySlots) {
        const name = lucideIconNames[slot.id];
        if (!name) continue;
        const imageUrl = await lucideIconToImageUrl(LucideIcons as any, name);
        await setSymbolWithSource(slot.id, imageUrl, imageUrl);
      }
    } finally {
      setIsDefaultLoading(false);
    }
  };

  const emptyCount = activeSymbols.filter((s) => s.url === null).length;

  return (
    <div className="bg-card border-border mb-6 rounded-2xl border pt-6 pb-1 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
      <BulkErrorDialog error={bulkError} onClose={() => setBulkError(null)} />

      {editingSlotId !== null && (
        <ImageEditor slotId={editingSlotId} onClose={() => setEditingSlotId(null)} />
      )}

      <GridHeader
        onBulkUpload={handleBulkUpload}
        onLoadDefaults={loadDefaults}
        onClearAll={clearAll}
        isBulkUploading={isBulkUploading}
        isDefaultLoading={isDefaultLoading}
        emptyCount={emptyCount}
        bulkInputRef={bulkInputRef}
        className="px-8"
      />

      <div className="relative">
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-in-out",
            !isExpanded
              ? "max-h-[190px] sm:max-h-[180px] md:max-h-[160px] lg:max-h-[170px]"
              : "max-h-[50000px]",
          )}
        >
          <div className="grid grid-cols-3 gap-4 px-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {activeSymbols.map((symbol) => (
              <SymbolSlot
                key={symbol.id}
                symbol={symbol}
                isFocused={focusedSlotId === symbol.id}
                onFocus={() => setFocusedSlotId(focusedSlotId === symbol.id ? null : symbol.id)}
                onFileChange={handleFileChange}
                onRemove={(id) => {
                  removeSymbol(id);
                  if (focusedSlotId === id) setFocusedSlotId(null);
                }}
                onEdit={(id) => setEditingSlotId(id)}
              />
            ))}
          </div>
        </div>

        {!isExpanded && (
          <div className="from-card via-card/80 pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t to-transparent" />
        )}
      </div>

      <div
        className={cn(
          "border-muted flex justify-center border-t border-dashed pt-1",
          isExpanded ? "mt-4" : "mt-0",
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:bg-primary/5 flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold transition-all active:scale-95"
        >
          {isExpanded ? (
            <>
              <LucideIcons.ChevronUp size={20} />
              Show Less
            </>
          ) : (
            <>
              <LucideIcons.ChevronDown size={20} />
              Show All {totalSymbolCount} Symbols
            </>
          )}
        </button>
      </div>
    </div>
  );
};
