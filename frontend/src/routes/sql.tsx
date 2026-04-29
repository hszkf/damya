import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format as formatSql } from 'sql-formatter';
import {
  Play,
  Loader2,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Circle,
  X,
  Clock,
  Database,
  Table2,
  Copy,
  Check,
  Plus,
  Save,
  Wand2,
  FolderOpen,
  Search,
  History,
  Trash2,
  FileJson,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import { executeQuery, checkHealth, getSchemas, clearSchemaCache } from '~/lib/api';
import type { QueryResult, SchemaResult } from '~/lib/api';
import type { LocalSavedQuery } from '~/lib/saved-queries';
import { addToHistory, getHistory, clearHistory, formatHistoryTimestamp } from '~/lib/query-history';
import { downloadAsCSV, downloadAsExcel, downloadAsJSON } from '~/lib/download';
import { SaveQueryDialog } from '~/components/ui/save-query-dialog';
import { ImportQueryDialog } from '~/components/ui/import-query-dialog';
import { StudioNav } from '~/components/studio-nav';

export const Route = createFileRoute('/sql')({
  component: RedshiftQueryPage,
});

// --- Tab types ---

interface QueryTab {
  id: string;
  name: string;
  query: string;
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  executionTime: number | null;
}

let tabCounter = 1;

function createTab(name?: string): QueryTab {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    name: name || `Query ${tabCounter - 1 || 1}`,
    query: 'SELECT *\nFROM redshift_customers.public_customers',
    result: null,
    error: null,
    loading: false,
    executionTime: null,
  };
}

// --- SQL syntax highlighting ---

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'ON', 'AS', 'IS', 'NULL',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'NATURAL',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH',
  'INSERT', 'INTO', 'UPDATE', 'DELETE', 'SET', 'VALUES',
  'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'TABLE', 'VIEW', 'INDEX',
  'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'WITH', 'DISTINCT', 'BETWEEN', 'LIKE', 'EXISTS',
  'ASC', 'DESC', 'TRUE', 'FALSE',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'CAST', 'COALESCE', 'NULLIF', 'IFNULL',
  'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
  'ILIKE', 'SIMILAR', 'TO', 'ESCAPE',
  'USING', 'LATERAL', 'RECURSIVE', 'MATERIALIZED',
  'UNNEST', 'ANY', 'SOME', 'ARRAY',
  'TOP', 'PERCENT', 'ROWS', 'ONLY', 'NEXT',
  'GRANT', 'REVOKE', 'SCHEMA', 'DATABASE', 'BEGIN', 'COMMIT', 'ROLLBACK',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  'CONSTRAINT', 'ADD', 'COLUMN', 'RENAME',
]);

function tokenizeSql(sql: string, knownSchemas: Record<string, string[]>): { text: string; type: string }[][] {
  const schemaNames = new Set(Object.keys(knownSchemas).map((s) => s.toLowerCase()));
  const tableNames = new Set<string>();
  for (const tables of Object.values(knownSchemas)) {
    for (const t of tables) tableNames.add(t.toLowerCase());
  }

  const lines = sql.split('\n');
  return lines.map((line) => {
    const tokens: { text: string; type: string }[] = [];
    let i = 0;
    while (i < line.length) {
      // Comments: --
      if (line[i] === '-' && line[i + 1] === '-') {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      // Strings: single quote
      if (line[i] === "'") {
        let j = i + 1;
        while (j < line.length && line[j] !== "'") j++;
        tokens.push({ text: line.slice(i, j + 1), type: 'string' });
        i = j + 1;
        continue;
      }
      // Numbers
      if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,;(=<>+\-*/]/.test(line[i - 1]))) {
        let j = i;
        while (j < line.length && /[0-9.]/.test(line[j])) j++;
        tokens.push({ text: line.slice(i, j), type: 'number' });
        i = j;
        continue;
      }
      // Identifiers & keywords
      if (/[a-zA-Z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        const upper = word.toUpperCase();
        if (SQL_KEYWORDS.has(upper)) {
          tokens.push({ text: word, type: 'keyword' });
        } else if (schemaNames.has(word.toLowerCase())) {
          tokens.push({ text: word, type: 'schema' });
        } else if (tableNames.has(word.toLowerCase())) {
          tokens.push({ text: word, type: 'table' });
        } else {
          tokens.push({ text: word, type: 'identifier' });
        }
        i = j;
        continue;
      }
      // Operators & punctuation
      if (/[=<>!+\-*/%&|^~]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[=<>!+\-*/%&|^~]/.test(line[j])) j++;
        tokens.push({ text: line.slice(i, j), type: 'operator' });
        i = j;
        continue;
      }
      // Dot (schema.table)
      if (line[i] === '.') {
        tokens.push({ text: '.', type: 'dot' });
        i++;
        continue;
      }
      // Parens, commas, semicolons
      if (/[(),;]/.test(line[i])) {
        tokens.push({ text: line[i], type: 'punctuation' });
        i++;
        continue;
      }
      // Whitespace
      if (/\s/.test(line[i])) {
        let j = i;
        while (j < line.length && /\s/.test(line[j])) j++;
        tokens.push({ text: line.slice(i, j), type: 'whitespace' });
        i = j;
        continue;
      }
      // Other
      tokens.push({ text: line[i], type: 'plain' });
      i++;
    }
    return tokens;
  });
}

