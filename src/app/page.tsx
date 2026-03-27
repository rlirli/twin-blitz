import Link from "next/link";

import { Printer } from "lucide-react";

import { CardPreview } from "@/components/card-preview";
import { SymbolGrid } from "@/components/symbol-grid";

export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-screen px-6 py-12 pb-16">
      <div className="mx-auto max-w-6xl">
        {/* ── Header ── */}
        <header className="border-border mb-12 flex flex-col gap-6 border-b pb-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="bg-primary-soft text-primary mb-3 block inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
                Card Deck Generator
              </span>
              <h1 className="text-foreground text-5xl leading-none font-black tracking-tighter md:text-6xl">
                <span className="italic">Twin</span>{" "}
                <span className="text-primary italic">Blitz</span>
              </h1>
              <p className="text-muted-foreground mt-4 max-w-lg text-lg leading-relaxed text-pretty">
                Upload 57 personal images and get a ready-to-print{" "}
                <strong className="text-foreground font-bold">matching card game</strong> where
                every pair of cards shares exactly one symbol — a truly unique handmade gift.
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href="/print"
                className="bg-primary text-primary-foreground inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-0 px-8 py-3.5 font-bold no-underline transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
                style={{ boxShadow: "0 8px 32px var(--primary-glow)" }}
              >
                <Printer size={18} />
                Print Cards
              </Link>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["57 symbols · 57 cards", "Custom images", "Print-ready", "Perfect handmade gift"].map(
              (pill) => (
                <span
                  key={pill}
                  className="text-muted-foreground bg-card border-border rounded-full border px-3 py-1 text-xs font-semibold"
                >
                  {pill}
                </span>
              ),
            )}
          </div>
        </header>

        {/* ── How It Works ── */}
        <section className="mb-10">
          <div
            className="bg-card border-border flex flex-wrap gap-8 rounded-2xl border px-8 py-6"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}
          >
            {[
              {
                step: "01",
                title: "Upload your symbols",
                desc: "Add 57 images — photos, stickers, drawings, anything personal.",
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

        {/* Step 1: Symbols */}
        <section>
          <SymbolGrid />
        </section>

        {/* Step 2: Preview */}
        <section>
          <CardPreview />
        </section>

        {/* ── Footer ── */}
        <footer className="border-border text-muted-foreground border-t pt-10 text-center text-xs leading-relaxed">
          <p>
            Built with love for handmade gifts.{" "}
            <span className="bg-primary-soft text-primary rounded px-2 py-0.5 font-semibold">
              Any two cards share exactly one symbol
            </span>{" "}
            guaranteed by projective plane mathematics.
          </p>
        </footer>
      </div>
    </main>
  );
}
