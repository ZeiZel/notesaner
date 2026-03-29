---
title: Frontend Standards (FSD + React 19)
description: FSD layers, component patterns, Zustand vs useState rules, and Ant Design usage.
---

# Frontend Standards (FSD + React 19)

## FSD Layer Rules

Follow the import direction strictly:

```
app → pages → widgets → features → entities → shared
```

Higher layers import from lower layers, never the reverse. This is enforced by NX dependency constraints.

## State Management Rules

| State Type                                 | Tool                       |
| ------------------------------------------ | -------------------------- |
| Server data (notes, workspace)             | TanStack Query             |
| Global business state (auth, current note) | Zustand                    |
| UI state (modal open, hover, focus)        | `useState` + React Context |
| Form state                                 | React Hook Form            |

**Never use Zustand for UI state. Never use TanStack Query for global business state.**

## Component Rules

- Use Ant Design components as the primary UI library
- Use `Box` instead of `<div>` or `<span>`
- Never use raw HTML elements (`<button>`, `<input>`, etc.) — use Ant Design or `packages/ui`
- Keep components under 200 lines; extract to sub-components if needed
- Co-locate component styles in `.module.css` files next to the component

## HTTP Rules

- Always use `axios` (never `fetch`)
- Wrap API calls in TanStack Query factories from `libs/query-factory`
- Handle loading and error states in every component that fetches

## useEffect Rules

Minimize `useEffect`. It's allowed for:

- DOM side effects (focus, scroll)
- Third-party library integration
- WebSocket subscriptions

It's NOT allowed for:

- Data fetching (use TanStack Query)
- State synchronization (use derived state or Zustand selectors)
- Responding to state changes that should trigger other state changes

## Performance

- Use `useMemo` and `useCallback` only when profiling shows a bottleneck
- Avoid premature optimization
- Use React DevTools Profiler to identify actual issues
