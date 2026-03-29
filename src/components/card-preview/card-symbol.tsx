import React from "react";

interface CardSymbolProps {
  symbolIdx: number;
  url: string | null;
  placement: React.CSSProperties;
}

export const CardSymbol: React.FC<CardSymbolProps> = ({ symbolIdx, url, placement }) => {
  return (
    <div className="absolute" style={placement}>
      {url ? (
        <img src={url} alt="symbol" className="h-12 w-12 object-contain" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[8px] text-gray-400">
          S{symbolIdx}
        </div>
      )}
    </div>
  );
};
