import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Save } from "lucide-react";
import { format as formatSqlLib } from "sql-formatter";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { saveLocalQuery, queryNameExists } from "~/lib/saved-queries";
import { useToast } from "./toast-provider";

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryText: string;
  queryType: "redshift";
  colorScheme?: "redshift";
}

function formatPreviewSql(sql: string): string {
  try {
    return formatSqlLib(sql, { language: "redshift", tabWidth: 2, keywordCase: "upper" });
  } catch {
    return sql;
  }
}

export function SaveQueryDialog({
  open,
  onOpenChange,
  queryText,
  queryType,
  colorScheme = "redshift",
}: SaveQueryDialogProps) {
  const { showToast } = useToast();
  const [queryName, setQueryName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQueryName("");
      setDescription("");
    }
  }, [open]);

  const handleSave = () => {
    if (!queryName.trim()) {
      showToast("Please enter a query name", "error");
      return;
    }

    if (!queryText.trim()) {
      showToast("Cannot save an empty query", "error");
      return;
    }

    if (queryNameExists(queryName.trim(), queryType)) {
      showToast("A query with this name already exists", "error");
      return;
    }

    setIsSaving(true);

    try {
      saveLocalQuery({
        query_name: queryName.trim(),
        query_text: queryText,
        query_type: queryType,
        description: description.trim() || undefined,
      });

      showToast("Query saved to browser storage", "success");
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save query";
      showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-2xl max-h-[85vh] rounded-xl",
            "bg-surface-container border border-outline-variant",
            "shadow-elevation-3",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "flex flex-col",
            "focus:outline-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-4 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-redshift/10 text-redshift">
                <Save className="w-4.5 h-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-on-surface">
                  Save Query
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Save your SQL query with a name
                </Dialog.Description>
                <span className="text-[11px] font-medium text-redshift">
                  Redshift
                </span>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {/* Query Name */}
            <div>
              <label htmlFor="query-name" className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Query Name <span className="text-red-400">*</span>
              </label>
              <input
                id="query-name"
                type="text"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="Enter query name"
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2 focus:ring-redshift/30 focus:border-redshift/50"
                )}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="query-desc" className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Description <span className="text-on-surface-variant/50">(optional)</span>
              </label>
              <textarea
                id="query-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this query do?"
                rows={2}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg text-sm resize-none",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2 focus:ring-redshift/30 focus:border-redshift/50"
                )}
              />
            </div>

            {/* SQL Preview */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Preview
              </label>
              <div className="rounded-lg bg-surface-container-high border border-outline-variant/30 p-4 max-h-80 overflow-auto">
                <pre className="text-[11px] leading-relaxed font-mono text-on-surface-variant/80 whitespace-pre-wrap break-words">
                  {formatPreviewSql(queryText)}
                </pre>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-variant">
            <Dialog.Close asChild>
              <Button variant="default" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="run"
              size="sm"
              colorScheme={colorScheme}
              onClick={handleSave}
              disabled={isSaving || !queryName.trim()}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Query"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
