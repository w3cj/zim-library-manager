import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const publicDir = join(projectRoot, "public");
const configPath = join(projectRoot, "client-libraries.json");

interface LibraryFile {
  url: string;
  dest: string;
}

interface Library {
  name: string;
  version: string;
  files: LibraryFile[];
}

interface Config {
  libraries: Library[];
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const content = await response.text();
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  writeFileSync(dest, content);
  console.log(`  -> ${dest}`);
}

async function main(): Promise<void> {
  // Read config
  const configContent = readFileSync(configPath, "utf-8");
  const config: Config = JSON.parse(configContent);

  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
    console.log(`Created ${publicDir}`);
  }

  // Download each library's files
  for (const library of config.libraries) {
    console.log(`\n${library.name} v${library.version}`);
    for (const file of library.files) {
      const destPath = join(publicDir, file.dest);
      await downloadFile(file.url, destPath);
    }
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
