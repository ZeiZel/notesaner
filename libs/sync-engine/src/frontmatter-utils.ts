import type { TimestampedField, TimestampedFrontmatter } from './types';

/**
 * Create a timestamped field value for use in frontmatter.
 */
export function createTimestampedField(
  value: unknown,
  updatedBy: string,
  updatedAt?: string,
): TimestampedField {
  return {
    value,
    updatedAt: updatedAt ?? new Date().toISOString(),
    updatedBy,
  };
}

/**
 * Convert a flat frontmatter object to timestamped format.
 * All fields are given the same timestamp and user.
 */
export function toTimestampedFrontmatter(
  flat: Record<string, unknown>,
  updatedBy: string,
  updatedAt?: string,
): TimestampedFrontmatter {
  const ts = updatedAt ?? new Date().toISOString();
  const result: TimestampedFrontmatter = {};

  for (const [key, value] of Object.entries(flat)) {
    result[key] = { value, updatedAt: ts, updatedBy };
  }

  return result;
}

/**
 * Extract flat key-value pairs from timestamped frontmatter.
 * Strips the timestamp metadata, returning only field names and values.
 */
export function fromTimestampedFrontmatter(
  timestamped: TimestampedFrontmatter,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(timestamped)) {
    result[key] = field.value;
  }

  return result;
}
