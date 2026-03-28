import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { useState } from 'react';
import { CommandPalette, type CommandPaletteAction } from '../components/command-palette';
import { Button } from '../components/button';

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the palette is visible',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text in the search input',
    },
  },
  // Render in fullscreen layout since the palette is fixed-position
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;

type Story = StoryObj<typeof meta>;

const sampleActions: CommandPaletteAction[] = [
  {
    id: 'new-note',
    label: 'New Note',
    description: 'Create a new empty note',
    group: 'Notes',
    shortcut: ['Ctrl', 'N'],
    onSelect: fn(),
  },
  {
    id: 'open-note',
    label: 'Open Note',
    description: 'Open an existing note',
    group: 'Notes',
    shortcut: ['Ctrl', 'O'],
    onSelect: fn(),
  },
  {
    id: 'search',
    label: 'Search Notes',
    description: 'Full-text search across all notes',
    group: 'Notes',
    shortcut: ['Ctrl', 'Shift', 'F'],
    keywords: ['find', 'lookup'],
    onSelect: fn(),
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar panel',
    group: 'View',
    shortcut: ['Ctrl', 'B'],
    onSelect: fn(),
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    description: 'Switch between light and dark mode',
    group: 'View',
    onSelect: fn(),
  },
  {
    id: 'graph-view',
    label: 'Open Graph View',
    description: 'Visualize note connections',
    group: 'View',
    shortcut: ['Ctrl', 'G'],
    onSelect: fn(),
  },
  {
    id: 'export-md',
    label: 'Export as Markdown',
    description: 'Download the current note as .md',
    group: 'Export',
    onSelect: fn(),
  },
  {
    id: 'export-pdf',
    label: 'Export as PDF',
    description: 'Download the current note as .pdf',
    group: 'Export',
    onSelect: fn(),
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Open application settings',
    group: 'Application',
    shortcut: ['Ctrl', ','],
    onSelect: fn(),
  },
];

// Default open state
export const Default: Story = {
  args: {
    open: true,
    onClose: fn(),
    actions: sampleActions,
    placeholder: 'Type a command or search...',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '600px', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};

// Interactive: toggle open/close
export const Interactive: Story = {
  args: {
    open: false,
    onClose: fn(),
    actions: sampleActions,
  },
  render: function InteractiveStory() {
    const [open, setOpen] = useState(false);

    return (
      <div style={{ padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <p style={{ fontSize: '13px', opacity: 0.7 }}>
            Click the button or press Ctrl+K to open the command palette.
          </p>
          <Button onClick={() => setOpen(true)}>Open Command Palette</Button>
        </div>
        <CommandPalette open={open} onClose={() => setOpen(false)} actions={sampleActions} />
      </div>
    );
  },
};

// With icons
export const WithIcons: Story = {
  args: {
    open: true,
    onClose: fn(),
    actions: [
      {
        id: 'new-note',
        label: 'New Note',
        description: 'Create a new empty note',
        group: 'Notes',
        shortcut: ['Ctrl', 'N'],
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        ),
        onSelect: fn(),
      },
      {
        id: 'search',
        label: 'Search',
        description: 'Search across all notes',
        group: 'Notes',
        shortcut: ['Ctrl', 'F'],
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        ),
        onSelect: fn(),
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Application settings',
        group: 'Application',
        shortcut: ['Ctrl', ','],
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
        onSelect: fn(),
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ height: '500px', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};

// With disabled items
export const WithDisabledItems: Story = {
  args: {
    open: true,
    onClose: fn(),
    actions: [
      {
        id: 'new-note',
        label: 'New Note',
        group: 'Notes',
        onSelect: fn(),
      },
      {
        id: 'publish',
        label: 'Publish Note',
        description: 'Publish to your blog (requires Pro plan)',
        group: 'Notes',
        disabled: true,
        onSelect: fn(),
      },
      {
        id: 'collaborate',
        label: 'Start Collaboration',
        description: 'Invite others to edit (requires Pro plan)',
        group: 'Collaboration',
        disabled: true,
        onSelect: fn(),
      },
      {
        id: 'settings',
        label: 'Settings',
        group: 'Application',
        onSelect: fn(),
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ height: '500px', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};

// Empty state
export const EmptyActions: Story = {
  args: {
    open: true,
    onClose: fn(),
    actions: [],
    placeholder: 'No commands available...',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '400px', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};
