/**
 * Built-in theme definitions for the Notesaner theme system.
 *
 * Each theme maps CSS custom property names (without the --ns- prefix) to values.
 * The ThemeProvider applies these as CSS variables on document.documentElement.
 *
 * Built-in themes:
 *   - dark     : Catppuccin Mocha (default)
 *   - light    : Catppuccin Latte
 *   - system   : Resolved at runtime from prefers-color-scheme
 *
 * Community themes are loaded at runtime and follow the same shape.
 */

export type ThemeMode = 'dark' | 'light';

/**
 * A complete set of CSS custom property overrides for the --ns-color-* namespace.
 * Only color tokens are included; typography/spacing/radius are theme-invariant.
 */
export interface ThemeColors {
  // Backgrounds
  'color-background': string;
  'color-background-surface': string;
  'color-background-elevated': string;
  'color-background-overlay': string;
  'color-background-input': string;
  'color-background-hover': string;
  'color-background-active': string;

  // Foreground / Text
  'color-foreground': string;
  'color-foreground-secondary': string;
  'color-foreground-muted': string;
  'color-foreground-inverse': string;

  // Primary
  'color-primary': string;
  'color-primary-hover': string;
  'color-primary-active': string;
  'color-primary-muted': string;
  'color-primary-foreground': string;

  // Secondary
  'color-secondary': string;
  'color-secondary-hover': string;
  'color-secondary-foreground': string;

  // Accent
  'color-accent': string;
  'color-accent-hover': string;
  'color-accent-muted': string;
  'color-accent-foreground': string;

  // Muted
  'color-muted': string;
  'color-muted-foreground': string;

  // Destructive
  'color-destructive': string;
  'color-destructive-hover': string;
  'color-destructive-muted': string;
  'color-destructive-foreground': string;

  // Semantic Status
  'color-success': string;
  'color-success-muted': string;
  'color-warning': string;
  'color-warning-muted': string;
  'color-error': string;
  'color-error-muted': string;
  'color-info': string;
  'color-info-muted': string;

  // Borders
  'color-border': string;
  'color-border-subtle': string;

  // Input / Ring
  'color-input': string;
  'color-ring': string;

  // Card
  'color-card': string;
  'color-card-foreground': string;

  // Popover
  'color-popover': string;
  'color-popover-foreground': string;

  // Sidebar
  'color-sidebar-background': string;
  'color-sidebar-foreground': string;
  'color-sidebar-border': string;
  'color-sidebar-accent': string;
  'color-sidebar-accent-foreground': string;
  'color-sidebar-muted': string;
  'color-sidebar-ring': string;

  // Extended Catppuccin palette (used for graphs, cursors, tags)
  'color-rosewater': string;
  'color-flamingo': string;
  'color-pink': string;
  'color-mauve': string;
  'color-red': string;
  'color-maroon': string;
  'color-peach': string;
  'color-yellow': string;
  'color-green': string;
  'color-teal': string;
  'color-sky': string;
  'color-sapphire': string;
  'color-blue': string;
  'color-lavender': string;

  // Charts
  'color-chart-1': string;
  'color-chart-2': string;
  'color-chart-3': string;
  'color-chart-4': string;
  'color-chart-5': string;
}

/**
 * A complete theme definition.
 *
 * The `colors` map is applied as CSS custom properties on <html> via
 * `document.documentElement.style.setProperty('--ns-{key}', value)`.
 *
 * `isDark` controls the CSS `color-scheme` property on <html> so the
 * browser renders native elements (scrollbars, date pickers) correctly.
 */
export interface Theme {
  /** Unique identifier, also used as the data-theme attribute value */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Author attribution (for community themes) */
  author?: string;
  /** Whether this is a dark color scheme */
  isDark: boolean;
  /** Full color token map */
  colors: ThemeColors;
}

// ---------------------------------------------------------------------------
// Built-in: Catppuccin Mocha (Dark)
// ---------------------------------------------------------------------------

