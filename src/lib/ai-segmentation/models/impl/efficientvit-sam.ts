/**
 * Implementation of EfficientViT-SAM family of models.
 * Handles L0, L1, L2, XL0, XL1 variants.
 */

import { get, set } from "idb-keyval";
import * as ort from "onnxruntime-web";

import { getEmbeddingKey } from "../../core/utils/embedding-utils";
import { imageToTensor, scaleImage } from "../../core/utils/image-utils";
import { Mask } from "../../core/utils/mask-utils";
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

    // 2. Preprocess: Downscale to model-specific resolution
    const res = this.metadata.targetResolution;
    const scaled = await scaleImage(image, res, res);
    const tensorData = await imageToTensor(scaled);

    const inputTensor = new ort.Tensor("float32", tensorData, [1, 3, res, res]);

    // 3. Encoder Inference
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: inputTensor });

    // Dynamically resolve output key (could be 'image_embeddings' or similar)
    const outputName = this.encoderSession.outputNames[0];
    const embeddings = results[outputName].data as Float32Array;

    // 4. Store result
    await set(embeddingKey, embeddings);

    return embeddingKey;
  }

  async decode(embeddingKey: string, points: Point[]): Promise<Mask> {
    if (!this.decoderSession) throw new Error("Decoder session not initialized");

    // 1. Fetch embeddings
    const embeddingArray = await get(embeddingKey);
    if (!embeddingArray) throw new Error("Embeddings not found in IndexedDB");

    const embeddings = new ort.Tensor("float32", embeddingArray, [1, 256, 64, 64]);

    // 2. Prepare Clicks
    const pointCoords = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => [p.x, p.y]).flat()),
      [1, points.length, 2],
    );
    const pointLabels = new ort.Tensor(
      "float32",
      new Float32Array(points.map((p) => (p.positive ? 1 : 0))),
      [1, points.length],
    );

    const res = this.metadata.targetResolution;
    const maskInput = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
    const hasMaskInput = new ort.Tensor("float32", new Float32Array([0]), [1]);
    const origImSize = new ort.Tensor("float32", new Float32Array([res, res]), [2]);

    const inputs: any = {};
    const inputNames = this.decoderSession.inputNames;

    if (inputNames.includes("image_embeddings")) inputs.image_embeddings = embeddings;
    if (inputNames.includes("point_coords")) inputs.point_coords = pointCoords;
    if (inputNames.includes("point_labels")) inputs.point_labels = pointLabels;

    // The following are not part of L0 input (other variants not yet checked)
    if (inputNames.includes("mask_input")) inputs.mask_input = maskInput;
    if (inputNames.includes("has_mask_input")) inputs.has_mask_input = hasMaskInput;
    if (inputNames.includes("orig_im_size")) inputs.orig_im_size = origImSize;

    // 4. Decoder Inference
    const results = await this.decoderSession.run(inputs);

    // Resolve output (usually 'masks')
    const outputName = this.decoderSession.outputNames[0];
    const maskData = results[outputName].data as Float32Array;

    // 5. Binary Thresholding (as per plan alpha >= 128)
    const alpha = new Uint8Array(res * res);
    for (let i = 0; i < maskData.length; i++) {
      alpha[i] = maskData[i] > 0 ? 255 : 0;
    }

    return {
      width: res,
      height: res,
      alpha,
    };
  }

  dispose(): void {
    // onnxruntime sessions don't have a direct .release() in browser
    // but nullifying them allows GC to attempt cleanup.
    this.encoderSession = null;
    this.decoderSession = null;
  }
}
