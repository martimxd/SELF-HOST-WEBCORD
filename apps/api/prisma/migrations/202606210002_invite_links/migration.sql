CREATE TABLE "ServerInvite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerInvite_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServerInvite_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServerInvite_token_key" ON "ServerInvite"("token");
CREATE INDEX "ServerInvite_serverId_idx" ON "ServerInvite"("serverId");

CREATE TABLE "FriendInvite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendInvite_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FriendInvite_token_key" ON "FriendInvite"("token");
CREATE UNIQUE INDEX "FriendInvite_ownerId_key" ON "FriendInvite"("ownerId");
