import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import itemTypesImage from "@/assets/item-types-icons.png";

// Item type configuration with positions in the sprite image (0-indexed)
const ITEM_TYPES = [
  { id: "knives", label: "Knives", position: 0 },
  { id: "gloves", label: "Gloves", position: 1 },
  { id: "rifles", label: "Rifles", position: 2 },
  { id: "pistols", label: "Pistols", position: 3 },
  { id: "smgs", label: "SMGs", position: 4 },
  { id: "shotguns", label: "Shotguns", position: 5 },
  { id: "machineguns", label: "Machineguns", position: 6 },
  { id: "stickers", label: "Stickers", position: 7 },
  { id: "charm", label: "Charm", position: 8 },
  { id: "agent", label: "Agent", position: 9 },
] as const;

export type ItemTypeId = typeof ITEM_TYPES[number]["id"];

// Icon size and spacing based on image dimensions (1200x64, 11 icons)
const ICON_WIDTH = 109; // ~1200/11
const ICON_HEIGHT = 64;

interface ItemIconProps {
  position: number;
  size?: number;
  className?: string;
}

const ItemIcon = ({ position, size = 24, className }: ItemIconProps) => {
  if (position < 0) return null;
  
  const scale = size / ICON_HEIGHT;
  const offsetX = position * ICON_WIDTH * scale;
  
  return (
    <div 
      className={cn("overflow-hidden flex-shrink-0", className)}
      style={{ 
        width: size,
        height: size,
      }}
    >
      <img 
        src={itemTypesImage}
        alt=""
        style={{
          width: ICON_WIDTH * 11 * scale,
          height: size,
          objectFit: "cover",
          marginLeft: -offsetX,
        }}
        className="pointer-events-none"
      />
    </div>
  );
};

interface ItemTypeSelectorProps {
  value: ItemTypeId;
  onChange: (value: ItemTypeId) => void;
  className?: string;
}

export const ItemTypeSelector = ({ value, onChange, className }: ItemTypeSelectorProps) => {
  const [open, setOpen] = useState(false);
  
  const selectedType = ITEM_TYPES.find(t => t.id === value) || ITEM_TYPES[0];
  
  const handleSelect = (id: ItemTypeId) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-between w-full h-10 px-3 py-2 text-sm",
            "bg-input border border-border rounded-md",
            "hover:bg-accent/10 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {selectedType.position >= 0 && (
              <ItemIcon position={selectedType.position} size={20} />
            )}
            <span>{selectedType.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-2 bg-[#1a2332] border-border/50"
        align="start"
        sideOffset={4}
      >
        <div className="grid grid-cols-1 gap-0.5">
          {ITEM_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleSelect(type.id)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                "hover:bg-[#2a3a4f]",
                value === type.id && "bg-primary/20 text-primary"
              )}
            >
              {type.position >= 0 ? (
                <ItemIcon position={type.position} size={20} />
              ) : (
                <div className="w-5" /> // Spacer for "All Items"
              )}
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { ITEM_TYPES };
