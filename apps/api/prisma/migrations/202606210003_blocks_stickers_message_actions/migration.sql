ALTER TABLE "Message"
  ADD COLUMN "forwardedFrom" TEXT;

ALTER TABLE "User"
  ADD COLUMN "bio" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "customStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Server" ADD COLUMN "imageStoredName" TEXT;

ALTER TABLE "DirectMessage"
  ADD COLUMN "replyToId" TEXT,
  ADD COLUMN "forwardedFrom" TEXT;

ALTER TABLE "DirectMessage"
  ADD CONSTRAINT "DirectMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key"
  ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE TABLE "Sticker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sticker_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sticker_storedName_key" ON "Sticker"("storedName");
CREATE UNIQUE INDEX "Sticker_publicToken_key" ON "Sticker"("publicToken");
CREATE INDEX "Sticker_ownerId_createdAt_idx" ON "Sticker"("ownerId", "createdAt");

CREATE TABLE "RegistrationInvite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationInvite_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RegistrationInvite_token_key" ON "RegistrationInvite"("token");
CREATE INDEX "RegistrationInvite_creatorId_createdAt_idx"
  ON "RegistrationInvite"("creatorId", "createdAt");
CREATE INDEX "RegistrationInvite_expiresAt_idx" ON "RegistrationInvite"("expiresAt");
