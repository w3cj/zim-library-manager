import { spawn, ChildProcess } from "child_process";
import { db, downloads, localZims, type Download, type NewDownload } from "../db/index.js";
import { eq } from "drizzle-orm";
import { join, basename } from "path";
import { getSetting } from "./settings.js";
import { getDiskSpace, hasEnoughSpace } from "./disk.js";
import { getBookById } from "./catalog.js";
import { stat } from "fs/promises";
import { XMLParser } from "fast-xml-parser";

// Track active download processes
const activeProcesses = new Map<number, ChildProcess>();

interface Meta4File {
  metalink: {
    file: {
      "@_name": string;
      size: string;
      url: string | { "#text": string; "@_location"?: string; "@_priority"?: string }[];
    };
  };
}

/**
 * Resolve a meta4 URL to get the actual download URL
 */
async function resolveMeta4Url(meta4Url: string): Promise<{ url: string; fileName: string }> {
  console.log(`Fetching meta4 file: ${meta4Url}`);
  const response = await fetch(meta4Url);
  if (!response.ok) {
    throw new Error(`Failed to fetch meta4: ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const result = parser.parse(xml) as Meta4File;
  const file = result.metalink.file;
  const fileName = file["@_name"];

  // Get the first URL (or the one with highest priority)
  let downloadUrl: string;
  if (typeof file.url === "string") {
    downloadUrl = file.url;
  } else if (Array.isArray(file.url)) {
    // Sort by priority and get the first one
    const urls = file.url.map(u => ({
      url: typeof u === "string" ? u : u["#text"],
      priority: typeof u === "string" ? 99 : parseInt(u["@_priority"] ?? "99", 10),
    }));
    urls.sort((a, b) => a.priority - b.priority);
    downloadUrl = urls[0].url;
  } else {
    downloadUrl = file.url["#text"];
  }

  console.log(`Resolved to: ${downloadUrl} (${fileName})`);
  return { url: downloadUrl, fileName };
}

export interface DownloadProgress {
  id: number;
  bookId: string;
  status: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  filePath: string;
  error?: string;
}

export async function startDownload(bookId: string): Promise<Download> {
  const book = await getBookById(bookId);
  if (!book) {
    throw new Error(`Book not found: ${bookId}`);
  }

  if (!book.url) {
    throw new Error(`Book has no download URL: ${bookId}`);
  }

  const downloadFolder = await getSetting("downloadFolder");

  // Check disk space (size is in KB in the catalog)
  const requiredBytes = (book.size ?? 0) * 1024;
  const diskSpace = await getDiskSpace(downloadFolder);

  if (!hasEnoughSpace(diskSpace.available, requiredBytes)) {
    throw new Error(
      `Not enough disk space. Required: ${requiredBytes}, Available: ${diskSpace.available}`
    );
  }

  // Resolve meta4 URL to get actual download URL
  const meta4Url = book.url;
  const { url: downloadUrl, fileName } = await resolveMeta4Url(meta4Url);
  const filePath = join(downloadFolder, fileName);

  // Check if download already exists
  const existing = await db
    .select()
    .from(downloads)
    .where(eq(downloads.bookId, bookId))
    .limit(1);

  if (existing.length > 0 && existing[0].status === "downloading") {
    throw new Error(`Download already in progress for: ${bookId}`);
  }

  // Create or update download record
  let downloadRecord: Download;

  if (existing.length > 0) {
    // Resume existing download
    await db
      .update(downloads)
      .set({
        status: "downloading",
        startedAt: new Date(),
        error: null,
      })
      .where(eq(downloads.id, existing[0].id));

    downloadRecord = (
      await db.select().from(downloads).where(eq(downloads.id, existing[0].id))
    )[0];
  } else {
    // Create new download
    const newDownload: NewDownload = {
      bookId,
      status: "downloading",
      filePath,
      bytesDownloaded: 0,
      totalBytes: requiredBytes,
      startedAt: new Date(),
    };

    const result = await db.insert(downloads).values(newDownload).returning();
    downloadRecord = result[0];
  }

  // Start wget process with the resolved download URL
  spawnWget(downloadRecord.id, downloadUrl, filePath, requiredBytes, {
    bookId: book.id,
    catalogDate: book.date,
    fileName,
  });

  return downloadRecord;
}

interface BookInfo {
  bookId: string;
  catalogDate: string | null;
  fileName: string;
}

function spawnWget(
  downloadId: number,
  url: string,
  outputPath: string,
  totalBytes: number,
  bookInfo: BookInfo
) {
  // wget with continue flag and progress output
  const wget = spawn("wget", ["-c", "--progress=dot:mega", "-O", outputPath, url], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  activeProcesses.set(downloadId, wget);

  // Update PID in database
  db.update(downloads)
    .set({ pid: wget.pid })
    .where(eq(downloads.id, downloadId))
    .then(() => {});

  let lastUpdate = Date.now();

  // Parse wget stderr for progress
  wget.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();

    // Update progress at most every 500ms
    if (Date.now() - lastUpdate > 500) {
      lastUpdate = Date.now();

      // Check file size for progress
      stat(outputPath)
        .then((stats) => {
          db.update(downloads)
            .set({ bytesDownloaded: stats.size })
            .where(eq(downloads.id, downloadId))
            .then(() => {});
        })
        .catch(() => {
          // File doesn't exist yet, ignore
        });
    }
  });

  wget.on("close", async (code) => {
    activeProcesses.delete(downloadId);

    if (code === 0) {
      // Download complete
      const stats = await stat(outputPath).catch(() => null);
      await db
        .update(downloads)
        .set({
          status: "completed",
          bytesDownloaded: stats?.size ?? totalBytes,
          completedAt: new Date(),
          pid: null,
        })
        .where(eq(downloads.id, downloadId));

      // Add to local library with catalog date
      const existingLocal = await db
        .select()
        .from(localZims)
        .where(eq(localZims.filePath, outputPath))
        .limit(1);

      if (existingLocal.length > 0) {
        await db
          .update(localZims)
          .set({
            fileSize: stats?.size ?? null,
            bookId: bookInfo.bookId,
            catalogDate: bookInfo.catalogDate,
            hasUpdate: false,
            lastChecked: new Date(),
          })
          .where(eq(localZims.id, existingLocal[0].id));
      } else {
        await db.insert(localZims).values({
          filePath: outputPath,
          fileName: bookInfo.fileName,
          fileSize: stats?.size ?? null,
          bookId: bookInfo.bookId,
          catalogDate: bookInfo.catalogDate,
          hasUpdate: false,
          discoveredAt: new Date(),
          lastChecked: new Date(),
        });
      }
    } else {
      // Check if it was paused (signal 19 SIGSTOP or 20 SIGTSTP)
      const download = await db
        .select()
        .from(downloads)
        .where(eq(downloads.id, downloadId))
        .limit(1);

      if (download[0]?.status !== "paused") {
        await db
          .update(downloads)
          .set({
            status: "failed",
            error: `wget exited with code ${code}`,
            pid: null,
          })
          .where(eq(downloads.id, downloadId));
      }
    }
  });

  wget.on("error", async (err) => {
    activeProcesses.delete(downloadId);
    await db
      .update(downloads)
      .set({
        status: "failed",
        error: err.message,
        pid: null,
      })
      .where(eq(downloads.id, downloadId));
  });
}

export async function pauseDownload(downloadId: number): Promise<void> {
  const process = activeProcesses.get(downloadId);
  if (process && process.pid) {
    // Send SIGSTOP to pause
    process.kill("SIGSTOP");
    await db
      .update(downloads)
      .set({ status: "paused" })
      .where(eq(downloads.id, downloadId));
  }
}

export async function resumeDownload(downloadId: number): Promise<void> {
  const download = await db
    .select()
    .from(downloads)
    .where(eq(downloads.id, downloadId))
    .limit(1);

  if (!download[0]) {
    throw new Error(`Download not found: ${downloadId}`);
  }

  const process = activeProcesses.get(downloadId);
  if (process && process.pid) {
    // Send SIGCONT to resume
    process.kill("SIGCONT");
    await db
      .update(downloads)
      .set({ status: "downloading" })
      .where(eq(downloads.id, downloadId));
  } else if (download[0].bookId) {
    // Restart the download (wget -c will resume from where it left off)
    await startDownload(download[0].bookId);
  }
}

export async function cancelDownload(downloadId: number): Promise<void> {
  const process = activeProcesses.get(downloadId);
  if (process) {
    process.kill("SIGTERM");
    activeProcesses.delete(downloadId);
  }

  await db
    .update(downloads)
    .set({
      status: "failed",
      error: "Cancelled by user",
      pid: null,
    })
    .where(eq(downloads.id, downloadId));
}

export async function getDownloadProgress(
  downloadId: number
): Promise<DownloadProgress | null> {
  const download = await db
    .select()
    .from(downloads)
    .where(eq(downloads.id, downloadId))
    .limit(1);

  if (!download[0]) return null;

  const d = download[0];

  // Update bytes from file if downloading
  let bytesDownloaded = d.bytesDownloaded ?? 0;
  if (d.status === "downloading" && d.filePath) {
    try {
      const stats = await stat(d.filePath);
      bytesDownloaded = stats.size;
    } catch {
      // File doesn't exist yet, use stored value
    }
  }

  const totalBytes = d.totalBytes ?? 0;
  const percentage = totalBytes > 0 ? (bytesDownloaded / totalBytes) * 100 : 0;

  return {
    id: d.id,
    bookId: d.bookId ?? "",
    status: d.status,
    bytesDownloaded,
    totalBytes,
    percentage,
    filePath: d.filePath ?? "",
    error: d.error ?? undefined,
  };
}

export async function getAllDownloads(): Promise<Download[]> {
  return db.select().from(downloads).orderBy(downloads.startedAt);
}

export async function getActiveDownloads(): Promise<Download[]> {
  return db
    .select()
    .from(downloads)
    .where(eq(downloads.status, "downloading"))
    .orderBy(downloads.startedAt);
}

export async function deleteDownload(downloadId: number): Promise<void> {
  await cancelDownload(downloadId);
  await db.delete(downloads).where(eq(downloads.id, downloadId));
}

export async function getDownloadByBookId(bookId: string): Promise<Download | null> {
  const result = await db
    .select()
    .from(downloads)
    .where(eq(downloads.bookId, bookId))
    .limit(1);
  return result[0] ?? null;
}
