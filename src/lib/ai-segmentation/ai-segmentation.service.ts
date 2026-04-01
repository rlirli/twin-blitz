/**
 * Central service for AI segmentation.
 * Handles workers, model caching (Cache API), and IndexedDB for embeddings.
 */

import { get } from "idb-keyval";

import { logDebugImage, logDebugMask } from "./core/utils/debug-utils";
import { getEmbeddingKey } from "./core/utils/embedding-utils";
import { Mask } from "./core/utils/mask-utils";
import { DecoderResponse, EncoderResponse, Point } from "./core/workers/protocol";
import { AVAILABLE_MODELS, ModelId, ModelInfo } from "./models/model-constants";

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

class AISegmentationService {
  private encoderWorker: Worker | null = null;
  private decoderWorker: Worker | null = null;
  private currentModel: ModelInfo | null = null;
  private loadingModelId: ModelId | null = null;
  private loadingPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    // Lazy initialize as workers need to be created in the browser
  }

  private ensureWorkers() {
    if (typeof window === "undefined") return;
    if (!this.encoderWorker) {
      this.encoderWorker = new Worker(
        new URL("./core/workers/encoder-worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    if (!this.decoderWorker) {
      this.decoderWorker = new Worker(
        new URL("./core/workers/decoder-worker.ts", import.meta.url),
        { type: "module" },
      );
    }
  }

  private async getCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return null;
    try {
      return await caches.open("ai-models-v1");
    } catch (e) {
      console.warn("AI Model cache access failed:", e);
      return null;
    }
  }

  private async fetchAndCacheModel(
    url: string,
    onProgress?: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const cache = await this.getCache();
    const cachedResponse = cache ? await cache.match(url) : null;
    if (cachedResponse) {
      return await cachedResponse.arrayBuffer();
    }

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Failed to fetch model from ${url}`);

    if (!onProgress) {
      const buffer = await response.clone().arrayBuffer();
      if (cache) {
        try {
          await cache.put(url, response);
        } catch (e) {
          console.warn(`Failed to cache model component ${url}:`, e);
        }
      }
      return buffer;
    }

    // Progress-aware fetch
    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    if (!response.body) throw new Error("Response body is null");

    const reader = response.body.getReader();
    let loaded = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }

    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Cache the buffer directly to avoid another round of reading
    if (cache) {
      try {
        await cache.put(url, new Response(buffer));
      } catch (e) {
        console.warn(`Failed to cache model component ${url}:`, e);
      }
    }
    return buffer.buffer;
  }

  /**
   * Check if a model is already in the browser cache.
   */
  async isModelCached(modelId: ModelId): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;

    const model = AVAILABLE_MODELS[modelId];
    try {
      const encMatch = await cache.match(model.encoderUrl);
      const decMatch = await cache.match(model.decoderUrl);
      return !!(encMatch && decMatch);
    } catch (e) {
      console.warn("AI Model cache match failed:", e);
      return false;
    }
  }

  /**
   * Loads a model into memory. Handles potential race conditions.
   */
  async loadModel(
    modelId: ModelId,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    if (this.currentModel?.id === modelId) return;

    // Return existing promise if already loading same model
    if (this.loadingModelId === modelId && this.loadingPromise) {
      return this.loadingPromise;
    }

    // Cancel previous load if still running
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.loadingPromise = null;
    }

    const model = AVAILABLE_MODELS[modelId];
    if (!model) throw new Error(`Model ${modelId} not found`);

    this.ensureWorkers();
    this.loadingModelId = modelId;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.loadingPromise = (async () => {
      const isCached = await this.isModelCached(modelId);
      if (!isCached) {
        console.log(
          `Starting AI model download: ${model.name}\n- Encoder URL: ${model.encoderUrl}\n- Decoder URL: ${model.decoderUrl}`,
        );
      }

      try {
        let encoderLoadedBytes = 0;
        let encoderTotalBytes = 0;
        let decoderLoadedBytes = 0;
        let decoderTotalBytes = 0;

        const metadataTotal = model.sizeMB * 1024 * 1024;

        const updateProgress = () => {
          if (onProgress) {
            const loaded = encoderLoadedBytes + decoderLoadedBytes;
            const total = Math.max(metadataTotal, encoderTotalBytes + decoderTotalBytes);
            const percent = Math.min(99, Math.round((loaded / total) * 100));
            onProgress({ loaded, total: total || metadataTotal, percent });
          }
        };

        // 1. Start both downloads in parallel for speed
        const encoderLoad = (async () => {
          const encData = await this.fetchAndCacheModel(
            model.encoderUrl,
            (loaded, total) => {
              encoderLoadedBytes = loaded;
              encoderTotalBytes = total;
              updateProgress();
            },
            signal,
          );
          // MOVE it to the worker immediately to free main thread RAM
          return this.sendMessageToWorker(
            this.encoderWorker!,
            {
              type: "LOAD_MODEL",
              modelId,
              modelData: encData,
            },
            [encData],
          );
        })();

        const decoderLoad = (async () => {
          const decData = await this.fetchAndCacheModel(
            model.decoderUrl,
            (loaded, total) => {
              decoderLoadedBytes = loaded;
              decoderTotalBytes = total;
              updateProgress();
            },
            signal,
          );
          // MOVE it to the worker immediately to free main thread RAM
          return this.sendMessageToWorker(
            this.decoderWorker!,
            {
              type: "LOAD_MODEL",
              modelId,
              modelData: decData,
            },
            [decData],
          );
        })();

        this.currentModel = model;

        // Wait for both components to be fully downloaded and ready in their workers
        await Promise.all([encoderLoad, decoderLoad]);

        if (!isCached) {
          console.log(`AI model download complete: ${model.name}`);
        }

        if (onProgress) {
          onProgress({ loaded: metadataTotal, total: metadataTotal, percent: 100 });
        }

        // CRITICAL: Clear the last model's embedding state to avoid 'input missing' errors
        // during architecture transitions (e.g. EfficientViT -> SAM2).
        localStorage.removeItem("last-ai-embedding-key");
        localStorage.setItem("last-ai-model-id", modelId);
      } finally {
        this.loadingModelId = null;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  getCurrentModel(): ModelInfo | null {
    return this.currentModel;
  }

  /**
   * Encodes an image into embeddings. Skips if already in IndexedDB.
   */
  async encodeImage(image: ImageBitmap, imageHash: string): Promise<string> {
    if (this.loadingPromise) await this.loadingPromise;
    if (!this.currentModel) throw new Error("No model loaded");
    this.ensureWorkers();

    const embeddingKey = getEmbeddingKey(
      this.currentModel.id,
      this.currentModel.version,
      imageHash,
    );

    // 1. Check IndexedDB first
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    logDebugImage(image, "AISegmentationService.encodeImage() input image", imageHash);

    // 2. Encode via worker
    await this.sendMessageToWorker<EncoderResponse>(this.encoderWorker!, {
      type: "ENCODE_IMAGE",
      image,
      imageHash,
      modelId: this.currentModel.id,
      modelVersion: this.currentModel.version,
    });

    return embeddingKey;
  }

  /**
   * Decodes embeddings for a set of clicks.
   */
  async decodePoints(embeddingKey: string, points: Point[]): Promise<Mask> {
    // Mask type is in utils
    if (this.loadingPromise) await this.loadingPromise;
    if (!this.currentModel) throw new Error("No model loaded");
    this.ensureWorkers();

    const response = await this.sendMessageToWorker<DecoderResponse>(this.decoderWorker!, {
      type: "DECODE",
      embeddingKey,
      points,
    });

    if (response.type === "DECODED") {
      logDebugMask(response.mask, "AISegmentationService.decodePoints() mask output");
      return response.mask;
    }
    throw new Error("Failed to decode mask");
  }

  /**
   * Dispose all resources and stop workers.
   */
  dispose() {
    this.encoderWorker?.terminate();
    this.decoderWorker?.terminate();
    this.encoderWorker = null;
    this.decoderWorker = null;
    this.currentModel = null;
  }

  private sendMessageToWorker<T>(worker: Worker, msg: any, transfer?: Transferable[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<T | any>) => {
        if (e.data.type === "ERROR") {
          worker.removeEventListener("message", handler);
          reject(new Error(e.data.message));
        } else {
          worker.removeEventListener("message", handler);
          resolve(e.data);
        }
      };
      worker.addEventListener("message", handler);
      if (transfer) {
        worker.postMessage(msg, transfer);
      } else {
        worker.postMessage(msg);
      }
    });
  }
}

export const aiSegmentationService = new AISegmentationService();
