/**
 * Central service for AI segmentation.
 * Handles workers, model caching (Cache API), and IndexedDB for embeddings.
 */

import { get } from "idb-keyval";
import JSZip from "jszip";

import { isIOS } from "../utils/device";
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
  private isEncoderLoaded = false;
  private isDecoderLoaded = false;
  private loadingModelId: ModelId | null = null;
  private loadingPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private statusListeners: Set<() => void> = new Set();

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
      const encKey = model.zipUrl ? `${modelId}/encoder` : model.encoderUrl!;
      const decKey = model.zipUrl ? `${modelId}/decoder` : model.decoderUrl!;

      const encMatch = await cache.match(encKey);
      const decMatch = await cache.match(decKey);
      return !!(encMatch && decMatch);
    } catch (e) {
      console.warn("AI Model cache match failed:", e);
      return false;
    }
  }

  /**
   * Check if an embedding is already in IndexedDB for a given model+hash.
   * This decoupled check is much faster than loadModel().
   */
  async isEmbeddingCached(modelId: ModelId, version: string, imageHash: string): Promise<boolean> {
    const key = getEmbeddingKey(modelId, version, imageHash);
    const existing = await get(key);
    return !!existing;
  }

  /**
   * Loads a model's binaries into memory (Workers).
   * On Desktop, loads both immediately.
   * On iOS, this only handles the "Download" phase to fill Cache API;
   * actual session inflation happens lazily in encode/decode.
   */
  async loadModel(
    modelId: ModelId,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    if (this.currentModel?.id === modelId && (this.isEncoderLoaded || this.isDecoderLoaded)) return;

    if (this.loadingModelId === modelId && this.loadingPromise) {
      return this.loadingPromise;
    }

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
        const downloadSource = model.zipUrl ? `ZIP: ${model.zipUrl}` : `URL: ${model.encoderUrl}`;
        console.log(`Starting AI model download: ${model.name}\n- Source: ${downloadSource}`);
      }

      try {
        let encoderLoadedBytes = 0;
        let encoderTotalBytes = 0;
        let decoderLoadedBytes = 0;
        let decoderTotalBytes = 0;

        const metadataTotal = model.sizeMB * 1024 * 1024;

        let lastUpdate = 0;
        const updateProgress = (l?: number) => {
          if (!onProgress) return;
          const now = Date.now();
          if (now - lastUpdate < 50 && l !== undefined) return;
          lastUpdate = now;

          const loaded = encoderLoadedBytes + decoderLoadedBytes;
          const total = Math.max(metadataTotal, encoderTotalBytes + decoderTotalBytes);
          const percent = Math.min(99, Math.round((loaded / (total || metadataTotal)) * 100));
          onProgress({ loaded, total: total || metadataTotal, percent });
        };

        const getModelBuffers = async (): Promise<[ArrayBuffer, ArrayBuffer]> => {
          if (model.zipUrl) {
            const cache = await this.getCache();
            const encKey = `${modelId}/encoder`;
            const decKey = `${modelId}/decoder`;

            if (isCached && cache) {
              const [e, d] = await Promise.all([cache.match(encKey), cache.match(decKey)]);
              if (e && d) return [await e.arrayBuffer(), await d.arrayBuffer()];
            }

            const zipBuffer = await this.fetchAndCacheModel(
              model.zipUrl,
              (l, t) => {
                encoderLoadedBytes = l;
                encoderTotalBytes = t;
                updateProgress(l);
              },
              signal,
            );

            updateProgress();
            const zip = await JSZip.loadAsync(zipBuffer);
            const encFile = zip.file(model.encoderPath!);
            const decFile = zip.file(model.decoderPath!);
            if (!encFile || !decFile) throw new Error("Model files not found in ZIP");

            const [eBuf, dBuf] = await Promise.all([
              encFile.async("arraybuffer"),
              decFile.async("arraybuffer"),
            ]);

            if (cache) {
              await Promise.all([
                cache.put(encKey, new Response(eBuf)),
                cache.put(decKey, new Response(dBuf)),
              ]);
            }
            return [eBuf, dBuf];
          } else {
            const [eBuf, dBuf] = await Promise.all([
              this.fetchAndCacheModel(
                model.encoderUrl!,
                (l, t) => {
                  encoderLoadedBytes = l;
                  encoderTotalBytes = t;
                  updateProgress();
                },
                signal,
              ),
              this.fetchAndCacheModel(
                model.decoderUrl!,
                (l, t) => {
                  decoderLoadedBytes = l;
                  decoderTotalBytes = t;
                  updateProgress();
                },
                signal,
              ),
            ]);
            return [eBuf, dBuf];
          }
        };

        const [encoderData, decoderData] = await getModelBuffers();

        // If we switched models, dispose old sessions
        if (this.currentModel && this.currentModel.id !== modelId) {
          this.disposeSessions();
        }

        this.currentModel = model;

        // Desktop: Load both immediately
        // iOS: Load nothing yet, wait for encode/decode calls
        if (!isIOS) {
          await Promise.all([
            this.ensureEncoderLoaded(encoderData),
            this.ensureDecoderLoaded(decoderData),
          ]);
        }

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

  /**
   * Ensures the encoder is inflated in its worker.
   */
  private async ensureEncoderLoaded(data?: ArrayBuffer) {
    if (this.isEncoderLoaded) return;
    if (!this.currentModel) return;

    this.ensureWorkers();

    let buffer = data;
    if (!buffer) {
      const cache = await this.getCache();
      const encKey = this.currentModel.zipUrl
        ? `${this.currentModel.id}/encoder`
        : this.currentModel.encoderUrl!;
      const match = cache ? await cache.match(encKey) : null;
      if (!match) throw new Error("Encoder binary not found in cache");
      buffer = await match.arrayBuffer();
    }

    await this.sendMessageToWorker(
      this.encoderWorker!,
      {
        type: "LOAD_MODEL",
        modelId: this.currentModel.id,
        modelData: buffer,
      },
      [buffer],
    );

    this.isEncoderLoaded = true;
    this.notify();
    console.debug(`[AISegmentationService] Encoder loaded for ${this.currentModel.id}`);
  }

  /**
   * Ensures the decoder is inflated in its worker.
   */
  public async ensureDecoderLoaded(data?: ArrayBuffer) {
    if (this.isDecoderLoaded) return;
    if (!this.currentModel) return;

    this.ensureWorkers();

    let buffer = data;
    if (!buffer) {
      const cache = await this.getCache();
      const decKey = this.currentModel.zipUrl
        ? `${this.currentModel.id}/decoder`
        : this.currentModel.decoderUrl!;
      const match = cache ? await cache.match(decKey) : null;
      if (!match) throw new Error("Decoder binary not found in cache");
      buffer = await match.arrayBuffer();
    }

    await this.sendMessageToWorker(
      this.decoderWorker!,
      {
        type: "LOAD_MODEL",
        modelId: this.currentModel.id,
        modelData: buffer,
      },
      [buffer],
    );

    this.isDecoderLoaded = true;
    this.notify();
    console.debug(`[AISegmentationService] Decoder loaded for ${this.currentModel.id}`);
  }

  getCurrentModel(): ModelInfo | null {
    return this.currentModel;
  }

  get encoderLoaded(): boolean {
    return this.isEncoderLoaded;
  }

  get decoderLoaded(): boolean {
    return this.isDecoderLoaded;
  }

  /**
   * Internal helper to make sure a model is loaded, optionally restoring the last active one.
   * If a load is currently in progress, we await it to ensure we are on the NEXT model,
   * not the previous one.
   */
  private async ensureModelLoaded() {
    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    if (this.currentModel) return;

    // Restore last used model if nothing is loading
    if (typeof window === "undefined") return;
    const lastId = localStorage.getItem("last-ai-model-id") as ModelId;
    if (lastId && AVAILABLE_MODELS[lastId]) {
      console.info(`[AISegmentationService] Autoloading last active model: ${lastId}`);
      try {
        await this.loadModel(lastId);
      } catch (e) {
        console.warn(`[AISegmentationService] Failed to autoload last model:`, e);
      }
    }
  }

  /**
   * Encodes an image into embeddings. Skips if already in IndexedDB.
   */
  async encodeImage(image: ImageBitmap, imageHash: string): Promise<string> {
    await this.ensureModelLoaded();
    if (!this.currentModel) throw new Error("No AI model loaded (Select one first)");

    const embeddingKey = getEmbeddingKey(
      this.currentModel.id,
      this.currentModel.version,
      imageHash,
    );

    // 1. Check IndexedDB first
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    // 2. Ensure encoder is loaded (even on desktop)
    await this.ensureEncoderLoaded();

    logDebugImage(
      image,
      `[${this.currentModel.name}]  AISegmentationService.encodeImage() input image`,
      imageHash,
    );

    // 3. Encode via worker
    await this.sendMessageToWorker<EncoderResponse>(this.encoderWorker!, {
      type: "ENCODE_IMAGE",
      image,
      imageHash,
      modelId: this.currentModel.id,
      modelVersion: this.currentModel.version,
    });

    // 4. iOS Cleanup: Dispose encoder immediately after use
    if (isIOS) {
      this.disposeEncoder();
    }

    return embeddingKey;
  }

  /**
   * Decodes embeddings for a set of clicks.
   */
  async decodePoints(embeddingKey: string, points: Point[]): Promise<Mask> {
    await this.ensureModelLoaded();
    if (!this.currentModel) throw new Error("No AI model loaded (Select one first)");

    // Safety check: key must belong to model to avoid ONNX feed errors during transitions
    if (!embeddingKey.startsWith(this.currentModel.id)) {
      throw new Error(
        `Embedding key mismatch: ${embeddingKey} does not belong to ${this.currentModel.id}`,
      );
    }

    // Ensure decoder is loaded
    await this.ensureDecoderLoaded();

    const response = await this.sendMessageToWorker<DecoderResponse>(this.decoderWorker!, {
      type: "DECODE",
      embeddingKey,
      points,
    });

    if (response.type === "DECODED") {
      logDebugMask(
        response.mask,
        `[${this.currentModel.name}]  AISegmentationService.decodePoints() mask output`,
      );
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
    this.isEncoderLoaded = false;
    this.isDecoderLoaded = false;
  }

  /**
   * Disposes only the encoder session.
   */
  disposeEncoder() {
    if (!this.encoderWorker || !this.isEncoderLoaded) return;
    this.encoderWorker.postMessage({ type: "DISPOSE" });
    this.isEncoderLoaded = false;
    this.notify();
    console.debug("[AISegmentationService] Encoder session disposed");
  }

  /**
   * Disposes only the decoder session.
   */
  disposeDecoder() {
    if (!this.decoderWorker || !this.isDecoderLoaded) return;
    this.decoderWorker.postMessage({ type: "DISPOSE" });
    this.isDecoderLoaded = false;
    this.notify();
    console.debug("[AISegmentationService] Decoder session disposed");
  }

  /**
   * Disposes sessions but keeps workers alive.
   */
  disposeSessions() {
    this.disposeEncoder();
    this.disposeDecoder();
  }

  private notify() {
    this.statusListeners.forEach((l) => l());
  }

  subscribe(callback: () => void) {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
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