export const themeDark: Theme = {
  id: 'dark',
  name: 'Dark (Catppuccin Mocha)',
  isDark: true,
  colors: {
    'color-background': '#1e1e2e',
    'color-background-surface': '#252537',
    'color-background-elevated': '#2d2d44',
    'color-background-overlay': '#36365a',
    'color-background-input': '#1a1a2e',
    'color-background-hover': 'rgba(255, 255, 255, 0.05)',
    'color-background-active': 'rgba(255, 255, 255, 0.09)',

    'color-foreground': '#cdd6f4',
    'color-foreground-secondary': '#a6adc8',
    'color-foreground-muted': '#6c7086',
    'color-foreground-inverse': '#1e1e2e',

    'color-primary': '#cba6f7',
    'color-primary-hover': '#b98ef5',
    'color-primary-active': '#a876f3',
    'color-primary-muted': 'rgba(203, 166, 247, 0.15)',
    'color-primary-foreground': '#1e1e2e',

    'color-secondary': '#45475a',
    'color-secondary-hover': '#525466',
    'color-secondary-foreground': '#cdd6f4',

    'color-accent': '#f5c2e7',
    'color-accent-hover': '#f0b0dd',
    'color-accent-muted': 'rgba(245, 194, 231, 0.15)',
    'color-accent-foreground': '#1e1e2e',

    'color-muted': '#45475a',
    'color-muted-foreground': '#a6adc8',

    'color-destructive': '#f38ba8',
    'color-destructive-hover': '#f07090',
    'color-destructive-muted': 'rgba(243, 139, 168, 0.15)',
    'color-destructive-foreground': '#1e1e2e',

    'color-success': '#a6e3a1',
    'color-success-muted': 'rgba(166, 227, 161, 0.15)',
    'color-warning': '#fab387',
    'color-warning-muted': 'rgba(250, 179, 135, 0.15)',
    'color-error': '#f38ba8',
    'color-error-muted': 'rgba(243, 139, 168, 0.15)',
    'color-info': '#89dceb',
    'color-info-muted': 'rgba(137, 220, 235, 0.15)',

    'color-border': '#45475a',
    'color-border-subtle': 'rgba(255, 255, 255, 0.08)',

    'color-input': '#45475a',
    'color-ring': '#cba6f7',

    'color-card': '#313244',
    'color-card-foreground': '#cdd6f4',

    'color-popover': '#313244',
    'color-popover-foreground': '#cdd6f4',

    'color-sidebar-background': '#181825',
    'color-sidebar-foreground': '#cdd6f4',
    'color-sidebar-border': '#313244',
    'color-sidebar-accent': '#45475a',
    'color-sidebar-accent-foreground': '#cdd6f4',
    'color-sidebar-muted': '#a6adc8',
    'color-sidebar-ring': '#cba6f7',

    'color-rosewater': '#f5e0dc',
    'color-flamingo': '#f2cdcd',
    'color-pink': '#f5c2e7',
    'color-mauve': '#cba6f7',
    'color-red': '#f38ba8',
    'color-maroon': '#eba0ac',
    'color-peach': '#fab387',
    'color-yellow': '#f9e2af',
    'color-green': '#a6e3a1',
    'color-teal': '#94e2d5',
    'color-sky': '#89dceb',
    'color-sapphire': '#74c7ec',
    'color-blue': '#89b4fa',
    'color-lavender': '#b4befe',

    'color-chart-1': '#cba6f7',
    'color-chart-2': '#89b4fa',
    'color-chart-3': '#a6e3a1',
    'color-chart-4': '#fab387',
    'color-chart-5': '#f38ba8',
  },
};

// ---------------------------------------------------------------------------
// Built-in: Catppuccin Latte (Light)
// ---------------------------------------------------------------------------

