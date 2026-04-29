/**
 * Compact Filter Dropdown
 *
 * A styled dropdown for toolbar filters with icon support and compact sizing.
 */

import { useState, useRef, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useClickOutside, useKeyboardShortcut } from "~/lib/hooks";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  placeholder?: string;
  icon?: React.ElementType;
  accentColor?: "cyan" | "emerald" | "amber" | "violet" | "blue";
  className?: string;
}

export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder = "All",
  icon: Icon,
  accentColor = "cyan",
  className = "",
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const accentColors = {
    cyan: {
      focus: "border-cyan-500/50 ring-cyan-500/20",
      selected: "bg-cyan-500/15 text-cyan-400",
      hover: "hover:bg-cyan-500/10",
      icon: "text-cyan-400/60",
    },
    emerald: {
      focus: "border-emerald-500/50 ring-emerald-500/20",
      selected: "bg-emerald-500/15 text-emerald-400",
      hover: "hover:bg-emerald-500/10",
      icon: "text-emerald-400/60",
    },
    amber: {
      focus: "border-amber-500/50 ring-amber-500/20",
      selected: "bg-amber-500/15 text-amber-400",
      hover: "hover:bg-amber-500/10",
      icon: "text-amber-400/60",
    },
    violet: {
      focus: "border-violet-500/50 ring-violet-500/20",
      selected: "bg-violet-500/15 text-violet-400",
      hover: "hover:bg-violet-500/10",
      icon: "text-violet-400/60",
    },
    blue: {
      focus: "border-blue-500/50 ring-blue-500/20",
      selected: "bg-blue-500/15 text-blue-400",
      hover: "hover:bg-blue-500/10",
      icon: "text-blue-400/60",
    },
  };

  const colors = accentColors[accentColor];

  const closeDropdown = useCallback(() => setIsOpen(false), []);

  useClickOutside(containerRef, closeDropdown, isOpen);
  useKeyboardShortcut("Escape", closeDropdown, { enabled: isOpen });

  const handleSelect = (optionValue: string) => {
    onChange(optionValue === "" ? null : optionValue);
    setIsOpen(false);
  };

  // Include "All" option at the beginning
  const allOptions: FilterOption[] = [
    { value: "", label: placeholder },
    ...options,
  ];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-2.5 py-2
          bg-surface-container border border-outline-variant/50 rounded-lg
          text-xs transition-all duration-200 cursor-pointer
          ${isOpen ? `${colors.focus} ring-1` : "hover:border-outline-variant"}
        `}
      >
        {Icon && <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />}
        <span className={selectedOption ? "text-on-surface" : "text-on-surface-variant"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-on-surface-variant/60 transition-transform duration-200 ml-0.5 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] min-w-full mt-1 py-1 bg-surface-container-high border border-outline-variant/50 rounded-lg shadow-xl shadow-black/30 max-h-60 overflow-auto">
          {allOptions.map((option) => {
            const isSelected = (option.value === "" && value === null) || option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full px-3 py-1.5 text-xs text-left
                  flex items-center justify-between gap-3
                  transition-colors duration-150 whitespace-nowrap
                  ${isSelected ? colors.selected : `text-on-surface ${colors.hover}`}
                `}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
