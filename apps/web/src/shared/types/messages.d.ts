/**
 * Type-safe message keys for next-intl.
 *
 * This declaration merges the English message JSON structure into
 * next-intl's `Messages` interface, enabling full autocompletion
 * and type checking when using `useTranslations()`, `getTranslations()`,
 * and `t()` calls throughout the application.
 *
 * When the shape of `messages/en.json` changes, TypeScript will
 * automatically pick up the updated types.
 *
 * @see https://next-intl.dev/docs/workflows/typescript
 */

import type messages from '../../../messages/en.json';

type Messages = typeof messages;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
