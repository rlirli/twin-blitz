/**
 * Common types and interfaces for AI segmentation models.
 */

import { Mask } from "../core/utils/mask-utils";
import { ModelId } from "./model-constants";

export interface Point {
  /** X coordinate relative to image, in pixels */
  x: number;
  /** Y coordinate relative to image, in pixels */
  y: number;
  /** true = positive click, false = negative click */
  positive: boolean;
}

export interface ModelMetadata {
  id: ModelId;
  name: string;
  version: string;
  encoderUrl: string;
  decoderUrl: string;
  sizeMB: number;
  targetResolution: number; // e.g., 1024
}

export interface SegmentationModel {
  /** Load encoder + decoder from ArrayBuffers or Cache API */
  load(encoderData: ArrayBuffer, decoderData: ArrayBuffer): Promise<void>;

  /** Encode a new image into embeddings (ImageBitmap → Uint8Array) */
  encode(image: ImageBitmap, imageHash: string): Promise<string>;

  /** Decode embeddings for given points */
  decode(embeddingKey: string, points: Point[]): Promise<Mask>;

  /** Dispose encoder + decoder sessions and GPU memory */
  dispose(): void;

  readonly metadata: ModelMetadata;
}
