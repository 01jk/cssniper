import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

// Weapon type categories
export type WeaponCategory = 
  | "all"
  | "rifle" 
  | "pistol" 
  | "smg" 
  | "shotgun"
  | "machinegun"
  | "knife" 
  | "gloves";

// Skin type for pattern-specific features
export type SkinType = 
  | "generic"
  | "case_hardened"
  | "fade"
  | "marble_fade"
  | "doppler"
  | "crimson_web";

interface WeaponContextState {
  weaponCategory: WeaponCategory;
  skinType: SkinType;
  skinName: string;
}

interface WeaponContextActions {
  setWeaponCategory: (category: WeaponCategory) => void;
  setSkinType: (type: SkinType) => void;
  setSkinName: (name: string) => void;
}

interface WeaponFeatureFlags {
  // Tab visibility
  showStickersTab: boolean;
  showPatternsTab: boolean;
  showCharmsSection: boolean;
  
  // Pattern-specific features
  showBlueGemFilter: boolean;
  showFadeFilter: boolean;
  showPhaseSelector: boolean;
  showWebPatternFilter: boolean;
  
  // Sticker slot count
  maxStickerSlots: number;
  
  // Explanations for disabled features
  disabledReasons: {
    stickers?: string;
    charms?: string;
    patterns?: string;
    blueGem?: string;
    fade?: string;
  };
}

interface WeaponContextType extends WeaponContextState, WeaponContextActions {
  features: WeaponFeatureFlags;
}

const WeaponContext = createContext<WeaponContextType | undefined>(undefined);

// Auto-detect skin type from skin name
const detectSkinType = (skinName: string): SkinType => {
  const lowerName = skinName.toLowerCase();
  
  if (lowerName.includes("case hardened")) return "case_hardened";
  if (lowerName.includes("fade") && !lowerName.includes("marble")) return "fade";
  if (lowerName.includes("marble fade")) return "marble_fade";
  if (lowerName.includes("doppler") || lowerName.includes("gamma doppler")) return "doppler";
  if (lowerName.includes("crimson web")) return "crimson_web";
  
  return "generic";
};

// Calculate feature flags based on weapon category and skin type
const calculateFeatures = (category: WeaponCategory, skinType: SkinType): WeaponFeatureFlags => {
  const isKnife = category === "knife";
  const isGloves = category === "gloves";
  const isGun = !isKnife && !isGloves && category !== "all";
  
  return {
    // Tab visibility
    showStickersTab: !isKnife && !isGloves,
    showPatternsTab: true, // All weapons including gloves have patterns
    showCharmsSection: !isKnife && !isGloves,
    
    // Pattern-specific features (only show when relevant)
    showBlueGemFilter: skinType === "case_hardened",
    showFadeFilter: skinType === "fade" || skinType === "marble_fade",
    showPhaseSelector: skinType === "doppler",
    showWebPatternFilter: skinType === "crimson_web",
    
    // Sticker slots
    maxStickerSlots: isKnife || isGloves ? 0 : 5,
    
    // Disabled reasons for tooltips
    disabledReasons: {
      stickers: isKnife 
        ? "Knives do not support stickers" 
        : isGloves 
          ? "Gloves do not support stickers" 
          : undefined,
      charms: isKnife 
        ? "Knives do not support charms" 
        : isGloves 
          ? "Gloves do not support charms" 
          : undefined,
      patterns: isGloves 
        ? "Gloves do not have pattern variations" 
        : undefined,
      blueGem: skinType !== "case_hardened" 
        ? "Blue Gem filter only applies to Case Hardened skins" 
        : undefined,
      fade: skinType !== "fade" && skinType !== "marble_fade" 
        ? "Fade filter only applies to Fade and Marble Fade skins" 
        : undefined,
    },
  };
};

export const WeaponContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WeaponContextState>({
    weaponCategory: "all",
    skinType: "generic",
    skinName: "",
  });

  const setWeaponCategory = useCallback((category: WeaponCategory) => {
    setState(prev => ({ ...prev, weaponCategory: category }));
  }, []);

  const setSkinType = useCallback((type: SkinType) => {
    setState(prev => ({ ...prev, skinType: type }));
  }, []);

  const setSkinName = useCallback((name: string) => {
    const detectedType = detectSkinType(name);
    setState(prev => ({ 
      ...prev, 
      skinName: name,
      skinType: detectedType 
    }));
  }, []);

  const features = useMemo(
    () => calculateFeatures(state.weaponCategory, state.skinType),
    [state.weaponCategory, state.skinType]
  );

  const value = useMemo(() => ({
    ...state,
    setWeaponCategory,
    setSkinType,
    setSkinName,
    features,
  }), [state, setWeaponCategory, setSkinType, setSkinName, features]);

  return (
    <WeaponContext.Provider value={value}>
      {children}
    </WeaponContext.Provider>
  );
};

export const useWeaponContext = () => {
  const context = useContext(WeaponContext);
  if (!context) {
    throw new Error("useWeaponContext must be used within WeaponContextProvider");
  }
  return context;
};

// Weapon category options for dropdown
export const WEAPON_CATEGORIES: { value: WeaponCategory; label: string }[] = [
  { value: "all", label: "All Weapons" },
  { value: "rifle", label: "Rifles" },
  { value: "pistol", label: "Pistols" },
  { value: "smg", label: "SMGs" },
  { value: "shotgun", label: "Shotguns" },
  { value: "machinegun", label: "Machine Guns" },
  { value: "knife", label: "Knives" },
  { value: "gloves", label: "Gloves" },
];
