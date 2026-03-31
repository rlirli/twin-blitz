/**
 * Dedicated WebWorker for mask decoding.
 */

import { get } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { Mask } from "../utils/mask-utils";
import { DecoderMessage } from "./protocol";

let session: ort.InferenceSession | null = null;

// Track the current decoding process to allow "latest-click-wins" cancellation
let activeDecodeId: number = 0;

self.onmessage = async (e: MessageEvent<DecoderMessage>) => {
  const msg = e.data;

  if (msg.type === "LOAD_MODEL") {
    try {
      session = null;
      session = await ort.InferenceSession.create(msg.modelData, {
        executionProviders: ["webgpu", "wasm"],
      });
      self.postMessage({ type: "LOADED" });
    } catch (err: any) {
      self.postMessage({ type: "ERROR", message: `Failed to load decoder: ${err.message}` });
    }
  } else if (msg.type === "DECODE") {
    if (!session) {
      self.postMessage({ type: "ERROR", message: "No decoder session loaded" });
      return;
    }

    const decodeId = ++activeDecodeId;

    try {
      // 1. Get embedding from IndexedDB
      const embeddingArray = await get(msg.embeddingKey);
      if (!embeddingArray) {
        self.postMessage({ type: "ERROR", message: "Embeddings not found in IndexedDB" });
        return;
      }

      // Check if we were cancelled during DB read
      if (decodeId !== activeDecodeId) return;

      const embeddings = new ort.Tensor("float32", embeddingArray, [1, 256, 64, 64]);

      // 2. Prepare inputs for SAM/EfficientViT
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

      const inputs = {
        image_embeddings: embeddings,
        point_coords: pointCoords,
        point_labels: pointLabels,
        mask_input: maskInput,
        has_mask_input: hasMaskInput,
        orig_im_size: new ort.Tensor("float32", new Float32Array([1024, 1024]), [2]),
      };

      // 3. Inference
      const results = await session.run(inputs);

      // Check if we were cancelled during inference
      if (decodeId !== activeDecodeId) return;

      const output = results.masks;
      const maskData = output.data as Float32Array;

      // 4. Threshold and convert to Mask
      // SAM outputs logits; we use threshold 0 (sigmoid(0) = 0.5)
      const alpha = new Uint8ClampedArray(1024 * 1024);
      for (let i = 0; i < maskData.length; i++) {
        alpha[i] = maskData[i] > 0 ? 255 : 0;
      }

      const mask: Mask = {
        width: 1024,
        height: 1024,
        alpha: new Uint8Array(alpha),
      };

      self.postMessage({ type: "DECODED", mask });
    } catch (err: any) {
      if (decodeId === activeDecodeId) {
        self.postMessage({ type: "ERROR", message: `Decoding failed: ${err.message}` });
      }
    }
  } else if (msg.type === "DISPOSE") {
    session = null;
  }
};
