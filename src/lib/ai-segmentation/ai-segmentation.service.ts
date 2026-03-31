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
  private loadingPromise: Promise<void> | null = null;

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

  private async fetchAndCacheModel(
    url: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<ArrayBuffer> {
    const cache = await caches.open("ai-models-v1");
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const buffer = await cachedResponse.arrayBuffer();
      // No onProgress call for cached models
      return buffer;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch model from ${url}`);

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

      onProgress?.(loaded, total);
    }

    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    await cache.put(url, new Response(buffer.slice(0))); // cache a copy
    return buffer.buffer;
  }

  /**
   * Check if a model is already in the browser cache.
   */
  async isModelCached(modelId: ModelId): Promise<boolean> {
    const model = AVAILABLE_MODELS[modelId];
    const cache = await caches.open("ai-models-v1");
    const encMatch = await cache.match(model.encoderUrl);
    const decMatch = await cache.match(model.decoderUrl);
    return !!(encMatch && decMatch);
  }

  /**
   * Loads the specified model into memory.
   */
  async loadModel(
    modelId: ModelId,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    if (this.currentModel?.id === modelId) return;
    this.ensureWorkers();

    const model = AVAILABLE_MODELS[modelId];

    let encLoaded = 0,
      encTotal = 0;
    let decLoaded = 0,
      decTotal = 0;

    const isCached = await this.isModelCached(modelId);

    const reportProgress = () => {
      if (!onProgress || isCached) return;
      const total = encTotal + decTotal;
      const loaded = encLoaded + decLoaded;
      if (total > 0) {
        onProgress({
          loaded,
          total,
          percent: Math.round((loaded / total) * 100),
        });
      }
    };

    this.loadingPromise = (async () => {
      const [encData, decData] = await Promise.all([
        this.fetchAndCacheModel(model.encoderUrl, (l, t) => {
          encLoaded = l;
          encTotal = t;
          reportProgress();
        }),
        this.fetchAndCacheModel(model.decoderUrl, (l, t) => {
          decLoaded = l;
          decTotal = t;
          reportProgress();
        }),
      ]);

      await Promise.all([
        this.sendMessageToWorker<EncoderResponse>(this.encoderWorker!, {
          type: "LOAD_MODEL",
          modelId,
          modelData: encData,
        }),
        this.sendMessageToWorker<DecoderResponse>(this.decoderWorker!, {
          type: "LOAD_MODEL",
          modelId,
          modelData: decData,
        }),
      ]);

      this.currentModel = model;
      localStorage.setItem("last-ai-model-id", modelId);
    })();

    await this.loadingPromise;
  }

  /**
   * Encodes an image into embeddings. Skips if already in IndexedDB.
   */
  async encodeImage(image: ImageBitmap, imageHash: string): Promise<string> {
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

  private sendMessageToWorker<T>(worker: Worker, msg: any): Promise<T> {
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
      worker.postMessage(msg);
    });
  }
}

export const aiSegmentationService = new AISegmentationService();
