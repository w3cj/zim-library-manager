import { db, localZims, catalogBooks, type LocalZim } from "../db/index.js";
import { eq, like, sql } from "drizzle-orm";
import { getSetting } from "./settings.js";
import { getZimFiles, getFileInfo } from "./disk.js";
import { join } from "path";
import { unlinkSync } from "fs";

/**
 * Parse a ZIM filename to extract the base name and date
 * Example: wikipedia_en_all_maxi_2024-01.zim -> { baseName: "wikipedia_en_all_maxi", date: "2024-01" }
 */
function parseZimFilename(filename: string): {
  baseName: string;
  date: string | null;
} {
  // Remove .zim extension
  const withoutExt = filename.replace(/\.zim$/i, "");

  // Try to extract date (format: YYYY-MM or YYYY-MM-DD at the end)
  const dateMatch = withoutExt.match(/_(\d{4}-\d{2}(?:-\d{2})?)$/);

  if (dateMatch) {
    const date = dateMatch[1];
    const baseName = withoutExt.slice(0, -date.length - 1); // Remove _date
    return { baseName, date };
  }

  return { baseName: withoutExt, date: null };
}

/**
 * Scan the download folder and update the local_zims table
 */
export async function scanLibrary(): Promise<number> {
  const downloadFolder = await getSetting("downloadFolder");
  const zimFiles = getZimFiles(downloadFolder);

  console.log(`Found ${zimFiles.length} ZIM files in ${downloadFolder}`);

  // Get all current entries to detect removed files
  const currentEntries = await db.select().from(localZims);
  const currentPaths = new Set(currentEntries.map((e) => e.filePath));
  const scannedPaths = new Set<string>();

  for (const fileName of zimFiles) {
    const filePath = join(downloadFolder, fileName);
    scannedPaths.add(filePath);

    const fileInfo = getFileInfo(filePath);
    if (!fileInfo) continue;

    const { baseName, date: fileDate } = parseZimFilename(fileName);

    // Try to find matching catalog entry
    // Escape underscores and percent signs in baseName for LIKE pattern
    const escapedBaseName = baseName.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const catalogMatch = await db
      .select()
      .from(catalogBooks)
      .where(sql`${catalogBooks.name} LIKE ${escapedBaseName + '%'} ESCAPE '\\'`)
      .limit(1);

    // Check if entry already exists
    const existing = await db
      .select()
      .from(localZims)
      .where(eq(localZims.filePath, filePath))
      .limit(1);

    // Use existing bookId if already set, otherwise try to match from catalog
    const bookId = existing[0]?.bookId ?? catalogMatch[0]?.id ?? null;

    // If we have a preserved bookId, fetch that specific catalog entry for accurate comparison
    let catalogEntry = catalogMatch[0];
    if (bookId && bookId !== catalogMatch[0]?.id) {
      const exactMatch = await db
        .select()
        .from(catalogBooks)
        .where(eq(catalogBooks.id, bookId))
        .limit(1);
      if (exactMatch[0]) {
        catalogEntry = exactMatch[0];
      }
    }

    // Use stored catalogDate if available, otherwise fall back to filename date
    const localDateStr = existing[0]?.catalogDate ?? fileDate;

    // Check if newer version exists in catalog
    // Parse dates and compare timestamps
    let hasUpdate = false;
    if (bookId && catalogEntry?.date && localDateStr) {
      const catalogTimestamp = new Date(catalogEntry.date).getTime();
      const localTimestamp = new Date(localDateStr).getTime();
      hasUpdate = catalogTimestamp > localTimestamp;
    }

    if (existing.length > 0) {
      // Update existing entry - preserve bookId if already set
      await db
        .update(localZims)
        .set({
          fileSize: fileInfo.size,
          bookId: existing[0].bookId ?? bookId,
          hasUpdate,
          lastChecked: new Date(),
        })
        .where(eq(localZims.id, existing[0].id));
    } else {
      // Insert new entry (use filename date as catalogDate for manually added files)
      await db.insert(localZims).values({
        filePath,
        fileName,
        fileSize: fileInfo.size,
        bookId,
        catalogDate: fileDate,
        hasUpdate,
        discoveredAt: new Date(),
        lastChecked: new Date(),
      });
    }
  }

  // Remove entries for files that no longer exist
  for (const entry of currentEntries) {
    if (!scannedPaths.has(entry.filePath)) {
      await db.delete(localZims).where(eq(localZims.id, entry.id));
    }
  }

  return zimFiles.length;
}

/**
 * Get all local ZIM files with their catalog info
 */
export async function getLocalLibrary() {
  const results = await db
    .select({
      local: localZims,
      catalog: catalogBooks,
    })
    .from(localZims)
    .leftJoin(catalogBooks, eq(localZims.bookId, catalogBooks.id))
    .orderBy(localZims.fileName);

  return results.map((r) => ({
    ...r.local,
    catalogInfo: r.catalog,
  }));
}

/**
 * Get a single local ZIM file by ID
 */
export async function getLocalZimById(id: number) {
  const result = await db
    .select({
      local: localZims,
      catalog: catalogBooks,
    })
    .from(localZims)
    .leftJoin(catalogBooks, eq(localZims.bookId, catalogBooks.id))
    .where(eq(localZims.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0].local,
    catalogInfo: result[0].catalog,
  };
}

/**
 * Delete a local ZIM file
 */
export async function deleteLocalZim(id: number): Promise<void> {
  const zim = await db
    .select()
    .from(localZims)
    .where(eq(localZims.id, id))
    .limit(1);

  if (zim.length === 0) {
    throw new Error(`ZIM file not found: ${id}`);
  }

  // Delete the actual file
  try {
    unlinkSync(zim[0].filePath);
  } catch (err) {
    console.error(`Failed to delete file: ${zim[0].filePath}`, err);
  }

  // Remove from database
  await db.delete(localZims).where(eq(localZims.id, id));
}

/**
 * Get count of ZIM files with updates available
 */
export async function getUpdateCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(localZims)
    .where(eq(localZims.hasUpdate, true));

  return result[0]?.count ?? 0;
}

export interface LibraryStatus {
  inLibrary: boolean;
  hasUpdate: boolean;
  localZimId: number | null;
}

/**
 * Get library status for all books that are in the local library
 * Returns a map of bookId -> LibraryStatus
 */
export async function getLibraryStatusMap(): Promise<Map<string, LibraryStatus>> {
  const localItems = await db
    .select({
      id: localZims.id,
      bookId: localZims.bookId,
      hasUpdate: localZims.hasUpdate,
    })
    .from(localZims)
    .where(sql`${localZims.bookId} IS NOT NULL`);

  const statusMap = new Map<string, LibraryStatus>();
  for (const item of localItems) {
    if (item.bookId) {
      statusMap.set(item.bookId, {
        inLibrary: true,
        hasUpdate: item.hasUpdate ?? false,
        localZimId: item.id,
      });
    }
  }

  return statusMap;
}
