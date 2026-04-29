

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle, Trash2, XCircle, CheckCircle } from "lucide-react";
import { cn } from "~/lib/utils";

export type ConfirmModalVariant = "danger" | "warning" | "info" | "success";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
  isLoading?: boolean;
}

const variantConfig: Record<ConfirmModalVariant, {
  icon: React.ElementType;
  iconBg: string;
  iconColour: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-500/10",
    iconColour: "text-rose-400",
    buttonBg: "bg-rose-500",
    buttonHover: "hover:bg-rose-600",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-500/10",
    iconColour: "text-amber-400",
    buttonBg: "bg-amber-500",
    buttonHover: "hover:bg-amber-600",
  },
  info: {
    icon: XCircle,
    iconBg: "bg-cyan-500/10",
    iconColour: "text-cyan-400",
    buttonBg: "bg-cyan-500",
    buttonHover: "hover:bg-cyan-600",
  },
  success: {
    icon: CheckCircle,
    iconBg: "bg-emerald-500/10",
    iconColour: "text-emerald-400",
    buttonBg: "bg-emerald-500",
    buttonHover: "hover:bg-emerald-600",
  },
};

export function ConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-sm p-6 rounded-2xl",
            "bg-surface-container shadow-elevation-3",
            "border border-outline-variant",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className={cn(
                "absolute top-4 right-4 p-1.5 rounded-full",
                "text-on-surface-variant hover:text-on-surface",
                "hover:bg-surface-container-high transition-colors"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center",
              config.iconBg
            )}>
              <Icon className={cn("w-7 h-7", config.iconColour)} />
            </div>
          </div>

          {/* Title */}
          <Dialog.Title className="text-lg font-semibold text-on-surface text-center mb-2">
            {title}
          </Dialog.Title>

          {/* Description */}
          <Dialog.Description className="text-sm text-on-surface-variant text-center mb-6 leading-relaxed">
            {description}
          </Dialog.Description>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Dialog.Close asChild>
              <button
                disabled={isLoading}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium",
                  "bg-surface-container-high text-on-surface",
                  "border border-outline-variant/50",
                  "hover:bg-surface-container-highest hover:border-outline/50",
                  "transition-all duration-200 active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white",
                config.buttonBg,
                config.buttonHover,
                "transition-all duration-200 active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
