# Notesaner -- Screen Mockups & Wireframe Specification

**Version**: 1.0.0
**Date**: 2026-03-25
**Author**: UI/UX Design Agent
**Canvas**: 1440x900 (desktop reference)
**Design Tool**: ASCII wireframes + detailed specs (OpenPencil .fig pending MCP integration)

---

## Design Tokens Reference

All screens use the Catppuccin Mocha-derived palette specified in the frontend architecture:

```yaml
colors:
  background:
    base: "#1e1e2e"         # Main background, editor area
    sidebar: "#181825"       # Left/right sidebars, panels
    card: "#313244"          # Cards, elevated surfaces, code blocks
    surface: "#45475a"       # Borders, active states, dividers
    overlay: "#585b70"       # Hover states, secondary borders

  text:
    primary: "#cdd6f4"       # Body text, headings
    muted: "#a6adc8"         # Secondary text, placeholders, timestamps
    subtle: "#7f849c"        # Disabled text, hint text

  accent:
    primary: "#cba6f7"       # Purple - primary actions, links, wiki links
    pink: "#f5c2e7"          # Pink - secondary accent, hover states
    green: "#a6e3a1"         # Success states, online indicators
    red: "#f38ba8"           # Error states, destructive actions
    yellow: "#f9e2af"        # Warning states, star ratings
    blue: "#89b4fa"          # Info states, links in published view
    peach: "#fab387"         # Tertiary accent, tag badges

  border:
    default: "#45475a"
    subtle: "#313244"
    focus: "#cba6f7"

typography:
  family:
    sans: "'Inter', system-ui, -apple-system, sans-serif"
    mono: "'JetBrains Mono', 'Fira Code', monospace"

  scale:
    h1: "28px / 36px, weight 700, tracking -0.02em"
    h2: "22px / 30px, weight 600, tracking -0.01em"
    h3: "18px / 26px, weight 600"
    body: "14px / 22px, weight 400"
    small: "12px / 18px, weight 400"
    label: "13px / 20px, weight 500"
    caption: "11px / 16px, weight 400"

spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px

effects:
  radius:
    sm: 4px
    md: 8px
    lg: 12px
    full: 9999px

  shadow:
    card: "0 4px 16px rgba(0, 0, 0, 0.3)"
    dropdown: "0 8px 24px rgba(0, 0, 0, 0.4)"
    modal: "0 16px 48px rgba(0, 0, 0, 0.5)"

  transition:
    fast: "150ms ease-in-out"
    base: "200ms ease-in-out"
    slow: "300ms ease-in-out"
```

---

## Screen 1: Login Page

**Route**: `/login`
**Canvas**: 1440x900
**Background**: `#1e1e2e` full bleed

### Wireframe

```
+------------------------------------------------------------------+  1440x900
|                        #1e1e2e background                        |
|                                                                  |
|                                                                  |
|                     +------------------------+                   |
|                     |      #313244 card      |  400x520          |
|                     |      radius: 12px      |  shadow: card     |
|                     |      padding: 32px     |                   |
|                     |                        |                   |
|                     |    [Notesaner Logo]    |  Inter 28px Bold  |
|                     |    #cba6f7 wordmark    |  center aligned   |
|                     |                        |                   |
|                     |    "Welcome back"      |  #a6adc8 14px     |
|                     |                        |                   |
|                     |  +------------------+  |                   |
|                     |  | Email            |  |  Input h:40px     |
|                     |  | user@example.com |  |  bg:#1e1e2e       |
|                     |  +------------------+  |  border:#45475a   |
|                     |                        |  radius:8px       |
|                     |  +------------------+  |                   |
|                     |  | Password     [*] |  |  [*] = show/hide |
|                     |  | ............     |  |  toggle icon      |
|                     |  +------------------+  |                   |
|                     |                        |                   |
|                     |  "Forgot password?"    |  #cba6f7 12px     |
|                     |   right-aligned link   |                   |
|                     |                        |                   |
|                     |  +------------------+  |                   |
|                     |  |    Sign In       |  |  bg:#cba6f7       |
|                     |  +------------------+  |  text:#1e1e2e     |
|                     |                        |  h:44px, radius:8 |
|                     |  ----- or -----        |  #45475a line     |
|                     |                        |  "or" #a6adc8     |
|                     |  +------------------+  |                   |
|                     |  | Sign in with SSO |  |  bg:#1e1e2e       |
|                     |  +------------------+  |  border:#45475a   |
|                     |                        |  text:#cdd6f4     |
|                     |  "Don't have account?" |  #a6adc8 13px     |
|                     |  "Create account"      |  #cba6f7 link     |
|                     |                        |                   |
|                     +------------------------+                   |
|                                                                  |
+------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position |
|---------|-------|--------|----------|
| Background | 1440px | 900px | Full viewport |
| Login card | 400px | auto (min 520px) | Centered H+V |
| Card padding | 32px all sides | -- | -- |
| Logo area | 100% card width | 64px | Top of card |
| Input fields | 100% (336px) | 40px | Stacked, 12px gap |
| Sign In button | 100% (336px) | 44px | Below inputs, 20px gap |
| SSO button | 100% (336px) | 44px | Below divider |
| Divider | 100% (336px) | 20px | 16px gap above/below |

### Component Specification

**Input Field**
```yaml
component: Input
variant: default
styling:
  background: "#1e1e2e"
  border: "1px solid #45475a"
  border_radius: 8px
  height: 40px
  padding: "0 12px"
  font: "Inter 14px #cdd6f4"
  placeholder_color: "#7f849c"
states:
  focus:
    border_color: "#cba6f7"
    box_shadow: "0 0 0 2px rgba(203, 166, 247, 0.2)"
  error:
    border_color: "#f38ba8"
    box_shadow: "0 0 0 2px rgba(243, 139, 168, 0.2)"
  filled:
    label_position: "floating above, 11px, #a6adc8"
```

**Sign In Button (Primary)**
```yaml
component: Button
variant: primary
styling:
  background: "#cba6f7"
  text_color: "#1e1e2e"
  font: "Inter 14px, weight 600"
  height: 44px
  border_radius: 8px
  width: "100%"
states:
  hover:
    background: "#f5c2e7"
    transition: "200ms ease-in-out"
  active:
    background: "#b4befe"
    transform: "scale(0.98)"
  loading:
    content: "Spinner icon + 'Signing in...'"
    pointer_events: none
  disabled:
    opacity: 0.5
    cursor: not-allowed
```

**SSO Button (Secondary)**
```yaml
component: Button
variant: secondary
styling:
  background: "transparent"
  border: "1px solid #45475a"
  text_color: "#cdd6f4"
  font: "Inter 14px, weight 500"
  height: 44px
  border_radius: 8px
states:
  hover:
    background: "#313244"
    border_color: "#585b70"
```

### Interactive States

1. **Default**: Empty form, inputs show placeholder text
2. **Filling**: Floating labels animate above inputs (150ms ease-out, translateY -24px)
3. **Validation Error**: Red border on invalid field, error text below in `#f38ba8` 12px
4. **Loading**: Sign In button shows spinner, all inputs become `disabled`, opacity 0.7
5. **SSO Redirect**: Full-page overlay with centered spinner and text "Redirecting to your identity provider..."

### Responsive Rules

| Breakpoint | Changes |
|------------|---------|
| Desktop (>=1280px) | Card centered, subtle CSS gradient background pattern |
| Laptop (>=1024px) | Same as desktop |
| Tablet (>=768px) | Card centered, simplified background |
| Mobile (<768px) | Card full-width with 16px horizontal margins, no background pattern |

---

## Screen 2: Main Workspace (PRIMARY SCREEN)

