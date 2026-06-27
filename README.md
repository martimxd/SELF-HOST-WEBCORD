# SELF-HOST-WEBCORD

WebCord is an open source, self-hosted communication platform for communities, teams, and groups of friends. Each installation keeps its own users, messages, files, and calls under administrator control.

Open source project distributed under the MIT license.

## Features

- Servers created by any user.
- Text, voice, and video channels.
- Real-time messages with Socket.IO.
- Friend requests, friend invite links, and DMs.
- Friend removal and account blocking.
- Private groups with up to 10 members.
- Online, offline, and invisible presence.
- Profile pictures and username changes.
- Bios, custom statuses, server join dates, and relationship-aware profile actions.
- Server invite links.
- Server image customization for moderators and administrators.
- Persistent uploads with random CDN URLs.
- Image, video, and audio previews.
- Replies and message forwarding across channels and DMs.
- GIPHY search with configurable content rating.
- Per-user GIF favorites that can be saved from messages and reused.
- Personal PNG, WEBP, and GIF stickers.
- Categorized search for messages, images, videos, files, and links.
- Single-use registration links created only by the super-admin, with optional expiration.
- Cards for documents, files, APKs, and EXEs.
- LiveKit calls with screen sharing.
- Call mute, deafen, camera, and screen-share controls.
- Server settings, ownership transfer, member kick/ban/unban, nicknames, timeouts, roles, permissions, channel privacy/read-only flags, and moderation logs.
- Account administration and upload limits.
- Image compression, upload deduplication, and lightweight media thumbnails.
- Deleted accounts are anonymized as `Deleted User` while preserving conversation history.
- Interface in Portuguese, English, and French.

## Installation privacy

The repository does not include:

- real users;
- messages or friendships;
- created servers;
- uploads;
- a database;
- passwords or tokens from an existing installation;
- `.env` files.

PostgreSQL, Redis, and uploads are created in new Docker volumes on first run.

## Requirements

- Linux, Windows, or macOS with Docker.
- Docker Engine 24+ and Docker Compose v2.
- At least 2 GB of RAM.
- `openssl` to generate secrets automatically.

Official installation:

