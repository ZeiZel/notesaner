import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import type { BackupType, BackupCategory, BackupStatus } from '@prisma/client';
import {
  BACKUP_QUEUE,
  BACKUP_FULL_JOB,
  BACKUP_DAILY_CRON,
  BACKUP_WEEKLY_CRON,
  BACKUP_MONTHLY_CRON,
  BACKUP_RETENTION_CRON,
  BACKUP_VERIFY_CRON,
  BACKUP_RETENTION_JOB,
  BACKUP_VERIFY_JOB,
  BACKUP_ENCRYPTION_ALGORITHM,
  BACKUP_IV_LENGTH,
  BACKUP_AUTH_TAG_LENGTH,
  BACKUP_ENCRYPTED_EXT,
  DB_BACKUP_PREFIX,
  FS_BACKUP_PREFIX,
  FULL_BACKUP_PREFIX,
} from './backup.constants';
import type {
  BackupConfig,
  BackupJobData,
  BackupJobResult,
  BackupLogDto,
  BackupListResponse,
  BackupRetentionJobData,
  BackupVerifyJobData,
} from './backup.types';

/**
 * BackupService — core backup orchestration.
 *
 * Responsibilities:
 *   - Execute pg_dump for PostgreSQL database backups (streaming)
 *   - Create tar archives of workspace note directories (streaming)
 *   - Encrypt backup archives with AES-256-GCM
 *   - Upload to local filesystem or S3-compatible storage
 *   - Track backup history via BackupLog Prisma model
 *   - Schedule BullMQ cron jobs for automated backups
 *   - Provide API layer for manual triggers and status queries
 */
