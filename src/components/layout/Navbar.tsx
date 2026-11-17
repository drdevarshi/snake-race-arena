"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/i18n/I18nProvider";
import { mainNav } from "@/config/navigation";
import { SnakeLogo } from "@/components/brand/SnakeLogo";
import { NeonLink } from "@/components/ui/NeonButton";
import { IconClose, IconCoin, IconMenu } from "@/components/ui/Icons";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

export interface NavUser {
  username: string;
  coins: number;
}

function LogoutButton({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <form action={logoutAction}>
      <button type="submit" className={cn("focus-ring rounded-lg font-semibold uppercase tracking-wide", className)}>
        {t("nav.logout")}
      </button>
    </form>
  );
}

function CoinPill({ coins }: { coins: number }) {
  const { t } = useT();
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border border-neon-gold/50 bg-neon-gold/10 px-3 py-1 font-display text-sm font-bold text-neon-gold"
      aria-label={t("nav.coinsAria", { count: coins })}
    >
      <IconCoin width={16} height={16} aria-hidden />
      {coins.toLocaleString("en")}
    </span>
  );
}

export function Navbar({ user }: { user?: NavUser | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-arena-border/80 bg-arena-black/75 backdrop-blur-xl">
      <nav aria-label={t("nav.mainNav")} className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg">
          <SnakeLogo size={36} />
          <span className="font-display text-sm font-black uppercase leading-tight tracking-wide">
            <span className="block text-neon-green text-glow-green">{t("brand.nameLine1")}</span>
            <span className="block text-neon-cyan">{t("brand.nameLine2")}</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {mainNav.map(({ href, labelKey, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "focus-ring relative flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-semibold uppercase tracking-wide transition-colors",
                  isActive(href) ? "text-neon-cyan" : "text-slate-400 hover:text-white",
                )}
              >
                <Icon width={18} height={18} />
                {t(labelKey)}
                {isActive(href) && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-neon-cyan shadow-glow-cyan"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <CoinPill coins={user.coins} />
              <NeonLink href="/dashboard" size="sm" variant="ghost">
                {user.username}
              </NeonLink>
              <LogoutButton className="px-2 py-2 text-sm text-slate-400 hover:text-white" />
            </>
          ) : (
            <>
              <Link href="/login" className="focus-ring rounded-lg px-3 py-2 font-semibold uppercase tracking-wide text-slate-300 hover:text-white">
                {t("nav.login")}
              </Link>
              <NeonLink href="/register" size="sm">
                {t("nav.register")}
              </NeonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="focus-ring rounded-lg p-2 text-slate-200 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-arena-border lg:hidden"
          >
            <ul className="space-y-1 px-4 py-4">
              {mainNav.map(({ href, labelKey, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "focus-ring flex items-center gap-3 rounded-lg px-3 py-3 font-semibold uppercase tracking-wide",
                      isActive(href) ? "bg-neon-cyan/10 text-neon-cyan" : "text-slate-300 hover:bg-white/5",
                    )}
                  >
                    <Icon width={20} height={20} />
                    {t(labelKey)}
                  </Link>
                </li>
              ))}
              {user ? (
                <li className="flex items-center justify-between gap-2 border-t border-arena-border pt-4">
                  <CoinPill coins={user.coins} />
                  <div className="flex items-center gap-2">
                    <NeonLink href="/dashboard" variant="ghost" size="sm">
                      {t("nav.dashboard")}
                    </NeonLink>
                    <LogoutButton className="px-3 py-2 text-sm text-slate-400" />
                  </div>
                </li>
              ) : (
                <li className="grid grid-cols-2 gap-2 pt-3">
                  <NeonLink href="/login" variant="ghost" size="sm">
                    {t("nav.login")}
                  </NeonLink>
                  <NeonLink href="/register" size="sm">
                    {t("nav.register")}
                  </NeonLink>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
