import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", label, error, containerClassName, ...props }, ref) => {
    return (
      <div className={`space-y-2 ${containerClassName}`}>
        {label && (
          <label className="text-sm font-medium text-on-surface">
            {label}
          </label>
        )}
        <input
          type={type}
          className={`flex h-10 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className} ${
            error ? "border-red-500" : ""
          }`}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";