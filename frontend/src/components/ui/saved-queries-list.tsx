

import * as React from "react";
import {
  FileCode,
  Trash2,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Database,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { getSavedQueries, deleteQuery, SavedQuery } from "~/lib/api";
import { useToast } from "./toast-provider";

interface SavedQueriesListProps {
  onSelectQuery: (query: SavedQuery) => void;
  filterType?: "redshift" | "all";
  colorScheme?: "redshift";
}

export function SavedQueriesList({
  onSelectQuery,
  filterType = "all",
  colorScheme = "redshift",
}: SavedQueriesListProps) {
  const { showToast } = useToast();
  const [queries, setQueries] = React.useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    redshift: true,
  });

  const fetchQueries = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const queryType = filterType === "all" ? undefined : filterType;
      const response = await getSavedQueries(queryType);
      setQueries(response.queries || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch queries";
      showToast(errorMessage, "error");
      setQueries([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterType, showToast]);

  React.useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const handleDelete = async (e: React.MouseEvent, queryId: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this query?")) return;

    try {
      await deleteQuery(queryId);
      showToast("Query deleted successfully", "success");
      fetchQueries();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete query";
      showToast(errorMessage, "error");
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getQueryTypeIcon = (type: string) => {
    switch (type) {
      case "redshift":
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
            <path
              d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
              stroke="#ff9900"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2" fill="#ff9900" />
          </svg>
        );
      default:
        return <Database className="w-3.5 h-3.5 text-on-surface-variant" />;
    }
  };

  const groupedQueries = React.useMemo(() => {
    const groups: Record<string, SavedQuery[]> = {
      redshift: [],
    };

    queries.forEach((query) => {
      if (groups[query.query_type]) {
        groups[query.query_type].push(query);
      }
    });

    return groups;
  }, [queries]);

  const renderQueryItem = (query: SavedQuery) => (
    <div
      key={query.id}
      onClick={() => onSelectQuery(query)}
      className={cn(
        "group px-3 py-2 cursor-pointer rounded-md mx-1 mb-1",
        "hover:bg-surface-container-high transition-colors",
        "border border-transparent hover:border-outline-variant"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <FileCode className="w-4 h-4 text-on-surface-variant mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-on-surface truncate">
              {query.query_name}
            </div>
            {query.description && (
              <div className="text-[10px] text-on-surface-variant truncate mt-0.5">
                {query.description}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 text-[10px] text-on-surface-variant/70">
              <span className="flex items-center gap-0.5">
                <User className="w-3 h-3" />
                {query.author}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatDate(query.updated_at)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={(e) => handleDelete(e, query.id)}
          className={cn(
            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-red-500/20 text-on-surface-variant hover:text-red-400"
          )}
          title="Delete query"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const renderSection = (type: string, label: string, queries: SavedQuery[]) => {
    if (filterType !== "all" && filterType !== type) return null;
    if (queries.length === 0 && filterType !== "all") return null;

    const isExpanded = expandedSections[type];

    return (
      <div key={type} className="mb-2">
        <button
          onClick={() => toggleSection(type)}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium",
            "text-on-surface-variant hover:text-on-surface transition-colors"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {getQueryTypeIcon(type)}
          <span>{label}</span>
          <span className="ml-auto text-[10px] text-on-surface-variant/70">
            ({queries.length})
          </span>
        </button>
        {isExpanded && (
          <div className="mt-1">
            {queries.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-on-surface-variant/50 italic">
                No saved queries
              </div>
            ) : (
              queries.map(renderQueryItem)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
        <span className="text-xs font-medium text-on-surface-variant">Saved Queries</span>
        <button
          onClick={fetchQueries}
          disabled={isLoading}
          className={cn(
            "p-1 rounded transition-colors",
            "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
            isLoading && "animate-spin"
          )}
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-5 h-5 text-on-surface-variant animate-spin" />
          </div>
        ) : queries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant/50 gap-2 px-4">
            <FileCode className="w-8 h-8 opacity-50" />
            <span className="text-xs text-center">No saved queries yet</span>
          </div>
        ) : filterType === "all" ? (
          <>
            {renderSection("redshift", "Redshift", groupedQueries.redshift)}
          </>
        ) : (
          <div className="mt-1">
            {queries.map(renderQueryItem)}
          </div>
        )}
      </div>
    </div>
  );
}
