/**
 * Generic WebWorker for image encoding.
 * Delegates all logic to a SegmentationModel instance.
 */

import { ModelFactory } from "../../models/model-factory";
import { SegmentationModel } from "../../models/segmentation-model";
import { EncoderMessage } from "./protocol";

let activeModel: SegmentationModel | null = null;
let activeEncodeId = 0;

self.onmessage = async (e: MessageEvent<EncoderMessage>) => {
  const msg = e.data;

  if (msg.type === "LOAD_MODEL") {
    try {
      activeModel?.dispose();
      activeModel = ModelFactory.create(msg.modelId);

      // The worker only needs one of the two binaries,
      // but SegmentationModel.load() currently expects both encoder and decoder.
      // We'll pass dummy array buffer for whichever part this worker doesn't use.
      await activeModel.load(msg.modelData, new ArrayBuffer(0));
      self.postMessage({ type: "LOADED" });
    } catch (err: any) {
      self.postMessage({ type: "ERROR", message: `Failed to load model: ${err.message}` });
    }
  } else if (msg.type === "ENCODE_IMAGE") {
    if (!activeModel) {
      self.postMessage({ type: "ERROR", message: "No model loaded" });
      return;
    }

    const encodeId = ++activeEncodeId;

    try {
      const embeddingKey = await activeModel.encode(msg.image, msg.imageHash);
      if (encodeId !== activeEncodeId) return;

      self.postMessage({ type: "ENCODED", embeddingKey });
    } catch (err: any) {
      if (encodeId === activeEncodeId) {
        self.postMessage({ type: "ERROR", message: `Encoding failed: ${err.message}` });
      }
    }
  } else if (msg.type === "DISPOSE") {
    activeModel?.dispose();
    activeModel = null;
  }
};