export const themeLight: Theme = {
  id: 'light',
  name: 'Light (Catppuccin Latte)',
  isDark: false,
  colors: {
    'color-background': '#eff1f5',
    'color-background-surface': '#e6e9ef',
    'color-background-elevated': '#ffffff',
    'color-background-overlay': '#ffffff',
    'color-background-input': '#ffffff',
    'color-background-hover': 'rgba(0, 0, 0, 0.04)',
    'color-background-active': 'rgba(0, 0, 0, 0.08)',

    'color-foreground': '#4c4f69',
    'color-foreground-secondary': '#5c5f77',
    'color-foreground-muted': '#6c6f85',
    'color-foreground-inverse': '#ffffff',

    'color-primary': '#8839ef',
    'color-primary-hover': '#7528e0',
    'color-primary-active': '#6520c7',
    'color-primary-muted': 'rgba(136, 57, 239, 0.1)',
    'color-primary-foreground': '#ffffff',

    'color-secondary': '#e6e9ef',
    'color-secondary-hover': '#dce0e8',
    'color-secondary-foreground': '#4c4f69',

    'color-accent': '#ea76cb',
    'color-accent-hover': '#e560c0',
    'color-accent-muted': 'rgba(234, 118, 203, 0.1)',
    'color-accent-foreground': '#ffffff',

    'color-muted': '#e6e9ef',
    'color-muted-foreground': '#6c6f85',

    'color-destructive': '#d20f39',
    'color-destructive-hover': '#b80d32',
    'color-destructive-muted': 'rgba(210, 15, 57, 0.1)',
    'color-destructive-foreground': '#ffffff',

    'color-success': '#40a02b',
    'color-success-muted': 'rgba(64, 160, 43, 0.1)',
    'color-warning': '#fe640b',
    'color-warning-muted': 'rgba(254, 100, 11, 0.1)',
    'color-error': '#d20f39',
    'color-error-muted': 'rgba(210, 15, 57, 0.1)',
    'color-info': '#04a5e5',
    'color-info-muted': 'rgba(4, 165, 229, 0.1)',

    'color-border': '#ccd0da',
    'color-border-subtle': 'rgba(0, 0, 0, 0.06)',

    'color-input': '#ccd0da',
    'color-ring': '#8839ef',

    'color-card': '#ffffff',
    'color-card-foreground': '#4c4f69',

    'color-popover': '#ffffff',
    'color-popover-foreground': '#4c4f69',

    'color-sidebar-background': '#dce0e8',
    'color-sidebar-foreground': '#4c4f69',
    'color-sidebar-border': '#ccd0da',
    'color-sidebar-accent': '#e6e9ef',
    'color-sidebar-accent-foreground': '#4c4f69',
    'color-sidebar-muted': '#6c6f85',
    'color-sidebar-ring': '#8839ef',

    'color-rosewater': '#dc8a78',
    'color-flamingo': '#dd7878',
    'color-pink': '#ea76cb',
    'color-mauve': '#8839ef',
    'color-red': '#d20f39',
    'color-maroon': '#e64553',
    'color-peach': '#fe640b',
    'color-yellow': '#df8e1d',
    'color-green': '#40a02b',
    'color-teal': '#179299',
    'color-sky': '#04a5e5',
    'color-sapphire': '#209fb5',
    'color-blue': '#1e66f5',
    'color-lavender': '#7287fd',

    'color-chart-1': '#8839ef',
    'color-chart-2': '#1e66f5',
    'color-chart-3': '#40a02b',
    'color-chart-4': '#fe640b',
    'color-chart-5': '#d20f39',
  },
};

// ---------------------------------------------------------------------------
// Built-in: Ayu Dark
// ---------------------------------------------------------------------------

export const themeAyuDark: Theme = {
  id: 'ayu-dark',
  name: 'Ayu Dark',
  isDark: true,
  colors: {
    'color-background': '#0f1419',
    'color-background-surface': '#1a1f29',
    'color-background-elevated': '#222832',
    'color-background-overlay': '#2a3040',
    'color-background-input': '#0d1117',
    'color-background-hover': 'rgba(255, 255, 255, 0.05)',
    'color-background-active': 'rgba(255, 255, 255, 0.09)',

    'color-foreground': '#e6e1cf',
    'color-foreground-secondary': '#b3b1ad',
    'color-foreground-muted': '#5c6773',
    'color-foreground-inverse': '#0f1419',

    'color-primary': '#ffb454',
    'color-primary-hover': '#ffa333',
    'color-primary-active': '#ff9011',
    'color-primary-muted': 'rgba(255, 180, 84, 0.15)',
    'color-primary-foreground': '#0f1419',

    'color-secondary': '#1f2430',
    'color-secondary-hover': '#252b38',
    'color-secondary-foreground': '#e6e1cf',

    'color-accent': '#73d0ff',
    'color-accent-hover': '#50c8ff',
    'color-accent-muted': 'rgba(115, 208, 255, 0.15)',
    'color-accent-foreground': '#0f1419',

    'color-muted': '#1f2430',
    'color-muted-foreground': '#5c6773',

    'color-destructive': '#ff3333',
    'color-destructive-hover': '#e60000',
    'color-destructive-muted': 'rgba(255, 51, 51, 0.15)',
    'color-destructive-foreground': '#ffffff',

    'color-success': '#aad94c',
    'color-success-muted': 'rgba(170, 217, 76, 0.15)',
    'color-warning': '#ffb454',
    'color-warning-muted': 'rgba(255, 180, 84, 0.15)',
    'color-error': '#ff3333',
    'color-error-muted': 'rgba(255, 51, 51, 0.15)',
    'color-info': '#73d0ff',
    'color-info-muted': 'rgba(115, 208, 255, 0.15)',

    'color-border': '#2d3640',
    'color-border-subtle': 'rgba(255, 255, 255, 0.06)',

    'color-input': '#2d3640',
    'color-ring': '#ffb454',

    'color-card': '#1a1f29',
    'color-card-foreground': '#e6e1cf',

    'color-popover': '#1a1f29',
    'color-popover-foreground': '#e6e1cf',

    'color-sidebar-background': '#0d1117',
    'color-sidebar-foreground': '#e6e1cf',
    'color-sidebar-border': '#1a1f29',
    'color-sidebar-accent': '#1f2430',
    'color-sidebar-accent-foreground': '#e6e1cf',
    'color-sidebar-muted': '#5c6773',
    'color-sidebar-ring': '#ffb454',

    'color-rosewater': '#ffd580',
    'color-flamingo': '#f07178',
    'color-pink': '#ff79c6',
    'color-mauve': '#c792ea',
    'color-red': '#ff3333',
    'color-maroon': '#f07178',
    'color-peach': '#ffb454',
    'color-yellow': '#ffd580',
    'color-green': '#aad94c',
    'color-teal': '#95e6cb',
    'color-sky': '#73d0ff',
    'color-sapphire': '#36a3d9',
    'color-blue': '#73d0ff',
    'color-lavender': '#c792ea',

    'color-chart-1': '#ffb454',
    'color-chart-2': '#73d0ff',
    'color-chart-3': '#aad94c',
    'color-chart-4': '#f07178',
    'color-chart-5': '#c792ea',
  },
};

