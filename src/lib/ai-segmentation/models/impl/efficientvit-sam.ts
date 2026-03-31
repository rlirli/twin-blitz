/**
 * Implementation of EfficientViT-SAM family of models.
 * Handles L0, L1, L2, XL0, XL1 variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { imageToTensor, scaleImage } from "../../core/utils/image-utils";
import { Mask, rescaleMask } from "../../core/utils/mask-utils";
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

    // 2. Preprocess: Resize and STRETCH to a square target resolution (required for simple ONNX export)
    const res = this.metadata.targetResolution;
    // Note: We use scaleImage but it should definitely stretch if given square res.
    const scaled = await scaleImage(image, res, res);
    const tensorData = await imageToTensor(scaled);

    const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, res, res]);

    // 3. Encoder Inference
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: inputTensor });

    const outputName = this.encoderSession.outputNames[0];
    const embeddings = results[outputName].data as Float32Array;

    // 4. Store result WITH original dimensions for back-scaling in decode
    await set(embeddingKey, {
      embeddings,
      originalWidth: image.width,
      originalHeight: image.height,
    });

    return embeddingKey;
  }

  async decode(embeddingKey: string, points: Point[]): Promise<Mask> {
    if (!this.decoderSession) throw new Error("Decoder session not initialized");

    // 1. Fetch embeddings
    const entry = await get(embeddingKey);
    if (!entry) throw new Error("Embeddings not found in IndexedDB");

    const { embeddings: embeddingArray, originalWidth, originalHeight } = entry;

    const embeddings = new ort.Tensor("float32", embeddingArray, [1, 256, 64, 64]);

    // 2. Prepare Clicks: Use relative coordinates (0-1) scaled to model internal resolution
    // We assume 'points' passed to us are now relative (x/w, y/h)
    const res = this.metadata.targetResolution;

    const pointCoords = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => [p.x * res, p.y * res]).flat()),
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

    // Optional inputs found in some larger SAM models (optional for L0/L1)
    if (inputNames.includes("mask_input")) {
      inputs.mask_input = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
    }
    if (inputNames.includes("has_mask_input")) {
      inputs.has_mask_input = new ort.Tensor("float32", new Float32Array([0]), [1]);
    }
    if (inputNames.includes("orig_im_size")) {
      inputs.orig_im_size = new ort.Tensor("float32", new Float32Array([res, res]), [2]);
    }

    // 4. Decoder Inference
    const results = await this.decoderSession.run(inputs);

    const outputName = this.decoderSession.outputNames[0];
    const maskTensor = results[outputName];
    const maskData = maskTensor.data as Float32Array;

    // Resolve output shape: usually [1, 4, H_out, W_out] or [1, 1, H_out, W_out]
    const dims = maskTensor.dims;
    const outH = dims[2];
    const outW = dims[3];
    const maskSize = outH * outW;

    // 5. Binary Thresholding
    const alpha = new Uint8Array(maskSize);
    for (let i = 0; i < maskSize; i++) {
      alpha[i] = maskData[i] > 0 ? 255 : 0;
    }

    const rawMask = {
      width: outW,
      height: outH,
      alpha,
    };

    // 6. Rescale back to original image resolution (e.g. crop dimensions)
    return await rescaleMask(rawMask, originalWidth, originalHeight);
  }

  dispose(): void {
    // onnxruntime sessions don't have a direct .release() in browser
    // but nullifying them allows GC to attempt cleanup.
    this.encoderSession = null;
    this.decoderSession = null;
  }
}
