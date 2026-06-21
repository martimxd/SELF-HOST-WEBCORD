# Architecture

The monorepo uses npm workspaces:

- `apps/web`: React, Vite, and the LiveKit client.
- `apps/api`: Fastify, Prisma, Socket.IO, and LiveKit token issuance.
- `packages/shared`: shared Zod schemas and quality profiles.
- PostgreSQL: persistent state.
- Redis: LiveKit pub/sub and a foundation for future horizontal scaling.
- `uploads_data` volume: local storage encapsulated for a future S3 or MinIO implementation.

The API validates authentication, server membership, friendships, and management permissions. The frontend hides actions that are not permitted, but it is never the authority. Chat uses Socket.IO rooms for channels and private conversations. Calls use one LiveKit room per voice or video channel, DM, or group.

Private conversations use a shared membership table for DMs and groups. Groups are limited to 10 members through API validation and serializable transactions when participants are added. Uploads are stored with random internal names and exposed through high-entropy opaque CDN tokens without revealing the original file name.
