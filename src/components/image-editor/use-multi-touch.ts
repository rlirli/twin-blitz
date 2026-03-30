import { useRef, useCallback, useState } from "react";

export function useMultiTouch(
  zoom: number,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  stagePos: { x: number; y: number },
  setStagePos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  cancelInteraction?: () => void,
) {
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);
  const [isMultiTouching, setIsMultiTouching] = useState(false);

  const onTouchStart = useCallback(
    (e: any) => {
      // e.evt.touches refers to screen touches.
      if (e.evt.touches?.length === 2) {
        if (cancelInteraction) {
          cancelInteraction();
        }

        setIsMultiTouching(true);

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

        // Zoom scale ratio between this frame and last frame
        const scaleBy = newDist / lastDistRef.current;
        // Clamp zoom between 0.05 and 50
        const newZoom = Math.min(Math.max(0.05, zoom * scaleBy), 50);

        // Find the image coordinate that was beneath the old center point
        const pointTo = {
          x: (lastCenterRef.current.x - stagePos.x) / zoom,
          y: (lastCenterRef.current.y - stagePos.y) / zoom,
        };

        // Align the old point in the image perfectly under the new center point,
        // factoring in the new scaled dimensions
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
      setIsMultiTouching(false);
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, isMultiTouching };
}
