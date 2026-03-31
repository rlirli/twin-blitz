import React, { useState, useRef, useEffect } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles, Download, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { aiSegmentationService } from "../ai-segmentation.service";
import { AVAILABLE_MODELS, ModelId, ModelInfo } from "../models/model-constants";

interface ModelSelectorProps {
  currentModel: ModelInfo | null;
  onSelect: (modelId: ModelId) => void;
  isLoading: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onSelect,
  isLoading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cachedModels, setCachedModels] = useState<Set<ModelId>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkCache = async () => {
      const cached = new Set<ModelId>();
      for (const id of Object.keys(AVAILABLE_MODELS) as ModelId[]) {
        if (await aiSegmentationService.isModelCached(id)) {
          cached.add(id);
        }
      }
      setCachedModels(cached);
    };
    checkCache();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (modelId: ModelId) => {
    if (!cachedModels.has(modelId)) {
      const model = AVAILABLE_MODELS[modelId];
      if (
        !window.confirm(
          `This model (${model.sizeMB}MB) will be downloaded and cached in your browser. Proceed?`,
        )
      ) {
        return;
      }
    }
    onSelect(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-bold ring-1 ring-white/10 backdrop-blur-xl transition-all hover:bg-slate-800",
          !currentModel && "text-amber-400 ring-amber-500/50",
        )}
      >
        <Sparkles size={14} className={cn(isLoading && "animate-pulse")} />
        <span>{currentModel ? currentModel.name : "Select AI Model"}</span>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin opacity-50" />
        ) : (
          <ChevronDown size={14} className="opacity-50" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={cn(
                "fixed inset-x-4 top-[20%] bottom-auto z-50 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl backdrop-blur-2xl sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-64 sm:rounded-xl",
                "max-h-[60vh] overflow-y-auto",
              )}
            >
              <div className="mb-2 px-3 py-1 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                Segmentation Models
              </div>
              <div className="flex flex-col gap-1">
                {(Object.values(AVAILABLE_MODELS) as ModelInfo[]).map((model) => {
                  const isActive = currentModel?.id === model.id;
                  const isCached = cachedModels.has(model.id as ModelId);

                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelect(model.id as ModelId)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all",
                        isActive
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "text-slate-300 hover:bg-white/5",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{model.name}</span>
                        <span className="text-[10px] opacity-50">
                          {model.sizeMB}MB • Version {model.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && <Check size={14} className="text-indigo-400" />}
                        {!isCached && <Download size={14} className="opacity-30" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
