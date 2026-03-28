'use client';

/**
 * EditorSettings — controls for editor typography and tab behaviour.
 *
 * Settings are persisted to localStorage via useSettingsStore.
 * All interactions are synchronous (no network calls) — no useEffect needed.
 */

import {
  useSettingsStore,
  FONT_FAMILY_LABELS,
  editorFontFamilyCss,
  type EditorFontFamily,
} from './settings-store';

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function LabeledSlider({ id, label, value, min, max, step, unit = '', onChange }: SliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          {label}
        </label>
        <span
          className="text-sm tabular-nums font-mono"
          style={{ color: 'var(--ns-color-foreground-secondary)' }}
        >
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
      />
      <div
        className="flex justify-between text-xs"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

interface SelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function LabeledSelect<T extends string>({ id, label, value, options, onChange }: SelectProps<T>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium"
        style={{ color: 'var(--ns-color-foreground)' }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md px-3 py-2 text-sm"
        style={{
          backgroundColor: 'var(--ns-color-background-input)',
          border: '1px solid var(--ns-color-input)',
          color: 'var(--ns-color-foreground)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Font preview
// ---------------------------------------------------------------------------

function FontPreview({
  fontFamily,
  fontSize,
  lineHeight,
}: {
  fontFamily: EditorFontFamily;
  fontSize: number;
  lineHeight: number;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background-surface)',
      }}
    >
      <p className="text-xs mb-2" style={{ color: 'var(--ns-color-foreground-muted)' }}>
        Preview
      </p>
      <p
        style={{
          fontFamily: editorFontFamilyCss(fontFamily),
          fontSize: `${fontSize}px`,
          lineHeight,
          color: 'var(--ns-color-foreground)',
        }}
      >
        The quick brown fox jumps over the lazy dog. <strong>Bold text</strong> and{' '}
        <em>italic text</em> look like this. Here is some{' '}
        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.9em',
            backgroundColor: 'var(--ns-color-background-code)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          inline code
        </code>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorSettings
// ---------------------------------------------------------------------------

const FONT_OPTIONS: { value: EditorFontFamily; label: string }[] = (
  Object.entries(FONT_FAMILY_LABELS) as [EditorFontFamily, string][]
).map(([value, label]) => ({ value, label }));

export function EditorSettings() {
  const editor = useSettingsStore((s) => s.editor);
  const updateEditorSettings = useSettingsStore((s) => s.updateEditorSettings);
  const resetEditorSettings = useSettingsStore((s) => s.resetEditorSettings);

  return (
    <div className="space-y-6 max-w-lg">
      <FontPreview
        fontFamily={editor.fontFamily}
        fontSize={editor.fontSize}
        lineHeight={editor.lineHeight}
      />

      <LabeledSelect<EditorFontFamily>
        id="settings-fontFamily"
        label="Font family"
        value={editor.fontFamily}
        options={FONT_OPTIONS}
        onChange={(fontFamily) => updateEditorSettings({ fontFamily })}
      />

      <LabeledSlider
        id="settings-fontSize"
        label="Font size"
        value={editor.fontSize}
        min={10}
        max={24}
        step={1}
        unit="px"
        onChange={(fontSize) => updateEditorSettings({ fontSize })}
      />

      <LabeledSlider
        id="settings-lineHeight"
        label="Line height"
        value={editor.lineHeight}
        min={1.2}
        max={2.5}
        step={0.1}
        onChange={(lineHeight) =>
          updateEditorSettings({ lineHeight: Math.round(lineHeight * 10) / 10 })
        }
      />

      <div className="space-y-1.5">
        <label
          htmlFor="settings-tabSize"
          className="text-sm font-medium"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          Tab size
        </label>
        <div className="flex gap-2">
          {[2, 4, 8].map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={editor.tabSize === size}
              onClick={() => updateEditorSettings({ tabSize: size })}
              className="flex-1 rounded-md py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  editor.tabSize === size
                    ? 'var(--ns-color-primary)'
                    : 'var(--ns-color-background-surface)',
                color:
                  editor.tabSize === size
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-secondary)',
                border: `1px solid ${editor.tabSize === size ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
              }}
            >
              {size} spaces
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={resetEditorSettings}
        className="text-sm"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        Reset to defaults
      </button>
    </div>
  );
}
