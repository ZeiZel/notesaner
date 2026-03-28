'use client';

/**
 * PluginSettingsRenderer.tsx
 *
 * Renders a form from a JSON Schema + current values. Produces controlled
 * form inputs for each field type:
 *
 *   text       → <Input type="text">
 *   url        → <Input type="url">
 *   number     → <Input type="number">
 *   boolean    → native checkbox styled as a toggle switch
 *   select     → Select / SelectItem
 *   color      → <input type="color"> with a hex preview label
 *   multiselect → checkboxes for enum options OR comma-separated text input
 *   group      → <fieldset> containing nested fields
 *
 * The component is purely presentational: it receives values and calls
 * onChange(key, value) whenever an input changes. Persistence and
 * validation feedback are the responsibility of the parent (PluginSettingsPage).
 */

import React, { useId } from 'react';
import { Input } from '@notesaner/ui/components/input';
import { Label } from '@notesaner/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@notesaner/ui/components/select';
import type { FieldDescriptor } from './schema-to-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginSettingsRendererProps {
  /** Field descriptors produced by schemaToFields(). */
  fields: FieldDescriptor[];
  /** Current form values, keyed by FieldDescriptor.key (dot-path). */
  values: Record<string, unknown>;
  /** Map of field key → validation error message. */
  errors?: Map<string, string>;
  /**
   * Called whenever a field value changes.
   * key: FieldDescriptor.key (dot-path)
   * value: the new value (typed appropriately for the field type)
   */
  onChange: (key: string, value: unknown) => void;
  /** When true, all inputs are disabled (e.g. during save). */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Individual field renderers
// ---------------------------------------------------------------------------

interface FieldProps {
  field: FieldDescriptor;
  value: unknown;
  error?: string;
  onChange: (key: string, value: unknown) => void;
  disabled: boolean;
}

function TextField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const strVal = value !== null && value !== undefined ? String(value) : '';

  return (
    <FieldWrapper fieldId={id} field={field} error={error}>
      <Input
        id={id}
        type={field.type === 'url' ? 'url' : 'text'}
        value={strVal}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.description ?? ''}
      />
    </FieldWrapper>
  );
}

function NumberField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const numVal = value !== null && value !== undefined ? String(value) : '';
  const { validation } = field;

  return (
    <FieldWrapper fieldId={id} field={field} error={error}>
      <Input
        id={id}
        type="number"
        value={numVal}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        min={validation.minimum}
        max={validation.maximum}
        onChange={(e) => {
          const parsed = e.target.value === '' ? '' : Number(e.target.value);
          onChange(field.key, parsed);
        }}
      />
    </FieldWrapper>
  );
}

function BooleanField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const checked = Boolean(value);

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-sm font-medium text-foreground cursor-pointer select-none"
        >
          {field.label}
        </label>
        {field.description && (
          <p className="text-xs text-foreground-muted mt-0.5">{field.description}</p>
        )}
        {error && (
          <p id={`${id}-error`} className="text-xs text-destructive mt-0.5" role="alert">
            {error}
          </p>
        )}
      </div>
      {/* Toggle switch */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={field.label}
        disabled={disabled}
        onClick={() => onChange(field.key, !checked)}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-background-muted border-border',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
            'ring-0 transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

function SelectField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const strVal = value !== null && value !== undefined ? String(value) : '';

  return (
    <FieldWrapper fieldId={id} field={field} error={error}>
      <Select value={strVal} onValueChange={(v) => onChange(field.key, v)} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={`Select ${field.label}...`} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

function ColorField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const hexVal = value !== null && value !== undefined ? String(value) : '#000000';

  return (
    <FieldWrapper fieldId={id} field={field} error={error}>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          value={hexVal}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          type="text"
          value={hexVal}
          disabled={disabled}
          maxLength={7}
          pattern="^#[0-9A-Fa-f]{6}$"
          aria-label={`${field.label} hex value`}
          className="w-28 font-mono"
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
              onChange(field.key, v);
            }
          }}
        />
      </div>
    </FieldWrapper>
  );
}

