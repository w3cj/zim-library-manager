import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdir } from "fs/promises";
import { dirname } from "path";

const DB_PATH = "./data/zim-library.db";

async function runMigrations() {
  // Ensure data directory exists
  const dataDir = dirname(DB_PATH);
  await mkdir(dataDir, { recursive: true });

  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite);

  console.log("Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete!");

  sqlite.close();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
