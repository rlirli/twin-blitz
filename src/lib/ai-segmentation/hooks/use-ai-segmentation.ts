/**
 * React hook for AI segmentation.
 */

import { useState, useCallback, useEffect, useRef } from "react";

import { isIOS } from "../../utils/device";
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

  // 1. ATOMIC SESSION (Image + Hash coupled together)
  const [session, setSession] = useState<{ image: ImageBitmap; hash: string } | null>(null);

  const [idbHasEmbeddings, setIdbHasEmbeddings] = useState<boolean | null>(null);
  const [embeddingKey, setEmbeddingKey] = useState<string | null>(null);
  const [isAIEncoding, setIsAIEncoding] = useState(false);
  const [isAISegmenting, setIsAISegmenting] = useState(false);
  const [isDecoderLoading, setIsDecoderLoading] = useState(false);
  const [isEncoderInMem, setIsEncoderInMem] = useState(aiSegmentationService.encoderLoaded);
  const [isDecoderInMem, setIsDecoderInMem] = useState(aiSegmentationService.decoderLoaded);
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

  // Hashing Effect: Couples the image with its hash to prevent "ghost checks"
  useEffect(() => {
    if (!image) {
      setSession(null);
      setIdbHasEmbeddings(null);
      setEmbeddingKey(null);
      return;
    }
    let isCancelled = false;
    hashImage(image).then((hash) => {
      if (!isCancelled) {
        setSession({ image, hash });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [image]);

  // Subscribe to service status changes (Loaded/Disposed)
  useEffect(() => {
    return aiSegmentationService.subscribe(() => {
      setIsEncoderInMem(aiSegmentationService.encoderLoaded);
      setIsDecoderInMem(aiSegmentationService.decoderLoaded);
    });
  }, []);

  const loadModel = useCallback(
    async (modelId: ModelId) => {
      manualLoadInProgress.current = modelId;
      const nextModel = AVAILABLE_MODELS[modelId];
      setCurrentModel(nextModel); // Update metadata immediately
      setIsModelLoading(true);
      setLoadingModelId(modelId);
      setDownloadProgress(null);
      setError(null);

      // Eagerly reset session result state (but keep the session itself)
      setEmbeddingKey(null);
      setLastAIOutput(null);
      setLastRelClick(null);
      setIdbHasEmbeddings(null);
      setIsAISegmenting(false);
      setIsDecoderLoading(false);

      // Proactively check IDB if image session already exists
      if (session) {
        aiSegmentationService
          .isEmbeddingCached(modelId, nextModel.version, session.hash)
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
    [session],
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

  // 2. PROACTIVE ENCODING EFFECT (Atomic on Session + Model)
  useEffect(() => {
    let isCancelled = false;
    if (!session || !currentModel) {
      setEmbeddingKey(null);
      setLastAIOutput(null);
      setLastRelClick(null);
      return;
    }

    console.debug("[useAISegmentation] Proactive embedding check for model:", currentModel.id);
    const runEncoding = async () => {
      try {
        // 1. FAST CACHE CHECK
        const isCached = await aiSegmentationService.isEmbeddingCached(
          currentModel.id,
          currentModel.version,
          session.hash,
        );

        if (!isCancelled) setIdbHasEmbeddings(isCached);

        if (isCached && !isCancelled) {
          const key = getEmbeddingKey(currentModel.id, currentModel.version, session.hash);
          setEmbeddingKey(key);
          console.debug(
            "[useAISegmentation] Embedding cache hit: using cached embedding for model:",
            currentModel.id,
          );
          return;
        }

        // 2. FULL ENCODING
        setIsAIEncoding(true);
        console.debug(
          "[useAISegmentation] Embedding cache miss: triggering proactive encoding for model:",
          currentModel.id,
        );
        const promise = aiSegmentationService.encodeImage(session.image, session.hash);
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
          console.debug("[useAISegmentation] Encoding finished for model:", currentModel.id);
          encodingPromiseRef.current = null;
        }
      }
    };

    runEncoding();

    return () => {
      isCancelled = true;
    };
  }, [session, currentModel]);

  // 3. iOS CLEANUP EFFECT: Dispose decoder/encoder when leaving MaskTab
  useEffect(() => {
    return () => {
      if (isIOS) {
        console.debug("[useAISegmentation] iOS unmount: cleaning up AI sessions");
        aiSegmentationService.disposeSessions();
      }
    };
  }, []);

  /**
   * SMART decodePoints - Internally manages re-encoding/awaiting.
   */
  const decodePoints = useCallback(
    async (points: Point[]): Promise<Mask> => {
      setError(null);
      setLastAIOutput(null);

      // Track click for debug visualization
      if (points.length > 0 && session) {
        setLastRelClick({
          x: points[0].x / session.image.width,
          y: points[0].y / session.image.height,
        });
      }
      try {
        let activeKey = embeddingKey;

        // ENSURE EMBEDDING KEY IS COMPATIBLE WITH CURRENT MODEL
        if (!activeKey || !activeKey.startsWith(currentModel?.id || "")) {
          console.log(`[useAISegmentation] Waiting for compatible embedding...`);

          if (encodingPromiseRef.current) {
            activeKey = await encodingPromiseRef.current;
          } else if (session) {
            activeKey = await aiSegmentationService.encodeImage(session.image, session.hash);
            setEmbeddingKey(activeKey);
          } else {
            throw new Error("AI session not ready: No image or embedding available.");
          }
        }
        // 3. SEPARATE DECODER LOADING STATE
        if (!aiSegmentationService.decoderLoaded) {
          setIsDecoderLoading(true);
          try {
            await aiSegmentationService.ensureDecoderLoaded();
          } finally {
            setIsDecoderLoading(false);
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
    [session, currentModel, embeddingKey],
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
      inputImage: session?.image || null,
      outputMask: lastAIOutput,
      isEncoding: isAIEncoding,
      isDecoding: isAISegmenting,
      isDecoderLoading,
      isEncoderLoaded: isEncoderInMem,
      isDecoderLoaded: isDecoderInMem,
      hasEmbeddings: idbHasEmbeddings ?? false,
      currentModelId: currentModel?.id || null,
      lastRelClick,
    },
  };
}
