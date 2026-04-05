/**
 * Type declarations for modules that lack their own TypeScript definitions.
 * These are optional runtime dependencies that may or may not be installed.
 */

declare module 'openid-client' {
  export class Issuer {
    static discover(url: string): Promise<Issuer>;
    readonly metadata: Record<string, unknown>;
    Client: new (metadata: Record<string, unknown>) => Client;
  }

  export class Client {
    authorizationUrl(params: Record<string, unknown>): string;
    callbackParams(input: unknown): Record<string, unknown>;
    callback(
      redirectUri: string | undefined,
      params: Record<string, unknown>,
      checks?: Record<string, unknown>,
    ): Promise<TokenSet>;
    userinfo(accessToken: string | TokenSet): Promise<Record<string, unknown>>;
  }

  export class TokenSet {
    access_token?: string;
    id_token?: string;
    refresh_token?: string;
    expires_at?: number;
    claims(): Record<string, unknown>;
  }

  export function generators(): {
    state(): string;
    nonce(): string;
    codeVerifier(): string;
    codeChallenge(verifier: string): string;
  };
}

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: Record<string, unknown>);
    send(command: unknown): Promise<unknown>;
    destroy(): void;
  }

  export class PutObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Body: Buffer | string | ReadableStream;
      ContentType?: string;
      Metadata?: Record<string, string>;
    });
  }

  export class GetObjectCommand {
    constructor(input: { Bucket: string; Key: string });
  }

  export class ListObjectsV2Command {
    constructor(input: {
      Bucket: string;
      Prefix?: string;
      MaxKeys?: number;
      ContinuationToken?: string;
    });
  }

  export class DeleteObjectCommand {
    constructor(input: { Bucket: string; Key: string });
  }

  export class HeadObjectCommand {
    constructor(input: { Bucket: string; Key: string });
  }
}

declare module '@prisma/adapter-pg' {
  import type { Pool } from 'pg';
  export class PrismaPg {
    constructor(pool: Pool);
  }
}

declare module 'pg' {
  export class Pool {
    constructor(config?: Record<string, unknown>);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    query(text: string, values?: unknown[]): Promise<QueryResult>;
  }

  export interface PoolClient {
    query(text: string, values?: unknown[]): Promise<QueryResult>;
    release(): void;
  }

  export interface QueryResult {
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }
}

declare module 'multer' {
  import type { RequestHandler } from 'express';

  interface StorageEngine {
    _handleFile(
      req: unknown,
      file: unknown,
      cb: (error: Error | null, info?: unknown) => void,
    ): void;
    _removeFile(req: unknown, file: unknown, cb: (error: Error | null) => void): void;
  }

  interface Options {
    dest?: string;
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    fileFilter?(
      req: unknown,
      file: unknown,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ): void;
  }

  interface Multer {
    single(fieldName: string): RequestHandler;
    array(fieldName: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
    none(): RequestHandler;
    any(): RequestHandler;
  }

  function multer(options?: Options): Multer;

  namespace multer {
    function diskStorage(options: {
      destination?:
        | string
        | ((
            req: unknown,
            file: unknown,
            cb: (error: Error | null, destination: string) => void,
          ) => void);
      filename?: (
        req: unknown,
        file: unknown,
        cb: (error: Error | null, filename: string) => void,
      ) => void;
    }): StorageEngine;

    function memoryStorage(): StorageEngine;
  }

  export = multer;
}

// Extend Express namespace for Multer file types
declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }
  }
}
