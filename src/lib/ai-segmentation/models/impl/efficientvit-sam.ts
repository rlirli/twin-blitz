/**
 * Implementation of EfficientViT-SAM family of models.
 * Handles L0, L1, L2, XL0, XL1 variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { imageToTensor } from "../../core/utils/image-utils";
import { Mask, cropAndRescaleMask } from "../../core/utils/mask-utils";
import { Point, SegmentationModel, ModelMetadata } from "../segmentation-model";

export class EfficientViTSAMModel implements SegmentationModel {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;

  constructor(public readonly metadata: ModelMetadata) {}

  async load(encoderData: ArrayBuffer, decoderData: ArrayBuffer): Promise<void> {
    const commonOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ["webgpu", "wasm"],
    };

    const loadTasks: Promise<void>[] = [];

    if (encoderData.byteLength > 0) {
      loadTasks.push(
        ort.InferenceSession.create(encoderData, commonOptions).then((s) => {
          this.encoderSession = s;
        }),
      );
    }
    if (decoderData.byteLength > 0) {
      loadTasks.push(
        ort.InferenceSession.create(decoderData, commonOptions).then((s) => {
          this.decoderSession = s;
        }),
      );
    }

    await Promise.all(loadTasks);
  }

  async encode(image: ImageBitmap, imageHash: string): Promise<string> {
    if (!this.encoderSession) throw new Error("Encoder session not initialized");

    const embeddingKey = getEmbeddingKey(this.metadata.id, this.metadata.version, imageHash);

    // 1. Check local cache (IndexedDB)
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    // 2. Resolve target dimensions (Letterbox for quality)
    const res = this.metadata.targetResolution;
    const w = image.width;
    const h = image.height;
    const scale = Math.min(res / w, res / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);
    const padX = (res - newW) / 2;
    const padY = (res - newH) / 2;

    // Fast Canvas Letterboxing
    const canvas = new OffscreenCanvas(res, res);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, res, res);
    ctx.drawImage(image, padX, padY, newW, newH);

    const scaled = canvas.transferToImageBitmap();
    const tensorData = await imageToTensor(scaled);

    const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, res, res]);

    // 3. Encoder Inference
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: inputTensor });

    const outputName = this.encoderSession.outputNames[0];
    const embeddings = results[outputName].data as Float32Array;

    // 4. Store result WITH original dimensions and letterbox info
    await set(embeddingKey, {
      embeddings,
      originalWidth: image.width,
      originalHeight: image.height,
      letterbox: { scale, padX, padY, newW, newH },
    });

    return embeddingKey;
  }

  async decode(embeddingKey: string, points: Point[]): Promise<Mask> {
    if (!this.decoderSession) throw new Error("Decoder session not initialized");

    // 1. Fetch embeddings
    const entry = await get(embeddingKey);
    if (!entry) throw new Error("Embeddings not found in IndexedDB");

    const { embeddings: embeddingArray, originalWidth, originalHeight, letterbox } = entry;
    const { scale, padX, padY, newW, newH } = letterbox || {
      scale: 1,
      padX: 0,
      padY: 0,
      newW: this.metadata.targetResolution,
      newH: this.metadata.targetResolution,
    };

    const embeddings = new ort.Tensor("float32", embeddingArray, [1, 256, 64, 64]);

    // 2. Prepare Clicks: Use absolute coordinates in 1024x1024 space
    // Most SAM decoders (including EfficientViT) are exported with a fixed 1024x1024 coordinate system.
    const res = this.metadata.targetResolution;
    const coordScale = 1024 / res;

    const pointCoords = new ort.Tensor(
      "float32",
      new Float32Array(
        points
          .map((p) => {
            const x = (p.x * originalWidth * scale + padX) * coordScale;
            const y = (p.y * originalHeight * scale + padY) * coordScale;
            return [x, y];
          })
          .flat(),
      ),
      [1, points.length, 2],
    );

    const pointLabels = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => (p.positive ? 1 : 0))),
      [1, points.length],
    );

    const inputs: any = {};
    const inputNames = this.decoderSession.inputNames;

    if (inputNames.includes("image_embeddings")) inputs.image_embeddings = embeddings;
    if (inputNames.includes("point_coords")) inputs.point_coords = pointCoords;
    if (inputNames.includes("point_labels")) inputs.point_labels = pointLabels;

    // Optional inputs
    if (inputNames.includes("mask_input")) {
      inputs.mask_input = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
    }
    if (inputNames.includes("has_mask_input")) {
      inputs.has_mask_input = new ort.Tensor("float32", new Float32Array([0]), [1]);
    }
    if (inputNames.includes("orig_im_size")) {
      // Pass 1024, 1024 because we normalized coordinates to that space
      inputs.orig_im_size = new ort.Tensor("float32", new Float32Array([1024, 1024]), [2]);
    }

    // 4. Decoder Inference
    const results = await this.decoderSession.run(inputs);

    const outputName = this.decoderSession.outputNames[0];
    const maskTensor = results[outputName];
    const maskData = maskTensor.data as Float32Array;

    const dims = maskTensor.dims;
    const outH = dims[2];
    const outW = dims[3];

    // Thresholding
    const alpha = new Uint8Array(outH * outW);
    for (let i = 0; i < outH * outW; i++) {
      alpha[i] = maskData[i] > 0 ? 255 : 0;
    }

    const rawMask = { width: outW, height: outH, alpha };

    // Reverse Letterbox
    const outScaleX = outW / res;
    const outScaleY = outH / res;
    const cropX = padX * outScaleX;
    const cropY = padY * outScaleY;
    const cropW = newW * outScaleX;
    const cropH = newH * outScaleY;

    return await cropAndRescaleMask(
      rawMask,
      cropX,
      cropY,
      cropW,
      cropH,
      originalWidth,
      originalHeight,
    );
  }

  dispose(): void {
    // onnxruntime sessions don't have a direct .release() in browser
    // but nullifying them allows GC to attempt cleanup.
    this.encoderSession = null;
    this.decoderSession = null;
  }
}