// ---------------------------------------------------------------------------
// Built-in: Nord
// ---------------------------------------------------------------------------

export const themeNord: Theme = {
  id: 'nord',
  name: 'Nord',
  isDark: true,
  colors: {
    'color-background': '#2e3440',
    'color-background-surface': '#3b4252',
    'color-background-elevated': '#434c5e',
    'color-background-overlay': '#4c566a',
    'color-background-input': '#2b3042',
    'color-background-hover': 'rgba(255, 255, 255, 0.05)',
    'color-background-active': 'rgba(255, 255, 255, 0.09)',

    'color-foreground': '#eceff4',
    'color-foreground-secondary': '#d8dee9',
    'color-foreground-muted': '#a1acbe',
    'color-foreground-inverse': '#2e3440',

    'color-primary': '#88c0d0',
    'color-primary-hover': '#7ab0c0',
    'color-primary-active': '#6ca0b0',
    'color-primary-muted': 'rgba(136, 192, 208, 0.15)',
    'color-primary-foreground': '#2e3440',

    'color-secondary': '#3b4252',
    'color-secondary-hover': '#434c5e',
    'color-secondary-foreground': '#eceff4',

    'color-accent': '#b48ead',
    'color-accent-hover': '#a47e9d',
    'color-accent-muted': 'rgba(180, 142, 173, 0.15)',
    'color-accent-foreground': '#2e3440',

    'color-muted': '#3b4252',
    'color-muted-foreground': '#a1acbe',

    'color-destructive': '#bf616a',
    'color-destructive-hover': '#af515a',
    'color-destructive-muted': 'rgba(191, 97, 106, 0.15)',
    'color-destructive-foreground': '#eceff4',

    'color-success': '#a3be8c',
    'color-success-muted': 'rgba(163, 190, 140, 0.15)',
    'color-warning': '#ebcb8b',
    'color-warning-muted': 'rgba(235, 203, 139, 0.15)',
    'color-error': '#bf616a',
    'color-error-muted': 'rgba(191, 97, 106, 0.15)',
    'color-info': '#81a1c1',
    'color-info-muted': 'rgba(129, 161, 193, 0.15)',

    'color-border': '#4c566a',
    'color-border-subtle': 'rgba(255, 255, 255, 0.07)',

    'color-input': '#4c566a',
    'color-ring': '#88c0d0',

    'color-card': '#3b4252',
    'color-card-foreground': '#eceff4',

    'color-popover': '#3b4252',
    'color-popover-foreground': '#eceff4',

    'color-sidebar-background': '#242933',
    'color-sidebar-foreground': '#eceff4',
    'color-sidebar-border': '#3b4252',
    'color-sidebar-accent': '#434c5e',
    'color-sidebar-accent-foreground': '#eceff4',
    'color-sidebar-muted': '#a1acbe',
    'color-sidebar-ring': '#88c0d0',

    'color-rosewater': '#eceff4',
    'color-flamingo': '#bf616a',
    'color-pink': '#b48ead',
    'color-mauve': '#b48ead',
    'color-red': '#bf616a',
    'color-maroon': '#bf616a',
    'color-peach': '#d08770',
    'color-yellow': '#ebcb8b',
    'color-green': '#a3be8c',
    'color-teal': '#8fbcbb',
    'color-sky': '#88c0d0',
    'color-sapphire': '#81a1c1',
    'color-blue': '#5e81ac',
    'color-lavender': '#b48ead',

    'color-chart-1': '#88c0d0',
    'color-chart-2': '#81a1c1',
    'color-chart-3': '#a3be8c',
    'color-chart-4': '#ebcb8b',
    'color-chart-5': '#bf616a',
  },
};

