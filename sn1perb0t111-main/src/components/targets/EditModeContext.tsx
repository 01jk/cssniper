import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FilterData } from './TargetFilterPanel';

export type FilterSection =
  | 'item'
  | 'price'
  | 'wear'
  | 'rarity'
  | 'special'
  | 'charm'
  | 'stickers'
  | 'patterns'
  | 'paintSeed'
  | 'custom'
  | 'discount'
  | 'fade'
  | 'blueGem'
  | 'discountOverpay'
  | 'stickerOverpay'
  | 'stickersPricePercent';

interface EditModeContextType {
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  editingTargetId: number | null;
  setEditingTargetId: (id: number | null) => void;
  highlightedSection: FilterSection | null;
  setHighlightedSection: (section: FilterSection | null) => void;
  navigateToSection: (section: FilterSection, targetId: number) => void;
  pendingFilterData: Partial<FilterData> | null;
  setPendingFilterData: (data: Partial<FilterData> | null) => void;
  flashSection: FilterSection | null;
  clearFlash: () => void;
  onExitEditMode: (() => void) | null;
  setOnExitEditMode: (callback: (() => void) | null) => void;
}

const EditModeContext = createContext<EditModeContextType | null>(null);

export const EditModeProvider = ({ children }: { children: ReactNode }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<FilterSection | null>(null);
  const [pendingFilterData, setPendingFilterData] = useState<Partial<FilterData> | null>(null);
  const [flashSection, setFlashSection] = useState<FilterSection | null>(null);
  const [onExitEditMode, setOnExitEditModeCallback] = useState<(() => void) | null>(null);

  const navigateToSection = useCallback((section: FilterSection, targetId: number) => {
    setEditingTargetId(targetId);
    setHighlightedSection(section);
    setFlashSection(section);

    // Clear flash after animation (longer duration)
    setTimeout(() => {
      setFlashSection(null);
    }, 1500);
  }, []);

  const clearFlash = useCallback(() => {
    setFlashSection(null);
  }, []);

  const setOnExitEditMode = useCallback((callback: (() => void) | null) => {
    setOnExitEditModeCallback(() => callback);
  }, []);

  return (
    <EditModeContext.Provider value={{
      isEditMode,
      setIsEditMode,
      editingTargetId,
      setEditingTargetId,
      highlightedSection,
      setHighlightedSection,
      navigateToSection,
      pendingFilterData,
      setPendingFilterData,
      flashSection,
      clearFlash,
      onExitEditMode,
      setOnExitEditMode
    }}>
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = () => {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider');
  }
  return context;
};
