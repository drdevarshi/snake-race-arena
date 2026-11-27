/** Quality tiers for Dragon Lab. Medium is the phone tier (agreed target: 30 FPS on iPhone 13). */
export type Quality = "low" | "medium" | "high";

export type QualitySettings = {
  /** Body rings (cross-sections). */
  rings: number;
  /** Crystal ridges along the spine. */
  ridges: number;
  /** Device-pixel-ratio range for the canvas. */
  dpr: [number, number];
  bloom: boolean;
  /** Mirror-like reflections on the water floor (renders the scene twice). */
  reflections: boolean;
  /** Anti-aliasing samples in the post-processing pass. */
  multisampling: number;
  sparks: number;
  dragonLight: number;
};

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { rings: 80, ridges: 16, dpr: [1, 1], bloom: false, reflections: false, multisampling: 0, sparks: 30, dragonLight: 14 },
  medium: { rings: 120, ridges: 22, dpr: [1, 1.5], bloom: true, reflections: false, multisampling: 0, sparks: 60, dragonLight: 18 },
  high: { rings: 170, ridges: 28, dpr: [1, 2], bloom: true, reflections: true, multisampling: 4, sparks: 120, dragonLight: 22 },
};

export const QUALITY_ORDER: Quality[] = ["low", "medium", "high"];

/** Phones and tablets start on Medium, desktops on High. */
export function defaultQuality(): Quality {
  if (typeof window === "undefined") return "medium";
  return window.matchMedia("(pointer: coarse)").matches ? "medium" : "high";
}
