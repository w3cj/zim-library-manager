# ZIM Library Manager

A full-stack Node.js application for managing Kiwix ZIM file downloads with a web UI.

## Features

- **Browse & Search**: Search the Kiwix catalog with filters for language and category
- **Download Management**: Download ZIM files with progress tracking, pause/resume/cancel support
- **Local Library**: View downloaded ZIM files with update detection
- **Disk Space Monitoring**: Check available disk space before downloads
- **Resumable Downloads**: Uses wget with `-c` flag for automatic resume support

## Tech Stack

- **Runtime**: Node.js with pnpm
- **Language**: TypeScript
- **Web Framework**: [Hono](https://hono.dev/) with JSX
- **Frontend**: [HTMX](https://htmx.org/) for interactivity
- **Styling**: [Bootstrap 5](https://getbootstrap.com/) (Bootswatch Darkly theme)
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/)
- **Download Tool**: wget

## Prerequisites

- Node.js 18+
- pnpm
- wget (for downloads)

## Setup

```bash
# Install dependencies
pnpm install

# Generate database migrations
pnpm db:generate

# Run database migrations
pnpm db:migrate
```

## Usage

### Development

```bash
pnpm dev
```

The server will start at http://localhost:3000

### Production

```bash
pnpm build
pnpm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build TypeScript to JavaScript |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Open Drizzle Studio for database inspection |
| `pnpm sync:sample` | Sync catalog from local sample XML file |

## Project Structure

```
zim-library-manager/
├── src/
│   ├── index.tsx              # App entry point
│   ├── db/
│   │   ├── schema.ts          # Database schema
│   │   ├── index.ts           # Drizzle client
│   │   └── migrate.ts         # Migration runner
│   ├── routes/
│   │   ├── browse.tsx         # Browse/search catalog
│   │   ├── downloads.tsx      # Download management
│   │   ├── library.tsx        # Local ZIM files
│   │   └── settings.tsx       # App settings
│   ├── services/
│   │   ├── catalog.ts         # Kiwix catalog sync
│   │   ├── downloader.ts      # wget download wrapper
│   │   ├── disk.ts            # Disk space utilities
│   │   ├── library.ts         # Local file scanner
│   │   └── settings.ts        # Settings management
│   └── components/
│       └── Layout.tsx         # Base HTML layout
├── example-library-xml/
│   └── library_zim.xml        # Sample catalog for testing
├── drizzle/                   # Generated migrations
├── data/                      # SQLite database
└── drizzle.config.ts          # Drizzle configuration
```

## Pages

### Browse (`/browse`)
Search and browse the Kiwix catalog. Filter by language and category. Click "Download" to start downloading a ZIM file.

### Downloads (`/downloads`)
View active and completed downloads. Pause, resume, or cancel downloads in progress. Progress updates automatically every 2 seconds.

### Library (`/library`)
View downloaded ZIM files. Scan for new files, check for updates, and manage your local collection.

### Settings (`/settings`)
Configure:
- **Download Folder**: Where ZIM files are saved (default: `~/zim-files`)
- **Kiwix Serve URL**: URL for your kiwix-serve instance to view ZIM content
- **Catalog Sync**: Manually sync the Kiwix catalog

## Configuration

Settings are stored in the SQLite database and can be modified through the Settings page:

| Setting | Default | Description |
|---------|---------|-------------|
| `downloadFolder` | `~/zim-files` | Directory for downloaded ZIM files |
| `kiwixServeUrl` | `http://localhost:8080` | URL for kiwix-serve viewer |

## How Downloads Work

1. When you click "Download", the app fetches the meta4 file from Kiwix
2. The meta4 XML is parsed to extract mirror URLs
3. wget is spawned with `-c` flag to download from the best mirror
4. Progress is tracked by monitoring file size
5. Downloads can be paused (SIGSTOP) and resumed (SIGCONT)

## API Endpoints

### Browse
- `GET /browse` - Browse page
- `GET /browse/search` - Search with filters (HTMX partial)
- `POST /browse/download/:bookId` - Start download

### Downloads
- `GET /downloads` - Downloads page
- `GET /downloads/list` - Download list (HTMX partial)
- `POST /downloads/:id/pause` - Pause download
- `POST /downloads/:id/resume` - Resume download
- `POST /downloads/:id/cancel` - Cancel download

### Library
- `GET /library` - Library page
- `POST /library/scan` - Rescan download folder
- `DELETE /library/:id` - Delete ZIM file

### Settings
- `GET /settings` - Settings page
- `POST /settings` - Save settings
- `POST /settings/sync-catalog` - Sync Kiwix catalog

## License

MIT