// ---------------------------------------------------------------------------
// Built-in: Solarized Dark
// ---------------------------------------------------------------------------

export const themeSolarizedDark: Theme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  isDark: true,
  colors: {
    'color-background': '#002b36',
    'color-background-surface': '#073642',
    'color-background-elevated': '#0a4050',
    'color-background-overlay': '#0d4d5e',
    'color-background-input': '#00232d',
    'color-background-hover': 'rgba(255, 255, 255, 0.05)',
    'color-background-active': 'rgba(255, 255, 255, 0.09)',

    'color-foreground': '#839496',
    'color-foreground-secondary': '#93a1a1',
    'color-foreground-muted': '#586e75',
    'color-foreground-inverse': '#002b36',

    'color-primary': '#268bd2',
    'color-primary-hover': '#1a7abf',
    'color-primary-active': '#1569a8',
    'color-primary-muted': 'rgba(38, 139, 210, 0.15)',
    'color-primary-foreground': '#fdf6e3',

    'color-secondary': '#073642',
    'color-secondary-hover': '#0a4050',
    'color-secondary-foreground': '#839496',

    'color-accent': '#2aa198',
    'color-accent-hover': '#238e87',
    'color-accent-muted': 'rgba(42, 161, 152, 0.15)',
    'color-accent-foreground': '#fdf6e3',

    'color-muted': '#073642',
    'color-muted-foreground': '#586e75',

    'color-destructive': '#dc322f',
    'color-destructive-hover': '#c72926',
    'color-destructive-muted': 'rgba(220, 50, 47, 0.15)',
    'color-destructive-foreground': '#fdf6e3',

    'color-success': '#859900',
    'color-success-muted': 'rgba(133, 153, 0, 0.15)',
    'color-warning': '#cb4b16',
    'color-warning-muted': 'rgba(203, 75, 22, 0.15)',
    'color-error': '#dc322f',
    'color-error-muted': 'rgba(220, 50, 47, 0.15)',
    'color-info': '#268bd2',
    'color-info-muted': 'rgba(38, 139, 210, 0.15)',

    'color-border': '#073642',
    'color-border-subtle': 'rgba(255, 255, 255, 0.06)',

    'color-input': '#073642',
    'color-ring': '#268bd2',

    'color-card': '#073642',
    'color-card-foreground': '#839496',

    'color-popover': '#073642',
    'color-popover-foreground': '#839496',

    'color-sidebar-background': '#00222b',
    'color-sidebar-foreground': '#839496',
    'color-sidebar-border': '#073642',
    'color-sidebar-accent': '#0a4050',
    'color-sidebar-accent-foreground': '#93a1a1',
    'color-sidebar-muted': '#586e75',
    'color-sidebar-ring': '#268bd2',

    'color-rosewater': '#eee8d5',
    'color-flamingo': '#dc322f',
    'color-pink': '#d33682',
    'color-mauve': '#6c71c4',
    'color-red': '#dc322f',
    'color-maroon': '#cb4b16',
    'color-peach': '#cb4b16',
    'color-yellow': '#b58900',
    'color-green': '#859900',
    'color-teal': '#2aa198',
    'color-sky': '#268bd2',
    'color-sapphire': '#268bd2',
    'color-blue': '#268bd2',
    'color-lavender': '#6c71c4',

    'color-chart-1': '#268bd2',
    'color-chart-2': '#2aa198',
    'color-chart-3': '#859900',
    'color-chart-4': '#b58900',
    'color-chart-5': '#dc322f',
  },
};

// ---------------------------------------------------------------------------
// Built-in: Dracula
// ---------------------------------------------------------------------------

