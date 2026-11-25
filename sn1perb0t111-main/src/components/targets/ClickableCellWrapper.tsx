import { ReactNode } from "react";
import { useEditMode, FilterSection } from "./EditModeContext";
import { cn } from "@/lib/utils";

interface ClickableCellWrapperProps {
  children: ReactNode;
  section: FilterSection;
  targetId: number;
  onCellClick: (targetId: number, section: FilterSection) => void;
  className?: string;
}

export const ClickableCellWrapper = ({ 
  children, 
  section, 
  targetId, 
  onCellClick,
  className = ""
}: ClickableCellWrapperProps) => {
  const { isEditMode, editingTargetId, flashSection } = useEditMode();
  
  const isCurrentlyEditing = editingTargetId === targetId;
  const isFlashing = flashSection === section && isCurrentlyEditing;
  
  const handleClick = () => {
    if (!isEditMode) return;
    onCellClick(targetId, section);
  };
  
  if (!isEditMode) {
    return <>{children}</>;
  }
  
  return (
    <div
      onClick={handleClick}
      className={cn(
        "edit-mode-cell",
        isFlashing && "edit-flash",
        className
      )}
    >
      {children}
    </div>
  );
};
