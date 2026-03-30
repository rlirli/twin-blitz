"use client";

import React from "react";

import Link from "next/link";

import { Printer } from "lucide-react";

import { cn } from "@/lib/utils/cn";

interface PrintSectionProps {
  className?: string;
}

export const PrintSection: React.FC<PrintSectionProps> = ({ className }) => {
  return (
    <div
      className={cn(
        "bg-card border-border mb-16 rounded-2xl border p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className="mb-6 flex flex-col gap-1">
        <span className="bg-primary-soft text-primary mb-1 block inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
          Step 3
        </span>
        <h2 className="text-card-foreground text-xl font-extrabold tracking-tight">
          Ready to Print
        </h2>
        <p className="text-muted-foreground text-sm">
          Everything looks good? Export your generated card deck to PDF or PNGs and print yourself.
        </p>
      </div>

      <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg p-2 py-6">
        <Link
          href="/print"
          className="bg-primary text-primary-foreground text-md inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-0 px-6 py-4 leading-tight font-bold no-underline transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
          style={{ boxShadow: "0 8px 32px var(--primary-glow)" }}
        >
          <span className="shrink-0">
            <Printer size={20} />
          </span>
          <span className="text-center">Print Cards</span>
        </Link>
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Photo print recommended for better gameplay.
        </p>
      </div>
    </div>
  );
};
