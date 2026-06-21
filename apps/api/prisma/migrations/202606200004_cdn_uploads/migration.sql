ALTER TABLE "Upload" ADD COLUMN "publicToken" TEXT;
ALTER TABLE "Upload" ADD COLUMN "directConversationId" TEXT;
CREATE UNIQUE INDEX "Upload_publicToken_key" ON "Upload"("publicToken");
ALTER TABLE "Upload"
  ADD CONSTRAINT "Upload_directConversationId_fkey"
  FOREIGN KEY ("directConversationId") REFERENCES "DirectConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
