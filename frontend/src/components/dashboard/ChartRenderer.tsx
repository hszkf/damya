import React, { useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ChartConfig, ChartDataPoint } from "~/lib/dashboard/types";
import { transformToChartData, transformToMultiSeriesData, aggregate, formatValue } from "~/lib/dashboard/aggregations";
import { CHART_COLOURS } from "~/lib/dashboard/types";

interface ChartRendererProps {
  chart: ChartConfig;
  data: Record<string, unknown>[];
}

export function ChartRenderer({ chart, data }: ChartRendererProps) {
  const { type, fields, colours, options, name } = chart;

  const chartData = useMemo(() => {
    if (!fields.xAxis || fields.yAxis.length === 0) return [];
    return transformToChartData(data, fields.xAxis.column, fields.yAxis, colours.length > 0 ? colours : CHART_COLOURS);
  }, [data, fields, colours]);

  const multiSeries = useMemo(() => {
    if (!fields.xAxis || fields.yAxis.length === 0) return { labels: [], series: [] };
    return transformToMultiSeriesData(data, fields.xAxis.column, fields.yAxis, colours.length > 0 ? colours : CHART_COLOURS);
  }, [data, fields, colours]);

  if (!fields.xAxis || fields.yAxis.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[rgb(var(--on-surface-variant)/0.4)] text-xs">
        Configure fields to see chart
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[rgb(var(--on-surface-variant)/0.4)] text-xs">
        No data
      </div>
    );
  }

  const palette = colours.length > 0 ? colours : CHART_COLOURS;

  switch (type) {
    case "bar":
      return (
        <div className="w-full h-full flex flex-col">
          {options.showLegend !== false && <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 truncate">{name}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={multiSeries.labels.map((label, i) => {
              const point: Record<string, unknown> = { name: label };
              multiSeries.series.forEach((s) => { point[s.name] = s.data[i]; });
              return point;
            })}>
              {options.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              {options.showTooltip !== false && <Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />}
              {options.showLegend !== false && multiSeries.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {multiSeries.series.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={palette[i % palette.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case "line":
      return (
        <div className="w-full h-full flex flex-col">
          {options.showLegend !== false && <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 truncate">{name}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={multiSeries.labels.map((label, i) => {
              const point: Record<string, unknown> = { name: label };
              multiSeries.series.forEach((s) => { point[s.name] = s.data[i]; });
              return point;
            })}>
              {options.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              {options.showTooltip !== false && <Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />}
              {options.showLegend !== false && multiSeries.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {multiSeries.series.map((s, i) => (
                <Line key={s.name} type={options.smooth ? "monotone" : "linear"} dataKey={s.name} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case "area":
      return (
        <div className="w-full h-full flex flex-col">
          {options.showLegend !== false && <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 truncate">{name}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={multiSeries.labels.map((label, i) => {
              const point: Record<string, unknown> = { name: label };
              multiSeries.series.forEach((s) => { point[s.name] = s.data[i]; });
              return point;
            })}>
              {options.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
              {options.showTooltip !== false && <Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />}
              {options.showLegend !== false && multiSeries.series.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              {multiSeries.series.map((s, i) => (
                <Area key={s.name} type={options.smooth ? "monotone" : "linear"} dataKey={s.name} stroke={palette[i % palette.length]} fill={palette[i % palette.length]} fillOpacity={0.2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case "pie":
    case "donut":
      return (
        <div className="w-full h-full flex flex-col">
          {options.showLegend !== false && <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 truncate">{name}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={type === "donut" ? "40%" : 0}
                outerRadius="70%"
                paddingAngle={2}
                label={options.showDataLabels ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
              >
                {chartData.map((_entry: ChartDataPoint, i: number) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              {options.showTooltip !== false && <Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />}
              {options.showLegend !== false && <Legend wrapperStyle={{ fontSize: 10 }} />}
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case "scatter":
      return (
        <div className="w-full h-full flex flex-col">
          {options.showLegend !== false && <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 truncate">{name}</p>}
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              {options.showGrid !== false && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
              <XAxis dataKey="x" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} name={fields.xAxis.column} />
              <YAxis dataKey="y" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} name={fields.yAxis[0]?.column ?? "y"} />
              {options.showTooltip !== false && <Tooltip contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />}
              <Scatter
                data={data.map((row) => ({
                  x: Number(row[fields.xAxis!.column]) || 0,
                  y: Number(row[fields.yAxis[0]?.column]) || 0,
                }))}
                fill={palette[0]}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );

    case "kpi": {
      const val = fields.yAxis[0] ? aggregate(data, fields.yAxis[0]) : 0;
      const fmt = options.kpiFormat || "number";
      const formatted = formatValue(val, fmt, options.kpiPrefix, options.kpiSuffix);
      return (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <p className="text-xs text-[rgb(var(--on-surface-variant)/0.6)] truncate max-w-full px-2">{name}</p>
          <p className="text-3xl font-bold text-[rgb(var(--on-surface))]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatted}
          </p>
          {fields.yAxis[0] && (
            <p className="text-[10px] text-[rgb(var(--on-surface-variant)/0.4)]">
              {fields.yAxis[0].aggregation} of {fields.yAxis[0].column}
            </p>
          )}
        </div>
      );
    }

    case "gauge": {
      const gaugeVal = fields.yAxis[0] ? aggregate(data, fields.yAxis[0]) : 0;
      const min = options.gaugeMin ?? 0;
      const max = options.gaugeMax ?? 100;
      const pct = Math.min(1, Math.max(0, (gaugeVal - min) / (max - min)));
      const angle = pct * 180;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <p className="text-xs text-[rgb(var(--on-surface-variant)/0.6)] truncate max-w-full px-2">{name}</p>
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
            <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={palette[0]} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${pct * 157} 157`} />
          </svg>
          <p className="text-lg font-bold text-[rgb(var(--on-surface))]">{formatValue(gaugeVal, options.kpiFormat || "number", options.kpiPrefix, options.kpiSuffix)}</p>
        </div>
      );
    }

    case "table":
      return (
        <div className="w-full h-full flex flex-col overflow-hidden">
          <p className="text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1 px-1 shrink-0 truncate">{name}</p>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[rgb(var(--surface-container-highest))]">
                  {fields.yAxis.map((f) => (
                    <th key={f.column} className="text-left px-2 py-1 text-[10px] font-semibold text-[rgb(var(--on-surface-variant))] whitespace-nowrap">
                      {formatValue !== undefined ? `${f.aggregation}(${f.column})` : f.column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} className="border-b border-[rgb(var(--outline-variant)/0.1)] hover:bg-[rgb(var(--surface-container)/0.5)]">
                    <td className="px-2 py-1 text-[rgb(var(--on-surface-variant))]">{row.label}</td>
                    <td className="px-2 py-1 text-[rgb(var(--on-surface))] font-mono">{typeof row.value === "number" ? row.value.toLocaleString() : row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    default:
      return <div className="flex items-center justify-center h-full text-xs text-[rgb(var(--on-surface-variant)/0.4)]">Unknown chart type</div>;
  }
}
