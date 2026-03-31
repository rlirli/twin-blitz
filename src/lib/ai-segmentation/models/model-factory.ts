/**
 * Factory for creating SegmentationModel instances.
 */

import { EfficientViTSAMModel } from "./impl/efficientvit-sam";
import { AVAILABLE_MODELS, ModelId } from "./model-constants";
import { SegmentationModel } from "./segmentation-model";

export class ModelFactory {
  static create(modelId: ModelId): SegmentationModel {
    const config = AVAILABLE_MODELS[modelId];
    if (!config) throw new Error(`Unknown model ID: ${modelId}`);

    // All current models are EfficientViT-SAM variants
    return new EfficientViTSAMModel({
      ...config,
      // Metadata in segmentation-model matches config in model-constants
    });
  }
}
