import React from "react";

import { TOTAL_SYMBOLS } from "@/lib/constants";

export const HowItWorks: React.FC = () => {
  return (
    <section className="mb-10">
      <div className="bg-card border-border flex flex-wrap gap-8 rounded-2xl border px-8 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {[
          {
            step: "01",
            title: "Upload your symbols",
            desc: `Add ${TOTAL_SYMBOLS} images — photos, stickers, drawings, anything personal.`,
          },
          {
            step: "02",
            title: "We balance the deck",
            desc: "A projective-plane algorithm guarantees every card pair shares exactly one symbol.",
          },
          {
            step: "03",
            title: "Print & play",
            desc: "Choose your paper size, print, cut, and you have a unique game to gift.",
          },
        ].map(({ step, title, desc }) => (
          <div key={step} className="min-w-48 flex-1">
            <div className="text-primary mb-1 text-[0.6rem] font-black tracking-widest uppercase">
              STEP {step}
            </div>
            <div className="text-card-foreground mb-1 text-sm font-bold">{title}</div>
            <div className="text-muted-foreground text-sm leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
