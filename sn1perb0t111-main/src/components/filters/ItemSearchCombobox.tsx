import { useState, useMemo, useEffect, useDeferredValue, type ElementType, type MouseEvent } from "react";
import { Search, X, Eraser, ChevronRight } from "lucide-react";

// Custom funnel / filter icon for the category-browse button
const CS2CategoriesIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Funnel outer shape */}
    <path
      d="M2.5 3.5 C2.5 2.9 3 2.5 3.5 2.5 L16.5 2.5 C17 2.5 17.5 2.9 17.5 3.5 L17.5 4.5 C17.5 4.8 17.35 5.1 17.1 5.3 L12 9.7 L12 16 C12 16.55 11.55 17 11 17 L9 17 C8.45 17 8 16.55 8 16 L8 9.7 L2.9 5.3 C2.65 5.1 2.5 4.8 2.5 4.5 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
    {/* Inner lines — horizontal bars inside funnel */}
    <line x1="6.5" y1="7.2" x2="13.5" y2="7.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    <line x1="8.3" y1="10.5" x2="11.7" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    <line x1="9.1" y1="13.5" x2="10.9" y2="13.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
  </svg>
);
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CS2_ITEMS } from "@/lib/cs2_items";
import {
  KarambitIcon,
  SportGlovesIcon,
  AK47Icon,
  DesertEagleIcon,
  UMP45Icon,
  SawedOffIcon,
  NegevIcon,
  TitanStickerIcon,
  CS2CharmIcon,
  AgentDarrylIcon,
} from "./CS2CategoryIconsRef";

type CS2Icon = ElementType<{ size?: number; className?: string }>;

// Item type configuration with CS2-themed icons
const ITEM_CATEGORIES: { id: string; label: string; icon: CS2Icon }[] = [
  { id: "knives", label: "Knives", icon: KarambitIcon },
  { id: "gloves", label: "Gloves", icon: SportGlovesIcon },
  { id: "rifles", label: "Rifles", icon: AK47Icon },
  { id: "pistols", label: "Pistols", icon: DesertEagleIcon },
  { id: "smgs", label: "SMGs", icon: UMP45Icon },
  { id: "shotguns", label: "Shotguns", icon: SawedOffIcon },
  { id: "machineguns", label: "Machineguns", icon: NegevIcon },
  { id: "stickers", label: "Stickers", icon: TitanStickerIcon },
  { id: "charm", label: "Charms", icon: CS2CharmIcon },
  { id: "agent", label: "Agents", icon: AgentDarrylIcon },
];


