# Notesaner CSS Tokens Reference

All Notesaner design tokens are CSS custom properties defined on `:root`.
They use the `--ns-` prefix to avoid collisions with third-party libraries.

Tokens are defined in: `packages/ui/src/styles/tokens.css`

## Quick Start

```css
/* In a CSS snippet */
.my-note {
  color: var(--ns-color-foreground);
  background: var(--ns-color-background);
  font-family: var(--ns-font-sans);
  padding: var(--ns-space-4);
  border-radius: var(--ns-radius-md);
}
```

---

## 1. Colors

### 1.1 Backgrounds

| Token                            | Description               | Dark Default             |
| -------------------------------- | ------------------------- | ------------------------ |
| `--ns-color-background`          | Main workspace background | `#1e1e2e`                |
| `--ns-color-background-surface`  | Sidebars, panels          | `#252537`                |
| `--ns-color-background-elevated` | Cards, popovers           | `#2d2d44`                |
| `--ns-color-background-overlay`  | Modals, dropdowns         | `#36365a`                |
| `--ns-color-background-input`    | Form inputs               | `#1a1a2e`                |
| `--ns-color-background-hover`    | Hover state overlay       | `rgba(255,255,255,0.05)` |
| `--ns-color-background-active`   | Active/pressed state      | `rgba(255,255,255,0.09)` |

### 1.2 Foreground / Text

| Token                             | Description            | Dark Default |
| --------------------------------- | ---------------------- | ------------ |
| `--ns-color-foreground`           | Primary content text   | `#cdd6f4`    |
| `--ns-color-foreground-secondary` | Labels, hints          | `#a6adc8`    |
| `--ns-color-foreground-muted`     | Disabled, placeholders | `#6c7086`    |
| `--ns-color-foreground-inverse`   | Text on accent fills   | `#1e1e2e`    |

### 1.3 Primary (Accent)

| Token                           | Description               | Dark Default             |
| ------------------------------- | ------------------------- | ------------------------ |
| `--ns-color-primary`            | Primary actions, links    | `#cba6f7`                |
| `--ns-color-primary-hover`      | Primary hover state       | `#b98ef5`                |
| `--ns-color-primary-active`     | Primary pressed state     | `#a876f3`                |
| `--ns-color-primary-muted`      | Primary tinted background | `rgba(203,166,247,0.15)` |
| `--ns-color-primary-foreground` | Text on primary fill      | `#1e1e2e`                |

### 1.4 Secondary

| Token                             | Description       | Dark Default |
| --------------------------------- | ----------------- | ------------ |
| `--ns-color-secondary`            | Secondary fills   | `#45475a`    |
| `--ns-color-secondary-hover`      | Secondary hover   | `#525466`    |
| `--ns-color-secondary-foreground` | Text on secondary | `#cdd6f4`    |

### 1.5 Accent

| Token                          | Description         | Dark Default             |
| ------------------------------ | ------------------- | ------------------------ |
| `--ns-color-accent`            | Accent highlights   | `#f5c2e7`                |
| `--ns-color-accent-hover`      | Accent hover        | `#f0b0dd`                |
| `--ns-color-accent-muted`      | Accent tinted bg    | `rgba(245,194,231,0.15)` |
| `--ns-color-accent-foreground` | Text on accent fill | `#1e1e2e`                |

### 1.6 Muted

| Token                         | Description | Dark Default |
| ----------------------------- | ----------- | ------------ |
| `--ns-color-muted`            | Muted fills | `#45475a`    |
| `--ns-color-muted-foreground` | Muted text  | `#a6adc8`    |

### 1.7 Destructive

| Token                               | Description           | Dark Default             |
| ----------------------------------- | --------------------- | ------------------------ |
| `--ns-color-destructive`            | Error/danger actions  | `#f38ba8`                |
| `--ns-color-destructive-hover`      | Destructive hover     | `#f07090`                |
| `--ns-color-destructive-muted`      | Destructive tinted bg | `rgba(243,139,168,0.15)` |
| `--ns-color-destructive-foreground` | Text on destructive   | `#1e1e2e`                |

