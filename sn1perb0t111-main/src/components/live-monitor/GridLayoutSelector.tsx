import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Columns3, Settings2, ImageIcon } from "lucide-react";

interface GridLayoutSelectorProps {
  columns: number;
  onColumnsChange: (v: number) => void;
  imageScale: number;
  onImageScaleChange: (v: number) => void;
}

export const GridLayoutSelector = ({ columns, onColumnsChange, imageScale, onImageScaleChange }: GridLayoutSelectorProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={`flex items-center h-8 rounded-md border !bg-background/40 overflow-hidden shrink-0 cursor-pointer transition-colors ${open ? 'border-primary/40' : 'border-border/40 hover:border-border/60'}`}>
          <div className="flex items-center gap-1 px-2 h-full border-r border-border/20">
            <Columns3 className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[11px] font-mono text-foreground font-medium">{columns}</span>
          </div>
          <div className="flex items-center gap-1 px-2 h-full border-r border-border/20">
            <ImageIcon className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[11px] font-mono text-foreground font-medium tabular-nums">{imageScale}%</span>
          </div>
          <div className="flex items-center px-1.5 h-full">
            <Settings2 className={`h-3 w-3 transition-colors ${open ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3 space-y-3" align="end">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5"><Columns3 className="h-3 w-3" /> Columns</span>
            <span className="font-mono text-foreground font-medium">{columns}</span>
          </div>
          <Slider value={[columns]} onValueChange={([v]) => onColumnsChange(v)} min={5} max={12} step={1} />
        </div>
        <div className="h-px bg-border/40" />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5"><ImageIcon className="h-3 w-3" /> Image Size</span>
            <span className="font-mono text-foreground font-medium tabular-nums">{imageScale}%</span>
          </div>
          <Slider value={[imageScale]} onValueChange={([v]) => onImageScaleChange(v)} min={50} max={200} step={5} />
          <p className="text-[9.5px] text-muted-foreground/70 leading-tight">Adjusts the zoom level of the weapon image inside the card.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
