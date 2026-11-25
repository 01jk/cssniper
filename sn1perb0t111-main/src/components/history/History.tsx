import { History as HistoryIcon } from "lucide-react";

export const History = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-muted-foreground">
        <HistoryIcon className="h-16 w-16 mx-auto mb-4 opacity-50 text-primary" />
        <h2 className="text-2xl font-bold mb-2 text-foreground">History</h2>
        <p className="text-muted-foreground">History content coming soon...</p>
      </div>
    </div>
  );
};
