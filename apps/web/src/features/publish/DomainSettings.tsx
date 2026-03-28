'use client';

/**
 * DomainSettings.tsx
 *
 * Settings panel for configuring a custom domain for the public vault.
 *
 * Features:
 *   - Configure a custom domain (e.g. docs.mycompany.com)
 *   - Show current domain with verification status badge
 *   - Display DNS setup instructions (TXT + CNAME records)
 *   - Trigger DNS verification (re-check TXT record)
 *   - Remove the custom domain
 *   - Fallback info: wildcard subdomain (<slug>.notesaner.app) always works
 *
 * Usage:
 *   <DomainSettings workspaceId={workspaceId} publicSlug={publicSlug} />
 *
 * The component manages its own async operations and communicates with the
 * backend via the domainApi module. The useDomainStore Zustand store holds
 * intermediate state between fetches.
 */

import { useState, useCallback, useEffect, useId } from 'react';
import { useDomainStore, type DomainVerificationStatus } from './domain-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { domainApi } from '@/shared/api/domain';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DomainSettingsProps {
  /** The workspace whose public vault domain is being configured. */
  workspaceId: string;
  /**
   * The default wildcard subdomain slug (e.g. "my-notes").
   * Used to show the fallback URL when no custom domain is set.
   */
  publicSlug: string | null;
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<DomainVerificationStatus, string> = {
  unverified: 'Not verified',
  pending: 'Pending',
  verified: 'Verified',
  failed: 'Verification failed',
};

const STATUS_COLORS: Record<DomainVerificationStatus, string> = {
  unverified: '#868e96',
  pending: '#f08c00',
  verified: '#2f9e44',
  failed: '#c92a2a',
};

// ─── DomainSettings ───────────────────────────────────────────────────────────

