/**
 * Column Header Filter Dropdown
 *
 * A compact filter dropdown designed for table column headers.
 */

import { useState, useRef, useCallback } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { useClickOutside, useKeyboardShortcut } from "~/lib/hooks";

interface FilterOption {
  value: string;
  label: string;
}

interface ColumnFilterProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  accentColor?: "cyan" | "emerald" | "amber" | "violet" | "blue";
}

export function ColumnFilter({
  label,
  value,
  onChange,
  options,
  accentColor = "cyan",
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const hasFilter = value !== null;

  const accentColors = {
    cyan: {
      active: "text-cyan-400",
      selected: "bg-cyan-500/15 text-cyan-400",
      hover: "hover:bg-cyan-500/10",
      dot: "bg-cyan-400",
    },
    emerald: {
      active: "text-emerald-400",
      selected: "bg-emerald-500/15 text-emerald-400",
      hover: "hover:bg-emerald-500/10",
      dot: "bg-emerald-400",
    },
    amber: {
      active: "text-amber-400",
      selected: "bg-amber-500/15 text-amber-400",
      hover: "hover:bg-amber-500/10",
      dot: "bg-amber-400",
    },
    violet: {
      active: "text-violet-400",
      selected: "bg-violet-500/15 text-violet-400",
      hover: "hover:bg-violet-500/10",
      dot: "bg-violet-400",
    },
    blue: {
      active: "text-blue-400",
      selected: "bg-blue-500/15 text-blue-400",
      hover: "hover:bg-blue-500/10",
      dot: "bg-blue-400",
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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1 py-1
          text-[9px] font-semibold uppercase tracking-wider
          transition-colors duration-150 cursor-pointer
          ${hasFilter ? colors.active : "text-on-surface-variant hover:text-on-surface"}
        `}
      >
        <span>{selectedOption?.label || label}</span>
        {hasFilter ? (
          <button
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-surface-container-highest"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        ) : (
          <ChevronDown
            className={`w-2.5 h-2.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-[9999] min-w-[120px] mt-1 py-1 bg-surface-container-high border border-outline-variant/50 rounded-lg shadow-xl shadow-black/30 max-h-60 overflow-auto">
          {/* All option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={`
              w-full px-3 py-1.5 text-[10px] text-left
              flex items-center justify-between gap-3
              transition-colors duration-150 whitespace-nowrap
              ${value === null ? colors.selected : `text-on-surface-variant ${colors.hover}`}
            `}
          >
            <span>All {label}</span>
            {value === null && <Check className="w-3 h-3 shrink-0" />}
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-outline-variant/30" />

          {/* Options */}
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full px-3 py-1.5 text-[10px] text-left
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
