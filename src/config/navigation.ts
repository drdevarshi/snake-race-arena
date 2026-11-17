import type { ComponentType, SVGProps } from "react";
import { IconHome, IconPlay, IconTrophy, IconGift, IconWheel, IconPlus } from "@/components/ui/Icons";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const mainNav: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: IconHome },
  { href: "/arena", labelKey: "nav.play", icon: IconPlay },
  { href: "/leaderboard", labelKey: "nav.leaderboard", icon: IconTrophy },
  { href: "/shop", labelKey: "nav.rewards", icon: IconGift },
  { href: "/spin", labelKey: "nav.spin", icon: IconWheel },
  { href: "/create", labelKey: "nav.create", icon: IconPlus },
];
