import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  ScrollText,
  Trash2,
  Copy,
  Check,
  Search,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { StudioNav } from "~/components/studio-nav";
import { useToast } from "~/components/ui/toast-provider";
import {
  fetchAppLogs,
  clearAppLogs,
  createLogStream,
  fetchHealthSummary,
  type AppLogEntry,
  type HealthSummary,
} from "~/lib/app-logs-api";

export const Route = createFileRoute("/logs")({
  component: LogsPage,
});

type LevelFilter = "all" | "info" | "warn" | "error";

const LEVEL_COLOURS: Record<string, string> = {
  debug: "text-neutral-500 bg-neutral-800",
  info: "text-emerald-400 bg-emerald-500/15",
  warn: "text-amber-400 bg-amber-500/15",
  error: "text-red-400 bg-red-500/15",
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

function LogsPage() {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const { showToast } = useToast();

  // Fetch initial logs + health
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([fetchAppLogs(undefined, 500), fetchHealthSummary()])
      .then(([logsRes, healthRes]) => {
        if (logsRes.status === "fulfilled") {
          setLogs(logsRes.value.data);
          setConnected(true);
        } else {
          setConnected(false);
        }
        if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      })
      .finally(() => setLoading(false));

    // Refresh health every 30s
    const healthInterval = setInterval(() => {
      fetchHealthSummary().then(setHealth).catch(() => {});
    }, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  // SSE stream
  useEffect(() => {
    const unsubscribe = createLogStream(
      (entry) => {
        setLogs((prev) => [...prev.slice(-999), entry]);
        setConnected(true);
      },
      () => setConnected(false),
    );
    return unsubscribe;
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const handleClear = async () => {
    try {
      await clearAppLogs();
      setLogs([]);
      setExpandedIdx(null);
      showToast("Logs cleared", "success");
    } catch {
      showToast("Failed to clear logs", "error");
    }
  };

  const handleCopy = () => {
    const text = filteredLogs
      .map((e) => {
        const base = `${formatTime(e.timestamp)} [${e.level.toUpperCase()}] ${e.message}`;
        const extras: string[] = [];
        if (e.method && e.path) extras.push(`${e.method} ${e.path}`);
        if (e.statusCode) extras.push(`${e.statusCode}`);
        if (e.duration) extras.push(`${e.duration}ms`);
        if (e.error) extras.push(`Error: ${e.error.message}`);
        return extras.length ? `${base}  ${extras.join(" | ")}` : base;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((entry) => {
    if (levelFilter !== "all" && entry.level !== levelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        entry.message.toLowerCase().includes(q) ||
        entry.error?.message?.toLowerCase().includes(q) ||
        entry.path?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = health?.stats ?? { total: logs.length, byLevel: { info: 0, warn: 0, error: 0 } };
  const countFor = (level: string) =>
    level === "all" ? stats.total : (stats.byLevel[level] ?? 0);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-neutral-200">
      <StudioNav />
      <main className="flex-1 overflow-hidden px-8 py-6">
        <div className="mx-auto max-w-6xl h-full flex flex-col">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ScrollText size={24} className="text-rose-400" />
                Backend Logs
              </h1>
              <p className="text-sm text-neutral-500">
                Real-time application log viewer
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <Trash2 size={13} />
                Clear
              </button>
            </div>
          </div>

          {/* Health bar */}
          <HealthBar health={health} connected={connected} />

          {/* Disconnected banner */}
          {!connected && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <WifiOff size={16} />
              Cannot connect to backend. Retrying...
            </div>
          )}

          {/* Filter bar */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-900 p-1">
              {(["all", "info", "warn", "error"] as LevelFilter[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    levelFilter === level
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
                  <span className="text-[10px] text-neutral-600">
                    {countFor(level)}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs..."
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 pl-8 pr-3 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
            <div className="ml-auto text-xs text-neutral-600">
              {filteredLogs.length} of {logs.length} entries
            </div>
          </div>

          {/* Log display */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/50"
          >
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                <span className="ml-3 text-sm text-neutral-400">Loading logs...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ScrollText size={40} className="mb-3 text-neutral-700" />
                <p className="text-sm text-neutral-500">No logs to display</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/50">
                {filteredLogs.map((entry, idx) => (
                  <LogRow
                    key={`${entry.timestamp}-${idx}`}
                    entry={entry}
                    expanded={expandedIdx === idx}
                    onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function HealthBar({ health, connected }: { health: HealthSummary | null; connected: boolean }) {
  if (!health) return null;

  const items = [
    {
      label: "Redshift",
      ok: health.redshift.connected,
      error: health.redshift.error,
    },
    {
      label: "S3 Storage",
      ok: health.storage.connected,
      error: health.storage.error,
    },
    {
      label: "Backend",
      ok: connected,
      error: connected ? undefined : "Unreachable",
    },
  ];

  return (
    <div className="mb-3 flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          {item.ok ? (
            <Wifi size={12} className="text-emerald-400" />
          ) : (
            <AlertTriangle size={12} className="text-red-400" />
          )}
          <span className="font-medium text-neutral-400">{item.label}</span>
          {item.ok ? (
            <span className="text-emerald-400">Connected</span>
          ) : (
            <span className="text-red-400" title={item.error}>
              {item.error || "Disconnected"}
            </span>
          )}
        </div>
      ))}
      <div className="ml-auto text-[10px] text-neutral-600">
        Uptime: {Math.floor(health.uptime / 60)}m
      </div>
    </div>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AppLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails = entry.error || entry.metadata || entry.requestId || entry.duration;

  return (
    <div>
      <button
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full text-left px-4 py-1.5 flex items-start gap-3 hover:bg-neutral-800/30 transition-colors ${
          !hasDetails ? "cursor-default" : ""
        }`}
      >
        {hasDetails ? (
          expanded ? (
            <ChevronDown size={12} className="mt-1 shrink-0 text-neutral-600" />
          ) : (
            <ChevronRight size={12} className="mt-1 shrink-0 text-neutral-600" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-[10px] font-mono text-neutral-600 mt-0.5 shrink-0 w-16">
          {formatTime(entry.timestamp)}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
            LEVEL_COLOURS[entry.level] || LEVEL_COLOURS.info
          }`}
        >
          {entry.level.toUpperCase()}
        </span>
        <span className="text-xs text-neutral-300 break-all flex-1">
          {entry.message}
          {entry.method && entry.path && (
            <span className="text-neutral-600 ml-2">
              {entry.method} {entry.path}
            </span>
          )}
          {entry.statusCode && (
            <span
              className={`ml-2 ${
                entry.statusCode >= 500
                  ? "text-red-400"
                  : entry.statusCode >= 400
                    ? "text-amber-400"
                    : "text-neutral-600"
              }`}
            >
              {entry.statusCode}
            </span>
          )}
          {entry.error && (
            <span className="ml-2 text-red-400/80">{entry.error.message}</span>
          )}
        </span>
      </button>
      {expanded && hasDetails && (
        <div className="px-4 pb-2 pl-12">
          <pre className="text-[11px] font-mono text-neutral-500 whitespace-pre-wrap break-all bg-neutral-900/80 rounded-lg p-3 border border-neutral-800/50">
            {JSON.stringify(
              {
                ...(entry.error && { error: entry.error }),
                ...(entry.metadata && { metadata: entry.metadata }),
                ...(entry.requestId && { requestId: entry.requestId }),
                ...(entry.duration != null && { duration: `${entry.duration}ms` }),
                ...(entry.userId != null && { userId: entry.userId }),
                timestamp: entry.timestamp,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
