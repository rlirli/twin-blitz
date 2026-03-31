/**
 * Dedicated WebWorker for image encoding (downscale → embeddings, store in IndexedDB).
 */

import { set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../utils/embedding-utils";
import { imageToTensor, scaleImage } from "../utils/image-utils";
import { EncoderMessage } from "./protocol";

let session: ort.InferenceSession | null = null;

// Track current encoding to allow cancellation of stale ones
let activeEncodeId = 0;

self.onmessage = async (e: MessageEvent<EncoderMessage>) => {
  const msg = e.data;

  if (msg.type === "LOAD_MODEL") {
    try {
      session = null;
      session = await ort.InferenceSession.create(msg.modelData, {
        executionProviders: ["webgpu", "wasm"],
      });
      self.postMessage({ type: "LOADED" });
    } catch (err: any) {
      self.postMessage({ type: "ERROR", message: `Failed to load encoder: ${err.message}` });
    }
  } else if (msg.type === "ENCODE_IMAGE") {
    if (!session) {
      self.postMessage({ type: "ERROR", message: "No encoder session loaded" });
      return;
    }

    const encodeId = ++activeEncodeId;

    try {
      // 1. Check if we already have it in IndexedDB
      const embeddingKey = getEmbeddingKey(msg.modelId, msg.modelVersion, msg.imageHash);
      if (encodeId !== activeEncodeId) return;

      // 2. Preprocess: Downscale to 1024x1024 (expected input for SAM-like models)
      const scaled = await scaleImage(msg.image, 1024, 1024);
      if (encodeId !== activeEncodeId) return;

      const data = await imageToTensor(scaled);
      if (encodeId !== activeEncodeId) return;

      const tensor = new ort.Tensor("float32", data, [1, 3, 1024, 1024]);

      // 3. Inference
      // The input key for EfficientViT-SAM is typically 'input'
      const results = await session.run({ input: tensor });
      if (encodeId !== activeEncodeId) return;

      // The output key is typically 'output' or 'image_embeddings'
      // We'll take the first available output
      const outputName = session.outputNames[0];
      const outputTensor = results[outputName];
      const embeddings = outputTensor.data as Float32Array;

      // 4. Store in IndexedDB
      await set(embeddingKey, embeddings);

      self.postMessage({ type: "ENCODED", embeddingKey });
    } catch (err: any) {
      if (encodeId === activeEncodeId) {
        self.postMessage({ type: "ERROR", message: `Encoding failed: ${err.message}` });
      }
    }
  } else if (msg.type === "DISPOSE") {
    session = null;
  }
};
