/**
 * Generic WebWorker for image encoding.
 * Delegates all logic to a SegmentationModel instance.
 */

import { ModelFactory } from "../../models/model-factory";
import { SegmentationModel } from "../../models/segmentation-model";
import { EncoderMessage } from "./protocol";

let activeModel: SegmentationModel | null = null;
let activeEncodeId = 0;
let isBusy = false;

self.onmessage = async (e: MessageEvent<EncoderMessage>) => {
  const msg = e.data;

  if (msg.type === "LOAD_MODEL") {
    try {
      isBusy = true;
      activeModel?.dispose();
      activeModel = ModelFactory.create(msg.modelId);

      // The worker only needs the encoder binary
      await activeModel.loadEncoder(msg.modelData);
      self.postMessage({ type: "LOADED" });
    } catch (err: any) {
      self.postMessage({ type: "ERROR", message: `Failed to load model: ${err.message}` });
    } finally {
      isBusy = false;
    }
  } else if (msg.type === "ENCODE_IMAGE") {
    if (!activeModel) {
      self.postMessage({ type: "ERROR", message: "No model loaded" });
      return;
    }

    if (isBusy) {
      // Skip simultaneous encoding requests; proactive updates will catch the next one.
      return;
    }

    isBusy = true;
    const encodeId = ++activeEncodeId;

    try {
      const embeddingKey = await activeModel.encode(msg.image, msg.imageHash);
      if (encodeId !== activeEncodeId) return;

      self.postMessage({ type: "ENCODED", embeddingKey });
    } catch (err: any) {
      if (encodeId === activeEncodeId) {
        self.postMessage({ type: "ERROR", message: `Encoding failed: ${err.message}` });
      }
    } finally {
      isBusy = false;
    }
  } else if (msg.type === "DISPOSE") {
    activeModel?.dispose();
    activeModel = null;
  }
};
