CREATE TABLE "ServerBan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerBan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServerBan_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "Server"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServerBan_userId_serverId_key"
  ON "ServerBan"("userId", "serverId");
CREATE INDEX "ServerBan_serverId_createdAt_idx"
  ON "ServerBan"("serverId", "createdAt");

ALTER TABLE "DirectConversation"
  ADD COLUMN "imageStoredName" TEXT;
