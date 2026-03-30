"use client";

import React, { useState, useRef, useEffect } from "react";

import { RotateCcw, RotateCw, Maximize } from "lucide-react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Group } from "react-konva";
import useImage from "use-image";

import { Transformation } from "@/lib/utils/image-processing";

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

  return (
    <div className="flex h-full flex-col">
      {/* Tool Header */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/50 p-2 backdrop-blur-md">
        <div className="flex items-center gap-4 px-2 text-slate-400">
          <span className="text-[10px] font-bold tracking-widest uppercase">Image Orientation</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handle90Rotate(-90)}
              className="group flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-bold transition-all hover:bg-slate-700 hover:text-indigo-400 active:scale-95"
            >
              <RotateCcw size={14} className="group-hover:-rotate-45" />
              <span>-90°</span>
            </button>
            <button
              onClick={() => handle90Rotate(90)}
              className="group flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-bold transition-all hover:bg-slate-700 hover:text-indigo-400 active:scale-95"
            >
              <RotateCw size={14} className="group-hover:rotate-45" />
              <span>+90°</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white active:scale-95"
        >
          <Maximize size={16} />
          <span>Reset Transformation</span>
        </button>
      </div>

      {/* Workspace */}
      <div className="relative flex-1 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {img && img.width > 0 && (
          <Stage
            width={window.innerWidth}
            height={window.innerHeight - 128}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={zoom}
            scaleY={zoom}
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
                  draggable
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

      {/* Zoom Control */}
      <div className="absolute right-4 bottom-4 flex items-center rounded-lg border border-slate-700 bg-slate-900/80 p-1 shadow-xl backdrop-blur-md">
        <button
          onClick={() => setZoom((z) => z - 0.1)}
          className="p-2 transition-colors hover:text-indigo-400"
        >
          <Maximize size={16} className="rotate-45" />
        </button>
        <span className="w-10 text-center font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => z + 0.1)}
          className="p-2 transition-colors hover:text-indigo-400"
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};
