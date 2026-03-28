/**
 * schema-to-form.ts
 *
 * Converts a JSON Schema object into an ordered array of FieldDescriptor
 * objects that PluginSettingsRenderer uses to build form controls.
 *
 * Supported field types (mapped from JSON Schema):
 *   string               → text input
 *   string + format:uri  → text input (url)
 *   string + format:color → color picker
 *   string + enum        → single-select
 *   number / integer     → number input
 *   boolean              → toggle switch
 *   array + items:string → multi-select (requires items.enum or string input list)
 *   object               → fieldset group (recursive)
 *
 * Validation rules are extracted from the schema and stored on each descriptor
 * for use by the validation layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'url'
  | 'color'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'group';

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  /** Whether the field is required. */
  required?: boolean;
  /** Minimum numeric value (number/integer fields). */
  minimum?: number;
  /** Maximum numeric value (number/integer fields). */
  maximum?: number;
  /** Minimum string length. */
  minLength?: number;
  /** Maximum string length. */
  maxLength?: number;
  /** Regex pattern the string value must match. */
  pattern?: string;
  /** Minimum number of items (array fields). */
  minItems?: number;
  /** Maximum number of items (array fields). */
  maxItems?: number;
}

export interface FieldDescriptor {
  /** Dot-path key into the settings object (e.g. "api.key" for nested). */
  key: string;
  /** Human-readable label derived from the property name or "title". */
  label: string;
  /** Optional description / help text from the schema "description". */
  description?: string;
  /** Resolved control type. */
  type: FieldType;
  /** Default value extracted from the schema. */
  defaultValue?: unknown;
  /** Options list for select / multiselect fields. */
  options?: SelectOption[];
  /** Nested field descriptors for group fields. */
  fields?: FieldDescriptor[];
  /** Validation constraints. */
  validation: FieldValidation;
}

// ---------------------------------------------------------------------------
// JSON Schema shape (minimal — we only inspect the fields we care about)
// ---------------------------------------------------------------------------

interface JsonSchemaProperty {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  // number constraints
  minimum?: number;
  maximum?: number;
  // string constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // array
  items?: JsonSchemaProperty;
  minItems?: number;
  maxItems?: number;
  // object
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchema extends JsonSchemaProperty {
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLabel(key: string, title?: string): string {
  if (title) return title;
  // Convert camelCase / snake_case to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function normalizeType(type: string | string[] | undefined): string {
  if (!type) return 'string';
  return Array.isArray(type) ? (type.find((t) => t !== 'null') ?? 'string') : type;
}

function propertyToField(
  key: string,
  prop: JsonSchemaProperty,
  requiredKeys: Set<string>,
  parentKey?: string,
): FieldDescriptor {
  const fullKey = parentKey ? `${parentKey}.${key}` : key;
  const label = toLabel(key, prop.title);
  const type = normalizeType(prop.type);
  const isRequired = requiredKeys.has(key);

  const validation: FieldValidation = {
    ...(isRequired && { required: true }),
    ...(prop.minimum !== undefined && { minimum: prop.minimum }),
    ...(prop.maximum !== undefined && { maximum: prop.maximum }),
    ...(prop.minLength !== undefined && { minLength: prop.minLength }),
    ...(prop.maxLength !== undefined && { maxLength: prop.maxLength }),
    ...(prop.pattern !== undefined && { pattern: prop.pattern }),
    ...(prop.minItems !== undefined && { minItems: prop.minItems }),
    ...(prop.maxItems !== undefined && { maxItems: prop.maxItems }),
  };

  // ---- object → group ----
  if (type === 'object' && prop.properties) {
    const nestedRequired = new Set<string>(prop.required ?? []);
    const fields = Object.entries(prop.properties).map(([k, p]) =>
      propertyToField(k, p, nestedRequired, fullKey),
    );
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'group',
      defaultValue: prop.default,
      fields,
      validation,
    };
  }

  // ---- array ----
  if (type === 'array') {
    const itemEnum = prop.items?.enum;
    const options: SelectOption[] | undefined = itemEnum
      ? itemEnum.map((v) => ({ label: String(v), value: String(v) }))
      : undefined;
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'multiselect',
      defaultValue: prop.default ?? [],
      options,
      validation,
    };
  }

