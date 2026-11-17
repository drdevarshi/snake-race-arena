import Link from "next/link";
import { getT } from "@/i18n/translate";
import { localeNames, locales } from "@/i18n/config";
import { mainNav } from "@/config/navigation";
import { SnakeLogo } from "@/components/brand/SnakeLogo";

export function Footer() {
  const t = getT();
  return (
    <footer className="border-t border-arena-border bg-arena-charcoal/60">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <SnakeLogo size={32} />
            <span className="font-display font-black uppercase text-neon-green">{t("brand.name")}</span>
          </div>
          <p className="mt-2 font-display text-sm uppercase tracking-widest text-neon-cyan">{t("brand.tagline")}</p>
          <p className="mt-4 text-sm text-slate-400">{t("footer.disclaimer")}</p>
        </div>

        <ul className="grid grid-cols-2 gap-2 text-sm">
          {mainNav.map(({ href, labelKey }) => (
            <li key={href}>
              <Link href={href} className="focus-ring rounded text-slate-400 hover:text-neon-cyan">
                {t(labelKey)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="text-sm text-slate-400 md:text-right">
          <p>
            {t("footer.language")}: {locales.map((l) => localeNames[l]).join(", ")}
          </p>
          <p className="mt-4">{t("footer.rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