const TOKEN_COLORS: Record<string, string> = {
  keyword: '#c792ea',
  schema: '#82aaff',
  table: '#f78c6c',
  string: '#c3e88d',
  number: '#f78c6c',
  comment: '#546e7a',
  operator: '#89ddff',
  dot: '#89ddff',
  punctuation: '#89ddff',
  identifier: '#eeffff',
  whitespace: 'transparent',
  plain: '#eeffff',
};

const SqlHighlight = React.forwardRef<HTMLPreElement, { query: string; schemas: Record<string, string[]> }>(
  function SqlHighlight({ query, schemas }, ref) {
    const lines = useMemo(() => tokenizeSql(query, schemas), [query, schemas]);
    return (
      <pre
        ref={ref}
        className="w-full h-full p-4 font-mono text-sm whitespace-pre-wrap break-words pointer-events-none overflow-hidden m-0"
        aria-hidden="true"
      >
      {lines.map((tokens, li) => (
        <span key={li}>
          {tokens.map((tok, ti) => (
            <span key={ti} style={{ color: TOKEN_COLORS[tok.type] || '#eeffff' }}>{tok.text}</span>
          ))}
          {li < lines.length - 1 && '\n'}
        </span>
      ))}
    </pre>
  );
  }
);

// --- Module-level cache to survive navigation (unmount/remount) ---

interface PageCache {
  tabs: QueryTab[];
  activeTabId: string;
  schemas: Record<string, string[]>;
  expandedSchemas: Set<string>;
  showSidebar: boolean;
  schemaSearch: string;
  limitRows: boolean;
  sidebarWidth: number;
  editorPct: number;
}

let _cache: PageCache | null = null;

function saveCache(c: PageCache) { _cache = c; }
function loadCache(): PageCache | null { return _cache; }

const PAGE_SIZE = 1000;

// --- Main component ---

