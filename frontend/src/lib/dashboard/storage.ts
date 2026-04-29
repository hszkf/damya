/**
 * Dashboard storage utilities - persist dashboard layouts to localStorage
 */

import type { DashboardConfig, ChartConfig, WidgetLayout } from "./types";

const STORAGE_KEY = "sql-studio-dashboards";
const CURRENT_DASHBOARD_KEY = "sql-studio-current-dashboard";

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new empty dashboard
 */
export function createEmptyDashboard(name = "My Dashboard"): DashboardConfig {
  return {
    id: generateId(),
    name,
    charts: [],
    layout: [],
    gridCols: 12,
    rowHeight: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get all saved dashboards from localStorage
 */
export function getSavedDashboards(): DashboardConfig[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const dashboards = JSON.parse(stored) as DashboardConfig[];
    return dashboards.map((d) => ({
      ...d,
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
      charts: d.charts.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      })),
    }));
  } catch {
    console.error("Failed to load dashboards from localStorage");
    return [];
  }
}

/**
 * Save dashboards to localStorage
 */
export function saveDashboards(dashboards: DashboardConfig[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
  } catch {
    console.error("Failed to save dashboards to localStorage");
  }
}

/**
 * Save a single dashboard (update if exists, create if new)
 */
export function saveDashboard(dashboard: DashboardConfig): void {
  const dashboards = getSavedDashboards();
  const index = dashboards.findIndex((d) => d.id === dashboard.id);

  const updatedDashboard = {
    ...dashboard,
    updatedAt: new Date(),
  };

  if (index >= 0) {
    dashboards[index] = updatedDashboard;
  } else {
    dashboards.push(updatedDashboard);
  }

  saveDashboards(dashboards);
}

/**
 * Delete a dashboard
 */
export function deleteDashboard(dashboardId: string): void {
  const dashboards = getSavedDashboards();
  const filtered = dashboards.filter((d) => d.id !== dashboardId);
  saveDashboards(filtered);
}

/**
 * Get the current active dashboard ID
 */
export function getCurrentDashboardId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_DASHBOARD_KEY);
}

/**
 * Set the current active dashboard ID
 */
export function setCurrentDashboardId(dashboardId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENT_DASHBOARD_KEY, dashboardId);
}

/**
 * Load the current dashboard (or create a new one if none exists)
 */
export function loadCurrentDashboard(): DashboardConfig {
  const currentId = getCurrentDashboardId();
  const dashboards = getSavedDashboards();

  if (currentId) {
    const current = dashboards.find((d) => d.id === currentId);
    if (current) return current;
  }

  // Return first dashboard or create new
  if (dashboards.length > 0) {
    setCurrentDashboardId(dashboards[0].id);
    return dashboards[0];
  }

  const newDashboard = createEmptyDashboard();
  saveDashboard(newDashboard);
  setCurrentDashboardId(newDashboard.id);
  return newDashboard;
}

/**
 * Calculate default layout position for a new chart
 */
export function calculateNewWidgetLayout(
  existingLayout: WidgetLayout[],
  chartType: string
): WidgetLayout {
  // Default sizes based on chart type
  const defaultSizes: Record<string, { w: number; h: number }> = {
    bar: { w: 6, h: 6 },
    line: { w: 6, h: 6 },
    area: { w: 6, h: 6 },
    pie: { w: 4, h: 6 },
    donut: { w: 4, h: 6 },
    scatter: { w: 6, h: 6 },
    gauge: { w: 3, h: 4 },
    kpi: { w: 3, h: 3 },
    table: { w: 8, h: 6 },
  };

  const size = defaultSizes[chartType] || { w: 6, h: 6 };

  // Find the next available position
  let y = 0;
  if (existingLayout.length > 0) {
    const maxY = Math.max(...existingLayout.map((l) => l.y + l.h));
    y = maxY;
  }

  return {
    i: generateId(),
    x: 0,
    y,
    w: size.w,
    h: size.h,
    minW: 2,
    minH: 2,
  };
}

/**
 * Duplicate a chart with a new ID
 */
export function duplicateChart(chart: ChartConfig): ChartConfig {
  return {
    ...chart,
    id: generateId(),
    name: `${chart.name} (Copy)`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Export dashboard as JSON
 */
export function exportDashboard(dashboard: DashboardConfig): string {
  return JSON.stringify(dashboard, null, 2);
}

/**
 * Import dashboard from JSON
 */
export function importDashboard(json: string): DashboardConfig | null {
  try {
    const dashboard = JSON.parse(json) as DashboardConfig;
    // Assign new IDs to avoid conflicts
    dashboard.id = generateId();
    dashboard.charts = dashboard.charts.map((c) => ({
      ...c,
      id: generateId(),
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    }));
    dashboard.layout = dashboard.layout.map((l, i) => ({
      ...l,
      i: dashboard.charts[i]?.id || generateId(),
    }));
    dashboard.createdAt = new Date();
    dashboard.updatedAt = new Date();
    return dashboard;
  } catch {
    console.error("Failed to import dashboard");
    return null;
  }
}
