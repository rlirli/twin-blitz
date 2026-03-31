/**
 * Generic WebWorker for mask decoding.
 * Delegates all logic to a SegmentationModel instance.
 */

import { ModelFactory } from "../../models/model-factory";
import { SegmentationModel } from "../../models/segmentation-model";
import { DecoderMessage } from "./protocol";

let activeModel: SegmentationModel | null = null;
let activeDecodeId = 0;

self.onmessage = async (e: MessageEvent<DecoderMessage>) => {
  const msg = e.data;

  if (msg.type === "LOAD_MODEL") {
    try {
      activeModel?.dispose();
      activeModel = ModelFactory.create(msg.modelId);

      // Load both pieces; worker will use decoder
      await activeModel.load(new ArrayBuffer(0), msg.modelData);
      self.postMessage({ type: "LOADED" });
    } catch (err: any) {
      self.postMessage({ type: "ERROR", message: `Failed to load model: ${err.message}` });
    }
  } else if (msg.type === "DECODE") {
    if (!activeModel) {
      self.postMessage({ type: "ERROR", message: "No model loaded" });
      return;
    }

    const decodeId = ++activeDecodeId;

    try {
      const mask = await activeModel.decode(msg.embeddingKey, msg.points);
      if (decodeId !== activeDecodeId) return;

      self.postMessage({ type: "DECODED", mask });
    } catch (err: any) {
      if (decodeId === activeDecodeId) {
        self.postMessage({ type: "ERROR", message: `Decoding failed: ${err.message}` });
      }
    }
  } else if (msg.type === "DISPOSE") {
    activeModel?.dispose();
    activeModel = null;
  }
};
