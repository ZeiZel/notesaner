-- CreateTable
CREATE TABLE "workspace_storage_stats" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "totalStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "noteCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "versionCount" INTEGER NOT NULL DEFAULT 0,
    "maxStorageBytes" BIGINT,
    "maxNotes" INTEGER,
    "maxFileSizeBytes" BIGINT,
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_storage_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_storage_stats_workspaceId_key" ON "workspace_storage_stats"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_storage_stats_workspaceId_idx" ON "workspace_storage_stats"("workspaceId");

-- AddForeignKey
ALTER TABLE "workspace_storage_stats" ADD CONSTRAINT "workspace_storage_stats_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
