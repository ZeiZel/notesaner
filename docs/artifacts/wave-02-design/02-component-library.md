# Notesaner Component Library Specification

**Version**: 1.0.0
**Date**: 2026-03-25
**Theme**: Catppuccin Mocha (Dark)
**Framework**: React 19 + shadcn/ui + Tailwind CSS 4
**CSS Architecture**: CSS custom properties (tokens.css) + Tailwind utilities

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Button](#2-button)
3. [Input](#3-input)
4. [Card](#4-card)
5. [Sidebar Item](#5-sidebar-item)
6. [Tab Bar](#6-tab-bar)
7. [Command Palette](#7-command-palette)
8. [Dialog / Modal](#8-dialog--modal)
9. [Badge](#9-badge)
10. [Avatar](#10-avatar)
11. [Tooltip](#11-tooltip)
12. [Dropdown Menu](#12-dropdown-menu)
13. [Toast](#13-toast)
14. [Accessibility Standards](#14-accessibility-standards)
15. [Implementation Notes](#15-implementation-notes)

---

## 1. Design Tokens

All components reference these token values. Tokens are defined in `packages/ui/src/styles/tokens.css` as CSS custom properties and consumed via Tailwind CSS 4.

### Color Palette (Catppuccin Mocha)

```
Token                          Hex         Usage
--color-bg-base                #1e1e2e     Main workspace background
--color-bg-surface             #181825     Sidebar panels, secondary surfaces
--color-bg-elevated            #313244     Cards, popovers, elevated surfaces
--color-bg-overlay             #313244     Modals, command palette
--color-bg-input               #313244     Form input backgrounds
--color-bg-hover               #45475a     Hover state backgrounds
--color-bg-active              #585b70     Active/pressed state backgrounds

--color-text-primary           #cdd6f4     Main content text
--color-text-secondary         #a6adc8     Labels, hints, muted content
--color-text-muted             #6c7086     Disabled text, placeholders
--color-text-inverse           #1e1e2e     Text on accent-colored backgrounds

--color-border                 #45475a     Default borders
--color-border-focus           #cba6f7     Focus ring color (primary accent)
--color-border-error           #f38ba8     Error state borders

--color-primary                #cba6f7     Primary accent (Mauve)
--color-primary-hover          #b48ede     Primary hover state
--color-primary-foreground     #1e1e2e     Text on primary backgrounds

--color-accent                 #f5c2e7     Secondary accent (Pink)
--color-accent-hover           #f0a8d8     Secondary accent hover

--color-destructive            #f38ba8     Destructive/error actions (Red)
--color-destructive-hover      #e06c88     Destructive hover
--color-destructive-foreground #1e1e2e     Text on destructive backgrounds

--color-success                #a6e3a1     Success states (Green)
--color-warning                #fab387     Warning states (Peach)
--color-info                   #89dceb     Info states (Sky)
```

### Typography

```
Token              Value                              Usage
--font-sans        'Inter Variable', system-ui         All UI text
--font-mono        'JetBrains Mono Variable'           Code blocks, shortcuts

--text-xs          12px / leading 1.33                  Captions, badges
--text-sm          13px / leading 1.38                  Secondary labels
--text-base        14px / leading 1.5                   Default body, inputs
--text-md          15px / leading 1.47                  Emphasized body
--text-lg          18px / leading 1.56                  Card titles
--text-xl          20px / leading 1.4                   Section headings
--text-2xl         24px / leading 1.33                  Page headings
--text-3xl         30px / leading 1.27                  Modal titles

Font weights:
  Regular   400     Body text, descriptions
  Medium    500     Buttons, labels, sidebar items
  SemiBold  600     Headings, card titles
  Bold      700     Emphasis, primary headings
```

### Spacing

All spacing follows a 4px base grid.

```
Token       Value    Usage
--space-1   4px      Tight internal padding, icon gaps
--space-2   8px      Input internal padding, small gaps
--space-3   12px     Button padding, list item padding
--space-4   16px     Card padding, section gaps
--space-5   20px     Component separation
--space-6   24px     Section padding
--space-8   32px     Large section gaps
--space-10  40px     Page-level padding
--space-12  48px     Major sections
--space-16  64px     Hero spacing
```

### Radius

```
Token          Value     Usage
--radius-sm    4px       Small chips, badges
--radius-md    6px       Sidebar items, list items
--radius-lg    8px       Buttons, inputs, cards (default)
--radius-xl    12px      Modals, command palette, large cards
--radius-full  9999px    Avatars, circular elements
```

### Shadows

```
Token             Value                               Usage
--shadow-sm       0 1px 3px rgba(0,0,0,0.4)           Subtle elevation
--shadow-md       0 4px 12px rgba(0,0,0,0.5)          Cards, dropdowns
--shadow-lg       0 8px 24px rgba(0,0,0,0.6)          Modals, popovers
--shadow-floating 0 16px 48px rgba(0,0,0,0.7)         Command palette
```

### Motion

```
Token               Value                               Usage
--duration-fast     120ms                                Hover, toggle
--duration-normal   200ms                                Standard transitions
--duration-slow     350ms                                Modal open/close
--ease-out          cubic-bezier(0.22, 1, 0.36, 1)      Enter animations
--ease-in-out       cubic-bezier(0.4, 0, 0.2, 1)        General transitions
```

---

## 2. Button

The primary interactive element for user actions. Built on Radix UI primitives with `class-variance-authority`.

### Anatomy

```
+--[icon-left]--[label]--[icon-right]--+
|              Button                   |
+---------------------------------------+
```

When loading, the content is replaced by a centered spinner.

### Variants

| Variant | Fill | Text | Border | Usage |
|---------|------|------|--------|-------|
| `primary` | `#cba6f7` | `#1e1e2e` | none | Primary CTA, form submit |
| `secondary` | `#45475a` | `#cdd6f4` | none | Secondary actions |
| `outline` | transparent | `#cdd6f4` | `#45475a` 1px | Tertiary actions, cancel |
| `destructive` | `#f38ba8` | `#1e1e2e` | none | Delete, remove actions |
| `ghost` | transparent | `#cdd6f4` | none | Toolbar buttons, subtle actions |
| `link` | transparent | `#cba6f7` | none | Inline text-style links |

### Sizes

| Size | Height | Horizontal Padding | Font Size | Icon Size | Gap |
|------|--------|-------------------|-----------|-----------|-----|
| `sm` | 32px (h-8) | 12px (px-3) | 13px | 14px | 6px |
| `md` | 36px (h-9) | 16px (px-4) | 14px | 16px | 8px |
| `lg` | 44px (h-11) | 24px (px-6) | 15px | 18px | 8px |

### States

| State | Changes | Transition |
|-------|---------|------------|
| **Default** | Base variant styling | -- |
| **Hover** | Background lightens/darkens. Primary: `#b48ede`. Secondary: `#585b70`. Ghost: `#45475a` bg appears. | 120ms ease-out |
| **Active/Pressed** | Background darkens further. Scale `0.98`. | immediate |
| **Focus-visible** | 2px ring offset 2px, ring color matches variant accent. Primary ring: `rgba(203,166,247,0.5)`. | immediate |
| **Disabled** | Opacity `0.5`. Cursor `not-allowed`. No hover/active effects. | -- |
| **Loading** | Label hidden, spinner displayed. Cursor `not-allowed`. `aria-busy="true"`. | 200ms fade |

### Styling (Tailwind Classes)

```
Base:
  inline-flex items-center justify-center rounded-lg
  font-medium text-sm transition-all
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  focus-visible:ring-offset-[#1e1e2e]
  disabled:pointer-events-none disabled:opacity-50
  active:scale-[0.98]

primary:
  bg-[#cba6f7] text-[#1e1e2e]
  hover:bg-[#b48ede]
  focus-visible:ring-[#cba6f7]/50

secondary:
  bg-[#45475a] text-[#cdd6f4]
  hover:bg-[#585b70]
  focus-visible:ring-[#45475a]/50

outline:
  border border-[#45475a] text-[#cdd6f4] bg-transparent
  hover:bg-[#45475a] hover:text-[#cdd6f4]
  focus-visible:ring-[#45475a]/50

destructive:
  bg-[#f38ba8] text-[#1e1e2e]
  hover:bg-[#e06c88]
  focus-visible:ring-[#f38ba8]/50

ghost:
  text-[#cdd6f4] bg-transparent
  hover:bg-[#45475a]
  focus-visible:ring-[#45475a]/50

link:
  text-[#cba6f7] bg-transparent underline-offset-4
  hover:underline
  focus-visible:ring-[#cba6f7]/50
```

### Props API

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  asChild?: boolean; // Radix Slot pattern
}
```

### Accessibility

- `role="button"` (native)
- `aria-disabled="true"` when disabled (prefer over HTML `disabled` for focusability)
- `aria-busy="true"` when loading
- `aria-label` required when button has only an icon (no text)
- Keyboard: `Enter` and `Space` activate. `Tab` for focus navigation.
- Focus ring must be visible at all times in focus-visible state.
- Minimum touch target: 44x44px on mobile (achieved via `lg` size or padding).

---

## 3. Input

Text input fields for forms and search interfaces.

### Anatomy

```
  Label (optional)
+--[left-icon]--[input text / placeholder]--[clear-btn / right-icon]--+
|                          Input Field                                  |
+-----------------------------------------------------------------------+
  Helper text / Error message (optional)
```

### Variants

| Variant | Border | Background | Usage |
|---------|--------|------------|-------|
| `default` | `#45475a` 1px | `#313244` | Standard text inputs |
| `error` | `#f38ba8` 1px | `#313244` | Validation error state |
| `ghost` | none | transparent | Inline editing, search bars |

### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| `sm` | 32px | 8px horiz, -- vert | 13px |
| `md` | 36px | 12px horiz, -- vert | 14px |
| `lg` | 44px | 16px horiz, -- vert | 15px |

### States

| State | Visual Changes |
|-------|---------------|
| **Default** | Border `#45475a`, bg `#313244` |
| **Placeholder** | Text color `#6c7086`, font-style normal |
| **Hover** | Border lightens to `#585b70` |
| **Focus** | Border `#cba6f7`, ring `2px rgba(203,166,247,0.25)`, bg stays |
| **Filled** | Text `#cdd6f4`, clear button appears (if `clearable`) |
| **Error** | Border `#f38ba8`, ring `2px rgba(243,139,168,0.25)` on focus |
| **Disabled** | Opacity `0.5`, cursor `not-allowed`, bg `#313244` |
| **Read-only** | No border change on focus, cursor `default` |

### Label

- Position: Above the input, 4px margin-bottom
- Font: Inter 13px Medium (`--text-sm`, font-weight 500)
- Color: `#cdd6f4`
- Required indicator: Red asterisk `*` in `#f38ba8` after label text

### Helper / Error Text

- Position: Below the input, 4px margin-top
- Font: Inter 12px Regular (`--text-xs`)
- Helper color: `#a6adc8`
- Error color: `#f38ba8`
- Error icon: 12px warning icon before text (optional)

### Styling (Tailwind)

```
Base:
  flex h-9 w-full rounded-lg border bg-[#313244] px-3
  text-sm text-[#cdd6f4] font-normal
  transition-colors duration-[120ms]
  placeholder:text-[#6c7086]
  focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e2e]
  disabled:cursor-not-allowed disabled:opacity-50

default:
  border-[#45475a]
  hover:border-[#585b70]
  focus-visible:border-[#cba6f7] focus-visible:ring-[#cba6f7]/25

error:
  border-[#f38ba8]
  focus-visible:border-[#f38ba8] focus-visible:ring-[#f38ba8]/25
```

### Props API

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'ghost';
  inputSize?: 'sm' | 'md' | 'lg';  // avoid conflict with HTML size attr
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}
```

### Accessibility

- `<label>` element linked via `htmlFor`/`id`
- `aria-invalid="true"` when in error state
- `aria-describedby` pointing to error/hint text element
- `aria-required="true"` when required
- Clear button: `aria-label="Clear input"`
- Error announced by screen reader via `role="alert"` on error text container

---

## 4. Card

Container component for grouping related content.

### Anatomy

```
+----------------------------------------------+
|  Header (optional)                            |
|    Title                   Action button      |
|    Description                                |
|-----------------------------------------------|
|  Content                                      |
|    (arbitrary content)                        |
|-----------------------------------------------|
|  Footer (optional)                            |
|    Actions                                    |
+----------------------------------------------+
```

### Variants

| Variant | Background | Border | Shadow | Usage |
|---------|------------|--------|--------|-------|
| `default` | `#313244` | `#45475a` 1px | none | Standard cards |
| `interactive` | `#313244` | `#45475a` 1px | none; hover: `--shadow-sm` | Clickable cards |
| `flat` | `#313244` | none | none | Minimal cards, nested contexts |

### Dimensions

- Default padding: 16px (`--space-4`) all sides
- Header bottom padding: 12px (`--space-3`)
- Footer top padding: 12px with top border `#45475a`
- Border radius: 12px (`--radius-xl`)
- Min width: none (fills container)
- Max width: determined by parent layout

### Title and Description

- Title: Inter 16px SemiBold (`--text-lg` equivalent at 16px, weight 600), color `#cdd6f4`
- Description: Inter 14px Regular, color `#a6adc8`, margin-top 4px

### States (interactive variant only)

| State | Changes |
|-------|---------|
| **Hover** | Border `#585b70`, shadow `--shadow-sm`, slight bg lighten |
| **Active** | Scale `0.99` |
| **Focus-visible** | Ring 2px `#cba6f7`, offset 2px |

### Styling (Tailwind)

```
Base:
  rounded-xl border bg-[#313244] text-[#cdd6f4]

default:
  border-[#45475a]

interactive:
  border-[#45475a] cursor-pointer
  transition-all duration-[120ms]
  hover:border-[#585b70] hover:shadow-sm
  active:scale-[0.99]
  focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-[#cba6f7] focus-visible:ring-offset-2
  focus-visible:ring-offset-[#1e1e2e]

flat:
  border-transparent

CardHeader:
  flex flex-col space-y-1 p-4 pb-3

CardTitle:
  text-base font-semibold leading-none tracking-tight text-[#cdd6f4]

CardDescription:
  text-sm text-[#a6adc8]

CardContent:
  p-4 pt-0

CardFooter:
  flex items-center p-4 pt-3 border-t border-[#45475a]
```

### Props API

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'flat';
  padding?: 'sm' | 'md' | 'lg'; // sm=12px, md=16px, lg=24px
  asChild?: boolean;
}

// Compound components
Card.Header: React.FC<React.HTMLAttributes<HTMLDivElement>>
Card.Title: React.FC<React.HTMLAttributes<HTMLHeadingElement>>
Card.Description: React.FC<React.HTMLAttributes<HTMLParagraphElement>>
Card.Content: React.FC<React.HTMLAttributes<HTMLDivElement>>
Card.Footer: React.FC<React.HTMLAttributes<HTMLDivElement>>
```

### Accessibility

- Use semantic HTML: `<article>` or `<section>` when appropriate
- Interactive cards should be `<a>` or `<button>` (via `asChild`)
- Card title should use appropriate heading level (`h3`, `h4`)
- Focus indicator visible on interactive variant

---

## 5. Sidebar Item

Navigation items in the left sidebar file explorer and right sidebar panels.

### Anatomy

```
+--[expand-chevron]--[icon]--[label]--[count-badge]--[action-btn]--+
|                        Sidebar Item                                |
+--------------------------------------------------------------------+
```

### Variants

| Variant | Background | Text | Usage |
|---------|------------|------|-------|
| **Normal** | transparent | `#cdd6f4` | Default state |
| **Hover** | `#313244` | `#cdd6f4` | Mouse over |
| **Active/Selected** | `#45475a` | `#cdd6f4` | Currently selected item |
| **Focused** | transparent + ring | `#cdd6f4` | Keyboard focus |
| **Muted** | transparent | `#a6adc8` | Inactive/secondary items |

### Dimensions

- Height: 32px (compact) or 36px (default)
- Horizontal padding: 8px left (with indentation for tree depth), 8px right
- Tree indent: 16px per depth level
- Icon size: 16px, gap to label: 8px
- Border radius: 6px (`--radius-md`)
- Full width minus 8px margin on each side (within sidebar)

### Tree Node Specifics

- Expand chevron: 16px, rotates 90 degrees when expanded
- Folder icon: 16px, filled folder or open folder state
- File icon: 16px, varies by file type (md, excalidraw, etc.)
- Drag handle: appears on hover, left of chevron/icon
- Rename: inline input field replacing label text

### States Detail

| State | Visual |
|-------|--------|
| **Normal** | bg transparent, text `#cdd6f4`, icon `#a6adc8` |
| **Hover** | bg `#313244`, text `#cdd6f4`, icon `#cdd6f4`, action buttons appear |
| **Active** | bg `#45475a`, text `#cdd6f4`, left border 2px `#cba6f7` (accent indicator) |
| **Focus-visible** | Ring 2px `#cba6f7` inset |
| **Drag over** | bg `rgba(203,166,247,0.1)`, border dashed 1px `#cba6f7` |
| **Dragging** | opacity 0.5, ghost element follows cursor |

### Styling (Tailwind)

```
Base:
  flex items-center gap-2 h-8 px-2 mx-2 rounded-md
  text-sm font-medium text-[#cdd6f4]
  cursor-pointer select-none
  transition-colors duration-[120ms]

normal:
  bg-transparent

hover:
  bg-[#313244]
  [& .action-btn]: opacity-100

active:
  bg-[#45475a]
  border-l-2 border-l-[#cba6f7] pl-[6px]  // compensate for border

focus-visible:
  outline-none ring-2 ring-inset ring-[#cba6f7]

Icon:
  w-4 h-4 text-[#a6adc8] shrink-0
  group-hover:text-[#cdd6f4]

Label:
  truncate flex-1 text-sm

Action buttons:
  opacity-0 group-hover:opacity-100
  h-5 w-5 rounded-sm hover:bg-[#585b70]
  transition-opacity duration-[120ms]

Count badge:
  text-xs text-[#a6adc8] bg-[#45475a] rounded-full px-1.5 min-w-[20px] text-center
```

### Props API

```typescript
interface SidebarItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  depth?: number; // tree indentation level
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  badge?: string | number;
  actions?: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: (e: React.MouseEvent) => void;
  }>;
  draggable?: boolean;
  droppable?: boolean;
}
```

### Accessibility

- `role="treeitem"` for file explorer items
- `aria-expanded` for expandable items
- `aria-selected` for active item
- `aria-level` for tree depth
- Keyboard: `ArrowDown`/`ArrowUp` to navigate, `ArrowRight` to expand, `ArrowLeft` to collapse
- `Enter` or `Space` to select
- Context menu via `Shift+F10`

---

## 6. Tab Bar

Horizontal tab strip for open notes, supporting reorder and close.

### Anatomy

```
+----[Tab]----[Tab (active)]----[Tab]----[+ New]----+
|  icon  label  close-btn  |  ...                    |
+------------------------------------------------------------+
```

### Container

- Height: 38px (`--tabbar-height`)
- Background: `#1e1e2e` (base background)
- Bottom border: 1px `#45475a`
- Overflow: horizontal scroll with fade gradients on edges
- New tab button: `+` icon at end, 28px square, ghost style

### Tab Item Variants

| State | Background | Text | Border | Close Button |
|-------|------------|------|--------|-------------|
| **Inactive** | transparent | `#a6adc8` | none | hidden, shown on hover |
| **Active** | `#313244` | `#cdd6f4` | bottom 2px `#cba6f7` | always visible |
| **Hover (inactive)** | `#313244` (subtle) | `#cdd6f4` | none | visible |
| **Dragging** | `#313244` opacity 0.8 | `#cdd6f4` | none | hidden |
| **Modified (unsaved)** | same as state | same | dot indicator `#cba6f7` before close | -- |

### Tab Item Dimensions

- Height: 38px (matches container)
- Padding: 12px horizontal
- Min width: 80px
- Max width: 200px
- Gap between icon and label: 6px
- Close button: 16px, 4px from right edge
- File icon: 14px, matches file type
- Font: Inter 13px Medium
- Border radius: 0 (tabs are flush with bar)
- Active bottom border radius: none (flat accent line)

### Modified Indicator

When a tab has unsaved changes, a small dot (6px diameter, `#cba6f7`) replaces or overlays the close button. On hover the close button returns.

### Styling (Tailwind)

```
TabBar container:
  flex items-end h-[38px] bg-[#1e1e2e] border-b border-[#45475a]
  overflow-x-auto scrollbar-none

Tab (inactive):
  flex items-center gap-1.5 h-full px-3
  text-[13px] font-medium text-[#a6adc8]
  cursor-pointer select-none
  transition-colors duration-[120ms]
  hover:text-[#cdd6f4] hover:bg-[#313244]/50
  border-b-2 border-b-transparent

Tab (active):
  flex items-center gap-1.5 h-full px-3
  text-[13px] font-medium text-[#cdd6f4]
  bg-[#313244]
  border-b-2 border-b-[#cba6f7]

Close button:
  w-4 h-4 rounded-sm
  text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#585b70]
  opacity-0 group-hover:opacity-100
  // always visible on active tab:
  group-data-[active=true]:opacity-100

New tab button:
  flex items-center justify-center w-7 h-7
  rounded-md mx-1
  text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#45475a]
  transition-colors duration-[120ms]
```

### Props API

```typescript
interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  onNewTab: () => void;
}

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  modified?: boolean;
  pinned?: boolean;
}
```

### Accessibility

- `role="tablist"` on container
- `role="tab"` on each tab
- `aria-selected` on active tab
- `aria-controls` pointing to tab panel
- Keyboard: `ArrowLeft`/`ArrowRight` to move between tabs
- `Ctrl+W` / `Cmd+W` to close active tab
- `Ctrl+Tab` / `Cmd+Tab` to cycle tabs
- Close button: `aria-label="Close tab: {filename}"`
- Screen reader: announce tab count and position ("Tab 2 of 5")

---

## 7. Command Palette

Full-screen search overlay for commands, files, and settings navigation. Activated via `Cmd+P` / `Ctrl+P`.

### Anatomy

```
+--------------------------------------------------+
|  [search-icon]  [input field]        [esc hint]   |
|--------------------------------------------------|
|  Group Label                                      |
|  > [icon]  Command Name           [Cmd+K]        |
|    [icon]  Command Name           [Cmd+Shift+P]  |
|  * [icon]  Selected Command       [Enter]        |  <-- highlighted
|                                                   |
|  Group Label                                      |
|    [icon]  Command Name                           |
+--------------------------------------------------+
```

### Overlay

- Background: `rgba(0, 0, 0, 0.6)` (60% black overlay)
- Closes on overlay click or `Escape`
- Appears centered, 20% from top of viewport
- Entry animation: fade in 200ms + slide down 8px

### Modal Container

- Width: 560px (max), min 400px
- Max height: 400px
- Background: `#313244`
- Border: 1px `#45475a`
- Border radius: 12px (`--radius-xl`)
- Shadow: `--shadow-floating`
- Overflow: hidden (scrolls internally)

### Search Input

- Full width, no visible border
- Height: 48px
- Padding: 16px horizontal
- Background: transparent (inherits from container)
- Text: Inter 15px Regular, `#cdd6f4`
- Placeholder: "Type a command..." in `#6c7086`
- Search icon: 18px `#a6adc8` on left
- Bottom border: 1px `#45475a` separating from results

### Result List

- Max height: 352px (400 - 48 input)
- Scrollable with `ScrollArea` component
- Padding: 4px

### Group Label

- Text: Inter 12px Medium, `#a6adc8`
- Padding: 8px horizontal, 8px top, 4px bottom
- Uppercase or title case

### Result Item

- Height: 36px
- Padding: 8px horizontal
- Border radius: 6px
- Gap: 8px between icon and text

| State | Background | Text |
|-------|------------|------|
| **Normal** | transparent | `#cdd6f4` |
| **Highlighted/Selected** | `#45475a` | `#cdd6f4` |
| **Hover** | `#45475a` (same as selected) | `#cdd6f4` |

### Keyboard Shortcut Display

- Aligned right, within result item
- Font: JetBrains Mono 11px, `#a6adc8`
- Key boxes: bg `#45475a`, border `#585b70`, radius 4px, padding 2px 6px
- Multiple keys separated by 4px gap
- Example: `[Cmd]` `[K]`

### Styling (Tailwind)

```
Overlay:
  fixed inset-0 z-50
  bg-black/60
  flex items-start justify-center pt-[20vh]
  animate-in fade-in duration-200

Container:
  w-[560px] max-h-[400px]
  bg-[#313244] border border-[#45475a]
  rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)]
  overflow-hidden
  animate-in slide-in-from-top-2 duration-200

Search input:
  flex items-center h-12 px-4 gap-3
  border-b border-[#45475a]

  Input:
    flex-1 bg-transparent text-[15px] text-[#cdd6f4]
    placeholder:text-[#6c7086]
    focus:outline-none

Result item:
  flex items-center gap-2 h-9 px-2 mx-1
  rounded-md text-sm text-[#cdd6f4]
  cursor-pointer

  data-[selected=true]:
    bg-[#45475a]

  hover:
    bg-[#45475a]

Keyboard shortcut:
  ml-auto flex items-center gap-1

Kbd:
  inline-flex items-center justify-center
  h-5 min-w-[20px] px-1.5
  bg-[#45475a] border border-[#585b70]
  rounded text-[11px] font-mono text-[#a6adc8]
```

### Props API

```typescript
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandGroup[];
  placeholder?: string;
  onSelect: (command: CommandItem) => void;
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string[]; // e.g., ['Cmd', 'K']
  description?: string;
  onSelect: () => void;
}
```

### Accessibility

- `role="dialog"` with `aria-modal="true"` on container
- `role="combobox"` on search input
- `role="listbox"` on results
- `role="option"` on each result item, `aria-selected` on highlighted
- `aria-label="Command palette"` on dialog
- Keyboard: `ArrowUp`/`ArrowDown` navigate results, `Enter` selects, `Escape` closes
- Focus trapped within palette while open
- Announced: "X results found" after filtering (live region)
- `Cmd+P` / `Ctrl+P` global shortcut to open

---

## 8. Dialog / Modal

Overlay dialogs for confirmations, forms, and focused interactions.

### Anatomy

```
[Overlay background]
+----------------------------------------------+
|  [close-x]                                    |
|  Title                                        |
|  Description text explaining the action       |
|                                               |
|  [Content area - forms, text, etc.]           |
|                                               |
|  --------------------------------------------|
|  Footer:       [Cancel]  [Confirm/Primary]    |
+----------------------------------------------+
```

### Overlay

- Background: `rgba(0, 0, 0, 0.6)` (60% black)
- Closes on click (unless `closeOnOverlay={false}`)
- Backdrop blur: `4px` (optional, subtle)

### Container

- Background: `#313244`
- Border: 1px `#45475a`
- Border radius: 12px (`--radius-xl`)
- Shadow: `--shadow-lg`
- Centered vertically and horizontally (with slight upward offset)
- Entry: scale from 0.95 + fade in, 200ms ease-out
- Exit: scale to 0.95 + fade out, 150ms ease-in

### Sizes

| Size | Width | Max Height | Usage |
|------|-------|-----------|-------|
| `sm` | 400px | 85vh | Simple confirmations |
| `md` | 500px | 85vh | Standard dialogs |
| `lg` | 640px | 85vh | Forms with multiple fields |
| `xl` | 800px | 85vh | Complex content |
| `full` | 90vw | 90vh | Full-screen dialogs |

### Internal Spacing

- All padding: 24px (`--space-6`)
- Title: Inter 18px SemiBold, `#cdd6f4`
- Description: Inter 14px Regular, `#a6adc8`, margin-top 8px
- Content area: margin-top 16px
- Footer: margin-top 24px, flex row, gap 8px, justify-end
- Close X button: absolute top-right, 16px from edges, 32x32 ghost button

### Footer Layout

- Buttons right-aligned by default
- Destructive actions: destructive button on left, cancel on right
- Cancel button: `outline` variant
- Confirm button: `primary` variant (or `destructive` for delete confirmations)
- Spacing between buttons: 8px

### Alert Dialog Variant

For irreversible actions (delete workspace, remove user):

- Title includes warning icon (triangle) in `#fab387`
- Description clearly states consequences
- Confirm button: `destructive` variant
- May include confirmation text input ("type workspace name to confirm")

### Styling (Tailwind)

```
Overlay:
  fixed inset-0 z-50 bg-black/60
  flex items-center justify-center
  animate-in fade-in duration-200

  // Optional blur:
  backdrop-blur-[4px]

Dialog container:
  relative w-full bg-[#313244]
  border border-[#45475a] rounded-xl
  shadow-[0_8px_24px_rgba(0,0,0,0.6)]
  animate-in fade-in-0 zoom-in-95 duration-200

  // Size variants
  max-w-[400px]  // sm
  max-w-[500px]  // md
  max-w-[640px]  // lg
  max-w-[800px]  // xl

DialogHeader:
  flex flex-col space-y-2 p-6 pb-0

DialogTitle:
  text-lg font-semibold text-[#cdd6f4]

DialogDescription:
  text-sm text-[#a6adc8]

DialogContent:
  p-6

DialogFooter:
  flex items-center justify-end gap-2 p-6 pt-0

DialogClose (X button):
  absolute right-4 top-4
  h-8 w-8 rounded-md
  flex items-center justify-center
  text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#45475a]
  transition-colors duration-[120ms]
```

### Props API

```typescript
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
}

// Compound components
Dialog.Header: React.FC<React.HTMLAttributes<HTMLDivElement>>
Dialog.Title: React.FC<React.HTMLAttributes<HTMLHeadingElement>>
Dialog.Description: React.FC<React.HTMLAttributes<HTMLParagraphElement>>
Dialog.Content: React.FC<React.HTMLAttributes<HTMLDivElement>>
Dialog.Footer: React.FC<React.HTMLAttributes<HTMLDivElement>>
Dialog.Close: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>>
```

### Accessibility

- `role="dialog"` with `aria-modal="true"`
- `aria-labelledby` pointing to title
- `aria-describedby` pointing to description
- Focus trapped inside dialog
- Initial focus on first focusable element (or close button)
- Focus returns to trigger element on close
- `Escape` closes (unless `closeOnEsc={false}`)
- Screen reader: announces dialog title on open
- Alert dialogs use `role="alertdialog"`

---

## 9. Badge

Small status indicators and labels.

### Variants

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| `default` | `#45475a` | `#cdd6f4` | none | General labels |
| `secondary` | `#313244` | `#a6adc8` | `#45475a` 1px | Subtle labels |
| `primary` | `rgba(203,166,247,0.15)` | `#cba6f7` | none | Primary accent |
| `destructive` | `rgba(243,139,168,0.15)` | `#f38ba8` | none | Errors, warnings |
| `success` | `rgba(166,227,161,0.15)` | `#a6e3a1` | none | Positive status |
| `outline` | transparent | `#cdd6f4` | `#45475a` 1px | Minimal style |

### Sizes

| Size | Height | Padding | Font |
|------|--------|---------|------|
| `sm` | 18px | 4px 6px | 11px |
| `md` | 22px | 4px 8px | 12px |
| `lg` | 26px | 4px 10px | 13px |

### Styling

- Border radius: `9999px` (pill shape)
- Font weight: 500 (Medium)
- Inline-flex, items-center
- Optional dot indicator: 6px circle before text
- Optional close/remove button (X): only on removable tags

---

## 10. Avatar

User representation with image, initials fallback, and status indicator.

### Variants

| Size | Dimensions | Font | Usage |
|------|-----------|------|-------|
| `xs` | 24x24 | 10px | Inline mentions, compact lists |
| `sm` | 28x28 | 11px | Comment threads, presence |
| `md` | 32x32 | 13px | Sidebar, tab presence |
| `lg` | 40x40 | 15px | Profile cards |
| `xl` | 56x56 | 20px | Account settings |

### States

- **Image loaded**: Shows user avatar image, object-fit cover
- **Fallback (initials)**: Shows 1-2 letters on colored background
  - Background: generated from user name hash (deterministic color)
  - Text: white or dark based on background luminance
- **Loading**: Skeleton pulse animation
- **Status indicator**: 8px dot at bottom-right
  - Online: `#a6e3a1`
  - Away: `#fab387`
  - Busy: `#f38ba8`
  - Offline: `#6c7086`

### Group Avatar

- Overlapping stack with -8px margin
- Max display: 4 + "+N" overflow badge
- Z-index descending so first avatar is on top
- Each avatar has 2px border in background color (`#1e1e2e`)

### Styling

```
Base:
  relative flex shrink-0 items-center justify-center
  overflow-hidden rounded-full bg-[#45475a]
  text-[#cdd6f4] font-medium

Status dot:
  absolute bottom-0 right-0
  w-2 h-2 rounded-full
  border-2 border-[#1e1e2e]

Group:
  flex -space-x-2
  [& > *]: ring-2 ring-[#1e1e2e]
```

---

## 11. Tooltip

Contextual information displayed on hover.

### Dimensions

- Max width: 300px
- Padding: 6px 12px
- Background: `#45475a`
- Text: Inter 13px Regular, `#cdd6f4`
- Border radius: 6px (`--radius-md`)
- Shadow: `--shadow-sm`
- Arrow: 6px, same color as background

### Timing

- Open delay: 700ms (default), 0ms (instant, for icon buttons)
- Close delay: 0ms
- Animation: fade in 150ms

### Positioning

- Side: `top` (default), `bottom`, `left`, `right`
- Alignment: `center` (default), `start`, `end`
- Side offset: 4px from trigger
- Collision-aware: auto-repositions if clipped

### Accessibility

- `role="tooltip"`
- Trigger has `aria-describedby` pointing to tooltip
- Not focusable (for info only, not interactive)
- Disappears on `Escape`

---

## 12. Dropdown Menu

Context menus and action menus.

### Anatomy

```
+---------------------------------------+
|  [icon]  Menu Item Label    [Cmd+X]   |
|  [icon]  Menu Item Label              |
|  ──────────────────────────── (sep)   |
|  [icon]  Submenu Label         >      |
|  ──────────────────────────── (sep)   |
|  [icon]  Destructive Item             |
+---------------------------------------+
```

### Container

- Background: `#313244`
- Border: 1px `#45475a`
- Border radius: 8px
- Shadow: `--shadow-md`
- Padding: 4px
- Min width: 180px
- Max width: 300px
- Max height: 400px (scrollable)

### Menu Item

- Height: 32px
- Padding: 8px horizontal
- Font: Inter 13px Regular, `#cdd6f4`
- Icon: 16px, `#a6adc8`, 8px gap to label
- Border radius: 4px (inner items)
- Shortcut text: JetBrains Mono 11px, `#6c7086`, right-aligned
- Submenu arrow: `>` chevron, `#6c7086`

### Item States

| State | Background | Text |
|-------|------------|------|
| **Normal** | transparent | `#cdd6f4` |
| **Highlighted** | `#45475a` | `#cdd6f4` |
| **Disabled** | transparent | `#6c7086`, opacity 0.5 |
| **Destructive** | transparent | `#f38ba8` |
| **Destructive + highlighted** | `rgba(243,139,168,0.1)` | `#f38ba8` |

### Separator

- Height: 1px
- Color: `#45475a`
- Margin: 4px horizontal, 4px vertical

### Accessibility

- `role="menu"` on container
- `role="menuitem"` on items
- `role="separator"` on dividers
- `aria-disabled` on disabled items
- Keyboard: `ArrowDown`/`ArrowUp` navigate, `Enter`/`Space` select
- `ArrowRight` opens submenu, `ArrowLeft` closes submenu
- Type-ahead: typing characters jumps to matching item
- Escape closes current menu level

---

## 13. Toast

Non-blocking notification messages.

### Anatomy

```
+--[icon]--[title]--[description]--[action-btn]--[close-x]--+
|                         Toast                               |
+-------------------------------------------------------------+
```

### Position

- Bottom-right of viewport, 16px from edges
- Stacked: newest on top, max 3 visible
- Enter: slide in from right + fade (300ms)
- Exit: slide out right + fade (200ms)

### Variants

| Variant | Icon Color | Left Border | Usage |
|---------|-----------|-------------|-------|
| `default` | `#cdd6f4` | none | General notifications |
| `success` | `#a6e3a1` | 3px `#a6e3a1` | Success confirmations |
| `error` | `#f38ba8` | 3px `#f38ba8` | Error alerts |
| `warning` | `#fab387` | 3px `#fab387` | Warning messages |

### Dimensions

- Width: 360px (min 300px, max 420px)
- Padding: 12px 16px
- Background: `#313244`
- Border: 1px `#45475a`
- Border radius: 8px
- Shadow: `--shadow-md`

### Content

- Title: Inter 14px Medium, `#cdd6f4`
- Description: Inter 13px Regular, `#a6adc8`, margin-top 4px
- Icon: 18px, color varies by variant
- Action button: ghost/link style, `#cba6f7`
- Close button: 16px X, `#a6adc8`, top-right corner

### Duration

- Default: 5000ms auto-dismiss
- Error: 8000ms (longer for error messages)
- Persistent: no auto-dismiss (user must close)
- Pause on hover

### Accessibility

- `role="status"` for informational
- `role="alert"` for errors/warnings
- `aria-live="polite"` for default, `aria-live="assertive"` for errors
- Dismiss button: `aria-label="Close notification"`
- Action button: clearly labeled

---

## 14. Accessibility Standards

All components must meet WCAG 2.1 AA. Key requirements:

### Color Contrast

| Element | Foreground | Background | Ratio | Requirement |
|---------|-----------|------------|-------|------------|
| Body text | `#cdd6f4` | `#1e1e2e` | 11.1:1 | AAA (pass) |
| Secondary text | `#a6adc8` | `#1e1e2e` | 7.0:1 | AAA (pass) |
| Muted text | `#6c7086` | `#1e1e2e` | 3.5:1 | AA large (pass) |
| Primary on card | `#cdd6f4` | `#313244` | 7.6:1 | AAA (pass) |
| Placeholder | `#6c7086` | `#313244` | 2.4:1 | Decorative (acceptable) |
| Button text | `#1e1e2e` | `#cba6f7` | 8.8:1 | AAA (pass) |
| Destructive text | `#1e1e2e` | `#f38ba8` | 7.2:1 | AAA (pass) |

### Focus Indicators

- All interactive elements must have visible focus indicators
- Default: 2px ring, offset 2px, `#cba6f7` with 50% opacity
- Must be visible against all background colors
- Never use `outline: none` without replacement

### Keyboard Navigation

- All interactive elements reachable via `Tab`
- Logical tab order following visual layout
- No keyboard traps (except modal dialogs with focus trap)
- Skip links for main content areas
- Shortcut keys documented and customizable

### Screen Reader

- All images have `alt` text
- Icon-only buttons have `aria-label`
- Form fields have associated labels
- Error messages announced via `aria-live`
- Loading states announced via `aria-busy`
- Dynamic content changes announced appropriately

### Motion

- Respect `prefers-reduced-motion`: disable animations
- No auto-playing animations that cannot be paused
- Transition durations under 5 seconds

---

## 15. Implementation Notes

### CVA (class-variance-authority) Pattern

All components use CVA for variant management:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // Base classes
  'inline-flex items-center justify-center rounded-lg font-medium text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg-base] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-[--color-primary] text-[--color-primary-foreground] hover:bg-[--color-primary-hover] focus-visible:ring-[--color-primary]/50',
        secondary: 'bg-[--color-bg-hover] text-[--color-text-primary] hover:bg-[--color-bg-active] focus-visible:ring-[--color-bg-hover]/50',
        outline: 'border border-[--color-border] text-[--color-text-primary] bg-transparent hover:bg-[--color-bg-hover] focus-visible:ring-[--color-border]/50',
        destructive: 'bg-[--color-destructive] text-[--color-destructive-foreground] hover:bg-[--color-destructive-hover] focus-visible:ring-[--color-destructive]/50',
        ghost: 'text-[--color-text-primary] bg-transparent hover:bg-[--color-bg-hover] focus-visible:ring-[--color-bg-hover]/50',
        link: 'text-[--color-primary] bg-transparent underline-offset-4 hover:underline focus-visible:ring-[--color-primary]/50',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] gap-1.5',
        md: 'h-9 px-4 text-sm gap-2',
        lg: 'h-11 px-6 text-[15px] gap-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
```

### Token Usage in Tailwind CSS 4

Tailwind CSS 4 supports CSS custom properties natively:

```css
/* Use tokens directly in Tailwind classes */
.component {
  background-color: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

/* Or via Tailwind arbitrary values */
/* bg-[--color-bg-elevated] text-[--color-text-primary] */
```

### Component File Structure

```
packages/ui/src/
  components/
    button/
      button.tsx          # Component implementation
      button.variants.ts  # CVA variant definitions
      button.test.tsx     # Unit tests
      index.ts            # Barrel export
    input/
      input.tsx
      input.variants.ts
      input.test.tsx
      index.ts
    card/
      card.tsx
      card.variants.ts
      card.test.tsx
      index.ts
    ...
  styles/
    tokens.css            # Design token definitions
    dark.css              # Dark theme (default)
    light.css             # Light theme overrides
    base.css              # Reset + base styles
  index.ts                # Main barrel export
```

### Radix UI Primitive Mapping

| Notesaner Component | Radix Primitive | Notes |
|---------------------|-----------------|-------|
| Button | -- (native) | No Radix needed |
| Dialog | `@radix-ui/react-dialog` | Focus trap, overlay |
| AlertDialog | `@radix-ui/react-alert-dialog` | Confirmation pattern |
| DropdownMenu | `@radix-ui/react-dropdown-menu` | Context menus too |
| Tooltip | `@radix-ui/react-tooltip` | Delayed display |
| Popover | `@radix-ui/react-popover` | Floating content |
| Tabs | `@radix-ui/react-tabs` | Note editor mode tabs |
| ScrollArea | `@radix-ui/react-scroll-area` | Custom scrollbars |
| Select | `@radix-ui/react-select` | Native-like select |
| Switch | `@radix-ui/react-switch` | Boolean toggles |
| Checkbox | `@radix-ui/react-checkbox` | With indeterminate |
| Accordion | `@radix-ui/react-accordion` | Settings panels |
| Collapsible | `@radix-ui/react-collapsible` | Sidebar sections |
| Separator | `@radix-ui/react-separator` | Visual dividers |
| Slider | `@radix-ui/react-slider` | Range inputs |

### Command Palette Stack

Built on `cmdk` (shadcn/ui Command component):

```typescript
import { Command } from 'cmdk';
// Wraps: Command, CommandDialog, CommandInput, CommandList,
//        CommandEmpty, CommandGroup, CommandItem, CommandSeparator
```

### Testing Requirements

Each component must have:
- Unit tests (Vitest) covering all variants and states
- Accessibility tests via `@testing-library/jest-dom` + `axe-core`
- Visual regression tests (optional, via Playwright)
- Storybook stories for all variants (when Storybook is set up)

Target: >90% coverage per component.

---

## Appendix: Visual Reference Summary

### Component Dimensions Quick Reference

```
Component          Width        Height      Radius
Button (md)        auto         36px        8px
Input (md)         full         36px        8px
Card               full         auto        12px
Sidebar Item       full-16px    32px        6px
Tab                80-200px     38px        0px
Command Palette    560px        400px max   12px
Dialog (md)        500px        auto        12px
Badge (md)         auto         22px        9999px
Avatar (md)        32px         32px        9999px
Tooltip            auto/300max  auto        6px
Dropdown Menu      180-300px    auto/400max 8px
Toast              360px        auto        8px
```

### Color Quick Reference Card

```
Background layers (darkest to lightest):
  #181825  Sidebar surface
  #1e1e2e  Base workspace
  #313244  Elevated (cards, modals, inputs)
  #45475a  Hover / Active states / Borders
  #585b70  Pressed / Active states

Text layers (brightest to dimmest):
  #cdd6f4  Primary text
  #a6adc8  Secondary / muted text
  #6c7086  Disabled / placeholder

Accent colors:
  #cba6f7  Primary (Mauve) - buttons, focus rings, active indicators
  #f5c2e7  Secondary (Pink) - highlights, accents
  #f38ba8  Destructive (Red) - errors, delete actions
  #a6e3a1  Success (Green) - confirmations
  #fab387  Warning (Peach) - cautions
  #89dceb  Info (Sky) - informational
```
