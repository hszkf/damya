import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  options?: { value: string; label: string }[];
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, containerClassName, options, children, ...props }, ref) => {
    return (
      <div className={`space-y-2 ${containerClassName}`}>
        {label && (
          <label className="text-sm font-medium text-on-surface">
            {label}
          </label>
        )}
        <select
          className={`flex h-10 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className} ${
            error ? "border-red-500" : ""
          }`}
          ref={ref}
          {...props}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

// Export placeholder components to avoid import errors
export const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SelectItem = ({ children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => <option {...props}>{children}</option>;
export const SelectTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SelectValue = ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>;