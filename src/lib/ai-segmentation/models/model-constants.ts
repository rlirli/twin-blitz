/**
 * Constants for EfficientViT-SAM models.
 */

export type ModelId =
  | "EFFICIENTVIT_L0"
  | "EFFICIENTVIT_L1"
  | "EFFICIENTVIT_L2"
  | "EFFICIENTVIT_XL0"
  | "EFFICIENTVIT_XL1";

export interface ModelInfo {
  id: ModelId;
  name: string;
  version: string;
  encoderUrl: string;
  decoderUrl: string;
  sizeMB: number;
  targetResolution: number; // e.g. 1024 or 512
}

export const AVAILABLE_MODELS: Record<ModelId, ModelInfo> = {
  EFFICIENTVIT_L0: {
    id: "EFFICIENTVIT_L0",
    name: "EfficientViT-L0 (Fastest/Low VRAM)",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_decoder.onnx",
    sizeMB: 139.5,
    targetResolution: 1024,
  },
  EFFICIENTVIT_L1: {
    id: "EFFICIENTVIT_L1",
    name: "EfficientViT-L1 (Recommended/Balanced)",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_decoder.onnx",
    sizeMB: 191.5,
    targetResolution: 1024,
  },
  EFFICIENTVIT_L2: {
    id: "EFFICIENTVIT_L2",
    name: "EfficientViT-L2 (Highest Quality)",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_decoder.onnx",
    sizeMB: 245.5,
    targetResolution: 1024,
  },
  EFFICIENTVIT_XL0: {
    id: "EFFICIENTVIT_XL0",
    name: "EfficientViT-XL0",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl0_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl0_decoder.onnx",
    sizeMB: 468.5,
    targetResolution: 1024,
  },
  EFFICIENTVIT_XL1: {
    id: "EFFICIENTVIT_XL1",
    name: "EfficientViT-XL1",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl1_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl1_decoder.onnx",
    sizeMB: 813.5,
    targetResolution: 1024,
  },
};