**Route**: `/workspaces/:id/notes/:noteId`
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+----------------------------------------------+-----------+
|R |  LEFT    |              MAIN EDITOR AREA                 |  RIGHT   | 900px
|I |  SIDEBAR |                                               |  SIDEBAR |
|B |  260px   |              960px (flexible)                 |  280px   |
|B |  #181825 |              #1e1e2e                          |  #181825 |
|O |          |                                               |          |
|N |          +----------------------------------------------+|          |
|  |          | [note.md] [draft.md] [+]     Tab Bar  h:36px ||          |
|48|          +----------------------------------------------+|          |
|px|          |                                               |          |
|  | [Search] |  # My Note Title                              | BACKLINKS|
|  | +------+ |  ___________________________________          | -------- |
|  | |      | |                                               | 5 notes  |
|  | +------+ |  Here is some body text in the editor.        | link here|
|  |          |  This is a paragraph with a [[Wiki Link]]     |          |
|  | Workspace|  in purple (#cba6f7) inline.                  | > Note A |
|  | -------- |                                               |   "...con|
|  | > Folder |  ```python                                    |   text.."|
|  |   note.md|  +----------------------------------------+   |          |
|  |   draft  |  | def hello():            #313244 bg     |   | > Note B |
|  | > Folder2|  |     print("world")      code block     |   |   "...sni|
|  |   ideas  |  +----------------------------------------+   |   ppet." |
|  |          |                                               |          |
|  |          |  More paragraph text continues here with      | OUTLINE  |
|  |          |  regular body content.                        | -------- |
|  |          |                                               | H1 Title |
|  |          |  > [!NOTE]                                    |  H2 Intro|
|  |          |  > This is a callout block with a colored     |  H2 Body |
|  |          |  > left border.                               |   H3 Sub |
|  |          |                                               |  H2 End  |
|  |          |                                               |          |
|  |----------+                                               |          |
|  | Settings |                                               |          |
|  | [Avatar] |                                               |          |
+--+----------+----------------------------------------------+-----------+
|  Synced | 342 words | Ln 12, Col 4 | WYSIWYG        Status Bar h:24px |
+------------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Ribbon | 48px | 100% viewport | Left edge | `#181825` |
| Left Sidebar | 260px | calc(100vh - 24px) | Right of ribbon | `#181825` |
| Tab Bar | remaining width | 36px | Top of editor area | `#181825` |
| Editor Area | remaining (flex) | calc(100vh - 60px) | Center | `#1e1e2e` |
| Right Sidebar | 280px | calc(100vh - 24px) | Right edge | `#181825` |
| Status Bar | 100% viewport | 24px | Bottom edge | `#181825` |

### Component: Ribbon (48px vertical strip)

```yaml
component: Ribbon
width: 48px
height: "100vh"
background: "#181825"
border_right: "1px solid #313244"

icons:
  top_group:  # 8px padding-top, 8px gap between icons
    - new_note: "PenSquare icon, 20px, #a6adc8"
    - file_explorer: "FolderTree icon, 20px, #cdd6f4 (active)"
    - search: "Search icon, 20px, #a6adc8"
    - graph: "Network icon, 20px, #a6adc8"
    - bookmarks: "Bookmark icon, 20px, #a6adc8"
    - tags: "Tags icon, 20px, #a6adc8"

  bottom_group:  # Pinned to bottom, 8px gap, 8px padding-bottom
    - settings: "Settings icon, 20px, #a6adc8"
    - user_avatar: "Circle 28px, bg #cba6f7, initials #1e1e2e"

icon_button:
  size: 36px
  border_radius: 8px
  display: "flex center"
  states:
    default: "transparent bg"
    hover: "bg #313244"
    active: "bg #45475a, icon #cdd6f4, left border 2px #cba6f7"
```

### Component: Left Sidebar

```yaml
component: LeftSidebar
width: 260px
background: "#181825"
border_right: "1px solid #313244"
padding: "8px 8px"

sections:
  search_bar:
    height: 32px
    margin_bottom: 8px
    background: "#313244"
    border_radius: 8px
    padding: "0 10px"
    icon: "Search 14px #7f849c left"
    placeholder: "Search notes..."
    font: "Inter 13px #7f849c"
    focus_border: "#cba6f7"

  workspace_header:
    height: 28px
    margin_bottom: 4px
    font: "Inter 13px weight 600 #cdd6f4"
    content: "Workspace Name"
    chevron: "Down arrow 12px #a6adc8 right"

  file_tree:
    flex: 1
    overflow: "auto (custom scrollbar #45475a, 4px wide)"

    folder_node:
      height: 28px
      padding: "0 8px 0 (indent * 16px + 8px)"
      border_radius: 4px
      icon_size: 16px
      font: "Inter 13px #cdd6f4"
      chevron: "8px #a6adc8, rotates 90deg on expand"
      hover: "bg #313244"

    file_node:
      height: 28px
      padding: "0 8px 0 (indent * 16px + 24px)"
      border_radius: 4px
      icon_size: 14px
      font: "Inter 13px #a6adc8"
      hover: "bg #313244"
      active: "bg #45475a, text #cdd6f4"

    indent_depth: 16px per level

  bottom_actions:
    border_top: "1px solid #313244"
    padding_top: 8px
    items:
      - settings: "Settings icon + 'Settings', 28px height"
      - plugins: "Puzzle icon + 'Plugins', 28px height"
```

### Component: Tab Bar

```yaml
component: TabBar
height: 36px
background: "#181825"
border_bottom: "1px solid #313244"
display: "flex row"
overflow: "auto hidden"

tab:
  height: 36px
  padding: "0 12px"
  font: "Inter 12px"
  max_width: 180px
  min_width: 100px
  display: "flex row center gap:6px"

  states:
    inactive:
      background: "transparent"
      text: "#7f849c"
      border_bottom: "none"
    active:
      background: "#1e1e2e"
      text: "#cdd6f4"
      border_bottom: "2px solid #cba6f7"
    hover:
      background: "#313244"

  close_button:
    size: 16px
    icon: "X 10px #7f849c"
    opacity: 0 (show on tab hover)
    hover: "bg #45475a, radius full"

new_tab_button:
  size: 36px
  icon: "Plus 14px #7f849c"
  hover: "bg #313244"
```

### Component: Editor Area

```yaml
component: EditorArea
background: "#1e1e2e"
padding: "32px 48px"
max_content_width: 720px
margin: "0 auto"

title:
  font: "Inter 28px weight 700 #cdd6f4"
  margin_bottom: 24px
  placeholder: "Untitled"
  placeholder_color: "#585b70"

body:
  font: "Inter 15px / 26px #cdd6f4"
  paragraph_spacing: 16px

  wiki_link:
    color: "#cba6f7"
    text_decoration: "none"
    hover: "underline, color #f5c2e7"
    cursor: "pointer"

  code_block:
    background: "#313244"
    border_radius: 8px
    padding: "16px"
    font: "JetBrains Mono 13px / 20px #cdd6f4"
    border: "1px solid #45475a"
    language_badge:
      position: "top-right"
      font: "Inter 11px #7f849c"
      padding: "2px 8px"

  inline_code:
    background: "#313244"
    padding: "2px 6px"
    border_radius: 4px
    font: "JetBrains Mono 13px #f38ba8"

  callout:
    background: "#313244"
    border_left: "3px solid #89b4fa"
    border_radius: "0 8px 8px 0"
    padding: "12px 16px"
    icon: "Info 16px #89b4fa"
    title_font: "Inter 14px weight 600 #cdd6f4"
    body_font: "Inter 14px #a6adc8"

  heading_h2:
    font: "Inter 22px weight 600 #cdd6f4"
    margin_top: 32px
    margin_bottom: 12px

  heading_h3:
    font: "Inter 18px weight 600 #cdd6f4"
    margin_top: 24px
    margin_bottom: 8px

block_drag_handle:
  width: 20px
  position: "left of block, offset -28px"
  opacity: 0 (appear on block hover)
  icon: "GripVertical 14px #585b70"
  hover_opacity: 1
  cursor: "grab"
```

### Component: Right Sidebar

```yaml
component: RightSidebar
width: 280px
background: "#181825"
border_left: "1px solid #313244"
padding: "12px"

sections:
  backlinks:
    header:
      font: "Inter 12px weight 600 #a6adc8 uppercase tracking 0.05em"
      margin_bottom: 8px
    count:
      font: "Inter 12px #7f849c"
    items:
      - note_title:
          font: "Inter 13px weight 500 #cba6f7"
          cursor: "pointer"
          hover: "underline"
      - context_snippet:
          font: "Inter 12px #7f849c"
          max_lines: 2
          overflow: "ellipsis"
      - item_padding: "8px 0"
      - item_border_bottom: "1px solid #313244"

  outline:
    header:
      font: "Inter 12px weight 600 #a6adc8 uppercase tracking 0.05em"
      margin_top: 24px
      margin_bottom: 8px
    heading_items:
      - h1: "Inter 13px weight 500 #cdd6f4, padding-left 0"
      - h2: "Inter 13px #a6adc8, padding-left 12px"
      - h3: "Inter 12px #7f849c, padding-left 24px"
      - height: 24px per item
      - hover: "bg #313244, radius 4px"
      - active: "text #cba6f7 (current position via intersection observer)"
```

### Component: Status Bar

```yaml
component: StatusBar
height: 24px
background: "#181825"
border_top: "1px solid #313244"
padding: "0 12px"
display: "flex row center space-between"
font: "Inter 11px #7f849c"

left_items:
  - sync_status: "green dot #a6e3a1 + 'Synced'" # or "yellow dot #f9e2af + 'Saving...'"
  - separator: "|"
  - word_count: "342 words"

right_items:
  - cursor: "Ln 12, Col 4"
  - separator: "|"
  - mode: "WYSIWYG" # clickable, toggles modes
```

### Interactive States

1. **Sidebar Collapsed**: Left sidebar width 0, toggle button (chevron icon) visible at left edge, editor area expands to fill. Animated with `300ms ease-in-out`.
2. **Right Sidebar Collapsed**: Same pattern, toggle at right edge.
3. **Focus Mode**: Both sidebars hidden, tab bar hidden, status bar hidden. Only editor content visible. Toggle via `Cmd+Shift+F`.
4. **Empty Workspace**: Editor area shows centered illustration (book/pen icon, 96px, #45475a), heading "Create your first note" in Inter 18px #cdd6f4, primary button "New Note" below.
5. **Sidebar Resize**: Drag handle (4px invisible hit area) on sidebar edge, cursor changes to `col-resize`, min-width 200px, max-width 400px.

### Responsive Rules

| Breakpoint | Left Sidebar | Right Sidebar | Ribbon | Tab Bar | Status Bar |
|------------|-------------|---------------|--------|---------|------------|
| Desktop (>=1280px) | 260px visible | 280px visible | 48px visible | Visible | Visible |
| Laptop (>=1024px) | 260px visible | Collapsed (toggle) | 48px visible | Visible | Visible |
| Tablet (>=768px) | Drawer overlay | Hidden | 48px collapsed to icons | Visible | Hidden |
| Mobile (<768px) | Bottom sheet | Hidden | Bottom nav bar (56px) | Simplified | Hidden |

---

## Screen 3: Graph View

**Route**: `/workspaces/:id/graph`
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+------------------------------------------------------+
|R |  LEFT    |                 GRAPH CANVAS                          |
|I |  SIDEBAR |                 #1e1e2e                               |
|B |  260px   |  +---filter toolbar---------------------------------+ |
|B |          |  | [Search] [Tags v] [Folders v] [Layout v] [+-] [] | |
|O |          |  +--------------------------------------------------+ |
|N |          |                                                       |
|  |          |            o                                          |
|  |          |           / \         o---o                            |
|  |          |          o   o       /     \                           |
|  |          |         / \ / \     o       o                         |
|  |          |        o   O   o    |      /                          |
|  |          |         \ | /       o---o-o                            |
|  |          |          \|/         \                                 |
|  |          |           o           o (orphan, dimmed)              |
|  |          |          / \                                           |
|  |          |         o   o        O = active node (#cba6f7 fill)   |
|  |          |                      o = default node (#585b70 fill) |
|  |          |                      lines = #45475a                 |
|  |          |                                                       |
|  |          |  +--legend---+                     +--minimap--+      |
|  |          |  | o Folder1 |                     | [........]|      |
|  |          |  | o Folder2 |                     | [.  .   .]|      |
|  |          |  | o Orphan  |                     | [........]|      |
|  |          |  +-----------+                     +-----------+      |
+--+----------+------------------------------------------------------+
|  Status bar                                                         |
+---------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Ribbon | 48px | 100vh | Left edge | `#181825` |
| Left Sidebar | 260px | calc(100vh - 24px) | Right of ribbon | `#181825` |
| Graph Canvas | remaining (flex) | calc(100vh - 24px) | Center | `#1e1e2e` |
| Filter Toolbar | 100% canvas width | 44px | Top of canvas, 8px padding | `#181825` bg |
| Legend | 140px | auto | Bottom-left, 16px inset | `#313244` card |
| Minimap | 160x100px | 100px | Bottom-right, 16px inset | `#313244` card |
| Status Bar | 100vw | 24px | Bottom edge | `#181825` |

### Component: Graph Nodes

```yaml
nodes:
  default:
    shape: circle
    size: "16-40px (scaled by connection count)"
    fill: "#585b70"
    stroke: "none"
    label:
      visible: false  # shows on hover
      font: "Inter 11px #cdd6f4"
      background: "#313244"
      padding: "4px 8px"
      border_radius: 4px
      position: "below node, 8px offset"

  hovered:
    size: "original + 4px"
    fill: "#f5c2e7"
    label_visible: true
    preview_card:
      width: 240px
      background: "#313244"
      border_radius: 8px
      padding: 12px
      shadow: "dropdown"
      title: "Inter 14px weight 600 #cdd6f4"
      snippet: "Inter 12px #a6adc8, max 3 lines"

  active:
    fill: "#cba6f7"
    size: "original * 1.5"
    stroke: "2px solid #f5c2e7"
    label_visible: true

  selected:
    stroke: "2px solid #cba6f7"
    shadow: "0 0 12px rgba(203, 166, 247, 0.4)"

  orphan:
    fill: "#45475a"
    opacity: 0.4
    size: 12px

  folder_colors:
    folder_1: "#cba6f7"  # purple
    folder_2: "#89b4fa"  # blue
    folder_3: "#a6e3a1"  # green
    folder_4: "#fab387"  # peach
    folder_5: "#f5c2e7"  # pink
    folder_6: "#f9e2af"  # yellow
```

### Component: Graph Edges

```yaml
edges:
  default:
    stroke: "#45475a"
    stroke_width: 1px
    opacity: 0.5

  highlighted:  # when either node is hovered
    stroke: "#a6adc8"
    stroke_width: 2px
    opacity: 1

  typed_link:
    continuation: "solid line"
    counterargument: "dashed line"
    source: "dotted line"
    arrow: "directional, 6px arrowhead"
```

### Component: Filter Toolbar

```yaml
filter_toolbar:
  background: "#181825"
  border_bottom: "1px solid #313244"
  height: 44px
  padding: "6px 12px"
  display: "flex row center gap:8px"

  search:
    width: 200px
    height: 32px
    background: "#313244"
    border_radius: 8px
    icon: "Search 14px #7f849c"
    placeholder: "Search graph..."

  filter_dropdown:
    height: 32px
    padding: "0 10px"
    background: "#313244"
    border_radius: 8px
    font: "Inter 12px #a6adc8"
    chevron: "8px #7f849c"
    hover: "bg #45475a"

  zoom_controls:
    position: right
    buttons:
      - zoom_in: "Plus icon, 28px square, bg #313244, radius 4px"
      - zoom_out: "Minus icon, 28px square, bg #313244, radius 4px"
      - fit_all: "Maximize icon, 28px square, bg #313244, radius 4px"
```

### Interactive States

1. **Hover node**: Node enlarges (150ms), label appears, connected edges highlight, preview card fades in (200ms)
2. **Click node**: Navigates to note in editor (or opens in new tab if Cmd+Click)
3. **Right-click node**: Context menu (Open, Open in Split, Create Link, Copy Title)
4. **Drag node**: Repositions in saved layout mode, cursor `grabbing`
5. **Scroll/Pinch**: Zoom in/out (min 0.1x, max 5x), smooth interpolation
6. **Box select**: Shift+drag on empty space to multi-select nodes
7. **Draw edge**: Alt+click node, drag to target = creates `[[wiki link]]`

### Responsive Rules

| Breakpoint | Changes |
|------------|---------|
| Desktop (>=1280px) | Full layout with sidebar |
| Tablet (>=768px) | Sidebar collapsed, graph full width, filter bar simplified |
| Mobile (<768px) | Full-screen graph, filter bar as bottom sheet, touch gestures |

---

## Screen 4: Settings

**Route**: `/workspaces/:id/settings/appearance`
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+---+--------------------------------------------+
|R |  LEFT    |NAV|              SETTINGS CONTENT               |
|I |  SIDEBAR |200|              #1e1e2e                        |
|B |  260px   |px |              scrollable                     |
|B |  #181825 |   |                                             |
|O |          |#18| Appearance                    Inter 22px 600|
|N |          |18 | Customize the look and feel   #a6adc8 14px |
|  |          |25 |                                             |
|  |          |   | Theme                                       |
|  |          |Wor| +--------+ +--------+ +--------+           |
|  |          |ksp| | [moon] | | [sun]  | | [auto] |           |
|  |          |ace| | Dark   | | Light  | | System |  64x80    |
|  |          |---| | #cba6f7| |        | |        |  cards    |
|  |          |Gen| | border | |        | |        |           |
|  |          |App| +--------+ +--------+ +--------+           |
|  |          |Edi|                                             |
|  |          |Key| Accent Color                                |
|  |          |Syn| [o][o][o][o][o][o][o][o] [#cba6f7]         |
|  |          |Mem|  Color swatches 28px     Custom hex input   |
|  |          |Plu|                                             |
|  |          |Pub| Font Family                                 |
|  |          |Dan| +----------+ +----------+ +----------+     |
|  |          |ger| | Aa       | | Aa       | | Aa       |     |
|  |          |   | | Inter    | | Georgia  | | JetBrains|     |
|  |          |   | | Sans     | | Serif    | | Mono     |     |
|  |          |   | +----------+ +----------+ +----------+     |
|  |          |   |                                             |
|  |          |   | Font Size                                   |
|  |          |   | 12px [=========O=====] 20px    [16px]      |
|  |          |   |                                             |
|  |          |   | Editor Width                                |
|  |          |   | Narrow [====O==========] Wide   [720px]    |
|  |          |   |                                             |
|  |          |   | Line Numbers       [======] (toggle on)    |
|  |          |   | Line Spacing        Compact | Normal | Wide|
|  |          |   |                                             |
+--+----------+---+--------------------------------------------+
|  Status bar                                                    |
+----------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Ribbon | 48px | 100vh | Left edge | `#181825` |
| Left Sidebar | 260px | calc(100vh - 24px) | Right of ribbon | `#181825` |
| Settings Nav | 200px | calc(100vh - 24px) | Right of sidebar | `#181825`, border-right `#313244` |
| Settings Content | remaining (flex) | calc(100vh - 24px) | Center | `#1e1e2e`, scrollable |
| Content Padding | 48px top, 48px left/right | -- | -- | -- |
| Content max-width | 640px | -- | left-aligned within padding | -- |

### Component: Settings Navigation

```yaml
component: SettingsNav
width: 200px
background: "#181825"
border_right: "1px solid #313244"
padding: "16px 8px"

section_header:
  font: "Inter 11px weight 600 #7f849c uppercase tracking 0.08em"
  padding: "8px 12px 4px"
  content: "WORKSPACE"

nav_item:
  height: 32px
  padding: "0 12px"
  border_radius: 6px
  font: "Inter 13px"
  display: "flex row center gap:8px"
  icon_size: 16px

  states:
    default:
      text: "#a6adc8"
      icon: "#7f849c"
      background: "transparent"
    hover:
      background: "#313244"
    active:
      background: "#313244"
      text: "#cdd6f4"
      icon: "#cba6f7"

items:
  - { icon: "Settings", label: "General" }
  - { icon: "Palette", label: "Appearance", active: true }
  - { icon: "PenTool", label: "Editor" }
  - { icon: "Keyboard", label: "Shortcuts" }
  - { icon: "RefreshCw", label: "Sync" }
  - { icon: "Users", label: "Members", badge: "Admin" }
  - { icon: "Puzzle", label: "Plugins" }
  - { icon: "Globe", label: "Publishing", badge: "Admin" }
  - { icon: "AlertTriangle", label: "Danger Zone", text_color: "#f38ba8" }
```

### Component: Theme Selector Cards

```yaml
component: ThemeCard
width: 120px
height: 80px
border_radius: 8px
padding: 12px
cursor: pointer
display: "flex column center gap:8px"
transition: "200ms ease-in-out"

states:
  default:
    background: "#313244"
    border: "2px solid transparent"
    text: "#a6adc8"

  hover:
    border_color: "#585b70"

  selected:
    border_color: "#cba6f7"
    text: "#cdd6f4"
    icon_color: "#cba6f7"
```

### Component: Toggle Switch

```yaml
component: Toggle
width: 40px
height: 22px
border_radius: full
transition: "200ms ease-in-out"

states:
  off:
    background: "#45475a"
    thumb:
      size: 18px
      position: "left 2px"
      background: "#a6adc8"

  on:
    background: "#cba6f7"
    thumb:
      position: "right 2px"
      background: "#1e1e2e"

  hover:
    thumb_scale: 1.05
```

### Component: Slider

```yaml
component: Slider
height: 6px
border_radius: full
background: "#45475a"

filled_track:
  background: "#cba6f7"
  border_radius: full

thumb:
  size: 16px
  border_radius: full
  background: "#cdd6f4"
  border: "2px solid #cba6f7"
  shadow: "0 2px 4px rgba(0,0,0,0.3)"
  hover: "scale 1.1"
  active: "scale 1.2, shadow larger"

value_label:
  position: "right of slider, 12px gap"
  font: "Inter 13px #a6adc8"
  min_width: 48px
```

### Interactive States

1. **Theme change**: Live preview -- background colors transition smoothly (300ms) to new theme values
2. **Accent color**: Clicking a swatch immediately updates all accent-colored elements on the page
3. **Font change**: Sample text in font cards updates to reflect the selected font
4. **Slider drag**: Value label updates in real-time; editor width slider shows a live preview line indicator
5. **Unsaved changes**: Floating toast at bottom "Changes saved automatically" (auto-dismiss 2s)

### Responsive Rules

| Breakpoint | Changes |
|------------|---------|
| Desktop (>=1280px) | Full layout with both sidebars |
| Laptop (>=1024px) | Left sidebar collapsed, settings nav + content |
| Tablet (>=768px) | Settings nav as top tabs, content full width |
| Mobile (<768px) | Settings as full-page stack, nav as accordion at top |

---

## Screen 5: Plugin Browser

**Route**: `/workspaces/:id/plugins`
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+-----------------------------------------------------+
|R |  LEFT    |                 PLUGIN MARKETPLACE                    |
|I |  SIDEBAR |                 #1e1e2e                               |
|B |  260px   |                                                       |
|B |          |  Plugins                              Inter 22px 600 |
|O |          |  Discover and manage extensions        #a6adc8       |
|N |          |                                                       |
|  |          |  +--search bar full width---------------------------+ |
|  |          |  | [Search] Search plugins...            [Filters]  | |
|  |          |  +--------------------------------------------------+ |
|  |          |                                                       |
|  |          |  [Installed] [All] [Editor] [Themes] [Productivity]   |
|  |          |   ^^^^^^^^                                            |
|  |          |   active tab with #cba6f7 underline                  |
|  |          |                                                       |
|  |          |  +-------------+ +-------------+ +-------------+     |
|  |          |  | #313244     | | #313244     | | #313244     |     |
|  |          |  |             | |             | |             |     |
|  |          |  | [icon 40px] | | [icon 40px] | | [icon 40px] |     |
|  |          |  | Kanban      | | Mermaid     | | Calendar    |     |
|  |          |  | Board       | | Diagrams    | | View        |     |
|  |          |  |             | |             | |             |     |
|  |          |  | "Organize   | | "Render     | | "View notes |     |
|  |          |  |  tasks in   | |  Mermaid    | |  by date    |     |
|  |          |  |  boards"    | |  diagrams"  | |  in cal."   |     |
|  |          |  |             | |             | |             |     |
|  |          |  | [tag] [tag] | | [tag] [tag] | | [tag]       |     |
|  |          |  |             | |             | |             |     |
|  |          |  | *4.8  12.4k | | *4.5  8.2k  | | *4.9  5.1k  |     |
|  |          |  |  [Install]  | | [Installed] | |  [Install]  |     |
|  |          |  +-------------+ +-------------+ +-------------+     |
|  |          |                                                       |
|  |          |  +-------------+ +-------------+ +-------------+     |
|  |          |  | ...row 2    | | ...         | | ...         |     |
|  |          |  +-------------+ +-------------+ +-------------+     |
|  |          |                                                       |
+--+----------+-----------------------------------------------------+
|  Status bar                                                         |
+---------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Ribbon | 48px | 100vh | Left edge | `#181825` |
| Left Sidebar | 260px | calc(100vh - 24px) | Right of ribbon | `#181825` |
| Plugin Content | remaining (flex) | calc(100vh - 24px) | Center, scrollable | `#1e1e2e` |
| Content padding | 32px top, 32px left/right | -- | -- | -- |
| Search bar | 100% content width | 40px | Top of content | -- |
| Plugin grid | 100% content width | auto | 3 columns, 16px gap | -- |
| Plugin card | 1fr (responsive) | auto ~220px | Grid cell | `#313244` |

### Component: Plugin Card

```yaml
component: PluginCard
background: "#313244"
border_radius: 12px
padding: 20px
border: "1px solid #45475a"
transition: "200ms ease-in-out"
cursor: pointer

layout:
  direction: column
  gap: 12px

elements:
  icon:
    size: 40px
    border_radius: 8px
    background: "#45475a"  # placeholder, actual icon from plugin

  name:
    font: "Inter 15px weight 600 #cdd6f4"

  description:
    font: "Inter 13px #a6adc8"
    max_lines: 2
    overflow: ellipsis

  tags:
    display: "flex row wrap gap:4px"
    tag:
      padding: "2px 8px"
      background: "#45475a"
      border_radius: full
      font: "Inter 11px #a6adc8"

  footer:
    display: "flex row space-between center"
    margin_top: auto

    stats:
      display: "flex row gap:12px"
      rating:
        icon: "Star 12px #f9e2af"
        font: "Inter 12px #a6adc8"
      downloads:
        icon: "Download 12px #7f849c"
        font: "Inter 12px #7f849c"

    install_button:
      height: 32px
      padding: "0 16px"
      border_radius: 6px

states:
  hover:
    border_color: "#585b70"
    transform: "translateY(-2px)"
    shadow: "0 8px 24px rgba(0,0,0,0.3)"

  button_states:
    available:
      text: "Install"
      background: "#cba6f7"
      text_color: "#1e1e2e"
      font: "Inter 13px weight 500"

    installing:
      text: "spinner icon"
      background: "#45475a"
      disabled: true

    installed:
      text: "Installed"
      background: "#313244"
      border: "1px solid #a6e3a1"
      text_color: "#a6e3a1"
      icon: "Check 12px"

    update:
      text: "Update"
      background: "#89b4fa"
      text_color: "#1e1e2e"
```

### Component: Category Tabs

```yaml
component: CategoryTabs
height: 36px
display: "flex row gap:0"
border_bottom: "1px solid #313244"
margin_bottom: 24px

tab:
  height: 36px
  padding: "0 16px"
  font: "Inter 13px"
  border_bottom: "2px solid transparent"

  states:
    default:
      text: "#7f849c"
    hover:
      text: "#a6adc8"
      background: "#313244"
    active:
      text: "#cdd6f4"
      border_bottom_color: "#cba6f7"
```

### Interactive States

1. **Card hover**: Slight lift animation (translateY -2px), enhanced shadow, border highlight
2. **Install click**: Button becomes spinner, then transitions to "Installed" state with green check (300ms)
3. **Search**: Results filter in real-time with debounce (200ms), cards animate out/in with opacity
4. **Card click** (not on button): Opens plugin detail sheet from right (280px wide, slide animation 200ms)
5. **Empty search**: "No plugins found" message with illustration

### Responsive Rules

| Breakpoint | Grid Columns | Card Min Width |
|------------|-------------|----------------|
| Desktop (>=1280px) | 3 | 260px |
| Laptop (>=1024px) | 2 | 280px |
| Tablet (>=768px) | 2 | 240px |
| Mobile (<768px) | 1 | 100% |

---

## Screen 6: Editor with Slash Menu

**Route**: `/workspaces/:id/notes/:noteId` (slash menu overlay)
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+----------------------------------------------+-----------+
|R |  LEFT    |              EDITOR WITH SLASH MENU            |  RIGHT   |
|I |  SIDEBAR |                                               |  SIDEBAR |
|B |  260px   |  [note.md] [+]                    Tab bar     |  280px   |
|B |          +----------------------------------------------+|          |
|O |          |                                               |          |
|N |          |  # Getting Started with Notesaner             |          |
|  |          |                                               |          |
|  |          |  Welcome to your new workspace. Here are      |          |
|  |          |  some tips to get started.                    |          |
|  |          |                                               |          |
|  |          |  ## Quick Features                            |          |
|  |          |                                               |          |
|  |          |  You can use wiki links like [[Setup Guide]]  |          |
|  |          |  to connect your notes.                       |          |
|  |          |                                               |          |
|  |          |  /|                                           |          |
|  |          |  +-----------------------------+              |          |
|  |          |  | #313244 card, shadow:dropdown|             |          |
|  |          |  | 220px wide, radius: 8px     |              |          |
|  |          |  |                              |              |          |
|  |          |  | +--highlighted item--------+ |              |          |
|  |          |  | | [H] Heading 1            | |  #45475a bg |          |
|  |          |  | +--------------------------+ |              |          |
|  |          |  | | [H] Heading 2            | |              |          |
|  |          |  | | [H] Heading 3            | |              |          |
|  |          |  | | [-] Bullet List          | |              |          |
|  |          |  | | [1] Numbered List        | |              |          |
|  |          |  | | [x] Task List            | |              |          |
|  |          |  | | [<>] Code Block          | |              |          |
|  |          |  | | ["] Blockquote           | |              |          |
|  |          |  | | [!] Callout              | |              |          |
|  |          |  | | [T] Table                | |              |          |
|  |          |  | | [~] Divider              | |              |          |
|  |          |  | | [img] Image              | |              |          |
|  |          |  | | [E] Embed                | |              |          |
|  |          |  +-----------------------------+              |          |
|  |          |                                               |          |
+--+----------+----------------------------------------------+-----------+
|  Status bar                                                             |
+-------------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Slash Menu | 220px | auto (max 340px) | Below cursor position | `#313244` |
| Menu item | 100% | 32px | Stacked | -- |
| Menu padding | 4px | -- | -- | -- |
| Icon area | 28px | 28px | Left of label | -- |
| Menu border-radius | 8px | -- | -- | -- |
| Menu shadow | dropdown | -- | -- | -- |

### Component: Slash Command Menu

```yaml
component: SlashMenu
width: 220px
max_height: 340px
background: "#313244"
border: "1px solid #45475a"
border_radius: 8px
padding: 4px
shadow: "0 8px 24px rgba(0, 0, 0, 0.4)"
overflow_y: auto

position:
  anchor: "cursor position in editor"
  placement: "below-start"
  offset_y: 4px
  flip: true  # flips above if near bottom edge

search_input:
  visible: true  # text typed after / filters items
  font: "Inter 13px #cdd6f4"

section_header:
  font: "Inter 11px weight 600 #7f849c uppercase tracking 0.05em"
  padding: "8px 8px 4px"
  content: "BLOCKS"

menu_item:
  height: 32px
  padding: "0 8px"
  border_radius: 6px
  display: "flex row center gap:8px"

  icon:
    size: 20px
    color: "#a6adc8"
    background: "#45475a"
    border_radius: 4px
    padding: 2px

  label:
    font: "Inter 13px #cdd6f4"

  description:
    font: "Inter 11px #7f849c"
    optional: true

  states:
    default:
      background: "transparent"

    highlighted:
      background: "#45475a"
      icon_color: "#cba6f7"

    hover:
      background: "#45475a"

items:
  blocks:
    - { icon: "H1", label: "Heading 1", shortcut: "# " }
    - { icon: "H2", label: "Heading 2", shortcut: "## " }
    - { icon: "H3", label: "Heading 3", shortcut: "### " }
    - { icon: "List", label: "Bullet List", shortcut: "- " }
    - { icon: "ListOrdered", label: "Numbered List", shortcut: "1. " }
    - { icon: "CheckSquare", label: "Task List", shortcut: "- [ ] " }
    - { icon: "Code", label: "Code Block", shortcut: "```" }
    - { icon: "Quote", label: "Blockquote", shortcut: "> " }
    - { icon: "AlertCircle", label: "Callout", shortcut: "> [!NOTE]" }
    - { icon: "Table", label: "Table", shortcut: null }
    - { icon: "Minus", label: "Divider", shortcut: "---" }
    - { icon: "Image", label: "Image", shortcut: null }
    - { icon: "ExternalLink", label: "Embed", shortcut: null }

  advanced:
    - { icon: "Calculator", label: "Math Block (KaTeX)", shortcut: "$$" }
    - { icon: "FileText", label: "Note Embed", shortcut: "![[" }
    - { icon: "Columns", label: "Columns", shortcut: null }

keyboard_navigation:
  up_down: "Navigate items"
  enter: "Select item"
  escape: "Close menu"
  typing: "Filter items (fuzzy match)"
```

### Interactive States

1. **Trigger**: User types `/` at the beginning of a line or after a space. Menu appears at cursor.
2. **Typing filter**: Characters typed after `/` filter items using fuzzy search. "/cod" highlights "Code Block".
3. **Arrow navigation**: Up/down arrows move highlight. First item highlighted by default.
4. **Selection**: Enter or click inserts the block type and closes menu.
5. **Escape**: Closes menu, keeps the `/` character (user can backspace to remove).
6. **Scroll**: If more items than fit, menu scrolls with custom scrollbar (4px, `#585b70`).

### Responsive Rules

| Breakpoint | Changes |
|------------|---------|
| All breakpoints | Menu width stays 220px, positioned relative to cursor |
| Mobile | Menu appears as bottom sheet instead of inline popup |

---

## Screen 7: Split View

**Route**: `/workspaces/:id/notes/:noteId` (split mode active)
**Canvas**: 1440x900
**Background**: `#1e1e2e`

### Wireframe

```
+--+----------+---------------------+|+---------------------+-----------+
|R |  LEFT    | LEFT PANE (50%)      || RIGHT PANE (50%)     |  RIGHT   |
|I |  SIDEBAR |                     ||| note.md  graph       |  SIDEBAR |
|B |  260px   | note.md  draft.md   |||                      |  280px   |
|B |          +---------------------+|+---------------------+|          |
|O |          |                     |||                      ||          |
|N |          | # Research Notes    ||| # Meeting Notes      ||          |
|  |          |                     |||                      ||          |
|  |          | Some content about  ||| Notes from the team  ||          |
|  |          | the research topic  ||| meeting on 2026-03-  ||          |
|  |          | we are exploring.   ||| 24 about the design  ||          |
|  |          |                     ||| system.              ||          |
|  |          | ## Key Findings     |||                      ||          |
|  |          |                     ||| ## Action Items      ||          |
|  |          | - Finding one       ||| - [ ] Complete specs ||          |
|  |          | - Finding two       ||| - [x] Review arch   ||          |
|  |          | - [[Related Note]]  ||| - [ ] Send feedback  ||          |
|  |          |                     |||                      ||          |
|  |          | ## References       ||| ## Attendees         ||          |
|  |          |                     ||| @alice, @bob, @carol ||          |
|  |          | 1. Source paper     |||                      ||          |
|  |          | 2. Online article   ||| > Next meeting on    ||          |
|  |          |                     ||| > Friday at 2pm      ||          |
|  |          |                     |||                      ||          |
|  |          |                     |||                      ||          |
+--+----------+---------------------+|+---------------------+-----------+
|  Synced | 342 words | Ln 12, Col 4 | WYSIWYG   (left pane active)    |
+------------------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Ribbon | 48px | 100vh | Left edge | `#181825` |
| Left Sidebar | 260px | calc(100vh - 24px) | Right of ribbon | `#181825` |
| Left Pane | 50% of editor area | calc(100vh - 24px) | Left of divider | `#1e1e2e` |
| Divider | 4px visual (12px hit area) | 100% | Between panes | `#45475a` |
| Right Pane | 50% of editor area | calc(100vh - 24px) | Right of divider | `#1e1e2e` |
| Right Sidebar | 280px | calc(100vh - 24px) | Right edge | `#181825` |
| Status Bar | 100vw | 24px | Bottom edge | `#181825` |

### Component: Split Divider

```yaml
component: SplitDivider
visual_width: 1px
hit_area_width: 12px
background: "#45475a"
cursor: "col-resize"

states:
  default:
    background: "#45475a"
    width: 1px

  hover:
    background: "#cba6f7"
    width: 2px

  dragging:
    background: "#cba6f7"
    width: 2px
    # shows ghost line following cursor

constraints:
  min_pane_width: 300px
  snap_ratios: [0.3, 0.5, 0.7]
  snap_threshold: 20px  # snaps when within 20px of ratio
```

### Component: Pane Tab Bar

```yaml
component: PaneTabBar
height: 36px
background: "#181825"
border_bottom: "1px solid #313244"

# Each pane has its own independent tab bar
# Active pane indicated by slightly brighter tab bar background

active_pane_indicator:
  tab_bar_background: "#1e1e2e"  # slightly lighter than inactive

inactive_pane_indicator:
  tab_bar_background: "#181825"
  tab_text_opacity: 0.6
```

### Interactive States

1. **Divider drag**: Real-time resize, min 300px per pane, snap to 30/50/70 ratios
2. **Pane focus**: Clicking in a pane makes it "active" (status bar shows its info, tab bar brightens)
3. **Tab drag between panes**: Drag tab from one pane to another to move note
4. **Close pane**: When last tab in a pane closes, pane collapses and other pane takes full width (300ms animation)
5. **Split shortcuts**: `Cmd+\` for vertical split, `Cmd+Shift+\` for horizontal split
6. **Snap layouts**: Dropdown menu in tab bar offers preset ratios: 50/50, 70/30, 30/70

### Split Configurations

```yaml
configurations:
  vertical_split:
    layout: "side by side"
    divider: vertical
    default_ratio: "50/50"

  horizontal_split:
    layout: "stacked"
    divider: horizontal
    default_ratio: "50/50"

  three_column:
    layout: "3 equal panes"
    dividers: 2 vertical
    default_ratio: "33/34/33"

  grid_2x2:
    layout: "2 rows x 2 columns"
    dividers: "1 horizontal + 2 vertical"
    default_ratio: "50/50 both axes"
```

### Responsive Rules

| Breakpoint | Changes |
|------------|---------|
| Desktop (>=1280px) | Full split view supported |
| Laptop (>=1024px) | Split view, right sidebar collapses |
| Tablet (>=768px) | Split not available, tabs switch between notes |
| Mobile (<768px) | Single pane only, tab switching |

---

## Screen 8: Public Published View

**Route**: `/public/:slug/*path`
**Canvas**: 1440x900
**Theme**: Dark (matching workspace) OR Light (configurable)

### Wireframe (Dark Theme)

```
+------------------------------------------------------------------------+
| [Notesaner] My Knowledge Base      [Search] [Light/Dark] [GitHub]      |
| #181825  h:56px  border-bottom: #313244                                |
+--------+---------------------------------------------------------------+
|  NAV   |  Breadcrumbs: Home > Guides > Getting Started                 |
|  220px |  #7f849c 12px, links #cba6f7                                  |
|  #18182+---------------------------------------------------------------+
|  5     |                                                               |
|        |  # Getting Started                         max-width: 760px  |
| Guides |  ___________________________________________________         |
|  > Get |                                                               |
|    Star|  Welcome to the knowledge base. This guide will help          |
|  > Adv |  you understand the core concepts.                            |
|    anc |                                                               |
|  > FAQ |  ## Prerequisites                                             |
|        |                                                               |
| Referen|  Before you begin, make sure you have:                        |
|  > API |                                                               |
|  > Chan|  - Node.js 20 or later                                        |
|    gelo|  - A modern web browser                                       |
|        |  - Basic markdown knowledge                                   |
|        |                                                               |
|        |  ## Installation                                              |
|        |                                                               |
|        |  ```bash                                                      |
|        |  npm install notesaner                                        |
|        |  ```                                                          |
|        |                                                               |
|        |  ## Next Steps                                                |
|        |                                                               |
|        |  Check out [[Advanced Usage]] for more details.               |
|        |                                                               |
+--------+---------------------------------------------------------------+
| Powered by Notesaner  |  Last updated: 2026-03-24  |  Edit this page  |
| #181825  h:48px  #7f849c text  border-top: #313244                     |
+------------------------------------------------------------------------+
```

### Wireframe (Light Theme Alternative)

```
+------------------------------------------------------------------------+
| [Notesaner] My Knowledge Base      [Search] [Light/Dark] [GitHub]      |
| #ffffff  h:56px  border-bottom: #e5e7eb                                |
+--------+---------------------------------------------------------------+
|  NAV   |                                                               |
|  220px |  # Getting Started                                            |
|  #f9faf|                                                               |
|  b     |  Body text in #1f2937 on #ffffff background                   |
|        |  Links in #7c3aed (purple)                                    |
| Guides |  Code blocks on #f3f4f6                                       |
|  > ...  |                                                               |
+--------+---------------------------------------------------------------+
```

### Layout Dimensions

| Element | Width | Height | Position | Fill |
|---------|-------|--------|----------|------|
| Header | 100vw | 56px | Top, fixed | `#181825` |
| Left Navigation | 220px | calc(100vh - 104px) | Left, sticky | `#181825` |
| Content Area | remaining (flex) | auto, scrollable | Center | `#1e1e2e` |
| Content max-width | 760px | -- | Centered in area | -- |
| Content padding | 40px top, 32px horizontal | -- | -- | -- |
| Footer | 100vw | 48px | Bottom | `#181825` |

### Component: Public Header

```yaml
component: PublicHeader
height: 56px
background: "#181825"
border_bottom: "1px solid #313244"
padding: "0 24px"
display: "flex row center space-between"
position: "fixed top"
z_index: 50

left:
  logo:
    icon: "BookOpen 20px #cba6f7"
    text: "Inter 16px weight 600 #cdd6f4"
    gap: 8px

  site_title:
    text: "Inter 14px #a6adc8"
    margin_left: 12px
    separator: "| #45475a"

right:
  display: "flex row center gap:8px"

  search_button:
    icon: "Search 18px #a6adc8"
    size: 36px
    border_radius: 8px
    hover: "bg #313244"

  theme_toggle:
    icon: "Sun/Moon 18px #a6adc8"
    size: 36px
    border_radius: 8px
    hover: "bg #313244"

  github_link:
    icon: "ExternalLink 18px #a6adc8"
    size: 36px
    border_radius: 8px
    hover: "bg #313244"
```

### Component: Public Navigation

```yaml
component: PublicNavigation
width: 220px
background: "#181825"
border_right: "1px solid #313244"
padding: "16px 12px"
position: "sticky top 56px"
height: "calc(100vh - 104px)"
overflow_y: auto

section:
  header:
    font: "Inter 12px weight 600 #a6adc8 uppercase tracking 0.05em"
    margin_bottom: 4px
    padding: "4px 8px"

  items:
    height: 28px
    padding: "0 8px 0 (depth * 12px + 8px)"
    border_radius: 4px
    font: "Inter 13px"

    states:
      default:
        text: "#a6adc8"
      hover:
        background: "#313244"
        text: "#cdd6f4"
      active:
        background: "#313244"
        text: "#cba6f7"
        font_weight: 500
```

### Component: Public Content

```yaml
component: PublicContent
max_width: 760px
margin: "0 auto"
padding: "40px 32px"

breadcrumbs:
  font: "Inter 12px #7f849c"
  separator: ">"
  link_color: "#cba6f7"
  margin_bottom: 24px

typography:
  h1: "Inter 32px / 40px weight 700 #cdd6f4, margin-bottom 16px"
  h2: "Inter 24px / 32px weight 600 #cdd6f4, margin-top 40px, margin-bottom 12px"
  h3: "Inter 18px / 26px weight 600 #cdd6f4, margin-top 32px, margin-bottom 8px"
  body: "Inter 15px / 28px #cdd6f4"
  link: "#cba6f7, hover underline"

  code_block:
    background: "#313244"
    border: "1px solid #45475a"
    border_radius: 8px
    padding: 16px
    font: "JetBrains Mono 13px / 22px #cdd6f4"
    header: "language label, copy button"

  inline_code:
    background: "#313244"
    padding: "2px 6px"
    border_radius: 4px
    font: "JetBrains Mono 13px #f38ba8"

  table:
    border: "1px solid #45475a"
    header_bg: "#313244"
    cell_padding: "8px 12px"
    font: "Inter 14px #cdd6f4"
    stripe: "#1e1e2e / #181825 alternating"

  blockquote:
    border_left: "3px solid #cba6f7"
    padding_left: 16px
    color: "#a6adc8"
    font_style: italic
```

### Component: Public Footer

```yaml
component: PublicFooter
height: 48px
background: "#181825"
border_top: "1px solid #313244"
padding: "0 24px"
display: "flex row center space-between"

left:
  text: "Powered by Notesaner"
  font: "Inter 12px #7f849c"
  link_color: "#cba6f7"

center:
  text: "Last updated: 2026-03-24"
  font: "Inter 12px #7f849c"

right:
  text: "Edit this page"
  font: "Inter 12px #cba6f7"
  icon: "ExternalLink 12px"
  hover: "underline"
```

### Interactive States

1. **Theme toggle**: Smooth transition (300ms) between dark/light themes. Persisted in localStorage.
2. **Search**: Opens centered modal overlay (similar to Command Palette), fuzzy searches all published notes.
3. **Navigation**: Active item highlighted, smooth scroll within same page for heading links.
4. **Wiki links**: Rendered as regular links in published view. `[[Note]]` becomes a clickable internal link.
5. **404 state**: Custom illustration with "This note is not published" message and link to home.
6. **Mobile navigation**: Left nav collapses to hamburger menu (slide-in drawer from left, 260px).

### Responsive Rules

| Breakpoint | Left Nav | Content | Header |
|------------|----------|---------|--------|
| Desktop (>=1280px) | 220px visible | 760px max, centered | Full |
| Laptop (>=1024px) | 220px visible | Flexible | Full |
| Tablet (>=768px) | Hamburger drawer | Full width, 24px padding | Simplified |
| Mobile (<768px) | Hamburger drawer | Full width, 16px padding | Logo + hamburger only |

---

## Cross-Screen Component Library Summary

### Shared Components Used Across Screens

| Component | Screens Used | shadcn/ui Base |
|-----------|-------------|----------------|
| Button (Primary) | 1, 2, 4, 5 | `Button variant="default"` |
| Button (Secondary) | 1, 4, 5 | `Button variant="outline"` |
| Button (Ghost) | 2, 3, 4, 7 | `Button variant="ghost"` |
| Button (Destructive) | 4 | `Button variant="destructive"` |
| Input | 1, 3, 4, 5 | `Input` |
| Toggle | 4 | `Switch` |
| Slider | 4 | `Slider` |
| Dropdown/Select | 4 | `Select` |
| Tabs | 2, 5, 7 | `Tabs` |
| Card | 1, 5, 8 | `Card` |
| Command Menu | 6 | `Command` (cmdk) |
| Tooltip | 2, 3 | `Tooltip` |
| Popover | 3, 6 | `Popover` |
| ScrollArea | 2, 3, 4, 5, 8 | `ScrollArea` |
| Separator | 1, 2, 4 | `Separator` |
| Badge | 2, 5 | `Badge` |
| Avatar | 2 | `Avatar` |

### Icon Library

All icons use **Lucide React** (consistent with shadcn/ui):

```yaml
icon_specs:
  default_size: 16px
  sidebar_icon_size: 20px
  ribbon_icon_size: 20px
  stroke_width: 1.75
  color: "inherits from parent text color"
```

### Animation Constants

```yaml
animations:
  sidebar_toggle:
    duration: 300ms
    easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    property: width

  menu_open:
    duration: 200ms
    easing: "cubic-bezier(0, 0, 0.2, 1)"
    property: "opacity, transform"
    transform: "translateY(-4px) -> translateY(0)"

  tab_switch:
    duration: 150ms
    easing: "ease-in-out"
    property: "border-color, color"

  card_hover:
    duration: 200ms
    easing: "ease-out"
    property: "transform, box-shadow"

  theme_transition:
    duration: 300ms
    easing: ease
    property: "background-color, color, border-color"
    selector: "*, *::before, *::after"

  focus_ring:
    style: "0 0 0 2px rgba(203, 166, 247, 0.4)"
    offset: 2px
```

### Accessibility Requirements (WCAG 2.1 AA)

```yaml
accessibility:
  color_contrast:
    text_on_base: "#cdd6f4 on #1e1e2e = 11.5:1 (AAA)"
    muted_on_base: "#a6adc8 on #1e1e2e = 7.4:1 (AAA)"
    accent_on_card: "#cba6f7 on #313244 = 5.2:1 (AA)"
    button_text: "#1e1e2e on #cba6f7 = 8.4:1 (AAA)"

  focus_indicators:
    style: "2px solid #cba6f7, 2px offset"
    visible_on: "keyboard navigation only (focus-visible)"

  keyboard_navigation:
    all_interactive: "reachable via Tab"
    menus: "Arrow keys for item navigation"
    modals: "Escape to close, focus trap active"
    skip_link: "Skip to main content (first focusable element)"

  screen_reader:
    landmarks: "header, nav, main, complementary, contentinfo"
    live_regions: "aria-live for sync status, save status"
    labels: "all inputs have associated labels"
    descriptions: "complex widgets have aria-describedby"

  reduced_motion:
    query: "prefers-reduced-motion: reduce"
    behavior: "disable all transitions, use instant state changes"
```

---

## Implementation Priority Order

| Priority | Screen | Complexity | Dependencies |
|----------|--------|------------|-------------|
| 1 | Screen 2: Main Workspace | High | All sidebar/panel components |
| 2 | Screen 6: Slash Menu | Medium | Editor component, Command component |
| 3 | Screen 1: Login Page | Low | Form components only |
| 4 | Screen 7: Split View | Medium | Workspace layout, resize panels |
| 5 | Screen 3: Graph View | High | Canvas/WebGL, d3-force |
| 6 | Screen 4: Settings | Medium | Form components, settings store |
| 7 | Screen 5: Plugin Browser | Medium | Card grid, API integration |
| 8 | Screen 8: Published View | Medium | Static rendering, theming |

---

## Tailwind CSS 4 Theme Configuration

The following design tokens should be configured in the Tailwind CSS theme:

```typescript
// tailwind.config.ts (excerpt for design tokens)
export default {
  theme: {
    extend: {
      colors: {
        base: '#1e1e2e',
        mantle: '#181825',
        surface: {
          0: '#313244',
          1: '#45475a',
          2: '#585b70',
        },
        text: {
          DEFAULT: '#cdd6f4',
          muted: '#a6adc8',
          subtle: '#7f849c',
        },
        accent: {
          DEFAULT: '#cba6f7',
          pink: '#f5c2e7',
          green: '#a6e3a1',
          red: '#f38ba8',
          yellow: '#f9e2af',
          blue: '#89b4fa',
          peach: '#fab387',
        },
        border: {
          DEFAULT: '#45475a',
          subtle: '#313244',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        ribbon: '48px',
        'sidebar-left': '260px',
        'sidebar-right': '280px',
        'status-bar': '24px',
        'tab-bar': '36px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 4px 16px rgba(0, 0, 0, 0.3)',
        dropdown: '0 8px 24px rgba(0, 0, 0, 0.4)',
        modal: '0 16px 48px rgba(0, 0, 0, 0.5)',
      },
    },
  },
} satisfies Config;
```

---

*End of Screen Mockups & Wireframe Specification*

*Next steps: Implement shared UI components in `packages/ui/` using shadcn/ui with these design tokens, then build layout shells in `apps/web/`.*
