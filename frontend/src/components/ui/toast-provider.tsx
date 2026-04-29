import toast, { Toaster, ToastBar, Toast } from "react-hot-toast";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

export { toast, Toaster };

export function useToast() {
  return {
    showToast: (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
      const toastOptions = {
        duration: type === "error" ? 5000 : 3000,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
        },
      };

      const CustomToast = ({ t }: { t: Toast }) => (
        <div
          className={`
            flex items-center gap-2.5 px-3 py-2 rounded-lg
            backdrop-blur-md border shadow-lg
            transform transition-all duration-200 ease-out
            ${t.visible ? "animate-in slide-in-from-top-2 fade-in-0" : "animate-out slide-out-to-top-2 fade-out-0"}
            ${type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-50"
              : type === "error"
              ? "bg-red-950/90 border-red-500/30 text-red-50"
              : type === "warning"
              ? "bg-amber-950/90 border-amber-500/30 text-amber-50"
              : "bg-slate-900/90 border-slate-500/30 text-slate-50"
            }
          `}
        >
          {/* Icon */}
          <div className={`
            flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full
            ${type === "success"
              ? "text-emerald-400"
              : type === "error"
              ? "text-red-400"
              : type === "warning"
              ? "text-amber-400"
              : "text-sky-400"
            }
          `}>
            {type === "success" && <CheckCircle2 className="w-4 h-4" />}
            {type === "error" && <XCircle className="w-4 h-4" />}
            {type === "warning" && <AlertTriangle className="w-4 h-4" />}
            {type === "info" && <Info className="w-4 h-4" />}
          </div>

          {/* Message */}
          <span className="text-xs font-medium leading-snug">
            {message}
          </span>

          {/* Dismiss button */}
          <button
            onClick={() => toast.dismiss(t.id)}
            className={`
              flex-shrink-0 ml-1 p-0.5 rounded-md transition-colors
              ${type === "success"
                ? "hover:bg-emerald-500/20 text-emerald-400/60 hover:text-emerald-300"
                : type === "error"
                ? "hover:bg-red-500/20 text-red-400/60 hover:text-red-300"
                : type === "warning"
                ? "hover:bg-amber-500/20 text-amber-400/60 hover:text-amber-300"
                : "hover:bg-slate-500/20 text-slate-400/60 hover:text-slate-300"
              }
            `}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );

      toast.custom((t) => <CustomToast t={t} />, toastOptions);
    },
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        containerStyle={{
          top: 12,
        }}
        toastOptions={{
          style: {
            background: "transparent",
            boxShadow: "none",
            padding: 0,
          },
        }}
      />
    </>
  );
}
