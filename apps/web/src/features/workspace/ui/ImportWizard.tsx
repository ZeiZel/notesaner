'use client';

/**
 * ImportWizard — Multi-step import wizard for bringing notes from other tools.
 *
 * Steps:
 * 1. Select source (Obsidian, Notion, Logseq, or generic Markdown)
 * 2. Upload files (drag & drop or file picker)
 * 3. Preview conversion results and configure options
 * 4. Import with progress indicator
 *
 * All state transitions are driven by user actions, not side effects.
 * The only useEffect is for keyboard shortcuts (Escape to close).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportSource = 'obsidian' | 'notion' | 'logseq' | 'markdown';

type WizardStep = 'source' | 'upload' | 'preview' | 'importing';

interface ImportOptions {
  source: ImportSource;
  preserveFolderStructure: boolean;
  targetFolder: string;
  convertLinks: boolean;
  importAttachments: boolean;
}

interface PreviewNote {
  originalPath: string;
  targetPath: string;
  title: string;
  sizeBytes: number;
  hasAttachments: boolean;
  linkCount: number;
  warnings: string[];
}

interface PreviewResult {
  source: ImportSource;
  totalNotes: number;
  totalAttachments: number;
  totalSizeBytes: number;
  notes: PreviewNote[];
  warnings: string[];
}

interface ImportResult {
  importedNotes: number;
  importedAttachments: number;
  skippedFiles: number;
  errors: { file: string; message: string; recoverable: boolean }[];
  duration: number;
}

export interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import */
  onImportComplete?: (result: ImportResult) => void;
}

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------

interface SourceOption {
  id: ImportSource;
  name: string;
  description: string;
  icon: React.ReactNode;
  acceptedFiles: string;
  helpText: string;
}

const SOURCES: SourceOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Import an Obsidian vault with wiki links, tags, and attachments.',
    icon: <ObsidianIcon />,
    acceptedFiles: '.zip',
    helpText: 'Export your vault as a ZIP file, or upload the vault folder directly.',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Import from a Notion workspace export (Markdown & CSV).',
    icon: <NotionIcon />,
    acceptedFiles: '.zip',
    helpText: 'Go to Settings & members > Export content > Export all as Markdown & CSV.',
  },
  {
    id: 'logseq',
    name: 'Logseq',
    description: 'Import Logseq pages and journals with outliner conversion.',
    icon: <LogseqIcon />,
    acceptedFiles: '.zip',
    helpText: 'Export your graph or upload the graph folder as a ZIP file.',
  },
  {
    id: 'markdown',
    name: 'Markdown files',
    description: 'Import standard .md files from any source.',
    icon: <MarkdownFilesIcon />,
    acceptedFiles: '.zip,.md',
    helpText: 'Upload a ZIP of markdown files or select individual .md files.',
  },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ObsidianIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
      <path d="M12 22V12M3 7l9 5 9-5" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h5M8 15h8" />
    </svg>
  );
}

function LogseqIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M9 10l-2-3M15 10l2-3M9 14l-2 3M15 14l2 3" />
    </svg>
  );
}

function MarkdownFilesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <path d="M8 13l2 3 2-2 2 3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-12 w-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`animate-spin ${className ?? 'h-5 w-5'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function previewImport(
  workspaceId: string,
  file: File,
  options: ImportOptions,
  token?: string,
): Promise<PreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', options.source);
  formData.append('preserveFolderStructure', String(options.preserveFolderStructure));
  formData.append('targetFolder', options.targetFolder);
  formData.append('convertLinks', String(options.convertLinks));
  formData.append('importAttachments', String(options.importAttachments));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/notes/import/preview`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string }).message ?? `Preview failed: HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<PreviewResult>;
}

