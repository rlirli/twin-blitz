# MaskTap AI Segmentation – Implementation Plan (v1)

1. Overview

Goal: Integrate AI-assisted segmentation into MaskTap using ONNX SAM / EfficientViT models.
	•	AI tool (sparkle icon) behaves like existing manual tools (Brush, Lasso, Rectangle, Ellipse) and fully integrates with Add/Subtract/Replace modes.
	•	Two dedicated workers: Encoder Worker and Decoder Worker.
	•	Models loaded from the Browser Cache API, not bundled in repo.
	•	Users can select from multiple models, including EfficientVit-SAM variants (L0, L1, L2, XL0, XL1).
    •   Unified interface for all models.

⸻

2. Model Definition

2.1 Constant Model Dict

export const AVAILABLE_MODELS = {
  "EFFICIENTVIT_L0": {
    name: "EfficientViT-SAM-L0",
    encoderUrl: "https://huggingface.co/mit-han-lab/efficientvit-sam/raw/main/L0/encoder.onnx",
    decoderUrl: "https://huggingface.co/mit-han-lab/efficientvit-sam/raw/main/L0/decoder.onnx",
    sizeMB: 120
  },
  "EFFICIENTVIT_L1": { ... },
  "EFFICIENTVIT_L2": { ... },
  "EFFICIENTVIT_XL0": { ... },
  "EFFICIENTVIT_XL1": { ... }
} as const;

	•	Each entry includes human-readable name, encoder & decoder ONNX URLs, and approximate file size.
	•	Used to populate Model Selector Dropdown.
	•	All downloads require confirmation dialog, restating size, with optional “Don’t show again”.

⸻

3. Segmentation Model Interface

```tsx
export interface SegmentationModel {
  /** Load encoder + decoder from ArrayBuffers or Cache API */
  load(): Promise<void>;

  /** Encode a new image into embeddings (ImageBitmap → Uint8Array) */
  encode(image: ImageBitmap, imageHash: string): Promise<void>;

  /** Decode embeddings for given points */
  decode(
    embeddingKey: string,
    points: Point[], // NOTE: For now we'll only support single Point with positive click
  ): Promise<Mask>;

  /** Dispose encoder + decoder sessions and GPU memory */
  dispose(): void;

  /** Model identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** ONNX session sizes (optional, for telemetry / UI) */
  sizeMB: number;
}

export type Point = {
  /** X coordinate relative to image, in pixels */
  x: number;

  /** Y coordinate relative to image, in pixels */
  y: number;

  // NOTE: For now we'll only support single Point with positive click
  /** true = positive click, false = negative click */
  positive: boolean;
};
```
	•	dispose() frees ONNX runtime + GPU buffers.
	•	The interface allows multiple implementations (EfficientVit, SAM, future models).

⸻

4. Workers

