import { Link } from "@tanstack/react-router";
import { Terminal, LucideIcon } from "lucide-react";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { StudioNav } from "~/components/studio-nav";

interface AppHeaderProps {
  title?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  showNav?: boolean;
}

export function AppHeader({
  title = "SQL Query Studio",
  icon: Icon = Terminal,
  iconClassName = "bg-amber-500",
  showNav = true,
}: AppHeaderProps) {
  return (
    <header className="bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left side: Title + Navigation */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconClassName} group-hover:scale-105 transition-transform shadow-md`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-on-surface">
              {title}
            </h1>
          </Link>

          {showNav && (
            <>
              <div className="w-px h-5 bg-outline-variant/50" />
              <StudioNav showBackToHome={false} />
            </>
          )}
        </div>

        {/* Right side: Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
