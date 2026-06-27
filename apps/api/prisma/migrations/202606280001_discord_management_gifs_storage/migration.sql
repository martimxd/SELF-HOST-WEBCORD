-- Extend server management and media storage without deleting existing data.

ALTER TABLE "ServerMember"
  ADD COLUMN IF NOT EXISTS "nickname" TEXT,
  ADD COLUMN IF NOT EXISTS "timeoutUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ServerMember_serverId_role_idx" ON "ServerMember"("serverId", "role");

ALTER TABLE "ServerBan"
  ADD COLUMN IF NOT EXISTS "moderatorId" TEXT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServerBan_moderatorId_fkey'
  ) THEN
    ALTER TABLE "ServerBan"
      ADD CONSTRAINT "ServerBan_moderatorId_fkey"
      FOREIGN KEY ("moderatorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "isReadOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Channel_serverId_position_idx" ON "Channel"("serverId", "position");
CREATE INDEX IF NOT EXISTS "Channel_serverId_category_idx" ON "Channel"("serverId", "category");

CREATE INDEX IF NOT EXISTS "Role_serverId_position_idx" ON "Role"("serverId", "position");

CREATE TABLE IF NOT EXISTS "RoleAssignment" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RoleAssignment_memberId_fkey'
  ) THEN
    ALTER TABLE "RoleAssignment"
      ADD CONSTRAINT "RoleAssignment_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "ServerMember"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RoleAssignment_roleId_fkey'
  ) THEN
    ALTER TABLE "RoleAssignment"
      ADD CONSTRAINT "RoleAssignment_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "RoleAssignment_memberId_roleId_key" ON "RoleAssignment"("memberId", "roleId");
CREATE INDEX IF NOT EXISTS "RoleAssignment_roleId_idx" ON "RoleAssignment"("roleId");

CREATE TABLE IF NOT EXISTS "ChannelPermissionOverwrite" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "allowedPermissions" TEXT[] NOT NULL,
  "deniedPermissions" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelPermissionOverwrite_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChannelPermissionOverwrite_channelId_fkey'
  ) THEN
    ALTER TABLE "ChannelPermissionOverwrite"
      ADD CONSTRAINT "ChannelPermissionOverwrite_channelId_fkey"
      FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChannelPermissionOverwrite_roleId_fkey'
  ) THEN
    ALTER TABLE "ChannelPermissionOverwrite"
      ADD CONSTRAINT "ChannelPermissionOverwrite_roleId_fkey"
      FOREIGN KEY ("roleId") REFERENCES "Role"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelPermissionOverwrite_channelId_roleId_key"
  ON "ChannelPermissionOverwrite"("channelId", "roleId");
CREATE INDEX IF NOT EXISTS "ChannelPermissionOverwrite_roleId_idx"
  ON "ChannelPermissionOverwrite"("roleId");

CREATE TABLE IF NOT EXISTS "ModerationLog" (
  "id" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationLog_serverId_fkey'
  ) THEN
    ALTER TABLE "ModerationLog"
      ADD CONSTRAINT "ModerationLog_serverId_fkey"
      FOREIGN KEY ("serverId") REFERENCES "Server"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ModerationLog_actorId_fkey'
  ) THEN
    ALTER TABLE "ModerationLog"
      ADD CONSTRAINT "ModerationLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ModerationLog_serverId_createdAt_idx" ON "ModerationLog"("serverId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationLog_targetUserId_idx" ON "ModerationLog"("targetUserId");

ALTER TABLE "Upload"
  ADD COLUMN IF NOT EXISTS "originalSize" BIGINT,
  ADD COLUMN IF NOT EXISTS "optimized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "optimizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailStoredName" TEXT;

CREATE INDEX IF NOT EXISTS "Upload_contentHash_idx" ON "Upload"("contentHash");
CREATE INDEX IF NOT EXISTS "Upload_createdAt_idx" ON "Upload"("createdAt");

CREATE TABLE IF NOT EXISTS "GifFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gifId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "previewUrl" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'giphy',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GifFavorite_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GifFavorite_userId_fkey'
  ) THEN
    ALTER TABLE "GifFavorite"
      ADD CONSTRAINT "GifFavorite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GifFavorite_userId_gifId_key" ON "GifFavorite"("userId", "gifId");
CREATE INDEX IF NOT EXISTS "GifFavorite_userId_createdAt_idx" ON "GifFavorite"("userId", "createdAt");
