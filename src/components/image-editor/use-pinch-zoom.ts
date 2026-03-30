import { useRef, useCallback, useState } from "react";

export function usePinchZoom(
  zoom: number,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  stagePos: { x: number; y: number },
  setStagePos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  cancelInteraction?: () => void,
) {
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);
  const [isPinching, setIsPinching] = useState(false);

  const onTouchStart = useCallback(
    (e: any) => {
      if (e.evt.touches?.length === 2) {
        if (cancelInteraction) {
          cancelInteraction();
        }

        setIsPinching(true);

        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];
        lastCenterRef.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
        lastDistRef.current = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
      }
    },
    [cancelInteraction],
  );

  const onTouchMove = useCallback(
    (e: any) => {
      if (e.evt.touches?.length === 2 && lastCenterRef.current && lastDistRef.current) {
        e.evt.preventDefault(); // Prevent default browser pinch/pan

        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];

        const newCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
        const newDist = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );

        // We want to zoom around the center of the pinch!
        const scaleBy = newDist / lastDistRef.current;
        // Clamp zoom between 0.05 and 50 to prevent crazy values
        const newZoom = Math.min(Math.max(0.05, zoom * scaleBy), 50);

        const pointTo = {
          x: (newCenter.x - stagePos.x) / zoom,
          y: (newCenter.y - stagePos.y) / zoom,
        };

        const newPos = {
          x: newCenter.x - pointTo.x * newZoom,
          y: newCenter.y - pointTo.y * newZoom,
        };

        setZoom(newZoom);
        setStagePos(newPos);

        lastCenterRef.current = newCenter;
        lastDistRef.current = newDist;
      }
    },
    [zoom, stagePos, setZoom, setStagePos],
  );

  const onTouchEnd = useCallback((e: any) => {
    if (!e.evt.touches || e.evt.touches.length < 2) {
      lastCenterRef.current = null;
      lastDistRef.current = 0;
      setIsPinching(false);
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, isPinching };
}
