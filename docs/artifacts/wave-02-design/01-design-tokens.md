# Notesaner Design Tokens Reference

**Version**: 1.0.0
**Created**: 2026-03-25
**Status**: Definitive
**Palette**: Catppuccin Mocha (dark) / Catppuccin Latte (light)
**Framework**: Next.js 15 + Tailwind CSS 4
**File**: `packages/ui/src/styles/tokens.css`

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography System](#3-typography-system)
4. [Spacing System](#4-spacing-system)
5. [Border Radius](#5-border-radius)
6. [Shadows](#6-shadows)
7. [Motion and Animation](#7-motion-and-animation)
8. [Layout Tokens](#8-layout-tokens)
9. [Z-Index Scale](#9-z-index-scale)
10. [Opacity Tokens](#10-opacity-tokens)
11. [Tailwind CSS Integration](#11-tailwind-css-integration)
12. [Usage Guidelines](#12-usage-guidelines)
13. [Accessibility](#13-accessibility)

---

## 1. Design Philosophy

### Dark-First

Notesaner is a knowledge workspace. Users spend hours in the editor, often in low-light environments. The dark theme is the default and primary design target. The light theme is a complete, first-class alternative, not an afterthought.

### Catppuccin Mocha Foundation

The color palette is built on Catppuccin Mocha, the most popular community theme across code editors and note-taking tools. This gives Notesaner immediate visual familiarity for users migrating from Obsidian, VS Code, or similar tools.

Key aesthetic choices:
- Deep navy/purple background (`#1e1e2e`) -- warmer than pure black, reduces eye strain
- Mauve/purple primary (`#cba6f7`) -- gives "knowledge tool" feel vs. code editor blue
- High contrast text (`#cdd6f4`) -- 7:1 ratio against base background (exceeds WCAG AAA)
- Pastel semantic colors -- less harsh than saturated alternatives

### Token Naming Convention

All CSS custom properties use the `--ns-` prefix (Notesaner) to prevent collisions with third-party libraries (TipTap, shadcn/ui, etc).

```
--ns-{category}-{property}[-{variant}]

Examples:
  --ns-color-primary
  --ns-color-primary-hover
  --ns-color-primary-foreground
  --ns-text-base
  --ns-space-4
  --ns-radius-md
  --ns-shadow-lg
```

---

## 2. Color System

### 2.1 Background Colors

Used for layering surfaces. Each level is progressively lighter to create visual depth.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-background` | `#1e1e2e` | `#eff1f5` | Main workspace background |
| `--ns-color-background-surface` | `#252537` | `#e6e9ef` | Sidebars, panels |
| `--ns-color-background-elevated` | `#2d2d44` | `#ffffff` | Cards, popovers |
| `--ns-color-background-overlay` | `#36365a` | `#ffffff` | Modals, dropdown menus |
| `--ns-color-background-input` | `#1a1a2e` | `#ffffff` | Form input fields |
| `--ns-color-background-hover` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.04)` | Hover highlight on items |
| `--ns-color-background-active` | `rgba(255,255,255,0.09)` | `rgba(0,0,0,0.08)` | Active/pressed highlight |

**Surface Elevation Model (Dark)**:
```
Layer 0: #1e1e2e  (workspace)
Layer 1: #252537  (sidebar, status bar)
Layer 2: #2d2d44  (card, floating panel)
Layer 3: #36365a  (modal, popover)
```

### 2.2 Foreground / Text Colors

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-foreground` | `#cdd6f4` | `#4c4f69` | Primary text, body content |
| `--ns-color-foreground-secondary` | `#a6adc8` | `#5c5f77` | Labels, hints, timestamps |
| `--ns-color-foreground-muted` | `#6c7086` | `#6c6f85` | Disabled text, placeholders |
| `--ns-color-foreground-inverse` | `#1e1e2e` | `#ffffff` | Text on filled/accent backgrounds |

**Contrast Ratios (Dark)**:
- `foreground` on `background`: 10.7:1 (AAA)
- `foreground-secondary` on `background`: 6.5:1 (AA)
- `foreground-muted` on `background`: 3.5:1 (AA for large text only)

### 2.3 Primary Color (Mauve)

The primary color represents the brand and is used for interactive elements: buttons, links, focus rings, and active states.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-primary` | `#cba6f7` | `#8839ef` | Primary buttons, links, active tabs |
| `--ns-color-primary-hover` | `#b98ef5` | `#7528e0` | Hover state |
| `--ns-color-primary-active` | `#a876f3` | `#6520c7` | Pressed/active state |
| `--ns-color-primary-muted` | `rgba(203,166,247,0.15)` | `rgba(136,57,239,0.1)` | Tinted backgrounds |
| `--ns-color-primary-foreground` | `#1e1e2e` | `#ffffff` | Text on primary fill |

### 2.4 Secondary Color

Used for secondary actions and less prominent interactive elements.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-secondary` | `#45475a` | `#e6e9ef` | Secondary buttons, toggle off state |
| `--ns-color-secondary-hover` | `#525466` | `#dce0e8` | Hover state |
| `--ns-color-secondary-foreground` | `#cdd6f4` | `#4c4f69` | Text on secondary fill |

### 2.5 Accent Color (Pink)

A complementary accent for highlights, tags, and decorative emphasis.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-accent` | `#f5c2e7` | `#ea76cb` | Highlights, badges, decorative |
| `--ns-color-accent-hover` | `#f0b0dd` | `#e560c0` | Hover state |
| `--ns-color-accent-muted` | `rgba(245,194,231,0.15)` | `rgba(234,118,203,0.1)` | Tinted backgrounds |
| `--ns-color-accent-foreground` | `#1e1e2e` | `#ffffff` | Text on accent fill |

### 2.6 Muted

Subdued backgrounds for less prominent UI areas.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-muted` | `#45475a` | `#e6e9ef` | Muted backgrounds |
| `--ns-color-muted-foreground` | `#a6adc8` | `#6c6f85` | Muted text |

### 2.7 Destructive / Danger

Used for delete actions, error states, and irreversible operations.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-destructive` | `#f38ba8` | `#d20f39` | Delete buttons, error messages |
| `--ns-color-destructive-hover` | `#f07090` | `#b80d32` | Hover state |
| `--ns-color-destructive-muted` | `rgba(243,139,168,0.15)` | `rgba(210,15,57,0.1)` | Error backgrounds |
| `--ns-color-destructive-foreground` | `#1e1e2e` | `#ffffff` | Text on destructive fill |

### 2.8 Semantic Status Colors

Used for system feedback: toast notifications, alerts, badges, inline validation.

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--ns-color-success` | `#a6e3a1` | `#40a02b` | Success states, published badge |
| `--ns-color-success-muted` | `rgba(166,227,161,0.15)` | `rgba(64,160,43,0.1)` | Success background |
| `--ns-color-warning` | `#fab387` | `#fe640b` | Warning states, stale content |
| `--ns-color-warning-muted` | `rgba(250,179,135,0.15)` | `rgba(254,100,11,0.1)` | Warning background |
| `--ns-color-error` | `#f38ba8` | `#d20f39` | Error states, validation |
| `--ns-color-error-muted` | `rgba(243,139,168,0.15)` | `rgba(210,15,57,0.1)` | Error background |
| `--ns-color-info` | `#89dceb` | `#04a5e5` | Info states, tips |
| `--ns-color-info-muted` | `rgba(137,220,235,0.15)` | `rgba(4,165,229,0.1)` | Info background |

### 2.9 Border Colors

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-border` | `#45475a` | `#ccd0da` | Default borders |
| `--ns-color-border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` | Subtle separators |
| `--ns-color-border-focus` | `var(--ns-color-primary)` | `var(--ns-color-primary)` | Focus borders |
| `--ns-color-border-error` | `var(--ns-color-destructive)` | `var(--ns-color-destructive)` | Error borders |

### 2.10 Input

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-input` | `#45475a` | `#ccd0da` | Input border color |
| `--ns-color-input-background` | `#1a1a2e` | `#ffffff` | Input fill |

### 2.11 Ring (Focus Ring)

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-ring` | `#cba6f7` | `#8839ef` | Focus ring color |

### 2.12 Card

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-card` | `#313244` | `#ffffff` | Card backgrounds |
| `--ns-color-card-foreground` | `#cdd6f4` | `#4c4f69` | Card text |

### 2.13 Popover

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-popover` | `#313244` | `#ffffff` | Popover/dropdown backgrounds |
| `--ns-color-popover-foreground` | `#cdd6f4` | `#4c4f69` | Popover text |

### 2.14 Sidebar

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-color-sidebar-background` | `#181825` | `#dce0e8` | Left/right sidebar background |
| `--ns-color-sidebar-foreground` | `#cdd6f4` | `#4c4f69` | Sidebar text |
| `--ns-color-sidebar-border` | `#313244` | `#ccd0da` | Sidebar dividers |
| `--ns-color-sidebar-accent` | `#45475a` | `#e6e9ef` | Active item background |
| `--ns-color-sidebar-accent-foreground` | `#cdd6f4` | `#4c4f69` | Active item text |
| `--ns-color-sidebar-muted` | `#a6adc8` | `#6c6f85` | Secondary sidebar text |
| `--ns-color-sidebar-ring` | `#cba6f7` | `#8839ef` | Sidebar focus ring |

### 2.15 Extended Catppuccin Palette

Used for graph node colors, user cursor colors, tag colors, and data visualization.

| Token | Dark (Mocha) | Light (Latte) | Catppuccin Name |
|-------|-------------|---------------|-----------------|
| `--ns-color-rosewater` | `#f5e0dc` | `#dc8a78` | Rosewater |
| `--ns-color-flamingo` | `#f2cdcd` | `#dd7878` | Flamingo |
| `--ns-color-pink` | `#f5c2e7` | `#ea76cb` | Pink |
| `--ns-color-mauve` | `#cba6f7` | `#8839ef` | Mauve |
| `--ns-color-red` | `#f38ba8` | `#d20f39` | Red |
| `--ns-color-maroon` | `#eba0ac` | `#e64553` | Maroon |
| `--ns-color-peach` | `#fab387` | `#fe640b` | Peach |
| `--ns-color-yellow` | `#f9e2af` | `#df8e1d` | Yellow |
| `--ns-color-green` | `#a6e3a1` | `#40a02b` | Green |
| `--ns-color-teal` | `#94e2d5` | `#179299` | Teal |
| `--ns-color-sky` | `#89dceb` | `#04a5e5` | Sky |
| `--ns-color-sapphire` | `#74c7ec` | `#209fb5` | Sapphire |
| `--ns-color-blue` | `#89b4fa` | `#1e66f5` | Blue |
| `--ns-color-lavender` | `#b4befe` | `#7287fd` | Lavender |

### 2.16 Chart / Data Visualization

Pre-assigned colors for chart series that maintain good contrast and distinguishability in both themes.

| Token | Dark | Light | Series |
|-------|------|-------|--------|
| `--ns-color-chart-1` | `#cba6f7` | `#8839ef` | Series 1 |
| `--ns-color-chart-2` | `#89b4fa` | `#1e66f5` | Series 2 |
| `--ns-color-chart-3` | `#a6e3a1` | `#40a02b` | Series 3 |
| `--ns-color-chart-4` | `#fab387` | `#fe640b` | Series 4 |
| `--ns-color-chart-5` | `#f38ba8` | `#d20f39` | Series 5 |

---

## 3. Typography System

### 3.1 Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-font-sans` | `'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif` | UI text, editor prose |
| `--ns-font-mono` | `'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace` | Code blocks, inline code, frontmatter |
| `--ns-font-serif` | `'Lora', 'Georgia', 'Times New Roman', serif` | Optional reading mode |

**Font Loading Strategy**:
- Inter Variable (WOFF2, ~100KB) -- loaded via `next/font/google` with `display: swap`
- JetBrains Mono Variable (WOFF2, ~80KB) -- loaded via `next/font/google` with `display: swap`
- Lora -- loaded on-demand when reading mode is activated

### 3.2 Font Size Scale

The scale is optimized for a desktop application feel. The base size is 14px (smaller than typical web 16px) because Notesaner is a dense workspace app, not a content website.

| Token | Size | px | Usage |
|-------|------|----|-------|
| `--ns-text-2xs` | `0.6875rem` | 11px | Smallest labels, keyboard shortcuts |
| `--ns-text-xs` | `0.75rem` | 12px | Captions, badges, timestamps |
| `--ns-text-sm` | `0.8125rem` | 13px | Sidebar items, secondary text |
| `--ns-text-base` | `0.875rem` | 14px | Body text, editor default |
| `--ns-text-md` | `1rem` | 16px | Emphasized body, input text |
| `--ns-text-lg` | `1.125rem` | 18px | Section headers, dialog titles |
| `--ns-text-xl` | `1.25rem` | 20px | Page titles, large headers |
| `--ns-text-2xl` | `1.5rem` | 24px | Editor H3 |
| `--ns-text-3xl` | `1.875rem` | 30px | Editor H2 |
| `--ns-text-4xl` | `2.25rem` | 36px | Editor H1 |
| `--ns-text-5xl` | `3rem` | 48px | Splash screens, onboarding |

### 3.3 Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-leading-none` | `1` | Icons, single-line badges |
| `--ns-leading-tight` | `1.25` | Headings, compact labels |
| `--ns-leading-snug` | `1.375` | Sidebar items |
| `--ns-leading-normal` | `1.5` | Default text |
| `--ns-leading-relaxed` | `1.625` | Editor body text |
| `--ns-leading-loose` | `1.75` | Editor prose, reading mode |

### 3.4 Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-tracking-tighter` | `-0.05em` | Large display headings (36px+) |
| `--ns-tracking-tight` | `-0.025em` | Headings (20px+) |
| `--ns-tracking-normal` | `0em` | Body text |
| `--ns-tracking-wide` | `0.025em` | Buttons, labels |
| `--ns-tracking-wider` | `0.05em` | Uppercase labels |
| `--ns-tracking-widest` | `0.1em` | All-caps section headers |

### 3.5 Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-font-thin` | `100` | Decorative only |
| `--ns-font-light` | `300` | Large display text |
| `--ns-font-regular` | `400` | Body text, paragraphs |
| `--ns-font-medium` | `500` | UI labels, sidebar items |
| `--ns-font-semibold` | `600` | Buttons, active tab labels |
| `--ns-font-bold` | `700` | Headings, emphasis |
| `--ns-font-extrabold` | `800` | Display headings only |

### 3.6 Composite Typography Presets

These are not CSS custom properties but recommended combinations for common use cases:

| Preset | Size | Weight | Line Height | Tracking | Usage |
|--------|------|--------|-------------|----------|-------|
| `display` | 48px | 800 | 1.0 | -0.05em | Splash, onboarding hero |
| `h1` | 36px | 700 | 1.25 | -0.05em | Editor H1 |
| `h2` | 30px | 700 | 1.25 | -0.025em | Editor H2 |
| `h3` | 24px | 600 | 1.375 | -0.025em | Editor H3, page titles |
| `h4` | 20px | 600 | 1.375 | -0.025em | Section headers |
| `h5` | 18px | 600 | 1.5 | 0em | Subsection headers |
| `h6` | 16px | 600 | 1.5 | 0em | Minor headers |
| `body` | 14px | 400 | 1.625 | 0em | Editor default |
| `body-sm` | 13px | 400 | 1.5 | 0em | Sidebar, secondary |
| `caption` | 12px | 400 | 1.5 | 0.025em | Timestamps, badges |
| `overline` | 11px | 500 | 1.0 | 0.1em | Uppercase section labels |
| `code` | 13px | 400 | 1.5 | 0em | Code blocks (JetBrains Mono) |
| `code-sm` | 12px | 400 | 1.5 | 0em | Inline code |

---

## 4. Spacing System

### 4.1 Scale

Based on a 4px grid. All spacing values are multiples of 4px for visual consistency.

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-space-0` | `0px` | Reset |
| `--ns-space-px` | `1px` | Borders, fine adjustments |
| `--ns-space-0-5` | `2px` | Micro gaps (icon-to-text in badges) |
| `--ns-space-1` | `4px` | Tight padding (badges, small buttons) |
| `--ns-space-1-5` | `6px` | Dense lists |
| `--ns-space-2` | `8px` | Default gap between inline items |
| `--ns-space-2-5` | `10px` | Comfortable small padding |
| `--ns-space-3` | `12px` | Input padding, card padding (compact) |
| `--ns-space-4` | `16px` | Standard component padding |
| `--ns-space-5` | `20px` | Medium section spacing |
| `--ns-space-6` | `24px` | Large component padding |
| `--ns-space-8` | `32px` | Section gaps |
| `--ns-space-10` | `40px` | Major section spacing |
| `--ns-space-12` | `48px` | Page-level sections |
| `--ns-space-16` | `64px` | Large page margins |
| `--ns-space-20` | `80px` | Hero spacing |
| `--ns-space-24` | `96px` | Splash sections |
| `--ns-space-32` | `128px` | Full-page vertical spacing |
| `--ns-space-40` | `160px` | Decorative spacing |
| `--ns-space-48` | `192px` | Decorative spacing |
| `--ns-space-64` | `256px` | Maximum decorative spacing |

### 4.2 Component Spacing Guidelines

| Component | Padding | Gap |
|-----------|---------|-----|
| Button (sm) | `4px 12px` | `6px` (icon gap) |
| Button (md) | `8px 16px` | `8px` |
| Button (lg) | `12px 24px` | `8px` |
| Input | `8px 12px` | -- |
| Card | `16px` | `12px` (content gap) |
| Dialog | `24px` | `16px` |
| Sidebar item | `6px 12px` | `8px` |
| Tab | `8px 16px` | -- |
| Toolbar | `4px 8px` | `4px` |
| Status bar | `0 8px` | `12px` |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-radius-none` | `0px` | No rounding (sharp edges) |
| `--ns-radius-sm` | `4px` | Small elements: badges, chips, inline code |
| `--ns-radius-md` | `8px` | Medium elements: buttons, inputs, tabs |
| `--ns-radius-lg` | `12px` | Large elements: cards, modals |
| `--ns-radius-xl` | `16px` | Extra large: sheets, dialog panels |
| `--ns-radius-2xl` | `24px` | Decorative containers |
| `--ns-radius-full` | `9999px` | Pills, avatar circles, toggle tracks |

### Radius Usage Rules

- **Nested elements**: Inner radius should be `outer radius - padding`. For example, a card with `radius-lg` (12px) and `padding: 16px` should have inner elements at `radius-sm` (4px) or less.
- **Interactive elements**: Always use at least `radius-sm` (4px) for touch/click targets.
- **Never mix**: Adjacent elements should use the same radius to avoid visual tension.

---

## 6. Shadows

### 6.1 Elevation Scale

Dark theme shadows are heavier because subtle shadows are invisible on dark backgrounds.

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-shadow-none` | `none` | `none` | Flat elements |
| `--ns-shadow-xs` | `0 1px 2px rgba(0,0,0,0.3)` | `0 1px 2px rgba(0,0,0,0.04)` | Subtle lift |
| `--ns-shadow-sm` | `0 1px 3px rgba(0,0,0,0.4)` | `0 1px 3px rgba(0,0,0,0.08)` | Buttons, cards at rest |
| `--ns-shadow-md` | `0 4px 12px rgba(0,0,0,0.5)` | `0 4px 12px rgba(0,0,0,0.12)` | Hovered cards, floating toolbar |
| `--ns-shadow-lg` | `0 8px 24px rgba(0,0,0,0.6)` | `0 8px 24px rgba(0,0,0,0.15)` | Popovers, dropdown menus |
| `--ns-shadow-xl` | `0 12px 36px rgba(0,0,0,0.65)` | `0 12px 36px rgba(0,0,0,0.18)` | Dialogs, command palette |
| `--ns-shadow-floating` | `0 16px 48px rgba(0,0,0,0.7)` | `0 16px 48px rgba(0,0,0,0.2)` | Detached windows, drag previews |

### 6.2 Utility Shadows

| Token | Dark Value | Light Value | Usage |
|-------|-----------|-------------|-------|
| `--ns-shadow-inset` | `inset 0 1px 3px rgba(0,0,0,0.3)` | `inset 0 1px 3px rgba(0,0,0,0.06)` | Input wells, pressed states |
| `--ns-shadow-ring` | `0 0 0 3px rgba(203,166,247,0.4)` | `0 0 0 3px rgba(136,57,239,0.3)` | Focus ring |
| `--ns-shadow-ring-error` | `0 0 0 3px rgba(243,139,168,0.4)` | `0 0 0 3px rgba(210,15,57,0.3)` | Error focus ring |

---

## 7. Motion and Animation

### 7.1 Duration Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-duration-instant` | `0ms` | Immediate state changes |
| `--ns-duration-fast` | `100ms` | Hover color changes, icon swaps |
| `--ns-duration-normal` | `150ms` | Button state transitions, toggles |
| `--ns-duration-moderate` | `200ms` | Panel slides, fades |
| `--ns-duration-slow` | `300ms` | Modal open/close, sidebar collapse |
| `--ns-duration-slower` | `500ms` | Page transitions, complex animations |

### 7.2 Easing Curves

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-ease-linear` | `linear` | Progress bars, continuous animations |
| `--ns-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations |
| `--ns-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Enter animations (default) |
| `--ns-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Symmetric transitions |
| `--ns-ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful micro-interactions |

### 7.3 Motion Principles

1. **Purpose**: Every animation must serve a functional purpose (orient, guide, or inform).
2. **Speed**: Default to `--ns-duration-normal` (150ms). Users should never wait for animations.
3. **Accessibility**: All durations become `0ms` when `prefers-reduced-motion: reduce` is active.
4. **Consistency**: Same type of transition uses same duration/easing throughout the app.

### 7.4 Common Animation Patterns

| Pattern | Duration | Easing | Usage |
|---------|----------|--------|-------|
| Hover highlight | `100ms` | `ease-out` | Background color on hover |
| Button press | `100ms` | `ease-in-out` | Scale(0.98) on active |
| Tooltip appear | `150ms` | `ease-out` | Opacity + translateY(4px) |
| Dropdown open | `200ms` | `ease-out` | Opacity + scale from 0.95 |
| Modal open | `300ms` | `ease-out` | Opacity + scale from 0.95 |
| Sidebar collapse | `300ms` | `ease-in-out` | Width transition |
| Page transition | `200ms` | `ease-in-out` | Opacity crossfade |

---

## 8. Layout Tokens

### 8.1 Application Shell Dimensions

| Token | Value | Description |
|-------|-------|-------------|
| `--ns-ribbon-width` | `48px` | Left icon ribbon (actions) |
| `--ns-sidebar-width` | `260px` | Left sidebar default |
| `--ns-sidebar-min` | `180px` | Minimum sidebar width |
| `--ns-sidebar-max` | `480px` | Maximum sidebar width |
| `--ns-right-sidebar-width` | `280px` | Right sidebar (backlinks, outline) |
| `--ns-statusbar-height` | `24px` | Bottom status bar |
| `--ns-tabbar-height` | `38px` | Tab bar above editor |
| `--ns-toolbar-height` | `44px` | Toolbar (formatting, breadcrumbs) |

### 8.2 Content Widths

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-max-width-prose` | `65ch` | Editor reading width, note content |
| `--ns-max-width-content` | `960px` | Settings, onboarding forms |
| `--ns-max-width-wide` | `1280px` | Dashboard, admin panels |

### 8.3 Breakpoints

Not CSS custom properties (CSS cannot use variables in media queries), but documented for Tailwind and JS usage.

| Name | Value | Target |
|------|-------|--------|
| `sm` | `640px` | Large phones, landscape |
| `md` | `768px` | Tablets |
| `lg` | `1024px` | Small laptops |
| `xl` | `1280px` | Desktops |
| `2xl` | `1536px` | Large displays |

---

## 9. Z-Index Scale

Defined as CSS custom properties for consistency. Each layer has a clear purpose to prevent z-index wars.

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-z-base` | `0` | Default stacking |
| `--ns-z-dropdown` | `50` | Dropdown menus, selects |
| `--ns-z-sticky` | `100` | Sticky headers, sidebar |
| `--ns-z-overlay` | `200` | Background overlays/scrims |
| `--ns-z-modal` | `300` | Modal dialogs |
| `--ns-z-popover` | `400` | Popovers, tooltips on modals |
| `--ns-z-tooltip` | `500` | Tooltips (always on top of popovers) |
| `--ns-z-toast` | `600` | Toast notifications |
| `--ns-z-spotlight` | `700` | Command palette, search spotlight |
| `--ns-z-max` | `9999` | Debug overlays, critical system UI |

---

## 10. Opacity Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ns-opacity-disabled` | `0.5` | Disabled buttons, inputs |
| `--ns-opacity-hover` | `0.8` | Hovered ghost elements |
| `--ns-opacity-placeholder` | `0.5` | Placeholder text |
| `--ns-opacity-overlay` | `0.6` | Modal backdrop/scrim |

---

## 11. Tailwind CSS Integration

### 11.1 Extending Tailwind with Tokens

In Tailwind CSS 4 (used by Notesaner), tokens are consumed via `@theme` in the main CSS file. The following shows how `tokens.css` maps to Tailwind utilities.

```css
/* packages/ui/src/styles/main.css */

@import "tailwindcss";
@import "./tokens.css";

@theme {
  /* Colors */
  --color-background: var(--ns-color-background);
  --color-foreground: var(--ns-color-foreground);
  --color-primary: var(--ns-color-primary);
  --color-primary-foreground: var(--ns-color-primary-foreground);
  --color-secondary: var(--ns-color-secondary);
  --color-secondary-foreground: var(--ns-color-secondary-foreground);
  --color-accent: var(--ns-color-accent);
  --color-accent-foreground: var(--ns-color-accent-foreground);
  --color-muted: var(--ns-color-muted);
  --color-muted-foreground: var(--ns-color-muted-foreground);
  --color-destructive: var(--ns-color-destructive);
  --color-destructive-foreground: var(--ns-color-destructive-foreground);
  --color-card: var(--ns-color-card);
  --color-card-foreground: var(--ns-color-card-foreground);
  --color-popover: var(--ns-color-popover);
  --color-popover-foreground: var(--ns-color-popover-foreground);
  --color-border: var(--ns-color-border);
  --color-input: var(--ns-color-input);
  --color-ring: var(--ns-color-ring);
  --color-sidebar-background: var(--ns-color-sidebar-background);
  --color-sidebar-foreground: var(--ns-color-sidebar-foreground);
  --color-sidebar-border: var(--ns-color-sidebar-border);
  --color-sidebar-accent: var(--ns-color-sidebar-accent);
  --color-sidebar-accent-foreground: var(--ns-color-sidebar-accent-foreground);
  --color-success: var(--ns-color-success);
  --color-warning: var(--ns-color-warning);
  --color-error: var(--ns-color-error);
  --color-info: var(--ns-color-info);

  /* Font families */
  --font-sans: var(--ns-font-sans);
  --font-mono: var(--ns-font-mono);
  --font-serif: var(--ns-font-serif);

  /* Border radius */
  --radius-sm: var(--ns-radius-sm);
  --radius-md: var(--ns-radius-md);
  --radius-lg: var(--ns-radius-lg);
  --radius-xl: var(--ns-radius-xl);
  --radius-2xl: var(--ns-radius-2xl);
  --radius-full: var(--ns-radius-full);
}
```

### 11.2 Tailwind Usage Examples

```html
<!-- Primary button -->
<button class="bg-primary text-primary-foreground rounded-md px-4 py-2
               hover:bg-primary/90 transition-colors duration-normal">
  Save Note
</button>

<!-- Card -->
<div class="bg-card text-card-foreground rounded-lg border border-border p-4 shadow-sm">
  <h3 class="text-lg font-semibold">Card Title</h3>
  <p class="text-muted-foreground text-sm">Description text</p>
</div>

<!-- Sidebar item -->
<button class="w-full text-left px-3 py-1.5 text-sm text-sidebar-foreground
               rounded-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
               transition-colors">
  File Name.md
</button>

<!-- Destructive action -->
<button class="bg-destructive text-destructive-foreground rounded-md px-4 py-2">
  Delete Note
</button>

<!-- Input field -->
<input class="w-full bg-background border border-input rounded-md px-3 py-2
              text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-ring" />
```

---

## 12. Usage Guidelines

### 12.1 Color Pairing Rules

| Foreground Token | Background Token | Usage |
|-----------------|------------------|-------|
| `foreground` | `background` | Standard body text |
| `card-foreground` | `card` | Card content |
| `popover-foreground` | `popover` | Popover content |
| `primary-foreground` | `primary` | Primary button text |
| `secondary-foreground` | `secondary` | Secondary button text |
| `accent-foreground` | `accent` | Accent badge text |
| `destructive-foreground` | `destructive` | Destructive button text |
| `muted-foreground` | `muted` | Muted area text |
| `sidebar-foreground` | `sidebar-background` | Sidebar text |
| `sidebar-accent-foreground` | `sidebar-accent` | Active sidebar item |

### 12.2 Semantic Color Usage

| Color | When to Use | When NOT to Use |
|-------|-------------|-----------------|
| `primary` | CTA buttons, links, focus states, active tabs | Decorative fills, text color |
| `secondary` | Secondary actions, toggle off states | Primary actions |
| `accent` | Highlights, tags, decorative badges | Action buttons |
| `destructive` | Delete, remove, error states | Warnings (use `warning` instead) |
| `success` | Completion, published status, valid input | Primary actions |
| `warning` | Stale content, caution states | Errors (use `error` instead) |
| `error` | Validation errors, failed operations | Delete buttons (use `destructive`) |
| `info` | Tips, informational badges, help text | Status that needs action |

### 12.3 Do's and Don'ts

**Do**:
- Use semantic tokens (`--ns-color-primary`) not raw values (`#cba6f7`)
- Pair foreground tokens with their matching background tokens
- Test every color combination for WCAG AA contrast (4.5:1 for text)
- Use `muted` variants for background tinting instead of raw opacity

**Don't**:
- Hard-code hex colors in components
- Use `foreground` text on `primary` background (use `primary-foreground`)
- Mix Catppuccin palette colors for semantic meaning without documenting why
- Apply opacity to text colors for dimming (use `foreground-muted` instead)

---

## 13. Accessibility

### 13.1 Contrast Compliance

All foreground/background pairings meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).

| Pairing (Dark) | Ratio | Level |
|-----------------|-------|-------|
| `foreground` on `background` | 10.7:1 | AAA |
| `foreground-secondary` on `background` | 6.5:1 | AA |
| `foreground-muted` on `background` | 3.5:1 | AA (large) |
| `primary` on `background` | 6.8:1 | AA |
| `primary-foreground` on `primary` | 6.8:1 | AA |
| `destructive` on `background` | 5.1:1 | AA |

| Pairing (Light) | Ratio | Level |
|------------------|-------|-------|
| `foreground` on `background` | 8.6:1 | AAA |
| `foreground-secondary` on `background` | 5.7:1 | AA |
| `foreground-muted` on `background` | 4.6:1 | AA |
| `primary` on `background` | 5.2:1 | AA |
| `primary-foreground` on `primary` | 9.4:1 | AAA |
| `destructive` on `background` | 5.8:1 | AA |

### 13.2 Focus Indicators

Every interactive element must have a visible focus indicator:
- Default: `box-shadow: var(--ns-shadow-ring)` (3px ring in primary color)
- Error state: `box-shadow: var(--ns-shadow-ring-error)`
- Minimum: 2px solid outline with 3:1 contrast against adjacent colors

### 13.3 Reduced Motion

The tokens CSS includes a `@media (prefers-reduced-motion: reduce)` block that sets all duration tokens to `0ms`. Components using these tokens will automatically respect the user's preference.

### 13.4 High Contrast Mode

A `@media (prefers-contrast: more)` block increases text contrast and border visibility for users who need it.

---

## Appendix A: Token Count Summary

| Category | Token Count |
|----------|-------------|
| Background colors | 7 |
| Foreground colors | 4 |
| Primary colors | 5 |
| Secondary colors | 3 |
| Accent colors | 4 |
| Muted colors | 2 |
| Destructive colors | 4 |
| Semantic status colors | 8 |
| Border colors | 4 |
| Input colors | 2 |
| Ring | 1 |
| Card colors | 2 |
| Popover colors | 2 |
| Sidebar colors | 7 |
| Extended palette | 14 |
| Chart colors | 5 |
| Font families | 3 |
| Font sizes | 11 |
| Line heights | 6 |
| Letter spacing | 6 |
| Font weights | 7 |
| Spacing | 21 |
| Border radius | 7 |
| Shadows | 10 |
| Motion durations | 6 |
| Easing curves | 5 |
| Layout | 11 |
| Z-index | 10 |
| Opacity | 4 |
| **Total** | **~185 tokens** |

## Appendix B: OpenPencil Design File

The visual reference for these tokens is available as an OpenPencil (`.fig`) file at:

```
designs/notesaner-tokens.fig
```

This file contains:
- Color swatch boards for both dark and light themes
- Typography specimens at each scale size
- Spacing visualization
- Shadow/radius previews
- Component token mapping examples

To regenerate this file using the OpenPencil MCP tools, run the token generation script documented in `scripts/generate-design-tokens.ts`.
