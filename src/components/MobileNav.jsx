import { Menu, HardHat } from "lucide-react";
import NotificationBell from "./notifications/NotificationBell";

export default function MobileNav({ onMenuClick }) {
  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <HardHat className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-heading font-bold text-sm">Costa do Sol</span>
      </div>
      <NotificationBell />
    </div>
  );
}