import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/i18n/translate";
import { levelFromXp } from "@/lib/game/progression";
import { Avatar } from "@/components/dashboard/Avatar";
import {
  IconCoin, IconPlay, IconPlus, IconWheel, IconGift, IconTrophy, IconShield, IconMap,
} from "@/components/ui/Icons";

export const metadata = { title: "Player Dashboard" };
export const dynamic = "force-dynamic";

interface QuickAction {
  href: string;
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ verified?: string; reset?: string }> }) {
  const { profile } = await requireUser("/dashboard");
  const { verified, reset } = await searchParams;
  const t = getT();
  const name = profile.display_name || profile.username;
  const { level, intoLevel, needed } = levelFromXp(profile.xp);
  const pct = Math.min(100, Math.round((intoLevel / needed) * 100));
  const since = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(profile.created_at));

  // Real stats are wired up in Phases 4–5 (from the attempts/results tables). No placeholder numbers.
  const stats = ["competitions", "bestTime", "podiums", "attempts"] as const;

  const actions: QuickAction[] = [
    { href: "/arena", key: "play", icon: IconPlay, color: "text-neon-green border-neon-green/40 hover:shadow-glow-green" },
    { href: "/create", key: "create", icon: IconPlus, color: "text-neon-purple border-neon-purple/40 hover:shadow-glow-purple" },
    { href: "/spin", key: "spin", icon: IconWheel, color: "text-neon-magenta border-neon-magenta/40 hover:shadow-glow-magenta" },
    { href: "/shop", key: "shop", icon: IconGift, color: "text-neon-gold border-neon-gold/40 hover:shadow-glow-gold" },
    { href: "/inventory", key: "inventory", icon: IconMap, color: "text-neon-cyan border-neon-cyan/40 hover:shadow-glow-cyan" },
    { href: "/leaderboard", key: "leaderboard", icon: IconTrophy, color: "text-neon-lime border-neon-lime/40 hover:shadow-glow-green" },
  ];
  if (profile.role === "admin") {
    actions.push({ href: "/admin", key: "admin", icon: IconShield, color: "text-red-400 border-red-400/40 hover:shadow-glow-magenta" });
  }

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="sr-only">{t("dashboard.title")}</h1>

      {verified && <Banner tone="green">{t("dashboard.verifiedBanner")}</Banner>}
      {reset && <Banner tone="cyan">{t("dashboard.resetBanner")}</Banner>}
      {profile.is_suspended && <Banner tone="red">{t("dashboard.suspended")}</Banner>}

      {/* Profile header */}
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-neon-purple/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar name={profile.username} color={profile.avatar_color} />
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-widest text-neon-cyan">{t("dashboard.welcomeBack")}</p>
              <p className="flex items-center gap-2 truncate font-display text-2xl font-black text-white sm:text-3xl">
                {name}
                {profile.role === "admin" && (
                  <span className="rounded-md border border-red-400/60 bg-red-400/10 px-2 py-0.5 text-xs font-bold uppercase text-red-300">
                    {t("dashboard.adminBadge")}
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">{t("dashboard.memberSince", { date: since })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-neon-gold/50 bg-neon-gold/10 px-5 py-3 shadow-glow-gold">
            <IconCoin width={32} height={32} className="text-neon-gold" />
            <div>
              <p className="font-display text-2xl font-black text-neon-gold">{profile.coin_balance.toLocaleString("en")}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t("dashboard.coins")}</p>
            </div>
          </div>
        </div>

        {/* Level bar */}
        <div className="relative mt-6">
          <div className="mb-1.5 flex justify-between text-sm font-bold">
            <span className="text-neon-green">{t("dashboard.level", { level })}</span>
            <span className="text-slate-400">{t("dashboard.xp", { current: intoLevel, needed })}</span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-arena-black"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("dashboard.level", { level })}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-neon-green to-neon-cyan shadow-glow-green" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Stats */}
        <section className="panel p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-bold uppercase text-white">{t("dashboard.stats.title")}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {stats.map((key) => (
              <div key={key} className="rounded-xl border border-arena-border bg-arena-black/50 p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{t(`dashboard.stats.${key}`)}</dt>
                <dd className="mt-1 font-display text-2xl font-black text-slate-300">—</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-slate-500">{t("dashboard.stats.empty")}</p>
        </section>

        {/* Quick actions */}
        <section className="panel p-6 lg:col-span-3">
          <h2 className="font-display text-lg font-bold uppercase text-white">{t("dashboard.quick.title")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {actions.map(({ href, key, icon: Icon, color }) => (
              <Link
                key={key}
                href={href}
                className={`focus-ring flex flex-col items-center gap-2 rounded-xl border bg-arena-black/50 p-4 text-center transition-all hover:-translate-y-0.5 ${color}`}
              >
                <Icon width={30} height={30} />
                <span className="text-sm font-bold uppercase tracking-wide text-slate-200">{t(`dashboard.quick.${key}`)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "green" | "cyan" | "red"; children: React.ReactNode }) {
  const styles = {
    green: "border-neon-green/50 bg-neon-green/10 text-neon-green",
    cyan: "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan",
    red: "border-red-500/50 bg-red-500/10 text-red-300",
  }[tone];
  return (
    <div role="status" className={`mb-6 rounded-xl border px-4 py-3 font-semibold ${styles}`}>
      {children}
    </div>
  );
}
