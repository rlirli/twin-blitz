import { CardPreview } from "@/components/card-preview";
import { HowItWorks } from "@/components/how-it-works";
import { PrintSection } from "@/components/print-section";
import { SymbolGrid } from "@/components/symbol-grid";
import { TOTAL_SYMBOLS, TOTAL_CARDS } from "@/lib/constants";

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
                Upload {TOTAL_SYMBOLS} personal images and get a ready-to-print{" "}
                <strong className="text-foreground font-bold">matching card game</strong> where
                every pair of cards shares exactly one symbol — a truly unique handmade gift.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              `${TOTAL_SYMBOLS} symbols · ${TOTAL_CARDS} cards`,
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
        </header>

        <HowItWorks />

        <section>
          <SymbolGrid />
        </section>

        <section>
          <CardPreview />
        </section>

        <section>
          <PrintSection />
        </section>

        <footer className="border-border text-muted-foreground border-t pt-10 text-center text-xs leading-relaxed">
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
