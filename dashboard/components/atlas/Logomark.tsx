/**
 * Octahedron logomark — same form as the BountyNode geometry inside the
 * cosmos, so the brand reads as "this is what the platform certifies."
 * Single-color, scales cleanly. Pair with the Ascertainty wordmark.
 */
export function Logomark({
  size = 22,
  color = "#00D4AA",
  innerColor,
}: {
  size?: number;
  color?: string;
  innerColor?: string;
}) {
  const inner = innerColor ?? color;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <path
        d="M32 8 L52 32 L32 56 L12 32 Z"
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M32 20 L42 32 L32 44 L22 32 Z"
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <circle cx={32} cy={32} r={3} fill={inner} />
    </svg>
  );
}
