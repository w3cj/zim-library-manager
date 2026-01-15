import { Hono } from "hono";
import { Layout } from "../components/Layout.js";
import {
  searchBooks,
  countBooks,
  getCatalogStats,
  getUniqueLanguages,
  getUniqueCategories,
  getAvailableTags,
  getBookById,
} from "../services/catalog.js";
import { startDownload } from "../services/downloader.js";
import { formatBytes, getDiskSpace } from "../services/disk.js";
import { getSetting } from "../services/settings.js";
import { getLibraryStatusMap, type LibraryStatus } from "../services/library.js";
import type { CatalogBook } from "../db/index.js";

const app = new Hono();

interface BookCardProps {
  book: CatalogBook;
  isLast?: boolean;
  nextPageUrl?: string;
  libraryStatus?: LibraryStatus;
  kiwixServeUrl?: string;
}


function BookCard({ book, isLast, nextPageUrl, libraryStatus, kiwixServeUrl }: BookCardProps) {
  const sizeBytes = (book.size ?? 0) * 1024;
  const sizeFormatted = formatBytes(sizeBytes);

  // Add infinite scroll trigger to the last card
  const infiniteScrollAttrs = isLast && nextPageUrl
    ? {
        "hx-get": nextPageUrl,
        "hx-trigger": "revealed",
        "hx-swap": "afterend",
        "hx-indicator": "#loading-spinner",
      }
    : {};

  const inLibrary = libraryStatus?.inLibrary ?? false;
  const hasUpdate = libraryStatus?.hasUpdate ?? false;
  const localViewUrl = kiwixServeUrl ? `${kiwixServeUrl}/${book.name}` : null;

  return (
    <div class="col-md-6 col-lg-4 mb-4" {...infiniteScrollAttrs}>
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex align-items-start mb-2">
            {book.favicon && (
              <img
                src={`data:image/png;base64,${book.favicon}`}
                alt=""
                class="me-2"
                style="width: 32px; height: 32px;"
              />
            )}
            <h5 class="card-title mb-0">{book.title}</h5>
          </div>
          <p class="card-text text-muted small">
            {book.description
              ? book.description.length > 150
                ? book.description.slice(0, 150) + "..."
                : book.description
              : "No description available"}
          </p>
          <div class="mb-2 d-flex flex-wrap gap-1">
            {book.language && (
              book.language.split(",").map((lang) => (
                <span class="badge bg-primary">{lang.trim()}</span>
              ))
            )}
            <span class="badge bg-secondary">{sizeFormatted}</span>
            {book.hasPictures && (
              <span class="badge bg-success">pics</span>
            )}
            {book.hasVideos && (
              <span class="badge bg-success">vids</span>
            )}
          </div>
          <div class="small text-muted mb-2">
            {book.articleCount && (
              <span class="me-3">
                {book.articleCount.toLocaleString()} articles
              </span>
            )}
            {book.date && <span>Updated: {book.date}</span>}
          </div>
        </div>
        <div class="card-footer bg-transparent">
          {inLibrary ? (
            hasUpdate ? (
              <button
                class="btn btn-sm btn-warning w-100"
                hx-post={`/browse/download/${book.id}`}
                hx-swap="outerHTML"
                hx-confirm={`Update ${book.title} to latest version (${sizeFormatted})?`}
              >
                Update Available
              </button>
            ) : (
              <a
                href={`/library#zim-${book.id}`}
                class="btn btn-sm btn-primary w-100"
              >
                Manage in Library
              </a>
            )
          ) : (
            <div class="d-flex gap-2">
              <a
                href={`https://library.kiwix.org/viewer#${book.name}`}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-outline-primary flex-grow-1"
              >
                View
              </a>
              <button
                class="btn btn-sm btn-success flex-grow-1"
                hx-post={`/browse/download/${book.id}`}
                hx-swap="outerHTML"
                hx-confirm={`Download ${book.title} (${sizeFormatted})?`}
              >
                Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

interface BookListProps {
  books: CatalogBook[];
  query?: string;
  language?: string;
  category?: string;
  tags?: string[];
  offset?: number;
  hasMore?: boolean;
  libraryStatusMap?: Map<string, LibraryStatus>;
  kiwixServeUrl?: string;
}

function BookList({ books, query, language, category, tags, offset = 0, hasMore = false, libraryStatusMap, kiwixServeUrl }: BookListProps) {
  if (books.length === 0) {
    return (
      <div class="col-12">
        <div class="alert alert-info">
          No books found matching your criteria.
        </div>
      </div>
    );
  }

  // Build next page URL with current filters
  const nextOffset = offset + PAGE_SIZE;
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (language) params.set("lang", language);
  if (category) params.set("category", category);
  if (tags && tags.length > 0) {
    params.set("tags", tags.join(","));
  }
  params.set("offset", String(nextOffset));
  const nextPageUrl = `/browse/search?${params.toString()}`;

  return (
    <>
      {books.map((book, index) => (
        <BookCard
          book={book}
          isLast={hasMore && index === books.length - 1}
          nextPageUrl={nextPageUrl}
          libraryStatus={libraryStatusMap?.get(book.id)}
          kiwixServeUrl={kiwixServeUrl}
        />
      ))}
      {hasMore && (
        <div class="col-12 text-center py-3 htmx-indicator" id="loading-spinner">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading more...</span>
          </div>
        </div>
      )}
    </>
  );
}

// Helper to build URL with tag added or removed
function buildTagUrl(params: {
  query?: string;
  language?: string;
  category?: string;
  currentTags: string[];
  addTag?: string;
  removeTag?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("q", params.query);
  if (params.language) searchParams.set("lang", params.language);
  if (params.category) searchParams.set("category", params.category);

  let tags = [...params.currentTags];
  if (params.addTag && !tags.includes(params.addTag)) {
    tags.push(params.addTag);
  }
  if (params.removeTag) {
    tags = tags.filter((t) => t !== params.removeTag);
  }
  if (tags.length > 0) {
    searchParams.set("tags", tags.join(","));
  }

  return `/browse?${searchParams.toString()}`;
}

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  query: string;
  language: string;
  category: string;
}

function TagFilter({ availableTags, selectedTags, query, language, category }: TagFilterProps) {
  // Filter out already selected tags from the dropdown
  const unselectedTags = availableTags.filter((tag) => !selectedTags.includes(tag));

  return (
    <div class="mb-3 d-flex align-items-center flex-wrap gap-2">
      <small class="text-muted">Tags:</small>

      {unselectedTags.length > 0 && (
        <select
          class="form-select form-select-sm"
          style="width: auto; min-width: 150px;"
          x-data
          x-on:change="if ($el.value) window.location.href = $el.value"
        >
          <option value="">+ Add tag...</option>
          {unselectedTags.map((tag) => (
            <option
              value={buildTagUrl({
                query: query || undefined,
                language: language || undefined,
                category: category || undefined,
                currentTags: selectedTags,
                addTag: tag,
              })}
            >
              {tag}
            </option>
          ))}
        </select>
      )}

      {selectedTags.length === 0 ? (
        <span class="badge bg-secondary">All Tags</span>
      ) : (
        <>
          {selectedTags.map((tag) => (
            <a
              href={buildTagUrl({
                query: query || undefined,
                language: language || undefined,
                category: category || undefined,
                currentTags: selectedTags,
                removeTag: tag,
              })}
              class="badge bg-primary text-decoration-none"
              style="cursor: pointer;"
            >
              {tag} &times;
            </a>
          ))}
        </>
      )}
    </div>
  );
}

app.get("/", async (c) => {
  const catalogStats = await getCatalogStats();
  const languages = await getUniqueLanguages();
  const categories = await getUniqueCategories();
  const libraryStatusMap = await getLibraryStatusMap();
  const kiwixServeUrl = await getSetting("kiwixServeUrl");

  const query = c.req.query("q") ?? "";
  const language = c.req.query("lang") ?? "";
  const category = c.req.query("category") ?? "";
  const tagsParam = c.req.query("tags") ?? "";
  const selectedTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  // Get available tags filtered by current language/category selection
  const availableTags = await getAvailableTags({
    language: language || undefined,
    category: category || undefined,
  });

  let books: CatalogBook[] = [];
  let hasMore = false;
  let filteredCount = 0;
  if (catalogStats.totalBooks > 0) {
    const searchFilters = {
      query: query || undefined,
      language: language || undefined,
      category: category || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };
    books = await searchBooks({
      ...searchFilters,
      limit: PAGE_SIZE + 1, // Fetch one extra to check if there's more
    });
    filteredCount = await countBooks(searchFilters);
    // Check if there are more results
    hasMore = books.length > PAGE_SIZE;
    if (hasMore) {
      books = books.slice(0, PAGE_SIZE);
    }
  }

  return c.html(
    <Layout title="Browse - ZIM Library" activeNav="browse">
      <h1>Browse Kiwix Library</h1>
      <p class="text-muted">
        Search and download ZIM files from the Kiwix catalog.
      </p>

      {catalogStats.totalBooks === 0 ? (
        <div class="alert alert-warning">
          <strong>Catalog not synced.</strong> Go to{" "}
          <a href="/settings">Settings</a> to sync the Kiwix catalog first.
        </div>
      ) : (
        <>
          <div class="card mb-4">
            <div class="card-body">
              <form
                hx-get="/browse/search"
                hx-target="#book-results"
                hx-trigger="submit"
                hx-push-url="true"
              >
                <div class="row g-3">
                  <div class="col-md-4">
                    <input
                      type="text"
                      class="form-control"
                      name="q"
                      placeholder="Search books..."
                      value={query}
                    />
                  </div>
                  <div
                    class="col-md-3"
                    x-data={`{
                      savedLang: $persist('').as('_x_zim-language'),
                      init() {
                        // Migrate from old localStorage format (plain string) to Alpine's JSON format
                        const oldKey = 'zim-language';
                        const oldValue = localStorage.getItem(oldKey);
                        if (oldValue && !oldValue.startsWith('"')) {
                          // Old format was plain string, migrate it
                          this.savedLang = oldValue;
                          localStorage.removeItem(oldKey);
                        }

                        // If we have a saved language and none in URL, apply it
                        const urlLang = new URLSearchParams(window.location.search).get('lang');
                        if (this.savedLang && !urlLang) {
                          let p = new URLSearchParams(window.location.search);
                          p.set('lang', this.savedLang);
                          window.location.href = '/browse?' + p.toString();
                        }
                        // If language was explicitly cleared, clear storage
                        if (urlLang === '') this.savedLang = '';
                      }
                    }`}
                  >
                    <select
                      class="form-select"
                      name="lang"
                      id="language-select"
                      data-category={category}
                      data-query={query}
                      x-on:change={`
                        savedLang = $el.value;
                        let p = new URLSearchParams();
                        p.set('lang', $el.value);
                        if ($el.dataset.category) p.set('category', $el.dataset.category);
                        if ($el.dataset.query) p.set('q', $el.dataset.query);
                        window.location.href = '/browse?' + p.toString();
                      `}
                    >
                      <option value="">All Languages</option>
                      {languages.map((lang) => (
                        <option value={lang} selected={lang === language}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-3">
                    <select
                      class="form-select"
                      name="category"
                      data-language={language}
                      data-query={query}
                      x-data
                      x-on:change={`
                        let p = new URLSearchParams();
                        if ($el.dataset.language) p.set('lang', $el.dataset.language);
                        p.set('category', $el.value);
                        if ($el.dataset.query) p.set('q', $el.dataset.query);
                        window.location.href = '/browse?' + p.toString();
                      `}
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option value={cat} selected={cat === category}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="col-md-2">
                    <button type="submit" class="btn btn-primary w-100">
                      Search
                    </button>
                  </div>
                </div>
                {/* Hidden field to preserve tags when form is submitted */}
                <input type="hidden" name="tags" value={selectedTags.join(",")} />
              </form>
            </div>
          </div>

          <TagFilter
            availableTags={availableTags}
            selectedTags={selectedTags}
            query={query}
            language={language}
            category={category}
          />

          <p class="text-muted mb-3">
            {filteredCount.toLocaleString()} available books
          </p>

          <div class="row" id="book-results">
            <BookList
              books={books}
              query={query}
              language={language}
              category={category}
              tags={selectedTags}
              offset={0}
              hasMore={hasMore}
              libraryStatusMap={libraryStatusMap}
              kiwixServeUrl={kiwixServeUrl}
            />
          </div>
        </>
      )}
    </Layout>
  );
});

app.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const language = c.req.query("lang") ?? "";
  const category = c.req.query("category") ?? "";
  const tagsParam = c.req.query("tags") ?? "";
  const selectedTags = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const libraryStatusMap = await getLibraryStatusMap();
  const kiwixServeUrl = await getSetting("kiwixServeUrl");

  // Fetch one extra to check if there's more
  const books = await searchBooks({
    query: query || undefined,
    language: language || undefined,
    category: category || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: PAGE_SIZE + 1,
    offset,
  });

  // Check if there are more results
  const hasMore = books.length > PAGE_SIZE;
  const displayBooks = hasMore ? books.slice(0, PAGE_SIZE) : books;

  return c.html(
    <BookList
      books={displayBooks}
      query={query}
      language={language}
      category={category}
      tags={selectedTags}
      offset={offset}
      hasMore={hasMore}
      libraryStatusMap={libraryStatusMap}
      kiwixServeUrl={kiwixServeUrl}
    />
  );
});

app.post("/download/:id", async (c) => {
  const bookId = c.req.param("id");

  try {
    const download = await startDownload(bookId);
    return c.html(
      <button class="btn btn-sm btn-secondary w-100" disabled>
        Downloading... <a href="/downloads">View</a>
      </button>
    );
  } catch (err) {
    return c.html(
      <div>
        <button
          class="btn btn-sm btn-danger w-100 mb-1"
          hx-post={`/browse/download/${bookId}`}
          hx-swap="outerHTML"
        >
          Retry Download
        </button>
        <small class="text-danger">{String(err)}</small>
      </div>
    );
  }
});

export default app;