// Infer item category from its name
const KNIFE_NAMES = [
  "Karambit", "M9 Bayonet", "Bayonet", "Butterfly Knife", "Flip Knife",
  "Gut Knife", "Huntsman Knife", "Falchion Knife", "Bowie Knife",
  "Shadow Daggers", "Navaja Knife", "Stiletto Knife", "Talon Knife",
  "Ursus Knife", "Classic Knife", "Paracord Knife", "Survival Knife",
  "Nomad Knife", "Skeleton Knife", "Kukri Knife",
];
const GLOVE_NAMES = [
  "Sport Gloves", "Driver Gloves", "Hand Wraps", "Moto Gloves",
  "Specialist Gloves", "Hydra Gloves", "Bloodhound Gloves",
  "Broken Fang Gloves",
];
const RIFLE_NAMES = ["AK-47", "M4A4", "M4A1-S", "AUG", "SG 553", "FAMAS", "Galil AR", "AWP", "SSG 08", "SCAR-20", "G3SG1"];
const PISTOL_NAMES = ["Desert Eagle", "Glock-18", "USP-S", "P2000", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Dual Berettas", "R8 Revolver"];
const SMG_NAMES = ["MAC-10", "MP9", "MP7", "MP5-SD", "UMP-45", "PP-Bizon", "P90"];
const SHOTGUN_NAMES = ["Nova", "XM1014", "MAG-7", "Sawed-Off"];
const MG_NAMES = ["M249", "Negev"];

// Preferred weapon ordering within each category (first = highest priority)
const WEAPON_ORDER: Record<string, string[]> = {
  pistols: ["Desert Eagle", "USP-S", "Glock-18", "P2000", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Dual Berettas", "R8 Revolver"],
  rifles: ["AK-47", "M4A4", "M4A1-S", "AWP", "AUG", "SG 553", "FAMAS", "Galil AR", "SSG 08", "SCAR-20", "G3SG1"],
  smgs: ["MP9", "MP7", "MP5-SD", "MAC-10", "UMP-45", "PP-Bizon", "P90"],
  knives: ["Karambit", "M9 Bayonet", "Butterfly Knife", "Bayonet", "Flip Knife", "Gut Knife", "Huntsman Knife", "Falchion Knife", "Bowie Knife", "Shadow Daggers", "Navaja Knife", "Stiletto Knife", "Talon Knife", "Ursus Knife", "Classic Knife", "Paracord Knife", "Survival Knife", "Nomad Knife", "Skeleton Knife", "Kukri Knife"],
  gloves: ["Sport Gloves", "Driver Gloves", "Hand Wraps", "Moto Gloves", "Specialist Gloves", "Hydra Gloves", "Bloodhound Gloves", "Broken Fang Gloves"],
  shotguns: ["MAG-7", "Sawed-Off", "Nova", "XM1014"],
  machineguns: ["M249", "Negev"],
};

// Extract weapon name from full skin name (handles ★, StatTrak™, Souvenir prefixes)
const getWeaponName = (itemName: string): string => {
  const clean = itemName
    .replace(/^★ /, "")
    .replace(/^StatTrak™ /, "")
    .replace(/^Souvenir /, "")
    .trim();
  const pipeIdx = clean.indexOf(" | ");
  return pipeIdx !== -1 ? clean.slice(0, pipeIdx) : clean;
};

// Get sort index for a weapon within its category (lower = higher priority)
const getWeaponOrderIndex = (itemName: string, category: string): number => {
  const order = WEAPON_ORDER[category];
  if (!order) return 999;
  const weapon = getWeaponName(itemName);
  const idx = order.indexOf(weapon);
  return idx === -1 ? 998 : idx;
};

const AGENT_NAMES = [
  "Cmdr. Frank 'Wet Sox' Baroud | SEAL Frogman", "Arno The Overgrown | Guerrilla Warfare", "Lt. Commander Ricksaw | NSWC SEAL", "3rd Commando Company | KSK", "Jungle Rebel | Elite Crew", "Sergeant Bombson | SWAT", "'Medium Rare' Crasswater | Guerrilla Warfare", "'Blueberries' Buckshot | NSWC SEAL", "Trapper | Guerrilla Warfare", "Operator | FBI SWAT", "Sous-Lieutenant Medic | Gendarmerie Nationale", "Sir Bloody Loudmouth Darryl | The Professionals", "Primeiro Tenente | Brazilian 1st Battalion", "John 'Van Healen' Kask | SWAT", "Cmdr. Mae 'Dead Cold' Jamison | SWAT", "Street Soldier | Phoenix", "Little Kev | The Professionals", "Michael Syfers | FBI Sniper", "Special Agent Ava | FBI", "Trapper Aggressor | Guerrilla Warfare", "Crasswater The Forgotten | Guerrilla Warfare", "Chem-Haz Capitaine | Gendarmerie Nationale", "Elite Trapper Solman | Guerrilla Warfare", "Sir Bloody Miami Darryl | The Professionals", "The Elite Mr. Muhlik | Elite Crew", "B Squadron Officer | SAS", "Vypa Sista of the Revolution | Guerrilla Warfare", "Sir Bloody Darryl Royale | The Professionals", "Officer Jacques Beltram | Gendarmerie Nationale", "Bloody Darryl The Strapped | The Professionals", "Bio-Haz Specialist | SWAT", "Sir Bloody Skullhead Darryl | The Professionals", "Safecracker Voltzmann | The Professionals", "Lieutenant Rex Krikey | SEAL Frogman", "Number K | The Professionals", "Cmdr. Davida 'Goggles' Fernandez | SEAL Frogman", "Getaway Sally | The Professionals", "Chef d'Escadron Rouchard | Gendarmerie Nationale", "'The Doctor' Romanov | Sabre", "Seal Team 6 Soldier | NSWC SEAL", "Aspirant | Gendarmerie Nationale", "Sir Bloody Silent Darryl | The Professionals", "D Squadron Officer | NZSAS", "1st Lieutenant Farlow | SWAT", "Col. Mangos Dabisi | Guerrilla Warfare", "Chem-Haz Specialist | SWAT", "Blackwolf | Sabre", "Lieutenant 'Tree Hugger' Farlow | SWAT", "Maximus | Sabre", "Prof. Shahmat | Elite Crew", "'Two Times' McCoy | TACP Cavalry", "Markus Delrow | FBI HRT", "Buckshot | NSWC SEAL", "Slingshot | Phoenix", "Dragomir | Sabre", "Rezan The Ready | Sabre", "Soldier | Phoenix", "Ground Rebel | Elite Crew", "'Two Times' McCoy | USAF TACP", "Enforcer | Phoenix", "Rezan the Redshirt | Sabre", "Dragomir | Sabre Footsoldier", "Osiris | Elite Crew"
];

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const inferItemCategory = (name: string): string => {
  const cleanName = name.replace("★ ", "").replace("StatTrak™ ", "").replace("Souvenir ", "").trim();
  if (cleanName.startsWith("Sticker |")) return "stickers";
  if (cleanName.startsWith("Charm |")) return "charm";
  if (AGENT_NAMES.includes(cleanName) || cleanName.startsWith("Agent |")) return "agent";
  if (KNIFE_NAMES.some(k => cleanName.startsWith(k))) return "knives";
  if (GLOVE_NAMES.some(g => cleanName.startsWith(g))) return "gloves";
  if (RIFLE_NAMES.some(r => cleanName.startsWith(r))) return "rifles";
  if (PISTOL_NAMES.some(p => cleanName.startsWith(p))) return "pistols";
  if (SMG_NAMES.some(s => cleanName.startsWith(s))) return "smgs";
  if (SHOTGUN_NAMES.some(s => cleanName.startsWith(s))) return "shotguns";
  if (MG_NAMES.some(m => cleanName.startsWith(m))) return "machineguns";
  return "rifles"; // Default unknown weapons to rifles so they remain visible
};

// Mock skin/item data - in production this would come from an API
const MOCK_ITEMS = [
  { name: "AK-47 | Asiimov", type: "rifles" },
  { name: "AK-47 | Redline", type: "rifles" },
  { name: "M4A4 | Howl", type: "rifles" },
  { name: "AWP | Dragon Lore", type: "rifles" },
  { name: "AWP | Asiimov", type: "rifles" },
  { name: "Desert Eagle | Blaze", type: "pistols" },
  { name: "Glock-18 | Fade", type: "pistols" },
  { name: "USP-S | Kill Confirmed", type: "pistols" },
  { name: "P250 | Rekt", type: "pistols" },
  { name: "Karambit | Fade", type: "knives" },
  { name: "Butterfly Knife | Fade", type: "knives" },
  { name: "Sport Gloves | Pandora's Box", type: "gloves" },
  { name: "Driver Gloves | King Snake", type: "gloves" },
  { name: "Sticker | Titan (Holo) | Katowice 2014", type: "stickers" },
  { name: "Charm | 8 Ball IGL", type: "charm" },
  { name: "Agent | Commander Ricksaw | SWAT", type: "agent" },
  { name: "MP9 | Hypnotic", type: "smgs" },
  { name: "Nova | Antique", type: "shotguns" },
  { name: "M249 | Nebula Crusader", type: "machineguns" },
  { name: "Sticker | Katowice 2014", type: "stickers" },
  { name: "Charm | Ancient Guardian", type: "charm" },
  { name: "Agent | Elite Crew", type: "agent" },
];

interface ItemSearchComboboxProps {
  onItemSelect?: (item: string, phase?: string) => void;
  selectedItem?: string;
  onClearItem?: () => void;
  className?: string;
  fadeFilterEnabled?: boolean;
  blueGemFilterEnabled?: boolean;
  defaultCategory?: string | null;
}

export const ItemSearchCombobox = ({
  onItemSelect,
  selectedItem,
  onClearItem,
  className,
  fadeFilterEnabled = false,
  blueGemFilterEnabled = false,
  defaultCategory = null
}: ItemSearchComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(defaultCategory);
  const [selectedWeapon, setSelectedWeapon] = useState<string | null>(null);
  const [selectedPhaseTab, setSelectedPhaseTab] = useState<string>("All");
  const [showCategories, setShowCategories] = useState(false);

  const PHASE_TABS = ["All", "Phase 1", "Phase 2", "Phase 3", "Phase 4", "Ruby", "Sapphire", "Black Pearl", "Emerald"];

  // Fetch from API
  const [apiItems, setApiItems] = useState<{ name: string; type: string }[]>([]);

  const fullStaticItems = useMemo(
    () => [
      ...CS2_ITEMS.map((item) => ({ name: item.name, type: item.type || inferItemCategory(item.name) })),
      ...MOCK_ITEMS,
    ],
    []
  );

  const normalizedUniqueItems = useMemo(() => {
    const allItems = [...fullStaticItems, ...apiItems];
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.name, item])).values());

    return uniqueItems.map((item) => ({
      ...item,
      weaponName: getWeaponName(item.name),
      normalizedName: normalizeSearchText(item.name),
    }));
  }, [fullStaticItems, apiItems]);

  useEffect(() => {
    fetch("/api/data/skins")
      .then(res => res.json())
      .then((data: string[]) => {
        const items = data.map(name => ({ name, type: inferItemCategory(name) }));
        setApiItems(items);
      })
      .catch(err => console.error("Failed to fetch skins:", err));
  }, []);

  useEffect(() => {
    if (defaultCategory !== undefined) {
      setSelectedCategory(defaultCategory);
    }
  }, [defaultCategory]);

  // Clear search and reset state when item is deselected (e.g. after adding a target)
  useEffect(() => {
    if (!selectedItem) {
      setSearch("");
      setPendingDopplerSkin(null);
      setSelectedPhaseTab("All");
    }
  }, [selectedItem]);

  // Weapons available for the selected category (derived from actual API data)
  const weaponsForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    const allItems = [...fullStaticItems, ...apiItems];
    const categoryItems = allItems.filter(item => item.type === selectedCategory);
    const isFlat = ["stickers", "charm", "agent"].includes(selectedCategory);
    if (isFlat) return [];
    const weaponSet = new Set(categoryItems.map(item => getWeaponName(item.name)));
    const order = WEAPON_ORDER[selectedCategory] || [];
    return [...weaponSet].sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      const normA = idxA === -1 ? 998 : idxA;
      const normB = idxB === -1 ? 998 : idxB;
      if (normA !== normB) return normA - normB;
      return a.localeCompare(b);
    });
  }, [selectedCategory, apiItems]);

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory) return null;
    return ITEM_CATEGORIES.find(cat => cat.id === selectedCategory) || null;
  }, [selectedCategory]);

  // Determines if a skin name is a Doppler or Gamma Doppler
  const isDopplerSkin = (name: string) =>
    name.includes("Doppler") || name.includes("Gamma Doppler");

  const filteredItems = useMemo(() => {
    let items = normalizedUniqueItems;

    // Filter by skin type (Fade or Blue Gem)
    if (fadeFilterEnabled) {
      items = items.filter(item => item.name.includes('Fade'));
    }

    if (blueGemFilterEnabled) {
      items = items.filter(item => item.name.includes('Case Hardened'));
    }

    // Filter by category if selected
    if (selectedCategory) {
      items = items.filter(item => item.type === selectedCategory);
    }

    // Filter by specific weapon if drill-down is active
    if (selectedWeapon) {
      items = items.filter(item => item.weaponName === selectedWeapon);
    }

    // Filter by Phase tabs for Knives — removed (now handled at skin level)

    // Filter by search term
    if (deferredSearch.trim()) {
      const searchTerms = deferredSearch.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      items = items.filter(item => {
        return searchTerms.every(term => item.normalizedName.includes(term));
      });

      const fuzzySearch = normalizeSearchText(deferredSearch);
      items.sort((a, b) => {
        const fuzzyNameA = a.normalizedName;
        const fuzzyNameB = b.normalizedName;
        if (fuzzyNameA === fuzzySearch) return -1;
        if (fuzzyNameB === fuzzySearch) return 1;
        const aStartsWith = fuzzyNameA.startsWith(fuzzySearch);
        const bStartsWith = fuzzyNameB.startsWith(fuzzySearch);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Alphabetical within the selected weapon
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Cap rendered items to keep typing smooth with large datasets.
    return items.slice(0, 150);
  }, [deferredSearch, selectedCategory, selectedWeapon, fadeFilterEnabled, blueGemFilterEnabled, selectedPhaseTab, normalizedUniqueItems]);

  const [pendingDopplerSkin, setPendingDopplerSkin] = useState<string | null>(null);

  const handleItemClick = (itemName: string) => {
    // If phase slider is active (pendingDopplerSkin), clicking a skin changes the pending skin
    if (pendingDopplerSkin !== null) {
      // Change the pending skin but don't apply yet
      if (isDopplerSkin(itemName)) {
        setPendingDopplerSkin(itemName);
        setSelectedPhaseTab("All"); // reset phase when changing skin
        return;
      }
      // If clicking non-Doppler while phase slider is active, apply it directly
      let selectedItemData = MOCK_ITEMS.find(item => item.name === itemName);
      let itemCategory = selectedItemData?.type || null;
      if (!selectedItemData) {
        const apiItem = apiItems.find(item => item.name === itemName);
        itemCategory = apiItem?.type || null;
      }
      onItemSelect?.(itemName, undefined);
      setSearch("");
      setSelectedCategory(null);
      setSelectedWeapon(null);
      setPendingDopplerSkin(null);
      setSelectedPhaseTab("All");
      setShowCategories(false);
      setOpen(false);
      return;
    }
    // If the skin is Doppler/Gamma Doppler, activate phase slider but don't change search text
    if (isDopplerSkin(itemName)) {
      setPendingDopplerSkin(itemName);
      setSelectedPhaseTab("All");
      return;
    }
    // Normal skin selection
    let selectedItemData = MOCK_ITEMS.find(item => item.name === itemName);
    let itemCategory = selectedItemData?.type || null;

    // If not found in MOCK_ITEMS, try to infer category from API items
    if (!selectedItemData) {
      const apiItem = apiItems.find(item => item.name === itemName);
      itemCategory = apiItem?.type || null;
    }

    // Special handling for stickers - ensure they get categorized correctly
    if (itemName.toLowerCase().includes('sticker |')) {
      itemCategory = 'stickers';
    } else if (itemName.toLowerCase().includes('charm |')) {
      itemCategory = 'charm';
    } else if (itemName.toLowerCase().includes('agent |')) {
      itemCategory = 'agent';
    }

    onItemSelect?.(itemName, undefined);
    setSearch("");
    setSelectedCategory(null); // Reset category so re-clicking works correctly
    setSelectedWeapon(null);
    setPendingDopplerSkin(null);
    setShowCategories(false);
    setOpen(false);
  };

  const handlePhaseSelect = (phase: string) => {
    if (!pendingDopplerSkin) return;
    const itemName = pendingDopplerSkin;
    let selectedItemData = MOCK_ITEMS.find(item => item.name === itemName);
    let itemCategory = selectedItemData?.type || null;
    if (!selectedItemData) {
      const apiItem = apiItems.find(item => item.name === itemName);
      itemCategory = apiItem?.type || null;
    }
    onItemSelect?.(itemName, phase);
    setSearch("");
    // Reset phase selection but keep component open for further selections
    setPendingDopplerSkin(null);
    setSelectedPhaseTab("All");
    // Reset category and weapon after phase selection so it doesn't persist
    setSelectedCategory(null);
    setSelectedWeapon(null);
    // Keep the component open and search active
    setOpen(true);
  };

  const handleDopplerItemClick = (itemName: string) => {
    // If the skin is Doppler/Gamma Doppler, activate phase slider but don't close
    if (isDopplerSkin(itemName)) {
      setPendingDopplerSkin(itemName);
      setSelectedPhaseTab("All"); // no pre-selection
      return;
    }
    // Normal skin selection
    let selectedItemData = MOCK_ITEMS.find(item => item.name === itemName);
    let itemCategory = selectedItemData?.type || null;

    // If not found in MOCK_ITEMS, try to infer category from API items
    if (!selectedItemData) {
      const apiItem = apiItems.find(item => item.name === itemName);
      itemCategory = apiItem?.type || null;
    }

    // Special handling for stickers - ensure they get categorized correctly
    if (itemName.toLowerCase().includes('sticker |')) {
      itemCategory = 'stickers';
    } else if (itemName.toLowerCase().includes('charm |')) {
      itemCategory = 'charm';
    } else if (itemName.toLowerCase().includes('agent |')) {
      itemCategory = 'agent';
    }

    onItemSelect?.(itemName, undefined);
    setSearch("");
    setSelectedCategory(null); // Reset category so re-clicking works correctly
    setSelectedWeapon(null);
    setPendingDopplerSkin(null);
    setShowCategories(false);
    setOpen(false);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
      setSelectedWeapon(null);
      setSelectedPhaseTab("All");
    } else {
      setSelectedCategory(categoryId);
      setSelectedWeapon(null);
      setSelectedPhaseTab("All");
      setShowCategories(false);
      setOpen(true);
    }
  };

  const handleWeaponClick = (weaponName: string) => {
    setSelectedWeapon(weaponName);
    setSearch("");
    setOpen(true);
  };

  const handleSelectAllWeapon = () => {
    if (!selectedWeapon) return;
    onItemSelect?.(selectedWeapon);
    setSearch("");
    setSelectedWeapon(null);
    setShowCategories(false);
    setOpen(false);
  };

  const handleSelectAllPhase = () => {
    if (selectedPhaseTab === "All") return;
    onItemSelect?.("", selectedPhaseTab);
    setSearch("");
    setShowCategories(false);
    setOpen(false);
  };

  const handleBackToWeapons = () => {
    setSelectedWeapon(null);
    setSelectedPhaseTab("All");
    setSearch("");
    setOpen(true);
  };

  const handleClear = () => {
    onClearItem?.();
    setSearch("");
    // Also clear pending Doppler skin when clearing
    setPendingDopplerSkin(null);
    setSelectedPhaseTab("All");
    // Don't clear category - only clear search content
  };

  const toggleCategories = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const newShowCategories = !showCategories;
    setShowCategories(newShowCategories);

    if (newShowCategories) {
      setOpen(true);
    } else if (!search.trim() && !selectedCategory) {
      setOpen(false);
    }
  };

  // Show selected item in input or search text
  const displayValue = selectedItem || search;

  // Determine which view to show in the popover
  const showWeaponGrid = !showCategories && !!selectedCategory && !selectedWeapon && !search.trim() && !pendingDopplerSkin && weaponsForCategory.length > 0;
  // Skin list stays visible even when phase slider is active
  const showSkinList = !!selectedWeapon || !!search.trim();
  // Phase slider shows when a Doppler skin is pending — either from drill-down or text search
  const showPhaseSlider = !!pendingDopplerSkin;

  // Only show popover when there's content to display
  const hasPopoverContent = showCategories || showWeaponGrid || showSkinList || (!!selectedCategory && ["stickers", "charm", "agent"].includes(selectedCategory));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open && hasPopoverContent} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search for items..."
              value={displayValue}
              onChange={(e) => {
                setSearch(e.target.value);
                if (selectedItem) {
                  onClearItem?.();
                }
                if (e.target.value.trim()) {
                  setOpen(true);
                }
              }}
              onFocus={() => {
                // Hide categories grid when focusing on search input
                setShowCategories(false);
                if (search.trim() || selectedCategory) {
                  setOpen(true);
                }
              }}
              className={cn(
                "pl-10 pr-8 bg-input border-border",
                selectedItem && "text-primary border-primary/50"
              )}
            />
            {selectedItem && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <Eraser className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[382px] p-0 bg-popover border-border/50 z-50"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Level 1 — Category Grid */}
          {showCategories && (
            <div className="p-2 border-b border-border/30">
              <div className="grid grid-cols-5 gap-1.5">
                {ITEM_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className={cn(
                        "flex flex-col items-center justify-end h-full gap-1 p-2 rounded-lg transition-all",
                        "hover:bg-accent/30 hover:scale-105",
                        selectedCategory === category.id
                          ? "bg-primary/20 ring-1 ring-primary/50 text-primary"
                          : "bg-background/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex-1 flex items-center justify-center">
                        <IconComponent size={18} className="block" aria-hidden="true" />
                      </div>
                      <span className="text-[10px] font-medium leading-tight text-center">
                        {category.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phase Slider — shown as top bar after clicking a Doppler/Gamma Doppler skin */}
          {showPhaseSlider && (
            <div className="px-1.5 pt-1 border-b border-border/20 mb-1 overflow-x-auto custom-scrollbar flex gap-1 pb-1">
                {/* All — select without any phase */}
                <button
                  onClick={() => {
                    // select skin directly without phase
                    const itemName = pendingDopplerSkin!;
                    const allI = [...MOCK_ITEMS, ...apiItems];
                    const found = allI.find(i => i.name === itemName);
                    onItemSelect?.(itemName, undefined);
                    // Reset phase selection but keep component open for further selections
                    setPendingDopplerSkin(null);
                    setSelectedPhaseTab("All");
                    // Keep the component open and search active
                    setOpen(true);
                  }}
                  className="px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition-colors bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  All
                </button>
                {PHASE_TABS.filter(t => t !== "All").map(tab => {
                  const displayLabel = tab.replace("Phase ", "P. ");
                  const isGammaDoppler = pendingDopplerSkin?.includes("Gamma Doppler");
                  // Emerald only for Gamma Doppler
                  if (tab === "Emerald" && !isGammaDoppler) return null;
                  // Remove Ruby, Sapphire, Black Pearl for Gamma Doppler
                  if (isGammaDoppler && ["Ruby", "Sapphire", "Black Pearl"].includes(tab)) return null;
                  return (
                    <button
                      key={tab}
                      onClick={() => handlePhaseSelect(tab)}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap transition-colors",
                        selectedPhaseTab === tab
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      {displayLabel}
                    </button>
                  );
                })}
              </div>
          )}

          {/* Level 2 — Weapon Selection Grid */}
          {showWeaponGrid && (
            <div className="p-1">
              {/* Header: back button + category name */}
              <div className="flex items-center gap-1 px-1.5 pt-1.5 pb-1 border-b border-border/20 mb-1.5">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedWeapon(null);
                    setShowCategories(true);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  Back
                </button>
                <span className="text-xs font-medium text-foreground/80 flex-1 truncate px-1">
                  {selectedCategoryData?.label || selectedCategory}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                {weaponsForCategory.map((weapon) => (
                  <button
                    key={weapon}
                    onClick={() => handleWeaponClick(weapon)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all text-left",
                      "bg-background/40 border border-border/30 hover:bg-accent/20 hover:border-primary/30 hover:text-foreground",
                      "text-foreground/80"
                    )}
                  >
                    <span className="truncate">{weapon}</span>
                    <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level 3 — Skin List (after weapon selected or search active) */}
          {showSkinList && (
            <div>
              {/* Header: back button + weapon name + all-skins button */}
              {selectedWeapon && !search.trim() && (
                <div className="flex items-center gap-1 px-1.5 pt-1.5 pb-1 border-b border-border/20">
                  <button
                    onClick={handleBackToWeapons}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3 rotate-180" />
                    Back
                  </button>
                  <span className="text-xs font-medium text-foreground/80 flex-1 truncate px-1">
                    {selectedWeapon}
                  </span>
                  <button
                    onClick={handleSelectAllWeapon}
                    title={`Search all ${selectedWeapon} skins`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors flex-shrink-0"
                  >
                    <Search className="h-3 w-3" />
                    All skins
                  </button>
                </div>
              )}
              {/* Skin list */}
              <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                {filteredItems.length > 0 ? (
                  <div className="p-1">
                    {filteredItems.map((item, index) => {
                      const pipeIdx = item.name.indexOf(" | ");
                      const weaponPart = pipeIdx !== -1 ? item.name.slice(0, pipeIdx) : "";
                      const skinPart = pipeIdx !== -1 ? item.name.slice(pipeIdx + 3) : item.name;
                      const cleanWeapon = getWeaponName(item.name);
                      const specialPrefix = weaponPart.replace(cleanWeapon, "").trim();
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            if (pendingDopplerSkin === item.name) {
                              // Если это выбранный Doppler скин - отменить выбор
                              setPendingDopplerSkin(null);
                              setSelectedPhaseTab("All");
                            } else {
                              // Иначе - выбрать скин
                              handleItemClick(item.name);
                            }
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors flex items-center justify-between",
                            pendingDopplerSkin === item.name 
                              ? "bg-primary/20 border border-primary/30 text-primary" 
                              : "text-foreground/90 hover:bg-accent/20"
                          )}
                        >
                          <span>
                            {selectedWeapon ? (
                              // When weapon is selected: show only skin part + special prefix
                              <>
                                {specialPrefix && (
                                  <span className="text-orange-400/80 text-xs mr-1">{specialPrefix}</span>
                                )}
                                {skinPart}
                              </>
                            ) : (
                              // During search: show full name
                              item.name
                            )}
                          </span>
                          {pendingDopplerSkin === item.name && (
                            <X className="h-3 w-3 text-primary/70 hover:text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No items found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flat list for categories without weapon structure (stickers, charms, agents) */}
          {!showWeaponGrid && !showSkinList && selectedCategory && ["stickers", "charm", "agent"].includes(selectedCategory) && (
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {/* Header: back button + category name */}
              <div className="flex items-center gap-1 px-1.5 pt-1.5 pb-1 border-b border-border/20 mb-1.5">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedWeapon(null);
                    setShowCategories(true);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  Back
                </button>
                <span className="text-xs font-medium text-foreground/80 flex-1 truncate px-1">
                  {selectedCategoryData?.label || selectedCategory}
                </span>
              </div>
              {filteredItems.length > 0 ? (
                <div className="p-1">
                  {filteredItems.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleItemClick(item.name)}
                      className="w-full text-left px-2 py-1.5 text-sm text-foreground/90 hover:bg-accent/20 rounded-md transition-colors"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-sm text-muted-foreground">No items found</div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Category Toggle Button - shows selected category icon or grid icon */}
      {(() => {
        const selectedCategoryData = selectedCategory
          ? ITEM_CATEGORIES.find(c => c.id === selectedCategory)
          : null;
        const CategoryIcon = selectedCategoryData?.icon;

        return (
          <div className="flex items-center gap-1">
            <button
              onClick={toggleCategories}
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-md border transition-all flex-shrink-0",
                selectedCategory
                  ? "text-primary bg-primary/20 border-primary/50"
                  : showCategories
                    ? "text-primary bg-primary/20 border-primary/50"
                    : "text-muted-foreground bg-input border-border hover:text-foreground hover:bg-accent/20"
              )}
              title={selectedCategoryData ? `${selectedCategoryData.label} (click to change)` : "Show categories"}
            >
              {CategoryIcon ? (
                <CategoryIcon size={20} className="block" aria-hidden="true" />
              ) : (
                <CS2CategoriesIcon size={20} />
              )}
            </button>

            {/* Clear category/weapon button */}
            {(selectedCategory || selectedWeapon) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategory(null);
                  setSelectedWeapon(null);
                  setShowCategories(false);
                  setSearch("");
                  onClearItem?.();
                }}
                className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};