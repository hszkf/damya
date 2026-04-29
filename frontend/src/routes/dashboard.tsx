import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Save, Trash2, Edit3, X, BarChart3, Database, Settings2,
} from "lucide-react";
import { StudioNav } from "~/components/studio-nav";
import { ChartRenderer } from "~/components/dashboard/ChartRenderer";
import { ChartBuilder } from "~/components/dashboard/ChartBuilder";
import {
  loadCurrentDashboard, saveDashboard, deleteDashboard, createEmptyDashboard,
  getSavedDashboards, setCurrentDashboardId, calculateNewWidgetLayout, generateId,
} from "~/lib/dashboard/storage";
import type { DashboardConfig, ChartConfig, WidgetLayout } from "~/lib/dashboard/types";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const SESSION_KEY = "damya-dashboard-data";

function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [dashboardList, setDashboardList] = useState<DashboardConfig[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load dashboard + session data
  useEffect(() => {
    const dash = loadCurrentDashboard();
    setDashboard(dash);
    setDashboardList(getSavedDashboards());

    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!dashboard) return;
    saveDashboard(dashboard);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setDashboardList(getSavedDashboards());
  }, [dashboard]);

  const handleAddChart = useCallback((chart: ChartConfig) => {
    if (!dashboard) return;
    const layoutItem = calculateNewWidgetLayout(dashboard.layout, chart.type);
    layoutItem.i = chart.id;
    setDashboard({
      ...dashboard,
      charts: [...dashboard.charts, chart],
      layout: [...dashboard.layout, layoutItem],
    });
  }, [dashboard]);

  const handleUpdateChart = useCallback((chart: ChartConfig) => {
    if (!dashboard) return;
    setDashboard({
      ...dashboard,
      charts: dashboard.charts.map((c) => (c.id === chart.id ? chart : c)),
    });
  }, [dashboard]);

  const handleDeleteChart = useCallback((chartId: string) => {
    if (!dashboard) return;
    setDashboard({
      ...dashboard,
      charts: dashboard.charts.filter((c) => c.id !== chartId),
      layout: dashboard.layout.filter((l) => l.i !== chartId),
    });
  }, [dashboard]);

  const handleNewDashboard = () => {
    const newDash = createEmptyDashboard();
    saveDashboard(newDash);
    setCurrentDashboardId(newDash.id);
    setDashboard(newDash);
    setDashboardList(getSavedDashboards());
  };

  const handleSwitchDashboard = (id: string) => {
    setCurrentDashboardId(id);
    const all = getSavedDashboards();
    const found = all.find((d) => d.id === id);
    if (found) setDashboard(found);
    setDashboardList(all);
  };

  const handleDeleteDashboard = () => {
    if (!dashboard || dashboardList.length <= 1) return;
    deleteDashboard(dashboard.id);
    const remaining = getSavedDashboards();
    if (remaining.length > 0) {
      setCurrentDashboardId(remaining[0].id);
      setDashboard(remaining[0]);
    }
    setDashboardList(remaining);
  };

  // Drag to resize widgets
  const handleWidgetResize = useCallback((chartId: string, newSize: { w: number; h: number }) => {
    if (!dashboard) return;
    setDashboard({
      ...dashboard,
      layout: dashboard.layout.map((l) =>
        l.i === chartId ? { ...l, w: newSize.w, h: newSize.h } : l
      ),
    });
  }, [dashboard]);

  if (!dashboard) {
    return (
      <div className="h-screen flex flex-col bg-[rgb(var(--surface))]">
        <StudioNav />
        <div className="flex-1 flex items-center justify-center text-[rgb(var(--on-surface-variant)/0.4)] text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[rgb(var(--surface))]">
      <StudioNav
        rightSlot={
          <div className="flex items-center gap-2 px-2">
            <select
              value={dashboard.id}
              onChange={(e) => handleSwitchDashboard(e.target.value)}
              className="text-[11px] bg-transparent text-[rgb(var(--on-surface-variant))] border border-[rgb(var(--outline-variant)/0.3)] rounded px-1.5 py-0.5"
            >
              {dashboardList.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgb(var(--outline-variant)/0.3)] bg-[rgb(var(--surface-container)/0.3)]">
        <input
          type="text"
          value={dashboard.name}
          onChange={(e) => setDashboard({ ...dashboard, name: e.target.value })}
          className="text-sm font-medium bg-transparent text-[rgb(var(--on-surface))] border-none outline-none focus:ring-0"
          style={{ width: `${Math.max(100, dashboard.name.length * 8)}px` }}
        />
        <span className="text-[10px] text-[rgb(var(--on-surface-variant)/0.4)]">
          {dashboard.charts.length} chart{dashboard.charts.length !== 1 ? "s" : ""}
          {data.length > 0 && ` · ${data.length} rows`}
        </span>
        <div className="flex-1" />
        {data.length === 0 && (
          <span className="text-[10px] text-amber-400/60 flex items-center gap-1">
            <Database className="w-3 h-3" />
            Run a query first, then click "Visualize"
          </span>
        )}
        <button
          onClick={() => { setEditingChart(null); setBuilderOpen(true); }}
          disabled={data.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Chart
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
        >
          <Save className="w-3 h-3" />
          {saved ? "Saved!" : "Save"}
        </button>
        <button
          onClick={handleNewDashboard}
          className="p-1 rounded hover:bg-[rgb(var(--surface-container-highest))] text-[rgb(var(--on-surface-variant)/0.5)] hover:text-[rgb(var(--on-surface))]"
          title="New dashboard"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {dashboardList.length > 1 && (
          <button
            onClick={handleDeleteDashboard}
            className="p-1 rounded hover:bg-red-500/10 text-[rgb(var(--on-surface-variant)/0.5)] hover:text-red-400"
            title="Delete dashboard"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Grid area */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={gridRef} className="absolute inset-0 overflow-auto p-4">
          {dashboard.charts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--on-surface-variant)/0.4)]">
              <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No charts yet</p>
              {data.length > 0 ? (
                <p className="text-xs mt-1">Click "Add Chart" to get started</p>
              ) : (
                <p className="text-xs mt-1">Run a SQL query, then click "Visualize" in the results toolbar</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-3 auto-rows-[50px]">
              {dashboard.charts.map((chart) => {
                const layout = dashboard.layout.find((l) => l.i === chart.id);
                const w = layout?.w ?? 6;
                const h = layout?.h ?? 6;
                return (
                  <div
                    key={chart.id}
                    className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3 bg-[rgb(var(--surface-container)/0.5)] border border-[rgb(var(--outline-variant)/0.3)] rounded-lg overflow-hidden relative group"
                    style={{
                      gridColumn: `span ${Math.min(w, 12)}`,
                      gridRow: `span ${h}`,
                      minHeight: `${h * 50}px`,
                    }}
                  >
                    <ChartRenderer chart={chart} data={data} />
                    {/* Hover controls */}
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingChart(chart); setBuilderOpen(true); }}
                        className="p-1 rounded bg-[rgb(var(--surface-container))] border border-[rgb(var(--outline-variant)/0.3)] text-[rgb(var(--on-surface-variant))] hover:text-violet-400"
                        title="Edit"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteChart(chart.id)}
                        className="p-1 rounded bg-[rgb(var(--surface-container))] border border-[rgb(var(--outline-variant)/0.3)] text-[rgb(var(--on-surface-variant))] hover:text-red-400"
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart Builder panel */}
        <ChartBuilder
          open={builderOpen}
          onClose={() => { setBuilderOpen(false); setEditingChart(null); }}
          onSave={editingChart ? handleUpdateChart : handleAddChart}
          editingChart={editingChart}
          data={data}
        />
      </div>
    </div>
  );
}
