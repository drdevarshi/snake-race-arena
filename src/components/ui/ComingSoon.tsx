import { getT } from "@/i18n/translate";
import { NeonLink } from "./NeonButton";
import { SnakeLogo } from "@/components/brand/SnakeLogo";

/** Temporary page body for routes scheduled in later build phases. */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  const t = getT();
  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-20">
      <div className="arena-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="panel relative max-w-md p-10 text-center">
        <SnakeLogo size={64} className="mx-auto" />
        <p className="mt-4 text-sm font-bold uppercase tracking-widest text-neon-magenta">{t("comingSoon.title")}</p>
        <h1 className="mt-2 font-display text-3xl font-black uppercase text-white">{title}</h1>
        <p className="mt-3 text-slate-400">{t("comingSoon.body", { phase })}</p>
        <NeonLink href="/" variant="ghost" className="mt-8">
          {t("comingSoon.back")}
        </NeonLink>
      </div>
    </section>
  );
}
