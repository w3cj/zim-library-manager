import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { initializeDefaults } from "./services/settings.js";

import browseRoutes from "./routes/browse.js";
import downloadsRoutes from "./routes/downloads.js";
import libraryRoutes from "./routes/library.js";
import settingsRoutes from "./routes/settings.js";

const app = new Hono();

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Initialize default settings
initializeDefaults().catch(console.error);

// Home page - redirect to browse
app.get("/", (c) => c.redirect("/browse"));

// Mount routes
app.route("/browse", browseRoutes);
app.route("/downloads", downloadsRoutes);
app.route("/library", libraryRoutes);
app.route("/settings", settingsRoutes);

const port = 3000;
console.log(`Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
