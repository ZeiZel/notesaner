# OpenPencil Design Token Generation

This document contains the exact MCP tool calls needed to generate the
`designs/notesaner-tokens.fig` file using the OpenPencil MCP server.

Run these in a Claude Code session where the `open-pencil` MCP server is loaded.

---

## Step 1: Create Document

```
mcp__open-pencil__new_document({ name: "Notesaner Design Tokens" })
```

## Step 2: Create "Design Tokens" Page

```
mcp__open-pencil__create_page({ name: "Design Tokens" })
```

## Step 3: Create Variable Collections

### 3a. Colors Collection

```
mcp__open-pencil__create_variable_collection({
  name: "Colors",
  modes: ["dark", "light"],
  variables: [
    { name: "background",           dark: "#1e1e2e", light: "#eff1f5" },
    { name: "background-surface",   dark: "#252537", light: "#e6e9ef" },
    { name: "background-elevated",  dark: "#2d2d44", light: "#ffffff" },
    { name: "background-overlay",   dark: "#36365a", light: "#ffffff" },
    { name: "background-input",     dark: "#1a1a2e", light: "#ffffff" },

    { name: "foreground",           dark: "#cdd6f4", light: "#4c4f69" },
    { name: "foreground-secondary", dark: "#a6adc8", light: "#5c5f77" },
    { name: "foreground-muted",     dark: "#6c7086", light: "#6c6f85" },
    { name: "foreground-inverse",   dark: "#1e1e2e", light: "#ffffff" },

    { name: "primary",              dark: "#cba6f7", light: "#8839ef" },
    { name: "primary-hover",        dark: "#b98ef5", light: "#7528e0" },
    { name: "primary-active",       dark: "#a876f3", light: "#6520c7" },
    { name: "primary-foreground",   dark: "#1e1e2e", light: "#ffffff" },

    { name: "secondary",            dark: "#45475a", light: "#e6e9ef" },
    { name: "secondary-hover",      dark: "#525466", light: "#dce0e8" },
    { name: "secondary-foreground", dark: "#cdd6f4", light: "#4c4f69" },

    { name: "accent",               dark: "#f5c2e7", light: "#ea76cb" },
    { name: "accent-hover",         dark: "#f0b0dd", light: "#e560c0" },
    { name: "accent-foreground",    dark: "#1e1e2e", light: "#ffffff" },

    { name: "muted",                dark: "#45475a", light: "#e6e9ef" },
    { name: "muted-foreground",     dark: "#a6adc8", light: "#6c6f85" },

    { name: "destructive",          dark: "#f38ba8", light: "#d20f39" },
    { name: "destructive-hover",    dark: "#f07090", light: "#b80d32" },
    { name: "destructive-foreground", dark: "#1e1e2e", light: "#ffffff" },

    { name: "success",              dark: "#a6e3a1", light: "#40a02b" },
    { name: "warning",              dark: "#fab387", light: "#fe640b" },
    { name: "error",                dark: "#f38ba8", light: "#d20f39" },
    { name: "info",                 dark: "#89dceb", light: "#04a5e5" },

    { name: "border",               dark: "#45475a", light: "#ccd0da" },
    { name: "input",                dark: "#45475a", light: "#ccd0da" },
    { name: "ring",                 dark: "#cba6f7", light: "#8839ef" },

    { name: "card",                 dark: "#313244", light: "#ffffff" },
    { name: "card-foreground",      dark: "#cdd6f4", light: "#4c4f69" },

    { name: "popover",              dark: "#313244", light: "#ffffff" },
    { name: "popover-foreground",   dark: "#cdd6f4", light: "#4c4f69" },

    { name: "sidebar-background",   dark: "#181825", light: "#dce0e8" },
    { name: "sidebar-foreground",   dark: "#cdd6f4", light: "#4c4f69" },
    { name: "sidebar-border",       dark: "#313244", light: "#ccd0da" },
    { name: "sidebar-accent",       dark: "#45475a", light: "#e6e9ef" },
    { name: "sidebar-accent-foreground", dark: "#cdd6f4", light: "#4c4f69" },

    { name: "rosewater",            dark: "#f5e0dc", light: "#dc8a78" },
    { name: "flamingo",             dark: "#f2cdcd", light: "#dd7878" },
    { name: "pink",                 dark: "#f5c2e7", light: "#ea76cb" },
    { name: "mauve",                dark: "#cba6f7", light: "#8839ef" },
    { name: "red",                  dark: "#f38ba8", light: "#d20f39" },
    { name: "maroon",               dark: "#eba0ac", light: "#e64553" },
    { name: "peach",                dark: "#fab387", light: "#fe640b" },
    { name: "yellow",               dark: "#f9e2af", light: "#df8e1d" },
    { name: "green",                dark: "#a6e3a1", light: "#40a02b" },
    { name: "teal",                 dark: "#94e2d5", light: "#179299" },
    { name: "sky",                  dark: "#89dceb", light: "#04a5e5" },
    { name: "sapphire",            dark: "#74c7ec", light: "#209fb5" },
    { name: "blue",                 dark: "#89b4fa", light: "#1e66f5" },
    { name: "lavender",             dark: "#b4befe", light: "#7287fd" }
  ]
})
```

### 3b. Typography Collection

