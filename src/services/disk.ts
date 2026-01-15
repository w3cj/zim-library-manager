import { exec } from "child_process";
import { promisify } from "util";
import { statSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export interface DiskSpace {
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  percentUsed: number;
}

export async function getDiskSpace(path: string): Promise<DiskSpace> {
  // Ensure directory exists
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }

  const { stdout } = await execAsync(`df -k "${path}"`);
  const lines = stdout.trim().split("\n");
  const data = lines[1].split(/\s+/);

  // df -k output: Filesystem 1K-blocks Used Available Use% Mounted
  const total = parseInt(data[1], 10) * 1024;
  const used = parseInt(data[2], 10) * 1024;
  const available = parseInt(data[3], 10) * 1024;
  const percentUsed = parseInt(data[4].replace("%", ""), 10);

  return { total, used, available, percentUsed };
}

export async function getFolderSize(path: string): Promise<number> {
  if (!existsSync(path)) {
    return 0;
  }

  const { stdout } = await execAsync(`du -sk "${path}"`);
  const size = parseInt(stdout.split(/\s+/)[0], 10) * 1024;
  return size;
}

export function hasEnoughSpace(available: number, required: number): boolean {
  // Require at least 1GB buffer beyond the file size
  const buffer = 1024 * 1024 * 1024; // 1GB
  return available >= required + buffer;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getZimFiles(folderPath: string): string[] {
  if (!existsSync(folderPath)) {
    return [];
  }

  return readdirSync(folderPath).filter((file) =>
    file.toLowerCase().endsWith(".zim")
  );
}

export function getFileInfo(filePath: string) {
  if (!existsSync(filePath)) {
    return null;
  }

  const stats = statSync(filePath);
  return {
    size: stats.size,
    modified: stats.mtime,
    created: stats.birthtime,
  };
}
