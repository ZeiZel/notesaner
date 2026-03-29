---
title: Navigation Components
description: Tabs, Breadcrumb, Sidebar navigation components.
---

# Navigation Components

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Tabs

```tsx
<Tabs
  items={[
    { key: 'notes', label: 'Notes', children: <NotesList /> },
    { key: 'graph', label: 'Graph', children: <GraphView /> },
  ]}
  activeKey={activeTab}
  onChange={setActiveTab}
/>
```

## Breadcrumb

```tsx
<Breadcrumb
  items={[
    { title: 'Workspace', href: '/workspace' },
    { title: 'Projects', href: '/workspace/projects' },
    { title: 'Alpha' },
  ]}
/>
```
