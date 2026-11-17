"use client";

import { useEffect, useRef } from "react";
import { getCourse } from "@/game/courses";
import { createGame } from "@/game/engine";
import { buildBoard, drawMiniMap } from "./renderer";

/** Static thumbnail of a course (board, apples, power-ups, start). */
export function CoursePreview({ courseId, className }: { courseId: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const course = getCourse(courseId);
    const ctx = ref.current?.getContext("2d");
    if (!course || !ctx) return;
    drawMiniMap(ctx, buildBoard(course), course, createGame(course), null);
  }, [courseId]);
  return <canvas ref={ref} width={560} height={360} className={className} aria-hidden />;
}
