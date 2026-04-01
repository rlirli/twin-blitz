/**
 * Factory for creating SegmentationModel instances.
 */

import * as ort from "onnxruntime-web/webgpu";

import { EfficientViTSAMModel } from "./impl/efficientvit-sam";
import { SAM2Model } from "./impl/sam2";
import { AVAILABLE_MODELS, ModelId } from "./model-constants";
import { SegmentationModel } from "./segmentation-model";

// --- Central ORT Configuration ---
const ORT_VERSION = "1.24.3"; // Matches package.json
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

// Strict iOS detection using only UserAgent strings for iPhone, iPad, and iPod.
export const isIOS =
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Global stability settings:
// SharedArrayBuffer (threaded WASM) requires Cross-Origin Isolation.
if (typeof self !== "undefined") {
  if (isIOS || !self.crossOriginIsolated) {
    ort.env.wasm.numThreads = 1;
  }
}

/**
 * Returns a stable list of execution providers based on device capabilities.
 */
export function getSafeExecutionProviders(): ort.InferenceSession.ExecutionProviderConfig[] {
  // WebGPU on iOS is currently a guaranteed crash for these models.
  // We keep WASM-only on iOS, but allow WebGPU on Desktop (even without isolation).
  if (isIOS) {
    return ["wasm"];
  }
  return ["webgpu", "wasm"];
}

/**
 * Returns the recommended optimization level for the current device.
 */
export function getSafeOptimizationLevel(): "all" | "extended" | "disabled" {
  const isMobile =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile ? "extended" : "all";
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
