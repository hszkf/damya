/**
 * Dashboard Types - Power BI-style dashboard configuration
 */

// ============================================
// Aggregation Types
// ============================================
export type AggregationType = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" | "NONE";

export interface AggregatedField {
  column: string;
  aggregation: AggregationType;
  alias?: string;
}

// ============================================
// Field Configuration
// ============================================
export type DataType = "string" | "number" | "date" | "boolean";

export interface FieldConfig {
  column: string;
  dataType: DataType;
}

export interface ChartFieldMapping {
  xAxis: FieldConfig | null;
  yAxis: AggregatedField[];
  legend: FieldConfig | null;
  values: AggregatedField[];
  tooltipFields: FieldConfig[];
}

// ============================================
// Chart Configuration
// ============================================
export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "donut"
  | "area"
  | "scatter"
  | "gauge"
  | "kpi"
  | "table";

export interface ChartOptions {
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  showDataLabels: boolean;
  stacked?: boolean;
  smooth?: boolean;
  innerRadius?: number;
  gaugeMin?: number;
  gaugeMax?: number;
  gaugeValue?: string;
  kpiFormat?: "number" | "currency" | "percentage";
  kpiPrefix?: string;
  kpiSuffix?: string;
  kpiCompareField?: string;
  orientation?: "vertical" | "horizontal";
}

export interface ChartConfig {
  id: string;
  name: string;
  type: ChartType;
  tableId: string;
  fields: ChartFieldMapping;
  colours: string[];
  options: ChartOptions;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Dashboard Layout (react-grid-layout compatible)
// ============================================
export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface DashboardConfig {
  id: string;
  name: string;
  charts: ChartConfig[];
  layout: WidgetLayout[];
  gridCols: number;
  rowHeight: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Drag-and-Drop Types
// ============================================
export type DropZoneType = "xAxis" | "yAxis" | "legend" | "values";

export interface DragItem {
  type: "field";
  column: string;
  dataType: DataType;
  sourceTable: string;
}

export interface DropResult {
  zone: DropZoneType;
  field: DragItem;
}

// ============================================
// Chart Builder State
// ============================================
export interface ChartBuilderState {
  selectedTable: string | null;
  chartType: ChartType;
  chartName: string;
  fields: ChartFieldMapping;
  options: ChartOptions;
  colours: string[];
  isDirty: boolean;
}

// ============================================
// Chart Data Point (for rendering)
// ============================================
export interface ChartDataPoint {
  label: string;
  value: number;
  colour?: string;
  [key: string]: unknown;
}

export interface ScatterDataPoint {
  x: number;
  y: number;
  label?: string;
  colour?: string;
}

// ============================================
// Default Values
// ============================================
export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  showLegend: true,
  showGrid: true,
  showTooltip: true,
  showDataLabels: false,
  stacked: false,
  smooth: false,
  innerRadius: 0.6,
  gaugeMin: 0,
  gaugeMax: 100,
  kpiFormat: "number",
  orientation: "vertical",
};

export const DEFAULT_FIELD_MAPPING: ChartFieldMapping = {
  xAxis: null,
  yAxis: [],
  legend: null,
  values: [],
  tooltipFields: [],
};

export const CHART_COLOURS = [
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#6366f1", // Indigo
];

export const CHART_TYPE_INFO: Record<ChartType, { label: string; icon: string; description: string }> = {
  bar: { label: "Bar Chart", icon: "BarChart3", description: "Compare values across categories" },
  line: { label: "Line Chart", icon: "LineChart", description: "Show trends over time" },
  area: { label: "Area Chart", icon: "AreaChart", description: "Show volume over time" },
  pie: { label: "Pie Chart", icon: "PieChart", description: "Show proportions of a whole" },
  donut: { label: "Donut Chart", icon: "Circle", description: "Show proportions with centre space" },
  scatter: { label: "Scatter Plot", icon: "ScatterChart", description: "Show correlation between values" },
  gauge: { label: "Gauge", icon: "Gauge", description: "Show a single value against a target" },
  kpi: { label: "KPI Card", icon: "Hash", description: "Display key metrics prominently" },
  table: { label: "Table", icon: "Table", description: "Show data in tabular format" },
};

// ============================================
// Dashboard Action Types (for reducer)
// ============================================
export type DashboardAction =
  | { type: "ADD_CHART"; payload: ChartConfig }
  | { type: "UPDATE_CHART"; payload: ChartConfig }
  | { type: "DELETE_CHART"; payload: string }
  | { type: "DUPLICATE_CHART"; payload: string }
  | { type: "UPDATE_LAYOUT"; payload: WidgetLayout[] }
  | { type: "SELECT_CHART"; payload: string | null }
  | { type: "OPEN_BUILDER"; payload?: ChartConfig }
  | { type: "CLOSE_BUILDER" }
  | { type: "LOAD_DASHBOARD"; payload: DashboardConfig }
  | { type: "RESET_LAYOUT" }
  | { type: "SET_DASHBOARD_NAME"; payload: string };

export interface DashboardState {
  dashboard: DashboardConfig;
  selectedChartId: string | null;
  isBuilderOpen: boolean;
  editingChart: ChartConfig | null;
}
