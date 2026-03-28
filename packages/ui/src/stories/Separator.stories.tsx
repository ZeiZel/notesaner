import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from '../components/separator';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Orientation of the separator line',
    },
    decorative: {
      control: 'boolean',
      description: 'When true, the separator is purely visual and hidden from assistive technology',
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

// Default horizontal separator
export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
};

// Horizontal with content sections
export const HorizontalWithContent: Story = {
  render: () => (
    <div style={{ width: '400px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Note Properties</h3>
        <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
          Metadata associated with this note.
        </p>
      </div>
      <Separator style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>Created</span>
          <span>Mar 15, 2026</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>Modified</span>
          <span>Mar 28, 2026</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>Words</span>
          <span>1,284</span>
        </div>
      </div>
      <Separator style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>Backlinks</span>
          <span>5</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ opacity: 0.7 }}>Tags</span>
          <span>3</span>
        </div>
      </div>
    </div>
  ),
};

// Vertical separator
export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', height: '32px', gap: '16px' }}>
      <span style={{ fontSize: '13px' }}>Notes</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: '13px' }}>Graphs</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: '13px' }}>Tags</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: '13px' }}>Search</span>
    </div>
  ),
};

// Sidebar-style layout
export const SidebarLayout: Story = {
  render: () => (
    <div style={{ width: '240px', fontSize: '13px' }}>
      <div
        style={{
          fontWeight: 600,
          padding: '8px 0',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          opacity: 0.5,
        }}
      >
        Vault
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>All Notes</div>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>Recent</div>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>Favorites</div>
      </div>
      <Separator style={{ margin: '12px 0' }} />
      <div
        style={{
          fontWeight: 600,
          padding: '8px 0',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          opacity: 0.5,
        }}
      >
        Tags
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>#react</div>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>
          #architecture
        </div>
        <div style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer' }}>#personal</div>
      </div>
    </div>
  ),
};
