/**
 * Tests for schema-to-form.ts
 *
 * Covers:
 *   - schemaToFields: type mapping, label derivation, nested objects
 *   - buildDefaultValues: defaults from schema or fallback
 *   - validateSettings: required, numeric range, string length, pattern, array
 *   - errorsByKey: deduplication into map
 */

import { describe, it, expect } from 'vitest';
import {
  schemaToFields,
  buildDefaultValues,
  validateSettings,
  errorsByKey,
  type FieldDescriptor,
} from '../lib/schema-to-form';

// ---------------------------------------------------------------------------
// schemaToFields
// ---------------------------------------------------------------------------

describe('schemaToFields', () => {
  it('returns empty array when schema has no properties', () => {
    expect(schemaToFields({})).toEqual([]);
    expect(schemaToFields({ type: 'object' })).toEqual([]);
  });

  it('maps string type to text field', () => {
    const fields = schemaToFields({
      properties: { apiKey: { type: 'string' } },
    });
    expect(fields).toHaveLength(1);
    expect(fields[0]!.type).toBe('text');
    expect(fields[0]!.key).toBe('apiKey');
  });

  it('derives label from property name when no title', () => {
    const fields = schemaToFields({
      properties: { apiKey: { type: 'string' } },
    });
    // camelCase → Title Case
    expect(fields[0]!.label).toBe('Api Key');
  });

  it('uses title when provided', () => {
    const fields = schemaToFields({
      properties: { apiKey: { type: 'string', title: 'API Key' } },
    });
    expect(fields[0]!.label).toBe('API Key');
  });

  it('maps string+format:color to color field', () => {
    const fields = schemaToFields({
      properties: { bg: { type: 'string', format: 'color', default: '#ff0000' } },
    });
    expect(fields[0]!.type).toBe('color');
    expect(fields[0]!.defaultValue).toBe('#ff0000');
  });

  it('maps string+format:uri to url field', () => {
    const fields = schemaToFields({
      properties: { webhook: { type: 'string', format: 'uri' } },
    });
    expect(fields[0]!.type).toBe('url');
  });

  it('maps string+enum to select field with options', () => {
    const fields = schemaToFields({
      properties: {
        theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
      },
    });
    expect(fields[0]!.type).toBe('select');
    expect(fields[0]!.options).toHaveLength(3);
    expect(fields[0]!.options![0]).toEqual({ label: 'light', value: 'light' });
  });

  it('maps number type to number field', () => {
    const fields = schemaToFields({
      properties: { timeout: { type: 'number', default: 30 } },
    });
    expect(fields[0]!.type).toBe('number');
    expect(fields[0]!.defaultValue).toBe(30);
  });

  it('maps integer type to number field', () => {
    const fields = schemaToFields({
      properties: { retries: { type: 'integer', minimum: 1, maximum: 10 } },
    });
    expect(fields[0]!.type).toBe('number');
    expect(fields[0]!.validation.minimum).toBe(1);
    expect(fields[0]!.validation.maximum).toBe(10);
  });

  it('maps boolean type to boolean field', () => {
    const fields = schemaToFields({
      properties: { enabled: { type: 'boolean', default: true } },
    });
    expect(fields[0]!.type).toBe('boolean');
    expect(fields[0]!.defaultValue).toBe(true);
  });

  it('maps array type to multiselect field', () => {
    const fields = schemaToFields({
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string', enum: ['a', 'b', 'c'] },
        },
      },
    });
    expect(fields[0]!.type).toBe('multiselect');
    expect(fields[0]!.options).toHaveLength(3);
  });

  it('maps array without enum items to multiselect with no options', () => {
    const fields = schemaToFields({
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
    expect(fields[0]!.type).toBe('multiselect');
    expect(fields[0]!.options).toBeUndefined();
  });

  it('maps object type to group field with nested fields', () => {
    const fields = schemaToFields({
      properties: {
        server: {
          type: 'object',
          properties: {
            host: { type: 'string', default: 'localhost' },
            port: { type: 'number', default: 3000 },
          },
        },
      },
    });
    expect(fields[0]!.type).toBe('group');
    expect(fields[0]!.fields).toHaveLength(2);
    expect(fields[0]!.fields![0]!.type).toBe('text');
    expect(fields[0]!.fields![1]!.type).toBe('number');
  });

  it('uses dot-path keys for nested fields', () => {
    const fields = schemaToFields({
      properties: {
        server: {
          type: 'object',
          properties: { host: { type: 'string' } },
        },
      },
    });
    expect(fields[0]!.fields![0]!.key).toBe('server.host');
  });

  it('marks required fields in validation', () => {
    const fields = schemaToFields({
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['email'],
    });
    const email = fields.find((f) => f.key === 'email')!;
    const name = fields.find((f) => f.key === 'name')!;
    expect(email.validation.required).toBe(true);
    expect(name.validation.required).toBeUndefined();
  });

  it('extracts string constraints (minLength, maxLength, pattern)', () => {
    const fields = schemaToFields({
      properties: {
        username: {
          type: 'string',
          minLength: 3,
          maxLength: 20,
          pattern: '^[a-z]+$',
        },
      },
    });
    const { validation } = fields[0]!;
    expect(validation.minLength).toBe(3);
    expect(validation.maxLength).toBe(20);
    expect(validation.pattern).toBe('^[a-z]+$');
  });

  it('extracts array constraints (minItems, maxItems)', () => {
    const fields = schemaToFields({
      properties: {
        tags: { type: 'array', minItems: 1, maxItems: 5 },
      },
    });
    expect(fields[0]!.validation.minItems).toBe(1);
    expect(fields[0]!.validation.maxItems).toBe(5);
  });

  it('handles nullable type array (picks non-null type)', () => {
    const fields = schemaToFields({
      properties: {
        note: { type: ['string', 'null'] },
      },
    });
    expect(fields[0]!.type).toBe('text');
  });

  it('includes description when provided', () => {
    const fields = schemaToFields({
      properties: {
        key: { type: 'string', description: 'Your API key' },
      },
    });
    expect(fields[0]!.description).toBe('Your API key');
  });
});

