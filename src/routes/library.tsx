import { Hono } from "hono";
import { Layout } from "../components/Layout.js";
import {
  getLocalLibrary,
  scanLibrary,
  deleteLocalZim,
  getUpdateCount,
  getLibraryTotalSize,
} from "../services/library.js";
import { startDownload } from "../services/downloader.js";
import { formatBytes, getDiskSpace } from "../services/disk.js";
import { getSetting } from "../services/settings.js";
import type { LocalZim, CatalogBook } from "../db/index.js";

const app = new Hono();

type LocalZimWithCatalog = LocalZim & { catalogInfo: CatalogBook | null };

function ZimCard({
  zim,
  kiwixServeUrl,
}: {
  zim: LocalZimWithCatalog;
  kiwixServeUrl: string;
}) {
  const viewUrl = `${kiwixServeUrl}/${encodeURIComponent(zim.fileName.replace(".zim", ""))}`;

  // Use bookId as anchor for linking from browse page
  const anchorId = zim.bookId ? `zim-${zim.bookId}` : `zim-${zim.id}`;

  return (
    <div class="card mb-3" id={anchorId}>
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div class="d-flex align-items-start">
            {zim.catalogInfo?.favicon && (
              <img
                src={`data:image/png;base64,${zim.catalogInfo.favicon}`}
                alt=""
                class="me-3"
                style="width: 48px; height: 48px;"
              />
            )}
            <div>
              <h5 class="card-title mb-1">
                {zim.catalogInfo?.title ?? zim.fileName}
                {zim.hasUpdate && (
                  <span class="badge bg-warning text-dark ms-2">Update Available</span>
                )}
              </h5>
              <p class="text-muted mb-1 small">
                {zim.catalogInfo?.description ?? "No description available"}
              </p>
              <div class="small">
                <span class="text-muted me-3">
                  Size: {formatBytes(zim.fileSize ?? 0)}
                </span>
                {zim.catalogInfo?.language && (
                  <span class="badge bg-secondary me-2">
                    {zim.catalogInfo.language}
                  </span>
                )}
                {zim.catalogInfo?.hasPictures && (
                  <span class="badge bg-success me-2">pics</span>
                )}
                {zim.catalogInfo?.hasVideos && (
                  <span class="badge bg-success me-2">vids</span>
                )}
                {zim.catalogInfo?.articleCount && (
                  <span class="text-muted">
                    {zim.catalogInfo.articleCount.toLocaleString()} articles
                  </span>
                )}
              </div>
            </div>
          </div>
          <div class="btn-group btn-group-sm">
            <a
              href={viewUrl}
              target="_blank"
              class="btn btn-outline-primary"
              title="Open in Kiwix-Serve"
            >
              View
            </a>
            {zim.hasUpdate && zim.catalogInfo && (
              <button
                class="btn btn-outline-info"
                hx-post={`/library/${zim.id}/update`}
                hx-target={`#${anchorId}`}
                hx-swap="outerHTML"
                hx-confirm={`Download the latest version of ${zim.catalogInfo.title}?`}
              >
                Update
              </button>
            )}
            <button
              class="btn btn-outline-danger"
              hx-delete={`/library/${zim.id}`}
              hx-target={`#${anchorId}`}
              hx-swap="outerHTML"
              hx-confirm={`Delete ${zim.fileName}? This cannot be undone.`}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZimList({
  zims,
  kiwixServeUrl,
}: {
  zims: LocalZimWithCatalog[];
  kiwixServeUrl: string;
}) {
  if (zims.length === 0) {
    return (
      <div class="alert alert-secondary">
        No ZIM files found. <a href="/browse">Browse the catalog</a> to
        download some content.
      </div>
    );
  }

  return (
    <>
      {zims.map((zim) => (
        <ZimCard zim={zim} kiwixServeUrl={kiwixServeUrl} />
      ))}
    </>
  );
}

app.get("/", async (c) => {
  const downloadFolder = await getSetting("downloadFolder");
  const kiwixServeUrl = await getSetting("kiwixServeUrl");

  const zims = (await getLocalLibrary()) as LocalZimWithCatalog[];
  const updateCount = await getUpdateCount();
  const folderSize = await getLibraryTotalSize();

  let diskInfo = null;
  try {
    diskInfo = await getDiskSpace(downloadFolder);
  } catch (err) {
    // Ignore
  }

  return c.html(
    <Layout title="Library - ZIM Library" activeNav="library">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="mb-0">My Library</h1>
          <p class="text-muted mb-0">
            {zims.length} ZIM file{zims.length !== 1 ? "s" : ""} in your library
            {updateCount > 0 && (
              <span class="badge bg-info ms-2">
                {updateCount} update{updateCount !== 1 ? "s" : ""} available
              </span>
            )}
          </p>
        </div>
        <div class="text-end">
          {folderSize > 0 && (
            <div>
              <div class="small text-muted">Library Size</div>
              <div class="h5 mb-0">{formatBytes(folderSize)}</div>
            </div>
          )}
        </div>
      </div>

      <div class="mb-3">
        <button
          class="btn btn-outline-secondary btn-sm"
          hx-post="/library/scan"
          hx-target="#zim-list"
          hx-swap="innerHTML"
        >
          Rescan Library
        </button>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <div class="small mb-0">
            <strong>Download Folder:</strong> {downloadFolder}
          </div>
          <div class="small mb-0">
            <strong>Kiwix-Serve URL:</strong>{" "}
            <a href={kiwixServeUrl} target="_blank">
              {kiwixServeUrl}
            </a>
          </div>
        </div>
      </div>

      <div id="zim-list">
        <ZimList zims={zims} kiwixServeUrl={kiwixServeUrl} />
      </div>
    </Layout>
  );
});

app.post("/scan", async (c) => {
  await scanLibrary();
  const zims = (await getLocalLibrary()) as LocalZimWithCatalog[];
  const kiwixServeUrl = await getSetting("kiwixServeUrl");
  return c.html(<ZimList zims={zims} kiwixServeUrl={kiwixServeUrl} />);
});

app.post("/:id/update", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const zims = (await getLocalLibrary()) as LocalZimWithCatalog[];
  const zim = zims.find((z) => z.id === id);

  if (!zim || !zim.bookId) {
    return c.text("ZIM file not found or has no catalog match", 404);
  }

  const anchorId = zim.bookId || `zim-${id}`;

  try {
    await startDownload(zim.bookId);
    return c.html(
      <div class="alert alert-success" id={anchorId}>
        Update started! <a href="/downloads">View downloads</a>
      </div>
    );
  } catch (err) {
    const kiwixServeUrl = await getSetting("kiwixServeUrl");
    return c.html(
      <div id={anchorId}>
        <ZimCard zim={zim} kiwixServeUrl={kiwixServeUrl} />
        <div class="alert alert-danger">Failed to start update: {String(err)}</div>
      </div>
    );
  }
});

app.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await deleteLocalZim(id);
  return c.html(<></>);
});

export default app;
