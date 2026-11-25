import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbColors?: string[]; transparentTrack?: boolean }
>(({ className, thumbColors, transparentTrack, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track
      data-slot="track"
      className={cn(
        "relative h-2 w-full grow overflow-visible rounded-full",
        transparentTrack ? "bg-transparent" : "bg-secondary"
      )}
    >
      <SliderPrimitive.Range className="absolute h-full bg-primary/0" />
    </SliderPrimitive.Track>
    {(props.value as number[] || [props.defaultValue || 0]).map((_, index) => (
      <SliderPrimitive.Thumb
        key={index}
        className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        style={thumbColors?.[index] ? {
          borderColor: thumbColors[index],
          backgroundColor: thumbColors[index],
          boxShadow: `0 0 8px ${thumbColors[index]}`
        } : undefined}
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
