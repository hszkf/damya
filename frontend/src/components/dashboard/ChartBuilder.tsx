import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { ChartType, ChartConfig, ChartFieldMapping, ChartOptions, FieldConfig, AggregatedField, DataType } from "~/lib/dashboard/types";
import { DEFAULT_CHART_OPTIONS, DEFAULT_FIELD_MAPPING, CHART_TYPE_INFO, CHART_COLOURS } from "~/lib/dashboard/types";
import { inferColumnType, suggestAggregation } from "~/lib/dashboard/aggregations";
import { generateId, calculateNewWidgetLayout } from "~/lib/dashboard/storage";

interface ChartBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (chart: ChartConfig) => void;
  editingChart: ChartConfig | null;
  data: Record<string, unknown>[];
}

const CHART_ICONS: Record<string, string> = {
  bar: "█", line: "╱", area: "▁", pie: "◉", donut: "◎", scatter: "•", gauge: "⊘", kpi: "#", table: "☷",
};

export function ChartBuilder({ open, onClose, onSave, editingChart, data }: ChartBuilderProps) {
  const [chartName, setChartName] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [fields, setFields] = useState<ChartFieldMapping>({ ...DEFAULT_FIELD_MAPPING });
  const [options, setOptions] = useState<ChartOptions>({ ...DEFAULT_CHART_OPTIONS });

  useEffect(() => {
    if (open) {
      if (editingChart) {
        setChartName(editingChart.name);
        setChartType(editingChart.type);
        setFields({ ...editingChart.fields });
        setOptions({ ...editingChart.options });
      } else {
        setChartName("");
        setChartType("bar");
        setFields({ ...DEFAULT_FIELD_MAPPING });
        setOptions({ ...DEFAULT_CHART_OPTIONS });
      }
    }
  }, [open, editingChart]);

  const columns = React.useMemo(() => {
    if (data.length === 0) return [];
    const cols = Object.keys(data[0]);
    return cols.map((col) => ({ column: col, dataType: inferColumnType(data, col) as DataType }));
  }, [data]);

  const handleAddYAxis = (column: string, dataType: DataType) => {
    const agg = suggestAggregation(dataType);
    const newField: AggregatedField = { column, aggregation: agg, alias: `${agg.toLowerCase()}_${column}` };
    setFields((prev) => ({ ...prev, yAxis: [...prev.yAxis, newField] }));
  };

  const handleRemoveYAxis = (index: number) => {
    setFields((prev) => ({ ...prev, yAxis: prev.yAxis.filter((_, i) => i !== index) }));
  };

  const handleSave = () => {
    if (!chartName.trim() || !fields.xAxis || fields.yAxis.length === 0) return;

    const chart: ChartConfig = editingChart
      ? { ...editingChart, name: chartName.trim(), type: chartType, fields, options, updatedAt: new Date() }
      : {
          id: generateId(),
          name: chartName.trim(),
          type: chartType,
          tableId: "query-result",
          fields,
          colours: CHART_COLOURS,
          options,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

    onSave(chart);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-[rgb(var(--surface-container))] border-l border-[rgb(var(--outline-variant)/0.3)] flex flex-col z-30 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--outline-variant)/0.3)]">
        <h3 className="text-sm font-semibold text-[rgb(var(--on-surface))]">
          {editingChart ? "Edit Chart" : "Add Chart"}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[rgb(var(--surface-container-highest))] text-[rgb(var(--on-surface-variant))]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Chart Name */}
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1">Chart Name</label>
          <input
            type="text"
            value={chartName}
            onChange={(e) => setChartName(e.target.value)}
            placeholder="My Chart"
            className="w-full px-2.5 py-1.5 rounded-md text-xs bg-[rgb(var(--surface))] text-[rgb(var(--on-surface))] border border-[rgb(var(--outline-variant)/0.4)] focus:outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Chart Type */}
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1.5">Chart Type</label>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`flex flex-col items-center gap-0.5 p-2 rounded-md text-[10px] transition-colors ${
                  chartType === t
                    ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))] border border-transparent"
                }`}
              >
                <span className="text-sm">{CHART_ICONS[t]}</span>
                {CHART_TYPE_INFO[t].label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* X-Axis */}
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1">X-Axis (Category)</label>
          <select
            value={fields.xAxis?.column ?? ""}
            onChange={(e) => {
              const col = e.target.value;
              if (!col) { setFields((p) => ({ ...p, xAxis: null })); return; }
              const dt = columns.find((c) => c.column === col)?.dataType ?? "string";
              setFields((p) => ({ ...p, xAxis: { column: col, dataType: dt } }));
            }}
            className="w-full px-2.5 py-1.5 rounded-md text-xs bg-[rgb(var(--surface))] text-[rgb(var(--on-surface))] border border-[rgb(var(--outline-variant)/0.4)] focus:outline-none focus:border-violet-500/50"
          >
            <option value="">Select column...</option>
            {columns.map((col) => (
              <option key={col.column} value={col.column}>{col.column} ({col.dataType})</option>
            ))}
          </select>
        </div>

        {/* Y-Axis (Measures) */}
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1">Y-Axis (Measures)</label>
          <div className="space-y-1 mb-2">
            {fields.yAxis.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  value={f.aggregation}
                  onChange={(e) => {
                    const updated = [...fields.yAxis];
                    updated[i] = { ...updated[i], aggregation: e.target.value as AggregatedField["aggregation"], alias: `${e.target.value.toLowerCase()}_${updated[i].column}` };
                    setFields((p) => ({ ...p, yAxis: updated }));
                  }}
                  className="flex-1 px-2 py-1 rounded-md text-[11px] bg-[rgb(var(--surface))] text-[rgb(var(--on-surface))] border border-[rgb(var(--outline-variant)/0.4)]"
                >
                  {["SUM", "COUNT", "AVG", "MIN", "MAX"].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <span className="text-[11px] text-[rgb(var(--on-surface-variant))] truncate max-w-[80px]">{f.column}</span>
                <button onClick={() => handleRemoveYAxis(i)} className="p-0.5 rounded hover:bg-red-500/10 text-[rgb(var(--on-surface-variant)/0.4)] hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <select
            value=""
            onChange={(e) => {
              const col = e.target.value;
              if (!col) return;
              const dt = columns.find((c) => c.column === col)?.dataType ?? "string";
              handleAddYAxis(col, dt);
            }}
            className="w-full px-2.5 py-1.5 rounded-md text-xs bg-[rgb(var(--surface))] text-[rgb(var(--on-surface-variant)/0.6)] border border-dashed border-[rgb(var(--outline-variant)/0.4)]"
          >
            <option value="">+ Add measure...</option>
            {columns.filter((c) => !fields.yAxis.some((f) => f.column === c.column)).map((col) => (
              <option key={col.column} value={col.column}>{col.column}</option>
            ))}
          </select>
        </div>

        {/* Options */}
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--on-surface-variant))] mb-1.5">Options</label>
          <div className="space-y-1.5">
            {[
              { key: "showLegend", label: "Legend" },
              { key: "showGrid", label: "Grid" },
              { key: "showTooltip", label: "Tooltip" },
              { key: "smooth", label: "Smooth lines" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs text-[rgb(var(--on-surface-variant))] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(options as Record<string, boolean>)[key]}
                  onChange={(e) => setOptions((p) => ({ ...p, [key]: e.target.checked }))}
                  className="rounded border-[rgb(var(--outline-variant)/0.4)] accent-violet-500"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[rgb(var(--outline-variant)/0.3)] flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-1.5 rounded-md text-xs text-[rgb(var(--on-surface-variant))] hover:bg-[rgb(var(--surface-container-highest))]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!chartName.trim() || !fields.xAxis || fields.yAxis.length === 0}
          className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {editingChart ? "Update" : "Add Chart"}
        </button>
      </div>
    </div>
  );
}
