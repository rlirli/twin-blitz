import React from "react";

import { X, Loader2 } from "lucide-react";

import { Mask } from "../core/utils/mask-utils";

interface AISegmentationDebugWindowProps {
  inputImage: ImageBitmap | null;
  outputMask: Mask | null;
  isProcessing: boolean;
  lastRelClick?: { x: number; y: number } | null;
  onClose: () => void;
}

export const AISegmentationDebugWindow: React.FC<AISegmentationDebugWindowProps> = ({
  inputImage,
  outputMask,
  isProcessing,
  lastRelClick,
  onClose,
}) => {
  const [inputUrl, setInputUrl] = React.useState<string | null>(null);
  const [maskUrl, setMaskUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!inputImage) {
      setInputUrl(null);
      return;
    }
    const canvas = new OffscreenCanvas(inputImage.width, inputImage.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(inputImage, 0, 0);

    // Overlay click if exists
    if (lastRelClick) {
      const x = lastRelClick.x * inputImage.width;
      const y = lastRelClick.y * inputImage.height;

      // 1. Crosshair lines (High contrast & Massive)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 10;
      const crossSize = 100; // Much larger

      ctx.beginPath();
      ctx.moveTo(x - crossSize, y);
      ctx.lineTo(x + crossSize, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - crossSize);
      ctx.lineTo(x, y + crossSize);
      ctx.stroke();

      // 2. The Dot (Massive)
      ctx.fillStyle = "#ef4444"; // rose-500
      ctx.strokeStyle = "white";
      ctx.lineWidth = 12;
      const radius = 40; // Double the previous size

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    canvas.convertToBlob().then((blob) => setInputUrl(URL.createObjectURL(blob)));
  }, [inputImage, lastRelClick]);

  React.useEffect(() => {
    if (!outputMask) {
      setMaskUrl(null);
      return;
    }
    const canvas = new OffscreenCanvas(outputMask.width, outputMask.height);
    const ctx = canvas.getContext("2d");
    const imageData = new ImageData(
      new Uint8ClampedArray(outputMask.width * outputMask.height * 4).map((_, i) =>
        i % 4 === 3 ? outputMask.alpha[Math.floor(i / 4)] : 255,
      ),
      outputMask.width,
      outputMask.height,
    );
    ctx?.putImageData(imageData, 0, 0);
    canvas.convertToBlob().then((blob) => setMaskUrl(URL.createObjectURL(blob)));
  }, [outputMask]);

  return (
    <div className="fixed right-6 bottom-24 z-50 flex w-72 flex-col gap-2 rounded-2xl bg-slate-950/90 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:right-6 sm:bottom-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
            AI Segmentation Debug
          </span>
          {isProcessing && <Loader2 size={10} className="animate-spin text-indigo-400" />}
        </div>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-white/5">
          <X size={12} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-600">INPUT</span>
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/5">
            {inputUrl && (
              <img src={inputUrl} className="h-full w-full object-contain" alt="Input for AI" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-600">MASK</span>
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/5">
            {maskUrl && (
              <img src={maskUrl} className="h-full w-full object-contain" alt="AI Output Mask" />
            )}
          </div>
        </div>
      </div>
      {!outputMask && !isProcessing && (
        <div className="mt-1 text-center text-[9px] text-slate-500">
          Click on the canvas to segment
        </div>
      )}
    </div>
  );
};
