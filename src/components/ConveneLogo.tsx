interface ConveneLogoProps {
  className?: string;
}

/**
 * Convene — "Constellation Network C" Connectivity Junction Logo
 * Single outer C-ring of 7 hollow junction nodes + 1 central convergence hub
 * in a crisp off-white / light greyish-white palette (#F8FAFC, #E2E8F0, #CBD5E1).
 */
export default function ConveneLogo({ className = "w-7 h-7" }: ConveneLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Convene Connectivity Junction Logo"
    >
      {/* Subtle inner constellation chords (no extra dot layer) */}
      <path
        d="M49 17 L18 16 L18 48 L49 47 M33 10 L10 32 L33 54"
        stroke="#CBD5E1"
        strokeOpacity="0.38"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Radial spokes from Central Hub (34, 32) to the 7 C-ring nodes */}
      <g stroke="#E2E8F0" strokeOpacity="0.7" strokeWidth="1.7" strokeLinecap="round">
        <line x1="34" y1="32" x2="49" y2="17" />
        <line x1="34" y1="32" x2="33" y2="10" />
        <line x1="34" y1="32" x2="18" y2="16" />
        <line x1="34" y1="32" x2="10" y2="32" />
        <line x1="34" y1="32" x2="18" y2="48" />
        <line x1="34" y1="32" x2="33" y2="54" />
        <line x1="34" y1="32" x2="49" y2="47" />
      </g>

      {/* Outer C-Ring Perimeter Arc */}
      <path
        d="M49 17 L33 10 L18 16 L10 32 L18 48 L33 54 L49 47"
        stroke="#F8FAFC"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Single Layer of 7 Outer C-Ring Hollow Junction Nodes */}
      <g fill="#0F172A" stroke="#F8FAFC" strokeWidth="2.2">
        <circle cx="49" cy="17" r="3.4" />
        <circle cx="33" cy="10" r="3.4" />
        <circle cx="18" cy="16" r="3.4" />
        <circle cx="10" cy="32" r="3.4" />
        <circle cx="18" cy="48" r="3.4" />
        <circle cx="33" cy="54" r="3.4" />
        <circle cx="49" cy="47" r="3.4" />
      </g>

      {/* Central Convergence Hub Node */}
      <circle cx="34" cy="32" r="4" fill="#0F172A" stroke="#F8FAFC" strokeWidth="2.4" />
    </svg>
  );
}
