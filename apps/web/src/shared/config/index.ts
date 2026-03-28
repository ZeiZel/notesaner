/**
 * shared/config — Application configuration and design-system providers.
 */

// Ant Design integration
export { AntdProvider } from './antd-provider';
export { getAntdTheme, getAntdDarkTheme, getAntdLightTheme } from './antd-theme';

// Environment
export { clientEnv, getServerEnv, isDevelopment, isProduction } from './env';

// Internationalization
export {
  locales,
  defaultLocale,
  localeMetadata,
  messageNamespaces,
  getLocaleDirection,
  isSupportedLocale,
  type Locale,
  type LocaleMetadata,
  type MessageNamespace,
} from './i18n';
