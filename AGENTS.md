# AGENTS.md

This file provides guidance for AI coding agents working with this codebase.

## Project Overview

**ZIM Library Manager** is a web application for managing Kiwix ZIM file downloads. It allows users to browse/search the Kiwix catalog, download ZIM files with progress tracking (pause/resume/cancel), and manage a local library of downloaded content.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 18+ with pnpm |
| Language | TypeScript (ES modules) |
| Web Framework | [Hono](https://hono.dev/) with JSX |
| Frontend | [HTMX](https://htmx.org/) + Alpine.js |
| Styling | Bootstrap 5 (Bootswatch Darkly theme) |
| Database | SQLite with [Drizzle ORM](https://orm.drizzle.team/) |
| Downloads | wget (system dependency) |

## Project Structure

```
src/
├── index.tsx              # App entry point, Hono server setup
├── components/
│   └── Layout.tsx         # Base HTML layout (nav, head, scripts)
├── db/
│   ├── schema.ts          # Drizzle database schema
│   ├── index.ts           # Database client initialization
│   └── migrate.ts         # Migration runner
├── routes/
│   ├── browse.tsx         # Browse/search Kiwix catalog
│   ├── downloads.tsx      # Download queue management
│   ├── library.tsx        # Local ZIM file management
│   └── settings.tsx       # App configuration
└── services/
    ├── catalog.ts         # Kiwix catalog sync & search
    ├── downloader.ts      # wget process wrapper
    ├── disk.ts            # Disk space utilities
    ├── library.ts         # Local file scanner
    └── settings.ts        # Settings persistence
```

## Key Architectural Patterns

1. **Server-Side Rendering with HTMX**: Pages render on the server using Hono JSX. HTMX handles dynamic updates via HTML fragments—minimal client-side JavaScript.

2. **Service Layer**: Business logic lives in `src/services/`, keeping route handlers thin.

3. **wget Process Management**: Downloads spawn wget processes. Pause uses SIGSTOP, resume uses SIGCONT, cancel uses SIGTERM.

4. **Routes as Sub-Apps**: Each route file exports a Hono app mounted on the main server.

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Development server with hot reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate migrations from schema changes |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Open Drizzle Studio for DB inspection |

## Database Schema

Four tables defined in `src/db/schema.ts`:

- **settings** - Key-value store for app configuration
- **catalog_books** - Cached Kiwix catalog entries (id, title, language, size, url, tags, etc.)
- **downloads** - Download queue with status, progress, file path, PID
- **local_zims** - Discovered local ZIM files with update tracking

## Important Files

| File | Why It Matters |
|------|----------------|
| `src/index.tsx` | Application entry point, route mounting |
| `src/db/schema.ts` | All database table definitions |
| `src/services/downloader.ts` | Core download logic with process management |
| `src/services/catalog.ts` | Kiwix catalog fetching and search |
| `src/routes/browse.tsx` | Main UI with search, filtering, infinite scroll |

## Code Conventions

- **JSX Runtime**: Uses Hono's JSX (`jsxImportSource: "hono/jsx"`)
- **ES Modules**: All imports use ESM syntax
- **No Test Suite**: Tests do not currently exist
- **Vendored Frontend Libs**: HTMX, Alpine.js, Bootstrap are in `public/`

## External Integrations

- **Kiwix Catalog**: Fetches from `https://download.kiwix.org/library/library_zim.xml`
- **Meta4 Files**: Parsed to resolve mirror URLs for ZIM downloads
- **Kiwix Serve**: Optional integration for viewing downloaded content
