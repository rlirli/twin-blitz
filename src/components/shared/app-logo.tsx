import React from "react";

import Link from "next/link";

import { cn } from "@/lib/utils/cn";

interface AppLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "text-xl md:text-2xl",
  md: "text-3xl md:text-4xl",
  lg: "text-5xl md:text-6xl",
  xl: "text-7xl md:text-8xl",
};

const paddingMap = {
  sm: "px-4 py-0.5",
  md: "px-6 py-0.5",
  lg: "px-9 py-1",
  xl: "px-12 py-2",
};

export const AppLogo: React.FC<AppLogoProps> = ({ className, size = "lg" }) => {
  return (
    <Link
      href="/"
      className={cn(
        "bg-primary w-fit rounded-full transition-transform active:scale-95",
        paddingMap[size],
        className,
      )}
    >
      <h1
        className={cn(
          "-ml-1 leading-none font-black tracking-tighter text-zinc-100 select-none dark:text-zinc-900",
          sizeMap[size],
        )}
      >
        <span className="italic">Twin</span>{" "}
        <span className="text-amber-400 italic dark:text-indigo-700">Blitz</span>
      </h1>
    </Link>
  );
};
