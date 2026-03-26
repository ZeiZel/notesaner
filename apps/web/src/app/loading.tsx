/**
 * Global loading skeleton shown during initial navigation.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-sm text-foreground-muted">Loading Notesaner…</p>
      </div>
    </div>
  );
}
