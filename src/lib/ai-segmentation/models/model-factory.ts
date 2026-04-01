/**
 * Factory for creating SegmentationModel instances.
 */

import * as ort from "onnxruntime-web";

import { EfficientViTSAMModel } from "./impl/efficientvit-sam";
import { SAM2Model } from "./impl/sam2";
import { AVAILABLE_MODELS, ModelId } from "./model-constants";
import { SegmentationModel } from "./segmentation-model";

// --- Central ORT Configuration ---
const ORT_VERSION = "1.24.3"; // Matches package.json
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

// Global stability settings:
// SharedArrayBuffer (threaded WASM) requires Cross-Origin Isolation.
// iOS Safari is highly prone to crashes when using multi-threaded WASM on large models.
if (typeof self !== "undefined") {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS || !self.crossOriginIsolated) {
    ort.env.wasm.numThreads = 1;
  }
}
// ---------------------------------

export class ModelFactory {
  static create(modelId: ModelId): SegmentationModel {
    const config = AVAILABLE_MODELS[modelId];
    if (!config) throw new Error(`Unknown model ID: ${modelId}`);

    if (modelId.includes("SAM2")) {
      return new SAM2Model(config);
    }

    // Default to EfficientViT-SAM variants
    return new EfficientViTSAMModel(config);
  }
}
