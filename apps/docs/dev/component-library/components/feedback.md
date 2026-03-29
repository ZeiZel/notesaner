---
title: Feedback Components
description: Alert, Badge, Spinner, Toast.
---

# Feedback Components

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Alert

```tsx
import { Alert } from '@notesaner/ui';

<Alert type="success" message="Note saved successfully" />
<Alert type="error" message="Failed to sync" description="Check your connection" />
<Alert type="warning" message="Storage quota at 90%" closable />
```

## Badge

```tsx
<Badge count={42} />
<Badge status="success" text="Connected" />
<Badge status="error" text="Offline" />
```

## Spinner

```tsx
<Spinner size="sm" />
<Spinner size="lg" label="Loading notes..." />
```

## Toast

```tsx
import { toast } from '@notesaner/ui';

toast.success('Note saved');
toast.error('Failed to delete note');
toast.info('Sync in progress...');
```