export const themeDracula: Theme = {
  id: 'dracula',
  name: 'Dracula',
  isDark: true,
  colors: {
    'color-background': '#282a36',
    'color-background-surface': '#2d303e',
    'color-background-elevated': '#343746',
    'color-background-overlay': '#3b3e50',
    'color-background-input': '#22242e',
    'color-background-hover': 'rgba(255, 255, 255, 0.05)',
    'color-background-active': 'rgba(255, 255, 255, 0.09)',

    'color-foreground': '#f8f8f2',
    'color-foreground-secondary': '#bfbfb6',
    'color-foreground-muted': '#6272a4',
    'color-foreground-inverse': '#282a36',

    'color-primary': '#bd93f9',
    'color-primary-hover': '#a87cf5',
    'color-primary-active': '#9465f1',
    'color-primary-muted': 'rgba(189, 147, 249, 0.15)',
    'color-primary-foreground': '#282a36',

    'color-secondary': '#44475a',
    'color-secondary-hover': '#515468',
    'color-secondary-foreground': '#f8f8f2',

    'color-accent': '#ff79c6',
    'color-accent-hover': '#ff5cb7',
    'color-accent-muted': 'rgba(255, 121, 198, 0.15)',
    'color-accent-foreground': '#282a36',

    'color-muted': '#44475a',
    'color-muted-foreground': '#6272a4',

    'color-destructive': '#ff5555',
    'color-destructive-hover': '#ff3838',
    'color-destructive-muted': 'rgba(255, 85, 85, 0.15)',
    'color-destructive-foreground': '#282a36',

    'color-success': '#50fa7b',
    'color-success-muted': 'rgba(80, 250, 123, 0.15)',
    'color-warning': '#ffb86c',
    'color-warning-muted': 'rgba(255, 184, 108, 0.15)',
    'color-error': '#ff5555',
    'color-error-muted': 'rgba(255, 85, 85, 0.15)',
    'color-info': '#8be9fd',
    'color-info-muted': 'rgba(139, 233, 253, 0.15)',

    'color-border': '#44475a',
    'color-border-subtle': 'rgba(255, 255, 255, 0.08)',

    'color-input': '#44475a',
    'color-ring': '#bd93f9',

    'color-card': '#313342',
    'color-card-foreground': '#f8f8f2',

    'color-popover': '#313342',
    'color-popover-foreground': '#f8f8f2',

    'color-sidebar-background': '#21222c',
    'color-sidebar-foreground': '#f8f8f2',
    'color-sidebar-border': '#313342',
    'color-sidebar-accent': '#44475a',
    'color-sidebar-accent-foreground': '#f8f8f2',
    'color-sidebar-muted': '#6272a4',
    'color-sidebar-ring': '#bd93f9',

    'color-rosewater': '#f8f8f2',
    'color-flamingo': '#ff5555',
    'color-pink': '#ff79c6',
    'color-mauve': '#bd93f9',
    'color-red': '#ff5555',
    'color-maroon': '#ff6e6e',
    'color-peach': '#ffb86c',
    'color-yellow': '#f1fa8c',
    'color-green': '#50fa7b',
    'color-teal': '#8be9fd',
    'color-sky': '#8be9fd',
    'color-sapphire': '#6272a4',
    'color-blue': '#6272a4',
    'color-lavender': '#bd93f9',

    'color-chart-1': '#bd93f9',
    'color-chart-2': '#8be9fd',
    'color-chart-3': '#50fa7b',
    'color-chart-4': '#ffb86c',
    'color-chart-5': '#ff5555',
  },
};

// ---------------------------------------------------------------------------
// Registry of all built-in themes
// ---------------------------------------------------------------------------

export const BUILT_IN_THEMES: Theme[] = [
  themeDark,
  themeLight,
  themeAyuDark,
  themeNord,
  themeSolarizedDark,
  themeDracula,
];

/** Preference key in localStorage */
export const THEME_STORAGE_KEY = 'notesaner-theme';
/** Custom CSS snippet key in localStorage */
export const CUSTOM_CSS_STORAGE_KEY = 'notesaner-custom-css';
/** Community themes key in localStorage */
export const COMMUNITY_THEMES_STORAGE_KEY = 'notesaner-community-themes';

/** Valid theme preference values */
export type ThemePreference = 'dark' | 'light' | 'system' | string;

/**
 * A community theme as downloaded from a JSON URL.
 * Follows the same shape as Theme but includes the source URL.
 */
export interface CommunityTheme extends Theme {
  sourceUrl: string;
  downloadedAt: string;
}
