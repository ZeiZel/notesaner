/**
 * shared/config — Application configuration and design-system providers.
 */

// Ant Design integration
export { AntdProvider } from './antd-provider';
export { getAntdTheme, getAntdDarkTheme, getAntdLightTheme } from './antd-theme';

// Environment
export { clientEnv, getServerEnv, isDevelopment, isProduction } from './env';