- [Docker Engine](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Install Docker

If Docker is not installed yet, use the official guides above for your operating system.

Quick summary:

- Linux: install Docker Engine and the Compose plugin from the official Docker documentation.
- Windows: install Docker Desktop from the official Docker website.
- macOS: install Docker Desktop from the official Docker website.

After installation, confirm both tools are available:

```bash
docker --version
docker compose version
```

If either command fails, Docker is not ready yet and the project will not start.

## Clean install

### 1. Clone

```bash
git clone https://github.com/martimxd/SELF-HOST-WEBCORD.git
cd SELF-HOST-WEBCORD
```

### 2. Create private configuration

Recommended:

```bash
chmod +x scripts/generate-env.sh
./scripts/generate-env.sh
```

The script creates `.env` with random passwords and keys. The file is ignored by Git.

Manual alternative:

```bash
cp .env.example .env
nano .env
```

Replace every `CHANGE_ME_*` value.

### 3. Start

```bash
docker compose up -d --build
```

Check the status:

```bash
docker compose ps
docker compose logs -f api
```

### 4. First login

Open:

```text
http://localhost:3000
```

Initial credentials:

```text
username: admin
password: admin
```

The login page only shows these credentials while the initial super-admin account still exists and still requires the first password change. After the first login, WebCord forces you to choose a different username and a strong password. After that change, the login page no longer displays the initial credentials.

## Configuration

Main `.env` variables:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | Database-only password |
| `JWT_SECRET` | Session signature secret |
| `WEB_ORIGIN` | Browser origin, without a trailing slash |
| `WEB_PORT` | Local site port, usually `3000` |
| `LIVEKIT_API_KEY` | Internal LiveKit identifier |
| `LIVEKIT_API_SECRET` | LiveKit secret key |
| `GIPHY_API_KEY` | Optional GIPHY API key used by the GIF picker |
| `GIPHY_RATING` | Maximum GIPHY content rating, such as `pg-13` |
| `GIPHY_COUNTRY_CODE` | Two-letter country code sent to GIPHY |
| `MEDIA_OPTIMIZATION_ENABLED` | Enables image compression and thumbnail generation, default `true` |
| `MEDIA_IMAGE_MAX_WIDTH` | Largest image dimension kept during optimization, default `1920` |
| `MEDIA_IMAGE_QUALITY` | Image quality from `50` to `100`, default `82` |
| `MEDIA_THUMBNAIL_WIDTH` | Thumbnail max width, default `480` |
| `UPLOAD_CLEANUP_ENABLED` | Enables optional preview-cache cleanup on API start, default `false` |
| `UPLOAD_RETENTION_DAYS` | Age threshold used by cleanup for orphan previews, default `365` |
| `VITE_API_URL` | Should normally remain `/api` |
| `VITE_SOCKET_URL` | Empty uses the same domain as the site |
| `VITE_LIVEKIT_URL` | Empty uses `ws(s)://domain/livekit` |

Never publish `.env`.

To enable GIF search, create an API key in the
[GIPHY Developer Dashboard](https://developers.giphy.com/) and set
`GIPHY_API_KEY` in `.env`. Personal stickers and saved GIF favorites do not require GIPHY after a GIF URL already exists in a message.

## Media storage

Uploaded files are stored once when an identical file hash already exists. Images are compressed when `MEDIA_OPTIMIZATION_ENABLED=true`; WebCord keeps the original visual format when practical and only replaces the stored file if the optimized result is smaller. GIFs and videos remain streamable, and supported media receives lightweight thumbnails under the uploads volume.

Upload size is controlled in the admin settings by `maxUploadBytes` and defaults to 2 GB. The environment variables above control image quality and thumbnail size. Optional cleanup only removes orphan preview-cache files, not message attachments, so old messages and existing uploads remain compatible.

## Access methods

### Localhost

Configuration:

```env
WEB_ORIGIN=http://localhost:3000
WEB_PORT=3000
```

URL:

```text
http://localhost:3000
```

### Local network

Find the server IP:

```bash
hostname -I
```

Example for `192.168.1.50`:

```env
WEB_ORIGIN=http://192.168.1.50:3000
WEB_PORT=3000
```

Restart:

```bash
docker compose up -d --build
```

Devices on the LAN use:

```text
http://192.168.1.50:3000
```

Do not expose PostgreSQL or Redis on the router.

### Cloudflare Temporary Tunnel

Useful for quick tests without a domain:

1. Install [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
2. Keep WebCord running at `localhost:3000`.
3. Run:

```bash
cloudflared tunnel --url http://localhost:3000
```

The terminal prints an address similar to:

```text
https://random-name.trycloudflare.com
```

The link only exists while the process is running. Quick Tunnels are not guaranteed to stay available.

Chat, accounts, invites, and uploads work through the tunnel. Voice/video calls may fail because LiveKit WebRTC UDP traffic is not carried by a Quick Tunnel.

### Cloudflare with your own domain

For a permanent installation:

1. Add the domain to Cloudflare.
2. Create a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/).
3. Publish the hostname to:

```text
http://localhost:3000
```

4. Set:

```env
WEB_ORIGIN=https://chat.example.com
```

5. Restart the API:

```bash
docker compose up -d --force-recreate api
```

For public voice/video, read the LiveKit section in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The HTTP tunnel does not replace LiveKit media UDP ports.

### DuckDNS

1. Create a subdomain at [DuckDNS](https://www.duckdns.org/).
2. Keep the IP updated with the token provided by DuckDNS.
3. Forward ports `80` and `443` on your router to the reverse proxy.
4. For calls, also forward `7881/tcp` and `50000-50100/udp`.
5. Install Caddy and use [docs/Caddyfile.example](docs/Caddyfile.example).
6. Set:

```env
WEB_ORIGIN=https://your-subdomain.duckdns.org
```

7. Restart:

```bash
docker compose up -d --build
```

### Any other domain

Point DNS to the public IP, use HTTPS with Caddy, Nginx Proxy Manager, or Traefik, and forward all HTTP traffic to `127.0.0.1:3000`.

Example Caddy file:

```caddy
chat.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

## Ports

| Port | Protocol | Function |
| --- | --- | --- |
| `3000` | TCP | Web, API, and WebSocket through Nginx |
| `7880` | TCP | Internal/direct LiveKit signaling |
| `7881` | TCP | LiveKit RTC over TCP |
| `50000-50100` | UDP | Voice, video, and screen sharing media |

PostgreSQL and Redis are not exposed by Compose.

## Update

```bash
git pull
docker compose up -d --build
```

Prisma migrations are applied automatically when the API starts.

## Backup

Create the folder:

```bash
mkdir -p backups
```

Database:

```bash
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-webcord}" "${POSTGRES_DB:-webcord}" \
  > backups/webcord.sql
```

Uploads:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backups":/backup \
  api tar czf /backup/uploads.tar.gz -C /data/uploads .
```

## Reset everything

This command deletes all data from this installation:

```bash
docker compose down -v
docker compose up -d --build
```

Do not run it on an instance you want to preserve.

## Development

```bash
npm install
npm run db:generate
npm run lint
npm test
npm run build
```

Additional documentation:

- [Detailed deployment](docs/DEPLOYMENT.md)
- [API](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. You can use, modify, and host your own instance.

## Author

Created by [Martim](https://www.youtube.com/@MartimTech-s5b).
