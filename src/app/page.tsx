"use client";

import { Suspense } from "react";

import { CardPreview } from "@/components/card-preview";
import { HowItWorks } from "@/components/how-it-works";
import { PrintSection } from "@/components/print-section";
import { AppLogo } from "@/components/shared";
import { SymbolGrid } from "@/components/symbol-grid";
import { useDeckSettingsStore } from "@/store/use-settings-store";

export default function Home() {
  const { totalSymbolCount, totalCardCount } = useDeckSettingsStore();

  return (
    <main className="bg-background text-foreground min-h-screen px-6 py-12 pb-16">
      <div className="mx-auto max-w-6xl">
        {/* ── Header ── */}
        <header className="border-border mb-12 flex flex-col gap-6 border-b pb-10">
          <div className="flex w-full flex-wrap items-center justify-center gap-5">
            <div className="flex flex-col items-center justify-center">
              <span className="mb-3 block inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest text-zinc-500 uppercase">
                Card Deck Generator
              </span>
              <AppLogo />
              <p className="text-muted-foreground mt-4 max-w-lg text-center text-lg leading-relaxed text-pretty">
                Upload {totalSymbolCount} personal images and get a ready-to-print{" "}
                <strong className="text-foreground font-bold">matching card game</strong> where
                every pair of cards shares exactly one symbol — a truly unique handmade gift.
              </p>
            </div>
          </div>

          <div className="flex hidden flex-wrap gap-2">
            {[
              `${totalSymbolCount} symbols · ${totalCardCount} cards`,
              "Custom images",
              "Print-ready",
              "Perfect handmade gift",
            ].map((pill) => (
              <span
                key={pill}
                className="text-muted-foreground bg-card border-border rounded-full border px-3 py-1 text-xs font-semibold"
              >
                {pill}
              </span>
            ))}
          </div>

          <HowItWorks />
        </header>

        <section>
          <Suspense
            fallback={
              <div className="bg-muted border-muted-foreground/10 mb-6 h-48 animate-pulse rounded-2xl border" />
            }
          >
            <SymbolGrid />
          </Suspense>
        </section>

        <section>
          <CardPreview />
        </section>

        <section>
          <PrintSection />
        </section>

        <footer className="border-border text-muted-foreground mt-12 border-t pt-10 text-center text-xs leading-relaxed">
          <div className="mb-6 flex justify-center opacity-50 transition-opacity hover:opacity-100">
            <AppLogo size="sm" />
          </div>
          <p>
            Built with love for handmade gifts.
            <br />
            <span className="bg-primary-soft text-primary rounded px-1 py-0.5 font-semibold">
              Any two cards share exactly one symbol
            </span>{" "}
            guaranteed by projective plane mathematics.
          </p>
        </footer>
      </div>
    </main>
  );
}
