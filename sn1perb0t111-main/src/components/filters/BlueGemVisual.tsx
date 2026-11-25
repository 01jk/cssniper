import blueGemCrystalImg from "@/assets/blue-gem-crystal.png";
import blueGemTier1Img from "@/assets/blue-gem-tier-1.png";
import blueGemTier2Img from "@/assets/blue-gem-tier-2.png";
import blueGemTier3Img from "@/assets/blue-gem-tier-3.png";
import { X } from "lucide-react";

interface BlueGemVisualProps {
  tier?: '1st' | '2nd' | '3rd' | null;
  /** 'main' matches CustomFilterTab button (h-10); 'chip' is the inline filter chip size */
  size?: 'chip' | 'main';
  /** Optional extra label after "Blue Gem" (e.g. percent) */
  extra?: string;
  showLabel?: boolean;
  /** When provided, renders an inline X remove button inside the pill */
  onRemove?: () => void;
  className?: string;
}

/**
 * Shared visual for the Blue Gem filter — mirrors the selected CustomFilterTab
 * Blue Gem button: icy crystal sticker with radial blue gradients, crystal facets
 * overlay, foil glitter and crystal PNG icon (tiered when provided).
 */
export const BlueGemVisual = ({
  tier = null,
  size = 'chip',
  extra,
  showLabel = true,
  onRemove,
  className = '',
}: BlueGemVisualProps) => {
  const isMain = size === 'main';
  const height = isMain ? 'h-10' : 'h-7';
  const padX = isMain ? 'px-3' : 'px-2';
  const radius = isMain ? 'rounded-lg' : 'rounded-md';
  const iconSize = isMain ? 'h-5 w-5' : 'h-4 w-4';
  const textSize = isMain ? 'text-sm' : 'text-xs';
  const gap = isMain ? 'gap-1.5' : 'gap-1.5';

  const iconSrc = tier === '1st'
    ? blueGemTier1Img
    : tier === '2nd'
      ? blueGemTier2Img
      : tier === '3rd'
        ? blueGemTier3Img
        : blueGemCrystalImg;

  return (
    <span
      className={`relative inline-flex items-center justify-center ${gap} ${padX} ${height} ${radius} overflow-hidden border-2 border-cyan-200/80 bluegem-sticker-active bluegem-crystal-surface ${className} ${onRemove ? 'pr-7' : ''}`}
      style={{
        background:
          'radial-gradient(ellipse at 30% 0%, rgba(186,230,253,0.55) 0%, transparent 55%), radial-gradient(ellipse at 75% 100%, rgba(29,78,216,0.65) 0%, transparent 60%), linear-gradient(135deg, #1d4ed8 0%, #2563eb 35%, #0284c7 65%, #1e3a8a 100%)',
        boxShadow: isMain
          ? '0 0 14px rgba(186,230,253,0.55), 0 0 26px rgba(125,211,252,0.35), inset 0 1px 0 rgba(240,249,255,0.55)'
          : '0 0 5px rgba(186,230,253,0.28), 0 0 9px rgba(125,211,252,0.18), inset 0 1px 0 rgba(240,249,255,0.55)',
      }}
    >
      <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-crystal-facets" style={{ opacity: 1 }}></span>
      <span aria-hidden="true" className="absolute inset-0 pointer-events-none bluegem-foil-glitter" style={{ opacity: 1 }}></span>

      <img
        src={iconSrc}
        alt=""
        className={`${iconSize} relative z-10 shrink-0 object-contain`}
        style={{
          filter:
            'drop-shadow(0 0 5px rgba(240,249,255,0.9)) drop-shadow(0 0 2px rgba(186,230,253,0.8))',
        }}
      />
      {showLabel && (
        <span
          className={`${textSize} font-semibold relative z-10 whitespace-nowrap`}
          style={{
            background: 'linear-gradient(90deg, #ffffff, #7dd3fc, #38bdf8, #0ea5e9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 4px rgba(14,165,233,0.6)) drop-shadow(0 1px 1px rgba(0,0,0,0.7))',
          }}
        >
          {tier ? `${tier} Blue Gem` : 'Blue Gem'}
        </span>
      )}
      {extra && (
        <span
          className={`${textSize} font-semibold relative z-10 whitespace-nowrap`}
          style={{
            background: 'linear-gradient(90deg, #ffffff, #7dd3fc, #38bdf8, #0ea5e9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 4px rgba(14,165,233,0.6)) drop-shadow(0 1px 1px rgba(0,0,0,0.7))',
          }}
        >
          {extra}
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-0.5 rounded hover:bg-current/20 transition-colors shrink-0"
          style={{ color: '#38bdf8' }}
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
