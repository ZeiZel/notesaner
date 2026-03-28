import type { Preview } from '@storybook/react';

// Import the main stylesheet which includes Tailwind CSS and design tokens
import '../src/styles/main.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      values: [
        {
          name: 'Dark (Catppuccin Mocha)',
          value: '#1e1e2e',
        },
        {
          name: 'Light (Catppuccin Latte)',
          value: '#eff1f5',
        },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'dark';
      // Apply the theme to the document so CSS custom properties resolve
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;

      return (
        <div
          data-theme={theme}
          style={{
            backgroundColor: theme === 'dark' ? '#1e1e2e' : '#eff1f5',
            color: theme === 'dark' ? '#cdd6f4' : '#4c4f69',
            padding: '2rem',
            minHeight: '100px',
            borderRadius: '8px',
            fontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
