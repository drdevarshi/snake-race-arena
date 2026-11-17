/** XP → level curve. Level n requires 500·n·(n−1)/2 total XP (500, 1500, 3000, …). */
export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, intoLevel: xp - current, needed: next - current };
}

export function xpForLevel(level: number) {
  return (500 * level * (level - 1)) / 2;
}
