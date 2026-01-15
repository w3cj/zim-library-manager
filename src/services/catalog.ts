import { XMLParser } from "fast-xml-parser";
import { db, catalogBooks, type NewCatalogBook } from "../db/index.js";
import { eq, like, or, sql } from "drizzle-orm";
import { access, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const KIWIX_CATALOG_URL =
  "https://download.kiwix.org/library/library_zim.xml";

interface KiwixBook {
  "@_id": string;
  "@_name": string;
  "@_title": string;
  "@_description"?: string;
  "@_language"?: string;
  "@_creator"?: string;
  "@_publisher"?: string;
  "@_date"?: string;
  "@_size"?: string;
  "@_url"?: string;
  "@_favicon"?: string;
  "@_tags"?: string;
  "@_mediaCount"?: string;
  "@_articleCount"?: string;
}

interface KiwixLibrary {
  library: {
    book: KiwixBook | KiwixBook[];
  };
}

export async function fetchCatalog(): Promise<string> {
  console.log("Fetching Kiwix catalog...");
  const response = await fetch(KIWIX_CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.statusText}`);
  }
  return response.text();
}

interface ParsedTags {
  tags: string | null; // User-facing tags (non-underscore), semicolon-separated
  category: string | null;
  hasFtIndex: boolean | null;
  hasPictures: boolean | null;
  hasVideos: boolean | null;
  hasDetails: boolean | null;
}

function parseTagsString(tagsString: string | undefined): ParsedTags {
  if (!tagsString) {
    return {
      tags: null,
      category: null,
      hasFtIndex: null,
      hasPictures: null,
      hasVideos: null,
      hasDetails: null,
    };
  }

  const tagParts = tagsString.split(";").map((t) => t.trim()).filter(Boolean);
  const userTags: string[] = [];
  let category: string | null = null;
  let hasFtIndex: boolean | null = null;
  let hasPictures: boolean | null = null;
  let hasVideos: boolean | null = null;
  let hasDetails: boolean | null = null;

  for (const tag of tagParts) {
    if (tag.startsWith("_category:")) {
      category = tag.slice("_category:".length);
    } else if (tag.startsWith("_ftindex:")) {
      hasFtIndex = tag.slice("_ftindex:".length) === "yes";
    } else if (tag.startsWith("_pictures:")) {
      hasPictures = tag.slice("_pictures:".length) === "yes";
    } else if (tag.startsWith("_videos:")) {
      hasVideos = tag.slice("_videos:".length) === "yes";
    } else if (tag.startsWith("_details:")) {
      hasDetails = tag.slice("_details:".length) === "yes";
    } else if (!tag.startsWith("_")) {
      // Only include non-underscore tags as user-facing tags
      userTags.push(tag);
    }
  }

  return {
    tags: userTags.length > 0 ? userTags.join(";") : null,
    category,
    hasFtIndex,
    hasPictures,
    hasVideos,
    hasDetails,
  };
}

export function parseCatalog(xml: string): NewCatalogBook[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const result = parser.parse(xml) as KiwixLibrary;
  const books = Array.isArray(result.library.book)
    ? result.library.book
    : [result.library.book];

  return books.map((book) => {
    const parsedTags = parseTagsString(book["@_tags"]);

    return {
      id: book["@_id"],
      name: book["@_name"],
      title: book["@_title"],
      description: book["@_description"] ?? null,
      language: book["@_language"] ?? null,
      creator: book["@_creator"] ?? null,
      publisher: book["@_publisher"] ?? null,
      date: book["@_date"] ?? null,
      size: book["@_size"] ? parseInt(book["@_size"], 10) : null,
      url: book["@_url"] ?? null,
      favicon: book["@_favicon"] ?? null,
      tags: parsedTags.tags,
      category: parsedTags.category,
      hasFtIndex: parsedTags.hasFtIndex,
      hasPictures: parsedTags.hasPictures,
      hasVideos: parsedTags.hasVideos,
      hasDetails: parsedTags.hasDetails,
      mediaCount: book["@_mediaCount"]
        ? parseInt(book["@_mediaCount"], 10)
        : null,
      articleCount: book["@_articleCount"]
        ? parseInt(book["@_articleCount"], 10)
        : null,
      syncedAt: new Date(),
    };
  });
}

export async function syncCatalogFromFile(filePath: string): Promise<number> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }
  const xml = await readFile(filePath, "utf-8");
  return syncCatalogFromXml(xml);
}

async function syncCatalogFromXml(xml: string): Promise<number> {
  const books = parseCatalog(xml);
  console.log(`Syncing ${books.length} books to database...`);

  // Upsert each book
  for (const book of books) {
    await db
      .insert(catalogBooks)
      .values(book)
      .onConflictDoUpdate({
        target: catalogBooks.id,
        set: {
          name: book.name,
          title: book.title,
          description: book.description,
          language: book.language,
          creator: book.creator,
          publisher: book.publisher,
          date: book.date,
          size: book.size,
          url: book.url,
          favicon: book.favicon,
          tags: book.tags,
          category: book.category,
          hasFtIndex: book.hasFtIndex,
          hasPictures: book.hasPictures,
          hasVideos: book.hasVideos,
          hasDetails: book.hasDetails,
          mediaCount: book.mediaCount,
          articleCount: book.articleCount,
          syncedAt: book.syncedAt,
        },
      });
  }

  console.log("Catalog sync complete!");
  return books.length;
}

export async function syncCatalog(): Promise<number> {
  const xml = await fetchCatalog();
  return syncCatalogFromXml(xml);
}

export interface SearchOptions {
  query?: string;
  language?: string;
  category?: string;
  tags?: string[]; // Filter by tags (all must match)
  limit?: number;
  offset?: number;
}

function buildSearchConditions(options: SearchOptions) {
  const { query, language, category, tags } = options;
  const conditions = [];

  if (query) {
    conditions.push(
      or(
        like(catalogBooks.title, `%${query}%`),
        like(catalogBooks.description, `%${query}%`),
        like(catalogBooks.name, `%${query}%`)
      )
    );
  }

  if (language) {
    // Use LIKE to match language in comma-separated list (e.g., "eng,zho" contains "eng")
    conditions.push(like(catalogBooks.language, `%${language}%`));
  }

  if (category) {
    conditions.push(eq(catalogBooks.category, category));
  }

  // Filter by tags - book must have any of the selected tags (OR)
  if (tags && tags.length > 0) {
    const tagConditions = tags.map((tag) => like(catalogBooks.tags, `%${tag}%`));
    conditions.push(or(...tagConditions));
  }

  return conditions;
}

export async function searchBooks(options: SearchOptions = {}) {
  const { limit = 50, offset = 0 } = options;
  const conditions = buildSearchConditions(options);

  const baseQuery = db.select().from(catalogBooks).$dynamic();

  if (conditions.length > 0) {
    return baseQuery.where(sql`${sql.join(conditions, sql` AND `)}`).limit(limit).offset(offset);
  }

  return baseQuery.limit(limit).offset(offset);
}

export async function countBooks(options: Omit<SearchOptions, 'limit' | 'offset'> = {}): Promise<number> {
  const conditions = buildSearchConditions(options);

  const baseQuery = db.select({ count: sql<number>`count(*)` }).from(catalogBooks).$dynamic();

  let result;
  if (conditions.length > 0) {
    result = await baseQuery.where(sql`${sql.join(conditions, sql` AND `)}`);
  } else {
    result = await baseQuery;
  }

  return result[0]?.count ?? 0;
}

export async function getBookById(id: string) {
  const result = await db
    .select()
    .from(catalogBooks)
    .where(eq(catalogBooks.id, id))
    .limit(1);

  return result[0] ?? null;
}

export async function getBookByName(name: string) {
  const result = await db
    .select()
    .from(catalogBooks)
    .where(eq(catalogBooks.name, name))
    .limit(1);

  return result[0] ?? null;
}

export async function getCatalogStats() {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
      lastSync: sql<number>`max(${catalogBooks.syncedAt})`,
    })
    .from(catalogBooks);

  // Convert Unix timestamp (seconds) to Date
  const lastSyncTimestamp = result[0]?.lastSync;
  const lastSync = lastSyncTimestamp ? new Date(lastSyncTimestamp * 1000) : null;

  return {
    totalBooks: result[0]?.count ?? 0,
    lastSync,
  };
}

export async function getUniqueLanguages(): Promise<string[]> {
  const result = await db
    .select({ language: catalogBooks.language })
    .from(catalogBooks)
    .where(sql`${catalogBooks.language} IS NOT NULL`);

  // Split comma-separated languages and collect unique codes
  const languages = new Set<string>();
  for (const row of result) {
    if (row.language) {
      // Split by comma and add each language
      const parts = row.language.split(",").map((l) => l.trim());
      for (const lang of parts) {
        if (lang) languages.add(lang);
      }
    }
  }

  return Array.from(languages).sort();
}

export async function getUniqueCategories(): Promise<string[]> {
  const result = await db
    .selectDistinct({ category: catalogBooks.category })
    .from(catalogBooks)
    .where(sql`${catalogBooks.category} IS NOT NULL`);

  return result.map((r) => r.category!).sort();
}

export async function getUniqueTags(): Promise<string[]> {
  const result = await db
    .select({ tags: catalogBooks.tags })
    .from(catalogBooks)
    .where(sql`${catalogBooks.tags} IS NOT NULL`);

  // Parse semicolon-separated tags and collect unique ones
  const tags = new Set<string>();
  for (const row of result) {
    if (row.tags) {
      const parts = row.tags.split(";").map((t) => t.trim());
      for (const tag of parts) {
        if (tag) tags.add(tag);
      }
    }
  }

  return Array.from(tags).sort();
}

export interface TagFilterOptions {
  language?: string;
  category?: string;
}

export async function getAvailableTags(options: TagFilterOptions = {}): Promise<string[]> {
  const { language, category } = options;

  const conditions = [sql`${catalogBooks.tags} IS NOT NULL`];

  if (language) {
    conditions.push(like(catalogBooks.language, `%${language}%`));
  }

  if (category) {
    conditions.push(eq(catalogBooks.category, category));
  }

  const result = await db
    .select({ tags: catalogBooks.tags })
    .from(catalogBooks)
    .where(sql`${sql.join(conditions, sql` AND `)}`);

  // Parse semicolon-separated tags and collect unique ones
  const tags = new Set<string>();
  for (const row of result) {
    if (row.tags) {
      const parts = row.tags.split(";").map((t) => t.trim());
      for (const tag of parts) {
        if (tag) tags.add(tag);
      }
    }
  }

  return Array.from(tags).sort();
}
