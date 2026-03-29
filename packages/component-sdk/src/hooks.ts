/**
 * Component SDK — React hooks for consuming overrides at runtime.
 *
 * These hooks are used by the host app to check whether an override exists
 * and to retrieve the compiled JS for sandbox execution.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  OverridableComponentId,
  SandboxInboundMessage,
  SandboxOutboundMessage,
  ComponentSdkContext,
} from './types';

// ---------------------------------------------------------------------------
// useOverrideSandbox
// ---------------------------------------------------------------------------

export interface OverrideSandboxOptions {
  compiledCode: string;
  componentId: OverridableComponentId;
  props: unknown;
  ctx: ComponentSdkContext;
  onEvent?: (event: string, payload: unknown) => void;
  onError?: (error: string) => void;
}

export interface OverrideSandboxReturn {
  /** Ref to attach to the host <iframe> element. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Whether the sandbox has signalled READY. */
  isReady: boolean;
  /** Last render error from the sandbox. */
  renderError: string | null;
  /** Send updated props to the running sandbox. */
  updateProps: (props: unknown) => void;
}

/**
 * Manages a sandboxed iframe that renders a compiled component override.
 *
 * The sandbox HTML (served at /sandbox/component-override.html) listens for
 * postMessage instructions and renders the component via React + ReactDOM.
 */
export function useOverrideSandbox(options: OverrideSandboxOptions): OverrideSandboxReturn {
  const { compiledCode, componentId, props, ctx, onEvent, onError } = options;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Track latest values in refs to avoid re-subscribing the message listener.
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  const send = useCallback((msg: SandboxInboundMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  // Listen for messages from the sandbox.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from our own iframe origin.
      if (event.source !== iframeRef.current?.contentWindow) return;

      const msg = event.data as SandboxOutboundMessage;
      switch (msg.type) {
        case 'READY':
          setIsReady(true);
          // Trigger initial render.
          send({ type: 'RENDER', componentId, compiledCode, props, ctx });
          break;
        case 'RENDER_OK':
          setRenderError(null);
          break;
        case 'RENDER_ERROR':
          setRenderError(msg.error);
          onErrorRef.current?.(msg.error);
          break;
        case 'SDK_EVENT':
          onEventRef.current?.(msg.event, msg.payload);
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [compiledCode, componentId, props, ctx, send]);

  const updateProps = useCallback(
    (nextProps: unknown) => {
      if (isReady) send({ type: 'UPDATE_PROPS', props: nextProps });
    },
    [isReady, send],
  );

  return { iframeRef, isReady, renderError, updateProps };
}
