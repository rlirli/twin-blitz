/**
 * Dedicated WebWorker for image encoding (downscale → embeddings, store in IndexedDB).
 */

import { set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../utils/embedding-utils";
import { imageToTensor, scaleImage } from "../utils/image-utils";
import { EncoderMessage, EncoderResponse } from "./protocol";

let session: ort.InferenceSession | null = null;
let currentModelId: string | null = null;

// Initialize WASM paths for ORT
// Note: In a production app, you might want to host these locally or use a CDN
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/";

self.onmessage = async (e: MessageEvent<EncoderMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case "LOAD_MODEL": {
        if (currentModelId === msg.modelId && session) {
          self.postMessage({ type: "LOADED" } as EncoderResponse);
          return;
        }

        // Dispose previous session
        if (session) {
          await session.release();
        }

        session = await ort.InferenceSession.create(msg.modelData, {
          executionProviders: ["webgpu", "wasm"],
        });
        currentModelId = msg.modelId;
        self.postMessage({ type: "LOADED" } as EncoderResponse);
        break;
      }

      case "ENCODE_IMAGE": {
        if (!session) {
          throw new Error("Encoder session not initialized");
        }

        const { image, imageHash, modelId, modelVersion } = msg;

        // EfficientViT-SAM-L0 expects 512x512, others might expect 1024x1024
        // For simplicity, we'll use 512 for L0 and 1024 for others
        const targetDim = modelId === "EFFICIENTVIT_L0" ? 512 : 1024;
        const scaledImage = await scaleImage(image, targetDim, targetDim);
        const tensorData = await imageToTensor(scaledImage);

        const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, targetDim, targetDim]);
        const outputs = await session.run({ image: inputTensor });
        const embeddings = outputs.image_embeddings.data as Float32Array;

        const embeddingKey = getEmbeddingKey(modelId, modelVersion, imageHash);
        await set(embeddingKey, embeddings);

        self.postMessage({ type: "ENCODED", imageHash, embeddingKey } as EncoderResponse);
        break;
      }

      case "DISPOSE": {
        if (session) {
          await session.release();
          session = null;
          currentModelId = null;
        }
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({ type: "ERROR", message: err.message } as EncoderResponse);
  }
};
