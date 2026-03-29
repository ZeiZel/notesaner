import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { ValkeyService } from '../valkey/valkey.service';

/** Supported embedding provider identifiers. */
export type EmbeddingProvider = 'openai';

/**
 * How long (in seconds) an embedding is cached in ValKey.
 * 7 days — embeddings are deterministic for the same text+model, so a long
 * TTL is appropriate. Cache is invalidated explicitly on content change.
 */
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Maximum number of inputs in a single OpenAI embeddings API batch request.
 * The API supports up to 2048, but we cap at 100 to stay well within safe
 * token-budget limits across diverse note content.
 */
const MAX_BATCH_SIZE = 100;

/** Result of a single embedding generation. */
export interface EmbeddingResult {
  /** Input text that was embedded. */
  input: string;
  /** Embedding vector. */
  vector: number[];
  /** Whether this result came from the cache. */
  fromCache: boolean;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly provider: EmbeddingProvider;
  private readonly isEnabled: boolean;

  constructor(
    private readonly valkeyService: ValkeyService,
    configService: ConfigService,
  ) {
    this.provider =
      (configService.get<string>('embedding.provider') as EmbeddingProvider | undefined) ??
      'openai';
    this.model = configService.get<string>('embedding.model') ?? 'text-embedding-3-small';

    const apiKey = configService.get<string>('embedding.openaiApiKey');

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isEnabled = true;
    } else {
      this.openai = null;
      this.isEnabled = false;
      this.logger.warn(
        'OPENAI_API_KEY is not set — embedding generation is disabled. ' +
          'Semantic search will fall back to full-text search.',
      );
    }
  }

  /**
   * Returns true when embedding generation is configured and available.
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Returns the configured model identifier (e.g. "text-embedding-3-small").
   * Useful for storing alongside persisted embeddings to detect model changes.
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Generate an embedding for a single text input.
   *
   * Checks the ValKey cache first to avoid redundant API calls.
   *
   * @param text  Text to embed (will be truncated to 8000 chars to avoid token limits)
   * @returns     Embedding vector as number[]
   * @throws      Error if the provider API call fails and the text is not cached
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const first = results[0];
    if (!first) {
      throw new Error('Embedding batch returned no results for single input');
    }
    return first.vector;
  }

  /**
   * Generate embeddings for multiple texts in batched API calls.
   *
   * Each input is checked against the cache individually so that partial
   * cache hits avoid unnecessary API calls for already-embedded texts.
   *
   * @param texts   Array of text strings to embed
   * @returns       Array of EmbeddingResult, in the same order as the input
   * @throws        Error if the provider API call fails
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.isEnabled || !this.openai) {
      throw new Error(
        'Embedding service is not configured. Set OPENAI_API_KEY to enable semantic search.',
      );
    }

    if (texts.length === 0) {
      return [];
    }

    // Normalise inputs: truncate long texts, replace newlines (OpenAI recommendation)
    const normalised = texts.map((t) => this.normaliseText(t));

    // Build results array — slots for cache hits are filled immediately
    const results: EmbeddingResult[] = new Array<EmbeddingResult>(normalised.length);
    const uncachedIndices: number[] = [];

    // Check cache for each input
    await Promise.all(
      normalised.map(async (text, idx) => {
        const cached = await this.getCached(text);
        if (cached !== null) {
          results[idx] = { input: text, vector: cached, fromCache: true };
        } else {
          uncachedIndices.push(idx);
        }
      }),
    );

    if (uncachedIndices.length === 0) {
      return results;
    }

    // Fetch embeddings for uncached inputs in batches
    const uncachedTexts = uncachedIndices.map((i) => normalised[i] as string);
    const apiVectors = await this.fetchFromProvider(uncachedTexts);

    // Fill in results and warm the cache
    await Promise.all(
      uncachedIndices.map(async (originalIdx, batchIdx) => {
        const text = normalised[originalIdx] as string;
        const vector = apiVectors[batchIdx];
        if (!vector) {
          throw new Error(`Provider returned no vector for batch index ${batchIdx}`);
        }
        results[originalIdx] = { input: text, vector, fromCache: false };
        await this.setCached(text, vector);
      }),
    );

    return results;
  }

  /**
   * Invalidate the cached embedding for a specific text.
   * Call this when note content changes so the next search uses a fresh vector.
   *
   * @param text  The same normalised text that was used to embed the note
   */
  async invalidateCache(text: string): Promise<void> {
    const key = this.cacheKey(this.normaliseText(text));
    await this.valkeyService.del(key);
  }

  /**
   * Compute SHA-256 hash of text content. Used by SemanticSearchService to
   * detect whether a note's embedding needs to be regenerated.
   */
  hashContent(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch embedding vectors from the configured provider in batches of
   * MAX_BATCH_SIZE to respect API rate limits.
   */
  private async fetchFromProvider(texts: string[]): Promise<number[][]> {
    const allVectors: number[][] = [];

    for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
      const batch = texts.slice(start, start + MAX_BATCH_SIZE);
      const batchVectors = await this.fetchOpenAIBatch(batch);
      allVectors.push(...batchVectors);
    }

    return allVectors;
  }

  private async fetchOpenAIBatch(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client is not initialised');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: 'float',
      });

      // Sort by index to ensure order matches the input array
      const sorted = [...response.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (error) {
      this.logger.error('OpenAI embeddings API call failed', error);
      throw error;
    }
  }

  /** Truncate and normalise text for embedding. */
  private normaliseText(text: string): string {
    // OpenAI recommends replacing newlines; also trim whitespace
    return text.slice(0, 8_000).replace(/\n+/g, ' ').trim();
  }

  private cacheKey(normalisedText: string): string {
    // Hash the text itself to keep Redis keys short and collision-free
    const textHash = createHash('sha256').update(normalisedText, 'utf8').digest('hex');
    return `embed:${this.provider}:${this.model}:${textHash}`;
  }

  private async getCached(normalisedText: string): Promise<number[] | null> {
    try {
      const raw = await this.valkeyService.get(this.cacheKey(normalisedText));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed as number[];
    } catch {
      // Cache misses are non-fatal
      return null;
    }
  }

  private async setCached(normalisedText: string, vector: number[]): Promise<void> {
    try {
      await this.valkeyService.set(
        this.cacheKey(normalisedText),
        JSON.stringify(vector),
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      // Cache write failures are non-fatal — log and continue
      this.logger.warn('Failed to cache embedding vector', error);
    }
  }
}
