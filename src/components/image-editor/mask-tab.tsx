"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";

import {
  Square,
  Circle,
  MousePointer2,
  Undo2,
  Minus,
  Plus,
  Brush,
  Combine,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
} from "lucide-react";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Line, Ellipse } from "react-konva";
import useImage from "use-image";

import { useMultiTouch } from "@/components/image-editor/use-multi-touch";
import {
  useAISegmentation,
  ModelSelector,
  AISegmentationDebugWindow,
  hashImage,
  maskToPNG,
  uncropMask,
  Mask,
} from "@/lib/ai-segmentation";
import { logDebugImage } from "@/lib/ai-segmentation/core/utils/debug-utils";
import { cn } from "@/lib/utils/cn";
import { Transformation, MaskPath, transformMaskData } from "@/lib/utils/image-processing";

interface MaskTabProps {
  sourceUrl: string;
  transformation: Transformation;
  maskData: MaskPath[];
  onUpdateMask: (mask: MaskPath[]) => void;
}

export const MaskTab: React.FC<MaskTabProps> = ({
  sourceUrl,
  transformation,
  maskData,
  onUpdateMask,
}) => {
  const [img] = useImage(sourceUrl);
  const stageRef = useRef<any>(null);
  const hasInitializedRef = useRef(false);
  const [tool, setTool] = useState<MaskPath["tool"]>("ai");
  const [mode, setMode] = useState<MaskPath["mode"]>("add");
  const [brushSize, setBrushSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<number[] | null>(null);

  // AI Segmentation State
  const {
    currentModel,
    loadingModelId,
    isModelLoading,
    encodeImage,
    decodePoints,
    loadModel,
    downloadProgress,
    error,
  } = useAISegmentation();
  const [isAISegmenting, setIsAISegmenting] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [lastAIInput, setLastAIInput] = useState<ImageBitmap | null>(null);
  const [lastAIOutput, setLastAIOutput] = useState<Mask | null>(null);
  const [aiEmbeddingKey, setAiEmbeddingKey] = useState<string | null>(null);
  const [isAIEncoding, setIsAIEncoding] = useState(false);
  const [lastRelClick, setLastRelClick] = useState<{ x: number; y: number } | null>(null);

  // Local state for workspace-relative masks (B-space)
  // This allows us to work UPRIGHT and AXIS-ALIGNED easily.
  const [localMaskData, setLocalMaskData] = useState<MaskPath[]>([]);

  // Initialize workspace masks from source masks
  useEffect(() => {
    if (!img) return;
    const transformed = transformMaskData(maskData, transformation, "A2B");

    // Default: if no mask exists, add a full-cover rectangle to reveal the whole image
    if (!hasInitializedRef.current) {
      if (transformed.length === 0) {
        const w = transformation.width || img.width;
        const h = transformation.height || img.height;
        transformed.push({
          tool: "rectangle",
          mode: "add",
          points: [0, 0, w, h],
          brushSize: 0,
        });
        // If we just added the default "Full Reveal", subsequent tools should default to "New" mode
        setMode("replace");
      } else {
        // If we have an existing manual mask, default to "Add"
        setMode("add");
      }
      hasInitializedRef.current = true;
    }

    setLocalMaskData(transformed);
  }, [img, maskData]);

  // Auto-fit crop area to screen on open
  useEffect(() => {
    if (!img) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 128;
    const cropW = transformation.width || img.width;
    const cropH = transformation.height || img.height;
    const padding = 0.85;
    const scale = Math.min(screenW / cropW, screenH / cropH) * padding;
    setZoom(scale);
    setStagePos({ x: screenW / 2, y: screenH / 2 });
  }, [img, transformation.width, transformation.height]);

  // Proactive AI Encoding
  useEffect(() => {
    if (!img || !currentModel) return;

    // Reset embedding state immediately on model switch
    setAiEmbeddingKey(null);
    setLastAIOutput(null);

    let isCancelled = false;
    const triggerEncoding = async () => {
      // 1. Create a bitmap of the current CROP for the AI
      const cropW = transformation.width || img.width;
      const cropH = transformation.height || img.height;
      const canvas = new OffscreenCanvas(cropW, cropH);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Replicate the B-space upright crop
      ctx.translate(cropW / 2, cropH / 2);
      ctx.rotate((-transformation.rotation * Math.PI) / 180);
      ctx.translate(-(transformation.x + cropW / 2), -(transformation.y + cropH / 2));
      ctx.drawImage(img, 0, 0);

      const bitmap = canvas.transferToImageBitmap();
      logDebugImage(bitmap, "from MaskTap");
      if (isCancelled) return;

      const hash = await hashImage(bitmap);
      if (isCancelled) return;

      setLastAIInput(bitmap);
      setIsAIEncoding(true);
      try {
        const key = await encodeImage(bitmap, hash);
        if (isCancelled) return;
        setAiEmbeddingKey(key);
      } finally {
        if (!isCancelled) setIsAIEncoding(false);
      }
    };

    triggerEncoding();
    return () => {
      isCancelled = true;
    };
  }, [img, currentModel, encodeImage, transformation]);

  const MASK_OVERLAY_COLOR = "rgba(0, 0, 0, 0.8)";
  const cropW = transformation.width || (img?.width ?? 0);
  const cropH = transformation.height || (img?.height ?? 0);

  const groupRef = useRef<any>(null);
  const cutterRef = useRef<any>(null);

  /**
   * STENCIL ARCHITECTURE:
   * We cache the cutter group to create an isolated "Reveal Pattern" (Add - Subtract).
   * This is critical: if we applied subtractions directly to the shroud, they would
   * simply erase the Gray overlay. By caching them, subtractive modes instead erase
   * from the additive silhouette WITHIN the private buffer, which is then applied
   * as a single holistic eraser to the shroud.
   */
  // Cache management for the cutter group
  const recalculateCache = useCallback(() => {
    if (cutterRef.current) {
      cutterRef.current.clearCache();
      if (img && localMaskData.length > 0) {
        cutterRef.current.cache({
          x: -20,
          y: -20,
          width: cropW + 40,
          height: cropH + 40,
        });
      }
      cutterRef.current.getLayer()?.batchDraw();
    }
  }, [img, localMaskData.length, cropW, cropH]);

  useEffect(() => {
    recalculateCache();
  }, [localMaskData, img, recalculateCache]);

  // Interaction handlers (Now in B-space!)
  const handleMouseDown = (e: any) => {
    // If multi-touch, do not start drawing
    if (e.evt?.touches?.length > 1) return;

    if (!groupRef.current) return;

    // AI TOOL HANDLING
    if (tool === "ai") {
      if (!currentModel) {
        alert("Please select and download an AI model first!");
        return;
      }
      if (!aiEmbeddingKey) {
        setIsAISegmenting(true);
        // If not ready, we wait a bit or show a spinner.
        // Realistically, encoding should be fast if cached.
      }
      handleAIClick();
      return;
    }

    setIsDrawing(true);
    const pos = groupRef.current.getRelativePointerPosition();
    setCurrentPath([pos.x, pos.y]);
  };

  const handleAIClick = async () => {
    if (!groupRef.current || !aiEmbeddingKey) return;

    // Use B-space position directly (no transformPointB2A needed as input is now the crop)
    const pos = groupRef.current.getRelativePointerPosition();
    console.log("[handleAIClick] pos", pos);

    // Boundary check
    if (pos.x < 0 || pos.x > cropW || pos.y < 0 || pos.y > cropH) {
      console.warn("Click outside image bounds", pos);
      return;
    }

    setIsAISegmenting(true);
    setLastRelClick({ x: pos.x / cropW, y: pos.y / cropH });
    try {
      const mask = await decodePoints(aiEmbeddingKey, [{ x: pos.x, y: pos.y, positive: true }]);
      setLastAIOutput(mask);

      if (!img) throw new Error("Image not loaded");

      // 1. PROJECT B-space (crop) mask back to A-space (original image)
      // This is crucial: the AI ran on the CROP, but we store in the ORIGINAL IMAGE resolution.
      const aSpaceMask = await uncropMask(mask, transformation, img.width, img.height);

      // 2. Convert mask to PNG for storage
      const dataUrl = await maskToPNG(aSpaceMask);

      // 3. Create new MaskPath (stored with A-space data)
      const newPath: MaskPath = {
        tool: "ai",
        mode,
        points: [pos.x, pos.y], // B-space points, transformed to A-space below
        maskDataUrl: dataUrl,
      };

      const newLocalMask = mode === "replace" ? [newPath] : [...localMaskData, newPath];
      setLocalMaskData(newLocalMask);

      // Sync back to parent (this will convert all points to A-space for storage)
      const backTransformed = transformMaskData(newLocalMask, transformation, "B2A");
      onUpdateMask(backTransformed);
    } catch (err) {
      console.error("AI Segmentation failed:", err);
    } finally {
      setIsAISegmenting(false);
    }
  };

  const handleMouseMove = (e: any) => {
    // Prevent moving if not drawing, or if multi-touch happens mid-draw
    if (!isDrawing || !currentPath || !groupRef.current) return;
    if (e.evt?.touches?.length > 1) {
      // If a second finger touches down while dragging, we can cancel the single drag
      setIsDrawing(false);
      setCurrentPath(null);
      return;
    }
    const pos = groupRef.current.getRelativePointerPosition();
    if (tool === "brush" || tool === "lasso") {
      setCurrentPath([...currentPath, pos.x, pos.y]);
    } else {
      setCurrentPath([currentPath[0], currentPath[1], pos.x, pos.y]);
    }
  };

  const handleMouseUp = (_e?: any) => {
    if (!isDrawing || !currentPath || !groupRef.current) return;
    setIsDrawing(false);

    let finalPoints: number[] = [];
    if (tool === "brush" || tool === "lasso") {
      finalPoints = currentPath;
    } else {
      const [sx, sy, ex, ey] = currentPath;
      const x = Math.min(sx, ex);
      const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx);
      const h = Math.abs(ey - sy);
      finalPoints = [x, y, w, h];
    }

    const newPath: MaskPath = {
      tool,
      mode,
      points: finalPoints,
      brushSize: tool === "brush" ? brushSize : undefined,
    };

    // 1. Update local workspace state
    const newLocalMask = mode === "replace" ? [newPath] : [...localMaskData, newPath];
    setLocalMaskData(newLocalMask);

    // 2. Transfrom back to A-space for storage
    const backTransformed = transformMaskData(newLocalMask, transformation, "B2A");
    onUpdateMask(backTransformed);
    setCurrentPath(null);
  };

  const handleReset = () => {
    if (window.confirm("Reset entire mask? This can't be undone.")) {
      hasInitializedRef.current = false;
      onUpdateMask([]);
    }
  };

  const handleUndo = () => {
    onUpdateMask(maskData.slice(0, -1));
  };

  const resetZoom = () => {
    if (!img) return;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - 64;
    const cropW = transformation.width || img.width;
    const cropH = transformation.height || img.height;
    const padding = 0.85;
    const scale = Math.min(screenW / cropW, screenH / cropH) * padding;
    setZoom(scale);
    setStagePos({ x: screenW / 2, y: screenH / 2 });
  };

  const cancelInteraction = () => {
    setIsDrawing(false);
    setCurrentPath(null);
  };

  const { onTouchStart, onTouchMove, onTouchEnd } = useMultiTouch(
    zoom,
    setZoom,
    stagePos,
    setStagePos,
    cancelInteraction,
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 1. Top Context Bar (Floating) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {tool === "ai" && (
          <ModelSelector
            currentModel={currentModel}
            loadingModelId={loadingModelId}
            onSelect={loadModel}
            isLoading={isModelLoading}
            downloadProgress={downloadProgress}
            error={error}
            className="h-[50px] rounded-2xl"
          />
        )}
        <div className="flex h-12 items-center justify-center rounded-2xl bg-slate-900/80 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <ActionButton onClick={handleUndo} icon={<Undo2 size={18} />} />
          <div className="mx-1 h-4 w-px bg-slate-700" />
          <ActionButton
            onClick={handleReset}
            icon={<Trash2 size={18} />}
            color="rose"
            title="Reset All"
          />
        </div>
      </div>

      {/* 2. Side Tool Rail (Floating Left) */}
      <div className="absolute top-1/2 left-4 z-10 -translate-y-1/2 sm:left-6">
        <div className="flex flex-col gap-2 rounded-2xl bg-slate-900/80 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <ToolButton
            active={tool === "brush"}
            onClick={() => setTool("brush")}
            icon={<Brush size={20} />}
            label="Brush"
          />
          <ToolButton
            active={tool === "lasso"}
            onClick={() => setTool("lasso")}
            icon={<MousePointer2 size={20} />}
            label="Lasso"
          />
          <ToolButton
            active={tool === "rectangle"}
            onClick={() => setTool("rectangle")}
            icon={<Square size={20} />}
            label="Rect"
          />
          <ToolButton
            active={tool === "ellipse"}
            onClick={() => setTool("ellipse")}
            icon={<Circle size={20} />}
            label="Circle"
          />
          <div className="my-1 h-px bg-slate-800" />
          <ToolButton
            active={tool === "ai"}
            onClick={() => {
              setTool("ai");
              setShowDebug(true);
            }}
            icon={<Sparkles size={20} className={cn(isAISegmenting && "animate-pulse")} />}
            label="AI Magic"
          />
        </div>
      </div>

      {/* 3. Bottom Control Center (Floating Center) */}
      <div className="absolute bottom-6 left-1/2 z-10 flex w-[90%] max-w-lg -translate-x-1/2 flex-col items-center gap-3 sm:w-auto">
        {/* Mode Switcher */}
        <div className="flex w-full items-center justify-center rounded-2xl bg-slate-900/80 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:w-auto">
          <ModeButton
            active={mode === "add"}
            onClick={() => setMode("add")}
            icon={<Plus size={16} />}
            label="Add"
            color="emerald"
          />
          <ModeButton
            active={mode === "subtract"}
            onClick={() => setMode("subtract")}
            icon={<Minus size={16} />}
            label="Sub"
            color="rose"
          />
          <ModeButton
            active={mode === "replace"}
            onClick={() => setMode("replace")}
            icon={<Combine size={16} />}
            label="New"
            color="indigo"
          />
        </div>

        {/* Brush & Zoom Footer */}
        <div className="flex w-full items-center gap-4 rounded-2xl bg-slate-950/90 px-4 py-2.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:w-auto">
          {tool === "brush" && (
            <div className="flex flex-1 items-center gap-3 sm:min-w-[180px] sm:flex-initial">
              <span className="shrink-0 text-[10px] font-black tracking-tighter text-slate-500 uppercase">
                Size
              </span>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-indigo-500 transition-all hover:bg-slate-700"
              />
              <span className="w-5 text-right font-mono text-[10px] font-bold text-indigo-400">
                {brushSize}
              </span>
              <div className="ml-2 hidden h-4 w-px bg-slate-800 sm:block" />
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={resetZoom}
              className="rounded-lg p-1.5 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Fit to Screen"
            >
              <Maximize size={15} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              className="rounded-lg p-1.5 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="min-w-[40px] text-center font-mono text-[10px] font-black text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(10, z + 0.1))}
              className="rounded-lg p-1.5 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {img && (
          <Stage
            ref={stageRef}
            width={window.innerWidth}
            height={window.innerHeight - 64} // Only subtract header height
            x={stagePos.x}
            y={stagePos.y}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={(e) => {
              onTouchStart(e);
              handleMouseDown(e);
            }}
            onTouchMove={(e) => {
              onTouchMove(e);
              handleMouseMove(e);
            }}
            onTouchEnd={(e) => {
              onTouchEnd(e);
              handleMouseUp(e);
            }}
            className="cursor-crosshair"
          >
            <Layer>
              <Group clip={{ x: -cropW / 2, y: -cropH / 2, width: cropW, height: cropH }}>
                <Group
                  rotation={-transformation.rotation}
                  offsetX={(transformation.x || 0) + cropW / 2}
                  offsetY={(transformation.y || 0) + cropH / 2}
                >
                  <KonvaImage image={img} />
                </Group>
              </Group>
            </Layer>

            <Layer>
              <Group
                // 2. Interaction Layer (Reveal Area)
                ref={groupRef}
                x={-cropW / 2}
                y={-cropH / 2}
                clip={{ x: 0, y: 0, width: cropW, height: cropH }}
              >
                {/* Gray Overlay Shroud */}
                <Rect x={0} y={0} width={cropW} height={cropH} fill={MASK_OVERLAY_COLOR} />

                {/*
                   1. Permanent Cutter Stencil (Cached)
                   Isolated Add-Minus-Subtract silohette applied as a single eraser to the shroud.
                */}
                <Group ref={cutterRef} globalCompositeOperation="destination-out">
                  {localMaskData.map((path, i) => (
                    <MaskShape
                      key={i}
                      path={path}
                      isPreview={false}
                      transformation={transformation}
                      onLoad={recalculateCache}
                    />
                  ))}
                </Group>

                {/*
                   2. Live Drawing Preview (Flicker-Free masking)
                   If adding: Erase from shroud (destination-out)
                   If subtracting: Patch the shroud back (source-over with shroud color)
                */}
                {isDrawing && currentPath && (
                  <MaskShape
                    path={{ tool, mode, points: currentPath, brushSize }}
                    isPreview={true}
                    compositeOverride={mode === "subtract" ? "source-over" : "destination-out"}
                    fillOverride={mode === "subtract" ? MASK_OVERLAY_COLOR : "white"}
                    strokeOverride={mode === "subtract" ? MASK_OVERLAY_COLOR : "white"}
                    transformation={transformation}
                  />
                )}

                {/*
                   3. Surgical Stroke Preview (Top Layer)
                   Drawn strictly on top to ensure user sees the outline even 
                   if they are drawing over already revealed areas.
                */}
                {isDrawing &&
                  currentPath &&
                  (tool === "lasso" || tool === "rectangle" || tool === "ellipse") && (
                    <MaskShape
                      path={{ tool, mode, points: currentPath, brushSize }}
                      isPreview={true}
                      compositeOverride="source-over"
                      fillOverride="transparent"
                      strokeOverride="#818cf8"
                      isGeometricOutlineOnly={true}
                    />
                  )}
              </Group>
            </Layer>
          </Stage>
        )}
      </div>

      {showDebug && tool === "ai" && (
        <AISegmentationDebugWindow
          inputImage={lastAIInput}
          outputMask={lastAIOutput}
          isEncoding={isAIEncoding}
          isDecoding={isAISegmenting}
          hasEmbeddings={!!aiEmbeddingKey}
          currentModelId={currentModel?.id || "None"}
          lastRelClick={lastRelClick}
          onClose={() => setShowDebug(false)}
        />
      )}
    </div>
  );
};

