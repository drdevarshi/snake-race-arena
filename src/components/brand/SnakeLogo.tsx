/** Original vector snake-head mark for Snake Race Arena. */
export function SnakeLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="srl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a6ff00" />
          <stop offset="100%" stopColor="#18c40a" />
        </linearGradient>
        <filter id="srl-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#srl-glow)">
        {/* coiled body */}
        <path
          d="M14 52c-6-6-4-16 6-17h20c8 0 10-10 2-11H26"
          fill="none"
          stroke="url(#srl-body)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* head */}
        <path d="M22 12c8-6 22-4 26 4 3 6-1 12-8 12H26c-6 0-9-10-4-16z" fill="url(#srl-body)" />
        {/* eye */}
        <circle cx="38" cy="16" r="3.2" fill="#05060a" />
        <circle cx="39" cy="15" r="1.1" fill="#00f0ff" />
        {/* tongue */}
        <path d="M48 22l6 2m-6-2l5 4" stroke="#ff2bd6" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
