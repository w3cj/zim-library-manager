# Contributing

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
- wget

## Setup

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate
```

## Development

```bash
pnpm dev
```

The server will start at http://localhost:3000

## Production Build

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
├── drizzle/                   # Generated migrations
├── data/                      # SQLite database
└── drizzle.config.ts          # Drizzle configuration
```

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

## How Downloads Work

1. When you click "Download", the app fetches the meta4 file from Kiwix
2. The meta4 XML is parsed to extract mirror URLs
3. wget is spawned with `-c` flag to download from the best mirror
4. Progress is tracked by monitoring file size
5. Downloads can be paused (SIGSTOP) and resumed (SIGCONT)
