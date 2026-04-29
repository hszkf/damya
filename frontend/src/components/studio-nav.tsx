import { Link, useLocation } from "@tanstack/react-router";
import {
  Terminal,
  HardDrive,
  BarChart3,
  ChevronLeft,
  LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  colour: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/sql",
    label: "Redshift Query",
    shortLabel: "SQL",
    icon: Terminal,
    colour: "amber",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Charts",
    icon: BarChart3,
    colour: "violet",
  },
  {
    href: "/storage",
    label: "Storage",
    shortLabel: "Storage",
    icon: HardDrive,
    colour: "orange",
  },
];

const colourClasses: Record<string, { active: string; inactive: string; icon: string; disabled: string }> = {
  amber: {
    active: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    inactive: "text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10",
    icon: "text-amber-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
  emerald: {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    inactive: "text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10",
    icon: "text-emerald-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
  orange: {
    active: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    inactive: "text-neutral-400 hover:text-orange-400 hover:bg-orange-500/10",
    icon: "text-orange-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
  violet: {
    active: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    inactive: "text-neutral-400 hover:text-violet-400 hover:bg-violet-500/10",
    icon: "text-violet-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
  cyan: {
    active: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    inactive: "text-neutral-400 hover:text-cyan-400 hover:bg-cyan-500/10",
    icon: "text-cyan-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
  rose: {
    active: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    inactive: "text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10",
    icon: "text-rose-400",
    disabled: "text-neutral-600 cursor-not-allowed",
  },
};

interface StudioNavProps {
  currentPage?: string;
  showBackToHome?: boolean;
  className?: string;
  rightSlot?: React.ReactNode;
}

export function StudioNav({ showBackToHome = true, className = "", rightSlot }: StudioNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) => {
    if (href === "/sql") {
      return pathname === "/sql";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col">
      {/* Drag region for macOS traffic lights */}
      <div className="h-11 w-full" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />
      <nav className={`flex items-center gap-1 -mt-1 ${className}`}>
        {showBackToHome && (
          <>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 text-neutral-500 hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-800/50"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Home</span>
            </Link>
            <div className="w-px h-6 bg-neutral-800 mx-1" />
          </>
        )}

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {navItems.map((item) => {
            const active = isActive(item.href);
            const colours = colourClasses[item.colour];
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    ${colours.disabled} opacity-50
                  `}
                  title={`${item.label} (Coming Soon)`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.shortLabel}</span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${active ? `${colours.active} border` : colours.inactive}
                `}
              >
                <Icon className={`w-4 h-4 ${active ? colours.icon : ""}`} />
                <span className="hidden md:inline">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
        {rightSlot && (
          <div className="ml-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {rightSlot}
          </div>
        )}
      </nav>
    </div>
  );
}

// Compact version for tight spaces
export function StudioNavCompact({ className = "" }: { className?: string }) {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) => {
    if (href === "/sql") {
      return pathname === "/sql";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className={`flex items-center gap-0.5 ${className}`}>
      {navItems.map((item) => {
        const active = isActive(item.href);
        const colours = colourClasses[item.colour];
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className={`
                flex items-center justify-center p-2 rounded-lg
                ${colours.disabled} opacity-50
              `}
              title={`${item.label} (Coming Soon)`}
            >
              <Icon className="w-4 h-4" />
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center justify-center p-2 rounded-lg transition-all duration-200
              ${active ? `${colours.active} border` : colours.inactive}
            `}
            title={item.label}
          >
            <Icon className={`w-4 h-4 ${active ? colours.icon : ""}`} />
          </Link>
        );
      })}
    </nav>
  );
}
