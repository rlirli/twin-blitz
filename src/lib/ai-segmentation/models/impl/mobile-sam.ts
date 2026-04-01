/**
 * Implementation of Mobile-SAM model.
 * Uses a smaller encoder with the standard SAM ViT-H decoder.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web/webgpu";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { Mask } from "../../core/utils/mask-utils";
import {
  applyLetterbox,
  mapPointToLetterbox,
  undoLetterbox,
} from "../../core/utils/segmentation-utils";
import { getSafeExecutionProviders, getSafeOptimizationLevel } from "../model-factory";
import { Point, SegmentationModel, ModelMetadata } from "../segmentation-model";

export class MobileSAMModel implements SegmentationModel {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;

  constructor(public readonly metadata: ModelMetadata) {}

  async load(encoderData: ArrayBuffer, decoderData: ArrayBuffer): Promise<void> {
    const commonOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: getSafeExecutionProviders(),
      graphOptimizationLevel: getSafeOptimizationLevel(),
    };

    const loadSession = async (data: ArrayBuffer, name: string) => {
      if (data.byteLength === 0) return null;
      try {
        return await ort.InferenceSession.create(data, commonOptions);
      } catch (err: any) {
        console.warn(`[MobileSAM] WebGPU failed for ${name}, falling back to WASM...`, err);
        return await ort.InferenceSession.create(data, { executionProviders: ["wasm"] });
      }
    };

    const [enc, dec] = await Promise.all([
      loadSession(encoderData, "encoder"),
      loadSession(decoderData, "decoder"),
    ]);

    this.encoderSession = enc;
    this.decoderSession = dec;
  }

  async encode(image: ImageBitmap, imageHash: string): Promise<string> {
    if (!this.encoderSession) throw new Error("Encoder session not initialized");

    const embeddingKey = getEmbeddingKey(this.metadata.id, this.metadata.version, imageHash);
    const existing = await get(embeddingKey);
    if (existing) return embeddingKey;

    const targetWidth = this.metadata.targetWidth;
    const targetHeight = this.metadata.targetHeight;
    const { bitmap, info } = await applyLetterbox(image, targetWidth, targetHeight);

    const inputName = this.encoderSession.inputNames[0];

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const idata = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;

    const tensorData = new Float32Array(targetWidth * targetHeight * 3);
    for (let i = 0; i < targetWidth * targetHeight; i++) {
      tensorData[i * 3] = idata[i * 4];
      tensorData[i * 3 + 1] = idata[i * 4 + 1];
      tensorData[i * 3 + 2] = idata[i * 4 + 2];
    }

    const results = await this.encoderSession.run({
      [inputName]: new ort.Tensor("float32", tensorData, [targetHeight, targetWidth, 3]),
    });
    const embeddings = results[this.encoderSession.outputNames[0]].data as Float32Array;

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
    if (!entry) throw new Error("Embeddings not found in cache");

    const { embeddings: embeddingArray, originalWidth, originalHeight, letterbox: info } = entry;
    const targetWidth = this.metadata.targetWidth;

    // Map clicks back to 1024x1024 space
    const coordScale = 1024 / targetWidth;
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

    const inputs: any = {
      image_embeddings: embeddings,
      point_coords: pointCoords,
      point_labels: pointLabels,
      mask_input: new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor("float32", new Float32Array([0]), [1]),
      orig_im_size: new ort.Tensor("float32", new Float32Array([1024, 1024]), [2]),
    };

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