### 1.8 Semantic Status

| Token                      | Description        | Dark Default             |
| -------------------------- | ------------------ | ------------------------ |
| `--ns-color-success`       | Success            | `#a6e3a1`                |
| `--ns-color-success-muted` | Success background | `rgba(166,227,161,0.15)` |
| `--ns-color-warning`       | Warning            | `#fab387`                |
| `--ns-color-warning-muted` | Warning background | `rgba(250,179,135,0.15)` |
| `--ns-color-error`         | Error              | `#f38ba8`                |
| `--ns-color-error-muted`   | Error background   | `rgba(243,139,168,0.15)` |
| `--ns-color-info`          | Info               | `#89dceb`                |
| `--ns-color-info-muted`    | Info background    | `rgba(137,220,235,0.15)` |

### 1.9 Borders

| Token                      | Description            | Dark Default             |
| -------------------------- | ---------------------- | ------------------------ |
| `--ns-color-border`        | Default borders        | `#45475a`                |
| `--ns-color-border-subtle` | Very subtle separators | `rgba(255,255,255,0.08)` |
| `--ns-color-border-focus`  | Focus border           | `= primary`              |
| `--ns-color-border-error`  | Error border           | `= destructive`          |

### 1.10 Input

| Token                         | Description        | Dark Default |
| ----------------------------- | ------------------ | ------------ |
| `--ns-color-input`            | Input border color | `#45475a`    |
| `--ns-color-input-background` | Input background   | `#1a1a2e`    |

### 1.11 Ring

| Token             | Description      | Dark Default |
| ----------------- | ---------------- | ------------ |
| `--ns-color-ring` | Focus ring color | `#cba6f7`    |

### 1.12 Card

| Token                        | Description      | Dark Default |
| ---------------------------- | ---------------- | ------------ |
| `--ns-color-card`            | Card backgrounds | `#313244`    |
| `--ns-color-card-foreground` | Card text        | `#cdd6f4`    |

### 1.13 Popover

| Token                           | Description         | Dark Default |
| ------------------------------- | ------------------- | ------------ |
| `--ns-color-popover`            | Popover backgrounds | `#313244`    |
| `--ns-color-popover-foreground` | Popover text        | `#cdd6f4`    |

### 1.14 Sidebar

| Token                                  | Description            | Dark Default |
| -------------------------------------- | ---------------------- | ------------ |
| `--ns-color-sidebar-background`        | Sidebar bg             | `#181825`    |
| `--ns-color-sidebar-foreground`        | Sidebar text           | `#cdd6f4`    |
| `--ns-color-sidebar-border`            | Sidebar dividers       | `#313244`    |
| `--ns-color-sidebar-accent`            | Sidebar active item    | `#45475a`    |
| `--ns-color-sidebar-accent-foreground` | Active item text       | `#cdd6f4`    |
| `--ns-color-sidebar-muted`             | Sidebar secondary text | `#a6adc8`    |
| `--ns-color-sidebar-ring`              | Sidebar focus ring     | `#cba6f7`    |

### 1.15 Extended Catppuccin Palette

These are available for direct use in custom themes, graph nodes, tags, etc.

| Token                  | Color     |
| ---------------------- | --------- |
| `--ns-color-rosewater` | Rosewater |
| `--ns-color-flamingo`  | Flamingo  |
| `--ns-color-pink`      | Pink      |
| `--ns-color-mauve`     | Mauve     |
| `--ns-color-red`       | Red       |
| `--ns-color-maroon`    | Maroon    |
| `--ns-color-peach`     | Peach     |
| `--ns-color-yellow`    | Yellow    |
| `--ns-color-green`     | Green     |
| `--ns-color-teal`      | Teal      |
| `--ns-color-sky`       | Sky       |
| `--ns-color-sapphire`  | Sapphire  |
| `--ns-color-blue`      | Blue      |
| `--ns-color-lavender`  | Lavender  |