function MultiSelectField({ field, value, error, onChange, disabled }: FieldProps) {
  const id = useId();
  const currentValues: string[] = Array.isArray(value) ? value.map(String) : [];

  // If the field has pre-defined options (from items.enum), render checkboxes.
  // Otherwise, render a comma-separated text input.
  if (field.options && field.options.length > 0) {
    return (
      <div className="space-y-1.5">
        <fieldset>
          <legend className="text-sm font-medium text-foreground">{field.label}</legend>
          {field.description && (
            <p className="text-xs text-foreground-muted mt-0.5">{field.description}</p>
          )}
          <div className="mt-2 space-y-1.5">
            {field.options.map((opt) => {
              const optId = `${id}-${opt.value}`;
              const checked = currentValues.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <input
                    id={optId}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    aria-label={opt.label}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...currentValues, opt.value]
                        : currentValues.filter((v) => v !== opt.value);
                      onChange(field.key, next);
                    }}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring disabled:opacity-50"
                  />
                  <label
                    htmlFor={optId}
                    className="text-sm text-foreground cursor-pointer select-none"
                  >
                    {opt.label}
                  </label>
                </div>
              );
            })}
          </div>
          {error && (
            <p className="text-xs text-destructive mt-1" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      </div>
    );
  }

  // Free-form comma-separated input
  return (
    <FieldWrapper fieldId={id} field={field} error={error}>
      <Input
        id={id}
        type="text"
        value={currentValues.join(', ')}
        disabled={disabled}
        placeholder="Enter values separated by commas"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          const items = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(field.key, items);
        }}
      />
    </FieldWrapper>
  );
}

function GroupField({ field, value, error: _error, onChange, disabled }: FieldProps) {
  const groupValues =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return (
    <fieldset className="rounded-lg border border-border p-4 space-y-4">
      <legend className="text-sm font-semibold text-foreground px-1">{field.label}</legend>
      {field.description && (
        <p className="text-xs text-foreground-muted -mt-2">{field.description}</p>
      )}
      {(field.fields ?? []).map((child) => (
        <FieldRenderer
          key={child.key}
          field={child}
          value={groupValues[child.key]}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper — label + description + error message
// ---------------------------------------------------------------------------

interface FieldWrapperProps {
  fieldId: string;
  field: FieldDescriptor;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ fieldId, field, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} required={field.validation.required}>
        {field.label}
      </Label>
      {field.description && <p className="text-xs text-foreground-muted">{field.description}</p>}
      {children}
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic field router
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  field: FieldDescriptor;
  value: unknown;
  error?: string;
  onChange: (key: string, value: unknown) => void;
  disabled: boolean;
}

function FieldRenderer({ field, value, error, onChange, disabled }: FieldRendererProps) {
  const props: FieldProps = { field, value, error, onChange, disabled };

  switch (field.type) {
    case 'text':
    case 'url':
      return <TextField {...props} />;
    case 'number':
      return <NumberField {...props} />;
    case 'boolean':
      return <BooleanField {...props} />;
    case 'select':
      return <SelectField {...props} />;
    case 'color':
      return <ColorField {...props} />;
    case 'multiselect':
      return <MultiSelectField {...props} />;
    case 'group':
      return <GroupField {...props} />;
    default: {
      // Exhaustive check
      const _never: never = field.type;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders an auto-generated form from a list of FieldDescriptors.
 *
 * Does NOT include Save/Reset buttons — those live in PluginSettingsPage.
 *
 * @example
 * ```tsx
 * const fields = schemaToFields(plugin.settingsSchema);
 * const [values, setValues] = useState(buildDefaultValues(fields));
 *
 * function handleChange(key: string, value: unknown) {
 *   setValues(prev => ({ ...prev, [key]: value }));
 * }
 *
 * <PluginSettingsRenderer
 *   fields={fields}
 *   values={values}
 *   errors={errorMap}
 *   onChange={handleChange}
 * />
 * ```
 */
export function PluginSettingsRenderer({
  fields,
  values,
  errors,
  onChange,
  disabled = false,
}: PluginSettingsRendererProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-foreground-muted italic py-4">
        This plugin has no configurable settings.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors?.get(field.key)}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
