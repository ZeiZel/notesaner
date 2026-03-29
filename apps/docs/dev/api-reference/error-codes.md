---
title: Error Codes Reference
description: Complete error code table with resolution guidance.
---

# Error Codes Reference

## HTTP Status Codes

| Status | Meaning                                 |
| ------ | --------------------------------------- |
| `200`  | Success                                 |
| `201`  | Created                                 |
| `204`  | No Content (successful delete)          |
| `400`  | Bad Request — invalid input             |
| `401`  | Unauthorized — missing or invalid token |
| `403`  | Forbidden — insufficient permissions    |
| `404`  | Not Found                               |
| `409`  | Conflict — duplicate resource           |
| `422`  | Unprocessable Entity — validation error |
| `429`  | Too Many Requests — rate limited        |
| `500`  | Internal Server Error                   |

## Application Error Codes

| Error Code                      | HTTP | Description                              | Resolution              |
| ------------------------------- | ---- | ---------------------------------------- | ----------------------- |
| `AUTH_INVALID_TOKEN`            | 401  | JWT is invalid or expired                | Re-authenticate         |
| `AUTH_TOKEN_REVOKED`            | 401  | Token has been revoked                   | Re-authenticate         |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403  | User lacks required role                 | Contact workspace admin |
| `NOTE_NOT_FOUND`                | 404  | Note ID does not exist                   | Verify the note ID      |
| `NOTE_ALREADY_EXISTS`           | 409  | Note with same title/path already exists | Use a different title   |
| `WORKSPACE_NOT_FOUND`           | 404  | Workspace ID does not exist              | Verify workspace ID     |
| `WORKSPACE_MEMBER_LIMIT`        | 403  | Workspace has reached member limit       | Upgrade plan            |
| `PLUGIN_NOT_FOUND`              | 404  | Plugin not found in registry             | Check plugin ID         |
| `STORAGE_QUOTA_EXCEEDED`        | 403  | Workspace storage limit reached          | Delete files or upgrade |
| `RATE_LIMIT_EXCEEDED`           | 429  | Too many requests                        | Wait and retry          |
| `VALIDATION_ERROR`              | 422  | Request body failed validation           | Check error details     |
