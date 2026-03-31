/**
 * Dedicated WebWorker for mask decoding.
 */

import { get } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { Mask } from "../utils/mask-utils";
import { DecoderMessage, DecoderResponse } from "./protocol";

let session: ort.InferenceSession | null = null;
let currentModelId: string | null = null;

// Initialize WASM paths for ORT
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/";

self.onmessage = async (e: MessageEvent<DecoderMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case "LOAD_MODEL": {
        if (currentModelId === msg.modelId && session) {
          self.postMessage({ type: "LOADED" } as DecoderResponse);
          return;
        }

        if (session) {
          await session.release();
        }

        session = await ort.InferenceSession.create(msg.modelData, {
          executionProviders: ["webgpu", "wasm"],
        });
        currentModelId = msg.modelId;
        self.postMessage({ type: "LOADED" } as DecoderResponse);
        break;
      }

      case "DECODE": {
        if (!session) {
          throw new Error("Decoder session not initialized");
        }

        // Get embeddings from IndexedDB
        const embeddings = await get<Float32Array>(msg.embeddingKey);
        if (!embeddings) {
          throw new Error(`Embeddings not found for key: ${msg.embeddingKey}`);
        }

        // EfficientViT-SAM-L0 expects 512x512, others might expect 1024x1024
        const targetDim = currentModelId === "EFFICIENTVIT_L0" ? 512 : 1024;
        const embDim = 64; // EfficientViT-SAM embeddings are 64x64

        // Prepare Tensors
        const imageEmbeddings = new ort.Tensor("float32", embeddings, [1, 256, embDim, embDim]);
        const pointCoords = new ort.Tensor(
          "float32",
          new Float32Array(msg.points.map((p) => [p.x, p.y]).flat()),
          [1, msg.points.length, 2],
        );
        const pointLabels = new ort.Tensor(
          "float32",
          new Float32Array(msg.points.map((p) => (p.positive ? 1 : 0))),
          [1, msg.points.length],
        );
        const maskInput = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
        const hasMaskInput = new ort.Tensor("float32", new Float32Array([0]), [1]);
        const origImSize = new ort.Tensor("float32", new Float32Array([targetDim, targetDim]), [2]);

        const outputs = await session.run({
          image_embeddings: imageEmbeddings,
          point_coords: pointCoords,
          point_labels: pointLabels,
          mask_input: maskInput,
          has_mask_input: hasMaskInput,
          orig_im_size: origImSize,
        });

        // The output is usually 'masks' [1, 1, H, W]
        const masks = outputs.masks.data as Float32Array;
        const maskWidth = outputs.masks.dims[3];
        const maskHeight = outputs.masks.dims[2];

        // Convert logits to alpha (0-255)
        const alpha = new Uint8Array(maskWidth * maskHeight);
        for (let i = 0; i < masks.length; i++) {
          const logit = masks[i];
          const sigmoid = 1 / (1 + Math.exp(-logit));
          alpha[i] = Math.round(sigmoid * 255);
        }

        const mask: Mask = { width: maskWidth, height: maskHeight, alpha };
        self.postMessage({ type: "DECODED", mask } as DecoderResponse);
        break;
      }

      case "CANCEL_DECODE": {
        // No direct ORT cancel, but we could add logic to stop post-processing if needed
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
    self.postMessage({ type: "ERROR", message: err.message } as DecoderResponse);
  }
};
