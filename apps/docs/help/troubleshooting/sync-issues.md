---
title: Sync Not Working
description: Troubleshoot real-time sync and offline sync issues.
---

# Sync Not Working

## Check Your Connection

The sync indicator in the top-right corner shows connection status:

- **Green dot**: Connected and synced
- **Yellow dot**: Reconnecting
- **Red dot**: Offline — changes queued locally

## Force Reconnect

Click the sync indicator → **Reconnect** to force a WebSocket reconnection.

## Conflict After Offline Edit

If you edited notes while offline and the merge result looks wrong, check [Note History](/help/user-guide/notes-folders/history) to restore a previous version.

## Large File Sync Timeout

Files larger than 10 MB may time out during initial sync. Try uploading attachments via the Attachment Manager instead of drag-drop for large files.

## Contact Support

If sync is consistently broken, [contact support](/help/troubleshooting/contact-support) and include:

- Your browser and OS version
- The browser console error log (F12 → Console)