### 1.16 Chart / Data Visualization

| Token                | Description   |
| -------------------- | ------------- |
| `--ns-color-chart-1` | Chart color 1 |
| `--ns-color-chart-2` | Chart color 2 |
| `--ns-color-chart-3` | Chart color 3 |
| `--ns-color-chart-4` | Chart color 4 |
| `--ns-color-chart-5` | Chart color 5 |

---

## 2. Typography

### 2.1 Font Families

| Token             | Description                |
| ----------------- | -------------------------- |
| `--ns-font-sans`  | UI font (Inter)            |
| `--ns-font-mono`  | Code font (JetBrains Mono) |
| `--ns-font-serif` | Serif font (Lora)          |

### 2.2 Font Sizes

| Token            | Size        | px   |
| ---------------- | ----------- | ---- |
| `--ns-text-2xs`  | `0.6875rem` | 11px |
| `--ns-text-xs`   | `0.75rem`   | 12px |
| `--ns-text-sm`   | `0.8125rem` | 13px |
| `--ns-text-base` | `0.875rem`  | 14px |
| `--ns-text-md`   | `1rem`      | 16px |
| `--ns-text-lg`   | `1.125rem`  | 18px |
| `--ns-text-xl`   | `1.25rem`   | 20px |
| `--ns-text-2xl`  | `1.5rem`    | 24px |
| `--ns-text-3xl`  | `1.875rem`  | 30px |
| `--ns-text-4xl`  | `2.25rem`   | 36px |
| `--ns-text-5xl`  | `3rem`      | 48px |

### 2.3 Line Heights

| Token                  | Value |
| ---------------------- | ----- |
| `--ns-leading-none`    | 1     |
| `--ns-leading-tight`   | 1.25  |
| `--ns-leading-snug`    | 1.375 |
| `--ns-leading-normal`  | 1.5   |
| `--ns-leading-relaxed` | 1.625 |
| `--ns-leading-loose`   | 1.75  |

### 2.4 Letter Spacing

| Token                   | Value    |
| ----------------------- | -------- |
| `--ns-tracking-tighter` | -0.05em  |
| `--ns-tracking-tight`   | -0.025em |
| `--ns-tracking-normal`  | 0em      |
| `--ns-tracking-wide`    | 0.025em  |
| `--ns-tracking-wider`   | 0.05em   |
| `--ns-tracking-widest`  | 0.1em    |

### 2.5 Font Weights

| Token                 | Value |
| --------------------- | ----- |
| `--ns-font-thin`      | 100   |
| `--ns-font-light`     | 300   |
| `--ns-font-regular`   | 400   |
| `--ns-font-medium`    | 500   |
| `--ns-font-semibold`  | 600   |
| `--ns-font-bold`      | 700   |
| `--ns-font-extrabold` | 800   |

---

## 3. Spacing (4px Grid)

| Token            | Value |
| ---------------- | ----- |
| `--ns-space-0`   | 0px   |
| `--ns-space-px`  | 1px   |
| `--ns-space-0-5` | 2px   |
| `--ns-space-1`   | 4px   |
| `--ns-space-1-5` | 6px   |
| `--ns-space-2`   | 8px   |
| `--ns-space-2-5` | 10px  |
| `--ns-space-3`   | 12px  |
| `--ns-space-4`   | 16px  |
| `--ns-space-5`   | 20px  |
| `--ns-space-6`   | 24px  |
| `--ns-space-8`   | 32px  |
| `--ns-space-10`  | 40px  |
| `--ns-space-12`  | 48px  |
| `--ns-space-16`  | 64px  |
| `--ns-space-20`  | 80px  |
| `--ns-space-24`  | 96px  |
| `--ns-space-32`  | 128px |
| `--ns-space-40`  | 160px |
| `--ns-space-48`  | 192px |
| `--ns-space-64`  | 256px |

