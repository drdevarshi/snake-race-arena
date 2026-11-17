import type { ReactNode } from "react";
import { SnakeLogo } from "@/components/brand/SnakeLogo";

/** Centered glowing card used by all auth screens. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="arena-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-neon-purple/20 blur-[100px]" />
      <div className="absolute bottom-10 right-1/4 h-72 w-72 rounded-full bg-neon-green/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-neon-green/60 via-neon-cyan/40 to-neon-purple/60 blur-sm" />
        <div className="relative rounded-3xl border border-arena-border bg-arena-panel/95 p-7 sm:p-9">
          <div className="mb-6 text-center">
            <SnakeLogo size={56} className="mx-auto" />
            <h1 className="mt-3 font-display text-2xl font-black uppercase text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 border-t border-arena-border pt-5 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </div>
    </section>
  );
}