function RedshiftQueryPage() {
  const navigate = useNavigate();

  const cached = loadCache();

  // Tab state
  const [tabs, setTabs] = useState<QueryTab[]>(() => {
    if (cached) return cached.tabs;
    tabCounter = 1;
    return [createTab()];
  });
  const [activeTabId, setActiveTabId] = useState(cached?.activeTabId ?? tabs[0].id);

  // Sidebar state
  const [health, setHealth] = useState<{ connected: boolean; error?: string }>({ connected: false });
  const [schemas, setSchemas] = useState<Record<string, string[]>>(cached?.schemas ?? {});
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(cached?.expandedSchemas ?? new Set());
  const [showSidebar, setShowSidebar] = useState(cached?.showSidebar ?? true);
  const [schemaSearch, setSchemaSearch] = useState(cached?.schemaSearch ?? '');

  // Dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState(getHistory('redshift'));
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('');

  // Limit toggle
  const [limitRows, setLimitRows] = useState(cached?.limitRows ?? true);

  // Server-side pagination
  const [resultPage, setResultPage] = useState(0);
  const [totalRows, setTotalRows] = useState<number | null>(null);

  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Draggable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(cached?.sidebarWidth ?? 224);
  const isDragging = useRef(false);

  // Draggable editor height (percentage of panel)
  const [editorPct, setEditorPct] = useState(cached?.editorPct ?? 45);
  const isEditorDragging = useRef(false);
  const editorPanelRef = useRef<HTMLDivElement>(null);

  // Save cache on state changes
  useEffect(() => {
    saveCache({ tabs, activeTabId, schemas, expandedSchemas, showSidebar, schemaSearch, limitRows, sidebarWidth, editorPct });
  }, [tabs, activeTabId, schemas, expandedSchemas, showSidebar, schemaSearch, limitRows, sidebarWidth, editorPct]);

  // Derived: active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Derived: filtered schemas for search
  const filteredSchemas = useMemo(() => {
    if (!schemaSearch.trim()) return schemas;
    const search = schemaSearch.toLowerCase();
    const result: Record<string, string[]> = {};
    for (const [schema, tables] of Object.entries(schemas)) {
      if (schema.toLowerCase().includes(search)) {
        result[schema] = tables;
      } else {
        const matching = tables.filter((t) => t.toLowerCase().includes(search));
        if (matching.length > 0) {
          result[schema] = matching;
        }
      }
    }
    return result;
  }, [schemas, schemaSearch]);

  const schemaStats = useMemo(() => {
    const schemaCount = Object.keys(schemas).length;
    const tableCount = Object.values(schemas).reduce((s, t) => s + t.length, 0);
    return { schemaCount, tableCount };
  }, [schemas]);

  // --- Health check ---

  useEffect(() => {
    const check = async () => {
      const h = await checkHealth('redshift');
      setHealth({ connected: h.status === 'connected', error: h.error });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Load schemas ---

  const loadSchemas = useCallback(async () => {
    setLoadingSchemas(true);
    const data: SchemaResult = await getSchemas('redshift');
    if (data.status === 'success') setSchemas(data.schemas);
    setLoadingSchemas(false);
  }, []);

  useEffect(() => {
    if (health.connected) loadSchemas();
  }, [health.connected, loadSchemas]);

  // --- Update tab helper ---

  const updateTab = useCallback((tabId: string, updates: Partial<QueryTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  // --- Run query ---

  const runQuery = useCallback(async (page: number = 0) => {
    let sql = activeTab.query.trim();
    if (!sql) return;

    const tabId = activeTab.id;
    const isPaginated = !limitRows;

    // Strip trailing semicolon
    sql = sql.replace(/;\s*$/, '');

    // Strip existing LIMIT/OFFSET if present
    sql = sql.replace(/\bLIMIT\s+\d+/gi, '').replace(/\bOFFSET\s+\d+/gi, '').trim();

    const safePage = Math.max(0, Math.floor(Number(page) || 0));
    const safePageSize = Number(PAGE_SIZE) || 1000;
    const offset = safePage * safePageSize;

    if (limitRows) {
      sql += '\nLIMIT 100';
    } else {
      // Extra guard: never inject NaN/Infinity into SQL
      const limitVal = Number.isFinite(safePageSize) ? safePageSize : 1000;
      const offsetVal = Number.isFinite(offset) ? offset : 0;
      sql += `\nLIMIT ${limitVal} OFFSET ${offsetVal}`;
    }

    console.log('[runQuery] SQL being sent:', JSON.stringify(sql));

    updateTab(tabId, { loading: true, error: null, result: null, executionTime: null });
    setResultPage(safePage);
    const start = Date.now();

    try {
      let count: number | null = null;
      if (isPaginated && safePage === 0) {
        const baseSql = activeTab.query.trim().replace(/;\s*$/, '');
        try {
          const countRes = await executeQuery('redshift', `SELECT COUNT(*) AS _total FROM (${baseSql}) AS _count_subq`);
          if (countRes.status === 'success' && countRes.rows?.[0]) {
            const val = Number(countRes.rows[0]._total);
            if (Number.isFinite(val)) count = val;
          }
        } catch {
          // Count query failed — pagination still works, just no total
        }
      }

      const res = await executeQuery('redshift', sql);
      const elapsed = Date.now() - start;
      if (res.status === 'error') {
        updateTab(tabId, { loading: false, error: `${res.error || res.message || 'Query failed'}\n\nSQL: ${sql}`, executionTime: elapsed });
        addToHistory('redshift', sql, false, elapsed);
        setTotalRows(null);
      } else {
        updateTab(tabId, { loading: false, result: res, executionTime: elapsed });
        addToHistory('redshift', sql, true, elapsed, res.rows?.length ?? 0);
        if (count !== null) {
          setTotalRows(count);
        } else if (safePage === 0 && !isPaginated) {
          setTotalRows(res.rows?.length ?? 0);
        }
      }
      setHistoryList(getHistory('redshift'));
    } catch (err: any) {
      updateTab(tabId, { loading: false, error: `${err.message}\n\nSQL: ${sql}` });
      addToHistory('redshift', sql, false);
      setTotalRows(null);
      setHistoryList(getHistory('redshift'));
    }
  }, [activeTab.id, activeTab.query, limitRows, updateTab]);

  // --- Keyboard shortcut ---

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runQuery]);

  // --- Auto-expand schemas when searching ---

  useEffect(() => {
    if (schemaSearch.trim()) {
      const matching = Object.keys(filteredSchemas);
      setExpandedSchemas((prev) => {
        const next = new Set(prev);
        matching.forEach((s) => next.add(s));
        return next;
      });
    }
  }, [schemaSearch, filteredSchemas]);

  // --- Tab actions ---

  const addTab = () => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    setResultPage(0);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  // --- Schema sidebar helpers ---

  const toggleSchema = (schema: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  };

  const insertTable = (schema: string, table: string) => {
    updateTab(activeTab.id, { query: `SELECT * FROM ${schema}.${table}` });
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  // --- Copy / export ---

  const copyCSV = useCallback(() => {
    if (!activeTab.result) return;
    const r = activeTab.result;
    const header = r.columns.join(',');
    const rows = r.rows.map((row) => r.columns.map((c) => JSON.stringify(row[c] ?? '')).join(','));
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab.result]);

  const exportAll = useCallback(async (format: 'csv' | 'excel' | 'json') => {
    if (!activeTab.query.trim()) return;
    setExportFormat(format === 'csv' ? 'CSV' : format === 'excel' ? 'Excel' : 'JSON');
    setExporting(true);
    setExportOpen(false);
    try {
      let sql = activeTab.query.trim().replace(/;\s*$/, '');
      sql = sql.replace(/\bLIMIT\s+\d+/gi, '').replace(/\bOFFSET\s+\d+/gi, '').trim();
      const res = await executeQuery('redshift', sql);
      if (res.status === 'error' || !res.rows?.length) {
        setExporting(false);
        return;
      }
      const data = { columns: res.columns, rows: res.rows };
      if (format === 'csv') downloadAsCSV(data);
      else if (format === 'excel') downloadAsExcel(data);
      else downloadAsJSON(data);
    } catch {
      // Export failed silently
    }
    setExporting(false);
  }, [activeTab.query]);

  // --- Saved queries ---

  const handleLoadSavedQuery = (saved: LocalSavedQuery) => {
    updateTab(activeTab.id, { query: saved.query_text, name: saved.query_name });
  };

  // --- Sidebar resize ---

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX;
      setSidebarWidth(Math.min(400, Math.max(160, startWidth + delta)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleEditorDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editorPanelRef.current) return;
    isEditorDragging.current = true;
    const panel = editorPanelRef.current;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isEditorDragging.current) return;
      const rect = panel.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setEditorPct(Math.min(80, Math.max(15, pct)));
    };
    const onMouseUp = () => {
      isEditorDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // --- Render ---

  return (
    <div className="h-screen flex flex-col bg-[rgb(var(--surface))]">
      <StudioNav
        rightSlot={
          <div
            className="flex items-center gap-1.5 px-3 py-1"
            title={health.connected ? 'Connected' : health.error || 'Disconnected'}
          >
            <Circle
              className={`w-2 h-2 ${health.connected ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`}
            />
            <span className="text-[11px] text-[rgb(var(--on-surface-variant))]">
              {health.connected ? 'Redshift' : 'Offline'}
            </span>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* ---- Sidebar ---- */}
        {showSidebar && (
          <div
            className="flex flex-col bg-[rgb(var(--surface-container)/0.5)] shrink-0 relative"
            style={{ width: sidebarWidth }}
          >
            {/* Header */}
            <div className="px-2.5 py-2 border-b border-[rgb(var(--outline-variant)/0.3)] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-[rgb(var(--on-surface))]">Schemas</span>
              </div>
              <button
                onClick={() => {
                  loadSchemas();
                  clearSchemaCache('redshift');
                }}
                className="p-1 rounded hover:bg-[rgb(var(--surface-container-highest))] text-[rgb(var(--on-surface-variant))]"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSchemas ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 border-b border-[rgb(var(--outline-variant)/0.2)]">
              <div className="relative">
                <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgb(var(--on-surface-variant)/0.5)]" />
                <input
                  type="text"
                  value={schemaSearch}
                  onChange={(e) => setSchemaSearch(e.target.value)}
                  placeholder="Filter tables..."
                  className="w-full pl-5 pr-2 py-1 rounded text-[11px] bg-transparent text-[rgb(var(--on-surface))] placeholder:text-[rgb(var(--on-surface-variant)/0.4)] border border-[rgb(var(--outline-variant)/0.2)] focus:outline-none focus:border-amber-500/40"
                />
              </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto px-2 py-1.5">
              {!health.connected ? (
                <div className="text-[11px] text-[rgb(var(--on-surface-variant))] p-2">
                  Connect to Redshift to browse schemas
                </div>
              ) : loadingSchemas && schemaStats.schemaCount === 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--on-surface-variant))] p-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                </div>
              ) : (
                <div className="text-[11px] text-[rgb(var(--on-surface-variant))]">
                  {schemaSearch.trim()
                    ? `${Object.keys(filteredSchemas).length} results`
                    : `${schemaStats.schemaCount} schemas, ${schemaStats.tableCount} tables`}
                </div>
              )}

              {Object.keys(filteredSchemas).length === 0 && schemaSearch.trim() && health.connected && (
                <div className="text-[11px] text-[rgb(var(--on-surface-variant)/0.5)] py-3 text-center">No results</div>
              )}

              <div className="mt-1.5 space-y-0">
                {Object.entries(filteredSchemas)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([schema, tables]) => (
                    <div key={schema}>
                      <button
                        onClick={() => toggleSchema(schema)}
                        className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[rgb(var(--surface-container-highest))] text-left text-[rgb(var(--on-surface))]"
                      >
                        {expandedSchemas.has(schema) ? (
                          <ChevronDown className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        )}
                        <span className="text-xs font-medium truncate">{schema}</span>
                        <span className="ml-auto text-[rgb(var(--on-surface-variant))] text-[9px]">{tables.length}</span>
                      </button>
                      {expandedSchemas.has(schema) && (
                        <div className="ml-3.5">
                          {tables.map((table) => (
                            <button
                              key={table}
                              onClick={() => insertTable(schema, table)}
                              className="w-full flex items-center gap-1 px-1.5 py-px rounded hover:bg-[rgb(var(--surface-container-highest))] text-left text-[rgb(var(--on-surface-variant))]"
                              title={`Insert ${schema}.${table}`}
                            >
                              <Table2 className="w-2.5 h-2.5 shrink-0 opacity-50" />
                              <span className="text-[11px] truncate">{table}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
            {/* Drag handle */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 transition-colors z-10"
            />
          </div>
        )}

        {/* ---- Main panel ---- */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex items-center border-b border-[rgb(var(--outline-variant)/0.3)] bg-[rgb(var(--surface-container)/0.2)]">
            <div className="flex items-center flex-1 overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer border-r border-[rgb(var(--outline-variant)/0.15)] whitespace-nowrap
                    ${tab.id === activeTabId
                      ? 'bg-[rgb(var(--surface))] text-amber-400 border-b-2 border-b-amber-400'
                      : 'text-[rgb(var(--on-surface-variant))] hover:text-[rgb(var(--on-surface))] hover:bg-[rgb(var(--surface-container)/0.3)]'}
                  `}
                  onClick={() => switchTab(tab.id)}
                >
                  <span className="truncate max-w-[120px]">{tab.name}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-[rgb(var(--outline-variant)/0.3)] text-[rgb(var(--on-surface-variant)/0.5)] hover:text-[rgb(var(--on-surface))]"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTab}
                className="p-1.5 mx-1 rounded hover:bg-[rgb(var(--surface-container-highest))] text-[rgb(var(--on-surface-variant)/0.6)] hover:text-[rgb(var(--on-surface))]"
                title="New tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="border-b border-[rgb(var(--outline-variant)/0.3)] px-4 py-1.5 flex items-center gap-2 bg-[rgb(var(--surface-container)/0.3)]">
            <button
              onClick={() => runQuery()}
              disabled={activeTab.loading || !activeTab.query.trim() || !health.connected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {activeTab.loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {activeTab.loading ? 'Running...' : 'Run'}
              <span className="text-[10px] opacity-60 ml-0.5">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+↵</span>
            </button>
            <div className="w-px h-3.5 bg-[rgb(var(--outline-variant)/0.3)]" />
            {/* Limit toggle */}
            <button
              onClick={() => setLimitRows(!limitRows)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                limitRows
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-[rgb(var(--on-surface-variant)/0.5)] hover:text-[rgb(var(--on-surface-variant))]'
              }`}
              title={limitRows ? 'Limiting results to 100 rows' : 'No row limit'}
            >
              <span className={`inline-block w-6 h-3.5 rounded-full relative transition-colors ${limitRows ? 'bg-amber-500' : 'bg-[rgb(var(--outline-variant))]'} `}>
                <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${limitRows ? 'left-3' : 'left-0.5'}`} />
              </span>
              <span>Limit 100</span>
            </button>
            <div className="w-px h-3.5 bg-[rgb(var(--outline-variant)/0.3)]" />
            <button
              onClick={() => setSaveDialogOpen(true)}
              disabled={!activeTab.query.trim()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 transition-colors"
              title="Save query"
            >
              <Save className="w-3 h-3" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={() => setImportDialogOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Saved queries"
            >
              <FolderOpen className="w-3 h-3" />
              <span className="hidden sm:inline">Saved</span>
            </button>
            <button
              onClick={() => updateTab(activeTab.id, { query: formatSql(activeTab.query, { language: 'redshift', tabWidth: 2, keywordCase: 'upper' }) })}
              disabled={!activeTab.query.trim()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 transition-colors"
              title="Format SQL"
            >
              <Wand2 className="w-3 h-3" />
              <span className="hidden sm:inline">Format</span>
            </button>
            {/* History */}
            <div className="relative">
              <button
                onClick={() => { setHistoryOpen(!historyOpen); setExportOpen(false); }}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Query history"
              >
                <History className="w-3 h-3" />
                <span className="hidden sm:inline">History</span>
              </button>
              {historyOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 max-h-72 overflow-auto rounded-lg bg-[rgb(var(--surface-container))] border border-[rgb(var(--outline-variant)/0.4)] shadow-lg z-50">
                  {historyList.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-[rgb(var(--on-surface-variant)/0.5)]">
                      No query history yet
                    </div>
                  ) : (
                    <>
                      {historyList.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => {
                            updateTab(activeTab.id, { query: entry.query });
                            setHistoryOpen(false);
                            setTimeout(() => editorRef.current?.focus(), 0);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[rgb(var(--surface-container-highest))] border-b border-[rgb(var(--outline-variant)/0.15)] last:border-0"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="text-[10px] text-[rgb(var(--on-surface-variant)/0.6)]">
                              {formatHistoryTimestamp(entry.timestamp)}
                            </span>
                            {entry.executionTime != null && (
                              <span className="text-[10px] text-[rgb(var(--on-surface-variant)/0.4)] ml-auto">
                                {entry.executionTime >= 1000 ? `${(entry.executionTime / 1000).toFixed(1)}s` : `${entry.executionTime}ms`}
                              </span>
                            )}
                            {entry.rowCount != null && (
                              <span className="text-[10px] text-[rgb(var(--on-surface-variant)/0.4)]">
                                {entry.rowCount} rows
                              </span>
                            )}
                          </div>
                          <pre className="text-[11px] text-[rgb(var(--on-surface-variant))] font-mono truncate">
                            {entry.query.replace(/\n/g, ' ').substring(0, 100)}
                          </pre>
                        </button>
                      ))}
                      <button
                        onClick={() => { clearHistory('redshift'); setHistoryList([]); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear History
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-[11px] text-[rgb(var(--on-surface-variant))] hover:text-[rgb(var(--on-surface))] px-2 py-1 rounded hover:bg-[rgb(var(--surface-container-highest))]"
            >
              {showSidebar ? 'Hide' : 'Show'} Schemas
            </button>
            {activeTab.result && (
              <>
                <button
                  onClick={copyCSV}
                  className="flex items-center gap-1 text-[11px] text-[rgb(var(--on-surface-variant))] hover:text-[rgb(var(--on-surface))] px-1.5 py-1 rounded hover:bg-[rgb(var(--surface-container-highest))]"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setExportOpen(!exportOpen); setHistoryOpen(false); }}
                    className="flex items-center gap-1 text-[11px] text-[rgb(var(--on-surface-variant))] hover:text-[rgb(var(--on-surface))] px-1.5 py-1 rounded hover:bg-[rgb(var(--surface-container-highest))]"
                  >
                    <Download className="w-3 h-3" /> Export
                  </button>
                  {exportOpen && (
                    <div className="absolute top-full right-0 mt-1 w-40 rounded-lg bg-[rgb(var(--surface-container))] border border-[rgb(var(--outline-variant)/0.4)] shadow-lg z-50">
                      <button
                        onClick={() => exportAll('csv')}
                        disabled={exporting}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))] rounded-t-lg disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'CSV'}
                      </button>
                      <button
                        onClick={() => exportAll('excel')}
                        disabled={exporting}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))] disabled:opacity-40"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'Excel (.xls)'}
                      </button>
                      <button
                        onClick={() => exportAll('json')}
                        disabled={exporting}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))] rounded-b-lg disabled:opacity-40"
                      >
                        <FileJson className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'JSON'}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (activeTab.result) {
                      sessionStorage.setItem('damya-dashboard-data', JSON.stringify(activeTab.result.rows));
                    }
                    navigate({ to: '/dashboard' });
                  }}
                  className="flex items-center gap-1 text-[11px] text-[rgb(var(--on-surface-variant))] hover:text-violet-400 hover:bg-violet-500/10 px-1.5 py-1 rounded transition-colors"
                  title="Visualize in Dashboard"
                >
                  <BarChart3 className="w-3 h-3" /> Visualize
                </button>
              </>
            )}
          </div>

          {/* Editor + Results */}
          <div ref={editorPanelRef} className="flex-1 flex flex-col overflow-hidden">
            <div style={{ height: `${editorPct}%` }} className="relative bg-[#0a0a0a] shrink-0">
              {/* Highlighted layer */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <SqlHighlight ref={highlightRef} query={activeTab.query} schemas={schemas} />
              </div>
              {/* Transparent textarea on top */}
              <textarea
                key={activeTab.id}
                ref={editorRef}
                value={activeTab.query}
                onChange={(e) => updateTab(activeTab.id, { query: e.target.value })}
                onScroll={() => {
                  if (editorRef.current && highlightRef.current) {
                    highlightRef.current.scrollTop = editorRef.current.scrollTop;
                    highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
                  }
                }}
                className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white font-mono text-sm resize-none outline-none"
                placeholder="SELECT * FROM schema.table LIMIT 100"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
            {/* Draggable divider */}
            <div
              onMouseDown={handleEditorDividerMouseDown}
              className="h-1.5 bg-[rgb(var(--outline-variant)/0.15)] hover:bg-amber-500/40 active:bg-amber-500/60 cursor-row-resize shrink-0 transition-colors flex items-center justify-center"
            >
              <div className="w-8 h-0.5 rounded-full bg-[rgb(var(--outline-variant)/0.3)]" />
            </div>
            <div className="flex-1 overflow-auto p-4 relative">
              {exporting && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgb(var(--surface)/0.85)] backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <p className="text-sm text-amber-300 font-medium">Exporting to {exportFormat}...</p>
                    <p className="text-xs text-[rgb(var(--on-surface-variant))]">Fetching all rows from Redshift</p>
                  </div>
                </div>
              )}
              {activeTab.error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">Query Error</p>
                    <p className="text-xs text-red-400/80 mt-1 font-mono whitespace-pre-wrap">
                      {activeTab.error}
                    </p>
                  </div>
                </div>
              )}
              {activeTab.result && activeTab.result.rows.length > 0 && (() => {
                const rows = activeTab.result.rows;
                const pageRowStart = resultPage * PAGE_SIZE;
                const totalPages = totalRows !== null ? Math.max(1, Math.ceil(totalRows / PAGE_SIZE)) : (rows.length >= PAGE_SIZE ? resultPage + 2 : resultPage + 1);
                const showPagination = !limitRows;

                return (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-[rgb(var(--on-surface-variant))]">
                      {totalRows !== null ? `${totalRows.toLocaleString()} rows` : `${rows.length} rows`}
                    </span>
                    {activeTab.executionTime !== null && (
                      <span className="flex items-center gap-1 text-xs text-[rgb(var(--on-surface-variant))]">
                        <Clock className="w-3 h-3" />
                        {(activeTab.executionTime / 1000).toFixed(2)}s
                      </span>
                    )}
                    {showPagination && (
                      <span className="text-xs text-amber-400/60">
                        Rows {pageRowStart + 1}–{pageRowStart + rows.length}
                      </span>
                    )}
                    <div className="flex-1" />
                    {showPagination && totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => runQuery(resultPage - 1)}
                          disabled={resultPage === 0 || activeTab.loading}
                          className="flex items-center p-1 rounded text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => {
                          if (totalPages <= 7 || i === 0 || i === totalPages - 1 || Math.abs(i - resultPage) <= 1) {
                            return (
                              <button
                                key={i}
                                onClick={() => runQuery(i)}
                                disabled={activeTab.loading}
                                className={`w-6 h-6 rounded text-[11px] font-medium transition-colors disabled:opacity-30 ${
                                  i === resultPage
                                    ? 'bg-amber-500 text-black'
                                    : 'text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))]'
                                }`}
                              >
                                {i + 1}
                              </button>
                            );
                          }
                          if (i === 1 && resultPage > 2) return <span key="e1" className="text-[10px] text-[rgb(var(--on-surface-variant)/0.3)]">...</span>;
                          if (i === totalPages - 2 && resultPage < totalPages - 3) return <span key="e2" className="text-[10px] text-[rgb(var(--on-surface-variant)/0.3)]">...</span>;
                          return null;
                        })}
                        <button
                          onClick={() => runQuery(resultPage + 1)}
                          disabled={resultPage >= totalPages - 1 || activeTab.loading}
                          className="flex items-center p-1 rounded text-xs text-[rgb(var(--on-surface-variant))] hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-auto rounded-lg border border-[rgb(var(--outline-variant)/0.3)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[rgb(var(--surface-container-highest))]">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-[rgb(var(--on-surface-variant)/0.5)] whitespace-nowrap border-b border-[rgb(var(--outline-variant)/0.3)] w-10">
                            #
                          </th>
                          {activeTab.result.columns.map((col) => (
                            <th
                              key={col}
                              className="text-left px-3 py-2 text-xs font-semibold text-[rgb(var(--on-surface-variant))] whitespace-nowrap border-b border-[rgb(var(--outline-variant)/0.3)]"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr
                            key={i}
                            className="hover:bg-[rgb(var(--surface-container)/0.5)] border-b border-[rgb(var(--outline-variant)/0.15)] last:border-0"
                          >
                            <td className="px-3 py-1.5 text-[10px] text-[rgb(var(--on-surface-variant)/0.3)] font-mono select-none">
                              {pageRowStart + i + 1}
                            </td>
                            {activeTab.result!.columns.map((col) => (
                              <td
                                key={col}
                                className="px-3 py-1.5 text-xs text-[rgb(var(--on-surface))] whitespace-nowrap max-w-[300px] truncate font-mono"
                                title={String(row[col] ?? '')}
                              >
                                {String(row[col] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}
              {activeTab.result && activeTab.result.rows.length === 0 && !activeTab.error && (
                <div className="text-center py-8 text-[rgb(var(--on-surface-variant))]">
                  <p className="text-sm">Query executed successfully</p>
                  <p className="text-xs mt-1">0 rows returned</p>
                </div>
              )}
              {activeTab.loading && (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span className="text-sm text-[rgb(var(--on-surface-variant))]">Executing query...</span>
                </div>
              )}
              {!activeTab.result && !activeTab.error && !activeTab.loading && (
                <div className="flex flex-col items-center justify-center py-16 text-[rgb(var(--on-surface-variant)/0.5)]">
                  <Database className="w-10 h-10 mb-3" />
                  <p className="text-sm">Write a query and press Run</p>
                  <p className="text-xs mt-1">
                    {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to execute
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        queryText={activeTab.query}
        queryType="redshift"
      />
      <ImportQueryDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onQuerySelect={handleLoadSavedQuery}
        queryType="redshift"
      />
    </div>
  );
}
