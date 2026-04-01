"use client";

import React, { useState, useRef, useEffect } from "react";

import { RotateCcw, RotateCw, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Group } from "react-konva";
import useImage from "use-image";

import { useMultiTouch } from "@/components/image-editor/use-multi-touch";
import { Transformation } from "@/lib/utils/coordinate-math";

interface CropTabProps {
  sourceUrl: string;
  transformation: Transformation;
  onUpdateTransformation: (transform: Transformation) => void;
}

export const CropTab: React.FC<CropTabProps> = ({
  sourceUrl,
  transformation,
  onUpdateTransformation,
}) => {
  const [img] = useImage(sourceUrl);
  const rectRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Local state for interactive editing
  const [rect, setRect] = useState({
    x: transformation.x || 0,
    y: transformation.y || 0,
    width: transformation.width || 0,
    height: transformation.height || 0,
  });

  const [rotation, setRotation] = useState(transformation.rotation || 0);

  // Auto-center and zoom on mount
  useEffect(() => {
    if (!img) return;

    const stageW = window.innerWidth;
    const stageH = window.innerHeight - 128;

    // Use full image for initial "fill" calculation in crop tab
    const scale = Math.min(stageW / img.width, stageH / img.height) * 0.85;

    setZoom(scale);
    setStagePos({
      x: stageW / 2 - (img.width / 2) * scale,
      y: stageH / 2 - (img.height / 2) * scale,
    });

    // Initialize rect if empty (no previous manual crop)
    if (rect.width === 0 || rect.height === 0) {
      setRect({
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });
    }
  }, [img]);

  // Ensure handles show ALWAYS (even on mount/load)
  useEffect(() => {
    // Small timeout to ensure Konva refs are definitively attached to the DOM
    const timer = setTimeout(() => {
      if (trRef.current && rectRef.current) {
        trRef.current.nodes([rectRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [img, rect, rotation]);

  const handleTransformEnd = () => {
    const node = rectRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const r = Math.round(node.rotation());

    // In this model, x/y is the PIVOT (the center of the rectangle)
    const centerX = node.x();
    const centerY = node.y();
    const w = node.width() * scaleX;
    const h = node.height() * scaleY;

    // We store the top-left of the axis-aligned version for simple storage compatibility
    const newRect = {
      x: Math.round(centerX - w / 2),
      y: Math.round(centerY - h / 2),
      width: Math.round(w),
      height: Math.round(h),
    };

    // Keep internal state clean
    node.scaleX(1);
    node.scaleY(1);
    node.offsetX(w / 2);
    node.offsetY(h / 2);
    node.x(centerX);
    node.y(centerY);

    setRect(newRect);
    setRotation(r);
    onUpdateTransformation({ ...newRect, rotation: r });
  };

  const handleDragEnd = () => {
    const node = rectRef.current;
    if (!node) return;

    const centerX = node.x();
    const centerY = node.y();

    const newRect = {
      ...rect,
      x: Math.round(centerX - rect.width / 2),
      y: Math.round(centerY - rect.height / 2),
    };

    setRect(newRect);
    onUpdateTransformation({ ...newRect, rotation });
  };

  const handle90Rotate = (delta: number) => {
    const newRotation = (rotation + delta + 360) % 360;
    setRotation(newRotation);
    onUpdateTransformation({ ...rect, rotation: newRotation });
  };

  const handleReset = () => {
    if (!img) return;
    const newTransform = { x: 0, y: 0, width: img.width, height: img.height, rotation: 0 };
    setRect({ x: 0, y: 0, width: img.width, height: img.height });
    setRotation(0);
    onUpdateTransformation(newTransform);
  };

  const resetZoom = () => {
    if (!img) return;
    const stageW = window.innerWidth;
    const stageH = window.innerHeight - 64;
    const scale = Math.min(stageW / img.width, stageH / img.height) * 0.85;
    setZoom(scale);
    setStagePos({
      x: stageW / 2 - (img.width / 2) * scale,
      y: stageH / 2 - (img.height / 2) * scale,
    });
  };

  const { onTouchStart, onTouchMove, onTouchEnd, isMultiTouching } = useMultiTouch(
    zoom,
    setZoom,
    stagePos,
    setStagePos,
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 1. Top Action Bar (Floating) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-2xl bg-slate-900/80 px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all hover:bg-slate-800 hover:text-white active:scale-95 sm:text-xs"
        >
          <Maximize size={16} />
          <span>Reset</span>
        </button>
      </div>

      {/* 2. Bottom Control Rail (Floating Center) */}
      <div className="absolute bottom-6 left-1/2 z-10 flex w-[85%] max-w-sm -translate-x-1/2 flex-col items-center gap-3 sm:w-auto">
        <div className="flex w-full items-center justify-between gap-4 rounded-2xl bg-slate-900/80 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:w-auto sm:justify-center">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => handle90Rotate(-90)}
              className="group flex items-center gap-2 rounded-xl bg-slate-950/40 px-3 py-2 text-[10px] font-black uppercase transition-all hover:bg-indigo-500/20 hover:text-indigo-400 active:scale-95"
            >
              <RotateCcw size={16} className="transition-transform group-hover:-rotate-45" />
              <span className="hidden sm:inline">-90°</span>
            </button>
            <button
              onClick={() => handle90Rotate(90)}
              className="group flex items-center gap-2 rounded-xl bg-slate-950/40 px-3 py-2 text-[10px] font-black uppercase transition-all hover:bg-indigo-500/20 hover:text-indigo-400 active:scale-95"
            >
              <RotateCw size={16} className="transition-transform group-hover:rotate-45" />
              <span className="hidden sm:inline">+90°</span>
            </button>
          </div>
          <div className="mx-1 h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-1">
            <button
              onClick={resetZoom}
              className="rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Fit to Screen"
            >
              <Maximize size={15} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              className="rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="min-w-[40px] text-center font-mono text-[10px] font-black text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(10, z + 0.1))}
              className="rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-indigo-400"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="relative flex-1 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {img && img.width > 0 && (
          <Stage
            width={window.innerWidth}
            height={window.innerHeight - 64}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={zoom}
            scaleY={zoom}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="cursor-move"
          >
            <Layer>
              {/* Image Boundary Indicator (Dashed Border) */}
              <Rect
                width={img.width}
                height={img.height}
                stroke="#475569"
                strokeWidth={1}
                dash={[5, 5]}
                opacity={0.5}
              />

              {/* Background Shadow */}
              <Rect width={img.width} height={img.height} fill="#000" opacity={0.05} />

              <Group>
                {/* 1. Underlying Source Image (Un-rotated unless 90/180 buttons used) */}
                <KonvaImage image={img} opacity={0.7} />

                {/* 2. Interactive Selection Frame (With Rotation Handle) */}
                <Rect
                  ref={rectRef}
                  x={rect.x + rect.width / 2}
                  y={rect.y + rect.height / 2}
                  width={rect.width}
                  height={rect.height}
                  offsetX={rect.width / 2}
                  offsetY={rect.height / 2}
                  rotation={rotation}
                  fill="white"
                  opacity={0.4}
                  stroke="#6366f1"
                  strokeWidth={2}
                  draggable={!isMultiTouching}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                />
              </Group>

              <Transformer
                ref={trRef}
                rotateEnabled={true}
                keepRatio={false}
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                  "top-center",
                  "bottom-center",
                  "middle-left",
                  "middle-right",
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 30 || newBox.height < 30) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
};