async function executeImport(
  workspaceId: string,
  file: File,
  options: ImportOptions,
  token?: string,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('source', options.source);
  formData.append('preserveFolderStructure', String(options.preserveFolderStructure));
  formData.append('targetFolder', options.targetFolder);
  formData.append('convertLinks', String(options.convertLinks));
  formData.append('importAttachments', String(options.importAttachments));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/notes/import/execute`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string }).message ?? `Import failed: HTTP ${response.status}`,
    );
  }

  return response.json() as Promise<ImportResult>;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps: { id: WizardStep; label: string }[] = [
    { id: 'source', label: 'Source' },
    { id: 'upload', label: 'Upload' },
    { id: 'preview', label: 'Preview' },
    { id: 'importing', label: 'Import' },
  ];

  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isComplete = i < currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className="h-px w-6"
                style={{
                  backgroundColor: isComplete
                    ? 'var(--ns-color-primary, #2563eb)'
                    : 'var(--ns-color-border, #e5e5e5)',
                }}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  backgroundColor: isActive
                    ? 'var(--ns-color-primary, #2563eb)'
                    : isComplete
                      ? 'var(--ns-color-primary, #2563eb)'
                      : 'var(--ns-color-secondary, #f5f5f5)',
                  color:
                    isActive || isComplete ? '#ffffff' : 'var(--ns-color-foreground-muted, #666)',
                }}
              >
                {isComplete ? '\u2713' : i + 1}
              </div>
              <span
                className="text-xs font-medium"
                style={{
                  color: isActive
                    ? 'var(--ns-color-foreground, #1a1a1a)'
                    : 'var(--ns-color-foreground-muted, #666)',
                }}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImportWizard({ open, onClose, onImportComplete }: ImportWizardProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('source');
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [options, setOptions] = useState<Omit<ImportOptions, 'source'>>({
    preserveFolderStructure: true,
    targetFolder: '',
    convertLinks: true,
    importAttachments: true,
  });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escape key to close (this is a keyboard event side effect — useEffect is valid)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'importing') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, step]);

  const handleClose = useCallback(() => {
    if (isLoading) return;
    onClose();
    // Reset state after close animation
    setTimeout(() => {
      setStep('source');
      setSelectedSource(null);
      setUploadedFile(null);
      setPreview(null);
      setImportResult(null);
      setErrorMessage(null);
      setIsLoading(false);
    }, 300);
  }, [onClose, isLoading]);

  // Source selection -> Upload step
  const handleSourceSelect = useCallback((source: ImportSource) => {
    setSelectedSource(source);
    setStep('upload');
    setErrorMessage(null);
  }, []);

  // File upload handling
  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file);
    setErrorMessage(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // Upload -> Preview step
  const handlePreview = useCallback(async () => {
    if (!activeWorkspaceId || !uploadedFile || !selectedSource) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await previewImport(activeWorkspaceId, uploadedFile, {
        source: selectedSource,
        ...options,
      });
      setPreview(result);
      setStep('preview');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, uploadedFile, selectedSource, options]);

  // Preview -> Import step
  const handleStartImport = useCallback(async () => {
    if (!activeWorkspaceId || !uploadedFile || !selectedSource) return;

    setStep('importing');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await executeImport(activeWorkspaceId, uploadedFile, {
        source: selectedSource,
        ...options,
      });
      setImportResult(result);
      onImportComplete?.(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, uploadedFile, selectedSource, options, onImportComplete]);

  const handleBack = useCallback(() => {
    setErrorMessage(null);
    switch (step) {
      case 'upload':
        setStep('source');
        setUploadedFile(null);
        break;
      case 'preview':
        setStep('upload');
        setPreview(null);
        break;
    }
  }, [step]);

  if (!open) return null;

  const currentSource = SOURCES.find((s) => s.id === selectedSource);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-wizard-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={step !== 'importing' ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'var(--ns-color-surface, #ffffff)',
          border: '1px solid var(--ns-color-border, #e5e5e5)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--ns-color-border, #e5e5e5)' }}
        >
          <div>
            <h2
              id="import-wizard-title"
              className="text-lg font-semibold"
              style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
            >
              Import notes
            </h2>
            <div className="mt-2">
              <StepIndicator currentStep={step} />
            </div>
          </div>
          {step !== 'importing' && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-1.5 transition-colors"
              style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
              aria-label="Close import wizard"
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: 300 }}>
          {/* Step 1: Source selection */}
          {step === 'source' && (
            <div>
              <p
                className="mb-4 text-sm"
                style={{ color: 'var(--ns-color-foreground-secondary, #333)' }}
              >
                Select the source application for your notes.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SOURCES.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => handleSourceSelect(source.id)}
                    className="flex flex-col items-start rounded-lg p-4 text-left transition-all hover:shadow-sm"
                    style={{
                      border: '2px solid var(--ns-color-border, #e5e5e5)',
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        'var(--ns-color-primary, #2563eb)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        'var(--ns-color-border, #e5e5e5)';
                    }}
                  >
                    <div
                      className="mb-3"
                      style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                    >
                      {source.icon}
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                    >
                      {source.name}
                    </span>
                    <span
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                    >
                      {source.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: File upload */}
          {step === 'upload' && currentSource && (
            <div>
              <p
                className="mb-2 text-sm font-medium"
                style={{ color: 'var(--ns-color-foreground-secondary, #333)' }}
              >
                Upload your {currentSource.name} export
              </p>
              <p
                className="mb-4 text-xs"
                style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
              >
                {currentSource.helpText}
              </p>

              {/* Drop zone */}
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all"
                style={{
                  borderColor: isDragOver
                    ? 'var(--ns-color-primary, #2563eb)'
                    : 'var(--ns-color-border, #e5e5e5)',
                  backgroundColor: isDragOver
                    ? 'var(--ns-color-primary-muted, #eff6ff)'
                    : 'transparent',
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div style={{ color: 'var(--ns-color-foreground-muted, #666)' }}>
                  <UploadIcon />
                </div>
                <p
                  className="mt-3 text-sm font-medium"
                  style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                >
                  {uploadedFile ? uploadedFile.name : 'Drag & drop your file here'}
                </p>
                {uploadedFile && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                  >
                    {formatBytes(uploadedFile.size)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: 'var(--ns-color-primary, #2563eb)',
                    backgroundColor: 'var(--ns-color-primary-muted, #eff6ff)',
                  }}
                >
                  {uploadedFile ? 'Choose a different file' : 'Choose file'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={currentSource.acceptedFiles}
                  onChange={handleFileInputChange}
                  className="hidden"
                  aria-label="Choose file to import"
                />
              </div>

              {/* Import options */}
              <div className="mt-6 space-y-3">
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--ns-color-foreground-secondary, #333)' }}
                >
                  Options
                </p>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.preserveFolderStructure}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, preserveFolderStructure: e.target.checked }))
                    }
                    className="h-4 w-4 rounded"
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Preserve folder structure
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.convertLinks}
                    onChange={(e) => setOptions((o) => ({ ...o, convertLinks: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Convert internal links to Notesaner format
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.importAttachments}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, importAttachments: e.target.checked }))
                    }
                    className="h-4 w-4 rounded"
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Import attachments (images, files)
                  </span>
                </label>

                <div>
                  <label
                    className="text-sm"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Target folder (optional)
                  </label>
                  <input
                    type="text"
                    value={options.targetFolder}
                    onChange={(e) => setOptions((o) => ({ ...o, targetFolder: e.target.value }))}
                    placeholder="e.g. imported/obsidian"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    style={{
                      borderColor: 'var(--ns-color-border, #e5e5e5)',
                      color: 'var(--ns-color-foreground, #1a1a1a)',
                      backgroundColor: 'var(--ns-color-surface, #ffffff)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && preview && (
            <div>
              {/* Summary */}
              <div
                className="mb-4 rounded-lg p-4"
                style={{ backgroundColor: 'var(--ns-color-secondary, #f5f5f5)' }}
              >
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                    >
                      {preview.totalNotes}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                    >
                      Notes
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                    >
                      {preview.totalAttachments}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                    >
                      Attachments
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                    >
                      {formatBytes(preview.totalSizeBytes)}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                    >
                      Total size
                    </p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div
                  className="mb-4 rounded-md px-4 py-3"
                  style={{
                    backgroundColor: 'var(--ns-color-warning-muted, #fffbeb)',
                    border: '1px solid var(--ns-color-warning-border, #fde68a)',
                  }}
                >
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span style={{ color: 'var(--ns-color-warning, #d97706)' }}>
                        <WarningIcon />
                      </span>
                      <span style={{ color: 'var(--ns-color-warning, #d97706)' }}>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes list */}
              <p
                className="mb-2 text-sm font-medium"
                style={{ color: 'var(--ns-color-foreground-secondary, #333)' }}
              >
                Notes to import
              </p>
              <div
                className="max-h-60 overflow-y-auto rounded-lg border"
                style={{ borderColor: 'var(--ns-color-border, #e5e5e5)' }}
              >
                {preview.notes.map((note, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b px-4 py-2.5 last:border-b-0"
                    style={{ borderColor: 'var(--ns-color-border, #e5e5e5)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                      >
                        {note.title}
                      </p>
                      <p
                        className="truncate text-xs"
                        style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                      >
                        {note.targetPath}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {note.warnings.length > 0 && (
                        <span
                          title={note.warnings.join('; ')}
                          style={{ color: 'var(--ns-color-warning, #d97706)' }}
                        >
                          <WarningIcon />
                        </span>
                      )}
                      <span
                        className="text-xs"
                        style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                      >
                        {formatBytes(note.sizeBytes)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8">
              {isLoading && !importResult && (
                <>
                  <SpinnerIcon className="h-12 w-12" />
                  <p
                    className="mt-4 text-sm font-medium"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Importing your notes...
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                  >
                    This may take a moment for large imports.
                  </p>
                </>
              )}

              {importResult && (
                <>
                  <div style={{ color: 'var(--ns-color-success, #16a34a)' }}>
                    <CheckCircleIcon />
                  </div>
                  <p
                    className="mt-4 text-lg font-semibold"
                    style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}
                  >
                    Import complete
                  </p>
                  <div
                    className="mt-4 w-full max-w-sm rounded-lg p-4"
                    style={{ backgroundColor: 'var(--ns-color-secondary, #f5f5f5)' }}
                  >
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ns-color-foreground-muted, #666)' }}>
                          Notes imported
                        </span>
                        <span style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}>
                          {importResult.importedNotes}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ns-color-foreground-muted, #666)' }}>
                          Attachments imported
                        </span>
                        <span style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}>
                          {importResult.importedAttachments}
                        </span>
                      </div>
                      {importResult.skippedFiles > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--ns-color-warning, #d97706)' }}>Skipped</span>
                          <span style={{ color: 'var(--ns-color-warning, #d97706)' }}>
                            {importResult.skippedFiles}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--ns-color-foreground-muted, #666)' }}>
                          Duration
                        </span>
                        <span style={{ color: 'var(--ns-color-foreground, #1a1a1a)' }}>
                          {(importResult.duration / 1000).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <div className="mt-4 w-full max-w-sm">
                      <p
                        className="mb-2 text-sm font-medium"
                        style={{ color: 'var(--ns-color-error, #dc2626)' }}
                      >
                        {importResult.errors.length} error(s)
                      </p>
                      <div
                        className="max-h-32 overflow-y-auto rounded-md border px-3 py-2"
                        style={{
                          borderColor: 'var(--ns-color-error-border, #fecaca)',
                          backgroundColor: 'var(--ns-color-error-muted, #fef2f2)',
                        }}
                      >
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="py-1 text-xs">
                            <span
                              className="font-medium"
                              style={{ color: 'var(--ns-color-error, #dc2626)' }}
                            >
                              {err.file}:
                            </span>{' '}
                            <span style={{ color: 'var(--ns-color-foreground-muted, #666)' }}>
                              {err.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {errorMessage && !importResult && (
                <>
                  <div style={{ color: 'var(--ns-color-error, #dc2626)' }}>
                    <WarningIcon />
                  </div>
                  <p
                    className="mt-4 text-sm font-medium"
                    style={{ color: 'var(--ns-color-error, #dc2626)' }}
                  >
                    Import failed
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--ns-color-foreground-muted, #666)' }}
                  >
                    {errorMessage}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Error message for non-importing steps */}
          {errorMessage && step !== 'importing' && (
            <div
              className="mt-4 rounded-md px-4 py-3 text-sm"
              style={{
                backgroundColor: 'var(--ns-color-error-muted, #fef2f2)',
                color: 'var(--ns-color-error, #dc2626)',
                border: '1px solid var(--ns-color-error-border, #fecaca)',
              }}
              role="alert"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-6 py-4"
          style={{ borderColor: 'var(--ns-color-border, #e5e5e5)' }}
        >
          <div>
            {(step === 'upload' || step === 'preview') && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  color: 'var(--ns-color-foreground-secondary, #333)',
                  backgroundColor: 'var(--ns-color-secondary, #f5f5f5)',
                }}
              >
                <ArrowLeftIcon />
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {step !== 'importing' && (
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: 'var(--ns-color-foreground-secondary, #333)',
                  backgroundColor: 'var(--ns-color-secondary, #f5f5f5)',
                }}
              >
                Cancel
              </button>
            )}

            {step === 'upload' && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!uploadedFile || isLoading}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: '#ffffff',
                  backgroundColor: 'var(--ns-color-primary, #2563eb)',
                  opacity: !uploadedFile || isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Preview
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={handleStartImport}
                disabled={isLoading || !preview || preview.totalNotes === 0}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: '#ffffff',
                  backgroundColor: 'var(--ns-color-primary, #2563eb)',
                  opacity: isLoading || !preview || preview.totalNotes === 0 ? 0.5 : 1,
                }}
              >
                Import {preview?.totalNotes ?? 0} notes
                <ArrowRightIcon />
              </button>
            )}

            {step === 'importing' && (importResult || errorMessage) && (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  color: '#ffffff',
                  backgroundColor: 'var(--ns-color-primary, #2563eb)',
                }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ImportWizard.displayName = 'ImportWizard';
