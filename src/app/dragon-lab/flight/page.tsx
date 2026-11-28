import type { Metadata } from "next";
import { FlightClient } from "@/game/flight/FlightClient";

/** M2a free-flight sandbox. Not linked from the menu and not indexed until the owner approves it. */
export const metadata: Metadata = {
  title: "Dragon Lab · Free flight",
  robots: { index: false, follow: false },
};

export default function DragonFlightPage() {
  return <FlightClient />;
}
