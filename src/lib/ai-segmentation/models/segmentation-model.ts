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
  encoderUrl?: string;
  decoderUrl?: string;
  zipUrl?: string;
  encoderPath?: string;
  decoderPath?: string;
  sizeMB: number;
  targetWidth: number; // e.g. 1024 (Width or long side)
  targetHeight: number; // e.g. 1024 or 682
}

export interface SegmentationModel {
  /** Load encoder binary into ORT session */
  loadEncoder(data: ArrayBuffer): Promise<void>;

  /** Load decoder binary into ORT session */
  loadDecoder(data: ArrayBuffer): Promise<void>;

  /** Encode a new image into embeddings (ImageBitmap → Uint8Array) */
  encode(image: ImageBitmap, imageHash: string): Promise<string>;

  /** Decode embeddings for given points */
  decode(embeddingKey: string, points: Point[]): Promise<Mask>;

  /** Dispose sessions and free GPU/VRAM memory */
  dispose(): void;

  readonly metadata: ModelMetadata;
}
