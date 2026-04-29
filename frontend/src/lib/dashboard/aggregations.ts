/**
 * Aggregation functions for dashboard charts
 */

import type { AggregationType, AggregatedField, ChartDataPoint, DataType } from "./types";

/**
 * Aggregate a single field across all rows
 */
export function aggregate(
  rows: Record<string, unknown>[],
  field: AggregatedField
): number {
  const values = rows
    .map((row) => {
      const val = row[field.column];
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter((v): v is number => v !== null);

  if (values.length === 0) return 0;

  switch (field.aggregation) {
    case "SUM":
      return values.reduce((a, b) => a + b, 0);
    case "COUNT":
      return values.length;
    case "AVG":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "MIN":
      return Math.min(...values);
    case "MAX":
      return Math.max(...values);
    case "NONE":
    default:
      return values[0] ?? 0;
  }
}

/**
 * Group rows by a field and aggregate measures
 */
export function aggregateByGroup(
  rows: Record<string, unknown>[],
  groupByField: string,
  measures: AggregatedField[]
): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  // Group rows by the groupBy field
  rows.forEach((row) => {
    const key = String(row[groupByField] ?? "(empty)");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  // Aggregate each group
  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const result: Record<string, unknown> = { [groupByField]: key };
    measures.forEach((measure) => {
      const alias = measure.alias || `${measure.aggregation.toLowerCase()}_${measure.column}`;
      result[alias] = aggregate(groupRows, measure);
    });
    return result;
  });
}

/**
 * Transform raw table data into chart data points
 */
export function transformToChartData(
  rows: Record<string, unknown>[],
  xAxisColumn: string,
  yAxisMeasures: AggregatedField[],
  colours: string[]
): ChartDataPoint[] {
  if (!xAxisColumn || yAxisMeasures.length === 0) return [];

  const aggregatedData = aggregateByGroup(rows, xAxisColumn, yAxisMeasures);

  return aggregatedData.map((row, index) => {
    const measure = yAxisMeasures[0];
    const alias = measure.alias || `${measure.aggregation.toLowerCase()}_${measure.column}`;
    return {
      label: String(row[xAxisColumn]),
      value: Number(row[alias]) || 0,
      colour: colours[index % colours.length],
    };
  });
}

/**
 * Get multiple series data for stacked/grouped charts
 */
export function transformToMultiSeriesData(
  rows: Record<string, unknown>[],
  xAxisColumn: string,
  yAxisMeasures: AggregatedField[],
  colours: string[]
): { labels: string[]; series: { name: string; data: number[]; colour: string }[] } {
  if (!xAxisColumn || yAxisMeasures.length === 0) {
    return { labels: [], series: [] };
  }

  const aggregatedData = aggregateByGroup(rows, xAxisColumn, yAxisMeasures);
  const labels = aggregatedData.map((row) => String(row[xAxisColumn]));

  const series = yAxisMeasures.map((measure, index) => {
    const alias = measure.alias || `${measure.aggregation.toLowerCase()}_${measure.column}`;
    return {
      name: alias,
      data: aggregatedData.map((row) => Number(row[alias]) || 0),
      colour: colours[index % colours.length],
    };
  });

  return { labels, series };
}

/**
 * Infer the data type of a column from sample values
 */
export function inferColumnType(
  rows: Record<string, unknown>[],
  column: string
): DataType {
  const sample = rows.slice(0, 20).map((r) => r[column]).filter((v) => v != null);

  if (sample.length === 0) return "string";

  // Check for numbers
  const numericCount = sample.filter((v) => {
    if (typeof v === "number") return true;
    if (typeof v === "string") {
      const trimmed = v.trim();
      return trimmed !== "" && !isNaN(Number(trimmed));
    }
    return false;
  }).length;

  if (numericCount > sample.length * 0.8) return "number";

  // Check for dates
  const dateCount = sample.filter((v) => {
    if (v instanceof Date) return true;
    if (typeof v === "string") {
      const parsed = Date.parse(v);
      return !isNaN(parsed) && v.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/);
    }
    return false;
  }).length;

  if (dateCount > sample.length * 0.8) return "date";

  // Check for booleans
  const boolCount = sample.filter((v) => {
    if (typeof v === "boolean") return true;
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      return lower === "true" || lower === "false" || lower === "yes" || lower === "no";
    }
    return false;
  }).length;

  if (boolCount > sample.length * 0.8) return "boolean";

  return "string";
}

/**
 * Get suggested aggregation for a data type
 */
export function suggestAggregation(dataType: DataType): AggregationType {
  return dataType === "number" ? "SUM" : "COUNT";
}

/**
 * Format aggregation display name
 */
export function formatAggregationName(column: string, aggregation: AggregationType): string {
  const prefix = {
    SUM: "Sum of",
    COUNT: "Count of",
    AVG: "Average of",
    MIN: "Min of",
    MAX: "Max of",
    NONE: "",
  }[aggregation];

  return prefix ? `${prefix} ${column}` : column;
}

/**
 * Calculate statistics for a numeric column
 */
export function calculateColumnStats(
  rows: Record<string, unknown>[],
  column: string
): { min: number; max: number; avg: number; sum: number; count: number } {
  const values = rows
    .map((row) => {
      const val = row[column];
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    sum,
    count: values.length,
  };
}

/**
 * Format a value for display based on options
 */
export function formatValue(
  value: number,
  format: "number" | "currency" | "percentage" = "number",
  prefix = "",
  suffix = ""
): string {
  let formatted: string;

  switch (format) {
    case "currency":
      formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      break;
    case "percentage":
      formatted = `${(value * 100).toFixed(1)}%`;
      break;
    case "number":
    default:
      if (value >= 1000000) {
        formatted = `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        formatted = `${(value / 1000).toFixed(1)}K`;
      } else {
        formatted = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
      }
  }

  return `${prefix}${formatted}${suffix}`;
}
