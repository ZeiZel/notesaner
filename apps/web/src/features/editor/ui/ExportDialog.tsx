'use client';

/**
 * ExportDialog — Modal dialog for exporting notes in various formats.
 *
 * Displays format options (Markdown, HTML, PDF, DOCX) with descriptions
 * and a download progress indicator. Supports both single-note and
 * batch export modes.
 *
 * No useEffect — download state is driven by user interaction,
 * not side effects.
 *
 * Ant Design: uses Modal for the dialog, Button for actions, Alert for errors.
 */

import { useCallback, useState } from 'react';
import { Modal, Button, Alert, Flex, Typography } from 'antd';
import { DownloadOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'md' | 'html' | 'pdf' | 'docx';

export type ExportMode = 'single' | 'batch';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The note ID to export (single mode) */
  noteId?: string;
  /** The note IDs to export (batch mode) */
  noteIds?: string[];
  /** The note title (for display in single mode) */
  noteTitle?: string;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
}

type DownloadState = 'idle' | 'downloading' | 'complete' | 'error';

// ---------------------------------------------------------------------------
// Format definitions
// ---------------------------------------------------------------------------

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'md',
    label: 'Markdown',
    description:
      'Raw markdown with frontmatter preserved. Best for interoperability with other tools.',
    icon: <MarkdownIcon />,
    extension: '.md',
  },
  {
    id: 'html',
    label: 'HTML',
    description: 'Rendered HTML with embedded styles. Opens in any browser.',
    icon: <HtmlIcon />,
    extension: '.html',
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Portable document format. Ideal for sharing and printing.',
    icon: <PdfIcon />,
    extension: '.pdf',
  },
  {
    id: 'docx',
    label: 'Word (DOCX)',
    description: 'Microsoft Word format. Editable in Word, Google Docs, and LibreOffice.',
    icon: <DocxIcon />,
    extension: '.docx',
  },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function MarkdownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2.5 3L12 9v6M16 12h-2m2 0l-2-3m2 3l-2 3" />
    </svg>
  );
}

function HtmlIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <path d="M9 13h2a1 1 0 100-2H9v5M13 15h1.5a1.5 1.5 0 000-3H13v5" />
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <path d="M8 13l1.5 5 1.5-3 1.5 3 1.5-5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function downloadExport(
  workspaceId: string,
  noteId: string,
  format: ExportFormat,
  token?: string,
): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(
    `${API_BASE_URL}/workspaces/${workspaceId}/notes/${noteId}/export?format=${format}`,
    { headers },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string }).message ?? `Export failed: HTTP ${response.status}`,
    );
  }

  return response.blob();
}

