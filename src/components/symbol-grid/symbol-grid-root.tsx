"use client";

import React, { useRef, useState } from "react";

import * as LucideIcons from "lucide-react";

import { TOTAL_SYMBOLS } from "@/lib/constants";
import {
  lucideIconToImageUrl,
  compressImage,
  normalizeSourceImage,
} from "@/lib/utils/image-processing";
import { useSymbolStore } from "@/store/use-symbol-store";

import { ImageEditor } from "../image-editor/image-editor";
import { BulkErrorDialog, BulkErrorData } from "./bulk-error-dialog";
import { GridHeader } from "./grid-header";
import { SymbolSlot } from "./symbol-slot";

const LUCIDE_ICON_NAMES = Object.keys(LucideIcons)
  .filter(
    (key) =>
      key !== "createLucideIcon" &&
      !key.endsWith("Icon") && // Filter out duplicate names with "Icon" suffix
      (typeof (LucideIcons as any)[key] === "function" ||
        typeof (LucideIcons as any)[key] === "object") &&
      /^[A-Z]/.test(key),
  )
  .slice(0, TOTAL_SYMBOLS);

export const SymbolGrid: React.FC = () => {
  const { symbols, setSymbolWithSource, removeSymbol, clearAll } = useSymbolStore();
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkError, setBulkError] = useState<BulkErrorData | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [focusedSlotId, setFocusedSlotId] = useState<number | null>(null);

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
        // Fallback for non-WebP browsers or other issues
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

    const emptySlots = symbols.filter((s) => s.url === null);
    const available = emptySlots.length;

    if (files.length > available) {
      setBulkError({ type: "overflow", selected: files.length, available });
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      return;
    }

    setIsBulkLoading(true);
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
      setIsBulkLoading(false);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const loadDefaults = async () => {
    setIsBulkLoading(true);
    try {
      const emptySlots = symbols.filter((s) => s.url === null);
      for (const slot of emptySlots) {
        const name = LUCIDE_ICON_NAMES[slot.id];
        if (!name) continue;
        const imageUrl = await lucideIconToImageUrl(LucideIcons as any, name);
        // For icons, preview and source are the same for now
        await setSymbolWithSource(slot.id, imageUrl, imageUrl);
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  const emptyCount = symbols.filter((s) => s.url === null).length;

  return (
    <div className="bg-card border-border mb-10 rounded-2xl border px-8 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
      <BulkErrorDialog error={bulkError} onClose={() => setBulkError(null)} />

      {editingSlotId !== null && (
        <ImageEditor slotId={editingSlotId} onClose={() => setEditingSlotId(null)} />
      )}

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
  );
};
