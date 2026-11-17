import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { defaultLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSession } from "@/lib/auth/session";

const t = getT();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${t("brand.name")} — ${t("brand.tagline")}`, template: `%s · ${t("brand.name")}` },
  description: t("home.hero.subtitle"),
  openGraph: {
    title: t("brand.name"),
    description: t("home.hero.subtitle"),
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const navUser = session?.profile
    ? { username: session.profile.username, coins: session.profile.coin_balance }
    : null;

  return (
    <html lang={defaultLocale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={defaultLocale}>
          <Navbar user={navUser} />
          <main className="flex-1">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