```
mcp__open-pencil__create_variable_collection({
  name: "Typography",
  variables: [
    { name: "text-2xs",  value: 11 },
    { name: "text-xs",   value: 12 },
    { name: "text-sm",   value: 13 },
    { name: "text-base", value: 14 },
    { name: "text-md",   value: 16 },
    { name: "text-lg",   value: 18 },
    { name: "text-xl",   value: 20 },
    { name: "text-2xl",  value: 24 },
    { name: "text-3xl",  value: 30 },
    { name: "text-4xl",  value: 36 },
    { name: "text-5xl",  value: 48 }
  ]
})
```

### 3c. Spacing Collection

```
mcp__open-pencil__create_variable_collection({
  name: "Spacing",
  variables: [
    { name: "space-0",    value: 0 },
    { name: "space-px",   value: 1 },
    { name: "space-0.5",  value: 2 },
    { name: "space-1",    value: 4 },
    { name: "space-1.5",  value: 6 },
    { name: "space-2",    value: 8 },
    { name: "space-2.5",  value: 10 },
    { name: "space-3",    value: 12 },
    { name: "space-4",    value: 16 },
    { name: "space-5",    value: 20 },
    { name: "space-6",    value: 24 },
    { name: "space-8",    value: 32 },
    { name: "space-10",   value: 40 },
    { name: "space-12",   value: 48 },
    { name: "space-16",   value: 64 },
    { name: "space-20",   value: 80 },
    { name: "space-24",   value: 96 },
    { name: "space-32",   value: 128 },
    { name: "space-40",   value: 160 },
    { name: "space-48",   value: 192 },
    { name: "space-64",   value: 256 }
  ]
})
```

### 3d. Radius Collection

```
mcp__open-pencil__create_variable_collection({
  name: "Radius",
  variables: [
    { name: "radius-none", value: 0 },
    { name: "radius-sm",   value: 4 },
    { name: "radius-md",   value: 8 },
    { name: "radius-lg",   value: 12 },
    { name: "radius-xl",   value: 16 },
    { name: "radius-2xl",  value: 24 },
    { name: "radius-full", value: 9999 }
  ]
})
```

### 3e. Shadows Collection

```
mcp__open-pencil__create_variable_collection({
  name: "Shadows",
  variables: [
    { name: "shadow-xs",       value: "0 1px 2px rgba(0,0,0,0.3)" },
    { name: "shadow-sm",       value: "0 1px 3px rgba(0,0,0,0.4)" },
    { name: "shadow-md",       value: "0 4px 12px rgba(0,0,0,0.5)" },
    { name: "shadow-lg",       value: "0 8px 24px rgba(0,0,0,0.6)" },
    { name: "shadow-xl",       value: "0 12px 36px rgba(0,0,0,0.65)" },
    { name: "shadow-floating", value: "0 16px 48px rgba(0,0,0,0.7)" },
    { name: "shadow-inset",    value: "inset 0 1px 3px rgba(0,0,0,0.3)" },
    { name: "shadow-ring",     value: "0 0 0 3px rgba(203,166,247,0.4)" }
  ]
})
```

## Step 4: Create Color Swatch Visualizations

Create visual rectangles on the canvas for each color group.

### Dark Theme Background Swatches (Row 1, Y=100)

For each color, create a rectangle with the fill color, plus a text label.

```
// Background group
mcp__open-pencil__create_rectangle({
  x: 100, y: 100, width: 120, height: 80,
  fill: "#1e1e2e", cornerRadius: 8,
  name: "background"
})
mcp__open-pencil__create_text({
  x: 100, y: 190, content: "background\n#1e1e2e",
  fontSize: 11, fill: "#cdd6f4"
})

mcp__open-pencil__create_rectangle({
  x: 240, y: 100, width: 120, height: 80,
  fill: "#252537", cornerRadius: 8,
  name: "bg-surface"
})
mcp__open-pencil__create_text({
  x: 240, y: 190, content: "surface\n#252537",
  fontSize: 11, fill: "#cdd6f4"
})

mcp__open-pencil__create_rectangle({
  x: 380, y: 100, width: 120, height: 80,
  fill: "#2d2d44", cornerRadius: 8,
  name: "bg-elevated"
})
mcp__open-pencil__create_text({
  x: 380, y: 190, content: "elevated\n#2d2d44",
  fontSize: 11, fill: "#cdd6f4"
})

mcp__open-pencil__create_rectangle({
  x: 520, y: 100, width: 120, height: 80,
  fill: "#36365a", cornerRadius: 8,
  name: "bg-overlay"
})
mcp__open-pencil__create_text({
  x: 520, y: 190, content: "overlay\n#36365a",
  fontSize: 11, fill: "#cdd6f4"
})

mcp__open-pencil__create_rectangle({
  x: 660, y: 100, width: 120, height: 80,
  fill: "#1a1a2e", cornerRadius: 8,
  name: "bg-input"
})
mcp__open-pencil__create_text({
  x: 660, y: 190, content: "input\n#1a1a2e",
  fontSize: 11, fill: "#cdd6f4"
})
```

### Continue for all other color groups...

(Repeat the pattern above for Primary, Secondary, Accent, Destructive,
Semantic, Sidebar, and Extended Catppuccin palette rows.)

## Step 5: Save File

```
mcp__open-pencil__save_file({
  path: "/Users/zeizel/projects/notesaner/designs/notesaner-tokens.fig"
})
```
