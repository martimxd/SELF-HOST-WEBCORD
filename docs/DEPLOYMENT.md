# WebCord Deployment

This guide covers LAN access, DuckDNS, a custom domain, and Cloudflare Tunnel.

## Network Architecture

The `web` container exposes a single HTTP port:

```text
browser -> :3000 -> Nginx
                      |-> frontend
                      |-> /api -> Fastify
                      |-> /socket.io -> Socket.IO
                      |-> /livekit -> LiveKit signaling
```

WebRTC media does not pass through Nginx. Voice, video, and screen sharing use the LiveKit ports directly.

## Required Preparation

```bash
./scripts/generate-env.sh
docker compose config
docker compose up -d --build
docker compose ps
```

All services should report `healthy` or `running`.

## LAN

Example:

```env
WEB_ORIGIN=http://192.168.1.50:3000
WEB_PORT=3000
```

Allow the required ports through the firewall:

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 50000:50100/udp
```

Port forwarding on the router is not required for LAN-only access.

## HTTPS with Caddy

Install Caddy and copy the example configuration:

```bash
sudo cp docs/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Set the public origin:

```env
WEB_ORIGIN=https://chat.example.com
```

Restart the API:

```bash
docker compose up -d --force-recreate api
```

Caddy automatically manages Let's Encrypt certificates when DNS and ports `80/443` are configured correctly.

## DuckDNS

### Dynamic DNS

Create a domain and obtain a token at:

```text
https://www.duckdns.org/
```

Test the update:

```bash
curl "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip="
```

Automate it with cron:

```bash
crontab -e
```

Example for an update every five minutes:

```cron
*/5 * * * * curl -fsS "https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" >/dev/null
```

### Router

Forward these ports to the server's LAN IP:

- `80/tcp`
- `443/tcp`
- `7881/tcp`
- `50000-50100/udp`

Do not forward PostgreSQL or Redis.

### WebCord

```env
WEB_ORIGIN=https://YOUR_SUBDOMAIN.duckdns.org
```

Use the example Caddyfile and restart the stack.

## Cloudflare Quick Tunnel

Install `cloudflared` using the official documentation:

```text
https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
```

Run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Advantages:

- no domain is required;
- no HTTP ports need to be opened;
- temporary HTTPS is provided.

Limitations:

- the address changes when a new tunnel is created;
- uptime is not guaranteed;
- LiveKit UDP does not pass through the tunnel;
- it is not the recommended production configuration.

## Cloudflare Named Tunnel

In the Cloudflare dashboard:

1. Open `Networking > Tunnels`.
2. Create a tunnel with `cloudflared`.
3. Add a public hostname.
4. Set the service to:

```text
http://localhost:3000
```

5. Set `WEB_ORIGIN=https://hostname`.

The tunnel protects the website, API, Socket.IO, and signaling. WebRTC media has two options:

- expose `7881/tcp` and `50000-50100/udp` directly;
- configure TURN or LiveKit on suitable external infrastructure.

A standard Cloudflare Tunnel is not a generic UDP relay for these ports.

## Public LiveKit

Included configuration:

- signaling on `7880`;
- RTC over TCP on `7881`;
- RTC over UDP on `50000-50100`;
- safe local and LAN configuration by default.

Requirements:

- a reachable public IP address;
- port forwarding on the router;
- an open firewall;
- no CGNAT, or use of an external server or TURN service.

If the ISP uses CGNAT, chat and uploads may work while calls fail.

On a public server behind NAT, change `infra/docker/livekit.yaml`:

```yaml
rtc:
  use_external_ip: true
```

Then restart LiveKit:

```bash
docker compose up -d --force-recreate livekit
```

This option requires DNS and outbound access to discover the public IP address. If it is not reliable, configure dedicated LiveKit or TURN infrastructure.

## Reverse Proxies

The proxy should:

- forward `/` to `127.0.0.1:3000`;
- preserve `Host`;
- send `X-Forwarded-Proto`;
- support WebSocket connections;
- accept large uploads.

The included Nginx configuration internally forwards `/api`, `/socket.io`, and `/livekit`.

## Security

- Use random passwords in `.env`.
- Keep `.env` out of Git.
- Do not expose PostgreSQL or Redis ports.
- Use HTTPS outside private networks.
- Update Docker images regularly.
- Make backups before updating.
- Restrict port `3000` to the reverse proxy when the instance is public.

## Diagnostics

Status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f livekit
```

API:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"status":"ok"}
```

Final configuration:

```bash
docker compose config
```

LiveKit ports:

```bash
docker compose exec livekit /livekit-server ports --config /etc/livekit.yaml
```

## Backup and Restore

Do not copy active volumes without ensuring consistency. Use `pg_dump` for PostgreSQL and archive the uploads volume.

Restore the database:

```bash
cat backups/webcord.sql | docker compose exec -T postgres \
  psql -U webcord webcord
```

To restore uploads, extract the archive into the correct volume while the stack is stopped:

```bash
docker compose stop api
docker compose run --rm --no-deps \
  -v "$PWD/backups":/backup \
  api tar xzf /backup/uploads.tar.gz -C /data/uploads
docker compose start api
```
