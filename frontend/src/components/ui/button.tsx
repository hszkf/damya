import * as React from "react";
import { cn } from "~/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "tonal" | "icon" | "run" | "outline";
  size?: "default" | "sm" | "icon";
  colorScheme?: "redshift";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      colorScheme,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2",
          "font-semibold transition-all duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed",

          // Size variants
          size === "default" && "px-5 py-2.5 rounded-[20px] text-sm",
          size === "sm" && "px-4 py-2 rounded-[18px] text-[13px]",
          size === "icon" && "p-2.5 rounded-full",

          // Variant styles
          variant === "default" &&
            "bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover:shadow-elevation-1",

          variant === "tonal" &&
            "bg-surface-container-high text-on-surface hover:bg-surface-container-highest hover:shadow-elevation-1",

          variant === "outline" &&
            "border border-outline text-on-surface bg-transparent hover:bg-surface-container-high hover:text-on-surface",

          variant === "icon" &&
            "bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",

          variant === "run" &&
            cn(
              "bg-redshift text-white",
              "hover:brightness-110 hover:shadow-[0_4px_12px_rgba(255,153,0,0.4)]",
              "active:scale-[0.98]"
            ),

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