  // ---- boolean ----
  if (type === 'boolean') {
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'boolean',
      defaultValue: prop.default ?? false,
      validation,
    };
  }

  // ---- number / integer ----
  if (type === 'number' || type === 'integer') {
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'number',
      defaultValue: prop.default ?? 0,
      validation,
    };
  }

  // ---- string variants ----

  // enum → select
  if (Array.isArray(prop.enum)) {
    const options: SelectOption[] = prop.enum.map((v) => ({
      label: String(v),
      value: String(v),
    }));
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'select',
      defaultValue: prop.default ?? '',
      options,
      validation,
    };
  }

  // color format
  if (prop.format === 'color') {
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'color',
      defaultValue: prop.default ?? '#000000',
      validation,
    };
  }

  // uri format
  if (prop.format === 'uri') {
    return {
      key: fullKey,
      label,
      description: prop.description,
      type: 'url',
      defaultValue: prop.default ?? '',
      validation,
    };
  }

  // plain string
  return {
    key: fullKey,
    label,
    description: prop.description,
    type: 'text',
    defaultValue: prop.default ?? '',
    validation,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a top-level JSON Schema object into an ordered array of
 * FieldDescriptor objects for form rendering.
 *
 * Only processes top-level `properties`. Nested objects are represented
 * as group descriptors with their own `fields` array.
 *
 * @param schema  A JSON Schema object (parsed, not a string).
 * @returns       Ordered list of field descriptors.
 */
export function schemaToFields(schema: JsonSchema): FieldDescriptor[] {
  if (!schema.properties) return [];
  const requiredKeys = new Set<string>(schema.required ?? []);
  return Object.entries(schema.properties).map(([key, prop]) =>
    propertyToField(key, prop, requiredKeys),
  );
}

/**
 * Build the default values object from the schema, suitable for use as
 * the initial form state when no saved settings are present.
 *
 * @param fields  The field descriptors returned by schemaToFields.
 * @returns       A plain object keyed by field key with default values.
 */
export function buildDefaultValues(fields: FieldDescriptor[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'group' && field.fields) {
      // Flatten nested defaults into the result using dot-path keys
      const nested = buildDefaultValues(field.fields);
      Object.assign(result, nested);
    } else {
      result[field.key] = field.defaultValue ?? null;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  key: string;
  message: string;
}

/**
 * Validate a flat values object against the field descriptors extracted
 * from the JSON Schema. Returns an array of errors (empty means valid).
 *
 * The values object uses dot-path keys matching FieldDescriptor.key.
 *
 * @param fields  Field descriptors from schemaToFields.
 * @param values  The current form values keyed by field.key.
 * @returns       Array of validation errors, empty when values are valid.
 */
export function validateSettings(
  fields: FieldDescriptor[],
  values: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  function validateField(field: FieldDescriptor): void {
    if (field.type === 'group' && field.fields) {
      for (const child of field.fields) {
        validateField(child);
      }
      return;
    }

    const raw = values[field.key];
    const { validation } = field;

    // Required check
    if (validation.required) {
      const isEmpty =
        raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
      if (isEmpty) {
        errors.push({ key: field.key, message: `${field.label} is required.` });
        return; // skip further validation for empty required fields
      }
    }

    // Skip remaining checks if value is empty / not provided
    if (raw === undefined || raw === null || raw === '') return;

    // Number checks
    if (field.type === 'number') {
      const num = Number(raw);
      if (isNaN(num)) {
        errors.push({ key: field.key, message: `${field.label} must be a number.` });
        return;
      }
      if (validation.minimum !== undefined && num < validation.minimum) {
        errors.push({
          key: field.key,
          message: `${field.label} must be at least ${validation.minimum}.`,
        });
      }
      if (validation.maximum !== undefined && num > validation.maximum) {
        errors.push({
          key: field.key,
          message: `${field.label} must be at most ${validation.maximum}.`,
        });
      }
    }

    // String checks
    if (field.type === 'text' || field.type === 'url' || field.type === 'color') {
      const str = String(raw);
      if (validation.minLength !== undefined && str.length < validation.minLength) {
        errors.push({
          key: field.key,
          message: `${field.label} must be at least ${validation.minLength} characters.`,
        });
      }
      if (validation.maxLength !== undefined && str.length > validation.maxLength) {
        errors.push({
          key: field.key,
          message: `${field.label} must be at most ${validation.maxLength} characters.`,
        });
      }
      if (validation.pattern) {
        try {
          if (!new RegExp(validation.pattern).test(str)) {
            errors.push({
              key: field.key,
              message: `${field.label} does not match the required format.`,
            });
          }
        } catch {
          // Invalid regex in schema — ignore
        }
      }
    }

    // Array checks
    if (field.type === 'multiselect' && Array.isArray(raw)) {
      if (validation.minItems !== undefined && raw.length < validation.minItems) {
        errors.push({
          key: field.key,
          message: `${field.label} must have at least ${validation.minItems} item(s).`,
        });
      }
      if (validation.maxItems !== undefined && raw.length > validation.maxItems) {
        errors.push({
          key: field.key,
          message: `${field.label} must have at most ${validation.maxItems} item(s).`,
        });
      }
    }
  }

  for (const field of fields) {
    validateField(field);
  }

  return errors;
}

/**
 * Convert a flat validation errors array into a map keyed by field key
 * for O(1) lookup in the renderer.
 */
export function errorsByKey(errors: ValidationError[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of errors) {
    // Keep the first error per key
    if (!map.has(e.key)) map.set(e.key, e.message);
  }
  return map;
}