function MaskShape({
  path,
  isPreview,
  fillOverride,
  strokeOverride,
  compositeOverride,
  transformation,
  onLoad,
  isGeometricOutlineOnly = false,
}: any) {
  const isGeometricPreview = isPreview && (path.tool !== "brush" || isGeometricOutlineOnly);
  const baseStrokeColor = isGeometricPreview
    ? "#818cf8"
    : path.tool === "brush"
      ? "white"
      : undefined;

  const commonProps = {
    fill: fillOverride || "white",
    stroke: strokeOverride || baseStrokeColor,
    strokeWidth: path.tool === "brush" ? path.brushSize : isGeometricPreview ? 5 : undefined,
    dash: isGeometricPreview ? [15, 7] : undefined,
    opacity: isPreview ? 0.6 : 1,
    globalCompositeOperation:
      compositeOverride || (path.mode === "subtract" ? "destination-out" : "source-over"),
  };

  if (path.tool === "brush" || path.tool === "lasso") {
    return (
      <Line
        points={path.points}
        closed={path.tool === "lasso"}
        {...commonProps}
        fill={path.tool === "brush" ? undefined : commonProps.fill}
        lineCap="round"
        lineJoin="round"
      />
    );
  }

  let x = 0,
    y = 0,
    w = 0,
    h = 0;
  if (path.tool === "rectangle" || path.tool === "ellipse") {
    if (isPreview && path.points && path.points.length >= 4) {
      const [sx, sy, ex, ey] = path.points;
      x = Math.min(sx, ex);
      y = Math.min(sy, ey);
      w = Math.abs(ex - sx);
      h = Math.abs(ey - sy);
    } else if (path.points && path.points.length >= 4) {
      [x, y, w, h] = path.points;
    }
  }

  if (path.tool === "rectangle") return <Rect x={x} y={y} width={w} height={h} {...commonProps} />;

  if (path.tool === "ellipse") {
    const rx = Math.max(0, w / 2);
    const ry = Math.max(0, h / 2);
    return <Ellipse x={x + rx} y={y + ry} radiusX={rx} radiusY={ry} {...commonProps} />;
  }

  if (path.tool === "ai" && path.maskDataUrl) {
    return (
      <AIMaskShape
        path={path}
        commonProps={commonProps}
        transformation={transformation}
        onLoad={onLoad}
      />
    );
  }

  return null;
}

