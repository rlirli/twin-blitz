/**
 * Implementation of Segment Anything 2.1 (SAM2) model family.
 * Handles tiny, small, base, large variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { Mask } from "../../core/utils/mask-utils";
import {
  applyLetterbox,
  imageBitmapToNormalizedTensor,
  mapPointToLetterbox,
  undoLetterbox,
} from "../../core/utils/segmentation-utils";
import { Point, SegmentationModel, ModelMetadata } from "../segmentation-model";

export class SAM2Model implements SegmentationModel {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;

  constructor(public readonly metadata: ModelMetadata) {}

  async load(encoderData: ArrayBuffer, decoderData: ArrayBuffer): Promise<void> {
    const commonOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    };

    /**
     * Helper to load a session with robust fallback.
     * WebGPU/WASM optimizations can sometimes fail on symbolic shapes.
     */
    const loadSession = async (data: ArrayBuffer, name: string) => {
      if (data.byteLength === 0) return null;

      try {
        console.info(`[SAM2Model] Tier 1: Attempting WebGPU for ${name}...`);
        return await ort.InferenceSession.create(data, commonOptions);
      } catch (err: any) {
        console.warn(`[SAM2Model] Tier 1 (WebGPU) failed for ${name}:`, err.message || err);

        try {
          console.info(`[SAM2Model] Tier 2: Attempting WASM (Optimized) for ${name}...`);
          return await ort.InferenceSession.create(data, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
        } catch (wasmErr: any) {
          console.warn(
            `[SAM2Model] Tier 2 (WASM Optimized) failed for ${name}:`,
            wasmErr.message || wasmErr,
          );

          console.info(`[SAM2Model] Tier 3: Attempting WASM (Safe Mode) for ${name}...`);
          try {
            return await ort.InferenceSession.create(data, {
              executionProviders: ["wasm"],
              graphOptimizationLevel: "disabled",
            });
          } catch (safeErr: any) {
            console.error(`[SAM2Model] All tiers failed for ${name}:`, safeErr.message || safeErr);
            throw safeErr;
          }
        }
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

    // 1. Prepare image at target resolution (Letterbox)
    const res = this.metadata.targetResolution;
    const { bitmap, info } = await applyLetterbox(image, res);

    // 2. Convert to normalized tensor (SAM2 uses ImageNet)
    const tensorData = await imageBitmapToNormalizedTensor(bitmap, true);

    // Some SAM2 models have a frame/batch dimension [1, 1, 3, H, W]
    const dimsMeta = (this.encoderSession as any).inputsMeta?.[this.encoderSession.inputNames[0]]
      ?.dims;
    const is5D = dimsMeta?.length === 5;
    const inputTensor = new ort.Tensor(
      "float32",
      tensorData,
      is5D ? [1, 1, 3, res, res] : [1, 3, res, res],
    );

    // 3. Encoder Inference
    const results = await this.encoderSession.run({
      [this.encoderSession.inputNames[0]]: inputTensor,
    });

    // 4. Store ALL produced outputs (SAM2 has multiple high-res feature scales)
    const storage: any = {
      originalWidth: image.width,
      originalHeight: image.height,
      letterbox: info,
      outputs: {},
    };

    for (const name of this.encoderSession.outputNames) {
      storage.outputs[name] = results[name].data;
    }

    await set(embeddingKey, storage);
    return embeddingKey;
  }

  async decode(embeddingKey: string, points: Point[]): Promise<Mask> {
    if (!this.decoderSession) throw new Error("Decoder session not initialized");

    const entry = await get(embeddingKey);
    if (!entry) throw new Error(`Embeddings not found in cache for key: ${embeddingKey}`);

    // Robust destructuring with failover
    const {
      outputs: rawOutputs,
      originalWidth,
      originalHeight,
      letterbox: info,
    } = entry as {
      outputs: Record<string, any>;
      originalWidth: number;
      originalHeight: number;
      letterbox: any;
    };

    // If 'outputs' key is missing, check if it was saved as 'embeddings' (EfficientViT fallback)
    const outputs = rawOutputs || (entry.embeddings ? { image_embeddings: entry.embeddings } : {});
    const res = this.metadata.targetResolution;

    // 1. Helper for safe dimension metadata
    const getExpectedShape = (name: string) =>
      (this.decoderSession as any).inputsMeta?.[name]?.dims;

    // 2. Map clicks to letterbox space (Some models expect 1024x1024 absolute coords)
    const inputNames = this.decoderSession.inputNames;
    const outputNames = this.decoderSession.outputNames;

    const needs1024Scale = res !== 1024;
    const coordScale = needs1024Scale ? 1024 / res : 1;

    const mapped = points.map((p) => mapPointToLetterbox(p, info, coordScale));
    const flatCoords = new Float32Array(mapped.flatMap((p) => [p.x, p.y]));
    const flatLabels = new Float32Array(points.map((p) => (p.positive ? 1 : 0)));

    const coordsShape = getExpectedShape("point_coords") || [1, points.length, 2];
    const is5D = coordsShape.length === 4 || coordsShape.length === 5;

    const inputs: any = {
      point_coords: new ort.Tensor(
        "float32",
        flatCoords,
        is5D ? [1, 1, points.length, 2] : [1, points.length, 2],
      ),
      point_labels: new ort.Tensor(
        "float32",
        flatLabels,
        is5D ? [1, 1, points.length] : [1, points.length],
      ),
    };

    // 3. Helper to find features by prefix (Image models have varying output names)
    const findInOutputs = (prefixes: string[]) => {
      for (const p of prefixes) {
        if (outputs[p]) return outputs[p];
        const match = Object.keys(outputs).find((k) => k.startsWith(p));
        if (match) return outputs[match];
      }
      return null;
    };

    // 4. Map Features
    // - Primary Embedding
    const encEmbed = findInOutputs(["image_embeddings", "image_embed", "image_features"]);
    if (encEmbed) {
      const name = inputNames.find((n) => n.includes("embed") || n.includes("feat"));
      if (name) {
        const shape = getExpectedShape(name) || [1, 256, 64, 64];
        inputs[name] = new ort.Tensor(
          "float32",
          encEmbed,
          shape.length === 5 ? [1, 1, ...shape.slice(-3)] : shape,
        );
      }
    }

    // - High Resolution features (crucial for SAM2 quality)
    if (inputNames.includes("high_res_feats_0")) {
      const data = findInOutputs(["high_res_feats_0"]);
      if (data)
        inputs.high_res_feats_0 = new ort.Tensor(
          "float32",
          data,
          getExpectedShape("high_res_feats_0") || [1, 32, 256, 256],
        );
    }
    if (inputNames.includes("high_res_feats_1")) {
      const data = findInOutputs(["high_res_feats_1"]);
      if (data)
        inputs.high_res_feats_1 = new ort.Tensor(
          "float32",
          data,
          getExpectedShape("high_res_feats_1") || [1, 64, 128, 128],
        );
    }

    // 5. Auxiliary inputs
    const maskInputName = inputNames.find((n) => n.includes("mask_input"));
    if (maskInputName) {
      const shape = getExpectedShape(maskInputName) || [1, 1, 256, 256];
      inputs[maskInputName] = new ort.Tensor(
        "float32",
        new Float32Array(shape.reduce((a: number, b: number) => a * b, 1)),
        shape,
      );
    }
    const hasMaskInputName = inputNames.find((n) => n.includes("has_mask_input"));
    if (hasMaskInputName) {
      inputs[hasMaskInputName] = new ort.Tensor("float32", new Float32Array([0]), [1]);
    }

    const origSizeName = inputNames.find(
      (n) => n.includes("orig_im_size") || n.includes("orig_size"),
    );
    if (origSizeName) {
      // Standard SAM usually expects [H, W] of the *target* resolution or original
      inputs[origSizeName] = new ort.Tensor("float32", new Float32Array([1024, 1024]), [2]);
    }

    // 6. Inference
    const results = await this.decoderSession.run(inputs);

    // 7. Resolve Mask Output (Pick the best one if multiple are provided)
    const maskName = outputNames.find((n) => n.includes("masks")) || outputNames[0];
    const scoreName = outputNames.find((n) => n.includes("scores") || n.includes("iou"));

    const maskTensor = results[maskName];
    let maskData = maskTensor.data as Float32Array;
    const dims = maskTensor.dims;

    const [outH, outW] = [dims[dims.length - 2], dims[dims.length - 1]];
    const numMasks = dims.length === 4 ? dims[1] : 1;

    // Pick best index using scores if available
    if (numMasks > 1 && scoreName && results[scoreName]) {
      const scores = results[scoreName].data as Float32Array;
      let bestIdx = 0;
      for (let i = 1; i < numMasks; i++) {
        if (scores[i] > scores[bestIdx]) bestIdx = i;
      }
      maskData = maskData.subarray(bestIdx * outH * outW, (bestIdx + 1) * outH * outW);
    }

    // 8. Final Thresholding and Alpha Map
    const alpha = new Uint8Array(outW * outH);
    for (let i = 0; i < outW * outH; i++) {
      alpha[i] = maskData[i] > 0.0 ? 255 : 0;
    }

    // 9. Inverse Transformation
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
