import React from "react";

interface CardSymbolProps {
  symbolIdx: number;
  url: string | null;
  placement: React.CSSProperties;
  size?: number;
}

export const CardSymbol: React.FC<CardSymbolProps> = ({ symbolIdx, url, placement, size = 48 }) => {
  return (
    <div className="absolute" style={placement}>
      {url ? (
        <img
          src={url}
          alt="symbol"
          className="pointer-events-none object-contain select-none"
          draggable={false}
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      ) : (
        <div
          className="pointer-events-none flex items-center justify-center rounded-full bg-gray-100 text-[8px] text-gray-400 select-none"
          style={{ width: `${size * 0.8}px`, height: `${size * 0.8}px` }}
        >
          S{symbolIdx}
        </div>
      )}
    </div>
  );
};
