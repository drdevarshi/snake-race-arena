/** Dragon skins (Phase 0 report, section 4). */
export type SkinId = "neon-magenta" | "neon-emerald" | "electric-cyan";

export type Skin = {
  id: SkinId;
  /** i18n key for the skin's name. */
  nameKey: string;
  /** Scale-edge and ridge glow. */
  glow: string;
  /** Secondary highlight (spine, rim, ridge tips). */
  highlight: string;
  /** Hot spots: brighter, cooler patches on the face and where the glow is strongest. */
  hot: string;
  /** Eye colour — the brightest point of the dragon. */
  eyes: string;
  /** Dark scale faces. */
  body: string;
  /** Belly plates, darker than the body. */
  belly: string;
};

export const SKINS: Record<SkinId, Skin> = {
  "neon-magenta": {
    id: "neon-magenta",
    nameKey: "dragonLab.skins.neonMagenta",
    glow: "#FF2BD6",
    highlight: "#9D4DFF",
    hot: "#4D6BFF",
    eyes: "#E6F0FF",
    body: "#2a0830",
    belly: "#140416",
  },
  "neon-emerald": {
    id: "neon-emerald",
    nameKey: "dragonLab.skins.neonEmerald",
    glow: "#39FF14",
    highlight: "#A6FF00",
    hot: "#00F0FF",
    eyes: "#00F0FF",
    body: "#0b2a12",
    belly: "#06140a",
  },
  "electric-cyan": {
    id: "electric-cyan",
    nameKey: "dragonLab.skins.electricCyan",
    glow: "#00F0FF",
    highlight: "#1E90FF",
    hot: "#FFE28A",
    eyes: "#FFE28A",
    body: "#06202c",
    belly: "#041018",
  },
};

export const SKIN_ORDER: SkinId[] = ["neon-magenta", "neon-emerald", "electric-cyan"];

/**
 * Dragon Lab opens in Neon Magenta Pink to match the owner's reference video (26 Nov).
 * The game's default skin (Neon Emerald Green, decided 19 Nov) is unchanged.
 */
export const LAB_START_SKIN: SkinId = "neon-magenta";
