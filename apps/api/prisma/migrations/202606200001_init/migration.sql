CREATE TYPE "ChannelType" AS ENUM ('TEXT', 'VOICE', 'VIDEO');
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "suspended" BOOLEAN NOT NULL DEFAULT false,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Server" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ServerMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "serverId" TEXT NOT NULL REFERENCES "Server"("id") ON DELETE CASCADE,
  "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "serverId")
);
CREATE TABLE "Channel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "ChannelType" NOT NULL DEFAULT 'TEXT',
  "position" INTEGER NOT NULL DEFAULT 0,
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  "serverId" TEXT NOT NULL REFERENCES "Server"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "authorId" TEXT NOT NULL REFERENCES "User"("id"),
  "channelId" TEXT NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE,
  "replyToId" TEXT REFERENCES "Message"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");
CREATE TABLE "Role" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#8b5cf6',
  "position" INTEGER NOT NULL DEFAULT 0,
  "permissions" TEXT[] NOT NULL,
  "serverId" TEXT NOT NULL REFERENCES "Server"("id") ON DELETE CASCADE
);
CREATE TABLE "Upload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL UNIQUE,
  "mimeType" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "channelId" TEXT REFERENCES "Channel"("id") ON DELETE CASCADE,
  "messageId" TEXT REFERENCES "Message"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Setting" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL);
