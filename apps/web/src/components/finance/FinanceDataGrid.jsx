import { useMemo, useRef } from "react";
import {
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
  CsvExportModule,
  ModuleRegistry,
  NumberFilterModule,
  PaginationModule,
  QuickFilterModule,
  TextFilterModule,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

// MIT-licensed AG Grid Community only. No Enterprise licence, key, service or paid modules.
// Register only the free modules this dashboard actually uses to reduce shipped JavaScript.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  QuickFilterModule,
  PaginationModule,
  CsvExportModule,
  ColumnAutoSizeModule,
]);
const cosmicGridTheme = themeQuartz.withParams({
  accentColor: "#22d3ee",
  backgroundColor: "#070e20",
  foregroundColor: "#e2e8f0",
  headerBackgroundColor: "#14213e",
  oddRowBackgroundColor: "#0e1a33",
  borderColor: "#334155",
  fontFamily: "inherit",
  fontSize: 13,
});

export const formatUsdCents = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) / 100)
    : "Not reported";

export default function FinanceDataGrid({
  rows, columns, label, csvName, allowExport = false, search = "",
}) {
  const gridRef = useRef(null);
  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true, minWidth: 120 }), []);
  return <section aria-label={label} className="min-w-0">
    <div className="w-full overflow-hidden rounded-xl border border-slate-700/70" style={{ height: 390 }}>
      <AgGridReact
        ref={gridRef}
        theme={cosmicGridTheme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        quickFilterText={search}
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={false}
        animateRows={false}
        overlayNoRowsTemplate={'<span>No records in this view</span>'}
      />
    </div>
    {allowExport && <button type="button" onClick={() => gridRef.current?.api?.exportDataAsCsv({ fileName: csvName || "ifund-demo-grid.csv" })}
      className="mt-3 min-h-11 rounded-xl border border-cyan-400/50 px-4 text-sm font-semibold text-cyan-200">
      Export current grid to CSV
    </button>}
  </section>;
}
