/**
 * AISettingsPanel — Provider configuration form for the AI Writing Assistant.
 *
 * Allows the user to configure the LLM provider, API key, model, temperature,
 * max tokens, and a custom endpoint URL. Persists settings to plugin storage
 * and updates the Zustand store.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAIStore } from './ai-store';
import { providerConfigSchema } from './ai-provider';
import type { ProviderConfig } from './ai-provider';
import type { PluginStorage } from '@notesaner/plugin-sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ai-provider-config';

const PROVIDER_DEFAULTS: Record<string, { model: string; endpoint: string }> = {
  openai: { model: 'gpt-4o-mini', endpoint: '' },
  anthropic: { model: 'claude-3-5-haiku-20241022', endpoint: '' },
  ollama: { model: 'llama3.2', endpoint: 'http://localhost:11434' },
};

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

const ANTHROPIC_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
];

const OLLAMA_MODELS = ['llama3.2', 'llama3.1', 'mistral', 'gemma2', 'phi3', 'codellama'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AISettingsPanelProps {
  /** Plugin storage for persisting settings */
  storage?: PluginStorage;
  /** Called when settings are saved */
  onSave?: (config: ProviderConfig) => void;
}

export function AISettingsPanel({ storage, onSave }: AISettingsPanelProps): React.ReactElement {
  const { config, actions } = useAIStore();

  const [draft, setDraft] = useState<ProviderConfig>({ ...config });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  // Load persisted config on mount
  useEffect(() => {
    if (!storage) return;

    void (async () => {
      const stored = await storage.get<ProviderConfig>(STORAGE_KEY);
      if (stored) {
        const result = providerConfigSchema.safeParse(stored);
        if (result.success) {
          setDraft(result.data);
          actions.setConfig(result.data);
        }
      }
    })();
  }, [storage, actions]);

  const handleProviderChange = useCallback((provider: ProviderConfig['provider']) => {
    const defaults = PROVIDER_DEFAULTS[provider] ??
      PROVIDER_DEFAULTS['openai'] ?? { model: 'gpt-4o-mini', endpoint: undefined };
    setDraft((prev) => ({
      ...prev,
      provider,
      model: defaults.model,
      customEndpoint: defaults.endpoint,
    }));
    setTestStatus('idle');
    setTestError(null);
  }, []);

  const handleChange = useCallback(
    <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setTestStatus('idle');
      setTestError(null);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const result = providerConfigSchema.safeParse(draft);
    if (!result.success) {
      setSaveError(result.error.issues.map((i) => i.message).join('; '));
      setSaving(false);
      return;
    }

    const validated = result.data;

    try {
      if (storage) {
        await storage.set(STORAGE_KEY, validated);
      }
      actions.setConfig(validated);
      onSave?.(validated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [draft, storage, actions, onSave]);

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestError(null);

    // Build a minimal test prompt
    const baseUrl = draft.customEndpoint || getDefaultEndpoint(draft.provider);

    try {
      if (draft.provider === 'ollama') {
        // Ollama: check model list endpoint
        const resp = await fetch(`${baseUrl}/api/tags`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } else {
        // OpenAI / Anthropic: send a tiny completion
        const testEndpoint =
          draft.provider === 'anthropic' ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;

        const body =
          draft.provider === 'anthropic'
            ? {
                model: draft.model,
                max_tokens: 5,
                messages: [{ role: 'user', content: 'Hi' }],
              }
            : {
                model: draft.model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
              };

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${draft.apiKey}`,
        };
        if (draft.provider === 'anthropic') {
          (headers as Record<string, string>)['x-api-key'] = draft.apiKey;
          (headers as Record<string, string>)['anthropic-version'] = '2023-06-01';
        }

        const resp = await fetch(testEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 100)}`);
        }
      }

      setTestStatus('ok');
    } catch (err) {
      setTestStatus('fail');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }, [draft]);

  const modelOptions = getModelOptions(draft.provider);

  return (
    <div className="ai-settings">
      <style>{SETTINGS_STYLES}</style>

      <h2 className="ai-settings-title">AI Writing Assistant Settings</h2>

      {/* Provider selection */}
      <fieldset className="ai-settings-group">
        <legend className="ai-settings-legend">Provider</legend>
        <div className="ai-provider-options" role="radiogroup" aria-label="LLM provider">
          {(['openai', 'anthropic', 'ollama'] as const).map((p) => (
            <label
              key={p}
              className={`ai-provider-option${draft.provider === p ? ' selected' : ''}`}
            >
              <input
                type="radio"
                name="provider"
                value={p}
                checked={draft.provider === p}
                onChange={() => handleProviderChange(p)}
                className="ai-sr-only"
              />
              {p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'Ollama'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* API Key — not needed for Ollama */}
      {draft.provider !== 'ollama' && (
        <div className="ai-settings-field">
          <label className="ai-settings-label" htmlFor="ai-api-key">
            API Key
          </label>
          <div className="ai-key-wrapper">
            <input
              id="ai-api-key"
              className="ai-settings-input"
              type={showApiKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder={`Enter your ${draft.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key`}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="ai-show-key-btn"
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="ai-settings-hint">
            Your API key is stored locally and never sent to Notesaner servers.
          </p>
        </div>
      )}

      {/* Model */}
      <div className="ai-settings-field">
        <label className="ai-settings-label" htmlFor="ai-model">
          Model
        </label>
        <div className="ai-model-wrapper">
          <select
            id="ai-model"
            className="ai-settings-select"
            value={draft.model}
            onChange={(e) => handleChange('model', e.target.value)}
          >
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {!modelOptions.includes(draft.model) && (
              <option value={draft.model}>{draft.model} (custom)</option>
            )}
          </select>
          <input
            className="ai-settings-input ai-model-custom"
            type="text"
            value={draft.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="Or type a custom model ID"
            aria-label="Custom model ID"
          />
        </div>
      </div>

      {/* Temperature */}
      <div className="ai-settings-field">
        <label className="ai-settings-label" htmlFor="ai-temperature">
          Temperature: <strong>{draft.temperature.toFixed(1)}</strong>
        </label>
        <input
          id="ai-temperature"
          className="ai-settings-range"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={draft.temperature}
          onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={draft.temperature}
        />
        <div className="ai-range-labels" aria-hidden="true">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max tokens */}
      <div className="ai-settings-field">
        <label className="ai-settings-label" htmlFor="ai-max-tokens">
          Max Tokens
        </label>
        <input
          id="ai-max-tokens"
          className="ai-settings-input ai-settings-input--short"
          type="number"
          min={64}
          max={8192}
          step={64}
          value={draft.maxTokens}
          onChange={(e) => handleChange('maxTokens', parseInt(e.target.value, 10))}
        />
        <p className="ai-settings-hint">
          Maximum response length. Higher values allow longer outputs but cost more.
        </p>
      </div>

      {/* Custom endpoint */}
      <div className="ai-settings-field">
        <label className="ai-settings-label" htmlFor="ai-endpoint">
          Custom Endpoint <span className="ai-optional">(optional)</span>
        </label>
        <input
          id="ai-endpoint"
          className="ai-settings-input"
          type="url"
          value={draft.customEndpoint}
          onChange={(e) => handleChange('customEndpoint', e.target.value)}
          placeholder={`Default: ${getDefaultEndpoint(draft.provider)}`}
          spellCheck={false}
        />
        <p className="ai-settings-hint">
          For Ollama or OpenAI-compatible APIs (e.g. LM Studio, LocalAI).
        </p>
      </div>

      {/* Test connection */}
      <div className="ai-settings-test">
        <button
          className="ai-test-btn"
          type="button"
          onClick={handleTest}
          disabled={testStatus === 'testing'}
          aria-busy={testStatus === 'testing'}
        >
          {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>

        {testStatus === 'ok' && (
          <span className="ai-test-status ai-test-status--ok" role="status">
            Connection successful
          </span>
        )}
        {testStatus === 'fail' && (
          <span className="ai-test-status ai-test-status--fail" role="alert">
            {testError ?? 'Connection failed'}
          </span>
        )}
      </div>

      {/* Save */}
      <div className="ai-settings-footer">
        {saveError && (
          <p className="ai-save-error" role="alert">
            {saveError}
          </p>
        )}
        {saveSuccess && (
          <p className="ai-save-success" role="status">
            Settings saved!
          </p>
        )}
        <button
          className="ai-save-btn"
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModelOptions(provider: ProviderConfig['provider']): string[] {
  switch (provider) {
    case 'openai':
      return OPENAI_MODELS;
    case 'anthropic':
      return ANTHROPIC_MODELS;
    case 'ollama':
      return OLLAMA_MODELS;
  }
}

function getDefaultEndpoint(provider: ProviderConfig['provider']): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'ollama':
      return 'http://localhost:11434';
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SETTINGS_STYLES = `
  .ai-settings {
    padding: 16px;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 13px;
    color: var(--color-text, #1a1a1a);
    max-width: 480px;
  }

  .ai-settings-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: var(--color-text, #1a1a1a);
  }

  .ai-settings-group {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 12px;
    margin: 0 0 16px 0;
  }

  .ai-settings-legend {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #64748b);
    padding: 0 4px;
  }

  .ai-provider-options {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .ai-provider-option {
    flex: 1;
    text-align: center;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.1s, border-color 0.1s;
  }

  .ai-provider-option.selected {
    background: var(--color-accent-bg, #eef2ff);
    border-color: var(--color-accent, #6366f1);
    color: var(--color-accent, #6366f1);
    font-weight: 600;
  }

  .ai-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    border: 0;
  }

  .ai-settings-field {
    margin-bottom: 14px;
  }

  .ai-settings-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted, #64748b);
    margin-bottom: 5px;
  }

  .ai-optional {
    font-weight: 400;
    font-size: 11px;
    color: var(--color-text-muted, #94a3b8);
  }

  .ai-settings-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    background: var(--color-bg-input, #f8fafc);
    color: var(--color-text, #1a1a1a);
    box-sizing: border-box;
  }

  .ai-settings-input:focus {
    outline: none;
    border-color: var(--color-accent, #6366f1);
    box-shadow: 0 0 0 2px var(--color-accent-ring, rgba(99,102,241,0.2));
  }

  .ai-settings-input--short {
    width: 120px;
  }

  .ai-key-wrapper {
    display: flex;
    gap: 6px;
  }

  .ai-key-wrapper .ai-settings-input {
    flex: 1;
  }

  .ai-show-key-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-input, #f8fafc);
    font-size: 11px;
    cursor: pointer;
    flex-shrink: 0;
    color: var(--color-text-muted, #64748b);
  }

  .ai-settings-select {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    font-size: 12px;
    background: var(--color-bg-input, #f8fafc);
    color: var(--color-text, #1a1a1a);
    margin-bottom: 6px;
    box-sizing: border-box;
  }

  .ai-model-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ai-model-custom {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
  }

  .ai-settings-range {
    width: 100%;
    accent-color: var(--color-accent, #6366f1);
    margin: 4px 0;
  }

  .ai-range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--color-text-muted, #94a3b8);
    margin-top: 2px;
  }

  .ai-settings-hint {
    font-size: 11px;
    color: var(--color-text-muted, #94a3b8);
    margin: 4px 0 0;
  }

  .ai-settings-test {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .ai-test-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-text, #1a1a1a);
  }

  .ai-test-btn:hover:not(:disabled) {
    background: var(--color-bg-hover, #f1f5f9);
  }

  .ai-test-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ai-test-status {
    font-size: 12px;
  }

  .ai-test-status--ok {
    color: var(--color-success, #10b981);
  }

  .ai-test-status--fail {
    color: var(--color-error, #ef4444);
  }

  .ai-settings-footer {
    border-top: 1px solid var(--color-border, #e2e8f0);
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-save-error {
    font-size: 12px;
    color: var(--color-error, #ef4444);
    margin: 0;
  }

  .ai-save-success {
    font-size: 12px;
    color: var(--color-success, #10b981);
    margin: 0;
  }

  .ai-save-btn {
    align-self: flex-start;
    padding: 7px 20px;
    border-radius: 6px;
    border: none;
    background: var(--color-accent, #6366f1);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.1s;
  }

  .ai-save-btn:hover:not(:disabled) {
    background: var(--color-accent-hover, #4f46e5);
  }

  .ai-save-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
