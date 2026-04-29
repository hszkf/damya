import { useState, useRef, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useClickOutside, useKeyboardShortcut } from "~/lib/hooks";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  accentColor?: "cyan" | "emerald" | "amber" | "violet" | "pink";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  accentColor = "cyan",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const accentColors = {
    cyan: {
      focus: "border-cyan-500/50 ring-cyan-500/20",
      selected: "bg-cyan-500/20 text-cyan-400",
      hover: "hover:bg-cyan-500/10",
    },
    emerald: {
      focus: "border-emerald-500/50 ring-emerald-500/20",
      selected: "bg-emerald-500/20 text-emerald-400",
      hover: "hover:bg-emerald-500/10",
    },
    amber: {
      focus: "border-amber-500/50 ring-amber-500/20",
      selected: "bg-amber-500/20 text-amber-400",
      hover: "hover:bg-amber-500/10",
    },
    violet: {
      focus: "border-violet-500/50 ring-violet-500/20",
      selected: "bg-violet-500/20 text-violet-400",
      hover: "hover:bg-violet-500/10",
    },
    pink: {
      focus: "border-pink-500/50 ring-pink-500/20",
      selected: "bg-pink-500/20 text-pink-400",
      hover: "hover:bg-pink-500/10",
    },
  };

  const colors = accentColors[accentColor];

  // Use custom hooks instead of useEffect
  const closeDropdown = useCallback(() => setIsOpen(false), []);
  
  useClickOutside(containerRef, closeDropdown, isOpen);
  useKeyboardShortcut("Escape", closeDropdown, { enabled: isOpen });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full h-[38px] px-3 py-2
          bg-surface-container-high border border-outline-variant/50 rounded-lg
          text-sm text-left
          flex items-center justify-between gap-2
          transition-all duration-200 cursor-pointer
          ${isOpen ? `${colors.focus} ring-1` : "hover:border-outline-variant"}
        `}
      >
        <span className={selectedOption ? "text-on-surface" : "text-on-surface-variant/50"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 py-1 bg-surface-container-high border border-outline-variant/50 rounded-lg shadow-xl shadow-black/20 max-h-60 overflow-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-3 py-2 text-sm text-left
                  flex items-center justify-between gap-2
                  transition-colors duration-150
                  ${isSelected ? colors.selected : `text-on-surface ${colors.hover}`}
                `}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
