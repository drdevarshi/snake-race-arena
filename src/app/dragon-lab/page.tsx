import type { Metadata } from "next";
import { DragonLabClient } from "@/game/dragon/DragonLabClient";

/** Phase 1 prototype. Not linked from the menu and not indexed until the owner approves it. */
export const metadata: Metadata = {
  title: "Dragon Lab",
  robots: { index: false, follow: false },
};

export default function DragonLabPage() {
  return <DragonLabClient />;
}
