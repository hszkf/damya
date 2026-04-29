

import { Sun, Moon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useTheme } from "~/lib/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="icon" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? (
            <Sun className="w-[18px] h-[18px] rotate-0 transition-all duration-300 hover:rotate-90" />
          ) : (
            <Moon className="w-[18px] h-[18px] rotate-0 transition-all duration-300 hover:-rotate-12" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Switch to {theme === "dark" ? "light" : "dark"} mode
      </TooltipContent>
    </Tooltip>
  );
}