// ---------------------------------------------------------------------------
// buildDefaultValues
// ---------------------------------------------------------------------------

describe('buildDefaultValues', () => {
  it('returns empty object for empty fields', () => {
    expect(buildDefaultValues([])).toEqual({});
  });

  it('uses schema defaults for simple fields', () => {
    const fields = schemaToFields({
      properties: {
        name: { type: 'string', default: 'Alice' },
        age: { type: 'number', default: 30 },
        active: { type: 'boolean', default: true },
      },
    });
    const defaults = buildDefaultValues(fields);
    expect(defaults['name']).toBe('Alice');
    expect(defaults['age']).toBe(30);
    expect(defaults['active']).toBe(true);
  });

  it('falls back to empty string for string fields without defaults', () => {
    const fields = schemaToFields({
      properties: { key: { type: 'string' } },
    });
    expect(buildDefaultValues(fields)['key']).toBe('');
  });

  it('falls back to 0 for number fields without defaults', () => {
    const fields = schemaToFields({
      properties: { count: { type: 'number' } },
    });
    expect(buildDefaultValues(fields)['count']).toBe(0);
  });

  it('falls back to false for boolean fields without defaults', () => {
    const fields = schemaToFields({
      properties: { enabled: { type: 'boolean' } },
    });
    expect(buildDefaultValues(fields)['enabled']).toBe(false);
  });

  it('falls back to empty array for array fields without defaults', () => {
    const fields = schemaToFields({
      properties: { tags: { type: 'array' } },
    });
    expect(buildDefaultValues(fields)['tags']).toEqual([]);
  });

  it('flattens nested group defaults using dot-path keys', () => {
    const fields = schemaToFields({
      properties: {
        server: {
          type: 'object',
          properties: {
            host: { type: 'string', default: 'localhost' },
            port: { type: 'number', default: 8080 },
          },
        },
      },
    });
    const defaults = buildDefaultValues(fields);
    expect(defaults['server.host']).toBe('localhost');
    expect(defaults['server.port']).toBe(8080);
  });
});

// ---------------------------------------------------------------------------
// validateSettings
// ---------------------------------------------------------------------------

