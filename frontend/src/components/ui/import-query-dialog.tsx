import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileCode, Clock, Trash2, Search, FolderOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { getFilteredQueries, deleteLocalQuery, LocalSavedQuery } from "~/lib/saved-queries";
import { useToast } from "./toast-provider";

interface ImportQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuerySelect: (query: LocalSavedQuery) => void;
  queryType: "redshift";
  colorScheme?: "redshift";
}

function formatSql(sql: string): string {
  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "ON", "AS",
    "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "CROSS JOIN",
    "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
    "INSERT INTO", "UPDATE", "DELETE", "SET", "VALUES",
    "CREATE TABLE", "DROP TABLE", "ALTER TABLE", "TRUNCATE",
    "UNION", "UNION ALL", "INTERSECT", "EXCEPT",
    "CASE", "WHEN", "THEN", "ELSE", "END",
    "WITH", "DISTINCT", "BETWEEN", "LIKE", "IS", "NULL",
    "ASC", "DESC", "FULL JOIN", "FETCH",
  ];

  let formatted = sql
    .replace(/\s+/g, " ")
    .trim();

  // Add newlines before major keywords
  const majorKeywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "GROUP BY", "ORDER BY",
    "HAVING", "LIMIT", "OFFSET", "LEFT JOIN", "RIGHT JOIN",
    "INNER JOIN", "OUTER JOIN", "CROSS JOIN", "FULL JOIN", "JOIN",
    "UNION ALL", "UNION", "INTERSECT", "EXCEPT",
    "INSERT INTO", "UPDATE", "DELETE", "SET", "VALUES",
    "CREATE TABLE", "DROP TABLE", "ALTER TABLE",
  ];

  // Sort by length descending so longer matches first (e.g., LEFT JOIN before JOIN)
  const sorted = [...majorKeywords].sort((a, b) => b.length - a.length);

  for (const kw of sorted) {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    formatted = formatted.replace(regex, `\n${kw}`);
  }

  // Clean leading newline
  formatted = formatted.replace(/^\n/, "");

  // Indent sub-keywords
  formatted = formatted
    .replace(/\n(AND|OR|SET|VALUES|HAVING)\b/gi, (match, kw) => `\n  ${kw}`);

  // Uppercase keywords for display
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    formatted = formatted.replace(regex, kw.toUpperCase());
  }

  return formatted;
}

export function ImportQueryDialog({
  open,
  onOpenChange,
  onQuerySelect,
  queryType,
  colorScheme = "redshift",
}: ImportQueryDialogProps) {
  const { showToast } = useToast();
  const [savedQueries, setSavedQueries] = React.useState<LocalSavedQuery[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ open: boolean; query: LocalSavedQuery | null }>({
    open: false,
    query: null,
  });

  const loadSavedQueries = React.useCallback(() => {
    setIsLoading(true);
    try {
      const queries = getFilteredQueries();
      setSavedQueries(queries);
    } catch (error) {
      showToast("Failed to load saved queries", "error");
      setSavedQueries([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    if (open) {
      loadSavedQueries();
      setSearchTerm("");
    }
  }, [open, loadSavedQueries]);

  const handleQueryClick = (query: LocalSavedQuery) => {
    onQuerySelect(query);
    onOpenChange(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, query: LocalSavedQuery) => {
    e.stopPropagation();
    setDeleteConfirm({ open: true, query });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.query) return;

    try {
      deleteLocalQuery(deleteConfirm.query.id);
      showToast("Query deleted", "success");
      loadSavedQueries();
    } catch (error) {
      showToast("Failed to delete query", "error");
    } finally {
      setDeleteConfirm({ open: false, query: null });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ open: false, query: null });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredQueries = React.useMemo(() => {
    let filtered = savedQueries.filter((q) => q.query_type === queryType);

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((q) =>
        q.query_name.toLowerCase().includes(search) ||
        q.description?.toLowerCase().includes(search) ||
        q.query_text.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [savedQueries, searchTerm, queryType]);

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
                <FolderOpen className="w-4.5 h-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-semibold text-on-surface">
                  Saved Queries
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  Select a saved query to load
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

          {/* Search */}
          <div className="px-5 py-3 border-b border-outline-variant">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Search by name or SQL content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-lg text-sm",
                  "bg-surface text-on-surface placeholder:text-outline",
                  "border border-outline-variant",
                  "focus:outline-none focus:ring-2 focus:ring-redshift/30 focus:border-redshift/50"
                )}
              />
            </div>
          </div>

          {/* Query List */}
          <div className="flex-1 overflow-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-on-surface-variant">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent mb-3 text-redshift" />
                  <p className="text-xs">Loading...</p>
                </div>
              </div>
            ) : filteredQueries.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-on-surface-variant">
                  <FileCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {searchTerm ? "No queries match your search" : "No saved queries yet"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQueries.map((query) => (
                  <div
                    key={query.id}
                    onClick={() => handleQueryClick(query)}
                    className={cn(
                      "group p-4 rounded-lg cursor-pointer",
                      "bg-surface hover:bg-surface-container-high",
                      "border border-outline-variant/50 hover:border-outline-variant",
                      "transition-colors"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileCode className="w-4 h-4 flex-shrink-0 text-redshift" />
                          <h3 className="text-sm font-medium text-on-surface truncate">
                            {query.query_name}
                          </h3>
                          <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/60 ml-auto shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDate(query.updated_at)}
                          </span>
                        </div>

                        {query.description && (
                          <p className="text-xs text-on-surface-variant mb-2 line-clamp-1 ml-6">
                            {query.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleDeleteClick(e, query)}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Formatted SQL Preview */}
                    <div className="mt-2 ml-6 p-3 rounded-lg bg-surface-container-high border border-outline-variant/30 overflow-auto max-h-40">
                      <pre className="text-[11px] leading-relaxed font-mono text-on-surface-variant/80 whitespace-pre-wrap break-words">
                        {formatSql(query.query_text)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant">
            <span className="text-xs text-on-surface-variant">
              {filteredQueries.length} {filteredQueries.length === 1 ? "query" : "queries"}
            </span>
            <Dialog.Close asChild>
              <Button variant="default" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Delete Confirmation Modal */}
      <Dialog.Root open={deleteConfirm.open} onOpenChange={(open) => !open && handleCancelDelete()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 animate-in fade-in-0 duration-150" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]",
              "w-full max-w-sm rounded-xl",
              "bg-surface-container border border-outline-variant",
              "shadow-elevation-3",
              "animate-in fade-in-0 zoom-in-95 duration-150",
              "focus:outline-none"
            )}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <Dialog.Title className="text-sm font-semibold text-on-surface">
                    Delete Query
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-on-surface-variant">
                    This action cannot be undone
                  </Dialog.Description>
                </div>
              </div>

              {deleteConfirm.query && (
                <div className="mb-4 p-3 rounded-lg bg-surface border border-outline-variant/50">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {deleteConfirm.query.query_name}
                  </p>
                  {deleteConfirm.query.description && (
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">
                      {deleteConfirm.query.description}
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-on-surface-variant mb-5">
                Are you sure you want to delete this saved query?
              </p>

              <div className="flex gap-2 justify-end">
                <Button variant="default" size="sm" onClick={handleCancelDelete}>
                  Cancel
                </Button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}
