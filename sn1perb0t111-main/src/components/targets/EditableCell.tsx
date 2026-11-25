import { ReactNode, useRef, useEffect } from "react";
import { useEditMode, FilterSection } from "./EditModeContext";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  children: ReactNode;
  section: FilterSection;
  targetId: number;
  className?: string;
  disabled?: boolean;
}

export const EditableCell = ({ 
  children, 
  section, 
  targetId, 
  className = "",
  disabled = false 
}: EditableCellProps) => {
  const { isEditMode, editingTargetId, navigateToSection, flashSection } = useEditMode();
  const cellRef = useRef<HTMLDivElement>(null);
  
  const isCurrentlyEditing = editingTargetId === targetId;
  const isFlashing = flashSection === section && isCurrentlyEditing;
  
  // Force animation restart by removing and re-adding the class
  useEffect(() => {
    if (isFlashing && cellRef.current) {
      const el = cellRef.current;
      el.classList.remove('edit-flash');
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add('edit-flash');
    }
  }, [isFlashing, flashSection]);
  
  const handleClick = () => {
    if (!isEditMode || disabled) return;
    navigateToSection(section, targetId);
  };
  
  if (!isEditMode) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <div
      ref={cellRef}
      onClick={handleClick}
      className={cn(
        className,
        !disabled && "edit-mode-cell",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      title={disabled ? "This filter cannot be edited" : `Click to edit ${section}`}
    >
      {children}
    </div>
  );
};
