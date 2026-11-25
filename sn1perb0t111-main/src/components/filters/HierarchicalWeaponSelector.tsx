import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import itemTypesImage from "@/assets/item-types-icons.png";

// Weapon type configuration with positions in sprite image (0-indexed)
const WEAPON_CATEGORIES = [
  {
    id: "knives",
    label: "Knives",
    position: 0,
    weapons: [
      { id: "bayonet", label: "Bayonet" },
      { id: "karambit", label: "Karambit" },
      { id: "m9_bayonet", label: "M9 Bayonet" },
      { id: "shadow_daggers", label: "Shadow Daggers" },
      { id: "butterfly", label: "Butterfly" },
      { id: "falchion", label: "Falchion" },
      { id: "bowie", label: "Bowie" },
      { id: "navaja", label: "Navaja" },
      { id: "ursus", label: "Ursus" },
      { id: "tactical", label: "Tactical" },
    ]
  },
  {
    id: "pistols",
    label: "Pistols",
    position: 1,
    weapons: [
      { id: "glock", label: "Glock" },
      { id: "usp", label: "USP" },
      { id: "p2000", label: "P2000" },
      { id: "p250", label: "P250" },
      { id: "dual_berettas", label: "Dual Berettas" },
      { id: "fiveseven", label: "Five-SeveN" },
      { id: "cz75_auto", label: "CZ75-Auto" },
      { id: "tec9", label: "TEC-9" },
      { id: "revolver", label: "Revolver" },
      { id: "deagle", label: "Desert Eagle" },
      { id: "mag7", label: "Mag-7" },
    ]
  },
  {
    id: "rifles",
    label: "Rifles",
    position: 2,
    weapons: [
      { id: "ak47", label: "AK-47" },
      { id: "ak74", label: "AK-74" },
      { id: "aug", label: "AUG" },
      { id: "famas", label: "FAMAS" },
      { id: "galil", label: "Galil" },
      { id: "m4a4", label: "M4A4" },
      { id: "m4a1_s", label: "M4A1-S" },
      { id: "sg553", label: "SG 553" },
      { id: "sg556", label: "SG 556" },
      { id: "famas", label: "FAMAS" },
      { id: "g3sg1", label: "G3SG1" },
    ]
  },
  {
    id: "smgs",
    label: "SMGs",
    position: 3,
    weapons: [
      { id: "mp5", label: "MP5" },
      { id: "mp7", label: "MP7" },
      { id: "mp9", label: "MP9" },
      { id: "mac10", label: "MAC-10" },
      { id: "ump45", label: "UMP-45" },
      { id: "p90", label: "P90" },
      { id: "bizon", label: "Bizon" },
    ]
  },
  {
    id: "shotguns",
    label: "Shotguns",
    position: 4,
    weapons: [
      { id: "nova", label: "Nova" },
      { id: "xm1014", label: "XM1014" },
      { id: "sawed_off", label: "Sawed-Off" },
      { id: "mag7", label: "Mag-7" },
      { id: "m870", label: "M870" },
    ]
  },
  {
    id: "machineguns",
    label: "Machineguns",
    position: 5,
    weapons: [
      { id: "m249", label: "M249" },
      { id: "negev", label: "Negev" },
      { id: "m60", label: "M60" },
    ]
  },
  {
    id: "stickers",
    label: "Stickers",
    position: 6,
    weapons: []
  },
  {
    id: "charm",
    label: "Charms",
    position: 7,
    weapons: []
  },
  {
    id: "agent",
    label: "Agents",
    position: 8,
    weapons: []
  }
];

// Icon size and spacing based on image dimensions (1200x64, 11 icons)
const ICON_WIDTH = 109; // ~1200/11
const ICON_HEIGHT = 64;

interface WeaponIconProps {
  position: number;
  size?: number;
  className?: string;
}

const WeaponIcon = ({ position, size = 24, className }: WeaponIconProps) => {
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

interface HierarchicalWeaponSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const HierarchicalWeaponSelector = ({ value, onChange, className }: HierarchicalWeaponSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<string | null>(null);

  const selectedCategoryData = WEAPON_CATEGORIES.find(cat => cat.id === selectedCategory);
  const selectedWeaponData = selectedCategoryData?.weapons.find(w => w.id === selectedWeapon);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedWeapon(null);
  };

  const handleWeaponSelect = (weaponId: string) => {
    const weaponIdForDisplay = `${selectedCategory}_${weaponId}`;
    onChange(weaponIdForDisplay);
    setSelectedWeapon(weaponId);
    setOpen(false);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedWeapon(null);
  };

  const getDisplayValue = () => {
    if (selectedWeapon && selectedCategory) {
      const weapon = selectedCategoryData?.weapons.find(w => w.id === selectedWeapon);
      return weapon ? `${selectedCategoryData.label} > ${weapon.label}` : value;
    }
    return value;
  };

  return (
    <div className="space-y-2">
      {/* Main selector button */}
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
              {selectedCategoryData && (
                <WeaponIcon position={selectedCategoryData.position} size={20} />
              )}
              {selectedWeaponData && (
                <>
                  <ChevronRight className="h-3 w-3 opacity-70" />
                  <WeaponIcon position={selectedCategoryData.position + 1} size={20} />
                </>
              )}
              <span className="truncate">
                {getDisplayValue()}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-2 bg-[#1a2332] border-border/50"
          align="start"
          sideOffset={4}
        >
          {/* Categories */}
          {!selectedCategory && (
            <div className="grid grid-cols-3 gap-1">
              {WEAPON_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-[#2a3a4f]",
                    selectedCategory === category.id && "bg-primary/20 text-primary"
                  )}
                >
                  <WeaponIcon position={category.position} size={16} />
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Weapons in selected category */}
          {selectedCategory && selectedCategoryData && (
            <div className="space-y-2">
              {/* Back button */}
              <button
                onClick={handleBackToCategories}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-[#2a3a4f] transition-colors mb-2"
              >
                <ChevronRight className="h-3 w-3 rotate-180" />
                <span>Back to Categories</span>
              </button>

              {/* Weapons grid */}
              <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
                {selectedCategoryData.weapons.map((weapon) => (
                  <button
                    key={weapon.id}
                    onClick={() => handleWeaponSelect(weapon.id)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                      "hover:bg-[#2a3a4f]",
                      selectedWeapon === weapon.id && "bg-primary/20 text-primary"
                    )}
                  >
                    <WeaponIcon position={selectedCategoryData.position + 1} size={16} />
                    <span>{weapon.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export { WEAPON_CATEGORIES };
