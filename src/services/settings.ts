import { db, settings } from "../db/index.js";
import { eq } from "drizzle-orm";
import { homedir } from "os";
import { join } from "path";

export interface AppSettings {
  downloadFolder: string;
  kiwixServeUrl: string;
  catalogSyncInterval: string; // cron expression
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadFolder: join(homedir(), "zim-files"),
  kiwixServeUrl: "http://localhost:8080",
  catalogSyncInterval: "0 0 * * *", // Daily at midnight
};

export async function getSetting(key: keyof AppSettings): Promise<string> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (result.length > 0 && result[0].value !== null) {
    return result[0].value;
  }

  return DEFAULT_SETTINGS[key];
}

export async function setSetting(
  key: keyof AppSettings,
  value: string
): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value },
    });
}

export async function getAllSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const settingsMap = new Map(rows.map((r) => [r.key, r.value]));

  return {
    downloadFolder:
      settingsMap.get("downloadFolder") ?? DEFAULT_SETTINGS.downloadFolder,
    kiwixServeUrl:
      settingsMap.get("kiwixServeUrl") ?? DEFAULT_SETTINGS.kiwixServeUrl,
    catalogSyncInterval:
      settingsMap.get("catalogSyncInterval") ??
      DEFAULT_SETTINGS.catalogSyncInterval,
  };
}

export async function initializeDefaults(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(settings).values({ key, value });
    }
  }
}
