/** Generated initials avatar (no uploads yet). Color is validated as #rrggbb by the database. */
export function Avatar({ name, color, size = 72 }: { name: string; color: string; size?: number }) {
  const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl border-2 font-display font-black text-arena-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color}, #00f0ff)`,
        borderColor: color,
        boxShadow: `0 0 18px ${color}88`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
