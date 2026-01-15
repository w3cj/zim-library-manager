import { Hono } from "hono";
import { Layout } from "../components/Layout.js";
import {
  getAllDownloads,
  getDownloadProgress,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  deleteDownload,
  type DownloadProgress,
} from "../services/downloader.js";
import { getBookById } from "../services/catalog.js";
import { formatBytes, getDiskSpace } from "../services/disk.js";
import { getSetting } from "../services/settings.js";
import type { Download } from "../db/index.js";

const app = new Hono();

async function DownloadCard({ download }: { download: Download }) {
  const progress = await getDownloadProgress(download.id);
  const book = download.bookId ? await getBookById(download.bookId) : null;

  const statusColors: Record<string, string> = {
    downloading: "primary",
    paused: "warning",
    completed: "success",
    failed: "danger",
    queued: "secondary",
  };

  const statusColor = statusColors[download.status] ?? "secondary";

  return (
    <div class="card mb-3" id={`download-${download.id}`}>
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 class="card-title mb-1">{book?.title ?? "Unknown Book"}</h5>
            <span class={`badge bg-${statusColor}`}>{download.status}</span>
          </div>
          <div class="btn-group btn-group-sm">
            {download.status === "downloading" && (
              <button
                class="btn btn-outline-warning"
                hx-post={`/downloads/${download.id}/pause`}
                hx-target={`#download-${download.id}`}
                hx-swap="outerHTML"
              >
                Pause
              </button>
            )}
            {download.status === "paused" && (
              <button
                class="btn btn-outline-success"
                hx-post={`/downloads/${download.id}/resume`}
                hx-target={`#download-${download.id}`}
                hx-swap="outerHTML"
              >
                Resume
              </button>
            )}
            {(download.status === "downloading" ||
              download.status === "paused" ||
              download.status === "queued") && (
              <button
                class="btn btn-outline-danger"
                hx-post={`/downloads/${download.id}/cancel`}
                hx-target={`#download-${download.id}`}
                hx-swap="outerHTML"
                hx-confirm="Cancel this download?"
              >
                Cancel
              </button>
            )}
            {(download.status === "completed" ||
              download.status === "failed") && (
              <button
                class="btn btn-outline-secondary"
                hx-delete={`/downloads/${download.id}`}
                hx-target={`#download-${download.id}`}
                hx-swap="outerHTML"
                hx-confirm="Remove from list?"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {progress && (download.status === "downloading" || download.status === "paused") && (
          <div>
            <div class="d-flex justify-content-between mb-1">
              <small>
                {formatBytes(progress.bytesDownloaded)} /{" "}
                {formatBytes(progress.totalBytes)}
              </small>
              <small>{progress.percentage.toFixed(1)}%</small>
            </div>
            <div class="progress" style="height: 20px;">
              <div
                class={`progress-bar ${download.status === "paused" ? "bg-warning" : "progress-bar-striped progress-bar-animated"}`}
                style={`width: ${progress.percentage}%`}
              >
                {progress.percentage.toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {download.status === "failed" && download.error && (
          <div class="alert alert-danger mt-2 mb-0 py-2">
            <small>{download.error}</small>
          </div>
        )}

        {download.status === "completed" && (
          <div class="text-muted mt-2">
            <small>
              Completed:{" "}
              {download.completedAt
                ? new Date(download.completedAt).toLocaleString()
                : "Unknown"}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

async function DownloadList({ downloads }: { downloads: Download[] }) {
  if (downloads.length === 0) {
    return (
      <div class="alert alert-secondary">
        No downloads. <a href="/browse">Browse the catalog</a> to start
        downloading.
      </div>
    );
  }

  return (
    <>
      {await Promise.all(
        downloads.map(async (download) => <DownloadCard download={download} />)
      )}
    </>
  );
}

app.get("/", async (c) => {
  const downloads = await getAllDownloads();
  const downloadFolder = await getSetting("downloadFolder");

  let diskInfo = null;
  try {
    diskInfo = await getDiskSpace(downloadFolder);
  } catch (err) {
    // Ignore
  }

  const activeCount = downloads.filter((d) => d.status === "downloading").length;

  return c.html(
    <Layout title="Downloads - ZIM Library" activeNav="downloads">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="mb-0">Downloads</h1>
          <p class="text-muted mb-0">Monitor and manage your downloads.</p>
        </div>
        {diskInfo && (
          <div class="text-end">
            <div class="small text-muted">Available Space</div>
            <div class="h5 mb-0">{formatBytes(diskInfo.available)}</div>
          </div>
        )}
      </div>

      <div
        id="download-list"
        hx-get="/downloads/list"
        hx-trigger={activeCount > 0 ? "every 2s" : undefined}
        hx-swap="innerHTML"
      >
        <DownloadList downloads={downloads} />
      </div>
    </Layout>
  );
});

app.get("/list", async (c) => {
  const downloads = await getAllDownloads();
  return c.html(<DownloadList downloads={downloads} />);
});

app.post("/:id/pause", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await pauseDownload(id);
  const downloads = await getAllDownloads();
  const download = downloads.find((d) => d.id === id);
  if (download) {
    return c.html(<DownloadCard download={download} />);
  }
  return c.text("Download not found", 404);
});

app.post("/:id/resume", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await resumeDownload(id);
  const downloads = await getAllDownloads();
  const download = downloads.find((d) => d.id === id);
  if (download) {
    return c.html(<DownloadCard download={download} />);
  }
  return c.text("Download not found", 404);
});

app.post("/:id/cancel", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await cancelDownload(id);
  const downloads = await getAllDownloads();
  const download = downloads.find((d) => d.id === id);
  if (download) {
    return c.html(<DownloadCard download={download} />);
  }
  return c.text("Download not found", 404);
});

app.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await deleteDownload(id);
  return c.html(<></>);
});

export default app;
