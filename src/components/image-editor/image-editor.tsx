"use client";

import React, { useEffect, useState } from "react";

import dynamic from "next/dynamic";

import { X, Check, Crop as CropIcon, Scissors } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Transformation, MaskPath, generateSticker } from "@/lib/utils/image-processing";
import { useSymbolStore } from "@/store/use-symbol-store";

const CropTab = dynamic(() => import("./crop-tab").then((mod) => mod.CropTab), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading...</div>,
});
const MaskTab = dynamic(() => import("./mask-tab").then((mod) => mod.MaskTab), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading...</div>,
});

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
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-3 shadow-md transition-all sm:h-16 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-slate-800 active:bg-slate-700"
          >
            <X size={20} className="sm:h-6 sm:w-6" />
          </button>
          <h2 className="hidden text-base font-black tracking-tight sm:block lg:text-lg">EDITOR</h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950/50 p-1 ring-1 ring-white/5">
          <button
            onClick={() => setActiveTab("mask")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase transition-all sm:gap-2 sm:px-5 sm:py-2 sm:text-xs",
              activeTab === "mask"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-white",
            )}
          >
            <Scissors size={14} className="sm:h-4 sm:w-4" />
            <span>Mask</span>
          </button>
          <button
            onClick={() => setActiveTab("crop")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase transition-all sm:gap-2 sm:px-5 sm:py-2 sm:text-xs",
              activeTab === "crop"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-white",
            )}
          >
            <CropIcon size={14} className="sm:h-4 sm:w-4" />
            <span>Crop</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white uppercase shadow-lg transition-all hover:bg-emerald-500 hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-6 sm:py-2 sm:text-sm"
        >
          {isSaving ? (
            "..."
          ) : (
            <>
              <Check size={16} className="sm:h-5 sm:w-5" />
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