@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly config: BackupConfig;

  constructor(
    @InjectQueue(BACKUP_QUEUE)
    private readonly backupQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.loadConfig();
  }

  // ─── Module lifecycle ───────────────────────────────────────────────────────

  /**
   * Register all backup cron schedulers on startup.
   * Uses BullMQ upsertJobScheduler for idempotent registration.
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Backup scheduler is disabled (BACKUP_ENABLED=false)');
      return;
    }

    await this.ensureLocalDirectory();

    try {
      // Daily full backup at 02:00 UTC
      await this.backupQueue.upsertJobScheduler(
        'backup-daily-scheduler',
        { pattern: BACKUP_DAILY_CRON },
        {
          name: BACKUP_FULL_JOB,
          data: {
            type: 'FULL',
            category: 'DAILY',
            triggeredBy: 'scheduler',
          } satisfies BackupJobData,
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 20 },
          },
        },
      );

      // Weekly full backup on Sunday at 03:00 UTC
      await this.backupQueue.upsertJobScheduler(
        'backup-weekly-scheduler',
        { pattern: BACKUP_WEEKLY_CRON },
        {
          name: BACKUP_FULL_JOB,
          data: {
            type: 'FULL',
            category: 'WEEKLY',
            triggeredBy: 'scheduler',
          } satisfies BackupJobData,
          opts: {
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 10 },
          },
        },
      );

      // Monthly full backup on the 1st at 04:00 UTC
      await this.backupQueue.upsertJobScheduler(
        'backup-monthly-scheduler',
        { pattern: BACKUP_MONTHLY_CRON },
        {
          name: BACKUP_FULL_JOB,
          data: {
            type: 'FULL',
            category: 'MONTHLY',
            triggeredBy: 'scheduler',
          } satisfies BackupJobData,
          opts: {
            removeOnComplete: { count: 5 },
            removeOnFail: { count: 5 },
          },
        },
      );

      // Retention cleanup daily at 05:00 UTC
      await this.backupQueue.upsertJobScheduler(
        'backup-retention-scheduler',
        { pattern: BACKUP_RETENTION_CRON },
        {
          name: BACKUP_RETENTION_JOB,
          data: { dryRun: false } satisfies BackupRetentionJobData,
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 10 },
          },
        },
      );

      // Restore verification weekly on Wednesday at 03:00 UTC
      await this.backupQueue.upsertJobScheduler(
        'backup-verify-scheduler',
        { pattern: BACKUP_VERIFY_CRON },
        {
          name: BACKUP_VERIFY_JOB,
          data: {} satisfies BackupVerifyJobData,
          opts: {
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 10 },
          },
        },
      );

      this.logger.log(
        'Backup schedulers registered: daily (02:00), weekly (Sun 03:00), ' +
          'monthly (1st 04:00), retention (05:00), verify (Wed 03:00)',
      );
    } catch (err) {
      this.logger.error(`Failed to register backup schedulers: ${String(err)}`);
    }
  }

  // ─── Core backup operations ─────────────────────────────────────────────────

  /**
   * Execute a full backup: pg_dump + filesystem tar, combined into a single archive.
   * Returns the backup log record ID and result metadata.
   */
  async executeBackup(
    type: BackupType,
    category: BackupCategory,
    triggeredBy: string,
  ): Promise<BackupJobResult> {
    const startedAt = new Date();
    const start = Date.now();
    const timestamp = this.formatTimestamp(startedAt);
    const prefix = this.getFilePrefix(type);
    const filename = `${prefix}-${timestamp}.tar.gz${BACKUP_ENCRYPTED_EXT}`;

    // Create the backup log record
    const log = await this.prisma.backupLog.create({
      data: {
        type,
        status: 'RUNNING',
        category,
        filename,
        destination: this.getDestinationLabel(),
        triggeredBy,
        startedAt,
        expiresAt: this.calculateExpiresAt(category, startedAt),
      },
    });

    try {
      const tempDir = await fsp.mkdtemp(path.join(this.config.localPath, '.backup-tmp-'));

      try {
        const archiveParts: string[] = [];

        // Step 1: pg_dump (for DATABASE or FULL)
        if (type === 'DATABASE' || type === 'FULL') {
          const dbDumpFile = path.join(tempDir, 'database.sql');
          await this.executePgDump(dbDumpFile);
          archiveParts.push(dbDumpFile);
        }

        // Step 2: Filesystem tar (for FILESYSTEM or FULL)
        if (type === 'FILESYSTEM' || type === 'FULL') {
          const fsTarFile = path.join(tempDir, 'workspaces.tar');
          await this.executeFilesystemBackup(fsTarFile);
          archiveParts.push(fsTarFile);
        }

        // Step 3: Create combined tar.gz of all parts
        const combinedTar = path.join(tempDir, 'backup.tar.gz');
        await this.createTarGz(combinedTar, archiveParts);

        // Step 4: Encrypt the archive
        const encryptedFile = path.join(tempDir, filename);
        const checksum = await this.encryptFile(combinedTar, encryptedFile);

        // Step 5: Get file size
        const stat = await fsp.stat(encryptedFile);
        const sizeBytes = stat.size;

        // Step 6: Move to destination (local or upload to S3)
        const destination = await this.storeBackup(encryptedFile, filename);

        const durationMs = Date.now() - start;

        // Step 7: Update backup log
        await this.prisma.backupLog.update({
          where: { id: log.id },
          data: {
            status: 'COMPLETED',
            sizeBytes: BigInt(sizeBytes),
            durationMs,
            checksum,
            destination,
            completedAt: new Date(),
            metadata: {
              pgDumpVersion: await this.getPgDumpVersion(),
              workspaceCount: await this.getWorkspaceCount(),
              nodeVersion: process.version,
            },
          },
        });

        this.logger.log(
          `Backup completed: ${filename} (${this.formatSize(sizeBytes)}) in ${durationMs}ms`,
        );

        return {
          backupLogId: log.id,
          type,
          category,
          filename,
          destination,
          sizeBytes,
          durationMs,
          checksum,
        };
      } finally {
        // Always clean up temp directory
        await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {
          /* best-effort cleanup */
        });
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.prisma.backupLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          durationMs,
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      this.logger.error(`Backup failed: ${errorMessage}`);
      throw err;
    }
  }

  // ─── pg_dump ──────────────────────────────────────────────────────────────

  /**
   * Execute pg_dump to a file using streaming.
   * Reads DATABASE_URL from environment to derive connection parameters.
   */
  private async executePgDump(outputPath: string): Promise<void> {
    const databaseUrl = this.configService.get<string>('database.url');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);

      const pgDump = spawn(this.config.pgDumpPath, [
        '--format=custom',
        '--compress=6',
        '--no-owner',
        '--no-privileges',
        `--dbname=${databaseUrl}`,
      ]);

      let stderr = '';

      pgDump.stdout.pipe(output);

      pgDump.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      pgDump.on('error', (err) => {
        output.destroy();
        reject(new Error(`pg_dump spawn error: ${err.message}`));
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`pg_dump exited with code ${code}: ${stderr.trim() || 'unknown error'}`),
          );
        }
      });

      // Timeout: 30 minutes for large databases
      const timeout = setTimeout(
        () => {
          pgDump.kill('SIGTERM');
          reject(new Error('pg_dump timed out after 30 minutes'));
        },
        30 * 60 * 1000,
      );

      pgDump.on('close', () => clearTimeout(timeout));
    });
  }

  // ─── Filesystem backup ────────────────────────────────────────────────────

  /**
   * Create a tar archive of all workspace storage directories.
   * Uses streaming to handle large vaults efficiently.
   */
  private async executeFilesystemBackup(outputPath: string): Promise<void> {
    const storageRoot = this.configService.get<string>(
      'storage.root',
      '/var/lib/notesaner/workspaces',
    );

    // Verify storage root exists
    try {
      await fsp.access(storageRoot, fs.constants.R_OK);
    } catch {
      throw new Error(
        `Storage root not accessible: ${storageRoot}. Ensure the directory exists and is readable.`,
      );
    }

    return new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', [
        '--create',
        '--file',
        outputPath,
        '--directory',
        storageRoot,
        '--preserve-permissions',
        '--exclude',
        '.DS_Store',
        '--exclude',
        '*.tmp',
        '--exclude',
        '.backup-tmp-*',
        '.',
      ]);

      let stderr = '';

      tar.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      tar.on('error', (err) => {
        reject(new Error(`tar spawn error: ${err.message}`));
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar exited with code ${code}: ${stderr.trim() || 'unknown error'}`));
        }
      });

      // Timeout: 60 minutes for very large vaults
      const timeout = setTimeout(
        () => {
          tar.kill('SIGTERM');
          reject(new Error('tar timed out after 60 minutes'));
        },
        60 * 60 * 1000,
      );

      tar.on('close', () => clearTimeout(timeout));
    });
  }

  // ─── Archive creation ─────────────────────────────────────────────────────

  /**
   * Create a gzipped tar archive from a list of input files.
   */
  private async createTarGz(outputPath: string, inputFiles: string[]): Promise<void> {
    // First create the tar
    for (const inputFile of inputFiles) {
      await new Promise<void>((resolve, reject) => {
        const isFirst = inputFile === inputFiles[0];
        const tar = spawn('tar', [
          isFirst ? '--create' : '--append',
          '--file',
          outputPath.replace('.gz', ''),
          '--directory',
          path.dirname(inputFile),
          path.basename(inputFile),
        ]);

        let stderr = '';
        tar.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        tar.on('error', (err) => reject(new Error(`tar create error: ${err.message}`)));
        tar.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`tar create exited with code ${code}: ${stderr.trim()}`));
        });
      });
    }

    // Then gzip it
    const tarPath = outputPath.replace('.gz', '');
    const readStream = fs.createReadStream(tarPath);
    const gzipStream = createGzip({ level: 6 });
    const writeStream = fs.createWriteStream(outputPath);

    await pipeline(readStream, gzipStream, writeStream);

    // Clean up uncompressed tar
    await fsp.unlink(tarPath).catch(() => {});
  }

  // ─── Encryption ───────────────────────────────────────────────────────────

  /**
   * Encrypt a file using AES-256-GCM with streaming.
   * Returns the SHA-256 checksum of the encrypted output.
   *
   * File format: [16-byte IV][16-byte auth tag][encrypted data]
   */
  async encryptFile(inputPath: string, outputPath: string): Promise<string> {
    const key = Buffer.from(this.config.encryptionKey, 'hex');
    if (key.length !== 32) {
      throw new Error('BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }

    const iv = crypto.randomBytes(BACKUP_IV_LENGTH);
    const cipher = crypto.createCipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv);
    const hash = crypto.createHash('sha256');

    const readStream = fs.createReadStream(inputPath);
    const writeStream = fs.createWriteStream(outputPath);

    // Write IV first (will write auth tag after encryption completes)
    writeStream.write(iv);

    // Placeholder for auth tag — we will seek back and write it
    const authTagPlaceholder = Buffer.alloc(BACKUP_AUTH_TAG_LENGTH);
    writeStream.write(authTagPlaceholder);

    // Pipe: read -> cipher -> [hash + write]
    const hashTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    await pipeline(readStream, cipher, hashTransform, writeStream);

    // Get auth tag and write it at the correct position
    const authTag = cipher.getAuthTag();

    // Rewrite the file with correct auth tag
    const fd = await fsp.open(outputPath, 'r+');
    try {
      await fd.write(authTag, 0, BACKUP_AUTH_TAG_LENGTH, BACKUP_IV_LENGTH);
    } finally {
      await fd.close();
    }

    // Include IV and auth tag in the checksum computation
    const finalHash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(outputPath);
    for await (const chunk of fileStream) {
      finalHash.update(chunk as Buffer);
    }

    return finalHash.digest('hex');
  }

  /**
   * Decrypt a backup file. Used for restore verification.
   * Returns the path to the decrypted file.
   */
  async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    const key = Buffer.from(this.config.encryptionKey, 'hex');

    // Read IV and auth tag from the file header
    const fd = await fsp.open(inputPath, 'r');
    try {
      const headerBuf = Buffer.alloc(BACKUP_IV_LENGTH + BACKUP_AUTH_TAG_LENGTH);
      await fd.read(headerBuf, 0, headerBuf.length, 0);

      const iv = headerBuf.subarray(0, BACKUP_IV_LENGTH);
      const authTag = headerBuf.subarray(
        BACKUP_IV_LENGTH,
        BACKUP_IV_LENGTH + BACKUP_AUTH_TAG_LENGTH,
      );

      const decipher = crypto.createDecipheriv(BACKUP_ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const readStream = fs.createReadStream(inputPath, {
        start: BACKUP_IV_LENGTH + BACKUP_AUTH_TAG_LENGTH,
      });
      const writeStream = fs.createWriteStream(outputPath);

      await pipeline(readStream, decipher, writeStream);
    } finally {
      await fd.close();
    }
  }

  // ─── Storage (local / S3) ─────────────────────────────────────────────────

  /**
   * Store a backup file at the configured destination.
   * Returns the final destination label.
   */
  private async storeBackup(filePath: string, filename: string): Promise<string> {
    if (this.config.s3) {
      return this.uploadToS3(filePath, filename);
    }

    return this.storeLocally(filePath, filename);
  }

  private async storeLocally(filePath: string, filename: string): Promise<string> {
    const destPath = path.join(this.config.localPath, filename);

    // Use copy + unlink to handle cross-device moves
    await fsp.copyFile(filePath, destPath);

    return `local:${destPath}`;
  }

  private async uploadToS3(filePath: string, filename: string): Promise<string> {
    const s3 = this.config.s3 as NonNullable<typeof this.config.s3>;

    // Dynamic import to avoid hard dependency when S3 is not configured
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO / non-AWS S3
    });

    const key = s3.prefix ? `${s3.prefix}/${filename}` : filename;
    const body = fs.createReadStream(filePath);
    const stat = await fsp.stat(filePath);

    await client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: body,
        ContentLength: stat.size,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      }),
    );

    // Also keep a local copy as a fallback
    await this.storeLocally(filePath, filename);

    return `s3://${s3.bucket}/${key}`;
  }

  /**
   * Delete a backup from storage (local and/or S3).
   */
  async deleteBackup(destination: string, filename: string): Promise<void> {
    // Delete local copy
    const localPath = path.join(this.config.localPath, filename);
    await fsp.unlink(localPath).catch(() => {
      /* may not exist locally */
    });

    // Delete from S3 if applicable
    if (destination.startsWith('s3://') && this.config.s3) {
      try {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

        const s3 = this.config.s3;
        const client = new S3Client({
          endpoint: s3.endpoint,
          region: s3.region,
          credentials: {
            accessKeyId: s3.accessKeyId,
            secretAccessKey: s3.secretAccessKey,
          },
          forcePathStyle: true,
        });

        const key = s3.prefix ? `${s3.prefix}/${filename}` : filename;

        await client.send(
          new DeleteObjectCommand({
            Bucket: s3.bucket,
            Key: key,
          }),
        );
      } catch (err) {
        this.logger.error(`Failed to delete S3 backup ${filename}: ${String(err)}`);
      }
    }
  }

  // ─── Restore verification ─────────────────────────────────────────────────

  /**
   * Verify a backup by attempting to decrypt and inspect its contents.
   * Does NOT restore to the live database — only validates integrity.
   */
  async verifyBackup(backupId?: string): Promise<BackupVerifyJobResult> {
    const start = Date.now();

    // Find the backup to verify
    const backup = backupId
      ? await this.prisma.backupLog.findUnique({ where: { id: backupId } })
      : await this.prisma.backupLog.findFirst({
          where: { status: 'COMPLETED' },
          orderBy: { startedAt: 'desc' },
        });

    if (!backup) {
      return {
        backupLogId: backupId ?? 'none',
        verified: false,
        durationMs: Date.now() - start,
        error: 'No backup found to verify',
      };
    }

    const tempDir = await fsp.mkdtemp(path.join(this.config.localPath, '.verify-tmp-'));

    try {
      const localPath = path.join(this.config.localPath, backup.filename);

      // Ensure the local file exists
      try {
        await fsp.access(localPath, fs.constants.R_OK);
      } catch {
        return {
          backupLogId: backup.id,
          verified: false,
          durationMs: Date.now() - start,
          error: `Backup file not found: ${localPath}`,
        };
      }

      // Step 1: Decrypt
      const decryptedPath = path.join(tempDir, 'decrypted.tar.gz');
      await this.decryptFile(localPath, decryptedPath);

      // Step 2: Verify tar.gz integrity
      await new Promise<void>((resolve, reject) => {
        const tar = spawn('tar', ['--test', '--gunzip', '--file', decryptedPath]);

        let stderr = '';
        tar.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        tar.on('error', (err) => reject(new Error(`tar verify error: ${err.message}`)));
        tar.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`tar verify failed with code ${code}: ${stderr.trim()}`));
        });
      });

      // Step 3: Verify checksum
      const hash = crypto.createHash('sha256');
      const fileStream = fs.createReadStream(localPath);
      for await (const chunk of fileStream) {
        hash.update(chunk as Buffer);
      }
      const computedChecksum = hash.digest('hex');

      if (backup.checksum && computedChecksum !== backup.checksum) {
        return {
          backupLogId: backup.id,
          verified: false,
          durationMs: Date.now() - start,
          error: `Checksum mismatch: expected ${backup.checksum}, got ${computedChecksum}`,
        };
      }

      // Step 4: If database backup, verify pg_restore can read it
      if (backup.type === 'DATABASE' || backup.type === 'FULL') {
        // Extract and check the database dump
        await new Promise<void>((resolve, reject) => {
          const tar = spawn('tar', [
            '--extract',
            '--gunzip',
            '--file',
            decryptedPath,
            '--directory',
            tempDir,
          ]);

          tar.on('error', (err) => reject(new Error(`tar extract error: ${err.message}`)));
          tar.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`tar extract failed with code ${code}`));
          });
        });

        const dbDumpPath = path.join(tempDir, 'database.sql');
        try {
          await fsp.access(dbDumpPath, fs.constants.R_OK);

          // Verify pg_restore can list the contents (dry run)
          await new Promise<void>((resolve, reject) => {
            const pgRestore = spawn('pg_restore', ['--list', dbDumpPath]);

            pgRestore.on('error', (err) =>
              reject(new Error(`pg_restore verify error: ${err.message}`)),
            );
            pgRestore.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`pg_restore verify failed with code ${code}`));
            });
          });
        } catch (err) {
          // database.sql not found in archive — acceptable for FILESYSTEM-only
          if (backup.type === 'DATABASE') {
            throw err;
          }
        }
      }

      const durationMs = Date.now() - start;

      // Update verification timestamp
      await this.prisma.backupLog.update({
        where: { id: backup.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });

      this.logger.log(`Backup verified: ${backup.filename} in ${durationMs}ms`);

      return {
        backupLogId: backup.id,
        verified: true,
        durationMs,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Backup verification failed: ${errorMessage}`);

      return {
        backupLogId: backup.id,
        verified: false,
        durationMs: Date.now() - start,
        error: errorMessage,
      };
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // ─── API helpers ──────────────────────────────────────────────────────────

  /**
   * Schedule a manual backup via BullMQ.
   */
  async triggerManualBackup(type: BackupType): Promise<string> {
    const jobId = `backup-manual:${type}:${Date.now()}`;

    const job = await this.backupQueue.add(
      BACKUP_FULL_JOB,
      {
        type,
        category: 'MANUAL',
        triggeredBy: 'manual',
      } satisfies BackupJobData,
      {
        jobId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
      },
    );

    this.logger.log(`Manual backup triggered: ${type}, job ${job.id}`);
    return job.id ?? jobId;
  }

  /**
   * List backup logs with optional filtering.
   */
  async listBackups(options?: {
    limit?: number;
    offset?: number;
    type?: BackupType;
    status?: BackupStatus;
  }): Promise<BackupListResponse> {
    const { limit = 50, offset = 0, type, status } = options ?? {};

    const where = {
      ...(type && { type }),
      ...(status && { status }),
    };

    const [backups, total] = await Promise.all([
      this.prisma.backupLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.backupLog.count({ where }),
    ]);

    // Compute statistics
    const [lastSuccessful, lastFailed, dailyCount, weeklyCount, monthlyCount, totalSizeResult] =
      await Promise.all([
        this.prisma.backupLog.findFirst({
          where: { status: { in: ['COMPLETED', 'VERIFIED'] } },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true },
        }),
        this.prisma.backupLog.findFirst({
          where: { status: 'FAILED' },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true },
        }),
        this.prisma.backupLog.count({
          where: {
            category: 'DAILY',
            status: { in: ['COMPLETED', 'VERIFIED'] },
          },
        }),
        this.prisma.backupLog.count({
          where: {
            category: 'WEEKLY',
            status: { in: ['COMPLETED', 'VERIFIED'] },
          },
        }),
        this.prisma.backupLog.count({
          where: {
            category: 'MONTHLY',
            status: { in: ['COMPLETED', 'VERIFIED'] },
          },
        }),
        this.prisma.$queryRaw<[{ sum: bigint | null }]>`
        SELECT COALESCE(SUM("sizeBytes"), 0) as sum
        FROM backup_logs
        WHERE status IN ('COMPLETED', 'VERIFIED')
      `,
      ]);

    return {
      backups: backups.map(this.toDto),
      total,
      stats: {
        totalSizeBytes: String(totalSizeResult[0]?.sum ?? 0),
        lastSuccessful: lastSuccessful?.startedAt.toISOString() ?? null,
        lastFailed: lastFailed?.startedAt.toISOString() ?? null,
        dailyCount,
        weeklyCount,
        monthlyCount,
      },
    };
  }

  /**
   * Get a single backup log entry by ID.
   */
  async getBackup(id: string): Promise<BackupLogDto | null> {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id },
    });

    return backup ? this.toDto(backup) : null;
  }

  /**
   * Get BullMQ job status for a backup job.
   */
  async getJobStatus(jobId: string): Promise<{ state: string; progress: unknown } | null> {
    const job = await this.backupQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return { state, progress: job.progress };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private loadConfig(): BackupConfig {
    const get = <T>(key: string, defaultValue?: T): T =>
      this.configService.get<T>(key, defaultValue as T) as T;

    const s3Endpoint = get<string>('backup.s3.endpoint', '');

    return {
      enabled: get<boolean>('backup.enabled', false),
      localPath: get<string>('backup.localPath', '/var/lib/notesaner/backups'),
      s3: s3Endpoint
        ? {
            endpoint: s3Endpoint,
            region: get<string>('backup.s3.region', 'us-east-1'),
            bucket: get<string>('backup.s3.bucket', ''),
            accessKeyId: get<string>('backup.s3.accessKeyId', ''),
            secretAccessKey: get<string>('backup.s3.secretAccessKey', ''),
            prefix: get<string>('backup.s3.prefix', 'backups'),
          }
        : null,
      encryptionKey: get<string>('backup.encryptionKey', ''),
      retention: {
        dailyCount: get<number>('backup.retention.dailyCount', 7),
        weeklyCount: get<number>('backup.retention.weeklyCount', 4),
        monthlyCount: get<number>('backup.retention.monthlyCount', 3),
      },
      alertEmail: get<string>('backup.alertEmail', '') || null,
      pgDumpPath: get<string>('backup.pgDumpPath', 'pg_dump'),
    };
  }

  private async ensureLocalDirectory(): Promise<void> {
    await fsp.mkdir(this.config.localPath, { recursive: true });
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  }

  private getFilePrefix(type: BackupType): string {
    switch (type) {
      case 'DATABASE':
        return DB_BACKUP_PREFIX;
      case 'FILESYSTEM':
        return FS_BACKUP_PREFIX;
      case 'FULL':
        return FULL_BACKUP_PREFIX;
    }
  }

  private getDestinationLabel(): string {
    if (this.config.s3) {
      return `s3://${this.config.s3.bucket}/${this.config.s3.prefix ?? ''}`;
    }
    return `local:${this.config.localPath}`;
  }

  private calculateExpiresAt(category: BackupCategory, startedAt: Date): Date | null {
    const { retention } = this.config;

    switch (category) {
      case 'DAILY':
        return new Date(startedAt.getTime() + retention.dailyCount * 24 * 60 * 60 * 1000);
      case 'WEEKLY':
        return new Date(startedAt.getTime() + retention.weeklyCount * 7 * 24 * 60 * 60 * 1000);
      case 'MONTHLY':
        return new Date(startedAt.getTime() + retention.monthlyCount * 30 * 24 * 60 * 60 * 1000);
      case 'MANUAL':
        // Manual backups do not expire by default
        return null;
    }
  }

  private async getPgDumpVersion(): Promise<string> {
    return new Promise<string>((resolve) => {
      const proc = spawn(this.config.pgDumpPath, ['--version']);
      let output = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.on('close', () => resolve(output.trim()));
      proc.on('error', () => resolve('unknown'));
    });
  }

  private async getWorkspaceCount(): Promise<number> {
    return this.prisma.workspace.count();
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private toDto(backup: {
    id: string;
    type: BackupType;
    status: BackupStatus;
    category: BackupCategory;
    filename: string;
    destination: string;
    sizeBytes: bigint;
    durationMs: number;
    checksum: string | null;
    error: string | null;
    triggeredBy: string;
    startedAt: Date;
    completedAt: Date | null;
    verifiedAt: Date | null;
    expiresAt: Date | null;
  }): BackupLogDto {
    return {
      id: backup.id,
      type: backup.type,
      status: backup.status,
      category: backup.category,
      filename: backup.filename,
      destination: backup.destination,
      sizeBytes: backup.sizeBytes.toString(),
      durationMs: backup.durationMs,
      checksum: backup.checksum,
      error: backup.error,
      triggeredBy: backup.triggeredBy,
      startedAt: backup.startedAt.toISOString(),
      completedAt: backup.completedAt?.toISOString() ?? null,
      verifiedAt: backup.verifiedAt?.toISOString() ?? null,
      expiresAt: backup.expiresAt?.toISOString() ?? null,
    };
  }
}
