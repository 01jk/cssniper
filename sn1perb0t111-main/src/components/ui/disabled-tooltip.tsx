import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

interface DisabledTooltipProps {
  children: React.ReactNode;
  reason?: string;
  disabled?: boolean;
}

/**
 * Wraps content with a tooltip explaining why it's disabled.
 * When disabled, applies visual dimming effect.
 */
export const DisabledTooltip = ({ children, reason, disabled = false }: DisabledTooltipProps) => {
  if (!disabled || !reason) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="relative opacity-30 pointer-events-none grayscale select-none">
          {children}
          <div className="absolute inset-0 cursor-not-allowed pointer-events-auto" />
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="bg-popover/95 border-border text-foreground max-w-[250px] text-sm"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <span>{reason}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

/**
 * Badge component for disabled filter tabs
 */
export const DisabledBadge = ({ reason }: { reason: string }) => (
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <div className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/50 text-muted-foreground cursor-help">
        <AlertCircle className="h-3 w-3" />
      </div>
    </TooltipTrigger>
    <TooltipContent 
      side="top" 
      className="bg-popover/95 border-border text-foreground max-w-[250px] text-sm"
    >
      {reason}
    </TooltipContent>
  </Tooltip>
);