---

## 4. Border Radius

| Token              | Value  | Use             |
| ------------------ | ------ | --------------- |
| `--ns-radius-none` | 0px    | Sharp corners   |
| `--ns-radius-sm`   | 4px    | Badges, chips   |
| `--ns-radius-md`   | 8px    | Buttons, inputs |
| `--ns-radius-lg`   | 12px   | Cards, modals   |
| `--ns-radius-xl`   | 16px   | Sheets, dialogs |
| `--ns-radius-2xl`  | 24px   | Extra large     |
| `--ns-radius-full` | 9999px | Pills, avatars  |

---

## 5. Shadows

| Token                    | Description            |
| ------------------------ | ---------------------- |
| `--ns-shadow-none`       | No shadow              |
| `--ns-shadow-xs`         | Subtle shadow          |
| `--ns-shadow-sm`         | Small shadow           |
| `--ns-shadow-md`         | Medium shadow (cards)  |
| `--ns-shadow-lg`         | Large shadow (modals)  |
| `--ns-shadow-xl`         | Extra large shadow     |
| `--ns-shadow-floating`   | Floating elements      |
| `--ns-shadow-inset`      | Inset for inputs/wells |
| `--ns-shadow-ring`       | Focus ring (primary)   |
| `--ns-shadow-ring-error` | Focus ring (error)     |

---

## 6. Motion / Animation

### 6.1 Durations

| Token                    | Value |
| ------------------------ | ----- |
| `--ns-duration-instant`  | 0ms   |
| `--ns-duration-fast`     | 100ms |
| `--ns-duration-normal`   | 150ms |
| `--ns-duration-moderate` | 200ms |
| `--ns-duration-slow`     | 300ms |
| `--ns-duration-slower`   | 500ms |

### 6.2 Easing Curves