export function DomainSettings({ workspaceId, publicSlug }: DomainSettingsProps) {
  const domainInputId = useId();
  const accessToken = useAuthStore((s) => s.accessToken);

  const {
    domain,
    status,
    verificationToken,
    lastVerifiedAt,
    dnsInstructions,
    isLoading,
    isSaving,
    error,
    setDomainConfig,
    setLoading,
    setSaving,
    setError,
    clearError,
    reset,
  } = useDomainStore();

  const [domainInput, setDomainInput] = useState('');
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);
  const [copied, setCopied] = useState<'txt' | 'cname' | null>(null);

  // ── Load domain config on mount ───────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    async function loadConfig() {
      setLoading(true);
      try {
        const config = await domainApi.getConfig(accessToken ?? '', workspaceId);
        if (!cancelled) {
          setDomainConfig(config);
          setDomainInput(config.domain ?? '');
          // Auto-show DNS instructions when a domain is set but unverified
          if (config.domain && config.status !== 'verified') {
            setShowDnsInstructions(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load domain configuration');
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
      reset();
    };
  }, [workspaceId, accessToken]);

  // ── Set domain ────────────────────────────────────────────────────────────

  const handleSetDomain = useCallback(async () => {
    const trimmed = domainInput.trim();
    if (!trimmed || !accessToken) return;

    clearError();
    setSaving(true);

    try {
      const config = await domainApi.setDomain(accessToken, workspaceId, trimmed);
      setDomainConfig(config);
      setShowDnsInstructions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set custom domain');
    }
  }, [domainInput, accessToken, workspaceId, clearError, setSaving, setDomainConfig, setError]);

  // ── Verify domain ─────────────────────────────────────────────────────────

  const handleVerify = useCallback(async () => {
    if (!accessToken) return;

    clearError();
    setSaving(true);

    try {
      const config = await domainApi.verify(accessToken, workspaceId);
      setDomainConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed');
    }
  }, [accessToken, workspaceId, clearError, setSaving, setDomainConfig, setError]);

  // ── Remove domain ─────────────────────────────────────────────────────────

  const handleRemoveDomain = useCallback(async () => {
    if (!accessToken) return;

    clearError();
    setSaving(true);

    try {
      await domainApi.removeDomain(accessToken, workspaceId);
      setDomainConfig({
        domain: null,
        status: 'unverified',
        verificationToken: null,
        lastVerifiedAt: null,
        dnsInstructions: null,
      });
      setDomainInput('');
      setShowDnsInstructions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove custom domain');
    }
  }, [accessToken, workspaceId, clearError, setSaving, setDomainConfig, setError]);

  // ── Copy helper ───────────────────────────────────────────────────────────

  const handleCopy = useCallback(async (value: string, field: 'txt' | 'cname') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, []);

  // ── Fallback URL ──────────────────────────────────────────────────────────

  const defaultUrl = publicSlug ? `https://${publicSlug}.notesaner.app` : null;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading domain configuration"
        style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: '2px solid #dee2e6',
            borderTopColor: '#1971c2',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="domain-settings"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: '#fff5f5',
            border: '1px solid #ffc9c9',
            color: '#c92a2a',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#c92a2a',
              flexShrink: 0,
              padding: '0',
              lineHeight: 1,
            }}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Default / fallback domain */}
      {defaultUrl && (
        <section aria-labelledby="default-domain-heading">
          <h3
            id="default-domain-heading"
            style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}
          >
            Default domain
          </h3>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#495057' }}>
            Your vault is always accessible at:
          </p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              color: '#495057',
              wordBreak: 'break-all',
            }}
          >
            {defaultUrl}
          </div>
        </section>
      )}

      {/* Custom domain section */}
      <section aria-labelledby="custom-domain-heading">
        <h3
          id="custom-domain-heading"
          style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}
        >
          Custom domain
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#868e96' }}>
          Serve your public vault from your own domain (e.g. docs.mycompany.com). DNS propagation
          may take up to 24 hours.
        </p>

        {/* Current domain status */}
        {domain && (
          <div
            data-testid="current-domain-status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              marginBottom: '12px',
              background: '#fff',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#212529',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {domain}
              </span>
              <StatusBadge status={status} />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {status !== 'verified' && (
                <button
                  type="button"
                  onClick={() => void handleVerify()}
                  disabled={isSaving}
                  aria-label={`Verify domain ${domain}`}
                  style={secondaryButtonStyle(isSaving)}
                >
                  {isSaving ? 'Checking...' : 'Verify'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleRemoveDomain()}
                disabled={isSaving}
                aria-label={`Remove domain ${domain}`}
                style={destructiveButtonStyle(isSaving)}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Domain input form */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label
              htmlFor={domainInputId}
              style={{
                display: 'block',
                fontSize: '12px',
                marginBottom: '4px',
                color: '#495057',
                fontWeight: 500,
              }}
            >
              {domain ? 'Replace with new domain' : 'Enter your domain'}
            </label>
            <input
              id={domainInputId}
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSetDomain();
              }}
              placeholder="docs.mycompany.com"
              disabled={isSaving}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
                opacity: isSaving ? 0.6 : 1,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSetDomain()}
            disabled={isSaving || !domainInput.trim()}
            style={primaryButtonStyle(isSaving || !domainInput.trim())}
          >
            {isSaving ? 'Saving...' : domain ? 'Update' : 'Set domain'}
          </button>
        </div>

        {/* Last verified timestamp */}
        {lastVerifiedAt && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#868e96' }}>
            Last checked:{' '}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(lastVerifiedAt))}
          </p>
        )}
      </section>

      {/* DNS instructions */}
      {dnsInstructions && (
        <section aria-labelledby="dns-instructions-heading">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <h3
              id="dns-instructions-heading"
              style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}
            >
              DNS configuration
            </h3>
            <button
              type="button"
              onClick={() => setShowDnsInstructions((v) => !v)}
              aria-expanded={showDnsInstructions}
              aria-controls="dns-instructions-content"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#1971c2',
                padding: '2px 4px',
              }}
            >
              {showDnsInstructions ? 'Hide' : 'Show instructions'}
            </button>
          </div>

          {showDnsInstructions && (
            <div
              id="dns-instructions-content"
              data-testid="dns-instructions"
              style={{
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                overflow: 'hidden',
                fontSize: '13px',
              }}
            >
              {/* Intro */}
              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                }}
              >
                <p style={{ margin: 0, color: '#495057' }}>
                  Add the following DNS records at your domain registrar to verify ownership and
                  point your domain to Notesaner.
                </p>
              </div>

              {/* TXT record */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#212529' }}>
                  Step 1 — Verify ownership (TXT record)
                </p>
                <DnsRecordRow
                  type="TXT"
                  host={dnsInstructions.txtRecordHost}
                  value={verificationToken ?? dnsInstructions.txtRecordValue}
                  onCopyHost={() => void handleCopy(dnsInstructions.txtRecordHost, 'txt')}
                  onCopyValue={() =>
                    void handleCopy(verificationToken ?? dnsInstructions.txtRecordValue, 'txt')
                  }
                  copied={copied === 'txt'}
                />
              </div>

              {/* CNAME record */}
              <div style={{ padding: '12px 16px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#212529' }}>
                  Step 2 — Point your domain (CNAME record)
                </p>
                <DnsRecordRow
                  type="CNAME"
                  host={dnsInstructions.cnameHost}
                  value={dnsInstructions.cnameTarget}
                  onCopyHost={() => void handleCopy(dnsInstructions.cnameHost, 'cname')}
                  onCopyValue={() => void handleCopy(dnsInstructions.cnameTarget, 'cname')}
                  copied={copied === 'cname'}
                />
              </div>

              {/* Note on propagation */}
              <div
                style={{
                  padding: '10px 16px',
                  background: '#f8f9fa',
                  borderTop: '1px solid #dee2e6',
                  color: '#868e96',
                  fontSize: '12px',
                }}
              >
                DNS changes can take up to 24-48 hours to propagate worldwide. Once added, click
                "Verify" above to confirm the TXT record is in place.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Verified success message */}
      {status === 'verified' && domain && (
        <div
          data-testid="verified-notice"
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: '#ebfbee',
            border: '1px solid #8ce99a',
            color: '#2f9e44',
            fontSize: '13px',
          }}
        >
          Your domain <strong>{domain}</strong> is verified and active. TLS certificate provisioning
          happens automatically via Let's Encrypt.
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DomainVerificationStatus }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: `${STATUS_COLORS[status]}18`,
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}40`,
        whiteSpace: 'nowrap',
      }}
    >
      <StatusDot color={STATUS_COLORS[status]} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

interface DnsRecordRowProps {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
  onCopyHost: () => void;
  onCopyValue: () => void;
  copied: boolean;
}

function DnsRecordRow({ type, host, value, onCopyValue, copied }: DnsRecordRowProps) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead>
        <tr>
          {['Type', 'Host', 'Value'].map((col) => (
            <th
              key={col}
              style={{
                textAlign: 'left',
                padding: '4px 8px',
                color: '#868e96',
                fontWeight: 600,
                fontSize: '11px',
                borderBottom: '1px solid #f1f3f5',
              }}
            >
              {col}
            </th>
          ))}
          <th style={{ width: '60px' }} />
        </tr>
      </thead>
      <tbody>
        <tr>
          <td
            style={{
              padding: '6px 8px',
              fontFamily: 'monospace',
              color: '#1971c2',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {type}
          </td>
          <td
            style={{
              padding: '6px 8px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              color: '#495057',
            }}
          >
            {host}
          </td>
          <td
            style={{
              padding: '6px 8px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              color: '#495057',
            }}
          >
            {value}
          </td>
          <td style={{ padding: '6px 8px' }}>
            <button
              type="button"
              onClick={onCopyValue}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #dee2e6',
                fontSize: '11px',
                cursor: 'pointer',
                background: copied ? '#ebfbee' : '#fff',
                color: copied ? '#2f9e44' : '#495057',
                whiteSpace: 'nowrap',
              }}
              aria-label={`Copy ${type} record value`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Button style helpers ─────────────────────────────────────────────────────

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: '6px',
    border: 'none',
    background: disabled ? '#a5d8ff' : '#1971c2',
    color: '#fff',
    fontWeight: 600,
    fontSize: '13px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
    background: '#fff',
    color: '#495057',
    fontSize: '12px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap',
  };
}

function destructiveButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #ffc9c9',
    background: 'transparent',
    color: '#c92a2a',
    fontSize: '12px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap',
  };
}

// ─── Inline icons ─────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
    </svg>
  );
}
