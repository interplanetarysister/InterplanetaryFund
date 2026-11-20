import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (relative) => readFileSync(path.join(webRoot, relative), "utf8");

const gridRoutes = [
  "src/pages/AdminFinance.jsx",
  "src/pages/FinanceDashboard.jsx",
  "src/pages/HackathonDemo.jsx",
  "src/pages/Atlas.jsx",
];

test("financial grid is lazy on every route that renders it", () => {
  for (const route of gridRoutes) {
    const source = readSource(route);
    assert.match(source, /lazy\(\(\) => import\("@\/components\/finance\/FinanceDataGrid"\)\)/, route);
    assert.match(source, /<Suspense fallback=\{<FinanceGridFallback \/>\}>/, route);
    assert.doesNotMatch(source, /import FinanceDataGrid(?:,|\s+from)/, route);
  }
});

test("money formatter is dependency-free and no longer forces an AG Grid import", () => {
  const formatter = readSource("src/lib/formatUsdCents.mjs");
  assert.match(formatter, /export const formatUsdCents/);
  assert.doesNotMatch(formatter, /ag-grid/i);

  for (const route of ["src/pages/AdminFinance.jsx", "src/pages/FinanceDashboard.jsx", "src/pages/HackathonDemo.jsx"]) {
    assert.match(readSource(route), /import \{ formatUsdCents \} from "@\/lib\/formatUsdCents\.mjs"/, route);
  }
  assert.match(readSource("src/components/agents/OwnerRefundTrends.jsx"), /formatUsdCents.*@\/lib\/formatUsdCents\.mjs/);
});

test("only the AG Grid modules used by the financial tables are registered", () => {
  const grid = readSource("src/components/finance/FinanceDataGrid.jsx");
  for (const module of [
    "ClientSideRowModelModule",
    "TextFilterModule",
    "NumberFilterModule",
    "QuickFilterModule",
    "PaginationModule",
    "CsvExportModule",
  ]) {
    assert.match(grid, new RegExp(`\\b${module}\\b`), module);
  }
  assert.doesNotMatch(grid, /ColumnAutoSizeModule/);
  assert.match(grid, /const defaultColDef = useMemo\(\(\) => \(\{ sortable: true, filter: true, resizable: true/);
  assert.match(grid, /quickFilterText=\{search\}/);
  assert.match(grid, /pagination\b/);
  assert.match(grid, /exportDataAsCsv/);
});

test("heavy routes and AG Grid vendors stay in explicit lazy chunks", () => {
  const app = readSource("src/App.jsx");
  for (const route of ["HackathonDemo", "Atlas", "FinanceDashboard", "AnalyticsCenter"]) {
    assert.match(app, new RegExp(`const ${route} = lazy\\(\\(\\) => import\\(`), route);
  }

  const config = readSource("vite.config.js");
  for (const vendor of ["ag-grid-community", "ag-grid-react"]) {
    assert.match(config, new RegExp(`return "${vendor}"`), vendor);
  }
  assert.match(config, /return "ag-grid-shared"/);
  assert.doesNotMatch(config, /chunkSizeWarningLimit/);
});
