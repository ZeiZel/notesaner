'use client';

/**
 * EditorPreferences — comprehensive editor settings panel.
 *
 * Extends the existing EditorSettings component with additional controls for:
 *   - Font family, size, line height (typography)
 *   - Link click behaviour (click / ctrl+click / always edit)
 *   - Autocomplete (enable, triggers, delay)
 *   - Spell check, line numbers, word wrap toggles
 *
 * All state lives in useSettingsStore (Zustand + localStorage persistence).
 * No useEffect — all interactions are synchronous event handlers.
 */

import {
  useSettingsStore,
  FONT_FAMILY_LABELS,
  editorFontFamilyCss,
  type EditorFontFamily,
  type LinkClickBehavior,
  type AutocompleteTrigger,
} from '../model/settings-store';

// ---------------------------------------------------------------------------
// Reusable primitives (consistent with existing EditorSettings.tsx)
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

interface SelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  description?: string;
}

function LabeledSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: SelectProps<T>) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium"
        style={{ color: 'var(--ns-color-foreground)' }}
      >
        {label}
      </label>
      {description && (
        <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          {description}
        </p>
      )}
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
// Toggle switch
// ---------------------------------------------------------------------------

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="text-sm font-medium cursor-pointer"
          style={{ color: 'var(--ns-color-foreground)' }}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors"
        style={{
          backgroundColor: checked ? 'var(--ns-color-primary)' : 'var(--ns-color-background)',
          border: `1px solid ${checked ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
          style={{
            backgroundColor: checked
              ? 'var(--ns-color-primary-foreground)'
              : 'var(--ns-color-foreground-muted)',
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
      </button>
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
  showLineNumbers,
  wordWrap,
}: {
  fontFamily: EditorFontFamily;
  fontSize: number;
  lineHeight: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
}) {
  const lines = [
    '# Welcome to Notesaner',
    '',
    'The quick brown fox jumps over the lazy dog.',
    '**Bold text** and *italic text* look like this.',
    'Here is some `inline code` and a [link](https://example.com).',
  ];

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background-surface)',
      }}
    >
      <div
        className="px-3 py-1.5 border-b"
        style={{
          borderColor: 'var(--ns-color-border)',
          backgroundColor: 'var(--ns-color-background)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Preview
        </p>
      </div>
      <div
        className="p-4 overflow-x-auto"
        style={{
          fontFamily: editorFontFamilyCss(fontFamily),
          fontSize: `${fontSize}px`,
          lineHeight,
          color: 'var(--ns-color-foreground)',
          whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          wordBreak: wordWrap ? 'break-word' : 'normal',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {showLineNumbers && (
              <span
                className="select-none pr-4 text-right shrink-0"
                style={{
                  color: 'var(--ns-color-foreground-muted)',
                  minWidth: '2.5em',
                  fontSize: '0.85em',
                  opacity: 0.6,
                }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
            )}
            <span>{line || '\u00A0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger chip
// ---------------------------------------------------------------------------

const ALL_TRIGGERS: { value: AutocompleteTrigger; label: string; description: string }[] = [
  { value: '/', label: '/', description: 'Slash commands' },
  { value: '@', label: '@', description: 'Mentions' },
  { value: '#', label: '#', description: 'Tags' },
  { value: '[[', label: '[[', description: 'Note links' },
];

interface TriggerChipProps {
  trigger: { value: AutocompleteTrigger; label: string; description: string };
  isActive: boolean;
  onToggle: () => void;
}

function TriggerChip({ trigger, isActive, onToggle }: TriggerChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
      style={{
        backgroundColor: isActive
          ? 'var(--ns-color-primary)'
          : 'var(--ns-color-background-surface)',
        color: isActive
          ? 'var(--ns-color-primary-foreground)'
          : 'var(--ns-color-foreground-secondary)',
        border: `1px solid ${isActive ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
      }}
    >
      <code className="font-mono font-bold text-xs">{trigger.label}</code>
      <span className="text-xs opacity-80">{trigger.description}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section divider
// ---------------------------------------------------------------------------

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="pt-2">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        {title}
      </h3>
      <div className="h-px" style={{ backgroundColor: 'var(--ns-color-border)' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Link behaviour options
// ---------------------------------------------------------------------------

const LINK_BEHAVIOR_OPTIONS: { value: LinkClickBehavior; label: string }[] = [
  { value: 'click', label: 'Click to follow' },
  { value: 'ctrl-click', label: 'Ctrl/Cmd + Click to follow' },
  { value: 'always-edit', label: 'Always edit (never follow)' },
];

// ---------------------------------------------------------------------------
// Font family options
// ---------------------------------------------------------------------------

const FONT_OPTIONS: { value: EditorFontFamily; label: string }[] = (
  Object.entries(FONT_FAMILY_LABELS) as [EditorFontFamily, string][]
).map(([value, label]) => ({ value, label }));

// ---------------------------------------------------------------------------
// EditorPreferences
// ---------------------------------------------------------------------------

export function EditorPreferences() {
  const editor = useSettingsStore((s) => s.editor);
  const updateEditorSettings = useSettingsStore((s) => s.updateEditorSettings);
  const updateAutocompleteSettings = useSettingsStore((s) => s.updateAutocompleteSettings);
  const resetEditorSettings = useSettingsStore((s) => s.resetEditorSettings);

  function handleToggleTrigger(trigger: AutocompleteTrigger) {
    const current = editor.autocomplete.triggers;
    const next = current.includes(trigger)
      ? current.filter((t) => t !== trigger)
      : [...current, trigger];
    updateAutocompleteSettings({ triggers: next });
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* ---- Typography ---- */}
      <SectionDivider title="Typography" />

      <FontPreview
        fontFamily={editor.fontFamily}
        fontSize={editor.fontSize}
        lineHeight={editor.lineHeight}
        showLineNumbers={editor.showLineNumbers}
        wordWrap={editor.wordWrap}
      />

      <LabeledSelect<EditorFontFamily>
        id="pref-fontFamily"
        label="Font family"
        value={editor.fontFamily}
        options={FONT_OPTIONS}
        onChange={(fontFamily) => updateEditorSettings({ fontFamily })}
      />

      <LabeledSlider
        id="pref-fontSize"
        label="Font size"
        value={editor.fontSize}
        min={10}
        max={24}
        step={1}
        unit="px"
        onChange={(fontSize) => updateEditorSettings({ fontSize })}
      />

      <LabeledSlider
        id="pref-lineHeight"
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
          htmlFor="pref-tabSize"
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

      {/* ---- Editor behaviour ---- */}
      <SectionDivider title="Behaviour" />

      <LabeledSelect<LinkClickBehavior>
        id="pref-linkBehavior"
        label="Link click behaviour"
        value={editor.linkClickBehavior}
        options={LINK_BEHAVIOR_OPTIONS}
        onChange={(linkClickBehavior) => updateEditorSettings({ linkClickBehavior })}
        description="How links in the editor respond to clicks."
      />

      <ToggleSwitch
        id="pref-spellCheck"
        label="Spell check"
        description="Enable browser spell checking in the editor."
        checked={editor.spellCheck}
        onChange={(spellCheck) => updateEditorSettings({ spellCheck })}
      />

      <ToggleSwitch
        id="pref-lineNumbers"
        label="Line numbers"
        description="Show line numbers in the editor gutter."
        checked={editor.showLineNumbers}
        onChange={(showLineNumbers) => updateEditorSettings({ showLineNumbers })}
      />

      <ToggleSwitch
        id="pref-wordWrap"
        label="Word wrap"
        description="Wrap long lines instead of horizontal scrolling."
        checked={editor.wordWrap}
        onChange={(wordWrap) => updateEditorSettings({ wordWrap })}
      />

      {/* ---- Autocomplete ---- */}
      <SectionDivider title="Autocomplete" />

      <ToggleSwitch
        id="pref-autocomplete"
        label="Enable autocomplete"
        description="Show suggestions as you type."
        checked={editor.autocomplete.enabled}
        onChange={(enabled) => updateAutocompleteSettings({ enabled })}
      />

      {editor.autocomplete.enabled && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
              Trigger characters
            </label>
            <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
              Select which characters open the autocomplete menu.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_TRIGGERS.map((trigger) => (
                <TriggerChip
                  key={trigger.value}
                  trigger={trigger}
                  isActive={editor.autocomplete.triggers.includes(trigger.value)}
                  onToggle={() => handleToggleTrigger(trigger.value)}
                />
              ))}
            </div>
          </div>

          <LabeledSlider
            id="pref-autocompleteDelay"
            label="Popup delay"
            value={editor.autocomplete.delayMs}
            min={0}
            max={1000}
            step={50}
            unit="ms"
            onChange={(delayMs) => updateAutocompleteSettings({ delayMs })}
          />
        </>
      )}

      {/* ---- Reset ---- */}
      <div className="pt-4 border-t" style={{ borderColor: 'var(--ns-color-border)' }}>
        <button
          type="button"
          onClick={resetEditorSettings}
          className="text-sm transition-colors"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Reset all editor settings to defaults
        </button>
      </div>
    </div>
  );
}
