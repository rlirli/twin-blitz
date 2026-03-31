export const AVAILABLE_MODELS = {
  EFFICIENTVIT_L0: {
    id: "EFFICIENTVIT_L0",
    name: "EfficientViT-SAM-L0",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l0_decoder.onnx",
    sizeMB: 140,
    version: "1",
  },
  EFFICIENTVIT_L1: {
    id: "EFFICIENTVIT_L1",
    name: "EfficientViT-SAM-L1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l1_decoder.onnx",
    sizeMB: 192,
    version: "1",
  },
  EFFICIENTVIT_L2: {
    id: "EFFICIENTVIT_L2",
    name: "EfficientViT-SAM-L2",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/l2_decoder.onnx",
    sizeMB: 246,
    version: "1",
  },
  EFFICIENTVIT_XL0: {
    id: "EFFICIENTVIT_XL0",
    name: "EfficientViT-SAM-XL0",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl0_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl0_decoder.onnx",
    sizeMB: 469,
    version: "1",
  },
  EFFICIENTVIT_XL1: {
    id: "EFFICIENTVIT_XL1",
    name: "EfficientViT-SAM-XL1",
    encoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl1_encoder.onnx",
    decoderUrl:
      "https://huggingface.co/mit-han-lab/efficientvit-sam/resolve/main/onnx/xl1_decoder.onnx",
    sizeMB: 814,
    version: "1",
  },
} as const;

export type ModelId = keyof typeof AVAILABLE_MODELS;
export type ModelInfo = (typeof AVAILABLE_MODELS)[ModelId];