4.1 Encoder Worker
	•	Handles encoding images into embeddings.
	•	Only 1 encode per model runs at a time.
	•	Proactive Encoding: If a model is active, immediately kick off encoding when the image or crop region changes (don't wait for AI tool selection!).
	•	Drops current encoding if a new image is selected.

Message protocol:

type EncoderMessage =
  | { type: "LOAD_MODEL"; modelId: string; file: ArrayBuffer }
  | { type: "ENCODE_IMAGE"; image: ImageBitmap; imageHash: string }
  | { type: "DISPOSE" };

	•	Writes embeddings to IndexedDB keyed: ${modelId}:${modelVersion}:${imageHash}

4.2 Decoder Worker
	•	Handles decoding embeddings into masks based on user points/clicks.
	•	Always cancel previous decode, process latest click only.
	•	Reads embeddings from IndexedDB.

Message protocol:

type DecoderMessage =
  | { type: "LOAD_MODEL"; modelId: string; file: ArrayBuffer }
  | { type: "DECODE"; embeddingKey: string; points: Point[] }
  | { type: "DISPOSE" }
  | { type: "CANCEL_DECODE" };

	•	Returns Mask object to main thread.

4.3 Coordination
	•	Encoder → IndexedDB → Decoder
	•	No direct communication needed between workers.
	•	Each worker holds its own ONNX session for encoder or decoder.

⸻

5. Mask Definition & Processing

type Mask = {
  width: number;
  height: number;
  alpha: Uint8Array; // 0–255
};

	•	Decoder always outputs alpha mask.
	•	(if needed) Binary masks created centrally with threshold (alpha >= 128).
	•	Masks converted to ImageData → OffscreenCanvas → Konva.Image.
	•	Add/Subtract/Replace integrated with existing manual masking system.

⸻

6. Storage & Memory Management
	•	Cache API: stores ONNX files.
	•	IndexedDB: stores embeddings keyed per image and model.
	•	Memory:
	•	Only current model encoder + decoder in memory.
	•	Only embeddings for currently viewed image loaded in memory.
	•	On model switch or memory pressure, call dispose() to free GPU memory.

⸻

7. UI Integration

7.1 Model Selector Dropdown
	•	Trigger: Shows currently active model. If none, shows "Download model to start" in a distinct, "very obvious" color.
	•	Last Used: Always reload the last used model if available in the Cache API.
	•	List: Models available locally show in foreground color; others show in muted-foreground color.
	•	Downloads: Shows "Use", "Downloading (X MB / Y MB)", or "Download". No progress bar, just size counts.
	•	Confirmation dialog on every download.

7.2 Floating Debug Window
	•	Left: input image passed to decoder
	•	Right: output mask
	•	Spinner during any in-flight processing.

7.3 MaskTap Call Sites

Hook / Service API Example:

const { loadModel, encodeImage, decodePoints } = useAISegmentationService();

await loadModel(modelId);
await encodeImage(imageBitmap, imageHash);
const mask = await decodePoints(imageHash, points, "add");

	•	These functions wrap worker messages internally.
	•	Encapsulates worker, Cache API, IndexedDB, and Mask conversion.

⸻

8. Precision / Runtime
	•	FP16 preferred with WebGPU.
	•	Fallback to FP32 on CPU/WASM.
	•	INT8 deferred to future optimization.

⸻

9. Error Handling / Fallback
	•	Model load/download fails → toast + retry.
	•	WebGPU unavailable → WASM fallback.
	•	Decode errors → return empty mask; manual tools remain usable.

⸻

10. (removed)

⸻

11. Telemetry
	•	Encode/decode durations
	•	Failures / retries
	•	Model download times

⸻

12. File / Folder Structure

```
/ai-segmentation/                 <-- top-level AI segmentation library
  /components
    /model-selector.tsx           # Dropdown for selecting models
    /debug-window.tsx             # Floating debug window for input image and output mask
  /core/
    /workers/
      encoder-worker.ts           # Dedicated WebWorker for image encoding (downscale → embeddings, store in IndexedDB)
      decoder-worker.ts           # Dedicated WebWorker for decoding embeddings to raw masks
      protocol.ts                 # Message types, communication schema between main thread & workers
    /utils/
      image-utils.ts              # Image-level helpers: scaleImage(image: ImageBitmap, targetWidth: number, targetHeight: number): ImageBitmap, imageToTensor(image: ImageBitmap): Tensor
      mask-utils.ts               # Mask-level helpers: scaleMask(mask: Mask, targetWidth: number, targetHeight: number): Mask, alphaToBinary(mask: Mask): Mask, maskToImageData(mask: Mask): ImageData
      embedding-utils.ts          # Embedding key helpers: hashImage(image: ImageBitmap): string, getEmbeddingKey(modelId: string, modelVersion: string, imageHash: string): string
  /models/
    model-constants.ts            # AVAILABLE_MODELS dict: {modelId → {encoderURL, decoderURL, sizeMB, name, etc.}}
  ai-segmentation.service.ts      # Central service: loadModel, encodeImage, decodePoints, dispose; handles Cache API, IndexedDB, and workers
  /hooks/
    use-ai-segmentation.ts        # Optional thin React hook wrapper over service, exposes loading/error state to components
  index.ts                        # Barrel export
```

	•	ONNX files never stored in repo; only loaded from Cache API at runtime.

⸻

13. Click / Point Handling
	•	Internal API supports multi-point (positive/negative).
	•	UI v1: single positive point only.
	•	Latest click wins; in-progress decode immediately aborted.
    •   If embeddingKey is already present in IndexedDB, skip encoding and proceed directly to decoding.

⸻

14. Future Considerations (not yet)
	•	Lite demo small model bundled in app.
	•	Multi-point negative support in UI v2.
	•	Optional shared worker if memory optimization needed.
	•	INT8 quantization for mobile optimizations.
