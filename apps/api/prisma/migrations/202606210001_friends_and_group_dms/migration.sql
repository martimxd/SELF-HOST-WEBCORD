CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

ALTER TABLE "DirectConversation"
  ALTER COLUMN "userAId" DROP NOT NULL,
  ALTER COLUMN "userBId" DROP NOT NULL,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "DirectConversation"
  ADD CONSTRAINT "DirectConversation_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DirectConversationMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectConversationMember_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DirectConversationMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DirectConversationMember_conversationId_userId_key"
  ON "DirectConversationMember"("conversationId", "userId");
CREATE INDEX "DirectConversationMember_userId_idx"
  ON "DirectConversationMember"("userId");

INSERT INTO "DirectConversationMember" ("id", "conversationId", "userId", "joinedAt")
SELECT CONCAT('dcm_', md5("id" || "userAId")), "id", "userAId", "createdAt"
FROM "DirectConversation"
WHERE "userAId" IS NOT NULL;

INSERT INTO "DirectConversationMember" ("id", "conversationId", "userId", "joinedAt")
SELECT CONCAT('dcm_', md5("id" || "userBId")), "id", "userBId", "createdAt"
FROM "DirectConversation"
WHERE "userBId" IS NOT NULL;

CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Friendship_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_addresseeId_fkey"
    FOREIGN KEY ("addresseeId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key"
  ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX "Friendship_addresseeId_status_idx"
  ON "Friendship"("addresseeId", "status");
CREATE INDEX "Friendship_requesterId_status_idx"
  ON "Friendship"("requesterId", "status");
