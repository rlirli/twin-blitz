import React, { useState, useRef, useEffect } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles, Download, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { aiSegmentationService, DownloadProgress } from "../ai-segmentation.service";
import { AVAILABLE_MODELS, ModelId, ModelInfo } from "../models/model-constants";

interface ModelSelectorProps {
  currentModel: ModelInfo | null;
  loadingModelId?: ModelId | null;
  onSelect: (modelId: ModelId) => void;
  isLoading: boolean;
  downloadProgress?: DownloadProgress | null;
  error?: string | null;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  loadingModelId,
  onSelect,
  isLoading,
  downloadProgress,
  error,
  className,
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
  }, [isOpen, isLoading]);

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
          `This model (${model.sizeMB.toFixed(1)}MB) will be downloaded and cached in your browser. Proceed?`,
        )
      ) {
        return;
      }
    }
    onSelect(modelId);
    setIsOpen(false);
  };

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  const hasAnyCached = cachedModels.size > 0;
  const isDownloading = isLoading && downloadProgress;

  // What to display in the trigger
  const displayModel = loadingModelId ? AVAILABLE_MODELS[loadingModelId] : currentModel;

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-full items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-bold ring-1 ring-white/10 backdrop-blur-xl transition-all hover:bg-slate-800",
          !displayModel && !hasAnyCached && "animate-pulse text-amber-400 ring-amber-500/50",
          !displayModel && hasAnyCached && "text-slate-400 ring-white/10",
        )}
      >
        <Sparkles
          size={14}
          className={cn((isLoading || isDownloading) && "animate-pulse text-indigo-400")}
        />
        <div className="flex flex-col items-start leading-tight">
          <span
            className={cn(
              (isDownloading || (isLoading && !isDownloading)) && "animate-pulse text-indigo-400",
              error && "text-rose-400",
            )}
          >
            {error
              ? "Download Failed"
              : displayModel
                ? displayModel.name
                : hasAnyCached
                  ? "Select AI Model"
                  : "Download Model to Start"}
          </span>
          {isDownloading ? (
            <span className="mt-0.5 font-mono text-[9px] text-indigo-400">
              Downloading ({formatMB(downloadProgress.loaded)} / {formatMB(downloadProgress.total)}{" "}
              MB)
            </span>
          ) : error ? (
            <span className="mt-0.5 max-w-[140px] truncate text-[9px] font-medium text-rose-500/80">
              {error}
            </span>
          ) : null}
        </div>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin opacity-50" />
        ) : (
          <ChevronDown size={14} className="opacity-50" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
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
                "fixed inset-x-4 top-[20%] bottom-auto z-50 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl backdrop-blur-2xl sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-72 sm:rounded-xl",
                "max-h-[60vh] overflow-y-auto",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-3 py-1">
                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                  Segmentation Models
                </span>
                {error && (
                  <span className="animate-pulse text-[9px] font-bold text-rose-500">
                    LOAD ERROR
                  </span>
                )}
              </div>

              {error && (
                <div className="mx-2 mb-3 rounded-lg border border-rose-500/10 bg-rose-500/5 px-2.5 py-2 text-[10px] font-medium text-rose-400/90 shadow-inner select-text">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {(Object.values(AVAILABLE_MODELS) as ModelInfo[]).map((model) => {
                  const isActive = currentModel?.id === model.id || loadingModelId === model.id;
                  const isCached = cachedModels.has(model.id as ModelId);
                  const isItemDownloading =
                    isLoading && loadingModelId === model.id && downloadProgress;

                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelect(model.id as ModelId)}
                      disabled={isLoading && loadingModelId === model.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all",
                        isActive
                          ? "bg-indigo-500/20 text-indigo-400"
                          : isCached
                            ? "text-slate-300 hover:bg-white/5"
                            : "text-slate-500 hover:bg-white/5",
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{model.name}</span>
                        <span className="text-[10px] opacity-70">
                          {isItemDownloading ? (
                            <span className="font-mono text-indigo-400">
                              Downloading ({formatMB(downloadProgress.loaded)} /{" "}
                              {formatMB(downloadProgress.total)} MB)
                            </span>
                          ) : (
                            <span>
                              {isCached ? "Ready" : `${model.sizeMB.toFixed(1)}MB`} • Version{" "}
                              {model.version}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && !isItemDownloading && (
                          <Check size={14} className="text-indigo-400" />
                        )}
                        {isItemDownloading && (
                          <Loader2 size={14} className="animate-spin text-indigo-400" />
                        )}
                        {!isCached && !isItemDownloading && (
                          <Download size={14} className="opacity-30" />
                        )}
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
