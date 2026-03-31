/**
 * Factory for creating SegmentationModel instances.
 */

import { EfficientViTSAMModel } from "./impl/efficientvit-sam";
import { SAM2Model } from "./impl/sam2";
import { AVAILABLE_MODELS, ModelId } from "./model-constants";
import { SegmentationModel } from "./segmentation-model";

export class ModelFactory {
  static create(modelId: ModelId): SegmentationModel {
    const config = AVAILABLE_MODELS[modelId];
    if (!config) throw new Error(`Unknown model ID: ${modelId}`);

    if (modelId === "SAM2_HIERA_TINY") {
      return new SAM2Model(config);
    }

    // Default to EfficientViT-SAM variants
    return new EfficientViTSAMModel(config);
  }
}