describe('validateSettings', () => {
  function buildFields(schemaPartial: Parameters<typeof schemaToFields>[0]): FieldDescriptor[] {
    return schemaToFields(schemaPartial);
  }

  describe('required validation', () => {
    it('returns error for empty required string', () => {
      const fields = buildFields({
        properties: { name: { type: 'string' } },
        required: ['name'],
      });
      const errors = validateSettings(fields, { name: '' });
      expect(errors).toHaveLength(1);
      expect(errors[0]!.key).toBe('name');
      expect(errors[0]!.message).toMatch(/required/i);
    });

    it('returns no error for populated required string', () => {
      const fields = buildFields({
        properties: { name: { type: 'string' } },
        required: ['name'],
      });
      const errors = validateSettings(fields, { name: 'Alice' });
      expect(errors).toHaveLength(0);
    });

    it('returns error for required array that is empty', () => {
      const fields = buildFields({
        properties: { tags: { type: 'array' } },
        required: ['tags'],
      });
      const errors = validateSettings(fields, { tags: [] });
      expect(errors).toHaveLength(1);
    });

    it('passes when optional field is absent', () => {
      const fields = buildFields({
        properties: { bio: { type: 'string' } },
      });
      const errors = validateSettings(fields, {});
      expect(errors).toHaveLength(0);
    });
  });

  describe('number validation', () => {
    const fields = buildFields({
      properties: {
        timeout: { type: 'number', minimum: 1, maximum: 60 },
      },
    });

    it('passes within range', () => {
      expect(validateSettings(fields, { timeout: 30 })).toHaveLength(0);
    });

    it('fails below minimum', () => {
      const errors = validateSettings(fields, { timeout: 0 });
      expect(errors[0]!.message).toMatch(/at least 1/);
    });

    it('fails above maximum', () => {
      const errors = validateSettings(fields, { timeout: 100 });
      expect(errors[0]!.message).toMatch(/at most 60/);
    });

    it('fails for non-numeric value', () => {
      const errors = validateSettings(fields, { timeout: 'abc' });
      expect(errors[0]!.message).toMatch(/must be a number/i);
    });
  });

  describe('string length validation', () => {
    const fields = buildFields({
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 10 },
      },
    });

    it('passes within bounds', () => {
      expect(validateSettings(fields, { username: 'alice' })).toHaveLength(0);
    });

    it('fails below minLength', () => {
      const errors = validateSettings(fields, { username: 'ab' });
      expect(errors[0]!.message).toMatch(/at least 3/);
    });

    it('fails above maxLength', () => {
      const errors = validateSettings(fields, { username: 'averylongname' });
      expect(errors[0]!.message).toMatch(/at most 10/);
    });
  });

  describe('pattern validation', () => {
    const fields = buildFields({
      properties: {
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
      },
    });

    it('passes matching pattern', () => {
      expect(validateSettings(fields, { slug: 'my-plugin' })).toHaveLength(0);
    });

    it('fails non-matching pattern', () => {
      const errors = validateSettings(fields, { slug: 'My Plugin!' });
      expect(errors[0]!.message).toMatch(/format/i);
    });
  });

  describe('array validation', () => {
    const fields = buildFields({
      properties: {
        tags: { type: 'array', minItems: 1, maxItems: 3 },
      },
    });

    it('passes with valid item count', () => {
      expect(validateSettings(fields, { tags: ['a', 'b'] })).toHaveLength(0);
    });

    it('fails below minItems', () => {
      const errors = validateSettings(fields, { tags: [] });
      expect(errors[0]!.message).toMatch(/at least 1 item/i);
    });

    it('fails above maxItems', () => {
      const errors = validateSettings(fields, { tags: ['a', 'b', 'c', 'd'] });
      expect(errors[0]!.message).toMatch(/at most 3 item/i);
    });
  });

  describe('nested group validation', () => {
    it('validates fields inside a group', () => {
      const fields = buildFields({
        properties: {
          server: {
            type: 'object',
            properties: {
              host: { type: 'string' },
              port: { type: 'number', minimum: 1024, maximum: 65535 },
            },
            required: ['host'],
          },
        },
      });

      const errors = validateSettings(fields, {
        'server.host': '',
        'server.port': 80,
      });

      const hostErr = errors.find((e) => e.key === 'server.host');
      const portErr = errors.find((e) => e.key === 'server.port');

      expect(hostErr).toBeDefined();
      expect(portErr).toBeDefined();
      expect(portErr!.message).toMatch(/at least 1024/);
    });
  });

  describe('multiple errors', () => {
    it('returns multiple errors when multiple fields are invalid', () => {
      const fields = buildFields({
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      });

      const errors = validateSettings(fields, { name: '', email: '' });
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// errorsByKey
// ---------------------------------------------------------------------------

describe('errorsByKey', () => {
  it('returns empty map for no errors', () => {
    expect(errorsByKey([])).toEqual(new Map());
  });

  it('maps each error to its key', () => {
    const map = errorsByKey([
      { key: 'name', message: 'Name is required.' },
      { key: 'email', message: 'Email is required.' },
    ]);
    expect(map.get('name')).toBe('Name is required.');
    expect(map.get('email')).toBe('Email is required.');
  });

  it('keeps only the first error per key', () => {
    const map = errorsByKey([
      { key: 'name', message: 'First error' },
      { key: 'name', message: 'Second error' },
    ]);
    expect(map.get('name')).toBe('First error');
    expect(map.size).toBe(1);
  });
});
