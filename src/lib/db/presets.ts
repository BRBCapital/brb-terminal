import "server-only";
import { query, newId } from "./client";

export interface ScreenPreset {
  id: string;
  name: string;
  created_by: string;
  config: string; // JSON string of filter/sort state
  created_at: string;
}

export async function listPresets(actor: string): Promise<ScreenPreset[]> {
  return query<ScreenPreset>(
    `SELECT * FROM screen_presets WHERE created_by = $1 ORDER BY created_at DESC`,
    [actor]
  );
}

export async function createPreset(
  actor: string,
  name: string,
  config: unknown
): Promise<ScreenPreset> {
  const id = newId("scr");
  await query(
    `INSERT INTO screen_presets (id, name, created_by, config) VALUES ($1,$2,$3,$4)`,
    [id, name, actor, JSON.stringify(config ?? {})]
  );
  return (await query<ScreenPreset>(`SELECT * FROM screen_presets WHERE id = $1`, [id]))[0];
}

export async function deletePreset(actor: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM screen_presets WHERE id = $1 AND created_by = $2 RETURNING id`,
    [id, actor]
  );
  return rows.length > 0;
}
