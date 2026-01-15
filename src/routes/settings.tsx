import { Hono } from "hono";
import { Layout } from "../components/Layout.js";
import {
  getAllSettings,
  setSetting,
  initializeDefaults,
} from "../services/settings.js";
import { syncCatalog, getCatalogStats } from "../services/catalog.js";
import { getDiskSpace, formatBytes } from "../services/disk.js";

const app = new Hono();

app.get("/", async (c) => {
  await initializeDefaults();
  const settings = await getAllSettings();
  const catalogStats = await getCatalogStats();

  let diskInfo = null;
  try {
    diskInfo = await getDiskSpace(settings.downloadFolder);
  } catch (err) {
    // Folder might not exist yet
  }

  return c.html(
    <Layout title="Settings - ZIM Library" activeNav="settings">
      <h1>Settings</h1>
      <p class="text-muted mb-4">Configure your ZIM Library Manager.</p>

      <div class="row">
        <div class="col-md-8">
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">General Settings</h5>
            </div>
            <div class="card-body">
              <form method="post" action="/settings">
                <div class="mb-3">
                  <label for="downloadFolder" class="form-label">
                    Download Folder
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="downloadFolder"
                    name="downloadFolder"
                    value={settings.downloadFolder}
                  />
                  <div class="form-text">
                    Where ZIM files will be downloaded to.
                  </div>
                </div>

                <div class="mb-3">
                  <label for="kiwixServeUrl" class="form-label">
                    Kiwix-Serve URL
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    id="kiwixServeUrl"
                    name="kiwixServeUrl"
                    value={settings.kiwixServeUrl}
                  />
                  <div class="form-text">
                    URL of your kiwix-serve instance (e.g.,
                    http://localhost:8080)
                  </div>
                </div>

                <button type="submit" class="btn btn-primary">
                  Save Settings
                </button>
              </form>
            </div>
          </div>

          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">Catalog Sync</h5>
            </div>
            <div class="card-body">
              <p>
                <strong>Total books in catalog:</strong>{" "}
                {catalogStats.totalBooks.toLocaleString()}
              </p>
              <p>
                <strong>Last synced:</strong>{" "}
                {catalogStats.lastSync
                  ? catalogStats.lastSync.toLocaleString()
                  : "Never"}
              </p>

              <form method="post" action="/settings/sync">
                <button
                  type="submit"
                  class="btn btn-secondary"
                  hx-post="/settings/sync"
                  hx-swap="innerHTML"
                  hx-target="#sync-result"
                  hx-indicator="#sync-spinner"
                >
                  <span
                    id="sync-spinner"
                    class="spinner-border spinner-border-sm htmx-indicator me-2"
                  ></span>
                  Sync Catalog Now
                </button>
              </form>

              <div id="sync-result" class="mt-3"></div>

              <div class="alert alert-info mt-3 mb-0">
                <small>
                  The catalog is ~19MB and contains thousands of ZIM files
                  available from Kiwix.
                </small>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card">
            <div class="card-header">
              <h5 class="mb-0">Disk Space</h5>
            </div>
            <div class="card-body">
              {diskInfo ? (
                <>
                  <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1">
                      <span>Used</span>
                      <span>{diskInfo.percentUsed}%</span>
                    </div>
                    <div class="progress">
                      <div
                        class={`progress-bar ${diskInfo.percentUsed > 90 ? "bg-danger" : diskInfo.percentUsed > 70 ? "bg-warning" : "bg-success"}`}
                        style={`width: ${diskInfo.percentUsed}%`}
                      ></div>
                    </div>
                  </div>
                  <p class="mb-1">
                    <strong>Available:</strong> {formatBytes(diskInfo.available)}
                  </p>
                  <p class="mb-1">
                    <strong>Used:</strong> {formatBytes(diskInfo.used)}
                  </p>
                  <p class="mb-0">
                    <strong>Total:</strong> {formatBytes(diskInfo.total)}
                  </p>
                </>
              ) : (
                <p class="text-muted mb-0">
                  Save settings to see disk space info.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

app.post("/", async (c) => {
  const body = await c.req.parseBody();

  if (body.downloadFolder) {
    await setSetting("downloadFolder", body.downloadFolder as string);
  }
  if (body.kiwixServeUrl) {
    await setSetting("kiwixServeUrl", body.kiwixServeUrl as string);
  }

  return c.redirect("/settings");
});

app.post("/sync", async (c) => {
  try {
    const count = await syncCatalog();
    return c.html(
      <div class="alert alert-success">
        Successfully synced {count.toLocaleString()} books from Kiwix catalog!
      </div>
    );
  } catch (err) {
    return c.html(
      <div class="alert alert-danger">
        Failed to sync catalog: {String(err)}
      </div>
    );
  }
});

export default app;
