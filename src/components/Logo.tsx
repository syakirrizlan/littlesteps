/** Two footprints, one small and one smaller, on a soft plum tile. Also used to draw the app icons. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#7a52a6" />
      <g fill="#fdeee7">
        <ellipse cx="25" cy="38" rx="7" ry="10" transform="rotate(-12 25 38)" />
        <circle cx="19.5" cy="24" r="2.6" />
        <circle cx="24.5" cy="22" r="2.4" />
        <circle cx="29" cy="23.2" r="2.1" />
      </g>
      <g fill="#f4d67c">
        <ellipse cx="42" cy="28" rx="5" ry="7.4" transform="rotate(10 42 28)" />
        <circle cx="38.6" cy="17.6" r="1.9" />
        <circle cx="42.4" cy="16.4" r="1.8" />
        <circle cx="45.8" cy="17.6" r="1.6" />
      </g>
    </svg>
  );
}
