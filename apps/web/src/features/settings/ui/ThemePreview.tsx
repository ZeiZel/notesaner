'use client';

/**
 * ThemePreview — live preview panel showing how the current theme + overrides
 * will render in the actual workspace.
 *
 * Features:
 *   - Mini workspace mockup with sidebar, toolbar, and editor area
 *   - Reacts live to theme changes, accent color, and font overrides
 *   - Rendered using the actual CSS custom properties (not hardcoded colors)
 *   - Isolated via inline styles so it always reflects the *applied* theme
 *
 * No useEffect — all styles are derived from current CSS variable values.
 */

interface ThemePreviewProps {
  /** Optional additional CSS classes on the root element */
  className?: string;
}

export function ThemePreview({ className = '' }: ThemePreviewProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden border ${className}`}
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          backgroundColor: 'var(--ns-color-background-surface)',
          borderColor: 'var(--ns-color-border)',
        }}
      >
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--ns-color-destructive)' }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--ns-color-warning)' }}
          />
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--ns-color-success)' }}
          />
        </div>
        {/* Toolbar items */}
        <div className="flex-1 flex justify-center">
          <div
            className="h-5 px-3 rounded-md flex items-center"
            style={{
              backgroundColor: 'var(--ns-color-background-input)',
              border: '1px solid var(--ns-color-input)',
            }}
          >
            <span className="text-[9px]" style={{ color: 'var(--ns-color-foreground-muted)' }}>
              Search notes...
            </span>
          </div>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex" style={{ height: 180 }}>
        {/* Sidebar */}
        <div
          className="flex flex-col gap-1 p-2 border-r shrink-0"
          style={{
            width: 100,
            backgroundColor: 'var(--ns-color-sidebar-background)',
            borderColor: 'var(--ns-color-sidebar-border)',
          }}
        >
          {/* Sidebar header */}
          <div
            className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-1"
            style={{ color: 'var(--ns-color-sidebar-muted)' }}
          >
            Workspace
          </div>

          {/* Active nav item */}
          <div
            className="flex items-center gap-1.5 px-1.5 py-1 rounded"
            style={{
              backgroundColor: 'var(--ns-color-sidebar-accent)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-sm"
              style={{ backgroundColor: 'var(--ns-color-primary)' }}
            />
            <div
              className="h-[5px] rounded-full flex-1"
              style={{
                backgroundColor: 'var(--ns-color-sidebar-accent-foreground)',
                opacity: 0.9,
                maxWidth: 48,
              }}
            />
          </div>

          {/* Inactive nav items */}
          {[38, 32, 44, 28].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 px-1.5 py-1">
              <div
                className="w-1.5 h-1.5 rounded-sm"
                style={{ backgroundColor: 'var(--ns-color-sidebar-muted)', opacity: 0.5 }}
              />
              <div
                className="h-[5px] rounded-full"
                style={{
                  width: w,
                  backgroundColor: 'var(--ns-color-sidebar-foreground)',
                  opacity: 0.35,
                }}
              />
            </div>
          ))}

          {/* Tags section */}
          <div className="mt-auto flex gap-1 px-1">
            {['primary', 'accent', 'success'].map((color) => (
              <div
                key={color}
                className="h-[5px] w-6 rounded-full"
                style={{
                  backgroundColor: `var(--ns-color-${color})`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 p-4 flex flex-col gap-2 overflow-hidden">
          {/* Title */}
          <div
            className="h-3 rounded"
            style={{
              width: '45%',
              backgroundColor: 'var(--ns-color-foreground)',
              opacity: 0.85,
            }}
          />

          {/* Meta line */}
          <div className="flex gap-2 items-center mb-1">
            <div
              className="h-[5px] w-12 rounded-full"
              style={{ backgroundColor: 'var(--ns-color-foreground-muted)', opacity: 0.5 }}
            />
            <div
              className="h-[5px] w-4 rounded-full"
              style={{ backgroundColor: 'var(--ns-color-primary)', opacity: 0.6 }}
            />
          </div>

          {/* Content lines */}
          {[
            { w: '92%', opacity: 0.4 },
            { w: '78%', opacity: 0.35 },
            { w: '85%', opacity: 0.4 },
            { w: '60%', opacity: 0.3 },
          ].map((line, i) => (
            <div
              key={i}
              className="h-[5px] rounded-full"
              style={{
                width: line.w,
                backgroundColor: 'var(--ns-color-foreground-secondary)',
                opacity: line.opacity,
              }}
            />
          ))}

          {/* Inline link */}
          <div className="flex gap-1 items-center mt-1">
            <div
              className="h-[5px] w-20 rounded-full"
              style={{ backgroundColor: 'var(--ns-color-foreground-secondary)', opacity: 0.35 }}
            />
            <div
              className="h-[5px] w-14 rounded-full"
              style={{ backgroundColor: 'var(--ns-color-primary)', opacity: 0.7 }}
            />
            <div
              className="h-[5px] w-16 rounded-full"
              style={{ backgroundColor: 'var(--ns-color-foreground-secondary)', opacity: 0.35 }}
            />
          </div>

          {/* Code block */}
          <div
            className="rounded p-2 mt-1"
            style={{
              backgroundColor: 'var(--ns-color-background-surface)',
              border: '1px solid var(--ns-color-border-subtle)',
            }}
          >
            {[55, 70, 45].map((w, i) => (
              <div
                key={i}
                className="h-[4px] rounded-full mb-1 last:mb-0"
                style={{
                  width: `${w}%`,
                  backgroundColor: 'var(--ns-color-foreground-muted)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1 border-t"
        style={{
          backgroundColor: 'var(--ns-color-background-surface)',
          borderColor: 'var(--ns-color-border)',
        }}
      >
        <div className="flex gap-2">
          {[20, 30, 15].map((w, i) => (
            <div
              key={i}
              className="h-[4px] rounded-full"
              style={{
                width: w,
                backgroundColor: 'var(--ns-color-foreground-muted)',
                opacity: 0.4,
              }}
            />
          ))}
        </div>
        <div
          className="h-[4px] w-8 rounded-full"
          style={{ backgroundColor: 'var(--ns-color-success)', opacity: 0.5 }}
        />
      </div>
    </div>
  );
}