| Token              | Value                             |
| ------------------ | --------------------------------- |
| `--ns-ease-linear` | linear                            |
| `--ns-ease-in`     | cubic-bezier(0.4, 0, 1, 1)        |
| `--ns-ease-out`    | cubic-bezier(0.22, 1, 0.36, 1)    |
| `--ns-ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1)      |
| `--ns-ease-bounce` | cubic-bezier(0.34, 1.56, 0.64, 1) |

---

## 7. Layout

### 7.1 Application Shell

| Token                      | Value |
| -------------------------- | ----- |
| `--ns-ribbon-width`        | 48px  |
| `--ns-sidebar-width`       | 260px |
| `--ns-sidebar-min`         | 180px |
| `--ns-sidebar-max`         | 480px |
| `--ns-right-sidebar-width` | 280px |
| `--ns-statusbar-height`    | 24px  |
| `--ns-tabbar-height`       | 38px  |
| `--ns-toolbar-height`      | 44px  |

### 7.2 Content Widths

| Token                    | Value  |
| ------------------------ | ------ |
| `--ns-max-width-prose`   | 65ch   |
| `--ns-max-width-content` | 960px  |
| `--ns-max-width-wide`    | 1280px |

### 7.3 Z-Index Scale

| Token              | Value | Use             |
| ------------------ | ----- | --------------- |
| `--ns-z-base`      | 0     | Default         |
| `--ns-z-dropdown`  | 50    | Dropdown menus  |
| `--ns-z-sticky`    | 100   | Sticky headers  |
| `--ns-z-overlay`   | 200   | Overlays        |
| `--ns-z-modal`     | 300   | Modals          |
| `--ns-z-popover`   | 400   | Popovers        |
| `--ns-z-tooltip`   | 500   | Tooltips        |
| `--ns-z-toast`     | 600   | Toasts          |
| `--ns-z-spotlight` | 700   | Command palette |
| `--ns-z-max`       | 9999  | Top-most        |

---

## 8. Opacity

| Token                      | Value | Use               |
| -------------------------- | ----- | ----------------- |
| `--ns-opacity-disabled`    | 0.5   | Disabled elements |
| `--ns-opacity-hover`       | 0.8   | Hover opacity     |
| `--ns-opacity-placeholder` | 0.5   | Placeholder text  |
| `--ns-opacity-overlay`     | 0.6   | Overlay backdrop  |

---

## 9. Obsidian Compatibility

Notesaner includes an Obsidian CSS variable compatibility layer at:
`packages/ui/src/styles/obsidian-compat.css`

This maps common Obsidian CSS variables to Notesaner tokens, so existing
Obsidian CSS snippets work with minimal modification.

### Key Mappings

| Obsidian Variable            | Notesaner Token                   |
| ---------------------------- | --------------------------------- |
| `--background-primary`       | `--ns-color-background`           |
| `--background-secondary`     | `--ns-color-background-surface`   |
| `--text-normal`              | `--ns-color-foreground`           |
| `--text-muted`               | `--ns-color-foreground-secondary` |
| `--text-faint`               | `--ns-color-foreground-muted`     |
| `--interactive-accent`       | `--ns-color-primary`              |
| `--interactive-accent-hover` | `--ns-color-primary-hover`        |
| `--font-interface-theme`     | `--ns-font-sans`                  |
| `--font-text-theme`          | `--ns-font-sans`                  |
| `--font-monospace-theme`     | `--ns-font-mono`                  |
| `--font-text-size`           | `--ns-text-base`                  |
| `--h1-size`                  | `--ns-text-4xl`                   |
| `--radius-s`                 | `--ns-radius-sm`                  |
| `--radius-m`                 | `--ns-radius-md`                  |
| `--radius-l`                 | `--ns-radius-lg`                  |
| `--link-color`               | `--ns-color-primary`              |
| `--tag-background`           | `--ns-color-primary-muted`        |
| `--code-background`          | `--ns-color-background-surface`   |

For the full mapping, see `packages/ui/src/styles/obsidian-compat.css`.

---

## 10. Per-Note Custom CSS

Add a `cssClass` property to a note's frontmatter to apply a custom CSS
class to the editor container:

```yaml
---
title: My Custom Note
cssClass: wide-page
---
```

Then target it in a CSS snippet:

```css
.wide-page {
  --ns-max-width-prose: 100%;
}

.wide-page .editor-content {
  font-size: var(--ns-text-lg);
}
```

Multiple classes are supported as an array:

```yaml
---
cssClass: [wide-page, dark-editor]
---
```

Both `cssClass` (camelCase) and `cssclass` (lowercase) are supported
for Obsidian compatibility.

---

## 11. CSS Snippet Security

CSS snippets are sanitized before injection. The following constructs are
blocked and will be removed:

- `@import` rules (external resource loading)
- `url()` values (external resource loading, data exfiltration)
- `expression()` (legacy IE script execution)
- `javascript:` protocol
- `behavior:` property (IE HTC execution)
- `-moz-binding:` property (XBL binding execution)

All valid CSS rules, selectors, properties, and functions (`calc()`,
`var()`, `clamp()`, `min()`, `max()`) are preserved.

---

## 12. Theme Switching

Themes are applied via the `data-theme` attribute on `<html>`:

```css
/* Dark theme (default) */
:root {
  /* ... dark tokens ... */
}

/* Light theme */
[data-theme='light'] {
  /* ... light tokens ... */
}
```

Custom CSS snippets can target specific themes:

```css
/* Only apply in dark mode */
[data-theme='dark'] .my-class {
  border-color: var(--ns-color-mauve);
}

/* Only apply in light mode */
[data-theme='light'] .my-class {
  border-color: var(--ns-color-blue);
}
```
