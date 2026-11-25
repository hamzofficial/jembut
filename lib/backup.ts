import { query } from "@/lib/db";

export interface BackupData {
  app: string;
  exported_at: string;
  total_rows: number;
  tables: Record<string, Record<string, unknown>[]>;
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.parse(JSON.stringify(value));
  return value;
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key] = serializeValue(val);
  }
  return out;
}

export async function dumpAllTables(): Promise<BackupData> {
  const tableRows = await query<{ table_name: string }>(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const tables: Record<string, Record<string, unknown>[]> = {};
  let totalRows = 0;

  for (const { table_name } of tableRows) {
    try {
      const rows = await query(`SELECT * FROM "${table_name}"`);
      tables[table_name] = rows.map(serializeRow);
      totalRows += rows.length;
    } catch (err) {
      console.error(`[backup] Failed to dump table ${table_name}:`, err);
      tables[table_name] = [];
    }
  }

  return {
    app: "bansos-simulation",
    exported_at: new Date().toISOString(),
    total_rows: totalRows,
    tables,
  };
}

export function formatBackupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}