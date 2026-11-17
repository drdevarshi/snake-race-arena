"use client";

import { motion } from "framer-motion";
import { useT } from "@/i18n/I18nProvider";
import { NeonLink } from "@/components/ui/NeonButton";
import { IconArrowRight, IconWheel, IconShield, IconMap, IconCoin } from "@/components/ui/Icons";
import { HeroSnakeCanvas } from "./HeroSnakeCanvas";

export function Hero() {
  const { t } = useT();
  const words = [t("home.hero.title1"), t("home.hero.title2"), t("home.hero.title3")];
  const badges = [
    { icon: IconCoin, label: t("home.hero.badgeFree") },
    { icon: IconMap, label: t("home.hero.badgeFair") },
    { icon: IconShield, label: t("home.hero.badgeVerified") },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background layers */}
      <div className="arena-grid absolute inset-0 animate-grid-scroll opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-neon-purple/20 blur-[120px]" />
      <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-neon-cyan/15 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-1 text-sm font-bold uppercase tracking-widest text-neon-magenta"
          >
            {t("home.hero.eyebrow")}
          </motion.p>

          <h1 className="mt-6 font-display text-5xl font-black uppercase italic leading-[0.95] sm:text-6xl xl:text-7xl">
            {words.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.15, type: "spring", stiffness: 120 }}
                className={
                  i === 2
                    ? "block bg-gradient-to-r from-neon-gold to-neon-lime bg-clip-text text-transparent"
                    : "block text-white"
                }
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 max-w-lg text-lg text-slate-300"
          >
            {t("home.hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-8 flex flex-wrap gap-4"
          >
            <NeonLink href="/arena" size="lg" icon={<IconArrowRight width={20} height={20} />}>
              {t("home.hero.ctaPrimary")}
            </NeonLink>
            <NeonLink href="/spin" size="lg" variant="purple" icon={<IconWheel width={20} height={20} />}>
              {t("home.hero.ctaSecondary")}
            </NeonLink>
          </motion.div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {badges.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <Icon width={18} height={18} className="text-neon-cyan" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, rotateX: 12 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{ perspective: 1000 }}
          className="relative"
        >
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-neon-green via-neon-cyan to-neon-purple opacity-60 blur-md" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-neon-cyan/40 bg-arena-charcoal">
            <HeroSnakeCanvas />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
