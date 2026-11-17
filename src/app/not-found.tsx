import { getT } from "@/i18n/translate";
import { NeonLink } from "@/components/ui/NeonButton";

export default function NotFound() {
  const t = getT();
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-black text-neon-magenta">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold uppercase text-white">{t("notFound.title")}</h1>
      <p className="mt-2 text-slate-400">{t("notFound.body")}</p>
      <NeonLink href="/" className="mt-8">{t("notFound.back")}</NeonLink>
    </section>
  );
}
