# ZIM Library Manager

A web application for managing Kiwix library ZIM file downloads.

## Features

- **Browse & Search**: Search the Kiwix catalog with filters for language and category
- **Download Management**: Download ZIM files with progress tracking, pause/resume/cancel support
- **Local Library**: View downloaded ZIM files with update detection
- **Disk Space Monitoring**: Check available disk space before downloads

## Quick Start

### Docker Compose (Recommended)

```bash
curl -O https://raw.githubusercontent.com/w3cj/zim-library-manager/main/docker-compose.example.yml
mv docker-compose.example.yml docker-compose.yml
docker compose up -d
```

Open http://localhost:3000 in your browser.

### Docker Run

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v ./zim-files:/app/zim-files \
  ghcr.io/w3cj/zim-library-manager:latest
```

## Configuration

### Volumes

| Path | Description |
|------|-------------|
| `/app/data` | SQLite database (persists settings and download history) |
| `/app/zim-files` | Downloaded ZIM files |

### Settings

Settings are configured through the web UI at `/settings`:

| Setting | Default | Description |
|---------|---------|-------------|
| Download Folder | `/app/zim-files` | Directory for downloaded ZIM files |
| Kiwix Serve URL | `http://localhost:8080` | URL for kiwix-serve viewer |

## Pages

### Browse (`/browse`)
Search and browse the Kiwix catalog. Filter by language and category. Click "Download" to start downloading a ZIM file.

### Downloads (`/downloads`)
View active and completed downloads. Pause, resume, or cancel downloads in progress.

### Library (`/library`)
View downloaded ZIM files. Scan for new files, check for updates, and manage your local collection.

### Settings (`/settings`)
Configure download folder, Kiwix Serve URL, and manually sync the catalog.

## Using with Kiwix Serve

To view your downloaded ZIM files, run [kiwix-serve](https://github.com/kiwix/kiwix-tools) alongside this application:

```yaml
services:
  zim-library-manager:
    image: ghcr.io/w3cj/zim-library-manager:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./zim-files:/app/zim-files

  kiwix-serve:
    image: ghcr.io/kiwix/kiwix-serve:latest
    ports:
      - "8080:8080"
    volumes:
      - ./zim-files:/data
    command: /data/*.zim
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup instructions.

## License

MIT
