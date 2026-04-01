/**
 * Implementation of EfficientViT-SAM family of models.
 * Handles L0, L1, L2, XL0, XL1 variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web/webgpu";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { Mask } from "../../core/utils/mask-utils";
import {
  applyLetterbox,
  imageBitmapToNormalizedTensor,
  mapPointToLetterbox,
  undoLetterbox,
} from "../../core/utils/segmentation-utils";
import { getSafeExecutionProviders, getSafeOptimizationLevel } from "../model-factory";
import { Point, SegmentationModel, ModelMetadata } from "../segmentation-model";

export class EfficientViTSAMModel implements SegmentationModel {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;

  constructor(public readonly metadata: ModelMetadata) {}

  async load(encoderData: ArrayBuffer, decoderData: ArrayBuffer): Promise<void> {
    const commonOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: getSafeExecutionProviders(),
      graphOptimizationLevel: getSafeOptimizationLevel(),
      logSeverityLevel: 0, // 3 = Error
    };
    /**
     * Helper to load a session with robust fallback.
     */
    const loadSession = async (data: ArrayBuffer, name: string) => {
      if (data.byteLength === 0) return null;
      try {
        console.info(
          `[EfficientViT] Loading ${name} with providers:`,
          commonOptions.executionProviders,
        );
        const session = await ort.InferenceSession.create(data, commonOptions);

        // Access the hardware descriptor to confirm WebGPU is active
        try {
          const device = await (ort.env as any).webgpu.device;
          if (device) {
            console.info(`[EfficientViT] Hardware confirmed: WebGPU Device found`, device);
          }
        } catch (e) {
          // Device might not be initialized yet if fallback was immediate
          console.warn(`[EfficientViT] WebGPU Device not found`, e);
        }

        return session;
      } catch (err: any) {
        console.warn(`[EfficientViT] WebGPU failed for ${name}, falling back to WASM...`, err);
        return await ort.InferenceSession.create(data, { executionProviders: ["wasm"] });
      }
    };

    const tasks: Promise<void>[] = [];

    if (encoderData.byteLength > 0) {
      tasks.push(
        loadSession(encoderData, "encoder").then((s) => {
          this.encoderSession = s;
        }),
      );
    }
    if (decoderData.byteLength > 0) {
      tasks.push(
        loadSession(decoderData, "decoder").then((s) => {
          this.decoderSession = s;
        }),
      );
    }

    await Promise.all(tasks);
  }

  async encode(image: ImageBitmap, imageHash: string): Promise<string> {
    if (!this.encoderSession) throw new Error("Encoder session not initialized");

    const embeddingKey = getEmbeddingKey(this.metadata.id, this.metadata.version, imageHash);
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    // 1. Resolve target dimensions (Letterbox)
    const targetWidth = this.metadata.targetWidth;
    const targetHeight = this.metadata.targetHeight;
    const { bitmap, info } = await applyLetterbox(image, targetWidth, targetHeight);

    // 2. Prepare Tensor (Normalize based on model variant, L-series usually uses 0-1)
    const normalize = this.metadata.id.startsWith("SAM2"); // L-series uses 0-1, SAM2 uses ImageNet
    const tensorData = await imageBitmapToNormalizedTensor(bitmap, normalize);
    const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, targetHeight, targetWidth]);

    // 3. Encoder Inference
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: inputTensor });

    const outputName = this.encoderSession.outputNames[0];
    const embeddings = results[outputName].data as Float32Array;

    // 4. Cache result
    await set(embeddingKey, {
      embeddings,
      originalWidth: image.width,
      originalHeight: image.height,
      letterbox: info,
    });

    return embeddingKey;
  }

  async decode(embeddingKey: string, points: Point[]): Promise<Mask> {
    if (!this.decoderSession) throw new Error("Decoder session not initialized");

    const entry = await get(embeddingKey);
    if (!entry) throw new Error("Embeddings not found in cache for key: " + embeddingKey);

    const { embeddings: embeddingArray, originalWidth, originalHeight, letterbox: info } = entry;
    // 1. Map clicks to 1024x1024 space (Standard SAM decoder expectation)
    const coordScale = 1024 / this.metadata.targetWidth;
    const mapped = points.map((p) => mapPointToLetterbox(p, info, coordScale));

    const pointCoords = new ort.Tensor(
      "float32",
      new Float32Array(mapped.flatMap((p) => [p.x, p.y])),
      [1, points.length, 2],
    );
    const pointLabels = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => (p.positive ? 1 : 0))),
      [1, points.length],
    );
    const embeddings = new ort.Tensor("float32", embeddingArray, [1, 256, 64, 64]);

    const inputs: any = {};
    const inputNames = this.decoderSession.inputNames;

    if (inputNames.includes("image_embeddings")) inputs.image_embeddings = embeddings;
    if (inputNames.includes("point_coords")) inputs.point_coords = pointCoords;
    if (inputNames.includes("point_labels")) inputs.point_labels = pointLabels;

    // Auxiliary inputs for robustness
    if (inputNames.includes("mask_input"))
      inputs.mask_input = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
    if (inputNames.includes("has_mask_input"))
      inputs.has_mask_input = new ort.Tensor("float32", new Float32Array([0]), [1]);
    if (inputNames.includes("orig_im_size"))
      inputs.orig_im_size = new ort.Tensor("float32", new Float32Array([1024, 1024]), [2]);

    const results = await this.decoderSession.run(inputs);
    const maskTensor = results[this.decoderSession.outputNames[0]];
    const maskData = maskTensor.data as Float32Array;

    const [outH, outW] = [
      maskTensor.dims[maskTensor.dims.length - 2],
      maskTensor.dims[maskTensor.dims.length - 1],
    ];
    const alpha = new Uint8Array(outH * outW);
    for (let i = 0; i < outH * outW; i++) {
      alpha[i] = maskData[i] > 0 ? 255 : 0;
    }

    // 3. Un-letterbox and resize back
    return await undoLetterbox(
      { width: outW, height: outH, alpha },
      info,
      originalWidth,
      originalHeight,
    );
  }

  dispose(): void {
    this.encoderSession = null;
    this.decoderSession = null;
  }
}
