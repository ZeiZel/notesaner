/**
 * webgl-utils.ts — Shared WebGL helpers for the graph renderer.
 *
 * Provides:
 * - Shader compilation and program linking
 * - Buffer creation and management helpers
 * - WebGL context capability detection
 * - Color hex-to-float-array conversion
 */

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

/**
 * Returns true when WebGL 2 (or WebGL 1 as fallback) is available.
 * Uses a throw-away canvas to probe the browser.
 */
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/**
 * Acquires a WebGL2 context from a canvas element.
 * Falls back to WebGL1 when WebGL2 is unavailable.
 * Returns null if WebGL is unsupported.
 */
export function getWebGLContext(
  canvas: HTMLCanvasElement,
  options?: WebGLContextAttributes,
): WebGL2RenderingContext | WebGLRenderingContext | null {
  const attrs: WebGLContextAttributes = {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    ...options,
  };

  return (
    (canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null) ??
    (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null) ??
    (canvas.getContext('experimental-webgl', attrs) as WebGLRenderingContext | null)
  );
}

// ---------------------------------------------------------------------------
// Shader utilities
// ---------------------------------------------------------------------------

/**
 * Compiles a single GLSL shader stage.
 * Throws a descriptive error if compilation fails.
 */
export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader object');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'unknown error';
    gl.deleteShader(shader);
    const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`WebGL ${typeName} shader compile error: ${info}`);
  }

  return shader;
}

/**
 * Links a vertex and fragment shader into a program.
 * Throws a descriptive error if linking fails.
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create WebGL program');

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'unknown error';
    gl.deleteProgram(program);
    throw new Error(`WebGL program link error: ${info}`);
  }

  return program;
}

// ---------------------------------------------------------------------------
// Buffer utilities
// ---------------------------------------------------------------------------

/**
 * Creates a WebGL buffer and uploads float data to it.
 */
export function createFloatBuffer(
  gl: WebGLRenderingContext,
  data: Float32Array,
  usage: number = WebGLRenderingContext.DYNAMIC_DRAW,
): WebGLBuffer {
  const buf = gl.createBuffer();
  if (!buf) throw new Error('Failed to create WebGL buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  return buf;
}

/**
 * Updates an existing float buffer with new data (avoids re-allocation).
 */
export function updateFloatBuffer(
  gl: WebGLRenderingContext,
  buf: WebGLBuffer,
  data: Float32Array,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/** Cache for parsed hex colors. */
const hexColorCache = new Map<string, [number, number, number]>();

/**
 * Parses a CSS hex color ("#rrggbb" or "#rgb") to normalized [r, g, b] floats.
 * Returns [0.58, 0.64, 0.73] (slate-400 fallback) for unrecognised values.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const cached = hexColorCache.get(hex);
  if (cached) return cached;

  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return [0.58, 0.64, 0.73];

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const result: [number, number, number] = [r, g, b];
  hexColorCache.set(hex, result);
  return result;
}

// ---------------------------------------------------------------------------
// Node GLSL shaders — circle instancing
// ---------------------------------------------------------------------------

/**
 * Vertex shader for nodes.
 *
 * Renders a screen-space quad (two triangles) per node.
 * aPosition: quad vertex offset (-1..1 in both axes)
 * aNodePos: world-space node center (x, y)
 * aRadius: node radius in world units
 * aColor: RGB color
 * uTransform: [scaleX, scaleY, translateX, translateY] (zoom+pan matrix)
 * uResolution: canvas [width, height]
 */
export const NODE_VERT_SHADER = /* glsl */ `
  precision mediump float;

  attribute vec2 aPosition;   // quad corner offset
  attribute vec2 aNodePos;    // node world position
  attribute float aRadius;    // node radius
  attribute vec3 aColor;      // node color (rgb)

  uniform vec4 uTransform;    // [scaleX, scaleY, txX, txY]
  uniform vec2 uResolution;

  varying vec2 vOffset;       // offset passed to fragment for circle SDF
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vOffset = aPosition;

    // Apply zoom/pan: world -> screen
    vec2 screenPos = (aNodePos * uTransform.xy + uTransform.zw);
    float screenRadius = aRadius * uTransform.x;

    // Quad corner in screen space
    vec2 corner = screenPos + aPosition * (screenRadius + 2.0);

    // NDC
    vec2 ndc = (corner / uResolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;

    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

/**
 * Fragment shader for nodes.
 *
 * Uses a signed-distance field circle with soft antialiasing edges.
 * Supports:
 * - Base fill color
 * - Stroke ring (dark border)
 * - Highlighted ring (amber #f59e0b when uHighlight > 0.5)
 * - Opacity via uOpacity
 */
export const NODE_FRAG_SHADER = /* glsl */ `
  precision mediump float;

  varying vec2 vOffset;
  varying vec3 vColor;

  uniform float uOpacity;
  uniform float uHighlight;   // 1.0 = show amber ring, 0.0 = normal
  uniform float uHovered;     // 1.0 = this node is hovered

  void main() {
    float dist = length(vOffset);

    // Smooth antialiased circle edge
    float alpha = 1.0 - smoothstep(0.88, 1.0, dist);
    if (alpha < 0.01) discard;

    // Stroke: dark ring just inside edge
    float strokeStart = 0.78;
    float strokeAlpha = smoothstep(strokeStart - 0.06, strokeStart, dist);

    vec3 color = vColor;

    // Highlight ring: amber
    if (uHighlight > 0.5) {
      float highlightAlpha = smoothstep(0.65, 0.72, dist) * (1.0 - smoothstep(0.85, 0.95, dist));
      color = mix(color, vec3(0.961, 0.620, 0.043), highlightAlpha);
    }

    // Stroke blended on top
    color = mix(color, vec3(0.059, 0.09, 0.161), strokeAlpha * 0.7);

    // Hover glow: brighten slightly
    if (uHovered > 0.5) {
      color = min(color * 1.25, vec3(1.0));
    }

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

// ---------------------------------------------------------------------------
// Edge GLSL shaders — lines
// ---------------------------------------------------------------------------

/**
 * Vertex shader for edges.
 * Renders simple lines; endpoint positions are passed as attributes.
 */
export const EDGE_VERT_SHADER = /* glsl */ `
  precision mediump float;

  attribute vec2 aPos;        // endpoint world position
  attribute vec3 aColor;      // edge color
  attribute float aOpacity;   // per-edge opacity

  uniform vec4 uTransform;
  uniform vec2 uResolution;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vColor = aColor;
    vOpacity = aOpacity;

    vec2 screen = aPos * uTransform.xy + uTransform.zw;
    vec2 ndc = (screen / uResolution) * 2.0 - 1.0;
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.0, 1.0);
  }
`;

export const EDGE_FRAG_SHADER = /* glsl */ `
  precision mediump float;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`;
