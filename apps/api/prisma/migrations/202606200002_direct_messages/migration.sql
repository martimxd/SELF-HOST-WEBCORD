CREATE TABLE "DirectConversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userAId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "userBId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE("userAId", "userBId")
);
CREATE INDEX "DirectConversation_userAId_updatedAt_idx" ON "DirectConversation"("userAId", "updatedAt");
CREATE INDEX "DirectConversation_userBId_updatedAt_idx" ON "DirectConversation"("userBId", "updatedAt");

CREATE TABLE "DirectMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "conversationId" TEXT NOT NULL REFERENCES "DirectConversation"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3)
);
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");
