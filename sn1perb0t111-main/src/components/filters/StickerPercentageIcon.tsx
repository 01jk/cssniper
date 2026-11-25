import { cn } from "@/lib/utils";

interface StickerPercentageIconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  active?: boolean;
}

const sizeMap = {
  sm: "w-4 h-4 text-[8px]",
  md: "w-5 h-5 text-[10px]",
  lg: "w-6 h-6 text-[11px]",
};

export const StickerPercentageIcon = ({
  className,
  size = "md",
  animate = true,
  active = true,
}: StickerPercentageIconProps) => {
  return (
    <div
      className={cn(
        "relative flex-shrink-0 rounded-md overflow-hidden flex items-center justify-center font-black leading-none select-none",
        active ? "sticker-overpay-gradient" : "sticker-percentage-inactive",
        "ring-1 ring-inset",
        active ? "ring-white/15" : "ring-white/10",
        active
          ? "shadow-[0_0_10px_rgba(34,197,94,0.22),0_0_4px_rgba(239,68,68,0.18)_inset]"
          : "shadow-[0_0_4px_rgba(0,0,0,0.25)_inset]",
        animate && active && "sticker-percentage-glow",
        sizeMap[size],
        className
      )}
    >
      {/* Glossy glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 pointer-events-none" />
      {/* Animated shimmer */}
      {active && (
        <div className="absolute inset-0 sticker-percentage-shimmer pointer-events-none" />
      )}
      {/* % symbol */}
      <span className={cn(
        "relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
        active ? "text-white/95" : "text-white/90"
      )}>%</span>
    </div>
  );
};
