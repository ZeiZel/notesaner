/**
 * Generates Monaco TypeScript type definitions for the override editor.
 *
 * Injected as extra libraries so that admins get IntelliSense for:
 *   - React (basic JSX types)
 *   - ComponentSdkContext
 *   - The specific component's props interface
 */

import type { OverridableComponentMeta } from '@notesaner/component-sdk';

/**
 * Build the extra type declaration content to inject into the Monaco model.
 */
export function buildTypeDefinitions(meta: OverridableComponentMeta): string {
  const propsInterface = buildPropsInterface(meta);

  return `
// ── React ────────────────────────────────────────────────────────────────────
declare namespace React {
  type ReactNode = React.ReactElement | string | number | boolean | null | undefined;
  interface ReactElement { type: any; props: any; key: any; }
  function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  const Fragment: symbol;
  function useState<T>(init: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void];
  function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  function useRef<T>(init?: T): { current: T };
  function useMemo<T>(fn: () => T, deps: readonly unknown[]): T;
}
declare function require(id: string): any;

// ── Component SDK context ────────────────────────────────────────────────────
interface ComponentSdkContext {
  workspaceSlug: string;
  colorScheme: 'light' | 'dark';
  emit: (event: string, payload?: unknown) => void;
}

// ── Component props ──────────────────────────────────────────────────────────
${propsInterface}

// ── Override entry point ─────────────────────────────────────────────────────
// Your default export must match this signature:
// export default function ${meta.id}(props: ${meta.id}Props & { sdk: ComponentSdkContext }): React.ReactElement | null
`;
}

function buildPropsInterface(meta: OverridableComponentMeta): string {
  const lines = meta.props.map((p) => {
    const optional = p.required ? '' : '?';
    const comment = p.description ? `  /** ${p.description} */\n` : '';
    return `${comment}  ${p.name}${optional}: ${p.type};`;
  });

  return `interface ${meta.id}Props {\n${lines.join('\n')}\n}`;
}
