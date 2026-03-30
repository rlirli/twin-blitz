"use client";

import React, { useEffect, useState } from "react";

import { X, Check, Crop as CropIcon, Scissors } from "lucide-react";

import { Transformation, MaskPath, generateSticker } from "@/lib/utils/image-processing";
import { useSymbolStore } from "@/store/use-symbol-store";

import { CropTab } from "./crop-tab";
import { MaskTab } from "./mask-tab";

interface ImageEditorProps {
  slotId: number;
  onClose: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ slotId, onClose }) => {
  const { symbols, updateTransformation, updateMaskData, setSymbolResult, getSourceImage } =
    useSymbolStore();
  const symbol = symbols.find((s) => s.id === slotId);

  const [activeTab, setActiveTab] = useState<"mask" | "crop">("mask");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for the editor, initialized from the store
  const [transformation, setTransformation] = useState<Transformation>(
    symbol?.transformation || { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
  );
  const [maskData, setMaskData] = useState<MaskPath[]>(symbol?.maskData || []);

  useEffect(() => {
    async function loadSource() {
      const url = await getSourceImage(slotId);
      if (url) {
        setSourceUrl(url);
      } else if (symbol?.url) {
        // Fallback for legacy icons
        setSourceUrl(symbol.url);
      }
    }
    loadSource();
  }, [slotId, symbol, getSourceImage]);

  const handleSave = async () => {
    if (!sourceUrl || !symbol) return;
    setIsSaving(true);
    try {
      // 1. Update the "Recipe" in the store
      updateTransformation(slotId, transformation);
      updateMaskData(slotId, maskData);

      // 2. Generate the final 300px "Sticker"
      const resultUrl = await generateSticker(sourceUrl, transformation, maskData);

      // 3. Store the result
      setSymbolResult(slotId, resultUrl);
      onClose();
    } catch (err) {
      console.error("Failed to save sticker:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!sourceUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="animate-pulse text-xl font-medium text-white">Loading Source Image...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-900 text-white select-none">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-slate-700"
          >
            <X size={24} />
          </button>
          <h2 className="text-lg font-bold tracking-tight">Professional Editor</h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-950 p-1">
          <button
            onClick={() => setActiveTab("mask")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === "mask"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Scissors size={16} />
            <span>Mask</span>
          </button>
          <button
            onClick={() => setActiveTab("crop")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === "crop"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CropIcon size={16} />
            <span>Crop</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white shadow-md transition-all hover:bg-emerald-500 hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            "Saving..."
          ) : (
            <>
              <Check size={20} />
              <span>Done</span>
            </>
          )}
        </button>
      </header>

      {/* Main Workbench */}
      <main className="relative flex-1 overflow-hidden bg-slate-950">
        {activeTab === "mask" ? (
          <MaskTab
            sourceUrl={sourceUrl}
            transformation={transformation}
            maskData={maskData}
            onUpdateMask={setMaskData}
          />
        ) : (
          <CropTab
            sourceUrl={sourceUrl}
            transformation={transformation}
            onUpdateTransformation={setTransformation}
          />
        )}
      </main>
    </div>
  );
};
