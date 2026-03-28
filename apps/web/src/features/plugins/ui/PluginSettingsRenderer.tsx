'use client';

/**
 * PluginSettingsRenderer.tsx
 *
 * Renders a form from a JSON Schema + current values using Ant Design components.
 * Migrated from shadcn/ui Input, Label, Select to antd equivalents.
 */

import React from 'react';
import { Input, InputNumber, Select, Switch, Checkbox, ColorPicker, Flex, Typography } from 'antd';
import type { FieldDescriptor } from '../lib/schema-to-form';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginSettingsRendererProps {
  fields: FieldDescriptor[];
  values: Record<string, unknown>;
  errors?: Map<string, string>;
  onChange: (key: string, value: unknown) => void;
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
  const strVal = value !== null && value !== undefined ? String(value) : '';

  return (
    <FieldWrapper field={field} error={error}>
      <Input
        type={field.type === 'url' ? 'url' : 'text'}
        value={strVal}
        disabled={disabled}
        status={error ? 'error' : undefined}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.description ?? ''}
      />
    </FieldWrapper>
  );
}

function NumberField({ field, value, error, onChange, disabled }: FieldProps) {
  const numVal = value !== null && value !== undefined ? Number(value) : undefined;
  const { validation } = field;

  return (
    <FieldWrapper field={field} error={error}>
      <InputNumber
        value={numVal}
        disabled={disabled}
        status={error ? 'error' : undefined}
        min={validation.minimum}
        max={validation.maximum}
        style={{ width: '100%' }}
        onChange={(val) => onChange(field.key, val)}
      />
    </FieldWrapper>
  );
}

function BooleanField({ field, value, error, onChange, disabled }: FieldProps) {
  const checked = Boolean(value);

  return (
    <Flex justify="space-between" align="center" gap={16} style={{ paddingBlock: 8 }}>
      <Flex vertical flex={1}>
        <Text strong style={{ fontSize: 14 }}>
          {field.label}
        </Text>
        {field.description && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 2 }}>
            {field.description}
          </Text>
        )}
        {error && (
          <Text type="danger" style={{ fontSize: 12, marginTop: 2 }}>
            {error}
          </Text>
        )}
      </Flex>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(val) => onChange(field.key, val)}
        aria-label={field.label}
      />
    </Flex>
  );
}

function SelectField({ field, value, error, onChange, disabled }: FieldProps) {
  const strVal = value !== null && value !== undefined ? String(value) : undefined;

  return (
    <FieldWrapper field={field} error={error}>
      <Select
        value={strVal}
        onChange={(v) => onChange(field.key, v)}
        disabled={disabled}
        status={error ? 'error' : undefined}
        placeholder={`Select ${field.label}...`}
        style={{ width: '100%' }}
        options={(field.options ?? []).map((opt) => ({
          label: opt.label,
          value: opt.value,
        }))}
      />
    </FieldWrapper>
  );
}

function ColorField({ field, value, error, onChange, disabled }: FieldProps) {
  const hexVal = value !== null && value !== undefined ? String(value) : '#000000';

  return (
    <FieldWrapper field={field} error={error}>
      <Flex gap={12} align="center">
        <ColorPicker
          value={hexVal}
          disabled={disabled}
          onChange={(_color, hex) => onChange(field.key, hex)}
          showText
        />
      </Flex>
    </FieldWrapper>
  );
}

function MultiSelectField({ field, value, error, onChange, disabled }: FieldProps) {
  const currentValues: string[] = Array.isArray(value) ? value.map(String) : [];

  if (field.options && field.options.length > 0) {
    return (
      <Flex vertical gap={6}>
        <Text strong style={{ fontSize: 14 }}>
          {field.label}
        </Text>
        {field.description && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {field.description}
          </Text>
        )}
        <Checkbox.Group
          value={currentValues}
          disabled={disabled}
          onChange={(vals) => onChange(field.key, vals)}
          options={field.options.map((opt) => ({
            label: opt.label,
            value: opt.value,
          }))}
        />
        {error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            {error}
          </Text>
        )}
      </Flex>
    );
  }

  return (
    <FieldWrapper field={field} error={error}>
      <Select
        mode="tags"
        value={currentValues}
        disabled={disabled}
        status={error ? 'error' : undefined}
        placeholder="Enter values"
        style={{ width: '100%' }}
        onChange={(vals) => onChange(field.key, vals)}
      />
    </FieldWrapper>
  );
}

function GroupField({ field, value, onChange, disabled }: FieldProps) {
  const groupValues =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return (
    <fieldset
      style={{
        borderRadius: 8,
        border: '1px solid var(--ant-color-border)',
        padding: 16,
      }}
    >
      <legend style={{ fontSize: 14, fontWeight: 600, padding: '0 4px' }}>{field.label}</legend>
      {field.description && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          {field.description}
        </Text>
      )}
      <Flex vertical gap={16}>
        {(field.fields ?? []).map((child) => (
          <FieldRenderer
            key={child.key}
            field={child}
            value={groupValues[child.key]}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </Flex>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

interface FieldWrapperProps {
  field: FieldDescriptor;
  error?: string;
  children: React.ReactNode;
}

function FieldWrapper({ field, error, children }: FieldWrapperProps) {
  return (
    <Flex vertical gap={4}>
      <Text strong style={{ fontSize: 14 }}>
        {field.label}
        {field.validation.required && <Text type="danger"> *</Text>}
      </Text>
      {field.description && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {field.description}
        </Text>
      )}
      {children}
      {error && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {error}
        </Text>
      )}
    </Flex>
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
    default:
      // Exhaustive check: ensure all field types are handled
      field.type satisfies never;
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PluginSettingsRenderer({
  fields,
  values,
  errors,
  onChange,
  disabled = false,
}: PluginSettingsRendererProps) {
  if (fields.length === 0) {
    return (
      <Text type="secondary" italic style={{ padding: '16px 0' }}>
        This plugin has no configurable settings.
      </Text>
    );
  }

  return (
    <Flex vertical gap={24}>
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
    </Flex>
  );
}
