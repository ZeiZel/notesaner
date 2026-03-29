/**
 * Component SDK — shared types for the component override system.
 *
 * Consumed by:
 *   - Backend: component-overrides module (compile/validate overrides)
 *   - Frontend: component-overrides feature (editor, registry, sandbox)
 */

// ---------------------------------------------------------------------------
// Component registry
// ---------------------------------------------------------------------------

/**
 * A prop descriptor used for IntelliSense in the Monaco editor.
 */
export interface ComponentPropDescriptor {
  /** Prop name as it appears in JSX. */
  name: string;
  /** TypeScript type string, e.g. "string", "number", "ReactNode". */
  type: string;
  /** Whether the prop is required. */
  required: boolean;
  /** Short description shown in IntelliSense. */
  description?: string;
  /** Default value as a string literal for documentation. */
  defaultValue?: string;
}

/**
 * Metadata for a single overridable component.
 */
export interface OverridableComponentMeta {
  /** Stable identifier used in override records, e.g. "NoteCard". */
  id: OverridableComponentId;
  /** Human-readable display name. */
  displayName: string;
  /** Short description of what the component renders. */
  description: string;
  /** Current base component version (semver). Used for version pinning. */
  baseVersion: string;
  /** Declared props. */
  props: ComponentPropDescriptor[];
  /** Example usage shown as a starter template in the editor. */
  starterTemplate: string;
}

/**
 * All component IDs that can be overridden.
 */
export type OverridableComponentId =
  | 'NoteCard'
  | 'FileTreeItem'
  | 'StatusBarItem'
  | 'SidebarPanel'
  | 'ToolbarButton'
  | 'CalloutBlock'
  | 'CodeBlock'
  | 'SearchResultItem';

// ---------------------------------------------------------------------------
// Override record
// ---------------------------------------------------------------------------

/** Lifecycle status of a component override. */
export type OverrideStatus = 'draft' | 'active' | 'error' | 'reverted';

/**
 * A component override record as stored in the database and returned by the API.
 */
export interface ComponentOverride {
  id: string;
  workspaceId: string;
  componentId: OverridableComponentId;
  /** TSX source code written by the admin. */
  sourceCode: string;
  /**
   * Compiled JS bundle (esbuild output).
   * null while still in draft or when compilation failed.
   */
  compiledCode: string | null;
  /** Version of the base component this override was written against. */
  pinnedBaseVersion: string;
  status: OverrideStatus;
  /** Compiler error message, populated when status === 'error'. */
  compileError: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

/**
 * A single entry in the override audit log.
 */
export interface OverrideAuditEntry {
  id: string;
  overrideId: string;
  workspaceId: string;
  componentId: OverridableComponentId;
  action: OverrideAuditAction;
  actorUserId: string;
  /** Snapshot of sourceCode at the time of the action. */
  sourceSnapshot: string | null;
  previousStatus: OverrideStatus | null;
  newStatus: OverrideStatus;
  createdAt: string;
}

export type OverrideAuditAction = 'created' | 'updated' | 'activated' | 'reverted' | 'deleted';

// ---------------------------------------------------------------------------
// SDK context (injected into override iframe)
// ---------------------------------------------------------------------------

/**
 * The SDK context object that override components receive via the `sdk` prop.
 * Only safe, sandboxed APIs are exposed.
 */
export interface ComponentSdkContext {
  /** Current workspace slug. */
  workspaceSlug: string;
  /** Theme tokens: "light" | "dark". */
  colorScheme: 'light' | 'dark';
  /** Emit a custom event to the host (e.g. navigate, open modal). */
  emit: (event: string, payload?: unknown) => void;
}

// ---------------------------------------------------------------------------
// Sandbox message protocol
// ---------------------------------------------------------------------------

/** Messages sent FROM host TO sandbox iframe. */
export type SandboxInboundMessage =
  | {
      type: 'RENDER';
      componentId: OverridableComponentId;
      compiledCode: string;
      props: unknown;
      ctx: ComponentSdkContext;
    }
  | { type: 'UPDATE_PROPS'; props: unknown }
  | { type: 'UPDATE_CTX'; ctx: ComponentSdkContext };

/** Messages sent FROM sandbox iframe TO host. */
export type SandboxOutboundMessage =
  | { type: 'READY' }
  | { type: 'RENDER_OK' }
  | { type: 'RENDER_ERROR'; error: string }
  | { type: 'SDK_EVENT'; event: string; payload: unknown };
