import React from "react";

interface CardSymbolProps {
  symbolIdx: number;
  url: string | null;
  placement: React.CSSProperties;
  relativeSize?: number; // percentage of card width
}

export const CardSymbol: React.FC<CardSymbolProps> = ({
  symbolIdx,
  url,
  placement,
  relativeSize = 20,
}) => {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        ...placement,
        width: `${relativeSize}%`,
        height: `${relativeSize}%`,
      }}
    >
      {url ? (
        <img
          src={url}
          alt="symbol"
          className="pointer-events-none h-full w-full object-contain select-none"
          draggable={false}
        />
      ) : (
        <div className="pointer-events-none flex aspect-square h-[80%] items-center justify-center rounded-full bg-gray-100 text-[1.5cqw] text-gray-400 select-none md:text-[8px]">
          S{symbolIdx}
        </div>
      )}
    </div>
  );
};