function AIMaskShape({ path, commonProps, transformation, onLoad }: any) {
  const [maskImg] = useImage(path.maskDataUrl);

  useEffect(() => {
    if (maskImg) {
      onLoad?.();
    }
  }, [maskImg, onLoad]);

  if (!maskImg) return null;

  // Since AI masks are now A-space (Original size),
  // we MUST apply the same pivot transformation as the original image to align it with our crop.
  return (
    <KonvaImage
      image={maskImg}
      x={transformation.width / 2}
      y={transformation.height / 2}
      offsetX={(transformation.x || 0) + (transformation.width || 0) / 2}
      offsetY={(transformation.y || 0) + (transformation.height || 0) / 2}
      rotation={-transformation.rotation}
      {...commonProps}
      fill={undefined}
      stroke={undefined}
    />
  );
}

function ActionButton({ onClick, icon, color = "indigo", title }: any) {
  const colors: any = {
    indigo: "hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400",
    rose: "hover:bg-rose-500/20 text-slate-300 hover:text-rose-400",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn("rounded-xl p-2.5 transition-all active:scale-90", colors[color])}
    >
      {icon}
    </button>
  );
}

function ToolButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center justify-center rounded-xl p-3 transition-all",
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40"
          : "text-slate-400 hover:bg-slate-800 hover:text-white",
      )}
    >
      {icon}
      <span className="group-hover:blur-0 pointer-events-none absolute left-full ml-3 scale-90 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-white opacity-0 blur-sm transition-all group-hover:scale-100 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function ModeButton({ active, onClick, icon, label, color }: any) {
  const colors: any = {
    emerald: active
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
      : "text-emerald-500 hover:bg-emerald-500/10",
    rose: active
      ? "bg-rose-600 text-white shadow-lg shadow-rose-500/20"
      : "text-rose-500 hover:bg-rose-500/10",
    indigo: active
      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
      : "text-indigo-500 hover:bg-indigo-500/10",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase transition-all active:scale-95 sm:flex-none",
        colors[color],
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
