import type { Layout } from "../types/terminal";

export interface GridConfig {
  columns: number;
  rows: number;
  gridTemplateColumns: string;
  gridTemplateRows: string;
}

export function getGridConfig(layout: Layout): GridConfig {
  const configs: Record<Layout, GridConfig> = {
    1: { columns: 1, rows: 1, gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
    2: { columns: 2, rows: 1, gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" },
    3: { columns: 3, rows: 1, gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr" },
    4: { columns: 2, rows: 2, gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
    6: { columns: 3, rows: 2, gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" },
    9: { columns: 3, rows: 3, gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr" },
  };
  return configs[layout];
}

export function panelCount(layout: Layout): number {
  const config = getGridConfig(layout);
  return config.columns * config.rows;
}
