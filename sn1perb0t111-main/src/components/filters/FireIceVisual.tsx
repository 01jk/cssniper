import fireIceIconImg from "@/assets/fire-ice-icon.png";
import { useId } from "react";
import { X } from "lucide-react";

interface FireIceVisualProps {
  /** Tier label to display (1st/2nd/3rd) or null */
  tier?: '1st' | '2nd' | '3rd' | null;
  /** Compact mode for inline chips/badges. 'main' matches the CustomFilterTab button (h-10) */
  size?: 'badge' | 'chip' | 'main';
  /** Show the "Fire & Ice" text label */
  showLabel?: boolean;
  /** When provided, renders an inline X remove button inside the pill */
  onRemove?: () => void;
  className?: string;
}

/**
 * Shared visual for the Fire & Ice filter — mirrors the selected CustomFilterTab
 * button: dual red/blue padding+border gradient, chaotic Doppler turbulent
 * depth layer and the flame PNG icon (tiered variant when provided).
 */
export const FireIceVisual = ({
  tier = null,
  size = 'chip',
  showLabel = true,
  onRemove,
  className = '',
}: FireIceVisualProps) => {
  const uid = useId().replace(/:/g, '');
  const isBadge = size === 'badge';
  const isMain = size === 'main';

  const height = isBadge ? 'h-4' : isMain ? 'h-10' : 'h-7';
  const padX = isBadge ? 'px-1' : isMain ? 'px-3' : 'px-2';
  const radius = isBadge ? 'rounded' : isMain ? 'rounded-lg' : 'rounded-md';
  const iconBox = isBadge ? 'h-3.5 w-3.5' : isMain ? 'h-[26px] w-[26px]' : 'h-5 w-5';
  const textSize = isBadge ? 'text-[9px]' : isMain ? 'text-sm' : 'text-xs';
  const gap = isBadge ? 'gap-0.5' : 'gap-1.5';

  const iconSrc = fireIceIconImg;
  const tierDigit = tier ? tier.charAt(0) : null;

  return (
    <span
      className={`relative inline-flex items-center justify-center ${gap} ${padX} ${height} ${radius} overflow-hidden fire-ice-shimmer border-2 border-transparent ${className} ${onRemove ? 'pr-7' : ''}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(13,31,74,0.78) 0%, rgba(34,20,82,0.65) 30%, rgba(88,21,21,0.66) 60%, rgba(139,25,25,0.6) 85%, rgba(20,55,133,0.55) 100%) padding-box, linear-gradient(135deg, #2563eb, #7c3aed, #dc2626, #991b1b) border-box',
        backgroundClip: 'padding-box, border-box',
        backgroundOrigin: 'padding-box, border-box',
        boxShadow:
          '0 0 6px rgba(244,63,94,0.22), 0 0 8px rgba(37,99,235,0.16)',
      }}
    >
      {/* Chaotic doppler-style turbulent depth layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-90 mix-blend-screen"
        preserveAspectRatio="none"
        viewBox="0 0 200 40"
        aria-hidden
      >
        <defs>
          <radialGradient id={`fivBlue-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#1e40af" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`fivRed-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#b91c1c" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`fivPurple-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          <filter id={`fivChaos-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.18" numOctaves="3" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="14" />
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
        </defs>
        <g filter={`url(#fivChaos-${uid})`}>
          <ellipse cx="30" cy="22" rx="34" ry="18" fill={`url(#fivBlue-${uid})`} />
          <ellipse cx="78" cy="14" rx="28" ry="16" fill={`url(#fivPurple-${uid})`} />
          <ellipse cx="120" cy="26" rx="32" ry="18" fill={`url(#fivRed-${uid})`} />
          <ellipse cx="168" cy="16" rx="30" ry="18" fill={`url(#fivBlue-${uid})`} />
          <ellipse cx="55" cy="30" rx="20" ry="12" fill={`url(#fivRed-${uid})`} />
          <ellipse cx="150" cy="8" rx="18" ry="10" fill={`url(#fivPurple-${uid})`} />
        </g>
      </svg>

      {/* Flame PNG icon with optional tier digit overlay */}
      <span className={`${iconBox} relative z-10 shrink-0 ${isMain ? 'translate-y-[3px]' : 'translate-y-[2px]'}`}>
        <img
          src={iconSrc}
          alt=""
          className="w-full h-full object-contain"
          style={{
            filter:
              'drop-shadow(0 0 5px rgba(244,63,94,0.55)) drop-shadow(0 0 4px rgba(59,130,246,0.45))',
          }}
        />
        {tierDigit && (
          <span
            className="absolute inset-0 flex items-center justify-center font-black pointer-events-none"
            style={{
              fontSize: isBadge ? '7px' : isMain ? '12px' : '9px',
              background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f43f5e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 4px rgba(0,0,0,0.6)',
            }}
          >
            {tierDigit}
          </span>
        )}
      </span>

      {showLabel && (
        <span
          className={`${textSize} font-semibold relative z-10 whitespace-nowrap`}
          style={{
            background:
              'linear-gradient(90deg, hsl(220 90% 70%), hsl(250 80% 65%), hsl(0 85% 60%), hsl(15 90% 55%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {tier ? `${tier} Fire & Ice` : 'Fire & Ice'}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-0.5 rounded hover:bg-current/20 transition-colors shrink-0"
          style={{ color: '#f43f5e' }}
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
