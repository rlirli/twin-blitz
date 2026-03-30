import React from "react";

import { TOTAL_SYMBOLS } from "@/lib/constants";
import { SymbolData } from "@/store/use-symbol-store";

import { GameCard } from "./card-preview/game-card";

const DEMO_SYMBOLS: SymbolData[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  url: `/demo/s${i + 1}.svg`,
  sourceId: null,
  name: `Demo ${i + 1}`,
  transformation: { x: 0, y: 0, width: 300, height: 300, rotation: 0 },
  maskData: [],
}));

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: "01",
      title: "Upload your symbols",
      desc: `Add ${TOTAL_SYMBOLS} images — photos, stickers, drawings, anything personal.`,
      visual: (
        <div className="relative h-full min-h-[6rem] w-full rounded-t-xl rounded-b-none bg-indigo-50/50 dark:bg-indigo-950/30">
          {[
            { id: 0, size: 45, top: "10%", left: "10%", rotate: -10 },
            { id: 1, size: 95, top: "5%", left: "42%", rotate: 5 },
            { id: 2, size: 50, top: "-15%", left: "70%", rotate: 15 },
            { id: 3, size: 40, top: "45%", left: "80%", rotate: -5 },
            { id: 4, size: 40, top: "-15%", left: "86%", rotate: -5 },
            { id: 5, size: 30, top: "60%", left: "5%", rotate: 20 },
            { id: 6, size: 45, top: "60%", left: "27%", rotate: -15 },
            { id: 7, size: 35, top: "20%", left: "25%", rotate: 10 },
          ].map((s) => (
            <div
              key={s.id}
              className="absolute flex items-center justify-center transition-transform hover:scale-110"
              style={{
                top: s.top,
                left: s.left,
                width: s.size,
                height: s.size,
                transform: `rotate(${s.rotate}deg)`,
              }}
            >
              <img
                src={DEMO_SYMBOLS[s.id].url!}
                alt="preview"
                className="h-full w-full object-contain select-none"
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      step: "02",
      title: "We balance the deck",
      desc: "A projective-plane algorithm guarantees every card pair shares exactly one symbol.",
      visual: (
        <div className="relative flex h-full min-h-[6rem] w-full items-center justify-center rounded-t-xl rounded-b-none bg-indigo-50/50 dark:bg-indigo-950/30">
          <div className="absolute -top-2 left-[72%] -translate-x-1/2 text-[2px] opacity-90">
            <GameCard
              cardIdx={1}
              cardIndices={[5, 9, 10, 11, 12, 13, 14, 15]}
              symbols={DEMO_SYMBOLS}
              size={90}
              showShadow={true}
              showLabel={false}
              interactive={true}
              className="border"
            />
          </div>
          <div className="absolute -bottom-12 left-[35%] -translate-x-1/2">
            <GameCard
              cardIdx={0}
              cardIndices={[0, 1, 2, 3, 4, 5, 6, 7]}
              symbols={DEMO_SYMBOLS}
              size={140}
              showShadow={true}
              showLabel={false}
              interactive={true}
              className="border"
            />
          </div>
        </div>
      ),
    },
    {
      step: "03",
      title: "Print & play",
      desc: "Choose your paper size, print, cut, and you have a unique game to gift.",
      visual: (
        <div className="relative flex h-full min-h-[6rem] w-full items-center justify-center rounded-t-xl rounded-b-none bg-indigo-50/50 dark:bg-indigo-950/30">
          {/* Background Page */}
          <div className="absolute -bottom-2 left-[62%] aspect-[3/2] h-16 -translate-x-[40%] -translate-y-[0%] rotate-2 rounded border border-gray-200 bg-white">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <GameCard
                cardIdx={1}
                cardIndices={[5, 9, 10, 11, 12, 13, 14, 15]}
                symbols={DEMO_SYMBOLS}
                size={40}
                showShadow={false}
                showLabel={false}
                interactive={false}
                className="border opacity-80"
              />
            </div>
          </div>

          {/* Foreground Page */}
          <div className="absolute -top-2 left-[45%] aspect-[3/2] h-20 -translate-x-1/2 -translate-y-0 -rotate-5 rounded border border-gray-200 bg-white p-2 shadow-xs md:bottom-5">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <GameCard
                cardIdx={0}
                cardIndices={[0, 1, 2, 3, 4, 5, 6, 7]}
                symbols={DEMO_SYMBOLS}
                size={55}
                showShadow={false}
                showLabel={false}
                interactive={false}
                className="border"
              />
            </div>
            {/* Corner marks */}
            <div className="absolute top-1 left-1 h-1 w-1 border-t border-l border-gray-200" />
            <div className="absolute top-1 right-1 h-1 w-1 border-t border-r border-gray-200" />
            <div className="absolute bottom-1 left-1 h-1 w-1 border-b border-l border-gray-200" />
            <div className="absolute right-1 bottom-1 h-1 w-1 border-r border-b border-gray-200" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="mb-10">
      <div className="bg-card border-border flex flex-wrap gap-8 overflow-hidden rounded-2xl border px-8 pt-6 pb-0 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {steps.map(({ step, title, desc, visual }) => (
          <div key={step} className="flex min-w-48 flex-1 flex-col gap-4 overflow-hidden">
            <div>
              <div className="text-primary mb-1 text-[0.6rem] font-black tracking-widest uppercase">
                STEP {step}
              </div>
              <div className="text-card-foreground mb-1 text-sm font-bold">{title}</div>
              <div className="text-muted-foreground text-sm leading-relaxed">{desc}</div>
            </div>
            {visual}
          </div>
        ))}
      </div>
    </section>
  );
};
