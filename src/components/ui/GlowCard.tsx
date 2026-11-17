import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Accent = "green" | "cyan" | "purple" | "magenta" | "gold";

const accents: Record<Accent, string> = {
  green: "hover:border-neon-green/60 hover:shadow-glow-green",
  cyan: "hover:border-neon-cyan/60 hover:shadow-glow-cyan",
  purple: "hover:border-neon-purple/60 hover:shadow-glow-purple",
  magenta: "hover:border-neon-magenta/60 hover:shadow-glow-magenta",
  gold: "hover:border-neon-gold/60 hover:shadow-glow-gold",
};

export function GlowCard({
  accent = "cyan",
  className,
  children,
}: {
  accent?: Accent;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("panel p-6 transition-all duration-300 hover:-translate-y-1", accents[accent], className)}>
      {children}
    </div>
  );
}
