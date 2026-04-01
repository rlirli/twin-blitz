/**
 * Constants for AI segmentation models.
 */

export type ModelId =
  | "MOBILE_SAM"
  | "MOBILE_SAM_QUANT"
  | "EFFICIENTVIT_L0"
  | "EFFICIENTVIT_L1"
  | "EFFICIENTVIT_L2"
  | "EFFICIENTVIT_XL0"
  | "EFFICIENTVIT_XL1"
  | "SAM2_HIERA_TINY";

export interface ModelInfo {
  id: ModelId;
  name: string;
  version: string;
  encoderUrl?: string; // Optional if using ZIP
  decoderUrl?: string; // Optional if using ZIP
  zipUrl?: string; // Optional if using separate files
  encoderPath?: string; // Path inside ZIP
  decoderPath?: string; // Path inside ZIP
  sizeMB: number;
  targetWidth: number; // e.g. 1024 or 512
  targetHeight: number; // e.g. 1024 or 682
}

export const AVAILABLE_MODELS: Record<ModelId, ModelInfo> = {
  MOBILE_SAM: {
    id: "MOBILE_SAM",
    name: "Segment Anything (MobileSAM)",
    version: "20230629",
    zipUrl:
      "https://huggingface.co/vietanhdev/segment-anything-onnx-models/resolve/main/mobile_sam_20230629.zip",
    encoderPath: "mobile_sam.encoder.onnx",
    decoderPath: "sam_vit_h_4b8939.decoder.onnx",
    sizeMB: 36.7,
    targetWidth: 1024,
    targetHeight: 682,
  },
  MOBILE_SAM_QUANT: {
    id: "MOBILE_SAM_QUANT",
    name: "Segment Anything (MobileSAM Quant)",
    version: "20230629",
    zipUrl:
      "https://huggingface.co/vietanhdev/segment-anything-onnx-models/resolve/main/mobile_sam_20230629_quant.zip",
    encoderPath: "mobile_sam.encoder.quant.onnx",
    decoderPath: "sam_vit_h_4b8939.decoder.quant.onnx",
    sizeMB: 11.0,
    targetWidth: 1024,
    targetHeight: 682,
  },
  EFFICIENTVIT_L0: {
    id: "EFFICIENTVIT_L0",
    name: "EfficientViT-L0",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_decoder.onnx",
    sizeMB: 139.5,
    targetWidth: 512,
    targetHeight: 512,
  },
  EFFICIENTVIT_L1: {
    id: "EFFICIENTVIT_L1",
    name: "EfficientViT-L1",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_decoder.onnx",
    sizeMB: 191.5,
    targetWidth: 512,
    targetHeight: 512,
  },
  EFFICIENTVIT_L2: {
    id: "EFFICIENTVIT_L2",
    name: "EfficientViT-L2",
    version: "v1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_decoder.onnx",
    sizeMB: 245.5,
    targetWidth: 512,
    targetHeight: 512,
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
    targetWidth: 1024,
    targetHeight: 1024,
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
    targetWidth: 1024,
    targetHeight: 1024,
  },
  SAM2_HIERA_TINY: {
    id: "SAM2_HIERA_TINY",
    name: "Segment Anything 2.1 (Hiera-Tiny)",
    version: "20260221",
    encoderUrl: "/models/sam2/sam2.1_hiera_tiny.encoder.onnx",
    decoderUrl: "/models/sam2/sam2.1_hiera_tiny.decoder.onnx",
    sizeMB: 39,
    targetWidth: 1024,
    targetHeight: 1024,
  },
};
