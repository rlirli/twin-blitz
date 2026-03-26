import Link from "next/link";

import { Printer } from "lucide-react";

import { CardPreview } from "@/components/card-preview";
import { SymbolGrid } from "@/components/symbol-grid";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50/50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div className="flex flex-col justify-between gap-6 border-b border-gray-200 pb-8 md:flex-row md:items-end">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
              Twin <span className="text-indigo-600 italic">Blitz</span>
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-pretty text-gray-500">
              Create a custom gift. Upload 57 symbols and we'll generate the perfectly balanced card
              game.
            </p>
          </div>
          <Link
            href="/print"
            className="group flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            <Printer className="transition-transform group-hover:rotate-12" />
            Go to Print Mode
          </Link>
        </div>

        {/* Step 1: Symbols */}
        <section>
          <SymbolGrid />
        </section>

        {/* Step 2: Preview */}
        <section>
          <CardPreview />
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-12 text-center text-sm text-gray-400">
          Built with precision for personal birthday gifts. Any two cards share exactly one symbol.
        </footer>
      </div>
    </main>
  );
}