async function downloadBatchExport(
  workspaceId: string,
  noteIds: string[],
  format: ExportFormat,
  token?: string,
): Promise<Blob> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/notes/export/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ noteIds, format }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string }).message ?? `Batch export failed: HTTP ${response.status}`,
    );
  }

  return response.blob();
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportDialog({ open, onClose, noteId, noteIds, noteTitle }: ExportDialogProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('md');
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBatchMode = noteIds !== undefined && noteIds.length > 0;
  const effectiveNoteIds = isBatchMode ? noteIds : noteId ? [noteId] : [];

  const handleExport = useCallback(async () => {
    if (!activeWorkspaceId || effectiveNoteIds.length === 0) return;

    setDownloadState('downloading');
    setErrorMessage(null);

    try {
      let blob: Blob;
      let filename: string;

      if (isBatchMode) {
        blob = await downloadBatchExport(activeWorkspaceId, effectiveNoteIds, selectedFormat);
        filename = `notesaner-export-${Date.now()}.zip`;
      } else {
        blob = await downloadExport(activeWorkspaceId, effectiveNoteIds[0], selectedFormat);
        const safeName = (noteTitle ?? 'note').replace(/[<>:"/\\|?*]/g, '_');
        const ext = FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.extension ?? '';
        filename = `${safeName}${ext}`;
      }

      triggerBrowserDownload(blob, filename);
      setDownloadState('complete');

      // Auto-close after successful download
      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setDownloadState('idle');
          setSelectedFormat('md');
        }, 300);
      }, 1500);
    } catch (error) {
      setDownloadState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Export failed. Please try again.');
    }
  }, [activeWorkspaceId, effectiveNoteIds, selectedFormat, isBatchMode, noteTitle, onClose]);

  const handleClose = useCallback(() => {
    if (downloadState === 'downloading') return;
    onClose();
    setTimeout(() => {
      setDownloadState('idle');
      setErrorMessage(null);
    }, 300);
  }, [onClose, downloadState]);

  const exportButtonIcon =
    downloadState === 'downloading' ? (
      <LoadingOutlined />
    ) : downloadState === 'complete' ? (
      <CheckOutlined />
    ) : (
      <DownloadOutlined />
    );

  const exportButtonLabel =
    downloadState === 'idle'
      ? 'Export'
      : downloadState === 'downloading'
        ? 'Exporting...'
        : downloadState === 'complete'
          ? 'Done'
          : 'Retry';

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {isBatchMode ? `Export ${effectiveNoteIds.length} notes` : 'Export note'}
          </Title>
          {noteTitle && !isBatchMode && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {noteTitle}
            </Text>
          )}
        </div>
      }
      width={520}
      footer={
        <Flex justify="space-between" align="center">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isBatchMode
              ? `${effectiveNoteIds.length} notes will be exported as ZIP`
              : `Will download as ${FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.extension}`}
          </Text>
          <Flex gap={8}>
            <Button onClick={handleClose} disabled={downloadState === 'downloading'}>
              Cancel
            </Button>
            <Button
              type={downloadState === 'complete' ? 'default' : 'primary'}
              onClick={handleExport}
              disabled={downloadState === 'downloading' || downloadState === 'complete'}
              loading={downloadState === 'downloading'}
              icon={exportButtonIcon}
              style={
                downloadState === 'complete'
                  ? { backgroundColor: 'var(--ns-color-success, #16a34a)', color: '#fff' }
                  : undefined
              }
            >
              {exportButtonLabel}
            </Button>
          </Flex>
        </Flex>
      }
    >
      {/* Format selection */}
      <div>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
          Choose format
        </Text>

        <div className="grid grid-cols-2 gap-3">
          {FORMAT_OPTIONS.map((format) => {
            const isSelected = selectedFormat === format.id;
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => {
                  if (downloadState !== 'downloading') {
                    setSelectedFormat(format.id);
                    setDownloadState('idle');
                    setErrorMessage(null);
                  }
                }}
                disabled={downloadState === 'downloading'}
                className="relative flex flex-col items-start rounded-lg p-4 text-left transition-all"
                style={{
                  border: isSelected
                    ? '2px solid var(--ns-color-primary, #2563eb)'
                    : '2px solid var(--ns-color-border, #e5e5e5)',
                  backgroundColor: isSelected
                    ? 'var(--ns-color-primary-muted, #eff6ff)'
                    : 'transparent',
                  opacity: downloadState === 'downloading' ? 0.6 : 1,
                }}
                aria-pressed={isSelected}
                aria-label={`Export as ${format.label}`}
              >
                {isSelected && (
                  <div
                    className="absolute right-2 top-2"
                    style={{ color: 'var(--ns-color-primary, #2563eb)' }}
                  >
                    <CheckOutlined style={{ fontSize: 16 }} />
                  </div>
                )}

                <div
                  className="mb-2"
                  style={{
                    color: isSelected
                      ? 'var(--ns-color-primary, #2563eb)'
                      : 'var(--ns-color-foreground-muted, #666)',
                  }}
                >
                  {format.icon}
                </div>

                <span
                  className="text-sm font-medium"
                  style={{
                    color: isSelected
                      ? 'var(--ns-color-primary, #2563eb)'
                      : 'var(--ns-color-foreground, #1a1a1a)',
                  }}
                >
                  {format.label}
                </span>

                <span
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                >
                  {format.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <Alert type="error" message={errorMessage} showIcon style={{ marginTop: 16 }} />
      )}
    </Modal>
  );
}

ExportDialog.displayName = 'ExportDialog';
