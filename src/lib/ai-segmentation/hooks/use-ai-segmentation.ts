/**
 * React hook for AI segmentation.
 */

import { useState, useCallback, useEffect } from "react";

import { aiSegmentationService, DownloadProgress } from "../ai-segmentation.service";
import { Mask } from "../core/utils/mask-utils";
import { Point } from "../core/workers/protocol";
import { ModelId, ModelInfo, AVAILABLE_MODELS } from "../models/model-constants";

export function useAISegmentation() {
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [loadingModelId, setLoadingModelId] = useState<ModelId | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-load last used model if available in cache
  useEffect(() => {
    const lastId = localStorage.getItem("last-ai-model-id") as ModelId;
    if (lastId && AVAILABLE_MODELS[lastId]) {
      const checkAndLoad = async () => {
        if (await aiSegmentationService.isModelCached(lastId)) {
          loadModel(lastId);
        }
      };
      checkAndLoad();
    }
  }, []);

  const loadModel = useCallback(async (modelId: ModelId) => {
    setIsModelLoading(true);
    setLoadingModelId(modelId);
    setDownloadProgress(null);
    setError(null);
    try {
      await aiSegmentationService.loadModel(modelId, (p) => {
        setDownloadProgress(p);
      });
      setCurrentModel(AVAILABLE_MODELS[modelId]);
    } catch (err: any) {
      setError(err.message || "Failed to load model");
    } finally {
      setIsModelLoading(false);
      setLoadingModelId(null);
      setDownloadProgress(null);
    }
  }, []);

  const encodeImage = useCallback(
    async (image: ImageBitmap, imageHash: string): Promise<string> => {
      try {
        return await aiSegmentationService.encodeImage(image, imageHash);
      } catch (err: any) {
        setError(err.message || "Failed to encode image");
        throw err;
      }
    },
    [],
  );

  const decodePoints = useCallback(async (embeddingKey: string, points: Point[]): Promise<Mask> => {
    try {
      return await aiSegmentationService.decodePoints(embeddingKey, points);
    } catch (err: any) {
      setError(err.message || "Failed to decode points");
      throw err;
    }
  }, []);

  return {
    currentModel,
    loadingModelId,
    isModelLoading,
    downloadProgress,
    error,
    loadModel,
    encodeImage,
    decodePoints,
  };
}
