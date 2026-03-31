/**
 * React hook for AI segmentation.
 */

import { useState, useCallback } from "react";

import { aiSegmentationService } from "../ai-segmentation.service";
import { Point } from "../core/workers/protocol";
import { ModelId, ModelInfo, AVAILABLE_MODELS } from "../models/model-constants";

export function useAISegmentation() {
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModel = useCallback(async (modelId: ModelId) => {
    setIsModelLoading(true);
    setError(null);
    try {
      await aiSegmentationService.loadModel(modelId);
      setCurrentModel(AVAILABLE_MODELS[modelId]);
    } catch (err: any) {
      setError(err.message || "Failed to load model");
    } finally {
      setIsModelLoading(false);
    }
  }, []);

  const encodeImage = useCallback(async (image: ImageBitmap, imageHash: string) => {
    try {
      return await aiSegmentationService.encodeImage(image, imageHash);
    } catch (err: any) {
      setError(err.message || "Failed to encode image");
      throw err;
    }
  }, []);

  const decodePoints = useCallback(async (embeddingKey: string, points: Point[]) => {
    try {
      return await aiSegmentationService.decodePoints(embeddingKey, points);
    } catch (err: any) {
      setError(err.message || "Failed to decode points");
      throw err;
    }
  }, []);

  return {
    currentModel,
    isModelLoading,
    error,
    loadModel,
    encodeImage,
    decodePoints,
  };
}
