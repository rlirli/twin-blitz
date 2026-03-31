/**
 * Message protocols for Encoder and Decoder workers.
 */

import { ModelId } from "../../models/model-constants";
import { Mask } from "../utils/mask-utils";

export interface Point {
  x: number;
  y: number;
  positive: boolean;
}

export type EncoderMessage =
  | { type: "LOAD_MODEL"; modelId: ModelId; modelData: ArrayBuffer }
  | {
      type: "ENCODE_IMAGE";
      image: ImageBitmap;
      imageHash: string;
      modelId: ModelId;
      modelVersion: string;
    }
  | { type: "DISPOSE" };

export type EncoderResponse =
  | { type: "LOADED" }
  | { type: "ENCODED"; imageHash: string; embeddingKey: string }
  | { type: "ERROR"; message: string };

export type DecoderMessage =
  | { type: "LOAD_MODEL"; modelId: ModelId; modelData: ArrayBuffer }
  | { type: "DECODE"; embeddingKey: string; points: Point[] }
  | { type: "DISPOSE" }
  | { type: "CANCEL_DECODE" };

export type DecoderResponse =
  | { type: "LOADED" }
  | { type: "DECODED"; mask: Mask }
  | { type: "ERROR"; message: string };
