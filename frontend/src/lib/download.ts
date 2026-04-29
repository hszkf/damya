/**
 * Download utilities for exporting query results
 */

export interface DownloadData {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * Convert data to CSV format and trigger download
 */
export function downloadAsCSV(data: DownloadData, filename: string = "query_results") {
  if (!data.columns.length || !data.rows.length) {
    return;
  }

  // Create CSV content
  const csvRows: string[] = [];

  // Header row
  csvRows.push(data.columns.map(escapeCSVValue).join(","));

  // Data rows
  data.rows.forEach((row) => {
    const values = data.columns.map((col) => {
      const value = row[col];
      return escapeCSVValue(formatValue(value));
    });
    csvRows.push(values.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Convert data to Excel XML format and trigger download
 */
export function downloadAsExcel(data: DownloadData, filename: string = "query_results") {
  if (!data.columns.length || !data.rows.length) {
    return;
  }

  // Create Excel XML content (SpreadsheetML format)
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Query Results">
    <Table>`;

  const xmlFooter = `
    </Table>
  </Worksheet>
</Workbook>`;

  // Header row
  const headerRow = `
      <Row>
        ${data.columns.map((col) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXML(col)}</Data></Cell>`).join("")}
      </Row>`;

  // Data rows
  const dataRows = data.rows
    .map((row) => {
      const cells = data.columns
        .map((col) => {
          const value = row[col];
          const { type, formattedValue } = getExcelType(value);
          return `<Cell><Data ss:Type="${type}">${escapeXML(formattedValue)}</Data></Cell>`;
        })
        .join("");
      return `
      <Row>${cells}</Row>`;
    })
    .join("");

  const xmlContent = xmlHeader + headerRow + dataRows + xmlFooter;
  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" });
  triggerDownload(blob, `${filename}.xls`);
}

/**
 * Export data as JSON and trigger download
 */
export function downloadAsJSON(data: DownloadData, filename: string = "query_results") {
  if (!data.rows.length) return;
  const json = JSON.stringify(data.rows, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, `${filename}.json`);
}

/**
 * Escape special characters for CSV
 */
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Escape special characters for XML
 */
function escapeXML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Get Excel data type for a value
 */
function getExcelType(value: unknown): { type: string; formattedValue: string } {
  if (value === null || value === undefined) {
    return { type: "String", formattedValue: "" };
  }
  if (typeof value === "number") {
    return { type: "Number", formattedValue: String(value) };
  }
  if (typeof value === "boolean") {
    return { type: "Boolean", formattedValue: value ? "1" : "0" };
  }
  return { type: "String", formattedValue: String(value) };
}

/**
 * Trigger file download in browser
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
