import { getT } from "@/i18n/translate";
import { GlowCard } from "@/components/ui/GlowCard";
import { NeonLink } from "@/components/ui/NeonButton";
import {
  IconArrowRight, IconMap, IconShield, IconUsers, IconCoin, IconPlay, IconRefresh, IconTrophy, IconApple,
} from "@/components/ui/Icons";
import { DEFAULT_REWARDS } from "@/config/rewards";
import { Reveal } from "./Reveal";

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-black uppercase sm:text-4xl">
        <span className="text-neon-gradient">{title}</span>
      </h2>
      {subtitle && <p className="mt-4 text-lg text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function FeatureGrid() {
  const t = getT();
  const items = [
    { key: "sameCourse", icon: IconMap, accent: "green" as const, color: "text-neon-green" },
    { key: "verified", icon: IconShield, accent: "cyan" as const, color: "text-neon-cyan" },
    { key: "private", icon: IconUsers, accent: "purple" as const, color: "text-neon-purple" },
    { key: "coins", icon: IconCoin, accent: "gold" as const, color: "text-neon-gold" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading title={t("home.features.title")} subtitle={t("home.features.subtitle")} />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ key, icon: Icon, accent, color }, i) => (
          <Reveal key={key} delay={i * 0.08}>
            <GlowCard accent={accent} className="h-full">
              <Icon width={36} height={36} className={color} />
              <h3 className="mt-4 font-display text-lg font-bold uppercase text-white">
                {t(`home.features.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-slate-400">{t(`home.features.items.${key}.body`)}</p>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const t = getT();
  const steps = [
    { key: "join", icon: IconPlay },
    { key: "race", icon: IconApple },
    { key: "retry", icon: IconRefresh },
    { key: "rank", icon: IconTrophy },
  ];
  return (
    <section className="relative border-y border-arena-border bg-arena-charcoal/50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading title={t("home.how.title")} />
        <ol className="mt-12 grid gap-8 md:grid-cols-4">
          {steps.map(({ key, icon: Icon }, i) => (
            <Reveal key={key} delay={i * 0.1}>
              <li className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-arena-panel text-neon-cyan shadow-glow-cyan">
                  <Icon width={28} height={28} />
                </div>
                <span className="mt-4 block font-display text-xs font-bold tracking-[0.3em] text-neon-magenta">
                  0{i + 1}
                </span>
                <h3 className="mt-1 font-display text-xl font-bold uppercase text-white">
                  {t(`home.how.steps.${key}.title`)}
                </h3>
                <p className="mt-2 text-slate-400">{t(`home.how.steps.${key}.body`)}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function RewardsPreview() {
  const t = getT();
  const rows = [
    { label: t("home.rewards.completion"), coins: DEFAULT_REWARDS.completion, ring: "border-neon-green/50 text-neon-green" },
    { label: t("home.rewards.first"), coins: DEFAULT_REWARDS.first, ring: "border-neon-gold/60 text-neon-gold shadow-glow-gold" },
    { label: t("home.rewards.second"), coins: DEFAULT_REWARDS.second, ring: "border-slate-300/50 text-slate-200" },
    { label: t("home.rewards.third"), coins: DEFAULT_REWARDS.third, ring: "border-orange-400/50 text-orange-300" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading title={t("home.rewards.title")} />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(({ label, coins, ring }, i) => (
          <Reveal key={label} delay={i * 0.08}>
            <div className={`panel flex flex-col items-center gap-2 border-2 p-6 text-center ${ring}`}>
              <IconCoin width={40} height={40} />
              <span className="font-display text-3xl font-black">{t("home.rewards.coins", { count: coins })}</span>
              <span className="font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">{t("home.rewards.note")}</p>
    </section>
  );
}

export function FinalCta() {
  const t = getT();
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-neon-purple/50 bg-gradient-to-br from-neon-purple/25 via-arena-panel to-neon-cyan/15 p-10 text-center shadow-glow-purple sm:p-14">
          <h2 className="font-display text-3xl font-black uppercase text-white sm:text-4xl">{t("home.cta.title")}</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate-300">{t("home.cta.body")}</p>
          <NeonLink href="/register" size="lg" className="mt-8" icon={<IconArrowRight width={20} height={20} />}>
            {t("home.cta.button")}
          </NeonLink>
        </div>
      </Reveal>
    </section>
  );
}
