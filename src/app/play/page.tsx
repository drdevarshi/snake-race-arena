import { notFound } from "next/navigation";
import { GameClient } from "@/components/game/GameClient";
import { DEFAULT_COURSE_ID, getCourse } from "@/game/courses";
import type { SpeedSetting } from "@/game/types";

export const metadata = { title: "Play" };

const SPEEDS: SpeedSetting[] = ["slow", "normal", "fast"];

/** Practice gameplay. Open to everyone (no login) so visitors can try the game. */
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ course?: string; speed?: string }> }) {
  const { course: courseParam, speed } = await searchParams;
  const courseId = courseParam ?? DEFAULT_COURSE_ID;
  if (!getCourse(courseId)) notFound();
  const initialSpeed = SPEEDS.includes(speed as SpeedSetting) ? (speed as SpeedSetting) : undefined;
  return <GameClient key={courseId} courseId={courseId} initialSpeed={initialSpeed} />;
}
