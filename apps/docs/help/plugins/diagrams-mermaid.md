---
title: Diagrams (Mermaid)
description: Render Mermaid diagrams inside code blocks.
---

# Diagrams (Mermaid)

The Mermaid plugin automatically renders Mermaid code blocks as interactive diagrams.

## Supported Diagram Types

- Flowcharts
- Sequence diagrams
- Gantt charts
- Class diagrams
- State diagrams
- Entity-relationship diagrams
- Git graphs
- Mind maps

## Usage

Create a code block with the `mermaid` language:

````markdown
```mermaid
flowchart LR
    A[Start] --> B{Decision}
    B -- Yes --> C[Action 1]
    B -- No --> D[Action 2]
    C --> E[End]
    D --> E
```
````

## Exporting Diagrams

Click a rendered diagram and select **Export as PNG** or **Export as SVG**.
