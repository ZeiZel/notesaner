'use client';

import {
  forwardRef,
  type ComponentPropsWithRef,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Props for the polymorphic Box component.
 *
 * @typeParam T - The element type to render as. Defaults to `'div'`.
 *
 * The `as` prop controls which HTML element (or React component) is rendered.
 * All native props of the chosen element are forwarded with full type inference:
 *
 * ```tsx
 * <Box as="a" href="/home">Link</Box>        // href is valid
 * <Box as="button" type="submit">Go</Box>     // type is valid
 * <Box as="input" value="hi" onChange={fn} />  // input props are valid
 * ```
 */
export type BoxProps<T extends ElementType = 'div'> = {
  /** The HTML element or React component to render. Defaults to `'div'`. */
  as?: T;
  /** Additional CSS class names, merged via `cn()`. */
  className?: string;
  /** React children. */
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className' | 'children'>;

// --------------------------------------------------------------------------
// Implementation
// --------------------------------------------------------------------------

/**
 * A polymorphic layout primitive that renders any HTML element (or React
 * component) while forwarding refs and merging class names via `cn()`.
 *
 * **Default element**: `<div>`
 *
 * @example
 * ```tsx
 * // Renders a <div>
 * <Box className="p-4">content</Box>
 *
 * // Renders a <section>
 * <Box as="section" className="my-8">section</Box>
 *
 * // Renders an <a> with full anchor props
 * <Box as="a" href="/about" target="_blank">About</Box>
 *
 * // Ref is forwarded to the underlying element
 * const ref = useRef<HTMLButtonElement>(null);
 * <Box as="button" ref={ref} onClick={handleClick}>Click</Box>
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Necessary for polymorphic ref forwarding; the outer type signature enforces safety.
const BoxInner = forwardRef<any, BoxProps & { as?: ElementType }>(
  ({ as, className, children, ...rest }, ref) => {
    const Component: ElementType = as ?? 'div';

    return (
      <Component ref={ref} className={cn(className)} {...rest}>
        {children}
      </Component>
    );
  },
);

BoxInner.displayName = 'Box';

/**
 * The polymorphic Box component.
 *
 * We export a cast version so that callers get full generic inference on
 * the `as` prop (e.g. `<Box as="a" href="...">` correctly types `href`).
 *
 * The cast is necessary because React's `forwardRef` does not natively
 * preserve outer generics; this is the standard community pattern.
 */
export const Box = BoxInner as <T extends ElementType = 'div'>(
  props: BoxProps<T> & {
    ref?: Ref<ComponentPropsWithRef<T> extends { ref?: Ref<infer R> } ? R : never>;
  },
) => ReactNode;
