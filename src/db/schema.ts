import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const catalogBooks = sqliteTable("catalog_books", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  language: text("language"),
  creator: text("creator"),
  publisher: text("publisher"),
  date: text("date"),
  size: integer("size"), // Size in KB
  url: text("url"),
  favicon: text("favicon"),
  tags: text("tags"), // Semicolon-separated user-facing tags (non-underscore)
  category: text("category"), // Extracted from _category:X tag
  hasFtIndex: integer("has_ft_index", { mode: "boolean" }),
  hasPictures: integer("has_pictures", { mode: "boolean" }),
  hasVideos: integer("has_videos", { mode: "boolean" }),
  hasDetails: integer("has_details", { mode: "boolean" }),
  mediaCount: integer("media_count"),
  articleCount: integer("article_count"),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
});

export const downloads = sqliteTable("downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: text("book_id").references(() => catalogBooks.id),
  status: text("status", {
    enum: ["queued", "downloading", "paused", "completed", "failed"],
  }).notNull(),
  filePath: text("file_path"),
  bytesDownloaded: integer("bytes_downloaded").default(0),
  totalBytes: integer("total_bytes"),
  pid: integer("pid"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  error: text("error"),
});

export const localZims = sqliteTable("local_zims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filePath: text("file_path").notNull().unique(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  bookId: text("book_id").references(() => catalogBooks.id),
  catalogDate: text("catalog_date"), // Date from catalog when downloaded (YYYY-MM-DD)
  hasUpdate: integer("has_update", { mode: "boolean" }).default(false),
  discoveredAt: integer("discovered_at", { mode: "timestamp" }),
  lastChecked: integer("last_checked", { mode: "timestamp" }),
});

// Type exports
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type CatalogBook = typeof catalogBooks.$inferSelect;
export type NewCatalogBook = typeof catalogBooks.$inferInsert;
export type Download = typeof downloads.$inferSelect;
export type NewDownload = typeof downloads.$inferInsert;
export type LocalZim = typeof localZims.$inferSelect;
export type NewLocalZim = typeof localZims.$inferInsert;
