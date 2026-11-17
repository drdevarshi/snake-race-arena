import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "green" | "purple" | "cyan" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  green:
    "bg-gradient-to-b from-neon-lime to-neon-green text-arena-black shadow-glow-green hover:brightness-110",
  purple:
    "bg-gradient-to-b from-neon-magenta to-neon-purple text-white shadow-glow-purple hover:brightness-110",
  cyan: "bg-gradient-to-b from-neon-cyan to-neon-blue text-arena-black shadow-glow-cyan hover:brightness-110",
  ghost:
    "border border-neon-cyan/50 bg-arena-panel/60 text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-glow-cyan",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

const base =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function NeonLink({
  href,
  variant = "green",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
      {icon}
    </Link>
  );
}

export function NeonButton({
  variant = "green",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
      {icon}
    </button>
  );
}
