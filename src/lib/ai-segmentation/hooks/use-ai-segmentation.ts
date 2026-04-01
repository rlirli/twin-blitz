/**
 * React hook for AI segmentation.
 */

import { useState, useCallback, useEffect, useRef } from "react";

import { aiSegmentationService, DownloadProgress } from "../ai-segmentation.service";
import { hashImage, getEmbeddingKey } from "../core/utils/embedding-utils";
import { Mask } from "../core/utils/mask-utils";
import { Point } from "../core/workers/protocol";
import { ModelId, ModelInfo, AVAILABLE_MODELS } from "../models/model-constants";

export function useAISegmentation(options: { image: ImageBitmap | null } = { image: null }) {
  const { image } = options;

  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(
    aiSegmentationService.getCurrentModel(),
  );
  const [loadingModelId, setLoadingModelId] = useState<ModelId | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SESSION STATE
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [idbHasEmbeddings, setIdbHasEmbeddings] = useState<boolean | null>(null);
  const [embeddingKey, setEmbeddingKey] = useState<string | null>(null);
  const [isAIEncoding, setIsAIEncoding] = useState(false);
  const [isAISegmenting, setIsAISegmenting] = useState(false);
  const [lastAIOutput, setLastAIOutput] = useState<Mask | null>(null);
  const [lastRelClick, setLastRelClick] = useState<{ x: number; y: number } | null>(null);

  const manualLoadInProgress = useRef<string | null>(null);
  const encodingPromiseRef = useRef<Promise<string> | null>(null);

  // Sync state if service already has a model (e.g. from another hook)
  // useEffect(() => {
  //   const model = aiSegmentationService.getCurrentModel();
  //   // Only pull from service if we aren't actively loading our own model
  //   if (model && !manualLoadInProgress.current && model.id !== currentModel?.id) {
  //     setCurrentModel(model);
  //   }
  // }, [currentModel]);

  // 1. Stable Image Hashing (Once per image)
  useEffect(() => {
    if (!image) {
      setImageHash(null);
      setIdbHasEmbeddings(null);
      return;
    }
    let isCancelled = false;
    hashImage(image).then((hash) => {
      if (!isCancelled) setImageHash(hash);
    });
    return () => {
      isCancelled = true;
    };
  }, [image]);

  const loadModel = useCallback(
    async (modelId: ModelId) => {
      manualLoadInProgress.current = modelId;
      const nextModel = AVAILABLE_MODELS[modelId];
      setCurrentModel(nextModel); // Update metadata immediately
      setIsModelLoading(true);
      setLoadingModelId(modelId);
      setDownloadProgress(null);
      setError(null);

      // Eagerly reset session state
      setEmbeddingKey(null);
      setLastAIOutput(null);
      setLastRelClick(null);
      setIdbHasEmbeddings(null);

      // Proactively check IDB if we already have the hash
      if (imageHash) {
        aiSegmentationService
          .isEmbeddingCached(modelId, nextModel.version, imageHash)
          .then((exists) => {
            // Only update if we are still targeting this model
            if (manualLoadInProgress.current === modelId) {
              setIdbHasEmbeddings(exists);
            }
          });
      }

      try {
        await aiSegmentationService.loadModel(modelId, (p) => setDownloadProgress(p));
      } catch (err: any) {
        setError(err.message || "Failed to load model");
      } finally {
        setIsModelLoading(false);
        setLoadingModelId(null);
        setDownloadProgress(null);
        if (manualLoadInProgress.current === modelId) manualLoadInProgress.current = null;
      }
    },
    [imageHash],
  );

  // Auto-load last used model
  useEffect(() => {
    let isCancelled = false;
    const existing = aiSegmentationService.getCurrentModel();
    const lastId = localStorage.getItem("last-ai-model-id") as ModelId;

    if (lastId && AVAILABLE_MODELS[lastId] && (!existing || existing.id !== lastId)) {
      const checkAndLoad = async () => {
        if (await aiSegmentationService.isModelCached(lastId)) {
          if (!isCancelled && !manualLoadInProgress.current) {
            loadModel(lastId);
          }
        }
      };
      checkAndLoad();
    }
    return () => {
      isCancelled = true;
    };
  }, [loadModel]);

  // PROACTIVE ENCODING EFFECT
  useEffect(() => {
    let isCancelled = false;
    if (!image || !currentModel || !imageHash) {
      setEmbeddingKey(null);
      setLastAIOutput(null);
      setLastRelClick(null);
      return;
    }
    console.debug("[useAISegmentation] Proactive embedding check for model:", currentModel.id);
    const runEncoding = async () => {
      try {
        // 1. FAST CACHE CHECK (Using stable imageHash)
        const isCached = await aiSegmentationService.isEmbeddingCached(
          currentModel.id,
          currentModel.version,
          imageHash,
        );

        if (!isCancelled) setIdbHasEmbeddings(isCached);

        if (isCached && !isCancelled) {
          const key = getEmbeddingKey(currentModel.id, currentModel.version, imageHash);
          setEmbeddingKey(key);
          console.debug(
            "[useAISegmentation] Embedding cache hit: using cached embedding for model:",
            currentModel.id,
          );
          return;
        }

        // 2. FULL ENCODING (Only now do we show the spinner)
        setIsAIEncoding(true);
        console.debug(
          "[useAISegmentation] Embedding cache miss: triggering proactive encoding for model:",
          currentModel.id,
        );
        const promise = aiSegmentationService.encodeImage(image, imageHash);
        encodingPromiseRef.current = promise;
        const key = await promise;

        if (!isCancelled) {
          setEmbeddingKey(key);
          setIdbHasEmbeddings(true);
        }
      } catch (err: any) {
        if (!isCancelled) setError(err.message);
      } finally {
        if (!isCancelled) {
          setIsAIEncoding(false);
          encodingPromiseRef.current = null;
        }
      }
    };

    runEncoding();

    return () => {
      isCancelled = true;
    };
  }, [image, currentModel, imageHash]);

  /**
   * SMART decodePoints - No embeddingKey needed from UI.
   * Internally manages re-encoding/awaiting if necessary.
   */
  const decodePoints = useCallback(
    async (points: Point[]): Promise<Mask> => {
      setError(null);
      setLastAIOutput(null);

      // Track click for debug visualization
      if (points.length > 0 && image) {
        setLastRelClick({ x: points[0].x / image.width, y: points[0].y / image.height });
      }
      try {
        let activeKey = embeddingKey;

        // ENSURE EMBEDDING KEY IS COMPATIBLE WITH CURRENT MODEL
        // This avoids the 'input missing' ONNX errors when switching models
        if (!activeKey || !activeKey.startsWith(currentModel?.id || "")) {
          console.log(`[useAISegmentation] Waiting for compatible embedding...`);

          if (encodingPromiseRef.current) {
            activeKey = await encodingPromiseRef.current;
          } else if (image) {
            const hash = await hashImage(image);
            activeKey = await aiSegmentationService.encodeImage(image, hash);
            setEmbeddingKey(activeKey);
          } else {
            throw new Error("AI session not ready: No image or embedding available.");
          }
        }
        setIsAISegmenting(true);

        const mask = await aiSegmentationService.decodePoints(activeKey, points);
        setLastAIOutput(mask);

        return mask;
      } catch (err: any) {
        setError(err.message || "AI Segmentation failed");
        throw err;
      } finally {
        setIsAISegmenting(false);
      }
    },
    [image, currentModel, embeddingKey],
  );

  return {
    // Model state
    currentModel,
    loadingModelId,
    isModelLoading,
    downloadProgress,
    error,
    loadModel,

    // Session status
    isReady: !!embeddingKey && embeddingKey.startsWith(currentModel?.id || "") && !isAIEncoding,
    isProcessing: isAIEncoding || isAISegmenting,

    // Action
    decodePoints,

    // Debug data (Consolidated for AISegmentationDebugWindow)
    debug: {
      inputImage: image,
      outputMask: lastAIOutput,
      isEncoding: isAIEncoding,
      isDecoding: isAISegmenting,
      hasEmbeddings: idbHasEmbeddings ?? false,
      currentModelId: currentModel?.id || null,
      lastRelClick,
    },
  };
}
