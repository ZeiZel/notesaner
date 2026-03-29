-- AddColumn
ALTER TABLE "notes" ADD COLUMN "alias" TEXT;

-- CreateIndex
-- Alias is unique within a workspace (workspaceId + alias), matching the same
-- scoping as (workspaceId, path).
CREATE UNIQUE INDEX "notes_workspaceId_alias_key" ON "notes"("workspaceId", "alias");

-- CreateIndex (standalone lookup by alias slug)
CREATE INDEX "notes_alias_idx" ON "notes"("alias");
