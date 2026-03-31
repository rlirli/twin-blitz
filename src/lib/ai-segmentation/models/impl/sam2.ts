/**
 * Implementation of Segment Anything 2.1 (SAM2) model family.
 * Handles tiny, small, base, large variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { Mask, cropAndRescaleMask } from "../../core/utils/mask-utils";
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
        // We slice(0) to prevent detachment if the attempt fails
        return await ort.InferenceSession.create(data.slice(0), commonOptions);
      } catch (err: any) {
        console.warn(`[SAM2Model] Tier 1 (WebGPU) failed for ${name}:`, err.message || err);

        try {
          console.info(`[SAM2Model] Tier 2: Attempting WASM (Optimized) for ${name}...`);
          return await ort.InferenceSession.create(data.slice(0), {
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
              graphOptimizationLevel: "disabled", // Disabling optimizations often fixes ShapeInferenceErrors
            });
          } catch (safeErr: any) {
            console.error(`[SAM2Model] All tiers failed for ${name}:`, safeErr.message || safeErr);
            throw safeErr;
          }
        }
      }
    };

    const [enc, dec] = await Promise.all([
      encoderData.byteLength > 0 ? loadSession(encoderData, "encoder") : Promise.resolve(null),
      decoderData.byteLength > 0 ? loadSession(decoderData, "decoder") : Promise.resolve(null),
    ]);

    if (enc) {
      this.encoderSession = enc;
      const meta = (enc as any).inputsMeta?.[enc.inputNames[0]];
      console.log(
        `[SAM2Model] Encoder loaded. Input: ${enc.inputNames[0]} ${meta ? JSON.stringify(meta) : "unknown shape"}`,
      );
    }
    if (dec) {
      this.decoderSession = dec;
      console.log(`[SAM2Model] Decoder loaded. Inputs: ${dec.inputNames.join(", ")}`);
    }
  }

  async encode(image: ImageBitmap, imageHash: string): Promise<string> {
    if (!this.encoderSession) throw new Error("Encoder session not initialized");

    const embeddingKey = getEmbeddingKey(this.metadata.id, this.metadata.version, imageHash);

    // 1. Check local cache (IndexedDB)
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    // 2. Resolve target dimensions (Letterbox)
    const res = this.metadata.targetResolution;
    const w = image.width;
    const h = image.height;
    const scale = Math.min(res / w, res / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);
    const padX = (res - newW) / 2;
    const padY = (res - newH) / 2;

    // 3. Fast Canvas Resizing (Letterboxed into a square canvas)
    const canvas = new OffscreenCanvas(res, res);
    const ctx = canvas.getContext("2d")!;
    // Clear to black (standard for padding)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, res, res);
    // Draw centered
    ctx.drawImage(image, padX, padY, newW, newH);

    const idata = ctx.getImageData(0, 0, res, res).data;
    const tensor = new Float32Array(3 * res * res);
    const chSize = res * res;

    // Normalization + Tensorization
    for (let i = 0; i < chSize; i++) {
      const srcIdx = i * 4;
      tensor[i] = (idata[srcIdx] / 255.0 - 0.485) / 0.229; // R
      tensor[i + chSize] = (idata[srcIdx + 1] / 255.0 - 0.456) / 0.224; // G
      tensor[i + chSize * 2] = (idata[srcIdx + 2] / 255.0 - 0.406) / 0.225; // B
    }

    // Dynamic Shape detection (Is 5D?)
    const dimsMeta = (this.encoderSession as any).inputsMeta?.[this.encoderSession.inputNames[0]]
      ?.dims;
    const is5D = dimsMeta?.length === 5;
    const dims = is5D ? [1, 1, 3, res, res] : [1, 3, res, res];
    const inputTensor = new ort.Tensor("float32", tensor, dims);

    console.log(`[SAM2Model] Encoding image (Normalization + Letterbox). is5D: ${is5D}`);

    // 4. Encoder Inference
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: inputTensor });

    // Store ALL outputs
    const storage: Record<string, any> = {
      originalWidth: image.width,
      originalHeight: image.height,
      letterbox: { scale, padX, padY, newW, newH },
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

    // 1. Fetch multi-scale embeddings
    const entry = await get(embeddingKey);
    if (!entry) throw new Error("Embeddings not found in IndexedDB");

    const { outputs, originalWidth, originalHeight, letterbox } = entry;
    const { scale, padX, padY, newW, newH } = letterbox || { scale: 1, padX: 0, padY: 0 };

    // 2. Prepare Clicks: Map from relative original to letterboxed absolute
    const getExpectedShape = (name: string) =>
      (this.decoderSession as any).inputsMeta?.[name]?.dims;

    const coordsShape = getExpectedShape("point_coords") || [1, points.length, 2];
    const isCoords5D = coordsShape.length === 4; // B, T, P, 2

    const pointCoords = new ort.Tensor(
      "float32",
      new Float32Array(
        points
          .map((p) => {
            const x = p.x * originalWidth * scale + padX;
            const y = p.y * originalHeight * scale + padY;
            return [x, y];
          })
          .flat(),
      ),
      isCoords5D ? [1, 1, points.length, 2] : [1, points.length, 2],
    );

    const pointLabels = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => (p.positive ? 1 : 0))),
      isCoords5D ? [1, 1, points.length] : [1, points.length],
    );

    console.log(`[SAM2Model] Decoding clicks. Points: ${points.length}, is5D: ${isCoords5D}`);

    const inputs: any = {};
    const inputNames = this.decoderSession.inputNames;

    // Map outputs to inputs
    const findOutput = (prefixes: string[]) => {
      for (const prefix of prefixes) {
        if (outputs[prefix]) return outputs[prefix];
        const match = Object.keys(outputs).find((k) => k.startsWith(prefix));
        if (match) return outputs[match];
      }
      return null;
    };

    const embedData = findOutput(["image_embeddings", "image_embed", "image_features"]);
    if (embedData) {
      const name = inputNames.find((n) => n.includes("embed") || n.includes("feat"));
      if (name) {
        const shape = getExpectedShape(name) || [1, 256, 64, 64];
        const dims = shape.length === 5 ? [1, 1, 256, 64, 64] : [1, 256, 64, 64];
        inputs[name] = new ort.Tensor("float32", embedData, dims);
      }
    }

    if (inputNames.includes("high_res_feats_0")) {
      const data = outputs.high_res_feats_0 || outputs.high_res_feats_0_0;
      if (data) {
        const shape = getExpectedShape("high_res_feats_0") || [1, 32, 256, 256];
        const dims = shape.length === 5 ? [1, 1, 32, 256, 256] : [1, 32, 256, 256];
        inputs.high_res_feats_0 = new ort.Tensor("float32", data, dims);
      }
    }
    if (inputNames.includes("high_res_feats_1")) {
      const data = outputs.high_res_feats_1 || outputs.high_res_feats_1_0;
      if (data) {
        const shape = getExpectedShape("high_res_feats_1") || [1, 64, 128, 128];
        const dims = shape.length === 5 ? [1, 1, 64, 128, 128] : [1, 64, 128, 128];
        inputs.high_res_feats_1 = new ort.Tensor("float32", data, dims);
      }
    }

    inputs.point_coords = pointCoords;
    inputs.point_labels = pointLabels;

    const maskInputName = inputNames.find((n) => n.includes("mask_input"));
    if (maskInputName) {
      const shape = getExpectedShape(maskInputName) || [1, 1, 256, 256];
      const size = shape.reduce((a: number, b: number) => a * b, 1);
      inputs[maskInputName] = new ort.Tensor("float32", new Float32Array(size), shape);
    }

    const hasMaskInputName = inputNames.find((n) => n.includes("has_mask_input"));
    if (hasMaskInputName) {
      inputs[hasMaskInputName] = new ort.Tensor("float32", new Float32Array([0]), [1]);
    }

    const res = this.metadata.targetResolution;
    const origSizeName = inputNames.find(
      (n) => n.includes("orig_im_size") || n.includes("orig_size"),
    );
    if (origSizeName) {
      inputs[origSizeName] = new ort.Tensor("float32", new Float32Array([res, res]), [2]);
    }

    const results = await this.decoderSession.run(inputs);
    const outputName = this.decoderSession.outputNames.includes("masks")
      ? "masks"
      : this.decoderSession.outputNames[0];

    const maskTensor = results[outputName];
    const maskData = maskTensor.data as Float32Array;
    const dims = maskTensor.dims;
    const outH = dims[2];
    const outW = dims[3];

    // Important: We need to reverse letterbox.
    // The mask resolution (outH, outW) might be different from encoding resolution (res, res).
    // Usually it's 1:1 (1024x1024) or 1:4 (256x256).
    const outScaleX = outW / res;
    const outScaleY = outH / res;

    const alpha = new Uint8Array(outW * outH);
    for (let i = 0; i < outW * outH; i++) {
      alpha[i] = maskData[i] > 0 ? 255 : 0;
    }

    const rawMask = { width: outW, height: outH, alpha };

    // Use un-padding logic
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
    this.encoderSession = null;
    this.decoderSession = null;
  }
}
